/* =========================================================================
   Bookwise — Strategy Optimizer
   1. Builds the full set of applicable strategies for each entity type.
   2. Picks the entity whose fully-optimised plan has the lowest tax.
   3. Scores every strategy individually against that entity's baseline
      by re-running the engine (so interactions like QBI, SE tax and
      bracket changes are captured, not approximated with a flat rate).
   ========================================================================= */
const Strategies = (() => {
  const pos = x => Math.max(0, x);
  const ENTITY_NAMES = { llc: 'LLC / Sole Prop', scorp: 'S Corporation', ccorp: 'C Corporation' };

  function dbIllustration(age, profit) {
    const byAge = age < 40 ? 60000 : age < 50 ? 110000 : age < 60 ? 180000 : 250000;
    return Math.round(Math.min(byAge, profit * 0.4));
  }
  function kidTax(wage) { return 0.10 * pos(wage - TAX.stdDeduction.single); }

  /** The deduction-type strategy adjustments that apply to a given entity */
  function planFor(entity, inp) {
    const items = {};
    items.retire = { retire: true };
    const pPer = TaxEngine.profitBeforeOwner(inp) / inp.owners;
    if (inp.considerDB && pPer > 150000) items.db = { db: dbIllustration(inp.ownerAge, pPer) };
    if (inp.hsaCoverage !== 'none') items.hsa = { hsa: TAX.hsa[inp.hsaCoverage] + (inp.ownerAge >= 55 ? TAX.hsa.catchup55 : 0) };
    if (inp.plannedEquipment > 0) items.equipment = { bizDeduction: inp.plannedEquipment };
    if (inp.vehicleCost > 0 && inp.vehicleBizUse > 50) items.vehicle = { bizDeduction: inp.vehicleCost * inp.vehicleBizUse / 100 };
    if (inp.businessMiles > 0 && !(inp.vehicleCost > 0 && inp.vehicleBizUse > 50)) items.mileage = { bizDeduction: inp.businessMiles * TAX.mileage.blended };
    if (inp.homeOfficeSqft > 0) items.homeOffice = { bizDeduction: Math.min(inp.homeOfficeSqft, TAX.homeOffice.maxSqft) * TAX.homeOffice.rate * inp.owners };
    if (entity !== 'llc' && inp.augustaDays > 0 && inp.augustaRate > 0)
      items.augusta = { bizDeduction: Math.min(14, inp.augustaDays) * inp.augustaRate * inp.owners };
    if (inp.kids > 0 && inp.kidWage > 0) {
      const w = inp.kidWage * inp.kids;
      const kt = kidTax(inp.kidWage) * inp.kids;
      items.kids = entity === 'llc' && inp.owners <= 2
        ? { bizDeduction: w, extraHouseholdTax: kt * inp.owners }
        : { bizDeduction: w * 1.0765, extraHouseholdTax: (w * 0.0765 + kt) * inp.owners };
    }
    return items;
  }
  function merge(list) {
    const out = { bizDeduction: 0, extraHouseholdTax: 0 };
    for (const a of list) {
      for (const k in a) {
        if (k === 'bizDeduction' || k === 'extraHouseholdTax') out[k] += a[k];
        else out[k] = a[k];
      }
    }
    return out;
  }

  function ptetSavings(inp, r) {
    if (!(inp.stateRate > 0) || r.entity === 'ccorp') return 0;
    const stateBiz = pos(r.profit) * inp.stateRate / 100;
    const salt = r.state + inp.propertyTax;
    const cap = r.agi > TAX.salt.phaseStart ? Math.max(TAX.salt.floor, TAX.salt.cap - 0.3 * (r.agi - TAX.salt.phaseStart)) : TAX.salt.cap;
    const usable = Math.min(salt, cap);
    const lost = usable <= TAX.stdDeduction[inp.filingStatus] ? stateBiz : Math.min(stateBiz, pos(salt - cap));
    return lost * r.marginal * inp.owners;
  }

  function credits(inp) {
    const C = TAX.credits, out = {};
    if (inp.rdSpend > 0) {
      const asc = inp.rdPriorAvg > 0 ? C.rdAscRate * pos(inp.rdSpend - 0.5 * inp.rdPriorAvg) : C.rdAscStartupRate * inp.rdSpend;
      out.rd = Math.round(asc);
    }
    if (inp.wotcHires > 0) out.wotc = inp.wotcHires * C.wotcMax;
    if (inp.employees >= 1 && inp.employees < C.sec45rFteLimit && inp.employerHealth > 0 && inp.avgEmployeeWage < C.sec45rWageLimit) {
      const fteF = Math.min(1, Math.max(0, 1 - (inp.employees - 10) / 15));
      const half = C.sec45rWageLimit / 2;
      const wageF = Math.min(1, Math.max(0, 1 - (inp.avgEmployeeWage - half) / half));
      out.health45r = Math.round(C.sec45rMaxRate * inp.employerHealth * fteF * wageF);
    }
    if (!inp.hasRetirementPlan && inp.employees >= 1) {
      const startup = Math.min(inp.planStartupCost || 2000, Math.max(500, Math.min(250 * inp.employees, C.startupCreditMax)));
      const contrib = Math.min(C.employerContribPerEmployee, 0.03 * inp.avgEmployeeWage) * Math.min(inp.employees, 50);
      out.startup45e = Math.round(startup + C.autoEnrollCredit + contrib);
    }
    if (inp.childcareSpend > 0) out.childcare45f = Math.round(Math.min(C.childcareMaxSmall, C.childcareRateSmall * inp.childcareSpend));
    return out;
  }

  function analyze(inp) {
    const n = inp.owners;
    const cmp = TaxEngine.compare(inp);

    // Fully-optimised plan for each entity
    const optimized = {};
    for (const e of ['llc', 'scorp', 'ccorp']) {
      const items = planFor(e, inp);
      const adj = merge(Object.values(items));
      optimized[e] = { items, adj, result: TaxEngine.run(e, inp, adj) };
    }
    const bestE = Object.keys(optimized).reduce((a, b) => optimized[b].result.total < optimized[a].result.total ? b : a);
    const opt = optimized[bestE];
    const base = cmp[bestE];
    const delta = adj => (base.total - TaxEngine.run(bestE, inp, adj).total) * n;
    const cr = credits(inp);
    const ptet = ptetSavings(inp, opt.result);
    const pPer = TaxEngine.profitBeforeOwner(inp) / n;
    const fmt = Fmt.money;
    const S = [];

    /* ---------- 1. Entity structure ---------- */
    const curName = ENTITY_NAMES[inp.currentEntity === 'partnership' ? 'llc' : inp.currentEntity];
    const curKey = inp.currentEntity === 'partnership' ? 'llc' : inp.currentEntity;
    const entitySav = (optimized[curKey].result.total - opt.result.total) * n;
    S.push({
      id: 'entity', cat: 'Structure', title: bestE === (inp.currentEntity === 'partnership' ? 'llc' : inp.currentEntity)
        ? `Stay as ${ENTITY_NAMES[bestE]}` : `Switch from ${curName} to ${ENTITY_NAMES[bestE]}`,
      code: bestE === 'scorp' ? 'IRC §1361–1362 (Form 2553)' : bestE === 'ccorp' ? 'IRC §11 (Form 1120 / 8832)' : 'Schedule C / Form 1065',
      type: 'permanent', savings: pos(entitySav), applies: true, risk: 'Low',
      summary: entitySav > 1
        ? `Your profit of ${fmt(pPer * n)} is taxed ${fmt(entitySav)} less per year as an ${ENTITY_NAMES[bestE]} after the full plan is applied.`
        : `Given your numbers, ${ENTITY_NAMES[bestE]} already gives the lowest combined tax.`,
      details: entityDetails(bestE, cmp, inp),
      steps: bestE === 'scorp' ? [
        'Form an LLC or corporation in your state (if you are a sole proprietor).',
        'File IRS Form 2553 by March 15 for the election to apply to this tax year (late-election relief exists under Rev. Proc. 2013-30).',
        `Set up payroll and pay yourself a reasonable salary (engine-optimised: ${fmt(base.salary)}).`,
        'File Form 1120-S each year by March 15 and issue K-1s to shareholders.',
      ] : bestE === 'ccorp' ? [
        'Incorporate (or file Form 8832 to have an LLC taxed as a corporation).',
        'Run payroll for owner-employees; decide a dividend vs. retained-earnings policy.',
        'File Form 1120 by April 15; watch the accumulated earnings tax above $250,000 retained without business need.',
      ] : ['Keep clean books and file Schedule C (single owner) or Form 1065 (partnership).', 'Re-run this analysis each year — S-corp usually wins once profit is consistently high enough.'],
    });

    /* ---------- 2. Reasonable salary ---------- */
    if (bestE !== 'llc') {
      S.push({
        id: 'salary', cat: 'Structure', title: 'Optimise owner salary vs. distributions', code: 'Reasonable compensation — Rev. Rul. 74-44, Watson v. U.S.',
        type: 'info', savings: 0, applies: true, risk: 'Medium', countInTotal: false,
        summary: `Engine-optimised salary: ${fmt(opt.result.salary)} per owner (reasonable-comp floor ${fmt(base.salaryFloor)}). Remaining profit flows out as ${bestE === 'scorp' ? 'distributions free of payroll tax' : 'dividends or retained earnings'}.`,
        details: `<p>Salary is subject to 15.3% payroll tax (to the ${fmt(TAX.ssWageBase)} Social Security wage base, then 2.9%). S-corp distributions are not. The IRS requires salary to be <b>reasonable</b> for the work performed — use industry wage data (e.g., BLS, RCReports) and document it.</p>
          <p>The engine searched salaries from your floor up to 100% of profit and picked the level with the lowest <i>total</i> tax — that includes the effect on the QBI deduction (W-2 wages raise the wage limit above the threshold) and on retirement contributions (25% of salary).</p>`,
        steps: ['Document a reasonable-compensation study and keep it with your corporate records.', 'Pay salary through payroll on a regular schedule, not as a single year-end lump.', 'Take distributions in proportion to ownership (S corps must keep one class of stock).'],
      });
    }

    /* ---------- 3. Retirement ---------- */
    const retSav = delta({ retire: true });
    const retR = TaxEngine.run(bestE, inp, { retire: true });
    S.push({
      id: 'retire', cat: 'Retirement', title: 'Max out a Solo 401(k) / SEP-IRA', code: 'IRC §401(k), §408(k), §415(c)',
      type: 'permanent', savings: pos(retSav), applies: retR.retire > 0, risk: 'Low',
      summary: `Contribute about ${fmt(retR.retire)} per owner (${TAX.year} limits: ${fmt(TAX.retirement.deferral)} employee deferral + employer contribution, ${fmt(TAX.retirement.dcLimit)} total${TaxEngine.catchup(inp.ownerAge) ? ` + ${fmt(TaxEngine.catchup(inp.ownerAge))} catch-up` : ''}).`,
      details: `<p>A Solo 401(k) (no employees besides a spouse) usually beats a SEP because it adds the ${fmt(TAX.retirement.deferral)} employee deferral on top of the 25%-of-salary (or ~20% of net SE income) employer contribution. With employees, a safe-harbor 401(k) keeps owner contributions high while passing nondiscrimination testing.</p>
        <p>The engine re-ran your full return with contributions — so the savings include lower income tax <i>and</i> the knock-on effect on QBI and state tax.</p>`,
      steps: ['Open the plan by December 31 (Solo 401(k)) — a SEP can be opened up to the filing deadline.', 'Make employee deferrals through payroll (S/C corp) or by year-end election (sole prop).', 'Fund the employer portion by the tax-return due date including extensions.'],
    });

    /* ---------- 4. Defined benefit / cash balance ---------- */
    if (opt.items.db) {
      const dbSav = delta({ retire: true, db: opt.items.db.db }) - retSav;
      S.push({
        id: 'db', cat: 'Retirement', title: 'Add a cash-balance / defined-benefit plan', code: 'IRC §412, §415(b)',
        type: 'permanent', savings: pos(dbSav), applies: true, risk: 'Medium',
        summary: `Illustrative extra contribution of ${fmt(opt.items.db.db)} per owner at age ${inp.ownerAge} (actuary sets the real number; ${TAX.year} benefit limit ${fmt(290000)}/yr).`,
        details: '<p>Cash-balance plans let older, high-profit owners deduct far more than the 401(k) limit. Contributions are a required annual commitment for several years, need an actuary (≈$2–4k/yr admin), and must cover eligible employees.</p>',
        steps: ['Get an actuarial illustration before year-end.', 'Adopt the plan document by the tax-filing deadline for the year.', 'Budget for required minimum funding each year.'],
      });
    }

    /* ---------- 5. HSA ---------- */
    if (opt.items.hsa) {
      S.push({
        id: 'hsa', cat: 'Health', title: 'Fund a Health Savings Account', code: 'IRC §223',
        type: 'permanent', savings: pos(delta(opt.items.hsa)), applies: true, risk: 'Low',
        summary: `Contribute ${fmt(opt.items.hsa.hsa)} (${TAX.year} ${inp.hsaCoverage}-coverage limit). Triple tax advantage: deductible, grows tax-free, tax-free for medical costs.`,
        details: '<p>Requires an HSA-eligible high-deductible health plan. For S-corp owners, contributions run through payroll as W-2 wages but are deductible above the line. Note: owner-paid health premiums you entered are already deducted (self-employed health insurance deduction, §162(l)).</p>',
        steps: ['Confirm your health plan is HSA-eligible.', 'Contribute by April 15 of next year for this tax year.'],
      });
    }

    /* ---------- 6. Equipment: §179 + bonus ---------- */
    if (opt.items.equipment) {
      S.push({
        id: 'equipment', cat: 'Depreciation', title: 'Expense planned equipment with §179 / 100% bonus depreciation', code: 'IRC §179, §168(k)',
        type: 'timing', savings: pos(delta(opt.items.equipment)), applies: true, risk: 'Low',
        summary: `Deduct the full ${fmt(inp.plannedEquipment)} this year instead of over 5–7 years. ${TAX.year} §179 limit ${fmt(TAX.sec179.limit)} (phase-out from ${fmt(TAX.sec179.phaseout)}); bonus depreciation is 100% for property acquired after Jan 19, 2025.`,
        details: `<p><b>§179</b> is elective and can't create a loss; <b>bonus depreciation</b> has no dollar cap and can. Property must be <i>placed in service</i> by December 31 — ordering it isn't enough. This is a timing benefit: you deduct now and have lower depreciation later (and recapture if you sell).</p><p>Use the <b>de minimis safe harbor</b> to expense items up to ${fmt(TAX.deMinimis)} each without depreciation schedules.</p>`,
        steps: ['Buy and place equipment in service before Dec 31.', 'Elect §179 on Form 4562; bonus applies automatically unless you opt out.', 'Weigh whether you expect higher rates later — deferring may sometimes be better.'],
      });
    }

    /* ---------- 7. Heavy vehicle ---------- */
    if (opt.items.vehicle) {
      S.push({
        id: 'vehicle', cat: 'Depreciation', title: 'Heavy SUV / truck (> 6,000 lb GVWR) write-off', code: 'IRC §280F, §179(b)(5), §168(k)',
        type: 'timing', savings: pos(delta(opt.items.vehicle)), applies: true, risk: 'Medium',
        summary: `Deduct ${fmt(opt.items.vehicle.bizDeduction)} (${inp.vehicleBizUse}% business use of ${fmt(inp.vehicleCost)}) in year one via bonus depreciation.`,
        details: '<p>Vehicles over 6,000 lb GVWR escape the luxury-auto depreciation caps. Business use must exceed 50% and be supported by a contemporaneous mileage log; if it drops to 50% or less later, depreciation is recaptured.</p>',
        steps: ['Verify GVWR on the door-jamb sticker.', 'Title in the business name (corps) and keep a mileage log.', 'If you use standard mileage instead, you cannot also take depreciation.'],
      });
    }
    if (opt.items.mileage) {
      S.push({
        id: 'mileage', cat: 'Expenses', title: bestE === 'llc' ? 'Deduct business mileage' : 'Reimburse mileage through an accountable plan',
        code: 'IRC §162, §62(c); Notice 2026-10, Ann. 2026-11',
        type: 'permanent', savings: pos(delta(opt.items.mileage)), applies: true, risk: 'Low',
        summary: `${inp.businessMiles.toLocaleString()} miles × blended ${TAX.year} rate (72.5¢ Jan–Jun, 76¢ Jul–Dec) = ${fmt(opt.items.mileage.bizDeduction)}.`,
        details: '<p>For S/C-corp owners, personal-vehicle costs are no longer deductible on your own return — the company must reimburse you under a written <b>accountable plan</b>. Reimbursements are deductible to the business and tax-free to you. The same plan covers home office, phone and internet.</p>',
        steps: ['Adopt a written accountable plan (one-page board resolution).', 'Submit monthly expense reports with mileage logs within 60 days.'],
      });
    }

    /* ---------- 8. Home office ---------- */
    if (opt.items.homeOffice) {
      S.push({
        id: 'homeOffice', cat: 'Expenses', title: 'Home office deduction', code: 'IRC §280A(c)',
        type: 'permanent', savings: pos(delta(opt.items.homeOffice)), applies: true, risk: 'Low',
        summary: `Simplified method: ${Math.min(inp.homeOfficeSqft, 300)} sq ft × $5 = ${fmt(Math.min(inp.homeOfficeSqft, 300) * 5)} per owner. The actual-expense method (share of rent/mortgage interest, utilities, insurance, depreciation) is often larger.`,
        details: '<p>The space must be used <b>regularly and exclusively</b> for business and be your principal place of business. Corporate owners claim it via accountable-plan reimbursement.</p>',
        steps: ['Measure the dedicated space; photograph it.', 'Compare simplified vs. actual methods (Form 8829).'],
      });
    }

    /* ---------- 9. Augusta rule ---------- */
    if (opt.items.augusta) {
      S.push({
        id: 'augusta', cat: 'Expenses', title: 'Rent your home to the business (Augusta rule)', code: 'IRC §280A(g)',
        type: 'permanent', savings: pos(delta(opt.items.augusta)), applies: true, risk: 'Medium',
        summary: `${Math.min(14, inp.augustaDays)} days × ${fmt(inp.augustaRate)}/day = ${fmt(opt.items.augusta.bizDeduction / n)} per owner: deductible to the business, tax-free to you.`,
        details: '<p>Rental income from renting your home for 14 or fewer days a year is excluded from income. The business deducts the rent for genuine business use (board meetings, planning sessions, team events). The rate must be fair market (get comparable venue quotes). Doesn\'t work for a sole proprietor paying themselves.</p>',
        steps: ['Get 2–3 written quotes for comparable local venues.', 'Hold real meetings; keep agendas, minutes and attendee lists.', 'Pay by invoice from you to the company.'],
      });
    } else if (bestE === 'llc' && inp.augustaDays > 0) {
      S.push({ id: 'augusta', cat: 'Expenses', title: 'Augusta rule (§280A(g))', code: 'IRC §280A(g)', type: 'info', savings: 0, applies: false, risk: 'Medium', countInTotal: false,
        summary: 'Not effective for a sole proprietor — becomes available after an S- or C-corp election.', details: '', steps: [] });
    }

    /* ---------- 10. Hire your kids ---------- */
    if (opt.items.kids) {
      const llcFree = bestE === 'llc' && inp.owners <= 2;
      S.push({
        id: 'kids', cat: 'Family', title: 'Hire your children', code: 'IRC §3121(b)(3)(A), §63(c)',
        type: 'permanent', savings: pos(delta(opt.items.kids)), applies: true, risk: 'Medium',
        summary: `Pay ${inp.kids} child${inp.kids > 1 ? 'ren' : ''} ${fmt(inp.kidWage)} each. Income up to the ${fmt(TAX.stdDeduction.single)} standard deduction is tax-free to them${llcFree ? ', and wages from a parent-owned sole prop/partnership to children under 18 are exempt from FICA' : '; corporations must withhold FICA, which the engine includes'}.`,
        details: '<p>Wages must be reasonable for real work (filing, social media, cleaning, modelling for marketing). Keep timesheets and pay by direct deposit into the child\'s account. Children can put up to the IRA limit ($7,500) into a Roth IRA from earned income.</p>',
        steps: ['Write simple job descriptions and track hours.', 'Issue a W-2 each January.', 'Consider funding a Roth IRA for each child.'],
      });
    }

    /* ---------- 11. QBI planning ---------- */
    S.push({
      id: 'qbi', cat: 'Deductions', title: 'Qualified Business Income (QBI) deduction planning', code: 'IRC §199A (permanent under OBBBA)',
      type: 'info', savings: 0, applies: bestE !== 'ccorp', risk: 'Low', countInTotal: false,
      summary: bestE === 'ccorp' ? 'Not available to C corporations — part of why pass-throughs often win.'
        : `Your optimised plan claims a ${fmt(opt.result.qbiDed * n)} QBI deduction. Status: ${opt.result.qbiNote}.`,
      details: `<p>Pass-through owners deduct up to 20% of QBI. Above ${fmt(TAX.qbi.threshold[inp.filingStatus])} of taxable income (${inp.filingStatus === 'mfj' ? 'joint' : 'single'}), the deduction phases in limits over ${fmt(TAX.qbi.range[inp.filingStatus])}: for <b>specified service</b> businesses (health, law, consulting, accounting, finance…) it disappears; for others it's capped at 50% of W-2 wages (or 25% wages + 2.5% of property basis). OBBBA also adds a ${fmt(400)} minimum deduction.</p>
        <p>${inp.sstb ? 'Your industry is an <b>SSTB</b> — retirement contributions and other deductions that pull taxable income below the threshold are worth extra.' : 'Your industry is not an SSTB — paying W-2 wages (including S-corp owner salary) preserves the deduction at high incomes.'}</p>`,
      steps: ['Model year-end taxable income before December.', 'If near the threshold, accelerate deductions or retirement contributions.'],
    });

    /* ---------- 12. PTET ---------- */
    if (ptet > 0) {
      S.push({
        id: 'ptet', cat: 'State', title: 'Elect your state\'s pass-through entity tax (PTET)', code: 'IRS Notice 2020-75; state PTET statutes',
        type: 'permanent', savings: Math.round(ptet), applies: true, risk: 'Low',
        summary: `Pay state tax on business income at the entity level so it's fully deductible federally, sidestepping the SALT cap (${fmt(TAX.salt.cap)} in ${TAX.year}, reduced above ${fmt(TAX.salt.phaseStart)} MAGI). Estimated benefit ${fmt(ptet)}.`,
        details: '<p>About 36 states offer PTET for partnerships and S corps (not sole proprietors in most). OBBBA preserved the workaround. If you take the standard deduction, you currently get no federal benefit from state income tax at all — PTET converts it into a business deduction.</p>',
        steps: ['Confirm your state offers PTET and its election deadline.', 'Make PTET estimated payments by Dec 31 to deduct this year.', 'Claim the matching state credit on your personal return.'],
      });
    }

    /* ---------- 13–17. Credits ---------- */
    if (cr.rd) S.push({
      id: 'rd', cat: 'Credits', title: 'Research & development tax credit', code: 'IRC §41, §174A',
      type: 'credit', savings: cr.rd, applies: true, risk: 'Medium',
      summary: `Alternative simplified credit ≈ ${fmt(cr.rd)} on ${fmt(inp.rdSpend)} of qualified research. ${inp.revenue < 5e6 && inp.yearsInBusiness < 5 ? 'You may qualify to apply up to $500,000 against payroll taxes even with no income tax.' : ''}`,
      details: '<p>Qualifying: developing new or improved products, software, processes — wages, supplies and 65% of contract research. OBBBA\'s new §174A restores <b>immediate expensing</b> of domestic research costs (from 2025), and small businesses (≤$31M receipts) can elect to apply it retroactively to 2022–2024 by amending.</p>',
      steps: ['Document projects, hypotheses and time spent.', 'File Form 6765 (and Form 8974 for the payroll offset).'],
    });
    if (cr.wotc) S.push({
      id: 'wotc', cat: 'Credits', title: 'Work Opportunity Tax Credit', code: 'IRC §51',
      type: 'credit', savings: cr.wotc, applies: true, risk: 'Low',
      summary: `Up to ${fmt(TAX.credits.wotcMax)} per qualifying new hire (veterans, SNAP recipients, long-term unemployed, etc.) — ${inp.wotcHires} hire(s).`,
      details: '<p>You must submit Form 8850 to your state workforce agency within 28 days of the employee\'s start date. Larger credits apply for certain veterans.</p>',
      steps: ['Screen new hires with Form 8850 on or before the job offer.', 'Claim on Form 5884.'],
    });
    if (cr.health45r) S.push({
      id: 'health45r', cat: 'Credits', title: 'Small Business Health Care Tax Credit', code: 'IRC §45R',
      type: 'credit', savings: cr.health45r, applies: true, risk: 'Low',
      summary: `Up to 50% of employer premiums for employers with < 25 FTEs and average wages under ≈${fmt(TAX.credits.sec45rWageLimit)}. Estimate: ${fmt(cr.health45r)}.`,
      details: '<p>Coverage must be bought through the SHOP marketplace and you must pay at least 50% of employee-only premiums. Available for two consecutive years. Owners and their family members do not count as employees.</p>',
      steps: ['Enroll via a SHOP-registered broker.', 'Claim on Form 8941.'],
    });
    if (cr.startup45e) S.push({
      id: 'startup45e', cat: 'Credits', title: 'Retirement plan startup credits (SECURE 2.0)', code: 'IRC §45E, §45T',
      type: 'credit', savings: cr.startup45e, applies: true, risk: 'Low',
      summary: `First-year estimate ${fmt(cr.startup45e)}: startup-cost credit (up to ${fmt(5000)}/yr for 3 years) + ${fmt(500)} auto-enrollment credit + up to ${fmt(1000)} per employee for employer contributions.`,
      details: '<p>For employers with up to 100 employees setting up a new plan with at least one non-highly-compensated employee. The employer-contribution credit is 100% in years 1–2 for ≤50 employees, then phases down.</p>',
      steps: ['Choose a 401(k) provider; include auto-enrollment.', 'Claim on Form 8881.'],
    });
    if (cr.childcare45f) S.push({
      id: 'childcare45f', cat: 'Credits', title: 'Employer-provided childcare credit', code: 'IRC §45F (expanded by OBBBA from 2026)',
      type: 'credit', savings: cr.childcare45f, applies: true, risk: 'Medium',
      summary: `Small businesses can claim 50% of qualified childcare expenditures (cap ${fmt(TAX.credits.childcareMaxSmall)}). Estimate: ${fmt(cr.childcare45f)}.`,
      details: '<p>Covers building/operating a childcare facility, contracting with a licensed provider, or (new under OBBBA) jointly with other small businesses.</p>', steps: ['Claim on Form 8882.'],
    });

    /* ---------- 18. QSBS ---------- */
    if (bestE === 'ccorp' || inp.exitGain > 0) {
      const q = Math.min(inp.exitGain || 0, TAX.qsbs.cap) * 0.238;
      S.push({
        id: 'qsbs', cat: 'Exit', title: 'Qualified Small Business Stock exclusion', code: 'IRC §1202 (enhanced by OBBBA)',
        type: 'future', savings: Math.round(q), applies: true, risk: 'Medium', countInTotal: false,
        summary: inp.exitGain > 0 ? `On a ${fmt(inp.exitGain)} exit, up to ${fmt(q)} of federal tax could be excluded.` : 'If you plan to sell the company, C-corp stock may be excluded from capital gains tax.',
        details: `<p>For stock issued after July 4, 2025: 50% exclusion after 3 years, 75% after 4, 100% after 5; gain cap raised to ${fmt(TAX.qsbs.cap)} (indexed); gross-asset limit ${fmt(TAX.qsbs.assetLimit)}. Must be an active C corp in a qualifying field — most service businesses (health, law, consulting, finance) are excluded.</p>`,
        steps: ['Issue stock directly from the corporation (original issuance).', 'Keep records proving gross assets at issuance.'],
      });
    }

    /* ---------- Best-practice checklist (no $ attached) ---------- */
    const tips = [
      ['Cash-method timing', 'IRC §448', 'If your gross receipts are under the small-business test (~$31M), you can use cash accounting: delay December invoices and prepay expenses (up to 12 months ahead) to shift income into next year.'],
      ['Estimated-tax safe harbor', 'IRC §6654', 'Pay 100% of last year\'s tax (110% if AGI > $150k) in quarterly estimates to avoid penalties no matter what you owe this year. See the Projections tab for your schedule.'],
      ['Startup costs', 'IRC §195', `Deduct up to ${fmt(TAX.startupCostDeduction)} of startup and organisational costs in year one; amortise the rest over 15 years.`],
      ['Meals', 'IRC §274', 'Business meals are 50% deductible; entertainment is 0%. Record who attended and the business purpose.'],
      ['De minimis safe harbor', 'Reg. §1.263(a)-1(f)', `Expense items costing ${fmt(TAX.deMinimis)} or less each instead of depreciating them — attach the election statement to your return.`],
      ['Bad debts & inventory', 'IRC §166, §471(c)', 'Write off uncollectible invoices (accrual basis) and review inventory write-downs at year end.'],
    ];

    const counted = S.filter(s => s.applies && s.countInTotal !== false && s.id !== 'entity' && s.id !== 'salary');
    const credTotal = Object.values(cr).reduce((a, b) => a + b, 0);
    const planTax = opt.result.total * n;
    const currentTax = cmp.current.total * n;
    const totalSavings = pos(currentTax - planTax) + credTotal + ptet;

    S.sort((a, b) => (b.applies - a.applies) || (b.savings - a.savings));
    return {
      cmp, optimized, bestE, opt, strategies: S, tips, credits: cr, ptet,
      currentTax, planTax, credTotal, totalSavings,
      profit: pPer * n, sumIndividual: counted.reduce((a, s) => a + s.savings, 0),
    };
  }

  function entityDetails(bestE, cmp, inp) {
    const fmt = Fmt.money;
    const r = cmp[bestE];
    return `<p>Before strategies, tax caused by the business per owner is: LLC ${fmt(cmp.llc.bizTax)}, S corp ${fmt(cmp.scorp.bizTax)} (salary ${fmt(cmp.scorp.salary)}), C corp ${fmt(cmp.ccorp.bizTax)} (salary ${fmt(cmp.ccorp.salary)}, ${inp.distributionPct}% of after-tax profit paid as dividends).</p>
      <ul>
        <li><b>LLC / sole prop</b>: all profit is subject to 15.3% self-employment tax (2.9% above ${fmt(TAX.ssWageBase)}), but you get the 20% QBI deduction and the simplest compliance.</li>
        <li><b>S corp</b>: only salary bears payroll tax; distributions don't. Costs ~${fmt(inp.payrollAdmin)}/yr in payroll and 1120-S prep. Typically wins once profit clears roughly $50–80k.</li>
        <li><b>C corp</b>: flat 21% corporate rate, then dividends taxed again at 0/15/20% + 3.8% NIIT. Wins mainly when profits are retained to grow, when QSBS (§1202) matters for an exit, or for fully deductible fringe benefits.</li>
      </ul>
      ${bestE === 'ccorp' && r.retained > 0 ? `<p>The C-corp result assumes ${fmt(r.retained)} per owner is retained in the company — that money is still taxed if paid out later.</p>` : ''}`;
  }

  return { analyze, ENTITY_NAMES };
})();
