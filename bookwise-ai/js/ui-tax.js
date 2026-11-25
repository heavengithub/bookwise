/* =========================================================================
   Bookwise — Tax Optimizer page
   ========================================================================= */
const Optimizer = {
  normalize(p) {
    const n = {};
    for (const k in p) n[k] = (typeof DEFAULT_TAX_PROFILE[k] === 'number') ? (+p[k] || 0) : p[k];
    n.owners = Math.max(1, Math.round(n.owners));
    n.sstb = !!(INDUSTRIES.find(i => i.id === p.industry) || {}).sstb;
    n.hasRetirementPlan = !!p.hasRetirementPlan; n.considerDB = !!p.considerDB;
    return n;
  },
  syncFromBooks() {
    const s = Store.state, f = Ledger.taxFigures(s);
    Object.assign(s.taxProfile, { revenue: f.revenue, cogs: f.cogs, opex: f.opex, employeeWages: f.employeeWages });
    s.taxSynced = { from: f.from, to: f.to };
    Store.save();
    return f;
  },
  analysis() {
    if (Store.state.autoSync && !Store.state.taxSynced && Store.state.transactions.length) this.syncFromBooks();
    return Strategies.analyze(this.normalize(Store.state.taxProfile)); },
};

const TaxUI = (() => {
  let tab = 'results';
  const F = Fmt.money;

  const FIELDS = [
    ['Business basics', [
      ['industry', 'Industry', 'select', INDUSTRIES.map(i => [i.id, i.name]), 'SSTB = specified service business for §199A'],
      ['currentEntity', 'Current tax structure', 'select', [['llc', 'Sole prop / single-member LLC'], ['partnership', 'Partnership / multi-member LLC'], ['scorp', 'S corporation'], ['ccorp', 'C corporation']]],
      ['owners', 'Number of owners', 'num', null, 'Profit split equally'],
      ['yearsInBusiness', 'Years in business', 'num'],
      ['stateChoice', 'State', 'select', US_STATES.map(s => [s[0], s[0]])],
      ['stateRate', 'State income tax rate', 'pct', null, 'Approx. marginal — edit to match yours'],
    ]],
    ['Annual financials (whole business)', [
      ['revenue', 'Gross revenue', 'money'],
      ['cogs', 'Cost of goods sold', 'money'],
      ['opex', 'Operating expenses', 'money', null, 'Excl. employee wages, payroll tax & owner pay'],
      ['employeeWages', 'Employee wages (non-owner)', 'money', null, 'Employer payroll tax is added automatically'],
      ['employees', 'Number of employees', 'num'],
      ['avgEmployeeWage', 'Average employee wage', 'money'],
      ['ubia', 'Depreciable property basis (UBIA)', 'money', null, 'Used for the QBI wage/property limit'],
    ]],
    ['Owner & household', [
      ['filingStatus', 'Filing status', 'select', [['mfj', 'Married filing jointly'], ['single', 'Single']]],
      ['ownerAge', 'Owner age', 'num', null, 'Drives catch-up & cash-balance limits'],
      ['otherIncome', 'Other household income', 'money', null, 'e.g. spouse W-2 wages'],
      ['propertyTax', 'Personal property tax', 'money', null, 'For SALT / PTET math'],
      ['minSalary', 'Minimum reasonable salary (S/C corp)', 'money', null, '0 = use industry estimate'],
      ['payrollAdmin', 'Payroll & 1120-S prep cost', 'money'],
      ['corpCompliance', 'Extra C-corp compliance cost', 'money'],
      ['distributionPct', 'C corp: % of profit paid as dividends', 'pct'],
    ]],
    ['Health & retirement', [
      ['healthPremiums', 'Owner health premiums (per owner)', 'money'],
      ['hsaCoverage', 'HSA-eligible plan', 'select', [['none', 'No'], ['self', 'Yes — self-only'], ['family', 'Yes — family']]],
      ['considerDB', 'Consider a cash-balance plan', 'check'],
      ['hasRetirementPlan', 'Already offers employees a retirement plan', 'check'],
      ['planStartupCost', 'Plan setup / admin cost', 'money'],
    ]],
    ['Planned purchases & expenses this year', [
      ['plannedEquipment', 'Equipment / machinery / software', 'money'],
      ['vehicleCost', 'Heavy vehicle (> 6,000 lb) cost', 'money'],
      ['vehicleBizUse', 'Vehicle business-use %', 'pct'],
      ['businessMiles', 'Business miles in personal car', 'num'],
      ['homeOfficeSqft', 'Home office sq ft (per owner)', 'num'],
      ['augustaDays', 'Days renting your home to the business', 'num', null, 'Max 14'],
      ['augustaRate', 'Fair daily rental rate', 'money'],
    ]],
    ['Family', [
      ['kids', 'Children who can work in the business', 'num'],
      ['kidWage', 'Wage per child', 'money'],
    ]],
    ['Credits', [
      ['rdSpend', 'Qualified research spend this year', 'money'],
      ['rdPriorAvg', 'Avg. research spend, prior 3 yrs', 'money'],
      ['wotcHires', 'New hires from WOTC target groups', 'num'],
      ['employerHealth', 'Employer-paid employee health premiums', 'money'],
      ['childcareSpend', 'Employer childcare spending', 'money'],
      ['exitGain', 'Expected gain if you sell the company', 'money', null, 'For QSBS (§1202)'],
    ]],
  ];

  function field([k, label, type, opts, hint]) {
    const v = Store.state.taxProfile[k];
    let input;
    if (type === 'select') input = `<select data-k="${k}">${opts.map(([val, t]) => `<option value="${Fmt.esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    else if (type === 'check') return `<label class="check"><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}/> ${label}</label>`;
    else if (type === 'money') input = `<div class="money-in"><input type="number" step="100" data-k="${k}" value="${v}"/></div>`;
    else input = `<input type="number" step="${type === 'pct' ? '0.01' : '1'}" data-k="${k}" value="${v}"/>`;
    return `<label class="f">${label}${input}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  }

  function profileTab() {
    const s = Store.state;
    return `<div class="card">
      <div class="card-h"><div><h2>Business profile</h2><div class="muted small">Every number feeds the engine. Changes save automatically.</div></div>
      <button class="btn" onclick="TaxUI.sync()">${ICONS.tx} Pull financials from my books</button></div>
      ${s.taxSynced ? `<div class="note info" style="margin-bottom:14px">Financials pulled from your books for ${Fmt.date(s.taxSynced.from)} – ${Fmt.date(s.taxSynced.to)}. Edit any figure to model a different year.</div>` : ''}
      ${FIELDS.map(([title, fs]) => `<fieldset><legend>${title}</legend><div class="form-grid">${fs.map(field).join('')}</div></fieldset>`).join('')}
      <div class="row"><span class="spacer"></span><button class="btn primary" onclick="TaxUI.setTab('results')">See my savings</button></div>
    </div>`;
  }

  const TYPE_BADGE = { permanent: ['Permanent saving', 'b-good'], timing: ['Timing / deferral', 'b-info'], credit: ['Tax credit', 'b-good'], info: ['Planning', 'b-gray'], future: ['Future / exit', 'b-warn'] };

  function resultsTab(a) {
    const n = Store.state.taxProfile.owners;
    const E = a.cmp, O = a.optimized;
    const ent = e => {
      const pre = E[e], post = O[e].result, best = e === a.bestE;
      return `<div class="entity ${best ? 'best' : ''}">${best ? '<span class="tag">RECOMMENDED</span>' : ''}
        <h3>${Strategies.ENTITY_NAMES[e]}</h3>
        <div class="t">${F(post.bizTax * n)}</div>
        <div class="muted small">tax caused by the business with full plan, ${Fmt.pct(post.profit > 0 ? post.bizTax / post.profit : 0)} effective</div>
        <table style="margin-top:10px"><tbody>
          <tr><td class="muted">Before strategies</td><td class="r">${F(pre.bizTax * n)}</td></tr>
          ${e !== 'llc' ? `<tr><td class="muted">Optimal owner salary</td><td class="r">${F(post.salary)}</td></tr>` : ''}
          ${e === 'ccorp' ? `<tr><td class="muted">Retained in company</td><td class="r">${F(post.retained * n)}</td></tr>` : `<tr><td class="muted">QBI deduction</td><td class="r">${F(post.qbiDed * n)}</td></tr>`}
          <tr><td class="muted">Payroll / SE tax</td><td class="r">${F(post.payroll * n)}</td></tr>
          <tr><td class="muted">Retirement sheltered</td><td class="r">${F(post.retire * n)}</td></tr>
        </tbody></table></div>`;
    };
    const strat = s => {
      const [bt, bc] = TYPE_BADGE[s.type];
      return `<div class="strat ${s.applies ? '' : 'na'}" id="s-${s.id}">
        <div class="strat-h" onclick="this.parentElement.classList.toggle('open')">
          <div><div class="row" style="gap:8px"><span class="title">${s.title}</span><span class="badge ${bc}">${bt}</span><span class="badge b-gray">${s.cat}</span></div>
            <div class="code">${s.code}</div><div class="small" style="margin-top:4px;color:var(--ink-2)">${s.summary}</div></div>
          <div class="amt">${s.savings > 0 ? F(s.savings) : '—'}<small>${s.savings > 0 ? (s.type === 'timing' ? 'deferred / yr' : s.type === 'future' ? 'at exit' : 'per year') : ''}</small></div>
        </div>
        <div class="strat-b">${s.details}
          ${s.steps.length ? `<h4>How to do it</h4><ol>${s.steps.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
          <div class="pill-row"><span class="badge ${s.risk === 'Low' ? 'b-good' : 'b-warn'}">Audit risk: ${s.risk}</span></div>
          <div class="ai-explain"><div class="row" style="gap:8px">${I('spark')}<b>Explain this</b><div class="seg">${[['plain', 'In plain English'], ['owner', 'For an owner'], ['cpa', 'For my CPA']].map(([k, l]) => `<button onclick="TaxUI.explain('${s.id}','${k}',this)">${l}</button>`).join('')}</div><span class="ai-tag"></span></div><div class="ai-out"></div></div>
        </div></div>`;
    };
    const tp = Store.state.taxProfile;
    return `
      <div class="card savings-banner">
        <div><div class="kpi"><div class="label">Estimated annual tax savings</div><div class="big num" data-count="${a.totalSavings}">${F(a.totalSavings)}</div>
          <div class="muted small">vs. staying as ${Strategies.ENTITY_NAMES[tp.currentEntity === 'partnership' ? 'llc' : tp.currentEntity]} with no planning</div></div></div>
        <div><div class="kpi"><div class="label">Tax today</div><div class="value">${F(a.currentTax)}</div><div class="delta">all owners, fed + state + payroll</div></div></div>
        <div><div class="kpi"><div class="label">Tax with plan</div><div class="value up">${F(a.planTax - a.credTotal - a.ptet)}</div><div class="delta">after ${F(a.credTotal + a.ptet)} credits & PTET</div></div></div>
        <div><div class="kpi"><div class="label">Recommended</div><div class="value" style="font-size:19px">${Strategies.ENTITY_NAMES[a.bestE]}</div><div class="delta">on ${F(a.profit)} profit before owner pay</div></div></div>
      </div>

      <div class="grid g-2-1" style="margin-top:16px">
        <div class="card"><div class="card-h"><h2>Entity comparison</h2><span class="muted small">Engine tests every salary level for S & C corps</span></div>
          <div class="entity-cols">${['llc', 'scorp', 'ccorp'].map(ent).join('')}</div></div>
        <div class="card"><div class="card-h"><h2>Before vs. after</h2></div><div class="chart-box sm"><canvas id="c-entity"></canvas></div></div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-h"><div><h2>Your tax-saving strategies</h2><div class="muted small">Each saving is calculated by re-running your full return under ${Strategies.ENTITY_NAMES[a.bestE]}. Click any strategy for the law, the math and the steps.</div></div>
          <div class="row"><button class="btn sm" onclick="$$('.strat').forEach(e=>e.classList.add('open'))">Expand all</button><button class="btn sm" onclick="$$('.strat').forEach(e=>e.classList.remove('open'))">Collapse</button></div></div>
        ${a.strategies.map(strat).join('')}
        <div class="muted small" style="margin-top:8px">Individual savings interact (e.g. retirement contributions change your bracket), so they don't add exactly to the total — the headline figure runs everything together.</div>
      </div>

      <div class="card"><div class="card-h"><h2>Year-round checklist</h2></div>
        <div class="grid g3">${a.tips.map(([t, c, d]) => `<div><h3>${t}</h3><div class="code" style="font-family:var(--mono);font-size:11.5px;color:var(--ink-3)">${c}</div><p class="small" style="margin-top:4px">${d}</p></div>`).join('')}</div>
      </div>
      <div class="note" style="margin-top:16px">Educational estimates using ${TAX.year} federal rules and a flat state rate. They aren't tax, legal or accounting advice. Confirm eligibility, reasonable compensation and state rules with a CPA or enrolled agent before acting.</div>`;
  }

  function deepTab(a) {
    const n = Store.state.taxProfile.owners;
    const cols = ['llc', 'scorp', 'ccorp'].map(e => a.optimized[e].result);
    const labels = new Set(); cols.forEach(c => c.lines.forEach(l => labels.add(l[0])));
    const val = (c, l) => { const f = c.lines.find(x => x[0] === l); return f ? F(f[1] * n) : '—'; };
    return `<div class="card"><div class="card-h"><div><h2>Line-by-line, full plan applied</h2><div class="muted small">All owners combined. Household tax includes tax on other income (${F(Store.state.taxProfile.otherIncome)}).</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Item</th>${cols.map(c => `<th class="r">${c.label}</th>`).join('')}</tr></thead><tbody>
        <tr><td>Profit before owner pay</td>${cols.map(c => `<td class="r">${F(c.profit * n)}</td>`).join('')}</tr>
        <tr><td>Owner salary (W-2)</td>${cols.map(c => `<td class="r">${F(c.salary * n)}</td>`).join('')}</tr>
        <tr><td>Retirement / HSA sheltered</td>${cols.map(c => `<td class="r">${F((c.retire + c.hsa) * n)}</td>`).join('')}</tr>
        <tr><td>Adjusted gross income (per owner)</td>${cols.map(c => `<td class="r">${F(c.agi)}</td>`).join('')}</tr>
        <tr><td>QBI deduction (per owner)</td>${cols.map(c => `<td class="r">${F(c.qbiDed)}</td>`).join('')}</tr>
        <tr><td>Taxable income (per owner)</td>${cols.map(c => `<td class="r">${F(c.ti)}</td>`).join('')}</tr>
        <tr><td>Marginal federal bracket</td>${cols.map(c => `<td class="r">${Fmt.pct(c.marginal, 0)}</td>`).join('')}</tr>
        ${[...labels].map(l => `<tr class="indent"><td>${l}</td>${cols.map(c => `<td class="r">${val(c, l)}</td>`).join('')}</tr>`).join('')}
        <tr class="total"><td>Total household tax + costs</td>${cols.map(c => `<td class="r">${F(c.total * n)}</td>`).join('')}</tr>
        <tr class="sub"><td>Of which caused by the business</td>${cols.map(c => `<td class="r">${F(c.bizTax * n)}</td>`).join('')}</tr>
      </tbody></table></div></div>
      <div class="card"><div class="card-h"><div><h2>S-corp salary sensitivity</h2><div class="muted small">Total tax at each salary level — the dot is the optimum the engine chose.</div></div></div>
        <div class="chart-box"><canvas id="c-salary"></canvas></div></div>`;
  }

  function render() {
    const a = Optimizer.analysis();
    TaxUI._a = a;
    return `<div class="tabs">
        <button class="tab ${tab === 'results' ? 'active' : ''}" onclick="TaxUI.setTab('results')">Savings plan</button>
        <button class="tab ${tab === 'profile' ? 'active' : ''}" onclick="TaxUI.setTab('profile')">Business profile</button>
        <button class="tab ${tab === 'deep' ? 'active' : ''}" onclick="TaxUI.setTab('deep')">Entity deep-dive</button>
        <button class="tab ${tab === 'terrain' ? 'active' : ''}" onclick="TaxUI.setTab('terrain')">3D tax terrain</button>
      </div>${tab === 'profile' ? profileTab() : tab === 'deep' ? deepTab(a) : tab === 'terrain' ? terrainTab(a) : resultsTab(a)}`;
  }

  function terrainGrid(a) {
    const inp = Optimizer.normalize(Store.state.taxProfile), n = inp.owners;
    const adj = { ...a.optimized.scorp.adj }; delete adj.db;
    const p = TaxEngine.profitBeforeOwner(inp, adj) / n;
    const NX = 28, NY = 22, xs = [], ys = [], grid = [];
    for (let i = 0; i < NX; i++) xs.push(Math.round(p / 1.0765 * .9 * i / (NX - 1)));
    const ymax = Math.max(5000, Math.min(80000, p * .35));
    for (let j = 0; j < NY; j++) ys.push(Math.round(ymax * j / (NY - 1)));
    const floor = a.optimized.scorp.result.salaryFloor || 0;
    let best = { i: 0, j: 0, v: Infinity };
    ys.forEach((y, j) => { grid.push(xs.map((x, i) => { const v = TaxEngine.calcS(inp, { ...adj, db: y }, x).total * n; if (x >= floor && v < best.v) best = { i, j, v }; return v; })); });
    const floorI = xs.findIndex(x => x >= floor);
    return { grid, xs, ys, best, p, floorI: Math.max(0, floorI) };
  }
  function terrainTab(a) {
    const g = TaxUI._g = terrainGrid(a), b = g.best, F0 = Fmt.money;
    return `<div class="grid g-2-1"><div class="card flush"><div class="three-box" id="terrain" style="height:520px"><div class="tip3d" id="terrain-tip"></div><div class="hint3d">Drag to turn, scroll to zoom, hover the surface for exact figures.</div></div></div>
      <div class="card"><h2>Reading the terrain</h2>
        <p class="small" style="margin-top:8px">Each point is a full S-corp tax return for ${Fmt.esc(Store.state.company.name.replace(/\.$/, ''))}. Left to right is the salary you pay yourself; front to back is extra money put into a cash-balance retirement plan. Height and color show total household tax: green is low, red is high.</p>
        <table style="margin-top:14px"><tbody>
          <tr><td>Lowest allowed point</td><td class="r"><b><span class="hl">${F0(b.v)}</span></b></td></tr>
          <tr><td>Salary there</td><td class="r">${F0(g.xs[b.i])}</td></tr>
          <tr><td>Extra retirement there</td><td class="r">${F0(g.ys[b.j])}</td></tr>
          <tr><td>Highest point</td><td class="r">${F0(Math.max(...g.grid.flat()))}</td></tr>
        </tbody></table>
        <p class="small muted" style="margin-top:12px">The valley runs along low salaries because payroll tax applies to salary but not distributions, until the reasonable-salary floor and the 401(k) limit pull it back. Bigger retirement contributions lower the surface until they exceed what the profit can support.</p>
        <div class="note info" style="margin-top:12px">The red shaded strip marks salaries below a reasonable wage for your role (${F0(a.optimized.scorp.result.salaryFloor || 0)}). The IRS doesn't allow those, so the lowest point is picked from the rest.</div></div></div>`;
  }

  function mount() {
    const a = TaxUI._a, n = Store.state.taxProfile.owners;
    if (tab === 'terrain') {
      const g = TaxUI._g, tipEl = $('#terrain-tip');
      App.scene($('#terrain'), S => S.terrain($('#terrain'), { ...g, fmt: Fmt.short,
        tip: d => { if (!d) { tipEl.style.display = 'none'; return; } tipEl.style.display = 'block'; tipEl.style.left = d.x + 14 + 'px'; tipEl.style.top = d.y - 10 + 'px';
          tipEl.innerHTML = `Salary <b class="num">${Fmt.money(d.salary)}</b><br>Extra retirement <b class="num">${Fmt.money(d.contrib)}</b><br>Total tax <b class="num">${Fmt.money(d.tax)}</b>`; } }));
    }
    $$('[data-k]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.k, tp = Store.state.taxProfile;
      tp[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? +el.value : el.value);
      if (k === 'stateChoice') { const st = US_STATES.find(x => x[0] === el.value); if (st && st[1] !== null) { tp.stateRate = st[1]; $('[data-k=stateRate]').value = st[1]; } }
      Store.save(); App.toast('Saved — savings recalculated');
    }));
    if (tab === 'results') {
      App.chart('c-entity', { type: 'bar', data: { labels: ['LLC', 'S corp', 'C corp'], datasets: [
        { label: 'Before strategies', data: ['llc', 'scorp', 'ccorp'].map(e => a.cmp[e].bizTax * n), backgroundColor: App.COLORS.gray, borderRadius: 4 },
        { label: 'With full plan', data: ['llc', 'scorp', 'ccorp'].map(e => a.optimized[e].result.bizTax * n), backgroundColor: App.COLORS.brand, borderRadius: 4 }] },
        options: { plugins: { legend: { position: 'bottom' } } } });
    }
    if (tab === 'deep') {
      const inp = Optimizer.normalize(Store.state.taxProfile);
      const adj = a.optimized.scorp.adj, p = TaxEngine.profitBeforeOwner(inp, adj) / n;
      const pts = []; for (let i = 0; i <= 40; i++) { const sal = p / 1.0765 * i / 40; pts.push({ x: sal, y: TaxEngine.calcS(inp, adj, sal).total * n }); }
      const opt = a.optimized.scorp.result;
      App.chart('c-salary', { type: 'line', data: { datasets: [
        { label: 'Total tax', data: pts, borderColor: App.COLORS.brand, pointRadius: 0, tension: .2, borderWidth: 2 },
        { label: 'Optimal salary', data: [{ x: opt.salary, y: opt.total * n }], borderColor: App.COLORS.accent, backgroundColor: App.COLORS.accent, pointRadius: 6, showLine: false }] },
        options: { scales: { x: { type: 'linear', ticks: { callback: v => Fmt.short(v) }, title: { display: true, text: 'Owner salary' } } },
          plugins: { tooltip: { callbacks: { label: c => `Salary ${Fmt.money(c.parsed.x)} tax ${Fmt.money(c.parsed.y)}` } } } } });
    }
  }

  return {
    setTab(t) { tab = t; App.render(); },
    async explain(id, level, btn) {
      const st = TaxUI._a.strategies.find(x => x.id === id), box = btn.closest('.ai-explain');
      $$('.seg button', box).forEach(b => b.classList.toggle('on', b === btn));
      const out = $('.ai-out', box); out.innerHTML = '<span class="ai-dots"><i></i><i></i><i></i></span>';
      const r = await AI.explain(st, level);
      $('.ai-tag', box).textContent = r.by === 'Claude' ? 'Claude' : 'Built-in';
      await AI.type(out, r.html, 7);
    },
    sync() { const f = Optimizer.syncFromBooks(); App.toast(`Pulled ${Fmt.money(f.revenue)} revenue from your books`); App.render(); },
    render, mount,
  };
})();

App.register('tax', {
  title: 'Tax optimizer', crumb: 'Taxes', sub: () => `${TAX.year} federal rules, LLC vs S-corp vs C-corp, ${Store.state.company.name}`,
  actions: () => `<button class="btn" onclick="TaxUI.setTab('profile')">Edit profile</button><button class="btn primary" onclick="window.print()">${ICONS.dl} Print plan</button>`,
  render: TaxUI.render, mount: TaxUI.mount,
});
