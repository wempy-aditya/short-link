const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-link-settings-'));
process.env.DB_PATH = path.join(tempDir, 'shortlink.db');
process.env.JWT_SECRET = 'test-secret';

const { initializeDatabase } = require('../src/db/init');
const { get } = require('../src/db/queries');
const { exportDatabase, stageRestore, getStagedRestore } = require('../src/services/backup.service');

test('database initializes token_version and export is valid SQLite', async () => {
  await initializeDatabase();
  const user = await get('SELECT username, token_version FROM users WHERE username = ?', ['admin']);
  assert.equal(user.username, 'admin');
  assert.equal(user.token_version, 0);

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