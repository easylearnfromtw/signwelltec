/* Preserve animation quality while avoiding work outside the visible page. */
(function () {
  'use strict';
  const elements = Array.from(document.querySelectorAll(
    '.tape-track, .spin-slow, .chain-wire, .flow-trace, .scroll-cue i'
  ));
  if (!elements.length) return;
  const visible = new Map();
  function update(element) {
    element.classList.toggle('gpu-paused', document.hidden || !visible.get(element));
  }
  function measure() {
    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      visible.set(element, rect.bottom > 0 && rect.top < window.innerHeight
        && rect.right > 0 && rect.left < window.innerWidth);
      update(element);
    });
  }
  measure();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { visible.set(entry.target, entry.isIntersecting); update(entry.target); });
    }, { threshold: 0 });
    elements.forEach(element => observer.observe(element));
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
})();
