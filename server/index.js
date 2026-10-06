import express from 'express';
import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cached, stale } from './cache.js';
import { fetchCatalog, fetchWeek } from './wise-adapter.js';
import { CACHE_MS, COURSE_ABBREVIATIONS, DEFAULT_COURSES, FETCH_WEEKS_AHEAD, FETCH_WEEKS_BEHIND, PORT, PROFILE } from './config.js';
import { registerTarget, schedulerStatus, startScheduler } from './scheduler.js';
import { createRecoveryKey, deleteUserSettings, readUserSettings, recoverUserId, writeUserSettings } from './settings-store.js';

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy',1);
const httpServer = createHttpServer(app);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const detail = (id, loader) => cached(`detail:${id}`, loader, 24 * 60 * 60 * 1000).then(x => x.value);
app.use(express.json({ limit: '32kb' }));
app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
});
const setUserCookie = (res, userId) => {
  const secure = process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `feri_schedule_user=${userId}; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}; Path=/`);
};
app.use((req, res, next) => {
  const existing = (req.headers.cookie || '').match(/(?:^|;)\s*feri_schedule_user=([0-9a-f-]{36})(?:;|$)/i)?.[1];
  req.userId = existing || randomUUID();
  if (!existing) setUserCookie(res, req.userId);
  next();
});

const rateBuckets = new Map();
function rateLimit(limit, windowMs) {
  return (req,res,next) => {
    const now=Date.now();
    if(rateBuckets.size>5000)for(const[key,value]of rateBuckets)if(value.reset<=now)rateBuckets.delete(key);
    const key=`${req.ip}:${req.userId||'anonymous'}:${req.path}`,bucket=rateBuckets.get(key);
    if(!bucket||bucket.reset<=now){rateBuckets.set(key,{count:1,reset:now+windowMs});return next()}
    if(bucket.count>=limit){res.setHeader('Retry-After',String(Math.ceil((bucket.reset-now)/1000)));return res.status(429).json({error:'Preveč zahtev. Poskusi znova pozneje.'})}
    bucket.count++;next();
  };
}
app.use('/api',rateLimit(180,60_000));

function validSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['sl','en'].includes(value.language)) return false;
  if (value.updatedAt && !Number.isFinite(Date.parse(value.updatedAt))) return false;
  const courses=value.courses;
  if (!courses || typeof courses !== 'object' || Array.isArray(courses) || Object.keys(courses).length>30) return false;
  return Object.entries(courses).every(([id,course]) => /^\d{1,10}$/.test(id) && course && typeof course==='object' && typeof course.enabled==='boolean' && (course.types===null || Array.isArray(course.types) && course.types.length<=20 && course.types.every(x=>typeof x==='string'&&x.length<=40)) && (course.groups===null || Array.isArray(course.groups) && course.groups.length<=100 && course.groups.every(x=>typeof x==='string'&&x.length<=250)) && course.recognized && typeof course.recognized.enabled==='boolean' && ['optional','hidden'].includes(course.recognized.mode) && Array.isArray(course.recognized.types) && course.recognized.types.length<=20 && course.recognized.types.every(x=>typeof x==='string'&&x.length<=40));
}

function sendError(res, error, staleEntry) {
  res.status(staleEntry ? 200 : 502).json({ error: error.message, stale: Boolean(staleEntry), ...(staleEntry?.value || {}), fetchedAt: staleEntry?.at || null });
}

app.get('/api/config', (_, res) => res.json({ profile: PROFILE, defaultCourses: DEFAULT_COURSES, abbreviations: COURSE_ABBREVIATIONS, cacheMs: CACHE_MS, fetchWeeksAhead: FETCH_WEEKS_AHEAD, fetchWeeksBehind: FETCH_WEEKS_BEHIND }));
app.get('/api/health', (_,res)=>res.json({status:'ok',service:'jarvis-schedule',time:new Date().toISOString()}));
app.get('/api/settings', (req, res) => res.json({ settings: readUserSettings(req.userId) }));
app.put('/api/settings', (req, res) => {
  const value = req.body;
  if (!validSettings(value)) return res.status(400).json({ error: 'Neveljavne nastavitve.' });
  writeUserSettings(req.userId, value);
  res.json({ ok: true });
});
app.delete('/api/settings', (req, res) => { deleteUserSettings(req.userId); res.json({ ok: true }); });
app.post('/api/settings/recovery-key',rateLimit(5,60*60_000),(req,res)=>{
  try { res.json({ recoveryKey:createRecoveryKey(req.userId) }); }
  catch(error){ res.status(400).json({error:error.message}); }
});
app.post('/api/settings/recover',rateLimit(10,60*60_000),(req,res)=>{
  const userId=recoverUserId(req.body?.recoveryKey);
  if(!userId)return res.status(404).json({error:'Obnovitveni ključ ni veljaven.'});
  setUserCookie(res,userId);
  res.json({settings:readUserSettings(userId)});
});
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
  const dates = [0, 7].map(days => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); });
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
  app.use(express.static(distDir));
  app.use((_, res) => res.sendFile(path.join(distDir, 'index.html')));
}
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana'}).format(new Date());
const nextWeek = (() => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 7); return date.toISOString().slice(0, 10); })();
startScheduler(async target => {
  for (const date of target.dates) {
    const key=`week:${date}:${target.ids.slice().sort().join(',')}`;
    await cached(key,()=>fetchWeek(date,target.ids.join(','),detail),CACHE_MS,true);
  }
}, { ids:DEFAULT_COURSES, dates:[today,nextWeek] });
httpServer.listen(PORT, () => console.log(`Moj FERI urnik: http://localhost:${PORT}`));
