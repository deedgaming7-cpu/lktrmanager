const crypto = require('crypto');
const { getDB } = require('./database');

// ── Password hashing (scrypt, salted) ────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Cookies ───────────────────────────────────────────────────────────────────
function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const found = header.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

// ── Sessions (stored in DB so they survive restarts) ─────────────────────────
const SESSION_DAYS = 30;

function createSession(userId) {
  const db = getDB();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .run(token, userId, expires, Date.now());
  return token;
}

function destroySession(token) {
  if (!token) return;
  getDB().prepare('DELETE FROM sessions WHERE token=?').run(token);
}

function userFromRequest(req) {
  const token = getCookie(req, 'sid');
  if (!token) return null;
  const db = getDB();
  const sess = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!sess || sess.expires_at < Date.now()) {
    if (sess) destroySession(token);
    return null;
  }
  const user = db.prepare('SELECT id, username FROM users WHERE id=?').get(sess.user_id);
  return user || null;
}

// Express middleware — blocks unauthenticated API access
function requireAuth(req, res, next) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  req.sessionToken = getCookie(req, 'sid');
  next();
}

// Seed a default admin on first run so the app is never locked out
function ensureDefaultAdmin() {
  const db = getDB();
  const { c } = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (c === 0) {
    db.prepare('INSERT INTO users (username,password_hash,created_at) VALUES (?,?,?)')
      .run('admin', hashPassword('admin'), new Date().toISOString());
    console.log('  [auth] Default admin created — username: "admin"  password: "admin"');
    console.log('  [auth] >>> Change it in Settings → Administrators after first login. <<<');
  }
}

module.exports = {
  hashPassword, verifyPassword, getCookie,
  createSession, destroySession, userFromRequest, requireAuth, ensureDefaultAdmin,
};
