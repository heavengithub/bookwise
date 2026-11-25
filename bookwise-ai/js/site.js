/* Bookwise — public site behaviour */
(() => {
  const $ = s => document.querySelector(s);
  $('#yr') && ($('#yr').textContent = new Date().getFullYear());
  document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => $('#links').classList.remove('open')));

  /* Monthly / yearly pricing */
  document.querySelectorAll('[data-bill]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-bill]').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.price[data-m]').forEach(p => { p.innerHTML = `$${p.dataset[b.dataset.bill]}<small> a month${b.dataset.bill === 'y' ? ', billed yearly' : ''}</small>`; });
  }));

  /* S-corp worksheet: same engine as the app */
  const st = $('#e-state');
  if (st) {
    US_STATES.filter(s => s[1] !== null).forEach(([n, r]) => st.insertAdjacentHTML('beforeend', `<option value="${r}" ${n === 'Ohio' ? 'selected' : ''}>${n.split(' (')[0]}${r ? `, ${r}%` : ''}</option>`));
    const calc = () => {
      const profit = +$('#e-profit').value;
      $('#e-val').textContent = Fmt.money(profit);
      const inp = { ...DEFAULT_TAX_PROFILE, revenue: profit, cogs: 0, opex: 0, employeeWages: 0, employees: 0, otherIncome: 0,
        filingStatus: $('#e-status').value, stateRate: +st.value, owners: 1, healthPremiums: 0, industry: 'other', sstb: false,
        minSalary: Math.round(profit * 0.4), payrollAdmin: 1800, ubia: 0 };
      const llc = TaxEngine.calcLLC(inp, {});
      const s = TaxEngine.run('scorp', inp, {});
      const save = llc.total - s.total;
      $('#e-llc').textContent = Fmt.money(llc.bizTax);
      $('#e-s').textContent = Fmt.money(s.bizTax);
      $('#e-sal').textContent = `Owner salary of ${Fmt.money(s.salary)}, the rest taken as distributions`;
      $('#e-save').textContent = save > 0 ? Fmt.money(save) : '$0';
      $('#e-note').textContent = save > 0 ? 'Before retirement plans, deductions and credits, which the full plan adds.'
        : 'At this profit, payroll costs outweigh the savings. Staying an LLC is likely better for now.';
    };
    ['#e-profit', '#e-status', '#e-state'].forEach(id => $(id).addEventListener('input', calc));
    calc();
  }

  /* Contact form: handled by Netlify Forms once deployed */
  const form = $('#contact-form');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#contact-msg');
    try {
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
      if (!r.ok) throw 0;
      form.reset(); msg.style.color = '#2f7d4f'; msg.textContent = 'Message sent. We reply within one business day.';
    } catch { msg.style.color = '#b42318'; msg.textContent = 'The form sends once the site is deployed on Netlify. Until then, it can\'t deliver messages.'; }
  });
})();

/* ---------- motion: highlighters, staggered lists, margin notes, chat demo, 3D hero ---------- */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const once = (els, fn, threshold = .35) => {
    if (still) { els.forEach(fn); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } }), { threshold });
    els.forEach(el => io.observe(el));
  };
  once($$('.hl'), el => el.classList.add('on'), .8);
  // ledger lists print line by line
  $$('.index, .ledger').forEach(el => el.classList.add('pre'));
  once($$('.index, .ledger'), el => { const rows = el.matches('.index') ? [...el.children] : [...el.querySelectorAll('tbody tr')];
    el.classList.remove('pre'); rows.forEach((r, i) => { r.style.transitionDelay = (still ? 0 : i * 45) + 'ms'; }); }, .15);
  once($$('.annot-sheet'), el => el.classList.add('on'), .5);

  // scripted conversation (clearly labelled as an example)
  const body = $('#cd-body'), qEl = $('#cd-q');
  if (body) {
    const script = [
      ['How much did we spend on ads last quarter?', 'You spent <b>$5,212</b> on advertising and marketing in Q3 2026 across 3 transactions. That\'s down 18% on the previous quarter ($6,355).'],
      ['Who owes us money?', 'Customers owe you <b>$57,400</b> across 8 open invoices. Summit Outdoor Gear is 6 days late on INV-1069 for $6,400. A reminder draft is in the invoice menu.'],
      ['Can I afford a $20k truck?', 'Spending $20,000 leaves <b>$123,442</b>, about 4.8 months of outflow, so it looks affordable. A truck over 6,000 lb used mostly for business can be written off this year.'],
    ];
    let k = 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const run = async () => {
      while (true) {
        const [q, a] = script[k % script.length]; k++;
        if (body.children.length > 3) { body.innerHTML = ''; }
        for (let i = 0; i <= q.length; i++) { qEl.textContent = q.slice(0, i); await sleep(still ? 0 : 28); }
        await sleep(350); qEl.textContent = '';
        body.insertAdjacentHTML('beforeend', `<div class="m u">${q}</div>`);
        await sleep(650);
        body.insertAdjacentHTML('beforeend', `<div class="m a">${a}</div>`);
        await sleep(still ? 8000 : 3800);
      }
    };
    once([body], () => run(), .4);
  }

  // 3D hero
  const hv = $('#hero-visual');
  const mount = () => {
    if (!hv || !window.Scenes?.ok || innerWidth <= 960) return;
    const box = document.createElement('div'); box.className = 'hero-3d'; box.setAttribute('aria-hidden', 'true'); hv.appendChild(box);
    try { window.Scenes.heroPaper(box); hv.classList.add('has3d'); } catch { box.remove(); }
  };
  window.Scenes ? mount() : window.addEventListener('scenes-ready', mount, { once: true });
})();
