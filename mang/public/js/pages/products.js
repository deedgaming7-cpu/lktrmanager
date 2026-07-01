import { api } from '../api.js';
import { fmt, fmtDate, toast, confirm, openModal, debounce } from '../utils.js';

export const title = 'Stock & Products';

let state = { search: '', category: '', offset: 0, limit: 30 };

export async function render(container, params) {
  if (params && params.id) return renderDetail(container, params.id);
  return renderList(container);
}

async function renderList(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  await loadList(container);
}

async function loadList(container) {
  const data = await api.products.list(state);
  const { products, total, categories } = data;

  container.innerHTML = `
    <div class="filters-bar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search products…" id="prod-search" value="${state.search}">
      </div>
      <select class="filter-select" id="prod-cat">
        <option value="">All Categories</option>
        ${categories.map(c => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="btn-new-prod">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Product
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Products <span style="color:var(--text-3);font-weight:400;font-size:13px">(${total})</span></h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th class="text-right">Cost</th>
              <th class="text-right">Price</th>
              <th class="text-right">Margin</th>
              <th class="text-right">Stock</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products.length ? products.map(p => {
              const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(0) : 0;
              const stockClass = p.stock <= 0 ? 'danger' : p.stock <= p.low_stock_threshold ? 'warning' : 'success';
              return `
                <tr class="clickable" data-id="${p.id}">
                  <td>
                    <div class="flex items-center gap-8">
                      ${p.image_url ? `<img src="${p.image_url}" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid var(--border)">` : `<div style="width:36px;height:36px;border-radius:6px;background:var(--border);flex-shrink:0"></div>`}
                      <strong>${p.name}</strong>
                    </div>
                  </td>
                  <td class="text-muted">${p.sku || '—'}</td>
                  <td>${p.category ? `<span class="tag">${p.category}</span>` : '—'}</td>
                  <td class="text-right">${fmt(p.cost)}</td>
                  <td class="text-right fw-bold">${fmt(p.price)}</td>
                  <td class="text-right text-${margin >= 30 ? 'success' : margin >= 10 ? 'warning' : 'danger'}">${margin}%</td>
                  <td class="text-right">
                    <span class="text-${stockClass} fw-bold">${p.stock}</span>
                    <div class="stock-bar" style="width:60px;display:inline-block;vertical-align:middle;margin-left:8px">
                      <div class="stock-bar-fill" style="width:${Math.min(100, p.stock / Math.max(p.low_stock_threshold * 4, 1) * 100)}%;background:var(--${stockClass})"></div>
                    </div>
                  </td>
                  <td>
                    <div class="flex gap-8" style="justify-content:flex-end">
                      <button class="btn btn-ghost btn-icon btn-sm" data-action="stock" data-id="${p.id}" title="Adjust Stock">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                      <button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${p.id}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') : `<tr><td colspan="8"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><h3>No products found</h3><p>Add your first product to get started</p></div></td></tr>`}
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

  const search = container.querySelector('#prod-search');
  const catSel = container.querySelector('#prod-cat');
  const reload = debounce(() => loadList(container), 300);

  search.addEventListener('input', () => { state.search = search.value; state.offset = 0; reload(); });
  catSel.addEventListener('change', () => { state.category = catSel.value; state.offset = 0; loadList(container); });
  container.querySelector('#btn-prev')?.addEventListener('click', () => { state.offset -= state.limit; loadList(container); });
  container.querySelector('#btn-next')?.addEventListener('click', () => { state.offset += state.limit; loadList(container); });
  container.querySelector('#btn-new-prod').addEventListener('click', () => showProductForm(container));

  container.querySelectorAll('tr.clickable[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      location.hash = `#/products/${row.dataset.id}`;
    });
  });

  container.querySelectorAll('[data-action="stock"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showStockModal(container, btn.dataset.id); });
  });
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => { e.stopPropagation(); const p = await api.products.get(btn.dataset.id); showProductForm(container, p); });
  });
}

async function renderDetail(container, id) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  const p = await api.products.get(id);

  const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(1) : 0;
  const stockClass = p.stock <= 0 ? 'danger' : p.stock <= p.low_stock_threshold ? 'warning' : 'success';

  container.innerHTML = `
    <div class="detail-header">
      <a href="#/products" class="back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Products
      </a>
      <h2 class="detail-title">${p.name}</h2>
      <div class="flex gap-8">
        <button class="btn btn-outline btn-sm" id="btn-stock">Adjust Stock</button>
        <button class="btn btn-primary btn-sm" id="btn-edit">Edit</button>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="card mb-16">
          <div class="card-header"><h3 class="card-title">Product Details</h3></div>
          <div class="card-body">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-bottom:16px">` : ''}
            <div class="info-list">
              <div class="info-row"><span class="info-key">SKU</span><span class="info-val">${p.sku || '—'}</span></div>
              <div class="info-row"><span class="info-key">Category</span><span class="info-val">${p.category || '—'}</span></div>
              <div class="info-row"><span class="info-key">Cost Price</span><span class="info-val fw-bold">${fmt(p.cost)}</span></div>
              <div class="info-row"><span class="info-key">Sell Price</span><span class="info-val fw-bold">${fmt(p.price)}</span></div>
              <div class="info-row"><span class="info-key">Margin</span><span class="info-val text-${+margin >= 30 ? 'success' : +margin >= 10 ? 'warning' : 'danger'} fw-bold">${margin}%</span></div>
              ${p.description ? `<div class="info-row"><span class="info-key">Description</span><span class="info-val" style="white-space:pre-wrap">${p.description}</span></div>` : ''}
            </div>
          </div>
        </div>

        ${p.recentSales.length ? `
          <div class="card">
            <div class="card-header"><h3 class="card-title">Recent Sales</h3></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Order</th><th>Customer</th><th class="text-right">Qty</th><th class="text-right">Price</th><th>Date</th></tr></thead>
                <tbody>
                  ${p.recentSales.map(s => `
                    <tr>
                      <td><a href="#/orders/${s.order_id}" style="color:var(--primary)">${s.order_number || '—'}</a></td>
                      <td>${s.customer_name || '—'}</td>
                      <td class="text-right">${s.quantity}</td>
                      <td class="text-right">${fmt(s.price)}</td>
                      <td class="text-muted">${fmtDate(s.created_at)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>` : ''}
      </div>

      <div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Stock Level</h3></div>
          <div class="card-body" style="text-align:center">
            <div style="font-size:48px;font-weight:800;color:var(--${stockClass})">${p.stock}</div>
            <div style="font-size:14px;color:var(--text-2);margin-bottom:16px">units in stock</div>
            <div class="stock-bar" style="height:10px;margin-bottom:8px">
              <div class="stock-bar-fill" style="width:${Math.min(100, p.stock / Math.max(p.low_stock_threshold * 4, 1) * 100)}%;background:var(--${stockClass})"></div>
            </div>
            <div style="font-size:12px;color:var(--text-3)">Low stock threshold: ${p.low_stock_threshold}</div>
            <button class="btn btn-primary w-full mt-16" id="btn-stock-detail">Adjust Stock</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const showStock = () => showStockModal(container, id, () => renderDetail(container, id));
  container.querySelector('#btn-stock')?.addEventListener('click', showStock);
  container.querySelector('#btn-stock-detail')?.addEventListener('click', showStock);
  container.querySelector('#btn-edit')?.addEventListener('click', () => showProductForm(container, p, () => renderDetail(container, id)));
}

function showStockModal(container, id, onDone) {
  const backdrop = openModal('Adjust Stock', `
    <div class="form-group">
      <label class="form-label">Adjustment Type</label>
      <select class="form-control" id="stock-type">
        <option value="adjust">Adjust (+ or -)</option>
        <option value="set">Set Absolute Value</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Amount</label>
      <input class="form-control" id="stock-amount" type="number" value="0" placeholder="e.g. 10 or -5">
    </div>
  `, `
    <button class="btn btn-outline" id="s-cancel">Cancel</button>
    <button class="btn btn-primary" id="s-save">Update Stock</button>
  `);

  backdrop.querySelector('#s-cancel').onclick = () => backdrop.remove();
  backdrop.querySelector('#s-save').onclick = async () => {
    const type = backdrop.querySelector('#stock-type').value;
    const amount = +backdrop.querySelector('#stock-amount').value;
    try {
      if (type === 'set') await api.products.updateStock(id, { absolute: amount });
      else await api.products.updateStock(id, { adjustment: amount });
      backdrop.remove();
      toast('Stock updated', 'success');
      if (onDone) onDone(); else loadList(container);
    } catch (err) { toast(err.message, 'error'); }
  };
}

function showProductForm(container, product = null, onDone) {
  const isEdit = !!product;
  const backdrop = openModal(isEdit ? 'Edit Product' : 'New Product', `
    <div class="form-group">
      <label class="form-label">Product Name *</label>
      <input class="form-control" id="p-name" value="${product?.name || ''}" placeholder="Product name">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">SKU</label>
        <input class="form-control" id="p-sku" value="${product?.sku || ''}" placeholder="SKU-001">
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <input class="form-control" id="p-cat" value="${product?.category || ''}" placeholder="e.g. Clothing">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Cost Price</label>
        <input class="form-control" id="p-cost" type="number" value="${product?.cost || 0}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Sell Price</label>
        <input class="form-control" id="p-price" type="number" value="${product?.price || 0}" min="0" step="0.01">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Stock</label>
        <input class="form-control" id="p-stock" type="number" value="${product?.stock || 0}" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Low Stock Alert</label>
        <input class="form-control" id="p-threshold" type="number" value="${product?.low_stock_threshold || 5}" min="0">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Image URL</label>
      <input class="form-control" id="p-img" value="${product?.image_url || ''}" placeholder="https://...">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-control" id="p-desc" rows="3">${product?.description || ''}</textarea>
    </div>
  `, `
    <button class="btn btn-outline" id="p-cancel">Cancel</button>
    ${isEdit ? `<button class="btn btn-danger" id="p-delete">Delete</button>` : ''}
    <button class="btn btn-primary" id="p-save">${isEdit ? 'Save Changes' : 'Create Product'}</button>
  `);

  backdrop.querySelector('#p-cancel').onclick = () => backdrop.remove();

  if (isEdit) {
    backdrop.querySelector('#p-delete').onclick = async () => {
      const ok = await confirm('Delete this product? This cannot be undone.');
      if (!ok) return;
      await api.products.delete(product.id);
      backdrop.remove();
      toast('Product deleted', 'success');
      if (onDone) onDone(); else { location.hash = '#/products'; }
    };
  }

  backdrop.querySelector('#p-save').onclick = async () => {
    const name = backdrop.querySelector('#p-name').value.trim();
    if (!name) { toast('Product name is required', 'error'); return; }
    const body = {
      name,
      sku: backdrop.querySelector('#p-sku').value,
      category: backdrop.querySelector('#p-cat').value,
      cost: +backdrop.querySelector('#p-cost').value,
      price: +backdrop.querySelector('#p-price').value,
      stock: +backdrop.querySelector('#p-stock').value,
      low_stock_threshold: +backdrop.querySelector('#p-threshold').value,
      image_url: backdrop.querySelector('#p-img').value,
      description: backdrop.querySelector('#p-desc').value,
    };
    try {
      if (isEdit) await api.products.update(product.id, body);
      else await api.products.create(body);
      backdrop.remove();
      toast(isEdit ? 'Product updated' : 'Product created', 'success');
      if (onDone) onDone(); else loadList(container);
    } catch (err) { toast(err.message, 'error'); }
  };
}
