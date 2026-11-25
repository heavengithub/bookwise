/* =========================================================================
   Bookwise — Projections page
   ========================================================================= */
const ProjUI = (() => {
  const F = Fmt.money;
  let cache;
  function set(k, v) { Store.state.proj[k] = v; Store.save(); App.render(); }
  function addHire() { Store.state.proj.hires.push({ role: 'New hire', month: 3, salary: 60000 }); Store.save(); App.render(); }
  function addCapex() { Store.state.proj.capex.push({ desc: 'Equipment', month: 6, amount: 10000 }); Store.save(); App.render(); }
  function upd(list, i, k, v) { Store.state.proj[list][i][k] = k === 'role' || k === 'desc' ? v : +v; Store.save(); App.render(); }
  function del(list, i) { Store.state.proj[list].splice(i, 1); Store.save(); App.render(); }

  function render() {
    const s = Store.state, o = s.proj;
    const all = Object.fromEntries(Object.keys(Projection.SCEN).map(k => [k, Projection.run(s, { ...o, scenario: k })]));
    const p = all[o.scenario]; cache = { all, p };
    const tax = Projection.taxOutlook(s, p);
    cache.tax = tax;
    const last = p.rows[p.rows.length - 1];
    const ny = new Date().getFullYear() + 1;
    const qDates = [`Apr 15, ${ny}`, `Jun 15, ${ny}`, `Sep 15, ${ny}`, `Jan 15, ${ny + 1}`];
    const years = []; for (let i = 0; i < p.rows.length; i += 12) years.push(p.rows.slice(i, i + 12));
    const sum = (a, k) => a.reduce((x, r) => x + r[k], 0);

    return `<div class="whatif">${I('spark')}<form onsubmit="event.preventDefault();ProjUI.whatIf(this.q.value)" style="display:flex;flex:1;gap:8px"><input name="q" placeholder="Describe a change, e.g. hire a designer at $65k in March and buy equipment for $12k in June" autocomplete="off"/><button class="btn primary">Apply to forecast</button></form></div>
      ${(o.hires.length || o.capex.length || o.costCut) ? `<div class="whatif-chips">${o.hires.map((h, i) => `<span>Hire ${Fmt.esc(h.role)}, ${Fmt.money(h.salary)} from month ${h.month}<button onclick="ProjUI.del('hires',${i})" aria-label="Remove">×</button></span>`).join('')}${o.capex.map((c, i) => `<span>Buy ${Fmt.esc(c.desc)}, ${Fmt.money(c.amount)} in month ${c.month}<button onclick="ProjUI.del('capex',${i})" aria-label="Remove">×</button></span>`).join('')}${o.costCut ? `<span>Costs cut ${o.costCut}%<button onclick="ProjUI.set('costCut',0)" aria-label="Remove">×</button></span>` : ''}</div>` : ''}
      <div class="card"><div class="row">
        <div class="seg">${Object.entries(Projection.SCEN).map(([k, v]) => `<button class="${o.scenario === k ? 'on' : ''}" onclick="ProjUI.set('scenario','${k}')">${v.label}</button>`).join('')}</div>
        <label class="f" style="width:150px">Revenue growth %/mo<input type="number" step="0.1" value="${o.revGrowth}" onchange="ProjUI.set('revGrowth',+this.value)"/></label>
        <label class="f" style="width:150px">Cost growth %/mo<input type="number" step="0.1" value="${o.expGrowth}" onchange="ProjUI.set('expGrowth',+this.value)"/></label>
        <label class="f" style="width:120px">Horizon<select onchange="ProjUI.set('horizon',+this.value)">${[12, 24, 36].map(h => `<option ${o.horizon === h ? 'selected' : ''} value="${h}">${h} months</option>`).join('')}</select></label>
        <label class="check" style="margin-top:22px"><input type="checkbox" ${o.seasonality ? 'checked' : ''} onchange="ProjUI.set('seasonality',this.checked)"/> Apply seasonality from history</label>
      </div>
      <div class="muted small" style="margin-top:10px">${p.b.hasHistory ? 'Baseline from your books' : 'No transaction history yet — baseline from your business profile'}: ${F(p.b.revRaw)}/mo revenue, ${Fmt.pct(p.b.cogsRatio)} COGS, ${F(p.b.opex)}/mo operating costs, ${F(p.b.draws)}/mo owner draws, starting cash ${F(p.b.cash)}. Growth rates are ${Fmt.pct(p.sc.g, 0)} of input on revenue and ${Fmt.pct(p.sc.e, 0)} on costs in this scenario.</div></div>

      <div class="grid g4" style="margin-top:16px">
        <div class="card kpi"><div class="label">Next 12 mo revenue</div><div class="value">${F(p.next12.revenue)}</div><div class="delta">${p.b.revRaw ? Fmt.pct(p.next12.revenue / (p.b.revRaw * 12) - 1) + ' vs. current run-rate' : ''}</div></div>
        <div class="card kpi"><div class="label">Next 12 mo profit</div><div class="value ${p.next12.net < 0 ? 'down' : ''}">${F(p.next12.net)}</div><div class="delta">${p.next12.revenue ? Fmt.pct(p.next12.net / p.next12.revenue) + ' margin' : ''}</div></div>
        <div class="card kpi"><div class="label">Cash in ${o.horizon} months</div><div class="value ${last.cash < 0 ? 'down' : ''}">${F(last.cash)}</div><div class="delta">${p.minCash < 0 ? `<span class="down">Goes negative ${Fmt.month(p.minCashMonth)}</span>` : `Low point ${F(p.minCash)}`}</div></div>
        <div class="card kpi"><div class="label">Set aside for tax / quarter</div><div class="value">${F(tax.quarterly)}</div><div class="delta">as ${Strategies.ENTITY_NAMES[tax.analysis.bestE]} with full plan</div></div>
      </div>

      <div class="card" style="margin-top:16px"><div class="card-h"><h2>Forecast</h2><span class="muted small">${p.sc.label}</span></div><div class="chart-box"><canvas id="c-proj"></canvas></div></div>

      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-h"><h2>Cash runway — all scenarios</h2></div><div class="chart-box sm"><canvas id="c-cash"></canvas></div></div>
        <div class="card"><div class="card-h"><h2>Projected tax & estimated payments</h2></div>
          <table><tbody>
            <tr><td>Projected profit (next 12 months)</td><td class="r">${F(tax.analysis.profit)}</td></tr>
            <tr><td>Total tax with plan (household, fed + state + payroll)</td><td class="r">${F(tax.analysis.planTax)}</td></tr>
            <tr><td>Savings vs. no planning</td><td class="r up">${F(tax.analysis.totalSavings)}</td></tr>
            ${qDates.map((d, i) => `<tr class="indent"><td>Q${i + 1} estimate — due ${d}</td><td class="r">${F(tax.quarterly)}</td></tr>`).join('')}
          </tbody></table>
          <div class="muted small" style="margin-top:8px">Rough set-aside. S-corp payroll withholding counts toward this. To avoid penalties, pay at least 100% of last year's tax (110% if AGI > $150k) — the safe harbor.</div></div>
      </div>

      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-h"><h2>Planned hires</h2><button class="btn sm" onclick="ProjUI.addHire()">${ICONS.plus} Add</button></div>
          ${o.hires.length ? `<table><thead><tr><th>Role</th><th>Start month #</th><th>Annual salary</th><th></th></tr></thead><tbody>${o.hires.map((h, i) => `<tr>
            <td><input value="${Fmt.esc(h.role)}" onchange="ProjUI.upd('hires',${i},'role',this.value)"/></td><td><input type="number" min="1" value="${h.month}" onchange="ProjUI.upd('hires',${i},'month',this.value)"/></td>
            <td><input type="number" step="1000" value="${h.salary}" onchange="ProjUI.upd('hires',${i},'salary',this.value)"/></td><td><button class="btn sm ghost" onclick="ProjUI.del('hires',${i})">✕</button></td></tr>`).join('')}</tbody></table>
            <div class="muted small">Adds salary + 7.65% employer payroll tax from the start month.</div>` : '<div class="muted small">No hires planned. Add one to see the effect on profit, cash and taxes (and the WOTC / §45E credits).</div>'}</div>
        <div class="card"><div class="card-h"><h2>Planned purchases</h2><button class="btn sm" onclick="ProjUI.addCapex()">${ICONS.plus} Add</button></div>
          ${o.capex.length ? `<table><thead><tr><th>Item</th><th>Month #</th><th>Cost</th><th></th></tr></thead><tbody>${o.capex.map((c, i) => `<tr>
            <td><input value="${Fmt.esc(c.desc)}" onchange="ProjUI.upd('capex',${i},'desc',this.value)"/></td><td><input type="number" min="1" value="${c.month}" onchange="ProjUI.upd('capex',${i},'month',this.value)"/></td>
            <td><input type="number" step="500" value="${c.amount}" onchange="ProjUI.upd('capex',${i},'amount',this.value)"/></td><td><button class="btn sm ghost" onclick="ProjUI.del('capex',${i})">✕</button></td></tr>`).join('')}</tbody></table>
            <div class="muted small">Hits cash in that month. Remember to add it to "Planned equipment" in the Tax Optimizer for §179.</div>` : '<div class="muted small">No capital purchases planned.</div>'}</div>
      </div>

      <div class="card" style="margin-top:16px"><div class="card-h"><h2>Annual summary</h2></div><div class="table-wrap"><table>
        <thead><tr><th>Period</th><th class="r">Revenue</th><th class="r">COGS</th><th class="r">Operating costs</th><th class="r">Net profit</th><th class="r">Margin</th><th class="r">Ending cash</th></tr></thead><tbody>
        ${years.map((y, i) => `<tr><td>Year ${i + 1} (${Fmt.month(y[0].month)} – ${Fmt.month(y[y.length - 1].month)})</td><td class="r">${F(sum(y, 'revenue'))}</td><td class="r">${F(sum(y, 'cogs'))}</td><td class="r">${F(sum(y, 'opex'))}</td>
          <td class="r" style="font-weight:650">${F(sum(y, 'net'))}</td><td class="r">${Fmt.pct(sum(y, 'net') / Math.max(1, sum(y, 'revenue')))}</td><td class="r">${F(y[y.length - 1].cash)}</td></tr>`).join('')}
      </tbody></table></div></div>

      <div class="card"><div class="card-h"><h2>Monthly detail</h2><button class="btn sm" onclick="ProjUI.csv()">${ICONS.dl} CSV</button></div><div class="table-wrap"><table>
        <thead><tr><th>Month</th><th class="r">Revenue</th><th class="r">COGS</th><th class="r">Operating</th><th class="r">Net</th><th class="r">Capex</th><th class="r">Cash</th></tr></thead><tbody>
        ${p.rows.map(r => `<tr><td>${Fmt.month(r.month)}</td><td class="r">${F(r.revenue)}</td><td class="r">${F(r.cogs)}</td><td class="r">${F(r.opex)}</td><td class="r ${r.net < 0 ? 'down' : ''}">${F(r.net)}</td><td class="r">${r.capex ? F(r.capex) : ''}</td><td class="r ${r.cash < 0 ? 'down' : ''}">${F(r.cash)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  function mount() {
    const { all, p } = cache;
    const s = Store.state;
    const hist = Ledger.monthly(s, Ledger.monthsBack(13).slice(0, 12));
    const labels = [...hist.map(h => h.month), ...p.rows.map(r => r.month)].map(Fmt.month);
    const pad = Array(hist.length).fill(null);
    App.chart('c-proj', { type: 'line', data: { labels, datasets: [
      { label: 'Revenue (actual)', data: [...hist.map(h => h.income), ...p.rows.map(() => null)], borderColor: App.COLORS.brand, backgroundColor: App.COLORS.brand, pointRadius: 2, tension: .3 },
      { label: 'Revenue (forecast)', data: [...pad.slice(1), hist[hist.length - 1].income, ...p.rows.map(r => r.revenue)], borderColor: App.COLORS.brand, borderDash: [6, 4], pointRadius: 0, tension: .3 },
      { label: 'Total costs', data: [...hist.map(h => h.cogs + h.expense), ...p.rows.map(r => r.cogs + r.opex)], borderColor: App.COLORS.gray, pointRadius: 0, tension: .3 },
      { label: 'Net profit', data: [...hist.map(h => h.net), ...p.rows.map(r => r.net)], borderColor: App.COLORS.accent, backgroundColor: 'rgba(47,91,211,.08)', fill: true, pointRadius: 0, tension: .3 }] },
      options: { plugins: { legend: { position: 'bottom' } } } });
    const col = { conservative: App.COLORS.warn, base: App.COLORS.brand, optimistic: App.COLORS.accent };
    App.chart('c-cash', { type: 'line', data: { labels: p.rows.map(r => Fmt.month(r.month)), datasets: Object.entries(all).map(([k, v]) => ({
      label: Projection.SCEN[k].label, data: v.rows.map(r => r.cash), borderColor: col[k], borderWidth: k === s.proj.scenario ? 3 : 1.5, pointRadius: 0, tension: .3 })) },
      options: { plugins: { legend: { position: 'bottom' } } } });
  }

  function csv() {
    const rows = [['month', 'revenue', 'cogs', 'opex', 'net', 'capex', 'cash']].concat(cache.p.rows.map(r => [r.month, r.revenue, r.cogs, r.opex, r.net, r.capex, r.cash].map(x => typeof x === 'number' ? x.toFixed(2) : x)));
    App.download('projection.csv', rows.map(r => r.join(',')).join('\n'), 'text/csv');
  }

  function whatIf(text) {
    const o = Store.state.proj, b = Projection.baseline(Store.state);
    const ch = AI.parseWhatIf(text || '', b.lastMonth);
    if (!ch.length) { App.toast('Try "hire a designer at $65k in March" or "buy a truck for $40k in June"'); return; }
    ch.forEach(c => { if (c.type === 'hire') o.hires.push({ role: c.role, month: c.month, salary: c.salary }); if (c.type === 'capex') o.capex.push({ desc: c.desc, month: c.month, amount: c.amount }); if (c.type === 'growth') o.revGrowth = c.value; if (c.type === 'cut') o.costCut = c.value; });
    Store.save(); App.render(); App.toast(`Forecast updated with ${ch.length} change${ch.length > 1 ? 's' : ''}`);
  }
  return { render, mount, set, addHire, addCapex, upd, del, csv, whatIf };
})();

App.register('projections', { title: 'Cash flow & forecast', crumb: 'Insights', sub: () => 'Forecast revenue, profit, cash and quarterly taxes', render: ProjUI.render, mount: ProjUI.mount });
