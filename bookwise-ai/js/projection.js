/* =========================================================================
   Bookwise — forecasting
   Baseline = trailing averages from the books, then growth, seasonality,
   planned hires and capital purchases are layered on per scenario.
   ========================================================================= */
const Projection = (() => {
  const SCEN = {
    conservative: { g: 0.4, e: 1.25, label: 'Conservative' },
    base:         { g: 1.0, e: 1.0,  label: 'Base case' },
    optimistic:   { g: 1.6, e: 0.9,  label: 'Optimistic' },
  };

  function baseline(state) {
    const complete = Ledger.monthsBack(13).slice(0, 12);         // last 12 complete months
    const m = Ledger.monthly(state, complete);
    const last3 = m.slice(-3);
    const avg = (arr, k) => arr.reduce((a, r) => a + r[k], 0) / Math.max(1, arr.length);
    const t12inc = m.reduce((a, r) => a + r.income, 0);
    const t12cogs = m.reduce((a, r) => a + r.cogs, 0);
    // seasonality index by calendar month
    const season = Array(12).fill(1);
    const mean = t12inc / 12;
    if (mean > 0 && m.filter(r => r.income > 0).length >= 12) {
      // cash receipts are lumpy, so damp the raw index toward 1 and clamp it
      m.forEach(r => { season[+r.month.slice(5) - 1] = Math.min(1.3, Math.max(0.7, 1 + 0.45 * (r.income / mean - 1))); });
    }
    // de-seasonalise the starting revenue so seasonality isn't applied twice
    const deseason = last3.reduce((a, r) => a + r.income / (season[+r.month.slice(5) - 1] || 1), 0) / Math.max(1, last3.length);
    if (t12inc <= 0) {
      // New account with no books yet — start from the figures entered during onboarding
      const tp = state.taxProfile;
      const r = (+tp.revenue || 0) / 12;
      return { rev: r, revRaw: r, cogsRatio: tp.revenue ? tp.cogs / tp.revenue : 0,
        opex: ((+tp.opex || 0) + (+tp.employeeWages || 0) * 1.0765) / 12, draws: 0,
        cash: Ledger.cashBalance(state), season, lastMonth: complete[11], hasHistory: false };
    }
    return {
      rev: deseason || avg(last3, 'income'), revRaw: avg(last3, 'income'),
      cogsRatio: t12inc ? t12cogs / t12inc : 0,
      opex: avg(last3, 'expense'), draws: avg(last3, 'draws'),
      cash: Ledger.cashBalance(state), season, lastMonth: complete[11], hasHistory: t12inc > 0,
    };
  }

  function run(state, opts = state.proj) {
    const b = baseline(state);
    const sc = SCEN[opts.scenario] || SCEN.base;
    const g = (opts.revGrowth / 100) * sc.g, ge = (opts.expGrowth / 100) * sc.e;
    const start = new Date(b.lastMonth + '-01T00:00:00');
    const rows = [];
    let cash = b.cash, breakEven = null, minCash = cash, minCashMonth = null;
    for (let i = 1; i <= opts.horizon; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const si = opts.seasonality ? b.season[d.getMonth()] : 1;
      const revenue = b.rev * Math.pow(1 + g, i) * si;
      const cogs = revenue * b.cogsRatio;
      let opex = b.opex * Math.pow(1 + ge, i) * (1 - (opts.costCut || 0) / 100);
      for (const h of opts.hires || []) if (i >= +h.month) opex += (+h.salary / 12) * 1.0765;
      const capex = (opts.capex || []).filter(c => +c.month === i).reduce((a, c) => a + +c.amount, 0);
      const net = revenue - cogs - opex;
      cash += net - capex - b.draws;
      if (breakEven === null && net > 0) breakEven = key;
      if (cash < minCash) { minCash = cash; minCashMonth = key; }
      rows.push({ month: key, revenue, cogs, opex, net, capex, cash });
    }
    const next12 = rows.slice(0, 12);
    const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
    return { b, rows, sc, breakEven, minCash, minCashMonth,
      next12: { revenue: sum(next12, 'revenue'), cogs: sum(next12, 'cogs'), opex: sum(next12, 'opex'), net: sum(next12, 'net') } };
  }

  /** Project next-12-month taxes using the optimiser's recommended structure */
  function taxOutlook(state, proj) {
    const tp = state.taxProfile;
    const wageShare = tp.revenue > 0 ? tp.employeeWages / Math.max(1, tp.opex + tp.employeeWages) : 0;
    const totalCost = proj.next12.opex;
    const inp = Optimizer.normalize({ ...tp,
      revenue: proj.next12.revenue, cogs: proj.next12.cogs,
      employeeWages: totalCost * wageShare / 1.0765, opex: totalCost * (1 - wageShare) });
    const a = Strategies.analyze(inp);
    return { analysis: a, quarterly: a.planTax / 4 };
  }

  return { run, baseline, taxOutlook, SCEN };
})();
