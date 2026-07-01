import { api } from '../api.js';
import { fmt, fmtDate } from '../utils.js';

export const title = 'Cash';

export async function render(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;

  let period = '30';

  async function load() {
    const [summary, movements] = await Promise.all([
      api.cash.summary({ period }),
      api.cash.movements({ limit: 30 }),
    ]);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Cash Flow</h2>
          <p>Money flow overview</p>
        </div>
        <select class="filter-select" id="cash-period">
          <option value="7" ${period === '7' ? 'selected' : ''}>Last 7 days</option>
          <option value="30" ${period === '30' ? 'selected' : ''}>Last 30 days</option>
          <option value="90" ${period === '90' ? 'selected' : ''}>Last 90 days</option>
          <option value="365" ${period === '365' ? 'selected' : ''}>Last year</option>
        </select>
      </div>

      <div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
        <div class="stat-card">
          <div class="stat-icon success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="stat-label">Collected Cash</div>
          <div class="stat-value success">${fmt(summary.collected)}</div>
          <div class="stat-sub">${summary.totalOrders} paid orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-label">Expected Cash</div>
          <div class="stat-value warning">${fmt(summary.expected)}</div>
          <div class="stat-sub">from pending orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 19 14 19"/><path d="M20 4a7 7 0 01-7 7H4"/></svg>
          </div>
          <div class="stat-label">Refunded Cash</div>
          <div class="stat-value danger">${fmt(summary.refunded)}</div>
          <div class="stat-sub">returned orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value danger">${fmt(summary.expenses)}</div>
          <div class="stat-sub">costs in period</div>
        </div>
        <div class="stat-card" style="border-color:${summary.net >= 0 ? 'var(--success)' : 'var(--danger)'}">
          <div class="stat-icon ${summary.net >= 0 ? 'success' : 'danger'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div class="stat-label">Net Cash</div>
          <div class="stat-value ${summary.net >= 0 ? 'success' : 'danger'}">${fmt(summary.net)}</div>
          <div class="stat-sub">collected - refunded - expenses</div>
        </div>
      </div>

      <div class="card mt-24">
        <div class="card-header">
          <h3 class="card-title">Recent Movements</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Reference</th>
                <th>Description</th>
                <th class="text-right">Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${movements.movements.length ? movements.movements.map(m => {
                const isPositive = m.amount > 0;
                const typeLabel = m.type === 'expense' ? 'Expense' : m.status === 'refunded' ? 'Refund' : 'Sale';
                const typeClass = m.type === 'expense' ? 'danger' : m.status === 'refunded' ? 'warning' : 'success';
                return `
                  <tr>
                    <td><span class="badge badge-${typeClass}">${typeLabel}</span></td>
                    <td class="text-muted">${m.reference || '—'}</td>
                    <td>${m.description || '—'}</td>
                    <td class="text-right fw-bold ${isPositive ? 'text-success' : 'text-danger'}">
                      ${isPositive ? '+' : ''}${fmt(m.amount)}
                    </td>
                    <td class="text-muted">${fmtDate(m.created_at)}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="5" class="text-center text-muted" style="padding:32px">No transactions yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#cash-period').addEventListener('change', e => {
      period = e.target.value;
      load();
    });
  }

  await load();
}
