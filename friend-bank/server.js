const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const DATA_BACKUP_FILE = path.join(DATA_DIR, 'data.backup.json');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MIN_VALID_STATE_BYTES = 512;

// Trust proxy for HTTPS on Render/Heroku
app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'friend-bank-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// --- Users helpers ---
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// Initialize default users if file doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  const defaultUsers = [
    { id: 1, username: 'mayur', name: 'Mayur', memberId: 5, role: 'admin', password: bcrypt.hashSync('1234', 10) },
    { id: 2, username: 'gagan', name: 'Gagan', memberId: 6, role: 'member', password: bcrypt.hashSync('1234', 10) },
    { id: 3, username: 'himesh', name: 'Himesh', memberId: 7, role: 'member', password: bcrypt.hashSync('1234', 10) },
    { id: 4, username: 'vicky', name: 'Vicky', memberId: 8, role: 'member', password: bcrypt.hashSync('1234', 10) }
  ];
  writeUsers(defaultUsers);
  console.log('Created default users (password: 1234 for all)');
}

// Keep a recovery admin available only when the user record is missing.
// Do not overwrite an existing password on startup.
function ensureRecoveryAdmin() {
  const users = readUsers();
  const recoveryPassword = bcrypt.hashSync('1234', 10);
  const recoveryUser = {
    id: 1,
    username: 'mayur',
    name: 'Mayur',
    memberId: 5,
    role: 'admin',
    password: recoveryPassword
  };

  const idx = users.findIndex(u => u.username && u.username.toLowerCase() === 'mayur');
  if (idx === -1) {
    users.unshift(recoveryUser);
    writeUsers(users);
    console.log('Created recovery admin user: mayur');
  }
}

ensureRecoveryAdmin();

// --- Auth middleware ---
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ success: false, message: 'Not logged in' });
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).json({ success: false, message: 'Admin access required' });
}

// --- Auth routes ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });
  const users = readUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
  req.session.user = { id: user.id, username: user.username, name: user.name, memberId: user.memberId, role: user.role };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
  if (newPassword.length < 4) return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.user.id);
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ success: false, message: 'Current password is wrong' });
  }
  user.password = bcrypt.hashSync(newPassword, 10);
  writeUsers(users);
  res.json({ success: true });
});

// --- User management (admin only) ---
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = readUsers().map(u => ({ id: u.id, username: u.username, name: u.name, memberId: u.memberId, role: u.role }));
  res.json({ users });
});

app.post('/api/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { role } = req.body;
  if (!role || !['admin', 'member'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
  if (userId === req.session.user.id) return res.status(400).json({ success: false, message: 'Cannot change your own role' });
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.role = role;
  writeUsers(users);
  res.json({ success: true });
});

// --- Static & page routes ---
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'friend_bank_v4.html'));
});

function readData() {
  const fallback = { transactions: [] };
  try {
    if (!fs.existsSync(DATA_FILE)) {
      if (fs.existsSync(DATA_BACKUP_FILE)) {
        return recoverDataFromBackup(fallback);
      }
      writeJsonAtomic(DATA_FILE, fallback);
      writeJsonAtomic(DATA_BACKUP_FILE, fallback);
      return fallback;
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (hasConflictMarkers(raw)) {
      console.warn('[DATA] Conflict markers detected in data.json. Attempting recovery from backup.');
      return recoverDataFromBackup(fallback);
    }

    const parsed = JSON.parse(raw);
    // Keep a continuously refreshed valid backup.
    writeJsonAtomic(DATA_BACKUP_FILE, parsed);
    return parsed;
  } catch (err) {
    console.warn('[DATA] Failed to parse data.json:', err.message);
    return recoverDataFromBackup(fallback);
  }
}

function writeData(data) {
  writeJsonAtomic(DATA_FILE, data);
  writeJsonAtomic(DATA_BACKUP_FILE, data);
  writeSnapshot(data);
}

function hasConflictMarkers(raw) {
  return raw.includes('<<<<<<<') || raw.includes('=======') || raw.includes('>>>>>>>');
}

function writeJsonAtomic(targetFile, data) {
  const tempFile = `${targetFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, targetFile);
}

function writeSnapshot(data) {
  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(SNAPSHOT_DIR, `data-${stamp}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2), 'utf-8');

    const snapshots = fs
      .readdirSync(SNAPSHOT_DIR)
      .filter(name => name.startsWith('data-') && name.endsWith('.json'))
      .sort();
    const keep = 30;
    if (snapshots.length > keep) {
      const toDelete = snapshots.slice(0, snapshots.length - keep);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(SNAPSHOT_DIR, file));
      }
    }
  } catch (err) {
    console.warn('[DATA] Snapshot write failed:', err.message);
  }
}

function validateStateForSave(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return ['State must be an object'];
  }

  if (!Array.isArray(state.members) || state.members.length === 0) {
    errors.push('members must be a non-empty array');
  }
  if (!Array.isArray(state.months) || state.months.length === 0) {
    errors.push('months must be a non-empty array');
  }
  if (!state.payments || typeof state.payments !== 'object' || Array.isArray(state.payments) || Object.keys(state.payments).length === 0) {
    errors.push('payments must be a non-empty object');
  }
  if (!Array.isArray(state.loans)) {
    errors.push('loans must be an array');
  }
  if (!Array.isArray(state.transactions)) {
    errors.push('transactions must be an array');
  }
  if (typeof state.mainBalance !== 'number' || Number.isNaN(state.mainBalance)) {
    errors.push('mainBalance must be a number');
  }
  if (typeof state.loanedOut !== 'number' || Number.isNaN(state.loanedOut)) {
    errors.push('loanedOut must be a number');
  }

  return errors;
}

function recoverDataFromBackup(fallback) {
  try {
    if (fs.existsSync(DATA_BACKUP_FILE)) {
      const backupRaw = fs.readFileSync(DATA_BACKUP_FILE, 'utf-8');
      const backupData = JSON.parse(backupRaw);
      writeJsonAtomic(DATA_FILE, backupData);
      console.log('[DATA] Recovered data.json from data.backup.json');
      return backupData;
    }
  } catch (err) {
    console.warn('[DATA] Backup recovery failed:', err.message);
  }

  // Never overwrite storage with fallback when recovery fails.
  // This prevents accidental data loss from parse/conflict issues.
  console.warn('[DATA] No valid backup available; returning in-memory fallback without writing to disk.');
  return fallback;
}

app.get('/api/transactions', requireAuth, (req, res) => {
  const data = readData();
  res.json({ transactions: data.transactions || [] });
});

app.post('/api/transactions', requireAuth, (req, res) => {
  const payload = req.body;
  const data = readData();
  data.transactions = data.transactions || [];
  data.transactions.push({
    id: Date.now(),
    ...payload,
  });
  writeData(data);
  res.json({ success: true, transaction: payload });
});

app.get('/api/state', requireAuth, (req, res) => {
  const data = readData();
  res.json({ state: data });
});

app.post('/api/state', requireAuth, requireAdmin, (req, res) => {
  const payload = req.body;
  console.log('[SAVE] Received state save request, body size:', JSON.stringify(payload).length, 'bytes');
  if (!payload || typeof payload.state !== 'object') {
    console.log('[SAVE] REJECTED: Invalid payload');
    return res.status(400).json({ success: false, message: 'Invalid state payload' });
  }
  const serialized = JSON.stringify(payload.state);
  if (!serialized || serialized.length < MIN_VALID_STATE_BYTES) {
    console.log('[SAVE] REJECTED: State payload too small:', serialized ? serialized.length : 0, 'bytes');
    return res.status(400).json({ success: false, message: 'State payload too small; refusing to overwrite persisted data' });
  }
  const validationErrors = validateStateForSave(payload.state);
  if (validationErrors.length > 0) {
    console.log('[SAVE] REJECTED: State validation failed:', validationErrors.join('; '));
    return res.status(400).json({ success: false, message: `State validation failed: ${validationErrors[0]}` });
  }
  console.log('[SAVE] Loans:', payload.state.loans?.map(l => l.id + ':' + l.month));
  writeData(payload.state);
  console.log('[SAVE] Written to', DATA_FILE);
  res.json({ success: true });
});

// --- Gold price API (cached) ---
const GOLD_API_KEY = process.env.GOLD_API_KEY || 'goldapi-1bfp1smnr8yidl-io';
let goldPriceCache = { data: null, fetchedAt: 0 };

app.get('/api/gold-price', requireAuth, async (req, res) => {
  // Return cached if less than 8 hours old (unless force refresh)
  const forceRefresh = req.query.force === '1';
  if (!forceRefresh && goldPriceCache.data && Date.now() - goldPriceCache.fetchedAt < 28800000) {
    return res.json(goldPriceCache.data);
  }
  try {
    const resp = await fetch('https://www.goldapi.io/api/XAU/KWD', {
      headers: { 'x-access-token': GOLD_API_KEY, 'Content-Type': 'application/json' }
    });
    if (!resp.ok) throw new Error('Gold API returned ' + resp.status);
    const json = await resp.json();
    const result = {
      success: true,
      pricePerGram24K: json.price_gram_24k,
      pricePerGram22K: json.price_gram_22k,
      pricePerOunce: json.price,
      currency: 'KWD',
      timestamp: json.timestamp
    };
    goldPriceCache = { data: result, fetchedAt: Date.now() };
    res.json(result);
  } catch (err) {
    console.error('Gold price fetch error:', err.message);
    if (goldPriceCache.data) return res.json({ ...goldPriceCache.data, stale: true });
    res.status(502).json({ success: false, message: 'Unable to fetch gold price' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`[STORAGE] DATA_DIR (local data folder) = ${DATA_DIR}`);
  if (process.env.NODE_ENV === 'production' && !process.env.DATA_DIR) {
    console.warn('[STORAGE] WARNING: Using ephemeral app filesystem; changes may be lost after restart/redeploy.');
  }
});