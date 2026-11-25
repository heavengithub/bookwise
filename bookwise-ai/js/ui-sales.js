/* =========================================================================
   Bookwise — Sales: invoices, payments, customers
   ========================================================================= */
const Sales = (() => {
  const F = Fmt.money;
  let mbFilter = '';
  const filt = { q: '', status: '', range: 'all' };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);

  /* ---------- customers (records + anyone you've invoiced) ---------- */
  function customers() {
    const s = Store.state, map = {};
    const get = n => (map[n] = map[n] || { name: n, email: '', phone: '', company: '', address: '', open: 0, overdue: 0, paid12: 0, invoices: 0, last: '', rec: null });
    s.customers.forEach(c => Object.assign(get(c.name), { email: c.email, phone: c.phone, company: c.company, address: c.address, rec: c }));
    const t12 = Ledger.range('t12');
    s.invoices.forEach(i => {
      const c = get(i.client), st = Ledger.invoiceStatus(i), amt = Ledger.invTotal(i);
      if (!c.email) c.email = i.email;
      c.invoices++; if (i.issue > c.last) c.last = i.issue;
      if (st === 'sent' || st === 'overdue') c.open += amt;
      if (st === 'overdue') c.overdue += amt;
      if (st === 'paid' && i.paidDate >= t12[0]) c.paid12 += amt;
    });
    return Object.values(map).map(c => ({ ...c, id: c.name }));
  }

  function statusCell(i) {
    const st = Ledger.invoiceStatus(i), d = daysBetween(today(), i.due);
    if (st === 'paid') return `<span class="badge b-paid">Paid</span><div class="t2">${Fmt.date(i.paidDate)}</div>`;
    if (st === 'draft') return `<span class="badge b-draft">Draft</span>`;
    if (st === 'overdue') return `<span class="badge b-overdue">Overdue ${-d} day${-d === 1 ? '' : 's'}</span>`;
    return `<span class="badge b-sent">${d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`}</span>`;
  }

  /* ---------- Invoices page ---------- */
  function moneybar() {
    const s = Store.state, d30 = Ledger.range('last30')[0];
    const sum = f => s.invoices.filter(f).reduce((a, i) => a + Ledger.invTotal(i), 0);
    const cnt = f => s.invoices.filter(f).length;
    const isO = i => Ledger.invoiceStatus(i) === 'overdue', isN = i => Ledger.invoiceStatus(i) === 'sent', isD = i => i.status === 'draft', isP = i => i.status === 'paid' && i.paidDate >= d30;
    const seg = (k, label, f, color) => `<div class="${mbFilter === k ? 'on' : ''}" onclick="Sales.mb('${k}')"><div class="mlabel">${cnt(f)} ${label}</div><div class="mamt">${F(sum(f))}</div><div class="mstrip" style="background:${color}"></div></div>`;
    return `<div class="small" style="display:flex;justify-content:space-between;margin-bottom:6px;font-weight:700;color:var(--ink-2)"><span>Unpaid</span><span>Paid in the last 30 days</span></div>
      <div class="moneybar">${seg('overdue', 'overdue', isO, '#b42318')}${seg('sent', 'not due yet', isN, '#7c8698')}${seg('draft', 'drafts', isD, '#c9d1c5')}${seg('paid30', 'paid', isP, '#2f7d4f')}</div>`;
  }
  function invRows() {
    const s = Store.state, r = Ledger.range(filt.range), d30 = Ledger.range('last30')[0];
    return s.invoices.filter(i => {
      const st = Ledger.invoiceStatus(i);
      if (mbFilter === 'paid30' && !(i.status === 'paid' && i.paidDate >= d30)) return false;
      if (mbFilter && mbFilter !== 'paid30' && st !== mbFilter) return false;
      if (filt.status && st !== filt.status) return false;
      if (filt.q && !`${i.number} ${i.client} ${i.items.map(x => x.desc).join(' ')}`.toLowerCase().includes(filt.q.toLowerCase())) return false;
      return i.issue >= r[0] && i.issue <= r[1];
    }).map(i => ({ ...i, total: Ledger.invTotal(i) }));
  }
  function invTable() {
    return DataTable.render('inv', { rows: invRows(), sort: 'issue', pageSize: 25,
      batch: [['Mark as paid', ids => markPaid(ids)], ['Print', ids => ids[0] && viewInvoice(ids[0])], ['Delete', ids => delInvoices(ids)]],
      empty: `<div class="empty"><div class="ill">${I('invoice')}</div><h3>No invoices here</h3><p>Create an invoice to get paid faster.</p><button class="btn primary" onclick="Sales.invoiceForm()">${I('plus')} Create invoice</button></div>`,
      cols: [
        { key: 'issue', label: 'Date', render: i => `<span class="num">${Fmt.date(i.issue)}</span>` },
        { key: 'number', label: 'No.', render: i => `<a href="javascript:Sales.viewInvoice('${i.id}')" style="font-weight:650">${i.number.replace('INV-', '')}</a>` },
        { key: 'client', label: 'Customer', render: i => `<div class="t1">${Fmt.esc(i.client)}</div><div class="t2">${Fmt.esc(i.items[0]?.desc || '')}${i.items.length > 1 ? ` +${i.items.length - 1}` : ''}</div>` },
        { key: 'due', label: 'Due date', render: i => `<span class="num">${Fmt.date(i.due)}</span>` },
        { key: 'total', label: 'Amount', cls: 'r', render: i => `<b>${F(i.total, 2)}</b>` },
        { key: 'status', label: 'Status', val: i => Ledger.invoiceStatus(i), render: statusCell },
        { key: 'a', label: 'Action', nosort: true, cls: 'r', render: i => {
          const st = Ledger.invoiceStatus(i);
          const main = st === 'paid' ? ['View', `Sales.viewInvoice('${i.id}')`] : st === 'draft' ? ['Edit', `Sales.editInvoice('${i.id}')`] : ['Receive payment', `Sales.receivePayment('${i.client.replace(/'/g, "\\'")}')`];
          return `<span class="row-action"><button class="link" onclick="${main[1]}">${main[0]}</button><button class="more" onclick="Sales.rowMenu(this,'${i.id}')">${I('down')}</button></span>`;
        } },
      ] });
  }
  function invoicesPage() {
    return `${moneybar()}
      <div class="card flush"><div class="table-toolbar">
        <div class="search-in">${I('search')}<input placeholder="Search invoice #, customer or item" value="${Fmt.esc(filt.q)}" oninput="Sales.f('q',this.value)"/></div>
        <select onchange="Sales.f('status',this.value)"><option value="">All statuses</option>${[['overdue', 'Overdue'], ['sent', 'Open — not due'], ['draft', 'Draft'], ['paid', 'Paid']].map(([v, l]) => `<option value="${v}" ${filt.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select onchange="Sales.f('range',this.value)">${Ledger.RANGE_OPTS.slice().reverse().map(([k, l]) => `<option value="${k}" ${filt.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${mbFilter ? `<button class="btn sm" onclick="Sales.mb('')">${I('x')} Clear filter</button>` : ''}
        <span class="spacer"></span><button class="btn sm" onclick="Sales.exportInv()">${I('dl')} Export</button>
      </div><div id="inv-table">${invTable()}</div></div>`;
  }

  /* ---------- Invoice full-screen form ---------- */
  function invoiceForm(inv, preset = {}) {
    const s = Store.state;
    const next = 'INV-' + (Math.max(1000, ...s.invoices.map(i => +i.number.replace(/\D/g, '') || 0)) + 1);
    const plus = d => { const x = new Date(Date.now() + d * 864e5); return x.toISOString().slice(0, 10); };
    const editing = !!inv;
    inv = inv ? JSON.parse(JSON.stringify(inv)) : { number: next, client: preset.client || '', email: '', address: '', terms: 30, issue: today(), due: plus(30), items: [{ desc: '', detail: '', qty: 1, rate: '' }, { desc: '', detail: '', qty: 1, rate: '' }], notes: 'Thank you for your business! Payment is due within the terms above.', discount: 0, status: 'sent' };
    inv.items.forEach(it => { it.detail = it.detail || ''; });
    const cs = customers();
    const services = [...new Set(s.invoices.flatMap(i => i.items.map(x => x.desc)))].filter(Boolean);
    const total = () => { const sub = inv.items.reduce((a, i) => a + (+i.qty || 0) * (+i.rate || 0), 0); const disc = sub * (+inv.discount || 0) / 100; return { sub, disc, total: sub - disc }; };
    const lineRows = () => inv.items.map((it, k) => `<tr><td class="idx">${k + 1}</td>
      <td style="width:24%"><input data-i="${k}" data-f="desc" list="svc" value="${Fmt.esc(it.desc)}" placeholder="Product or service"/></td>
      <td><input data-i="${k}" data-f="detail" value="${Fmt.esc(it.detail)}" placeholder="Description"/></td>
      <td style="width:90px"><input type="number" data-i="${k}" data-f="qty" value="${it.qty}" style="text-align:right"/></td>
      <td style="width:130px"><input type="number" step="0.01" data-i="${k}" data-f="rate" value="${it.rate}" style="text-align:right" placeholder="0.00"/></td>
      <td class="r num" style="width:130px;font-weight:600" id="lt-${k}">${F((+it.qty || 0) * (+it.rate || 0), 2)}</td>
      <td style="width:36px"><button class="del" onclick="Sales._del(${k})" title="Delete line">${I('x')}</button></td></tr>`).join('');
    const body = `<div class="paper">
      <div class="row" style="align-items:flex-start;gap:24px">
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <label class="f">Customer<input id="i-client" list="cl" value="${Fmt.esc(inv.client)}" placeholder="Choose or add a customer"/><datalist id="cl">${cs.map(c => `<option value="${Fmt.esc(c.name)}">`).join('')}</datalist></label>
          <label class="f">Customer email<input id="i-email" type="email" value="${Fmt.esc(inv.email)}" placeholder="Separate emails with a comma"/></label>
          <label class="f" style="grid-column:1/-1">Billing address<textarea id="i-addr" rows="2">${Fmt.esc(inv.address || '')}</textarea></label>
        </div>
        <div class="balance"><div class="lbl">Balance due</div><div class="amt" id="i-bal">${F(total().total, 2)}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px;padding-top:18px;border-top:1px solid var(--line-2)">
        <label class="f">Terms<select id="i-terms">${[[0, 'Due on receipt'], [15, 'Net 15'], [30, 'Net 30'], [45, 'Net 45'], [60, 'Net 60']].map(([v, l]) => `<option value="${v}" ${+inv.terms === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">Invoice date<input type="date" id="i-issue" value="${inv.issue}"/></label>
        <label class="f">Due date<input type="date" id="i-due" value="${inv.due}"/></label>
        <label class="f">Invoice no.<input id="i-num" value="${inv.number}"/></label>
      </div>
      <table class="lines" style="margin-top:22px"><thead><tr><th>#</th><th>Product / service</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th><th></th></tr></thead><tbody id="i-lines">${lineRows()}</tbody></table>
      <datalist id="svc">${services.map(x => `<option value="${Fmt.esc(x)}">`).join('')}</datalist>
      <div class="row" style="margin-top:10px"><button class="btn sm" onclick="Sales._add()">Add lines</button><button class="btn sm" onclick="Sales._clear()">Clear all lines</button></div>
      <div class="row" style="align-items:flex-start;margin-top:12px;gap:30px">
        <label class="f" style="flex:1;max-width:460px">Message on invoice<textarea id="i-notes" rows="3">${Fmt.esc(inv.notes || '')}</textarea></label>
        <div class="totals"><div><span>Subtotal</span><span id="i-sub"></span></div>
          <div style="align-items:center"><span>Discount <input type="number" id="i-disc" value="${inv.discount || 0}" style="width:64px;height:30px;display:inline-block;margin:0 4px"/>%</span><span id="i-dsc"></span></div>
          <div class="grand"><span>Total</span><span id="i-tot"></span></div><div><span class="muted">Balance due</span><b id="i-bal2"></b></div></div>
      </div></div>`;
    App.full(editing ? `Invoice ${inv.number}` : 'New invoice', body,
      `<button class="btn" onclick="App.closeAll()">Cancel</button>${editing ? `<button class="btn" onclick="Sales.delInvoices(['${inv.id}'])">Delete</button>` : ''}<span class="spacer"></span>
       <button class="btn" onclick="Sales._save('draft')">Save draft</button><button class="btn primary" onclick="Sales._save('sent')">Save and close</button>`, m => {
        const recalc = () => { const t = total(); $('#i-sub', m).textContent = F(t.sub, 2); $('#i-dsc', m).textContent = t.disc ? '−' + F(t.disc, 2) : F(0, 2); $('#i-tot', m).textContent = F(t.total, 2); $('#i-bal', m).textContent = F(t.total, 2); $('#i-bal2', m).textContent = F(t.total, 2); };
        const bind = () => $$('#i-lines input', m).forEach(el => el.addEventListener('input', () => {
          const it = inv.items[+el.dataset.i]; it[el.dataset.f] = ['qty', 'rate'].includes(el.dataset.f) ? el.value : el.value;
          if (el.dataset.f === 'desc' && !it.rate) { const prev = s.invoices.flatMap(i => i.items).find(x => x.desc === el.value); if (prev) { it.rate = prev.rate; $(`[data-i="${el.dataset.i}"][data-f="rate"]`, m).value = prev.rate; } }
          $('#lt-' + el.dataset.i, m).textContent = F((+it.qty || 0) * (+it.rate || 0), 2); recalc();
        }));
        const draw = () => { $('#i-lines', m).innerHTML = lineRows(); bind(); recalc(); };
        Sales._add = () => { inv.items.push({ desc: '', detail: '', qty: 1, rate: '' }); draw(); };
        Sales._del = k => { inv.items.splice(k, 1); if (!inv.items.length) inv.items.push({ desc: '', detail: '', qty: 1, rate: '' }); draw(); };
        Sales._clear = () => { inv.items = [{ desc: '', detail: '', qty: 1, rate: '' }]; draw(); };
        const setDue = () => { const d = new Date($('#i-issue', m).value + 'T00:00:00'); d.setDate(d.getDate() + +$('#i-terms', m).value); $('#i-due', m).value = d.toISOString().slice(0, 10); };
        $('#i-terms', m).onchange = setDue; $('#i-issue', m).onchange = setDue;
        $('#i-disc', m).oninput = e => { inv.discount = +e.target.value || 0; recalc(); };
        $('#i-client', m).addEventListener('change', e => { const c = cs.find(x => x.name === e.target.value); if (c) { if (!$('#i-email', m).value) $('#i-email', m).value = c.email || ''; if (!$('#i-addr', m).value) $('#i-addr', m).value = c.address || ''; } });
        Sales._save = status => {
          inv.client = $('#i-client', m).value.trim(); inv.email = $('#i-email', m).value.trim(); inv.address = $('#i-addr', m).value.trim();
          inv.terms = +$('#i-terms', m).value; inv.issue = $('#i-issue', m).value; inv.due = $('#i-due', m).value; inv.number = $('#i-num', m).value.trim(); inv.notes = $('#i-notes', m).value;
          inv.items = inv.items.filter(i => i.desc || +i.rate).map(i => ({ ...i, qty: +i.qty || 1, rate: +i.rate || 0 }));
          if (inv.discount) { const t = inv.items.reduce((a, i) => a + i.qty * i.rate, 0) * inv.discount / 100; inv.items.push({ desc: `Discount (${inv.discount}%)`, detail: '', qty: 1, rate: -Math.round(t * 100) / 100 }); inv.discount = 0; }
          if (!inv.client) return App.toast('Choose a customer');
          if (!inv.items.length) return App.toast('Add at least one line');
          if (inv.status !== 'paid') inv.status = status;
          if (!s.customers.some(c => c.name === inv.client) && !s.invoices.some(i => i.client === inv.client)) s.customers.push({ id: uid(), name: inv.client, email: inv.email, address: inv.address });
          if (inv.id) s.invoices[s.invoices.findIndex(x => x.id === inv.id)] = inv; else s.invoices.push({ id: uid(), ...inv });
          Store.save(); App.closeAll(); App.render(); App.toast(status === 'draft' ? `Draft ${inv.number} saved` : `Invoice ${inv.number} saved`);
        };
        bind(); recalc(); if (!inv.client) setTimeout(() => $('#i-client', m).focus(), 60);
      });
  }

  function viewInvoice(id) {
    const i = Store.state.invoices.find(x => x.id === id), c = Store.state.company, st = Ledger.invoiceStatus(i), tot = Ledger.invTotal(i);
    App.modal(`Invoice ${i.number}`, `<div class="invoice-doc">
      <div class="ih"><div><div class="big">INVOICE</div><div class="muted">${i.number}</div><div style="margin-top:8px">${statusCell(i)}</div></div>
        <div style="text-align:right"><b style="font-size:16px">${Fmt.esc(c.name)}</b><br><span class="muted small">Invoice date ${Fmt.date(i.issue)}<br>Due ${Fmt.date(i.due)}</span></div></div>
      <div style="margin-bottom:18px"><div class="small muted" style="font-weight:700;letter-spacing:.05em">BILL TO</div><b>${Fmt.esc(i.client)}</b><br><span class="small">${Fmt.esc(i.address || '')}${i.address ? '<br>' : ''}${Fmt.esc(i.email || '')}</span></div>
      <table><thead><tr><th>Product / service</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
        ${i.items.map(it => `<tr><td><b>${Fmt.esc(it.desc)}</b>${it.detail ? `<div class="t2">${Fmt.esc(it.detail)}</div>` : ''}</td><td class="r">${it.qty}</td><td class="r">${F(it.rate, 2)}</td><td class="r">${F(it.qty * it.rate, 2)}</td></tr>`).join('')}
        <tr class="total"><td colspan="3">Total</td><td class="r">${F(tot, 2)}</td></tr>
        <tr><td colspan="3"><b>Balance due</b></td><td class="r"><b style="font-size:17px">${F(st === 'paid' ? 0 : tot, 2)}</b></td></tr></tbody></table>
      <p class="small muted" style="margin-top:16px">${Fmt.esc(i.notes || '')}</p></div>`,
      `<button class="btn" onclick="App.closeModal();Sales.editInvoice('${i.id}')">Edit</button><span class="spacer"></span>
       <button class="btn" onclick="document.body.classList.add('printing');window.print();document.body.classList.remove('printing')">${I('print')} Print / PDF</button>
       ${st !== 'paid' ? `<button class="btn primary" onclick="App.closeModal();Sales.receivePayment('${i.client.replace(/'/g, "\\'")}','${i.id}')">Receive payment</button>` : ''}`);
  }

  /* ---------- Receive payment ---------- */
  function receivePayment(client, invId) {
    const cs = customers().filter(c => c.open > 0);
    client = client || cs[0]?.name || '';
    const draw = cl => {
      const open = Store.state.invoices.filter(i => i.client === cl && i.status !== 'paid' && i.status !== 'draft');
      return open.length ? `<table><thead><tr><th class="cb"></th><th>Invoice</th><th>Due</th><th class="r">Open balance</th></tr></thead><tbody>
        ${open.map(i => `<tr><td class="cb"><input type="checkbox" class="rp" value="${i.id}" ${!invId || invId === i.id ? 'checked' : ''}/></td><td><b>${i.number}</b><div class="t2">${Fmt.date(i.issue)}</div></td><td>${statusCell(i)}</td><td class="r num">${F(Ledger.invTotal(i), 2)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No open invoices for this customer.</div>';
    };
    App.drawer('Receive payment', `<div class="form-grid" style="grid-template-columns:1fr 1fr">
        <label class="f" style="grid-column:1/-1">Customer<select id="rp-c">${(cs.some(c => c.name === client) ? cs : [{ name: client }, ...cs]).filter(c => c.name).map(c => `<option ${c.name === client ? 'selected' : ''}>${Fmt.esc(c.name)}</option>`).join('')}</select></label>
        <label class="f">Payment date<input type="date" id="rp-d" value="${today()}"/></label>
        <label class="f">Payment method<select id="rp-m"><option>ACH / bank transfer</option><option>Credit card</option><option>Check</option><option>Cash</option></select></label>
        <label class="f">Reference no.<input id="rp-ref" placeholder="Optional"/></label>
        <label class="f">Deposit to<select><option>Business Checking •••• 4821</option></select></label></div>
      <h3 style="margin:22px 0 10px">Outstanding transactions</h3><div id="rp-list">${draw(client)}</div>
      <div class="totals"><div class="grand"><span>Amount received</span><span id="rp-amt"></span></div></div>`,
      `<button class="btn" onclick="App.closeAll()">Cancel</button><button class="btn primary" id="rp-go">Save and close</button>`, d => {
        const sum = () => { $('#rp-amt', d).textContent = F($$('.rp:checked', d).reduce((a, cb) => a + Ledger.invTotal(Store.state.invoices.find(i => i.id === cb.value)), 0), 2); };
        const bind = () => $$('.rp', d).forEach(cb => cb.onchange = sum);
        $('#rp-c', d).onchange = e => { $('#rp-list', d).innerHTML = draw(e.target.value); bind(); sum(); };
        bind(); sum();
        $('#rp-go', d).onclick = () => { const ids = $$('.rp:checked', d).map(c => c.value); if (!ids.length) return App.toast('Select at least one invoice'); markPaid(ids, $('#rp-d', d).value, $('#rp-m', d).value); App.closeAll(); };
      });
  }
  function markPaid(ids, date = today(), method = '') {
    const s = Store.state; let n = 0, amt = 0;
    ids.forEach(id => { const i = s.invoices.find(x => x.id === id); if (!i || i.status === 'paid') return;
      i.status = 'paid'; i.paidDate = date; n++; amt += Ledger.invTotal(i);
      s.transactions.push({ id: uid(), date, desc: `Payment ${i.number}${method ? ', ' + method : ''}`, payee: i.client, category: 'services', amount: Ledger.invTotal(i), account: 'checking' }); });
    s.taxSynced = false; Store.save(); App.render(); if (n) App.stamp('Paid'); App.toast(n ? `${F(amt, 2)} received on ${n} invoice${n > 1 ? 's' : ''}` : 'Already paid');
  }
  function delInvoices(ids) {
    App.modal('Delete invoice?', `<p>Delete ${ids.length} invoice${ids.length > 1 ? 's' : ''}? Payments already recorded stay in Banking.</p>`,
      `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn primary" style="background:var(--bad);border-color:var(--bad)" id="d-go">Delete</button>`,
      m => $('#d-go', m).onclick = () => { const s = Store.state; s.invoices = s.invoices.filter(i => !ids.includes(i.id)); Store.save(); App.closeAll(); App.render(); App.toast('Deleted'); });
  }

  /* ---------- Customers ---------- */
  function customersPage() {
    const cs = customers(), F0 = F;
    const open = cs.reduce((a, c) => a + c.open, 0), over = cs.reduce((a, c) => a + c.overdue, 0);
    const d30 = Ledger.range('last30')[0];
    const paid30 = Store.state.invoices.filter(i => i.status === 'paid' && i.paidDate >= d30).reduce((a, i) => a + Ledger.invTotal(i), 0);
    return `<div class="moneybar"><div><div class="mlabel">Customers</div><div class="mamt">${cs.length}</div><div class="mstrip" style="background:#7c8698"></div></div>
        <div><div class="mlabel">Open balance</div><div class="mamt">${F0(open)}</div><div class="mstrip" style="background:#1c2b4a"></div></div>
        <div><div class="mlabel">Overdue</div><div class="mamt ${over ? 'down' : ''}">${F0(over)}</div><div class="mstrip" style="background:#b42318"></div></div>
        <div><div class="mlabel">Paid last 30 days</div><div class="mamt">${F0(paid30)}</div><div class="mstrip" style="background:#2f7d4f"></div></div></div>
      <div class="card flush"><div class="table-toolbar"><div class="search-in">${I('search')}<input placeholder="Find a customer" oninput="Sales.cf(this.value)"/></div><span class="spacer"></span><button class="btn sm" onclick="Sales.exportCust()">${I('dl')} Export</button></div>
      <div id="cust-table">${custTable(cs)}</div></div>`;
  }
  function custTable(cs) {
    return DataTable.render('cust', { rows: cs, sort: 'open', pageSize: 25,
      empty: `<div class="empty"><div class="ill">${I('users')}</div><h3>Add your first customer</h3><p>Customers are added automatically when you invoice them.</p><button class="btn primary" onclick="Sales.customerForm()">${I('plus')} New customer</button></div>`,
      cols: [
        { key: 'name', label: 'Customer', render: c => `<div class="row" style="flex-wrap:nowrap"><span class="avatar" style="background:${color(c.name)}">${c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')}</span><div><a class="t1" href="javascript:void 0" onclick="Sales.customerDetail(${attr(c.name)})">${Fmt.esc(c.name)}</a><div class="t2">${Fmt.esc(c.company || c.email || '')}</div></div></div>` },
        { key: 'email', label: 'Email', render: c => c.email ? `<span class="small">${Fmt.esc(c.email)}</span>` : '<span class="muted">—</span>' },
        { key: 'invoices', label: 'Invoices', cls: 'r' },
        { key: 'paid12', label: 'Paid, 12 mo', cls: 'r', render: c => F(c.paid12) },
        { key: 'open', label: 'Open balance', cls: 'r', render: c => c.open ? `<b>${F(c.open, 2)}</b>${c.overdue ? `<div class="t2 down">${F(c.overdue)} overdue</div>` : ''}` : '<span class="muted">$0.00</span>' },
        { key: 'a', label: 'Action', nosort: true, cls: 'r', render: c => `<span class="row-action"><button class="link" onclick="${c.open ? `Sales.receivePayment(${attr(c.name)})` : `Sales.invoiceForm(null,{client:${attr(c.name)}})`}">${c.open ? 'Receive payment' : 'Create invoice'}</button><button class="more" onclick="Sales.custMenu(this,${attr(c.name)})">${I('down')}</button></span>` },
      ] });
  }
  const attr = s => JSON.stringify(s).replace(/"/g, '&quot;');
  const color = n => ['#1c2b4a', '#2f7d4f', '#5b4a7a', '#7a5a22', '#2c6a6b', '#8a3a30', '#4a5670'][[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 7];

  function customerDetail(name) {
    const c = customers().find(x => x.name === name) || { name, open: 0, overdue: 0, paid12: 0, invoices: 0 };
    const inv = Store.state.invoices.filter(i => i.client === name).sort((a, b) => b.issue.localeCompare(a.issue));
    App.drawer(Fmt.esc(name), `<div class="row" style="flex-wrap:nowrap;margin-bottom:16px"><span class="avatar" style="width:52px;height:52px;font-size:18px;background:${color(name)}">${name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')}</span>
        <div><div style="font-weight:700;font-size:17px">${Fmt.esc(name)}</div><div class="small muted">${Fmt.esc(c.email || 'No email on file')}${c.phone ? ', ' + Fmt.esc(c.phone) : ''}</div></div></div>
      <div class="stat-row" style="grid-template-columns:repeat(3,1fr)"><div><div class="l">Open</div><div class="v">${F(c.open)}</div></div><div><div class="l">Overdue</div><div class="v ${c.overdue ? 'down' : ''}">${F(c.overdue)}</div></div><div><div class="l">Paid, 12 mo</div><div class="v">${F(c.paid12)}</div></div></div>
      <h3 style="margin-bottom:8px">Transactions</h3>
      <table><thead><tr><th>Date</th><th>No.</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>
        ${inv.map(i => `<tr style="cursor:pointer" onclick="Sales.viewInvoice('${i.id}')"><td>${Fmt.date(i.issue)}</td><td><a>${i.number}</a></td><td class="r num">${F(Ledger.invTotal(i), 2)}</td><td>${statusCell(i)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No invoices yet.</td></tr>'}</tbody></table>`,
      `<button class="btn" onclick="Sales.customerForm(${attr(name)})">Edit customer</button><span class="spacer"></span>${c.open ? `<button class="btn" onclick="Sales.receivePayment(${attr(name)})">Receive payment</button>` : ''}<button class="btn primary" onclick="App.closeAll();Sales.invoiceForm(null,{client:${attr(name)}})">New invoice</button>`);
  }
  function customerForm(name) {
    const s = Store.state, base = customers().find(c => c.name === name) || {};
    const rec = s.customers.find(c => c.name === name) || {};
    App.drawer(name ? 'Edit customer' : 'New customer', `<div class="form-grid" style="grid-template-columns:1fr 1fr">
      <label class="f" style="grid-column:1/-1">Customer display name *<input id="c-name" value="${Fmt.esc(name || '')}" ${name && s.invoices.some(i => i.client === name) ? 'disabled title="Used on invoices"' : ''}/></label>
      <label class="f">Company<input id="c-co" value="${Fmt.esc(rec.company || base.company || '')}"/></label>
      <label class="f">Email<input id="c-email" type="email" value="${Fmt.esc(rec.email || base.email || '')}"/></label>
      <label class="f">Phone<input id="c-phone" value="${Fmt.esc(rec.phone || '')}"/></label>
      <label class="f">Default terms<select id="c-terms"><option value="30">Net 30</option><option value="15">Net 15</option><option value="0">Due on receipt</option></select></label>
      <label class="f" style="grid-column:1/-1">Billing address<textarea id="c-addr" rows="3">${Fmt.esc(rec.address || '')}</textarea></label>
      <label class="f" style="grid-column:1/-1">Notes<textarea id="c-notes" rows="2">${Fmt.esc(rec.notes || '')}</textarea></label></div>`,
      `<button class="btn" onclick="App.closeAll()">Cancel</button><button class="btn primary" id="c-go">Save</button>`, d => {
        $('#c-go', d).onclick = () => {
          const n = $('#c-name', d).value.trim(); if (!n) return App.toast('Enter a customer name');
          const data = { name: n, company: $('#c-co', d).value.trim(), email: $('#c-email', d).value.trim(), phone: $('#c-phone', d).value.trim(), address: $('#c-addr', d).value.trim(), notes: $('#c-notes', d).value.trim(), terms: +$('#c-terms', d).value };
          const i = s.customers.findIndex(c => c.name === (name || n));
          if (i >= 0) Object.assign(s.customers[i], data); else s.customers.push({ id: uid(), ...data });
          Store.save(); App.closeAll(); App.render(); App.toast('Customer saved');
        };
      });
  }

  async function reminder(id, tone = 0) {
    const inv = Store.state.invoices.find(i => i.id === id);
    const tones = ['Friendly', 'Neutral', 'Firm'];
    App.modal(`Reminder for ${inv.number}`, `<div class="row" style="margin-bottom:12px">${I('spark')}<b>Tone</b><div class="seg" id="rm-tone">${tones.map((t, i) => `<button class="${i === tone ? 'on' : ''}" data-t="${i}">${t}</button>`).join('')}</div><span class="ai-tag" id="rm-by"></span></div>
      <textarea id="rm-text" rows="12" style="font-family:var(--sans);line-height:1.5"></textarea><p class="small muted" style="margin-top:8px">Edit freely before sending. Sent to ${Fmt.esc(inv.email || 'the customer')}.</p>`,
      `<button class="btn" onclick="App.closeModal()">Close</button><button class="btn" id="rm-copy">Copy text</button><button class="btn primary" id="rm-mail">${I('mail')} Open in email</button>`, async m => {
        const fill = async t => { $('#rm-text', m).value = 'Writing…'; const r = await AI.reminder(inv, t); $('#rm-by', m).textContent = r.by; const ta = $('#rm-text', m); ta.value = '';
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) ta.value = r.text; else { let i = 0; const st = () => { i += 6; ta.value = r.text.slice(0, i); if (i < r.text.length) setTimeout(st, 8); }; st(); } };
        $$('#rm-tone button', m).forEach(b => b.onclick = () => { $$('#rm-tone button', m).forEach(x => x.classList.toggle('on', x === b)); fill(+b.dataset.t); });
        $('#rm-copy', m).onclick = () => { navigator.clipboard?.writeText($('#rm-text', m).value); App.toast('Reminder copied'); };
        $('#rm-mail', m).onclick = () => { const t = $('#rm-text', m).value, subj = (t.match(/^Subject:\s*(.*)$/m) || [, `Invoice ${inv.number}`])[1], body = t.replace(/^Subject:.*\n+/, ''); location.href = `mailto:${encodeURIComponent(inv.email || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`; };
        fill(tone);
      });
  }

  return {
    reminder,
    invoicesPage, invoiceForm, viewInvoice, receivePayment, markPaid, delInvoices, customersPage, customerDetail, customerForm, customers, statusCell,
    editInvoice: id => invoiceForm(Store.state.invoices.find(i => i.id === id)),
    mb(k) { mbFilter = mbFilter === k ? '' : k; DataTable.reset('inv'); App.render(); },
    f(k, v) { filt[k] = v; DataTable.reset('inv'); $('#inv-table').innerHTML = invTable(); },
    cf(q) { DataTable.reset('cust'); $('#cust-table').innerHTML = custTable(customers().filter(c => `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(q.toLowerCase()))); },
    rowMenu(btn, id) {
      const i = Store.state.invoices.find(x => x.id === id), st = Ledger.invoiceStatus(i);
      App.menu(btn, [['View / print', () => viewInvoice(id)], ['Edit', () => invoiceForm(i)], ...(st !== 'paid' ? [['Mark as paid', () => markPaid([id])]] : []),
        ['Duplicate', () => invoiceForm({ ...JSON.parse(JSON.stringify(i)), id: undefined, number: undefined, status: 'sent', paidDate: undefined, issue: today() })],
        ...(st === 'overdue' || st === 'sent' ? [['Draft a reminder email', () => reminder(id)]] : []),
        ['Delete', () => delInvoices([id]), 'bad']]);
    },
    custMenu(btn, name) { App.menu(btn, [['View details', () => customerDetail(name)], ['Create invoice', () => invoiceForm(null, { client: name })], ['Edit customer', () => customerForm(name)]]); },
    exportInv() { App.download('invoices.csv', App.csv([['Invoice', 'Customer', 'Date', 'Due', 'Amount', 'Status', 'Paid']].concat(Store.state.invoices.map(i => [i.number, i.client, i.issue, i.due, Ledger.invTotal(i).toFixed(2), Ledger.invoiceStatus(i), i.paidDate || '']))), 'text/csv'); },
    exportCust() { App.download('customers.csv', App.csv([['Customer', 'Email', 'Invoices', 'Open balance', 'Overdue', 'Paid last 12 months']].concat(customers().map(c => [c.name, c.email, c.invoices, c.open.toFixed(2), c.overdue.toFixed(2), c.paid12.toFixed(2)]))), 'text/csv'); },
  };
})();

App.register('invoices', { title: 'Invoices', crumb: 'Sales', sub: () => 'Bill customers, track what\'s owed and record payments',
  actions: () => `<button class="btn" onclick="Sales.receivePayment()">Receive payment</button><button class="btn primary" onclick="Sales.invoiceForm()">${I('plus')} Create invoice</button>`,
  render: Sales.invoicesPage, mount: () => { if (location.hash.includes('new=1')) { history.replaceState(null, '', '#/invoices'); Sales.invoiceForm(); } } });
App.register('customers', { title: 'Customers', crumb: 'Sales', sub: () => 'Everyone you sell to, with balances and history',
  actions: () => `<button class="btn" onclick="Sales.invoiceForm()">Create invoice</button><button class="btn primary" onclick="Sales.customerForm()">${I('plus')} New customer</button>`,
  render: Sales.customersPage });
