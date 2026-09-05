const express = require('express');
const { body, validationResult } = require('express-validator');

const { all, get, run } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { runPaginated } = require('../utils/paginate');

const router = express.Router();

router.use(authenticateToken);

// Ambil catatan: tanpa query param -> array penuh (kompat mode lama, tanpa content_html);
// dengan page/pageSize -> { rows, total, ... } (server-side pagination/search/sort)
router.get('/', asyncHandler(async (req, res) => {
  const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined;

  if (!hasPaging) {
    const notes = await all(
      `SELECT id, title, created_at, updated_at
       FROM notes
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    return res.json(notes);
  }

  const data = await runPaginated(require('../db/queries'), {
    table: 'notes',
    columns: 'id, title, created_at, updated_at',
    searchCols: ['title'],
    allowedSortMap: {
      updated_at: 'updated_at',
      created_at: 'created_at',
      title: 'title',
    },
    defaultSort: 'updated_at',
    baseWhere: 'user_id = ?',
    baseParams: [req.user.id],
    q: req.query.search || '',
    sort: req.query.sort || '',
    order: req.query.order || '',
    page: parseInt(req.query.page, 10) || 1,
    pageSize: parseInt(req.query.pageSize, 10) || 10,
  });

  res.json(data);
}));

// Ambil satu catatan lengkap (dipakai saat edit/read — lazy load konten)
router.get('/:id', asyncHandler(async (req, res) => {
  const note = await get(
    'SELECT id, title, content_html, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!note) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan' });
  }
  res.json(note);
}));

// Buat catatan baru
router.post(
  '/',
  [body('title').notEmpty().withMessage('Judul catatan diperlukan')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { title, content_html } = req.body;
    const { lastID } = await run(
      'INSERT INTO notes (title, content_html, user_id) VALUES (?, ?, ?)',
      [title, content_html || '', req.user.id]
    );

    res.status(201).json({
      id: lastID,
      title,
      content_html: content_html || '',
      message: 'Catatan berhasil dibuat',
    });
  })
);

// Update catatan
router.put(
  '/:id',
  [body('title').notEmpty().withMessage('Judul catatan diperlukan')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const noteId = req.params.id;
    const { title, content_html } = req.body;

    const note = await get('SELECT id FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);
    if (!note) {
      return res.status(404).json({ error: 'Catatan tidak ditemukan' });
    }

    const { changes } = await run(
      `UPDATE notes
       SET title = ?, content_html = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [title, content_html || '', noteId, req.user.id]
    );
    if (changes === 0) {
      return res.status(404).json({ error: 'Catatan tidak ditemukan' });
    }

    res.json({ message: 'Catatan berhasil diupdate' });
  })
);

// Hapus catatan
router.delete('/:id', asyncHandler(async (req, res) => {
  const noteId = req.params.id;

  const note = await get('SELECT id FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);
  if (!note) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan' });
  }

  const { changes } = await run('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);
  if (changes === 0) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan' });
  }

  res.json({ message: 'Catatan berhasil dihapus' });
}));

module.exports = router;
