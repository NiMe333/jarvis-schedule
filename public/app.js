import { filterEvents } from './filter.js';
import { loadSettings, saveSettings } from './storage.js';

const $ = selector => document.querySelector(selector);
const fmtDate = new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'long' });
const fmtFull = new Intl.DateTimeFormat('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const colors = ['#5271c4','#d0624b','#469678','#a85d9f','#b17b28','#567f9a','#765eb1','#a15065'];
let config, catalog = [], data = null, optionsData = null, settings, anchor = todayISO(), loading = false;

function todayISO() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana' }).format(new Date()); }
function shift(date, days) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
function monday(date) { const d = new Date(`${date}T12:00:00Z`); const day = d.getUTCDay() || 7; return shift(date, 1 - day); }
function esc(v='') { const el = document.createElement('span'); el.textContent = v; return el.innerHTML; }
function courseMeta(id) { return catalog.find(c => c.id === id) || { id, name: `Predmet ${id}`, code: '' }; }
function naturalCase(value='') { return value.toLocaleLowerCase('sl').replace(/(^|[.!?]\s+)(\p{L})/gu,(_,a,b)=>a+b.toLocaleUpperCase('sl')).replace(/\b(rit|ipt|un|vs)\b/gi,m=>m.toLocaleUpperCase('sl')); }
function selectedIds() { return Object.keys(settings.courses); }
function colorFor(id) { return colors[selectedIds().indexOf(id) % colors.length]; }

async function api(path) { const r = await fetch(path); const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Napaka pri pridobivanju.'); return body; }

async function init() {
  config = await api('/api/config'); settings = loadSettings(config.defaultCourses);
  bind(); $('#date').value = anchor; await loadCatalog(); await loadWeek();
}

async function loadCatalog(force=false) {
  try { const result = await api(`/api/catalog?date=${anchor}${force ? '&refresh=1' : ''}`); catalog = result.courses; renderCourses(); }
  catch (e) { showNotice(e.message, 'error'); }
}

async function loadWeek(force=false) {
  if (!selectedIds().length) { data = { events: [] }; renderAll(); return; }
  loading = true; $('#schedule').innerHTML = '<div class="state"><span class="spinner"></span><h3>Pridobivam urnik …</h3></div>';
  try {
    const suffix = `date=${anchor}&ids=${selectedIds().join(',')}${force ? '&refresh=1' : ''}`;
    [data, optionsData] = await Promise.all([api(`/api/week?${suffix}`), api(`/api/options?${suffix}`)]);
    showNotice(data.error ? `Vir trenutno ni dosegljiv. Prikazani so starejši podatki: ${data.error}` : '', data.stale ? 'warning' : '');
  } catch (e) { data = null; showNotice(`Wise Timetable ni dosegljiv: ${e.message}`, 'error'); }
  loading = false; renderAll();
}

function discovered(id, field) {
  const source = optionsData || data;
  if (!source) return [];
  if (field === 'types') return [...new Set(source.events.filter(e => e.courseId === id).map(e => e.type))].sort();
  const map = new Map(); source.events.filter(e => e.courseId === id).flatMap(e => e.groups || []).forEach(g => map.set(g.id, g)); return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'sl'));
}

function renderCourses() {
  const openIds = new Set([...document.querySelectorAll('.course-panel[open]')].map(el => el.dataset.id));
  $('#courseCount').textContent = `${selectedIds().length} predmetov`;
  $('#coursePanels').innerHTML = selectedIds().map((id, index) => {
    const meta = courseMeta(id), state = settings.courses[id], types = discovered(id,'types'), groups = discovered(id,'groups');
    const isOpen = openIds.size ? openIds.has(id) : index === 0;
    return `<details class="course-panel" data-id="${id}" ${isOpen ? 'open' : ''}><summary><span class="course-dot" style="background:${colorFor(id)}"></span><span class="course-name">${esc(naturalCase(meta.name))}<small>${esc(meta.code || `Wise ID ${id}`)}</small></span><span class="chevron">›</span><label class="switch" title="Začasno pokaži/skrij"><input data-action="enable" data-id="${id}" type="checkbox" ${state.enabled?'checked':''}><span></span></label></summary><div class="filters"><div class="filter-head"><b>Vrsta izvedbe</b></div><div class="checks type-checks">${types.length ? types.map(t=>check(id,'type',t,t,state.types===null||state.types.includes(t))).join('') : '<small>Možnosti se prikažejo po nalaganju podatkov.</small>'}</div><div class="filter-head"><b>Skupine</b><span><button data-action="groups-all" data-id="${id}">Vse</button><button data-action="groups-clear" data-id="${id}">Počisti</button></span></div><div class="checks">${groups.length ? groups.map(g=>check(id,'group',g.id,g.name,state.groups===null||state.groups.includes(g.id))).join('') : '<small>Ta predmet nima skupinskih izvedb v pregledanem obdobju.</small>'}</div><button class="remove" data-action="remove" data-id="${id}">⌫ <span>Odstrani predmet</span></button></div></details>`;
  }).join('');
}
function check(id, kind, value, label, checked) { return `<label class="check"><input type="checkbox" data-action="${kind}" data-id="${id}" value="${esc(value)}" ${checked?'checked':''}><span>${esc(label)}</span></label>`; }

function renderAll() {
  renderCourses();
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === settings.view));
  const start = monday(anchor), end = shift(start,4);
  $('#weekLabel').textContent = `${fmtDate.format(new Date(start+'T12:00:00'))}–${fmtDate.format(new Date(end+'T12:00:00'))}`;
  $('#status').textContent = data?.fetchedAt ? `Posodobljeno ${new Date(data.fetchedAt).toLocaleTimeString('sl-SI',{hour:'2-digit',minute:'2-digit'})}` : '';
  $('#published').textContent = data?.publishedAt ? `Wise objava: ${new Date(data.publishedAt).toLocaleString('sl-SI')}` : '';
  if (!data) { $('#schedule').innerHTML = '<div class="state"><h3>Urnika ni bilo mogoče naložiti</h3><p>Preveri povezavo in poskusi osvežiti.</p></div>'; return; }
  const all = data.events || [], visible = filterEvents(all, settings);
  if (!all.length) { $('#schedule').innerHTML = '<div class="state"><h3>Ta teden ni dogodkov</h3><p>Izbrani predmeti v tem tednu nimajo objavljenih izvedb.</p></div>'; return; }
  if (!visible.length) { $('#schedule').innerHTML = '<div class="state"><h3>Filtri ne vrnejo dogodkov</h3><p>Vključi vrsto ali skupino v levem panelu.</p></div>'; return; }
  settings.view === 'list' || matchMedia('(max-width: 760px)').matches ? renderList(visible) : renderWeek(visible);
}

function overlaps(event, events) { return events.some(x => x.id !== event.id && x.date === event.date && x.start < event.end && x.end > event.start); }
function eventCard(e, conflict=false) { return `<button class="event" data-event="${e.id}" style="--event:${colorFor(e.courseId)}"><span class="event-time">${e.start}–${e.end}${conflict?' <i title="Časovni konflikt">△</i>':''}</span><b>${esc(naturalCase(e.subject))}</b><span class="event-meta"><em>${esc(e.rawType)}</em>${e.remote?'<em>Na daljavo</em>':''}<span>⌖ ${esc(e.room)}</span></span>${e.groups?.length?`<small>♧ ${esc(e.groups.map(g=>g.name).join(', '))}</small>`:''}<span class="event-open">↗</span></button>`; }
function renderList(events) {
  const dates = [...new Set(events.map(e=>e.date))].sort(); $('#schedule').className='list-view';
  $('#schedule').innerHTML = dates.map(date=>{ const day=events.filter(e=>e.date===date).sort((a,b)=>a.start.localeCompare(b.start)); return `<section class="list-day"><h3>${fmtFull.format(new Date(date+'T12:00:00'))}</h3><div>${day.map(e=>eventCard(e,overlaps(e,events))).join('')}</div></section>`; }).join('');
}
function renderWeek(events) {
  const start=monday(anchor), dates=Array.from({length:5},(_,i)=>shift(start,i));
  const starts=events.map(e=>toMinutes(e.start)), ends=events.map(e=>toMinutes(e.end));
  const minHour=Math.min(7,Math.floor(Math.min(...starts)/60));
  const maxHour=Math.max(20,Math.ceil(Math.max(...ends)/60));
  const availableHeight = Math.max(390, window.innerHeight - 142);
  const px = Math.max(34, Math.min(58, Math.floor(availableHeight / (maxHour - minHour))));
  const height=(maxHour-minHour)*px;
  $('#schedule').className='week-view timeline';
  const today = todayISO();
  const nowParts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Ljubljana',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const nowTime = `${nowParts.find(x=>x.type==='hour').value}:${nowParts.find(x=>x.type==='minute').value}`;
  const days=dates.map(date=>{
    const day=events.filter(e=>e.date===date).sort((a,b)=>a.start.localeCompare(b.start));
    const laid=layoutDay(day);
    const isToday=date===today;
    const currentMinutes=toMinutes(nowTime), marker=isToday&&currentMinutes>=minHour*60&&currentMinutes<=maxHour*60?`<div class="now-line" style="top:${(currentMinutes-minHour*60)/60*px}px"><i></i><span>${nowTime}</span></div>`:'';
    return `<section class="week-day ${isToday?'is-today':''}"><header><b>${new Intl.DateTimeFormat('sl-SI',{weekday:'short'}).format(new Date(date+'T12:00:00'))}</b><small>${fmtDate.format(new Date(date+'T12:00:00'))}</small>${isToday?'<span>Danes</span>':''}</header><div class="day-track" style="--hour:${px}px;height:${height}px">${laid.map(({event,column,columns})=>{const top=(toMinutes(event.start)-minHour*60)/60*px;const h=Math.max(30,(toMinutes(event.end)-toMinutes(event.start))/60*px-3);const width=100/columns,left=column*width;return `<div class="event-slot" style="top:${top}px;height:${h}px;left:${left}%;width:${width}%">${eventCard(event,columns>1)}</div>`}).join('')}${marker}</div></section>`;
  }).join('');
  const hours=Array.from({length:maxHour-minHour+1},(_,i)=>`<span style="top:${i*px}px">${String(minHour+i).padStart(2,'0')}:00</span>`).join('');
  $('#schedule').innerHTML=`<aside class="time-axis" style="height:${height}px">${hours}</aside>${days}`;
}

function toMinutes(time) { const [h,m]=time.split(':').map(Number); return h*60+m; }
function layoutDay(events) {
  const result=[];
  for(let i=0;i<events.length;){
    const cluster=[]; let clusterEnd=toMinutes(events[i].end),j=i;
    while(j<events.length && (j===i || toMinutes(events[j].start)<clusterEnd)){ cluster.push(events[j]); clusterEnd=Math.max(clusterEnd,toMinutes(events[j].end)); j++; }
    const columnEnds=[];
    const placed=cluster.map(event=>{let column=columnEnds.findIndex(end=>end<=toMinutes(event.start));if(column<0)column=columnEnds.length;columnEnds[column]=toMinutes(event.end);return{event,column};});
    placed.forEach(item=>result.push({...item,columns:columnEnds.length})); i=j;
  }
  return result;
}

function showNotice(message, kind='') { $('#notice').innerHTML=message?`<div class="notice ${kind}">${esc(message)}</div>`:''; }
function saveAndRender() { saveSettings(settings); renderAll(); }
function bind() {
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderAll, 100); });
  $('#prev').onclick=()=>changeDate(shift(anchor,-7)); $('#next').onclick=()=>changeDate(shift(anchor,7)); $('#today').onclick=()=>changeDate(todayISO()); $('#date').onchange=e=>changeDate(e.target.value);
  $('#refresh').onclick=async()=>{ await Promise.all([loadCatalog(true),loadWeek(true)]); };
  $('#addToggle').onclick=()=>$('#addPanel').classList.toggle('hidden');
  $('#addId').onclick=()=>addCourse($('#directId').value.trim());
  $('#coursePanels').onclick=handleFilter; $('#schedule').onclick=openEvent;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ settings.view=b.dataset.view; document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b)); saveAndRender(); });
  $('#sidebarToggle').onclick=()=>document.body.classList.toggle('sidebar-open');
  $('#reset').onclick=()=>{ if(confirm('Ponastavim vse predmete in filtre?')) { settings=loadSettings([]); settings.courses=Object.fromEntries(config.defaultCourses.map(id=>[id,{enabled:true,types:null,groups:null}])); saveSettings(settings); loadWeek(); } };
  document.querySelectorAll('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  setInterval(()=>{ if(!document.hidden && data) renderAll(); },60000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden && data) renderAll(); });
}
async function changeDate(value) { anchor=value; $('#date').value=value; await loadWeek(); }
async function addCourse(id) { const meta=catalog.find(c=>c.id===id); if(!meta) { showNotice(`Predmeta z ID ${id || '—'} v dejanskem Wise katalogu ni.`, 'error'); return; } if(settings.courses[id]) { showNotice('Predmet je že na seznamu.','warning'); return; } settings.courses[id]={enabled:true,types:null,groups:null}; saveSettings(settings); $('#directId').value=''; await loadWeek(); }
function handleFilter(e) { const a=e.target.dataset.action, id=e.target.dataset.id; if(!a||!id)return; const s=settings.courses[id]; if(a==='enable')s.enabled=e.target.checked; if(a==='remove'){delete settings.courses[id];saveSettings(settings);loadWeek();return;} if(a==='type'){const all=discovered(id,'types');s.types=all.filter(t=>document.querySelector(`input[data-action="type"][data-id="${id}"][value="${CSS.escape(t)}"]`)?.checked);} if(a==='group'){const all=discovered(id,'groups');s.groups=all.filter(g=>document.querySelector(`input[data-action="group"][data-id="${id}"][value="${CSS.escape(g.id)}"]`)?.checked).map(g=>g.id);} if(a==='groups-all')s.groups=null;if(a==='groups-clear')s.groups=[];saveAndRender(); }
function openEvent(e) { const btn=e.target.closest('[data-event]'); if(!btn)return; const ev=data.events.find(x=>x.id===btn.dataset.event); if(!ev)return; $('#eventDetails').innerHTML=`<p class="eyebrow">${esc(ev.rawType)}</p><h2>${esc(ev.subject)}</h2><dl><dt>Datum in čas</dt><dd>${fmtFull.format(new Date(ev.date+'T12:00:00'))}, ${ev.start}–${ev.end}</dd><dt>Prostor / izvedba</dt><dd>${esc(ev.room)}${ev.remote?' · na daljavo':''}</dd><dt>Izvajalec</dt><dd>${esc(ev.lecturers||'Ni podatka')}</dd><dt>Skupina</dt><dd>${esc(ev.groups?.map(g=>g.name).join(', ')||'Skupna izvedba')}</dd></dl><a class="source-link" href="${ev.sourceUrl}" target="_blank" rel="noopener">Odpri izvirni Wise dogodek ↗</a>`; $('#eventDialog').showModal(); }

init().catch(e=>showNotice(e.message,'error'));
