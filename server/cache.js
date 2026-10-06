const values = new Map();
const pending = new Map();

export async function cached(key, loader, maxAge, force = false) {
  const hit = values.get(key);
  if (!force && hit && Date.now() - hit.at < maxAge) return { ...hit, cached: true };
  if (pending.has(key)) return pending.get(key);
  const task = loader().then(value => {
    const entry = { value, at: Date.now(), cached: false };
    values.set(key, entry);
    pending.delete(key);
    return entry;
  }).catch(error => { pending.delete(key); throw error; });
  pending.set(key, task);
  return task;
}

export function stale(key) { return values.get(key); }
