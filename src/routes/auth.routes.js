const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const path = require('path');

const config = require('../config');
const { get, run } = require('../db/queries');
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Halaman login admin
router.get('/admin/login', (req, res) => {
  res.sendFile(path.join(config.publicDir, 'admin', 'login.html'));
});

// Halaman dashboard admin
router.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(config.publicDir, 'admin', 'dashboard.html'));
});

// API login admin
router.post(
  '/api/admin/login',
  [
    body('username').notEmpty().withMessage('Username diperlukan'),
    body('password').notEmpty().withMessage('Password diperlukan'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Username dan password diperlukan' });
    }

    const { username, password } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, tokenVersion: user.token_version || 0 },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, message: 'Login berhasil' });
  })
);

// Ganti password dan invalidate seluruh JWT lama melalui token_version.
router.put(
  '/api/admin/account/password',
  authenticateToken,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 12 }),
    body('confirmPassword').isString().notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!errors.isEmpty() || newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Password baru tidak valid atau konfirmasi tidak cocok' });
    }

    const user = await get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Password saat ini salah' });
    }

    await run('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [
      bcrypt.hashSync(newPassword, 12),
      req.user.id,
    ]);
    res.json({ message: 'Password berhasil diubah. Silakan login ulang.' });
  })
);

module.exports = router;