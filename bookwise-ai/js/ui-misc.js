/* =========================================================================
   Bookwise — Tax Law Library + Settings
   ========================================================================= */
const Library = (() => {
  const F = Fmt.money;
  let q = '';
  const T = TAX;
  const ENTRIES = () => [
    ['Entity types', 'Sole proprietorship & single-member LLC', 'Schedule C, IRC §1401', `Profit flows to your Form 1040. All net earnings (×92.35%) are subject to 15.3% self-employment tax up to the ${F(T.ssWageBase)} Social Security wage base, then 2.9% Medicare (+0.9% above ${F(200000)} single / ${F(250000)} joint). Half of SE tax is deductible. Eligible for the QBI deduction.`],
    ['Entity types', 'Partnership / multi-member LLC', 'Form 1065, IRC §701–777', 'No entity-level federal tax; each partner gets a K-1. General partners and most LLC members pay SE tax on their share. Flexible special allocations and guaranteed payments. Eligible for QBI and state PTET.'],
    ['Entity types', 'S corporation', 'Form 1120-S, IRC §1361–1379', `Pass-through with one class of stock, ≤100 shareholders (U.S. individuals). Owner-employees must take reasonable W-2 salary; remaining profit is distributed free of payroll tax. More than 2% shareholders include health premiums in W-2 wages but deduct them personally. Elect with Form 2553 by March 15.`],
    ['Entity types', 'C corporation', 'Form 1120, IRC §11', `Flat ${Fmt.pct(T.corpRate, 0)} federal rate on corporate profit; dividends taxed again at 0/15/20% plus 3.8% NIIT. Fully deductible fringe benefits, QSBS eligibility (§1202), no QBI deduction. Accumulated earnings tax can apply above $250,000 retained without business need.`],
    ['Payroll', 'Reasonable compensation', 'Rev. Rul. 74-44, Watson v. U.S. (8th Cir. 2012)', 'S-corp owners who work in the business must be paid a salary comparable to what the business would pay someone else. Courts have reclassified distributions as wages when salary was unreasonably low. Use market data and document the role.'],
    ['Payroll', 'Hiring your children', 'IRC §3121(b)(3)(A), §3306(c)(5)', `Wages a sole proprietor or parents-only partnership pays a child under 18 are exempt from Social Security and Medicare tax (under 21 for FUTA). The child pays no income tax up to the ${F(T.stdDeduction.single)} standard deduction. Corporations get the deduction but must withhold FICA.`],
    ['Deductions', 'Qualified Business Income deduction', 'IRC §199A — permanent under OBBBA', `Up to 20% of QBI from pass-throughs. ${T.year} limits begin at ${F(T.qbi.threshold.single)} (single) / ${F(T.qbi.threshold.mfj)} (joint) of taxable income and phase in over ${F(T.qbi.range.single)} / ${F(T.qbi.range.mfj)}. SSTBs (health, law, accounting, consulting, financial services, athletics, performing arts, or reputation/skill-based) lose it above the range; others are capped at 50% of W-2 wages or 25% of wages + 2.5% of UBIA. New $400 minimum deduction for at least $1,000 of QBI.`],
    ['Deductions', 'Home office', 'IRC §280A(c)', `Regular and exclusive business use of part of your home. Simplified method: $${T.homeOffice.rate}/sq ft up to ${T.homeOffice.maxSqft} sq ft. Actual method allocates rent/mortgage interest, utilities, insurance, repairs and depreciation (Form 8829). Corporate owners use an accountable plan.`],
    ['Deductions', 'Augusta rule', 'IRC §280A(g)', 'Rent from renting your residence for 14 days or fewer per year is excluded from income. A corporation or partnership can deduct fair-market rent for genuine business meetings held there.'],
    ['Deductions', 'Vehicles & mileage', 'IRC §274(d), §280F, Notice 2026-10, Ann. 2026-11', `${T.year} business standard mileage rate: 72.5¢/mile for January–June and 76¢/mile from July 1 (a rare mid-year increase). Or deduct actual costs + depreciation. Vehicles over 6,000 lb GVWR avoid luxury-auto caps. Contemporaneous logs are required.`],
    ['Deductions', 'Meals & entertainment', 'IRC §274(k), (n)', 'Business meals with clients or employees are 50% deductible when not lavish and the owner or an employee is present. Entertainment (sporting events, golf) is not deductible. Office holiday parties are 100%.'],
    ['Deductions', 'Startup costs', 'IRC §195, §248', `Up to ${F(T.startupCostDeduction)} of startup costs and ${F(5000)} of organisational costs deductible in year one (reduced dollar-for-dollar above $50,000), remainder over 15 years.`],
    ['Depreciation', 'Section 179 expensing', 'IRC §179', `Immediately expense qualifying equipment, software and certain building improvements (roofs, HVAC, security). ${T.year} limit ${F(T.sec179.limit)}, phasing out dollar-for-dollar above ${F(T.sec179.phaseout)} of purchases. Can't exceed business taxable income.`],
    ['Depreciation', 'Bonus depreciation', 'IRC §168(k) — 100% restored by OBBBA', 'Permanent 100% first-year depreciation for property acquired after January 19, 2025. No dollar cap and can create a loss. Applies automatically unless you elect out by class.'],
    ['Depreciation', 'De minimis safe harbor', 'Reg. §1.263(a)-1(f)', `Expense tangible items costing up to ${F(T.deMinimis)} per invoice/item (${F(5000)} with audited financials) by attaching an annual election.`],
    ['Retirement', 'Solo 401(k)', 'IRC §401(k), §415(c)', `${T.year}: ${F(T.retirement.deferral)} employee deferral + employer profit-sharing of 25% of W-2 salary (≈20% of net SE income), total ${F(T.retirement.dcLimit)}. Catch-up ${F(T.retirement.catchup50)} at 50+, ${F(T.retirement.catchup6063)} at ages 60–63. Must be established by Dec 31.`],
    ['Retirement', 'SEP-IRA', 'IRC §408(k)', `Employer-only contributions of up to 25% of compensation, max ${F(T.retirement.dcLimit)}. Can be opened and funded up to the extended filing deadline. Must cover eligible employees at the same percentage.`],
    ['Retirement', 'Cash-balance / defined-benefit plan', 'IRC §412, §415(b)', `Actuarially determined contributions, often $100k–$300k+/yr for owners in their 50s–60s. ${T.year} annual benefit limit $290,000. Can be paired with a 401(k).`],
    ['Health', 'Self-employed health insurance', 'IRC §162(l)', 'Owners of sole props, partnerships and >2% S-corp shareholders deduct health, dental and long-term-care premiums above the line. Not available in months you were eligible for an employer-subsidised plan (including a spouse\'s).'],
    ['Health', 'Health Savings Account', 'IRC §223', `${T.year} limits ${F(T.hsa.self)} self-only / ${F(T.hsa.family)} family, +${F(T.hsa.catchup55)} at 55+. Requires an HSA-eligible high-deductible plan.`],
    ['Health', 'QSEHRA & ICHRA', 'IRC §9831(d), Reg. §54.9802-4', 'Reimburse employees\' individual health premiums tax-free. QSEHRA is for employers with fewer than 50 employees (annual caps apply); ICHRA has no cap and lets you vary by employee class.'],
    ['Credits', 'R&D credit & §174A expensing', 'IRC §41, §174A', 'Credit for qualified research wages, supplies and 65% of contract research. Alternative simplified credit = 14% of QREs above 50% of the prior 3-year average (6% if no history). Qualified small businesses (<$5M receipts, <5 years) can apply up to $500,000 against payroll taxes. OBBBA restored immediate expensing of domestic research costs from 2025.'],
    ['Credits', 'Work Opportunity Tax Credit', 'IRC §51', `Up to ${F(T.credits.wotcMax)} per eligible hire (more for certain veterans). Requires Form 8850 within 28 days of start.`],
    ['Credits', 'Small Business Health Care Credit', 'IRC §45R', 'Up to 50% of employer premiums (35% for tax-exempts) for fewer than 25 FTEs with average wages under ≈$66,600, purchased through SHOP. Two consecutive years max.'],
    ['Credits', 'Retirement plan startup credits', 'IRC §45E, §45T (SECURE 2.0)', 'Up to $5,000/yr for 3 years for plan startup costs, $500/yr for 3 years for auto-enrollment, plus up to $1,000 per employee for employer contributions (100% in years 1–2 for ≤50 employees).'],
    ['Credits', 'Employer-provided childcare credit', 'IRC §45F (expanded by OBBBA)', `From 2026: 40% of qualified childcare expenditures up to $500,000 — 50% up to ${F(T.credits.childcareMaxSmall)} for small businesses.`],
    ['State', 'SALT cap & PTET workaround', 'IRC §164(b)(6), Notice 2020-75', `The individual state-and-local tax deduction cap is ${F(T.salt.cap)} for ${T.year}, reduced by 30% of MAGI above ${F(T.salt.phaseStart)} (floor ${F(T.salt.floor)}). Pass-through entity taxes paid by partnerships/S corps are deductible at the entity level, bypassing the cap.`],
    ['Exit', 'Qualified Small Business Stock', 'IRC §1202', `For C-corp stock issued after July 4, 2025: 50% gain exclusion after 3 years, 75% after 4, 100% after 5. Cap ${F(T.qsbs.cap)} (or 10× basis); gross assets ≤ ${F(T.qsbs.assetLimit)} at issuance. Excludes most professional-service, finance, hospitality and farming businesses.`],
    ['Compliance', 'Estimated tax safe harbor', 'IRC §6654', 'Avoid underpayment penalties by paying the lesser of 90% of this year\'s tax or 100% of last year\'s (110% if prior AGI > $150,000), in four installments: April 15, June 15, September 15, January 15.'],
    ['Compliance', 'Cash vs. accrual method', 'IRC §448, §471(c)', 'Businesses under the gross-receipts test (~$31M average, indexed) can use the cash method and simplified inventory rules — enabling year-end timing of income and expenses.'],
  ];

  function render() {
    const T = TAX;
    const list = ENTRIES().filter(e => !q || e.join(' ').toLowerCase().includes(q.toLowerCase()));
    const groups = [...new Set(list.map(e => e[0]))];
    return `<div class="card"><div class="card-h"><div><h2>Key ${T.year} numbers</h2><div class="muted small">Every calculation in Bookwise reads from these (js/tax-data.js).</div></div></div>
      <div class="grid g4 small">
        ${[['Standard deduction', `${F(T.stdDeduction.single)} single, ${F(T.stdDeduction.mfj)} joint`], ['Top bracket (37%)', `> ${F(640600)} single, ${F(768700)} joint`],
          ['Social Security wage base', F(T.ssWageBase)], ['Corporate rate', Fmt.pct(T.corpRate, 0)],
          ['QBI threshold', `${F(T.qbi.threshold.single)}, ${F(T.qbi.threshold.mfj)}`], ['§179 limit', `${F(T.sec179.limit)} (phase-out ${F(T.sec179.phaseout)})`],
          ['401(k) deferral / total', `${F(T.retirement.deferral)} / ${F(T.retirement.dcLimit)}`], ['SALT cap', F(T.salt.cap)],
          ['HSA', `${F(T.hsa.self)}, ${F(T.hsa.family)}`], ['IRA', F(T.ira)], ['Mileage', '72.5¢ (Jan–Jun), 76¢ (Jul–Dec)'], ['Bonus depreciation', '100%']]
          .map(([k, v]) => `<div><div class="muted" style="font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em">${k}</div><div style="font-weight:650">${v}</div></div>`).join('')}
      </div></div>
      <div class="card"><div class="card-h"><h2>Federal brackets ${T.year}</h2></div><div class="table-wrap"><table><thead><tr><th>Rate</th><th class="r">Single — up to</th><th class="r">Married joint — up to</th></tr></thead><tbody>
        ${T.brackets.single.map((b, i) => `<tr><td>${Fmt.pct(b[1], 0)}</td><td class="r">${b[0] === Infinity ? 'and above' : F(b[0])}</td><td class="r">${T.brackets.mfj[i][0] === Infinity ? 'and above' : F(T.brackets.mfj[i][0])}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><div class="row" style="margin-bottom:12px"><h2>Provisions</h2><span class="spacer"></span><input style="max-width:280px" placeholder="Search e.g. S corp, 179, mileage" value="${Fmt.esc(q)}" oninput="Library.search(this.value)" id="lib-q"/></div>
        ${groups.map(g => `<h3 style="margin:18px 0 8px;color:var(--brand)">${g}</h3><div class="grid g2">${list.filter(e => e[0] === g).map(e => `<div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px">
          <div style="font-weight:650">${e[1]}</div><div style="font-family:var(--mono);font-size:11.5px;color:var(--ink-3);margin:2px 0 6px">${e[2]}</div><div class="small">${e[3]}</div></div>`).join('')}</div>`).join('') || '<div class="empty">No matches.</div>'}
      </div>
      <div class="note">Summaries are simplified for planning. Sources: IRS Rev. Proc. 2025-32, Notice 2025-67, Notice 2026-10, Announcement 2026-11, SSA 2026 COLA fact sheet, and P.L. 119-21 (One Big Beautiful Bill Act).</div>`;
  }
  return { render, search(v) { q = v; App.render(); setTimeout(() => { const el = $('#lib-q'); el.focus(); el.setSelectionRange(v.length, v.length); }, 0); } };
})();
App.register('library', { title: 'Tax law library', crumb: 'Taxes', sub: () => `Plain-English guide to the ${TAX.year} rules the optimizer uses`, render: Library.render });

const Settings = {
  render() {
    const c = Store.state.company;
    return `<div class="grid g2"><div class="card"><div class="card-h"><h2>Company</h2></div><div class="form-grid">
        <label class="f">Business name<input id="s-name" value="${Fmt.esc(c.name)}"/></label>
        <label class="f">Opening cash balance<div class="money-in"><input type="number" id="s-cash" value="${c.openingCash}"/></div></label>
        <label class="f">Equipment (book value at opening)<div class="money-in"><input type="number" id="s-eq" value="${c.equipmentValue}"/></div></label>
        <label class="f">Loan balance<div class="money-in"><input type="number" id="s-loan" value="${c.loanBalance}"/></div></label></div>
        <div class="row" style="margin-top:14px"><span class="spacer"></span><button class="btn primary" onclick="Settings.save()">Save</button></div></div>
      <div class="card"><div class="card-h"><h2>AI features</h2><span class="ai-tag">${AI.engine() === 'Claude' ? 'Connected to Claude' : 'Using the built-in engine'}</span></div>
        <label class="check"><input type="checkbox" ${Store.state.aiOff ? '' : 'checked'} onchange="Store.state.aiOff=!this.checked;Store.save();App.toast(this.checked?'Claude enabled when available':'Using the built-in engine only')"/> Use Claude when the site has an API key</label>
        <p class="small" style="margin-top:10px">Briefings, answers, explanations, reminders and margin notes run on the built-in engine in your browser. To have Claude write them, add <code>ANTHROPIC_API_KEY</code> in your Netlify site's environment variables and deploy from Git or the Netlify CLI. When Claude is used, a summary of your books (monthly totals, categories, top customers and vendors, the tax plan) is sent with each request. Bank descriptions and account numbers are not.</p></div>
      <div class="card"><div class="card-h"><h2>Your data</h2></div>
        <p class="small">Your books are stored privately in this browser under your account — nothing is sent to a server. Back them up or move them to another device with a JSON file.</p>
        <div class="row" style="margin-top:10px"><button class="btn" onclick="Settings.backup()">${ICONS.dl} Download backup</button>
          <label class="btn">Restore backup<input type="file" accept=".json" style="display:none" onchange="Settings.restore(this.files[0])"/></label></div>
        <div class="row" style="margin-top:14px"><button class="btn" onclick="Settings.reset(true)">Reload sample company</button><button class="btn danger" onclick="Settings.reset(false)">Clear transactions & invoices</button></div>
        <p class="muted small" style="margin-top:14px">${Store.state.transactions.length} transactions, ${Store.state.invoices.length} invoices</p></div></div>`;
  },
  save() {
    const c = Store.state.company;
    c.name = $('#s-name').value.trim() || 'My Business'; c.openingCash = +$('#s-cash').value; c.equipmentValue = +$('#s-eq').value; c.loanBalance = +$('#s-loan').value;
    Store.save(); App.render(); App.toast('Settings saved');
  },
  backup() { App.download(`bookwise-backup-${today()}.json`, JSON.stringify(Store.state, null, 2), 'application/json'); },
  async restore(file) {
    try { const d = JSON.parse(await file.text()); if (!d.transactions) throw 0; localStorage.setItem('bookwise.data.' + window.__user.id, JSON.stringify(d)); Store.load(window.__user); App.render(); App.toast('Backup restored'); }
    catch { App.toast('That file is not a Bookwise backup'); }
  },
  reset(sample) {
    if (!confirm(sample ? 'Replace your data with the sample company?' : 'Erase all transactions and invoices? Your business profile is kept.')) return;
    Store.reset(sample); App.render(); App.toast(sample ? 'Sample data loaded' : 'Books cleared');
  },
};
App.register('settings', { title: 'Settings & Data', render: Settings.render });
