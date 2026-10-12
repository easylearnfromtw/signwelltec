import test from 'node:test';
import assert from 'node:assert/strict';

async function setup(draw = () => true) {
  const { createRenderLoop } = await import('../assets/js/render-loop.mjs');
  let visible = true, id = 0;
  const pending = new Map(), samples = [];
  const loop = createRenderLoop({
    draw: (now, dt) => { samples.push(dt); return draw(now, dt); },
    isVisible: () => visible,
    requestFrame: cb => { pending.set(++id, cb); return id; },
    cancelFrame: token => pending.delete(token)
  });
  return { loop, pending, samples, hide: () => { visible = false; }, show: () => { visible = true; },
    tick(now) { const entry = pending.entries().next().value; assert.ok(entry); pending.delete(entry[0]); entry[1](now); }
  };
}

test('repeated wakes and rapid hide/show keep exactly one animation loop', async () => {
  const h = await setup();
  h.loop.wake(); h.loop.wake(); h.loop.wake();
  assert.equal(h.pending.size, 1);
  h.tick(100); assert.equal(h.pending.size, 1);
  h.hide(); h.loop.pause(); assert.equal(h.pending.size, 0);
  h.loop.wake(); assert.equal(h.pending.size, 0);
  h.show(); h.loop.wake(); h.loop.wake(); assert.equal(h.pending.size, 1);
  h.tick(10000); assert.ok(h.samples.at(-1) <= 1 / 60, 'background time must not jump the scene');
});

test('covered or settled scene stops scheduling until an input wakes it', async () => {
  let animate = false;
  const h = await setup(() => animate);
  h.loop.wake(); h.tick(100); assert.equal(h.pending.size, 0);
  animate = true; h.loop.wake(); h.tick(1000); assert.equal(h.pending.size, 1);
  h.hide(); h.tick(1020); assert.equal(h.pending.size, 0);
});

test('visible animation follows display cadence without alternating dropped frames', async () => {
  const h = await setup();
  h.loop.wake(); for (let i = 0; i < 120; i++) h.tick(100 + i * (1000 / 120));
  assert.equal(h.samples.length, 120);
  assert.ok(Math.abs(h.samples.at(-1) - 1 / 120) < 1e-6);
  h.loop.pause(); assert.equal(h.pending.size, 0);
});
