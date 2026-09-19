const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

let db = new sqlite3.Database(config.dbPath);

function getDb() {
  return db;
}

function closeDb() {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

function reopenDb() {
  db = new sqlite3.Database(config.dbPath);
  return db;
}

module.exports = { getDb, closeDb, reopenDb };