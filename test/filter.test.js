import test from 'node:test';
import assert from 'node:assert/strict';
import { eventVisible, filterEvents, applyRecognized } from '../public/filter.js';

const base = { version: 1, courses: {
  '1': { enabled: true, types: ['PR', 'RV'], groups: ['1:RV:A'] },
  '2': { enabled: true, types: ['RV'], groups: ['2:RV:C'] }
}};
const ev = (courseId, type, groups=[]) => ({ courseId, type, groups: groups.map(id=>({id})) });

test('skupno predavanje ostane vidno ne glede na izbrane skupine RV', () => {
  assert.equal(eventVisible(ev('1','PR'), base), true);
});
test('dogodek z več skupinami je viden ob vsaj enem ujemanju', () => {
  assert.equal(eventVisible(ev('1','RV',['1:RV:X','1:RV:A']), base), true);
  assert.equal(eventVisible(ev('1','RV',['1:RV:X']), base), false);
});
test('nastavitve predmetov so neodvisne', () => {
  const events=[ev('1','RV',['1:RV:A']),ev('2','RV',['2:RV:D'])];
  assert.equal(filterEvents(events,base).length,1);
});
test('prazna izbira skrije skupinske vaje, ne pa skupne izvedbe', () => {
  const settings=structuredClone(base); settings.courses['1'].groups=[];
  assert.equal(eventVisible(ev('1','RV',['1:RV:A']),settings),false);
  assert.equal(eventVisible(ev('1','PR'),settings),true);
});
test('RV-NA DALJAVO se filtrira kot RV', () => {
  assert.equal(eventVisible({...ev('1','RV',['1:RV:A']),rawType:'RV-NA DALJAVO',remote:true},base),true);
});
test('priznane vaje so lahko neobvezne brez ponovnega vključevanja filtriranih dogodkov', () => {
  const settings=structuredClone(base); settings.courses['1'].recognized={enabled:true,types:['RV'],mode:'optional'};
  const result=applyRecognized([ev('1','RV',['1:RV:A']),ev('1','RV',['1:RV:X']),ev('1','PR')],settings);
  assert.equal(result.length,2); assert.equal(result[0].optional,true); assert.equal(result[1].optional,false);
});
test('skrivanje priznanih vaj ne skrije predavanj', () => {
  const settings=structuredClone(base); settings.courses['1'].recognized={enabled:true,types:['RV'],mode:'hidden'};
  const result=applyRecognized([ev('1','RV',['1:RV:A']),ev('1','PR')],settings);
  assert.deepEqual(result.map(x=>x.type),['PR']);
});
