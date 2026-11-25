/* =========================================================================
   Bookwise — onboarding wizard (new accounts) + Account & security page
   ========================================================================= */
const Onboard = (() => {
  let step = 0;
  const F = Fmt.money;
  const STEPS = ['Your business', 'Your numbers', 'You & household', 'Plans this year', 'Your plan'];
  const ENTITY_CHOICES = [['llc', 'Sole prop / single-member LLC', 'Schedule C'], ['partnership', 'Partnership / multi-member LLC', 'Form 1065'],
    ['scorp', 'S corporation', 'Form 1120-S'], ['ccorp', 'C corporation', 'Form 1120']];

  const tp = () => Store.state.taxProfile, co = () => Store.state.company;
  const money = (k, label, hint, scope = 'p') => {
    const v = scope === 'c' ? co()[k] : tp()[k];
    return `<label class="f">${label}<div class="money-in"><input type="number" min="0" step="100" data-w="${scope}:${k}" value="${v || ''}" placeholder="0"/></div>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  };
  const num = (k, label, hint, attrs = '') => `<label class="f">${label}<input type="number" min="0" data-w="p:${k}" value="${tp()[k] ?? ''}" ${attrs}/>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const choice = (k, opts) => `<div class="choice-grid">${opts.map(([v, t, sub]) => `<button type="button" class="choice ${String(tp()[k]) === String(v) ? 'on' : ''}" data-choice="${k}" data-v="${v}"><b>${t}</b>${sub ? `<span>${sub}</span>` : ''}</button>`).join('')}</div>`;

  function body() {
    const p = tp(), c = co();
    if (step === 0) return `<h2 class="big">Tell us about your business</h2><p class="muted">This takes about 3 minutes. You can change anything later.</p>
      <div class="form-grid" style="margin-top:16px">
        <label class="f" style="grid-column:1/-1">Business name<input data-w="c:name" value="${Fmt.esc(c.name === 'My Business' ? '' : c.name)}" placeholder="e.g. Riverside Plumbing LLC"/></label>
        <label class="f">Industry<select data-w="p:industry">${INDUSTRIES.map(i => `<option value="${i.id}" ${p.industry === i.id ? 'selected' : ''}>${i.name}</option>`).join('')}</select><span class="hint">Service fields marked SSTB have special QBI rules</span></label>
        <label class="f">State<select data-w="p:stateChoice" id="ob-state">${US_STATES.map(s => `<option ${p.stateChoice === s[0] ? 'selected' : ''}>${s[0]}</option>`).join('')}</select></label>
        <label class="f">State income tax rate (%)<input type="number" step="0.01" data-w="p:stateRate" id="ob-rate" value="${p.stateRate}"/></label>
        ${num('yearsInBusiness', 'Years in business')}
        ${num('owners', 'Number of owners', '', 'min="1"')}
      </div>
      <h3 style="margin:20px 0 8px">How is the business taxed today?</h3>${choice('currentEntity', ENTITY_CHOICES)}
      <p class="small muted" style="margin-top:16px">Just exploring? <a href="javascript:Onboard.sample()">Fill my account with sample data instead</a>.</p>`;
    if (step === 1) return `<h2 class="big">Your annual numbers</h2><p class="muted">Use last year's figures or your best estimate for this year. Once you start recording transactions, you can pull real figures from your books.</p>
      <fieldset style="margin-top:16px"><legend>Income & costs</legend><div class="form-grid">
        ${money('revenue', 'Gross revenue')}${money('cogs', 'Cost of goods sold', 'Materials, inventory, subcontractors')}
        ${money('opex', 'Operating expenses', 'Rent, software, ads, insurance… (not payroll)')}</div></fieldset>
      <fieldset><legend>Team</legend><div class="form-grid">
        ${num('employees', 'Employees (excluding owners)')}${money('employeeWages', 'Total employee wages / yr')}
        ${money('employerHealth', 'Health premiums you pay for employees')}</div></fieldset>
      <fieldset><legend>Starting balances</legend><div class="form-grid">
        ${money('openingCash', 'Business bank balance today', '', 'c')}${money('equipmentValue', 'Equipment you own (value)', '', 'c')}${money('loanBalance', 'Business loans outstanding', '', 'c')}</div></fieldset>
      <div id="ob-live" class="note info"></div>`;
    if (step === 2) return `<h2 class="big">You & your household</h2><p class="muted">Business taxes land on your personal return, so the engine needs a little about you. This stays in your account.</p>
      <h3 style="margin:16px 0 8px">Filing status</h3>${choice('filingStatus', [['single', 'Single', ''], ['mfj', 'Married filing jointly', '']])}
      <div class="form-grid" style="margin-top:16px">
        ${num('ownerAge', 'Your age', 'Unlocks catch-up contribution limits')}
        ${money('otherIncome', 'Other household income', 'e.g. spouse\'s salary')}
        ${money('propertyTax', 'Home property tax / yr')}
        ${money('healthPremiums', 'Health insurance you pay for yourself / yr')}
        <label class="f">HSA-eligible health plan?<select data-w="p:hsaCoverage">${[['none', 'No / not sure'], ['self', 'Yes — just me'], ['family', 'Yes — family']].map(([v, t]) => `<option value="${v}" ${p.hsaCoverage === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        ${num('kids', 'Children who could help in the business')}${money('kidWage', 'Reasonable wage per child / yr')}
      </div>`;
    if (step === 3) return `<h2 class="big">What's planned this year?</h2><p class="muted">Each of these can unlock a deduction or credit. Leave blank if it doesn't apply.</p>
      <fieldset style="margin-top:16px"><legend>Purchases</legend><div class="form-grid">
        ${money('plannedEquipment', 'Equipment, computers, machinery, software')}${money('vehicleCost', 'Truck / SUV over 6,000 lb')}${num('vehicleBizUse', 'Vehicle business-use %')}</div></fieldset>
      <fieldset><legend>Everyday deductions</legend><div class="form-grid">
        ${num('businessMiles', 'Business miles in your own car / yr')}${num('homeOfficeSqft', 'Home office size (sq ft)', 'Used regularly & only for work')}
        ${num('augustaDays', 'Days you could host business meetings at home', 'Up to 14')}${money('augustaRate', 'Local venue rate per day')}</div></fieldset>
      <fieldset><legend>Growth & credits</legend><div class="form-grid">
        ${money('rdSpend', 'R&D / product development spend', 'Wages + supplies on new products, software, processes')}
        ${num('wotcHires', 'New hires who are veterans, SNAP recipients or long-term unemployed')}
        ${money('childcareSpend', 'Childcare you\'ll provide for employees')}
        <label class="check"><input type="checkbox" data-w="p:hasRetirementPlan" ${p.hasRetirementPlan ? 'checked' : ''}/> We already offer employees a retirement plan</label>
        <label class="check"><input type="checkbox" data-w="p:considerDB" ${p.considerDB ? 'checked' : ''}/> I'd consider a high-contribution cash-balance plan</label></div></fieldset>`;
    const a = Optimizer.analysis();
    const top = a.strategies.filter(s => s.applies && s.savings > 0).slice(0, 5);
    return `<div style="text-align:center;padding:10px 0 6px"><h2 class="big">You're all set, ${Fmt.esc(window.__user.name.split(' ')[0])}</h2>
      <p class="muted">Based on what you entered, Bookwise found</p><div style="font-size:44px;margin:6px 0" class="num"><span class="hl">${F(a.totalSavings)}</span></div>
      <p class="muted">in potential annual tax savings. Recommended structure: <b>${Strategies.ENTITY_NAMES[a.bestE]}</b>.</p></div>
      ${top.length ? `<div class="card" style="margin-top:14px">${top.map(t => `<div class="list-item"><span>${t.title}</span><b class="up num">${F(t.savings)}</b></div>`).join('')}</div>` : '<div class="note">Add revenue and expense figures to see savings.</div>'}`;
  }

  function render() {
    return `<div class="wizard"><div class="steps">${STEPS.map((s, i) => `<div class="st ${i < step ? 'done' : i === step ? 'on' : ''}"><i></i><span>${s}</span></div>`).join('')}</div>
      <div class="card">${body()}
        <div class="wiz-foot"><div>${step > 0 && step < 4 ? '<button class="btn" onclick="Onboard.back()">← Back</button>' : step === 0 && Store.state.onboarded ? '<a class="btn" href="#/dashboard">Cancel</a>' : ''}</div>
          <div class="row"><span class="err" id="ob-err"></span>
          ${step < 3 ? `<button class="btn primary" onclick="Onboard.next()">Continue</button>` : step === 3 ? `<button class="btn primary" onclick="Onboard.next()">See my savings</button>` :
            `<a class="btn" href="#/transactions">Add transactions</a><a class="btn" href="#/dashboard">Go to dashboard</a><a class="btn primary" href="#/tax">Open my full tax plan</a>`}</div></div></div></div>`;
  }

  function collect() {
    $$('[data-w]').forEach(el => {
      const [scope, k] = el.dataset.w.split(':');
      const target = scope === 'c' ? co() : tp();
      target[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (+el.value || 0) : el.value;
    });
    const p = tp();
    p.owners = Math.max(1, p.owners || 1);
    p.avgEmployeeWage = p.employees ? Math.round(p.employeeWages / p.employees) : 0;
    p.ubia = Math.max(p.ubia || 0, co().equipmentValue || 0);
    Store.save();
  }
  function live() {
    const box = $('#ob-live'); if (!box) return;
    collect();
    const p = tp(), profit = p.revenue - p.cogs - p.opex - p.employeeWages * 1.0765;
    box.innerHTML = p.revenue ? `Estimated profit before owner pay: <b>${F(profit)}</b> (${Fmt.pct(profit / p.revenue)} margin).` : 'Enter revenue to see your estimated profit.';
  }

  function mount() {
    $$('[data-choice]').forEach(b => b.addEventListener('click', () => {
      tp()[b.dataset.choice] = b.dataset.v; Store.save();
      $$(`[data-choice="${b.dataset.choice}"]`).forEach(x => x.classList.toggle('on', x === b));
    }));
    const st = $('#ob-state');
    if (st) st.addEventListener('change', () => { const s = US_STATES.find(x => x[0] === st.value); if (s && s[1] !== null) $('#ob-rate').value = s[1]; });
    $$('#ob-live').length && ($$('[data-w]').forEach(el => el.addEventListener('input', live)), live());
  }

  return {
    render, mount,
    next() {
      collect();
      if (step === 0 && !co().name.trim()) { $('#ob-err').textContent = 'Please name your business.'; return; }
      if (step === 0) { window.__user = Auth.update(window.__user.id, { company: co().name }) || window.__user; App.renderUser(); }
      if (step === 3) { Store.state.onboarded = true; Store.state.taxSynced = false; Store.save(); }
      step++; App.render();
    },
    back() { collect(); step = Math.max(0, step - 1); App.render(); },
    sample() {
      if (!confirm('Load the sample company (Bluebird Creative Co.) with 12 months of transactions and invoices?')) return;
      Store.reset(true); App.toast('Sample data loaded'); location.hash = '#/dashboard';
    },
    reset() { step = 0; },
  };
})();
App.register('onboarding', { title: 'Set up your account', focus: true, sub: () => 'A few questions so the tax engine can work on your real numbers',
  render: Onboard.render, mount: Onboard.mount });
window.addEventListener('hashchange', () => { if (location.hash !== '#/onboarding') Onboard.reset(); });

/* ---------------- Account & security ---------------- */
const Account = {
  render() {
    const u = window.__user;
    const plans = [['starter', 'Starter — Free'], ['pro', 'Pro — $29/mo'], ['business', 'Business — $59/mo']];
    return `${u.isDemo ? '<div class="note" style="margin-bottom:16px">This is the shared demo account. Changes are saved only in this browser. <a href="signup.html">Create your own account</a> to keep your own books.</div>' : ''}
      <div class="grid g2">
        <div class="card"><div class="card-h"><h2>Profile</h2></div><div class="form-grid">
          <label class="f">Full name<input id="a-name" value="${Fmt.esc(u.name)}"/></label>
          <label class="f">Email<input id="a-email" type="email" value="${Fmt.esc(u.email)}" ${u.isDemo ? 'disabled' : ''}/></label>
          <label class="f">Company<input id="a-co" value="${Fmt.esc(Store.state.company.name)}"/></label>
          <label class="f">Member since<input value="${new Date(u.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}" disabled/></label></div>
          <div class="row" style="margin-top:14px"><span class="err" id="a-err"></span><span class="spacer"></span><button class="btn primary" onclick="Account.saveProfile()">Save profile</button></div></div>
        <div class="card"><div class="card-h"><h2>Password</h2></div>
          ${u.isDemo ? `<p class="small">Demo login: <b>${Auth.DEMO.email}</b> / <b>${Auth.DEMO.password}</b>. The password can't be changed.</p>` : `<div class="form-grid">
            <label class="f">Current password<input id="a-old" type="password" autocomplete="current-password"/></label>
            <label class="f">New password<input id="a-new" type="password" autocomplete="new-password"/><span class="hint">8+ characters with a letter and a number</span></label></div>
            <div class="row" style="margin-top:14px"><span class="err" id="a-perr"></span><span class="spacer"></span><button class="btn primary" onclick="Account.savePw()">Update password</button></div>`}</div>
        <div class="card"><div class="card-h"><h2>Plan</h2></div>
          <p class="small">Current plan: <span class="badge b-good" style="text-transform:capitalize">${u.plan}</span></p>
          <div class="row"><select id="a-plan" style="max-width:240px">${plans.map(([v, t]) => `<option value="${v}" ${u.plan === v ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn" onclick="Account.savePlan()">Change plan</button></div>
          <p class="muted small" style="margin-top:10px">Billing isn't connected in this build — connect Stripe Checkout to charge for plans.</p></div>
        <div class="card"><div class="card-h"><h2>Danger zone</h2></div>
          <p class="small">Permanently delete your account, books and tax profile from this browser.</p>
          <button class="btn danger" ${u.isDemo ? 'disabled title="The demo account cannot be deleted"' : ''} onclick="Account.del()">Delete my account</button></div>
      </div>`;
  },
  saveProfile() {
    try {
      const u = window.__user;
      const name = $('#a-name').value.trim(); if (!name) throw new Error('Name is required.');
      const fields = { name, company: $('#a-co').value.trim() };
      if (!u.isDemo) fields.email = $('#a-email').value;
      window.__user = Auth.update(u.id, fields);
      Store.state.company.name = fields.company || Store.state.company.name; Store.save();
      App.renderUser(); App.render(); App.toast('Profile saved');
    } catch (e) { $('#a-err').textContent = e.message; }
  },
  async savePw() {
    try { await Auth.changePassword(window.__user.id, $('#a-old').value, $('#a-new').value); $('#a-old').value = $('#a-new').value = ''; $('#a-perr').textContent = ''; App.toast('Password updated'); }
    catch (e) { $('#a-perr').textContent = e.message; }
  },
  savePlan() { window.__user = Auth.update(window.__user.id, { plan: $('#a-plan').value }); App.renderUser(); App.render(); App.toast('Plan updated'); },
  del() {
    if (prompt('Type DELETE to permanently remove your account and data.') !== 'DELETE') return;
    Auth.deleteAccount(window.__user.id); location.href = 'index.html';
  },
};
App.register('account', { title: 'Account & security', render: Account.render });
