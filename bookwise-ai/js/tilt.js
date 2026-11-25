/* Gentle 3D tilt for printouts on the sign-in pages */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach(el => {
    const wrap = el.parentElement; wrap.style.perspective = '1100px';
    el.style.transition = 'transform .25s ease-out'; el.style.transformStyle = 'preserve-3d';
    wrap.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 10}deg) translateZ(8px)`; });
    wrap.addEventListener('pointerleave', () => { el.style.transform = 'rotateY(-6deg) rotateX(3deg)'; });
    el.style.transform = 'rotateY(-6deg) rotateX(3deg)';
  });
})();
