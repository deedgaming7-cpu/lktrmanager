export function fmt(amount, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(+amount || 0);
}

export function fmtDate(dt) {
  if (!dt) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dt));
}

export function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dt));
}

export function timeAgo(dt) {
  const s = Math.floor((Date.now() - new Date(dt)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function statusBadge(status) {
  const map = {
    pending: ['badge-warning', 'Pending'],
    processing: ['badge-info', 'Processing'],
    completed: ['badge-success', 'Completed'],
    cancelled: ['badge-danger', 'Cancelled'],
    paid: ['badge-success', 'Paid'],
    refunded: ['badge-danger', 'Refunded'],
    unfulfilled: ['badge-warning', 'Unfulfilled'],
    fulfilled: ['badge-success', 'Fulfilled'],
    partial: ['badge-info', 'Partial'],
    active: ['badge-success', 'Active'],
    inactive: ['badge-default', 'Inactive'],
  };
  const [cls, label] = map[status] || ['badge-default', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function toast(msg, type = 'default', duration = 3000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      ${type === 'success' ? '<polyline points="20 6 9 17 4 12"/>' :
        type === 'error' ? '<path d="M18 6L6 18M6 6l12 12"/>' :
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
    </svg>
    <span>${msg}</span>
  `;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function confirm(msg) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-body" style="padding:24px;text-align:center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="margin-bottom:12px">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px">Confirm Action</p>
          <p style="font-size:14px;color:var(--text-2)">${msg}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="cfm-no">Cancel</button>
          <button class="btn btn-danger" id="cfm-yes">Confirm</button>
        </div>
      </div>
    `;
    document.getElementById('modal-container').appendChild(backdrop);
    backdrop.querySelector('#cfm-yes').onclick = () => { backdrop.remove(); resolve(true); };
    backdrop.querySelector('#cfm-no').onclick = () => { backdrop.remove(); resolve(false); };
  });
}

export function openModal(title, bodyHtml, footerHtml = '') {
  const container = document.getElementById('modal-container');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close btn-ghost btn-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  container.appendChild(backdrop);
  backdrop.querySelector('.modal-close').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  return backdrop;
}

export function closeModal() {
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function qs(sel, ctx = document) { return ctx.querySelector(sel); }
export function on(el, ev, fn) { el && el.addEventListener(ev, fn); }
