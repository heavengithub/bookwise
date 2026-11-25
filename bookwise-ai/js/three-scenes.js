/* =========================================================================
   Bookwise 3D scenes (three.js r170, loaded as an ES module)
   - heroPaper:  continuous-form "green-bar" printout folding in space
   - terrain:    S-corp tax surface (salary × extra retirement → total tax)
   - skyline:    12 months of money in / money out as a 3D bar city
   Each mount returns { dispose() }. Scenes pause when off screen and
   render a single still frame when the user prefers reduced motion.
   ========================================================================= */
import * as THREE from './vendor/three.module.min.js';

const INK = 0x1c2b4a, GREEN = 0x2f7d4f, RED = 0xb42318, BAND = '#e6efe2', PAPER = '#ffffff';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function setup(el, { fov = 35, alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, .1, 200);
  const size = () => { const w = el.clientWidth || 400, h = el.clientHeight || 300; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size();
  const ro = new ResizeObserver(size); ro.observe(el);
  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }); io.observe(el);
  let raf = 0, alive = true;
  const loop = (fn) => { const t0 = performance.now(); const tick = (t) => { if (!alive) return; if (visible) fn((t - t0) / 1000); renderer.render(scene, camera); if (!reduced()) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); };
  const dispose = () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); }); renderer.domElement.remove(); };
  return { renderer, scene, camera, loop, dispose, size };
}

/* drag to orbit, wheel to zoom */
function orbit(el, camera, target, { r = 14, theta = .8, phi = 1.0, min = 6, max = 30, auto = 0 } = {}) {
  const st = { r, theta, phi, drag: false, x: 0, y: 0, auto };
  const apply = () => { camera.position.set(target.x + st.r * Math.sin(st.phi) * Math.sin(st.theta), target.y + st.r * Math.cos(st.phi), target.z + st.r * Math.sin(st.phi) * Math.cos(st.theta)); camera.lookAt(target); };
  el.addEventListener('pointerdown', e => { st.drag = true; st.x = e.clientX; st.y = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointerup', () => { st.drag = false; el.style.cursor = 'grab'; });
  el.addEventListener('pointermove', e => { if (!st.drag) return; st.theta -= (e.clientX - st.x) * .008; st.phi = Math.min(1.45, Math.max(.25, st.phi - (e.clientY - st.y) * .006)); st.x = e.clientX; st.y = e.clientY; st.auto = 0; apply(); });
  el.addEventListener('wheel', e => { e.preventDefault(); st.r = Math.min(max, Math.max(min, st.r * (1 + Math.sign(e.deltaY) * .08))); apply(); }, { passive: false });
  el.style.cursor = 'grab'; el.style.touchAction = 'none';
  apply();
  return { tick: dt => { if (st.auto) { st.theta += st.auto * dt; apply(); } }, apply, st };
}

function textSprite(text, { size = 28, color = '#1c2b4a', weight = 600, font = 'Public Sans' } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `${weight} ${size}px "${font}", sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 12; c.width = w; c.height = size + 14;
  x.font = `${weight} ${size}px "${font}", sans-serif`; x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, 6, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sp.scale.set(w / 100, c.height / 100, 1); return sp;
}

/* ---------------- green-bar sheet texture ---------------- */
function sheetTexture(lines, title) {
  const W = 1024, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  const L = 70, R = W - 70, rowH = 36, top = 84;
  for (let r = 0; r < 14; r++) if (Math.floor(r / 3) % 2 === 0) { x.fillStyle = BAND; x.fillRect(L, top + r * rowH, R - L, rowH); }
  // tractor-feed margins
  x.strokeStyle = '#c9d1c5'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(L, 0); x.lineTo(L, H); x.moveTo(R, 0); x.lineTo(R, H); x.stroke(); x.setLineDash([]);
  for (let y = 22; y < H; y += 44) for (const cx of [35, W - 35]) { x.beginPath(); x.arc(cx, y, 9, 0, Math.PI * 2); x.fillStyle = '#d8ded5'; x.fill(); x.strokeStyle = '#b9c2b6'; x.stroke(); }
  x.fillStyle = '#1c2b4a'; x.font = '600 26px "Plex Mono", monospace'; x.textBaseline = 'middle';
  x.fillText(title[0], L + 20, 46); const tw = x.measureText(title[1]).width; x.fillText(title[1], R - 20 - tw, 46);
  x.fillRect(L + 14, 70, R - L - 28, 2);
  x.font = '400 24px "Plex Mono", monospace';
  lines.forEach((ln, i) => {
    const y = top + i * rowH + rowH / 2; const [a, b, flag] = ln;
    x.font = `${flag === 'b' || flag === 'net' ? 600 : 400} 24px "Plex Mono", monospace`;
    x.fillStyle = '#1c2b4a'; x.fillText(a, L + 20, y);
    if (b) { const w = x.measureText(b).width; if (flag === 'hl') { x.fillStyle = '#fbe36b'; x.fillRect(R - 24 - w, y - 2, w + 8, 14); x.fillStyle = '#1c2b4a'; } x.fillText(b, R - 20 - w, y); }
    if (flag === 'net') { x.fillRect(L + 14, y - rowH / 2, R - L - 28, 2); x.fillRect(L + 14, y + rowH / 2 - 2, R - L - 28, 2); x.fillRect(L + 14, y + rowH / 2 + 3, R - L - 28, 2); }
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}

/* =========================================================================
   1. Hero: fan-folded printout
   ========================================================================= */
function heroPaper(el) {
  const S = setup(el, { fov: 30 });
  const { scene, camera } = S;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8eee6, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-4, 8, 9); scene.add(sun);
  const pages = [
    [['BLUEBIRD CREATIVE CO.', 'TAX REVIEW TY2026'], [['Service revenue', '470,700.00'], ['Cost of goods sold', '(46,506.00)'], ['Operating expenses', '(229,693.00)'], ['Net profit', '194,501.00', 'b'], ['Tax as filed today', '58,670.00'], ['Elect S-corp  §1362', '(7,353.00)', 'hl'], ['Solo 401(k)  §401(k)', '(9,949.00)', 'hl'], ['Bonus depreciation', '(3,663.00)'], ['Augusta rule  §280A(g)', '(1,832.00)'], ['Credits', '(5,481.00)'], ['Other strategies', '(14,546.00)'], ['Tax with plan', '15,846.00', 'net']]],
    [['GENERAL LEDGER', 'NOV 2026'], [['11/01 Office lease', '(3,200.00)'], ['11/03 Software', '(865.00)'], ['11/05 Insurance', '(455.00)'], ['11/06 Payment INV-1067', '10,600.00'], ['11/08 Utilities', '(319.00)'], ['11/11 Client lunch  50%', '(467.00)'], ['11/15 Payroll', '(5,500.00)'], ['11/15 Payroll taxes', '(421.00)'], ['11/15 Freelance design', '(4,728.00)'], ['11/20 Loan interest', '(140.00)'], ['11/24 Payment INV-1068', '7,300.00'], ['Month to date', '2,105.00', 'net']]],
    [['A/R AGING', 'AS OF 11/24/26'], [['Evergreen Clinics', '19,200.00'], ['Summit Outdoor Gear', '23,450.00'], ['Maple & Co. Law', '3,700.00'], ['Brightpath Tutoring', '2,900.00'], ['Northwind Foods', '8,150.00'], ['', ''], ['Current', '51,000.00'], ['1 - 30 days', '6,400.00', 'hl'], ['31 - 60 days', '0.00'], ['61 - 90 days', '0.00'], ['91 and over', '0.00'], ['Total', '57,400.00', 'net']]],
    [['SCHEDULE C SUMMARY', 'TY2026'], [['Line 1  Gross receipts', '470,700.00'], ['Line 4  Cost of goods', '46,506.00'], ['Line 8  Advertising', '20,811.00'], ['Line 15 Insurance', '5,005.00'], ['Line 17 Legal & prof.', '5,900.00'], ['Line 20b Rent', '35,200.00'], ['Line 23 Taxes & lic.', '9,191.00'], ['Line 24b Meals (50%)', '1,924.00', 'hl'], ['Line 26 Wages', '115,500.00'], ['Line 27a Other', '15,122.00'], ['', ''], ['Line 31 Net profit', '196,425.00', 'net']]],
  ];
  const W = 4.2, H = 2.46, N = 6;
  const root = new THREE.Group(); scene.add(root);
  const hinges = [];
  let parent = root;
  for (let i = 0; i < N; i++) {
    const hinge = new THREE.Group(); parent.add(hinge);
    if (i) hinge.position.y = -H;
    const pg = pages[i % pages.length];
    const tex = sheetTexture(pg[1], pg[0]); const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .1, side: THREE.DoubleSide, roughness: .92, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 1, 1), mat);
    mesh.position.y = -H / 2; hinge.add(mesh);
    // perforation line
    const perf = new THREE.Mesh(new THREE.PlaneGeometry(W, .012), new THREE.MeshBasicMaterial({ color: 0xc9d1c5 }));
    perf.position.set(0, -H + .006, .002); hinge.add(perf);
    hinges.push(hinge); parent = hinge;
  }
  root.position.set(0, 3.5, 0);
  // soft contact shadow
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
  const g = sx.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(28,43,74,.28)'); g.addColorStop(1, 'rgba(28,43,74,0)'); sx.fillStyle = g; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -3.3, -.6); scene.add(shadow);
  camera.position.set(0, .8, 15.5); camera.lookAt(0, -.1, 0);
  let mx = 0, my = 0;
  const onMove = e => { const r = el.getBoundingClientRect(); mx = ((e.clientX - r.left) / r.width - .5); my = ((e.clientY - r.top) / r.height - .5); };
  window.addEventListener('pointermove', onMove);
  const fold = (t) => {
    const open = reduced() ? 1 : Math.min(1, t / 2.2); const ease = 1 - Math.pow(1 - open, 3);
    hinges.forEach((h, i) => { if (!i) { h.rotation.x = -.12 - .05 * Math.sin(t * .6); return; } const a = (i % 2 ? 1 : -1) * (2.75 - 1.55 * ease) + (i % 2 ? .04 : -.04) * Math.sin(t * .8 + i); h.rotation.x = a * (i > 2 ? 1.04 : 1); });
    root.rotation.y = -.42 + mx * .35 + Math.sin(t * .25) * .04; root.rotation.x = .08 + my * .12;
  };
  fold(reduced() ? 10 : 0);
  S.loop(fold);
  return { dispose: () => { window.removeEventListener('pointermove', onMove); S.dispose(); } };
}

/* =========================================================================
   2. Tax terrain: z = total tax(salary, extra retirement contribution)
   ========================================================================= */
function terrain(el, { grid, xs, ys, best, fmt, tip, floorI = 0 }) {
  const S = setup(el, { fov: 38 });
  const { scene, camera, renderer } = S;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2b4, 1.5));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(6, 12, 4); scene.add(dl);
  const n = xs.length, m = ys.length, size = 10;
  let zmin = Infinity, zmax = -Infinity; grid.forEach(r => r.forEach(v => { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); }));
  const hz = v => (v - zmin) / Math.max(1, zmax - zmin) * 4;
  const geo = new THREE.PlaneGeometry(size, size, n - 1, m - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = [];
  const lo = new THREE.Color(GREEN), mid = new THREE.Color(0xf3f0d8), hi = new THREE.Color(RED), c = new THREE.Color();
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, v = grid[j][i], t = (v - zmin) / Math.max(1, zmax - zmin);
    pos.setY(k, hz(v)); c.copy(t < .5 ? lo : mid).lerp(t < .5 ? mid : hi, t < .5 ? t * 2 : (t - .5) * 2); colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .75, flatShading: false }));
  scene.add(surf);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: .16 }));
  scene.add(wire);
  const floor = new THREE.GridHelper(size, n - 1, 0x9aa79a, 0xc9d1c5); floor.position.y = -.02; scene.add(floor);
  // axes labels
  const lx = textSprite('Owner salary →', { size: 26 }); lx.position.set(0, -.2, size / 2 + .9); scene.add(lx);
  const ly = textSprite('Extra retirement →', { size: 26 }); ly.position.set(size / 2 + 1.6, -.2, 0); scene.add(ly);
  if (floorI > 0) {
    const fw = floorI / (n - 1) * size;
    const zone = new THREE.Mesh(new THREE.BoxGeometry(fw, 4.4, size), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: .09, depthWrite: false }));
    zone.position.set(-size / 2 + fw / 2, 2.2, 0); scene.add(zone);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(zone.geometry), new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: .35 })); edge.position.copy(zone.position); scene.add(edge);
    const zl = textSprite('Below reasonable salary', { size: 24, color: '#b42318' }); zl.position.set(-size / 2 + fw / 2, 4.7, size / 2); scene.add(zl);
  }
  const lz = textSprite('Total tax ↑', { size: 26 }); lz.position.set(-size / 2, 4.6, -size / 2); scene.add(lz);
  // optimum pin
  const bx = -size / 2 + best.i / (n - 1) * size, bz = -size / 2 + best.j / (m - 1) * size, by = hz(grid[best.j][best.i]);
  const pin = new THREE.Group(); pin.position.set(bx, by, bz); scene.add(pin);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.6), new THREE.MeshBasicMaterial({ color: INK })); stem.position.y = .8; pin.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.18, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfbe36b, emissive: 0x8a7a10, emissiveIntensity: .3 })); head.position.y = 1.65; pin.add(head);
  const lab = textSprite(`Lowest tax ${fmt(grid[best.j][best.i])}`, { size: 30, weight: 700 }); lab.position.set(0, 2.25, 0); pin.add(lab);
  const target = new THREE.Vector3(0, 1.2, 0);
  const orb = orbit(renderer.domElement, camera, target, { r: 17, theta: .75, phi: .95, auto: reduced() ? 0 : .12 });
  // hover readout
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('pointermove', e => {
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); const hit = ray.intersectObject(surf)[0];
    if (!hit) { tip(null); return; }
    const i = Math.round((hit.point.x + size / 2) / size * (n - 1)), j = Math.round((hit.point.z + size / 2) / size * (m - 1));
    tip({ salary: xs[Math.max(0, Math.min(n - 1, i))], contrib: ys[Math.max(0, Math.min(m - 1, j))], tax: grid[Math.max(0, Math.min(m - 1, j))][Math.max(0, Math.min(n - 1, i))], x: e.clientX - r.left, y: e.clientY - r.top });
  });
  renderer.domElement.addEventListener('pointerleave', () => tip(null));
  let last = 0;
  S.loop(t => { orb.tick(t - last); last = t; head.position.y = 1.65 + Math.sin(t * 2.2) * .08; });
  return { dispose: S.dispose };
}

/* =========================================================================
   3. Skyline: money in / money out by month
   ========================================================================= */
function skyline(el, { months, inc, out, fmt, tip }) {
  const S = setup(el, { fov: 36 });
  const { scene, camera, renderer } = S;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc7cfc3, 1.5));
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(-5, 10, 7); scene.add(dl);
  const max = Math.max(1, ...inc, ...out), n = months.length, gap = 1.05, H = 4;
  // ledger ground
  const gc = document.createElement('canvas'); gc.width = 512; gc.height = 512; const gx = gc.getContext('2d');
  gx.fillStyle = '#ffffff'; gx.fillRect(0, 0, 512, 512); for (let r = 0; r < 16; r++) if (Math.floor(r / 3) % 2 === 0) { gx.fillStyle = BAND; gx.fillRect(0, r * 32, 512, 32); }
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(n * gap + 2, 5), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const bars = [];
  const mk = (h, color, x, z, data) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(.38, 1, .38), new THREE.MeshStandardMaterial({ color, roughness: .6 }));
    m.position.set(x, 0, z); m.scale.y = .001; m.userData = { h: Math.max(.02, h), ...data }; scene.add(m); bars.push(m); return m;
  };
  months.forEach((mo, i) => {
    const x = (i - (n - 1) / 2) * gap;
    mk(inc[i] / max * H, GREEN, x - .21, 0, { label: mo, kind: 'Money in', v: inc[i] });
    mk(out[i] / max * H, INK, x + .21, 0, { label: mo, kind: 'Money out', v: out[i] });
    const s = textSprite(mo, { size: 24, weight: 500, color: '#4a5670' }); s.position.set(x, .02, 1.25); s.scale.multiplyScalar(.85); scene.add(s);
  });
  const orb = orbit(renderer.domElement, camera, new THREE.Vector3(0, 1.2, 0), { r: 15, theta: .45, phi: 1.05, auto: 0 });
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('pointermove', e => {
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(bars)[0];
    bars.forEach(b => b.material.emissive?.setHex(0x000000));
    if (!hit) { tip(null); return; }
    hit.object.material.emissive.setHex(0x333300);
    tip({ ...hit.object.userData, x: e.clientX - r.left, y: e.clientY - r.top });
  });
  renderer.domElement.addEventListener('pointerleave', () => tip(null));
  S.loop(t => {
    bars.forEach((b, i) => { const k = reduced() ? 1 : Math.min(1, Math.max(0, (t - i * .035) / .7)); const e = 1 - Math.pow(1 - k, 3); b.scale.y = b.userData.h * e; b.position.y = b.scale.y / 2; });
  });
  return { dispose: S.dispose };
}

function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

window.Scenes = { heroPaper, terrain, skyline, ok: webgl() };
window.dispatchEvent(new Event('scenes-ready'));
