import { api } from '../api.js';
import { fmt, fmtDate, fmtDateTime, statusBadge, toast, confirm, openModal, closeModal, debounce } from '../utils.js';

export const title = 'Orders';

let state = { search: '', status: '', payment: '', offset: 0, limit: 30 };

export async function render(container, params) {
  if (params && params.id) return renderDetail(container, params.id);
  return renderList(container);
}

async function renderList(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  await loadList(container);
}

async function loadList(container) {
  const data = await api.orders.list(state);
  const { orders, total } = data;

  container.innerHTML = `
    <div class="filters-bar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search orders…" id="orders-search" value="${state.search}">
      </div>
      <select class="filter-select" id="orders-status">
        <option value="">All Status</option>
        <option value="pending" ${state.status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="processing" ${state.status === 'processing' ? 'selected' : ''}>Processing</option>
        <option value="completed" ${state.status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="cancelled" ${state.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
      <select class="filter-select" id="orders-payment">
        <option value="">All Payments</option>
        <option value="pending" ${state.payment === 'pending' ? 'selected' : ''}>Unpaid</option>
        <option value="paid" ${state.payment === 'paid' ? 'selected' : ''}>Paid</option>
        <option value="refunded" ${state.payment === 'refunded' ? 'selected' : ''}>Refunded</option>
      </select>
      <button class="btn btn-primary" id="btn-new-order">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Order
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Orders <span style="color:var(--text-3);font-weight:400;font-size:13px">(${total})</span></h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${orders.length ? orders.map(o => `
              <tr class="clickable" data-id="${o.id}">
                <td><strong>${o.order_number || '#' + o.id}</strong></td>
                <td>${o.customer_name || '<span class="text-muted">Guest</span>'}</td>
                <td class="fw-bold">${fmt(o.total, o.currency)}</td>
                <td>${statusBadge(o.payment_status)}</td>
                <td>${statusBadge(o.status)}</td>
                <td class="text-muted" style="white-space:nowrap">${fmtDate(o.created_at)}</td>
                <td>
                  <div class="flex gap-8" style="justify-content:flex-end">
                    <button class="btn btn-ghost btn-icon btn-sm" title="Fiscal Coupon" data-action="coupon" data-id="${o.id}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </button>
                    ${o.payment_status !== 'paid' && o.payment_status !== 'refunded' ? `
                      <button class="btn btn-success btn-sm" data-action="pay" data-id="${o.id}" title="Mark as Paid">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Paid
                      </button>` : ''}
                    ${o.payment_status === 'paid' ? `
                      <button class="btn btn-outline btn-sm" data-action="return" data-id="${o.id}" title="Return / Refund">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 19 14 19"/><path d="M20 4a7 7 0 01-7 7H4"/></svg>
                        Return
                      </button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg><h3>No orders found</h3><p>Try adjusting filters or create a new order</p></div></td></tr>`}
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

  // Events
  const search = container.querySelector('#orders-search');
  const statusSel = container.querySelector('#orders-status');
  const paymentSel = container.querySelector('#orders-payment');

  const reload = debounce(() => loadList(container), 300);

  search.addEventListener('input', () => { state.search = search.value; state.offset = 0; reload(); });
  statusSel.addEventListener('change', () => { state.status = statusSel.value; state.offset = 0; loadList(container); });
  paymentSel.addEventListener('change', () => { state.payment = paymentSel.value; state.offset = 0; loadList(container); });

  container.querySelector('#btn-prev')?.addEventListener('click', () => { state.offset -= state.limit; loadList(container); });
  container.querySelector('#btn-next')?.addEventListener('click', () => { state.offset += state.limit; loadList(container); });
  container.querySelector('#btn-new-order').addEventListener('click', () => showOrderForm(container));

  container.querySelectorAll('tr.clickable[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      location.hash = `#/orders/${row.dataset.id}`;
    });
  });

  container.querySelectorAll('[data-action="coupon"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(api.orders.couponUrl(btn.dataset.id), '_blank');
    });
  });

  container.querySelectorAll('[data-action="pay"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const method = await askPaymentMethod();
      if (!method) return;
      try { await api.orders.pay(btn.dataset.id, method); toast('Order marked as paid', 'success'); loadList(container); }
      catch (err) { toast(err.message, 'error'); }
    });
  });

  container.querySelectorAll('[data-action="return"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirm('Mark this order as returned/refunded?');
      if (!ok) return;
      try { await api.orders.return(btn.dataset.id); toast('Order refunded', 'success'); loadList(container); }
      catch (err) { toast(err.message, 'error'); }
    });
  });
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function parseAddress(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch { return { address1: value }; }
}

function addressLines(address) {
  const a = parseAddress(address);
  if (!a) return [];
  return [
    a.name,
    a.company,
    [a.address1, a.address2].filter(Boolean).join(' '),
    [a.zip, a.city].filter(Boolean).join(' '),
    a.province || a.province_code,
    a.country || a.country_code,
    a.phone,
  ].filter(Boolean);
}

function addressBlock(title, address) {
  const lines = addressLines(address);
  if (!lines.length) return '';
  return `
    <div class="card mb-16">
      <div class="card-header"><h3 class="card-title">${title}</h3></div>
      <div class="card-body">
        <div style="font-size:14px;line-height:1.7;color:var(--text-1)">
          ${lines.map(line => `<div>${esc(line)}</div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

async function renderDetail(container, id) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const order = await api.orders.get(id);
  const tax = +order.tax || 0;
  const subtotalExTax = Math.max(0, (+order.subtotal || 0) - tax);
  const customerAddress = order.customer ? {
    address1: order.customer.address,
    city: order.customer.city,
    country: order.customer.country,
    phone: order.customer.phone,
  } : null;

  container.innerHTML = `
    <div class="detail-header">
      <a href="#/orders" class="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Orders
      </a>
      <h2 class="detail-title">${order.order_number || '#' + order.id}</h2>
      <div class="flex gap-8">
        <button class="btn btn-ghost btn-sm" id="btn-coupon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Coupon
        </button>
        ${order.payment_status !== 'paid' && order.payment_status !== 'refunded' ? `
          <button class="btn btn-success btn-sm" id="btn-pay">Mark Paid</button>` : ''}
        ${order.payment_status === 'paid' ? `
          <button class="btn btn-outline btn-sm" id="btn-return">Return</button>` : ''}
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="card mb-16">
          <div class="card-header"><h3 class="card-title">Order Items</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
              <tbody>
                ${order.items.map(i => `
                  <tr>
                    <td><strong>${i.name}</strong></td>
                    <td class="text-muted">${i.sku || '—'}</td>
                    <td class="text-right">${i.quantity}</td>
                    <td class="text-right">${fmt(i.price, order.currency)}</td>
                    <td class="text-right fw-bold">${fmt(i.price * i.quantity, order.currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="card-footer">
            <div class="flex justify-between" style="font-size:13px;color:var(--text-2)"><span>Subtotal excl. tax</span><span>${fmt(subtotalExTax, order.currency)}</span></div>
            ${order.shipping > 0 ? `<div class="flex justify-between mt-8" style="font-size:13px;color:var(--text-2)"><span>Shipping</span><span>${fmt(order.shipping, order.currency)}</span></div>` : ''}
            ${order.discount > 0 ? `<div class="flex justify-between mt-8" style="font-size:13px;color:var(--success)"><span>Discount</span><span>-${fmt(order.discount, order.currency)}</span></div>` : ''}
            ${tax > 0 ? `<div class="flex justify-between mt-8" style="font-size:13px;color:var(--text-2)"><span>Tax included</span><span>${fmt(tax, order.currency)}</span></div>` : ''}
            <hr class="divider" style="margin:10px 0">
            <div class="flex justify-between fw-bold"><span>Total</span><span style="font-size:16px">${fmt(order.total, order.currency)}</span></div>
          </div>
        </div>
      </div>
      <div>
        <div class="card mb-16">
          <div class="card-header"><h3 class="card-title">Order Info</h3></div>
          <div class="card-body">
            <div class="info-list">
              <div class="info-row"><span class="info-key">Status</span><span class="info-val">${statusBadge(order.status)}</span></div>
              <div class="info-row"><span class="info-key">Payment</span><span class="info-val">${statusBadge(order.payment_status)}</span></div>
              <div class="info-row"><span class="info-key">Payment Method</span><span class="info-val">${({ cash: 'Cash', card: 'Card', transfer: 'Bank Transfer', other: 'Other' })[order.payment_method] || 'Cash'}</span></div>
              <div class="info-row"><span class="info-key">Fulfillment</span><span class="info-val">${statusBadge(order.fulfillment_status)}</span></div>
              <div class="info-row"><span class="info-key">Created</span><span class="info-val">${fmtDateTime(order.created_at)}</span></div>
              ${order.paid_at ? `<div class="info-row"><span class="info-key">Paid At</span><span class="info-val">${fmtDateTime(order.paid_at)}</span></div>` : ''}
              ${order.returned_at ? `<div class="info-row"><span class="info-key">Returned</span><span class="info-val">${fmtDateTime(order.returned_at)}</span></div>` : ''}
              ${order.notes ? `<div class="info-row"><span class="info-key">Notes</span><span class="info-val">${order.notes}</span></div>` : ''}
            </div>
          </div>
        </div>
        ${addressBlock('Shipping Address', order.shipping_address)}
        ${order.customer ? `
          <div class="card">
            <div class="card-header"><h3 class="card-title">Customer</h3></div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-row"><span class="info-key">Name</span><span class="info-val"><a href="#/customers/${order.customer.id}" style="color:var(--primary);font-weight:600">${order.customer.name}</a></span></div>
                ${order.customer.email ? `<div class="info-row"><span class="info-key">Email</span><span class="info-val">${order.customer.email}</span></div>` : ''}
                ${order.customer.phone ? `<div class="info-row"><span class="info-key">Phone</span><span class="info-val">${order.customer.phone}</span></div>` : ''}
                ${addressLines(customerAddress).length ? `<div class="info-row"><span class="info-key">Address</span><span class="info-val">${addressLines(customerAddress).map(esc).join('<br>')}</span></div>` : ''}
              </div>
            </div>
          </div>` : order.customer_name ? `
          <div class="card">
            <div class="card-header"><h3 class="card-title">Customer</h3></div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-row"><span class="info-key">Name</span><span class="info-val">${order.customer_name}</span></div>
                ${order.customer_email ? `<div class="info-row"><span class="info-key">Email</span><span class="info-val">${order.customer_email}</span></div>` : ''}
              </div>
            </div>
          </div>` : ''}
      </div>
    </div>
  `;

  container.querySelector('#btn-coupon')?.addEventListener('click', () => {
    window.open(api.orders.couponUrl(id), '_blank');
  });
  container.querySelector('#btn-pay')?.addEventListener('click', async () => {
    const method = await askPaymentMethod(order.payment_method || 'cash');
    if (!method) return;
    await api.orders.pay(id, method);
    toast('Order marked as paid', 'success');
    renderDetail(container, id);
  });
  container.querySelector('#btn-return')?.addEventListener('click', async () => {
    const ok = await confirm('Mark this order as returned/refunded?');
    if (!ok) return;
    await api.orders.return(id);
    toast('Order refunded', 'success');
    renderDetail(container, id);
  });
}

function showOrderForm(container) {
  const backdrop = openModal('New Order', `
    <div class="form-group">
      <label class="form-label">Customer Name</label>
      <input class="form-control" id="o-cname" placeholder="Customer name">
    </div>
    <div class="form-group">
      <label class="form-label">Customer Email</label>
      <input class="form-control" id="o-cemail" type="email" placeholder="email@example.com">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-control" id="o-notes" placeholder="Order notes…"></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Shipping</label>
        <input class="form-control" id="o-shipping" type="number" value="0" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Tax</label>
        <input class="form-control" id="o-tax" type="number" value="0" min="0" step="0.01">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Payment Method</label>
      <select class="form-control" id="o-payment-method">
        <option value="cash">Cash (Kesh)</option>
        <option value="card">Card (Kartelë)</option>
        <option value="transfer">Bank Transfer (Transfertë)</option>
        <option value="other">Other (Tjetër)</option>
      </select>
    </div>
    <hr class="divider">
    <p class="form-label">Items</p>
    <div id="o-items"></div>
    <button class="btn btn-outline btn-sm mt-8" id="btn-add-item">+ Add Item</button>
  `, `
    <button class="btn btn-outline" id="o-cancel">Cancel</button>
    <button class="btn btn-primary" id="o-save">Create Order</button>
  `);

  const itemsEl = backdrop.querySelector('#o-items');
  let itemCount = 0;

  const addItem = () => {
    const idx = itemCount++;
    const row = document.createElement('div');
    row.className = 'form-row mb-16';
    row.dataset.item = idx;
    row.innerHTML = `
      <div class="form-group" style="grid-column:span 2">
        <input class="form-control" placeholder="Product name" data-field="name">
      </div>
      <div class="form-group">
        <input class="form-control" type="number" placeholder="Qty" value="1" min="1" data-field="quantity">
      </div>
      <div class="form-group">
        <input class="form-control" type="number" placeholder="Price" value="0" min="0" step="0.01" data-field="price">
      </div>
      <div class="form-group" style="grid-column:span 2;display:flex;align-items:flex-end">
        <button class="btn btn-ghost btn-sm btn-remove-item" style="color:var(--danger)">Remove</button>
      </div>
    `;
    row.querySelector('.btn-remove-item').onclick = () => row.remove();
    itemsEl.appendChild(row);
  };

  addItem();
  backdrop.querySelector('#btn-add-item').onclick = addItem;
  backdrop.querySelector('#o-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#o-save').onclick = async () => {
    const items = [...itemsEl.querySelectorAll('[data-item]')].map(row => ({
      name: row.querySelector('[data-field="name"]').value,
      quantity: +row.querySelector('[data-field="quantity"]').value,
      price: +row.querySelector('[data-field="price"]').value,
      cost: 0,
    })).filter(i => i.name);

    if (!items.length) { toast('Add at least one item', 'error'); return; }

    try {
      await api.orders.create({
        customer_name: backdrop.querySelector('#o-cname').value,
        customer_email: backdrop.querySelector('#o-cemail').value,
        notes: backdrop.querySelector('#o-notes').value,
        shipping: +backdrop.querySelector('#o-shipping').value,
        tax: +backdrop.querySelector('#o-tax').value,
        payment_method: backdrop.querySelector('#o-payment-method').value,
        items,
      });
      backdrop.remove();
      toast('Order created', 'success');
      loadList(container);
    } catch (err) { toast(err.message, 'error'); }
  };
}

// Ask the user to pick a payment method when marking an order paid.
// Resolves the chosen method, or null if cancelled.
function askPaymentMethod(current = 'cash') {
  return new Promise(resolve => {
    const methods = [
      { val: 'cash', label: 'Cash', sub: 'Kesh', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>` },
      { val: 'card', label: 'Card', sub: 'Kartelë', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>` },
      { val: 'transfer', label: 'Transfer', sub: 'Transfertë', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>` },
      { val: 'other', label: 'Other', sub: 'Tjetër', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>` },
    ];
    let selected = current;
    const backdrop = openModal('Mark as Paid', `
      <p style="font-size:14px;color:var(--text-2);margin-bottom:14px">Select the payment method for this order:</p>
      <div class="pay-method-grid">
        ${methods.map(m => `
          <button type="button" class="pay-method${m.val === selected ? ' selected' : ''}" data-method="${m.val}">
            ${m.icon}
            <strong>${m.label}</strong>
            <span>${m.sub}</span>
          </button>`).join('')}
      </div>
    `, `
      <button class="btn btn-outline" id="pm-cancel">Cancel</button>
      <button class="btn btn-success" id="pm-confirm">Confirm Payment</button>
    `);

    const cards = backdrop.querySelectorAll('.pay-method');
    cards.forEach(card => card.addEventListener('click', () => {
      selected = card.dataset.method;
      cards.forEach(c => c.classList.toggle('selected', c === card));
    }));

    let done = false;
    const finish = (val) => { if (done) return; done = true; backdrop.remove(); resolve(val); };
    backdrop.querySelector('#pm-confirm').addEventListener('click', () => finish(selected));
    backdrop.querySelector('#pm-cancel').addEventListener('click', () => finish(null));
    backdrop.querySelector('.modal-close').addEventListener('click', () => finish(null));
    backdrop.addEventListener('click', e => { if (e.target === backdrop) finish(null); });
  });
}
