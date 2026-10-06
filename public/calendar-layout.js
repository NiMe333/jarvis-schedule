import { minutes } from './date-utils.js';

export function layoutDay(events) {
  const result=[];
  for(let i=0;i<events.length;){
    const cluster=[];
    let end=minutes(events[i].end),j=i;
    while(j<events.length&&(j===i||minutes(events[j].start)<end)){
      cluster.push(events[j]);
      end=Math.max(end,minutes(events[j].end));
      j++;
    }
    const ends=[];
    const placed=cluster.map(event=>{
      let column=ends.findIndex(value=>value<=minutes(event.start));
      if(column<0)column=ends.length;
      ends[column]=minutes(event.end);
      return{event,column};
    });
    placed.forEach(value=>result.push({...value,columns:ends.length}));
    i=j;
  }
  return result;
}
