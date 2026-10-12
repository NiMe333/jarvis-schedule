export const clean = value => (value || '').replace(/\s+/g, ' ').trim();
export const isRemote = (rawType = '', room = '') => /NA DALJAVO/i.test(rawType) || /E[- ]?PREDAVALNICA/i.test(room);

const factKey = value => clean(value).toLocaleLowerCase('sl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
const lecturerKeys = new Set(['predavatelji', 'predavatelj', 'izvajalci', 'izvajalec', 'nosilci', 'nosilec', 'teacher', 'teachers', 'lecturer', 'lecturers']);

export function pickLecturers(facts, fallback = '') {
  const value = Object.entries(facts || {}).find(([key, value]) => lecturerKeys.has(factKey(key)) && clean(value));
  return clean(value?.[1] || fallback);
}

export function splitTitle(title) {
  const match = clean(title).match(/^(.*) \(([^)]+)\)$/);
  const rawType = match?.[2] || 'DRUGO';
  return {
    subject: match?.[1] || clean(title),
    rawType,
    type: rawType.startsWith('RV') ? 'RV' : rawType,
    remote: isRemote(rawType)
  };
}

export function groupKey(courseId, type, name) {
  return `${courseId}:${type}:${name}`;
}
