/* Keep chapter navigation available independently of the decorative 3D scene. */
(() => {
  'use strict';
  const sections = Array.from(document.querySelectorAll('[data-chapter]'));
  const links = Array.from(document.querySelectorAll('.story-nav a'));
  if (!sections.length || links.length !== sections.length) return;
  let scheduled = false;
  function update() {
    scheduled = false;
    const anchor = window.innerHeight * 0.4;
    let active = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= anchor) active = index;
    });
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('pageshow', schedule);
  update();
})();
