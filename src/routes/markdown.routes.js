const express = require('express');
const { body, validationResult } = require('express-validator');

const { all, get, run } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { runPaginated } = require('../utils/paginate');

const router = express.Router();

router.use(authenticateToken);

// Ambil dokumen: tanpa query param -> array penuh (kompat mode lama, tanpa konten berat);
// dengan page/pageSize -> { rows, total, ... } (server-side pagination/search/sort)
router.get('/', asyncHandler(async (req, res) => {
  const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined;

  if (!hasPaging) {
    const docs = await all(
      `SELECT id, title, created_at, updated_at
       FROM markdown_docs
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    return res.json(docs);
  }

  const data = await runPaginated(require('../db/queries'), {
    table: 'markdown_docs',
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

// Ambil satu dokumen lengkap
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await get(
    'SELECT id, title, content_md, content_html, created_at, updated_at FROM markdown_docs WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!doc) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  }
  res.json(doc);
}));

// Buat dokumen baru
router.post(
  '/',
  [body('title').notEmpty().withMessage('Judul dokumen diperlukan')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { title, content_md } = req.body;
    const { lastID } = await run(
      'INSERT INTO markdown_docs (title, content_md, user_id) VALUES (?, ?, ?)',
      [title, content_md || '', req.user.id]
    );

    res.status(201).json({
      id: lastID,
      title,
      content_md: content_md || '',
      message: 'Dokumen berhasil dibuat',
    });
  })
);

// Update dokumen
router.put(
  '/:id',
  [body('title').notEmpty().withMessage('Judul dokumen diperlukan')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const docId = req.params.id;
    const { title, content_md, content_html } = req.body;

    const doc = await get('SELECT id FROM markdown_docs WHERE id = ? AND user_id = ?', [docId, req.user.id]);
    if (!doc) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }

    const { changes } = await run(
      `UPDATE markdown_docs
       SET title = ?, content_md = ?, content_html = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [title, content_md || '', content_html || '', docId, req.user.id]
    );
    if (changes === 0) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }

    res.json({ message: 'Dokumen berhasil diupdate' });
  })
);

// Hapus dokumen
router.delete('/:id', asyncHandler(async (req, res) => {
  const docId = req.params.id;

  const doc = await get('SELECT id FROM markdown_docs WHERE id = ? AND user_id = ?', [docId, req.user.id]);
  if (!doc) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  }

  const { changes } = await run('DELETE FROM markdown_docs WHERE id = ? AND user_id = ?', [docId, req.user.id]);
  if (changes === 0) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  }

  res.json({ message: 'Dokumen berhasil dihapus' });
}));

module.exports = router;
