import { minutes } from './date-utils.js';

export function layoutDay(events) {
  const result=[];
  const ordered=events.slice().sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
  for(let i=0;i<ordered.length;){
    const cluster=[];
    let end=minutes(ordered[i].end),j=i;
    while(j<ordered.length&&(j===i||minutes(ordered[j].start)<end)){
      cluster.push(ordered[j]);
      end=Math.max(end,minutes(ordered[j].end));
      j++;
    }
    const ends=[];
    const placed=cluster.map(event=>{
      let column=ends.findIndex(value=>value<=minutes(event.start));
      if(column<0)column=ends.length;
      ends[column]=minutes(event.end);
      return{event,column};
    });
    const columnCount=ends.length;
    placed.forEach(value=>result.push({...value,columns:columnCount}));
    i=j;
  }
  return result;
}
