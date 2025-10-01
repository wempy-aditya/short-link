const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Buat database SQLite
const dbPath = path.join(__dirname, 'shortlink.db');
const db = new sqlite3.Database(dbPath);

// Inisialisasi database dengan tabel yang diperlukan
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Tabel users untuk admin
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )`, (err) => {
                if (err) {
                    console.error('Error creating users table:', err);
                    reject(err);
                    return;
                }
                console.log('Users table created successfully');
            });

            // Tabel links untuk menyimpan tautan
            db.run(`CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                short_code TEXT UNIQUE NOT NULL,
                original_url TEXT NOT NULL,
                click_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating links table:', err);
                    reject(err);
                    return;
                }
                console.log('Links table created successfully');
            });

            // Buat user admin default jika belum ada
            const defaultUsername = 'admin';
            const defaultPassword = 'admin123';
            
            db.get('SELECT * FROM users WHERE username = ?', [defaultUsername], (err, row) => {
                if (err) {
                    console.error('Error checking admin user:', err);
                    reject(err);
                    return;
                }
                
                if (!row) {
                    // Hash password dan buat user admin
                    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
                    db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
                        [defaultUsername, hashedPassword], (err) => {
                        if (err) {
                            console.error('Error creating admin user:', err);
                            reject(err);
                            return;
                        }
                        console.log('Default admin user created successfully');
                        console.log('Username: admin, Password: admin123');
                        resolve();
                    });
                } else {
                    console.log('Admin user already exists');
                    resolve();
                }
            });
        });
    });
}

module.exports = {
    db,
    initializeDatabase
};