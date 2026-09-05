const express = require('express');
const { body, validationResult } = require('express-validator');
const { nanoid } = require('nanoid');

const { all, get, run } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { runPaginated } = require('../utils/paginate');

const router = express.Router();

// Semua route link butuh auth
router.use(authenticateToken);

// Ambil semua tautan + statistik (tanpa query param -> array penuh, kompat mode lama)
router.get('/', asyncHandler(async (req, res) => {
  const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined;

  // Tanpa param pagination: kembalikan array penuh (perilaku lama) — dipakai
  // dashboard utk statistik & hal lain yang butuh semua data.
  if (!hasPaging) {
    const rows = await all('SELECT * FROM links ORDER BY created_at DESC');
    return res.json(rows);
  }

  const data = await runPaginated(require('../db/queries'), {
    table: 'links',
    columns: '*',
    searchCols: ['original_url', 'short_code'],
    allowedSortMap: {
      created_at: 'created_at',
      click_count: 'click_count',
      original_url: 'original_url',
    },
    defaultSort: 'created_at',
    q: req.query.search || '',
    sort: req.query.sort || '',
    order: req.query.order || '',
    page: parseInt(req.query.page, 10) || 1,
    pageSize: parseInt(req.query.pageSize, 10) || 10,
  });

  res.json(data);
}));

// Statistik global (Total Tautan, Total Klik, Rata-rata) — dipakai kartu dashboard
router.get('/stats', asyncHandler(async (req, res) => {
  const row = await get('SELECT COUNT(*) AS total, COALESCE(SUM(click_count),0) AS clicks FROM links');
  res.json({
    totalLinks: row.total,
    totalClicks: row.clicks,
    avgClicks: row.total > 0 ? Math.round(row.clicks / row.total) : 0,
  });
}));

// Buat tautan pendek baru (bisa custom alias)
router.post(
  '/',
  [body('url').isURL().withMessage('URL tidak valid')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { url, customAlias } = req.body;
    const shortCode = customAlias || nanoid(8);

    if (customAlias) {
      const existing = await get('SELECT id FROM links WHERE short_code = ?', [customAlias]);
      if (existing) {
        return res.status(400).json({ error: 'Alias sudah digunakan' });
      }
    }

    const { lastID } = await run('INSERT INTO links (original_url, short_code) VALUES (?, ?)', [url, shortCode]);

    res.json({
      id: lastID,
      shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
      shortCode,
      originalUrl: url,
    });
  })
);

// Edit URL asli tautan
router.put(
  '/:id',
  [body('originalUrl').isURL().withMessage('URL tidak valid')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'URL tidak valid' });
    }

    const { id } = req.params;
    const { originalUrl } = req.body;

    const { changes } = await run('UPDATE links SET original_url = ? WHERE id = ?', [originalUrl, id]);
    if (changes === 0) {
      return res.status(404).json({ error: 'Tautan tidak ditemukan' });
    }

    res.json({ message: 'Tautan berhasil diperbarui' });
  })
);

// Hapus tautan
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { changes } = await run('DELETE FROM links WHERE id = ?', [id]);
  if (changes === 0) {
    return res.status(404).json({ error: 'Tautan tidak ditemukan' });
  }
  res.json({ message: 'Tautan berhasil dihapus' });
}));

module.exports = router;
