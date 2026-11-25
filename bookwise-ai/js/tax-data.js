/* =========================================================================
   Bookwise — 2026 U.S. federal tax constants
   Sources: IRS Rev. Proc. 2025-32 (IR-2025-103), IRS Notice 2025-67 /
   IR-2025-111 (retirement limits), SSA 2026 COLA, Notice 2026-10 and
   Announcement 2026-11 (mileage), One Big Beautiful Bill Act (P.L. 119-21).
   Update this one file each year — the whole engine reads from it.
   ========================================================================= */
const TAX = {
  year: 2026,

  // Ordinary income brackets: [upper bound of bracket, rate]
  brackets: {
    single: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]],
    mfj:    [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [Infinity, .37]],
  },
  stdDeduction: { single: 16100, mfj: 32200 },

  // Qualified dividends / LTCG brackets
  ltcg: {
    single: [[49450, 0], [545500, .15], [Infinity, .20]],
    mfj:    [[98900, 0], [613700, .15], [Infinity, .20]],
  },

  // Payroll / self-employment
  ssWageBase: 184500,
  ssRate: 0.124,            // combined employer+employee
  medicareRate: 0.029,      // combined
  addlMedicareRate: 0.009,
  addlMedicareThreshold: { single: 200000, mfj: 250000 },
  niitRate: 0.038,
  niitThreshold: { single: 200000, mfj: 250000 },
  seFactor: 0.9235,
  futa: 42,                 // $7,000 x 0.6% after state credit, per employee

  corpRate: 0.21,

  // Section 199A Qualified Business Income (made permanent by OBBBA)
  qbi: {
    rate: 0.20,
    threshold: { single: 201750, mfj: 403500 },
    range: { single: 75000, mfj: 150000 },   // OBBBA widened phase-in ranges
    minDeduction: 400, minQbi: 1000,
  },

  sec179: { limit: 2560000, phaseout: 4090000 },
  bonusDepreciation: 1.00,  // 100% permanent for property acquired after Jan 19, 2025

  retirement: {
    deferral: 24500, catchup50: 8000, catchup6063: 11250,
    dcLimit: 72000, compLimit: 360000, sepRate: 0.25,
  },
  hsa: { self: 4400, family: 8750, catchup55: 1000 },
  ira: 7500,

  salt: { cap: 40400, phaseStart: 505000, floor: 10000 },

  homeOffice: { rate: 5, maxSqft: 300 },
  // 72.5¢ Jan–Jun, 76¢ Jul–Dec 2026 (Announcement 2026-11). Blended for full-year estimates.
  mileage: { h1: 0.725, h2: 0.76, blended: 0.7425 },

  credits: {
    wotcMax: 2400,
    startupCreditMax: 5000, autoEnrollCredit: 500, employerContribPerEmployee: 1000,
    sec45rMaxRate: 0.50, sec45rWageLimit: 66600, sec45rFteLimit: 25,
    childcareRateSmall: 0.50, childcareMaxSmall: 600000,
    rdAscRate: 0.14, rdAscStartupRate: 0.06, rdPayrollOffsetMax: 500000,
  },

  qsbs: { cap: 15000000, assetLimit: 75000000 },
  deMinimis: 2500,
  startupCostDeduction: 5000,
};

/* Industries — `sstb` = Specified Service Trade or Business under §199A(d)(2) */
const INDUSTRIES = [
  { id: 'agency',      name: 'Marketing / design agency',          sstb: false, salaryPct: .40 },
  { id: 'software',    name: 'Software / SaaS / tech',              sstb: false, salaryPct: .45 },
  { id: 'retail',      name: 'Retail / e-commerce',                 sstb: false, salaryPct: .35 },
  { id: 'restaurant',  name: 'Restaurant / food service',           sstb: false, salaryPct: .35 },
  { id: 'construction',name: 'Construction / trades',               sstb: false, salaryPct: .45 },
  { id: 'manufacturing',name:'Manufacturing',                       sstb: false, salaryPct: .40 },
  { id: 'realestate',  name: 'Real estate services',                sstb: false, salaryPct: .35 },
  { id: 'transport',   name: 'Trucking / logistics',                sstb: false, salaryPct: .40 },
  { id: 'consulting',  name: 'Consulting (SSTB)',                   sstb: true,  salaryPct: .50 },
  { id: 'health',      name: 'Health / medical practice (SSTB)',    sstb: true,  salaryPct: .55 },
  { id: 'law',         name: 'Law firm (SSTB)',                     sstb: true,  salaryPct: .55 },
  { id: 'accounting',  name: 'Accounting / tax prep (SSTB)',        sstb: true,  salaryPct: .50 },
  { id: 'finance',     name: 'Financial services / advisory (SSTB)',sstb: true,  salaryPct: .50 },
  { id: 'arts',        name: 'Performing arts / athletics (SSTB)',  sstb: true,  salaryPct: .50 },
  { id: 'other',       name: 'Other',                               sstb: false, salaryPct: .40 },
];

const US_STATES = [
  ['None (TX, FL, WA, NV, TN, SD, WY, AK, NH)', 0], ['Arizona', 2.5], ['California', 9.3], ['Colorado', 4.4],
  ['Georgia', 5.19], ['Illinois', 4.95], ['Indiana', 2.95], ['Massachusetts', 5.0], ['Michigan', 4.25],
  ['New Jersey', 6.37], ['New York', 6.85], ['North Carolina', 3.99], ['Ohio', 2.75], ['Oregon', 8.75],
  ['Pennsylvania', 3.07], ['Utah', 4.5], ['Virginia', 5.75], ['Other — enter rate', null],
];
