import { api } from '../api.js';
import { toast, confirm } from '../utils.js';

export const title = 'Settings';

const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

function accordion({ id, icon, title, subtitle, status, body }) {
  return `
    <div class="accordion" data-acc="${id}">
      <button class="accordion-header" type="button">
        <span class="accordion-ico">${icon}</span>
        <span class="accordion-meta">
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </span>
        ${status || ''}
        <span class="accordion-chevron">${chevron}</span>
      </button>
      <div class="accordion-body hidden">${body}</div>
    </div>`;
}

export async function render(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const settings = await api.settings.get();
  const shopifyStatus = await api.shopify.status();
  const usersData = await api.users.list().catch(() => ({ users: [], currentUserId: null }));

  const ICONS = {
    business: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M10 11h.01M10 15h.01M14 11h.01M14 15h.01M18 11h.01M18 15h.01M3 7l9-4 9 4"/></svg>`,
    fiscal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    costs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    shopify: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`,
    admins: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  };

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Settings</h2>
        <p>Tap a section to expand and edit</p>
      </div>
    </div>

    ${accordion({
      id: 'business',
      icon: ICONS.business,
      title: 'Business Details',
      subtitle: 'Name, address, contact & logo',
      body: `
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input class="form-control" id="s-store-name" value="${settings.store_name || ''}" placeholder="Lipjani SH.P.K.">
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-control" id="s-address" value="${settings.store_address || ''}" placeholder="Lidhja e Prizrenit">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">City</label>
            <input class="form-control" id="s-city" value="${settings.store_city || ''}" placeholder="LIPJAN">
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-control" id="s-currency">
              <option value="EUR" ${(settings.currency || 'EUR') === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
              <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD - US Dollar</option>
              <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP - British Pound</option>
              <option value="MAD" ${settings.currency === 'MAD' ? 'selected' : ''}>MAD - Moroccan Dirham</option>
              <option value="DZD" ${settings.currency === 'DZD' ? 'selected' : ''}>DZD - Algerian Dinar</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone 1</label>
            <input class="form-control" id="s-phone" value="${settings.store_phone || ''}" placeholder="044 820 831">
          </div>
          <div class="form-group">
            <label class="form-label">Phone 2</label>
            <input class="form-control" id="s-phone2" value="${settings.store_phone2 || ''}" placeholder="049 820 831">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-control" id="s-email" type="email" value="${settings.store_email || ''}" placeholder="store@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Logo URL</label>
          <input class="form-control" id="s-logo" value="${settings.store_logo || ''}" placeholder="https://...">
          <p class="form-hint">Shown in the app sidebar</p>
        </div>
        <button class="btn btn-primary" id="btn-save-business">Save Business Details</button>
      `,
    })}

    ${accordion({
      id: 'fiscal',
      icon: ICONS.fiscal,
      title: 'Fiscal Coupon (Kosovo)',
      subtitle: 'Fiscal number, VAT, PEF & device serial',
      body: `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Numri Fiskal (Fiscal No.)</label>
            <input class="form-control" id="s-fiscal-number" value="${settings.fiscal_number || ''}" placeholder="810381583">
          </div>
          <div class="form-group">
            <label class="form-label">Numri i TVSH (VAT No.)</label>
            <input class="form-control" id="s-vat-number" value="${settings.vat_number || ''}" placeholder="330008202">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nr. i PEF</label>
            <input class="form-control" id="s-pef" value="${settings.pef_number || ''}" placeholder="1">
          </div>
          <div class="form-group">
            <label class="form-label">Operatori (Operator)</label>
            <input class="form-control" id="s-operator" value="${settings.operator_name || ''}" placeholder="ERIKI">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Numri Serik (Device Serial)</label>
            <input class="form-control" id="s-serial" value="${settings.fiscal_serial || ''}" placeholder="EN11003984">
          </div>
          <div class="form-group">
            <label class="form-label">EJ Nr. (Journal No.)</label>
            <input class="form-control" id="s-ej" value="${settings.ej_number || ''}" placeholder="1">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Thermal Paper Width</label>
            <select class="form-control" id="s-paper-width">
              <option value="80" ${(settings.paper_width || '80') === '80' ? 'selected' : ''}>80 mm (standard)</option>
              <option value="58" ${settings.paper_width === '58' ? 'selected' : ''}>58 mm (compact)</option>
            </select>
            <p class="form-hint">Match your thermal printer's roll width</p>
          </div>
          <div class="form-group">
            <label class="form-label">Shenja e Sistemit Fiskal (System ID)</label>
            <input class="form-control" id="s-fiscal-system" value="${settings.fiscal_system_id || ''}" placeholder="e.g. POS-SM-001">
            <p class="form-hint">Identifying mark, printed on coupon</p>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kosovo Logo URL (RKS emblem)</label>
          <input class="form-control" id="s-fiscal-logo" value="${settings.fiscal_logo || ''}" placeholder="https://…/rks-logo.png">
          <p class="form-hint">Image printed at the bottom of the coupon. Leave blank to use the default mark.</p>
          <div id="fiscal-logo-preview" style="margin-top:10px">${settings.fiscal_logo ? `<img src="${settings.fiscal_logo}" alt="RKS" style="max-height:60px;max-width:130px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:8px;background:#fff" onerror="this.style.display='none'">` : ''}</div>
        </div>
        <p class="form-hint mb-16">These appear on the printed fiscal coupon. Generate one from any order's coupon button.</p>
        <button class="btn btn-primary" id="btn-save-fiscal">Save Fiscal Details</button>
      `,
    })}

    ${accordion({
      id: 'costs',
      icon: ICONS.costs,
      title: 'Costs & Defaults',
      subtitle: 'Packaging, tax rate & delivery prices',
      body: `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Default Packaging Cost</label>
            <input class="form-control" id="s-packaging" type="number" value="${settings.default_packaging || 0}" min="0" step="0.01">
            <p class="form-hint">Default packaging cost per order</p>
          </div>
          <div class="form-group">
            <label class="form-label">VAT / TVSH Rate (%)</label>
            <input class="form-control" id="s-tax" type="number" value="${settings.default_tax_rate || 0}" min="0" max="100" step="0.1" placeholder="18">
            <p class="form-hint">Applied to fiscal coupons (Kosovo standard: 18%)</p>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Prices by Country</label>
          <textarea class="form-control" id="s-delivery" rows="4" placeholder="XK: 2.00&#10;AL: 5.90&#10;MK: 7.90">${settings.delivery_prices || ''}</textarea>
          <p class="form-hint">Format: COUNTRY_CODE: price (one per line)</p>
        </div>
        <button class="btn btn-primary" id="btn-save-costs">Save Costs & Defaults</button>
      `,
    })}

    ${accordion({
      id: 'shopify',
      icon: ICONS.shopify,
      title: 'Shopify Integration',
      subtitle: 'Auto-sync orders, products & customers',
      status: `<span class="accordion-status" style="background:${shopifyStatus.configured ? 'var(--success-l)' : 'var(--bg)'};color:${shopifyStatus.configured ? '#1f6b41' : 'var(--text-2)'}">${shopifyStatus.configured ? 'CONNECTED' : 'OFF'}</span>`,
      body: `
        <div class="flex items-center gap-8 mb-16" style="padding:12px;background:${shopifyStatus.configured ? 'var(--success-l)' : 'var(--bg)'};border-radius:10px;border:1px solid ${shopifyStatus.configured ? 'var(--success)' : 'var(--border)'}">
          <div style="width:10px;height:10px;border-radius:50%;background:${shopifyStatus.configured ? 'var(--success)' : 'var(--border-dark)'};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <strong style="font-size:14px">${shopifyStatus.configured ? 'Connected' : 'Not configured'}</strong>
            ${shopifyStatus.lastSync ? `<div style="font-size:12px;color:var(--text-2)">Last sync: ${shopifyStatus.lastSync.created_at ? new Date(shopifyStatus.lastSync.created_at).toLocaleString() : '—'}</div>` : ''}
          </div>
          ${shopifyStatus.configured ? `<button class="btn btn-success btn-sm" id="btn-sync">Sync Now</button>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Shopify Admin Domain</label>
          <input class="form-control" id="s-shopify-domain" value="${settings.shopify_domain || ''}" placeholder="your-store.myshopify.com">
          <p class="form-hint">Domain without https://</p>
        </div>
        <div class="form-group">
          <label class="form-label">Admin API Access Token</label>
          <input class="form-control" id="s-shopify-token" type="password" value="${settings.shopify_token || ''}" placeholder="shpat_...">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client ID</label>
            <input class="form-control" id="s-shopify-client-id" value="${settings.shopify_client_id || ''}" placeholder="Client ID">
          </div>
          <div class="form-group">
            <label class="form-label">Client Secret</label>
            <input class="form-control" id="s-shopify-client-secret" type="password" value="${settings.shopify_client_secret || ''}" placeholder="Client Secret">
          </div>
        </div>
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn btn-primary" id="btn-save-shopify">Save Shopify Settings</button>
          ${shopifyStatus.configured ? `<button class="btn btn-outline" id="btn-test-shopify">Test Connection</button>` : ''}
        </div>
        <p class="form-hint mt-8">Sync runs automatically every 5 minutes when configured.</p>
      `,
    })}

    ${accordion({
      id: 'admins',
      icon: ICONS.admins,
      title: 'Administrators',
      subtitle: 'Who can sign in to this app',
      status: `<span class="accordion-status" style="background:var(--bg);color:var(--text-2)">${usersData.users.length}</span>`,
      body: `
        <div style="margin-bottom:4px">
          ${usersData.users.map(u => {
            const isMe = u.id === usersData.currentUserId;
            return `
              <div class="flex items-center justify-between" style="padding:11px 0;border-bottom:1px solid var(--border)">
                <div class="flex items-center gap-8">
                  <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-l);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${(u.username[0] || '?').toUpperCase()}</div>
                  <div>
                    <strong style="font-size:14px">${u.username}</strong>${isMe ? ' <span class="badge badge-info">You</span>' : ''}
                    <div style="font-size:12px;color:var(--text-3)">Since ${new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                ${isMe ? '' : `<button class="btn btn-ghost btn-icon btn-sm" data-del-user="${u.id}" data-name="${u.username}" style="color:var(--danger)" title="Remove admin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>`}
              </div>`;
          }).join('')}
        </div>

        <hr class="divider">
        <p class="settings-section-title" style="margin-bottom:12px">Add New Admin</p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input class="form-control" id="new-admin-user" placeholder="username" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-control" id="new-admin-pass" type="password" placeholder="min 4 characters" autocomplete="new-password">
          </div>
        </div>
        <button class="btn btn-primary" id="btn-add-admin">Add Admin</button>

        <hr class="divider">
        <p class="settings-section-title" style="margin-bottom:12px">Change My Password</p>
        <div class="form-group" style="max-width:280px">
          <label class="form-label">New Password</label>
          <input class="form-control" id="my-new-pass" type="password" placeholder="min 4 characters" autocomplete="new-password">
        </div>
        <button class="btn btn-outline" id="btn-change-pass">Update Password</button>
      `,
    })}
  `;

  // ── Accordion toggle ──────────────────────────────────────────────────────
  container.querySelectorAll('.accordion').forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    const body = acc.querySelector('.accordion-body');
    header.addEventListener('click', () => {
      const isOpen = acc.classList.toggle('open');
      body.classList.toggle('hidden', !isOpen);
    });
  });

  // ── Save: Business ────────────────────────────────────────────────────────
  container.querySelector('#btn-save-business').addEventListener('click', async () => {
    await api.settings.save({
      store_name: container.querySelector('#s-store-name').value,
      store_address: container.querySelector('#s-address').value,
      store_city: container.querySelector('#s-city').value,
      currency: container.querySelector('#s-currency').value,
      store_phone: container.querySelector('#s-phone').value,
      store_phone2: container.querySelector('#s-phone2').value,
      store_email: container.querySelector('#s-email').value,
      store_logo: container.querySelector('#s-logo').value,
    });
    toast('Business details saved', 'success');
    const titleEl = document.querySelector('.sidebar-title');
    if (titleEl) titleEl.textContent = container.querySelector('#s-store-name').value || 'Store Manager';
  });

  // ── Save: Fiscal ──────────────────────────────────────────────────────────
  container.querySelector('#btn-save-fiscal').addEventListener('click', async () => {
    await api.settings.save({
      fiscal_number: container.querySelector('#s-fiscal-number').value.trim(),
      vat_number: container.querySelector('#s-vat-number').value.trim(),
      pef_number: container.querySelector('#s-pef').value.trim(),
      operator_name: container.querySelector('#s-operator').value.trim(),
      fiscal_serial: container.querySelector('#s-serial').value.trim(),
      ej_number: container.querySelector('#s-ej').value.trim(),
      fiscal_system_id: container.querySelector('#s-fiscal-system').value.trim(),
      paper_width: container.querySelector('#s-paper-width').value,
      fiscal_logo: container.querySelector('#s-fiscal-logo').value.trim(),
    });
    toast('Fiscal details saved', 'success');
  });

  // ── Live preview for the Kosovo logo URL ──────────────────────────────────
  const logoInput = container.querySelector('#s-fiscal-logo');
  const logoPreview = container.querySelector('#fiscal-logo-preview');
  if (logoInput && logoPreview) {
    logoInput.addEventListener('input', () => {
      const url = logoInput.value.trim();
      logoPreview.innerHTML = url
        ? `<img src="${url}" alt="RKS" style="max-height:60px;max-width:130px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:8px;background:#fff" onerror="this.style.display='none'">`
        : '';
    });
  }

  // ── Save: Costs ───────────────────────────────────────────────────────────
  container.querySelector('#btn-save-costs').addEventListener('click', async () => {
    await api.settings.save({
      default_packaging: +container.querySelector('#s-packaging').value,
      default_tax_rate: +container.querySelector('#s-tax').value,
      delivery_prices: container.querySelector('#s-delivery').value,
    });
    toast('Costs & defaults saved', 'success');
  });

  // ── Save: Shopify ─────────────────────────────────────────────────────────
  container.querySelector('#btn-save-shopify').addEventListener('click', async () => {
    await api.settings.save({
      shopify_domain: container.querySelector('#s-shopify-domain').value.trim(),
      shopify_token: container.querySelector('#s-shopify-token').value.trim(),
      shopify_client_id: container.querySelector('#s-shopify-client-id').value.trim(),
      shopify_client_secret: container.querySelector('#s-shopify-client-secret').value.trim(),
    });
    toast('Shopify settings saved', 'success');
    setTimeout(() => render(container), 500);
  });

  // ── Sync now ──────────────────────────────────────────────────────────────
  container.querySelector('#btn-sync')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Syncing…';
    try {
      const result = await api.shopify.sync();
      toast(result.message, result.success ? 'success' : 'error');
      if (result.success) setTimeout(() => render(container), 1000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sync Now';
    }
  });

  // ── Test connection ───────────────────────────────────────────────────────
  container.querySelector('#btn-test-shopify')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      const result = await api.shopify.sync();
      toast(result.success ? 'Connection successful! ' + result.message : result.message, result.success ? 'success' : 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test Connection';
    }
  });

  // ── Admins: add ───────────────────────────────────────────────────────────
  container.querySelector('#btn-add-admin')?.addEventListener('click', async () => {
    const username = container.querySelector('#new-admin-user').value.trim();
    const password = container.querySelector('#new-admin-pass').value;
    if (!username || !password) { toast('Username and password are required', 'error'); return; }
    try {
      await api.users.create({ username, password });
      toast('Admin added', 'success');
      render(container);
    } catch (err) { toast(err.message, 'error'); }
  });

  // ── Admins: delete ────────────────────────────────────────────────────────
  container.querySelectorAll('[data-del-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirm(`Remove admin "${btn.dataset.name}"? They will no longer be able to sign in.`);
      if (!ok) return;
      try {
        await api.users.delete(btn.dataset.delUser);
        toast('Admin removed', 'success');
        render(container);
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  // ── Admins: change my password ────────────────────────────────────────────
  container.querySelector('#btn-change-pass')?.addEventListener('click', async () => {
    const password = container.querySelector('#my-new-pass').value;
    if (!password || password.length < 4) { toast('Password must be at least 4 characters', 'error'); return; }
    try {
      await api.users.setPassword(usersData.currentUserId, password);
      toast('Password updated', 'success');
      container.querySelector('#my-new-pass').value = '';
    } catch (err) { toast(err.message, 'error'); }
  });
}
