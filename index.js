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
const PORT = process.env.PORT || 4000;
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

// ===== FOLDER MANAGEMENT ENDPOINTS =====

// GET /api/admin/folders - Mendapatkan semua folder
app.get('/api/admin/folders', authenticateToken, (req, res) => {
    const query = `
        SELECT id, name, parent_id, created_at 
        FROM folders 
        WHERE user_id = ? 
        ORDER BY name ASC
    `;
    
    db.all(query, [req.user.id], (err, folders) => {
        if (err) {
            console.error('Error fetching folders:', err);
            return res.status(500).json({ error: 'Gagal mengambil data folder' });
        }
        res.json(folders);
    });
});

// POST /api/admin/folders - Membuat folder baru
app.post('/api/admin/folders', authenticateToken, [
    body('name').notEmpty().withMessage('Nama folder diperlukan'),
    body('parent_id').optional({ nullable: true }).isInt().withMessage('Parent ID harus berupa angka')
], (req, res) => {
    console.log('POST /api/admin/folders - Request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, parent_id } = req.body;
    
    // Jika parent_id ada, pastikan folder parent milik user yang sama
    if (parent_id) {
        const checkParentQuery = 'SELECT id FROM folders WHERE id = ? AND user_id = ?';
        db.get(checkParentQuery, [parent_id, req.user.id], (err, parentFolder) => {
            if (err) {
                console.error('Error checking parent folder:', err);
                return res.status(500).json({ error: 'Gagal memeriksa folder parent' });
            }
            
            if (!parentFolder) {
                console.log('Parent folder not found:', parent_id);
                return res.status(400).json({ error: 'Folder parent tidak ditemukan' });
            }
            
            // Insert folder baru
            insertFolder();
        });
    } else {
        insertFolder();
    }
    
    function insertFolder() {
        const insertQuery = `
            INSERT INTO folders (name, user_id, parent_id) 
            VALUES (?, ?, ?)
        `;
        
        console.log('Inserting folder:', { name, user_id: req.user.id, parent_id: parent_id || null });
        
        db.run(insertQuery, [name, req.user.id, parent_id || null], function(err) {
            if (err) {
                console.error('Error creating folder:', err);
                return res.status(500).json({ error: 'Gagal membuat folder' });
            }
            
            console.log('Folder created successfully with ID:', this.lastID);
            
            res.status(201).json({
                id: this.lastID,
                name,
                parent_id: parent_id || null,
                message: 'Folder berhasil dibuat'
            });
        });
    }
});

// PUT /api/admin/folders/:id - Mengupdate folder
app.put('/api/admin/folders/:id', authenticateToken, [
    body('name').notEmpty().withMessage('Nama folder diperlukan'),
    body('parent_id').optional().isInt().withMessage('Parent ID harus berupa angka')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const folderId = req.params.id;
    const { name, parent_id } = req.body;
    
    // Pastikan folder milik user yang sedang login
    const checkOwnerQuery = 'SELECT id FROM folders WHERE id = ? AND user_id = ?';
    db.get(checkOwnerQuery, [folderId, req.user.id], (err, folder) => {
        if (err) {
            console.error('Error checking folder ownership:', err);
            return res.status(500).json({ error: 'Gagal memeriksa kepemilikan folder' });
        }
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder tidak ditemukan' });
        }
        
        // Jika parent_id ada, pastikan folder parent milik user yang sama dan bukan dirinya sendiri
        if (parent_id) {
            if (parent_id == folderId) {
                return res.status(400).json({ error: 'Folder tidak bisa menjadi parent dari dirinya sendiri' });
            }
            
            const checkParentQuery = 'SELECT id FROM folders WHERE id = ? AND user_id = ?';
            db.get(checkParentQuery, [parent_id, req.user.id], (err, parentFolder) => {
                if (err) {
                    console.error('Error checking parent folder:', err);
                    return res.status(500).json({ error: 'Gagal memeriksa folder parent' });
                }
                
                if (!parentFolder) {
                    return res.status(400).json({ error: 'Folder parent tidak ditemukan' });
                }
                
                updateFolder();
            });
        } else {
            updateFolder();
        }
        
        function updateFolder() {
            const updateQuery = `
                UPDATE folders 
                SET name = ?, parent_id = ? 
                WHERE id = ? AND user_id = ?
            `;
            
            db.run(updateQuery, [name, parent_id || null, folderId, req.user.id], function(err) {
                if (err) {
                    console.error('Error updating folder:', err);
                    return res.status(500).json({ error: 'Gagal mengupdate folder' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Folder tidak ditemukan' });
                }
                
                res.json({ message: 'Folder berhasil diupdate' });
            });
        }
    });
});

// DELETE /api/admin/folders/:id - Menghapus folder
app.delete('/api/admin/folders/:id', authenticateToken, (req, res) => {
    const folderId = req.params.id;
    
    // Pastikan folder milik user yang sedang login
    const checkOwnerQuery = 'SELECT id FROM folders WHERE id = ? AND user_id = ?';
    db.get(checkOwnerQuery, [folderId, req.user.id], (err, folder) => {
        if (err) {
            console.error('Error checking folder ownership:', err);
            return res.status(500).json({ error: 'Gagal memeriksa kepemilikan folder' });
        }
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder tidak ditemukan' });
        }
        
        // Hapus folder (CASCADE akan menghapus subfolder dan bookmark)
        const deleteQuery = 'DELETE FROM folders WHERE id = ? AND user_id = ?';
        db.run(deleteQuery, [folderId, req.user.id], function(err) {
            if (err) {
                console.error('Error deleting folder:', err);
                return res.status(500).json({ error: 'Gagal menghapus folder' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Folder tidak ditemukan' });
            }
            
            res.json({ message: 'Folder berhasil dihapus' });
        });
    });
});

// ===== BOOKMARK MANAGEMENT ENDPOINTS =====

// GET /api/admin/bookmarks - Mendapatkan semua bookmark
app.get('/api/admin/bookmarks', authenticateToken, (req, res) => {
    const folderId = req.query.folder_id;
    
    let query = `
        SELECT b.id, b.title, b.original_url, b.folder_id, b.created_at,
               f.name as folder_name
        FROM bookmarks b
        LEFT JOIN folders f ON b.folder_id = f.id
        WHERE b.user_id = ?
    `;
    
    const params = [req.user.id];
    
    // Add folder filter if folder_id is provided
    if (folderId) {
        query += ' AND b.folder_id = ?';
        params.push(folderId);
    }
    
    query += ' ORDER BY b.title ASC';
    
    db.all(query, params, (err, bookmarks) => {
        if (err) {
            console.error('Error fetching bookmarks:', err);
            return res.status(500).json({ error: 'Gagal mengambil data bookmark' });
        }
        res.json(bookmarks);
    });
});

// POST /api/admin/bookmarks - Membuat bookmark baru
app.post('/api/admin/bookmarks', authenticateToken, [
    body('title').notEmpty().withMessage('Judul bookmark diperlukan'),
    body('original_url').isURL().withMessage('URL tidak valid'),
    body('folder_id').isInt().withMessage('Folder ID diperlukan')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, original_url, folder_id } = req.body;
    
    // Pastikan folder milik user yang sedang login
    const checkFolderQuery = 'SELECT id FROM folders WHERE id = ? AND user_id = ?';
    db.get(checkFolderQuery, [folder_id, req.user.id], (err, folder) => {
        if (err) {
            console.error('Error checking folder ownership:', err);
            return res.status(500).json({ error: 'Gagal memeriksa folder' });
        }
        
        if (!folder) {
            return res.status(400).json({ error: 'Folder tidak ditemukan' });
        }
        
        // Insert bookmark baru
        const insertQuery = `
            INSERT INTO bookmarks (title, original_url, folder_id, user_id) 
            VALUES (?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [title, original_url, folder_id, req.user.id], function(err) {
            if (err) {
                console.error('Error creating bookmark:', err);
                return res.status(500).json({ error: 'Gagal membuat bookmark' });
            }
            
            res.status(201).json({
                id: this.lastID,
                title,
                original_url,
                folder_id,
                message: 'Bookmark berhasil dibuat'
            });
        });
    });
});

// PUT /api/admin/bookmarks/:id - Mengupdate bookmark
app.put('/api/admin/bookmarks/:id', authenticateToken, [
    body('title').notEmpty().withMessage('Judul bookmark diperlukan'),
    body('original_url').isURL().withMessage('URL tidak valid'),
    body('folder_id').isInt().withMessage('Folder ID diperlukan')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const bookmarkId = req.params.id;
    const { title, original_url, folder_id } = req.body;
    
    // Pastikan bookmark milik user yang sedang login
    const checkOwnerQuery = 'SELECT id FROM bookmarks WHERE id = ? AND user_id = ?';
    db.get(checkOwnerQuery, [bookmarkId, req.user.id], (err, bookmark) => {
        if (err) {
            console.error('Error checking bookmark ownership:', err);
            return res.status(500).json({ error: 'Gagal memeriksa kepemilikan bookmark' });
        }
        
        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
        }
        
        // Pastikan folder milik user yang sedang login
        const checkFolderQuery = 'SELECT id FROM folders WHERE id = ? AND user_id = ?';
        db.get(checkFolderQuery, [folder_id, req.user.id], (err, folder) => {
            if (err) {
                console.error('Error checking folder ownership:', err);
                return res.status(500).json({ error: 'Gagal memeriksa folder' });
            }
            
            if (!folder) {
                return res.status(400).json({ error: 'Folder tidak ditemukan' });
            }
            
            // Update bookmark
            const updateQuery = `
                UPDATE bookmarks 
                SET title = ?, original_url = ?, folder_id = ? 
                WHERE id = ? AND user_id = ?
            `;
            
            db.run(updateQuery, [title, original_url, folder_id, bookmarkId, req.user.id], function(err) {
                if (err) {
                    console.error('Error updating bookmark:', err);
                    return res.status(500).json({ error: 'Gagal mengupdate bookmark' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
                }
                
                res.json({ message: 'Bookmark berhasil diupdate' });
            });
        });
    });
});

// DELETE /api/admin/bookmarks/:id - Menghapus bookmark
app.delete('/api/admin/bookmarks/:id', authenticateToken, (req, res) => {
    const bookmarkId = req.params.id;
    
    // Pastikan bookmark milik user yang sedang login
    const checkOwnerQuery = 'SELECT id FROM bookmarks WHERE id = ? AND user_id = ?';
    db.get(checkOwnerQuery, [bookmarkId, req.user.id], (err, bookmark) => {
        if (err) {
            console.error('Error checking bookmark ownership:', err);
            return res.status(500).json({ error: 'Gagal memeriksa kepemilikan bookmark' });
        }
        
        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
        }
        
        // Hapus bookmark
        const deleteQuery = 'DELETE FROM bookmarks WHERE id = ? AND user_id = ?';
        db.run(deleteQuery, [bookmarkId, req.user.id], function(err) {
            if (err) {
                console.error('Error deleting bookmark:', err);
                return res.status(500).json({ error: 'Gagal menghapus bookmark' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
            }
            
            res.json({ message: 'Bookmark berhasil dihapus' });
        });
    });
});

// GET /api/admin/bookmarks-tree - Mendapatkan struktur tree folder dan bookmark
app.get('/api/admin/bookmarks-tree', authenticateToken, (req, res) => {
    // Fungsi rekursif untuk membangun tree structure
    function buildTree(folders, bookmarks, parentId = null) {
        const tree = [];
        
        // Filter folder berdasarkan parent_id
        const childFolders = folders.filter(folder => folder.parent_id === parentId);
        
        childFolders.forEach(folder => {
            const folderNode = {
                id: folder.id,
                name: folder.name,
                type: 'folder',
                parent_id: folder.parent_id,
                created_at: folder.created_at,
                children: [],
                bookmarks: []
            };
            
            // Tambahkan subfolder secara rekursif
            folderNode.children = buildTree(folders, bookmarks, folder.id);
            
            // Tambahkan bookmark yang ada di folder ini
            folderNode.bookmarks = bookmarks.filter(bookmark => bookmark.folder_id === folder.id);
            
            tree.push(folderNode);
        });
        
        return tree;
    }
    
    // Query untuk mendapatkan semua folder user
    const foldersQuery = `
        SELECT id, name, parent_id, created_at 
        FROM folders 
        WHERE user_id = ? 
        ORDER BY name ASC
    `;
    
    // Query untuk mendapatkan semua bookmark user
    const bookmarksQuery = `
        SELECT id, title, original_url, folder_id, created_at
        FROM bookmarks 
        WHERE user_id = ? 
        ORDER BY title ASC
    `;
    
    // Eksekusi kedua query secara paralel
    db.all(foldersQuery, [req.user.id], (err, folders) => {
        if (err) {
            console.error('Error fetching folders for tree:', err);
            return res.status(500).json({ error: 'Gagal mengambil data folder' });
        }
        
        db.all(bookmarksQuery, [req.user.id], (err, bookmarks) => {
            if (err) {
                console.error('Error fetching bookmarks for tree:', err);
                return res.status(500).json({ error: 'Gagal mengambil data bookmark' });
            }
            
            // Bangun tree structure
            const tree = buildTree(folders, bookmarks);
            
            // Tambahkan bookmark yang tidak memiliki folder (orphaned bookmarks)
            const orphanedBookmarks = bookmarks.filter(bookmark => 
                !folders.some(folder => folder.id === bookmark.folder_id)
            );
            
            res.json({
                tree: tree,
                orphaned_bookmarks: orphanedBookmarks,
                total_folders: folders.length,
                total_bookmarks: bookmarks.length
            });
        });
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