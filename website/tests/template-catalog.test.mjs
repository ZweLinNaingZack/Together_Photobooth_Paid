import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { templateCatalog } from '../src/booth/templateCatalog.js';
import { layouts } from '../src/booth/core.js';
import { createRoomService } from '../server/rooms.mjs';

test('every supported layout has valid local templates accepted by rooms', () => {
  for (const layout of ['B','C','D','E','G','K','N']) {
    const entries = Object.entries(templateCatalog).filter(([, d]) => d.layout === layout);
    assert.equal(entries.length, layout === 'N' ? 1 : 10);
    for (const [template, design] of entries) {
      const service = createRoomService();
      const host = service.run('create', { settings: { layout, template, source: 'camera' } });
      const guest = service.run('join', { code: host.code });
      assert.equal(guest.settings.template, template);
      assert.throws(() => service.run('create', { settings: { layout: 'A', template, source: 'camera' } }), /valid layout/);
      assert.equal(design.slots.length, layouts[layout].count);
      assert(existsSync(new URL('../public' + design.src, import.meta.url)));
      for (const slot of design.slots) {
        assert(slot.x >= 0 && slot.y >= 0 && slot.w > 0 && slot.h > 0);
        assert(slot.x + slot.w <= design.size[0] && slot.y + slot.h <= design.size[1]);
      }
    }
  }
});
test('retired Layout G cannot create a booth or offer designs', () => {
  assert.equal(layouts.H, undefined); // Internal H was displayed as Layout G.
  assert(!Object.values(templateCatalog).some(d => d.layout === 'H'));
  assert.throws(() => createRoomService().run('create', { settings: { layout: 'H', template: null, source: 'camera' } }), /valid layout/);
});
