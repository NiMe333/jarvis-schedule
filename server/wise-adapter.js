import * as cheerio from 'cheerio';
import { WISE_ORIGIN, WISE_BASE } from './config.js';
import { clean, splitTitle, groupKey, isRemote, pickLecturers } from './normalize.js';

const layoutError = detail => new Error(`Wise podatkov ni mogoče razbrati (${detail}). Struktura strani se je verjetno spremenila.`);

function allowedDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Neveljaven datum.');
  return date;
}

function allowedIds(ids) {
  const list = String(ids || '').split(',').filter(Boolean);
  if (!list.length || list.length > 30 || list.some(id => !/^\d{1,10}$/.test(id))) throw new Error('Neveljavni ID-ji predmetov.');
  return [...new Set(list)];
}

async function get(path, params = {}) {
  const url = new URL(`${WISE_BASE}${path}`, WISE_ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { 'user-agent': 'Moj FERI urnik/1.0 (local personal demo)', accept: 'text/html' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Wise je vrnil HTTP ${response.status}.`);
  return { html: await response.text(), url: url.href };
}

export async function fetchCatalog(date) {
  const { html, url } = await get('/', { date: allowedDate(date), lang: 'sl' });
  const $ = cheerio.load(html);
  const courses = [];
  $('input[name="pick[]"]').each((_, node) => {
    const id = String($(node).attr('value') || '');
    const label = $(node).closest('.picker-item');
    const name = clean(label.find('span').clone().children().remove().end().text());
    const code = clean(label.find('small').text());
    if (/^\d+$/.test(id) && name) courses.push({ id, name, code });
  });
  if (!courses.length) throw layoutError('katalog predmetov manjka');
  return { courses, sourceUrl: url };
}

async function fetchDetail(eventId, courseId, fallback) {
  if (!/^S\d+$/.test(eventId)) return fallback;
  const { html } = await get(`/event/${eventId}`, { lang: 'sl' });
  const $ = cheerio.load(html);
  const facts = {};
  $('.evfacts dt').each((_, dt) => { facts[clean($(dt).text())] = clean($(dt).next('dd').text()); });
  $('.evfacts tr').each((_, row) => {
    const cells = $(row).find('th,td').toArray().map(cell => clean($(cell).text())).filter(Boolean);
    if (cells.length >= 2) facts[cells[0]] = cells.slice(1).join(' · ');
  });
  const groupElement = $('.evgroup-list');
  const titleLines = String(groupElement.attr('title') || '').split(/\n+/).map(clean).filter(Boolean);
  const rawGroups = titleLines.map(line => {
    const split = line.lastIndexOf(': ');
    return split >= 0 ? { source: line, name: line.slice(split + 2), context: line.slice(0, split) } : { source: line, name: line, context: '' };
  });
  const counts = new Map(rawGroups.map(group => [group.name, rawGroups.filter(other => other.name === group.name).length]));
  const groups = rawGroups.length ? rawGroups.map(group => ({
    id: groupKey(courseId, fallback.type, group.source),
    name: counts.get(group.name) > 1 ? `${group.name} · ${group.context}` : group.name
  })) : clean(groupElement.text()).split(/,\s*/).filter(Boolean).map(name => ({ id: groupKey(courseId, fallback.type, name), name }));
  return {
    code: facts['Šifra predmeta'] || '',
    room: facts.Prostori || fallback.room,
    lecturers: pickLecturers(facts, fallback.lecturers),
    rawType: facts['Vrsta izvedbe'] || fallback.rawType,
    groups
  };
}

export async function fetchWeek(date, ids, detailCache) {
  const validDate = allowedDate(date);
  const courseIds = allowedIds(ids);
  const { html, url } = await get('/', { date: validDate, lang: 'sl', match: 'all', c: courseIds.join('_') });
  const $ = cheerio.load(html);
  if (!$('.day').length) throw layoutError('dnevi urnika manjkajo');
  const nameToId = new Map();
  $('input[name="pick[]"]:checked').each((_, node) => {
    const label = $(node).closest('.picker-item');
    nameToId.set(clean(label.find('span').clone().children().remove().end().text()), String($(node).val()));
  });
  if (!nameToId.size) throw layoutError('izbrani predmeti niso označeni');
  const events = [];
  let malformedCards = 0;
  $('.day').each((_, day) => {
    const label = clean($(day).find('.day-date').text());
    const dm = label.match(/(\d+)\.\s*(\d+)\./);
    let eventDate = validDate;
    if (dm) {
      let year = Number(validDate.slice(0, 4));
      const month = Number(dm[2]);
      const anchorMonth = Number(validDate.slice(5, 7));
      if (month === 12 && anchorMonth === 1) year--;
      if (month === 1 && anchorMonth === 12) year++;
      eventDate = `${year}-${String(month).padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    }
    $(day).find('article.card').each((__, card) => {
      const title = splitTitle($(card).find('.card-title').text());
      const courseId = nameToId.get(title.subject);
      if (!courseId) return;
      const parts = clean($(card).find('.card-sub').text()).split(' · ');
      const times = clean($(card).find('.card-time').text()).split(/[–-]/);
      const link = $(card).find('.card-open');
      const eventId = String(link.attr('data-event') || '');
      if (!/^\d{2}:\d{2}$/.test(times[0]||'') || !/^\d{2}:\d{2}$/.test(times[1]||'') || !eventId) { malformedCards++; return; }
      events.push({ id: eventId, courseId, ...title, date: eventDate, start: times[0], end: times[1], room: parts[0] || '', lecturers: parts[1] || '', groupSummary: parts.slice(2).join(' · '), sourceUrl: new URL((link.attr('href') || '').split('?')[0], WISE_ORIGIN).href });
    });
  });
  if (malformedCards) throw layoutError(`${malformedCards} dogodkov nima pričakovanih polj`);
  const enriched = [];
  // At most four detail requests at once; repeated event IDs are deduplicated by cache.js.
  for (let i = 0; i < events.length; i += 4) {
    enriched.push(...await Promise.all(events.slice(i, i + 4).map(async event => {
      const detail = await detailCache(event.id, () => fetchDetail(event.id, event.courseId, event));
      const rawType = detail.rawType || event.rawType;
      const room = detail.room || event.room;
      return { ...event, ...detail, rawType, room, type: rawType.startsWith('RV') ? 'RV' : rawType, remote: event.remote || isRemote(rawType, room) };
    })));
  }
  const publishedAt = $('p.foot-published time').attr('datetime') || null;
  return { date: validDate, events: enriched, publishedAt, sourceUrl: url };
}
