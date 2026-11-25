/* =========================================================================
   Bookwise — accounting calculations (cash basis)
   ========================================================================= */
const Ledger = (() => {
  const ym = d => d.slice(0, 7);
  const invTotal = inv => inv.items.reduce((a, it) => a + it.qty * it.rate, 0);

  function monthsBack(n, endYm) {
    const end = endYm ? new Date(endYm + '-01T00:00:00') : new Date();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }

  /** Per-month totals by type */
  function monthly(state, months) {
    const map = Object.fromEntries(months.map(m => [m, { month: m, income: 0, cogs: 0, expense: 0, capex: 0, draws: 0, contrib: 0 }]));
    for (const t of state.transactions) {
      if (t.review) continue;
      const row = map[ym(t.date)]; if (!row) continue;
      const type = CAT[t.category]?.type;
      if (type === 'income') row.income += t.amount;
      else if (type === 'cogs') row.cogs += t.amount;
      else if (type === 'expense') row.expense += t.amount;
      else if (type === 'asset') row.capex += t.amount;
      else if (type === 'equity') row.draws += t.amount;
      else if (type === 'equity_in') row.contrib += t.amount;
    }
    return months.map(m => { const r = map[m]; r.net = r.income - r.cogs - r.expense; r.cashFlow = r.income + r.contrib - r.cogs - r.expense - r.capex - r.draws; return r; });
  }

  /** Profit & loss between two ISO dates (inclusive) */
  function pnl(state, from, to) {
    const rows = {};
    for (const t of state.transactions) {
      if (t.review || t.date < from || t.date > to) continue;
      const c = CAT[t.category]; if (!c || !['income', 'cogs', 'expense'].includes(c.type)) continue;
      rows[t.category] = (rows[t.category] || 0) + t.amount;
    }
    const by = type => CATEGORIES.filter(c => c.type === type && rows[c.id]).map(c => ({ ...c, amount: rows[c.id] }));
    const income = by('income'), cogs = by('cogs'), expense = by('expense');
    const sum = a => a.reduce((x, y) => x + y.amount, 0);
    const totalIncome = sum(income), totalCogs = sum(cogs), totalExpense = sum(expense);
    const nonDeductible = expense.reduce((a, e) => a + e.amount * (1 - (e.ded ?? 1)), 0);
    return { income, cogs, expense, totalIncome, totalCogs, gross: totalIncome - totalCogs, totalExpense, net: totalIncome - totalCogs - totalExpense, nonDeductible };
  }

  function cashBalance(state, asOf = '9999-12-31') {
    let c = state.company.openingCash;
    for (const t of state.transactions) if (!t.review && t.date <= asOf) c += isInflow(t.category) ? t.amount : -t.amount;
    return c;
  }

  function arOutstanding(state) {
    return state.invoices.filter(i => i.status !== 'paid' && i.status !== 'draft').reduce((a, i) => a + invTotal(i), 0);
  }
  function arAging(state) {
    const b = { current: 0, d30: 0, d60: 0, d90: 0 }, now = new Date();
    for (const i of state.invoices) {
      if (i.status === 'paid' || i.status === 'draft') continue;
      const late = (now - new Date(i.due + 'T00:00:00')) / 864e5;
      const k = late <= 0 ? 'current' : late <= 30 ? 'd30' : late <= 60 ? 'd60' : 'd90';
      b[k] += invTotal(i);
    }
    return b;
  }

  function balanceSheet(state) {
    const cash = cashBalance(state);
    const ar = arOutstanding(state);
    const capex = state.transactions.filter(t => CAT[t.category]?.type === 'asset').reduce((a, t) => a + t.amount, 0);
    const equipment = state.company.equipmentValue + capex;
    const assets = cash + ar + equipment;
    const liabilities = state.company.loanBalance;
    return { cash, ar, equipment, assets, liabilities, equity: assets - liabilities };
  }

  /** Trailing-12-month figures shaped for the tax optimiser */
  function taxFigures(state) {
    const months = monthsBack(12, monthsBack(2)[0]); // last 12 *complete* months
    const from = months[0] + '-01';
    const [ly, lm] = months[11].split('-').map(Number);
    const to = `${months[11]}-${String(new Date(ly, lm, 0).getDate()).padStart(2, '0')}`;
    const p = pnl(state, from, to);
    const amt = id => p.expense.filter(e => e.id === id).reduce((a, e) => a + e.amount, 0);
    const wages = amt('wages'), payrollTax = amt('payroll_tax');
    const opex = p.totalExpense - wages - payrollTax - p.nonDeductible;
    return { revenue: Math.round(p.totalIncome), cogs: Math.round(p.totalCogs), opex: Math.round(opex), employeeWages: Math.round(wages), from, to };
  }

  function invoiceStatus(inv) {
    if (inv.status === 'paid') return 'paid';
    if (inv.status === 'draft') return 'draft';
    return new Date(inv.due + 'T23:59:59') < new Date() ? 'overdue' : 'sent';
  }

  /** Named date ranges [from, to, label] */
  function range(key, from, to) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), q = Math.floor(m / 3);
    const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const t = iso(d);
    const R = {
      month: [iso(new Date(y, m, 1)), t, 'This month'],
      lastmonth: [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0)), 'Last month'],
      quarter: [iso(new Date(y, q * 3, 1)), t, 'This quarter'],
      ytd: [`${y}-01-01`, t, 'Year to date'],
      t12: [iso(new Date(y, m - 11, 1)), t, 'Last 12 months'],
      lastyear: [`${y - 1}-01-01`, `${y - 1}-12-31`, `Last year (${y - 1})`],
      last30: [iso(new Date(Date.now() - 29 * 864e5)), t, 'Last 30 days'],
      all: ['0000-01-01', '9999-12-31', 'All dates'],
    };
    if (key === 'custom') return [from, to, 'Custom'];
    return R[key] || R.ytd;
  }
  const RANGE_OPTS = [['month', 'This month'], ['lastmonth', 'Last month'], ['quarter', 'This quarter'], ['ytd', 'Year to date'], ['t12', 'Last 12 months'], ['lastyear', 'Last year'], ['last30', 'Last 30 days'], ['all', 'All dates']];
  const inRange = (t, [f, to]) => t.date >= f && t.date <= to;

  return { range, RANGE_OPTS, inRange, monthly, pnl, cashBalance, arOutstanding, arAging, balanceSheet, taxFigures, monthsBack, invTotal, invoiceStatus };
})();
