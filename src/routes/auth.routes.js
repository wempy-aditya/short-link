const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const path = require('path');

const config = require('../config');
const { get } = require('../db/queries');
const asyncHandler = require('../utils/asyncHandler');

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
      { id: user.id, username: user.username },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, message: 'Login berhasil' });
  })
);

module.exports = router;