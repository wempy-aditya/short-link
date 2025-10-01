const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const path = require('path');

// Import nanoid using dynamic import
let nanoid;
(async () => {
    const nanoidModule = await import('nanoid');
    nanoid = nanoidModule.nanoid;
})();

const { db, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Middleware untuk autentikasi JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Validasi URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// RUTE PUBLIK

// Halaman utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API untuk memendekkan URL (publik)
app.post('/api/shorten', [
    body('url').isURL().withMessage('URL tidak valid')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { url } = req.body;
    
    // Wait for nanoid to be loaded
    if (!nanoid) {
        return res.status(500).json({ error: 'Server sedang memuat, coba lagi sebentar' });
    }
    
    const shortCode = nanoid(8);
    
    db.run(
        'INSERT INTO links (original_url, short_code) VALUES (?, ?)',
        [url, shortCode],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Gagal menyimpan tautan' });
            }
            
             res.json({
                 shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
                 shortCode: shortCode
             });
         }
     );
});

// Redirect tautan pendek ke URL asli
app.get('/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    
    // Skip jika ini adalah rute admin atau API
    if (shortCode === 'admin' || shortCode === 'api') {
        return res.status(404).send('Not Found');
    }

    db.get('SELECT * FROM links WHERE short_code = ?', [shortCode], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Server Error');
        }
        
        if (!row) {
            return res.status(404).send('Tautan tidak ditemukan');
        }

        // Update click count
        db.run('UPDATE links SET click_count = click_count + 1 WHERE id = ?', [row.id]);
        
        // Redirect ke URL asli
        res.redirect(301, row.original_url);
    });
});

// RUTE ADMIN

// Halaman login admin
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// Halaman dashboard admin
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// API login admin
app.post('/api/admin/login', [
    body('username').notEmpty().withMessage('Username diperlukan'),
    body('password').notEmpty().withMessage('Password diperlukan')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Username dan password diperlukan' });
    }

    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Terjadi kesalahan server' });
        }

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Username atau password salah' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, message: 'Login berhasil' });
    });
});

// API mendapatkan semua tautan (admin)
app.get('/api/admin/links', authenticateToken, (req, res) => {
    db.all('SELECT * FROM links ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Terjadi kesalahan server' });
        }
        
        res.json(rows);
    });
});

// API membuat tautan baru (admin)
app.post('/api/admin/links', authenticateToken, [
    body('url').isURL().withMessage('URL tidak valid')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { url, customAlias } = req.body;
    
    // Wait for nanoid to be loaded
    if (!nanoid) {
        return res.status(500).json({ error: 'Server sedang memuat, coba lagi sebentar' });
    }
    
    let shortCode = customAlias || nanoid(8);
    
    // Check if custom alias already exists
    if (customAlias) {
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM links WHERE short_code = ?', [customAlias], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (existing) {
            return res.status(400).json({ error: 'Alias sudah digunakan' });
        }
    }
    
    db.run(
        'INSERT INTO links (original_url, short_code) VALUES (?, ?)',
        [url, shortCode],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Gagal menyimpan tautan' });
            }
            
            res.json({
                id: this.lastID,
                shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
                shortCode: shortCode,
                originalUrl: url
            });
        }
    );
});

// API mengedit tautan (admin)
app.put('/api/admin/links/:id', authenticateToken, [
    body('originalUrl').isURL().withMessage('URL tidak valid')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'URL tidak valid' });
    }

    const { id } = req.params;
    const { originalUrl } = req.body;

    db.run('UPDATE links SET original_url = ? WHERE id = ?', [originalUrl, id], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Terjadi kesalahan server' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Tautan tidak ditemukan' });
        }

        res.json({ message: 'Tautan berhasil diperbarui' });
    });
});

// API menghapus tautan (admin)
app.delete('/api/admin/links/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM links WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Terjadi kesalahan server' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Tautan tidak ditemukan' });
        }

        res.json({ message: 'Tautan berhasil dihapus' });
    });
});

// Inisialisasi database dan jalankan server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server berjalan di http://localhost:${PORT}`);
        console.log('Database berhasil diinisialisasi');
    });
}).catch(err => {
    console.error('Gagal menginisialisasi database:', err);
    process.exit(1);
});