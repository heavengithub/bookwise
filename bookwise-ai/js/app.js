/* =========================================================================
   Bookwise — app shell: top bar, nav, search, +New, drawers, data tables
   ========================================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const P = {
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  bank: '<path d="M3 21h18M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M12 3l9 5H3z"/>',
  sales: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  invoice: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 9M22 21v-1a6 6 0 00-4-5.6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M3 9h18v1.5a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0zM5 13v8h14v-8M10 21v-5h4v5"/>',
  tax: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  proj: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  dl: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>',
  ul: '<path d="M12 15V3m0 0l-4 4m4-4l4 4M4 21h16"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2l-1 1-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  wallet: '<path d="M20 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h13a2 2 0 002-2v-2"/><path d="M22 11h-6a2 2 0 000 4h6z"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};
const I = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${P[n] || ''}</svg>`;
const ICONS = { plus: I('plus'), dl: I('dl'), tx: I('bank'), print: I('print') };

const App = (() => {
  const routes = {};
  const NAV = [
    ['dashboard', 'Home', 'home'],
    ['sec', 'Bookkeeping'],
    ['banking', 'Banking', 'bank', () => Store.state.transactions.filter(t => t.review).length],
    ['invoices', 'Sales & invoices', 'invoice'],
    ['customers', 'Customers', 'users'],
    ['expenses', 'Expenses', 'card'],
    ['vendors', 'Vendors', 'store'],
    ['coa', 'Chart of accounts', 'list'],
    ['sec', 'Insights'],
    ['reports', 'Reports', 'reports'],
    ['projections', 'Cash flow & forecast', 'proj'],
    ['sec', 'Taxes'],
    ['tax', 'Tax optimizer', 'tax'],
    ['library', 'Tax law library', 'book'],
    ['sec', 'Company'],
    ['settings', 'Settings & data', 'settings'],
  ];
  let charts = [], scenes = [];

  function register(name, def) { routes[name] = def; }
  function current() { return (location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard'); }
  const ALIAS = { transactions: 'banking' };

  function renderNav() {
    const cur = ALIAS[current()] || current();
    $('#leftnav').innerHTML = NAV.map(n => {
      if (n[0] === 'sec') return `<div class="sec">${n[1]}</div>`;
      const cnt = n[3] ? n[3]() : 0;
      return `<a href="#/${n[0]}" class="${cur === n[0] ? 'active' : ''}" title="${n[1]}">${I(n[2])}<span>${n[1]}</span>${cnt ? `<em class="cnt">${cnt}</em>` : ''}</a>`;
    }).join('') + `<div class="nav-foot">2026 federal tax rules, estimates, not tax advice</div>`;
  }

  function render() {
    charts.forEach(c => c.destroy()); charts = [];
    scenes.forEach(x => { try { x.dispose(); } catch { } }); scenes = [];
    closeAll();
    const name = ALIAS[current()] || current();
    const r = routes[name] || routes.dashboard;
    document.body.classList.toggle('focus-mode', !!r.focus);
    document.body.classList.remove('nav-open');
    $('#user-menu')?.classList.remove('open');
    renderNav();
    $('#tb-co').textContent = Store.state.company.name;
    $('#page-head').innerHTML = r.hideHead ? '' : `<div>${r.crumb ? `<div class="crumb">${r.crumb}</div>` : ''}<h1>${typeof r.title === 'function' ? r.title() : r.title}</h1>${r.sub ? `<div class="sub">${r.sub()}</div>` : ''}</div>
      <div class="page-actions">${r.actions ? r.actions() : ''}</div>`;
    $('#page-head').style.display = r.hideHead ? 'none' : '';
    const v = $('#view'); v.innerHTML = r.render();
    v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
    r.mount && r.mount();
    animate(v);
    window.scrollTo(0, 0);
    renderBell();
  }

  /* ---------- feedback / overlays ---------- */
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function modal(title, body, foot = '', onMount) {
    $('#modal').innerHTML = `<div class="modal-h"><h2>${title}</h2><button class="icon-btn" onclick="App.closeModal()">${I('x')}</button></div>
      <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}`;
    $('#modal-bg').classList.add('open');
    onMount && onMount($('#modal'));
  }
  function closeModal() { $('#modal-bg').classList.remove('open'); document.body.classList.remove('printing'); }
  function drawer(title, body, foot = '', onMount) {
    $('#drawer').innerHTML = `<div class="drawer-h"><h2>${title}</h2><button class="icon-btn" onclick="App.closeAll()">${I('x')}</button></div>
      <div class="drawer-b">${body}</div>${foot ? `<div class="drawer-f">${foot}</div>` : ''}`;
    $('#drawer').classList.add('open'); $('#scrim').classList.add('open');
    onMount && onMount($('#drawer'));
  }
  function full(title, body, foot, onMount) {
    $('#full').innerHTML = `<div class="full-h"><button class="icon-btn" onclick="App.closeAll()" title="Close">${I('back')}</button><h2>${title}</h2><span class="spacer"></span><button class="icon-btn" onclick="App.closeAll()">${I('x')}</button></div>
      <div class="full-b">${body}</div><div class="full-f">${foot}</div>`;
    $('#full').classList.add('open'); document.body.style.overflow = 'hidden';
    onMount && onMount($('#full'));
  }
  function closeAll() {
    const dr = $('#drawer');
    if (dr.classList.contains('open')) { dr.classList.remove('open'); setTimeout(() => { if (!dr.classList.contains('open')) dr.innerHTML = ''; }, 250); }
    $('#scrim').classList.remove('open');
    $('#full').classList.remove('open'); $('#full').innerHTML = ''; document.body.style.overflow = '';
    closeModal(); $$('.menu').forEach(m => m.remove());
    $('#new-menu').classList.remove('open'); $('#notif-pop').classList.remove('open'); $('#search-pop').classList.remove('open');
  }
  /** Small popup menu anchored to a button: items = [[label, fn, 'bad']] */
  function menu(btn, items) {
    $$('.menu').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'menu';
    items.forEach(([label, fn, cls]) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); m.remove(); fn(); }; m.appendChild(b); });
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 4) + 'px';
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }));
  }

  /* ---------- charts ---------- */
  Chart.defaults.font.family = '"Public Sans", ui-sans-serif, system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#4a5670';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1c2b4a';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 2;
  Chart.defaults.plugins.tooltip.callbacks.label = ctx => ` ${ctx.dataset.label || ctx.label}: ${Fmt.money(ctx.parsed.y ?? ctx.parsed)}`;
  const COLORS = { brand: '#2f7d4f', brand2: '#8fbf9f', accent: '#1c2b4a', warn: '#c98a12', bad: '#b42318', gray: '#c9d1c5', teal: '#2c7a7b', purple: '#7a4e8a',
    series: ['#1c2b4a', '#2f7d4f', '#c98a12', '#7a4e8a', '#2c7a7b', '#b42318', '#8fbf9f', '#7c8698', '#d4a373', '#5b7db1'] };
  function chart(id, cfg) {
    const el = document.getElementById(id); if (!el) return;
    const base = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: cfg.type === 'doughnut' ? undefined : {
        x: { grid: { display: false }, border: { color: '#1c2b4a' } },
        y: { grid: { color: '#e3e8e0' }, border: { display: false }, ticks: { callback: v => Fmt.short(v), maxTicksLimit: 6 } } } };
    cfg.options = deepMerge(base, cfg.options || {});
    const c = new Chart(el, cfg); charts.push(c); return c;
  }
  function deepMerge(a, b) {
    for (const k in b) a[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) ? deepMerge(a[k], b[k]) : b[k];
    return a;
  }
  function download(name, text, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  const csv = rows => rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

  /* ---------- motion helpers ---------- */
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Count numbers up from zero ([data-count] holds the value, [data-fmt] money|int) and swipe highlighters in */
  function animate(root = document) {
    $$('[data-count]', root).forEach(el => {
      const end = +el.dataset.count, dec = +(el.dataset.dec || 0), f = v => el.dataset.fmt === 'int' ? Math.round(v).toLocaleString() : Fmt.money(v, dec);
      if (still()) { el.textContent = f(end); return; }
      const t0 = performance.now(), dur = 900;
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(end * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .6 });
    $$('.hl:not(.on)', root).forEach(el => still() ? el.classList.add('on') : io.observe(el));
  }
  /** Mount a three.js scene once the module has loaded; disposed on navigation */
  function scene(el, fn) {
    if (!el) return;
    const go = () => { if (!window.Scenes?.ok) { el.classList.add('no3d'); return; } if (!el.isConnected) return; scenes.push(fn(window.Scenes)); };
    window.Scenes ? go() : window.addEventListener('scenes-ready', go, { once: true });
  }
  /** Big rubber stamp that slams onto the screen (used when an invoice is paid) */
  function stamp(text, cls = 'paid') {
    if (still()) return;
    const d = document.createElement('div'); d.className = 'stamp-slam ' + cls; d.textContent = text; document.body.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  /* ---------- top bar ---------- */
  const NEW_MENU = [
    ['Customers', [['Invoice', () => Sales.invoiceForm()], ['Receive payment', () => Sales.receivePayment()], ['Sales receipt', () => Banking.txForm({ category: 'services' })], ['Add customer', () => Sales.customerForm()]]],
    ['Vendors', [['Expense', () => Expenses.expenseForm()], ['Owner draw', () => Banking.txForm({ category: 'owner_draw' })], ['Equipment purchase', () => Expenses.expenseForm({ category: 'equipment' })]]],
    ['Banking', [['Bank deposit', () => Banking.txForm({ category: 'other_income' })], ['Import bank CSV', () => Banking.importCSV()], ['Owner contribution', () => Banking.txForm({ category: 'owner_contrib' })]]],
    ['Planning', [['Ask your books', () => Assistant.open()], ['Tax savings plan', () => go('tax')], ['Cash-flow forecast', () => go('projections')], ['Run a report', () => go('reports')], ['Update business profile', () => { go('tax'); setTimeout(() => TaxUI.setTab('profile')); }]]],
  ];
  const go = r => { location.hash = '#/' + r; };

  function setupTopbar() {
    $('#burger').innerHTML = I('menu');
    $('#new-btn').innerHTML = `${I('plus')}<span>New</span>`;
    $('#ask-btn').innerHTML = `${I('spark')}<span>Ask</span><kbd>${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd>`;
    $('#ask-btn').onclick = () => Assistant.open();
    $('#help-btn').innerHTML = I('help');
    $('#bell').innerHTML = I('bell');
    $('#gear-btn').innerHTML = I('gear');
    $('#tb-search').insertAdjacentHTML('afterbegin', I('search'));
    $('#burger').onclick = () => innerWidth <= 860 ? document.body.classList.toggle('nav-open') : (document.body.classList.toggle('nav-mini'), localStorage.setItem('tl.navmini', document.body.classList.contains('nav-mini') ? 1 : ''));
    if (localStorage.getItem('tl.navmini')) document.body.classList.add('nav-mini');
    const nm = $('#new-menu');
    nm.innerHTML = NEW_MENU.map(([h, items], gi) => `<div><h5>${h}</h5>${items.map(([l], ii) => `<a href="javascript:void 0" data-n="${gi}.${ii}">${l}</a>`).join('')}</div>`).join('');
    nm.onclick = e => { const a = e.target.closest('[data-n]'); if (!a) return; const [g, i] = a.dataset.n.split('.'); nm.classList.remove('open'); NEW_MENU[g][1][i][1](); };
    $('#new-btn').onclick = e => { e.stopPropagation(); $('#notif-pop').classList.remove('open'); nm.classList.toggle('open'); };
    $('#bell').onclick = e => { e.stopPropagation(); nm.classList.remove('open'); $('#notif-pop').classList.toggle('open'); };
    document.addEventListener('click', e => {
      if (!e.target.closest('#new-menu,#new-btn')) nm.classList.remove('open');
      if (!e.target.closest('#notif-pop,#bell')) $('#notif-pop').classList.remove('open');
      if (!e.target.closest('#tb-search')) $('#search-pop').classList.remove('open');
      if (!e.target.closest('#user-menu')) $('#user-menu')?.classList.remove('open');
    });
    $('#scrim').onclick = closeAll;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Assistant.open(); }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); }
    });
    setupSearch();
  }

  function renderBell() {
    const s = Store.state, F = Fmt.money, items = [];
    const over = s.invoices.filter(i => Ledger.invoiceStatus(i) === 'overdue');
    if (over.length) items.push(['bad', `${over.length} overdue invoice${over.length > 1 ? 's' : ''}`, `${F(over.reduce((a, i) => a + Ledger.invTotal(i), 0))} past due`, '#/invoices']);
    const rev = s.transactions.filter(t => t.review).length;
    if (rev) items.push(['warn', `${rev} bank transaction${rev > 1 ? 's' : ''} to review`, 'Categorise them so reports stay accurate', '#/banking']);
    const d = new Date(), y = d.getFullYear();
    const due = [[`${y}-01-15`, 'Q4 estimated tax'], [`${y}-04-15`, 'Q1 estimated tax'], [`${y}-06-15`, 'Q2 estimated tax'], [`${y}-09-15`, 'Q3 estimated tax'], [`${y + 1}-01-15`, 'Q4 estimated tax']]
      .find(([dt]) => new Date(dt) >= d);
    if (due) items.push(['info', `${due[1]} due ${Fmt.date(due[0])}`, 'See your set-aside amount in Cash flow & forecast', '#/projections']);
    if (s.onboarded) items.push(['good', 'Tax plan ready', 'Review the strategies the engine found', '#/tax']);
    $('#bell').innerHTML = I('bell') + (items.some(i => i[0] === 'bad' || i[0] === 'warn') ? '<span class="dot"></span>' : '');
    $('#notif-pop').innerHTML = `<div style="padding:14px 16px;border-bottom:1px solid var(--line)"><h3>Notifications</h3></div>` +
      items.map(([k, t, d, h]) => `<a href="${h}" style="display:flex;gap:12px;padding:12px 16px;color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line-2)"><span class="badge b-${k} nodot" style="height:22px">${k === 'bad' ? '!' : k === 'warn' ? '•' : 'i'}</span><span><b style="display:block;font-size:13.5px">${t}</b><span class="small muted">${d}</span></span></a>`).join('');
  }

  function setupSearch() {
    const inp = $('#search'), pop = $('#search-pop');
    const PAGES = NAV.filter(n => n[0] !== 'sec').map(n => [n[1], '#/' + n[0]]).concat([['Profit & loss report', '#/reports?r=pl'], ['Balance sheet', '#/reports?r=bs'], ['A/R aging', '#/reports?r=ar']]);
    let sel = 0;
    const run = () => {
      const q = inp.value.trim().toLowerCase(); if (!q) { pop.classList.remove('open'); return; }
      const s = Store.state, F = Fmt.money, out = [];
      const pages = PAGES.filter(p => p[0].toLowerCase().includes(q)).slice(0, 4);
      if (pages.length) out.push(['Pages', pages.map(p => [p[0], 'Go to page', p[1]])]);
      const cust = Sales.customers().filter(c => c.name.toLowerCase().includes(q)).slice(0, 4);
      if (cust.length) out.push(['Customers', cust.map(c => [c.name, c.open ? `${F(c.open)} open` : 'Customer', `javascript:Sales.customerDetail(${JSON.stringify(c.name).replace(/"/g, '&quot;')})`])]);
      const inv = s.invoices.filter(i => `${i.number} ${i.client}`.toLowerCase().includes(q)).slice(0, 5);
      if (inv.length) out.push(['Invoices', inv.map(i => [`${i.number}, ${i.client}`, F(Ledger.invTotal(i)), `javascript:Sales.viewInvoice('${i.id}')`])]);
      const tx = s.transactions.filter(t => `${t.desc} ${t.payee} ${t.amount}`.toLowerCase().includes(q)).slice(-6).reverse();
      if (tx.length) out.push(['Transactions', tx.map(t => [t.desc, `${Fmt.date(t.date)}, ${F(t.amount, 2)}`, `javascript:Banking.editTx('${t.id}')`])]);
      pop.innerHTML = out.length ? out.map(([g, rows]) => `<div class="grp">${g}</div>` + rows.map(([a, b, h]) => `<a href="${h}">${Fmt.esc(a)}<small>${b}</small></a>`).join('')).join('') : '<div class="empty small">No results</div>';
      pop.classList.add('open'); sel = 0; mark();
    };
    const mark = () => $$('a', pop).forEach((a, i) => a.classList.toggle('sel', i === sel));
    inp.addEventListener('input', run);
    inp.addEventListener('focus', run);
    inp.addEventListener('keydown', e => {
      const links = $$('a', pop);
      if (e.key === 'ArrowDown') { sel = Math.min(links.length - 1, sel + 1); mark(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      if (e.key === 'Enter' && links[sel]) { links[sel].click(); inp.value = ''; inp.blur(); pop.classList.remove('open'); }
    });
    pop.addEventListener('click', () => { inp.value = ''; pop.classList.remove('open'); });
  }

  function renderUser() {
    const u = window.__user; if (!u) return;
    const initials = u.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    $('#user-menu').innerHTML = `<button class="avatar-btn" onclick="this.parentElement.classList.toggle('open')"><span class="avatar">${Fmt.esc(initials)}</span><span class="u-name">${Fmt.esc(u.name.split(' ')[0])}</span>${I('down')}</button>
      <div class="dropdown"><div class="dd-head"><span class="avatar" style="width:42px;height:42px;font-size:15px">${Fmt.esc(initials)}</span><div><b>${Fmt.esc(u.name)}</b><div class="muted small">${Fmt.esc(u.email)}</div>${u.isDemo ? '<span class="badge b-warn" style="margin-top:6px">Demo account</span>' : `<span class="badge b-good" style="margin-top:6px;text-transform:capitalize">${u.plan} plan</span>`}</div></div>
        <a href="#/account">${I('users')} Account & security</a><a href="#/settings">${I('settings')} Company & data</a><a href="#/onboarding">${I('spark')} Re-run setup wizard</a><a href="index.html" target="_blank">${I('home')} Visit website</a>
        <a href="javascript:App.logout()" class="dd-out">${I('back')} Sign out</a></div>`;
  }
  function demoBar() {
    if (!window.__user?.isDemo || $('.demo-bar')) return;
    const b = document.createElement('div'); b.className = 'demo-bar no-print';
    b.innerHTML = `<span>You're exploring the <b>demo company</b> — data is sample and stays in this browser.</span><span class="spacer"></span><a href="signup.html">Create your free account</a>`;
    $('#main').prepend(b);
  }
  function logout() { Auth.logout(); location.href = 'login.html?out=1'; }

  function start() {
    if (!window.__user) return; // redirecting to login
    Store.load(window.__user);
    setupTopbar(); renderUser(); demoBar();
    window.addEventListener('hashchange', render);
    $('#modal-bg').addEventListener('mousedown', e => { if (e.target.id === 'modal-bg') closeModal(); });
    if (!Store.state.onboarded && current() !== 'onboarding') { location.hash = '#/onboarding'; return; }
    render();
  }

  return { register, render, toast, modal, closeModal, drawer, full, closeAll, menu, chart, download, csv, start, COLORS, current, logout, renderUser, go, renderNav, animate, scene, stamp };
})();

/* =========================================================================
   DataTable — sortable, selectable, paginated table used across the app
   ========================================================================= */
const DataTable = (() => {
  const st = {};
  function render(id, cfg) {
    const s = st[id] = st[id] || { sort: cfg.sort || null, dir: cfg.dir || -1, page: 0, sel: new Set() };
    s.cfg = cfg;
    let rows = [...cfg.rows];
    if (s.sort) { const col = cfg.cols.find(c => c.key === s.sort); const v = col?.val || (r => r[s.sort]);
      rows.sort((a, b) => { const x = v(a), y = v(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * s.dir; }); }
    const size = cfg.pageSize || 25, pages = Math.max(1, Math.ceil(rows.length / size));
    s.page = Math.min(s.page, pages - 1);
    const view = rows.slice(s.page * size, s.page * size + size);
    s.ids = rows.map(r => r.id);
    const allSel = view.length && view.every(r => s.sel.has(r.id));
    return `<div id="dt-${id}">
      ${cfg.batch ? `<div class="batch ${s.sel.size ? 'show' : ''}"><span>${s.sel.size} selected</span>${cfg.batch.map((b, i) => `<button class="btn sm" onclick="DataTable.batch('${id}',${i})">${b[0]}</button>`).join('')}<button class="link" onclick="DataTable.clear('${id}')">Clear</button></div>` : ''}
      <div class="table-wrap"><table><thead><tr>
        ${cfg.batch ? `<th class="cb"><input type="checkbox" ${allSel ? 'checked' : ''} onclick="DataTable.toggleAll('${id}',this.checked)"/></th>` : ''}
        ${cfg.cols.map(c => `<th class="${c.cls || ''} ${c.nosort ? '' : 'sort'} ${s.sort === c.key ? 'sorted' : ''}" ${c.nosort ? '' : `onclick="DataTable.sortBy('${id}','${c.key}')"`}>${c.label}${c.nosort ? '' : `<span class="arr">${s.sort === c.key ? (s.dir > 0 ? '▲' : '▼') : '▲'}</span>`}</th>`).join('')}
      </tr></thead><tbody>
        ${view.map(r => `<tr class="${s.sel.has(r.id) ? 'sel' : ''}">${cfg.batch ? `<td class="cb"><input type="checkbox" ${s.sel.has(r.id) ? 'checked' : ''} onclick="DataTable.toggle('${id}','${r.id}',this.checked)"/></td>` : ''}
          ${cfg.cols.map(c => `<td class="${c.cls || ''}">${c.render ? c.render(r) : Fmt.esc(r[c.key])}</td>`).join('')}</tr>`).join('') ||
          `<tr><td colspan="${cfg.cols.length + (cfg.batch ? 1 : 0)}">${cfg.empty || '<div class="empty">Nothing here yet.</div>'}</td></tr>`}
      </tbody>${cfg.foot ? `<tfoot>${cfg.foot}</tfoot>` : ''}</table></div>
      ${rows.length > size ? `<div class="pager"><span>${s.page * size + 1}–${Math.min(rows.length, (s.page + 1) * size)} of ${rows.length}</span>
        <button ${s.page ? '' : 'disabled'} onclick="DataTable.go('${id}',-1)">‹</button><button ${s.page < pages - 1 ? '' : 'disabled'} onclick="DataTable.go('${id}',1)">›</button></div>` : ''}
    </div>`;
  }
  const re = id => { const el = $('#dt-' + id); if (el) el.outerHTML = render(id, st[id].cfg); };
  return {
    render,
    sortBy(id, k) { const s = st[id]; s.dir = s.sort === k ? -s.dir : (k === 'date' || k === 'amount' ? -1 : 1); s.sort = k; re(id); },
    go(id, d) { st[id].page += d; re(id); },
    toggle(id, rid, on) { on ? st[id].sel.add(rid) : st[id].sel.delete(rid); re(id); },
    toggleAll(id, on) { const s = st[id], size = s.cfg.pageSize || 25; s.ids.slice(s.page * size, s.page * size + size).forEach(r => on ? s.sel.add(r) : s.sel.delete(r)); re(id); },
    clear(id) { st[id].sel.clear(); re(id); },
    batch(id, i) { const s = st[id]; const ids = [...s.sel]; s.sel.clear(); s.cfg.batch[i][1](ids); },
    reset(id) { if (st[id]) { st[id].page = 0; st[id].sel.clear(); } },
  };
})();
