export const STORAGE_KEY = 'moj-feri-urnik:v1';
export const BACKUP_KEY = 'moj-feri-urnik:v1:backup';
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
  return { version: 2, language: value.language || 'sl', cache: { futureWeeks: 3, pastWeeks: 2, ...(value.cache || {}) }, courses };
}
export function saveSettings(value) {
  value.version = 2;
  value.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(value);
  localStorage.setItem(BACKUP_KEY, serialized);
  localStorage.setItem(STORAGE_KEY, serialized);
}
export function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BACKUP_KEY);
}
