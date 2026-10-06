export const clean = value => (value || '').replace(/\s+/g, ' ').trim();

export function splitTitle(title) {
  const match = clean(title).match(/^(.*) \(([^)]+)\)$/);
  const rawType = match?.[2] || 'DRUGO';
  return {
    subject: match?.[1] || clean(title),
    rawType,
    type: rawType.startsWith('RV') ? 'RV' : rawType,
    remote: /NA DALJAVO/i.test(rawType)
  };
}

export function groupKey(courseId, type, name) {
  return `${courseId}:${type}:${name}`;
}
