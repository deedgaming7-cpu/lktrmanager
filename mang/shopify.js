const fetch = require('node-fetch');
const { getDB } = require('./database');

const SHOPIFY_API_VERSION = '2026-07';

function getSettings() {
  const db = getDB();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'shopify_%'").all();
  const settings = {};
  rows.forEach(r => {
    try { settings[r.key] = JSON.parse(r.value); }
    catch { settings[r.key] = r.value; }
  });
  return settings;
}

async function refreshAccessToken(settings) {
  const domain = settings.shopify_domain;
  const clientId = settings.shopify_client_id;
  const clientSecret = settings.shopify_client_secret;
  if (!domain || !clientId || !clientSecret) return settings.shopify_token;

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Shopify token refresh failed ${res.status}: ${data.error_description || data.error || res.statusText}`);
  }

  settings.shopify_token = data.access_token;
  const db = getDB();
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)")
    .run('shopify_token', JSON.stringify(data.access_token));
  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)")
    .run('shopify_token_expires_at', JSON.stringify(new Date(Date.now() + ((data.expires_in || 86399) * 1000)).toISOString()));

  return data.access_token;
}

async function shopifyFetch(settings, endpoint) {
  const domain = settings.shopify_domain;
  const token = settings.shopify_token;
  if (!domain || !token) throw new Error('Shopify credentials not configured');

  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Shopify API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function syncCustomers(settings) {
  const db = getDB();
  const data = await shopifyFetch(settings, 'customers.json?limit=250');
  const customers = data.customers || [];

  const upsert = db.prepare(`
    INSERT INTO customers (shopify_id, name, email, phone, address, city, country, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shopify_id) DO UPDATE SET
      name=excluded.name, email=excluded.email, phone=excluded.phone,
      address=excluded.address, city=excluded.city, country=excluded.country,
      updated_at=excluded.updated_at
  `);

  const run = db.transaction((list) => {
    for (const c of list) {
      const addr = c.addresses && c.addresses[0];
      upsert.run(
        String(c.id),
        `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unknown',
        c.email || '', c.phone || '',
        addr ? `${addr.address1 || ''} ${addr.address2 || ''}`.trim() : '',
        addr ? addr.city || '' : '',
        addr ? addr.country || '' : '',
        c.created_at || new Date().toISOString(),
        new Date().toISOString()
      );
    }
    return list.length;
  });

  return run(customers);
}

async function syncProducts(settings) {
  const db = getDB();
  const data = await shopifyFetch(settings, 'products.json?limit=250');
  const products = data.products || [];

  const upsert = db.prepare(`
    INSERT INTO products (shopify_id, name, sku, description, price, stock, image_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shopify_id) DO UPDATE SET
      name=excluded.name, sku=excluded.sku, description=excluded.description,
      price=excluded.price, image_url=excluded.image_url, updated_at=excluded.updated_at
  `);

  const run = db.transaction((list) => {
    for (const p of list) {
      const variant = p.variants && p.variants[0];
      const image = p.images && p.images[0];
      upsert.run(
        String(p.id), p.title || '',
        variant ? variant.sku || '' : '',
        p.body_html ? p.body_html.replace(/<[^>]*>/g, '') : '',
        variant ? parseFloat(variant.price || 0) : 0,
        variant ? parseInt(variant.inventory_quantity || 0) : 0,
        image ? image.src || '' : '',
        p.created_at || new Date().toISOString(),
        new Date().toISOString()
      );
    }
    return list.length;
  });

  return run(products);
}

async function syncOrders(settings) {
  const db = getDB();
  const lastSyncRow = db.prepare("SELECT value FROM settings WHERE key='shopify_last_sync'").get();
  let url = 'orders.json?limit=250&status=any';
  if (lastSyncRow && lastSyncRow.value) {
    url += `&updated_at_min=${JSON.parse(lastSyncRow.value)}`;
  }

  const data = await shopifyFetch(settings, url);
  const orders = data.orders || [];
  let count = 0;

  const deleteItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, shopify_product_id, name, sku, quantity, price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const o of orders) {
    let customerId = null;
    if (o.customer && o.customer.id) {
      const cust = db.prepare('SELECT id FROM customers WHERE shopify_id=?').get(String(o.customer.id));
      if (cust) customerId = cust.id;
    }

    const paymentStatus = o.financial_status === 'paid' ? 'paid' :
      o.financial_status === 'refunded' ? 'refunded' : 'pending';

    const orderStatus = o.cancelled_at ? 'cancelled' :
      (o.fulfillment_status === 'fulfilled' ? 'completed' : 'pending');

    const shippingCost = o.shipping_lines && o.shipping_lines[0] ?
      parseFloat(o.shipping_lines[0].price || 0) : 0;

    const customerName = o.customer ?
      `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : '';

    const existing = db.prepare('SELECT id FROM orders WHERE shopify_id=?').get(String(o.id));
    let orderId;

    if (existing) {
      db.prepare(`
        UPDATE orders SET status=?, payment_status=?, fulfillment_status=?,
          total=?, updated_at=?, paid_at=?
        WHERE id=?
      `).run(
        orderStatus, paymentStatus, o.fulfillment_status || 'unfulfilled',
        parseFloat(o.total_price || 0), new Date().toISOString(),
        paymentStatus === 'paid' ? o.updated_at : null,
        existing.id
      );
      orderId = existing.id;
    } else {
      const info = db.prepare(`
        INSERT INTO orders (
          shopify_id, order_number, customer_id, customer_name, customer_email,
          status, payment_status, fulfillment_status,
          subtotal, shipping, discount, tax, total, currency,
          notes, shipping_address, created_at, updated_at, paid_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        String(o.id), o.name || String(o.order_number),
        customerId, customerName,
        o.customer ? o.customer.email || '' : '',
        orderStatus, paymentStatus,
        o.fulfillment_status || 'unfulfilled',
        parseFloat(o.subtotal_price || 0), shippingCost,
        parseFloat(o.total_discounts || 0),
        parseFloat(o.total_tax || 0),
        parseFloat(o.total_price || 0),
        o.currency || 'EUR',
        o.note || '',
        o.shipping_address ? JSON.stringify(o.shipping_address) : null,
        o.created_at || new Date().toISOString(),
        new Date().toISOString(),
        paymentStatus === 'paid' ? o.updated_at : null
      );
      orderId = info.lastInsertRowid;
    }

    if (orderId && o.line_items) {
      deleteItems.run(orderId);
      for (const item of o.line_items) {
        insertItem.run(
          orderId,
          item.product_id ? String(item.product_id) : null,
          item.title || '', item.sku || '',
          parseInt(item.quantity || 1),
          parseFloat(item.price || 0)
        );
      }
    }
    count++;
  }

  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(
    'shopify_last_sync', JSON.stringify(new Date().toISOString())
  );

  return count;
}

async function syncShopify() {
  const db = getDB();
  try {
    const settings = getSettings();
    const hasClientCredentials = settings.shopify_client_id && settings.shopify_client_secret;
    if (!settings.shopify_domain || (!settings.shopify_token && !hasClientCredentials)) {
      return { success: false, message: 'Shopify credentials not configured' };
    }

    console.log('[Shopify] Syncing...');
    await refreshAccessToken(settings);
    const customers = await syncCustomers(settings);
    const products = await syncProducts(settings);
    const orders = await syncOrders(settings);

    const message = `Synced ${customers} customers, ${products} products, ${orders} orders`;
    db.prepare('INSERT INTO sync_log (type,status,message,synced_count) VALUES (?,?,?,?)').run(
      'shopify', 'success', message, customers + products + orders
    );
    console.log('[Shopify]', message);
    return { success: true, message };

  } catch (err) {
    console.error('[Shopify] Error:', err.message);
    db.prepare('INSERT INTO sync_log (type,status,message) VALUES (?,?,?)').run('shopify', 'error', err.message);
    return { success: false, message: err.message };
  }
}

function getShopifyStatus() {
  const db = getDB();
  const lastLog = db.prepare('SELECT * FROM sync_log WHERE type=? ORDER BY created_at DESC LIMIT 1').get('shopify');
  const settings = getSettings();
  return {
    configured: !!(settings.shopify_domain && (settings.shopify_token || (settings.shopify_client_id && settings.shopify_client_secret))),
    lastSync: lastLog || null
  };
}

module.exports = { syncShopify, getShopifyStatus };
