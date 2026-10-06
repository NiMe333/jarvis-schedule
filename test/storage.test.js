import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_KEY, STORAGE_KEY, clearSettings, loadSettings, saveSettings } from '../public/storage.js';

function storageMock() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('nova namestitev nima privzetih predmetov', () => {
  global.localStorage = storageMock();
  assert.deepEqual(loadSettings().courses, {});
});

test('poškodovan glavni zapis se obnovi iz varnostne kopije', () => {
  global.localStorage = storageMock();
  const settings = loadSettings();
  settings.courses['42'] = { enabled: true, types: ['PR'], groups: ['A'], recognized: { enabled: false, types: [], mode: 'optional' } };
  saveSettings(settings);
  assert.ok(localStorage.getItem(BACKUP_KEY));
  localStorage.setItem(STORAGE_KEY, '{poškodovano');
  const restored = loadSettings();
  assert.deepEqual(restored.courses['42'].groups, ['A']);
  assert.doesNotThrow(() => JSON.parse(localStorage.getItem(STORAGE_KEY)));
  clearSettings();
  assert.equal(localStorage.getItem(STORAGE_KEY), null);
  assert.equal(localStorage.getItem(BACKUP_KEY), null);
});
