/* =========================================================================
   Bookwise — Tax Engine
   Models one owner's share of a business under three structures:
     • LLC / Sole proprietorship / Partnership  (Schedule C or K-1, SE tax)
     • S corporation  (W-2 salary + K-1 distributions, salary optimised)
     • C corporation  (21% corporate tax + qualified dividends, salary optimised)
   All figures are annual, federal 2026 + a flat state-rate approximation.
   ========================================================================= */
const TaxEngine = (() => {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const pos = x => Math.max(0, x);

  function bracketTax(ti, br) {
    let tax = 0, prev = 0;
    for (const [top, r] of br) {
      if (ti > prev) tax += (Math.min(ti, top) - prev) * r;
      prev = top;
    }
    return tax;
  }
  function marginalRate(ti, status) {
    for (const [top, r] of TAX.brackets[status]) if (ti <= top) return r;
    return .37;
  }
  /** Federal income tax with preferential (qualified dividend) income stacked on top */
  function incomeTax(ti, pref, status) {
    ti = pos(ti); pref = clamp(pref || 0, 0, ti);
    const ord = ti - pref;
    let tax = bracketTax(ord, TAX.brackets[status]);
    let prev = 0;
    for (const [top, r] of TAX.ltcg[status]) {
      const overlap = pos(Math.min(ti, top) - Math.max(ord, prev));
      tax += overlap * r;
      prev = top;
    }
    return tax;
  }
  /** §199A QBI deduction with OBBBA phase-in ranges and SSTB rules */
  function qbiDeduction({ qbi, w2, ubia, tiBeforeQbi, sstb, status }) {
    if (qbi <= 0 || tiBeforeQbi <= 0) return { ded: 0, note: 'No positive QBI' };
    const thr = TAX.qbi.threshold[status], range = TAX.qbi.range[status];
    const frac = clamp((tiBeforeQbi - thr) / range, 0, 1);
    let q = qbi, w = w2, u = ubia;
    if (sstb && frac > 0) { const ap = 1 - frac; q *= ap; w *= ap; u *= ap; }
    const tentative = TAX.qbi.rate * q;
    const wageLimit = Math.max(0.5 * w, 0.25 * w + 0.025 * u);
    let ded, note;
    if (frac === 0) { ded = tentative; note = 'Below threshold — full 20%'; }
    else if (tentative <= wageLimit) { ded = tentative; note = sstb ? 'SSTB phase-in applied' : 'W-2 wage limit not binding'; }
    else if (frac < 1) { ded = tentative - (tentative - wageLimit) * frac; note = 'In phase-in range — partially limited'; }
    else { ded = wageLimit; note = sstb ? 'SSTB above range — no deduction' : 'Limited to W-2 wage / UBIA cap'; }
    ded = Math.min(ded, TAX.qbi.rate * tiBeforeQbi);
    if (qbi >= TAX.qbi.minQbi && ded < TAX.qbi.minDeduction && !(sstb && frac >= 1)) ded = TAX.qbi.minDeduction;
    return { ded: pos(ded), note, frac };
  }
  const catchup = age => (age >= 60 && age <= 63) ? TAX.retirement.catchup6063 : (age >= 50 ? TAX.retirement.catchup50 : 0);

  function ficaSplit(wages) { // each side (employer or employee)
    return Math.min(wages, TAX.ssWageBase) * 0.062 + wages * 0.0145;
  }

  /** Business profit before any owner compensation (whole business) */
  function profitBeforeOwner(inp, adj = {}) {
    const empTaxes = inp.employeeWages * 0.0765 + inp.employees * TAX.futa;
    return inp.revenue - inp.cogs - inp.opex - inp.employeeWages - empTaxes - (adj.bizDeduction || 0);
  }

  /** Household tax on the "other" income alone — subtracted so results show tax caused by the business */
  function baselineTax(inp) {
    const st = inp.filingStatus;
    const ti = pos(inp.otherIncome - TAX.stdDeduction[st]);
    const fed = incomeTax(ti, 0, st);
    const addl = TAX.addlMedicareRate * pos(inp.otherIncome - TAX.addlMedicareThreshold[st]);
    return fed + addl + ti * inp.stateRate / 100;
  }

  function retirementLLC(netSE, age) {
    const R = TAX.retirement, cu = catchup(age);
    if (netSE <= 0) return 0;
    const regDef = Math.min(R.deferral, netSE);
    const cuDef = Math.min(cu, netSE - regDef);
    const employer = Math.min(0.20 * Math.min(netSE, R.compLimit), R.dcLimit - regDef);
    return Math.min(regDef + cuDef + pos(employer), netSE);
  }
  function retirementW2(salary, age) {
    const R = TAX.retirement, cu = catchup(age);
    const regDef = Math.min(R.deferral, salary);
    const cuDef = Math.min(cu, salary - regDef);
    const employer = pos(Math.min(R.sepRate * Math.min(salary, R.compLimit), R.dcLimit - regDef));
    return { deferral: regDef + cuDef, employer };
  }

  /* ---------------- LLC / Sole prop / Partnership ---------------- */
  function calcLLC(inp, adj = {}) {
    const st = inp.filingStatus, n = inp.owners;
    const p = profitBeforeOwner(inp, adj) / n;
    const seBase = pos(p) * TAX.seFactor;
    const seTax = seBase < 400 ? 0 : Math.min(seBase, TAX.ssWageBase) * TAX.ssRate + seBase * TAX.medicareRate;
    const halfSE = seTax / 2;
    const addlMed = TAX.addlMedicareRate * pos(seBase + inp.otherIncome - TAX.addlMedicareThreshold[st]);
    const retire = adj.retire ? retirementLLC(p - halfSE, inp.ownerAge) : 0;
    const db = Math.min(adj.db || 0, pos(p - halfSE - retire));
    const seHealth = Math.min(inp.healthPremiums, pos(p - halfSE - retire - db));
    const hsa = adj.hsa || 0;
    const agi = inp.otherIncome + p - halfSE - retire - db - seHealth - hsa;
    const tiBefore = pos(agi - TAX.stdDeduction[st]);
    const qbiAmt = p - halfSE - retire - db - seHealth;
    const q = qbiDeduction({ qbi: qbiAmt, w2: inp.employeeWages / n, ubia: inp.ubia / n, tiBeforeQbi: tiBefore, sstb: inp.sstb, status: st });
    const ti = pos(tiBefore - q.ded);
    const fed = incomeTax(ti, 0, st);
    const state = tiBefore * inp.stateRate / 100;
    const total = seTax + addlMed + fed + state + (adj.extraHouseholdTax || 0) / n;
    return finish(inp, {
      entity: 'llc', label: 'LLC / Sole Prop', salary: 0, profit: p,
      lines: [
        ['Self-employment tax (15.3% to wage base, 2.9% above)', seTax],
        ['Additional Medicare tax (0.9%)', addlMed],
        ['Federal income tax', fed],
        ['State income tax (approx.)', state],
      ],
      payroll: seTax + addlMed, fed, state, corp: 0, admin: 0,
      qbiDed: q.ded, qbiNote: q.note, agi, ti, retire: retire + db, hsa, total,
    });
  }

  /* ---------------- S corporation ---------------- */
  function calcS(inp, adj = {}, salary) {
    const st = inp.filingStatus, n = inp.owners;
    const p = profitBeforeOwner(inp, adj) / n;
    const S = pos(salary);
    const erFica = ficaSplit(S), eeFica = ficaSplit(S);
    const admin = (inp.payrollAdmin || 0) / n + TAX.futa;
    const rt = adj.retire ? retirementW2(S, inp.ownerAge) : { deferral: 0, employer: 0 };
    const db = adj.db || 0;
    const k1 = p - S - erFica - admin - rt.employer - db - inp.healthPremiums;
    const addlMed = TAX.addlMedicareRate * pos(S + inp.otherIncome - TAX.addlMedicareThreshold[st]);
    const box1 = S - rt.deferral + inp.healthPremiums;          // >2% shareholder health is W-2 wages
    const hsa = adj.hsa || 0;
    const agi = inp.otherIncome + box1 + k1 - inp.healthPremiums - hsa; // SE health deduction
    const tiBefore = pos(agi - TAX.stdDeduction[st]);
    const q = qbiDeduction({ qbi: k1, w2: S + inp.employeeWages / n, ubia: inp.ubia / n, tiBeforeQbi: tiBefore, sstb: inp.sstb, status: st });
    const ti = pos(tiBefore - q.ded);
    const fed = incomeTax(ti, 0, st);
    const state = tiBefore * inp.stateRate / 100;
    const total = erFica + eeFica + addlMed + fed + state + admin + (adj.extraHouseholdTax || 0) / n;
    return finish(inp, {
      entity: 'scorp', label: 'S Corporation', salary: S, profit: p, k1,
      lines: [
        ['Employer payroll tax on owner salary (7.65%)', erFica],
        ['Employee payroll tax on owner salary (7.65%)', eeFica],
        ['Additional Medicare tax (0.9%)', addlMed],
        ['Federal income tax', fed],
        ['State income tax (approx.)', state],
        ['Payroll service + FUTA (compliance cost)', admin],
      ],
      payroll: erFica + eeFica + addlMed, fed, state, corp: 0, admin,
      qbiDed: q.ded, qbiNote: q.note, agi, ti, retire: rt.deferral + rt.employer + db, hsa, total,
    });
  }

  /* ---------------- C corporation ---------------- */
  function calcC(inp, adj = {}, salary) {
    const st = inp.filingStatus, n = inp.owners;
    const p = profitBeforeOwner(inp, adj) / n;
    const S = pos(salary);
    const erFica = ficaSplit(S), eeFica = ficaSplit(S);
    const admin = (inp.payrollAdmin || 0) / n + TAX.futa + (inp.corpCompliance || 0) / n;
    const rt = adj.retire ? retirementW2(S, inp.ownerAge) : { deferral: 0, employer: 0 };
    const db = adj.db || 0;
    const corpTI = p - S - erFica - admin - rt.employer - db - inp.healthPremiums; // health is tax-free fringe
    const corpTax = TAX.corpRate * pos(corpTI);
    const corpState = pos(corpTI) * inp.stateRate / 100;
    const afterTax = corpTI - corpTax - corpState;
    const div = pos(afterTax) * (inp.distributionPct / 100);
    const hsa = adj.hsa || 0;
    const agi = inp.otherIncome + S - rt.deferral + div - hsa;
    const ti = pos(agi - TAX.stdDeduction[st]);
    const fed = incomeTax(ti, div, st);
    const niit = TAX.niitRate * Math.min(div, pos(agi - TAX.niitThreshold[st]));
    const addlMed = TAX.addlMedicareRate * pos(S + inp.otherIncome - TAX.addlMedicareThreshold[st]);
    const state = ti * inp.stateRate / 100;
    const total = corpTax + corpState + erFica + eeFica + addlMed + fed + niit + state + admin + (adj.extraHouseholdTax || 0) / n;
    return finish(inp, {
      entity: 'ccorp', label: 'C Corporation', salary: S, profit: p, dividends: div, retained: pos(afterTax) - div,
      lines: [
        ['Corporate income tax (21%)', corpTax],
        ['State corporate tax (approx.)', corpState],
        ['Payroll taxes on owner salary (15.3%)', erFica + eeFica],
        ['Additional Medicare tax (0.9%)', addlMed],
        ['Federal income tax (salary + dividends)', fed],
        ['Net investment income tax (3.8%)', niit],
        ['State personal income tax (approx.)', state],
        ['Payroll + corporate compliance cost', admin],
      ],
      payroll: erFica + eeFica + addlMed, fed: fed + niit, state: state + corpState, corp: corpTax, admin,
      qbiDed: 0, qbiNote: 'Not available to C corporations', agi, ti, retire: rt.deferral + rt.employer + db, hsa, total,
    });
  }

  function finish(inp, r) {
    const base = baselineTax(inp);
    r.bizTax = r.total - base;                        // per owner, caused by the business
    r.bizTaxAll = r.bizTax * inp.owners;
    r.effRate = r.profit > 0 ? r.bizTax / r.profit : 0;
    r.marginal = marginalRate(r.ti, inp.filingStatus);
    return r;
  }

  function salaryFloor(inp, p) {
    if (inp.minSalary > 0) return Math.min(inp.minSalary, pos(p));
    const ind = INDUSTRIES.find(i => i.id === inp.industry) || { salaryPct: .4 };
    return pos(p) * ind.salaryPct;
  }

  function optimize(fn, inp, adj) {
    const p = profitBeforeOwner(inp, adj) / inp.owners;
    const floor = Math.min(salaryFloor(inp, profitBeforeOwner(inp) / inp.owners), Math.max(0, p / 1.0765)); // floor based on real earnings, before planning deductions
    const max = pos(p / 1.0765);
    let best = fn(inp, adj, floor);
    if (max > floor) {
      const step = Math.max(250, (max - floor) / 160);
      for (let s = floor; s <= max; s += step) {
        const r = fn(inp, adj, s);
        if (r.total < best.total - 0.5) best = r;
      }
    }
    best.salaryFloor = floor;
    return best;
  }

  /** Run all three structures, pick the cheapest */
  function compare(inp, adj = {}) {
    const llc = calcLLC(inp, adj);
    const scorp = optimize(calcS, inp, adj);
    const ccorp = optimize(calcC, inp, adj);
    const all = [llc, scorp, ccorp];
    const best = all.reduce((a, b) => (b.total < a.total ? b : a));
    const current = { llc, scorp, ccorp }[inp.currentEntity === 'partnership' ? 'llc' : inp.currentEntity] || llc;
    return { llc, scorp, ccorp, all, best, current };
  }

  function run(entity, inp, adj = {}) {
    if (entity === 'llc') return calcLLC(inp, adj);
    if (entity === 'scorp') return optimize(calcS, inp, adj);
    return optimize(calcC, inp, adj);
  }

  return { compare, run, incomeTax, marginalRate, qbiDeduction, profitBeforeOwner, baselineTax, catchup, calcLLC, calcS, calcC };
})();
