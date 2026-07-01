import { api } from '../api.js';
import { fmt, fmtDate, toast, confirm, openModal, debounce } from '../utils.js';

export const title = 'Expenses';

let state = { category: '', offset: 0, limit: 30, period: '' };

export async function render(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  await loadList(container);
}

async function loadList(container) {
  const data = await api.expenses.list(state);
  const { expenses, total, sum, categories } = data;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Expenses</h2>
        <p>Total: <strong>${fmt(sum)}</strong></p>
      </div>
      <button class="btn btn-primary" id="btn-new-exp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Expense
      </button>
    </div>

    <div class="filters-bar">
      <select class="filter-select" id="exp-cat">
        <option value="">All Categories</option>
        ${categories.map(c => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="filter-select" id="exp-period">
        <option value="" ${state.period === '' ? 'selected' : ''}>All time</option>
        <option value="7" ${state.period === '7' ? 'selected' : ''}>Last 7 days</option>
        <option value="30" ${state.period === '30' ? 'selected' : ''}>Last 30 days</option>
        <option value="90" ${state.period === '90' ? 'selected' : ''}>Last 90 days</option>
      </select>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Expenses <span style="color:var(--text-3);font-weight:400;font-size:13px">(${total})</span></h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Notes</th>
              <th class="text-right">Amount</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.length ? expenses.map(e => `
              <tr>
                <td class="text-muted" style="white-space:nowrap">${fmtDate(e.date)}</td>
                <td>${e.category ? `<span class="tag">${e.category}</span>` : '—'}</td>
                <td><strong>${e.description}</strong></td>
                <td class="text-muted">${e.notes || '—'}</td>
                <td class="text-right fw-bold text-danger">${fmt(e.amount)}</td>
                <td>
                  <div class="flex gap-8" style="justify-content:flex-end">
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${e.id}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-action="delete" data-id="${e.id}" style="color:var(--danger)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="6"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg><h3>No expenses yet</h3><p>Track your store costs here</p></div></td></tr>`}
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

  container.querySelector('#exp-cat').addEventListener('change', e => { state.category = e.target.value; state.offset = 0; loadList(container); });
  container.querySelector('#exp-period').addEventListener('change', e => { state.period = e.target.value; state.offset = 0; loadList(container); });
  container.querySelector('#btn-prev')?.addEventListener('click', () => { state.offset -= state.limit; loadList(container); });
  container.querySelector('#btn-next')?.addEventListener('click', () => { state.offset += state.limit; loadList(container); });
  container.querySelector('#btn-new-exp').addEventListener('click', () => showExpenseForm(container));

  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const all = await api.expenses.list({ limit: 1000 });
      const exp = all.expenses.find(e => e.id == btn.dataset.id);
      if (exp) showExpenseForm(container, exp);
    });
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirm('Delete this expense?');
      if (!ok) return;
      await api.expenses.delete(btn.dataset.id);
      toast('Expense deleted', 'success');
      loadList(container);
    });
  });
}

function showExpenseForm(container, expense = null) {
  const isEdit = !!expense;
  const today = new Date().toISOString().split('T')[0];
  const backdrop = openModal(isEdit ? 'Edit Expense' : 'New Expense', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-control" id="e-date" type="date" value="${expense?.date?.split('T')[0] || today}">
      </div>
      <div class="form-group">
        <label class="form-label">Amount *</label>
        <input class="form-control" id="e-amount" type="number" value="${expense?.amount || 0}" min="0" step="0.01">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <input class="form-control" id="e-cat" list="exp-cats" value="${expense?.category || ''}" placeholder="e.g. Shipping, Marketing">
      <datalist id="exp-cats">
        <option>Shipping</option><option>Marketing</option><option>Packaging</option>
        <option>Software</option><option>Office</option><option>Payroll</option><option>Other</option>
      </datalist>
    </div>
    <div class="form-group">
      <label class="form-label">Description *</label>
      <input class="form-control" id="e-desc" value="${expense?.description || ''}" placeholder="Brief description">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-control" id="e-notes">${expense?.notes || ''}</textarea>
    </div>
  `, `
    <button class="btn btn-outline" id="e-cancel">Cancel</button>
    <button class="btn btn-primary" id="e-save">${isEdit ? 'Save Changes' : 'Add Expense'}</button>
  `);

  backdrop.querySelector('#e-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#e-save').onclick = async () => {
    const desc = backdrop.querySelector('#e-desc').value.trim();
    const amount = +backdrop.querySelector('#e-amount').value;
    if (!desc) { toast('Description is required', 'error'); return; }
    if (!amount) { toast('Amount must be greater than 0', 'error'); return; }
    const body = {
      date: backdrop.querySelector('#e-date').value,
      amount,
      category: backdrop.querySelector('#e-cat').value || 'other',
      description: desc,
      notes: backdrop.querySelector('#e-notes').value,
    };
    try {
      if (isEdit) await api.expenses.update(expense.id, body);
      else await api.expenses.create(body);
      backdrop.remove();
      toast(isEdit ? 'Expense updated' : 'Expense added', 'success');
      loadList(container);
    } catch (err) { toast(err.message, 'error'); }
  };
}
