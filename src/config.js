const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'shortlink.db'),
  backupDir: path.join(dataDir, 'backups'),
  restoreDir: path.join(dataDir, 'restore-staging'),
  storage: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    maxFileBytes: Number(process.env.STORAGE_MAX_FILE_BYTES || 100 * 1024 * 1024),
    presignedTtlSeconds: Number(process.env.STORAGE_PRESIGNED_TTL || 300),
  },
  publicDir: path.join(__dirname, '..', 'public'),
};