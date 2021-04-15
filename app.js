
const express = require('express')
var session = require('express-session')
let mustacheExpress = require('mustache-express')

/*************************************************/

var dbconn = require('./dbconn.js')

var con = dbconn.mysql_conn()

/*************************************************/

const app = express()

app.use(express.json());

app.engine('html', mustacheExpress());

app.set('view engine', 'html');

app.set('views', `${__dirname}/views`);

app.use(session({
	secret: process.env.session_secret,
	resave: false,
	saveUninitialized: true
}))

/*************************************************/

const port = process.env.PORT || 3000

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})

const season = 2021

/*************************************************/

app.get('/favicon.ico', (req, res) => {
	res.sendStatus(200)
	return
})

app.get('/', (req, res) => {

	var obj = {}

	// check for valid session

	if ("authenticated" in req.session && req.session.authenticated == true) {
		obj.authenticated = true
		console.log("the user is authenticated")
	}
	else {
		obj.authenticated = false
		console.log("the user is not authenticated")
		res.render ('base', obj)
		return
	}

	let query = `SELECT * FROM ownersXseasons_current_view ORDER BY lnf`

	console.log(query)

	con.query(query, function (err, owners) {

		if (err) {
			console.log(err)
			res.json(err)
			return
		}

		obj.owners = owners

		res.render ('base', obj);
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

app.get('/api/players/:player_id/current', (req, res) => {

	var player_id = req.params.player_id
	console.log(player_id)

	const query = `SELECT * FROM players_current_view WHERE player_id=${player_id}`

	con.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}

		console.log(data)

		res.json(data[0])
	})
})

app.get('/api/owners/:owner_id', (req, res) => {

	const owner_id = req.params.owner_id

	let query = `SELECT * FROM owners`
	query += ` WHERE owner_id=${owner_id}`

	console.log(query)

	con.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}
		res.json(data[0])
	})
})

app.get('/api/owners/:owner_id/current', (req, res) => {

	const owner_id = req.params.owner_id

	let query = `SELECT * FROM ownersXseasons_current_view`
	query += ` WHERE owner_id=${owner_id}`

	console.log(query)

	con.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}
		res.json(data[0])
	})
})

app.get('/api/owners/:owner_id/team', (req, res) => {

	const owner_id = req.params.owner_id

	let query = `SELECT * FROM ownersXrosters_current_view AS osx, position_order AS p`
	query += ` WHERE osx.owner_id=${owner_id} AND osx.pos = p.pos ORDER BY p.o ASC`
	query += `, osx.lnf ASC`

	console.log(query)

	con.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}
		res.json(data)
	})
})

app.get('/api/seasons/current/players?*', (req, res) => {

	const max_salary = req.query.max_salary
	const owner_id = req.query.owner_id
	const pos = req.query.pos

	let query = `SELECT * FROM players_current_view WHERE salary <= ${max_salary}`
	query += ` AND pos = '${pos}' AND player_id NOT IN (SELECT player_id FROM ownersXrosters_current_view WHERE owner_id = ${owner_id}) ORDER BY salary DESC`

	console.log(query)

	con.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}
		res.json(data)
	})
})

app.get('/session/clear', (req, res) => {

	delete req.session.authenticated

	res.json({"status": "ok"})
})

/*************************************************/
/* POST */

app.post('/api/trades', (req, res) => {

	if (!("authenticated" in req.session && req.session.authenticated)) {
		res.sendStatus(403)
		return
	}

	console.dir(req.body)

	const owner_id = req.body.owner_id
	const dropped_player_id = req.body.dropped_player_id
	const added_player_id = req.body.added_player_id

	let query = `SELECT salary, points FROM players_current WHERE player_id = ${added_player_id}`

	console.log(query)

	con.query(query, function (err, data) {
		if (err) {
			console.log(err)
			res.json(err)
			return
		}

		added_player_salary = data[0].salary
		added_player_points = data[0].points

		console.log(`added_player_salary: ${added_player_salary}`)

		query = `SELECT salary FROM players_current WHERE player_id = ${dropped_player_id}`

		con.query(query, function (err, data) {
			if (err) {
				console.log(err)
				res.json(err)
				return
			}

			dropped_player_salary = data[0].salary

			console.log(`dropped_player_salary: ${dropped_player_salary}`)

			let d = dayOfYear(new Date())

			query = `INSERT INTO ownersXrosters_current SET owner_id = ${owner_id}, player_id = ${added_player_id}, start_date = ${d}, acquired = 1, prev_points = ${added_player_points}`

			console.log(query)

			con.query(query, function (err, data) {
				if (err) {
					console.log(err)
					res.json(err)
					return
				}

				query = `UPDATE ownersXrosters_current SET bench_date = ${d}, benched = 1 WHERE owner_id = ${owner_id} AND player_id = ${dropped_player_id}`

				console.log(query)

				con.query(query, function (err, data) {
					if (err) {
						console.log(err)
						res.json(err)
						return
					}

					if (added_player_salary > dropped_player_salary) {

						let d = added_player_salary - dropped_player_salary

						query = `UPDATE ownersXseasons_current SET bank = (bank - ${d}) WHERE owner_id = ${owner_id}`

						console.log(query)

						con.query(query, function (err, data) {
							if (err) {
								console.log(err)
								res.json(err)
								return
							}

							res.json({status: "ok"})
						})
					}
					else {
						res.json({status: "ok"})
					}
				})
			})
		})
	})
})

app.post('/authenticate', (req, res) => {

	const password = req.body.password

	console.log("the password is: " + password)

	if (password.toLowerCase() == process.env.group_password.toLowerCase()) {
		req.session.authenticated = true

		res.json({"status": "ok"})
	}
	else {
		res.json({"status": "error"})
	}
})

const dayOfYear = date =>
  Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
