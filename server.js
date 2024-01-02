'use strict';
var socketio = require("socket.io");
var http = require('http');
var fs = require('fs');
const path = require('node:path');
var mysql = require('mysql');

var port = process.env.PORT || 1337;

const mimeTypes = {
	'.ico': 'image/x-icon',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword'
};

var con = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "ccat123",
	port: 3306,
	database: "ccatdb"
});

con.connect(function(err) {
	if(err) throw err;
	console.log("Connected to db!");
	con.query("SET NAMES 'utf8mb4';");
	const httpServer = http.createServer(function(req, res) {
		var ext = "";
		function respond(err, data) {
			res.writeHead(data ? 200 : 404, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
			res.write(data || `404 Not Found: ${err}`);
			return res.end();
		}
		fs.stat(path.join("./", req.url), (err, stats) => {
			if(err) {
				respond(err);
				return;
			}
			var url = path.join("./", req.url);
			console.log(err, stats, url);
			if(stats.isDirectory()) url = path.join(url, "/index.html");
			ext = path.extname(url);
			fs.readFile(url, respond);
		});
	});

	const io = new socketio.Server(httpServer, {
		// options
	});

	io.on("connection", (socket) => {
		socket.on("message-history", () => {
			con.query("SELECT * FROM messages", function(err, result, fields) {
				socket.emit("debug", JSON.stringify({ err: err, result: result, fields: fields }));
				result.forEach(r => {
					socket.emit(r.channel, r.message, r.id);
				});
			});
		});
		socket.on("delete-message", id => {
			var sql = `DELETE FROM messages WHERE id = ${id}`;
			con.query(sql, function(err, result) {
				socket.emit("debug", JSON.stringify({ err: err, result: result }));
				io.emit("delete-message", id);
			});
		});
		socket.on("debug", (pwd, payload, isJs) => {
			if(pwd != "ccat123") return;
			if(isJs) {
				socket.emit("debug", JSON.stringify((new Function(payload))()));
			} else {
				con.query(payload, function(...args) {
					socket.emit("debug", JSON.stringify(args));
				});
			}
		});
		socket.use(([event, ...args], next) => {
			if(["message-history", "delete-message", "debug"].includes(event)) {
				next();
				return;
			}
			if(["typing"].includes(event)) {
				io.emit(event, ...args);
				next();
				return;
			}
			var sql = "INSERT INTO messages (channel, message) VALUES ?";
			var values = [[event, args[0] || '']];
			con.query(sql, [values], function(err, result) {
				socket.emit("debug", JSON.stringify({ err: err, result: result }));
				if(!err) io.emit(event, args.shift(), result.insertId, ...args);
			});
			next();
		});
	});


	httpServer.listen(1337);
});
