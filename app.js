
const express = require('express')
var session = require('express-session')
let mustacheExpress = require('mustache-express')

/*************************************************/

var dbconn = require('./dbconn.js')

/*************************************************/

const app = express()

app.use(express.json())

app.engine('html', mustacheExpress())

app.set('view engine', 'html')

app.use(session({
	secret: process.env.session_secret,
	resave: false,
	saveUninitialized: true
}))

/*************************************************/

const port = process.env.PORT || 3000

app.listen(port, () => {
	console.log(`app listening at http://localhost:${port}`)
})

const todaysDate = new Date()
const season = todaysDate.getFullYear()

const dayOfYear = date =>
  Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);

/*************************************************/

app.get('/favicon.ico', (req, res) => {
	res.sendStatus(200)
	return
})

app.get('/', (req, res) => {

	var obj = {
		api_base: process.env.API_BASE,
		home_base: process.env.API_BASE
	}

	// check for valid session

	if ("authenticated" in req.session && req.session.authenticated == true) {
		obj.authenticated = true
		console.log("the user is authenticated")
	}
	else {
		obj.authenticated = false
		console.log("the user is not authenticated")
		res.render ('index', obj)
		return
	}

	let query = `SELECT owner_id, nickname, season FROM owner_x_season_detail WHERE season = ${season} ORDER BY nickname ASC`

	console.log(query)

	var connection = dbconn.mysql_conn()

	connection.query(query, function (err, owners) {

		if (err) {
			console.log(err)
			res.json(err)
			return
		}

		obj.owners = owners

		res.render ('index', obj)

		// connection.end(function(err) {
		// 	console.log("terminated mysql connection.")
		// })
	})
})

app.get('/authenticated', (req, res) => {
	if ("authenticated" in req.session && req.session.authenticated == true) {
		res.json({"authenticated": true})
	}
	else {
		res.json({"authenticated": false})
	}
})

app.get('/session/clear', (req, res) => {

	delete req.session.authenticated

	res.json({"status": "ok"})
})

/*************************************************/
/* POST */

app.post('/trade', (req, res) => {

	if (!("authenticated" in req.session && req.session.authenticated)) {
		res.sendStatus(403)
		return
	}

	console.dir(req.body)

	const owner_id = req.body.owner_id
	const dropped_player_id = req.body.dropped_player_id
	const added_player_id = req.body.added_player_id

	let query = `SELECT salary, points FROM player_x_season WHERE player_id = ${added_player_id} AND season = ${season}`

	console.log(query)

	var connection = dbconn.mysql_conn()

	connection.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}

		added_player_salary = data[0].salary
		added_player_points = data[0].points

		console.log(`added_player_salary: ${added_player_salary}`)

		query = `SELECT salary FROM player_x_season WHERE player_id = ${dropped_player_id} AND season = ${season}`

		connection.query(query, function (err, data) {
			if (err) {
				console.log(err)
				res.json(err)
				return
			}

			dropped_player_salary = data[0].salary

			console.log(`dropped_player_salary: ${dropped_player_salary}`)

			let d = dayOfYear(new Date())

			query = `INSERT INTO owner_x_player SET owner_id = ${owner_id}, player_id = ${added_player_id}, start_date = ${d}, bench_date = 0, prev_points = ${added_player_points}, season=${season}`

			console.log(query)

			connection.query(query, function (err, data) {
				if (err) {
					console.log(err)
					res.json(err)
					return
				}

				query = `UPDATE owner_x_player SET bench_date = ${d} WHERE owner_id = ${owner_id} AND player_id = ${dropped_player_id} AND season = ${season}`

				console.log(query)

				connection.query(query, function (err, data) {
					if (err) {
						console.log(err)
						res.json(err)
						return
					}

					// calculate salary difference
					let diff = 0

					if (added_player_salary > dropped_player_salary) {
						diff = added_player_salary - dropped_player_salary
					}

					query = `UPDATE owner_x_season SET bank = (bank - ${diff}) WHERE owner_id = ${owner_id} AND season = ${season}`

					console.log(query)

					connection.query(query, function (err, data) {
						if (err) {
							console.log(err)
							res.json(err)
							return
						}

						query = `INSERT INTO trades SET owner_id=${owner_id}, dropped_player_id=${dropped_player_id}, added_player_id=${added_player_id}, season=${season}, day=${d}`

						console.log(query)

						connection.query(query, function (err, data) {
							if (err) {
								console.log(err)
								res.json(err)
								return
							}
							res.sendStatus(200)

							connection.end(function(err) {
								console.log("terminated mysql connection.")
							})
						})
					})
				})
			})
		})
	})
})

app.post('/authenticate', (req, res) => {

	const password = req.body.password

	console.log("the password is: " + password)

	if (password.toLowerCase() == process.env.group_password.toLowerCase() || password.toLowerCase() == process.env.group_password_alt.toLowerCase()) {
		req.session.authenticated = true

		res.json({"status": "ok"})
	}
	else {
		res.json({"status": "error"})
	}
})

