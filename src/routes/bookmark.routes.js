const express = require('express');
const { body, validationResult } = require('express-validator');

const { all, get, run } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticateToken);

// Bangun struktur tree folder + bookmark secara rekursif
function buildTree(folders, bookmarks, parentId = null) {
  const tree = [];
  const childFolders = folders.filter((f) => f.parent_id === parentId);

  for (const folder of childFolders) {
    const folderNode = {
      id: folder.id,
      name: folder.name,
      type: 'folder',
      parent_id: folder.parent_id,
      created_at: folder.created_at,
      children: [],
      bookmarks: [],
    };
    folderNode.children = buildTree(folders, bookmarks, folder.id);
    folderNode.bookmarks = bookmarks.filter((b) => b.folder_id === folder.id);
    tree.push(folderNode);
  }
  return tree;
}

// Ambil seluruh struktur folder + bookmark (tree)
// NOTE: endpoint asli = /api/admin/bookmarks-tree (dash) — didefinisikan di
// bookmarkTree.routes.js, BUKAN di sini. Path dipanggil frontend dashboard.html.

// Ambil bookmark (filter opsional per folder)
router.get('/', asyncHandler(async (req, res) => {
  const { folder_id } = req.query;

  let query = `
    SELECT b.id, b.title, b.original_url, b.folder_id, b.created_at,
           f.name as folder_name
    FROM bookmarks b
    LEFT JOIN folders f ON b.folder_id = f.id
    WHERE b.user_id = ?
  `;
  const params = [req.user.id];

  if (folder_id) {
    query += ' AND b.folder_id = ?';
    params.push(folder_id);
  }
  query += ' ORDER BY b.title ASC';

  const bookmarks = await all(query, params);
  res.json(bookmarks);
}));

// Buat bookmark baru
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Judul bookmark diperlukan'),
    body('original_url').isURL().withMessage('URL tidak valid'),
    body('folder_id').isInt().withMessage('Folder ID diperlukan'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, original_url, folder_id } = req.body;

    const folder = await get('SELECT id FROM folders WHERE id = ? AND user_id = ?', [folder_id, req.user.id]);
    if (!folder) {
      return res.status(400).json({ error: 'Folder tidak ditemukan' });
    }

    const { lastID } = await run(
      'INSERT INTO bookmarks (title, original_url, folder_id, user_id) VALUES (?, ?, ?, ?)',
      [title, original_url, folder_id, req.user.id]
    );

    res.status(201).json({
      id: lastID,
      title,
      original_url,
      folder_id,
      message: 'Bookmark berhasil dibuat',
    });
  })
);

// Update bookmark (edit / pindah folder)
router.put(
  '/:id',
  [
    body('title').notEmpty().withMessage('Judul bookmark diperlukan'),
    body('original_url').isURL().withMessage('URL tidak valid'),
    body('folder_id').isInt().withMessage('Folder ID diperlukan'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bookmarkId = req.params.id;
    const { title, original_url, folder_id } = req.body;

    const bookmark = await get('SELECT id FROM bookmarks WHERE id = ? AND user_id = ?', [bookmarkId, req.user.id]);
    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
    }

    const folder = await get('SELECT id FROM folders WHERE id = ? AND user_id = ?', [folder_id, req.user.id]);
    if (!folder) {
      return res.status(400).json({ error: 'Folder tidak ditemukan' });
    }

    const { changes } = await run(
      'UPDATE bookmarks SET title = ?, original_url = ?, folder_id = ? WHERE id = ? AND user_id = ?',
      [title, original_url, folder_id, bookmarkId, req.user.id]
    );
    if (changes === 0) {
      return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
    }

    res.json({ message: 'Bookmark berhasil diupdate' });
  })
);

// Hapus bookmark
router.delete('/:id', asyncHandler(async (req, res) => {
  const bookmarkId = req.params.id;

  const bookmark = await get('SELECT id FROM bookmarks WHERE id = ? AND user_id = ?', [bookmarkId, req.user.id]);
  if (!bookmark) {
    return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
  }

  const { changes } = await run('DELETE FROM bookmarks WHERE id = ? AND user_id = ?', [bookmarkId, req.user.id]);
  if (changes === 0) {
    return res.status(404).json({ error: 'Bookmark tidak ditemukan' });
  }

  res.json({ message: 'Bookmark berhasil dihapus' });
}));

module.exports = router;