async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('unauthorized'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  auth: {
    me: () => request('GET', '/api/auth/me'),
    login: (username, password) => request('POST', '/api/auth/login', { username, password }),
    logout: () => request('POST', '/api/auth/logout'),
  },
  // Users / admins
  users: {
    list: () => request('GET', '/api/users'),
    create: (data) => request('POST', '/api/users', data),
    setPassword: (id, password) => request('PUT', `/api/users/${id}/password`, { password }),
    delete: (id) => request('DELETE', `/api/users/${id}`),
  },
  // Settings
  settings: {
    get: () => request('GET', '/api/settings'),
    save: (data) => request('PUT', '/api/settings', data),
  },
  // Dashboard
  dashboard: {
    get: () => request('GET', '/api/dashboard'),
  },
  // Customers
  customers: {
    list: (params = {}) => request('GET', '/api/customers?' + new URLSearchParams(params)),
    get: (id) => request('GET', `/api/customers/${id}`),
    create: (data) => request('POST', '/api/customers', data),
    update: (id, data) => request('PUT', `/api/customers/${id}`, data),
    delete: (id) => request('DELETE', `/api/customers/${id}`),
  },
  // Products
  products: {
    list: (params = {}) => request('GET', '/api/products?' + new URLSearchParams(params)),
    get: (id) => request('GET', `/api/products/${id}`),
    create: (data) => request('POST', '/api/products', data),
    update: (id, data) => request('PUT', `/api/products/${id}`, data),
    updateStock: (id, data) => request('PATCH', `/api/products/${id}/stock`, data),
    delete: (id) => request('DELETE', `/api/products/${id}`),
  },
  // Orders
  orders: {
    list: (params = {}) => request('GET', '/api/orders?' + new URLSearchParams(params)),
    get: (id) => request('GET', `/api/orders/${id}`),
    create: (data) => request('POST', '/api/orders', data),
    update: (id, data) => request('PUT', `/api/orders/${id}`, data),
    pay: (id, payment_method) => request('PATCH', `/api/orders/${id}/pay`, { payment_method }),
    return: (id) => request('PATCH', `/api/orders/${id}/return`),
    delete: (id) => request('DELETE', `/api/orders/${id}`),
    couponUrl: (id) => `/api/orders/${id}/coupon`,
  },
  // Cash
  cash: {
    summary: (params = {}) => request('GET', '/api/cash/summary?' + new URLSearchParams(params)),
    movements: (params = {}) => request('GET', '/api/cash/movements?' + new URLSearchParams(params)),
  },
  // Expenses
  expenses: {
    list: (params = {}) => request('GET', '/api/expenses?' + new URLSearchParams(params)),
    create: (data) => request('POST', '/api/expenses', data),
    update: (id, data) => request('PUT', `/api/expenses/${id}`, data),
    delete: (id) => request('DELETE', `/api/expenses/${id}`),
  },
  // Reports
  reports: {
    summary: (params = {}) => request('GET', '/api/reports/summary?' + new URLSearchParams(params)),
    byDay: (params = {}) => request('GET', '/api/reports/orders-by-day?' + new URLSearchParams(params)),
    topProducts: (params = {}) => request('GET', '/api/reports/top-products?' + new URLSearchParams(params)),
    expensesByCategory: (params = {}) => request('GET', '/api/reports/expenses-by-category?' + new URLSearchParams(params)),
  },
  // Shopify
  shopify: {
    sync: () => request('POST', '/api/shopify/sync'),
    status: () => request('GET', '/api/shopify/status'),
  },
};
