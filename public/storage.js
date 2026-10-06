export const STORAGE_KEY = 'moj-feri-urnik:v1';
export function loadSettings(defaultIds) {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value?.version === 1 && value.courses) return value;
  } catch {}
  return { version: 1, view: 'week', courses: Object.fromEntries(defaultIds.map(id => [id, { enabled: true, types: null, groups: null }])) };
}
export function saveSettings(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
