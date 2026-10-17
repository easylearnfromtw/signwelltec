import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scene = readFileSync(new URL('../assets/js/scene.js', import.meta.url), 'utf8');
const beginning = scene.indexOf('function swGpuDpr(');
const ending = scene.indexOf('\nfunction b_(', beginning);
assert.ok(beginning >= 0 && ending > beginning, 'the shared GPU resolution governor is defined once');
const helper = scene.slice(beginning, ending);

function gpuDpr(width, height, hardwareDpr, maxDpr, pixelBudget) {
  return vm.runInNewContext(
    helper + '\n;swGpuDpr(' + [width, height, maxDpr, pixelBudget].join(',') + ');',
    { window: { devicePixelRatio: hardwareDpr } }
  );
}

test('high-DPI mobile canvases respect memory and fill-rate budgets', () => {
  for (const [width, height, deviceDpr] of [[390,844,3],[430,932,3],[820,1180,2.5]]) {
    const budget = 1500000;
    const dpr = gpuDpr(width, height, deviceDpr, 1.5, budget);
    assert.ok(dpr >= .5 && dpr <= 1.5, 'mobile DPR bound');
    assert.ok(width * height * dpr * dpr <= budget + 1, 'mobile drawing buffer stays within budget');
  }
});

test('desktop rendering preserves sharpness without unlimited supersampling', () => {
  const dpr = gpuDpr(1920, 1080, 3, 2, 3200000);
  assert.ok(dpr > 1 && dpr < 2, '1920px desktop should use bounded supersampling');
  assert.ok(1920 * 1080 * dpr * dpr <= 3200001);
});

test('all three 3D stages guard unchanged drawing-buffer dimensions', () => {
  assert.ok(scene.includes('if (ratioChanged || sizeChanged) { r.setSize(width, height, false);'), 'hero resize');
  assert.ok(scene.includes('if (ratioChanged || sizeChanged) { o.setSize(width, height, !1);'), 'product viewer resize');
  assert.ok(scene.includes('if (ratioChanged || sizeChanged) { a.setSize(width, height, false);'), 'tape resize');
  assert.ok(scene.includes('l.shadow.mapSize.set(tapeMobile ? 512 : 1024'), 'tape GPU shadow budget');
});
