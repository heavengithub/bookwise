# Bookwise AI: small-business accounting with a tax engine built in

A complete static website you can deploy to Netlify in one drag-and-drop:

| Page | What it is |
|---|---|
| `index.html` | Marketing homepage: hero, features, tax-engine section, live S-corp savings estimator, pricing (monthly/yearly), FAQ, contact form (Netlify Forms) |
| `signup.html` | Create an account (name, business, email, password strength meter, plan, terms) |
| `login.html` | Log in, "keep me logged in", one-click **demo account** |
| `app.html` | The product (requires login): onboarding wizard, dashboard, tax optimizer, tax law library, transactions, invoices, reports, projections, account & security, data settings |
| `privacy.html`, `terms.html`, `404.html` | Legal templates + not-found page |

## Demo account
- **Email:** demo@bookwise.ai
- **Password:** Demo1234!

Pre-loaded with a sample marketing agency (12 months of transactions and invoices). Or click "Try the live demo" anywhere.

## New-account flow
Sign up → 5-step setup wizard (business, numbers, household, plans this year) → instant savings estimate → app. New accounts start with empty books; the tax optimizer and projections run from the wizard answers until transactions are recorded (Tax Optimizer → Business profile → "Pull financials from my books").

## Brand
| File | Use |
|---|---|
| `assets/logo-mark.svg`, `favicon.svg` | App icon / favicon (ledger book with spark) |
| `assets/logo.png` | Full wordmark on light backgrounds |
| `assets/logo-on-dark.png` | Wordmark on ink navy |
| `assets/apple-touch-icon.png` | iPhone home-screen icon |
| `assets/og-image.png` | Social share preview (1200×630) |

Colors: ink navy `#1c2b4a`, ledger green `#2f7d4f`, green-bar band `#e6efe2`, highlighter `#fbe36b`, ledger red `#b42318`. Type: Public Sans, IBM Plex Mono for figures.

## AI features
- **Ask your books** (top bar, or Ctrl/⌘ K): questions in plain English, answered from the ledger.
- **Morning briefing** on Home: 3–4 sentences on what changed and what to do.
- **Explain this** on every tax strategy: plain English, owner to-do list, or CPA detail.
- **Suggest categories** in Banking: matches imported bank lines to your own history, with a confidence score and reason.
- **Margin notes** on Profit and Loss, Balance Sheet, Expenses by Category and Schedule C.
- **Forecast in a sentence** on Cash flow & forecast ("hire a designer at $65k in March, buy equipment for $12k in June").
- **Reminder emails** from any open invoice, with a friendly / neutral / firm tone switch.

Every feature runs on a built-in engine in the browser. To have Claude write them instead:
1. Deploy from Git or the Netlify CLI (`netlify deploy --prod`). Netlify Drop (drag and drop) does **not** deploy functions.
2. In Netlify: Site configuration → Environment variables → add `ANTHROPIC_API_KEY` (optional `AI_MODEL`, default `claude-sonnet-5-5`).
The function lives in `netlify/functions/ai.mjs` and sends only a summary of the books (monthly totals, categories, top customers/vendors, tax plan).

## 3D
three.js scenes (`js/three-scenes.js`, vendored `js/vendor/three.module.min.js`): the fan-folded printout on the homepage, the 3D tax terrain (Tax optimizer → 3D tax terrain) and the 3D cash-flow city on Home. They pause off screen, show a still frame for reduced-motion users, and fall back to 2D when WebGL is off. ES modules need http(s), so preview locally with `python3 -m http.server`, not by opening the file.

## Deploy
1. Unzip.
2. Drag the `bookwise-ai` folder onto https://app.netlify.com/drop.
3. Optional: in Netlify → Forms, turn on email notifications for the "contact" form.

`netlify.toml` sets security headers and pretty URLs (`/login`, `/signup`, `/app`).

## Important: how accounts work in this build
Accounts, passwords (PBKDF2-hashed) and books are stored in each visitor's **own browser** (localStorage). That makes the site fully functional with zero backend — perfect for demos, testing and pitching — but it means:
- data doesn't sync across devices or browsers (Settings → Download/Restore backup moves it),
- there's no email password reset,
- it isn't server-side security.

**Before taking real customers**, swap `js/auth.js` and the `Store.load/save` functions in `js/store.js` for a hosted backend such as **Supabase** (auth + Postgres, free tier) or Firebase. The rest of the app only calls `Auth.current/login/signup/logout/update/changePassword`, so the swap is contained. Add Stripe Checkout for paid plans (plan selection is already wired in Account & security).

## Code map
| File | Purpose |
|---|---|
| `js/tax-data.js` | All 2026 tax constants — update yearly |
| `js/tax-engine.js` | LLC / S-corp / C-corp tax calculations |
| `js/strategies.js` | 20+ strategy optimizer with explanations |
| `js/auth.js` | Accounts & sessions |
| `js/store.js` | Per-account data, chart of accounts, sample company |
| `js/ledger.js`, `js/projection.js` | Accounting math, forecasting |
| `js/app.js` | App shell: top bar, search, + New menu, nav, drawers, full-screen forms, DataTable |
| `js/ui-dashboard.js` | Home widgets |
| `js/ui-banking.js` | Bank register, For-review queue, CSV import |
| `js/ui-sales.js` | Invoices, receive payment, customers |
| `js/ui-expenses.js` | Expenses (multi-line form), vendors |
| `js/ui-reports.js` | Reports center (11 reports), chart of accounts |
| `js/ui-tax.js`, `js/ui-projections.js`, `js/ui-onboarding.js`, `js/ui-misc.js` | Tax optimizer, forecast, setup wizard/account, library/settings |
| `js/site.js`, `css/site.css` | Marketing site & auth pages |
| `assets/` | Product screenshots used on the homepage |

Tax results are educational estimates (2026 federal law incl. the One Big Beautiful Bill Act, flat state rate, standard deduction) — not tax advice.
