import test from 'node:test';
import assert from 'node:assert/strict';
import { isRemote, pickLecturers, splitTitle } from '../server/normalize.js';

test('RV-NA DALJAVO se normalizira v RV in oddaljeno izvedbo', () => {
  const value = splitTitle('Računalniške vaje (RV-NA DALJAVO)');
  assert.equal(value.type, 'RV');
  assert.equal(value.remote, true);
});

test('E-PREDAVALNICA pomeni oddaljeno izvedbo', () => {
  assert.equal(isRemote('SV', 'E-PREDAVALNICA'), true);
  assert.equal(isRemote('PR', 'A-301'), false);
});

test('izvajalce prepozna pod različnimi oznakami Wise strani', () => {
  assert.equal(pickLecturers({ 'Vrsta izvedbe': 'PR', Izvajalci: '  Ana Novak, B. Kovač ' }), 'Ana Novak, B. Kovač');
  assert.equal(pickLecturers({ Predavatelj: 'Tina Test' }), 'Tina Test');
  assert.equal(pickLecturers({ 'Vrsta izvedbe': 'PR' }, 'Rezervni podatek'), 'Rezervni podatek');
});
