const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const {
  stageRestore,
  getStagedRestore,
  activateStagedRestore,
  exportDatabase,
} = require('../services/backup.service');

const router = express.Router();
router.use(authenticateToken);

router.get('/backup', asyncHandler(async (req, res) => {
  const backup = await exportDatabase();
  res.download(backup.path, backup.filename, { maxAge: 0 }, (error) => {
    if (error && !res.headersSent) res.status(500).json({ error: 'Gagal mengirim backup' });
  });
}));

router.get('/restore/staged', asyncHandler(async (req, res) => {
  res.json({ restore: await getStagedRestore() });
}));

router.post('/restore/stage', asyncHandler(async (req, res) => {
  const originalName = req.headers['x-backup-filename'] || 'uploaded.db';
  const restore = await stageRestore(req.body, originalName);
  res.status(201).json({ message: 'Backup lolos validasi dan siap diaktifkan', restore });
}));

router.post('/restore/activate', [body('stagedName').isString().notEmpty()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Nama staged restore diperlukan' });
  const result = await activateStagedRestore(req.body.stagedName);
  res.json({ message: 'Restore aktif. Semua sesi lama sudah dibatalkan.', ...result });
}));

module.exports = router;