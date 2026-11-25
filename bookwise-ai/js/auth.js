/* =========================================================================
   Bookwise — accounts & sessions
   ------------------------------------------------------------------------
   This build stores accounts in the visitor's browser (localStorage) with
   PBKDF2-hashed passwords, so the site runs on Netlify with zero backend.
   For a production launch with real users across devices, replace the
   functions in this file with Supabase / Firebase / Auth0 calls — the rest
   of the app only uses Auth.current(), Auth.login(), Auth.signup(),
   Auth.logout(), Auth.update() and Auth.changePassword().
   ========================================================================= */
const Auth = (() => {
  const UK = 'bookwise.users', SK = 'bookwise.session';
  const DEMO = { email: 'demo@bookwise.ai', password: 'Demo1234!', name: 'Alex Rivera', company: 'Bluebird Creative Co.' };
  const enc = s => new TextEncoder().encode(s);

  const users = () => { try { return JSON.parse(localStorage.getItem(UK)) || []; } catch { return []; } };
  const saveUsers = u => localStorage.setItem(UK, JSON.stringify(u));
  const norm = e => String(e || '').trim().toLowerCase();
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

  async function hash(pw, salt) {
    if (window.crypto && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
      return 'p2$' + Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for non-secure contexts (e.g. some file:// setups) — not for production
    let h = 2166136261; for (const c of salt + pw) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return 'fb$' + (h >>> 0).toString(16);
  }

  function passwordProblems(pw) {
    const p = [];
    if (pw.length < 8) p.push('at least 8 characters');
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) p.push('a letter and a number');
    return p;
  }

  async function ensureDemo() {
    const list = users();
    if (list.some(u => u.id === 'demo')) return;
    const salt = rid();
    list.push({ id: 'demo', email: DEMO.email, name: DEMO.name, company: DEMO.company, plan: 'pro', isDemo: true,
      salt, pass: await hash(DEMO.password, salt), created: new Date().toISOString() });
    saveUsers(list);
  }

  function startSession(id, remember) {
    const s = JSON.stringify({ id, at: Date.now() });
    (remember ? localStorage : sessionStorage).setItem(SK, s);
    (remember ? sessionStorage : localStorage).removeItem(SK);
  }

  async function signup({ name, email, password, company, plan }) {
    email = norm(email);
    if (!name || !name.trim()) throw new Error('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    const prob = passwordProblems(password); if (prob.length) throw new Error('Password needs ' + prob.join(' and ') + '.');
    const list = users();
    if (list.some(u => u.email === email)) throw new Error('An account with that email already exists — try logging in.');
    const salt = rid();
    const u = { id: rid(), email, name: name.trim(), company: (company || '').trim(), plan: plan || 'starter', salt, pass: await hash(password, salt), created: new Date().toISOString() };
    list.push(u); saveUsers(list); startSession(u.id, true);
    return publicUser(u);
  }

  async function login(email, password, remember = true) {
    await ensureDemo();
    const u = users().find(x => x.email === norm(email));
    if (!u || (await hash(password, u.salt)) !== u.pass) throw new Error('That email and password don\'t match.');
    startSession(u.id, remember);
    return publicUser(u);
  }
  async function loginDemo() { return login(DEMO.email, DEMO.password, false); }

  function current() {
    let s; try { s = JSON.parse(sessionStorage.getItem(SK) || localStorage.getItem(SK)); } catch { s = null; }
    if (!s) return null;
    const u = users().find(x => x.id === s.id);
    return u ? publicUser(u) : null;
  }
  const publicUser = u => ({ id: u.id, email: u.email, name: u.name, company: u.company, plan: u.plan, isDemo: !!u.isDemo, created: u.created });

  function logout() { localStorage.removeItem(SK); sessionStorage.removeItem(SK); }

  function update(id, fields) {
    const list = users(), u = list.find(x => x.id === id); if (!u) return;
    if (fields.email) {
      const e = norm(fields.email);
      if (list.some(x => x.email === e && x.id !== id)) throw new Error('That email is already used by another account.');
      fields.email = e;
    }
    Object.assign(u, fields); saveUsers(list); return publicUser(u);
  }
  async function changePassword(id, oldPw, newPw) {
    const list = users(), u = list.find(x => x.id === id);
    if ((await hash(oldPw, u.salt)) !== u.pass) throw new Error('Current password is incorrect.');
    const prob = passwordProblems(newPw); if (prob.length) throw new Error('New password needs ' + prob.join(' and ') + '.');
    u.salt = rid(); u.pass = await hash(newPw, u.salt); saveUsers(list);
  }
  function deleteAccount(id) {
    saveUsers(users().filter(u => u.id !== id));
    localStorage.removeItem('bookwise.data.' + id); logout();
  }

  /** Call at the top of app.html — bounces signed-out visitors to the login page */
  function require() {
    const u = current();
    if (!u) { document.documentElement.style.visibility = 'hidden'; location.replace('login.html?next=' + encodeURIComponent(location.hash || '')); return null; }
    return u;
  }

  return { signup, login, loginDemo, logout, current, update, changePassword, deleteAccount, require, ensureDemo, passwordProblems, DEMO };
})();
