const targets = new Map();
let running = null;
let lastRunAt = null;
let lastSuccessAt = null;
let lastError = null;
let lastSlot = null;

function ljubljanaParts() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return { date:`${parts.year}-${parts.month}-${parts.day}`, hour:Number(parts.hour), minute:Number(parts.minute) };
}
export function registerTarget(ids, dates) { targets.set([...ids].sort().join(','), { ids, dates, at:Date.now() }); }
export function schedulerStatus() { return { lastRunAt,lastSuccessAt,lastError,running:Boolean(running),schedule:['08:00','16:00'],timezone:'Europe/Ljubljana' }; }
export function startScheduler(syncTarget, defaults) {
  registerTarget(defaults.ids, defaults.dates);
  const check=()=>{ const now=ljubljanaParts(); const slot=now.hour>=16?'16':now.hour>=8?'08':null; const key=slot?`${now.date}:${slot}`:null; if(key&&key!==lastSlot){ lastSlot=key; runAll(syncTarget); } };
  check(); const timer=setInterval(check,60_000); timer.unref?.();
}
async function runAll(syncTarget) {
  if(running)return running;
  running=(async()=>{ lastRunAt=Date.now();lastError=null;try{for(const target of targets.values())await syncTarget(target);lastSuccessAt=Date.now();}catch(error){lastError=error.message;}finally{running=null;} })();
  return running;
}
