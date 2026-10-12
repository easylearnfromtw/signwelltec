/* One frame owner: inputs wake it, hidden/covered scenes can put it to sleep. */
export function createRenderLoop({ draw, isVisible,
  requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  let frame = null, previous = null;
  function wake() {
    if (frame === null && isVisible()) frame = requestFrame(tick);
  }
  function pause() {
    if (frame !== null) cancelFrame(frame);
    frame = previous = null;
  }
  function tick(now) {
    frame = null;
    if (!isVisible()) { previous = null; return; }
    const dt = previous === null ? 1 / 60 : Math.min(.1, Math.max(.001, (now - previous) / 1000));
    previous = now;
    if (draw(now, dt)) wake();
    else previous = null;
  }
  return { wake, pause, get running() { return frame !== null; } };
}
