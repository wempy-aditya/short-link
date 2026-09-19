const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-link-settings-'));
process.env.DB_PATH = path.join(tempDir, 'shortlink.db');
process.env.DATA_DIR = path.join(tempDir, 'data');
process.env.JWT_SECRET = 'test-secret';

const { initializeDatabase } = require('../src/db/init');
const { get } = require('../src/db/queries');
const { exportDatabase, stageRestore, getStagedRestore } = require('../src/services/backup.service');
const storage = require('../src/services/storage.service');

test('database initializes token_version and export is valid SQLite', async () => {
  await initializeDatabase();
  const user = await get('SELECT username, token_version FROM users WHERE username = ?', ['admin']);
  assert.equal(user.username, 'admin');
  assert.equal(user.token_version, 0);
  const storageTable = await get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'storage_files'");
  assert.equal(storageTable.name, 'storage_files');

  const backup = await exportDatabase();
  assert.match(backup.filename, /^shortlink-backup-.*\.db$/);
  assert.ok(fs.statSync(backup.path).size > 0);
});

test('restore staging rejects invalid SQLite bytes', async () => {
  await assert.rejects(
    stageRestore(Buffer.from('not-a-database'), 'bad.db'),
    /SQLite integrity check gagal|database SQLite yang valid/
  );
  assert.equal(await getStagedRestore(), null);
});

test('storage object keys and share tokens are opaque', () => {
  const key = storage.createObjectKey(7, 'foto keluarga 2026.jpg');
  const share = storage.createShareToken();
  assert.match(key, /^users\/7\/[0-9a-f-]+-foto-keluarga-2026\.jpg$/);
  assert.equal(share.token.length > 30, true);
  assert.notEqual(share.token, share.hash);
});