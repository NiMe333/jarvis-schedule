export function todayISO() {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana'}).format(new Date());
}

export function shift(date, days) {
  const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

export function monday(date) {
  const value=new Date(`${date}T12:00:00Z`),day=value.getUTCDay()||7;
  return shift(date,1-day);
}

export function minutes(time) {
  const [hours,mins]=time.split(':').map(Number);
  return hours*60+mins;
}
