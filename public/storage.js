export const STORAGE_KEY = 'moj-feri-urnik:v1';
export function loadSettings(defaultIds) {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value?.courses) return migrate(value, defaultIds);
  } catch {}
  return migrate({ courses: Object.fromEntries(defaultIds.map(id => [id, { enabled: true, types: null, groups: null }])) }, defaultIds);
}
function migrate(value, defaultIds=[]) {
  const courses = value.courses || Object.fromEntries(defaultIds.map(id => [id, {}]));
  for (const course of Object.values(courses)) {
    course.enabled ??= true; course.types ??= null; course.groups ??= null;
    course.recognized ??= { enabled: false, types: [], mode: 'optional' };
  }
  return { version: 2, language: value.language || 'sl', cache: { futureWeeks: 3, pastWeeks: 2, ...(value.cache || {}) }, courses };
}
export function saveSettings(value) { value.version = 2; localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
