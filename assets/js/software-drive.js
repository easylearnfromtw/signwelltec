/* 欣緯軟體 SIGNWELL SOFTWARE — scroll-driven drive through a clay-style 3D Taiwan.
   The camera rides in front of our van looking back: as you scroll, the van drives forward
   and the blocks and billboards slide toward the centre of the screen, into the distance.
   Route: loft office in an industrial park → mountain road with tea terraces (manager billboards)
   → foothill 透天厝 (customer questions) → city boulevard with 騎樓 arcades (seven website billboards).
   The status page then scrolls over the world.
   three.js r160 (MIT) is loaded from ./vendor. Without WebGL the page stays a flat card list. */
import * as THREE from './vendor/three.module.min.js';

const root = document.documentElement;
root.classList.add('engine');   // tells the boot script the 3D module is running, so it waits instead of falling back
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const wait = ms => new Promise(r => setTimeout(r, ms));
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ============================================================== UI shared by both modes */
const dock = $('#dock'), track = $('#dockTrack'), cap = $('#dockCap'), lens = $('#dockLens');
const dockItems = $$('.dock__item', track);
const progressBar = $('#progress'), topBar = $('#top'), placeName = $('#placeName');
const statusEl = $('#status'), driveEl = $('#drive'), hud = $('#hud');
const cards = $$('.card', hud);
const N_CH = dockItems.length;
let chapterP = 0;            // continuous chapter position for the dock capsule (0..N_CH-1)
let goToChapter = i => { const id = dockItems[i].getAttribute('href'); const el = $(id); if (el) el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' }); };

lens.innerHTML = dockItems.map(a => '<span class="dock__item">' + a.innerHTML + '</span>').join('');
let dockDrag = null, dockSuppress = false, boxes = [], dockW = 0, dockL = 0;
function readDock() { const dr = dock.getBoundingClientRect(), cl = dock.clientLeft; dockW = dock.clientWidth; dockL = dr.left; boxes = dockItems.map(it => { const r = it.getBoundingClientRect(); return { x: r.left - dr.left - cl, w: r.width }; }); }
let capKey = '';
function placeCap(x, w, press) {
  const key = x.toFixed(1) + '|' + w.toFixed(1) + '|' + (press ? 1 : 0); if (key === capKey) return; capKey = key;
  cap.style.width = w + 'px'; cap.style.transform = 'translateX(' + x.toFixed(2) + 'px) scale(' + (press ? 1.1 : 1) + ')';
  lens.style.width = dockW + 'px'; lens.style.transformOrigin = (x + w / 2).toFixed(2) + 'px 50%';
  lens.style.transform = 'translateX(' + (-x).toFixed(2) + 'px) scale(1.12)';
  for (let i = 0; i < dockItems.length; i++) { const b = boxes[i], c = b.x + b.w / 2; dockItems[i].classList.toggle('is-under', c > x + 4 && c < x + w - 4); }
}
function capForP(p) { const i = Math.floor(clamp(p, 0, N_CH - 1)), j = Math.min(N_CH - 1, i + 1), f = clamp(p - i, 0, 1), a = boxes[i], b = boxes[j]; return { x: lerp(a.x, b.x, f), w: lerp(a.w, b.w, f) }; }
dock.addEventListener('dragstart', e => e.preventDefault());
dock.addEventListener('pointerdown', e => {
  if (e.button > 0) return; readDock(); const box = capForP(chapterP);
  dockDrag = { id: e.pointerId, x0: e.clientX, moved: false, left: dockL, w: box.w };
  dock.setPointerCapture(e.pointerId); dock.classList.add('is-drag');
  placeCap(clamp(e.clientX - dockL - box.w / 2, 5, dockW - 5 - box.w), box.w, true);
});
dock.addEventListener('pointermove', e => {
  if (!dockDrag || e.pointerId !== dockDrag.id) return; if (Math.abs(e.clientX - dockDrag.x0) > 5) dockDrag.moved = true;
  placeCap(clamp(e.clientX - dockDrag.left - dockDrag.w / 2, 5, dockW - 5 - dockDrag.w), dockDrag.w, true);
});
function endDock(e) {
  if (!dockDrag || e.pointerId !== dockDrag.id) return; const x = e.clientX - dockDrag.left; let best = 0, bd = 1e9;
  for (let i = 0; i < dockItems.length; i++) { const b = boxes[i], d = Math.abs(b.x + b.w / 2 - x); if (d < bd) { bd = d; best = i; } }
  dockDrag = null; dock.classList.remove('is-drag');
  if (e.type === 'pointerup') { dockSuppress = true; setTimeout(() => { dockSuppress = false; }, 350); goToChapter(best); }
}
dock.addEventListener('pointerup', endDock); dock.addEventListener('pointercancel', endDock);
dockItems.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); if (dockSuppress) return; goToChapter(i); }));
$$('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goToChapter(+a.dataset.goto); }));

let lastCh = -1, lastTone = '', scrollDir = 0, lastSY = scrollY, dockDirty = 60, lastDockTone = '', compactNow = false;
function markDockDirty(n) { dockDirty = Math.max(dockDirty, n); }
if ('ResizeObserver' in window) new ResizeObserver(() => markDockDirty(20)).observe(dock);
let docH = 0;   // document height, read only when the layout actually changes (not every frame)
const readDocH = () => { docH = document.documentElement.scrollHeight; };
if ('ResizeObserver' in window) new ResizeObserver(readDocH).observe(document.body); addEventListener('resize', readDocH); readDocH();
function updateChrome(statusTop) {
  const sy = scrollY, vh = innerHeight;
  scrollDir = sy > lastSY + 1 ? 1 : sy < lastSY - 1 ? -1 : scrollDir; lastSY = sy;
  progressBar.style.transform = 'scaleX(' + clamp(sy / Math.max(1, docH - vh), 0, 1).toFixed(4) + ')';
  const ch = Math.round(clamp(chapterP, 0, N_CH - 1));
  if (ch !== lastCh) { lastCh = ch; dockItems.forEach((it, i) => i === ch ? it.setAttribute('aria-current', 'true') : it.removeAttribute('aria-current')); }
  const stTop = statusTop == null ? statusEl.getBoundingClientRect().top : statusTop;
  const tone = stTop < 40 ? 'dark' : 'light';
  if (tone !== lastTone) { lastTone = tone; root.dataset.uiTone = tone; topBar.dataset.tone = tone; const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', tone === 'dark' ? '#0a0a0b' : '#eef0f2'); }
  const dTone = stTop < vh - 60 ? 'dark' : 'light'; if (dTone !== lastDockTone) { lastDockTone = dTone; dock.dataset.tone = dTone; }
  const compact = scrollDir > 0 && sy > 160; if (compact !== compactNow) { compactNow = compact; dock.classList.toggle('is-compact', compact); markDockDirty(45); }
  if (!dockDrag) { if (dockDirty > 0) { readDock(); dockDirty--; } const cb = capForP(chapterP); placeCap(cb.x, cb.w, false); }
}

/* managers (flat mode / screen readers): segmented control with one shared capsule */
const seg = $('#mgrSeg'), segCap = seg ? $('.seg__cap', seg) : null, segBtns = seg ? $$('button', seg) : [];
let mgrSel = 0;
function placeSeg() { if (!seg || !seg.offsetParent) return; const b = segBtns[mgrSel], r = b.getBoundingClientRect(), sr = seg.getBoundingClientRect(); const x = r.left - sr.left - seg.clientLeft; segCap.style.width = r.width + 'px'; seg.style.setProperty('--seg-x', 'translateX(' + x.toFixed(1) + 'px)'); segCap.style.transform = 'translateX(' + x.toFixed(1) + 'px)'; }
function selectMgr(i, focus) {
  mgrSel = i; segBtns.forEach((b, k) => { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); b.tabIndex = k === i ? 0 : -1; $('#' + b.getAttribute('aria-controls')).hidden = k !== i; });
  if (focus) segBtns[i].focus(); placeSeg();
}
segBtns.forEach((b, i) => {
  b.addEventListener('click', () => selectMgr(i));
  b.addEventListener('pointerdown', () => seg.classList.add('is-press'));
  b.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); selectMgr((mgrSel + (e.key === 'ArrowRight' ? 1 : -1) + segBtns.length) % segBtns.length, true); } });
});
addEventListener('pointerup', () => seg && seg.classList.remove('is-press'));

/* customers: exclusive accordion (for browsers without <details name>) */
const qaItems = $$('#qa details');
qaItems.forEach(d => d.addEventListener('toggle', () => { if (d.open) qaItems.forEach(o => { if (o !== d) o.open = false; }); }));
const cmsHow = $('#cmsHow'); if (cmsHow && matchMedia('(max-width:1179px)').matches) cmsHow.open = false;

/* status page: blur-fade reveal, count-up and spotlight cards */
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: .18 }) : null;
$$('.rv').forEach(el => io ? io.observe(el) : el.classList.add('is-in'));
const counter = $('[data-count]');
if (counter && io) {
  const co = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; co.disconnect(); const n = +counter.dataset.count, t0 = performance.now();
    (function tick(now) { const t = clamp((now - t0) / 1100, 0, 1); counter.textContent = Math.round(n * (1 - Math.pow(1 - t, 3))); if (t < 1) requestAnimationFrame(tick); })(t0); }, { threshold: .6 });
  co.observe(counter);
}
$$('.fact').forEach(f => f.addEventListener('pointermove', e => { const r = f.getBoundingClientRect(); f.style.setProperty('--mx', (e.clientX - r.left) + 'px'); f.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));

/* partners: one accessible list, plus aria-hidden copies so the strip loops without a gap.
   The track moves exactly one list-width per loop, at a constant SPEED in px/s on every screen. */
const marquee = $('#partnerMarquee');
if (marquee) {
  const mTrack = $('.marquee__track', marquee), mGroup = $('.marquee__group', marquee), SPEED = 34;
  let mw = -1;
  const fillMarquee = force => {
    const w = marquee.clientWidth; if (!force && Math.abs(w - mw) < 2) return; mw = w;
    $$('.marquee__group[aria-hidden]', mTrack).forEach(g => g.remove());
    if (reduced.matches) return;
    const gw = mGroup.getBoundingClientRect().width; if (!gw) return;
    for (let i = 0, n = Math.ceil(w / gw) + 1; i < n; i++) { const c = mGroup.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.removeAttribute('role'); mTrack.appendChild(c); }
    mTrack.style.setProperty('--marquee-shift', gw.toFixed(2) + 'px'); mTrack.style.setProperty('--marquee-dur', (gw / SPEED).toFixed(2) + 's');
  };
  fillMarquee(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fillMarquee(true));
  addEventListener('resize', () => fillMarquee(false));
  if (reduced.addEventListener) reduced.addEventListener('change', () => fillMarquee(true));
  // paused while off screen, so it costs nothing during the 3D drive
  if ('IntersectionObserver' in window) new IntersectionObserver(es => marquee.classList.toggle('is-off', !es[0].isIntersecting)).observe(marquee);
}
/* 「我有興趣合作」: desktops open a Gmail draft in a new tab; phones use mailto (opens the mail app) */
const coopBtn = $('#coopBtn');
if (coopBtn && coopBtn.dataset.gmail && matchMedia('(pointer:fine)').matches) { coopBtn.href = coopBtn.dataset.gmail; coopBtn.target = '_blank'; coopBtn.rel = 'noopener noreferrer'; }

/* ============================================================== flat mode */
function startFlat() {
  root.classList.add('no3d'); root.classList.remove('boot', 'is3d');
  const sections = dockItems.map(a => $(a.getAttribute('href')));
  function onScroll() {
    const vh = innerHeight; let p = 0;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * .45) p = i; });
    chapterP = p; updateChrome();
  }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
  requestAnimationFrame(() => { readDock(); placeSeg(); onScroll(); });
}

/* ============================================================== 3D mode */
const canvas = $('#world');
const SMALL = Math.min(innerWidth, screen.width || innerWidth) < 700 || matchMedia('(pointer:coarse)').matches;
let renderer = null;
try {
  const probe = document.createElement('canvas');
  const ok = !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  // Phones render near-native 2K, where MSAA costs a lot of memory and bandwidth for little gain.
  const msaa = !SMALL || (devicePixelRatio || 1) < 2;
  if (ok) renderer = new THREE.WebGLRenderer({ canvas, antialias: msaa, powerPreference: 'high-performance', alpha: false, stencil: false });
} catch (e) { renderer = null; }
if (!renderer) startFlat(); else start3D().catch(err => { console.error(err); try { renderer.dispose(); } catch (e) {} startFlat(); });

async function start3D() {
  const LOW = SMALL || (navigator.hardwareConcurrency || 8) <= 4;
  const R = rng(20261009);
  const SNAP = /[?&]snap\b/.test(location.search);   // test mode: no easing lag
  if (SNAP) root.classList.add('snap');
  const GL2 = renderer.capabilities.isWebGL2, GLX = renderer.getContext();

  /* ---------------- renderer, scene, light ---------------- */
  /* Resolution: aim for 2K. Desktops render a 2560-px long edge (supersampled on 1080p screens),
     phones render native up to 3×, both inside a pixel budget. A governor only ever steps down
     (one notch at a time, before a frame is drawn) so the canvas never shows a cleared buffer. */
  const DEV = devicePixelRatio || 1;
  const Q_LEVELS = [1, .87, .75, .64];
  let qLevel = (LOW && !SMALL) || (navigator.deviceMemory || 8) <= 3 ? 1 : 0;
  const qInit = qLevel; let qN = 0, qSlow = 0, qBad = 0, qGood = 0, qWentUp = false, qUpLocked = false, dprNow = 0;
  function baseDpr(cw, ch) {
    const budget = SMALL ? 3.0e6 : 4.2e6;
    const d = SMALL ? Math.min(DEV, 3) : Math.min(2, Math.max(DEV, 2560 / Math.max(cw, ch)));
    return Math.max(SMALL ? 1 : .8, Math.min(d, Math.sqrt(budget / Math.max(1, cw * ch))));
  }
  function applyDpr(cw, ch) {
    dprNow = Math.max(SMALL ? 1 : .75, baseDpr(cw, ch) * Q_LEVELS[qLevel]);
    renderer.setPixelRatio(dprNow); renderer.setSize(cw, ch, false); needRender = true;
  }
  let needRender = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;           // refreshed every other frame in the loop
  const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
  const HAZE = new THREE.Color(0xeef0f1);
  const scene = new THREE.Scene();
  scene.background = HAZE;
  scene.fog = new THREE.Fog(HAZE, 150, 560);
  const camera = new THREE.PerspectiveCamera(40, 1, 2, 1200);

  const hemi = new THREE.HemisphereLight(0xfdfcf8, 0xd5cfc3, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1df, 2.15);
  sun.castShadow = true;
  const SMAP = LOW ? 1536 : 2048;
  sun.shadow.mapSize.set(SMAP, SMAP);
  const SH = 72; Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 340 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = .4; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const SUN_OFF = new THREE.Vector3(-64, 100, -54);

  // soft sky dome so the horizon is not a flat grey
  {
    const g = new THREE.SphereGeometry(1000, 32, 16), col = [], c = new THREE.Color(), top = new THREE.Color(0xc9dcef), hor = new THREE.Color(0xf1f2f1);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 1000; c.copy(hor).lerp(top, clamp(y * 2.2, 0, 1)); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    var sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = 10; sky.frustumCulled = false; scene.add(sky);   // drawn after the opaque world: only uncovered pixels get shaded
  }
  // opaque pass front-to-back, so early depth testing skips hidden fragments (cheaper fill at 2K)
  renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.z - b.z || a.id - b.id);

  /* ---------------- palette & materials ---------------- */
  const C = {
    ink: 0x0a0a0b, paper: 0xffffff, yellow: 0xffd84d, blue: 0x3d6bff, blueSoft: 0xdfe7ff, pink: 0xf7c6d9, pinkDeep: 0xe98fb2, pinkSoft: 0xfde9f1,
    ground: 0xeceae5, road: 0xcfd1d4, wall: 0xf3f2ef, tree: 0x4c9a8a, tree2: 0x3f8577, tree3: 0x63ab93, trunk: 0x8d7b69,
    steel: 0x1d1e21, oak: 0xd6b48a, concrete: 0xd3d1cc, palm: 0x5f9a62, tea: 0x6fae5c
  };
  const matCache = new Map();
  function lam(color, extra) { const k = color + '|' + JSON.stringify(extra || {}); if (matCache.has(k)) return matCache.get(k); const m = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {})); matCache.set(k, m); return m; }
  const vcFlat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  /* atlas materials: each vertex carries the tile it samples; uv repeats inside that tile */
  function tiled(mat) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 tile;\nvarying vec4 vTile;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = tile;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vTile;').replace('#include <map_fragment>',
        '#ifdef USE_MAP\n vec2 tuv = vTile.xy + fract(vMapUv) * vTile.zw;\n' +
        (GL2 ? ' vec4 sampledDiffuseColor = textureGrad(map, tuv, dFdx(vMapUv) * vTile.zw, dFdy(vMapUv) * vTile.zw);\n' : ' vec4 sampledDiffuseColor = texture2D(map, tuv);\n') +
        ' diffuseColor *= sampledDiffuseColor;\n#endif');
    };
    mat.customProgramCacheKey = () => 'tiled-' + mat.type;
    return mat;
  }

  /* ---------------- canvas helpers ---------------- */
  const FONT_CN = '"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Hiragino Sans TC","Microsoft JhengHei",sans-serif';
  const FONT_D = '"Archivo","Noto Sans TC","Noto Sans CJK TC",sans-serif';
  const FONT_M = '"Plex Mono","IBM Plex Mono",ui-monospace,Consolas,monospace';
  function ctxOf(c) { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.setLineDash([]); x.globalAlpha = 1; x.lineCap = 'butt'; return x; }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function tokens(t) { return t.match(/[A-Za-z0-9\-.:/@&'’]+|\s+|./g) || []; }
  function wrap(ctx, text, maxW) {
    const out = []; let line = '';
    for (const tk of tokens(text)) { const test = line + tk; if (ctx.measureText(test).width > maxW && line.trim()) { out.push(line.trim()); line = tk.trim() ? tk : ''; } else line = test; }
    if (line.trim()) out.push(line.trim()); return out;
  }
  function fitFont(ctx, text, weight, size, family, maxW, min) { let s = size; ctx.font = weight + ' ' + s + 'px ' + family; while (ctx.measureText(text).width > maxW && s > min) { s -= 2; ctx.font = weight + ' ' + s + 'px ' + family; } return s; }
  function texFrom(c, repeat) {
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t;
  }
  function loadImg(src) { return new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }

  /* ---------------- data (mirrors the cards) ---------------- */
  const MANAGERS = [
    { name: '林哲愷', en: 'CHE-KAI LIN', now: ['欣緯生醫創辦人', '閒台文 Tai-Wan Way創辦人', 'CITYMUS 創辦人', '欣緯科技軟體部門經理'],
      edu: ['再興中學', '清華大學-經濟系學程', '中央大學-人工智慧學系學程', '中原大學-理工學系學程', 'Google UX Design Professional Certificate', '聯合大學企劃', '台英學士培育計畫'],
      link: 'https://easylearnfromtw.github.io/test/chekai-portfolio/#art', linkLabel: '前往林哲愷個人網站' },
    { name: '林哲緯', en: 'CHE-WEI LIN', now: ['欣緯生醫主編', '文森筆記創辦人', '欣緯科技軟體部門經理'],
      edu: ['建國中學', '中國醫藥大學醫學系', '新加坡國立大學實習', 'OMC奧林匹亞台灣地區數學壹等獎'],
      link: 'https://vincent-journal.andyhank1234567890.workers.dev/index.html', linkLabel: '閱讀文森筆記' }
  ];
  const WORKS = $$('.card--work').map((c, i) => ({
    i, stop: c.dataset.stop, name: $('h3', c).textContent.trim(), desc: $('.lead', c).textContent.trim(),
    url: ($('a.btn', c) || {}).href || null, urlText: $('.url', c).textContent.trim(), img: ($('img.card__thumb', c) || {}).src || null,
    kind: c.classList.contains('card--cms') ? 'cms' : !$('img.card__thumb', c) ? 'type' : 'shot'
  }));
  // Preserve speech-bubble data independently of the removed customer FAQ panel.
  // The 3D residential scene draws five conversation sprites using QUESTIONS[i].
  const QUESTIONS = [
    { q: '想自己更新網站內容，可以嗎？', a: '可以規劃內容後台。欣緯生醫的 CMS 就是一例。' },
    { q: '手機上看會不會跑版？', a: '電腦版與手機版一起設計，也一起檢查。' },
    { q: '只有想法，還沒有設計稿。', a: '從聊需求開始，先整理頁面架構，再進入設計。' },
    { q: '做得出我們品牌的感覺嗎？', a: '先確認品牌色、字體和說話語氣。' },
    { q: '網站會不會很慢？', a: '圖片與動畫依裝置調整。' }
  ];
  const V_SIGNS = ['牙醫診所', '眼科', '中醫診所', '藥局', '補習班', '英語', '麵館', '早餐', '便當', '咖啡', '茶飲', '眼鏡', '機車行', '五金', '水電行', '旅社', '理髮', '書局', '水果', '小吃', '火鍋', '滷味', '藥妝', '家具', '鐘錶', '乾洗', '房屋仲介', '鍋貼', '冰店', '電器行', '花店', '診所'];
  const H_SIGNS = ['牛肉麵', '早午餐', '便利商店', '手搖飲', '鍋貼水餃', '眼鏡行', '藥局', '麵包店', '五金百貨', '滷肉飯', '水果行', '電信行', '文具行', '珍珠奶茶', '小籠包', '鹹酥雞'];

  /* fonts for canvas text: ask for exactly the glyphs we draw (Google Fonts serves unicode-range subsets) */
  const ALL_TEXT = [MANAGERS.map(m => m.name + m.now.join('') + m.edu.join('')).join(''), WORKS.map(w => w.name + w.desc).join(''), QUESTIONS.map(q => q.q).join(''), V_SIGNS.join(''), H_SIGNS.join(''),
    '欣緯軟體設計科技部門經理現職學經歷後台運作原理登入編寫發佈上線延伸電子報社群驗證撰寫審稿草稿提交網站作品醫美診所美學辦公室'].join('');
  async function fontsReady(ms) {   // true when every face arrived in time (then no late redraw is needed)
    if (!document.fonts || !document.fonts.load) return true;
    const jobs = ['900', '700', '500'].map(w => document.fonts.load(w + ' 40px "Noto Sans TC"', ALL_TEXT));
    jobs.push(document.fonts.load('800 40px "Archivo"', 'SIGNWELL SOFTWARE 0123456789'), document.fonts.load('600 20px "Plex Mono"', 'WORK 0123456789/'), document.fonts.load('500 20px "Plex Mono"', 'abc.github.io'));
    let done = false; const all = Promise.allSettled(jobs).then(() => { done = true; });
    await Promise.race([all, wait(ms)]); return done;
  }

  /* ---------------- the road ---------------- */
  const CP = [[0, 0, 0], [0, 0, 52], [9, .6, 118], [40, 4, 188], [57, 10, 258], [37, 17.5, 330], [12, 24.5, 398], [7, 28.5, 450], [22, 28, 512], [58, 22.5, 574], [86, 14.5, 638], [91, 8.5, 698], [78, 3.4, 760], [63, .6, 818], [60, 0, 872], [60, 0, 990], [60, 0, 1110], [60, 0, 1230], [60, 0, 1350], [60, 0, 1440]];
  const curve = new THREE.CatmullRomCurve3(CP.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const L = curve.getLength();
  const NS = Math.ceil(L);
  const SX = new Float32Array(NS + 1), SY = new Float32Array(NS + 1), SZ = new Float32Array(NS + 1), HX = new Float32Array(NS + 1), HZ = new Float32Array(NS + 1), TY = new Float32Array(NS + 1);
  { const v = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i <= NS; i++) { const u = i / NS; curve.getPointAt(u, v); curve.getTangentAt(u, t); SX[i] = v.x; SY[i] = v.y; SZ[i] = v.z; const hl = Math.hypot(t.x, t.z) || 1; HX[i] = t.x / hl; HZ[i] = t.z / hl; TY[i] = t.y / hl; } }
  const RD = { x: 0, y: 0, z: 0, hx: 0, hz: 1, rx: -1, rz: 0, gy: 0 };   // shared output: point, horizontal tangent, right vector, grade
  function road(s) {
    let i, f;
    if (s <= 0) { RD.hx = HX[0]; RD.hz = HZ[0]; RD.x = SX[0] + RD.hx * s; RD.z = SZ[0] + RD.hz * s; RD.y = SY[0]; RD.gy = 0; }
    else if (s >= L) { RD.hx = HX[NS]; RD.hz = HZ[NS]; const e = s - L; RD.x = SX[NS] + RD.hx * e; RD.z = SZ[NS] + RD.hz * e; RD.y = SY[NS]; RD.gy = 0; }
    else { f = s / L * NS; i = Math.min(NS - 1, Math.floor(f)); f -= i; RD.x = lerp(SX[i], SX[i + 1], f); RD.y = lerp(SY[i], SY[i + 1], f); RD.z = lerp(SZ[i], SZ[i + 1], f);
      const hx = lerp(HX[i], HX[i + 1], f), hz = lerp(HZ[i], HZ[i + 1], f), hl = Math.hypot(hx, hz) || 1; RD.hx = hx / hl; RD.hz = hz / hl; RD.gy = lerp(TY[i], TY[i + 1], f); }
    RD.rx = -RD.hz; RD.rz = RD.hx;   // driver's right = cross(T, up) = (-tz, 0, tx)
    return RD;
  }
  /* The camera looks back along -T, so the driver's right (+R) shows on the left of the screen. */
  function sAtZ(z) { let lo = 0, hi = NS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SZ[m] < z) lo = m; else hi = m; } return lo / NS * L; }
  const ROAD_W = 10, HALF = ROAD_W / 2, LANE = 2.45;
  const yawOf = (hx, hz) => Math.atan2(hx, hz);

  const CS = 3, NC = Math.ceil(L / CS); const CX = new Float32Array(NC + 1), CZ = new Float32Array(NC + 1), CY = new Float32Array(NC + 1);
  for (let k = 0; k <= NC; k++) { road(Math.min(L, k * CS)); CX[k] = RD.x; CZ[k] = RD.z; CY[k] = RD.y; }
  const NR = { d: 0, y: 0, s: 0 };
  function nearest(x, z) {
    let best = 1e18, bi = 0;
    for (let k = 0; k <= NC; k += 8) { const dx = x - CX[k], dz = z - CZ[k], d = dx * dx + dz * dz; if (d < best) { best = d; bi = k; } }
    const a = Math.max(0, bi - 10), b = Math.min(NC, bi + 10);
    for (let k = a; k <= b; k++) { const dx = x - CX[k], dz = z - CZ[k], d = dx * dx + dz * dz; if (d < best) { best = d; bi = k; } }
    let d = Math.sqrt(best), y = CY[bi], s = bi * CS;
    const j = bi < NC ? bi + 1 : bi - 1, ex = CX[j] - CX[bi], ez = CZ[j] - CZ[bi], el = ex * ex + ez * ez;
    if (el > 0) { const t = clamp(((x - CX[bi]) * ex + (z - CZ[bi]) * ez) / el, 0, 1), px = CX[bi] + ex * t, pz = CZ[bi] + ez * t; const d2 = Math.hypot(x - px, z - pz); if (d2 < d) { d = d2; y = lerp(CY[bi], CY[j], t); s = (bi + (j - bi) * t) * CS; } }
    NR.d = d; NR.y = y; NR.s = s; return NR;
  }

  /* key places along the road */
  const S_CLIMB0 = sAtZ(105), S_MTN1 = sAtZ(610), S_FOOT1 = sAtZ(800), S_CITY0 = sAtZ(845);
  const S_MGR_K = sAtZ(404), S_MGR_W = sAtZ(468), S_RES = sAtZ(712);
  const WORK_Z = [902, 964, 1026, 1088, 1150, 1212, 1274];
  const S_WORK = WORK_Z.map(sAtZ);
  const PARK = { x0: -136, x1: 136, z0: -196, z1: 14 };          // the industrial park around the office
  const inPark = (x, z, m = 0) => x > PARK.x0 - m && x < PARK.x1 + m && z > PARK.z0 - m && z < PARK.z1 + m;
  const SKY101 = { x: 248, z: 640 };                               // Xinyi skyline, seen from the city

  /* ---------------- noise & terrain ---------------- */
  const PERM = new Uint8Array(512); { const r = rng(77), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
  function hash(i, j) { return PERM[(PERM[i & 255] + j) & 255] / 255; }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
  function fbm(x, y) { let s = 0, a = .5, f = 1; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s / .9375; }
  function regions(s) {
    const mtn = sstep(S_CLIMB0 - 30, S_CLIMB0 + 70, s) * (1 - sstep(S_MTN1 - 40, S_MTN1 + 60, s));
    const foot = sstep(S_MTN1 - 60, S_MTN1 + 20, s) * (1 - sstep(S_FOOT1 - 30, S_CITY0, s));
    return [mtn, foot];
  }
  const PADS = [];   // levelled ground: [x, z, radius, y]
  function terrainH(x, z) {
    const n = nearest(x, z), d = n.d, ry = n.y, [mtn, foot] = regions(n.s);
    const amp = 58 * mtn + 15 * foot;
    const near = sstep(HALF + 1.2, HALF + lerp(26, 18, mtn), d) * (.42 + .58 * sstep(18, 80, d));
    let hills = (fbm(x * .0115 + 3.1, z * .0115 - 1.7) - .42) * amp;
    if (hills < 0) hills = Math.max(hills, -(d - HALF) * .42);
    const office = 1 - sstep(60, 160, n.s);
    const r0 = lerp(lerp(150, 34, clamp(mtn + foot * .7, 0, 1)), 250, office);
    const ridge = Math.pow(sstep(r0, r0 + 170, d), 1.35) * (35 + fbm(x * .0062 + 9, z * .0062 + 4) * 120);
    let h = ry - .32 + near * hills + ridge;
    if (inPark(x, z, 30)) h = lerp(-.32, h, sstep(0, 30, Math.max(PARK.x0 - x, x - PARK.x1, PARK.z0 - z, z - PARK.z1)));
    for (let i = 0; i < PADS.length; i++) { const p = PADS[i], pd = Math.hypot(x - p[0], z - p[1]); if (pd < p[2]) h = lerp(h, p[3], 1 - sstep(p[2] * .55, p[2], pd)); }
    return h;
  }
  /* the faceted mesh differs from terrainH between vertices, so objects sit on the mesh itself */
  const TG = { step: LOW ? 8 : 5.5, X0: -340, X1: 440, Z0: -500, Z1: 1540, cols: 0, rows: 0, H: null };
  function groundY(x, z) {
    const { step, X0, Z0, cols, rows, H } = TG; if (!H) return terrainH(x, z);
    const fx = (x - X0) / step, fz = (z - Z0) / step, i = clamp(Math.floor(fx), 0, cols - 1), j = clamp(Math.floor(fz), 0, rows - 1), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
    const a = H[j * (cols + 1) + i], b = H[j * (cols + 1) + i + 1], c = H[(j + 1) * (cols + 1) + i], d = H[(j + 1) * (cols + 1) + i + 1];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  function buildTerrain() {
    const { step, X0, X1, Z0, Z1 } = TG;
    const cols = Math.ceil((X1 - X0) / step), rows = Math.ceil((Z1 - Z0) / step); TG.cols = cols; TG.rows = rows;
    const N = (cols + 1) * (rows + 1), H = new Float32Array(N), RY = new Float32Array(N), RS = new Float32Array(N), RDST = new Float32Array(N);
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const k = j * (cols + 1) + i; H[k] = terrainH(X0 + i * step, Z0 + j * step); RY[k] = NR.y; RS[k] = NR.s; RDST[k] = NR.d; }
    TG.H = H;
    const tri = cols * rows * 2, pos = new Float32Array(tri * 9), col = new Float32Array(tri * 9);
    const cGround = new THREE.Color(C.ground), cPark = new THREE.Color(0xe3e6dc), cGrass = new THREE.Color(0xbcd8c3), cGrass2 = new THREE.Color(0xa9cdb5), cRock = new THREE.Color(0xdde2de), cFar = new THREE.Color(0xd3e0d7), tmp = new THREE.Color(), grass = new THREE.Color();
    let o = 0;
    const put = (a, b, c) => {
      const ax = X0 + (a % (cols + 1)) * step, az = Z0 + Math.floor(a / (cols + 1)) * step, bx = X0 + (b % (cols + 1)) * step, bz = Z0 + Math.floor(b / (cols + 1)) * step, cx = X0 + (c % (cols + 1)) * step, cz = Z0 + Math.floor(c / (cols + 1)) * step;
      pos[o] = ax; pos[o + 1] = H[a]; pos[o + 2] = az; pos[o + 3] = bx; pos[o + 4] = H[b]; pos[o + 5] = bz; pos[o + 6] = cx; pos[o + 7] = H[c]; pos[o + 8] = cz;
      const hy = (H[a] + H[b] + H[c]) / 3, ry = (RY[a] + RY[b] + RY[c]) / 3, s = (RS[a] + RS[b] + RS[c]) / 3, d = (RDST[a] + RDST[b] + RDST[c]) / 3;
      const [mtn, foot] = regions(s), lift = hy - ry;
      const e1x = bx - ax, e1y = H[b] - H[a], e1z = bz - az, e2x = cx - ax, e2y = H[c] - H[a], e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, up = Math.abs(ny / (Math.hypot(nx, ny, nz) || 1));
      const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
      const wild = clamp(mtn + foot * .8 + sstep(60, 200, d) + sstep(30, 70, lift), 0, 1);
      tmp.copy(inPark(mx, mz) ? cPark : cGround);
      grass.copy(tmp).lerp(vnoise(ax * .05, az * .05) > .5 ? cGrass : cGrass2, wild * sstep(HALF + 2, HALF + 16, d));
      grass.lerp(cRock, clamp((1 - up) * 2.2 - .3, 0, 1) * wild);
      grass.lerp(cFar, sstep(60, 140, lift) * .8);
      grass.offsetHSL(0, 0, (vnoise(ax * .21 + 5, az * .21) - .5) * .035);
      for (let q = 0; q < 3; q++) { col[o + q * 3] = grass.r; col[o + q * 3 + 1] = grass.g; col[o + q * 3 + 2] = grass.b; }
      o += 9;
    };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; put(a, c, b); put(b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, vcFlat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  }

  /* ---------------- atlases ---------------- */
  // Façade atlas: 5 x 4 tiles of 256 px. One tile = one bay (4.2) x one floor (3.4).
  const T = { TILE: 0, WHITE: 1, OLD: 2, GLASS: 3, SHOP: 4, SHUTTER: 5, CONV: 6, FOOD: 7, SIDE: 8, TH_G: 9, TH_U: 10, TIN: 11, FACTORY: 12, DOCK: 13, LOFT: 14, PLAIN: 15, CONCRETE: 16, OAK: 17, TEMPLE: 18, BRICK: 19 };
  const FA = { cols: 5, rows: 4 }, BAY = 4.2, FL = 3.4;
  const tileUV = (t, cols, rows, padPx, W, H) => { const c = t % cols, r = Math.floor(t / cols), pu = padPx / W, pv = padPx / H; return [c / cols + pu, 1 - (r + 1) / rows + pv, 1 / cols - 2 * pu, 1 / rows - 2 * pv]; };
  const FUV = []; for (let t = 0; t < 20; t++) FUV.push(tileUV(t, 5, 4, 3, 1280, 1024));
  function drawFacadeAtlas(c) {
    const x = ctxOf(c), S = 256, r = rng(31); x.scale(c.width / 1280, c.height / 1024);   // drawn in 1280×1024 units, stored at 2K
    const at = (t, fn) => { x.save(); x.translate((t % 5) * S, Math.floor(t / 5) * S); x.beginPath(); x.rect(0, 0, S, S); x.clip(); fn(); x.restore(); };
    const grid = (bg, line, step) => { x.fillStyle = bg; x.fillRect(0, 0, S, S); x.strokeStyle = line; x.lineWidth = 1; for (let i = 0; i <= S; i += step) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, S); x.moveTo(0, i + .5); x.lineTo(S, i + .5); x.stroke(); } };
    const glass = (gx, gy, gw, gh, a, b) => { const g = x.createLinearGradient(0, gy, 0, gy + gh); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(gx, gy, gw, gh); x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.moveTo(gx, gy + gh * .75); x.lineTo(gx + gw * .32, gy); x.lineTo(gx + gw * .48, gy); x.lineTo(gx, gy + gh); x.closePath(); x.fill(); };
    const cage = (gx, gy, gw, gh, col, n) => { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(gx + 4, gy + gh, gw, 8); x.fillStyle = col; for (let i = 0; i <= n; i++) x.fillRect(gx + i * (gw - 4) / n, gy, 4, gh); x.fillRect(gx, gy, gw, 5); x.fillRect(gx, gy + gh - 5, gw, 5); x.fillRect(gx, gy + gh * .55, gw, 4); };
    const streaks = (n, col) => { for (let i = 0; i < n; i++) { const sx = r() * S, sw = 2 + r() * 8, sy = r() * S * .6, g = x.createLinearGradient(0, sy, 0, sy + 120); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(sx, sy, sw, 120); } };
    const ribs = (a, b, step, vertical = true) => { for (let i = 0; i < S; i += step) { x.fillStyle = (i / step) % 2 ? b : a; if (vertical) x.fillRect(i, 0, step, S); else x.fillRect(0, i, S, step); } };
    at(T.TILE, () => { grid('#e7dcc8', 'rgba(150,128,96,.22)', 10); x.fillStyle = '#b8aa90'; x.fillRect(34, 44, 188, 152); glass(40, 50, 176, 140, '#7f8e9b', '#4b5864'); cage(28, 40, 200, 160, '#f2f1ec', 9); x.fillStyle = '#d3c6ad'; x.fillRect(24, 204, 208, 9); streaks(5, 'rgba(90,70,50,.13)'); });
    at(T.WHITE, () => { grid('#f1efea', 'rgba(140,140,140,.16)', 12); x.fillStyle = '#c9ccd0'; x.fillRect(34, 56, 188, 132); glass(40, 62, 86, 120, '#a8bcd0', '#6c849c'); glass(130, 62, 86, 120, '#a8bcd0', '#6c849c'); x.fillStyle = '#8f969c'; [196, 214, 232].forEach(y => x.fillRect(16, y, 224, 5)); for (let i = 16; i < 240; i += 22) x.fillRect(i, 196, 4, 41); });
    at(T.OLD, () => { x.fillStyle = '#cecbc3'; x.fillRect(0, 0, S, S); streaks(12, 'rgba(70,60,50,.16)'); x.fillStyle = '#a8a59d'; x.fillRect(38, 50, 180, 140); glass(44, 56, 168, 128, '#6b7a84', '#455058'); cage(34, 46, 188, 148, '#6f907b', 8); x.fillStyle = 'rgba(150,90,60,.28)'; x.fillRect(40, 196, 6, 50); x.fillRect(200, 196, 5, 40); });
    at(T.GLASS, () => { const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#b5cad9'); g.addColorStop(1, '#7c99b1'); x.fillStyle = g; x.fillRect(0, 0, S, S); x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(0, 170); x.lineTo(150, 0); x.lineTo(210, 0); x.lineTo(0, 236); x.fill(); x.fillStyle = '#5f7488'; for (let i = 0; i <= S; i += 64) x.fillRect(i - 2, 0, 4, S); x.fillRect(0, 118, S, 3); x.fillStyle = '#d3d9de'; x.fillRect(0, 232, S, 24); });
    at(T.SHOP, () => { x.fillStyle = '#3c3d43'; x.fillRect(0, 0, S, S); x.fillStyle = '#d8d3c7'; x.fillRect(0, 0, S, 30); const g = x.createLinearGradient(0, 30, 0, S); g.addColorStop(0, '#fff2d6'); g.addColorStop(1, '#c9b48c'); x.fillStyle = g; x.fillRect(10, 36, 236, 214); const cols = ['#d8402f', '#3a6ab8', '#f2c230', '#3a8a5a', '#ffffff', '#e98fb2']; for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) { x.fillStyle = cols[(row * 3 + i) % 6]; x.fillRect(18 + i * 25, 60 + row * 44, 18, 24); } x.fillStyle = '#2b2c30'; x.fillRect(0, 30, 10, S); x.fillRect(246, 30, 10, S); x.fillRect(124, 36, 8, S); });
    at(T.SHUTTER, () => { x.fillStyle = '#8b8f92'; x.fillRect(0, 0, S, 36); ribs('#bcc0c3', '#a6aaad', 7, false); x.fillStyle = '#8b8f92'; x.fillRect(0, 0, S, 34); x.fillStyle = '#7a7e81'; x.fillRect(0, 246, S, 10); x.fillStyle = 'rgba(40,40,40,.25)'; x.fillRect(110, 200, 36, 8); });
    at(T.CONV, () => { x.fillStyle = '#f7f8f5'; x.fillRect(0, 0, S, S); x.fillStyle = '#2f6fb8'; x.fillRect(0, 0, S, 14); x.fillStyle = '#ffffff'; x.fillRect(0, 14, S, 8); x.fillStyle = '#3a9a5a'; x.fillRect(0, 22, S, 14); const cols = ['#d8402f', '#2f6fb8', '#f2c230', '#3a9a5a', '#e98fb2', '#8f6ad8']; for (let row = 0; row < 4; row++) { x.fillStyle = '#dfe3e6'; x.fillRect(14, 70 + row * 42, 228, 5); for (let i = 0; i < 12; i++) { x.fillStyle = cols[(i + row) % 6]; x.fillRect(16 + i * 19, 52 + row * 42, 13, 18); } } x.fillStyle = '#2b2c30'; x.fillRect(0, 36, 8, S); x.fillRect(248, 36, 8, S); x.fillRect(100, 36, 6, S); });
    at(T.FOOD, () => { x.fillStyle = '#c8402f'; x.fillRect(0, 0, S, 36); x.fillStyle = '#f6e6c4'; x.fillRect(40, 8, 176, 20); const g = x.createLinearGradient(0, 36, 0, S); g.addColorStop(0, '#f3d49c'); g.addColorStop(1, '#d9a866'); x.fillStyle = g; x.fillRect(0, 36, S, 220); x.fillStyle = '#cfd3d6'; x.fillRect(20, 168, 216, 40); x.fillStyle = '#9aa0a5'; x.fillRect(20, 205, 216, 6); x.fillStyle = '#d8402f'; [60, 128, 196].forEach(cx => { x.beginPath(); x.arc(cx, 70, 15, 0, 7); x.fill(); }); x.fillStyle = '#ffffff'; x.fillRect(150, 96, 80, 54); x.fillStyle = '#c8402f'; for (let i = 0; i < 4; i++) x.fillRect(158, 104 + i * 11, 64, 5); });
    at(T.SIDE, () => { x.fillStyle = '#d9d5cc'; x.fillRect(0, 0, S, S); streaks(10, 'rgba(80,70,60,.12)'); x.strokeStyle = 'rgba(120,110,100,.18)'; x.beginPath(); x.moveTo(0, 2); x.lineTo(S, 2); x.stroke(); });
    at(T.TH_G, () => { grid('#e4d9c5', 'rgba(150,128,96,.2)', 10); x.fillStyle = '#9fa3a6'; x.fillRect(22, 40, 160, 216); for (let y = 44; y < 256; y += 8) { x.fillStyle = (y / 8) % 2 ? '#b9bdc0' : '#a5a9ac'; x.fillRect(24, y, 156, 8); } x.fillStyle = '#7a5a3a'; x.fillRect(196, 70, 46, 186); x.fillStyle = '#c9a24a'; x.fillRect(232, 160, 5, 5); x.fillStyle = '#d3c6ad'; x.fillRect(0, 26, S, 10); x.fillStyle = '#d8402f'; x.fillRect(200, 44, 38, 18); });
    at(T.TH_U, () => { grid('#ece4d4', 'rgba(150,128,96,.18)', 10); x.fillStyle = '#b8aa90'; x.fillRect(34, 40, 188, 150); glass(40, 46, 176, 138, '#8796a3', '#55626e'); cage(28, 34, 200, 158, '#f4f3ef', 10); x.fillStyle = '#d3c7b2'; x.fillRect(0, 226, S, 30); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 226, S, 4); streaks(4, 'rgba(90,70,50,.12)'); });
    at(T.TIN, () => { ribs('#f2f2f2', '#d4d4d4', 12); x.fillStyle = 'rgba(120,80,50,.12)'; for (let i = 0; i < 6; i++) x.fillRect(r() * S, r() * 200, 10, 60); });
    at(T.FACTORY, () => { ribs('#f3f4f4', '#e2e4e5', 14); glass(0, 22, S, 42, '#b6cadb', '#8fa9c0'); x.fillStyle = '#7d8a96'; for (let i = 0; i <= S; i += 32) x.fillRect(i - 1, 22, 3, 42); x.fillStyle = '#c9ced2'; x.fillRect(0, 64, S, 5); });
    at(T.DOCK, () => { ribs('#f3f4f4', '#e2e4e5', 14); x.fillStyle = '#5c6166'; x.fillRect(18, 36, 220, 220); for (let y = 42; y < 256; y += 9) { x.fillStyle = (y / 9) % 2 ? '#c4c8cb' : '#b1b5b8'; x.fillRect(26, y, 204, 9); } for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#111' : '#ffd84d'; x.fillRect(18, 200 + i * 9, 10, 9); x.fillRect(228, 200 + i * 9, 10, 9); } });
    at(T.LOFT, () => { x.fillStyle = '#1e1f22'; x.fillRect(0, 0, S, S); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const px = 8 + i * 61, py = 8 + j * 81; glass(px, py, 55, 75, '#eef3f7', '#c6d5e2'); } x.fillStyle = 'rgba(95,140,110,.18)'; x.fillRect(0, 200, S, 56); });
    at(T.PLAIN, () => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S); });
    at(T.CONCRETE, () => { x.fillStyle = '#d8d6d1'; x.fillRect(0, 0, S, S); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '90,90,90'},${.03 + r() * .05})`; x.fillRect(r() * S, r() * S, 2 + r() * 10, 2 + r() * 10); } x.fillStyle = 'rgba(80,80,80,.22)'; x.fillRect(0, 0, S, 2); x.fillRect(0, 0, 2, S); });
    at(T.OAK, () => { for (let y = 0; y < S; y += 32) { x.fillStyle = ['#d9b98c', '#d1af80', '#dcbf95', '#cfa978'][(y / 32) % 4]; x.fillRect(0, y, S, 32); x.fillStyle = 'rgba(90,60,30,.18)'; x.fillRect(0, y, S, 2); x.fillRect(((y * 37) % 200) + 20, y, 2, 32); } });
    at(T.TEMPLE, () => { x.fillStyle = '#c4473a'; x.fillRect(0, 0, S, S); x.fillStyle = '#e6c26a'; x.fillRect(0, 0, S, 22); x.fillStyle = '#7a2a20'; x.fillRect(70, 70, 116, 186); x.fillStyle = '#d9a84a'; for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) x.fillRect(82 + i * 26, 84 + j * 28, 8, 8); x.fillStyle = '#2f6a5a'; x.fillRect(14, 70, 40, 90); x.fillRect(202, 70, 40, 90); x.strokeStyle = '#e6c26a'; x.lineWidth = 4; x.strokeRect(14, 70, 40, 90); x.strokeRect(202, 70, 40, 90); });
    at(T.BRICK, () => { x.fillStyle = '#d9c9b4'; x.fillRect(0, 0, S, S); for (let y = 0, k = 0; y < S; y += 16, k++) for (let i = -1; i < 9; i++) { x.fillStyle = ['#b5533d', '#a94b37', '#bd5c44'][(i + k) % 3]; x.fillRect(i * 32 + (k % 2) * 16 + 1, y + 1, 30, 14); } });
  }
  // Sign atlas: 32 vertical (64x256) on top, 16 horizontal (256x64) below, plain white slot at the end.
  const SUV_V = [], SUV_H = []; let SUV_PLAIN;
  for (let i = 0; i < 32; i++) { const c = i % 16, r = Math.floor(i / 16), pu = 2 / 1024, pv = 2 / 1024; SUV_V.push([c * 64 / 1024 + pu, 1 - (r + 1) * 256 / 1024 + pv, 64 / 1024 - 2 * pu, 256 / 1024 - 2 * pv]); }
  for (let i = 0; i < 16; i++) { const c = i % 4, r = Math.floor(i / 4), pu = 2 / 1024, pv = 2 / 1024; SUV_H.push([c * 256 / 1024 + pu, 1 - (512 + (r + 1) * 64) / 1024 + pv, 256 / 1024 - 2 * pu, 64 / 1024 - 2 * pv]); }
  SUV_PLAIN = [8 / 1024, 8 / 1024, 4 / 1024, 4 / 1024];
  const SIGN_COLS = [['#d8312a', '#ffffff'], ['#ffd84d', '#c8241c'], ['#ffffff', '#1d4fae'], ['#1d4fae', '#ffffff'], ['#2a8a52', '#ffffff'], ['#151515', '#ffd84d'], ['#ffffff', '#d8312a'], ['#f08a24', '#ffffff']];
  function drawSignAtlas(c) {
    const x = ctxOf(c); x.scale(c.width / 1024, c.height / 1024); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1024, 1024);
    V_SIGNS.forEach((t, i) => {
      const cx = (i % 16) * 64, cy = Math.floor(i / 16) * 256, [bg, fg] = SIGN_COLS[(i * 3) % SIGN_COLS.length];
      x.fillStyle = bg; x.fillRect(cx, cy, 64, 256); x.strokeStyle = fg === '#ffffff' ? 'rgba(255,255,255,.75)' : fg; x.lineWidth = 3; x.strokeRect(cx + 5, cy + 5, 54, 246);
      const n = [...t].length, fs = Math.min(46, 222 / n * .9); x.fillStyle = fg; x.font = '900 ' + fs + 'px ' + FONT_CN; x.textAlign = 'center'; x.textBaseline = 'middle';
      [...t].forEach((ch, k) => x.fillText(ch, cx + 32, cy + 128 + (k - (n - 1) / 2) * fs * 1.08));
    });
    H_SIGNS.forEach((t, i) => {
      const cx = (i % 4) * 256, cy = 512 + Math.floor(i / 4) * 64, [bg, fg] = SIGN_COLS[(i * 5 + 1) % SIGN_COLS.length];
      x.fillStyle = bg; x.fillRect(cx, cy, 256, 64); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; fitFont(x, t, '900', 40, FONT_CN, 220, 20); x.fillText(t, cx + 128, cy + 34);
    });
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 16, 16);
  }

  /* ---------------- batched static geometry ---------------- */
  // One draw call per region: every part carries colour, uv and the atlas tile it samples.
  class Batch {
    constructor(uvs) { this.items = []; this.count = 0; this.uvs = uvs; }
    add(geo, m, color, tile, ao) { const g = geo.index ? (geo._ni || (geo._ni = geo.toNonIndexed())) : geo; this.items.push([g, m, color, tile == null ? T.PLAIN : tile, ao]); this.count += g.attributes.position.count; return this; }
    mesh(mat, cast = true) {
      const n = this.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), Cc = new Float32Array(n * 3), TL = new Float32Array(n * 4);
      const v = new THREE.Vector3(), nm = new THREE.Matrix3(), col = new THREE.Color(); let o = 0;
      for (const [g, m, color, tile, ao] of this.items) {
        const p = g.attributes.position.array, nn = g.attributes.normal.array, uv = g.attributes.uv ? g.attributes.uv.array : null, tl = g.attributes.tile ? g.attributes.tile.array : null, cnt = g.attributes.position.count;
        if (m) nm.getNormalMatrix(m); col.set(color); const tu = typeof tile === 'number' ? this.uvs[tile] : tile;
        for (let i = 0; i < cnt; i++, o++) {
          v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); if (m) v.applyMatrix4(m); P[o * 3] = v.x; P[o * 3 + 1] = v.y; P[o * 3 + 2] = v.z;
          const wy = v.y; v.set(nn[i * 3], nn[i * 3 + 1], nn[i * 3 + 2]); if (m) v.applyMatrix3(nm).normalize(); N[o * 3] = v.x; N[o * 3 + 1] = v.y; N[o * 3 + 2] = v.z;
          if (uv) { U[o * 2] = uv[i * 2]; U[o * 2 + 1] = uv[i * 2 + 1]; }
          if (tl) { TL[o * 4] = tl[i * 4]; TL[o * 4 + 1] = tl[i * 4 + 1]; TL[o * 4 + 2] = tl[i * 4 + 2]; TL[o * 4 + 3] = tl[i * 4 + 3]; } else { TL[o * 4] = tu[0]; TL[o * 4 + 1] = tu[1]; TL[o * 4 + 2] = tu[2]; TL[o * 4 + 3] = tu[3]; }
          const f = ao ? lerp(.74, 1, clamp((wy - ao[0]) / ao[1], 0, 1)) : 1;
          Cc[o * 3] = col.r * f; Cc[o * 3 + 1] = col.g * f; Cc[o * 3 + 2] = col.b * f;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); g.setAttribute('tile', new THREE.BufferAttribute(TL, 4)); g.computeBoundingSphere();
      const me = new THREE.Mesh(g, mat); me.castShadow = cast; me.receiveShadow = true; me.matrixAutoUpdate = false; scene.add(me); this.items = []; return me;
    }
  }
  const UNIT = new THREE.BoxGeometry(1, 1, 1);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), EUL = new THREE.Euler(), UPV = new THREE.Vector3(0, 1, 0);
  function mtx(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { EUL.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(EUL); return new THREE.Matrix4().compose(V3.set(x, y, z), Q, S3.set(sx, sy, sz)); }
  /* box with per-face tiles: faces = [+x, -x, +y, -y, +z, -z]; uv repeats per bay / floor */
  function fbox(w, h, d, faces, uvs = FUV, unitU = BAY, unitV = FL) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), uv = g.attributes.uv, tl = new Float32Array(uv.count * 4);
    const ext = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const plain = uvs === FUV ? FUV[T.PLAIN] : SUV_PLAIN;
    for (let f = 0; f < 6; f++) { const t = faces[f] == null ? null : faces[f], tu = t == null ? plain : (Array.isArray(t) ? t : uvs[t]); const ru = (t == null || Array.isArray(t)) ? 1 : Math.max(1, Math.round(ext[f][0] / unitU)), rv = (t == null || Array.isArray(t)) ? 1 : Math.max(1, Math.round(ext[f][1] / unitV));
      for (let k = 0; k < 6; k++) { const i = f * 6 + k; uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); tl.set(tu, i * 4); } }
    g.setAttribute('tile', new THREE.BufferAttribute(tl, 4)); return g;
  }
  const facadeMat = tiled(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const signMat = tiled(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const ATLAS_K = LOW ? 1.5 : 2;   // 2K atlases on desktop (2560×2048, 2048²), 1.5× on phones
  const facadeTex = texFrom(mkCanvas(1280 * ATLAS_K, 1024 * ATLAS_K)); facadeTex.generateMipmaps = true; facadeMat.map = facadeTex;
  const signTex = texFrom(mkCanvas(1024 * ATLAS_K, 1024 * ATLAS_K)); signMat.map = signTex;
  class Chunked {      // a Batch per 140 units of z, routed by each part's position
    constructor(uvs, size = 140) { this.uvs = uvs; this.size = size; this.map = new Map(); }
    at(z) { const k = Math.floor(z / this.size); let b = this.map.get(k); if (!b) this.map.set(k, b = new Batch(this.uvs)); return b; }
    add(geo, m, color, tile, ao) { return this.at(m ? m.elements[14] : 0).add(geo, m, color, tile, ao); }
    mesh(mat, cast = true) { for (const b of this.map.values()) b.mesh(mat, cast); }
  }
  const B = { park: new Batch(FUV), office: new Batch(FUV), mtn: new Chunked(FUV), foot: new Chunked(FUV), city: new Chunked(FUV), city2: new Chunked(FUV), fields: new Batch(FUV) };
  const SB = new Chunked(SUV_V);
  const box = (b, x, y, z, w, h, d, color, ry = 0, tile = T.PLAIN, ao) => b.add(UNIT, mtx(x, y, z, ry, w, h, d), color, tile, ao);

  /* instanced helper */
  class Inst {       // instanced mesh, split into 160-unit z chunks so far chunks are culled
    constructor(geo, mat, cast = true) { this.geo = geo; this.mat = mat; this.cast = cast; this.buckets = new Map(); }
    add(m, color) { const k = Math.floor(m.elements[14] / 160); let b = this.buckets.get(k); if (!b) this.buckets.set(k, b = { m: [], c: [] }); b.m.push(m); b.c.push(color == null ? 0xffffff : color); return this; }
    build() { const cc = new THREE.Color(); for (const b of this.buckets.values()) { const im = new THREE.InstancedMesh(this.geo, this.mat, b.m.length); b.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cc.set(b.c[i])); }); im.castShadow = this.cast; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); } }
  }
  function mergeSimple(parts) {   // [[geo, matrix, color]] -> one geometry with vertex colours
    const b = new Batch(FUV); parts.forEach(([g, m, c]) => b.add(g, m, c == null ? 0xffffff : c));
    const tmp = b.mesh(vcFlat, false); scene.remove(tmp); return tmp.geometry;
  }
  const instVC = new THREE.MeshLambertMaterial({ vertexColors: true });

  /* ---------------- blockers (where nothing random may grow) ---------------- */
  const blockers = [];
  function blocked(x, z, pad = 0) { for (const b of blockers) { const dx = x - b[0], dz = z - b[1]; if (dx * dx + dz * dz < (b[2] + pad) * (b[2] + pad)) return true; } return false; }

  /* ================================================================ BUILD */
  const T0 = performance.now(); const mark = n => { if (SNAP) console.log('[drive]', n, Math.round(performance.now() - T0) + 'ms'); };
  const fontsOk = await fontsReady(2600); mark('fonts');
  const images = await Promise.all(WORKS.map(w => w.kind === 'shot' ? loadImg(w.img) : Promise.resolve(null)));
  drawFacadeAtlas(facadeTex.image); facadeTex.needsUpdate = true;
  drawSignAtlas(signTex.image); signTex.needsUpdate = true;

  /* positions decided before the terrain so the ground can be levelled under them */
  const MGR_W = 18, MGR_H = 11.25;
  const MGR_DEFS = [{ s: S_MGR_K, side: 1, ang: 45 }, { s: S_MGR_W, side: -1, ang: 125 }].map(d => {
    road(d.s);
    const dev = Math.abs(90 - d.ang) * Math.PI / 180, inX = -RD.rx * d.side, inZ = -RD.rz * d.side;   // turn toward the road centre
    const off = 13.4, x = RD.x + RD.rx * off * d.side, z = RD.z + RD.rz * off * d.side;
    PADS.push([x, z, 15, RD.y - .3]); blockers.push([x, z, 13]);
    return { x, z, y: RD.y + 5 + MGR_H / 2, nx: RD.hx * Math.cos(dev) + inX * Math.sin(dev), nz: RD.hz * Math.cos(dev) + inZ * Math.sin(dev) };
  });
  const VOICE_SPOTS = [[-58, 1, 16], [-48, -1, 15.5], [-38, 1, 17], [-27, -1, 16.5], [-16, 1, 15]];
  VOICE_SPOTS.forEach(([ds, side, off]) => { road(S_RES + ds); const x = RD.x + RD.rx * (off + 5) * side, z = RD.z + RD.rz * (off + 5) * side; PADS.push([x, z, 14, RD.y + .4]); });
  PADS.push([SKY101.x, SKY101.z, 95, -.3]);
  // temple and courtyard house in the foothills
  const TEMPLE = (() => { road(S_RES - 92); const side = -1, off = 26; return { x: RD.x + RD.rx * off * side, z: RD.z + RD.rz * off * side, yaw: yawOf(RD.hx, RD.hz) + Math.PI, ry: RD.y }; })();
  const SANHE = (() => { road(S_RES - 128); const side = 1, off = 30; return { x: RD.x + RD.rx * off * side, z: RD.z + RD.rz * off * side, yaw: yawOf(RD.hx, RD.hz), ry: RD.y }; })();
  PADS.push([TEMPLE.x, TEMPLE.z, 18, TEMPLE.ry + .2], [SANHE.x, SANHE.z, 20, SANHE.ry + .4]);
  blockers.push([TEMPLE.x, TEMPLE.z, 14], [SANHE.x, SANHE.z, 16]);

  buildTerrain(); mark('terrain');

  /* ---------------- road surface & ribbons ---------------- */
  function roadTex() {
    const c = mkCanvas(128, 512), x = c.getContext('2d');
    x.fillStyle = '#c9cbcf'; x.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${R() > .5 ? '255,255,255' : '0,0,0'},${.03 + R() * .04})`; x.fillRect(R() * 128, R() * 512, 1.5, 1.5); }
    x.fillStyle = '#fbfbf8'; x.fillRect(5, 0, 4, 512); x.fillRect(119, 0, 4, 512);
    x.fillStyle = '#ffd84d'; x.fillRect(61, 0, 6, 250);
    return texFrom(c, true);
  }
  const RTEX = roadTex(), roadMat = new THREE.MeshLambertMaterial({ map: RTEX });
  function buildRoad() {
    const pos = [], uv = [], idx = []; let n = 0;
    for (let s = 0; s <= L; s += 1.5) {
      road(s); const y = RD.y + .06;
      pos.push(RD.x - RD.rx * HALF, y, RD.z - RD.rz * HALF, RD.x + RD.rx * HALF, y, RD.z + RD.rz * HALF);
      uv.push(0, s / 15, 1, s / 15);
      if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } n++;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, roadMat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  }
  function ribbon(s0, s1, off0, off1, lift, color, stepS = 2) {
    const pos = [], idx = []; let n = 0;
    for (let s = s0; s <= s1 + .001; s += stepS) {
      road(s); const y = RD.y + lift;
      pos.push(RD.x + RD.rx * off0, y, RD.z + RD.rz * off0, RD.x + RD.rx * off1, y, RD.z + RD.rz * off1);
      if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } n++;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, lam(color)); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m;
  }
  /* a straight street strip (not on the route): centre, direction yaw, length, width */
  function street(x, z, yaw, len, wid = 10) {
    const g = new THREE.PlaneGeometry(wid, len); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 15);
    const m = new THREE.Mesh(g, roadMat); m.position.set(x, .05, z); m.rotation.y = yaw; m.receiveShadow = true; scene.add(m); return m;
  }
  buildRoad();

  /* ---------------- vegetation ---------------- */
  const trees = new Inst(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }));
  const trunks = new Inst((() => { const g = new THREE.CylinderGeometry(.16, .22, 1, 5); g.translate(0, .5, 0); return g; })(), lam(C.trunk));
  function addTree(x, z, s, k = R() * 3 | 0, col) {
    const y = groundY(x, z), h = (2.3 + (k === 2 ? .8 : 0)) * s, w = s * (1.25 + (k === 1 ? .2 : 0));
    trunks.add(mtx(x, y - .4, z, 0, s, h * .55 + .4, s)); trees.add(mtx(x, y + h, z, R() * 6.28, w, h * .62, w), col || [C.tree, C.tree2, C.tree3][k % 3]);
  }
  // royal palm (大王椰子), betel palm (檳榔), banana: crown geometry built once, instanced
  function frondCrown(n, len, droop, wid, upY) {
    const parts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + (i % 2) * .2, g = new THREE.BoxGeometry(wid, .07, len); g.translate(0, 0, len / 2); parts.push([g, mtx(0, upY, 0, a, 1, 1, 1, droop + (i % 3) * .12), 0xffffff]); }
    return mergeSimple(parts);
  }
  const royalTrunk = new Inst((() => { const g = new THREE.CylinderGeometry(.34, .48, 1, 8); g.translate(0, .5, 0); return g; })(), lam(0xb9b6ae));
  const royalShaft = new Inst((() => { const g = new THREE.CylinderGeometry(.42, .38, 1, 8); g.translate(0, .5, 0); return g; })(), lam(0x7aa76b));
  const royalCrown = new Inst(frondCrown(11, 4.6, .45, .7, 0), instVC);
  function royalPalm(x, z, s = 1) { const y = groundY(x, z), h = 10.5 * s; royalTrunk.add(mtx(x, y - .3, z, 0, s, h, s)); royalShaft.add(mtx(x, y + h - .3, z, 0, s, 2.2 * s, s)); royalCrown.add(mtx(x, y + h + 1.9 * s, z, R() * 6.28, s, s, s), 0x5f9a5c); }
  const betelTrunk = new Inst((() => { const g = new THREE.CylinderGeometry(.11, .15, 1, 6); g.translate(0, .5, 0); return g; })(), lam(0x9a9a86));
  const betelCrown = new Inst(frondCrown(8, 2.6, .25, .45, 0), instVC);
  function betelPalm(x, z) { const y = groundY(x, z), h = 6.5 + R() * 3; betelTrunk.add(mtx(x, y - .2, z, 0, 1, h, 1, (R() - .5) * .08, (R() - .5) * .08)); betelCrown.add(mtx(x, y + h - .2, z, R() * 6.28), [0x6fa25c, 0x5f9452, 0x7bab63][R() * 3 | 0]); }
  const bananaCrown = new Inst(frondCrown(7, 2.4, -.35, 1.1, 0), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const bananaTrunk = new Inst((() => { const g = new THREE.CylinderGeometry(.22, .3, 1, 6); g.translate(0, .5, 0); return g; })(), lam(0x8fa070));
  function banana(x, z) { const y = groundY(x, z), h = 1.6 + R(); bananaTrunk.add(mtx(x, y - .2, z, 0, 1, h, 1)); bananaCrown.add(mtx(x, y + h, z, R() * 6.28), 0x7fb860); }
  const teaBush = new Inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ flatShading: true }));
  const fieldQuad = (x0, z0, x1, z1, color, lift = .1) => {   // a flat field patch draped on the terrain mesh (four corners)
    const ys = [groundY(x0, z0), groundY(x1, z0), groundY(x0, z1), groundY(x1, z1)];
    const g = new THREE.BufferGeometry(); const p = [x0, ys[0] + lift, z0, x0, ys[2] + lift, z1, x1, ys[1] + lift, z0, x1, ys[1] + lift, z0, x0, ys[2] + lift, z1, x1, ys[3] + lift, z1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(.5), 2)); B.fields.add(g, null, color);
  };

  /* ---------------- industrial park & the loft office ---------------- */
  const OFFICE = { x: 0, z: -50, w: 74, d: 48 };
  const officePeople = [];
  let screenTexes = [];
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xd5e4f5, transparent: true, opacity: .3, depthWrite: false });
  function buildPark() {
    const b = B.park;
    // cross street in front of the office, sidewalks, junction
    street(0, 1, Math.PI / 2, 680);
    [[-6.6, -4], [6, 8.6]].forEach(([z0, z1]) => { box(b, -180, .12, (z0 + z1) / 2, 330, .24, z1 - z0, 0xeeece7); box(b, 180, .12, (z0 + z1) / 2, 330, .24, z1 - z0, 0xeeece7); });
    box(b, 0, .12, -5.3, 30, .24, 2.6, 0xeeece7);
    const stripes = new Inst(UNIT, lam(0xffffff), false);
    for (let q = -4; q <= 4; q++) stripes.add(mtx(q * 1.05, .1, 11, 0, .55, .04, 3.2));
    for (let q = -4; q <= 4; q++) stripes.add(mtx(-9, .1, 1 + q * 1.05, Math.PI / 2, .55, .04, 3.2));
    stripes.build();
    // royal palms along the street and the first stretch of the route
    for (let x = -210; x <= 210; x += 14) { if (Math.abs(x) < 16) continue; royalPalm(x, -5.3, .95 + R() * .1); royalPalm(x + 7, 7.3, .95 + R() * .1); }
    for (let s = 16; s < 118; s += 13) { road(s); [-1, 1].forEach(sd => royalPalm(RD.x + RD.rx * (HALF + 2.6) * sd, RD.z + RD.rz * (HALF + 2.6) * sd, .9 + R() * .15)); }
    // office lot: plaza + parking
    box(b, 0, .04, -16, 82, .08, 20, 0xdedfdc);
    const lines = new Inst(UNIT, lam(0xffffff), false);
    for (let i = -8; i <= 8; i++) if (Math.abs(i) > 1) { lines.add(mtx(i * 4.4, .1, -20.5, 0, .18, .04, 5)); lines.add(mtx(i * 4.4, .1, -11, 0, .18, .04, 5)); }
    lines.build();
    // left neighbour: clean factory with a sawtooth roof and loading docks
    { const cx = -86, cz = -66, w = 64, d = 66, h = 10.5; blockers.push([cx, cz, 50]);
      b.add(fbox(w, h, d, [T.FACTORY, T.FACTORY, null, null, T.DOCK, T.FACTORY]), mtx(cx, h / 2, cz), 0xffffff, null, [0, 8]);
      const teeth = 9, td = d / teeth, th = 3.2, sl = Math.hypot(td, th), sa = Math.atan2(th, td);
      for (let i = 0; i < teeth; i++) { const z0t = cz - d / 2 + i * td;
        b.add(UNIT, mtx(cx, h + th / 2, z0t + td / 2, 0, w - .6, .28, sl, -sa), 0xeceeef);
        box(b, cx, h + th / 2, z0t + td - .08, w - .8, th, .16, 0x9fbad3); }
      box(b, cx, .05, cz + d / 2 + 11, w + 6, .1, 22, 0xd8d8d4);
      box(b, cx + 18, .9, cz + d / 2 + 1.2, 22, 1.8, 2.4, 0xbfc2c4);  // dock platform
      box(b, cx, 8.6, cz + d / 2 + .3, w * .7, 1.2, .3, 0x2f6fb8);    // blue band
    }
    // right neighbour: science-park lab with glass bands, lawn and a pond
    { const cx = 84, cz = -70, w = 62, d = 52, h = 19; blockers.push([cx, cz, 46]);
      b.add(fbox(w, h, d, [T.GLASS, T.GLASS, null, null, T.GLASS, T.GLASS]), mtx(cx, h / 2, cz), 0xffffff, null, [0, 10]);
      box(b, cx, h + .5, cz, w - 2, 1, d - 2, 0xd9dcdf); box(b, cx + 14, h + 2, cz - 6, 12, 3, 8, 0xc9cdd1); box(b, cx - 12, h + 1.6, cz + 8, 8, 2.2, 6, 0xc9cdd1);
      b.add(fbox(18, 7, 8, [T.GLASS, T.GLASS, null, null, T.GLASS, T.GLASS]), mtx(cx - 8, 3.5, cz + d / 2 + 4), 0xffffff);
      box(b, cx, .07, cz + d / 2 + 18, w + 8, .14, 26, 0xc7dcbc);
      box(b, cx + 16, .12, cz + d / 2 + 18, 18, .1, 10, 0xb6d2e2);
      for (let i = 0; i < 4; i++) royalPalm(cx - 26 + i * 10, cz + d / 2 + 26, 1);
    }
    // warehouses (鐵皮) behind, water tower, solar panels
    [[-82, -150, 50, 34], [58, -150, 50, 34]].forEach(([cx, cz, w, d], i) => {
      blockers.push([cx, cz, 34]);
      b.add(fbox(w, 8, d, [T.FACTORY, T.FACTORY, null, null, T.DOCK, T.FACTORY]), mtx(cx, 4, cz), 0xffffff, null, [0, 6]);
      const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 2);
      b.add(fbox(w + 1, 1, d + 1, [T.TIN, T.TIN, T.TIN, null, T.TIN, T.TIN]), mtx(cx, 8.4, cz), [0x7f99bd, 0x8fa9c9, 0x7a94b6][i]);
      b.add(g, mtx(cx, 8.9, cz, 0, w + 1, 3, (d + 1) / 1.73), [0x7f99bd, 0x8fa9c9, 0x7a94b6][i]);
    });
    { const tx = 46, tz = -104; blockers.push([tx, tz, 8]); for (const [a, c] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) box(b, tx + a, 6, tz + c, .5, 12, .5, 0x9aa0a6);
      b.add(new THREE.CylinderGeometry(4, 4, 6, 18), mtx(tx, 15, tz), 0xf3f3f1); b.add(new THREE.ConeGeometry(4.3, 1.8, 18), mtx(tx, 18.9, tz), 0xe1e3e5); }
    const solar = new Inst(UNIT, lam(0x2c3f63), false);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) solar.add(mtx(84 + (i - 3.5) * 5.8, 20.3, -70 + (j - 1) * 9, 0, 4.8, .12, 6.6, -.22), 0x2c3f63);
    solar.build();
    // a guard house and lawn across the street
    box(b, -26, 1.6, 15, 6, 3.2, 5, 0xf3f2ef, 0, T.PLAIN, [0, 2]); box(b, -26, 3.4, 15, 7, .4, 6, 0x2a2b30);
    box(b, 40, .07, 30, 70, .14, 34, 0xc7dcbc); box(b, -60, .07, 30, 60, .14, 34, 0xc7dcbc);
    // trucks at the dock
    const truck = makeVehicle('truck', 0xffffff, 0x2f6fb8); truck.position.set(-78, .05, -18); truck.rotation.y = Math.PI; scene.add(truck);
    const fork = makeVehicle('car', C.yellow, C.yellow); fork.scale.set(.6, .6, .55); fork.position.set(-100, .05, -22); fork.rotation.y = .6; scene.add(fork);
    [[-18, 'car', 0xffffff, -20.5], [-9, 'taxi', C.yellow, -20.5], [13, 'car', C.blue, -20.5], [22, 'car', 0x2a2b30, -11], [-26, 'car', 0xe9eaec, -11]].forEach(([x, k, c, z]) => { const car = makeVehicle(k, c, c); car.position.set(x, .05, z); scene.add(car); });
    buildHillSign();
  }
  /* Hollywood-style letters on a grassy hill behind the office: SIGNWELL, and 欣緯軟體 below */
  const hillLetters = [];
  function buildHillSign() {
    const cx = -14, cz = -166, RX = 68, RY = 15, RZ = 30;
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 9, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xb4d3b8, flatShading: true }));
    mound.scale.set(RX, RY, RZ); mound.position.set(cx, -.5, cz); mound.receiveShadow = true; scene.add(mound); blockers.push([cx, cz, 62]);
    const yOn = (x, z) => -.5 + RY * Math.sqrt(Math.max(0, 1 - ((x - cx) / RX) ** 2 - ((z - cz) / RZ) ** 2));
    const word = 'SIGNWELL', CAP = 11, CW = 384, CHh = 320, FS = 300, PH = CAP * CHh / (FS * .72), PW = PH * CW / CHh;
    const meas = mkCanvas(8, 8).getContext('2d'); meas.font = '800 ' + FS + 'px ' + FONT_D;
    const adv = [...word].map(ch => meas.measureText(ch).width / (FS * .72) * CAP), gap = 1.6, total = adv.reduce((a, b) => a + b, 0) + gap * (word.length - 1);
    const zf = cz + RZ * .52, yaw0 = .14, legM = lam(0x3a3c40);
    let x = cx - total / 2;
    [...word].forEach((ch, i) => {
      const c = mkCanvas(CW, CHh); const tex = texFrom(c); hillLetters.push({ c, tex, ch, kind: 'latin' }); drawHillGlyph(c, ch); tex.needsUpdate = true;
      const lx = x + adv[i] / 2, lz = zf + (R() - .5) * 1.2, gy = yOn(lx, lz), base = gy + .8, yaw = yaw0 + (R() - .5) * .06, tilt = (R() - .5) * .05;
      const g = new THREE.Group(); g.position.set(lx, base + PH * (.5 - (CHh - 292) / CHh), lz); g.rotation.set(0, yaw, tilt);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, emissive: 0x9a9a9a, emissiveMap: tex }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5, color: 0xc4c8cc, side: THREE.DoubleSide })); back.position.z = -.7;
      front.castShadow = back.castShadow = true; g.add(front, back);
      [-.25, .25].forEach(o => { const leg = new THREE.Mesh(new THREE.BoxGeometry(.28, CAP * .7 + 3, .28), legM); leg.position.set(o * adv[i], -PH * .5 + (CHh - 292) / CHh * PH + CAP * .35 - 1.5, -1.1); leg.castShadow = true; g.add(leg); });
      scene.add(g); x += adv[i] + gap;
    });
    const c = mkCanvas(1024, 256), tex = texFrom(c); hillLetters.push({ c, tex, kind: 'cn' }); drawHillGlyph(c, '欣緯軟體', true); tex.needsUpdate = true;
    const sz = cz + RZ * .82, sy = yOn(cx, sz), sub = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, emissive: 0x9a9a9a, emissiveMap: tex }));
    sub.position.set(cx, sy + 3.4, sz); sub.rotation.y = yaw0; sub.castShadow = true; scene.add(sub);
  }
  function drawHillGlyph(c, t, cn) {
    const x = ctxOf(c); x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#ffffff'; x.textAlign = 'center';
    if (cn) { x.textBaseline = 'middle'; x.font = '900 190px ' + FONT_CN; x.fillText(t, c.width / 2, c.height / 2 + 6); }
    else { x.textBaseline = 'alphabetic'; x.font = '800 300px ' + FONT_D; x.fillText(t, c.width / 2, 292); }
  }

  function buildOffice(textures) {
    const b = B.office, { x: ox, z: oz, w, d } = OFFICE, x0 = ox - w / 2, x1 = ox + w / 2, z0 = oz - d / 2, z1 = oz + d / 2;
    blockers.push([ox, oz, Math.hypot(w, d) / 2 + 4]);
    const TW = .9, WALL = 0xeeedea, CAP = 0x2a2b2f, STEEL = C.steel;
    // slab & polished concrete floor
    box(b, ox, -.2, oz, w + 2, .5, d + 2, 0xe2e1dd);
    b.add(fbox(w, .1, d, [null, null, T.CONCRETE, null, null, null], FUV, 9, 9), mtx(ox, .06, oz), 0xffffff);
    // tall back & left walls (far side), low cut-away front & right walls (near side)
    box(b, ox, 6.2, z0, w + TW, 12.4, TW, WALL, 0, T.PLAIN, [0, 6]);
    box(b, x0, 5.6, oz, TW, 11.2, d, WALL, 0, T.PLAIN, [0, 6]);
    const fw = w / 2 - 6; box(b, x0 + fw / 2, .7, z1, fw, 1.4, TW, WALL); box(b, x1 - fw / 2, .7, z1, fw, 1.4, TW, WALL);
    box(b, x1, .7, oz, TW, 1.4, d, WALL);
    box(b, ox, 12.46, z0, w + TW + .04, .14, TW + .04, CAP); box(b, x0, 11.26, oz, TW + .04, .14, d, CAP);
    box(b, x0 + fw / 2, 1.46, z1, fw, .14, TW + .04, CAP); box(b, x1 - fw / 2, 1.46, z1, fw, .14, TW + .04, CAP); box(b, x1, 1.46, oz, TW + .04, .14, d, CAP);
    // steel-framed loft windows on the inside of the tall walls (ground floor and upper level)
    b.add(fbox(.12, 3.4, 33.6, [T.LOFT, T.LOFT, null, null, null, null]), mtx(x0 + TW / 2 + .07, 2.6, oz + 6), 0xffffff);
    b.add(fbox(.12, 3.4, 42, [T.LOFT, T.LOFT, null, null, null, null]), mtx(x0 + TW / 2 + .07, 7.6, oz), 0xffffff);
    b.add(fbox(29.4, 3.4, .12, [null, null, null, null, T.LOFT, T.LOFT]), mtx(x0 + 52, 7.6, z0 + TW / 2 + .07), 0xffffff);
    // brand band at the top of the back wall
    const band = new THREE.Mesh(new THREE.PlaneGeometry(w * .8, 2.6), new THREE.MeshBasicMaterial({ map: textures.band, toneMapped: false }));
    box(b, ox + 4, 10.7, z0 + TW / 2 + .12, w * .84, 3, .24, C.ink);
    band.position.set(ox + 4, 10.7, z0 + TW / 2 + .3); scene.add(band);
    // exposed steel trusses with pendant lamps
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff1c9, toneMapped: false });
    [oz + 15, oz + 3, oz - 9].forEach(z => {
      box(b, ox, 11.7, z, w, .42, .32, STEEL); box(b, x1 - .3, 5.85, z, .34, 11.7, .34, STEEL);
      for (let x = x0 + 8; x < x1 - 4; x += 8.4) { if (z < oz - 6 && x < x0 + 52) continue; box(b, x, 10.4, z, .04, 2.4, .04, 0x555555); b.add(new THREE.ConeGeometry(.5, .45, 12, 1, true), mtx(x, 9.0, z), 0x2a2b2f); const l = new THREE.Mesh(new THREE.CircleGeometry(.42, 12), lampM); l.rotation.x = Math.PI / 2; l.position.set(x, 8.78, z); scene.add(l); }
    });
    // mezzanine (2F) along the back wall: meeting room + lounge, steel stair
    const MZ = { x0: x0 + .5, x1: x0 + 52, z0: z0 + .5, z1: z0 + 16, y: 5.2 };
    box(b, (MZ.x0 + MZ.x1) / 2, MZ.y - .22, (MZ.z0 + MZ.z1) / 2, MZ.x1 - MZ.x0, .44, MZ.z1 - MZ.z0, 0xd8d6d1);
    b.add(fbox(MZ.x1 - MZ.x0, .06, MZ.z1 - MZ.z0, [null, null, T.OAK, null, null, null], FUV, 6, 6), mtx((MZ.x0 + MZ.x1) / 2, MZ.y + .03, (MZ.z0 + MZ.z1) / 2), 0xffffff);
    box(b, (MZ.x0 + MZ.x1) / 2, MZ.y - .3, MZ.z1, MZ.x1 - MZ.x0, .6, .35, STEEL);
    for (let x = MZ.x0 + 11; x < MZ.x1; x += 13) box(b, x, (MZ.y - .4) / 2, MZ.z1 - .2, .4, MZ.y - .4, .4, STEEL);
    const rail = (xa, za, xb, zb) => { const len = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), mx = (xa + xb) / 2, mz = (za + zb) / 2;
      const gp = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.05, len), glassMat); gp.position.set(mx, MZ.y + .55, mz); gp.rotation.y = a; scene.add(gp); box(b, mx, MZ.y + 1.1, mz, .14, .1, len, STEEL, a); };
    rail(MZ.x0, MZ.z1 - .1, MZ.x1 - 4.6, MZ.z1 - .1);
    // stair: from the floor near the right of the mezzanine, rising toward the back
    const ST = { x: MZ.x1 + 2.2, zb: MZ.z1 + 17, zt: MZ.z1, w: 3.6 }; const steps = 17, rise = MZ.y / steps, run = (ST.zb - ST.zt) / steps;
    box(b, ST.x, MZ.y - .22, MZ.z0 + 8, ST.w + .6, .44, 15, 0xd8d6d1); b.add(fbox(ST.w + .6, .06, 15, [null, null, T.OAK, null, null, null], FUV, 6, 6), mtx(ST.x, MZ.y + .03, MZ.z0 + 8), 0xffffff);
    for (let i = 0; i < steps; i++) box(b, ST.x, rise * (i + 1) - .06, ST.zb - run * (i + .5), ST.w, .12, run + .05, C.oak);
    { const len = Math.hypot(ST.zb - ST.zt, MZ.y), a = Math.atan2(MZ.y, ST.zb - ST.zt), mz = (ST.zb + ST.zt) / 2;
      [-1, 1].forEach(sd => b.add(UNIT, mtx(ST.x + sd * (ST.w / 2 + .1), MZ.y / 2 - .1, mz, 0, .16, .42, len, a), STEEL));
      b.add(UNIT, mtx(ST.x + ST.w / 2 + .1, MZ.y / 2 + 1.05, mz, 0, .08, .08, len, a), STEEL); }
    // meeting room (glass box) on the mezzanine
    const MR = { x0: x0 + 1.4, x1: x0 + 26, z0: z0 + 1.2, z1: z0 + 13.6, y0: MZ.y + .06, h: 3.3 };
    [[MR.x0, MR.z1, MR.x1, MR.z1], [MR.x1, MR.z0, MR.x1, MR.z1]].forEach(([xa, za, xb, zb]) => { const len = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), mx = (xa + xb) / 2, mz = (za + zb) / 2;
      const gp = new THREE.Mesh(new THREE.BoxGeometry(.08, MR.h, len), glassMat); gp.position.set(mx, MR.y0 + MR.h / 2, mz); gp.rotation.y = a; scene.add(gp);
      box(b, mx, MR.y0 + MR.h, mz, .18, .18, len, STEEL, a); for (let k = 0; k <= Math.round(len / 4); k++) { const t = k / Math.round(len / 4); box(b, lerp(xa, xb, t), MR.y0 + MR.h / 2, lerp(za, zb, t), .1, MR.h, .1, STEEL); } });
    const tx = (MR.x0 + MR.x1) / 2, tz = (MR.z0 + MR.z1) / 2 + .6;
    b.add(fbox(14, .14, 3.4, [null, null, T.OAK, null, null, null], FUV, 4, 4), mtx(tx, MR.y0 + 1.02, tz), 0xffffff); box(b, tx - 5, MR.y0 + .5, tz, .3, 1, 2.6, STEEL); box(b, tx + 5, MR.y0 + .5, tz, .3, 1, 2.6, STEEL);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.2), new THREE.MeshBasicMaterial({ map: textures.meeting, toneMapped: false })); screen.position.set(tx - 2, MR.y0 + 2.3, MR.z0 + .02); scene.add(screen);
    box(b, tx - 2, MR.y0 + 2.3, MR.z0 - .04, 7.9, 4.5, .1, 0x111111);
    // mezzanine lounge: sofa, bookshelf, plants
    box(b, x0 + 36, MZ.y + .45, z0 + 4, 8, .9, 2.4, 0x2f3d4f); box(b, x0 + 36, MZ.y + 1.0, z0 + 2.9, 8, 1.3, .6, 0x2f3d4f);
    box(b, x0 + 36, MZ.y + .35, z0 + 7.6, 3, .7, 1.8, C.oak);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { box(b, x0 + 44 + i * 1.9, MZ.y + .9 + j * 1.15, z0 + 1.1, 1.8, .08, 1.1, 0x3a3b3f); for (let k = 0; k < 5; k++) box(b, x0 + 43.4 + i * 1.9 + k * .3, MZ.y + 1.25 + j * 1.15, z0 + 1.1, .24, .62, .8, [0xd8402f, 0x2f6fb8, 0xffd84d, 0xffffff, 0x3a8a5a, 0x111111][(i + j + k) % 6]); }
    // ground floor under the mezzanine: video studio corner, coffee bar, servers
    box(b, x0 + 9, 2.4, z0 + 1.2, 15, 4.6, .3, C.yellow); box(b, x0 + 9, .1, z0 + 3.4, 15, .12, 4.4, C.yellow);
    const tripod = (x, z) => { for (let a = 0; a < 3; a++) { const an = a / 3 * Math.PI * 2; box(b, x + Math.sin(an) * .35, .9, z + Math.cos(an) * .35, .07, 1.9, .07, 0x111111, 0, T.PLAIN); } box(b, x, 2, z, .7, .55, .9, 0x1b1b1e); b.add(new THREE.CylinderGeometry(.22, .26, .7, 12), mtx(x, 2.05, z - .7, 0, 1, 1, 1, Math.PI / 2), 0x111111); };
    tripod(x0 + 9, z0 + 11);
    [[x0 + 3.5, z0 + 8.5, .7], [x0 + 14.5, z0 + 8.5, -.7]].forEach(([x, z, a]) => { box(b, x, 1.4, z, .08, 2.8, .08, 0x111111); const sb = mtx(x, 3, z, a, 1.6, 1.6, .9); b.add(UNIT, sb, 0xffffff); });
    b.add(fbox(14, 1.15, 1.7, [null, null, T.PLAIN, null, T.OAK, T.OAK], FUV, 1.5, 1.2), mtx(x0 + 30, .58, z0 + 9.5), 0xffffff);
    box(b, x0 + 30, 1.2, z0 + 9.5, 14.4, .1, 2, 0xf2f2f0); box(b, x0 + 26, 1.6, z0 + 9.4, 1.2, .8, .9, 0x1b1b1e); box(b, x0 + 38.6, 1.6, z0 + 2.4, 1.8, 3.2, 1.6, 0xf4f4f2);
    for (let i = 0; i < 4; i++) { box(b, x0 + 25 + i * 3, .55, z0 + 11.4, .5, 1.1, .5, 0x1b1b1e); b.add(new THREE.CylinderGeometry(.45, .45, .12, 12), mtx(x0 + 25 + i * 3, 1.12, z0 + 11.4), C.oak); }
    for (let i = 0; i < 3; i++) box(b, x0 + 44 + i * 1.8, 1.8, z0 + 1.8, 1.6, 3.6, 1.2, 0x1c1d21);
    const blink = new THREE.Mesh(new THREE.BoxGeometry(5.2, .08, .05), new THREE.MeshBasicMaterial({ color: 0x66ff9a, toneMapped: false })); blink.position.set(x0 + 45.8, 2.7, z0 + 2.42); scene.add(blink); officePeople.blink = blink;
    // main floor: three long oak benches, one wide monitor per seat
    const deskM = [], monM = [], scrM = [[], [], []], chairM = [], seats = [];
    const benches = [{ xa: x0 + 4, xb: x0 + 46, z: z0 + 23.5 }, { xa: x0 + 4, xb: x0 + 46, z: z0 + 32.5 }, { xa: x0 + 18, xb: x0 + 58, z: z0 + 41 }];
    benches.forEach(bn => {
      const len = bn.xb - bn.xa, cx = (bn.xa + bn.xb) / 2;
      b.add(fbox(len, .14, 3.2, [null, null, T.OAK, null, null, null], FUV, 5, 5), mtx(cx, .98, bn.z), 0xffffff);
      for (let x = bn.xa + .6; x <= bn.xb - .6; x += (len - 1.2) / Math.round(len / 7)) box(b, x, .48, bn.z, .14, .96, 2.9, STEEL);
      const n = Math.floor(len / 3.6);
      for (let k = 0; k < n; k++) for (const look of [1, -1]) {
        const sx = bn.xa + (k + .5) * len / n, sz = bn.z - look * 2.15, ry = look > 0 ? 0 : Math.PI, mz = bn.z - look * .5;
        monM.push(mtx(sx, 1.55, mz, ry)); scrM[seats.length % 3].push(mtx(sx, 1.58, mz - look * .055, ry + Math.PI)); chairM.push(mtx(sx, .55, sz, ry)); seats.push({ x: sx, z: sz, ry });
      }
    });
    const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); return im; };
    inst(new THREE.BoxGeometry(1.5, .84, .08), lam(0x1b1b1f), monM); inst((() => { const g = new THREE.BoxGeometry(.12, .5, .12); g.translate(0, -.55, 0); return g; })(), lam(0x2a2b30), monM);
    screenTexes = textures.code;
    scrM.forEach((list, i) => { const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.38, .72), new THREE.MeshBasicMaterial({ map: textures.code[i], toneMapped: false }), list.length); list.forEach((m, k) => im.setMatrixAt(k, m)); im.computeBoundingSphere(); scene.add(im); });
    inst(new THREE.BoxGeometry(1, .14, 1), lam(0x2a2b30), chairM);
    inst((() => { const g = new THREE.BoxGeometry(1, 1.1, .14); g.translate(0, .62, -.5); return g; })(), lam(0x2a2b30), chairM);
    // lounge with a big screen in the front-right corner, sofa corner front-left
    box(b, x1 - 9, .45, z1 - 4.2, 8, .9, 2.4, C.blue); box(b, x1 - 9, 1, z1 - 3.1, 8, 1.3, .6, C.blue); box(b, x1 - 9, .3, z1 - 8, 3, .6, 1.6, C.oak);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(4, 28), lam(C.pinkSoft)); rug.rotation.x = -Math.PI / 2; rug.position.set(x0 + 9, .12, z1 - 7); scene.add(rug);
    box(b, x0 + 9, .3, z1 - 7, 2.6, .6, 1.6, C.yellow); box(b, x0 + 9, .45, z1 - 3.2, 8, .9, 2.4, 0x2f3d4f); box(b, x0 + 9, 1, z1 - 2.1, 8, 1.3, .6, 0x2f3d4f);
    // plants in black pots
    const plantGeo = new THREE.IcosahedronGeometry(1, 0);
    [[x0 + 2.2, z1 - 2.2], [x0 + 2.2, oz + 4], [x1 - 3, z1 - 2.6], [x0 + 20, z1 - 2.2], [x0 + 49, z0 + 20], [x0 + 30, MZ.z1 - 2]].forEach(([px, pz], i) => {
      const y = i === 5 ? MZ.y : 0; b.add(new THREE.CylinderGeometry(.6, .45, 1, 10), mtx(px, y + .5, pz), 0x1d1e21);
      const pl = new THREE.Mesh(plantGeo, new THREE.MeshLambertMaterial({ color: C.tree, flatShading: true })); pl.position.set(px, y + 1.9, pz); pl.scale.set(1, 1.35, 1); pl.castShadow = true; scene.add(pl);
    });
    // entrance canopy & glass doors
    box(b, ox, 4.15, z1 + 1.6, 12.4, .55, 3.6, C.yellow); [-1, 1].forEach(sd => { box(b, ox + sd * 5.6, 2, z1 + .2, .45, 4, .45, C.ink); box(b, ox + sd * 5.6, 2, z1 + 3.1, .45, 4, .45, C.ink); }); box(b, ox, 4.5, z1 + 3.42, 12.4, .5, .12, C.ink);
    // people
    const shirts = [C.blue, C.yellow, C.pink, C.ink, C.paper, 0x8fa8ff, C.pinkDeep, 0x9aa0a8, 0x3a8a5a];
    const skins = [0xf1d5c2, 0xe7c1a6, 0xd6a583, 0xf3dccd], hairs = [0x1a1a1a, 0x3b2a1f, 0x2b2b2b, 0x5a4030];
    const P = (o) => Object.assign({ shirt: shirts[R() * shirts.length | 0], skin: skins[R() * skins.length | 0], hair: hairs[R() * hairs.length | 0], ph: R() * 6.28 }, o);
    seats.forEach((st, i) => { if (i % 7 === 5) return; officePeople.push(P({ ...st, sit: true })); });
    // meeting upstairs
    for (let k = 0; k < 4; k++) for (const sd of [1, -1]) { if (k === 3 && sd === 1) continue; officePeople.push(P({ x: tx - 4.6 + k * 3, z: tz + sd * 2.3, y: MR.y0, ry: sd > 0 ? Math.PI : 0, sit: true, noDesk: true })); }
    officePeople.push(P({ x: tx + 2.4, z: MR.z0 + 1.6, y: MR.y0, ry: Math.PI * .1, sit: false, shirt: C.ink, wave: true }));
    officePeople.push(P({ x: x0 + 35, z: z0 + 4.6, y: MZ.y, ry: 0, sit: true, noDesk: true }), P({ x: x0 + 38, z: z0 + 4.6, y: MZ.y, ry: 0, sit: true, noDesk: true }));
    // studio: presenter & camera operator; coffee bar
    officePeople.push(P({ x: x0 + 9, z: z0 + 4.6, ry: 0, sit: false, shirt: C.yellow }), P({ x: x0 + 9.6, z: z0 + 12.4, ry: Math.PI, sit: false, shirt: C.ink }));
    officePeople.push(P({ x: x0 + 30, z: z0 + 7.6, ry: 0, sit: false, shirt: C.paper }), P({ x: x0 + 27, z: z0 + 12.6, ry: Math.PI, sit: false }));
    officePeople.push(P({ x: x0 + 7, z: z1 - 4.3, ry: 0, sit: true, noDesk: true }), P({ x: x0 + 11, z: z1 - 4.3, ry: 0, sit: true, noDesk: true }));
    officePeople.push(P({ x: x1 - 11, z: z1 - 5.4, ry: Math.PI, sit: true, noDesk: true }), P({ x: x1 - 7.5, z: z1 - 5.4, ry: Math.PI, sit: true, noDesk: true }));
    const walk = (ax, ay, az, bx, by, bz, o) => officePeople.push(P(Object.assign({ path: [ax, ay, az, bx, by, bz], sit: false }, o || {})));
    walk(x0 + 6, 0, z0 + 28, x0 + 44, 0, z0 + 28); walk(x0 + 42, 0, z0 + 37, x0 + 8, 0, z0 + 37, { shirt: C.yellow }); walk(x0 + 20, 0, z1 - 2.4, x0 + 52, 0, z1 - 2.4, { shirt: C.ink });
    walk(ST.x - .7, 0, ST.zb + .6, ST.x - .7, MZ.y + .02, ST.zt - .6, { speed: 1.3 }); walk(x0 + 28, MZ.y, z0 + 14.6, x0 + 48, MZ.y, z0 + 14.6, { shirt: C.pink });
    walk(x0 + 23, 0, z0 + 14.8, x0 + 37, 0, z0 + 14.8, { speed: 1.2 }); walk(x1 - 3.5, 0, z1 - 14, x1 - 3.5, 0, z0 + 21, { shirt: C.blue });
    buildPeople(officePeople, 'office');
  }

  /* low-poly people (instanced): sitting, standing or walking back and forth along a path */
  const peopleSets = [];
  const PGEO = {
    torso: new THREE.CylinderGeometry(.42, .5, 1.05, 8), head: new THREE.SphereGeometry(.36, 12, 10), hair: new THREE.SphereGeometry(.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55),
    leg: (() => { const g = new THREE.BoxGeometry(.34, 1.02, .38); g.translate(0, -.51, 0); return g; })(), arm: (() => { const g = new THREE.BoxGeometry(.22, .86, .24); g.translate(0, -.43, 0); return g; })()
  };
  const PARTS = ['torso', 'head', 'hair', 'legL', 'legR', 'armL', 'armR'];
  function buildPeople(list, tag) {
    const n = list.length; if (!n) return null;
    list.forEach(p => { if (p.path) { const [ax, ay, az, bx, by, bz] = p.path; p.len = Math.hypot(bx - ax, by - ay, bz - az) || 1; p.speed = p.speed || 1.6 + R() * .8; } });
    const mk = (geo, cols) => { const im = new THREE.InstancedMesh(geo, lam(0xffffff), n); const cc = new THREE.Color(); cols.forEach((c, i) => im.setColorAt(i, cc.set(c))); im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); return im; };
    const pants = list.map(p => p.pants || [0x33343a, 0x2f3d4f, 0x4a4036, 0x2a2b30][(p.ph * 10 | 0) % 4]);
    const set = { list, tag, visible: true, torso: mk(PGEO.torso, list.map(p => p.shirt)), head: mk(PGEO.head, list.map(p => p.skin)), hair: mk(PGEO.hair, list.map(p => p.hair)),
      legL: mk(PGEO.leg, pants), legR: mk(PGEO.leg, pants), armL: mk(PGEO.arm, list.map(p => p.shirt)), armR: mk(PGEO.arm, list.map(p => p.shirt)) };
    peopleSets.push(set); posePeople(set, 0); return set;
  }
  function showPeople(set, v) { if (set.visible === v) return; set.visible = v; PARTS.forEach(k => { set[k].visible = v; }); }
  const PM = new THREE.Matrix4(), PB = new THREE.Matrix4(), PQ = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
  function part(mesh, i, px, py, pz, ax) { PM.makeRotationX(ax); PM.setPosition(px, py, pz); PM.premultiply(PB); mesh.setMatrixAt(i, PM); }
  function posePeople(set, t) {
    const { list } = set, anim = !reduced.matches;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]; let x = p.x, y = p.y || 0, z = p.z, ry = p.ry || 0, walk = 0, ph = 0;
      if (p.path) {
        const [ax, ay, az, bx, by, bz] = p.path, Lp = p.len;
        if (anim) { const u = (t * p.speed + p.ph * 7) % (2 * Lp), fwd = u < Lp, f = (fwd ? u : 2 * Lp - u) / Lp; x = ax + (bx - ax) * f; y = ay + (by - ay) * f; z = az + (bz - az) * f; ry = Math.atan2((bx - ax) * (fwd ? 1 : -1), (bz - az) * (fwd ? 1 : -1)); walk = 1; ph = t * p.speed * 2.5 + p.ph; }
        else { x = ax; y = ay; z = az; ry = Math.atan2(bx - ax, bz - az); }
      }
      const swing = walk ? Math.sin(ph) * .62 : 0, lift = walk ? Math.abs(Math.cos(ph)) * .07 : 0;
      const bob = anim && !walk ? Math.sin(t * 2.2 + p.ph) * .03 : 0, nod = anim ? Math.sin(t * 1.3 + p.ph * 2) * .08 : 0, typing = anim && p.sit && !p.noDesk ? Math.sin(t * 13 + p.ph) * .14 : 0;
      PQ.setFromAxisAngle(UPV, ry); PB.compose(V3.set(x, y + lift, z), PQ, ONE);
      const sit = p.sit, ty = sit ? 1.38 : 1.72, desk = sit && !p.noDesk;
      part(set.torso, i, 0, ty + bob, 0, 0);
      part(set.head, i, 0, ty + .92 + bob, desk ? .06 : 0, nod); part(set.hair, i, 0, ty + .99 + bob, desk ? .04 : 0, nod);
      if (sit) { part(set.legL, i, -.2, .86, .05, -1.45); part(set.legR, i, .2, .86, .05, -1.45); }
      else { part(set.legL, i, -.2, 1.16, 0, swing); part(set.legR, i, .2, 1.16, 0, -swing); }
      if (desk) { part(set.armL, i, -.52, ty + .4, .05, -1.15 + typing); part(set.armR, i, .52, ty + .4, .05, -1.15 - typing); }
      else if (sit) { part(set.armL, i, -.52, ty + .4, 0, -.45); part(set.armR, i, .52, ty + .4, 0, -.45); }
      else { part(set.armL, i, -.55, ty + .48 + bob, 0, -swing * .8); part(set.armR, i, .55, ty + .48 + bob, 0, p.wave && anim ? -2.7 + Math.sin(t * 5) * .35 : swing * .8); }
    }
    PARTS.forEach(k => { set[k].instanceMatrix.needsUpdate = true; });
  }

  /* ---------------- vehicles ---------------- */
  function makeVehicle(kind, body, accent) {
    const g = new THREE.Group(); const m = c => lam(c);
    const add = (geo, mat, x, y, z, cast = true) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; g.add(me); return me; };
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(.46, .46, .36, 14); wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(.2, .2, .38, 8); hubGeo.rotateZ(Math.PI / 2);
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), tl = new THREE.MeshBasicMaterial({ color: 0xff5a5a, toneMapped: false });
    if (kind === 'van') {
      add(new THREE.BoxGeometry(2.3, 1.25, 5.3), m(body), 0, 1.0, 0);
      add(new THREE.BoxGeometry(2.24, 1.15, 3.9), m(body), 0, 2.2, -.62);
      const ws = add(new THREE.BoxGeometry(2.1, 1.2, .12), lam(0x25324a), 0, 2.08, 1.48, false); ws.rotation.x = -.5;
      add(new THREE.BoxGeometry(2.33, .26, 5.32), m(accent), 0, 1.26, 0, false);
      add(new THREE.BoxGeometry(1.6, .2, 2.2), m(accent), 0, 2.86, -.9);
      add(new THREE.BoxGeometry(1.9, .4, .1), lam(0x1d1e22), 0, .82, 2.66, false);
      add(new THREE.BoxGeometry(.42, .2, .06), hl, -.78, 1.22, 2.66, false); add(new THREE.BoxGeometry(.42, .2, .06), hl, .78, 1.22, 2.66, false);
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(.56, .56), new THREE.MeshBasicMaterial({ map: TEX.logo, toneMapped: false })); logo.position.set(0, 1.52, 2.66); g.add(logo);
      const side = new THREE.MeshBasicMaterial({ map: TEX.vanSide, toneMapped: false, transparent: true });
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .9), side); sl.position.set(1.135, 2.2, -.7); sl.rotation.y = Math.PI / 2; g.add(sl);
      const sr = sl.clone(); sr.position.x = -1.135; sr.rotation.y = -Math.PI / 2; g.add(sr);
      [[-1.06, 1.6], [1.06, 1.6], [-1.06, -1.75], [1.06, -1.75]].forEach(([x, z]) => { wheels.push(add(wheelGeo, lam(0x17181b), x, .46, z)); add(hubGeo, lam(0xd8d8d8), x, .46, z, false); });
    } else if (kind === 'truck' || kind === 'garbage' || kind === 'bus') {
      const long = kind === 'bus' ? 10 : 7, h = kind === 'bus' ? 3.1 : 3.2;
      if (kind === 'bus') { add(new THREE.BoxGeometry(2.5, h, long), m(body), 0, 1.95, 0); add(new THREE.BoxGeometry(2.54, .9, long - 1), lam(0x2b3446), 0, 2.4, -.2, false); add(new THREE.BoxGeometry(2.56, .35, long + .02), m(accent), 0, .95, 0, false); }
      else { add(new THREE.BoxGeometry(2.3, 2.1, 2.2), m(kind === 'garbage' ? body : 0xf2f2f0), 0, 1.6, long / 2 - 1.1); add(new THREE.BoxGeometry(2.1, .8, .1), lam(0x2b3446), 0, 2.1, long / 2 + .01, false);
        add(new THREE.BoxGeometry(2.5, kind === 'garbage' ? 2.6 : 3.1, long - 2.4), m(body), 0, kind === 'garbage' ? 2.0 : 2.25, -1.2); add(new THREE.BoxGeometry(2.52, .5, long - 2.4), m(accent), 0, 1.0, -1.2, false); }
      add(new THREE.BoxGeometry(.4, .18, .05), hl, -.8, 1.1, long / 2 + .02, false); add(new THREE.BoxGeometry(.4, .18, .05), hl, .8, 1.1, long / 2 + .02, false);
      [[-1.1, long * .34], [1.1, long * .34], [-1.1, -long * .32], [1.1, -long * .32]].forEach(([x, z]) => { wheels.push(add(wheelGeo, lam(0x17181b), x, .48, z)); });
    } else if (kind === 'scooter') {
      add(new THREE.BoxGeometry(.62, .5, 1.9), m(body), 0, .62, -.05); add(new THREE.BoxGeometry(.6, .9, .38), m(body), 0, 1.05, .78); add(new THREE.BoxGeometry(.52, .2, .9), lam(0x1b1b1e), 0, 1.0, -.35);
      add(new THREE.BoxGeometry(.9, .07, .07), lam(0x2a2a2a), 0, 1.6, .82, false);
      const wg = new THREE.CylinderGeometry(.3, .3, .2, 12); wg.rotateZ(Math.PI / 2); [.8, -.8].forEach(z => wheels.push(add(wg, lam(0x17181b), 0, .3, z)));
      add(new THREE.CylinderGeometry(.42, .5, 1, 8), m(accent), 0, 1.75, -.25); add(new THREE.SphereGeometry(.4, 12, 10), m([0xffffff, C.yellow, C.ink, C.pink, C.blue][R() * 5 | 0]), 0, 2.55, -.18);
      add(new THREE.BoxGeometry(.24, .24, .7), m(accent), -.4, 1.85, .2); add(new THREE.BoxGeometry(.24, .24, .7), m(accent), .4, 1.85, .2);
    } else {
      const long = kind === 'taxi' ? 4.4 : 4.2;
      add(new THREE.BoxGeometry(1.9, .78, long), m(body), 0, .8, 0);
      add(new THREE.BoxGeometry(1.72, .7, long * .52), m(body), 0, 1.52, -.15);
      add(new THREE.BoxGeometry(1.76, .5, long * .53), lam(0x2b3446), 0, 1.5, -.15, false);
      if (kind === 'taxi') add(new THREE.BoxGeometry(.7, .22, .3), m(C.ink), 0, 1.98, -.1);
      add(new THREE.BoxGeometry(.36, .14, .05), hl, -.6, .92, long / 2 + .01, false); add(new THREE.BoxGeometry(.36, .14, .05), hl, .6, .92, long / 2 + .01, false);
      add(new THREE.BoxGeometry(.36, .14, .05), tl, -.6, .92, -long / 2 - .01, false); add(new THREE.BoxGeometry(.36, .14, .05), tl, .6, .92, -long / 2 - .01, false);
      [[-.9, long * .32], [.9, long * .32], [-.9, -long * .32], [.9, -long * .32]].forEach(([x, z]) => { wheels.push(add(wheelGeo, lam(0x17181b), x, .42, z)); });
    }
    g.userData.wheels = wheels; return g;
  }
  const LOOK = new THREE.Vector3();
  function placeOnRoad(obj, s, lateral, dir) {
    road(s); const x = RD.x + RD.rx * lateral, z = RD.z + RD.rz * lateral, y = RD.y + .05;
    obj.position.set(x, y, z);
    LOOK.set(x + RD.hx * dir, y + RD.gy * dir, z + RD.hz * dir); obj.lookAt(LOOK);
  }

  /* ---------------- billboards ---------------- */
  const signs = [];
  function makeBillboard(w, h, tex, opts = {}) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.z = .21; g.add(face);
    const frameM = new THREE.MeshLambertMaterial({ color: opts.frame || C.ink });
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + .7, h + .7, .4), frameM); back.castShadow = true; back.receiveShadow = true; g.add(back);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.3, h + 1.3), new THREE.MeshBasicMaterial({ color: C.yellow, toneMapped: false, transparent: true, opacity: 0, depthWrite: false })); glow.position.z = -.05; glow.renderOrder = -1; g.add(glow);
    const postH = opts.postH || 6, postM = lam(0x2a2b30);
    [-w * .3, w * .3].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(.5, postH + 10, .5), postM); p.position.set(x, -h / 2 - (postH + 10) / 2 + .2, -.35); p.castShadow = true; g.add(p); });
    const walk = new THREE.Mesh(new THREE.BoxGeometry(w + .6, .14, 1.1), postM); walk.position.set(0, -h / 2 - .5, .35); walk.castShadow = true; g.add(walk);
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff1c2, toneMapped: false });
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.9, .22, .5), lampM); l.position.set((i - 1) * w * .33, h / 2 + .55, .45); g.add(l); const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .9), postM); arm.position.set((i - 1) * w * .33, h / 2 + .45, .05); g.add(arm); }
    scene.add(g); return { group: g, face, glow, back };
  }
  function standSign(sg, x, y, z, nx, nz) { sg.group.position.set(x, y, z); sg.group.lookAt(x + nx, y, z + nz); sg.group.updateMatrixWorld(true); }

  /* ---------------- canvas art ---------------- */
  const TEX = {};
  const SIGN_W = LOW ? 1280 : 2048, SIGN_H = Math.round(SIGN_W * .625);
  function drawBand(c) {
    const x = ctxOf(c), W = c.width, H = c.height; x.fillStyle = '#0a0a0b'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.font = '800 ' + H * .5 + 'px ' + FONT_D; x.fillText('SIGNWELL', W * .04, H * .52);
    const w1 = x.measureText('SIGNWELL').width; x.fillStyle = '#ffd84d'; x.font = '900 ' + H * .42 + 'px ' + FONT_CN; x.fillText('欣緯軟體', W * .04 + w1 + H * .4, H * .53);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 ' + H * .16 + 'px ' + FONT_M; x.textAlign = 'right'; x.fillText('SOFTWARE DEPARTMENT · 欣緯科技', W * .96, H * .52);
  }
  function drawMeeting(c, img) {
    const x = ctxOf(c), W = c.width, H = c.height; x.fillStyle = '#0a0a0b'; x.fillRect(0, 0, W, H);
    if (img) { const r = Math.max(W / img.width, H / img.height), sw = W / r, sh = H / r; x.drawImage(img, (img.width - sw) / 2, 0, sw, sh, 0, 0, W, H); x.fillStyle = 'rgba(10,10,11,.12)'; x.fillRect(0, 0, W, H); }
    x.fillStyle = '#ffd84d'; x.fillRect(0, H - 10, W * .62, 10);
  }
  function drawCode(c, seed) {
    const x = ctxOf(c), W = c.width, H = c.height, r = rng(seed); x.fillStyle = '#12141b'; x.fillRect(0, 0, W, H);
    const cols = ['#8fa8ff', '#ffd84d', '#f7c6d9', '#e8eaf0', '#7ee0b4', '#6b7280'];
    let y = 8, ind = 0;
    while (y < H - 6) { ind = clamp(ind + (r() < .3 ? 1 : r() < .3 ? -1 : 0), 0, 4); let xx = 10 + ind * 14; const n = 1 + (r() * 4 | 0);
      for (let k = 0; k < n; k++) { const w = 12 + r() * 50; x.fillStyle = cols[r() * cols.length | 0]; x.fillRect(xx, y, w, 5); xx += w + 6; if (xx > W - 20) break; }
      y += 11; if (r() < .12) y += 9; }
    x.fillStyle = 'rgba(61,107,255,.25)'; x.fillRect(0, 0, 6, H);
  }
  function drawLogo(c) { const x = ctxOf(c), W = c.width; x.fillStyle = '#ffd84d'; rrect(x, 0, 0, W, W, W * .22); x.fill(); x.fillStyle = '#0a0a0b'; x.font = '800 ' + W * .62 + 'px ' + FONT_D; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('S', W / 2, W * .54); }
  function drawVanSide(c) { const x = ctxOf(c), W = c.width, H = c.height; x.clearRect(0, 0, W, H); x.fillStyle = '#ffffff'; x.font = '800 ' + H * .42 + 'px ' + FONT_D; x.textBaseline = 'middle'; x.fillText('SIGNWELL', W * .04, H * .5); const w = x.measureText('SIGNWELL').width; x.fillStyle = '#ffd84d'; x.font = '900 ' + H * .36 + 'px ' + FONT_CN; x.fillText('欣緯軟體', W * .06 + w, H * .53); }
  function drawChevron(c, dir) { const x = ctxOf(c), W = c.width, H = c.height; x.fillStyle = '#ffd84d'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; for (let k = 0; k < 2; k++) { const cx = W * (.33 + k * .34); x.beginPath(); x.moveTo(cx - dir * 22, H * .14); x.lineTo(cx + dir * 22, H * .5); x.lineTo(cx - dir * 22, H * .86); x.lineTo(cx - dir * 4, H * .86); x.lineTo(cx + dir * 40, H * .5); x.lineTo(cx - dir * 4, H * .14); x.closePath(); x.fill(); } x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6); }

  function drawManager(c, m, idx) {
    const x = ctxOf(c), W = c.width, H = c.height, u = W / 1600;
    x.fillStyle = '#0a0a0b'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffd84d'; x.fillRect(0, 0, W, 14 * u);
    x.textBaseline = 'alphabetic'; x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '600 ' + 26 * u + 'px ' + FONT_M; x.fillText('SIGNWELL SOFTWARE · MANAGER 0' + (idx + 1), 72 * u, 92 * u);
    x.textAlign = 'right'; x.fillText((idx + 1) + ' / 2', W - 72 * u, 92 * u); x.textAlign = 'left';
    x.fillStyle = '#ffffff'; x.font = '900 ' + 210 * u + 'px ' + FONT_CN; x.fillText(m.name, 64 * u, 330 * u);
    x.fillStyle = '#ffd84d'; rrect(x, 72 * u, 380 * u, 250 * u, 64 * u, 32 * u); x.fill(); x.fillStyle = '#0a0a0b'; x.font = '700 ' + 34 * u + 'px ' + FONT_CN; x.fillText('部門經理', 104 * u, 424 * u);
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '600 ' + 26 * u + 'px ' + FONT_M; x.fillText(m.en, 350 * u, 422 * u);
    const col = (title, items, cx, cy, cw, size) => {
      x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '600 ' + 24 * u + 'px ' + FONT_M; x.fillText(title, cx, cy);
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(cx, cy + 18 * u, cw, 2 * u);
      let y = cy + 74 * u; x.font = '500 ' + size * u + 'px ' + FONT_CN;
      for (const it of items) { const lines = wrap(x, it, cw - 30 * u); x.fillStyle = '#ffd84d'; x.beginPath(); x.arc(cx + 7 * u, y - size * u * .34, 6 * u, 0, 7); x.fill(); x.fillStyle = '#fff';
        lines.forEach((ln, k) => { x.fillText(ln, cx + 30 * u, y); y += size * u * (k < lines.length - 1 ? 1.3 : 1.62); }); }
      return y;
    };
    col('現職 / NOW', m.now, 72 * u, 540 * u, 610 * u, 40);
    col('學經歷 / EDUCATION & EXPERIENCE', m.edu, 800 * u, 190 * u, 730 * u, m.edu.length > 5 ? 41 : 46);
  }
  function coverImg(x, img, dx, dy, dw, dh, focusY = 0) { const r = Math.max(dw / img.width, dh / img.height), sw = dw / r, sh = dh / r; x.drawImage(img, (img.width - sw) / 2, (img.height - sh) * focusY, sw, sh, dx, dy, dw, dh); }
  function drawWork(c, wk, img) {
    const x = ctxOf(c), W = c.width, H = c.height, u = W / 1600, bandH = 232 * u, top = H - bandH;
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    if (wk.kind === 'shot' && img) coverImg(x, img, 0, 0, W, top, 0); else if (wk.kind === 'cms') drawCMS(x, W, top, u); else drawVincent(x, W, top, u);
    x.fillStyle = '#0a0a0b'; rrect(x, 40 * u, 40 * u, 300 * u, 66 * u, 33 * u); x.fill();
    x.fillStyle = '#ffd84d'; x.font = '600 ' + 28 * u + 'px ' + FONT_M; x.textBaseline = 'middle'; x.fillText('WORK 0' + (wk.i + 1) + ' / 07', 70 * u, 74 * u);
    x.fillStyle = '#0a0a0b'; x.fillRect(0, top, W, bandH); x.fillStyle = '#ffd84d'; x.fillRect(0, top, W, 8 * u);
    x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; fitFont(x, wk.name, '900', 76 * u, FONT_CN, W - 300 * u, 40 * u); x.fillText(wk.name, 56 * u, top + 108 * u);
    x.fillStyle = wk.url ? 'rgba(255,216,77,.92)' : 'rgba(255,255,255,.6)'; x.font = '500 ' + 28 * u + 'px ' + (wk.url ? FONT_M : FONT_CN); x.fillText(wk.urlText, 58 * u, top + 172 * u);
    if (!wk.url) return;
    x.fillStyle = '#ffd84d'; x.beginPath(); x.arc(W - 120 * u, top + bandH / 2 + 4 * u, 64 * u, 0, 7); x.fill();
    x.strokeStyle = '#0a0a0b'; x.lineWidth = 9 * u; x.lineCap = 'round'; x.beginPath(); x.moveTo(W - 142 * u, top + bandH / 2 + 26 * u); x.lineTo(W - 98 * u, top + bandH / 2 - 18 * u); x.moveTo(W - 136 * u, top + bandH / 2 - 18 * u); x.lineTo(W - 98 * u, top + bandH / 2 - 18 * u); x.lineTo(W - 98 * u, top + bandH / 2 + 20 * u); x.stroke();
  }
  function drawCMS(x, W, H, u) {
    x.fillStyle = '#eef2ff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#0a0a0b'; x.font = '900 ' + 54 * u + 'px ' + FONT_CN; x.textBaseline = 'alphabetic'; x.fillText('後台運作原理', 400 * u, 92 * u);
    x.fillStyle = '#55555a'; x.font = '600 ' + 24 * u + 'px ' + FONT_M; x.fillText('HOW THE CMS WORKS', 760 * u, 90 * u);
    const steps = [['01', '登入', 'Apps Script 驗證'], ['02', '編寫', '撰寫・審稿・草稿'], ['03', '發佈', 'commit 到 GitHub'], ['04', '上線', 'GitHub Pages']];
    const bw = 318 * u, bh = 250 * u, gap = 62 * u, y0 = 180 * u, x0 = (W - (bw * 4 + gap * 3)) / 2;
    steps.forEach((s, i) => {
      const bx = x0 + i * (bw + gap);
      x.fillStyle = i === 3 ? '#0a0a0b' : '#ffffff'; rrect(x, bx, y0, bw, bh, 28 * u); x.fill(); x.strokeStyle = '#0a0a0b'; x.lineWidth = 4 * u; x.stroke();
      x.fillStyle = i === 3 ? '#ffd84d' : '#3d6bff'; x.font = '600 ' + 28 * u + 'px ' + FONT_M; x.fillText(s[0], bx + 30 * u, y0 + 58 * u);
      x.fillStyle = i === 3 ? '#fff' : '#0a0a0b'; x.font = '900 ' + 64 * u + 'px ' + FONT_CN; x.fillText(s[1], bx + 30 * u, y0 + 148 * u);
      x.fillStyle = i === 3 ? 'rgba(255,255,255,.75)' : '#55555a'; x.font = '700 ' + 27 * u + 'px ' + FONT_CN; x.fillText(s[2], bx + 30 * u, y0 + 206 * u);
      if (i < 3) { const ax = bx + bw + 10 * u, ay = y0 + bh / 2; x.strokeStyle = '#0a0a0b'; x.lineWidth = 6 * u; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + gap - 20 * u, ay); x.moveTo(ax + gap - 34 * u, ay - 14 * u); x.lineTo(ax + gap - 20 * u, ay); x.lineTo(ax + gap - 34 * u, ay + 14 * u); x.stroke(); }
    });
    const bx = x0 + 3 * (bw + gap) + bw / 2, by = y0 + bh;
    x.strokeStyle = '#0a0a0b'; x.lineWidth = 5 * u; x.setLineDash([12 * u, 10 * u]); x.beginPath(); x.moveTo(bx, by + 6 * u); x.lineTo(bx, by + 60 * u); x.lineTo(x0 + bw * 1.2, by + 60 * u); x.lineTo(x0 + bw * 1.2, by + 92 * u); x.moveTo(bx, by + 60 * u); x.lineTo(bx, by + 92 * u); x.stroke(); x.setLineDash([]);
    const tag = (tx, label, fill) => { x.font = '700 ' + 30 * u + 'px ' + FONT_CN; const tw = x.measureText(label).width + 60 * u; x.fillStyle = fill; rrect(x, tx - tw / 2, by + 92 * u, tw, 70 * u, 35 * u); x.fill(); x.fillStyle = '#0a0a0b'; x.fillText(label, tx - tw / 2 + 30 * u, by + 138 * u); };
    tag(x0 + bw * 1.2, '電子報｜Gmail・Google Sheet', '#f7c6d9'); tag(bx, '社群｜Canva → Meta', '#ffd84d');
  }
  function drawVincent(x, W, H, u) {
    x.fillStyle = '#f4efe6'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(139,127,114,.55)'; x.lineWidth = 3 * u;
    x.beginPath(); x.moveTo(W / 2 - 250 * u, H * .86); x.lineTo(W / 2 - 250 * u, H * .42); x.arc(W / 2, H * .42, 250 * u, Math.PI, 0); x.lineTo(W / 2 + 250 * u, H * .86); x.stroke();
    x.beginPath(); x.moveTo(140 * u, H * .86); x.lineTo(W - 140 * u, H * .86); x.stroke();
    x.fillStyle = '#2b2622'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = '400 ' + 118 * u + 'px Georgia,"Times New Roman",serif'; x.fillText('VINCENT', W / 2, H * .5);
    x.font = '400 ' + 86 * u + 'px Georgia,"Times New Roman",serif'; x.fillText('JOURNAL', W / 2, H * .5 + 104 * u);
    x.fillStyle = '#8b7f72'; x.font = '600 ' + 24 * u + 'px ' + FONT_M; x.fillText('AESTHETIC  ·  CLINIC  ·  JOURNAL', W / 2, H * .5 + 172 * u);
    x.textAlign = 'left';
  }
  function drawBubble(c, q, i) {
    const x = ctxOf(c), W = c.width, H = c.height; x.clearRect(0, 0, W, H);
    const pad = 20, tailH = 36; x.fillStyle = 'rgba(10,10,11,.16)'; rrect(x, pad + 4, pad + 8, W - pad * 2, H - pad * 2 - tailH, 46); x.fill();
    x.fillStyle = '#fff'; rrect(x, pad, pad, W - pad * 2, H - pad * 2 - tailH, 46); x.fill();
    x.beginPath(); x.moveTo(W * .3, H - pad - tailH - 2); x.lineTo(W * .26, H - pad); x.lineTo(W * .4, H - pad - tailH - 2); x.closePath(); x.fill();
    x.fillStyle = i % 2 ? '#ffd84d' : '#f7c6d9'; x.beginPath(); x.arc(pad + 62, (H - tailH) / 2, 34, 0, 7); x.fill();
    x.fillStyle = '#0a0a0b'; x.font = '600 26px ' + FONT_M; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('0' + (i + 1), pad + 62, (H - tailH) / 2 + 1);
    x.textAlign = 'left'; fitFont(x, q, '700', 46, FONT_CN, W - pad * 2 - 140, 26); x.fillText(q, pad + 118, (H - tailH) / 2 + 2);
  }

  TEX.band = texFrom(mkCanvas(2048, 160)); drawBand(TEX.band.image); TEX.band.needsUpdate = true;
  TEX.logo = texFrom(mkCanvas(128, 128)); drawLogo(TEX.logo.image); TEX.logo.needsUpdate = true;
  TEX.vanSide = texFrom(mkCanvas(512, 128)); drawVanSide(TEX.vanSide.image); TEX.vanSide.needsUpdate = true;
  TEX.meeting = texFrom(mkCanvas(640, 360)); drawMeeting(TEX.meeting.image, images[0]); TEX.meeting.needsUpdate = true;
  const codeTex = [0, 1, 2].map(i => { const c = mkCanvas(256, 512); drawCode(c, 11 + i * 7); const t = texFrom(c, true); t.repeat.set(1, .32); return t; });

  buildPark(); buildOffice({ band: TEX.band, code: codeTex, meeting: TEX.meeting }); mark('office+park');

  /* ---------------- countryside: paddies around the park and in the foothills ---------------- */
  function buildFields() {
    const cols = [0xa8cf8e, 0x9cc684, 0xb7d695, 0xc9d98f, 0xd8cc7c, 0xbfd8a0, 0xc6dde0, 0x93bf7f];
    const cw = LOW ? 22 : 16, ch = LOW ? 15 : 11;
    for (let z = -470; z < 900; z += ch) for (let x = -330; x < 420; x += cw) {
      const cx = x + cw / 2, cz = z + ch / 2; if (inPark(cx, cz, 8)) continue;
      const n = nearest(cx, cz); if (n.d < HALF + 7 || n.s > S_CITY0 - 30) continue;
      const [mtn, foot] = regions(n.s); if (mtn > .55) continue;
      const y0 = groundY(x + .4, z + .4), y1 = groundY(x + cw - .4, z + ch - .4), y2 = groundY(x + cw - .4, z + .4), y3 = groundY(x + .4, z + ch - .4);
      if (Math.max(y0, y1, y2, y3) - Math.min(y0, y1, y2, y3) > 2.4 || (y0 - n.y) > 9) continue;
      if (blocked(cx, cz, 4) || Math.hypot(cx - SKY101.x, cz - SKY101.z) < 100) continue;
      fieldQuad(x + .45, z + .45, x + cw - .45, z + ch - .45, cols[(hash(Math.floor(x / cw) + 50, Math.floor(z / ch) + 70) * cols.length) | 0], .12);
      if (R() < .06) betelPalm(x + .2, z + R() * ch);
    }
    B.fields.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false);
  }

  /* Landmark on the mountain's road-facing foothill: independent, freestanding white letters. */
  const foothillLetterTextures = [];
  function drawFoothillLetter(canvas, ch) {
    const ctx = ctxOf(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '900 216px ' + FONT_CN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, canvas.width / 2, canvas.height / 2 + 6, 232);
  }
  function buildFoothillHollywoodSign() {
    // Negative side is the hillside on screen-right when driving through the mountain.
    road(S_CLIMB0 + 230);
    const side = -1, offset = 48, along = 14;
    const cx = RD.x + RD.rx * offset * side + RD.hx * along;
    const cz = RD.z + RD.rz * offset * side + RD.hz * along;
    // The surface faces the approaching driving camera, not the hillside.
    const yaw = yawOf(RD.hx, RD.hz) - 0.12;
    const glyphs = [...'欣緯軟體設計'];
    const stride = 7.15, height = 8.7, faceWidth = 6.7;
    const letterPositions = glyphs.map((ch, i) => {
      const dx = (i - (glyphs.length - 1) / 2) * stride;
      const wx = cx + Math.cos(yaw) * dx;
      const wz = cz - Math.sin(yaw) * dx;
      return { ch, dx, ground: groundY(wx, wz), wx, wz };
    });
    // Shared baseline keeps the landmark typography level across uneven polygonal terrain.
    const baseline = Math.max(...letterPositions.map(p => p.ground)) + 1.2;
    const group = new THREE.Group();
    group.name = 'SIGNWELL_FOOTHILL_HOLLYWOOD_SIGN';
    group.position.set(cx, 0, cz);
    group.rotation.y = yaw;
    const strutMat = lam(0x757a7e);
    const backMat = new THREE.MeshLambertMaterial({ color: 0xbac0c1, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide });
    for (const { ch, dx, ground, wx, wz } of letterPositions) {
      const art = mkCanvas(256, 256), tex = texFrom(art);
      drawFoothillLetter(art, ch); tex.needsUpdate = true;
      foothillLetterTextures.push({ canvas: art, char: ch, texture: tex });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(faceWidth, height), new THREE.MeshLambertMaterial({
        map: tex, alphaTest: .28, side: THREE.DoubleSide, emissive: 0x383838, emissiveMap: tex
      }));
      front.position.set(dx, baseline + height / 2, 0);
      front.castShadow = true; group.add(front);
      const backing = new THREE.Mesh(new THREE.PlaneGeometry(faceWidth, height), backMat.clone());
      backing.material.map = tex;
      backing.position.set(dx, baseline + height / 2, -0.7);
      backing.castShadow = true; group.add(backing);
      // Slim independent supports reach the faceted terrain under each letter.
      const postHeight = Math.max(2.8, baseline - ground + height * .67);
      for (const sx of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.24, postHeight, .24), strutMat);
        post.position.set(dx + sx, ground + postHeight / 2, -0.95);
        post.castShadow = true; group.add(post);
      }
      // Keep roadside vegetation from covering the lettering.
      blockers.push([wx, wz, 4.8]);
    }
    scene.add(group);
  }

  /* ---------------- mountain road: tea terraces, curve chevrons, mirrors, shrine, pavilion ---------------- */
  function buildMountain() {
    const b = B.mtn;
    ribbon(S_CLIMB0, S_MTN1 + 40, HALF + .7, HALF + .95, .78, 0xf3f3f1, 2);
    ribbon(S_CLIMB0, S_MTN1 + 40, -HALF - .95, -HALF - .7, .78, 0xf3f3f1, 2);
    ribbon(S_CLIMB0, S_MTN1 + 40, -HALF - .6, -HALF + .05, .02, 0xbfc1c3, 2);           // concrete side ditch
    const posts = new Inst(UNIT, lam(0xdedfe2), false);
    for (let s = S_CLIMB0; s < S_MTN1 + 40; s += 4) { road(s); const yaw = yawOf(RD.hx, RD.hz); [-1, 1].forEach(sd => posts.add(mtx(RD.x + RD.rx * (HALF + .82) * sd, RD.y + .4, RD.z + RD.rz * (HALF + .82) * sd, yaw, .16, .8, .16))); }
    posts.build();
    // tea terraces on the slopes: rows follow the contour lines
    const patches = [[S_CLIMB0 + 70, 1, 38], [S_CLIMB0 + 130, -1, 36], [S_CLIMB0 + 200, 1, 44], [S_CLIMB0 + 255, -1, 40], [S_CLIMB0 + 395, -1, 38], [S_CLIMB0 + 440, 1, 42]];
    const teaCols = [0x6fae5c, 0x62a253, 0x7cb866];
    for (const [s, side, off] of patches) {
      road(s); const cx = RD.x + RD.rx * off * side, cz = RD.z + RD.rz * off * side;
      if (blocked(cx, cz, 6)) continue;
      const e = 2, gx = terrainH(cx + e, cz) - terrainH(cx - e, cz), gz = terrainH(cx, cz + e) - terrainH(cx, cz - e), gl = Math.hypot(gx, gz) || 1, ux = gx / gl, uz = gz / gl, tx = -uz, tz = ux;
      blockers.push([cx, cz, 22]);
      for (let r = -7; r <= 7; r++) for (let t = -17; t <= 17; t += 1.45) {
        const px = cx + ux * r * 2.3 + tx * t + (R() - .5) * .25, pz = cz + uz * r * 2.3 + tz * t + (R() - .5) * .25;
        if (Math.hypot(px - cx, pz - cz) > 19 + vnoise(px * .2, pz * .2) * 4) continue; if (nearest(px, pz).d < HALF + 5) continue;
        teaBush.add(mtx(px, groundY(px, pz) + .25, pz, R() * 3, .95, .62, .78), teaCols[R() * 3 | 0]);
      }
      for (let k = 0; k < 6; k++) { const a = R() * 6.28, rr = 20 + R() * 4; betelPalm(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr); }
    }
    // chevron boards on the outside of curves, convex mirrors on the inside
    const cl = texFrom(mkCanvas(160, 100)); drawChevron(cl.image, 1); cl.needsUpdate = true;
    const cr = texFrom(mkCanvas(160, 100)); drawChevron(cr.image, -1); cr.needsUpdate = true;
    const chevL = new Inst(new THREE.BoxGeometry(1.7, 1.05, .08), new THREE.MeshLambertMaterial({ map: cl }), false), chevR = new Inst(new THREE.BoxGeometry(1.7, 1.05, .08), new THREE.MeshLambertMaterial({ map: cr }), false);
    const chevPost = new Inst(UNIT, lam(0x7d8186), false), mirPole = new Inst(UNIT, lam(0xe8762c)), mirDisk = new Inst((() => { const g = new THREE.CylinderGeometry(.8, .8, .12, 18); g.rotateX(Math.PI / 2); return g; })(), lam(0xe8762c)), mirFace = new Inst((() => { const g = new THREE.CircleGeometry(.68, 18); g.translate(0, 0, .07); return g; })(), new THREE.MeshLambertMaterial({ color: 0xcfe0ee, emissive: 0x405060 }), false);
    let lastMirror = -999;
    for (let s = S_CLIMB0 + 10; s < S_MTN1 + 40; s += 9) {
      road(s - 8); const a0 = Math.atan2(RD.hx, RD.hz); road(s + 8); const a1 = Math.atan2(RD.hx, RD.hz); let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) < .2) continue;
      road(s); const yaw = yawOf(RD.hx, RD.hz), turnRight = da < 0, outer = turnRight ? -1 : 1;   // da<0: turning toward +R
      const x = RD.x + RD.rx * (HALF + 1.7) * outer, z = RD.z + RD.rz * (HALF + 1.7) * outer, y = RD.y;
      if (blocked(x, z)) continue;
      chevPost.add(mtx(x, y + .8, z, yaw, .12, 1.6, .12)); (outer > 0 ? chevL : chevR).add(mtx(x, y + 1.9, z, yaw + Math.PI * 0));
      if (s - lastMirror > 60) { lastMirror = s; const ix = RD.x - RD.rx * (HALF + 1.6) * outer, iz = RD.z - RD.rz * (HALF + 1.6) * outer; mirPole.add(mtx(ix, y + 1.6, iz, yaw, .14, 3.2, .14)); mirDisk.add(mtx(ix, y + 3.5, iz, yaw)); mirFace.add(mtx(ix, y + 3.5, iz, yaw)); }
    }
    [chevL, chevR, chevPost, mirPole, mirDisk, mirFace].forEach(i => i.build());
    // 土地公廟 roadside shrine
    { road(S_CLIMB0 + 22); const side = 1, x = RD.x + RD.rx * (HALF + 4) * side, z = RD.z + RD.rz * (HALF + 4) * side, y = groundY(x, z), yaw = yawOf(RD.hx, RD.hz); blockers.push([x, z, 5]);
      shrine(b, x, y, z, yaw, .55); }
    // 涼亭 pavilion on a viewpoint
    { road(S_CLIMB0 + 300); const side = -1, x = RD.x + RD.rx * (HALF + 9) * side, z = RD.z + RD.rz * (HALF + 9) * side, y = groundY(x, z), yaw = yawOf(RD.hx, RD.hz); blockers.push([x, z, 7]);
      box(b, x, y + .2, z, 7, .4, 7, 0xd7d3cb, yaw); [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].forEach(([a, c]) => { const px = x + Math.cos(yaw) * a + Math.sin(yaw) * c, pz = z - Math.sin(yaw) * a + Math.cos(yaw) * c; b.add(new THREE.CylinderGeometry(.22, .22, 3.2, 8), mtx(px, y + 2, pz), 0xc4473a); });
      b.add(new THREE.ConeGeometry(5.6, 2.6, 4), mtx(x, y + 4.8, z, yaw + Math.PI / 4), 0x3f7a62); b.add(new THREE.ConeGeometry(.4, 1, 6), mtx(x, y + 6.4, z), 0xe6c26a); }
    buildFoothillHollywoodSign();
  }
  /* temple-style roof parts (orange glazed tiles, swallow-tail ridge) */
  function templeRoof(b, x, y, z, yaw, w, d, h, col = 0xe0782f) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1); g.rotateX(-Math.PI / 2); g.translate(0, .5, 0);
    b.add(g, mtx(x, y, z, yaw, w / 1.732 * 1.0, h / 1.5, d), col);
    box(b, x, y + h + .1, z, .35, .3, d * 1.02, col, yaw);
    [-1, 1].forEach(sd => { const ex = x + Math.sin(yaw) * sd * d / 2, ez = z + Math.cos(yaw) * sd * d / 2; b.add(new THREE.ConeGeometry(.28, 1.6, 6), mtx(ex, y + h + .7, ez, yaw, 1, 1, 1, sd * .7), col); });
    for (let k = -2; k <= 2; k++) box(b, x + Math.sin(yaw) * k * d * .16, y + h + .45, z + Math.cos(yaw) * k * d * .16, .3, .4, .5, [0x3f9a7a, 0xffd84d, 0x2f6fb8, 0xd8402f, 0x3f9a7a][k + 2], yaw);
    b.add(new THREE.SphereGeometry(.35, 10, 8), mtx(x, y + h + .75, z), 0xd8402f);
  }
  function shrine(b, x, y, z, yaw, s) {
    box(b, x, y + .3 * s, z, 4 * s, .6 * s, 4 * s, 0xb9b4aa, yaw);
    b.add(fbox(3.2 * s, 3 * s, 3 * s, [T.TEMPLE, T.SIDE, null, null, T.SIDE, T.SIDE]), mtx(x, y + 2.1 * s, z, yaw), 0xffffff);
    templeRoof(b, x, y + 3.6 * s, z, yaw, 4.2 * s, 4.4 * s, 1.6 * s);
    b.add(new THREE.CylinderGeometry(.45 * s, .35 * s, .8 * s, 10), mtx(x + Math.sin(yaw) * 2.6 * s, y + .4 * s, z + Math.cos(yaw) * 2.6 * s), 0x8a6a3a);
  }

  /* ---------------- foothills: 透天厝 rows, temple, 三合院, betel palms & bananas ---------------- */
  const TINTS = [0xffffff, 0xf4efe6, 0xf2e2dc, 0xe4ece0, 0xe6e6e2, 0xf6ecd9];
  const TIN_COLS = [0x7fae8e, 0x7d9cc4, 0xb8735a, 0xe8e8e4, 0x6fa9a3, 0x9db3cc];
  const acUnits = new Inst(UNIT, lam(0xf1f1ef)), tanks = new Inst((() => { const g = new THREE.CylinderGeometry(.85, .85, 1.7, 12); g.translate(0, .85, 0); return g; })(), lam(0xcfd5da));
  const solarHeater = new Inst(UNIT, lam(0x2c3f63), false);
  // a 透天厝 unit: local +x is the street face. baseY = ground at the front
  function townhouse(b, x, z, yaw, baseY, w, d, floors, opts = {}) {
    const tint = opts.tint ?? TINTS[R() * TINTS.length | 0], c = Math.cos(yaw), sn = Math.sin(yaw);
    const L2W = (lx, lz) => [x + c * lx + sn * lz, z - sn * lx + c * lz];
    box(b, x, baseY - 1.6, z, d, 3.4, w, 0xbdb8ae, yaw);                                    // footing for slopes
    b.add(fbox(d, 3.6, w, [T.TH_G, T.SIDE, null, null, T.SIDE, T.SIDE]), mtx(x, baseY + 1.8, z, yaw), tint, null, [baseY, 3]);
    const uh = (floors - 1) * 3.2; b.add(fbox(d, uh, w, [T.TH_U, T.SIDE, null, null, T.SIDE, T.SIDE], FUV, BAY, 3.2), mtx(x, baseY + 3.6 + uh / 2, z, yaw), tint);
    for (let f = 0; f < floors - 1; f++) { const [bx, bz] = L2W(d / 2 + .3, 0); box(b, bx, baseY + 3.6 + f * 3.2, bz, .6, .16, w, 0xe9e5dc, yaw); if (R() < .5) { const [ax, az] = L2W(d / 2 + .3, (R() < .5 ? -1 : 1) * (w / 2 - .7)); acUnits.add(mtx(ax, baseY + 4.6 + f * 3.2, az, yaw, .55, .62, 1)); } }
    const top = baseY + 3.6 + uh;
    box(b, x, top + .12, z, d, .24, w, 0xd9d6cf, yaw);
    if (opts.roof !== false && R() < .7) { const rc = TIN_COLS[R() * TIN_COLS.length | 0], rd = d * (.55 + R() * .25), [rx, rz] = L2W(-d / 2 + rd / 2 + .2, 0);
      b.add(fbox(rd, 2.5, w - .3, [T.TIN, T.TIN, T.TIN, null, T.TIN, T.TIN], FUV, 2.4, 2.5), mtx(rx, top + 1.25, rz, yaw), rc); box(b, rx, top + 2.6, rz, rd + .4, .14, w, rc, yaw, T.TIN, null); }
    if (R() < .75) { const [tx, tz] = L2W(d / 2 - 1.6, (R() - .5) * (w - 2)); tanks.add(mtx(tx, top + .25, tz, 0, .8, .8, .8)); }
    if (R() < .3) { const [sx, sz] = L2W(d / 2 - 3.6, 0); solarHeater.add(mtx(sx, top + 1, sz, yaw, 1.8, .1, w * .7, 0, .5)); }
    return top;
  }
  const bubbles = [], voices = [];
  function buildFoothills() {
    const b = B.foot;
    // houses facing the road: rotate so local +x looks at the road
    const faceYaw = (side) => { const t = yawOf(RD.hx, RD.hz); return side > 0 ? t : t + Math.PI; };
    const row = (s, side, off, n, floors) => { let ss = s; for (let k = 0; k < n; k++) { road(ss); const yaw = faceYaw(side), w = 4.6, d = 11, cx = RD.x + RD.rx * (off + d / 2) * side, cz = RD.z + RD.rz * (off + d / 2) * side; if (blocked(cx, cz, 1.5)) { ss += w; continue; } const fx = RD.x + RD.rx * off * side, fz = RD.z + RD.rz * off * side; const by = Math.min(groundY(fx, fz), groundY(cx, cz)) + .02; townhouse(b, cx, cz, yaw, by, w, d, floors + (R() < .35 ? 1 : 0)); blockers.push([cx, cz, 6]); if (R() < .5) parkedScooter(fx - RD.rx * side * 1.2 + RD.hx * (R() - .5) * 2, fz - RD.rz * side * 1.2 + RD.hz * (R() - .5) * 2, by, faceYaw(side) + (R() - .5) * .4); ss += w; } };
    // the five homes with someone outside asking a question
    const folks = [];
    VOICE_SPOTS.forEach(([ds, side, off], i) => {
      const s = S_RES + ds; road(s); const yaw = faceYaw(side), w = 5, d = 11;
      const hx = RD.x + RD.rx * (off + 2.5 + d / 2) * side, hz = RD.z + RD.rz * (off + 2.5 + d / 2) * side, hy = groundY(hx, hz);
      townhouse(b, hx, hz, yaw, hy, w, d, 3, { tint: [0xf2e2dc, 0xf6ecd9, 0xe4ece0, 0xffffff, 0xf2e2dc][i] }); blockers.push([hx, hz, 7]);
      road(s); const px = RD.x + RD.rx * off * side, pz = RD.z + RD.rz * off * side, py = groundY(px, pz);
      folks.push({ x: px, y: py, z: pz, ry: yaw + Math.PI / 2, shirt: [C.blue, C.yellow, C.ink, C.pinkDeep, 0x8fa8ff][i], skin: [0xf1d5c2, 0xe7c1a6, 0xd6a583, 0xf3dccd, 0xe7c1a6][i], hair: 0x2b2b2b, ph: i * 1.3, sit: false, wave: i === 2 });
      const c = mkCanvas(SMALL ? 768 : 900, SMALL ? 230 : 270); drawBubble(c, QUESTIONS[i].q, i);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texFrom(c), toneMapped: false, transparent: true, depthWrite: false }));
      const bw = SMALL ? 9 : 10, bh = bw * c.height / c.width; sp.scale.set(bw, bh, 1); sp.center.set(.28, 0);
      sp.position.set(px, py + 3.2, pz); sp.userData.base = sp.position.clone(); sp.userData.w = bw; sp.userData.h = bh; sp.renderOrder = 5; scene.add(sp);
      voices.push({ x: px, y: py, z: pz, sprite: sp, s, i, pop: 0 });
    });
    buildPeople(folks, 'foot');
    // rows of 透天厝 along both sides
    for (let s = S_RES - 160; s < S_RES + 70; s += 26 + R() * 14) for (const side of [-1, 1]) { if (R() < .2) continue; row(s + R() * 6, side, 13 + R() * 4, 3 + (R() * 3 | 0), 3); if (R() < .6) row(s + 3, side, 30 + R() * 8, 2 + (R() * 3 | 0), 3); }
    // temple (廟)
    { const { x, z, yaw } = TEMPLE, y = groundY(x, z) + .2;
      box(b, x, y + .3, z, 16, .6, 12, 0xbdb7ab, yaw);
      b.add(fbox(9, 4.6, 13, [T.TEMPLE, T.SIDE, null, null, T.SIDE, T.SIDE], FUV, 4.4, 4.6), mtx(x, y + 2.9, z, yaw), 0xffffff);
      templeRoof(b, x, y + 5.2, z, yaw, 11.5, 15, 3.2);
      templeRoof(b, x + Math.cos(yaw) * 5.6, y + 3.8, z - Math.sin(yaw) * 5.6, yaw, 3.6, 15.5, 1.4);
      [-5, -1.7, 1.7, 5].forEach(k => { const px = x + Math.cos(yaw) * 5.8 + Math.sin(yaw) * k, pz = z - Math.sin(yaw) * 5.8 + Math.cos(yaw) * k; b.add(new THREE.CylinderGeometry(.32, .32, 3.8, 10), mtx(px, y + 2.5, pz), 0xc4473a); });
      const bx = x + Math.cos(yaw) * 10, bz = z - Math.sin(yaw) * 10; b.add(new THREE.CylinderGeometry(.9, .7, 1.4, 12), mtx(bx, y + .9, bz), 0x8a6a3a); b.add(new THREE.ConeGeometry(1.1, 1, 12), mtx(bx, y + 2.1, bz), 0x8a6a3a);
      const lantern = new THREE.MeshLambertMaterial({ color: 0xd8312a, emissive: 0x5a0a05 }); [-3.4, 3.4].forEach(k => { const l = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 10), lantern); l.scale.y = 1.25; l.position.set(x + Math.cos(yaw) * 6 + Math.sin(yaw) * k, y + 4.2, z - Math.sin(yaw) * 6 + Math.cos(yaw) * k); scene.add(l); });
    }
    // 三合院 courtyard house in red brick
    { const { x, z, yaw } = SANHE, y = groundY(x, z) + .1, c = Math.cos(yaw), sn = Math.sin(yaw), P = (lx, lz) => [x + c * lx + sn * lz, z - sn * lx + c * lz];
      box(b, x, y + .05, z, 22, .1, 20, 0xe2d8c4, yaw);
      const hall = P(-7, 0); b.add(fbox(6, 3.8, 18, [T.BRICK, T.BRICK, null, null, T.BRICK, T.BRICK], FUV, 3, 3), mtx(hall[0], y + 1.9, hall[1], yaw), 0xffffff); templeRoof(b, hall[0], y + 3.8, hall[1], yaw, 7.4, 19, 2, 0xc8553d);
      [-1, 1].forEach(sd => { const p = P(1.5, sd * 7); b.add(fbox(11, 3.2, 4.6, [T.BRICK, T.BRICK, null, null, T.BRICK, T.BRICK], FUV, 3, 3), mtx(p[0], y + 1.6, p[1], yaw), 0xffffff); templeRoof(b, p[0], y + 3.2, p[1], yaw + Math.PI / 2, 5.8, 12, 1.6, 0xc8553d); });
    }
    // betel palms and bananas around the homes
    for (let k = 0; k < 120; k++) { const s = S_MTN1 - 40 + R() * (S_CITY0 - S_MTN1 + 10), side = R() < .5 ? -1 : 1; road(s); const off = 12 + R() * 70, x = RD.x + RD.rx * off * side, z = RD.z + RD.rz * off * side; if (blocked(x, z, 2) || nearest(x, z).d < HALF + 4) continue; (R() < .7 ? betelPalm : banana)(x, z); }
  }
  const scooterBody = new Inst((() => mergeSimple([[new THREE.BoxGeometry(.66, .5, 1.95), mtx(0, .62, -.05)], [new THREE.BoxGeometry(.64, .95, .4), mtx(0, 1.05, .8)], [new THREE.BoxGeometry(.5, .5, .7), mtx(0, .95, -.55)]]))(), instVC);
  const scooterDark = new Inst((() => mergeSimple([[new THREE.BoxGeometry(.54, .2, .95), mtx(0, 1.23, -.35), 0x1b1b1e], [(() => { const g = new THREE.CylinderGeometry(.3, .3, .2, 10); g.rotateZ(Math.PI / 2); return g; })(), mtx(0, .3, .82), 0x17181b], [(() => { const g = new THREE.CylinderGeometry(.3, .3, .2, 10); g.rotateZ(Math.PI / 2); return g; })(), mtx(0, .3, -.82), 0x17181b], [new THREE.BoxGeometry(.95, .07, .07), mtx(0, 1.62, .85), 0x2a2a2a]]))(), instVC);
  const SCOOTER_COLS = [0xe8e8e6, 0x1c1c1e, 0x9a2a2a, 0x2a4a7a, 0x6a6e70, 0xc8b48a, 0x3a6a4a, 0xf2c230, 0x8fb8d8];
  function parkedScooter(x, z, y, yaw) { scooterBody.add(mtx(x, y, z, yaw), SCOOTER_COLS[R() * SCOOTER_COLS.length | 0]); scooterDark.add(mtx(x, y, z, yaw), 0xffffff); }

  /* ---------------- the city: 騎樓, 鐵窗, vertical signs, 頂樓加蓋, water tanks, scooters ---------------- */
  const CROSS = [sAtZ(870), sAtZ(995), sAtZ(1120), sAtZ(1245)];
  const MRT_Z = 852;
  function cityBuilding(b, side, sMid, lot, front, depth, floors, arcade) {
    road(sMid); const yaw = yawOf(RD.hx, RD.hz) + (side > 0 ? 0 : Math.PI);
    const cx = RD.x + RD.rx * (front + depth / 2) * side, cz = RD.z + RD.rz * (front + depth / 2) * side, c = Math.cos(yaw), sn = Math.sin(yaw);
    const L2W = (lx, lz) => [cx + c * lx + sn * lz, cz - sn * lx + c * lz];
    const tint = TINTS[R() * TINTS.length | 0], up = [T.TILE, T.WHITE, T.OLD, T.TILE, T.WHITE, T.GLASS][R() * 6 | 0];
    const GF = 4.2, ARC = 2.8, bays = Math.max(1, Math.round(lot / BAY)), uh = floors * FL;
    if (arcade) {
      const shop = [T.SHOP, T.SHUTTER, T.FOOD, T.SHOP, T.CONV, T.FOOD, T.SHUTTER][R() * 7 | 0];
      const [gx, gz] = L2W(-ARC / 2, 0); b.add(fbox(depth - ARC, GF, lot, [shop, T.SIDE, null, null, T.SIDE, T.SIDE], FUV, BAY, GF), mtx(gx, GF / 2, gz, yaw), 0xffffff, null, [0, 2]);
      for (let k = 0; k <= bays; k++) { const [px, pz] = L2W(depth / 2 - .45, -lot / 2 + k * lot / bays); box(b, px, GF / 2, pz, .75, GF, .75, tint, yaw, T.PLAIN, [0, 2.5]); }
      for (let k = 0; k < bays; k++) { const [sx, sz] = L2W(depth / 2 + .08, -lot / 2 + (k + .5) * lot / bays); SB.add(fbox(.16, .95, lot / bays - .5, [SUV_H[(R() * 16) | 0], null, null, null, null, null], SUV_V), mtx(sx, GF - .62, sz, yaw), 0xffffff); }
    } else {
      b.add(fbox(depth, GF, lot, [T.SHUTTER, T.SIDE, null, null, T.SIDE, T.SIDE], FUV, BAY, GF), mtx(cx, GF / 2, cz, yaw), 0xffffff, null, [0, 2]);
    }
    b.add(fbox(depth, uh, lot, [up, T.SIDE, null, null, T.SIDE, T.SIDE]), mtx(cx, GF + uh / 2, cz, yaw), up === T.GLASS ? 0xffffff : tint);
    const top = GF + uh; box(b, cx, top + .15, cz, depth + .1, .3, lot + .1, 0xd6d3cc, yaw);
    // vertical signs sticking out of the façade (seen edge-on along the street)
    if (arcade) { const n = R() * 3.2 | 0; for (let k = 0; k < n; k++) { const z = -lot / 2 + (1 + (R() * (bays - 1) | 0)) * lot / bays, hh = 3.4 + R() * 3, y = GF + 1.2 + hh / 2 + R() * Math.max(0, uh - hh - 3); if (y + hh / 2 > top) continue; const [sx, sz] = L2W(depth / 2 + .7, z), t = SUV_V[(R() * 32) | 0];
      SB.add(fbox(1.15, hh, .28, [null, null, null, null, t, t], SUV_V), mtx(sx, y, sz, yaw), 0xffffff); } }
    // AC units on the façade
    if (up !== T.GLASS) for (let f = 0; f < floors; f++) for (let k = 0; k < bays; k++) if (R() < .32) { const [ax, az] = L2W(depth / 2 + .32, -lot / 2 + (k + .5) * lot / bays + (R() < .5 ? -1.3 : 1.3)); acUnits.add(mtx(ax, GF + f * FL + .7, az, yaw, .6, .62, 1.05)); }
    // rooftop: 頂樓加蓋, water tanks
    if (R() < .55) { const rc = TIN_COLS[R() * TIN_COLS.length | 0], rd = depth * (.5 + R() * .3), rl = lot * (.5 + R() * .4), [rx, rz] = L2W(-depth / 2 + rd / 2 + .3, (R() - .5) * (lot - rl));
      b.add(fbox(rd, 2.6, rl, [T.TIN, T.TIN, T.TIN, null, T.TIN, T.TIN], FUV, 2.4, 2.6), mtx(rx, top + 1.6, rz, yaw), rc); box(b, rx, top + 2.98, rz, rd + .5, .16, rl + .4, rc, yaw, T.TIN); }
    const nt = 1 + (R() * 2 | 0); for (let k = 0; k < nt; k++) { const [tx, tz] = L2W(depth / 2 - 2 - R() * 3, (R() - .5) * (lot - 3)); tanks.add(mtx(tx, top + .3, tz, 0, .9, .9, .9)); box(b, tx, top + .15, tz, 1.8, .3, 1.8, 0x9aa0a6); }
    return { cx, cz, top };
  }
  function buildCity() {
    const b = B.city, b2 = B.city2;
    const S0 = S_CITY0 - 20, S1 = L, nearCross = (s, pad) => CROSS.some(c => Math.abs(s - c) < pad), nearMRT = (s, half = 0) => { road(s); return Math.abs(RD.z - MRT_Z) < 9 + half; }, nearWork = (s, half) => S_WORK.some(w => Math.abs(s - w) < 13 + half);
    for (const side of [-1, 1]) {
      let s = S0 + R() * 4;
      while (s < S1 - 4) { const bays = 2 + (R() * 3 | 0), lot = bays * BAY, mid = s + lot / 2; if (nearCross(mid, 8 + lot / 2) || nearMRT(mid, lot / 2) || nearWork(mid, lot / 2)) { s += 2; continue; }
        cityBuilding(b, side, mid, lot, 17, 12 + R() * 6, 3 + (R() * 6 | 0), true); s += lot + (R() < .15 ? 1.5 : .1); }
      s = S0 + R() * 6;
      while (s < S1 - 4) { const lot = 12 + R() * 10, mid = s + lot / 2; if (nearCross(mid, 6 + lot / 2) || nearMRT(mid, lot / 2)) { s += 2; continue; }
        cityBuilding(b2, side, mid, lot, 36 + R() * 3, 14 + R() * 10, 6 + (R() * 9 | 0), false); s += lot + 1; }
      s = S0 + R() * 8;
      while (s < S1 - 4) { const lot = 16 + R() * 12, mid = s + lot / 2; if (nearMRT(mid, lot / 2)) { s += 2; continue; } cityBuilding(b2, side, mid, lot, 64 + R() * 6, 18 + R() * 10, 9 + (R() * 14 | 0), false); s += lot + 3; }
    }
    // sidewalk, frontage plaza, side streets, crosswalks
    ribbon(S_CITY0 - 26, L, HALF, HALF + 4.4, .2, 0xf2f1ed, 2); ribbon(S_CITY0 - 26, L, -HALF - 4.4, -HALF, .2, 0xf2f1ed, 2);
    ribbon(S_CITY0 - 26, L, HALF + 4.4, HALF + 12.2, .16, 0xe5e1d8, 2); ribbon(S_CITY0 - 26, L, -HALF - 12.2, -HALF - 4.4, .16, 0xe5e1d8, 2);
    const stripes = new Inst(UNIT, lam(0xffffff), false);
    CROSS.forEach(cs => { road(cs); street(RD.x, RD.z, yawOf(RD.hx, RD.hz) + Math.PI / 2, 260);
      for (const k of [-1, 1]) { road(cs + k * 8.5); for (let q = -4; q <= 4; q++) stripes.add(mtx(RD.x + RD.rx * q * 1.05, RD.y + .09, RD.z + RD.rz * q * 1.05, yawOf(RD.hx, RD.hz), .55, .04, 3.2)); } });
    stripes.build();
    // traffic lights at crossings (pole, arm over the road, signal head)
    const sig = new Inst(UNIT, lam(0x55585e)), lights = new Inst(UNIT, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), false);
    CROSS.forEach(cs => [-1, 1].forEach(sd => { road(cs + sd * 11); const yaw = yawOf(RD.hx, RD.hz), x = RD.x + RD.rx * (HALF + 1.2) * sd, z = RD.z + RD.rz * (HALF + 1.2) * sd;
      sig.add(mtx(x, 3.6, z, yaw, .32, 7.2, .32)); sig.add(mtx(x - RD.rx * sd * 3, 7.1, z - RD.rz * sd * 3, yaw + Math.PI / 2, 6, .2, .2)); const hx = x - RD.rx * sd * 4.6, hz = z - RD.rz * sd * 4.6; sig.add(mtx(hx, 6.7, hz, yaw, 1.6, .55, .45));
      [[-.5, 0x6a2a2a], [0, 0x6a5a2a], [.5, 0x55ff88]].forEach(([o, col]) => lights.add(mtx(hx + Math.cos(yaw) * o + Math.sin(yaw) * .25, 6.7, hz - Math.sin(yaw) * o + Math.cos(yaw) * .25, yaw, .34, .34, .06), col)); }));
    sig.build(); lights.build();
    // parked scooters along the frontage, street trees (台灣欒樹 in October yellow)
    for (const side of [-1, 1]) for (let s = S_CITY0; s < L - 4; s += 2.2) {
      if (nearCross(s, 10) || nearMRT(s) || S_WORK.some(w => Math.abs(s - w) < 10)) continue;
      road(s); if (R() < .72) { const off = HALF + 10.5 + R() * .8, yaw = yawOf(RD.hx, RD.hz) + (side > 0 ? -1.35 : 1.35) + (R() - .5) * .25; parkedScooter(RD.x + RD.rx * off * side, RD.z + RD.rz * off * side, .18, yaw); }
    }
    for (let s = S_CITY0 + 6; s < L; s += 17) for (const side of [-1, 1]) { if (nearCross(s, 10) || nearMRT(s) || S_WORK.some(w => Math.abs(s - w) < 11)) continue; road(s); addTree(RD.x + RD.rx * (HALF + 3) * side, RD.z + RD.rz * (HALF + 3) * side, .62 + R() * .15, 2, [0xd9b44a, 0xc9a23a, 0xb8733f, 0x8fb06a][R() * 4 | 0]); }
    // street lights
    const poles = new Inst(UNIT, lam(0x8b8e95)), lamps = new Inst(UNIT, new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), false);
    for (let s = S_CITY0; s < L; s += 26) for (const side of [-1, 1]) { if (nearCross(s, 10) || nearMRT(s) || nearWork(s, -1)) continue; road(s); const yaw = yawOf(RD.hx, RD.hz), x = RD.x + RD.rx * (HALF + 1) * side, z = RD.z + RD.rz * (HALF + 1) * side;
      poles.add(mtx(x, 3.6, z, yaw, .32, 7.2, .32)); poles.add(mtx(x - RD.rx * side * 1.05, 7.12, z - RD.rz * side * 1.05, yaw + Math.PI / 2, 2.2, .16, .16)); lamps.add(mtx(x - RD.rx * side * 2, 6.98, z - RD.rz * side * 2, yaw, .55, .14, .34)); }
    poles.build(); lamps.build();
    S_WORK.forEach((ws, i) => { const side = i % 2 === 0 ? 1 : -1; road(ws); const yaw = yawOf(RD.hx, RD.hz), px = RD.x + RD.rx * 26 * side, pz = RD.z + RD.rz * 26 * side;
      box(b, px, .1, pz, 20, .2, 24, 0xe9e6df, yaw); [-7, 7].forEach(k => addTree(px + RD.hx * k - RD.rx * side * 4, pz + RD.hz * k - RD.rz * side * 4, .7, 1));
      box(b, px - RD.rx * side * 6, .5, pz - RD.rz * side * 6, 1.2, .5, 5, C.oak, yaw); });
    // elevated MRT across the boulevard at the city gate
    { const y = 11.5; box(b, 60, y, MRT_Z, 620, 2.2, 7.2, 0xd9d8d4); box(b, 60, y + 1.4, MRT_Z - 3.4, 620, .8, .3, 0xe8e7e3); box(b, 60, y + 1.4, MRT_Z + 3.4, 620, .8, .3, 0xe8e7e3);
      for (let x = -250; x <= 370; x += 34) { if (Math.abs(x - 60) < 12) continue; box(b, x, (y - 1.1) / 2, MRT_Z, 2.2, y - 1.1, 2.4, 0xcfcdc8, 0, T.PLAIN, [0, 3]); }
      [-1, 1].forEach(sd => box(b, 60 + sd * 10.5, (y - 1.1) / 2, MRT_Z, 2.2, y - 1.1, 2.4, 0xcfcdc8, 0, T.PLAIN, [0, 3])); }
    // Xinyi skyline: a low-poly Taipei 101 and neighbours, seen over the roofs
    { const b3 = B.city2, X = SKY101.x, Z = SKY101.z, glass = 0x6f9f98, glass2 = 0x7fab9f, frame = 0xa9b6b4;
      box(b3, X, 4, Z, 30, 8, 24, 0x7f8f90);
      const sq = (rTop, rBot, h) => { const g = new THREE.CylinderGeometry(rTop, rBot, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); return g; };
      let y = 8; b3.add(sq(9.5, 12, 34), mtx(X, y, Z), glass); y += 34;
      for (let i = 0; i < 8; i++) { b3.add(sq(11.4, 8.8, 10.5), mtx(X, y, Z), i % 2 ? glass : glass2); b3.add(sq(10.6, 11.4, .5), mtx(X, y + 10.5, Z), frame); y += 11; }
      b3.add(sq(6.6, 7.6, 6), mtx(X, y, Z), glass); y += 6; b3.add(sq(4.2, 5, 5), mtx(X, y, Z), frame); y += 5;
      b3.add(new THREE.CylinderGeometry(.5, 1.2, 22, 8), mtx(X, y + 11, Z), 0xc8d0d0);
      [[-34, 18, 62, 14, 12], [30, -16, 74, 16, 16], [-30, -26, 48, 18, 14], [40, 22, 40, 14, 20]].forEach(([dx, dz, h, w, d]) => b3.add(fbox(w, h, d, [T.GLASS, T.GLASS, null, null, T.GLASS, T.GLASS]), mtx(X + dx, h / 2, Z + dz), 0xe9f0f2));
    }
  }

  /* city work billboards: one by one, alternating sides */
  const WORK_W = 15.6, WORK_H = 9.75;
  const workSigns = [];
  function buildWorkSigns() {
    WORKS.forEach((wk, i) => {
      const s = S_WORK[i]; road(s); const side = i % 2 === 0 ? 1 : -1;   // first one on screen-left
      const c = mkCanvas(SIGN_W, SIGN_H); drawWork(c, wk, images[i]); const tex = texFrom(c);
      const sg = makeBillboard(WORK_W, WORK_H, tex, { postH: 6.5 });
      const dev = 24 * Math.PI / 180, toC = -side;
      const nx = RD.hx * Math.cos(dev) + RD.rx * Math.sin(dev) * toC, nz = RD.hz * Math.cos(dev) + RD.rz * Math.sin(dev) * toC;
      const off = 11.2, x = RD.x + RD.rx * off * side, z = RD.z + RD.rz * off * side, y = RD.y + 6.5 + WORK_H / 2;
      standSign(sg, x, y, z, nx, nz);
      Object.assign(sg, { kind: 'work', i, tex, canvas: c, center: new THREE.Vector3(x, y, z), url: wk.url, side });
      workSigns.push(sg); signs.push(sg);
    });
  }
  /* manager billboards — planes at 45° and 125° to the road axis, both facing the viewer */
  const mgrSigns = [];
  function buildMgrSigns() {
    MGR_DEFS.forEach((d, i) => {
      const c = mkCanvas(SIGN_W, SIGN_H); drawManager(c, MANAGERS[i], i); const tex = texFrom(c);
      const sg = makeBillboard(MGR_W, MGR_H, tex, { postH: 5 });
      standSign(sg, d.x, d.y, d.z, d.nx, d.nz);
      Object.assign(sg, { kind: 'mgr', i, tex, canvas: c, center: new THREE.Vector3(d.x, d.y, d.z), normal: new THREE.Vector3(d.nx, 0, d.nz) }); mgrSigns.push(sg); signs.push(sg);
    });
  }

  buildMgrSigns(); buildFoothills(); buildCity(); buildWorkSigns(); mark('foothills+city');
  {
    const shirts = [C.blue, C.yellow, C.pink, C.ink, C.paper, 0x8fa8ff, C.pinkDeep, 0x9aa0a8, 0x3a8a5a, 0xd8402f], skins = [0xf1d5c2, 0xe7c1a6, 0xd6a583, 0xf3dccd], hairs = [0x1a1a1a, 0x3b2a1f, 0x2b2b2b];
    const person = (o) => Object.assign({ sit: false, shirt: shirts[R() * shirts.length | 0], skin: skins[R() * 4 | 0], hair: hairs[R() * 3 | 0], ph: R() * 6.28 }, o);
    // park: people walking along the sidewalks, two chatting at the guard house
    const park = [];
    for (let i = 0; i < 12; i++) { const z = i % 2 ? -5.3 : 7.3, a = -150 + R() * 230, len = 24 + R() * 40; if (Math.abs(a) < 10 || Math.abs(a + len) < 10) continue; park.push(person({ path: [a, .24, z, a + len, .24, z] })); }
    park.push(person({ x: -24, z: 18.5, y: .2, ry: Math.PI }), person({ x: -28, z: 18.2, y: .2, ry: Math.PI * .8, wave: true }));
    buildPeople(park, 'park');
    // city: arcade and sidewalk walkers, some standing at the shops
    const city = [];
    for (const side of [-1, 1]) for (let s = S_CITY0 + 10; s < L - 40; s += 10 + R() * 12) {
      if (CROSS.some(c => Math.abs(s - c) < 10)) continue;
      const arcade = R() < .5, off = arcade ? 18.4 + R() * .6 : HALF + 2.2 + R() * 1.6;
      if (!arcade && S_WORK.some(w => Math.abs(s - w) < 9)) continue;
      road(s); const ax = RD.x + RD.rx * off * side, az = RD.z + RD.rz * off * side;
      if (R() < .7) { const len = 14 + R() * 20, e = s + len; if (CROSS.some(c => e > c - 10 && s < c + 10)) continue; road(e); city.push(person({ path: [ax, .2, az, RD.x + RD.rx * off * side, .2, RD.z + RD.rz * off * side] })); }
      else city.push(person({ x: ax, z: az, y: .2, ry: yawOf(RD.hx, RD.hz) + (R() < .5 ? 0 : Math.PI) }));
    }
    buildPeople(city, 'city');
    // foothills: a few neighbours walking along the road shoulder
    const foot = [];
    [[-120, 1], [-80, -1], [-20, -1], [10, 1]].forEach(([ds, side]) => { road(S_RES + ds); const off = HALF + 1.6, ax = RD.x + RD.rx * off * side, az = RD.z + RD.rz * off * side, ay = RD.y + .1; road(S_RES + ds + 22); foot.push(person({ path: [ax, ay, az, RD.x + RD.rx * off * side, RD.y + .1, RD.z + RD.rz * off * side], speed: 1.3 })); });
    buildPeople(foot, 'foot');
  }
  buildMountain(); mark('mountain');
  // trees around the park edge & scattered forest
  for (let i = 0; i < 60; i++) { const x = PARK.x0 + R() * (PARK.x1 - PARK.x0), z = PARK.z0 + R() * 20; if (!blocked(x, z, 3)) addTree(x, z, .8 + R() * .5); }
  {
    const want = LOW ? 900 : 1800; let tries = 0, count = 0;
    while (count < want && tries < want * 14) {
      tries++;
      const s = R() * (S_CITY0 + 40), side = R() < .5 ? -1 : 1, off = HALF + 4 + Math.pow(R(), 1.6) * 150;
      road(s); const x = RD.x + RD.rx * off * side + (R() - .5) * 8, z = RD.z + RD.rz * off * side + (R() - .5) * 8;
      if (inPark(x, z, 6)) continue; const n = nearest(x, z); if (n.d < HALF + 3.6) continue;
      const [mtn, foot] = regions(n.s); const dens = .05 + mtn * .9 + foot * .3;
      if (R() > dens || n.s > S_CITY0 - 10 || blocked(x, z)) continue;
      addTree(x, z, .75 + R() * .7); count++;
    }
  }
  buildFields(); mark('fields');
  [trees, trunks, royalTrunk, royalShaft, royalCrown, betelTrunk, betelCrown, bananaTrunk, bananaCrown, teaBush, acUnits, tanks, solarHeater, scooterBody, scooterDark].forEach(i => i.build());
  B.park.mesh(facadeMat); B.office.mesh(facadeMat); B.mtn.mesh(facadeMat); B.foot.mesh(facadeMat); B.city.mesh(facadeMat); B.city2.mesh(facadeMat); SB.mesh(signMat, false);
  mark('batches');

  /* vehicles: our van + opposite-lane traffic (cars, taxis, scooters, a bus, the garbage truck) */
  const van = makeVehicle('van', C.ink, C.yellow); scene.add(van);
  const traffic = [];
  const tcols = [[0xffffff, 'car'], [C.yellow, 'taxi'], [0x2a4a7a, 'scooter'], [C.blue, 'car'], [0xe9eaec, 'scooter'], [C.pinkDeep, 'car'], [0x2f8a5a, 'bus', 0xffffff], [C.yellow, 'taxi'], [0x9a2a2a, 'scooter'], [0xf2c230, 'garbage', 0x2a2b30], [0x2a2b30, 'car'], [0x6a6e70, 'scooter']];
  for (let i = 0; i < (LOW ? 8 : tcols.length); i++) { const [col, k, acc] = tcols[i]; const car = makeVehicle(k, col, acc == null ? (k === 'scooter' ? [C.blue, C.ink, C.pink, 0x8fa8ff][i % 4] : col) : acc); scene.add(car); traffic.push({ obj: car, s: 40 + i * 31, v: k === 'scooter' ? 12 + R() * 4 : k === 'bus' || k === 'garbage' ? 8 : 10 + R() * 4, lane: k === 'scooter' ? -LANE - 1 : -LANE }); }
  const train = new THREE.Group(); { for (let k = 0; k < 4; k++) { const car = new THREE.Mesh(new THREE.BoxGeometry(15, 3.2, 3), lam(0xf4f5f5)); car.position.x = k * 15.6; car.castShadow = true; train.add(car); const st = new THREE.Mesh(new THREE.BoxGeometry(15.02, .45, 3.04), lam(0x2f6fb8)); st.position.set(k * 15.6, -.4, 0); train.add(st); const win = new THREE.Mesh(new THREE.BoxGeometry(13.6, .9, 3.06), lam(0x2b3446)); win.position.set(k * 15.6, .55, 0); train.add(win); } train.position.set(-200, 14.7, MRT_Z); scene.add(train); }

  /* ================================================================ camera, stops & scroll track */
  // 01 office · 02 林哲愷 → 林哲緯 · 03 customers · 04 seven works
  const STOPS = [
    { id: 'office', ch: 0, dwell: .55, travel: 1.45 },
    { id: 'kai', ch: 1, dwell: .75, travel: .8, noCard: true, mgr: 0 },
    { id: 'wei', ch: 1, dwell: .75, travel: 1.1, noCard: true, mgr: 1 },
    { id: 'customers', ch: 2, dwell: .95, travel: 1.15 },
    ...WORKS.map((w, i) => ({ id: w.stop, ch: 3, dwell: .55, travel: i < 6 ? .55 : .5, work: i }))
  ];
  const IX = { office: 0, kai: 1, wei: 2, cust: 3, work0: 4 };
  const cardById = {}; cards.forEach(c => { cardById[c.dataset.stop] = c; });
  STOPS.forEach(st => { st.cardEl = cardById[st.id] || cardById.managers; st.card = st.noCard ? null : cardById[st.id]; });
  const camA = { a: 13, lh: 1.6 };
  let W = 1, H = 1, lensX = 0, lensY = 0, baseFov = 40;
  function computeStops() {
    const portrait = W / H < .9;
    camA.a = portrait ? 15 : 24;
    const dWork = portrait ? 26 : 33, dMgr = portrait ? 31 : 38, dRes = portrait ? 42 : 54;
    STOPS[IX.office].s = 4;
    STOPS[IX.kai].s = S_MGR_K + dMgr - camA.a; STOPS[IX.wei].s = S_MGR_W + dMgr - camA.a;
    STOPS[IX.cust].s = S_RES - 30 + dRes - camA.a;
    WORKS.forEach((w, i) => { STOPS[IX.work0 + i].s = S_WORK[i] + dWork - camA.a; });
    STOPS.forEach(st => { st.focus = null; st.fw = 0; });
    STOPS[IX.office].focus = new THREE.Vector3(OFFICE.x + (portrait ? -4 : -2), portrait ? 2 : 8, OFFICE.z + (portrait ? 2 : -22)); STOPS[IX.office].fw = 1;
    mgrSigns.forEach((sg, i) => { const st = STOPS[IX.kai + i]; st.focus = sg.center.clone().add(new THREE.Vector3(0, -.5, 0)); st.fw = portrait ? .94 : .88; });
    const vc = voices.reduce((a, v) => a.add(new THREE.Vector3(v.x, v.y + 4, v.z)), new THREE.Vector3()).multiplyScalar(1 / voices.length);
    STOPS[IX.cust].focus = vc; STOPS[IX.cust].fw = portrait ? .8 : .7;
    WORKS.forEach((w, i) => { const st = STOPS[IX.work0 + i]; st.focus = workSigns[i].center; st.fw = portrait ? .92 : .82; });
  }

  // scroll track (in viewport heights)
  let segs = [], trackVH = 0, vhPx = innerHeight, driveTop = 0, statusDocTop = 0;
  function layoutTrack() {
    segs = []; let y = 0;
    STOPS.forEach((st, i) => {
      segs.push({ type: 'dwell', k: i, y0: y, y1: y + st.dwell }); st.y0 = y; st.y1 = y + st.dwell; y += st.dwell;
      segs.push({ type: i < STOPS.length - 1 ? 'travel' : 'tail', k: i, y0: y, y1: y + st.travel }); y += st.travel;
    });
    trackVH = y; vhPx = innerHeight;
    driveEl.style.setProperty('--drive-h', ((trackVH + 1) * vhPx) + 'px');
    driveTop = driveEl.getBoundingClientRect().top + scrollY; statusDocTop = statusEl.getBoundingClientRect().top + scrollY;
  }
  const DRIFT = 2.2;
  function sAtScroll(u) {
    u = clamp(u, 0, trackVH);
    for (const sg of segs) {
      if (u > sg.y1 && sg !== segs[segs.length - 1]) continue;
      const t = clamp((u - sg.y0) / (sg.y1 - sg.y0), 0, 1), st = STOPS[sg.k];
      if (sg.type === 'dwell') return { s: st.s - DRIFT + t * 2 * DRIFT, k: sg.k, t, type: 'dwell' };
      if (sg.type === 'tail') return { s: st.s + DRIFT + easeIO(t) * .5 * 46, k: sg.k, t, type: 'tail' };
      const nx = STOPS[sg.k + 1]; return { s: lerp(st.s + DRIFT, nx.s - DRIFT, easeSine(t)), k: sg.k, t, type: 'travel' };
    }
    return { s: STOPS[STOPS.length - 1].s, k: STOPS.length - 1, t: 1, type: 'tail' };
  }
  const stopY = st => driveTop + (st.y0 + st.dwell * .5) * vhPx;
  goToChapter = i => { const y = i >= 4 ? statusDocTop : stopY(STOPS.find(s => s.ch === i)); scrollTo({ top: y, behavior: reduced.matches ? 'auto' : 'smooth' }); };
  hud.addEventListener('focusin', e => { const c = e.target.closest('.card'); if (!c || c.classList.contains('is-on')) return; const st = STOPS.find(x => x.cardEl === c); if (st) scrollTo({ top: stopY(st), behavior: 'auto' }); });
  function jumpHash() { const h = location.hash.slice(1); const idx = { office: 0, managers: 1, customers: 2, works: 3, status: 4 }[h]; if (idx != null) { if (idx >= 4) statusEl.scrollIntoView(); else scrollTo(0, stopY(STOPS.find(s => s.ch === idx))); } }

  /* ---------------- sizing & lens ---------------- */
  let lastW = 0, lastH = 0, cardRect = null, cardRectFor = null;
  function resize(force) {
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    if (!force && Math.abs(cw - lastW) < 2 && Math.abs(ch - lastH) < 140) return;   // ignore mobile toolbar wobble
    lastW = cw; lastH = ch; W = cw; H = ch;
    applyDpr(cw, ch);   // the canvas is cleared here; needRender makes the very next frame draw it
    const aspect = cw / ch; camera.aspect = aspect;
    if (aspect >= 1.25) baseFov = 40; else if (aspect >= .9) baseFov = 48; else baseFov = clamp(2 * Math.atan(Math.tan(23 * Math.PI / 180) / aspect) * 180 / Math.PI, 50, 84);
    camera.fov = baseFov;
    computeStops(); layoutTrack(); cardRectFor = null; markDockDirty(30);
  }
  function applyLens() { camera.updateProjectionMatrix(); const e = camera.projectionMatrix.elements; e[8] = -lensX; e[9] = -lensY; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
  function lensTarget(activeCard) {
    const portrait = W / H < .9;
    if (!activeCard) return portrait ? [0, .1] : [0, .07];
    if (activeIdx === IX.office && !portrait && W >= 761) { if (cardRectFor !== activeCard) { cardRectFor = activeCard; cardRect = activeCard.getBoundingClientRect(); } const cx = (cardRect.right + 16 + W) / 2; return [clamp((cx / W) * 2 - 1, 0, .5) * .9, -.02]; }
    if (cardRectFor !== activeCard) { cardRectFor = activeCard; cardRect = activeCard.getBoundingClientRect(); }
    if (W >= 761 && !portrait) { const cx = (cardRect.right + 16 + W) / 2; return [clamp((cx / W) * 2 - 1, 0, .5) * .9, .13]; }
    const cy = (66 + Math.min(cardRect.top, H * .72)) / 2; return [0, clamp(1 - 2 * cy / H, 0, .55)];
  }

  /* ---------------- link chips on billboards ---------------- */
  const hsLayer = $('#hotspots'); const hotspots = [];
  const ICON_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  function addLink(pos, s0, s1, stop, url, label) {
    const el = document.createElement('div'); el.className = 'hs hs--link';
    const a = document.createElement('a'); a.className = 'hs__btn'; a.innerHTML = ICON_LINK; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', label);
    const tip = document.createElement('div'); tip.className = 'hs__tip'; tip.textContent = label;
    el.append(a, tip); hsLayer.appendChild(el); hotspots.push({ el, pos, s0, s1, stop, on: false, x: -1, y: -1 });
  }
  mgrSigns.forEach((sg, i) => { const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(sg.group.quaternion); addLink(sg.center.clone().addScaledVector(ax, (i === 0 ? -1 : 1) * (MGR_W / 2 - .6)).add(new THREE.Vector3(0, MGR_H / 2 + .2, 0)), -30, 22, IX.kai + i, MANAGERS[i].link, MANAGERS[i].linkLabel); });
  workSigns.forEach((sg, i) => { if (!WORKS[i].url) return; const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(sg.group.quaternion); addLink(sg.center.clone().addScaledVector(ax, -sg.side * (WORK_W / 2 - .6)).add(new THREE.Vector3(0, WORK_H / 2 + .2, 0)), -30, 20, IX.work0 + i, WORKS[i].url, '開啟 ' + WORKS[i].name); });
  const PV = new THREE.Vector3();
  function updateHotspots(sNow) {
    for (const h of hotspots) {
      const base = STOPS[h.stop].s; let on = sNow > base + h.s0 && sNow < base + h.s1;
      if (on) { PV.copy(h.pos).project(camera); on = PV.z < 1 && PV.x > -1.05 && PV.x < 1.05 && PV.y > -1.05 && PV.y < 1.05;
        if (on) { const x = Math.round((PV.x * .5 + .5) * W), y = Math.round((-PV.y * .5 + .5) * H); if (x !== h.x || y !== h.y) { h.x = x; h.y = y; h.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; h.el.classList.toggle('flip-x', x > W * .62); } } }
      if (on !== h.on) { h.on = on; h.el.classList.toggle('is-on', on); }
    }
  }

  /* ---------------- pointer on billboards: tap opens the site ---------------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let downAt = null;
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) { downAt = null; return; } downAt = null;
    const hit = pick(e.clientX, e.clientY); if (!hit) return;
    window.open(hit.kind === 'mgr' ? MANAGERS[hit.i].link : hit.url, '_blank', 'noopener');
  });
  let hoverT = 0; canvas.addEventListener('pointermove', e => { const now = performance.now(); if (now - hoverT < 120 || e.pointerType !== 'mouse') return; hoverT = now; canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : ''; });
  function pick(cx, cy) { ptr.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); ray.setFromCamera(ptr, camera); const hits = ray.intersectObjects(signs.map(s => s.face), false); if (!hits.length || hits[0].distance > 180) return null; const sg = signs.find(s => s.face === hits[0].object); return sg && (sg.kind === 'mgr' || sg.url) ? sg : null; }

  /* ---------------- frame loop ---------------- */
  let sCam = 4, sGoal = 4, prevS = 4, speed = 0, time = 0, tPrev = performance.now(), running = true, lastScrollAt = 0, activeIdx = -1, covered = false, hidden = null, frameNo = 0;
  let idleTick = 0, readyAt = 0; const redrawQ = [];
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), tgtSm = new THREE.Vector3(), posSm = new THREE.Vector3(), focusV = new THREE.Vector3(), lastSun = new THREE.Vector3(1e9, 0, 0);
  let firstFrame = true;
  const setOf = tag => peopleSets.filter(p => p.tag === tag);
  const PEOPLE = { office: setOf('office'), park: setOf('park'), foot: setOf('foot'), city: setOf('city') };
  function rig(s, outPos, outTgt) {
    const off = 1 - sstep(10, 135, s), city = sstep(S_CITY0 - 50, S_CITY0 + 30, s), portrait = W / H < .9;
    const A = lerp(camA.a, portrait ? 34 : 33, off), Hh = lerp(lerp(portrait ? 12.5 : 12, portrait ? 11 : 10.5, city), portrait ? 54 : 48, off), B2 = lerp(lerp(46, 50, city), 60, off);
    road(s); const vy = RD.y;
    road(s + A); outPos.set(RD.x + RD.rx * LANE * .5, Math.max(vy, RD.y) + Hh, RD.z + RD.rz * LANE * .5);
    if (off > 0) { outPos.x += -RD.rx * (portrait ? 28 : 30) * off; outPos.z += -RD.rz * (portrait ? 28 : 30) * off; }   // three-quarter view of the office
    road(s - B2); outTgt.set(RD.x + RD.rx * LANE * .4, RD.y + camA.lh, RD.z + RD.rz * LANE * .4);
    outTgt.lerp(STOPS[0].focus, off);
    for (let i = 1; i < STOPS.length; i++) {
      const st = STOPS[i], r = i >= IX.work0 ? 30 : i <= IX.wei ? 34 : 46, w = 1 - sstep(0, r, Math.abs(s - st.s)); if (w <= 0) continue;
      if (st.focus) outTgt.lerp(st.focus, w * st.fw);
      if (st.mgr != null) outPos.y += w * 2;
    }
  }
  function frame(now) {
    if (!running) return; requestAnimationFrame(frame);
    const dt = Math.min(.1, Math.max(.001, (now - tPrev) / 1000)); tPrev = now; time += dt;
    const sy = scrollY; const u = (sy - driveTop) / vhPx; const at = sAtScroll(u);
    sGoal = at.s; const k = SNAP ? 400 : reduced.matches ? 14 : 3.4; sCam += (sGoal - sCam) * (1 - Math.exp(-dt * k)); if (Math.abs(sGoal - sCam) < .002) sCam = sGoal;
    speed = (sCam - prevS) / dt; prevS = sCam;
    const stTop = statusDocTop - sy; const isCovered = stTop <= 0;
    if (isCovered !== covered) { covered = isCovered; root.classList.toggle('world-covered', covered); }
    // active card
    let idx = at.k, hide = false;
    if (at.type === 'travel') { const st = STOPS[at.k]; if (st.travel >= 1) { if (at.t > .26 && at.t < .74) hide = true; else if (at.t >= .74) idx = at.k + 1; } else if (at.t >= .5) idx = at.k + 1; }
    if (at.type === 'tail' && at.t > .55) hide = true;
    if (u < -.2) idx = 0;
    if (idx !== activeIdx) { activeIdx = idx; cards.forEach(c => c.classList.toggle('is-on', c === STOPS[idx].card)); cardRectFor = null; }
    const hideNow = hide || stTop < vhPx * .55; if (hideNow !== hidden) { hidden = hideNow; hud.classList.toggle('is-hidden', hideNow); }
    let p;
    if (at.type === 'dwell') p = STOPS[at.k].ch; else if (at.type === 'travel') p = lerp(STOPS[at.k].ch, STOPS[at.k + 1].ch, sstep(.15, .85, at.t)); else p = 3 + clamp(1 - (stTop / vhPx), 0, 1);
    if (stTop < vhPx) p = Math.max(p, 3 + clamp(1 - stTop / vhPx, 0, 1));
    chapterP = p; updateChrome(stTop);
    const placeTxt = sCam < 90 ? '辦公室' : sCam < S_MTN1 ? '山路' : sCam < S_CITY0 - 20 ? '山腳住宅區' : '市區';
    if (placeName.textContent !== placeTxt) placeName.textContent = placeTxt;
    // late font redraws: one canvas per frame so texture uploads never pile into one long frame
    if (redrawQ.length) { redrawQ.shift()(); needRender = true; }
    if (covered && !firstFrame && !needRender) return;
    if (GLX.isContextLost()) return;   // between a GPU reset and its event: draw nothing rather than half a frame
    const idle = now - lastScrollAt > 2200 && Math.abs(sGoal - sCam) < .01 && !downAt;
    if (idle && !firstFrame && !needRender && (++idleTick & 1)) return;
    // quality governor: watch moving frames; two windows in a row with >40% of frames under ~45 fps → one notch down
    if (!idle && !firstFrame && now - readyAt > 1800) {
      qN++; if (dt > 1 / 45) qSlow++;
      if (qN >= 90) {
        const r = qSlow / qN; qN = qSlow = 0;
        if (r > .4) { qGood = 0; if (++qBad >= 2 && qLevel < Q_LEVELS.length - 1) { qBad = 0; qLevel++; if (qWentUp) qUpLocked = true; applyDpr(W, H); } }
        else { qBad = 0; if (r < .03 && qLevel > qInit && !qUpLocked) { if (++qGood >= 8) { qGood = 0; qLevel--; qWentUp = true; applyDpr(W, H); } } else qGood = 0; }
      }
    }

    rig(sCam, camPos, camTgt);
    if (firstFrame) { posSm.copy(camPos); tgtSm.copy(camTgt); }
    posSm.lerp(camPos, SNAP ? 1 : 1 - Math.exp(-dt * 9)); tgtSm.lerp(camTgt, SNAP ? 1 : 1 - Math.exp(-dt * 6));
    camera.position.copy(posSm);
    const bob = reduced.matches ? 0 : Math.sin(time * 9) * Math.min(Math.abs(speed), 30) * .0018;
    camera.position.y += bob; camera.lookAt(tgtSm);
    const [lx, ly] = lensTarget(STOPS[activeIdx] && STOPS[activeIdx].card);
    const ls = firstFrame || SNAP ? 1 : 1 - Math.exp(-dt * 3.2); lensX += (lx - lensX) * ls; lensY += (ly - lensY) * ls; applyLens();
    const cityF = sstep(S_CITY0 - 60, S_CITY0 + 40, sCam); scene.fog.near = lerp(150, 220, cityF); scene.fog.far = lerp(560, 860, cityF); sky.position.copy(camera.position);

    placeOnRoad(van, sCam, LANE, 1);
    const wr = (speed * dt) / .46; van.userData.wheels.forEach(w => { w.rotation.x += wr; });
    const trafficOn = sCam > 70;
    for (const t of traffic) {
      if (!reduced.matches) t.s -= t.v * dt;
      if (t.s < Math.max(sCam - 300, 40) || t.s > sCam + 160) t.s = sCam + 40 + Math.random() * 110;
      t.obj.visible = trafficOn;
      if (trafficOn) { placeOnRoad(t.obj, t.s, t.lane, -1); t.obj.userData.wheels.forEach(w => { w.rotation.x += t.v * dt / .42; }); }
    }
    const trainOn = sCam > S_CITY0 - 260; train.visible = trainOn; if (trainOn && !reduced.matches) train.position.x = -260 + ((time * 14) % 640);
    // people: animate only the groups near the camera
    const show = { office: sCam < 330, park: sCam < 330, foot: Math.abs(sCam - STOPS[IX.cust].s) < 260, city: sCam > S_CITY0 - 160 };
    for (const k in PEOPLE) PEOPLE[k].forEach(set => { showPeople(set, show[k]); if (show[k]) posePeople(set, time); });
    if (!reduced.matches && show.office) { screenTexes.forEach((tx, i) => { tx.offset.y = (tx.offset.y + dt * (.05 + i * .02)) % 1; }); if (officePeople.blink) officePeople.blink.visible = Math.sin(time * 5) > -.4; }
    const resOn = sCam > STOPS[IX.cust].s - 150 && sCam < STOPS[IX.cust].s + 110;
    voices.forEach((v, i) => {
      const target = resOn && sCam > v.s + 6 ? 1 : 0; v.pop += (target - v.pop) * (1 - Math.exp(-dt * 6));
      const sp = v.sprite, e = v.pop, spring = reduced.matches ? e : e * (1 + Math.sin(e * Math.PI) * .18);
      sp.visible = e > .01; if (!sp.visible) return;
      sp.scale.set(sp.userData.w * spring, sp.userData.h * spring, 1);
      sp.position.copy(sp.userData.base); if (!reduced.matches) sp.position.y += Math.sin(time * 1.6 + i) * .18;
    });
    // sun follows the view; the shadow map is refreshed every other frame, or at once when the view jumps
    focusV.copy(tgtSm).lerp(posSm, .35); const tx = Math.round(focusV.x / 2) * 2, tz = Math.round(focusV.z / 2) * 2;
    sun.target.position.set(tx, focusV.y, tz); sun.position.set(tx + SUN_OFF.x, focusV.y + SUN_OFF.y, tz + SUN_OFF.z); sun.target.updateMatrixWorld();
    const jump = lastSun.distanceToSquared(sun.target.position) > 36; if (jump || (frameNo++ & 1) === 0 || firstFrame) { renderer.shadowMap.needsUpdate = true; lastSun.copy(sun.target.position); }
    updateHotspots(sCam);
    renderer.render(scene, camera); needRender = false;
    if (firstFrame) { firstFrame = false; readyAt = now; root.classList.add('ready'); if (SNAP) console.log('[drive] first frame', Math.round(performance.now() - T0) + 'ms', renderer.info.render.triangles + ' tris', renderer.info.render.calls + ' calls', 'dpr ' + dprNow.toFixed(2), renderer.domElement.width + '×' + renderer.domElement.height); }
  }

  /* re-draw canvas art only if web fonts arrived after we drew it; queued one canvas per frame */
  if (!fontsOk && document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    redrawQ.push(() => { drawBand(TEX.band.image); TEX.band.needsUpdate = true; }, () => { drawVanSide(TEX.vanSide.image); TEX.vanSide.needsUpdate = true; },
      () => { drawSignAtlas(signTex.image); signTex.needsUpdate = true; });
    mgrSigns.forEach(sg => redrawQ.push(() => { drawManager(sg.canvas, MANAGERS[sg.i], sg.i); sg.tex.needsUpdate = true; }));
    workSigns.forEach(sg => redrawQ.push(() => { drawWork(sg.canvas, WORKS[sg.i], images[sg.i]); sg.tex.needsUpdate = true; }));
    voices.forEach(v => redrawQ.push(() => { const t = v.sprite.material.map; drawBubble(t.image, QUESTIONS[v.i].q, v.i); t.needsUpdate = true; }));
    hillLetters.forEach(h => redrawQ.push(() => { drawHillGlyph(h.c, h.kind === 'cn' ? '欣緯軟體' : h.ch, h.kind === 'cn'); h.tex.needsUpdate = true; }));
    foothillLetterTextures.forEach(h => redrawQ.push(() => { drawFoothillLetter(h.canvas, h.char); h.texture.needsUpdate = true; }));
  });

  /* upload every texture and compile every shader now, behind the loading veil,
     so nothing stalls the first time the drive reaches the city or a billboard */
  function warmGPU() {
    const seen = new Set();
    scene.traverse(o => { const ms = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) for (const k of ['map', 'emissiveMap', 'alphaMap']) { const t = m[k]; if (t && !seen.has(t)) { seen.add(t); try { renderer.initTexture(t); } catch (e) {} } } });
    return renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve(renderer.compile(scene, camera));
  }

  /* ---------------- go ---------------- */
  if (root.classList.contains('no3d')) throw new Error('flat fallback already shown');   // never flip a page the visitor is already reading
  root.classList.add('is3d'); root.classList.remove('boot', 'no3d');
  resize(true);
  await warmGPU(); mark('gpu warm');
  addEventListener('resize', () => resize(false));
  addEventListener('orientationchange', () => setTimeout(() => resize(true), 250));
  addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true });
  addEventListener('load', () => { statusDocTop = statusEl.getBoundingClientRect().top + scrollY; });
  const resume = () => { needRender = true; if (!running) { running = true; tPrev = performance.now(); requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else resume(); });
  // A lost GPU context (tab in background, memory pressure) shows the loading veil instead of a blank canvas,
  // then the world is rebuilt on the GPU from the same scene. Only if it never comes back do we fall back to flat.
  let lostT = 0;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; root.classList.add('gl-lost'); clearTimeout(lostT); lostT = setTimeout(() => { root.classList.remove('gl-lost'); startFlat(); }, 8000); });
  canvas.addEventListener('webglcontextrestored', () => { clearTimeout(lostT); applyDpr(W, H); lastSun.set(1e9, 0, 0); warmGPU().then(() => { root.classList.remove('gl-lost'); resume(); }); });
  if (SNAP) window.__drive = { STOPS, TEX, camera, van, THREE, renderer, get sCam() { return sCam; }, get running() { return running; }, get needRender() { return needRender; }, get covered() { return covered; }, get driveTop() { return driveTop; }, get vhPx() { return vhPx; } };
  jumpHash();
  const u0 = (scrollY - driveTop) / vhPx; sCam = sAtScroll(u0).s; prevS = sCam;
  requestAnimationFrame(frame);
  mark('ready to render');
}
