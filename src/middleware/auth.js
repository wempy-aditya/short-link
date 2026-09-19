const jwt = require('jsonwebtoken');
const config = require('../config');
const { get } = require('../db/queries');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    get('SELECT id, username, token_version FROM users WHERE id = ?', [user.id])
      .then((currentUser) => {
        if (!currentUser || currentUser.token_version !== user.tokenVersion) {
          return res.status(401).json({ error: 'Session invalidated, please login again' });
        }
        req.user = currentUser;
        next();
      })
      .catch(next);
  });
}

module.exports = { authenticateToken };