const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { all, get, run } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticateToken);

function errors(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) return res.status(400).json({ error: result.array()[0].msg });
  next();
}

router.get('/', asyncHandler(async (req, res) => {
  const profile = await get('SELECT display_name, bio, avatar_url, theme FROM linktree_profiles WHERE user_id = ?', [req.user.id]);
  const links = await all('SELECT id, title, url, icon, visible, sort_order FROM linktree_links WHERE user_id = ? ORDER BY sort_order ASC, id ASC', [req.user.id]);
  res.json({ profile: profile || { display_name: '', bio: '', avatar_url: '', theme: 'ocean' }, links });
}));

router.put('/profile', [
  body('displayName').isLength({ max: 80 }).withMessage('Nama maksimal 80 karakter'),
  body('bio').optional().isLength({ max: 240 }).withMessage('Bio maksimal 240 karakter'),
  body('avatarUrl').optional({ values: 'falsy' }).isURL().withMessage('Avatar URL tidak valid'),
  body('theme').optional().isIn(['ocean', 'ink', 'forest', 'sunset']).withMessage('Tema tidak valid'),
], errors, asyncHandler(async (req, res) => {
  const { displayName, bio = '', avatarUrl = '', theme = 'ocean' } = req.body;
  await run(`INSERT INTO linktree_profiles (user_id, display_name, bio, avatar_url, theme) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, bio=excluded.bio, avatar_url=excluded.avatar_url, theme=excluded.theme, updated_at=CURRENT_TIMESTAMP`, [req.user.id, displayName.trim(), bio.trim(), avatarUrl.trim(), theme]);
  res.json({ message: 'Profile Linktree tersimpan' });
}));

router.post('/links', [
  body('title').isLength({ min: 1, max: 80 }).withMessage('Judul link wajib, maksimal 80 karakter'),
  body('url').isURL().withMessage('URL tidak valid'),
  body('icon').optional().isLength({ max: 40 }),
], errors, asyncHandler(async (req, res) => {
  const max = await get('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM linktree_links WHERE user_id = ?', [req.user.id]);
  const result = await run('INSERT INTO linktree_links (title, url, icon, visible, sort_order, user_id) VALUES (?, ?, ?, 1, ?, ?)', [req.body.title.trim(), req.body.url.trim(), (req.body.icon || 'fa-link').trim(), max.max_order + 1, req.user.id]);
  res.status(201).json({ id: result.lastID });
}));

router.put('/links/:id', [param('id').isInt(), body('title').isLength({ min: 1, max: 80 }), body('url').isURL(), body('icon').optional().isLength({ max: 40 })], errors, asyncHandler(async (req, res) => {
  const result = await run('UPDATE linktree_links SET title = ?, url = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [req.body.title.trim(), req.body.url.trim(), (req.body.icon || 'fa-link').trim(), req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'Link tidak ditemukan' });
  res.json({ message: 'Link diperbarui' });
}));

router.patch('/links/:id/visibility', [param('id').isInt(), body('visible').isBoolean()], errors, asyncHandler(async (req, res) => {
  const result = await run('UPDATE linktree_links SET visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [req.body.visible ? 1 : 0, req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'Link tidak ditemukan' });
  res.json({ message: 'Visibility diperbarui' });
}));

router.patch('/links/:id/order', [param('id').isInt(), body('direction').isIn(['up', 'down'])], errors, asyncHandler(async (req, res) => {
  const current = await get('SELECT id, sort_order FROM linktree_links WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!current) return res.status(404).json({ error: 'Link tidak ditemukan' });
  const neighbor = await get(`SELECT id, sort_order FROM linktree_links WHERE user_id = ? AND sort_order ${req.body.direction === 'up' ? '<' : '>'} ? ORDER BY sort_order ${req.body.direction === 'up' ? 'DESC' : 'ASC'} LIMIT 1`, [req.user.id, current.sort_order]);
  if (neighbor) {
    await run('UPDATE linktree_links SET sort_order = CASE id WHEN ? THEN ? WHEN ? THEN ? END WHERE id IN (?, ?)', [current.id, neighbor.sort_order, neighbor.id, current.sort_order, current.id, neighbor.id]);
  }
  res.json({ message: 'Urutan diperbarui' });
}));

router.delete('/links/:id', [param('id').isInt()], errors, asyncHandler(async (req, res) => {
  const result = await run('DELETE FROM linktree_links WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'Link tidak ditemukan' });
  res.json({ message: 'Link dihapus' });
}));

module.exports = router;
