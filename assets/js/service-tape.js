/* SIGNWELL — drag to lay the giving & service tape. */
(function () {
  'use strict';
  const stage = document.querySelector('[data-tape3d]');
  const items = Array.from(document.querySelectorAll('[data-tape-index] .tape-item'));
  if (!stage || !items.length) return;
  const sceneURL = new URL('scene.js?v=20261007-interactive', document.currentScript.src);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tip = stage.querySelector('[data-tape-tip]');
  const count = stage.querySelector('[data-tape-count]');
  const status = stage.querySelector('[data-tape-status]');
  const reset = stage.querySelector('[data-tape-reset]');
  let scene = null, loading = false;

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
        cards: cards(), reducedMotion,
        onHover: showTip,
        onCount(value) { count.textContent = String(value).padStart(6, '0'); },
        onDrawing(drawing) {
          status.textContent = drawing ? '正在貼膠帶，放開即可停止' : '按住滑鼠或手指，在地板上拖曳貼膠帶';
        }
      });
      if (!scene) stage.classList.add('is-static');
      else {
        reset.disabled = false;
        status.textContent = '按住滑鼠或手指，在地板上拖曳貼膠帶';
      }
    } catch {
      stage.classList.add('is-static');
    }
  }

  document.addEventListener('signwell:donationsupdated', () => {
    if (scene) scene.updateCards(cards());
    tip.classList.remove('is-on');
  });
  reset.addEventListener('click', () => {
    if (scene) { scene.restart(); status.textContent = '地板已清空，按住並拖曳重新貼膠帶'; }
  });
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
