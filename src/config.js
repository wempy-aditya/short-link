const path = require('path');

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  dbPath: path.join(__dirname, '..', 'shortlink.db'),
  publicDir: path.join(__dirname, '..', 'public'),
};