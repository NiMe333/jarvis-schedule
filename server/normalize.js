export const clean = value => (value || '').replace(/\s+/g, ' ').trim();
export const isRemote = (rawType = '', room = '') => /NA DALJAVO/i.test(rawType) || /E[- ]?PREDAVALNICA/i.test(room);

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
