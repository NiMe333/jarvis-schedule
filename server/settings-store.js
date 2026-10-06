import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'user-settings.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  recovery_hash TEXT
)`);
const columns = db.prepare('PRAGMA table_info(user_settings)').all();
if (!columns.some(column => column.name === 'recovery_hash')) db.exec('ALTER TABLE user_settings ADD COLUMN recovery_hash TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS user_settings_recovery_hash ON user_settings(recovery_hash) WHERE recovery_hash IS NOT NULL');

const readStatement = db.prepare('SELECT settings_json FROM user_settings WHERE user_id = ?');
const writeStatement = db.prepare(`INSERT INTO user_settings (user_id, settings_json, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`);
const deleteStatement = db.prepare('DELETE FROM user_settings WHERE user_id = ?');
const recoveryStatement = db.prepare('UPDATE user_settings SET recovery_hash = ? WHERE user_id = ?');
const recoverStatement = db.prepare('SELECT user_id FROM user_settings WHERE recovery_hash = ?');
const hashRecoveryKey = key => createHash('sha256').update(String(key).trim()).digest('hex');

export function readUserSettings(userId) {
  const row = readStatement.get(userId);
  return row ? JSON.parse(row.settings_json) : null;
}

export function writeUserSettings(userId, settings) {
  const updatedAt = typeof settings.updatedAt === 'string' ? settings.updatedAt : new Date().toISOString();
  writeStatement.run(userId, JSON.stringify({ ...settings, updatedAt }), updatedAt);
}

export function deleteUserSettings(userId) {
  deleteStatement.run(userId);
}

export function createRecoveryKey(userId) {
  if (!readStatement.get(userId)) throw new Error('Najprej shrani vsaj eno nastavitev.');
  const key = randomBytes(12).toString('hex').match(/.{6}/g).join('-');
  recoveryStatement.run(hashRecoveryKey(key), userId);
  return key;
}

export function recoverUserId(key) {
  if (typeof key !== 'string' || !/^[a-f0-9]{6}(?:-[a-f0-9]{6}){3}$/i.test(key.trim())) return null;
  return recoverStatement.get(hashRecoveryKey(key))?.user_id || null;
}
