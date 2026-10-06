async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Napaka pri pridobivanju podatkov.');
  return body;
}
export const getConfig = () => request('/api/config');
export const getCatalog = (date, refresh=false) => request(`/api/catalog?date=${date}${refresh?'&refresh=1':''}`);
export const getWeek = (date, ids, refresh=false) => request(`/api/week?date=${date}&ids=${ids.join(',')}${refresh?'&refresh=1':''}`);
export const getOptions = (date, ids, refresh=false) => request(`/api/options?date=${date}&ids=${ids.join(',')}${refresh?'&refresh=1':''}`);
export const registerSync = payload => request('/api/sync/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
