import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRecoveryKey, deleteUserSettings, readUserSettings, recoverUserId, writeUserSettings } from '../server/settings-store.js';

test('obnovitveni ključ najde anonimen SQLite zapis', () => {
  const userId=randomUUID();
  try {
    writeUserSettings(userId,{version:2,updatedAt:new Date().toISOString(),language:'sl',cache:{},courses:{}});
    const key=createRecoveryKey(userId);
    assert.match(key,/^[a-f0-9]{6}(?:-[a-f0-9]{6}){3}$/);
    assert.equal(recoverUserId(key),userId);
    assert.deepEqual(readUserSettings(userId).courses,{});
  } finally { deleteUserSettings(userId); }
});
