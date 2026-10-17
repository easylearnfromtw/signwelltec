import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../software.html',import.meta.url),'utf8');
const film=new URL('../assets/video/signwell-software-film.mp4',import.meta.url);

test('brand film button appears below the existing Signwellsoft navigation CTA',()=>{
  const nav=html.indexOf('<span>前往 SIGNWELLSOFT</span>');
  const filmCta=html.indexOf('<span>觀看形象影片</span>');
  const footer=html.indexOf('<footer class="foot">');
  assert.ok(footer>=0&&nav>footer&&filmCta>nav);
  assert.match(html,/data-software-film-open aria-haspopup="dialog" aria-controls="software-film"/);
});

test('modal is accessible, and video has a published local source',()=>{
  assert.match(html,/<div class="software-film" id="software-film" role="dialog" aria-modal="true"[^>]*hidden>/);
  assert.match(html,/src="assets\/video\/signwell-software-film\.mp4" type="video\/mp4"/);
  assert.match(html,/<video[^>]*controls playsinline preload="none"/);
  assert.match(html,/video\.pause\(\)/);
  assert.match(html,/if\(event\.key==='Escape'\)/);
  const size=statSync(film).size;
  assert.ok(size>100000&&size<10000000, 'the HTML references the real compressed MP4');
  const file=readFileSync(film);
  assert.equal(file.toString('ascii',4,8),'ftyp');
});

test('all inline classic scripts on the 3D software page parse',()=>{
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>=3,'page has the expected interactive scripts');
  for(const match of scripts)new vm.Script(match[1]);
});
