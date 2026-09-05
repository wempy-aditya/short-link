const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

const db = new sqlite3.Database(config.dbPath);

module.exports = db;