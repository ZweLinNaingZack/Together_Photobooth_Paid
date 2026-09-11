import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmDiscard } from '../src/booth/leaveSession.ts';

test('cancel keeps captured/uploaded photos and blocks departure', () => {
  let photos = ['a', 'b'];
  assert.equal(confirmDiscard(true, () => false, () => { photos = []; }), false);
  assert.deepEqual(photos, ['a', 'b']);
});
test('confirmed departure clears the session', () => {
  let photos = ['a', 'b'];
  assert.equal(confirmDiscard(true, () => true, () => { photos = []; }), true);
  assert.deepEqual(photos, []);
});
test('empty sessions leave without a warning', () => {
  assert.equal(confirmDiscard(false, () => { throw Error('Unexpected prompt'); }, () => {}), true);
});
