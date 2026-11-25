/* =========================================================================
   Bookwise — Home dashboard (widget layout)
   ========================================================================= */
const Dash = (() => {
  const F = Fmt.money;
  const per = { pl: 't12', exp: 'ytd', sales: 'ytd' };
  let cf3d = false, brief = null;
  const opts = sel => Ledger.RANGE_OPTS.filter(o => o[0] !== 'all').map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${l}</option>`).join('');

  function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

  function render() {
    const s = Store.state, u = window.__user;
    const fresh = !s.transactions.length && !s.invoices.length;
    const a = Optimizer.analysis();
    const shortcuts = [
      ['Create invoice', 'invoice', '#e7f5ec', '#2f7d4f', 'Sales.invoiceForm()'],
      ['Record expense', 'card', '#fdecea', '#c43d2f', 'Expenses.expenseForm()'],
      ['Receive payment', 'dollar', '#eaf3fd', '#1c2b4a', 'Sales.receivePayment()'],
      ['Add bank deposit', 'bank', '#efeafe', '#6b4fd8', "Banking.txForm({category:'other_income'})"],
      ['Upload bank CSV', 'ul', '#fff4e0', '#b06a00', 'Banking.importCSV()'],
      ['Tax savings plan', 'tax', '#e3f6f5', '#0c8f8f', "App.go('tax')"],
    ];
    const pl = Ledger.pnl(s, ...Ledger.range(per.pl).slice(0, 2));
    const expR = Ledger.range(per.exp), ep = Ledger.pnl(s, expR[0], expR[1]);
    const expItems = [...ep.cogs, ...ep.expense].sort((x, y) => y.amount - x.amount);
    const expTot = expItems.reduce((x, y) => x + y.amount, 0);
    // invoices widget
    const d30 = Ledger.range('last30')[0];
    const unpaid = s.invoices.filter(i => i.status === 'sent'), over = unpaid.filter(i => Ledger.invoiceStatus(i) === 'overdue');
    const sumI = arr => arr.reduce((x, i) => x + Ledger.invTotal(i), 0);
    const uTot = sumI(unpaid), oTot = sumI(over), nTot = uTot - oTot;
    const paid30 = s.invoices.filter(i => i.status === 'paid' && i.paidDate >= d30), pTot = sumI(paid30);
    const cash = Ledger.cashBalance(s), review = s.transactions.filter(t => t.review).length;
    const maxPL = Math.max(pl.totalIncome, pl.totalCogs + pl.totalExpense, 1);
    const top = a.strategies.filter(x => x.applies && x.savings > 0).slice(0, 3);

    return `<div class="greet"><div><div class="small muted" style="font-weight:600">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1>${greeting()}, ${Fmt.esc(u.name.split(' ')[0])}</h1><div class="muted">Here's how ${Fmt.esc(s.company.name)} is doing.</div></div>
        <div class="row"><a class="btn" href="#/reports">${I('reports')} Reports</a><a class="btn" href="#/projections">${I('proj')} Forecast</a></div></div>
      <div class="briefing" id="brief"><div class="b-head">${I('spark')}<b>Morning briefing</b><span class="ai-tag" id="brief-by">reading your books</span><button class="link" style="margin-left:auto" onclick="Assistant.open()">Ask a follow-up</button></div>
        <ol id="brief-list"><li class="skel"></li><li class="skel"></li><li class="skel" style="width:60%"></li></ol></div>
      <div class="shortcuts">${shortcuts.map(([l, ic, bg, fg, fn]) => `<a class="shortcut" href="javascript:void 0" onclick="${fn}"><span class="ic" style="background:${bg};color:${fg}">${I(ic)}</span>${l}</a>`).join('')}</div>

      ${fresh ? `<div class="card" style="margin-bottom:16px;border-color:#bfe3cc;background:linear-gradient(120deg,#f2faf5,#fff)"><div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:16px"><span class="ill" style="width:48px;height:48px;border-radius:50%;background:var(--brand-soft);color:var(--brand);display:grid;place-items:center;flex:none">${I('spark')}</span>
        <div style="flex:1"><h2>Your books are ready — let's add some activity</h2><p class="muted" style="margin:4px 0 12px">Upload a bank CSV or record your first invoice and expense. Your tax plan already uses the numbers from setup.</p>
        <div class="row"><button class="btn primary" onclick="Banking.importCSV()">${I('ul')} Upload bank transactions</button><button class="btn" onclick="Sales.invoiceForm()">Create invoice</button><a class="btn ghost" href="#/tax">View tax plan</a></div></div></div></div>` : ''}

      <div class="widgets">
        <div class="widget"><div class="w-head"><h3>Profit & loss</h3><select onchange="Dash.set('pl',this.value)">${opts(per.pl)}</select></div>
          <div class="w-cap">Net profit for ${Ledger.range(per.pl)[2].toLowerCase()}</div><div class="w-big ${pl.net < 0 ? 'down' : ''}" data-count="${pl.net}">${F(pl.net)}</div>
          ${pl.totalIncome ? `<div class="w-cap"><span class="${pl.net >= 0 ? 'up' : 'down'}" style="font-weight:700">${Fmt.pct(pl.net / pl.totalIncome)}</span> profit margin</div>` : ''}
          <div class="hbar"><div class="lbl"><span>Income</span><b>${F(pl.totalIncome)}</b></div><div class="track"><i style="width:${pl.totalIncome / maxPL * 100}%;background:#2f7d4f"></i></div></div>
          <div class="hbar"><div class="lbl"><span>Expenses</span><b>${F(pl.totalCogs + pl.totalExpense)}</b></div><div class="track"><i style="width:${(pl.totalCogs + pl.totalExpense) / maxPL * 100}%;background:#1c2b4a"></i></div></div>
          <div class="w-foot"><a href="#/reports?r=pl">See profit and loss report</a></div></div>

        <div class="widget"><div class="w-head"><h3>Expenses</h3><select onchange="Dash.set('exp',this.value)">${opts(per.exp)}</select></div>
          <div class="w-cap">Spending for ${expR[2].toLowerCase()}</div><div class="w-big" data-count="${expTot}">${F(expTot)}</div>
          ${expTot ? `<div class="row" style="flex-wrap:nowrap;gap:16px;margin-top:6px"><div class="chart-box xs" style="width:150px;flex:none"><canvas id="c-exp"></canvas></div>
            <div class="legend-list" style="flex:1">${expItems.slice(0, 5).map((x, i) => `<div><i style="background:${App.COLORS.series[i]}"></i>${x.name.replace(' (50% deductible)', '').replace('COGS — ', '')}<b>${Fmt.short(x.amount)}</b></div>`).join('')}${expItems.length > 5 ? `<div><i style="background:#c9d1c5"></i>Everything else<b>${Fmt.short(expItems.slice(5).reduce((x, y) => x + y.amount, 0))}</b></div>` : ''}</div></div>`
            : '<div class="empty small">No expenses recorded in this period.</div>'}
          <div class="w-foot"><a href="#/expenses">Go to expenses</a></div></div>

        <div class="widget"><div class="w-head"><h3>Invoices</h3><span class="small muted">Last 365 days</span></div>
          <div class="w-cap">Unpaid</div><div class="w-big" data-count="${uTot}">${F(uTot)}</div>
          <div class="money-bar"><i style="width:${uTot ? oTot / uTot * 100 : 0}%;background:#b42318"></i><i style="width:${uTot ? nTot / uTot * 100 : 0}%;background:#c9d1c5"></i></div>
          <div class="mb-legend"><div><b>${F(oTot)}</b><span class="muted">Overdue</span></div><div style="text-align:right"><b>${F(nTot)}</b><span class="muted">Not due yet</span></div></div>
          <div class="w-cap" style="margin-top:14px">Paid, last 30 days</div>
          <div class="money-bar" style="height:14px"><i style="width:100%;background:#2f7d4f"></i></div>
          <div class="mb-legend"><div><b>${F(pTot)}</b><span class="muted">${paid30.length} payments received</span></div></div>
          <div class="w-foot"><a href="#/invoices">Manage invoices</a></div></div>

        <div class="widget span2"><div class="w-head"><h3>Cash flow</h3><span class="small muted" style="margin-left:auto;margin-right:10px">Money in vs. money out, last 12 months</span><div class="seg"><button class="${cf3d ? '' : 'on'}" onclick="Dash.cf(false)">Chart</button><button class="${cf3d ? 'on' : ''}" onclick="Dash.cf(true)">3D city</button></div></div>
          <div class="row" style="gap:28px"><div><div class="w-cap">Cash balance today</div><div class="w-big" data-count="${cash}">${F(cash)}</div></div>
            <div><div class="w-cap">Money in, 12 mo</div><div style="font-size:18px;font-weight:700" class="up num" id="cf-in"></div></div><div><div class="w-cap">Money out, 12 mo</div><div style="font-size:18px;font-weight:700" class="num" id="cf-out"></div></div></div>
          ${cf3d ? '<div class="three-box" id="sky" style="height:300px;margin-top:8px"><div class="tip3d" id="sky-tip"></div><div class="hint3d">Drag to turn. Hover a bar for the amount.</div></div>' : '<div class="chart-box sm" style="margin-top:8px"><canvas id="c-cf"></canvas></div>'}
          <div class="w-foot"><a href="#/projections">See cash-flow forecast</a></div></div>

        <div class="widget tax-w"><div class="w-head"><h3>Tax savings found</h3><span class="small" style="color:#c9d3e6">${TAX.year} federal law</span></div>
          <div class="w-big" style="font-size:34px"><span class="hl num" data-count="${a.totalSavings}">${F(a.totalSavings)}</span></div><div class="w-cap">a year if you act on the plan. Recommended structure: <b style="color:var(--ink)">${Strategies.ENTITY_NAMES[a.bestE]}</b></div>
          <div style="margin-top:12px">${top.map(t => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--rule-2);font-size:13.5px"><span>${t.title}</span><span class="num">${F(t.savings)}</span></div>`).join('')}</div>
          <div class="w-foot"><a href="#/tax" class="btn primary">Open my tax plan</a></div></div>

        <div class="widget span2"><div class="w-head"><h3>Sales</h3><select onchange="Dash.set('sales',this.value)">${opts(per.sales)}</select></div>
          <div class="w-cap">Income received, ${Ledger.range(per.sales)[2].toLowerCase()}</div><div class="w-big">${F(Ledger.pnl(s, ...Ledger.range(per.sales).slice(0, 2)).totalIncome)}</div>
          <div class="chart-box" style="flex:1;min-height:220px"><canvas id="c-sales"></canvas></div></div>

        <div style="display:grid;gap:16px;align-content:start">
        <div class="widget" style="min-height:0"><div class="w-head"><h3>Bank accounts</h3><a class="small" href="#/banking">Go to banking</a></div>
          <div class="bank-row"><div class="bank-logo">${I('bank')}</div><div style="flex:1"><div style="font-weight:650">Business Checking</div><div class="small muted">•••• 4821, Updated today</div></div></div>
          <div class="row" style="justify-content:space-between;padding:10px 0"><span class="muted">Bank balance</span><b class="num">${F(cash, 2)}</b></div>
          <div class="row" style="justify-content:space-between;padding:0 0 10px"><span class="muted">In Bookwise</span><b class="num">${F(cash, 2)}</b></div>
          ${review ? `<a class="btn sm" href="#/banking" onclick="setTimeout(()=>Banking.setTab('review'))" style="align-self:flex-start">${review} to review</a>` : `<span class="badge b-good" style="align-self:flex-start">All transactions reviewed</span>`}
          <div class="w-foot"><a href="javascript:Banking.importCSV()">Upload transactions</a></div></div>

        <div class="widget" style="min-height:0"><div class="w-head"><h3>To do</h3></div>
          ${todo().map(([t, d, h, k]) => `<a href="${h}" style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-2);color:var(--ink);text-decoration:none"><span class="badge b-${k} nodot" style="height:24px;min-width:24px;justify-content:center">${k === 'bad' ? '!' : k === 'warn' ? '•' : '✓'}</span><span><b style="font-size:13.5px;display:block">${t}</b><span class="small muted">${d}</span></span></a>`).join('')}</div>
        </div>
      </div>`;
  }
  function todo() {
    const s = Store.state, out = [];
    const over = s.invoices.filter(i => Ledger.invoiceStatus(i) === 'overdue');
    if (over.length) out.push([`Follow up on ${over.length} overdue invoice${over.length > 1 ? 's' : ''}`, `${F(over.reduce((a, i) => a + Ledger.invTotal(i), 0))} past due`, '#/invoices', 'bad']);
    const rv = s.transactions.filter(t => t.review).length;
    if (rv) out.push([`Review ${rv} bank transactions`, 'Categorise imported activity', '#/banking', 'warn']);
    const drafts = s.invoices.filter(i => i.status === 'draft').length;
    if (drafts) out.push([`Send ${drafts} draft invoice${drafts > 1 ? 's' : ''}`, 'Finish and mark as sent', '#/invoices', 'warn']);
    out.push(['Set aside quarterly estimated tax', 'See the amount in your forecast', '#/projections', 'good']);
    out.push(['Review your tax-saving strategies', 'Act before Dec 31 for this year', '#/tax', 'good']);
    return out.slice(0, 5);
  }
  function mount() {
    const s = Store.state;
    const showBrief = r => { brief = r; $('#brief-by') && ($('#brief-by').textContent = r.by === 'Claude' ? 'written by Claude' : 'from your books'); const L = $('#brief-list'); if (!L) return;
      L.innerHTML = r.lines.map(() => '<li></li>').join(''); (async () => { for (const [i, li] of [...L.children].entries()) await AI.type(li, Fmt.esc(r.lines[i]), 6); })(); };
    brief ? showBrief(brief) : AI.briefing().then(showBrief);
    if (cf3d) {
      const months = Ledger.monthsBack(12), m = Ledger.monthly(s, months), tipEl = $('#sky-tip');
      App.scene($('#sky'), S => S.skyline($('#sky'), { months: months.map(Fmt.month), inc: m.map(r => r.income + r.contrib), out: m.map(r => r.cogs + r.expense + r.capex + r.draws), fmt: Fmt.money,
        tip: d => { if (!d) { tipEl.style.display = 'none'; return; } tipEl.style.display = 'block'; tipEl.style.left = d.x + 14 + 'px'; tipEl.style.top = d.y - 10 + 'px'; tipEl.innerHTML = `<b>${d.label}</b><br>${d.kind}: <span class="num">${Fmt.money(d.v)}</span>`; } }));
    }
    const expR = Ledger.range(per.exp), ep = Ledger.pnl(s, expR[0], expR[1]);
    const items = [...ep.cogs, ...ep.expense].sort((x, y) => y.amount - x.amount);
    const topN = items.slice(0, 5), rest = items.slice(5).reduce((x, y) => x + y.amount, 0);
    App.chart('c-exp', { type: 'doughnut', data: { labels: [...topN.map(i => i.name), ...(rest ? ['Everything else'] : [])],
      datasets: [{ data: [...topN.map(i => i.amount), ...(rest ? [rest] : [])], backgroundColor: [...App.COLORS.series.slice(0, 5), '#c9d1c5'], borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${Fmt.money(c.parsed)}` } } } } });
    const months = Ledger.monthsBack(12), m = Ledger.monthly(s, months);
    $('#cf-in') && ($('#cf-in').textContent = Fmt.money(m.reduce((x, r) => x + r.income + r.contrib, 0)));
    $('#cf-out') && ($('#cf-out').textContent = Fmt.money(m.reduce((x, r) => x + r.cogs + r.expense + r.capex + r.draws, 0)));
    let bal = Ledger.cashBalance(s, months[0] + '-00');
    const balances = m.map(r => (bal += r.cashFlow));
    App.chart('c-cf', { type: 'bar', data: { labels: months.map(Fmt.month), datasets: [
      { label: 'Money in', data: m.map(r => r.income + r.contrib), backgroundColor: '#2f7d4f', borderRadius: 3, order: 2, barPercentage: .7 },
      { label: 'Money out', data: m.map(r => r.cogs + r.expense + r.capex + r.draws), backgroundColor: '#a9b4c8', borderRadius: 3, order: 3, barPercentage: .7 },
      { label: 'Cash balance', data: balances, type: 'line', borderColor: '#1c2b4a', backgroundColor: '#1c2b4a', tension: .35, pointRadius: 2, order: 1, yAxisID: 'y' }] },
      options: { plugins: { legend: { position: 'top', align: 'end' } } } });
    const sr = Ledger.range(per.sales);
    const sm = Ledger.monthly(s, Ledger.monthsBack(12)).filter(r => r.month + '-31' >= sr[0] && r.month + '-01' <= sr[1]);
    App.chart('c-sales', { type: 'line', data: { labels: sm.map(r => Fmt.month(r.month)), datasets: [{ label: 'Income', data: sm.map(r => r.income), borderColor: '#2f7d4f', backgroundColor: 'rgba(27,138,62,.10)', fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#2f7d4f' }] },
      options: { plugins: { legend: { display: false } } } });
  }
  return { render, mount, set(k, v) { per[k] = v; App.render(); }, cf(on) { cf3d = on; App.render(); } };
})();

App.register('dashboard', { title: 'Home', hideHead: true, render: Dash.render, mount: Dash.mount });
