import * as Dashboard from './pages/dashboard.js';
import * as Orders from './pages/orders.js';
import * as Products from './pages/products.js';
import * as Customers from './pages/customers.js';
import * as Cash from './pages/cash.js';
import * as Expenses from './pages/expenses.js';
import * as Reports from './pages/reports.js';
import * as Settings from './pages/settings.js';
import { api } from './api.js';

const routes = [
  { pattern: /^\/$/, page: Dashboard },
  { pattern: /^\/orders\/(\d+)$/, page: Orders, param: 'id' },
  { pattern: /^\/orders$/, page: Orders },
  { pattern: /^\/products\/(\d+)$/, page: Products, param: 'id' },
  { pattern: /^\/products$/, page: Products },
  { pattern: /^\/customers\/(\d+)$/, page: Customers, param: 'id' },
  { pattern: /^\/customers$/, page: Customers },
  { pattern: /^\/cash$/, page: Cash },
  { pattern: /^\/expenses$/, page: Expenses },
  { pattern: /^\/reports$/, page: Reports },
  { pattern: /^\/settings$/, page: Settings },
];

const content = document.getElementById('page-content');
const pageTitle = document.getElementById('page-title');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function getPath() {
  const hash = location.hash || '#/';
  return hash.slice(1) || '/';
}

async function navigate() {
  const path = getPath();

  for (const route of routes) {
    const m = path.match(route.pattern);
    if (m) {
      const params = route.param ? { [route.param]: m[1] } : null;

      // Update active nav
      document.querySelectorAll('.nav-item, .bnav-item').forEach(el => {
        const r = el.dataset.route;
        const active = r === '/' ? path === '/' : path.startsWith(r);
        el.classList.toggle('active', active);
      });

      // Update page title
      pageTitle.textContent = route.page.title || '';
      document.title = (route.page.title ? route.page.title + ' — ' : '') + 'Store Manager';

      // Close mobile sidebar
      sidebar.classList.remove('open');
      overlay.classList.remove('active');

      // Scroll to top
      content.scrollTop = 0;

      // Render
      try {
        await route.page.render(content, params);
      } catch (err) {
        console.error('Page render error:', err);
        content.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h3>Something went wrong</h3>
            <p>${err.message}</p>
          </div>
        `;
      }

      return;
    }
  }

  // 404
  content.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h3>Page not found</h3>
      <p><a href="#/" style="color:var(--primary)">Go to Dashboard</a></p>
    </div>
  `;
}

// Sidebar toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
});
document.getElementById('sidebar-close').addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});

// Router (navigation only happens once authenticated)
window.addEventListener('hashchange', navigate);

// Update badges periodically
let badgesTimer = null;
async function updateBadges() {
  try {
    const data = await api.dashboard.get();
    const ordBadge = document.getElementById('badge-orders');
    const stockBadge = document.getElementById('badge-stock');
    if (ordBadge) ordBadge.textContent = data.pendingOrders > 0 ? data.pendingOrders : '';
    if (stockBadge) stockBadge.textContent = data.lowStock > 0 ? data.lowStock : '';
  } catch {}
}

// ── Authentication gate ───────────────────────────────────────────────────────
function showApp(user) {
  document.getElementById('login-overlay')?.remove();
  const nameEl = document.getElementById('current-user');
  const avEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = user.username;
  if (avEl) avEl.textContent = (user.username[0] || 'A').toUpperCase();

  api.settings.get().then(s => {
    if (s.store_name) {
      const el = document.querySelector('.sidebar-title');
      if (el) el.textContent = s.store_name;
    }
  }).catch(() => {});

  navigate();
  updateBadges();
  if (!badgesTimer) badgesTimer = setInterval(updateBadges, 60000);
}

function showLogin(message) {
  if (badgesTimer) { clearInterval(badgesTimer); badgesTimer = null; }
  let overlay = document.getElementById('login-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <form class="login-card" id="login-form">
      <div class="login-logo">
        <svg width="30" height="30" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M160 200 L180 160 L332 160 L352 200 Z" stroke="currentColor" stroke-width="28" stroke-linejoin="round"/>
          <rect x="140" y="200" width="232" height="160" rx="12" stroke="currentColor" stroke-width="28"/>
          <path d="M220 200 L220 180 Q220 150 256 150 Q292 150 292 180 L292 200" stroke="currentColor" stroke-width="28" stroke-linecap="round" fill="none"/>
        </svg>
        <span>Store Manager</span>
      </div>
      <p class="login-sub">Sign in to continue</p>
      ${message ? `<div class="login-note">${message}</div>` : ''}
      <div class="form-group">
        <label class="form-label">Username</label>
        <input class="form-control" id="login-user" autocomplete="username" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-control" id="login-pass" type="password" autocomplete="current-password">
      </div>
      <div class="login-error" id="login-error"></div>
      <button class="btn btn-primary w-full" type="submit" id="login-submit">Sign In</button>
    </form>`;
  overlay.style.display = 'flex';

  overlay.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = overlay.querySelector('#login-submit');
    const err = overlay.querySelector('#login-error');
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await api.auth.login(overlay.querySelector('#login-user').value.trim(), overlay.querySelector('#login-pass').value);
      const user = await api.auth.me();
      showApp(user);
    } catch (e2) {
      err.textContent = e2.message || 'Login failed';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
  setTimeout(() => overlay.querySelector('#login-user')?.focus(), 50);
}

window.addEventListener('unauthorized', () => showLogin('Your session has expired. Please sign in again.'));

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  try { await api.auth.logout(); } catch {}
  showLogin();
});

async function boot() {
  let user = null;
  try { user = await api.auth.me(); } catch { user = null; }
  if (user) showApp(user);
  else showLogin();
}

boot();
