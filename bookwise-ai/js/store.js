/* =========================================================================
   Bookwise — formatting helpers, chart of accounts, local data store
   Data lives in the browser's localStorage (no server needed for Netlify).
   ========================================================================= */
const Fmt = {
  money: (x, dec = 0) => (x < 0 ? '−$' : '$') + Math.abs(Math.round(x * 10 ** dec) / 10 ** dec).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }),
  short: x => { const a = Math.abs(x), s = x < 0 ? '−$' : '$'; return a >= 1e6 ? s + (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k' : s + Math.round(a); },
  pct: (x, d = 1) => (x * 100).toFixed(d) + '%',
  date: d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  month: ym => { const [y, m] = ym.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); },
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
};
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

/* type: income | cogs | expense | asset | equity.  line = IRS Schedule C line.  ded = deductible share */
const CATEGORIES = [
  { id: 'services',      name: 'Service Revenue',             type: 'income',  line: '1' },
  { id: 'sales',         name: 'Product Sales',               type: 'income',  line: '1' },
  { id: 'other_income',  name: 'Other Income',                type: 'income',  line: '6' },
  { id: 'cogs_materials',name: 'Materials (COGS)',            type: 'cogs',    line: '36–38', ded: 1 },
  { id: 'cogs_sub',      name: 'Subcontractors (COGS)',       type: 'cogs',    line: '37', ded: 1 },
  { id: 'advertising',   name: 'Advertising & Marketing',     type: 'expense', line: '8',   ded: 1 },
  { id: 'car',           name: 'Car & Truck',                 type: 'expense', line: '9',   ded: 1 },
  { id: 'contract',      name: 'Contract Labor',              type: 'expense', line: '11',  ded: 1 },
  { id: 'benefits',      name: 'Employee Benefits',           type: 'expense', line: '14',  ded: 1 },
  { id: 'insurance',     name: 'Insurance',                   type: 'expense', line: '15',  ded: 1 },
  { id: 'interest',      name: 'Loan Interest',               type: 'expense', line: '16b', ded: 1 },
  { id: 'legal',         name: 'Legal & Professional',        type: 'expense', line: '17',  ded: 1 },
  { id: 'office',        name: 'Office Supplies',             type: 'expense', line: '18',  ded: 1 },
  { id: 'rent',          name: 'Rent / Lease',                type: 'expense', line: '20b', ded: 1 },
  { id: 'repairs',       name: 'Repairs & Maintenance',       type: 'expense', line: '21',  ded: 1 },
  { id: 'taxes_lic',     name: 'Taxes & Licenses',            type: 'expense', line: '23',  ded: 1 },
  { id: 'payroll_tax',   name: 'Payroll Taxes',               type: 'expense', line: '23',  ded: 1 },
  { id: 'travel',        name: 'Travel',                      type: 'expense', line: '24a', ded: 1 },
  { id: 'meals',         name: 'Meals (50% deductible)',      type: 'expense', line: '24b', ded: .5 },
  { id: 'utilities',     name: 'Utilities & Phone',           type: 'expense', line: '25',  ded: 1 },
  { id: 'wages',         name: 'Wages (employees)',           type: 'expense', line: '26',  ded: 1 },
  { id: 'software',      name: 'Software & Subscriptions',    type: 'expense', line: '27a', ded: 1 },
  { id: 'bank',          name: 'Bank & Merchant Fees',        type: 'expense', line: '27a', ded: 1 },
  { id: 'other_exp',     name: 'Other Expense',               type: 'expense', line: '27a', ded: 1 },
  { id: 'equipment',     name: 'Equipment Purchase (capital)',type: 'asset',   line: '13 / 4562', ded: 1 },
  { id: 'owner_draw',    name: 'Owner Draw / Distribution',   type: 'equity',  line: '—',   ded: 0 },
  { id: 'owner_contrib', name: 'Owner Contribution',          type: 'equity_in', line: '—', ded: 0 },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const isInflow = cat => ['income', 'equity_in'].includes(CAT[cat]?.type);

const DEFAULT_TAX_PROFILE = {
  industry: 'agency', filingStatus: 'mfj', stateChoice: 'Ohio', stateRate: 2.75,
  owners: 1, ownerAge: 34, currentEntity: 'llc', yearsInBusiness: 4,
  revenue: 0, cogs: 0, opex: 0, employeeWages: 0, employees: 2, avgEmployeeWage: 66000,
  otherIncome: 65000, propertyTax: 6500, healthPremiums: 9600, hsaCoverage: 'family',
  minSalary: 0, payrollAdmin: 1800, corpCompliance: 1500, distributionPct: 50,
  plannedEquipment: 18000, ubia: 25000, vehicleCost: 0, vehicleBizUse: 0, businessMiles: 4000,
  homeOfficeSqft: 0, augustaDays: 10, augustaRate: 900, kids: 1, kidWage: 8000, considerDB: true,
  rdSpend: 0, rdPriorAvg: 0, wotcHires: 1, employerHealth: 9000, hasRetirementPlan: false,
  planStartupCost: 2000, childcareSpend: 0, exitGain: 0,
};
const DEFAULT_PROJ = { horizon: 24, revGrowth: 1.5, expGrowth: 0.8, scenario: 'base', seasonality: true, hires: [], capex: [] };

const Store = (() => {
  let KEY = 'bookwise.data.guest', user = null;
  let state;
  const BLANK_PROFILE = { ...DEFAULT_TAX_PROFILE, revenue: 0, cogs: 0, opex: 0, employeeWages: 0, employees: 0, avgEmployeeWage: 0,
    otherIncome: 0, propertyTax: 0, healthPremiums: 0, hsaCoverage: 'none', plannedEquipment: 0, ubia: 0, businessMiles: 0,
    augustaDays: 0, augustaRate: 0, kids: 0, kidWage: 0, wotcHires: 0, employerHealth: 0, yearsInBusiness: 1 };
  function blank() {
    return {
      company: { name: (user && user.company) || 'My Business', openingCash: 0, openingDate: today(), equipmentValue: 0, loanBalance: 0 },
      transactions: [], invoices: [], taxProfile: { ...BLANK_PROFILE }, proj: { ...DEFAULT_PROJ }, taxSynced: false,
      onboarded: false, autoSync: false,
    };
  }
  /** Each signed-in account gets its own data bucket */
  function load(u) {
    if (u) { user = u; KEY = 'bookwise.data.' + u.id; }
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
    if (!state) { state = (user && user.isDemo) ? sample() : blank(); save(); }
    state.taxProfile = { ...DEFAULT_TAX_PROFILE, ...state.taxProfile };
    state.customers = state.customers || [];
    state.favReports = state.favReports || ['pl', 'bs', 'ar'];
    state.proj = { ...DEFAULT_PROJ, ...state.proj };
    return state;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed', e); } }
  function reset(withSample) { const keepProfile = !withSample && state; state = withSample ? sample() : blank(); if (keepProfile && keepProfile.onboarded) { state.taxProfile = keepProfile.taxProfile; state.company = keepProfile.company; state.onboarded = true; } save(); }

  /* ---------- Deterministic sample company ---------- */
  function sample() {
    let seed = 42;
    const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const r = (a, b) => Math.round(a + rnd() * (b - a));
    const s = blank();
    s.onboarded = true; s.autoSync = true;
    s.taxProfile = { ...DEFAULT_TAX_PROFILE };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    s.company = { name: 'Bluebird Creative Co.', openingCash: 42000, openingDate: start.toISOString().slice(0, 10), equipmentValue: 14000, loanBalance: 20000 };
    const clients = ['Northwind Foods', 'Harbor Dental Group', 'Lakeview Realty', 'Copper Kettle Café', 'Summit Outdoor Gear', 'Brightpath Tutoring', 'Ironwood Fitness', 'Maple & Co. Law', 'Evergreen Clinics', 'Atlas Logistics'];
    const services = ['Brand identity package', 'Website redesign', 'Monthly social media retainer', 'Paid ads management', 'Product photography', 'SEO audit & content', 'Email campaign build'];
    const season = [0.82, 0.9, 1.08, 1.12, 1.1, 1.0, 0.92, 0.95, 1.05, 1.1, 1.0, 0.85]; // Jan..Dec
    const pad = n => String(n).padStart(2, '0');
    let invNo = 1001;
    const tx = (date, desc, category, amount, payee = '') => s.transactions.push({ id: uid(), date, desc, payee, category, amount: Math.round(amount * 100) / 100, account: 'checking' });

    for (let i = 0; i <= 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1, ym = `${y}-${pad(m)}`;
      const lastDay = new Date(y, m, 0).getDate();
      const isCurrent = i === 12;
      const maxDay = isCurrent ? Math.max(1, now.getDate()) : lastDay;
      const day = n => `${ym}-${pad(Math.min(n, maxDay))}`;
      const target = 37000 * Math.pow(1.015, i) * season[m - 1];
      // invoices
      let billed = 0, k = 0;
      while (billed < target * (isCurrent ? now.getDate() / lastDay : 1) && k < 8) {
        const amt = r(2500, 11500);
        const issueDay = r(1, Math.max(1, maxDay));
        const issue = day(issueDay);
        const dueD = new Date(y, m - 1, issueDay + 30);
        const due = dueD.toISOString().slice(0, 10);
        const ageDays = (now - new Date(issue)) / 864e5;
        const paid = ageDays > 45 || (ageDays > 20 && rnd() < 0.55);
        const client = clients[r(0, clients.length - 1)];
        const svc = services[r(0, services.length - 1)];
        const qty = svc.includes('retainer') ? 1 : r(1, 3);
        const rate = Math.round(amt / qty / 50) * 50;
        const inv = { id: uid(), number: 'INV-' + invNo++, client, email: client.toLowerCase().replace(/[^a-z]+/g, '') + '@example.com',
          issue, due, items: [{ desc: svc, qty, rate }], status: paid ? 'paid' : 'sent', notes: 'Thank you for your business!' };
        if (paid) {
          const pd = new Date(new Date(issue).getTime() + r(10, 35) * 864e5);
          inv.paidDate = (pd > now ? now : pd).toISOString().slice(0, 10);
          tx(inv.paidDate, `Payment ${inv.number}`, 'services', qty * rate, client);
        }
        s.invoices.push(inv);
        billed += qty * rate; k++;
      }
      // expenses
      tx(day(1), 'Office lease — Ohio City studio', 'rent', 3200, 'Market Square Properties');
      tx(day(3), 'Adobe CC, Figma, Google Workspace', 'software', r(820, 960), 'Various SaaS');
      tx(day(5), 'Business liability & E&O insurance', 'insurance', 455, 'Hiscox');
      tx(day(8), 'Electric, internet & phones', 'utilities', r(260, 320), 'FirstEnergy / Spectrum');
      if (maxDay >= 15) { tx(day(15), 'Payroll — 2 designers', 'wages', 5500, 'Gusto'); tx(day(15), 'Employer payroll taxes', 'payroll_tax', 421, 'Gusto'); }
      if (maxDay >= 28) { tx(day(28), 'Payroll — 2 designers', 'wages', 5500, 'Gusto'); tx(day(28), 'Employer payroll taxes', 'payroll_tax', 421, 'Gusto'); tx(day(28), 'Employee health insurance', 'benefits', 750, 'Medical Mutual'); }
      tx(day(r(9, 20)), 'Freelance illustrator / developer', 'cogs_sub', r(1800, 4800), 'Upwork');
      tx(day(r(5, 25)), 'Stock photos & print production', 'cogs_materials', r(300, 1400), 'Shutterstock / Vistaprint');
      tx(day(r(4, 22)), 'LinkedIn & Google ads', 'advertising', r(1200, 2800), 'Google Ads');
      tx(day(r(6, 26)), 'Client lunch', 'meals', r(120, 480), 'Various');
      tx(day(r(2, 27)), 'Office supplies', 'office', r(90, 380), 'Staples');
      tx(day(r(10, 27)), 'Stripe / bank fees', 'bank', Math.round(target * 0.012), 'Stripe');
      tx(day(r(11, 18)), 'Bookkeeping & CPA', 'legal', m === 3 ? 2400 : 350, 'Rivera CPA');
      tx(day(20), 'SBA loan interest', 'interest', 140, 'Huntington Bank');
      if (m === 4 || m === 9) tx(day(r(5, 20)), 'Conference travel', 'travel', r(1400, 2600), 'Delta / Marriott');
      if (i === 3) tx(day(12), 'New workstations (2× MacBook Pro)', 'equipment', 6400, 'Apple');
      if (m === 1) tx(day(20), 'State LLC renewal & city license', 'taxes_lic', 350, 'State of Ohio');
      tx(day(Math.min(30, maxDay)), 'Owner draw', 'owner_draw', 6000, 'Owner');
    }
    // a few freshly imported bank lines waiting in "For review"
    const td = now.toISOString().slice(0, 10), yd = new Date(now - 864e5).toISOString().slice(0, 10);
    [['AMZN MKTP US*2K4 — office chairs', 'office', 389.97, yd], ['STARBUCKS #12044 CLEVELAND', 'meals', 46.2, yd], ['SHELL OIL 5744 — fuel', 'car', 61.35, td], ['ZOOM.US 888-799-9666', 'software', 149.9, td], ['STRIPE PAYOUT — client card payments', 'services', 2150, td]]
      .forEach(([desc, category, amount, date]) => s.transactions.push({ id: uid(), date, desc, payee: '', category, amount, account: 'checking', review: true, dir: category === 'services' ? 'in' : 'out' }));
    s.customers = clients.map(n => ({ id: uid(), name: n, email: n.toLowerCase().replace(/[^a-z]+/g, '') + '@example.com', phone: '(216) 555-0' + (100 + clients.indexOf(n) * 7), address: '' }));
    s.transactions.sort((a, b) => a.date.localeCompare(b.date));
    return s;
  }

  return { load, save, reset, get state() { return state; }, get user() { return user; }, sample };
})();
