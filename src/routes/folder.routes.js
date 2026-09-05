const express = require('express');
const { body, validationResult } = require('express-validator');

const { all, get, run } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticateToken);

// Ambil semua folder milik user
router.get('/', asyncHandler(async (req, res) => {
  const folders = await all(
    `SELECT id, name, parent_id, created_at
     FROM folders
     WHERE user_id = ?
     ORDER BY name ASC`,
    [req.user.id]
  );
  res.json(folders);
}));

// Buat folder / subfolder baru
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Nama folder diperlukan'),
    body('parent_id').optional({ nullable: true }).isInt().withMessage('Parent ID harus berupa angka'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, parent_id } = req.body;

    // Validasi: parent (jika ada) harus milik user yang sama
    if (parent_id) {
      const parent = await get('SELECT id FROM folders WHERE id = ? AND user_id = ?', [parent_id, req.user.id]);
      if (!parent) {
        return res.status(400).json({ error: 'Folder parent tidak ditemukan' });
      }
    }

    const { lastID } = await run(
      'INSERT INTO folders (name, user_id, parent_id) VALUES (?, ?, ?)',
      [name, req.user.id, parent_id || null]
    );

    res.status(201).json({
      id: lastID,
      name,
      parent_id: parent_id || null,
      message: 'Folder berhasil dibuat',
    });
  })
);

// Update nama / pindahkan folder
router.put(
  '/:id',
  [
    body('name').notEmpty().withMessage('Nama folder diperlukan'),
    body('parent_id').optional({ nullable: true }).isInt().withMessage('Parent ID harus berupa angka'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const folderId = req.params.id;
    const { name, parent_id } = req.body;

    // Pastikan folder milik user
    const folder = await get('SELECT id FROM folders WHERE id = ? AND user_id = ?', [folderId, req.user.id]);
    if (!folder) {
      return res.status(404).json({ error: 'Folder tidak ditemukan' });
    }

    // Kalau pindah parent: tidak boleh ke diri sendiri, parent harus milik user
    if (parent_id) {
      if (parent_id == folderId) {
        return res.status(400).json({ error: 'Folder tidak bisa menjadi parent dari dirinya sendiri' });
      }
      const parent = await get('SELECT id FROM folders WHERE id = ? AND user_id = ?', [parent_id, req.user.id]);
      if (!parent) {
        return res.status(400).json({ error: 'Folder parent tidak ditemukan' });
      }
    }

    const { changes } = await run(
      'UPDATE folders SET name = ?, parent_id = ? WHERE id = ? AND user_id = ?',
      [name, parent_id || null, folderId, req.user.id]
    );
    if (changes === 0) {
      return res.status(404).json({ error: 'Folder tidak ditemukan' });
    }

    res.json({ message: 'Folder berhasil diupdate' });
  })
);

// Hapus folder (CASCADE hapus subfolder + bookmark di dalamnya)
router.delete('/:id', asyncHandler(async (req, res) => {
  const folderId = req.params.id;

  const folder = await get('SELECT id FROM folders WHERE id = ? AND user_id = ?', [folderId, req.user.id]);
  if (!folder) {
    return res.status(404).json({ error: 'Folder tidak ditemukan' });
  }

  const { changes } = await run('DELETE FROM folders WHERE id = ? AND user_id = ?', [folderId, req.user.id]);
  if (changes === 0) {
    return res.status(404).json({ error: 'Folder tidak ditemukan' });
  }

  res.json({ message: 'Folder berhasil dihapus' });
}));

module.exports = router;