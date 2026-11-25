/* =========================================================================
   Bookwise — Reports center, report viewer, chart of accounts
   ========================================================================= */
const Reports = (() => {
  const F = x => x < 0 ? `<span class="down">(${Fmt.money(-x, 2)})</span>` : Fmt.money(x, 2);
  let rk = 'ytd', cFrom = '', cTo = '', notesOn = true;
  const NOTE_KINDS = ['pl', 'bs', 'expcat', 'schc'];
  const q = () => new URLSearchParams(location.hash.split('?')[1] || '');

  /* ---- row builders: each returns [html, csvRow] ---- */
  const grp = (label, g) => [`<tr class="grp" data-grp="${g}" onclick="Reports.toggle('${g}',this)"><td colspan="20">${label}</td></tr>`, [label]];
  const line = (label, vals, g = '', extra = '') => [`<tr class="l2" ${g ? `data-g="${g}"` : ''}><td>${label}</td>${vals.map(v => `<td class="r">${typeof v === 'number' ? F(v) : v}</td>`).join('')}${extra}</tr>`, [label.replace(/<[^>]+>/g, ''), ...vals.map(v => typeof v === 'number' ? v.toFixed(2) : String(v).replace(/<[^>]+>/g, ''))]];
  const tot = (label, vals, cls = 'tot') => [`<tr class="${cls}"><td>${label}</td>${vals.map(v => `<td class="r">${typeof v === 'number' ? F(v) : v}</td>`).join('')}</tr>`, [label, ...vals.map(v => typeof v === 'number' ? v.toFixed(2) : v)]];
  const pct = (a, b) => b ? Fmt.pct(a / b) : '';

  const DEFS = {
    pl: { name: 'Profit and Loss', group: 'Business overview', icon: 'reports', desc: 'Income, costs and net profit for a period.', run(r) {
      const p = Ledger.pnl(Store.state, r[0], r[1]), out = [];
      out.push(grp('Income', 'i')); p.income.forEach(x => out.push(line(x.name, [x.amount, pct(x.amount, p.totalIncome)], 'i')));
      out.push(tot('Total Income', [p.totalIncome, '']));
      out.push(grp('Cost of Goods Sold', 'c')); p.cogs.forEach(x => out.push(line(x.name, [x.amount, pct(x.amount, p.totalIncome)], 'c')));
      out.push(tot('Total Cost of Goods Sold', [p.totalCogs, pct(p.totalCogs, p.totalIncome)]));
      out.push(tot('GROSS PROFIT', [p.gross, pct(p.gross, p.totalIncome)]));
      out.push(grp('Expenses', 'e')); p.expense.forEach(x => out.push(line(x.name, [x.amount, pct(x.amount, p.totalIncome)], 'e')));
      out.push(tot('Total Expenses', [p.totalExpense, pct(p.totalExpense, p.totalIncome)]));
      out.push(tot('NET INCOME', [p.net, pct(p.net, p.totalIncome)], 'net'));
      return { head: ['', 'Total', '% of Income'], rows: out };
    } },
    plm: { name: 'Profit and Loss by Month', group: 'Business overview', icon: 'reports', wide: true, desc: 'Monthly columns to spot trends and seasonality.', run(r) {
      const s = Store.state, months = [];
      let d = new Date(r[0] < '1900' ? Ledger.monthsBack(12)[0] + '-01T00:00:00' : r[0] + 'T00:00:00');
      const end = r[1] > '9000' ? today() : r[1];
      while (months.length < 12 && d.toISOString().slice(0, 7) <= end.slice(0, 7)) { months.push(d.toISOString().slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 15); }
      const ms = months.map(m => Ledger.pnl(s, m + '-01', m + '-31'));
      const all = Ledger.pnl(s, months[0] + '-01', months[months.length - 1] + '-31');
      const out = [], val = (p, id) => [...p.income, ...p.cogs, ...p.expense].find(x => x.id === id)?.amount || 0;
      const sect = (title, g, arr, key) => { out.push(grp(title, g)); arr.forEach(x => out.push(line(x.name, [...ms.map(p => val(p, x.id)), x.amount], g))); out.push(tot(`Total ${title}`, [...ms.map(p => p[key]), all[key]])); };
      sect('Income', 'i', all.income, 'totalIncome'); sect('Cost of Goods Sold', 'c', all.cogs, 'totalCogs');
      out.push(tot('GROSS PROFIT', [...ms.map(p => p.gross), all.gross]));
      sect('Expenses', 'e', all.expense, 'totalExpense');
      out.push(tot('NET INCOME', [...ms.map(p => p.net), all.net], 'net'));
      return { head: ['', ...months.map(Fmt.month), 'Total'], rows: out, period: `${Fmt.month(months[0])} – ${Fmt.month(months[months.length - 1])}` };
    } },
    bs: { name: 'Balance Sheet', group: 'Business overview', icon: 'list', asOf: true, desc: 'What the business owns and owes, as of a date.', run(r) {
      const s = Store.state, asOf = r[1] > '9000' ? today() : r[1];
      const cash = Ledger.cashBalance(s, asOf);
      const ar = s.invoices.filter(i => i.issue <= asOf && (i.status === 'sent' || (i.status === 'paid' && i.paidDate > asOf))).reduce((a, i) => a + Ledger.invTotal(i), 0);
      const capex = s.transactions.filter(t => !t.review && CAT[t.category]?.type === 'asset' && t.date <= asOf).reduce((a, t) => a + t.amount, 0);
      const equip = s.company.equipmentValue + capex, assets = cash + ar + equip, liab = s.company.loanBalance;
      const y0 = asOf.slice(0, 4) + '-01-01';
      const ni = Ledger.pnl(s, y0, asOf).net;
      const drw = s.transactions.filter(t => !t.review && t.date >= y0 && t.date <= asOf && CAT[t.category]?.type === 'equity').reduce((a, t) => a + t.amount, 0);
      const ctb = s.transactions.filter(t => !t.review && t.date >= y0 && t.date <= asOf && CAT[t.category]?.type === 'equity_in').reduce((a, t) => a + t.amount, 0);
      const equity = assets - liab, retained = equity - ni + drw - ctb;
      const out = [grp('ASSETS', 'a'), grp('&nbsp;&nbsp;Current Assets', 'a1'), line('Business Checking', [cash], 'a1'), line('Accounts Receivable (A/R)', [ar], 'a1'), tot('Total Current Assets', [cash + ar]),
        grp('&nbsp;&nbsp;Fixed Assets', 'a2'), line('Equipment & Computers', [equip], 'a2'), tot('Total Fixed Assets', [equip]), tot('TOTAL ASSETS', [assets], 'net'),
        grp('LIABILITIES AND EQUITY', 'l'), grp('&nbsp;&nbsp;Liabilities', 'l1'), line('Business Loan Payable', [liab], 'l1'), tot('Total Liabilities', [liab]),
        grp('&nbsp;&nbsp;Equity', 'q'), line('Opening Balance & Retained Earnings', [retained], 'q'), line("Owner's Contributions", [ctb], 'q'), line("Owner's Draws", [-drw], 'q'), line('Net Income (YTD)', [ni], 'q'),
        tot('Total Equity', [equity]), tot('TOTAL LIABILITIES AND EQUITY', [liab + equity], 'net')];
      return { head: ['', 'Total'], rows: out, period: `As of ${Fmt.date(asOf)}` };
    } },
    cf: { name: 'Statement of Cash Flows', group: 'Business overview', icon: 'wallet', desc: 'Where cash came from and where it went.', run(r) {
      const s = Store.state, p = Ledger.pnl(s, r[0], r[1]);
      const sum = type => s.transactions.filter(t => !t.review && t.date >= r[0] && t.date <= r[1] && CAT[t.category]?.type === type).reduce((a, t) => a + t.amount, 0);
      const capex = sum('asset'), drw = sum('equity'), ctb = sum('equity_in');
      const begin = Ledger.cashBalance(s, (r[0] < '1900' ? '0000-01-00' : prevDay(r[0])));
      const net = p.net - capex - drw + ctb;
      return { head: ['', 'Total'], rows: [grp('OPERATING ACTIVITIES', 'o'), line('Net Income', [p.net], 'o'), tot('Net cash provided by operating activities', [p.net]),
        grp('INVESTING ACTIVITIES', 'v'), line('Equipment purchases', [-capex], 'v'), tot('Net cash used by investing activities', [-capex]),
        grp('FINANCING ACTIVITIES', 'f'), line("Owner's contributions", [ctb], 'f'), line("Owner's draws", [-drw], 'f'), tot('Net cash from financing activities', [ctb - drw]),
        tot('NET CASH INCREASE FOR PERIOD', [net]), line('Cash at beginning of period', [r[0] < '1900' ? s.company.openingCash : begin]), tot('CASH AT END OF PERIOD', [(r[0] < '1900' ? s.company.openingCash : begin) + net], 'net')] };
    } },
    schc: { name: 'Schedule C Tax Summary', group: 'Taxes', icon: 'tax', desc: 'Income and deductions mapped to IRS Schedule C lines.', run(r) {
      const p = Ledger.pnl(Store.state, r[0], r[1]), out = [];
      const ded = x => x.amount * (x.ded ?? 1);
      out.push(grp('Part I — Income', 'i')); p.income.forEach(x => out.push(line(`${x.name} <span class="muted">· Line ${x.line}</span>`, [x.amount, x.amount], 'i')));
      out.push(grp('Part III — Cost of Goods Sold', 'c')); p.cogs.forEach(x => out.push(line(`${x.name} <span class="muted">· Line ${x.line}</span>`, [x.amount, ded(x)], 'c')));
      out.push(tot('Line 7, Gross income', [p.gross, p.gross]));
      out.push(grp('Part II — Expenses', 'e')); [...p.expense].sort((a, b) => parseFloat(a.line) - parseFloat(b.line)).forEach(x => out.push(line(`${x.name} <span class="muted">· Line ${x.line}</span>`, [x.amount, ded(x)], 'e')));
      out.push(tot('Line 28, Total expenses', [p.totalExpense, p.totalExpense - p.nonDeductible]));
      out.push(tot('Line 31, Net profit', [p.net, p.net + p.nonDeductible], 'net'));
      return { head: ['', 'Booked', 'Deductible'], rows: out, note: `Taxable profit is ${Fmt.money(p.net + p.nonDeductible)} after adding back ${Fmt.money(p.nonDeductible)} of non-deductible meals. Equipment purchases are capital items — see §179 / bonus depreciation in the Tax optimizer.` };
    } },
    ar: { name: 'A/R Aging Summary', group: 'Who owes you', icon: 'clock', asOf: true, desc: 'Unpaid invoices by customer and days past due.', run() {
      const by = {}, now = new Date();
      Store.state.invoices.filter(i => i.status === 'sent').forEach(i => {
        const b = by[i.client] = by[i.client] || [0, 0, 0, 0, 0];
        const late = (now - new Date(i.due + 'T00:00:00')) / 864e5;
        b[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4] += Ledger.invTotal(i);
      });
      const names = Object.keys(by).sort(), tots = [0, 0, 0, 0, 0];
      const out = names.map(n => { by[n].forEach((v, k) => tots[k] += v); return line(Fmt.esc(n), [...by[n], by[n].reduce((a, b) => a + b, 0)]); });
      out.push(tot('TOTAL', [...tots, tots.reduce((a, b) => a + b, 0)], 'net'));
      return { head: ['Customer', 'Current', '1 – 30', '31 – 60', '61 – 90', '91 and over', 'Total'], rows: out, period: `As of ${Fmt.date(today())}`, wide: true };
    } },
    open: { name: 'Open Invoices', group: 'Who owes you', icon: 'invoice', desc: 'Every unpaid invoice with its due date.', run() {
      const inv = Store.state.invoices.filter(i => i.status === 'sent').sort((a, b) => a.due.localeCompare(b.due));
      const out = inv.map(i => [`<tr class="l2" style="cursor:pointer" onclick="Sales.viewInvoice('${i.id}')"><td>${Fmt.esc(i.client)}</td><td>${i.number}</td><td>${Fmt.date(i.issue)}</td><td>${Fmt.date(i.due)}</td><td>${Sales.statusCell(i)}</td><td class="r">${F(Ledger.invTotal(i))}</td></tr>`, [i.client, i.number, i.issue, i.due, Ledger.invoiceStatus(i), Ledger.invTotal(i).toFixed(2)]]);
      out.push(tot('TOTAL', ['', '', '', '', inv.reduce((a, i) => a + Ledger.invTotal(i), 0)], 'net'));
      return { head: ['Customer', 'No.', 'Date', 'Due', 'Status', 'Open balance'], rows: out, period: `As of ${Fmt.date(today())}` };
    } },
    salescust: { name: 'Sales by Customer Summary', group: 'Sales and customers', icon: 'users', desc: 'Income received from each customer.', run(r) {
      const by = {}; Store.state.transactions.filter(t => !t.review && CAT[t.category]?.type === 'income' && t.date >= r[0] && t.date <= r[1]).forEach(t => { const n = t.payee || '(no customer)'; by[n] = (by[n] || 0) + t.amount; });
      const total = Object.values(by).reduce((a, b) => a + b, 0);
      const out = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, v]) => line(Fmt.esc(n), [v, pct(v, total)]));
      out.push(tot('TOTAL', [total, '100.0%'], 'net'));
      return { head: ['Customer', 'Total', '% of sales'], rows: out };
    } },
    expvendor: { name: 'Expenses by Vendor Summary', group: 'Expenses and vendors', icon: 'store', desc: 'Total paid to each vendor.', run(r) {
      const by = {}; Store.state.transactions.filter(t => !t.review && ['cogs', 'expense'].includes(CAT[t.category]?.type) && t.date >= r[0] && t.date <= r[1]).forEach(t => { const n = t.payee || '(no payee)'; by[n] = (by[n] || 0) + t.amount; });
      const total = Object.values(by).reduce((a, b) => a + b, 0);
      const out = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, v]) => line(Fmt.esc(n), [v, pct(v, total)]));
      out.push(tot('TOTAL', [total, '100.0%'], 'net'));
      return { head: ['Vendor', 'Total', '% of spend'], rows: out };
    } },
    expcat: { name: 'Expenses by Category', group: 'Expenses and vendors', icon: 'card', desc: 'Spending by account with tax deductibility.', run(r) {
      const p = Ledger.pnl(Store.state, r[0], r[1]), all = [...p.cogs, ...p.expense].sort((a, b) => b.amount - a.amount), total = all.reduce((a, x) => a + x.amount, 0);
      const out = all.map(x => line(x.name, [x.amount, pct(x.amount, total), x.ded === .5 ? '50%' : '100%']));
      out.push(tot('TOTAL', [total, '100.0%', ''], 'net'));
      return { head: ['Category', 'Total', '% of spend', 'Deductible'], rows: out };
    } },
    txlist: { name: 'Transaction List by Date', group: 'For my accountant', icon: 'list', wide: true, desc: 'Every transaction in the period — handy for your CPA.', run(r) {
      const tx = Store.state.transactions.filter(t => !t.review && t.date >= r[0] && t.date <= r[1]).sort((a, b) => a.date.localeCompare(b.date));
      const out = tx.map(t => [`<tr class="l2"><td>${Fmt.date(t.date)}</td><td>${isInflow(t.category) ? 'Deposit' : CAT[t.category].type === 'equity' ? 'Transfer' : 'Expense'}</td><td>${Fmt.esc(t.payee || '')}</td><td>${Fmt.esc(t.desc)}</td><td>${CAT[t.category].name}</td><td class="r">${F((isInflow(t.category) ? 1 : -1) * t.amount)}</td></tr>`,
        [t.date, isInflow(t.category) ? 'Deposit' : 'Expense', t.payee, t.desc, CAT[t.category].name, ((isInflow(t.category) ? 1 : -1) * t.amount).toFixed(2)]]);
      return { head: ['Date', 'Type', 'Name', 'Memo / description', 'Account', 'Amount'], rows: out };
    } },
  };
  function prevDay(d) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10); }

  function center() {
    const fav = Store.state.favReports;
    const item = k => { const d = DEFS[k]; return `<div class="rep-item" onclick="location.hash='#/reports?r=${k}'"><span class="ic">${I(d.icon)}</span><div><div style="font-weight:650">${d.name}</div><div class="small muted">${d.desc}</div></div>
      <button class="star ${fav.includes(k) ? 'on' : ''}" title="Favorite" onclick="event.stopPropagation();Reports.fav('${k}')">★</button></div>`; };
    const groups = [...new Set(Object.values(DEFS).map(d => d.group))];
    return `${fav.length ? `<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>★ Favorites</h2></div><div class="rep-grid">${fav.filter(k => DEFS[k]).map(item).join('')}</div></div>` : ''}
      <div class="card">${groups.map(g => `<h2 style="margin:6px 0 12px">${g}</h2><div class="rep-grid" style="margin-bottom:22px">${Object.keys(DEFS).filter(k => DEFS[k].group === g).map(item).join('')}
        ${g === 'Taxes' ? `<div class="rep-item" onclick="location.hash='#/tax'"><span class="ic">${I('spark')}</span><div><div style="font-weight:650">Tax Savings Plan</div><div class="small muted">Entity comparison and every strategy, printable for your CPA.</div></div></div>` : ''}</div>`).join('')}</div>`;
  }
  function viewer(k) {
    const d = DEFS[k], r = rk === 'custom' ? Ledger.range('custom', cFrom || '2000-01-01', cTo || today()) : Ledger.range(rk);
    const out = d.run(r), s = Store.state;
    Reports._csv = [out.head, ...out.rows.map(x => x[1])];
    const period = out.period || (rk === 'all' ? 'All dates' : `${Fmt.date(r[0])} – ${Fmt.date(r[1] > '9000' ? today() : r[1])}`);
    return `<div class="rep-toolbar no-print">
        <a class="btn sm" href="#/reports">${I('back')} Reports</a>
        ${d.asOf && k !== 'bs' ? '' : `<label class="f">Report period<select id="rp-r">${Ledger.RANGE_OPTS.map(([v, l]) => `<option value="${v}" ${rk === v ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${rk === 'custom' ? 'selected' : ''}>Custom dates</option></select></label>
        <label class="f" id="rp-cust" style="display:${rk === 'custom' ? 'flex' : 'none'};flex-direction:row;gap:8px;align-items:flex-end"><span>From<input type="date" id="rp-f" value="${cFrom}"/></span><span>To<input type="date" id="rp-t" value="${cTo || today()}"/></span></label>
        <button class="btn primary" onclick="Reports.run('${k}')">Run report</button>`}
        <span class="spacer"></span>
        ${NOTE_KINDS.includes(k) ? `<button class="btn sm ${notesOn ? 'primary' : ''}" onclick="Reports.notes()">${I('spark')} Margin notes</button>` : ''}
        <button class="btn sm" onclick="Reports.fav('${k}',true)">${s.favReports.includes(k) ? '★ Favorited' : '☆ Favorite'}</button>
        <button class="btn sm" onclick="window.print()">${I('print')} Print</button>
        <button class="btn sm" onclick="App.download('${d.name.replace(/\s+/g, '-').toLowerCase()}.csv', App.csv(Reports._csv), 'text/csv')">${I('dl')} Export CSV</button>
      </div>
      <div class="sheet ${d.wide || out.wide ? 'wide' : ''}"><div class="s-head"><div class="co">${Fmt.esc(s.company.name)}</div><h2>${d.name}</h2><div class="dt">${period}</div></div>
        <div class="table-wrap"><table><thead><tr>${out.head.map((h, i) => `<th class="${i ? 'r' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${out.rows.map(x => x[0]).join('') || `<tr><td colspan="${out.head.length}" class="empty">No data for this period.</td></tr>`}</tbody></table></div>
        ${out.note ? `<div class="note info" style="margin-top:18px">${out.note}</div>` : ''}
        <div class="s-foot">Cash basis, ${new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>`;
  }

  /* ---------- Chart of accounts ---------- */
  function coa() {
    const s = Store.state, ytd = Ledger.range('ytd'), p = Ledger.pnl(s, ytd[0], ytd[1]), b = Ledger.balanceSheet(s);
    const bal = id => [...p.income, ...p.cogs, ...p.expense].find(x => x.id === id)?.amount || 0;
    const TYPE = { income: 'Income', cogs: 'Cost of Goods Sold', expense: 'Expenses', asset: 'Fixed Assets', equity: 'Equity', equity_in: 'Equity' };
    const rows = [
      { id: 'bank', name: 'Business Checking', type: 'Bank', detail: 'Checking', bal: b.cash, link: '#/banking' },
      { id: 'ar', name: 'Accounts Receivable (A/R)', type: 'Accounts receivable', detail: 'Accounts Receivable', bal: b.ar, link: '#/invoices' },
      { id: 'eq', name: 'Equipment & Computers', type: 'Fixed Assets', detail: 'Machinery & Equipment', bal: b.equipment, link: '#/reports?r=bs' },
      { id: 'loan', name: 'Business Loan Payable', type: 'Long Term Liabilities', detail: 'Notes Payable', bal: b.liabilities, link: '#/reports?r=bs' },
      { id: 'oe', name: "Owner's Equity", type: 'Equity', detail: "Owner's Equity", bal: b.equity, link: '#/reports?r=bs' },
      ...CATEGORIES.filter(c => !['asset', 'equity', 'equity_in'].includes(c.type)).map(c => ({ id: c.id, name: c.name, type: TYPE[c.type], detail: `Schedule C line ${c.line}`, bal: bal(c.id), link: `javascript:Reports.acct('${c.id}')` })),
    ];
    return `<div class="note info" style="margin-bottom:16px">Balance-sheet accounts show current balances. Income and expense accounts show year-to-date activity. Each expense account is mapped to its IRS Schedule C line so your tax summary builds itself.</div>
      <div class="card flush"><div id="coa-t">${DataTable.render('coa', { rows, pageSize: 60, cols: [
        { key: 'name', label: 'Name', render: r => `<a class="t1" href="${r.link}">${r.name}</a>` },
        { key: 'type', label: 'Account type' }, { key: 'detail', label: 'Detail type', render: r => `<span class="muted">${r.detail}</span>` },
        { key: 'bal', label: 'Balance', cls: 'r', render: r => `<b>${F(r.bal)}</b>` },
        { key: 'a', label: 'Action', nosort: true, cls: 'r', render: r => `<a class="link" href="${r.link}">${r.id.length > 4 && !['bank', 'loan'].includes(r.id) ? 'Account history' : 'View register'}</a>` }] })}</div></div>`;
  }

  return {
    center, viewer, coa, DEFS,
    notes() { notesOn = !notesOn; App.render(); },
    annotate(k) {
      if (!notesOn || !NOTE_KINDS.includes(k)) return;
      const r = rk === 'custom' ? Ledger.range('custom', cFrom || '2000-01-01', cTo || today()) : Ledger.range(rk);
      const notes = AI.marginNotes(k, r), keys = Object.keys(notes); if (!keys.length) return;
      const sheet = $('.sheet'); sheet.classList.add('annotated');
      $('.sheet thead tr').insertAdjacentHTML('beforeend', '<th class="mnote-h"></th>');
      let n = 0;
      $$('.sheet tbody tr').forEach(tr => {
        const label = tr.firstElementChild.textContent.trim(); const key = keys.find(k2 => label === k2 || label.startsWith(k2 + ','));
        const td = document.createElement('td'); td.className = 'mnote';
        if (key) { td.innerHTML = `<span style="animation-delay:${300 + n++ * 180}ms">${Fmt.esc(notes[key])}</span>`; tr.classList.add('noted'); }
        if (tr.firstElementChild.colSpan > 1) tr.firstElementChild.colSpan += 0;
        tr.appendChild(td);
      });
    },
    run(k) { rk = $('#rp-r').value; if (rk === 'custom') { cFrom = $('#rp-f').value; cTo = $('#rp-t').value; } App.render(); },
    fav(k, rerender) { const f = Store.state.favReports; const i = f.indexOf(k); i >= 0 ? f.splice(i, 1) : f.push(k); Store.save(); App.render(); },
    toggle(g, tr) { tr.classList.toggle('closed'); $$(`tr[data-g="${g}"]`).forEach(r => r.style.display = tr.classList.contains('closed') ? 'none' : ''); },
    acct(id) {
      const tx = Store.state.transactions.filter(t => t.category === id && !t.review).sort((a, b) => b.date.localeCompare(a.date));
      App.drawer(CAT[id].name, `<div class="small muted" style="margin-bottom:12px">Schedule C line ${CAT[id].line}, ${tx.length} transactions, ${Fmt.money(tx.reduce((a, t) => a + t.amount, 0), 2)} all-time</div>
        <table><thead><tr><th>Date</th><th>Payee / description</th><th class="r">Amount</th></tr></thead><tbody>${tx.slice(0, 80).map(t => `<tr style="cursor:pointer" onclick="Banking.editTx('${t.id}')"><td>${Fmt.date(t.date)}</td><td>${Fmt.esc(t.payee || '')}<div class="t2">${Fmt.esc(t.desc)}</div></td><td class="r num">${Fmt.money(t.amount, 2)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No activity yet.</td></tr>'}</tbody></table>`);
    },
  };
})();

App.register('reports', {
  title: () => { const k = new URLSearchParams(location.hash.split('?')[1] || '').get('r'); return k && Reports.DEFS[k] ? Reports.DEFS[k].name : 'Reports'; },
  crumb: 'Insights', sub: () => new URLSearchParams(location.hash.split('?')[1] || '').get('r') ? '' : 'Financial statements, tax summaries and lists — print or export any report',
  render: () => { const k = new URLSearchParams(location.hash.split('?')[1] || '').get('r'); return k && Reports.DEFS[k] ? Reports.viewer(k) : Reports.center(); },
  mount: () => { const k = new URLSearchParams(location.hash.split('?')[1] || '').get('r'); if (k) Reports.annotate(k); const sel = $('#rp-r'); if (sel) sel.onchange = () => { $('#rp-cust').style.display = sel.value === 'custom' ? 'flex' : 'none'; if (sel.value !== 'custom') Reports.run(); }; },
});
App.register('coa', { title: 'Chart of accounts', crumb: 'Bookkeeping', sub: () => 'Every account in your books, mapped to the IRS forms', render: Reports.coa });
