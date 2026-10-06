import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'user-settings.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

const readStatement = db.prepare('SELECT settings_json FROM user_settings WHERE user_id = ?');
const writeStatement = db.prepare(`INSERT INTO user_settings (user_id, settings_json, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`);
const deleteStatement = db.prepare('DELETE FROM user_settings WHERE user_id = ?');

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
