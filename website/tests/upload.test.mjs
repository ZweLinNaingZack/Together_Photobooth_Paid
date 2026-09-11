import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePhotoSelection, importPhoto } from '../src/booth/importPhotos.ts';

const photo = (type = 'image/jpeg', size = 100) => ({ name: 'photo.jpg', type, size });
test('uploads respect available slots and reject unsupported or oversized files', () => {
  assert.doesNotThrow(() => validatePhotoSelection([photo(), photo('image/png')], 3));
  assert.throws(() => validatePhotoSelection([photo(), photo()], 1), /up to 1/);
  assert.throws(() => validatePhotoSelection([photo()], 0), /up to 0/);
  assert.throws(() => validatePhotoSelection([photo('image/heic')], 1), /HEIC/);
  assert.throws(() => validatePhotoSelection([photo('image/svg+xml')], 1), /JPG/);
  assert.throws(() => validatePhotoSelection([photo('image/jpeg', 21 * 1024 * 1024)], 1), /20 MB/);
});
test('imports scale large photos locally and revoke temporary URLs on success and failure', async () => {
  const previous = { Image: globalThis.Image, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let fail = false, revoked = 0, canvas;
  globalThis.Image = class { naturalWidth = 4800; naturalHeight = 3200; async decode() { if (fail) throw Error('corrupt'); } };
  URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => revoked++;
  globalThis.document = { createElement: () => canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,photo' } };
  try {
    assert.equal(await importPhoto(photo()), 'data:image/jpeg;base64,photo');
    assert.equal(canvas.width, 2400); assert.equal(canvas.height, 1600); assert.equal(revoked, 1);
    fail = true; await assert.rejects(importPhoto(photo()), /Could not open/); assert.equal(revoked, 2);
  } finally { globalThis.Image = previous.Image; globalThis.document = previous.document; URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke; }
});
