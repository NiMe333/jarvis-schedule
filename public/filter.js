export function eventVisible(event, settings) {
  const course = settings.courses[event.courseId];
  if (!course?.enabled) return false;
  if (course.types !== null && !course.types.includes(event.type)) return false;
  if (!event.groups?.length) return true;
  if (course.groups === null) return true;
  return event.groups.some(group => course.groups.includes(group.id));
}

export function filterEvents(events, settings) { return events.filter(event => eventVisible(event, settings)); }

export function applyRecognized(events, settings) {
  return filterEvents(events, settings).flatMap(event => {
    const recognized = settings.courses[event.courseId]?.recognized;
    const applies = recognized?.enabled && event.type !== 'PR' && recognized.types.includes(event.type);
    if (applies && recognized.mode === 'hidden') return [];
    return [{ ...event, optional: Boolean(applies) }];
  });
}
