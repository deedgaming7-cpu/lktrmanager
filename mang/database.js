const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

let db;

// node-sqlite3-wasm emulates file locking on Windows with a `.lock` file.
// An unclean shutdown (force-kill) leaves it behind and the next open fails
// with "database is locked". Clear stale lock/journal files before opening.
function clearStaleLocks(dbPath) {
  for (const suffix of ['.lock', '-journal', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch { /* not present — fine */ }
  }
}

function getDB() {
  return db;
}

// node-sqlite3-wasm has two differences from better-sqlite3:
// 1. No db.transaction() method — we add one via BEGIN/COMMIT
// 2. null values in spread params stop binding — we wrap prepare() to pass params as array
function addCompatibility(rawDb) {
  // 1. Add transaction support
  rawDb.transaction = function(fn) {
    return function(arg) {
      rawDb.exec('BEGIN');
      try {
        const result = fn(arg);
        rawDb.exec('COMMIT');
        return result;
      } catch (e) {
        try { rawDb.exec('ROLLBACK'); } catch {}
        throw e;
      }
    };
  };

  // 2. Wrap prepare() so run/get/all always receive params as an array,
  //    avoiding the null-as-terminator behaviour in node-sqlite3-wasm.
  const origPrepare = rawDb.prepare.bind(rawDb);
  rawDb.prepare = function(sql) {
    const s = origPrepare(sql);
    const wrap = (method) => function(...args) {
      if (args.length === 0) return s[method]();
      if (args.length === 1) return s[method](args[0]);
      return s[method](args); // array form: node-sqlite3-wasm binds all, incl. nulls
    };
    return { run: wrap('run'), get: wrap('get'), all: wrap('all') };
  };
}

function initDB() {
  const dbPath = path.join(__dirname, 'store.db');
  clearStaleLocks(dbPath);
  db = new Database(dbPath);
  // Single-process app — default rollback journal avoids the stale -wal/-shm
  // lock files that WAL leaves behind on Windows when a process is killed.
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA foreign_keys = ON');

  addCompatibility(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_id TEXT UNIQUE,
      name TEXT NOT NULL,
      sku TEXT,
      description TEXT,
      price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 5,
      category TEXT,
      image_url TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shopify_id TEXT UNIQUE,
      order_number TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      customer_email TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      fulfillment_status TEXT DEFAULT 'unfulfilled',
      subtotal REAL DEFAULT 0,
      shipping REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      notes TEXT,
      shipping_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      returned_at DATETIME,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      shopify_product_id TEXT,
      name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT DEFAULT 'other',
      description TEXT NOT NULL,
      amount REAL DEFAULT 0,
      date DATE DEFAULT (date('now')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      status TEXT,
      message TEXT,
      synced_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ── Migrations for existing databases (ALTER is a no-op if column exists) ──
  for (const [table, col, def] of [
    ['orders', 'payment_method', "TEXT DEFAULT 'cash'"],
  ]) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* exists */ }
  }

  console.log('Database initialized: store.db');
  return db;
}

module.exports = { initDB, getDB };
