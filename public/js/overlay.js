'use strict';

const Overlay = (() => {

  const RING_COLOR       = '#E63946';
  const RING_WIDTH       = 3;
  const RING_RADIUS_FRAC = 0.03;
  const MIN_RADIUS       = 12;
  const MAX_RADIUS       = 40;

  function draw(canvas, img, clickX, clickY) {
    if (clickX == null || clickY == null) { clear(canvas); return; }
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    if (!w || !h) return;
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const cx = clickX * w;
    const cy = clickY * h;
    const r  = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, RING_RADIUS_FRAC * w));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = RING_COLOR;
    ctx.lineWidth   = RING_WIDTH;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle   = RING_COLOR;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function clear(canvas) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function attach(canvas, img, clickX, clickY) {
    const redraw = () => draw(canvas, img, clickX, clickY);
    if (img.complete && img.naturalWidth) { redraw(); }
    else { img.addEventListener('load', redraw, { once: true }); }
    const ro = new ResizeObserver(redraw);
    ro.observe(img);
    return () => ro.disconnect();
  }

  return { draw, clear, attach };

})();