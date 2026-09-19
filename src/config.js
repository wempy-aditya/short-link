const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'shortlink.db'),
  backupDir: path.join(dataDir, 'backups'),
  restoreDir: path.join(dataDir, 'restore-staging'),
  publicDir: path.join(__dirname, '..', 'public'),
};