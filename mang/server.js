const express = require('express');
const path = require('path');
const cron = require('node-cron');
const QRCode = require('qrcode');
const { initDB, getDB } = require('./database');
const { syncShopify, getShopifyStatus } = require('./shopify');
const {
  hashPassword, verifyPassword, getCookie,
  createSession, destroySession, userFromRequest, requireAuth, ensureDefaultAdmin,
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

initDB();
ensureDefaultAdmin();

const COOKIE_BASE = `HttpOnly; Path=/; SameSite=Lax`;

// ─── AUTH (public endpoints) ─────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const db = getDB();
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || '').trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = createSession(user.id);
  res.setHeader('Set-Cookie', `sid=${token}; ${COOKIE_BASE}; Max-Age=${30 * 86400}`);
  res.json({ id: user.id, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(getCookie(req, 'sid'));
  res.setHeader('Set-Cookie', `sid=; ${COOKIE_BASE}; Max-Age=0`);
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

// ─── Everything below requires a valid session ───────────────────────────────
app.use('/api', requireAuth);

// ─── USERS / ADMINS ──────────────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, username, created_at FROM users ORDER BY id ASC').all();
  res.json({ users, currentUserId: req.user.id });
});

app.post('/api/users', (req, res) => {
  const db = getDB();
  const { username, password } = req.body || {};
  const u = String(username || '').trim();
  if (!u || !password) return res.status(400).json({ error: 'Username and password are required' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (db.prepare('SELECT id FROM users WHERE username=?').get(u)) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const info = db.prepare('INSERT INTO users (username,password_hash,created_at) VALUES (?,?,?)')
    .run(u, hashPassword(password), new Date().toISOString());
  res.json({ id: info.lastInsertRowid, username: u });
});

app.put('/api/users/:id/password', (req, res) => {
  const db = getDB();
  const { password } = req.body || {};
  if (!password || String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  const db = getDB();
  const id = +req.params.id;
  if (req.user.id === id) return res.status(400).json({ error: "You can't delete your own account" });
  const { c } = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (c <= 1) return res.status(400).json({ error: 'At least one admin must remain' });
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  res.json({ success: true });
});

// ─── SETTINGS ───────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  rows.forEach(r => { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } });
  res.json(out);
});

app.put('/api/settings', (req, res) => {
  const db = getDB();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  const tx = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) stmt.run(k, JSON.stringify(v));
  });
  tx(req.body);
  res.json({ success: true });
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
app.get('/api/customers', (req, res) => {
  const db = getDB();
  const { search = '', limit = 50, offset = 0 } = req.query;
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
  const where = search ? 'WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?' : '';
  const customers = db.prepare(`SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, +limit, +offset);
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM customers ${where}`).get(...params);
  res.json({ customers, total: count });
});

app.get('/api/customers/:id', (req, res) => {
  const db = getDB();
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Not found' });
  const orders = db.prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...customer, orders });
});

app.post('/api/customers', (req, res) => {
  const db = getDB();
  const { name, email, phone, address, city, country, notes } = req.body;
  const info = db.prepare(`INSERT INTO customers (name,email,phone,address,city,country,notes) VALUES (?,?,?,?,?,?,?)`)
    .run(name, email || '', phone || '', address || '', city || '', country || '', notes || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/customers/:id', (req, res) => {
  const db = getDB();
  const { name, email, phone, address, city, country, notes } = req.body;
  db.prepare(`UPDATE customers SET name=?,email=?,phone=?,address=?,city=?,country=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(name, email || '', phone || '', address || '', city || '', country || '', notes || '', req.params.id);
  res.json({ success: true });
});

app.delete('/api/customers/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const db = getDB();
  const { search = '', category = '', limit = 50, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  if (search) { conditions.push('(name LIKE ? OR sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category) { conditions.push('category=?'); params.push(category); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const products = db.prepare(`SELECT * FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`)
    .all(...params, +limit, +offset);
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params);
  const categories = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""').all().map(r => r.category);
  res.json({ products, total: count, categories });
});

app.get('/api/products/:id', (req, res) => {
  const db = getDB();
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Not found' });
  const recentSales = db.prepare(`
    SELECT oi.quantity, oi.price, o.created_at, o.order_number, o.customer_name
    FROM order_items oi JOIN orders o ON oi.order_id=o.id
    WHERE oi.product_id=? ORDER BY o.created_at DESC LIMIT 10
  `).all(req.params.id);
  res.json({ ...product, recentSales });
});

app.post('/api/products', (req, res) => {
  const db = getDB();
  const { name, sku, description, price, cost, stock, low_stock_threshold, category, image_url } = req.body;
  const info = db.prepare(`
    INSERT INTO products (name,sku,description,price,cost,stock,low_stock_threshold,category,image_url)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(name, sku || '', description || '', +price || 0, +cost || 0, +stock || 0, +low_stock_threshold || 5, category || '', image_url || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', (req, res) => {
  const db = getDB();
  const { name, sku, description, price, cost, stock, low_stock_threshold, category, image_url, active } = req.body;
  db.prepare(`
    UPDATE products SET name=?,sku=?,description=?,price=?,cost=?,stock=?,low_stock_threshold=?,
    category=?,image_url=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, sku || '', description || '', +price || 0, +cost || 0, +stock || 0,
    +low_stock_threshold || 5, category || '', image_url || '', active !== false ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.patch('/api/products/:id/stock', (req, res) => {
  const db = getDB();
  const { adjustment, absolute } = req.body;
  if (absolute !== undefined) {
    db.prepare('UPDATE products SET stock=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(+absolute, req.params.id);
  } else {
    db.prepare('UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(+adjustment, req.params.id);
  }
  const product = db.prepare('SELECT stock FROM products WHERE id=?').get(req.params.id);
  res.json({ stock: product.stock });
});

app.delete('/api/products/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────
app.get('/api/orders', (req, res) => {
  const db = getDB();
  const { search = '', status = '', payment = '', limit = 50, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  if (search) { conditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { conditions.push('o.status=?'); params.push(status); }
  if (payment) { conditions.push('o.payment_status=?'); params.push(payment); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const orders = db.prepare(`SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, +limit, +offset);
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM orders o ${where}`).get(...params);
  res.json({ orders, total: count });
});

app.get('/api/orders/:id', (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(req.params.id);
  const customer = order.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(order.customer_id) : null;
  res.json({ ...order, items, customer });
});

app.post('/api/orders', (req, res) => {
  const db = getDB();
  const { customer_id, customer_name, customer_email, items = [], shipping, discount, tax, notes, shipping_address, currency, payment_method } = req.body;
  const subtotal = items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const total = subtotal + (+shipping || 0) - (+discount || 0) + (+tax || 0);
  const orderNum = 'ORD-' + Date.now();

  const info = db.prepare(`
    INSERT INTO orders (order_number,customer_id,customer_name,customer_email,subtotal,shipping,discount,tax,total,currency,notes,shipping_address,payment_method)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(orderNum, customer_id || null, customer_name || '', customer_email || '',
    subtotal, +shipping || 0, +discount || 0, +tax || 0, total, currency || 'EUR',
    notes || '', shipping_address ? JSON.stringify(shipping_address) : null, payment_method || 'cash');

  const orderId = info.lastInsertRowid;
  const insertItem = db.prepare(`INSERT INTO order_items (order_id,product_id,name,sku,quantity,price,cost) VALUES (?,?,?,?,?,?,?)`);
  for (const item of items) {
    insertItem.run(orderId, item.product_id || null, item.name, item.sku || '', +item.quantity, +item.price, +item.cost || 0);
  }

  if (customer_id) {
    db.prepare('UPDATE customers SET total_orders=total_orders+1, total_spent=total_spent+?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(total, customer_id);
  }

  res.json({ id: orderId, order_number: orderNum });
});

app.put('/api/orders/:id', (req, res) => {
  const db = getDB();
  const { status, payment_status, fulfillment_status, notes } = req.body;
  db.prepare(`UPDATE orders SET status=?,payment_status=?,fulfillment_status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(status, payment_status, fulfillment_status || 'unfulfilled', notes || '', req.params.id);
  res.json({ success: true });
});

app.patch('/api/orders/:id/pay', (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const { payment_method } = req.body || {};
  if (payment_method) {
    db.prepare(`UPDATE orders SET payment_status='paid', status='completed', payment_method=?, paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(payment_method, req.params.id);
  } else {
    db.prepare(`UPDATE orders SET payment_status='paid', status='completed', paid_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
  }
  res.json({ success: true });
});

app.patch('/api/orders/:id/return', (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE orders SET payment_status='refunded', status='cancelled', returned_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
  if (order.customer_id) {
    db.prepare('UPDATE customers SET total_orders=MAX(0,total_orders-1), total_spent=MAX(0,total_spent-?), updated_at=CURRENT_TIMESTAMP WHERE id=?').run(order.total, order.customer_id);
  }
  res.json({ success: true });
});

app.delete('/api/orders/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM orders WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/orders/:id/coupon', async (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(req.params.id);
  const settings = {};
  db.prepare('SELECT key,value FROM settings').all().forEach(r => {
    try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
  });

  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // Business / fiscal details (Kosovo)
  const businessName = settings.store_name || 'My Store';
  const address = settings.store_address || '';
  const city = settings.store_city || '';
  const phone1 = settings.store_phone || '';
  const phone2 = settings.store_phone2 || '';
  const fiscalNumber = settings.fiscal_number || '';
  const vatNumber = settings.vat_number || '';
  const pef = settings.pef_number || '1';
  const operator = settings.operator_name || '';
  const serial = settings.fiscal_serial || '';
  const ej = settings.ej_number || '1';
  const fiscalSystemId = settings.fiscal_system_id || '';

  const money = v => (+v || 0).toFixed(2);
  const pad = n => String(n).padStart(2, '0');
  const d = new Date(order.paid_at || order.created_at);
  const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const docNr = String(order.id).padStart(8, '0');
  const couponNr = order.id;

  // Payment method (Mënyra e pagesës) — ASCII labels for thermal printers
  const methodMap = { cash: 'KESH', card: 'KARTELE', transfer: 'TRANSFERTE', other: 'TJETER' };
  const pm = order.payment_method || 'cash';
  const methodLabel = methodMap[pm] || 'KESH';

  // VAT (TVSH). Kosovo retail prices are VAT-inclusive, so the VAT portion is
  // extracted from the total. Priority: explicit order.tax, else the TVSH rate
  // configured in Settings (default_tax_rate). Letters: A=0%, B=8%, D=18%.
  const round2 = v => Math.round(v * 100) / 100;
  const total = +order.total || 0;
  const vatRate = +settings.default_tax_rate || 0;
  let vat, totalNoVat;
  if (+order.tax > 0) {
    vat = round2(+order.tax);
    totalNoVat = round2(total - vat);
  } else if (vatRate > 0) {
    vat = round2(total - total / (1 + vatRate / 100));
    totalNoVat = round2(total - vat);
  } else {
    vat = 0;
    totalNoVat = total;
  }
  const taxLetter = vat <= 0 ? 'A' : vatRate >= 18 ? 'D' : vatRate >= 8 ? 'B' : 'C';

  // Fiscal verification code (Kodi Fiskal) — deterministic from the coupon data
  const fiscalCodeOf = (str) => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(16).toUpperCase().padStart(8, '0');
  };
  const codeBase = `${fiscalNumber}|${docNr}|${dateStr} ${timeStr}|${money(total)}|${money(vat)}`;
  const fiscalCode = fiscalCodeOf(codeBase);

  // QR code (generated server-side → works fully offline). Encodes the
  // verification data required to identify the coupon.
  const qrPayload = [
    businessName,
    `NF:${fiscalNumber}`,
    `TVSH:${vatNumber}`,
    `Kupon:${couponNr}`,
    `Data:${dateStr} ${timeStr}`,
    `Total:${money(total)} EUR`,
    `TVSH:${money(vat)} EUR`,
    `Pagesa:${methodLabel}`,
    `Kodi:${fiscalCode}`,
  ].join('\n');
  let qrSvg = '';
  try {
    qrSvg = await QRCode.toString(qrPayload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  } catch { qrSvg = ''; }

  // Thermal paper width (80mm default, or 58mm) — drives layout & font sizing
  const isNarrow = String(settings.paper_width) === '58';
  const paper = {
    width: isNarrow ? '58mm' : '80mm',
    max: isNarrow ? '240px' : '320px',
    pad: isNarrow ? '4mm 3mm' : '6mm 5mm',
    name: isNarrow ? 13 : 15,
    sub: isNarrow ? 10.5 : 12,
    row: isNarrow ? 11 : 12.5,
    title: isNarrow ? 14 : 17,
    titleSpace: isNarrow ? 2 : 3,
    item: isNarrow ? 11 : 12.5,
    tot: isNarrow ? 11.5 : 13,
    totMain: isNarrow ? 13.5 : 16,
    qr: isNarrow ? 92 : 112,
    logoH: isNarrow ? 46 : 58,
    logoW: isNarrow ? 78 : 104,
  };

  const itemRows = items.map(i => `
      <div class="item">
        <div class="item-name">${esc(i.name)}</div>
        <div class="row">
          <span>${i.quantity} x ${money(i.price)}</span>
          <span>${money(i.price * i.quantity)} ${taxLetter}</span>
        </div>
      </div>`).join('');

  // Republic of Kosovo (RKS) / Ministry of Finance (MF) mark.
  // Use the logo image URL from settings if provided, else a stylized fallback.
  const fiscalLogo = settings.fiscal_logo || '';
  const emblemMark = `<div class="emblem-text"><strong>RKS</strong><span>MF</span></div>`;
  const emblem = fiscalLogo ? `
    <div class="emblem">
      <img src="${esc(fiscalLogo)}" alt="RKS" style="max-height:${paper.logoH}px;max-width:${paper.logoW}px;object-fit:contain">
      ${emblemMark}
    </div>` : `
    <div class="emblem">
      <svg width="${isNarrow ? 36 : 42}" height="${isNarrow ? 42 : 48}" viewBox="0 0 80 92" xmlns="http://www.w3.org/2000/svg">
        <path d="M40 4 L74 16 V52 C74 77 40 88 40 88 C40 88 6 77 6 52 V16 Z" fill="#1B4BA0"/>
        <g fill="#fff">
          <circle cx="22" cy="27" r="2.1"/><circle cx="31" cy="23" r="2.1"/>
          <circle cx="40" cy="21" r="2.1"/><circle cx="49" cy="23" r="2.1"/>
          <circle cx="58" cy="27" r="2.1"/>
        </g>
        <path d="M28 41 q12 -7 23 2 q4 11 -5 19 q-13 6 -20 -5 q-2 -10 2 -16 Z" fill="#E0A82E"/>
      </svg>
      ${emblemMark}
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kupon Fiskal - ${esc(order.order_number || order.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', 'Consolas', monospace; color: #000; background: #e9e9e9; margin: 0; padding: 16px; }
    .receipt { width: ${paper.width}; max-width: ${paper.max}; margin: 0 auto; background: #fff; padding: ${paper.pad}; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .name { font-size: ${paper.name}px; font-weight: 700; letter-spacing: .5px; }
    .sub { font-size: ${paper.sub}px; line-height: 1.5; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: ${paper.row}px; line-height: 1.6; }
    .dash { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    .title { text-align: center; font-size: ${paper.title}px; font-weight: 700; letter-spacing: ${paper.titleSpace}px; margin: 10px 0; }
    .item { margin-bottom: 6px; font-size: ${paper.item}px; }
    .item-name { font-weight: 700; }
    .tot-line { display: flex; justify-content: space-between; font-size: ${paper.tot}px; line-height: 1.7; }
    .tot-main { font-size: ${paper.totMain}px; font-weight: 700; letter-spacing: 1px; }
    .qr { margin: 6px 0; }
    .qr svg { width: ${paper.qr}px; height: ${paper.qr}px; }
    .emblem { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
    .emblem-text { display: flex; flex-direction: column; line-height: 1.1; font-size: ${paper.name}px; font-weight: 700; }
    .emblem-text span { font-size: ${paper.sub}px; font-weight: 400; }
    .toolbar { width: ${paper.max}; max-width: ${paper.max}; margin: 14px auto 0; display: flex; gap: 8px; }
    .toolbar button { flex: 1; padding: 11px; font: inherit; font-weight: 600; border: 1px solid #3D3D3D; border-radius: 8px; cursor: pointer; }
    .toolbar .print { background: #3D3D3D; color: #fff; border-color: #3D3D3D; }
    .toolbar .close { background: #fff; color: #3D3D3D; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { width: auto; max-width: none; padding: 0; }
      .toolbar { display: none; }
      @page { size: ${paper.width} auto; margin: ${isNarrow ? '2mm' : '3mm'}; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center name">${esc(businessName)}</div>
    ${address ? `<div class="center sub">${esc(address)}</div>` : ''}
    ${city ? `<div class="center sub bold">${esc(city)}</div>` : ''}
    ${phone1 ? `<div class="center sub">Mob. ${esc(phone1)}</div>` : ''}
    ${phone2 ? `<div class="center sub">Mob. ${esc(phone2)}</div>` : ''}
    <div style="height:6px"></div>
    ${fiscalNumber ? `<div class="row"><span>Numri Fiskal:</span><span class="bold">${esc(fiscalNumber)}</span></div>` : ''}
    ${vatNumber ? `<div class="row"><span>Numri i TVSH:</span><span class="bold">${esc(vatNumber)}</span></div>` : ''}
    <div class="row"><span>Nr. i PEF: ${esc(pef)}</span><span>OPERATORI: ${esc(operator)}</span></div>

    <div class="title">KUPON FISKAL</div>

    <hr class="dash">
    ${itemRows || '<div class="center sub">— pa artikuj —</div>'}
    <hr class="dash">

    <div class="tot-line tot-main"><span>TOTALI NE EURO</span><span>${money(order.total)}</span></div>
    <div style="height:4px"></div>
    ${vat > 0 ? `<div class="tot-line"><span>TVSH ${vatRate}% (${taxLetter})</span><span>${money(vat)}</span></div>` : ''}
    <div class="tot-line"><span>TOT. PA TVSH</span><span>${money(totalNoVat)}</span></div>
    <div style="height:4px"></div>
    <div class="tot-line"><span>MENYRA E PAGESES</span><span class="bold">${methodLabel}</span></div>
    <div class="tot-line"><span>${pm === 'cash' ? 'PARA TE GATSHME' : 'E PAGUAR'}</span><span>${money(order.total)}</span></div>

    <hr class="dash">
    <div class="row"><span>EJ NR. ${esc(ej)}</span><span>DOK.NR. ${docNr}</span></div>
    <div class="row"><span>DATA ${dateStr}</span><span>ORA ${timeStr}</span></div>
    <div class="row"><span>Numri Serik:</span><span>${esc(serial)}</span></div>
    <div class="center bold" style="margin-top:8px;font-size:13px">KUPONI FISKAL NR. ${couponNr}</div>

    <hr class="dash">
    ${qrSvg ? `<div class="center qr">${qrSvg}</div>` : ''}
    <div class="center sub bold" style="margin-top:4px">Kodi Fiskal: ${fiscalCode}</div>
    ${fiscalSystemId ? `<div class="center sub">Sistemi Fiskal: ${esc(fiscalSystemId)}</div>` : ''}
    ${emblem}
  </div>

  <div class="toolbar">
    <button class="print" onclick="window.print()">Print</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</body>
</html>`;

  res.send(html);
});

// ─── CASH ────────────────────────────────────────────────────────────────────
app.get('/api/cash/summary', (req, res) => {
  const db = getDB();
  const { period = '30' } = req.query;
  const dateFilter = `AND date(created_at) >= date('now', '-${+period} days')`;

  const collected = db.prepare(`SELECT COALESCE(SUM(total),0) as val FROM orders WHERE payment_status='paid' ${dateFilter}`).get().val;
  const refunded = db.prepare(`SELECT COALESCE(SUM(total),0) as val FROM orders WHERE payment_status='refunded' ${dateFilter}`).get().val;
  const expected = db.prepare(`SELECT COALESCE(SUM(total),0) as val FROM orders WHERE payment_status='pending' AND status != 'cancelled' ${dateFilter}`).get().val;
  const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses WHERE date(date) >= date('now', '-${+period} days')`).get().val;
  const totalOrders = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE payment_status='paid' ${dateFilter}`).get().c;

  res.json({ collected, refunded, expected, expenses, net: collected - refunded - expenses, totalOrders });
});

app.get('/api/cash/movements', (req, res) => {
  const db = getDB();
  const { limit = 50, offset = 0 } = req.query;
  const orders = db.prepare(`
    SELECT 'order' as type, order_number as reference, customer_name as description, total as amount, payment_status as status, created_at
    FROM orders WHERE payment_status IN ('paid','refunded')
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(+limit, +offset);
  const expenses = db.prepare(`
    SELECT 'expense' as type, category as reference, description, -amount as amount, 'expense' as status, created_at
    FROM expenses ORDER BY created_at DESC LIMIT 20
  `).all();
  const movements = [...orders, ...expenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, +limit);
  res.json({ movements });
});

// ─── EXPENSES ────────────────────────────────────────────────────────────────
app.get('/api/expenses', (req, res) => {
  const db = getDB();
  const { category = '', limit = 50, offset = 0, period = '' } = req.query;
  const conditions = [];
  const params = [];
  if (category) { conditions.push('category=?'); params.push(category); }
  if (period) { conditions.push(`date(date) >= date('now', '-${+period} days')`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const expenses = db.prepare(`SELECT * FROM expenses ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, +limit, +offset);
  const { total: sum } = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses ${where}`).get(...params);
  const { count } = db.prepare(`SELECT COUNT(*) as count FROM expenses ${where}`).get(...params);
  const categories = db.prepare('SELECT DISTINCT category FROM expenses WHERE category IS NOT NULL').all().map(r => r.category);
  res.json({ expenses, total: count, sum, categories });
});

app.post('/api/expenses', (req, res) => {
  const db = getDB();
  const { category, description, amount, date, notes } = req.body;
  const info = db.prepare('INSERT INTO expenses (category,description,amount,date,notes) VALUES (?,?,?,?,?)')
    .run(category || 'other', description, +amount || 0, date || new Date().toISOString().split('T')[0], notes || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/expenses/:id', (req, res) => {
  const db = getDB();
  const { category, description, amount, date, notes } = req.body;
  db.prepare('UPDATE expenses SET category=?,description=?,amount=?,date=?,notes=? WHERE id=?')
    .run(category || 'other', description, +amount || 0, date, notes || '', req.params.id);
  res.json({ success: true });
});

app.delete('/api/expenses/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
app.get('/api/reports/summary', (req, res) => {
  const db = getDB();
  const { period = '30' } = req.query;
  const df = `date(created_at) >= date('now', '-${+period} days')`;

  const revenue = db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM orders WHERE payment_status='paid' AND ${df}`).get().v;
  const refunds = db.prepare(`SELECT COALESCE(SUM(total),0) as v FROM orders WHERE payment_status='refunded' AND ${df}`).get().v;
  const costs = db.prepare(`SELECT COALESCE(SUM(oi.cost*oi.quantity),0) as v FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE o.payment_status='paid' AND ${df.replace('created_at','o.created_at')}`).get().v;
  const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE date(date) >= date('now', '-${+period} days')`).get().v;
  const orderCount = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE ${df}`).get().c;
  const paidCount = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE payment_status='paid' AND ${df}`).get().c;
  const newCustomers = db.prepare(`SELECT COUNT(*) as c FROM customers WHERE ${df.replace('created_at','created_at')}`).get().c;
  const grossProfit = revenue - costs - refunds;
  const netProfit = grossProfit - expenses;

  res.json({ revenue, refunds, costs, expenses, grossProfit, netProfit, orderCount, paidCount, newCustomers, period: +period });
});

app.get('/api/reports/orders-by-day', (req, res) => {
  const db = getDB();
  const { period = '30' } = req.query;
  const rows = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE payment_status='paid' AND date(created_at) >= date('now', '-${+period} days')
    GROUP BY day ORDER BY day ASC
  `).all();
  res.json({ rows });
});

app.get('/api/reports/top-products', (req, res) => {
  const db = getDB();
  const { period = '30', limit = 10 } = req.query;
  const rows = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as qty, SUM(oi.price*oi.quantity) as revenue,
           SUM((oi.price-oi.cost)*oi.quantity) as profit
    FROM order_items oi JOIN orders o ON oi.order_id=o.id
    WHERE o.payment_status='paid' AND date(o.created_at) >= date('now', '-${+period} days')
    GROUP BY oi.name ORDER BY revenue DESC LIMIT ?
  `).all(+limit);
  res.json({ rows });
});

app.get('/api/reports/expenses-by-category', (req, res) => {
  const db = getDB();
  const { period = '30' } = req.query;
  const rows = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total
    FROM expenses WHERE date(date) >= date('now', '-${+period} days')
    GROUP BY category ORDER BY total DESC
  `).all();
  res.json({ rows });
});

// ─── SHOPIFY ─────────────────────────────────────────────────────────────────
app.post('/api/shopify/sync', async (req, res) => {
  const result = await syncShopify();
  res.json(result);
});

app.get('/api/shopify/status', (req, res) => {
  res.json(getShopifyStatus());
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const db = getDB();
  const todayOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=date('now')").get().c;
  const todayRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM orders WHERE date(created_at)=date('now') AND payment_status='paid'").get().v;
  const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c;
  const pendingPayment = db.prepare("SELECT COUNT(*) as c FROM orders WHERE payment_status='pending' AND status!='cancelled'").get().c;
  const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock <= low_stock_threshold AND active=1').get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE active=1').get().c;
  const totalCustomers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const monthRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM orders WHERE payment_status='paid' AND date(created_at) >= date('now','start of month')").get().v;
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all();
  res.json({ todayOrders, todayRevenue, pendingOrders, pendingPayment, lowStock, totalProducts, totalCustomers, monthRevenue, recentOrders });
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ─── SHOPIFY CRON (every 5 min) ──────────────────────────────────────────────
cron.schedule('*/5 * * * *', () => {
  syncShopify().catch(err => console.error('[Cron] Shopify sync failed:', err.message));
});

app.listen(PORT, () => {
  console.log(`\n  Store Manager running at http://localhost:${PORT}\n`);
});
