/* =========================================================================
   Bookwise AI
   Every feature runs two ways:
   1. Claude, through the Netlify function /.netlify/functions/ai (needs
      ANTHROPIC_API_KEY set on the site), with the business's books sent as
      compact JSON context.
   2. A built-in engine that runs in the browser on the same data, so every
      feature works in the demo and offline.
   ========================================================================= */
const AI = (() => {
  let remote = sessionStorage.getItem('tl.ai') === 'off' ? false : null;                       // null = untested, true / false after first call
  const F = x => Fmt.money(x);
  const pct = x => Fmt.pct(x, 0);
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  /* ---------------- transport ---------------- */
  async function claude(task, prompt) {
    if (remote === false || Store.state.aiOff) return null;
    try {
      const r = await fetch('/.netlify/functions/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, prompt, context: context() }) });
      if (!r.ok) { remote = false; sessionStorage.setItem('tl.ai', 'off'); return null; }
      const j = await r.json(); remote = true; return j.text || null;
    } catch { remote = false; sessionStorage.setItem('tl.ai', 'off'); return null; }
  }
  const engine = () => remote ? 'Claude' : 'Built-in';

  /** Compact, privacy-light snapshot of the books for the model */
  function context() {
    const s = Store.state, months = Ledger.monthsBack(12), m = Ledger.monthly(s, months);
    const ytd = Ledger.range('ytd'), p = Ledger.pnl(s, ytd[0], ytd[1]);
    const a = Optimizer.analysis();
    return {
      company: s.company.name, today: today(),
      monthly: m.map(r => ({ month: r.month, income: Math.round(r.income), expenses: Math.round(r.cogs + r.expense), net: Math.round(r.net) })),
      ytd: { income: Math.round(p.totalIncome), cogs: Math.round(p.totalCogs), expenses: Math.round(p.totalExpense), net: Math.round(p.net),
        byCategory: [...p.cogs, ...p.expense].map(x => ({ name: x.name, amount: Math.round(x.amount) })) },
      cash: Math.round(Ledger.cashBalance(s)), receivables: Math.round(Ledger.arOutstanding(s)),
      overdue: s.invoices.filter(i => Ledger.invoiceStatus(i) === 'overdue').map(i => ({ customer: i.client, number: i.number, amount: Ledger.invTotal(i), due: i.due })),
      topVendors: Expenses.vendors().sort((x, y) => y.t12 - x.t12).slice(0, 8).map(v => ({ name: v.name, last12: Math.round(v.t12) })),
      topCustomers: Sales.customers().sort((x, y) => y.paid12 - x.paid12).slice(0, 8).map(c => ({ name: c.name, paid12: Math.round(c.paid12), open: Math.round(c.open) })),
      tax: { recommended: Strategies.ENTITY_NAMES[a.bestE], savings: Math.round(a.totalSavings), taxToday: Math.round(a.currentTax), taxWithPlan: Math.round(a.planTax - a.credTotal - a.ptet),
        strategies: a.strategies.filter(x => x.applies && x.savings > 0).map(x => ({ title: x.title, code: x.code, savings: Math.round(x.savings), type: x.type })) },
    };
  }

  /* ---------------- helpers for the built-in engine ---------------- */
  function parsePeriod(q) {
    const d = new Date(), y = d.getFullYear(), iso = x => x.toISOString().slice(0, 10);
    const qm = q.match(/\bq([1-4])(?:\s*(\d{4}))?/);
    if (qm) { const yy = +(qm[2] || y), s = (qm[1] - 1) * 3; return [iso(new Date(yy, s, 1)), iso(new Date(yy, s + 3, 0)), `Q${qm[1]} ${yy}`]; }
    const mi = MONTHS.findIndex(mn => new RegExp(`\\b${mn.slice(0, 3)}(${mn.slice(3)})?\\b`).test(q));
    if (mi >= 0) { const yy = mi > d.getMonth() ? y - 1 : y; return [iso(new Date(yy, mi, 1)), iso(new Date(yy, mi + 1, 0)), `${MONTHS[mi][0].toUpperCase() + MONTHS[mi].slice(1)} ${yy}`]; }
    if (/last quarter|previous quarter/.test(q)) { const cq = Math.floor(d.getMonth() / 3), yy = cq ? y : y - 1, pq = cq ? cq - 1 : 3; return [iso(new Date(yy, pq * 3, 1)), iso(new Date(yy, pq * 3 + 3, 0)), `Q${pq + 1} ${yy}`]; }
    if (/last month/.test(q)) return Ledger.range('lastmonth');
    if (/this month/.test(q)) return Ledger.range('month');
    if (/this quarter/.test(q)) return Ledger.range('quarter');
    if (/last year/.test(q)) return Ledger.range('lastyear');
    if (/12 months|past year|last twelve/.test(q)) return Ledger.range('t12');
    if (/30 days/.test(q)) return Ledger.range('last30');
    if (/all time|ever/.test(q)) return Ledger.range('all');
    return Ledger.range('ytd');
  }
  const SYN = { ads: 'advertising', ad: 'advertising', marketing: 'advertising', advertising: 'advertising', software: 'software', subscriptions: 'software', saas: 'software',
    rent: 'rent', lease: 'rent', office: 'office', supplies: 'office', payroll: 'wages', wages: 'wages', salaries: 'wages', salary: 'wages', meals: 'meals', food: 'meals', lunch: 'meals',
    travel: 'travel', flights: 'travel', hotels: 'travel', insurance: 'insurance', utilities: 'utilities', phone: 'utilities', internet: 'utilities',
    contractors: 'cogs_sub', freelancers: 'cogs_sub', subcontractors: 'cogs_sub', materials: 'cogs_materials', legal: 'legal', accountant: 'legal', cpa: 'legal',
    fees: 'bank', bank: 'bank', stripe: 'bank', interest: 'interest', benefits: 'benefits', health: 'benefits', taxes: 'payroll_tax', fuel: 'car', car: 'car', gas: 'car', equipment: 'equipment' };
  function findCategory(q) { for (const w of q.split(/[^a-z]+/)) if (SYN[w]) return SYN[w]; return null; }
  function findName(q, names) { const l = q.toLowerCase(); return names.filter(n => n && n.length > 2).sort((a, b) => b.length - a.length).find(n => l.includes(n.toLowerCase()) || l.includes(n.toLowerCase().split(/[\s/]/)[0])) || null; }
  const sumTx = f => Store.state.transactions.filter(t => !t.review && f(t)).reduce((a, t) => a + t.amount, 0);
  function when(r) { const m = { 'Year to date': 'so far this year', 'This month': 'this month', 'Last month': 'last month', 'This quarter': 'this quarter', 'Last 12 months': 'over the last 12 months', 'Last 30 days': 'in the last 30 days', 'All dates': 'in total' }; return m[r[2]] || (/^Last year/.test(r[2]) ? 'last year' : 'in ' + r[2]); }
  function hasData(from) { const first = Store.state.transactions.reduce((a, t) => t.date < a ? t.date : a, '9999'); return from >= first; }
  function prevRange([f, t, label]) {
    if (label === 'Year to date') return [`${+f.slice(0, 4) - 1}${f.slice(4)}`, `${+t.slice(0, 4) - 1}${t.slice(4)}`]; const a = new Date(f + 'T00:00:00'), b = new Date(t + 'T00:00:00'), len = b - a + 864e5; return [new Date(a - len).toISOString().slice(0, 10), new Date(a - 864e5).toISOString().slice(0, 10)]; }
  const change = (now, before, pr) => { if (!(before > 0) || (pr && !hasData(pr[0]))) return ''; const r = now / before; return r >= 3 ? ` That's ${r.toFixed(1)}x the previous period (${F(before)}).` : r <= 1 / 3 ? ` That's well below the previous period (${F(before)}).` : ` That's ${now >= before ? 'up' : 'down'} ${pct(Math.abs(now - before) / before)} on the previous period (${F(before)}).`; };

  /* ---------------- 1. Ask your books ---------------- */
  function localAnswer(qRaw) {
    const q = qRaw.toLowerCase(), s = Store.state, r = parsePeriod(q), pr = prevRange(r), within = rr => t => t.date >= rr[0] && t.date <= rr[1];
    const vendors = [...new Set(s.transactions.map(t => t.payee).filter(Boolean))], customers = Sales.customers().map(c => c.name);
    const cat = findCategory(q), vend = findName(q, vendors), cust = findName(q, customers);
    const a = () => Optimizer.analysis();
    if (/overdue|owe|owes|unpaid|receivable|outstanding|collect/.test(q)) {
      const od = s.invoices.filter(i => Ledger.invoiceStatus(i) === 'overdue'), open = Ledger.arOutstanding(s);
      return `Customers owe you <b>${F(open)}</b> across ${s.invoices.filter(i => i.status === 'sent').length} open invoices. ${od.length ? `${od.length} ${od.length > 1 ? 'are' : 'is'} overdue: ${od.map(i => `${Fmt.esc(i.client)} (${i.number}, ${F(Ledger.invTotal(i))}, due ${Fmt.date(i.due)})`).join('; ')}. A reminder from the invoice menu usually works within a week.` : 'Nothing is overdue right now.'}`;
    }
    if (/cash|bank balance|in the bank|runway/.test(q) && !/afford/.test(q)) {
      const m = Ledger.monthly(s, Ledger.monthsBack(4).slice(0, 3)); const burn = m.reduce((x, y) => x + y.cogs + y.expense + y.draws, 0) / 3;
      return `You have <b>${F(Ledger.cashBalance(s))}</b> in Business Checking. Average monthly outflow over the last three months was ${F(burn)}, so that covers about <b>${(Ledger.cashBalance(s) / Math.max(1, burn)).toFixed(1)} months</b> with no new income.`;
    }
    if (/afford|buy|purchase|hire/.test(q)) {
      const amt = +(q.match(/\$?\s?([\d,.]+)\s*(k|thousand)?/) || [])[1]?.replace(/,/g, '') * ((q.match(/\d\s*(k|thousand)\b/)) ? 1000 : 1) || 0;
      const m = Ledger.monthly(s, Ledger.monthsBack(4).slice(0, 3)); const burn = m.reduce((x, y) => x + y.cogs + y.expense + y.draws, 0) / 3;
      const cash = Ledger.cashBalance(s), after = cash - amt, months = after / Math.max(1, burn);
      if (!amt) return 'Tell me the amount, for example "Can I afford a $15k purchase?" or "Can I hire someone at $60k?"';
      const yearly = /hire|salary|a year|per year/.test(q);
      if (yearly) { const monthly = amt / 12 * 1.0765; const net3 = m.reduce((x, y) => x + y.net, 0) / 3;
        return `A ${F(amt)} salary costs about <b>${F(monthly)} a month</b> with employer payroll tax. Your average monthly profit is ${F(net3)}, so after the hire it would be about <b>${F(net3 - monthly)}</b>. ${net3 - monthly > 0 ? 'That is affordable on current numbers.' : 'That would put you below break-even; consider waiting or a part-time start.'} Hiring from a WOTC target group could earn up to $2,400 in credit.`; }
      return `Spending ${F(amt)} leaves <b>${F(after)}</b>, about ${months.toFixed(1)} months of outflow. ${months >= 3 ? 'That keeps a three-month cushion, so it looks affordable.' : 'That is under a three-month cushion, so it would be tight.'} If it is equipment, §179 or bonus depreciation can deduct it this year.`;
    }
    if (/tax|s.?corp|save|saving|deduct|write.?off|strateg/.test(q)) {
      const x = a(), top = x.strategies.filter(t => t.applies && t.savings > 0).slice(0, 3);
      if (/quarter|estimated|set aside/.test(q)) { const p = Projection.run(s); const t = Projection.taxOutlook(s, p); return `Set aside about <b>${F(t.quarterly)} a quarter</b> for taxes, based on ${F(p.next12.net)} of projected profit over the next 12 months as an ${Strategies.ENTITY_NAMES[t.analysis.bestE]}. Paying 100% of last year's tax (110% if AGI is over $150k) in four installments avoids penalties.`; }
      return `The tax plan finds <b>${F(x.totalSavings)} a year</b> in savings, mainly from: ${top.map(t => `${t.title.toLowerCase()} (${F(t.savings)})`).join(', ')}. The recommended structure is ${Strategies.ENTITY_NAMES[x.bestE]}. These are estimates, so confirm the bigger moves with a CPA.`;
    }
    if (/profit|net income|make money|margin/.test(q)) {
      const p = Ledger.pnl(s, r[0], r[1]), pp = Ledger.pnl(s, pr[0], pr[1]);
      return `Net profit ${when(r)} was <b>${F(p.net)}</b> on ${F(p.totalIncome)} of income, a ${p.totalIncome ? pct(p.net / p.totalIncome) : '0%'} margin.${change(p.net, pp.net, pr)}`;
    }
    if (/revenue|sales|income|earn|made|bring in|paid me|received/.test(q) || (cust && !/spen/.test(q))) {
      const f = t => CAT[t.category]?.type === 'income' && (!cust || t.payee === cust);
      const now = sumTx(t => f(t) && within(r)(t)), before = sumTx(t => f(t) && within(pr)(t));
      return `${cust ? `${Fmt.esc(cust)} paid you` : 'You took in'} <b>${F(now)}</b> ${when(r)}.${change(now, before, pr)}`;
    }
    if (/spen|spent|cost|expens|pay|paid|bill|biggest|most/.test(q) || cat || vend) {
      const isExp = t => ['cogs', 'expense', 'asset'].includes(CAT[t.category]?.type);
      if (/biggest|most|largest|top/.test(q) && !cat && !vend) {
        const p = Ledger.pnl(s, r[0], r[1]); const items = [...p.cogs, ...p.expense].sort((x, y) => y.amount - x.amount).slice(0, 4);
        return `Your biggest costs ${when(r)}: ${items.map(i => `${i.name} <b>${F(i.amount)}</b>`).join(', ')}.`;
      }
      const f = t => isExp(t) && (!cat || t.category === cat) && (!vend || t.payee === vend);
      const now = sumTx(t => f(t) && within(r)(t)), before = sumTx(t => f(t) && within(pr)(t));
      const n = s.transactions.filter(t => !t.review && f(t) && within(r)(t)).length;
      const what = vend ? Fmt.esc(vend) : cat ? CAT[cat].name.toLowerCase() : 'everything';
      return `You spent <b>${F(now)}</b> on ${what} ${when(r)} across ${n} transaction${n === 1 ? '' : 's'}.${change(now, before, pr)}${cat === 'meals' ? ' Remember only 50% of meals is deductible.' : ''}`;
    }
    return `I can answer questions about your books. Try: "How much did I spend on ads last quarter?", "Who owes me money?", "What was my profit in October?", "Can I afford a $20k truck?" or "How much should I set aside for taxes?"`;
  }
  async function ask(q) {
    const t = await claude('answer', `The owner asks: "${q}". Answer in 2–4 sentences using the context. Bold the key figure with <b></b>. Plain HTML only, no markdown.`);
    return { html: t || localAnswer(q), by: t ? 'Claude' : 'Built-in' };
  }

  /* ---------------- 2. Explain a strategy at three reading levels ---------------- */
  const PLAIN = {
    entity: ['Right now all your profit is treated as your wages, so you pay the 15.3% Social Security and Medicare tax on every dollar. An S corporation lets you pay yourself a fair salary and take the rest as profit that skips that tax.', 'It is like being both the employee and the owner: the employee part pays payroll tax, the owner part does not.'],
    salary: ['As an S corp, you choose how much to pay yourself as salary. Too low invites IRS trouble; too high wastes payroll tax. The engine picked the level that costs the least while staying reasonable for your job.', 'Think of it as setting a fair wage you could defend if you hired someone to do your role.'],
    retire: ['Money you put into a Solo 401(k) comes off your taxable income this year and grows tax-free until retirement. You are paying yourself first and the IRS later.', 'It is a savings account the tax code pays you to use.'],
    db: ['A cash-balance plan is a pension for your own business. It allows far larger tax-deductible contributions than a 401(k), especially as you get older, but you commit to funding it every year.', 'It is a 401(k) with a much bigger bucket and a stricter schedule.'],
    hsa: ['If your health plan qualifies, an HSA lets you save for medical costs with money that is never taxed going in, while it grows, or when you spend it on care.', 'It is the only account that is tax-free three times.'],
    equipment: ['Instead of deducting a new computer or machine a bit each year for five to seven years, you can deduct the whole cost this year. You save tax now; later years have smaller deductions.', 'You are pulling a future deduction into today.'],
    vehicle: ['Trucks and large SUVs over 6,000 lb used mostly for business can be written off in the first year. Keep a mileage log to prove business use.', 'A work truck is treated like equipment, not a personal car.'],
    mileage: ['Every business mile you drive in your own car is worth 72.5 cents (76 cents from July 1, 2026) as a deduction. A corporation can reimburse you tax-free instead.', 'Your car is doing business work; the business should pay for it.'],
    homeOffice: ['If part of your home is used only for work, the business can deduct a share of your housing costs. The simple version is $5 per square foot up to 300 sq ft.', 'You are renting yourself an office you already have.'],
    augusta: ['You can rent your home to your own company for up to 14 days a year, for real meetings at a fair price. The company deducts the rent and you pay no tax on it.', 'A legal quirk named after golf-week rentals in Augusta, Georgia.'],
    kids: ['Paying your children a fair wage for real work moves income from your tax bracket to theirs, where the first $16,100 is tax-free. In a parent-owned sole proprietorship it also skips payroll tax.', 'Family income gets taxed at the kid rate instead of yours.'],
    qbi: ['Owners of pass-through businesses can deduct up to 20% of their business profit. At higher incomes, limits kick in, especially for service businesses like law or consulting.', 'A built-in discount on business profit, with fine print at high incomes.'],
    ptet: ['Your state lets the business pay state income tax for you. The business deducts it in full, which gets around the federal $40,400 cap on deducting state taxes.', 'The same tax, paid by a different pocket that the IRS treats better.'],
    rd: ['If you build new products, software or processes, part of the wages and supplies count as research. The credit cuts your tax bill dollar for dollar.', 'A reward for experimenting, even for small companies.'],
    wotc: ['Hiring someone from certain groups, like veterans or people on SNAP, can earn up to $2,400 off your taxes. You must file a form within 28 days of their start date.', 'The government pays part of the hire.'],
    health45r: ['Small employers that pay at least half of employee health premiums through the SHOP marketplace can get up to half of that back as a credit for two years.', 'Covering your team earns a rebate.'],
    startup45e: ['Starting a 401(k) for your employees earns credits that can cover setup costs and part of your contributions for the first years.', 'The IRS helps pay for the plan you set up.'],
    childcare45f: ['If you help employees pay for childcare, the business can get up to half of that cost back as a credit.', 'A perk for your team that pays for itself.'],
    qsbs: ['If you own C-corp stock for five years and then sell the company, up to $15 million of gain can be tax-free.', 'A long-term reward for building a company to sell.'],
  };
  function localExplain(st, level) {
    const txt = (st.details || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const worth = st.savings > 0 ? (st.type === 'timing' ? `It shifts about ${F(st.savings)} of tax to later years.` : st.type === 'future' ? `It could save about ${F(st.savings)} when you sell.` : `For you it is worth about ${F(st.savings)} a year.`) : '';
    if (level === 'plain') { const [p, an] = PLAIN[st.id] || [st.summary, '']; return `<p>${p}</p>${an ? `<p class="muted"><i>${an}</i></p>` : ''}<p><b>${worth}</b> First step: ${(st.steps[0] || 'talk it through with your CPA').replace(/\.$/, '')}.</p>`; }
    if (level === 'owner') return `<p>${st.summary}</p><p><b>What to do this month:</b></p><ol>${st.steps.slice(0, 3).map(x => `<li>${x}</li>`).join('')}</ol><p>${worth} Audit risk: ${st.risk.toLowerCase()}.</p>`;
    return `<p><b>${st.code}.</b> ${txt}</p><p>Forms and mechanics: ${st.steps.join(' ')}</p><p class="muted">Computed by re-running the full return under the recommended entity; savings ${F(st.savings)} (${st.type}).</p>`;
  }
  async function explain(st, level) {
    const t = await claude('explain', `Explain the strategy "${st.title}" (${st.code}) to ${level === 'plain' ? 'someone with no tax knowledge, using one everyday analogy, max 90 words' : level === 'owner' ? 'a busy owner, with the three concrete steps to take this month, max 120 words' : 'a CPA, with code references, mechanics, limits and filing forms, max 150 words'}. The engine estimated ${st.savings} dollars of savings. Facts: ${st.summary} ${(st.details || '').replace(/<[^>]+>/g, ' ')}. Return simple HTML (<p>, <ol>, <b>).`);
    return { html: t || localExplain(st, level), by: t ? 'Claude' : 'Built-in' };
  }

  /* ---------------- 3. Categorise bank lines from your own history ---------------- */
  function suggest(t) {
    if (!t.dir) t.dir = isInflow(t.category) ? 'in' : 'out';
    const sameDir = c => (isInflow(c) ? 'in' : 'out') === t.dir;
    const hist = Store.state.transactions.filter(x => !x.review && sameDir(x.category));
    const STOP = ['the', 'and', 'for', 'com', 'www', 'inc', 'llc', 'pos', 'debit', 'card', 'purchase', 'office', 'payment', 'payments', 'client', 'online', 'monthly', 'services', 'various', 'us'];
    const toks = s => (s || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.includes(w));
    const mineList = toks(t.desc + ' ' + t.payee), mine = new Set(mineList), lead = mineList[0];
    const votes = {}; let best = null;
    for (const h of hist) {
      const ht = toks(h.desc + ' ' + h.payee); const hit = ht.reduce((a, w) => a + (mine.has(w) ? (w === lead ? 3 : 1) : 0), 0);
      if (hit) { votes[h.category] = (votes[h.category] || 0) + hit; if (!best || hit > best.hit) best = { hit, h }; }
    }
    const tot = Object.values(votes).reduce((a, b) => a + b, 0);
    if (tot && best.hit >= 2) {
      const [c, v] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      const n = hist.filter(h => h.category === c && toks(h.desc + ' ' + h.payee).some(w => mine.has(w))).length;
      return { category: c, conf: Math.min(.97, .45 + .45 * v / tot + Math.min(.12, n * .015)), why: `Matches ${n} past transaction${n > 1 ? 's' : ''} like "${best.h.desc.slice(0, 30)}"` };
    }
    let g = Banking.guess(t.desc, t.dir === 'in' ? 1 : -1);
    if (!sameDir(g)) g = t.dir === 'in' ? 'services' : 'other_exp';
    const known = !['other_exp', 'services'].includes(g) || /payout|deposit|transfer/i.test(t.desc);
    return { category: g, conf: known ? .66 : .3, why: known ? 'Recognised the merchant name' : 'No match in your history, please check' };
  }

  /* ---------------- 4. Margin notes for reports ---------------- */
  function marginNotes(kind, r) {
    const s = Store.state, notes = {};
    if (kind === 'pl' || kind === 'expcat' || kind === 'schc') {
      const p = Ledger.pnl(s, r[0], r[1]), pr = prevRange(r), comparable = hasData(pr[0]), pp = Ledger.pnl(s, pr[0], pr[1]);
      const prev = id => [...pp.income, ...pp.cogs, ...pp.expense].find(x => x.id === id)?.amount || 0;
      if (comparable) [...p.income, ...p.cogs, ...p.expense].map(x => ({ x, b: prev(x.id) })).filter(o => o.b > 500 && Math.abs(o.x.amount - o.b) > 1000 && Math.abs((o.x.amount - o.b) / o.b) > .2)
        .sort((a, b) => Math.abs(b.x.amount - b.b) - Math.abs(a.x.amount - a.b)).slice(0, 4)
        .forEach(({ x, b }) => { const d = x.amount - b; notes[x.name] = `${d > 0 ? 'Up' : 'Down'} ${pct(Math.abs(d / b))} vs. prior period`; });
      [...p.income, ...p.cogs, ...p.expense].forEach(x => {
        if (x.id === 'meals') notes[x.name] = `Only ${F(x.amount / 2)} deductible`;
        
      });
      const big = [...p.expense].sort((a, b) => b.amount - a.amount)[0];
      if (big) notes[big.name] = `Largest expense, ${pct(big.amount / Math.max(1, p.totalIncome))} of revenue` + (notes[big.name] ? `. ${notes[big.name]}` : '');
      const sub = p.cogs.find(x => x.id === 'cogs_sub'); if (sub && sub.amount > 600) notes[sub.name] = notes[sub.name] || 'Contractors: collect W-9s, file 1099-NEC by Jan 31';
      if (p.totalIncome) notes['NET INCOME'] = `${pct(p.net / p.totalIncome)} margin${comparable && pp.totalIncome ? `, was ${pct(pp.net / pp.totalIncome)}` : ''}`;
      if (p.gross && p.totalIncome) notes['GROSS PROFIT'] = `${pct(p.gross / p.totalIncome)} gross margin`;
    }
    if (kind === 'bs') {
      const b = Ledger.balanceSheet(s), m = Ledger.monthly(s, Ledger.monthsBack(4).slice(0, 3)), burn = m.reduce((x, y) => x + y.cogs + y.expense, 0) / 3;
      notes['Business Checking'] = `${(b.cash / Math.max(1, burn)).toFixed(1)} months of costs`;
      if (b.ar) notes['Accounts Receivable (A/R)'] = `${pct(b.ar / b.assets)} of assets; chase overdue`;
      notes['Business Loan Payable'] = `Debt-to-equity ${(b.liabilities / Math.max(1, b.equity)).toFixed(2)}`;
    }
    return notes;
  }

  /* ---------------- 5. What-if sentences for the forecast ---------------- */
  function parseWhatIf(text, startMonth) {
    const out = [], q = text.toLowerCase();
    const monthOffset = str => {
      if (!str) return 1;
      const n = str.match(/(\d+)\s*months?/); if (n) return Math.max(1, +n[1]);
      const mi = MONTHS.findIndex(m => str.includes(m.slice(0, 3)));
      if (mi < 0) return 1;
      const s = new Date(startMonth + '-01T00:00:00'); let off = mi - s.getMonth(); if (off <= 0) off += 12; return off;
    };
    const money = (n, k) => +n.replace(/,/g, '') * (k ? 1000 : 1);
    q.split(/,|;| and (?=hire|buy|purchase|grow|increase|cut|reduce|raise)/).forEach(part => {
      let m;
      if ((m = part.match(/hire\s+(?:an?\s+|\d+\s+)?([a-z ]*?)\s*(?:at|for|on|paid)\s*\$?([\d,.]+)\s*(k)?(?:.*?(?:in|from|starting|by)\s+([a-z]+|\d+\s*months?))?/)))
        out.push({ type: 'hire', role: (m[1] || 'new hire').trim() || 'new hire', salary: money(m[2], m[3]), month: monthOffset(m[4]) });
      else if ((m = part.match(/(?:buy|purchase|spend|get)\s+(?:an?\s+)?([a-z ]*?)\s*(?:for|at|of|costing)?\s*\$?([\d,.]+)\s*(k)?(?:.*?(?:in|on|by)\s+([a-z]+|\d+\s*months?))?/)))
        out.push({ type: 'capex', desc: (m[1] || 'purchase').trim() || 'purchase', amount: money(m[2], m[3]), month: monthOffset(m[4]) });
      else if ((m = part.match(/(?:grow|increase|raise)\s+(?:revenue|sales)\s+(?:by\s+)?([\d.]+)\s*%/)))
        out.push({ type: 'growth', value: +m[1] });
      else if ((m = part.match(/(?:cut|reduce|lower)\s+(?:costs?|expenses?|spending)\s+(?:by\s+)?([\d.]+)\s*%/)))
        out.push({ type: 'cut', value: +m[1] });
    });
    return out;
  }

  /* ---------------- 6. Payment reminder drafts ---------------- */
  function localReminder(inv, tone) {
    const co = Store.state.company.name, amt = Fmt.money(Ledger.invTotal(inv), 2), days = Math.max(0, Math.round((new Date() - new Date(inv.due + 'T00:00:00')) / 864e5));
    const first = inv.client.split(/\s+/)[0];
    if (tone === 0) return `Subject: Quick reminder: ${inv.number}\n\nHi ${first} team,\n\nHope things are going well. A friendly note that invoice ${inv.number} for ${amt} ${days ? `was due on ${Fmt.date(inv.due)}` : `is due ${Fmt.date(inv.due)}`}. If it's already on its way, thank you and please ignore this.\n\nHappy to resend the invoice or answer any questions.\n\nThanks,\n${co}`;
    if (tone === 1) return `Subject: Invoice ${inv.number} is ${days} days past due\n\nHello,\n\nOur records show invoice ${inv.number} for ${amt}, due ${Fmt.date(inv.due)}, is still unpaid. Please send payment or let us know the expected payment date.\n\nThe invoice is attached for reference.\n\nRegards,\n${co}`;
    return `Subject: Final notice: ${inv.number} (${amt}) overdue\n\nHello,\n\nInvoice ${inv.number} for ${amt} is now ${days} days past its ${Fmt.date(inv.due)} due date, and we haven't received a reply to earlier reminders. Please arrange payment within 7 days.\n\nIf payment isn't received by then, we will pause further work and may apply late fees under our terms.\n\n${co}`;
  }
  async function reminder(inv, tone) {
    const t = await claude('reminder', `Write a ${['friendly', 'neutral, businesslike', 'firm final-notice'][tone]} payment reminder email for invoice ${inv.number} to ${inv.client}, amount ${Ledger.invTotal(inv)}, due ${inv.due}, today ${today()}, from ${Store.state.company.name}. Start with "Subject:". Plain text, under 120 words.`);
    return { text: t || localReminder(inv, tone), by: t ? 'Claude' : 'Built-in' };
  }

  /* ---------------- 7. Morning briefing ---------------- */
  function localBriefing() {
    const s = Store.state, out = [];
    const cm = Ledger.range('month'), lm = Ledger.range('lastmonth');
    const p = Ledger.pnl(s, lm[0], lm[1]), pp = Ledger.pnl(s, ...prevRange([lm[0], lm[1]]));
    if (p.totalIncome) out.push(`Last month you earned ${F(p.totalIncome)} and kept ${F(p.net)} (${pct(p.net / Math.max(1, p.totalIncome))}).${pp.totalIncome ? ` Income was ${p.totalIncome >= pp.totalIncome ? 'up' : 'down'} ${pct(Math.abs(p.totalIncome - pp.totalIncome) / pp.totalIncome)} on the month before.` : ''}`);
    const items = [...p.cogs, ...p.expense], prevItems = [...pp.cogs, ...pp.expense];
    const jumps = items.map(x => ({ x, b: prevItems.find(y => y.id === x.id)?.amount || 0 })).filter(o => o.b > 300 && o.x.amount - o.b > 800).sort((a, b) => (b.x.amount - b.b) - (a.x.amount - a.b));
    if (jumps[0]) out.push(`${jumps[0].x.name} jumped to ${F(jumps[0].x.amount)} from ${F(jumps[0].b)}. Worth a look.`);
    const od = s.invoices.filter(i => Ledger.invoiceStatus(i) === 'overdue');
    if (od.length) out.push(`${od[0].client} owes ${F(Ledger.invTotal(od[0]))} on ${od[0].number}, ${Math.round((new Date() - new Date(od[0].due + 'T00:00:00')) / 864e5)} days late. A reminder draft is one click away.`);
    const rv = s.transactions.filter(t => t.review).length;
    if (rv) out.push(`${rv} bank transactions are waiting for a category. Suggested categories are ready in Banking.`);
    const a = Optimizer.analysis(), top = a.strategies.find(x => x.applies && x.savings > 0 && x.id !== 'entity');
    const dLeft = Math.ceil((new Date(new Date().getFullYear(), 11, 31) - new Date()) / 864e5);
    if (top) out.push(`${dLeft} days left in the tax year. The biggest open item is "${top.title.toLowerCase()}", worth about ${F(top.savings)}.`);
    if (!s.transactions.length) out.push('Your books are empty. Upload a bank CSV and the briefing will start reading them.');
    return out.slice(0, 4);
  }
  async function briefing() {
    const t = await claude('briefing', 'Write a morning briefing for the owner: exactly 3 or 4 short bullet sentences, each on its own line starting with "- ". Cover the most useful changes, risks and one tax action with a deadline. No headings.');
    const lines = t ? t.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).slice(0, 4) : localBriefing();
    return { lines, by: t ? 'Claude' : 'Built-in' };
  }

  /* ---------------- typing effect ---------------- */
  function type(el, html, speed = 9) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.innerHTML = html; return Promise.resolve(); }
    return new Promise(res => {
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const text = tmp.textContent; let i = 0;
      el.classList.add('typing'); el.textContent = '';
      const step = () => { i += Math.max(1, Math.round(text.length / 120)); el.textContent = text.slice(0, i); if (i < text.length) setTimeout(step, speed); else { el.innerHTML = html; el.classList.remove('typing'); res(); } };
      step();
    });
  }

  return { ask, explain, suggest, marginNotes, parseWhatIf, reminder, briefing, type, engine, context, localAnswer };
})();

/* =========================================================================
   Assistant panel: "Ask your books"
   ========================================================================= */
const Assistant = (() => {
  const log = [];
  const CHIPS = ['How much did I spend on ads last quarter?', 'Who owes me money?', 'What was my profit last month?', 'Can I afford a $20k truck?', 'How much should I set aside for taxes?', 'What are my biggest costs this year?'];
  function open(q) {
    App.drawer(`${I('spark')} Ask your books`, `<div class="ai-log" id="ai-log">${log.length ? log.map(render).join('') : intro()}</div>`,
      `<form id="ai-f" class="ai-input"><input id="ai-q" placeholder="Ask about spending, income, customers, cash or taxes" autocomplete="off"/><button class="btn primary">Ask</button></form>`, d => {
        d.classList.add('ai-drawer');
        $('#ai-f', d).onsubmit = e => { e.preventDefault(); send($('#ai-q', d).value); };
        setTimeout(() => $('#ai-q', d).focus(), 80);
        if (q) send(q);
      });
  }
  const intro = () => `<div class="ai-intro"><p>Ask a question in your own words. Answers come from your books and tax plan, calculated live.</p>
    <div class="ai-chips">${CHIPS.map(c => `<button type="button" onclick="Assistant.send(this.textContent)">${c}</button>`).join('')}</div></div>`;
  const render = m => m.role === 'u' ? `<div class="ai-msg u">${Fmt.esc(m.text)}</div>` : `<div class="ai-msg a"><div class="ai-body">${m.html}</div><div class="ai-by">${m.by}</div></div>`;
  async function send(q) {
    q = (q || '').trim(); if (!q) return;
    const L = $('#ai-log'); if (!L) return open(q);
    if (!log.length) L.innerHTML = '';
    log.push({ role: 'u', text: q }); L.insertAdjacentHTML('beforeend', render(log[log.length - 1]));
    $('#ai-q').value = '';
    L.insertAdjacentHTML('beforeend', `<div class="ai-msg a pending"><div class="ai-body"><span class="ai-dots"><i></i><i></i><i></i></span></div></div>`);
    L.scrollTop = L.scrollHeight;
    const r = await AI.ask(q);
    const p = $('.ai-msg.pending', L); p.classList.remove('pending');
    p.insertAdjacentHTML('beforeend', `<div class="ai-by">${r.by}</div>`);
    log.push({ role: 'a', html: r.html, by: r.by });
    await AI.type($('.ai-body', p), r.html);
    L.scrollTop = L.scrollHeight;
  }
  return { open, send };
})();
