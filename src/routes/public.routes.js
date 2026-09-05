const express = require('express');
const { body, validationResult } = require('express-validator');
const { nanoid } = require('nanoid');
const path = require('path');

const config = require('../config');
const { run, get } = require('../db/queries');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Halaman utama (pemendek tautan publik)
router.get('/', (req, res) => {
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

// API memendekkan URL (publik)
router.post(
  '/api/shorten',
  [body('url').isURL().withMessage('URL tidak valid')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { url } = req.body;
    const shortCode = nanoid(8);
    await run('INSERT INTO links (original_url, short_code) VALUES (?, ?)', [url, shortCode]);

    res.json({
      shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
      shortCode,
    });
  })
);

// Redirect tautan pendek ke URL asli
router.get('/:shortCode', asyncHandler(async (req, res) => {
  const { shortCode } = req.params;

  // Skip jika ini rute admin atau API
  if (shortCode === 'admin' || shortCode === 'api') {
    return res.status(404).send('Not Found');
  }

  const row = await get('SELECT * FROM links WHERE short_code = ?', [shortCode]);
  if (!row) {
    return res.status(404).send('Tautan tidak ditemukan');
  }

  await run('UPDATE links SET click_count = click_count + 1 WHERE id = ?', [row.id]);
  res.redirect(301, row.original_url);
}));

module.exports = router;