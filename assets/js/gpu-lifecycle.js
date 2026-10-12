/* Preserve animation quality while avoiding work outside the visible page. */
(function () {
  'use strict';
  const elements = Array.from(document.querySelectorAll(
    '.tape-track, .spin-slow, .chain-wire, .flow-trace, .scroll-cue i, ' +
    '.marquee__track, .scroll-invite__arrow svg, .place i'
  ));
  if (!elements.length) return;
  const visible = new Map();
  // Observe the stationary viewport of moving strips, not the translating track.
  const targets = new Map();
  elements.forEach(element => {
    const target = element.matches('.tape-track, .marquee__track') ? element.parentElement : element;
    if (!targets.has(target)) targets.set(target, []);
    targets.get(target).push(element);
  });
  function update(element) {
    element.classList.toggle('gpu-paused', document.hidden || !visible.get(element));
  }
  function measure() {
    const measurements = Array.from(targets, ([target, children]) => {
      const rect = target.getBoundingClientRect();
      return { children, inView: rect.bottom > 0 && rect.top < window.innerHeight
        && rect.right > 0 && rect.left < window.innerWidth };
    });
    measurements.forEach(({ children, inView }) => children.forEach(element => {
      visible.set(element, inView); update(element);
    }));
  }
  measure();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => targets.get(entry.target).forEach(element => {
        visible.set(element, entry.isIntersecting); update(element);
      }));
    }, { threshold: 0 });
    targets.forEach((children, target) => observer.observe(target));
  } else {
    let frame = 0;
    function schedule() {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }
  document.addEventListener('visibilitychange', () => elements.forEach(update));
  window.addEventListener('pageshow', measure);

  // Supply the same wire travel distance once per resize, so CSS can move it
  // with transform rather than animating top/left and repainting each frame.
  const wires = elements.filter(element => element.matches('.chain-wire'));
  function sizeWires() {
    const sizes = wires.map(element => ({ element, x: Math.max(0, element.clientWidth - 8), y: Math.max(0, element.clientHeight - 8) }));
    sizes.forEach(({ element, x, y }) => {
      element.style.setProperty('--wire-x', x + 'px');
      element.style.setProperty('--wire-y', y + 'px');
    });
  }
  if (wires.length) {
    sizeWires();
    if ('ResizeObserver' in window) {
      const sizes = new ResizeObserver(sizeWires);
      wires.forEach(element => sizes.observe(element));
    } else window.addEventListener('resize', sizeWires, { passive: true });
  }
})();
