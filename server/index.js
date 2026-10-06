import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cached, stale } from './cache.js';
import { fetchCatalog, fetchWeek } from './wise-adapter.js';
import { CACHE_MS, COURSE_ABBREVIATIONS, DEFAULT_COURSES, PORT, PROFILE } from './config.js';
import { registerTarget, schedulerStatus, startScheduler } from './scheduler.js';

const app = express();
const httpServer = createHttpServer(app);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const detail = (id, loader) => cached(`detail:${id}`, loader, 24 * 60 * 60 * 1000).then(x => x.value);
app.use(express.json({ limit: '32kb' }));

function sendError(res, error, staleEntry) {
  res.status(staleEntry ? 200 : 502).json({ error: error.message, stale: Boolean(staleEntry), ...(staleEntry?.value || {}), fetchedAt: staleEntry?.at || null });
}

app.get('/api/config', (_, res) => res.json({ profile: PROFILE, defaultCourses: DEFAULT_COURSES, abbreviations: COURSE_ABBREVIATIONS, cacheMs: CACHE_MS }));
app.get('/api/sync/status', (_,res)=>res.json(schedulerStatus()));
app.post('/api/sync/register',(req,res)=>{
  const ids=Array.isArray(req.body?.ids)?req.body.ids.map(String):[];
  const dates=Array.isArray(req.body?.dates)?req.body.dates.map(String):[];
  if(!ids.length||ids.length>30||ids.some(id=>!/^\d{1,10}$/.test(id))||dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)))return res.status(400).json({error:'Neveljavni podatki sinhronizacije.'});
  registerTarget(ids,dates.slice(0,8));res.json({ok:true});
});
app.get('/api/catalog', async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const key = `catalog:${date.slice(0, 4)}`;
  try { const entry = await cached(key, () => fetchCatalog(date), 24 * 60 * 60 * 1000, req.query.refresh === '1'); res.json({ ...entry.value, fetchedAt: entry.at, cached: entry.cached }); }
  catch (error) { sendError(res, error, stale(key)); }
});
app.get('/api/week', async (req, res) => {
  const date = String(req.query.date || '');
  const ids = String(req.query.ids || '');
  const key = `week:${date}:${ids.split(',').sort().join(',')}`;
  try { const entry = await cached(key, () => fetchWeek(date, ids, detail), CACHE_MS, req.query.refresh === '1'); res.json({ ...entry.value, fetchedAt: entry.at, cached: entry.cached }); }
  catch (error) { sendError(res, error, stale(key)); }
});
app.get('/api/options', async (req, res) => {
  const date = String(req.query.date || '');
  const ids = String(req.query.ids || '');
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.valueOf())) return res.status(400).json({ error: 'Neveljaven datum.' });
  const dates = [-28, 0, 28].map(days => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); });
  const key = `options:${date}:${ids.split(',').sort().join(',')}`;
  try {
    const entry = await cached(key, async () => {
      const weeks = [];
      for (const weekDate of dates) weeks.push(await fetchWeek(weekDate, ids, detail));
      const unique = new Map();
      weeks.flatMap(w => w.events).forEach(event => unique.set(`${event.id}:${event.courseId}`, event));
      return { events: [...unique.values()], window: dates };
    }, 24 * 60 * 60 * 1000, req.query.refresh === '1');
    res.json({ ...entry.value, fetchedAt: entry.at, cached: entry.cached });
  } catch (error) { sendError(res, error, stale(key)); }
});
if (process.env.NODE_ENV === 'development') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: publicDir,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa'
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(publicDir));
  app.use((_, res) => res.sendFile(path.join(publicDir, 'index.html')));
}
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana'}).format(new Date());
startScheduler(async target => {
  for (const date of target.dates) {
    const key=`week:${date}:${target.ids.slice().sort().join(',')}`;
    await cached(key,()=>fetchWeek(date,target.ids.join(','),detail),CACHE_MS,true);
  }
}, { ids:DEFAULT_COURSES, dates:[today] });
httpServer.listen(PORT, () => console.log(`Moj FERI urnik: http://localhost:${PORT}`));
