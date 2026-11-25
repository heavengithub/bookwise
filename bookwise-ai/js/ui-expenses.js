/* =========================================================================
   Bookwise — Expenses & vendors
   ========================================================================= */
const Expenses = (() => {
  const F = Fmt.money;
  const filt = { q: '', cat: '', range: 'ytd' };
  const isOut = t => !t.review && ['cogs', 'expense', 'asset'].includes(CAT[t.category]?.type);

  function expRows() {
    const r = Ledger.range(filt.range);
    return Store.state.transactions.filter(t => isOut(t) && Ledger.inRange(t, r) && (!filt.cat || t.category === filt.cat)
      && (!filt.q || `${t.desc} ${t.payee} ${t.amount}`.toLowerCase().includes(filt.q.toLowerCase())));
  }
  function table() {
    return DataTable.render('exp', { rows: expRows(), sort: 'date', pageSize: 25,
      batch: [['Recategorize', ids => recat(ids)], ['Delete', ids => Banking.confirmDel(ids)]],
      empty: `<div class="empty"><div class="ill">${I('card')}</div><h3>No expenses in this period</h3><p>Record a purchase or upload bank transactions.</p><button class="btn primary" onclick="Expenses.expenseForm()">${I('plus')} New expense</button></div>`,
      cols: [
        { key: 'date', label: 'Date', render: t => `<span class="num">${Fmt.date(t.date)}</span>` },
        { key: 'type', label: 'Type', nosort: true, render: t => CAT[t.category].type === 'asset' ? 'Asset purchase' : 'Expense' },
        { key: 'payee', label: 'Payee', render: t => `<div class="t1">${Fmt.esc(t.payee || '—')}</div><div class="t2">${Fmt.esc(t.desc)}</div>` },
        { key: 'category', label: 'Category', val: t => CAT[t.category]?.name, render: t => `${CAT[t.category]?.name}${CAT[t.category]?.ded === .5 ? ' <span class="badge b-warn nodot">50%</span>' : ''}` },
        { key: 'amount', label: 'Total', cls: 'r', render: t => `<b>${F(t.amount, 2)}</b>` },
        { key: 'a', label: 'Action', nosort: true, cls: 'r', render: t => `<span class="row-action"><button class="link" onclick="Banking.editTx('${t.id}')">View/Edit</button><button class="more" onclick="Banking.rowMenu(this,'${t.id}')">${I('down')}</button></span>` },
      ] });
  }
  function recat(ids) {
    App.modal(`Recategorize ${ids.length} expense${ids.length > 1 ? 's' : ''}`, `<label class="f">New category<select id="rc">${Banking.catOptions('other_exp')}</select></label>`,
      `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn primary" id="rc-go">Apply</button>`,
      m => $('#rc-go', m).onclick = () => { const c = $('#rc', m).value; ids.forEach(id => { const t = Store.state.transactions.find(x => x.id === id); if (t) t.category = c; }); Store.state.taxSynced = false; Store.save(); App.closeModal(); App.render(); });
  }

  function page() {
    const s = Store.state, r = Ledger.range(filt.range);
    const list = s.transactions.filter(t => isOut(t) && Ledger.inRange(t, r));
    const total = list.reduce((a, t) => a + t.amount, 0);
    const byCat = {}; list.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const thisMonth = s.transactions.filter(t => isOut(t) && Ledger.inRange(t, Ledger.range('month'))).reduce((a, t) => a + t.amount, 0);
    const nonded = list.filter(t => CAT[t.category]?.ded === .5).reduce((a, t) => a + t.amount * .5, 0);
    return `<div class="grid g-2-1">
        <div class="card"><div class="w-head"><h3>Spending by category</h3>
          <select onchange="Expenses.f('range',this.value,true)">${Ledger.RANGE_OPTS.map(([k, l]) => `<option value="${k}" ${filt.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="w-big">${F(total)}</div><div class="w-cap">${r[2]}, ${list.length} transactions</div>
          ${cats.length ? `<div class="chart-box sm" style="margin-top:10px"><canvas id="c-expcat"></canvas></div>` : '<div class="empty">No spending recorded yet.</div>'}</div>
        <div class="stack" style="display:grid;gap:16px">
          <div class="card kpi"><div class="label">Spent this month</div><div class="value">${F(thisMonth)}</div><div class="delta">Across all payment accounts</div></div>
          <div class="card kpi"><div class="label">Top category</div><div class="value" style="font-size:19px">${cats[0] ? CAT[cats[0][0]].name : '—'}</div><div class="delta">${cats[0] ? `${F(cats[0][1])}, ${Fmt.pct(cats[0][1] / total, 0)} of spend` : ''}</div></div>
          <div class="card kpi"><div class="label">Not deductible (meals 50%)</div><div class="value">${F(nonded)}</div><div class="delta"><a href="#/reports?r=schc">Schedule C summary</a></div></div>
        </div></div>
      <div class="card flush" style="margin-top:16px"><div class="table-toolbar">
        <div class="search-in">${I('search')}<input placeholder="Search payee, memo or amount" value="${Fmt.esc(filt.q)}" oninput="Expenses.f('q',this.value)"/></div>
        <select onchange="Expenses.f('cat',this.value)"><option value="">All categories</option>${CATEGORIES.filter(c => ['cogs', 'expense', 'asset'].includes(c.type)).map(c => `<option value="${c.id}" ${filt.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
        <span class="spacer"></span><span class="small muted">${r[2]}</span></div>
        <div id="exp-table">${table()}</div></div>`;
  }
  function mount() {
    const r = Ledger.range(filt.range), byCat = {};
    Store.state.transactions.filter(t => isOut(t) && Ledger.inRange(t, r)).forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 9);
    App.chart('c-expcat', { type: 'bar', data: { labels: cats.map(c => CAT[c[0]].name.replace(' (50% deductible)', '')), datasets: [{ label: 'Spent', data: cats.map(c => c[1]), backgroundColor: App.COLORS.series, borderRadius: 4, barThickness: 16 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + Fmt.money(c.parsed.x) } } },
        scales: { x: { grid: { color: '#eef0f3' }, ticks: { callback: v => Fmt.short(v) } }, y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11.5 }, callback: function (v) { return this.getLabelForValue(v); } } } } } });
  }

  /* ---------- full-screen expense form (multi-line) ---------- */
  function expenseForm(preset = {}) {
    const s = Store.state;
    const vendors = [...new Set(s.transactions.filter(isOut).map(t => t.payee).filter(Boolean))];
    let lines = [{ category: preset.category || 'other_exp', desc: '', amount: '' }, { category: 'other_exp', desc: '', amount: '' }];
    const catSel = sel => CATEGORIES.filter(c => ['cogs', 'expense', 'asset'].includes(c.type)).map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    const rowsHtml = () => lines.map((l, k) => `<tr><td class="idx">${k + 1}</td><td style="width:30%"><select data-k="${k}" data-f="category">${catSel(l.category)}</select></td>
      <td><input data-k="${k}" data-f="desc" value="${Fmt.esc(l.desc)}" placeholder="What was it for?"/></td>
      <td style="width:150px"><input type="number" step="0.01" data-k="${k}" data-f="amount" value="${l.amount}" style="text-align:right" placeholder="0.00"/></td>
      <td style="width:36px"><button class="del" onclick="Expenses._del(${k})">${I('x')}</button></td></tr>`).join('');
    App.full('Expense', `<div class="paper">
      <div class="row" style="align-items:flex-start;gap:24px"><div style="flex:1;display:grid;grid-template-columns:repeat(2,1fr);gap:14px">
        <label class="f">Payee<input id="e-payee" list="vend" placeholder="Who did you pay?"/><datalist id="vend">${vendors.map(v => `<option value="${Fmt.esc(v)}">`).join('')}</datalist></label>
        <label class="f">Payment account<select id="e-acct"><option>Business Checking •••• 4821</option></select></label>
        <label class="f">Payment date<input type="date" id="e-date" value="${today()}"/></label>
        <label class="f">Payment method<select id="e-method"><option>Debit card</option><option>Credit card</option><option>ACH</option><option>Check</option><option>Cash</option></select></label>
        <label class="f">Ref no.<input id="e-ref" placeholder="Optional"/></label></div>
        <div class="balance"><div class="lbl">Amount</div><div class="amt" id="e-total">$0.00</div></div></div>
      <h3 style="margin:24px 0 8px">Category details</h3>
      <table class="lines"><thead><tr><th>#</th><th>Category</th><th>Description</th><th class="r">Amount</th><th></th></tr></thead><tbody id="e-lines">${rowsHtml()}</tbody></table>
      <div class="row" style="margin-top:10px"><button class="btn sm" onclick="Expenses._add()">Add lines</button><button class="btn sm" onclick="Expenses._clear()">Clear all lines</button></div>
      <div class="row" style="align-items:flex-start;margin-top:16px;gap:30px"><label class="f" style="flex:1;max-width:460px">Memo<textarea id="e-memo" rows="3" placeholder="Business purpose — helpful at tax time"></textarea></label>
        <div class="totals"><div class="grand"><span>Total</span><span id="e-total2">$0.00</span></div></div></div>
      <div class="note info" style="margin-top:16px" id="e-tip">Tip: equipment and software over $2,500 per item can still be expensed this year with §179 or 100% bonus depreciation — the Tax Optimizer models this.</div></div>`,
      `<button class="btn" onclick="App.closeAll()">Cancel</button><span class="spacer"></span><button class="btn" onclick="Expenses._save(true)">Save and new</button><button class="btn primary" onclick="Expenses._save(false)">Save and close</button>`, m => {
        const tot = () => { const t = lines.reduce((a, l) => a + (+l.amount || 0), 0); $('#e-total', m).textContent = F(t, 2); $('#e-total2', m).textContent = F(t, 2); };
        const bind = () => $$('#e-lines [data-k]', m).forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { lines[+el.dataset.k][el.dataset.f] = el.value; tot(); }));
        const draw = () => { $('#e-lines', m).innerHTML = rowsHtml(); bind(); tot(); };
        Expenses._add = () => { lines.push({ category: 'other_exp', desc: '', amount: '' }); draw(); };
        Expenses._del = k => { lines.splice(k, 1); if (!lines.length) lines.push({ category: 'other_exp', desc: '', amount: '' }); draw(); };
        Expenses._clear = () => { lines = [{ category: 'other_exp', desc: '', amount: '' }]; draw(); };
        $('#e-payee', m).addEventListener('change', e => { const last = [...s.transactions].reverse().find(t => t.payee === e.target.value && isOut(t)); if (last && !lines[0].amount) { lines[0].category = last.category; draw(); } });
        Expenses._save = again => {
          const payee = $('#e-payee', m).value.trim(), date = $('#e-date', m).value || today(), memo = $('#e-memo', m).value.trim(), method = $('#e-method', m).value;
          const good = lines.filter(l => +l.amount > 0);
          if (!payee) return App.toast('Enter a payee');
          if (!good.length) return App.toast('Add an amount on at least one line');
          good.forEach(l => s.transactions.push({ id: uid(), date, payee, desc: l.desc || `${CAT[l.category].name} — ${payee}`, category: l.category, amount: Math.abs(+l.amount), memo: [memo, method].filter(Boolean).join(', '), account: 'checking' }));
          s.taxSynced = false; Store.save(); App.closeAll(); App.render(); App.toast(`Expense saved, ${F(good.reduce((a, l) => a + +l.amount, 0), 2)}`);
          if (again) expenseForm();
        };
        bind(); tot(); setTimeout(() => $('#e-payee', m).focus(), 60);
      });
  }

  /* ---------- Vendors ---------- */
  function vendors() {
    const map = {}, t12 = Ledger.range('t12'), ytd = Ledger.range('ytd');
    Store.state.transactions.filter(isOut).forEach(t => {
      const n = t.payee || '(no payee)';
      const v = map[n] = map[n] || { id: n, name: n, ytd: 0, t12: 0, count: 0, last: '', cats: {} };
      v.count++; if (t.date > v.last) v.last = t.date;
      if (Ledger.inRange(t, t12)) v.t12 += t.amount;
      if (Ledger.inRange(t, ytd)) v.ytd += t.amount;
      v.cats[t.category] = (v.cats[t.category] || 0) + t.amount;
    });
    return Object.values(map).map(v => ({ ...v, top: Object.entries(v.cats).sort((a, b) => b[1] - a[1])[0]?.[0] }));
  }
  const attr = s => JSON.stringify(s).replace(/"/g, '&quot;');
  function vendTable(vs) {
    return DataTable.render('vend', { rows: vs, sort: 't12', pageSize: 25,
      empty: `<div class="empty"><div class="ill">${I('store')}</div><h3>No vendors yet</h3><p>Vendors appear as you record expenses.</p></div>`,
      cols: [
        { key: 'name', label: 'Vendor', render: v => `<a class="t1" href="javascript:void 0" onclick="Expenses.vendorDetail(${attr(v.name)})">${Fmt.esc(v.name)}</a><div class="t2">${v.count} transaction${v.count > 1 ? 's' : ''}</div>` },
        { key: 'top', label: 'Usual category', val: v => CAT[v.top]?.name || '', render: v => CAT[v.top]?.name || '—' },
        { key: 'last', label: 'Last paid', render: v => Fmt.date(v.last) },
        { key: 'ytd', label: 'Spent YTD', cls: 'r', render: v => F(v.ytd, 2) },
        { key: 't12', label: 'Last 12 months', cls: 'r', render: v => `<b>${F(v.t12, 2)}</b>` },
        { key: 'a', label: 'Action', nosort: true, cls: 'r', render: v => `<button class="link" onclick="Expenses.expenseFor(${attr(v.name)})">Create expense</button>` },
      ] });
  }
  function vendorsPage() {
    const vs = vendors(), top = [...vs].sort((a, b) => b.t12 - a.t12).slice(0, 5), tot = vs.reduce((a, v) => a + v.t12, 0);
    return `<div class="grid g-2-1"><div class="card flush"><div class="table-toolbar"><div class="search-in">${I('search')}<input placeholder="Find a vendor" oninput="Expenses.vf(this.value)"/></div><span class="spacer"></span><span class="small muted">${vs.length} vendors</span></div><div id="vend-table">${vendTable(vs)}</div></div>
      <div class="card"><div class="w-head"><h3>Top vendors, 12 months</h3></div><div class="w-big">${F(tot)}</div><div class="w-cap">Total paid to vendors</div>
        <div style="margin-top:14px">${top.map((v, i) => `<div style="margin-bottom:12px"><div class="row" style="flex-wrap:nowrap"><span class="small" style="font-weight:600">${Fmt.esc(v.name)}</span><span class="spacer"></span><span class="small num" style="font-weight:700">${F(v.t12)}</span></div>
          <div class="bar" style="margin-top:5px"><i style="width:${v.t12 / (top[0]?.t12 || 1) * 100}%;background:${App.COLORS.series[i]}"></i></div></div>`).join('')}</div></div></div>`;
  }
  function vendorDetail(name) {
    const v = vendors().find(x => x.name === name);
    const tx = Store.state.transactions.filter(t => isOut(t) && (t.payee || '(no payee)') === name).sort((a, b) => b.date.localeCompare(a.date));
    App.drawer(Fmt.esc(name), `<div class="stat-row" style="grid-template-columns:repeat(3,1fr)"><div><div class="l">Spent YTD</div><div class="v">${F(v.ytd)}</div></div><div><div class="l">Last 12 months</div><div class="v">${F(v.t12)}</div></div><div><div class="l">Transactions</div><div class="v">${v.count}</div></div></div>
      <table><thead><tr><th>Date</th><th>Category</th><th class="r">Amount</th></tr></thead><tbody>${tx.slice(0, 60).map(t => `<tr style="cursor:pointer" onclick="Banking.editTx('${t.id}')"><td>${Fmt.date(t.date)}<div class="t2">${Fmt.esc(t.desc)}</div></td><td>${CAT[t.category].name}</td><td class="r num">${F(t.amount, 2)}</td></tr>`).join('')}</tbody></table>`,
      `<button class="btn primary" onclick="Expenses.expenseFor(${attr(name)})">Create expense</button>`);
  }

  return {
    page, mount, expenseForm, vendorsPage, vendorDetail, vendors,
    f(k, v, full) { filt[k] = v; DataTable.reset('exp'); if (full) App.render(); else $('#exp-table').innerHTML = table(); },
    vf(q) { DataTable.reset('vend'); $('#vend-table').innerHTML = vendTable(vendors().filter(v => v.name.toLowerCase().includes(q.toLowerCase()))); },
    expenseFor(name) { App.closeAll(); expenseForm(); setTimeout(() => { const p = $('#e-payee'); p.value = name; p.dispatchEvent(new Event('change')); }, 30); },
  };
})();

App.register('expenses', { title: 'Expenses', crumb: 'Expenses', sub: () => 'Every purchase, categorised for your tax return',
  actions: () => `<button class="btn" onclick="Banking.exportCSV()">${I('dl')} Export</button><button class="btn primary" onclick="Expenses.expenseForm()">${I('plus')} New expense</button>`,
  render: Expenses.page, mount: Expenses.mount });
App.register('vendors', { title: 'Vendors', crumb: 'Expenses', sub: () => 'Who you pay and how much',
  actions: () => `<button class="btn primary" onclick="Expenses.expenseForm()">${I('plus')} New expense</button>`, render: Expenses.vendorsPage });
