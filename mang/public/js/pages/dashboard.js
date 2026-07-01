import { api } from '../api.js';
import { fmt, fmtDate, statusBadge, timeAgo } from '../utils.js';

export const title = 'Dashboard';

export async function render(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const data = await api.dashboard.get();

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div class="stat-label">Today's Orders</div>
        <div class="stat-value primary">${data.todayOrders}</div>
        <div class="stat-sub">${data.pendingOrders} pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        </div>
        <div class="stat-label">Today's Revenue</div>
        <div class="stat-value success">${fmt(data.todayRevenue)}</div>
        <div class="stat-sub">${fmt(data.monthRevenue)} this month</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-label">Awaiting Payment</div>
        <div class="stat-value warning">${data.pendingPayment}</div>
        <div class="stat-sub">orders unpaid</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${data.lowStock > 0 ? 'danger' : 'success'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
        <div class="stat-label">Low Stock</div>
        <div class="stat-value ${data.lowStock > 0 ? 'danger' : ''}">${data.lowStock}</div>
        <div class="stat-sub">${data.totalProducts} total products</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card" data-nav="/orders">
        <div class="dash-card-icon" style="background:var(--primary-l);color:var(--primary)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div class="dash-card-value">${data.pendingOrders}</div>
        <div class="dash-card-label">Pending Orders</div>
        <div class="dash-card-sub">Click to manage orders &rarr;</div>
      </div>
      <div class="dash-card" data-nav="/products">
        <div class="dash-card-icon" style="background:var(--success-l);color:var(--success)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
        <div class="dash-card-value">${data.totalProducts}</div>
        <div class="dash-card-label">Active Products</div>
        <div class="dash-card-sub">${data.lowStock} need restocking &rarr;</div>
      </div>
      <div class="dash-card" data-nav="/customers">
        <div class="dash-card-icon" style="background:var(--info-l);color:var(--info)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div class="dash-card-value">${data.totalCustomers}</div>
        <div class="dash-card-label">Total Customers</div>
        <div class="dash-card-sub">View all customers &rarr;</div>
      </div>
      <div class="dash-card" data-nav="/cash">
        <div class="dash-card-icon" style="background:var(--warning-l);color:var(--warning)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="dash-card-value">${fmt(data.monthRevenue)}</div>
        <div class="dash-card-label">Month Revenue</div>
        <div class="dash-card-sub">View cash flow &rarr;</div>
      </div>
    </div>

    <div class="card mt-24">
      <div class="card-header">
        <h3 class="card-title">Recent Orders</h3>
        <a href="#/orders" class="btn btn-ghost btn-sm">View all</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.recentOrders.length ? data.recentOrders.map(o => `
              <tr class="clickable" data-nav="/orders/${o.id}">
                <td><strong>${o.order_number || '#' + o.id}</strong></td>
                <td>${o.customer_name || '<span class="text-muted">Guest</span>'}</td>
                <td class="fw-bold">${fmt(o.total, o.currency)}</td>
                <td>${statusBadge(o.payment_status)}</td>
                <td class="text-muted">${timeAgo(o.created_at)}</td>
              </tr>
            `).join('') : `<tr><td colspan="5" class="text-center text-muted" style="padding:32px">No orders yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => { location.hash = '#' + el.dataset.nav; });
  });
}
