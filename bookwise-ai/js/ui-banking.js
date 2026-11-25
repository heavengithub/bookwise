/* =========================================================================
   Bookwise — Banking: bank register, review queue, transaction drawer
   ========================================================================= */
const Banking = (() => {
  const F = Fmt.money;
  let tab = 'all';
  const filt = { q: '', cat: '', dir: '', range: 'all' };

  const catOptions = sel => [['income', 'Income'], ['cogs', 'Cost of goods sold'], ['expense', 'Expenses'], ['asset', 'Fixed assets'], ['equity', 'Owner equity (out)'], ['equity_in', 'Owner equity (in)']]
    .map(([type, label]) => `<optgroup label="${label}">${CATEGORIES.filter(c => c.type === type).map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</optgroup>`).join('');

  const RULES = [[/payroll|gusto|adp/i, 'wages'], [/rent|lease/i, 'rent'], [/google ads|facebook|meta|linkedin|ads/i, 'advertising'],
    [/adobe|figma|slack|notion|aws|software|saas|subscription|microsoft|zoom/i, 'software'], [/uber|lyft|delta|united|airbnb|marriott|hotel|airline/i, 'travel'],
    [/restaurant|cafe|coffee|doordash|grubhub|lunch|dinner|starbucks/i, 'meals'], [/stripe fee|square fee|paypal fee|bank fee|service charge/i, 'bank'],
    [/insurance|hiscox|geico/i, 'insurance'], [/staples|office depot|amazon|amzn/i, 'office'], [/electric|internet|comcast|verizon|at&t|spectrum|utility/i, 'utilities'],
    [/cpa|attorney|legal|accounting|bookkeep/i, 'legal'], [/upwork|fiverr|contractor|freelance/i, 'contract'], [/shell|exxon|bp |chevron|fuel|gas station/i, 'car'],
    [/deposit|payment from|transfer from|stripe payout|square payout/i, 'services']];
  const guess = (desc, amt) => { for (const [re, c] of RULES) if (re.test(desc)) return c; return amt > 0 ? 'services' : 'other_exp'; };

  function rows() {
    const s = Store.state, r = Ledger.range(filt.range);
    return s.transactions.filter(t => {
      if (tab === 'review' ? !t.review : t.review) return false;
      if (filt.q && !`${t.desc} ${t.payee} ${t.amount}`.toLowerCase().includes(filt.q.toLowerCase())) return false;
      if (filt.cat && t.category !== filt.cat) return false;
      if (filt.dir === 'in' && !isInflow(t.category)) return false;
      if (filt.dir === 'out' && isInflow(t.category)) return false;
      return Ledger.inRange(t, r);
    });
  }

  function table() {
    const rs = rows();
    if (tab === 'review') {
      return DataTable.render('review', { rows: rs, sort: 'date', pageSize: 50,
        batch: [['Accept selected', ids => accept(ids)], ['Exclude', ids => remove(ids)]],
        empty: `<div class="empty"><div class="ill">${I('check')}</div><h3>You're all caught up</h3><p>Imported bank transactions land here for review. Use <b>Upload transactions</b> to import a bank CSV.</p></div>`,
        cols: [
          { key: 'date', label: 'Date', render: t => Fmt.date(t.date) },
          { key: 'desc', label: 'Bank description', render: t => `<div class="t1">${Fmt.esc(t.desc)}</div>` },
          { key: 'out', label: 'Spent', cls: 'r', val: t => isInflow(t.category) ? 0 : t.amount, render: t => isInflow(t.category) ? '' : F(t.amount, 2) },
          { key: 'in', label: 'Received', cls: 'r', val: t => isInflow(t.category) ? t.amount : 0, render: t => isInflow(t.category) ? `<span class="up">${F(t.amount, 2)}</span>` : '' },
          { key: 'category', label: 'Category', nosort: true, render: t => `<select style="min-width:210px" class="${t.aiConf ? 'ai-picked' : ''}" onchange="Banking.setCat('${t.id}',this.value)">${catOptions(t.category)}</select>` },
          { key: 'aiConf', label: 'Suggestion', render: t => t.aiConf ? `<div class="conf" title="${Fmt.esc(t.aiWhy)}"><span class="meter"><i style="width:${Math.round(t.aiConf * 100)}%;background:${t.aiConf > .75 ? 'var(--green)' : t.aiConf > .5 ? '#c98a12' : 'var(--red)'}"></i></span><b class="num">${Math.round(t.aiConf * 100)}%</b></div><div class="t2" style="max-width:220px">${Fmt.esc(t.aiWhy)}</div>` : '<span class="t2">Not checked yet</span>' },
          { key: 'a', label: 'Action', nosort: true, cls: 'r', render: t => `<button class="btn sm primary" onclick="Banking.accept(['${t.id}'])">Add</button>` },
        ] });
    }
    return DataTable.render('bank', { rows: rs, sort: 'date', pageSize: 25,
      batch: [['Recategorize', ids => recat(ids)], ['Export', ids => exportCSV(ids)], ['Delete', ids => confirmDel(ids)]],
      empty: `<div class="empty"><div class="ill">${I('bank')}</div><h3>No transactions match</h3><p>Record money in and out, or upload a bank CSV.</p><button class="btn primary" onclick="Banking.txForm()">${I('plus')} Add transaction</button></div>`,
      cols: [
        { key: 'date', label: 'Date', render: t => `<span class="num">${Fmt.date(t.date)}</span>` },
        { key: 'desc', label: 'Description', render: t => `<div class="t1">${Fmt.esc(t.desc)}</div><div class="t2">${Fmt.esc(t.payee || '')}</div>` },
        { key: 'category', label: 'Category', val: t => CAT[t.category]?.name || '', render: t => `${CAT[t.category]?.name || t.category}${CAT[t.category]?.ded === .5 ? ' <span class="badge b-warn nodot">50%</span>' : ''}<div class="t2">Sch. C line ${CAT[t.category]?.line || '—'}</div>` },
        { key: 'out', label: 'Spent', cls: 'r', val: t => isInflow(t.category) ? 0 : t.amount, render: t => isInflow(t.category) ? '' : F(t.amount, 2) },
        { key: 'in', label: 'Received', cls: 'r', val: t => isInflow(t.category) ? t.amount : 0, render: t => isInflow(t.category) ? `<b class="up">${F(t.amount, 2)}</b>` : '' },
        { key: 'a', label: 'Action', nosort: true, cls: 'r', render: t => `<span class="row-action"><button class="link" onclick="Banking.editTx('${t.id}')">Edit</button><button class="more" onclick="Banking.rowMenu(this,'${t.id}')">${I('down')}</button></span>` },
      ] });
  }

  function page() {
    const s = Store.state;
    const bal = Ledger.cashBalance(s);
    const r30 = Ledger.range('last30');
    const t30 = s.transactions.filter(t => Ledger.inRange(t, r30) && !t.review);
    const in30 = t30.filter(t => isInflow(t.category)).reduce((a, t) => a + t.amount, 0);
    const out30 = t30.filter(t => !isInflow(t.category)).reduce((a, t) => a + t.amount, 0);
    const nReview = s.transactions.filter(t => t.review).length;
    const nAll = s.transactions.length - nReview;
    const months = [...new Set(s.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    return `<div class="grid g4" style="margin-bottom:18px">
        <div class="card" style="padding:16px 18px"><div class="row" style="flex-wrap:nowrap"><div class="bank-logo">${I('bank')}</div><div><div class="t1" style="font-weight:700">Business Checking</div><div class="small muted">•••• 4821, Updated today</div></div></div>
          <div class="row" style="margin-top:12px;justify-content:space-between;flex-wrap:nowrap;align-items:flex-end"><div><div class="small muted">Bank balance</div><div style="font-size:21px;font-weight:750" class="num">${F(bal, 2)}</div></div>
          <div style="text-align:right"><div class="small muted">In Bookwise</div><div style="font-size:15px;font-weight:650" class="num">${F(bal, 2)}</div></div></div></div>
        <div class="card kpi"><div class="label">Money in, 30 days</div><div class="value up">${F(in30)}</div><div class="delta">${t30.filter(t => isInflow(t.category)).length} deposits</div></div>
        <div class="card kpi"><div class="label">Money out, 30 days</div><div class="value">${F(out30)}</div><div class="delta">${t30.filter(t => !isInflow(t.category)).length} payments</div></div>
        <div class="card kpi" style="cursor:pointer" onclick="Banking.setTab('review')"><div class="label">To review</div><div class="value ${nReview ? 'down' : ''}">${nReview}</div><div class="delta">${nReview ? 'Categorise imported transactions' : 'Everything is categorised'}</div></div>
      </div>
      <div class="tabs"><button class="tab ${tab === 'review' ? 'active' : ''}" onclick="Banking.setTab('review')">For review<span class="cnt">${nReview}</span></button>
        <button class="tab ${tab === 'all' ? 'active' : ''}" onclick="Banking.setTab('all')">Categorized<span class="cnt">${nAll}</span></button></div>
      <div class="card flush">
        <div class="table-toolbar">
          <div class="search-in">${I('search')}<input placeholder="Search description, payee or amount" value="${Fmt.esc(filt.q)}" oninput="Banking.f('q',this.value)"/></div>
          <select onchange="Banking.f('range',this.value)">${Ledger.RANGE_OPTS.slice().reverse().map(([k, l]) => `<option value="${k}" ${filt.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select onchange="Banking.f('dir',this.value)"><option value="">All transactions</option><option value="in" ${filt.dir === 'in' ? 'selected' : ''}>Money in</option><option value="out" ${filt.dir === 'out' ? 'selected' : ''}>Money out</option></select>
          <select onchange="Banking.f('cat',this.value)"><option value="">All categories</option>${catOptions(filt.cat)}</select>
          <span class="spacer"></span>${tab === 'review' && nReview ? `<button class="btn sm primary" onclick="Banking.suggestAll()">${I('spark')} Suggest categories</button>` : ''}<span class="small muted">${months.length ? `${Fmt.month(months[months.length - 1])} – ${Fmt.month(months[0])}` : ''}</span>
        </div>
        <div id="bank-table">${table()}</div>
      </div>`;
  }

  function txForm(t = {}) {
    const isNew = !t.id;
    t = { date: today(), desc: '', payee: '', category: 'other_exp', amount: '', memo: '', ...t };
    const payees = [...new Set(Store.state.transactions.map(x => x.payee).filter(Boolean))].slice(0, 200);
    const inflow = isInflow(t.category);
    App.drawer(isNew ? (inflow ? 'Record money in' : 'Record money out') : 'Edit transaction', `
      <div class="seg" style="margin-bottom:18px" id="t-dir"><button type="button" class="${inflow ? '' : 'on'}" data-d="out">Money out</button><button type="button" class="${inflow ? 'on' : ''}" data-d="in">Money in</button></div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <label class="f">Date<input type="date" id="t-date" value="${t.date}"/></label>
        <label class="f">Amount<div class="money-in"><input type="number" step="0.01" id="t-amt" value="${t.amount}" placeholder="0.00"/></div></label>
        <label class="f" style="grid-column:1/-1">Payee / customer<input id="t-payee" list="payees" value="${Fmt.esc(t.payee)}" placeholder="Who was it paid to or received from?"/><datalist id="payees">${payees.map(p => `<option value="${Fmt.esc(p)}">`).join('')}</datalist></label>
        <label class="f" style="grid-column:1/-1">Description<input id="t-desc" value="${Fmt.esc(t.desc)}" placeholder="e.g. Google Ads — March"/></label>
        <label class="f" style="grid-column:1/-1">Category<select id="t-cat">${catOptions(t.category)}</select><span class="hint" id="t-hint"></span></label>
        <label class="f" style="grid-column:1/-1">Memo<textarea id="t-memo" rows="2" placeholder="Optional — business purpose, attendees, receipt #">${Fmt.esc(t.memo || '')}</textarea></label>
      </div>`,
      `${!isNew ? `<button class="btn danger" onclick="Banking.confirmDel(['${t.id}'])">Delete</button><span class="spacer"></span>` : ''}<button class="btn" onclick="App.closeAll()">Cancel</button>${isNew ? `<button class="btn" onclick="Banking.saveTx('',true)">Save and new</button>` : ''}<button class="btn primary" onclick="Banking.saveTx('${t.id || ''}')">Save</button>`,
      d => {
        const hint = () => { const c = CAT[$('#t-cat', d).value]; $('#t-hint', d).textContent = c ? `${c.type === 'income' || c.type === 'equity_in' ? 'Money in' : 'Money out'}, IRS Schedule C line ${c.line}${c.ded === .5 ? ', 50% deductible' : c.ded === 0 ? ', not deductible' : ''}` : ''; };
        $('#t-cat', d).addEventListener('change', hint); hint();
        $$('#t-dir button', d).forEach(b => b.onclick = () => { $$('#t-dir button', d).forEach(x => x.classList.toggle('on', x === b)); $('#t-cat', d).value = b.dataset.d === 'in' ? 'services' : 'other_exp'; hint(); });
        $('#t-desc', d).addEventListener('blur', e => { if (isNew && e.target.value) { const g = guess(e.target.value, 0); if (g !== 'other_exp') { $('#t-cat', d).value = g; hint(); } } });
        setTimeout(() => $('#t-amt', d).focus(), 80);
      });
  }
  function saveTx(id, again) {
    const amt = Math.abs(+$('#t-amt').value), desc = $('#t-desc').value.trim() || $('#t-payee').value.trim();
    if (!amt) return App.toast('Enter an amount');
    if (!desc) return App.toast('Add a payee or description');
    const rec = { date: $('#t-date').value || today(), desc, payee: $('#t-payee').value.trim(), category: $('#t-cat').value, amount: amt, memo: $('#t-memo').value.trim(), account: 'checking' };
    const s = Store.state;
    if (id) Object.assign(s.transactions.find(t => t.id === id), rec, { review: false }); else s.transactions.push({ id: uid(), ...rec });
    s.taxSynced = false; Store.save(); App.toast(id ? 'Transaction updated' : 'Transaction saved');
    if (again) { App.closeAll(); App.render(); txForm({ category: rec.category, date: rec.date }); } else App.render();
  }
  function accept(ids) { const s = Store.state; ids.forEach(id => { const t = s.transactions.find(x => x.id === id); if (t) t.review = false; }); s.taxSynced = false; Store.save(); App.render(); App.toast(`${ids.length} transaction${ids.length > 1 ? 's' : ''} added to your books`); }
  function remove(ids) { const s = Store.state; s.transactions = s.transactions.filter(t => !ids.includes(t.id)); s.taxSynced = false; Store.save(); App.render(); App.toast(`${ids.length} removed`); }
  function confirmDel(ids) {
    App.modal('Delete transactions?', `<p>Delete <b>${ids.length}</b> transaction${ids.length > 1 ? 's' : ''}? This can't be undone.</p>`,
      `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn primary" style="background:var(--bad);border-color:var(--bad)" id="del-go">Delete</button>`,
      m => $('#del-go', m).onclick = () => { remove(ids); App.closeAll(); });
  }
  function recat(ids) {
    App.modal(`Recategorize ${ids.length} transaction${ids.length > 1 ? 's' : ''}`, `<label class="f">New category<select id="rc">${catOptions('other_exp')}</select></label>`,
      `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn primary" id="rc-go">Apply</button>`,
      m => $('#rc-go', m).onclick = () => { const c = $('#rc', m).value, s = Store.state; ids.forEach(id => { const t = s.transactions.find(x => x.id === id); if (t) t.category = c; }); s.taxSynced = false; Store.save(); App.closeModal(); App.render(); App.toast('Categories updated'); });
  }
  function exportCSV(ids) {
    const list = ids ? Store.state.transactions.filter(t => ids.includes(t.id)) : Store.state.transactions;
    App.download('transactions.csv', App.csv([['Date', 'Description', 'Payee', 'Category', 'Schedule C line', 'Amount', 'Memo']].concat(
      [...list].sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.desc, t.payee, CAT[t.category]?.name, CAT[t.category]?.line, ((isInflow(t.category) ? 1 : -1) * t.amount).toFixed(2), t.memo || '']))), 'text/csv');
  }
  function importCSV() {
    App.modal('Upload bank transactions', `<p class="small">Export a CSV from your bank (most banks offer this under <i>Download transactions</i>). We need <b>date</b>, <b>description</b> and <b>amount</b> columns — negative amounts are money out. Imported rows go to <b>For review</b> with a suggested category.</p>
      <label class="btn" style="margin-top:6px">${I('ul')} Choose CSV file<input type="file" id="csv-file" accept=".csv,text/csv" style="display:none"/></label><div id="csv-prev" class="small" style="margin-top:14px"></div>`,
      `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn primary" id="csv-go" disabled>Import</button>`, m => {
        let parsed = [];
        $('#csv-file', m).addEventListener('change', async e => {
          const text = await e.target.files[0].text();
          const lines = text.trim().split(/\r?\n/).map(l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()));
          const head = lines[0].map(h => h.toLowerCase());
          const di = head.findIndex(h => h.includes('date')), ds = head.findIndex(h => /desc|memo|name|payee/.test(h)), ai = head.findIndex(h => h.includes('amount'));
          if (di < 0 || ds < 0 || ai < 0) { $('#csv-prev', m).innerHTML = '<span class="err">We couldn\'t find date, description and amount columns.</span>'; return; }
          parsed = lines.slice(1).filter(l => l[ai]).map(l => {
            const raw = +l[ai].replace(/[$,]/g, ''); const d = new Date(l[di]);
            return { id: uid(), date: isNaN(d) ? today() : d.toISOString().slice(0, 10), desc: l[ds], payee: '', category: guess(l[ds], raw), amount: Math.abs(raw), account: 'checking', review: true, dir: raw > 0 ? 'in' : 'out' };
          });
          $('#csv-prev', m).innerHTML = `<b>${parsed.length}</b> transactions found. Preview:<table style="margin-top:8px">${parsed.slice(0, 5).map(p => `<tr><td>${p.date}</td><td>${Fmt.esc(p.desc)}</td><td class="r">${F(p.amount, 2)}</td><td>${CAT[p.category].name}</td></tr>`).join('')}</table>`;
          $('#csv-go', m).disabled = false;
        });
        $('#csv-go', m).onclick = () => { Store.state.transactions.push(...parsed); Store.save(); App.closeModal(); tab = 'review'; location.hash = '#/banking'; App.render(); App.toast(`${parsed.length} transactions ready for review`); };
      });
  }

  return {
    page, txForm, saveTx, accept, confirmDel, importCSV, exportCSV, catOptions, guess,
    setTab(t) { tab = t; DataTable.reset('bank'); App.render(); },
    suggestAll() {
      const list = Store.state.transactions.filter(t => t.review);
      list.forEach(t => { const r = AI.suggest(t); t.category = r.category; t.aiConf = r.conf; t.aiWhy = r.why; });
      Store.save(); $('#bank-table').innerHTML = table();
      $$('#bank-table tbody tr').forEach((tr, i) => { tr.style.animationDelay = (i * 60) + 'ms'; tr.classList.add('ai-row'); });
      const hi = list.filter(t => t.aiConf > .75).length;
      App.toast(`${list.length} suggestions ready, ${hi} with high confidence`);
    },
    f(k, v) { filt[k] = v; DataTable.reset('bank'); DataTable.reset('review'); $('#bank-table').innerHTML = table(); },
    setCat(id, c) { const t = Store.state.transactions.find(x => x.id === id); t.category = c; Store.save(); },
    editTx: id => txForm(Store.state.transactions.find(t => t.id === id)),
    rowMenu(btn, id) {
      const t = Store.state.transactions.find(x => x.id === id);
      App.menu(btn, [['Edit', () => txForm(t)], ['Duplicate', () => txForm({ ...t, id: undefined, date: today() })], ['Send to review', () => { t.review = true; Store.save(); App.render(); }], ['Delete', () => confirmDel([id]), 'bad']]);
    },
  };
})();

App.register('banking', {
  title: 'Banking', crumb: 'Bookkeeping', sub: () => 'Your bank register — review, categorise and reconcile money in and out',
  actions: () => `<button class="btn" onclick="Banking.exportCSV()">${I('dl')} Export</button><button class="btn" onclick="Banking.importCSV()">${I('ul')} Upload transactions</button><button class="btn primary" onclick="Banking.txForm()">${I('plus')} Add transaction</button>`,
  render: Banking.page,
  mount: () => { if (location.hash.includes('new=1')) { history.replaceState(null, '', '#/banking'); Banking.txForm(); } },
});
