import { api } from '../api.js';
import { fmt, fmtDate } from '../utils.js';

export const title = 'Reports';

export async function render(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  let period = '30';

  async function load() {
    const [summary, topProducts, byDay, expCats] = await Promise.all([
      api.reports.summary({ period }),
      api.reports.topProducts({ period, limit: 8 }),
      api.reports.byDay({ period }),
      api.reports.expensesByCategory({ period }),
    ]);

    const maxRevenue = Math.max(...(byDay.rows.map(r => r.revenue) || [1]), 1);
    const maxProdRev = Math.max(...(topProducts.rows.map(r => r.revenue) || [1]), 1);
    const maxExpCat = Math.max(...(expCats.rows.map(r => r.total) || [1]), 1);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Reports & Analytics</h2>
          <p>Performance overview</p>
        </div>
        <select class="filter-select" id="rep-period">
          <option value="7" ${period === '7' ? 'selected' : ''}>Last 7 days</option>
          <option value="30" ${period === '30' ? 'selected' : ''}>Last 30 days</option>
          <option value="90" ${period === '90' ? 'selected' : ''}>Last 90 days</option>
          <option value="365" ${period === '365' ? 'selected' : ''}>Last year</option>
        </select>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div>
          <div class="stat-label">Revenue</div>
          <div class="stat-value success">${fmt(summary.revenue)}</div>
          <div class="stat-sub">${summary.paidCount} paid orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 19 14 19"/><path d="M20 4a7 7 0 01-7 7H4"/></svg></div>
          <div class="stat-label">Refunds</div>
          <div class="stat-value danger">${fmt(summary.refunds)}</div>
          <div class="stat-sub">returned orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
          <div class="stat-label">Product Costs</div>
          <div class="stat-value">${fmt(summary.costs)}</div>
          <div class="stat-sub">cost of goods sold</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
          <div class="stat-label">Expenses</div>
          <div class="stat-value danger">${fmt(summary.expenses)}</div>
          <div class="stat-sub">operational costs</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${summary.grossProfit >= 0 ? 'success' : 'danger'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="stat-label">Gross Profit</div>
          <div class="stat-value ${summary.grossProfit >= 0 ? 'success' : 'danger'}">${fmt(summary.grossProfit)}</div>
          <div class="stat-sub">revenue - costs - refunds</div>
        </div>
        <div class="stat-card" style="border-color:${summary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">
          <div class="stat-icon ${summary.netProfit >= 0 ? 'success' : 'danger'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
          <div class="stat-label">Net Profit</div>
          <div class="stat-value ${summary.netProfit >= 0 ? 'success' : 'danger'}">${fmt(summary.netProfit)}</div>
          <div class="stat-sub">gross profit - expenses</div>
        </div>
      </div>

      <div class="dash-grid mt-24">
        <!-- Revenue over time -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Revenue by Day</h3></div>
          <div class="card-body">
            ${byDay.rows.length ? `
              <div style="display:flex;align-items:flex-end;gap:4px;height:100px;margin-bottom:8px">
                ${byDay.rows.map(r => `
                  <div title="${fmtDate(r.day)}: ${fmt(r.revenue)}" style="flex:1;background:var(--primary);border-radius:3px 3px 0 0;height:${Math.max(4, (r.revenue / maxRevenue) * 100)}%;min-width:4px;cursor:pointer" class="chart-bar-daily"></div>
                `).join('')}
              </div>
              <div class="flex justify-between" style="font-size:11px;color:var(--text-3)">
                <span>${fmtDate(byDay.rows[0]?.day)}</span>
                <span>${fmtDate(byDay.rows[byDay.rows.length - 1]?.day)}</span>
              </div>
            ` : '<p class="text-muted text-center" style="padding:32px 0">No data yet</p>'}
          </div>
        </div>

        <!-- Order stats -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Order Stats</h3></div>
          <div class="card-body">
            <div class="info-list">
              <div class="info-row"><span class="info-key">Total Orders</span><span class="info-val fw-bold">${summary.orderCount}</span></div>
              <div class="info-row"><span class="info-key">Paid Orders</span><span class="info-val fw-bold text-success">${summary.paidCount}</span></div>
              <div class="info-row"><span class="info-key">New Customers</span><span class="info-val fw-bold text-primary">${summary.newCustomers}</span></div>
              <div class="info-row">
                <span class="info-key">Avg Order Value</span>
                <span class="info-val fw-bold">${summary.paidCount > 0 ? fmt(summary.revenue / summary.paidCount) : fmt(0)}</span>
              </div>
              <div class="info-row">
                <span class="info-key">Gross Margin</span>
                <span class="info-val fw-bold ${summary.revenue > 0 && (summary.grossProfit / summary.revenue) >= 0.2 ? 'text-success' : 'text-danger'}">
                  ${summary.revenue > 0 ? ((summary.grossProfit / summary.revenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top products -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Top Products by Revenue</h3></div>
          <div class="card-body">
            ${topProducts.rows.length ? `
              <div class="chart-bar-list">
                ${topProducts.rows.map(p => `
                  <div class="chart-bar-row">
                    <span class="chart-bar-label" title="${p.name}">${p.name}</span>
                    <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(p.revenue / maxProdRev * 100).toFixed(1)}%"></div></div>
                    <span class="chart-bar-val">${fmt(p.revenue)}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-muted text-center" style="padding:24px 0">No sales data</p>'}
          </div>
        </div>

        <!-- Expenses by category -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Expenses by Category</h3></div>
          <div class="card-body">
            ${expCats.rows.length ? `
              <div class="chart-bar-list">
                ${expCats.rows.map(e => `
                  <div class="chart-bar-row">
                    <span class="chart-bar-label">${e.category || 'Other'}</span>
                    <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(e.total / maxExpCat * 100).toFixed(1)}%;background:var(--danger)"></div></div>
                    <span class="chart-bar-val">${fmt(e.total)}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-muted text-center" style="padding:24px 0">No expenses yet</p>'}
          </div>
        </div>
      </div>
    `;

    container.querySelector('#rep-period').addEventListener('change', e => {
      period = e.target.value;
      load();
    });

    // Tooltip on bar hover
    container.querySelectorAll('.chart-bar-daily').forEach((bar, i) => {
      const row = byDay.rows[i];
      if (row) bar.title = `${fmtDate(row.day)}: ${fmt(row.revenue)} (${row.count} orders)`;
    });
  }

  await load();
}
