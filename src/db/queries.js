// Helper query SQLite — promisified wrapper di atas sqlite3 (callback -> async/await).
// get:   SELECT satu baris (undefined kalau tidak ada)
// all:   SELECT banyak baris (array)
// run:   INSERT/UPDATE/DELETE -> resolve { lastID, changes }
// exec:  jalankan SQL mentah (untuk migration/skema)
const db = require('./connection');

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { get, all, run, exec };