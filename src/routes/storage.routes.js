const express = require('express');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { all, get, run } = require('../db/queries');
const config = require('../config');
const storage = require('../services/storage.service');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxFileBytes, files: 1 },
});

function uploadErrorHandler(error, req, res, next) {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Ukuran file melebihi batas storage' });
  next(error);
}

function validateVisibility(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
}

function publicFileShape(row) {
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const files = await all('SELECT id, original_name, mime_type, size_bytes, visibility, created_at, updated_at FROM storage_files WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ files: files.map(publicFileShape) });
}));

router.post('/upload', authenticateToken, upload.single('file'), uploadErrorHandler, [body('visibility').optional().isIn(['private', 'public'])], validateVisibility, asyncHandler(async (req, res) => {
  if (!storage.isConfigured()) return res.status(503).json({ error: 'S3 storage belum dikonfigurasi' });
  if (!req.file) return res.status(400).json({ error: 'File wajib dipilih' });
  const visibility = req.body.visibility || 'private';
  const objectKey = storage.createObjectKey(req.user.id, req.file.originalname);
  try {
    await storage.uploadObject({ key: objectKey, body: req.file.buffer, contentType: req.file.mimetype });
    const result = await run('INSERT INTO storage_files (object_key, original_name, mime_type, size_bytes, visibility, user_id) VALUES (?, ?, ?, ?, ?, ?)', [objectKey, req.file.originalname, req.file.mimetype, req.file.size, visibility, req.user.id]);
    const file = await get('SELECT id, original_name, mime_type, size_bytes, visibility, created_at, updated_at FROM storage_files WHERE id = ?', [result.lastID]);
    res.status(201).json({ file: publicFileShape(file) });
  } catch (error) {
    try { await storage.deleteObject(objectKey); } catch (_) {}
    throw error;
  }
}));

router.patch('/:id/visibility', authenticateToken, [param('id').isInt(), body('visibility').isIn(['private', 'public'])], validateVisibility, asyncHandler(async (req, res) => {
  const result = await run('UPDATE storage_files SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [req.body.visibility, req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'File tidak ditemukan' });
  res.json({ message: 'Access berhasil diubah' });
}));

router.post('/:id/share', authenticateToken, [param('id').isInt()], validateVisibility, asyncHandler(async (req, res) => {
  const file = await get('SELECT id, visibility FROM storage_files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan' });
  if (file.visibility !== 'public') return res.status(400).json({ error: 'Ubah access ke public sebelum membuat share link' });
  const share = storage.createShareToken();
  await run('UPDATE storage_files SET share_token_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [share.hash, file.id]);
  res.json({ shareUrl: `${req.protocol}://${req.get('host')}/drive/share/${share.token}` });
}));

router.delete('/:id', authenticateToken, [param('id').isInt()], validateVisibility, asyncHandler(async (req, res) => {
  const file = await get('SELECT object_key FROM storage_files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan' });
  await storage.deleteObject(file.object_key);
  await run('DELETE FROM storage_files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'File dihapus' });
}));

router.get('/:id/preview', authenticateToken, [param('id').isInt()], validateVisibility, asyncHandler(async (req, res) => {
  const file = await get('SELECT * FROM storage_files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan' });
  res.json({ previewUrl: await storage.createPreviewUrl(file.object_key, file.mime_type, file.original_name) });
}));

module.exports = router;