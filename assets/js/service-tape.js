/* SIGNWELL — drag to lay the giving & service tape. */
(function () {
  'use strict';
  const stage = document.querySelector('[data-tape3d]');
  const items = Array.from(document.querySelectorAll('[data-tape-index] .tape-item'));
  if (!stage || !items.length) return;
  const sceneURL = new URL('scene.js?v=20261007-refine', document.currentScript.src);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tip = stage.querySelector('[data-tape-tip]');
  const count = stage.querySelector('[data-tape-count]');
  const status = stage.querySelector('[data-tape-status]');
  const reset = stage.querySelector('[data-tape-reset]');
  const draw = stage.querySelector('[data-tape-draw]');
  const hero = stage.closest('.csr-hero');
  const content = document.querySelector('.csr-page-content');
  const tabbar = document.querySelector('[data-tabbar]');
  const touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let scene = null, loading = false;
  stage.classList.toggle('supports-touch', touchDevice);

  function idleMessage() {
    return touchDevice
      ? '在膠帶上拖曳可以貼下；向上滑動繼續閱讀'
      : '按住並拖曳，在地板上貼膠帶';
  }

  function setTouchDrawing(enabled) {
    stage.classList.toggle('is-touch-drawing', enabled);
    if (draw) {
      draw.setAttribute('aria-pressed', String(enabled));
      draw.querySelector('span').textContent = enabled ? '完成貼膠帶' : '手指貼膠帶';
    }
    if (!enabled && scene) scene.stopDrawing();
    status.textContent = idleMessage();
  }

  function syncTabbar(panelTop) {
    if (!tabbar) return;
    const vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
    if (!vh) return;
    const revealStart = vh * 0.96;
    const revealEnd = vh * 0.72;
    const progress = Math.max(0, Math.min(1, (revealStart - panelTop) / (revealStart - revealEnd)));
    tabbar.classList.add('csr-tape-aware');
    tabbar.style.setProperty('--csr-tabbar-opacity', progress.toFixed(3));
    tabbar.style.setProperty('--csr-tabbar-y', ((1 - progress) * 118).toFixed(1) + '%');
    const inner = tabbar.querySelector('.tabbar-inner');
    if (inner) inner.inert = progress < 0.18;
  }

  function syncCover() {
    if (!hero || !content) return;
    const panelTop = content.getBoundingClientRect().top;
    syncTabbar(panelTop);
    const covered = panelTop <= 0;
    [stage.querySelector('.tape-controls'), hero.querySelector('.csr-scroll-link')].forEach(element => {
      if (element) element.inert = panelTop < element.getBoundingClientRect().bottom;
    });
    if (covered && !hero.inert) setTouchDrawing(false);
    hero.inert = covered;
    if (scene) scene.setCovered(covered);
  }

  function floorCopy() {
    return {
      amount: document.querySelector('[data-donation-total]').textContent.trim(),
      asOf: document.querySelector('[data-donation-asof]').textContent.trim()
    };
  }

  function cards() {
    return items.map(item => {
      const data = item.dataset;
      const source = data.amountFrom && document.querySelector(data.amountFrom);
      return { code: data.code, tag: data.tag, bg: data.bg, fg: data.fg,
        accent: data.accent, icon: data.icon, tagFill: data.tagFill || '',
        tagText: data.tagText || '', lines: (data.lines || '').split('|'),
        amount: source ? (source.dataset.final || source.textContent).trim() : '',
        foot: 'SIGNWELL 欣緯科技' };
    });
  }

  function showTip(index, x, y) {
    items.forEach((item, j) => item.classList.toggle('is-active', j === index));
    if (index < 0) { tip.classList.remove('is-on'); return; }
    const item = items[index];
    tip.querySelector('[data-tip-code]').textContent = item.dataset.code;
    tip.querySelector('[data-tip-title]').textContent = item.querySelector('strong').textContent;
    tip.querySelector('[data-tip-sub]').textContent = item.querySelector('small').textContent;
    const left = Math.max(12, Math.min(stage.clientWidth - tip.offsetWidth - 12, x + 18));
    const top = Math.max(12, Math.min(stage.clientHeight - tip.offsetHeight - 12, y - 76));
    tip.style.transform = `translate3d(${left}px,${top}px,0)`;
    tip.classList.add('is-on');
  }

  async function initialize() {
    if (loading) return;
    loading = true;
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([
          Promise.all([document.fonts.load('900 64px "Noto Sans TC"', '慈濟基金會'),
            document.fonts.load('600 40px "Plex Mono"'), document.fonts.load('700 20px Archivo')]).catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 2500))
        ]);
      }
      const module = await import(sceneURL.href);
      scene = module.initTape(stage, {
        cards: cards(), reducedMotion, floorCopy: floorCopy(),
        onHover: showTip,
        onCount(value) { count.textContent = String(value).padStart(6, '0'); },
        onDrawing(drawing) {
          status.textContent = drawing ? '正在貼膠帶，放開即可停止' : idleMessage();
        }
      });
      if (!scene) stage.classList.add('is-static');
      else {
        if (reset) reset.disabled = false;
        if (draw) draw.disabled = false;
        status.textContent = idleMessage();
        syncCover();
      }
    } catch {
      stage.classList.add('is-static');
    }
  }

  document.addEventListener('signwell:donationsupdated', () => {
    if (scene) { scene.updateCards(cards()); scene.updateFloor(floorCopy()); }
    tip.classList.remove('is-on');
  });
  if (reset) reset.addEventListener('click', () => {
    if (scene) { scene.restart(); status.textContent = '地板已清空，' + idleMessage(); }
  });
  if (draw) draw.addEventListener('click', () => setTouchDrawing(!stage.classList.contains('is-touch-drawing')));
  if (hero && content) {
    let coverFrame = 0;
    window.addEventListener('scroll', () => {
      if (!coverFrame) coverFrame = requestAnimationFrame(() => { coverFrame = 0; syncCover(); });
    }, { passive: true });
    window.addEventListener('resize', syncCover, { passive: true });
    syncCover();
  }
  items.forEach((item, index) => {
    const button = item.querySelector('button');
    const highlight = () => { if (scene) scene.highlight(index); item.classList.add('is-active'); };
    const clear = () => { if (scene) scene.highlight(-1); item.classList.remove('is-active'); };
    button.addEventListener('pointerenter', highlight);
    button.addEventListener('pointerleave', clear);
    button.addEventListener('focus', highlight);
    button.addEventListener('blur', clear);
    button.addEventListener('click', highlight);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); initialize(); }
    }, { rootMargin: '400px 0px', threshold: 0 });
    observer.observe(stage);
  } else initialize();
})();
