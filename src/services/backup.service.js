const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');
const { exec, run } = require('../db/queries');
const { closeDb, reopenDb } = require('../db/connection');
const { initializeDatabase } = require('../db/init');

const REQUIRED_TABLES = ['users', 'links', 'folders', 'bookmarks', 'notes', 'markdown_docs'];
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

async function ensureDirs() {
  await Promise.all([
    fsp.mkdir(config.backupDir, { recursive: true }),
    fsp.mkdir(config.restoreDir, { recursive: true }),
  ]);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', 'T').replace('Z', `-${Date.now()}Z`).replace(/\.\d{3}/, '');
}

function validateSqliteFile(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) return reject(new Error('File bukan database SQLite yang valid'));
      db.get('PRAGMA integrity_check', (integrityError, integrityRow) => {
        if (integrityError || integrityRow?.integrity_check !== 'ok') {
          return db.close(() => reject(new Error('SQLite integrity check gagal')));
        }
        db.all("SELECT name FROM sqlite_master WHERE type = 'table'", (tableError, rows) => {
          const names = new Set((rows || []).map((row) => row.name));
          const missing = REQUIRED_TABLES.filter((table) => !names.has(table));
          db.close(() => {
            if (tableError) return reject(tableError);
            if (missing.length) return reject(new Error(`Tabel wajib hilang: ${missing.join(', ')}`));
            resolve({ tables: [...names].sort() });
          });
        });
      });
    });
  });
}

async function exportDatabase() {
  await ensureDirs();
  await exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const filename = `shortlink-backup-${timestamp()}.db`;
  const target = path.join(config.backupDir, filename);
  await fsp.copyFile(config.dbPath, target, fs.constants.COPYFILE_EXCL);
  await validateSqliteFile(target);
  return { filename, path: target };
}

async function stageRestore(buffer, originalName = 'uploaded.db') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('File backup kosong');
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error('Ukuran backup melebihi batas 100 MB');
  await ensureDirs();
  const stagedName = `restore-${timestamp()}-${process.pid}.db`;
  const stagedPath = path.join(config.restoreDir, stagedName);
  await fsp.writeFile(stagedPath, buffer, { flag: 'wx', mode: 0o600 });
  try {
    const validation = await validateSqliteFile(stagedPath);
    await fsp.writeFile(`${stagedPath}.json`, JSON.stringify({
      stagedName,
      originalName: path.basename(originalName),
      size: buffer.length,
      tables: validation.tables,
      createdAt: new Date().toISOString(),
    }), { mode: 0o600 });
    return { stagedName, originalName: path.basename(originalName), size: buffer.length, tables: validation.tables };
  } catch (error) {
    await fsp.rm(stagedPath, { force: true });
    throw error;
  }
}

async function getStagedRestore() {
  await ensureDirs();
  const candidates = (await fsp.readdir(config.restoreDir)).filter((name) => name.endsWith('.db')).sort().reverse();
  let stagedPath = null;
  for (const name of candidates) {
    const candidate = path.join(config.restoreDir, name);
    try {
      if ((await fsp.stat(candidate)).size > 0) {
        await validateSqliteFile(candidate);
        stagedPath = candidate;
        break;
      }
    } catch (_) {
      await fsp.rm(candidate, { force: true });
      await fsp.rm(`${candidate}.json`, { force: true });
    }
  }
  if (!stagedPath) return null;
  const files = [path.basename(stagedPath)];
  const metadataPath = `${stagedPath}.json`;
  let metadata = {};
  try { metadata = JSON.parse(await fsp.readFile(metadataPath, 'utf8')); } catch (_) {}
  return { ...metadata, stagedName: files[0] };
}

async function activateStagedRestore(stagedName) {
  if (!/^restore-[A-Za-z0-9_.-]+\.db$/.test(stagedName)) throw new Error('Nama staged restore tidak valid');
  const stagedPath = path.join(config.restoreDir, stagedName);
  await fsp.access(stagedPath, fs.constants.R_OK);
  await validateSqliteFile(stagedPath);
  const backup = await exportDatabase();
  const activePath = `${config.dbPath}.before-restore-${process.pid}`;
  await closeDb();
  try {
    await fsp.rename(config.dbPath, activePath);
    const replacementPath = `${config.dbPath}.restore-${process.pid}`;
    await fsp.copyFile(stagedPath, replacementPath, fs.constants.COPYFILE_EXCL);
    await fsp.rename(replacementPath, config.dbPath);
    reopenDb();
    await initializeDatabase();
    await run('UPDATE users SET token_version = token_version + 1');
    await fsp.rm(activePath, { force: true });
    await fsp.rm(`${stagedPath}.json`, { force: true });
  } catch (error) {
    try {
      await fsp.rm(config.dbPath, { force: true });
      await fsp.rename(activePath, config.dbPath);
      reopenDb();
    } catch (_) {}
    throw error;
  }
  return { backupFilename: backup.filename };
}

module.exports = {
  MAX_IMPORT_BYTES,
  exportDatabase,
  stageRestore,
  getStagedRestore,
  activateStagedRestore,
};