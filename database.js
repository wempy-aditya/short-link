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

            // Tabel folders untuk sistem bookmark
            db.run(`CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                parent_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating folders table:', err);
                    reject(err);
                    return;
                }
                console.log('Folders table created successfully');
            });

            // Tabel bookmarks untuk menyimpan bookmark
            db.run(`CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                original_url TEXT NOT NULL,
                folder_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating bookmarks table:', err);
                    reject(err);
                    return;
                }
                console.log('Bookmarks table created successfully');
            });

            // Tabel notes untuk menyimpan catatan
            db.run(`CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content_html TEXT,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating notes table:', err);
                    reject(err);
                    return;
                }
                console.log('Notes table created successfully');
            });

            // Tabel markdown_docs untuk menyimpan dokumen markdown
            db.run(`CREATE TABLE IF NOT EXISTS markdown_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content_md TEXT NOT NULL DEFAULT '',
                content_html TEXT DEFAULT '',
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating markdown_docs table:', err);
                    reject(err);
                    return;
                }
                console.log('Markdown docs table created successfully');
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