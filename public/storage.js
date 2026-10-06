import { deleteUserSettings, getUserSettings, putUserSettings } from './api.js';

export const STORAGE_KEY = 'moj-feri-urnik:v1';
export const BACKUP_KEY = 'moj-feri-urnik:v1:backup';
let syncState = 'local';
const reportSync = state => {
  syncState = state;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('settings-sync',{ detail:state }));
};
export const getSettingsSyncState = () => syncState;
export function loadSettings() {
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      if (value?.courses && typeof value.courses === 'object') {
        const migrated = migrate(value);
        if (key === BACKUP_KEY) saveSettings(migrated);
        return migrated;
      }
    } catch {}
  }
  return migrate({ courses: {} });
}
function migrate(value) {
  const courses = value.courses || {};
  for (const course of Object.values(courses)) {
    course.enabled ??= true; course.types ??= null; course.groups ??= null;
    course.recognized ??= { enabled: false, types: [], mode: 'optional' };
  }
  return { version: 2, updatedAt: value.updatedAt || null, language: value.language || 'sl', cache: { futureWeeks: 3, pastWeeks: 2, ...(value.cache || {}) }, courses };
}
export function importSettings(value) {
  if (!value?.courses || typeof value.courses !== 'object' || Array.isArray(value.courses)) throw new Error('Datoteka ne vsebuje veljavnih nastavitev.');
  const entries=Object.entries(value.courses);
  if(entries.length>30||entries.some(([id,course])=>!/^\d{1,10}$/.test(id)||!course||typeof course!=='object'||course.types!==null&&!Array.isArray(course.types)||course.groups!==null&&!Array.isArray(course.groups)))throw new Error('Datoteka vsebuje neveljavne nastavitve predmetov.');
  const imported=migrate(value);
  saveSettings(imported);
  return imported;
}
export function saveSettings(value) {
  value.version = 2;
  value.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(value);
  localStorage.setItem(BACKUP_KEY, serialized);
  localStorage.setItem(STORAGE_KEY, serialized);
  reportSync('syncing');
  void putUserSettings(value).then(() => reportSync('synced')).catch(() => reportSync('offline'));
}
export function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BACKUP_KEY);
  void deleteUserSettings().then(() => reportSync('synced')).catch(() => reportSync('offline'));
}

export async function syncSettings(localValue) {
  try {
    const remote = (await getUserSettings()).settings;
    if (!remote?.courses) {
      saveSettings(localValue);
      return localValue;
    }
    const localTime = Date.parse(localValue.updatedAt || 0) || 0;
    const remoteTime = Date.parse(remote.updatedAt || 0) || 0;
    if (remoteTime > localTime) {
      const restored = migrate(remote);
      const serialized = JSON.stringify(restored);
      localStorage.setItem(BACKUP_KEY, serialized);
      localStorage.setItem(STORAGE_KEY, serialized);
      reportSync('synced');
      return restored;
    }
    saveSettings(localValue);
  } catch { reportSync('offline'); }
  return localValue;
}
