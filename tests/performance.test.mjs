import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('scroll chrome measures each section once before writing styles', () => {
  const source = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function gt()');
  const end = source.indexOf('window.addEventListener("scroll"', start);
  const events = [];
  const write = () => { events.push('write'); return true; };
  const recordSet = (target, key, value) => { write(); target[key] = value; return true; };
  const node = () => ({
    dataset: new Proxy({}, { set: recordSet }),
    style: new Proxy({}, { set: recordSet }),
    classList: { toggle: write, add: write, remove: write },
    get offsetHeight() { events.push('read'); return 70; }
  });
  const sections = [0, 1, 2].map(i => ({
    dataset: { tone: i === 0 ? 'dark' : 'light' },
    getBoundingClientRect() { events.push('rect:' + i); return { top: i * 350 - 10, bottom: (i + 1) * 350 - 10 }; }
  }));
  const context = {
    window: { scrollY: 360, innerHeight: 900 },
    g: { documentElement: { get scrollHeight() { events.push('read'); return 1800; } } },
    xt: sections, W: node(), tt: node(), dt: node(), ie: node(),
    K: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    Bt: { matches: true }, ft: 0, Et: true
  };
  context.Pt = y => sections.find(s => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
  context.Ut = y => context.Pt(y)?.dataset.tone;
  vm.runInNewContext(source.slice(start, end) + ';gt();', context);
  const firstWrite = events.indexOf('write');
  assert.ok(firstWrite >= 0);
  assert.equal(events.slice(firstWrite).some(e => e === 'read' || e.startsWith('rect:')), false,
    'layout reads after a style write can force synchronous layout');
  for (let i = 0; i < sections.length; i++) assert.equal(events.filter(e => e === 'rect:' + i).length, 1);
  assert.equal(context.W.dataset.tone, 'dark');
  assert.equal(context.tt.dataset.tone, 'light');
});

for (const type of ['pointercancel', 'pointerup']) {
  test('dock ' + type + ' wakes settled chrome even without a scroll', () => {
    const source = readFileSync(new URL('../assets/js/software-drive.js', import.meta.url), 'utf8');
    const start = source.indexOf('function endDock(');
    const end = source.indexOf("dock.addEventListener('pointerup'", start);
    let wakes = 0;
    const context = {
      dockDrag: { id: 7, left: 0 }, dockSuppress: false,
      dockItems: [{}], boxes: [{ x: 0, w: 60 }],
      dock: { classList: { remove() {} } },
      goToChapter() {}, setTimeout: callback => callback(),
      wakeChrome: () => wakes++
    };
    vm.runInNewContext(source.slice(start, end) + ';endDock({pointerId:7,clientX:30,type:' + JSON.stringify(type) + '});', context);
    assert.equal(context.dockDrag, null);
    assert.equal(wakes, 1, 'the capsule needs a frame to restore its chapter position and scale');
  });
}
