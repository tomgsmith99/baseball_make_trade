require('dotenv').config()

var mysql = require('mysql')

/**************************************/

exports.mysql_conn = function() {

	var con = mysql.createConnection({
		host: process.env.mysql_host,
		user: process.env.mysql_user,
		password: process.env.mysql_pwd,
		database: "baseball",
		port: parseInt(process.env.mysql_port)
	})

	con.connect(function(err) {
		if (err) throw err
		console.log("Connected to mysql database!");
	})

	return con
}
