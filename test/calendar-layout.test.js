import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDay } from '../public/calendar-layout.js';
import { minutes, monday, shift } from '../public/date-utils.js';

test('datumska orodja ohranijo začetek delovnega tedna', () => {
  assert.equal(monday('2026-10-06'),'2026-10-05');
  assert.equal(shift('2026-10-05',4),'2026-10-09');
  assert.equal(minutes('11:58'),718);
});

test('prekrivajoči dogodki dobijo ločene stolpce', () => {
  const events=[{id:'a',start:'09:00',end:'11:00'},{id:'b',start:'10:00',end:'12:00'},{id:'c',start:'12:00',end:'13:00'}];
  const result=layoutDay(events);
  assert.deepEqual(result.map(item=>[item.event.id,item.column,item.columns]),[['a',0,2],['b',1,2],['c',0,1]]);
});

test('dogodka z enakim začetkom in koncem sta vedno drug ob drugem', () => {
  const result=layoutDay([
    {id:'a',start:'09:00',end:'10:00'},
    {id:'b',start:'09:00',end:'10:00'}
  ]);
  assert.deepEqual(result.map(item=>[item.event.id,item.column,item.columns]),[['a',0,2],['b',1,2]]);
});
