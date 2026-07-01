import { api } from '../api.js';
import { fmt, fmtDate, statusBadge, toast, confirm, openModal, debounce } from '../utils.js';

export const title = 'Customers';

let state = { search: '', offset: 0, limit: 30 };

export async function render(container, params) {
  if (params && params.id) return renderDetail(container, params.id);
  return renderList(container);
}

async function renderList(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  await loadList(container);
}

async function loadList(container) {
  const { customers, total } = await api.customers.list(state);

  container.innerHTML = `
    <div class="filters-bar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search customers…" id="cust-search" value="${state.search}">
      </div>
      <button class="btn btn-primary" id="btn-new-cust">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Customer
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Customers <span style="color:var(--text-3);font-weight:400;font-size:13px">(${total})</span></h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
              <th class="text-right">Orders</th>
              <th class="text-right">Total Spent</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            ${customers.length ? customers.map(c => `
              <tr class="clickable" data-id="${c.id}">
                <td>
                  <div class="flex items-center gap-8">
                    <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-l);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">
                      ${c.name.charAt(0).toUpperCase()}
                    </div>
                    <strong>${c.name}</strong>
                  </div>
                </td>
                <td class="text-muted">${c.email || '—'}</td>
                <td class="text-muted">${c.phone || '—'}</td>
                <td class="text-muted">${c.city || '—'}</td>
                <td class="text-right fw-bold">${c.total_orders}</td>
                <td class="text-right fw-bold text-success">${fmt(c.total_spent)}</td>
                <td class="text-muted">${fmtDate(c.created_at)}</td>
              </tr>
            `).join('') : `<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><h3>No customers yet</h3><p>Add your first customer or sync from Shopify</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${total > state.limit ? `
        <div class="pagination card-footer">
          <span>Showing ${state.offset + 1}–${Math.min(state.offset + state.limit, total)} of ${total}</span>
          <button class="btn btn-outline btn-sm" id="btn-prev" ${state.offset === 0 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-outline btn-sm" id="btn-next" ${state.offset + state.limit >= total ? 'disabled' : ''}>Next</button>
        </div>` : ''}
    </div>
  `;

  const search = container.querySelector('#cust-search');
  const reload = debounce(() => loadList(container), 300);
  search.addEventListener('input', () => { state.search = search.value; state.offset = 0; reload(); });
  container.querySelector('#btn-prev')?.addEventListener('click', () => { state.offset -= state.limit; loadList(container); });
  container.querySelector('#btn-next')?.addEventListener('click', () => { state.offset += state.limit; loadList(container); });
  container.querySelector('#btn-new-cust').addEventListener('click', () => showCustomerForm(container));

  container.querySelectorAll('tr.clickable[data-id]').forEach(row => {
    row.addEventListener('click', () => { location.hash = `#/customers/${row.dataset.id}`; });
  });
}

async function renderDetail(container, id) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const c = await api.customers.get(id);

  container.innerHTML = `
    <div class="detail-header">
      <a href="#/customers" class="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Customers
      </a>
      <h2 class="detail-title">${c.name}</h2>
      <div class="flex gap-8">
        <button class="btn btn-outline btn-sm" id="btn-edit">Edit</button>
        <button class="btn btn-danger btn-sm" id="btn-delete">Delete</button>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="card mb-16">
          <div class="card-header"><h3 class="card-title">Order History</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Total</th><th>Payment</th><th>Date</th></tr></thead>
              <tbody>
                ${c.orders.length ? c.orders.map(o => `
                  <tr class="clickable" data-href="#/orders/${o.id}">
                    <td><strong>${o.order_number || '#' + o.id}</strong></td>
                    <td class="fw-bold">${fmt(o.total, o.currency)}</td>
                    <td>${statusBadge(o.payment_status)}</td>
                    <td class="text-muted">${fmtDate(o.created_at)}</td>
                  </tr>
                `).join('') : `<tr><td colspan="4" class="text-center text-muted" style="padding:24px">No orders yet</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div class="card mb-16">
          <div class="card-header"><h3 class="card-title">Customer Info</h3></div>
          <div class="card-body">
            <div style="text-align:center;margin-bottom:16px">
              <div style="width:64px;height:64px;border-radius:50%;background:var(--primary-l);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;margin:0 auto 10px">
                ${c.name.charAt(0).toUpperCase()}
              </div>
              <strong style="font-size:16px">${c.name}</strong>
            </div>
            <div class="info-list">
              ${c.email ? `<div class="info-row"><span class="info-key">Email</span><span class="info-val"><a href="mailto:${c.email}" style="color:var(--primary)">${c.email}</a></span></div>` : ''}
              ${c.phone ? `<div class="info-row"><span class="info-key">Phone</span><span class="info-val">${c.phone}</span></div>` : ''}
              ${c.address ? `<div class="info-row"><span class="info-key">Address</span><span class="info-val">${c.address}</span></div>` : ''}
              ${c.city ? `<div class="info-row"><span class="info-key">City</span><span class="info-val">${c.city}</span></div>` : ''}
              ${c.country ? `<div class="info-row"><span class="info-key">Country</span><span class="info-val">${c.country}</span></div>` : ''}
              <div class="info-row"><span class="info-key">Customer Since</span><span class="info-val">${fmtDate(c.created_at)}</span></div>
              ${c.notes ? `<div class="info-row"><span class="info-key">Notes</span><span class="info-val" style="white-space:pre-wrap">${c.notes}</span></div>` : ''}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Summary</h3></div>
          <div class="card-body">
            <div class="stat-grid" style="grid-template-columns:1fr 1fr">
              <div class="stat-card">
                <div class="stat-label">Total Orders</div>
                <div class="stat-value primary">${c.total_orders}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Spent</div>
                <div class="stat-value success">${fmt(c.total_spent)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('tr.clickable[data-href]').forEach(row => {
    row.addEventListener('click', () => { location.hash = row.dataset.href; });
    row.style.cursor = 'pointer';
  });

  container.querySelector('#btn-edit').addEventListener('click', () => showCustomerForm(container, c, () => renderDetail(container, id)));
  container.querySelector('#btn-delete').addEventListener('click', async () => {
    const ok = await confirm('Delete this customer? This cannot be undone.');
    if (!ok) return;
    await api.customers.delete(id);
    toast('Customer deleted', 'success');
    location.hash = '#/customers';
  });
}

function showCustomerForm(container, customer = null, onDone) {
  const isEdit = !!customer;
  const backdrop = openModal(isEdit ? 'Edit Customer' : 'New Customer', `
    <div class="form-group">
      <label class="form-label">Full Name *</label>
      <input class="form-control" id="c-name" value="${customer?.name || ''}" placeholder="John Doe">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="c-email" type="email" value="${customer?.email || ''}" placeholder="john@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-control" id="c-phone" value="${customer?.phone || ''}" placeholder="+1 555...">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Address</label>
      <input class="form-control" id="c-addr" value="${customer?.address || ''}" placeholder="123 Main St">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">City</label>
        <input class="form-control" id="c-city" value="${customer?.city || ''}" placeholder="Paris">
      </div>
      <div class="form-group">
        <label class="form-label">Country</label>
        <input class="form-control" id="c-country" value="${customer?.country || ''}" placeholder="France">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-control" id="c-notes">${customer?.notes || ''}</textarea>
    </div>
  `, `
    <button class="btn btn-outline" id="c-cancel">Cancel</button>
    <button class="btn btn-primary" id="c-save">${isEdit ? 'Save Changes' : 'Add Customer'}</button>
  `);

  backdrop.querySelector('#c-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#c-save').onclick = async () => {
    const name = backdrop.querySelector('#c-name').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const body = {
      name,
      email: backdrop.querySelector('#c-email').value,
      phone: backdrop.querySelector('#c-phone').value,
      address: backdrop.querySelector('#c-addr').value,
      city: backdrop.querySelector('#c-city').value,
      country: backdrop.querySelector('#c-country').value,
      notes: backdrop.querySelector('#c-notes').value,
    };
    try {
      if (isEdit) await api.customers.update(customer.id, body);
      else await api.customers.create(body);
      backdrop.remove();
      toast(isEdit ? 'Customer updated' : 'Customer added', 'success');
      if (onDone) onDone(); else loadList(container);
    } catch (err) { toast(err.message, 'error'); }
  };
}
