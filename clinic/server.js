// ...existing code...

// =====================================================
//  Clinic Management System - Server (JSON file DB)
//  Node.js + Express  |  Zero native dependencies
// =====================================================
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 5050;
const APP_STARTED_AT = nowIso();

function nowIso() {
  return new Date().toISOString();
}
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'clinic-data.json');
const SQLITE_FILE = path.join(DATA_DIR, 'clinic-data.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const sqlite = new Database(SQLITE_FILE);
sqlite.pragma('journal_mode = WAL');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// ---------- Permission definitions ----------
const ALL_PERMISSIONS = [
  'dashboard.view',
  'patients.view','patients.create','patients.edit','patients.delete','patients.import','patients.export',
  'appointments.view','appointments.create','appointments.edit','appointments.delete',
  'scheduler.view',
  'patient_packages.view','patient_packages.create','patient_packages.edit','patient_packages.delete',
  'prescriptions.view','prescriptions.create','prescriptions.delete',
  'billing.view','billing.create','billing.edit','billing.delete','billing.print_history',
  'billing.discount.view','billing.discount.apply','billing.discount.open','billing.discount.override',
  'billing.refund.view','billing.refund.initiate',
  'expenses.view','expenses.create','expenses.edit','expenses.delete',
  'reports.view',
  'users.view','users.create','users.edit','users.delete',
  'services.view','services.create','services.edit','services.delete','services.import','services.export',
  'packages.view','packages.create','packages.edit','packages.delete',
  'setup.view','setup.edit',
  'role_permissions.view','role_permissions.edit',
  'store.view','store.manage','store.purchase','store.transfer'
  ,'store.consume','store.consume.cost','store.adjust'
];
const DEFAULT_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  doctor: [
    'dashboard.view',
    'patients.view','patients.create','patients.edit','patients.export',
    'appointments.view','appointments.create','appointments.edit',
    'scheduler.view',
    'patient_packages.view',
    'prescriptions.view','prescriptions.create','prescriptions.delete',
    'billing.view',
    'expenses.view',
    'reports.view',
    'services.view','packages.view',
    'store.view'
  ],
  receptionist: [
    'dashboard.view',
    'patients.view','patients.create','patients.edit','patients.import','patients.export',
    'appointments.view','appointments.create','appointments.edit','appointments.delete',
    'scheduler.view',
    'patient_packages.view','patient_packages.create','patient_packages.edit',
    'billing.view','billing.create','billing.edit',
    'expenses.view','expenses.create','expenses.edit',
    'services.view','services.import','services.export','packages.view',
    'store.view','store.consume','store.consume.cost','store.adjust'
  ]
};

function getPermissions(db, role) {
  if (!db.role_permissions) db.role_permissions = {};
  if (role === 'admin') return ALL_PERMISSIONS;
  return db.role_permissions[role] || DEFAULT_PERMISSIONS[role] || [];
}

function hasPermission(db, role, perm) {
  if (role === 'admin') return true;
  return getPermissions(db, role).includes(perm);
}

// ---------- JSON "Database" helpers ----------
function blankDB() {
  return {
    users:[], patients:[], appointments:[], prescriptions:[], bills:[], services:[], packages:[],
    payment_methods:[], patient_packages:[], service_categories:[], expense_categories:[], doctor_departments:[], role_permissions:{}, custom_roles:[], _seq:{},
    discounts:[], refunds:[], expenses:[],
    store_products:[], store_suppliers:[], store_sub_stores:[], store_stock:[],
    store_purchase_orders:[], store_supplier_invoice_payments:[], store_supplier_returns:[], store_transfers:[], store_adjustments:[], store_service_products:[], store_service_consumptions:[], store_manual_consumptions:[], uoms:[], store_product_categories:[], store_product_uoms:[],
    activity_logs:[], doctor_schedules:[], clinic_profile:null, follow_ups:[]
  };
}

function upsertState(dataObj) {
  const payload = JSON.stringify(dataObj);
  const ts = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO app_state (id, data, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
  `).run(payload, ts);
}

function ensureCollections(data) {
  // Automatically add any new collections/fields introduced in blankDB() to existing data.
  // This means adding a new array/field to blankDB() is sufficient — no manual migration needed.
  const blank = blankDB();
  let changed = false;
  for (const key of Object.keys(blank)) {
    if (data[key] === undefined || data[key] === null) {
      data[key] = blank[key];
      changed = true;
    }
  }
  if (changed) upsertState(data);
  return data;
}

function readDB() {
  const row = sqlite.prepare('SELECT data FROM app_state WHERE id = 1').get();
  if (row && row.data) {
    try { return ensureCollections(JSON.parse(row.data)); }
    catch { return initDB(); }
  }

  // One-time migration from existing JSON file, if present.
  if (fs.existsSync(DB_FILE)) {
    try {
      const jsonData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      upsertState(jsonData);
      return ensureCollections(jsonData);
    } catch {
      return initDB();
    }
  }

  return initDB();
}
function writeDB(data) {
  upsertState(data);

  // Keep JSON backup for portability/manual inspection.
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Non-fatal: SQLite remains source of truth.
  }
}
function initDB() {
  const blank = blankDB();
  writeDB(blank);
  return blank;
}
function nextId(data, table) {
  if (!data._seq[table]) data._seq[table] = 0;
  data._seq[table] += 1;
  return data._seq[table];
}
function backupTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '-');
}
async function createDbBackup(triggeredBy = 'system') {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = backupTimestamp();
  const backupId = `db-backup-${stamp}`;
  const backupPath = path.join(BACKUP_DIR, backupId);
  fs.mkdirSync(backupPath, { recursive: true });

  const sqliteBackupPath = path.join(backupPath, 'clinic-data.sqlite');
  const jsonBackupPath = path.join(backupPath, 'clinic-data.json');
  await sqlite.backup(sqliteBackupPath);

  const dbState = readDB();
  fs.writeFileSync(jsonBackupPath, JSON.stringify(dbState, null, 2), 'utf8');

  const manifest = {
    backup_id: backupId,
    created_at: new Date().toISOString(),
    created_by: triggeredBy,
    files: {
      sqlite: 'clinic-data.sqlite',
      json: 'clinic-data.json'
    },
    counts: {
      users: Array.isArray(dbState.users) ? dbState.users.length : 0,
      patients: Array.isArray(dbState.patients) ? dbState.patients.length : 0,
      appointments: Array.isArray(dbState.appointments) ? dbState.appointments.length : 0,
      prescriptions: Array.isArray(dbState.prescriptions) ? dbState.prescriptions.length : 0,
      bills: Array.isArray(dbState.bills) ? dbState.bills.length : 0,
      services: Array.isArray(dbState.services) ? dbState.services.length : 0,
      discounts: Array.isArray(dbState.discounts) ? dbState.discounts.length : 0
    }
  };
  fs.writeFileSync(path.join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return {
    backup_id: backupId,
    created_at: manifest.created_at,
    path: backupPath,
    files: {
      sqlite: `/api/admin/db-backups/${encodeURIComponent(backupId)}/clinic-data.sqlite`,
      json: `/api/admin/db-backups/${encodeURIComponent(backupId)}/clinic-data.json`,
      manifest: `/api/admin/db-backups/${encodeURIComponent(backupId)}/manifest.json`
    },
    counts: manifest.counts
  };
}

const RESET_JOB_KEEP_LIMIT = 20;
function getSystemResetState(db) {
  if (!db.system_reset || typeof db.system_reset !== 'object') {
    db.system_reset = {
      in_progress: false,
      active_job_id: null,
      started_at: null,
      started_by: null,
      phase: null,
      message: null,
      progress: 0,
      updated_at: now(),
      last_completed_at: null,
      last_failed_at: null,
      jobs: [],
      security_events: []
    };
  }
  if (!Array.isArray(db.system_reset.jobs)) db.system_reset.jobs = [];
  if (!Array.isArray(db.system_reset.security_events)) db.system_reset.security_events = [];
  return db.system_reset;
}

function getSystemRestoreState(db) {
  if (!db.system_restore || typeof db.system_restore !== 'object') {
    db.system_restore = {
      in_progress: false,
      active_job_id: null,
      started_at: null,
      started_by: null,
      phase: null,
      message: null,
      progress: 0,
      updated_at: now(),
      last_completed_at: null,
      last_failed_at: null,
      jobs: [],
      security_events: []
    };
  }
  if (!Array.isArray(db.system_restore.jobs)) db.system_restore.jobs = [];
  if (!Array.isArray(db.system_restore.security_events)) db.system_restore.security_events = [];
  return db.system_restore;
}

function loadBackupStateById(backupId) {
  const cleanId = String(backupId || '').trim();
  if (!/^db-backup-/.test(cleanId)) throw new Error('Invalid backup id');
  const backupPath = path.join(BACKUP_DIR, cleanId);
  if (!fs.existsSync(backupPath)) throw new Error('Backup folder not found');

  const jsonPath = path.join(backupPath, 'clinic-data.json');
  const sqlitePath = path.join(backupPath, 'clinic-data.sqlite');

  if (fs.existsSync(jsonPath)) {
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!jsonData || typeof jsonData !== 'object') throw new Error('Invalid JSON backup');
    return {
      source: 'json',
      backup_id: cleanId,
      data: jsonData,
      files: {
        sqlite: `/api/admin/db-backups/${encodeURIComponent(cleanId)}/clinic-data.sqlite`,
        json: `/api/admin/db-backups/${encodeURIComponent(cleanId)}/clinic-data.json`,
        manifest: `/api/admin/db-backups/${encodeURIComponent(cleanId)}/manifest.json`
      }
    };
  }

  if (fs.existsSync(sqlitePath)) {
    const restoreDb = new Database(sqlitePath, { readonly: true, fileMustExist: true });
    try {
      const row = restoreDb.prepare('SELECT data FROM app_state WHERE id = 1').get();
      if (!row || !row.data) throw new Error('No app_state data found in sqlite backup');
      const data = JSON.parse(row.data);
      if (!data || typeof data !== 'object') throw new Error('Invalid sqlite backup payload');
      return {
        source: 'sqlite',
        backup_id: cleanId,
        data,
        files: {
          sqlite: `/api/admin/db-backups/${encodeURIComponent(cleanId)}/clinic-data.sqlite`,
          json: `/api/admin/db-backups/${encodeURIComponent(cleanId)}/clinic-data.json`,
          manifest: `/api/admin/db-backups/${encodeURIComponent(cleanId)}/manifest.json`
        }
      };
    } finally {
      try { restoreDb.close(); } catch (_) {}
    }
  }

  throw new Error('No restorable backup file found (JSON/SQLite)');
}

function isSuperAdminUser(db, userId) {
  const uid = parseInt(userId, 10);
  const u = (db.users || []).find(x => parseInt(x.id, 10) === uid);
  if (!u) return false;
  if (u.role !== 'admin') return false;
  return parseInt(u.id, 10) === 1 || String(u.username || '').toLowerCase() === 'admin';
}

function buildResetSummary(db, includeAuditLogs = false) {
  const safeLen = (arr) => Array.isArray(arr) ? arr.length : 0;
  return {
    patients: safeLen(db.patients),
    appointments: safeLen(db.appointments),
    follow_ups: safeLen(db.follow_ups),
    prescriptions: safeLen(db.prescriptions),
    bills: safeLen(db.bills),
    refunds: safeLen(db.refunds),
    expenses: safeLen(db.expenses),
    services: safeLen(db.services),
    packages: safeLen(db.packages),
    patient_packages: safeLen(db.patient_packages),
    inventory_transactions: safeLen(db.store_purchase_orders) + safeLen(db.store_transfers) + safeLen(db.store_adjustments) + safeLen(db.store_service_consumptions) + safeLen(db.store_manual_consumptions),
    report_cache_logs: safeLen(db.reports_cache) + safeLen(db.report_cache) + safeLen(db.report_logs),
    audit_logs: includeAuditLogs ? safeLen(db.activity_logs) : 0
  };
}

function pushResetSecurityEvent(db, event) {
  const state = getSystemResetState(db);
  state.security_events.push({
    id: nextId(db, 'system_reset_security_events'),
    at: now(),
    ...event
  });
  if (state.security_events.length > 200) {
    state.security_events = state.security_events.slice(-200);
  }
}

function updateResetJob(db, jobId, patch = {}) {
  const state = getSystemResetState(db);
  const idx = state.jobs.findIndex(j => j.job_id === jobId);
  if (idx < 0) return null;
  state.jobs[idx] = { ...state.jobs[idx], ...patch, updated_at: now() };
  if (patch.phase) state.phase = patch.phase;
  if (patch.message) state.message = patch.message;
  if (typeof patch.progress === 'number') state.progress = patch.progress;
  return state.jobs[idx];
}

function finalizeResetState(db, jobId, status) {
  const state = getSystemResetState(db);
  state.in_progress = false;
  state.active_job_id = null;
  state.phase = status === 'completed' ? 'done' : 'failed';
  state.message = status === 'completed' ? 'Reset completed' : 'Reset failed';
  state.progress = status === 'completed' ? 100 : state.progress || 0;
  state.updated_at = now();
  if (status === 'completed') state.last_completed_at = now();
  if (status === 'failed') state.last_failed_at = now();
  state.jobs = state.jobs.slice(-RESET_JOB_KEEP_LIMIT);
}

function updateRestoreJob(db, jobId, patch = {}) {
  const state = getSystemRestoreState(db);
  const idx = state.jobs.findIndex(j => j.job_id === jobId);
  if (idx < 0) return null;
  state.jobs[idx] = { ...state.jobs[idx], ...patch, updated_at: now() };
  if (patch.phase) state.phase = patch.phase;
  if (patch.message) state.message = patch.message;
  if (typeof patch.progress === 'number') state.progress = patch.progress;
  return state.jobs[idx];
}

function finalizeRestoreState(db, status) {
  const state = getSystemRestoreState(db);
  state.in_progress = false;
  state.active_job_id = null;
  state.phase = status === 'completed' ? 'done' : 'failed';
  state.message = status === 'completed' ? 'Restore completed' : 'Restore failed';
  state.progress = status === 'completed' ? 100 : (state.progress || 0);
  state.updated_at = now();
  if (status === 'completed') state.last_completed_at = now();
  if (status === 'failed') state.last_failed_at = now();
  state.jobs = state.jobs.slice(-RESET_JOB_KEEP_LIMIT);
}

function healStaleMaintenanceLocks(db) {
  const terminal = new Set(['completed', 'failed', 'cancelled']);
  const staleMs = 20 * 60 * 1000;
  const nowMs = Date.now();
  let changed = false;
  const restoreState = getSystemRestoreState(db);

  const maybeTimedOut = (ts) => {
    const at = Date.parse(String(ts || ''));
    if (!Number.isFinite(at)) return false;
    return (nowMs - at) > staleMs;
  };

  const resetState = getSystemResetState(db);
  if (resetState.in_progress) {
    const job = (resetState.jobs || []).find(j => j.job_id === resetState.active_job_id);
    const status = String(job?.status || '').toLowerCase();
    const timedOut = !terminal.has(status) && maybeTimedOut(job?.updated_at || job?.started_at || resetState.updated_at);
    const restoreAfterReset = (() => {
      const restoreDone = Date.parse(String(restoreState.last_completed_at || ''));
      const resetUpdated = Date.parse(String(job?.updated_at || job?.started_at || resetState.updated_at || ''));
      return Number.isFinite(restoreDone) && Number.isFinite(resetUpdated) && restoreDone >= resetUpdated;
    })();
    if (!job || terminal.has(status) || timedOut || restoreAfterReset) {
      if (job && timedOut) {
        job.status = 'failed';
        job.phase = 'failed';
        job.error = job.error || 'Stale reset lock auto-cleared';
        job.message = 'Maintenance lock auto-cleared after timeout';
        job.completed_at = now();
        job.updated_at = now();
      }
      if (job && restoreAfterReset) {
        job.status = 'cancelled';
        job.phase = 'cancelled';
        job.error = job.error || 'Reset superseded by completed restore';
        job.message = 'Reset cancelled because a restore completed later';
        job.completed_at = now();
        job.updated_at = now();
      }
      finalizeResetState(db, resetState.active_job_id || null, status === 'completed' ? 'completed' : 'failed');
      changed = true;
    }
  }

  if (restoreState.in_progress) {
    const job = (restoreState.jobs || []).find(j => j.job_id === restoreState.active_job_id);
    const status = String(job?.status || '').toLowerCase();
    const timedOut = !terminal.has(status) && maybeTimedOut(job?.updated_at || job?.started_at || restoreState.updated_at);
    if (!job || terminal.has(status) || timedOut) {
      if (job && timedOut) {
        job.status = 'failed';
        job.phase = 'failed';
        job.error = job.error || 'Stale restore lock auto-cleared';
        job.message = 'Maintenance lock auto-cleared after timeout';
        job.completed_at = now();
        job.updated_at = now();
      }
      finalizeRestoreState(db, status === 'completed' ? 'completed' : 'failed');
      changed = true;
    }
  }

  return changed;
}

async function executeSystemRestoreJob(jobId) {
  let db = readDB();
  const restoreState = getSystemRestoreState(db);
  const job = restoreState.jobs.find(j => j.job_id === jobId);
  if (!job) return;
  try {
    updateRestoreJob(db, jobId, { status: 'running', phase: 'backup', progress: 10, message: 'Creating safety backup before restore' });
    writeDB(db);

    const safetyBackup = await createDbBackup(`pre-restore:${job.started_by || 'admin'}`);

    db = readDB();
    updateRestoreJob(db, jobId, { phase: 'loading_backup', progress: 35, message: 'Loading selected backup file', safety_backup: safetyBackup });
    writeDB(db);

    const loaded = loadBackupStateById(job.backup_id);

    db = readDB();
    const existingRestoreState = getSystemRestoreState(db);
    const existingJobs = Array.isArray(existingRestoreState.jobs) ? existingRestoreState.jobs.slice(-RESET_JOB_KEEP_LIMIT) : [];
    const existingEvents = Array.isArray(existingRestoreState.security_events) ? existingRestoreState.security_events.slice(-200) : [];

    let restoredDb = loaded.data;
    if (!restoredDb || typeof restoredDb !== 'object') throw new Error('Backup data is invalid');
    if (!Array.isArray(restoredDb.users)) throw new Error('Backup data missing users');

    ensureClinicProfile(restoredDb);

    // Never carry over active maintenance locks from backup snapshots.
    const restoredResetState = getSystemResetState(restoredDb);
    restoredResetState.in_progress = false;
    restoredResetState.active_job_id = null;
    restoredResetState.phase = 'done';
    restoredResetState.message = 'Reset state cleared during restore';
    restoredResetState.progress = 100;
    restoredResetState.updated_at = now();

    const restoredRestoreState = getSystemRestoreState(restoredDb);
    restoredRestoreState.in_progress = false;
    restoredRestoreState.active_job_id = null;
    restoredRestoreState.phase = 'applying';
    restoredRestoreState.message = 'Applying restored database state';
    restoredRestoreState.progress = 75;
    restoredRestoreState.updated_at = now();

    const rs = getSystemRestoreState(restoredDb);
    rs.jobs = existingJobs;
    rs.security_events = existingEvents;

    updateRestoreJob(restoredDb, jobId, {
      status: 'running',
      phase: 'applying',
      progress: 75,
      message: 'Applying restored database state',
      source: loaded.source,
      backup_files: loaded.files,
      safety_backup: safetyBackup
    });

    rs.security_events.push({
      id: nextId(restoredDb, 'system_restore_security_events'),
      at: now(),
      actor_id: job.started_by_user_id || null,
      actor_name: job.started_by || 'admin',
      action: 'system_restore_completed',
      backup_id: job.backup_id,
      source: loaded.source,
      notes: 'Database restored from backup file'
    });
    if (rs.security_events.length > 200) rs.security_events = rs.security_events.slice(-200);

    finalizeRestoreState(restoredDb, 'completed');
    updateRestoreJob(restoredDb, jobId, {
      status: 'completed',
      phase: 'done',
      progress: 100,
      message: 'Restore completed successfully',
      completed_at: now(),
      source: loaded.source,
      backup_files: loaded.files,
      safety_backup: safetyBackup
    });

    writeDB(restoredDb);
  } catch (e) {
    db = readDB();
    updateRestoreJob(db, jobId, {
      status: 'failed',
      phase: 'failed',
      message: `Restore failed: ${e.message}`,
      error: String(e.message || e),
      completed_at: now()
    });
    const rs = getSystemRestoreState(db);
    rs.security_events.push({
      id: nextId(db, 'system_restore_security_events'),
      at: now(),
      actor_id: job.started_by_user_id || null,
      actor_name: job.started_by || 'admin',
      action: 'system_restore_failed',
      backup_id: job.backup_id,
      notes: String(e.message || e)
    });
    if (rs.security_events.length > 200) rs.security_events = rs.security_events.slice(-200);
    finalizeRestoreState(db, 'failed');
    writeDB(db);
  }
}

async function executeSystemResetJob(jobId) {
  let db = readDB();
  const state = getSystemResetState(db);
  const job = state.jobs.find(j => j.job_id === jobId);
  if (!job) return;
  const includeAuditLogs = !!job.include_audit_logs;

  try {
    updateResetJob(db, jobId, { status: 'running', phase: 'backup', progress: 8, message: 'Creating backup before reset' });
    writeDB(db);

    const backup = await createDbBackup(job.started_by || 'admin');

    db = readDB();
    updateResetJob(db, jobId, { backup, phase: 'lockdown', progress: 16, message: 'Backup completed. Starting cleanup' });
    writeDB(db);

    db = readDB();
    const phase = (name, progress, message) => {
      updateResetJob(db, jobId, { phase: name, progress, message });
    };

    phase('deleting_patients', 28, 'Deleting patients and package subscriptions');
    db.patients = [];
    db.patient_packages = [];

    phase('deleting_schedule', 40, 'Deleting appointments and follow-ups');
    db.appointments = [];
    db.follow_ups = [];

    phase('deleting_emr', 52, 'Deleting EMR data');
    db.prescriptions = [];
    if (Array.isArray(db.clinical_notes)) db.clinical_notes = [];
    if (Array.isArray(db.lab_records)) db.lab_records = [];

    phase('deleting_billing', 64, 'Deleting billing, payments and refunds');
    db.bills = [];
    db.refunds = [];

    phase('deleting_expenses', 72, 'Deleting expenses');
    db.expenses = [];

    phase('deleting_inventory', 82, 'Deleting inventory transactions');
    db.store_purchase_orders = [];
    db.store_supplier_invoice_payments = [];
    db.store_transfers = [];
    db.store_adjustments = [];
    db.store_service_consumptions = [];
    db.store_manual_consumptions = [];
    db.store_supplier_returns = [];
    db.store_stock = [];
    if (Array.isArray(db.store_service_products)) db.store_service_products = [];

    phase('deleting_services_packages', 88, 'Deleting service and package masters');
    db.services = [];
    db.packages = [];

    phase('deleting_reports', 90, 'Deleting report caches and logs');
    if (Array.isArray(db.reports_cache)) db.reports_cache = [];
    if (Array.isArray(db.report_cache)) db.report_cache = [];
    if (Array.isArray(db.report_logs)) db.report_logs = [];
    if (includeAuditLogs) db.activity_logs = [];

    phase('resetting_sequences', 95, 'Resetting transactional counters');
    if (!db._seq || typeof db._seq !== 'object') db._seq = {};
    [
      'patients','appointments','follow_ups','prescriptions','bills','refunds','expenses','services','packages','patient_packages',
      'store_purchase_orders','store_supplier_invoice_payments','store_transfers','store_adjustments',
      'store_service_consumptions','store_manual_consumptions','store_stock','store_service_products','clinical_notes','lab_records',
      'reports_cache','report_cache','report_logs'
    ].forEach((k) => { db._seq[k] = 0; });

    const finishedAt = now();
    db.last_reset = {
      at: finishedAt,
      by_user_id: job.started_by_user_id || null,
      by: job.started_by || 'admin',
      scope: job.scope,
      include_audit_logs: includeAuditLogs,
      backup_id: backup && backup.backup_id ? backup.backup_id : null,
      summary_before: job.summary_before || null
    };

    pushResetSecurityEvent(db, {
      actor_id: job.started_by_user_id || null,
      actor_name: job.started_by || 'admin',
      action: 'system_reset_completed',
      scope: job.scope,
      include_audit_logs: includeAuditLogs,
      backup_id: backup && backup.backup_id ? backup.backup_id : null,
      notes: 'Transactional data reset completed'
    });

    // Keep a reset timestamp in activity log when logs are retained.
    if (!includeAuditLogs) {
      logActivity(db, null, {
        module: 'system',
        action: 'tenant_reset',
        notes: `Transactional data reset completed by ${job.started_by || 'admin'}`,
        meta: { job_id: jobId, backup_id: backup && backup.backup_id ? backup.backup_id : null }
      });
    }

    updateResetJob(db, jobId, {
      status: 'completed',
      phase: 'done',
      progress: 100,
      message: 'Reset completed successfully',
      completed_at: finishedAt,
      backup
    });
    finalizeResetState(db, jobId, 'completed');
    writeDB(db);
  } catch (e) {
    db = readDB();
    updateResetJob(db, jobId, {
      status: 'failed',
      phase: 'failed',
      message: `Reset failed: ${e.message}`,
      error: String(e.message || e),
      completed_at: now()
    });
    pushResetSecurityEvent(db, {
      actor_id: job.started_by_user_id || null,
      actor_name: job.started_by || 'admin',
      action: 'system_reset_failed',
      scope: job.scope,
      include_audit_logs: includeAuditLogs,
      notes: String(e.message || e)
    });
    finalizeResetState(db, jobId, 'failed');
    writeDB(db);
  }
}

function now()   { return new Date().toLocaleString('sv').replace('T',' '); }
function today() { return new Date().toLocaleDateString('sv'); }
function enrichBillLineItems(db, lineItems) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const byId = (arr, id) => (Array.isArray(arr) ? arr.find(x => parseInt(x.id) === parseInt(id)) : null);
  return items.map((raw) => {
    const item = { ...(raw || {}) };
    const refId = parseInt(item.ref_id);
    const serviceId = parseInt(item.service_id);
    const type = String(item.type || '').toLowerCase();

    if (!item.package_name) {
      if (type === 'package' && refId) {
        const pkg = byId(db.packages, refId);
        if (pkg) item.package_name = pkg.name || '';
      } else if (type === 'pkg_session' && refId) {
        const patPkg = byId(db.patient_packages, refId);
        if (patPkg) item.package_name = patPkg.package_name || '';
      }
    }

    if (!Array.isArray(item.selected_service_names) || !item.selected_service_names.length) {
      if (type === 'package' && Array.isArray(item.selected_service_ids) && item.selected_service_ids.length) {
        item.selected_service_names = item.selected_service_ids
          .map((sid) => byId(db.services, sid))
          .filter(Boolean)
          .map((s) => s.name || '');
      } else if (type === 'pkg_session' && serviceId) {
        const s = byId(db.services, serviceId);
        item.selected_service_names = s ? [s.name || ''] : [];
      }
    }

    if (!item.name) {
      if (type === 'product' && refId) {
        const p = byId(db.store_products, refId);
        if (p) item.name = p.name || '';
      } else if (type === 'service' && refId) {
        const s = byId(db.services, refId);
        if (s) item.name = s.name || '';
      } else if (type === 'package' && refId) {
        const pkg = byId(db.packages, refId);
        if (pkg) item.name = pkg.name || '';
      } else if (type === 'pkg_session' && serviceId) {
        const s = byId(db.services, serviceId);
        if (s) item.name = s.name || '';
      }

      if (!item.name) {
        if (type === 'product' && refId) item.name = `Deleted product #${refId}`;
        else if (type === 'service' && refId) item.name = `Deleted service #${refId}`;
        else if (type === 'package' && refId) item.name = `Deleted package #${refId}`;
        else if (type === 'pkg_session' && serviceId) item.name = `Deleted service #${serviceId}`;
        else item.name = `Item #${refId || serviceId || 'N/A'}`;
      }
    }

    if (type === 'pkg_session' && item.package_name && item.name && !String(item.name).includes(`[${item.package_name}]`)) {
      item.name = `${item.name} [${item.package_name}]`;
    }

    if (type === 'product' && !item.unit && refId) {
      const p = byId(db.store_products, refId);
      if (p) item.unit = p.unit || p.uom_symbol || '';
    }

    return item;
  });
}
function dateAddDays(dateStr, days) {
  const dt = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dt)) return dateStr;
  dt.setDate(dt.getDate() + parseInt(days || 0, 10));
  return dt.toLocaleDateString('sv');
}
function toDayStartMs(dateStr) {
  const dt = new Date(`${String(dateStr || '').slice(0, 10)}T00:00:00`);
  return isNaN(dt) ? NaN : dt.getTime();
}
function ensureClinicProfile(db) {
  const ensureReceiptFields = (profile) => {
    let changed = false;
    if (profile.receipt_header === undefined) { profile.receipt_header = ''; changed = true; }
    if (profile.receipt_footer === undefined) { profile.receipt_footer = 'Thank you for visiting our clinic. Get well soon!'; changed = true; }
    if (profile.printer_type === undefined) { profile.printer_type = ''; changed = true; }
    if (profile.printer_name === undefined) { profile.printer_name = ''; changed = true; }
    if (profile.printer_ip === undefined) { profile.printer_ip = ''; changed = true; }
    if (profile.printer_port === undefined) { profile.printer_port = 9100; changed = true; }
    if (!profile.printer_terminals || typeof profile.printer_terminals !== 'object') { profile.printer_terminals = {}; changed = true; }
    if (profile.print_mode === undefined) { profile.print_mode = 'auto'; changed = true; }
    return changed;
  };

  if (!db.clinic_profile || typeof db.clinic_profile !== 'object') {
    db.clinic_profile = {
      clinic_name: 'ClinicMS',
      trade_name: '',
      address: '',
      phone: '',
      email: '',
      tax_number: '',
      logo_url: '',
      receipt_header: '',
      receipt_footer: 'Thank you for visiting our clinic. Get well soon!',
      timezone: 'Asia/Kuwait',
      currency: 'KD',
      billing_store_id: null,
      max_users: 25,
      no_show_booking_limit: 5,
      printer_type: '',
      printer_name: '',
      printer_ip: '',
      printer_port: 9100,
      printer_terminals: {},
      print_mode: 'auto',
      setup_completed: false,
      subscription: {
        plan: 'trial',
        status: 'trial',
        trial_start: today(),
        trial_end: dateAddDays(today(), 14),
        subscription_start: '',
        subscription_end: '',
        grace_days: 3,
        notes: '',
        last_verified_at: now()
      },
      created_at: now(),
      updated_at: now()
    };
    return true;
  }
  const hadReceiptUpdate = ensureReceiptFields(db.clinic_profile);
  if (!Number.isInteger(parseInt(db.clinic_profile.no_show_booking_limit, 10)) || parseInt(db.clinic_profile.no_show_booking_limit, 10) < 1) {
    db.clinic_profile.no_show_booking_limit = 5;
    db.clinic_profile.updated_at = now();
    return true;
  }
  if (!db.clinic_profile.subscription || typeof db.clinic_profile.subscription !== 'object') {
    db.clinic_profile.subscription = {
      plan: 'trial',
      status: 'trial',
      trial_start: today(),
      trial_end: dateAddDays(today(), 14),
      subscription_start: '',
      subscription_end: '',
      grace_days: 3,
      notes: '',
      last_verified_at: now()
    };
    db.clinic_profile.updated_at = now();
    return true;
  }
  return hadReceiptUpdate;
}

function getBillingProductStore(db) {
  ensureClinicProfile(db);
  const stores = Array.isArray(db.store_sub_stores) ? db.store_sub_stores : [];
  const configuredId = parseInt(db.clinic_profile && db.clinic_profile.billing_store_id, 10);
  const configured = stores.find((s) => parseInt(s.id, 10) === configuredId && s.active !== false);
  if (configured) return configured;
  return stores.find((s) => s.is_main && s.active !== false) || stores.find((s) => s.active !== false) || null;
}

function normalizeTerminalId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 96);
}

function getTerminalIdFromReq(req) {
  if (!req) return '';
  const fromHeader = req.get ? req.get('x-terminal-id') : '';
  const fromBody = req.body && req.body.terminal_id;
  const fromQuery = req.query && req.query.terminal_id;
  return normalizeTerminalId(fromHeader || fromBody || fromQuery);
}

function resolvePrinterConfig(profile, terminalId = '') {
  const fallback = {
    printer_type: String(profile.printer_type || '').trim(),
    printer_name: String(profile.printer_name || '').trim(),
    printer_ip: String(profile.printer_ip || '').trim(),
    printer_port: parseInt(profile.printer_port || 9100, 10) || 9100,
    terminal_id: ''
  };
  const tid = normalizeTerminalId(terminalId);
  if (!tid) return fallback;
  const map = (profile.printer_terminals && typeof profile.printer_terminals === 'object') ? profile.printer_terminals : {};
  const hit = map[tid];
  if (!hit || typeof hit !== 'object') return fallback;
  return {
    printer_type: String(hit.printer_type || fallback.printer_type || '').trim(),
    printer_name: String(hit.printer_name || fallback.printer_name || '').trim(),
    printer_ip: String(hit.printer_ip || '').trim(),
    printer_port: parseInt(hit.printer_port || 9100, 10) || 9100,
    terminal_id: tid
  };
}

// Cache git commit hash once at startup to avoid spawning git.exe on every request
let _cachedGitCommit = '';
try {
  _cachedGitCommit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname, timeout: 3000 }).toString().trim();
} catch (_) {}

function getAppBuildInfo() {
  let version = '0.0.0';
  let packageMtime = '';
  let serverMtime = '';
  let appJsMtime = '';
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      version = String(pkg.version || version);
      packageMtime = fs.statSync(pkgPath).mtime.toISOString();
    }
  } catch (_) {}
  try {
    const p = path.join(__dirname, 'server.js');
    if (fs.existsSync(p)) serverMtime = fs.statSync(p).mtime.toISOString();
  } catch (_) {}
  try {
    const p = path.join(__dirname, 'public', 'app.js');
    if (fs.existsSync(p)) appJsMtime = fs.statSync(p).mtime.toISOString();
  } catch (_) {}
  const latestFileMtime = [appJsMtime, serverMtime, packageMtime].filter(Boolean).sort().slice(-1)[0] || '';
  const gitCommit = _cachedGitCommit;
  return {
    version,
    git_commit: gitCommit,
    started_at: APP_STARTED_AT,
    latest_file_mtime: latestFileMtime,
    server_js_mtime: serverMtime,
    app_js_mtime: appJsMtime,
    package_json_mtime: packageMtime
  };
}

function getClinicSystemStatus(db, terminalId = '') {
  ensureClinicProfile(db);
  const profile = db.clinic_profile;
  const billingStore = getBillingProductStore(db);
  const printerCfg = resolvePrinterConfig(profile, terminalId);
  const sub = profile.subscription || {};
  const plan = String(sub.plan || 'trial').toLowerCase();
  const forced = String(sub.status || '').toLowerCase();
  const graceDays = Math.max(0, parseInt(sub.grace_days || 0, 10));
  const endDate = (plan === 'trial') ? String(sub.trial_end || '') : String(sub.subscription_end || '');
  const startDate = (plan === 'trial') ? String(sub.trial_start || '') : String(sub.subscription_start || '');
  const todayMs = toDayStartMs(today());
  const endMs = toDayStartMs(endDate);
  let status = forced || (plan === 'trial' ? 'trial' : 'active');
  let daysLeft = null;

  if (forced === 'suspended') {
    status = 'suspended';
  } else if (!isNaN(endMs)) {
    daysLeft = Math.ceil((endMs - todayMs) / (24 * 60 * 60 * 1000));
    if (daysLeft < 0) {
      status = (Math.abs(daysLeft) <= graceDays) ? 'grace' : 'expired';
    } else if (plan === 'trial') {
      status = 'trial';
    } else if (forced !== 'expired') {
      status = 'active';
    }
  }

  return {
    clinic: {
      clinic_name: profile.clinic_name || 'ClinicMS',
      trade_name: profile.trade_name || '',
      address: profile.address || '',
      phone: profile.phone || '',
      email: profile.email || '',
      tax_number: profile.tax_number || '',
      logo_url: profile.logo_url || '',
      receipt_header: profile.receipt_header || '',
      receipt_footer: profile.receipt_footer || 'Thank you for visiting our clinic. Get well soon!',
      timezone: profile.timezone || 'Asia/Kuwait',
      currency: profile.currency || 'KD',
      billing_store_id: billingStore ? parseInt(billingStore.id, 10) : null,
      billing_store_name: billingStore ? (billingStore.name || '') : '',
      max_users: parseInt(profile.max_users || 0, 10) || 0,
      no_show_booking_limit: Math.max(1, parseInt(profile.no_show_booking_limit || 5, 10)),
      setup_completed: !!profile.setup_completed
    },
    printer: {
      printer_type: printerCfg.printer_type || '',
      printer_name: printerCfg.printer_name || '',
      printer_ip: printerCfg.printer_ip || '',
      printer_port: printerCfg.printer_port || 9100,
      terminal_id: printerCfg.terminal_id || '',
      print_mode: ['auto', 'manual'].includes(profile.print_mode) ? profile.print_mode : 'auto'
    },
    subscription: {
      plan,
      status,
      trial_start: startDate && plan === 'trial' ? startDate : String(sub.trial_start || ''),
      trial_end: String(sub.trial_end || ''),
      subscription_start: plan === 'trial' ? String(sub.subscription_start || '') : startDate,
      subscription_end: String(sub.subscription_end || ''),
      grace_days: graceDays,
      days_left: daysLeft,
      notes: String(sub.notes || ''),
      last_verified_at: String(sub.last_verified_at || now())
    },
    build: getAppBuildInfo(),
    setup_required: !profile.setup_completed,
    blocked: status === 'expired' || status === 'suspended',
    blocked_reason: status === 'expired' ? 'subscription_expired' : (status === 'suspended' ? 'subscription_suspended' : '')
  };
}
function parseTimeToMinutes(t) {
  const m = String(t || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
  return hh * 60 + mm;
}
function minutesToHHMM(mins) {
  const m = Math.max(0, Math.min(24 * 60, parseInt(mins, 10) || 0));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
function normalizeWeeklyOffDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map(d => parseInt(d, 10)).filter(d => d >= 0 && d <= 6))].sort((a, b) => a - b);
}
function normalizeScheduleBreaks(breaks) {
  if (!Array.isArray(breaks)) return [];
  const out = [];
  for (const b of breaks) {
    const start = String((b && b.start) || '').trim();
    const end = String((b && b.end) || '').trim();
    const sm = parseTimeToMinutes(start);
    const em = parseTimeToMinutes(end);
    if (isNaN(sm) || isNaN(em) || em <= sm) continue;
    out.push({
      start: minutesToHHMM(sm),
      end: minutesToHHMM(em),
      label: String((b && b.label) || '').trim() || 'Break'
    });
  }
  out.sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
  return out;
}
function defaultDoctorSchedule(doctorId) {
  return {
    doctor_id: parseInt(doctorId),
    work_start: '09:00',
    work_end: '17:00',
    weekly_off_days: [5],
    breaks: [],
    updated_at: now()
  };
}
function getDoctorSchedule(db, doctorId) {
  if (!db.doctor_schedules) db.doctor_schedules = [];
  const did = parseInt(doctorId);
  const found = (db.doctor_schedules || []).find(s => parseInt(s.doctor_id) === did);
  if (!found) return defaultDoctorSchedule(did);
  return {
    doctor_id: did,
    work_start: String(found.work_start || '09:00'),
    work_end: String(found.work_end || '17:00'),
    weekly_off_days: normalizeWeeklyOffDays(found.weekly_off_days || []),
    breaks: normalizeScheduleBreaks(found.breaks || []),
    updated_at: found.updated_at || now(),
    updated_by: found.updated_by || null
  };
}
function saveDoctorSchedule(db, doctorId, payload, userId = null) {
  if (!db.doctor_schedules) db.doctor_schedules = [];
  const did = parseInt(doctorId);
  const next = {
    doctor_id: did,
    work_start: String(payload.work_start || '09:00'),
    work_end: String(payload.work_end || '17:00'),
    weekly_off_days: normalizeWeeklyOffDays(payload.weekly_off_days || []),
    breaks: normalizeScheduleBreaks(payload.breaks || []),
    updated_at: now(),
    updated_by: userId || null
  };
  const idx = db.doctor_schedules.findIndex(s => parseInt(s.doctor_id) === did);
  if (idx === -1) db.doctor_schedules.push(next);
  else db.doctor_schedules[idx] = next;
  return next;
}
function validateDoctorSchedulePayload(payload) {
  const ws = String(payload.work_start || '').trim();
  const we = String(payload.work_end || '').trim();
  const wsMin = parseTimeToMinutes(ws);
  const weMin = parseTimeToMinutes(we);
  if (isNaN(wsMin) || isNaN(weMin) || weMin <= wsMin) {
    return { ok: false, error: 'Invalid working hours' };
  }
  const weeklyOffDays = normalizeWeeklyOffDays(payload.weekly_off_days || []);
  const breaks = normalizeScheduleBreaks(payload.breaks || []);
  for (const b of breaks) {
    const bs = parseTimeToMinutes(b.start);
    const be = parseTimeToMinutes(b.end);
    if (bs < wsMin || be > weMin) return { ok: false, error: `Break ${b.start}-${b.end} must be within working hours` };
  }
  for (let i = 1; i < breaks.length; i++) {
    const prevEnd = parseTimeToMinutes(breaks[i - 1].end);
    const curStart = parseTimeToMinutes(breaks[i].start);
    if (curStart < prevEnd) return { ok: false, error: 'Break timings overlap' };
  }
  return { ok: true, value: { work_start: minutesToHHMM(wsMin), work_end: minutesToHHMM(weMin), weekly_off_days: weeklyOffDays, breaks } };
}
function weekdayFromDateStr(dateStr) {
  const dt = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dt)) return NaN;
  return dt.getDay();
}
function normalizeFollowUpStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'completed') return 'Completed';
  if (raw === 'missed') return 'Missed';
  if (raw === 'cancelled') return 'Cancelled';
  return 'Pending';
}
function normalizeFollowUpTime(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return '';
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function isValidDateStr(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}
function createFollowUpRecord(db, req, payload = {}) {
  const patientId = parseInt(payload.patient_id);
  const doctorId = payload.doctor_id ? parseInt(payload.doctor_id) : null;
  const appointmentId = payload.appointment_id ? parseInt(payload.appointment_id) : null;
  const dueDate = String(payload.due_date || '').slice(0, 10);
  const dueTime = normalizeFollowUpTime(payload.due_time);
  const purpose = String(payload.purpose || '').trim();
  const notes = String(payload.notes || '').trim();

  const id = nextId(db, 'follow_ups');
  const fu = {
    id,
    patient_id: patientId,
    appointment_id: appointmentId || null,
    doctor_id: doctorId || null,
    due_date: dueDate,
    due_time: dueTime || '',
    purpose,
    notes: notes || '',
    status: normalizeFollowUpStatus(payload.status),
    created_at: now(),
    updated_at: now(),
    completed_at: null,
    created_by: req && req.session && req.session.user ? req.session.user.id : null,
    completed_by: null,
    completion_notes: ''
  };
  db.follow_ups.push(fu);
  return fu;
}
function validateDoctorSlotAvailability(db, doctorId, date, time, ignoreAppointmentId = null) {
  const did = parseInt(doctorId);
  const doc = (db.users || []).find(u => u.id === did && u.role === 'doctor' && u.active !== false);
  if (!doc) return { ok: false, error: 'Doctor not found or inactive' };

  const sch = getDoctorSchedule(db, did);
  const dow = weekdayFromDateStr(date);
  if (isNaN(dow)) return { ok: false, error: 'Invalid appointment date' };
  if ((sch.weekly_off_days || []).includes(dow)) {
    return { ok: false, error: 'Doctor is on holiday on this day' };
  }

  const startMin = parseTimeToMinutes(time);
  if (isNaN(startMin)) return { ok: false, error: 'Invalid appointment time' };
  const dur = Math.max(1, parseInt(doc.slot_duration || 30, 10));
  const endMin = startMin + dur;
  const workStart = parseTimeToMinutes(sch.work_start);
  const workEnd = parseTimeToMinutes(sch.work_end);
  if (startMin < workStart || endMin > workEnd) {
    return { ok: false, error: `Doctor working hours are ${sch.work_start}-${sch.work_end}` };
  }

  for (const b of (sch.breaks || [])) {
    const bs = parseTimeToMinutes(b.start);
    const be = parseTimeToMinutes(b.end);
    const overlaps = startMin < be && endMin > bs;
    if (overlaps) return { ok: false, error: `Selected time is in break (${b.start}-${b.end})` };
  }

  const sameDay = (db.appointments || []).filter(a => a.date === date && parseInt(a.doctor_id) === did && a.status !== 'Cancelled');
  const ignoreId = ignoreAppointmentId != null ? parseInt(ignoreAppointmentId) : null;
  for (const a of sameDay) {
    if (ignoreId && parseInt(a.id) === ignoreId) continue;
    const aStart = parseTimeToMinutes(a.time);
    const aEnd = aStart + dur;
    if (startMin < aEnd && endMin > aStart) {
      return { ok: false, error: `Doctor already has an appointment at ${a.time}` };
    }
  }
  return { ok: true };
}
function getUomById(db, id) {
  return (db.uoms || []).find(u => u.id === parseInt(id));
}
function resolveUomFactor(db, uomId, fallbackFactor = 1) {
  const u = getUomById(db, uomId);
  if (u && u.active !== false) return parseFloat(u.factor || 1);
  return parseFloat(fallbackFactor || 1);
}
function getProductUomMappings(db, productId) {
  return (db.store_product_uoms || []).filter(x => x.product_id === parseInt(productId));
}
function getProductUomOptions(db, product) {
  const opts = [];
  const seen = new Set();
  const baseUom = getUomById(db, product && product.uom_id);
  if (baseUom && baseUom.active !== false) {
    opts.push({ uom_id: baseUom.id, factor: 1, symbol: baseUom.symbol, name: baseUom.name, is_base: true });
    seen.add(baseUom.id);
  }
  for (const m of getProductUomMappings(db, product && product.id)) {
    const u = getUomById(db, m.uom_id);
    if (!u || u.active === false || seen.has(u.id)) continue;
    const factor = parseFloat(m.factor || 0);
    if (!(factor > 0)) continue;
    opts.push({ uom_id: u.id, factor, symbol: u.symbol, name: u.name, is_base: false });
    seen.add(u.id);
  }
  return opts;
}
function resolveLineFactor(db, productId, uomId, fallbackFactor = 1) {
  const uid = parseInt(uomId);
  const pid = parseInt(productId);
  const product = (db.store_products || []).find(p => p.id === pid);
  if (product) {
    const options = getProductUomOptions(db, product);
    const picked = options.find(o => o.uom_id === uid);
    if (picked) return parseFloat(picked.factor || 1);
  }
  return resolveUomFactor(db, uid, fallbackFactor);
}

function collectServiceUsageFromBillItems(lineItems = []) {
  const usageByService = new Map();
  const addUse = (serviceId, qty) => {
    const sid = parseInt(serviceId);
    const q = parseFloat(qty || 0);
    if (!sid || !(q > 0)) return;
    usageByService.set(sid, (usageByService.get(sid) || 0) + q);
  };

  for (const item of (Array.isArray(lineItems) ? lineItems : [])) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'service') {
      addUse(item.ref_id, item.qty || 1);
    } else if (item.type === 'pkg_session') {
      addUse(item.service_id, item.qty || 1);
    } else if (item.type === 'package' && Array.isArray(item.selected_service_ids)) {
      for (const sid of item.selected_service_ids) addUse(sid, 1);
    }
  }

  return [...usageByService.entries()].map(([service_id, service_qty]) => ({ service_id, service_qty }));
}

const MANUAL_CONSUMPTION_REASONS = [
  'Treatment Usage',
  'Wastage',
  'Expired',
  'Internal Use',
  'Sample',
  'Adjustment'
];

function normalizeManualConsumptionReason(value) {
  const raw = String(value || '').trim().toLowerCase();
  const picked = MANUAL_CONSUMPTION_REASONS.find(r => r.toLowerCase() === raw);
  return picked || 'Adjustment';
}

function recordServiceProductConsumption(db, req, payload = {}) {
  ensureStore(db);
  if (!db.store_service_consumptions) db.store_service_consumptions = [];

  const billId = parseInt(payload.bill_id);
  const patientId = payload.patient_id != null ? parseInt(payload.patient_id) : null;
  const appointmentId = payload.appointment_id != null ? parseInt(payload.appointment_id) : null;
  const visitId = payload.visit_id || null;
  const serviceUsage = collectServiceUsageFromBillItems(payload.line_items || []);
  if (!serviceUsage.length) return;

  const mainStore = (db.store_sub_stores || []).find(s => s.is_main) || (db.store_sub_stores || [])[0];
  if (!mainStore) return;

  const linksByService = new Map();
  for (const link of (db.store_service_products || [])) {
    const sid = parseInt(link.service_id);
    if (!sid) continue;
    if (!linksByService.has(sid)) linksByService.set(sid, []);
    linksByService.get(sid).push(link);
  }

  for (const use of serviceUsage) {
    const sid = parseInt(use.service_id);
    const serviceQty = parseFloat(use.service_qty || 0);
    if (!(serviceQty > 0)) continue;
    const links = linksByService.get(sid) || [];
    for (const link of links) {
      const pid = parseInt(link.product_id);
      const qtyPerUse = parseFloat(link.qty_per_use || 0);
      if (!pid || !(qtyPerUse > 0)) continue;
      const consumedQty = parseFloat((serviceQty * qtyPerUse).toFixed(3));
      const stock = getStock(db, pid, mainStore.id);
      const unitCost = parseFloat(stock.avg_cost || 0) || 0;
      const totalCost = parseFloat((consumedQty * unitCost).toFixed(3));
      const stockBefore = parseFloat(stock.qty || 0);
      stock.qty = parseFloat((stock.qty - consumedQty).toFixed(3));
      const stockAfter = parseFloat(stock.qty || 0);

      db.store_service_consumptions.push({
        id: nextId(db, 'store_service_consumptions'),
        at: now(),
        date: today(),
        bill_id: isNaN(billId) ? null : billId,
        patient_id: isNaN(patientId) ? null : patientId,
        appointment_id: isNaN(appointmentId) ? null : appointmentId,
        visit_id: visitId,
        service_id: sid,
        product_id: pid,
        service_qty: serviceQty,
        qty_per_use: qtyPerUse,
        consumed_qty: consumedQty,
        unit_cost: unitCost,
        total_cost: totalCost,
        store_id: mainStore.id,
        stock_before: stockBefore,
        stock_after: stockAfter,
        created_by: req && req.session ? ((req.session.user && req.session.user.id) || req.session.userId || null) : null
      });
    }
  }
}

function logActivity(db, req, payload = {}) {
  if (!db.activity_logs) db.activity_logs = [];
  const actor = req && req.session && req.session.user ? req.session.user : {};
  const id = nextId(db, 'activity_logs');
  db.activity_logs.push({
    id,
    at: now(),
    actor_id: actor.id || null,
    actor_name: actor.name || actor.username || 'System',
    actor_role: actor.role || 'system',
    module: payload.module || 'system',
    action: payload.action || 'updated',
    entity_type: payload.entity_type || null,
    entity_id: payload.entity_id != null ? parseInt(payload.entity_id) : null,
    patient_id: payload.patient_id != null ? parseInt(payload.patient_id) : null,
    appointment_id: payload.appointment_id != null ? parseInt(payload.appointment_id) : null,
    bill_id: payload.bill_id != null ? parseInt(payload.bill_id) : null,
    visit_id: payload.visit_id || null,
    notes: payload.notes || null,
    meta: payload.meta || null
  });
}

function autoMarkMissedAppointmentsAsNoShow(db) {
  const appointments = Array.isArray(db && db.appointments) ? db.appointments : [];
  if (!appointments.length) return false;

  const bills = Array.isArray(db && db.bills) ? db.bills : [];
  const prescriptions = Array.isArray(db && db.prescriptions) ? db.prescriptions : [];
  const currentDay = today();
  let changed = false;

  for (const appointment of appointments) {
    const status = String(appointment && appointment.status || '').trim();
    const aptDate = String(appointment && appointment.date || '').trim();
    if (!['Booked', 'Confirmed'].includes(status)) continue;
    if (!aptDate || aptDate >= currentDay) continue;

    const appointmentId = parseInt(appointment.id, 10);
    const hasLinkedBill = bills.some(bill => parseInt(bill.appointment_id, 10) === appointmentId);
    const hasLinkedPrescription = prescriptions.some(rx => parseInt(rx.appointment_id, 10) === appointmentId);
    if (hasLinkedBill || hasLinkedPrescription) continue;

    appointment.status = 'No-Show';
    logActivity(db, null, {
      module: 'appointment',
      action: 'no_show_auto',
      entity_type: 'appointment',
      entity_id: appointment.id,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      notes: `Automatically marked No-Show after ${aptDate}`,
      meta: { previous_status: status }
    });
    changed = true;
  }

  return changed;
}

function getPatientConsecutiveNoShowStreak(db, patientId) {
  const pid = parseInt(patientId, 10);
  if (!pid) return 0;

  const list = (db.appointments || [])
    .filter(a => parseInt(a.patient_id, 10) === pid)
    .sort((a, b) => {
      const ak = `${String(a.date || '')} ${String(a.time || '')} ${String(a.created_at || '')}`;
      const bk = `${String(b.date || '')} ${String(b.time || '')} ${String(b.created_at || '')}`;
      return bk.localeCompare(ak);
    });

  let streak = 0;
  for (const appointment of list) {
    if (String(appointment.status || '').trim() === 'No-Show') streak += 1;
    else break;
  }
  return streak;
}

// ---------- Seed default data ----------
(function seed() {
  const db = readDB();
  let didSeed = false;
  if (ensureClinicProfile(db)) didSeed = true;
  if (autoMarkMissedAppointmentsAsNoShow(db)) didSeed = true;
  if (db.users.length === 0) {
    const h = p => bcrypt.hashSync(p, 10);
    db.users.push({ id:1, name:'Admin User',     username:'admin',         password:h('admin123'),  role:'admin', active:true });
    db.users.push({ id:2, name:'Dr. Sarah Ali',  username:'doctor1',       password:h('doctor123'), role:'doctor', slot_duration:30, active:true });
    db.users.push({ id:3, name:'Dr. Ravi Kumar', username:'doctor2',       password:h('doctor456'), role:'doctor', slot_duration:15, active:true });
    db.users.push({ id:4, name:'Reena Verma',    username:'receptionist1', password:h('recep123'),  role:'receptionist', active:true });
    db._seq.users = 4;
    didSeed = true;
  }
  if (db.patients.length === 0) {
    const ins = (id,mr,name,age,gender,phone,address,mh,dob,civil_id) =>
      db.patients.push({ id, mr_number:mr, name, age, gender, phone, address, medical_history:mh, dob:dob||null, civil_id:civil_id||null, created_at:now() });
    ins(1,'MR00001','Ankit Sharma',   34,'Male',  '9876543210','Delhi',     'Hypertension','1992-03-15','298401234567');
    ins(2,'MR00002','Priya Singh',    28,'Female','9812345678','Mumbai',    'None','1998-07-22','298507891234');
    ins(3,'MR00003','Mohan Lal',      55,'Male',  '9800012345','Jaipur',    'Diabetes, Heart disease','1971-01-10','297112345678');
    ins(4,'MR00004','Sunita Devi',    42,'Female','9988776655','Lucknow',   'Asthma','1984-11-05','298411056789');
    ins(5,'MR00005','Ajay Patel',     19,'Male',  '9001122334','Ahmedabad', 'None','2007-06-18','300706181234');
    db._seq.patients = 5;
    db._seq.mr = 5;
    didSeed = true;
  }
  if (!db.services) db.services = [];
  if (!db.packages) db.packages = [];
  if (!db.payment_methods) db.payment_methods = [];
  if (!db.patient_packages) db.patient_packages = [];
  if (db.services.length === 0) {
    const svc = (id,name,cat,desc,price,dur) => db.services.push({ id,name,category:cat,description:desc,price,duration_min:dur,active:true,created_at:now() });
    svc(1,'General Consultation','Consultation','Standard doctor consultation',300,20);
    svc(2,'Specialist Consultation','Consultation','Specialist doctor consultation',600,30);
    svc(3,'Blood Test (CBC)','Diagnostic','Complete blood count test',250,15);
    svc(4,'Blood Glucose Test','Diagnostic','Fasting/random blood glucose',150,10);
    svc(5,'X-Ray (Chest)','Diagnostic','Chest X-ray imaging',400,20);
    svc(6,'ECG','Diagnostic','Electrocardiogram',350,15);
    svc(7,'Dressing / Wound Care','Procedure','Minor wound dressing',200,20);
    svc(8,'Physiotherapy Session','Therapy','30-min physiotherapy session',500,30);
    db._seq.services = 8;
    didSeed = true;
  }
  if (db.packages.length === 0) {
    db.packages.push({ id:1, name:'Basic Health Checkup', description:'Essential tests for a routine health checkup', service_ids:[1,3,4], discount_price:600, active:true, created_at:now() });
    db.packages.push({ id:2, name:'Cardiac Screening', description:'Heart-related diagnostics bundle', service_ids:[2,6,5], discount_price:1100, active:true, created_at:now() });
    db._seq.packages = 2;
    didSeed = true;
  }
  if (db.payment_methods.length === 0) {
    const pm = (id,name) => db.payment_methods.push({ id, name, active:true, created_at:now() });
    pm(1,'Cash'); pm(2,'Card'); pm(3,'UPI'); pm(4,'Online Transfer'); pm(5,'Insurance'); pm(6,'Cheque');
    db._seq.payment_methods = 6;
    didSeed = true;
  }
  if (!db.service_categories) db.service_categories = [];
  if (db.service_categories.length === 0) {
    const sc = (id,name) => db.service_categories.push({ id, name, created_at:now() });
    sc(1,'Consultation'); sc(2,'Diagnostic'); sc(3,'Procedure'); sc(4,'Therapy'); sc(5,'Other');
    db._seq.service_categories = 5;
    didSeed = true;
  }
  if (!db.expense_categories) db.expense_categories = [];
  if (db.expense_categories.length === 0) {
    const ec = (id, name) => db.expense_categories.push({ id, name, created_at: now() });
    ec(1, 'Utilities');
    ec(2, 'Travel');
    ec(3, 'Pantry');
    ec(4, 'Maintenance');
    ec(5, 'Marketing');
    ec(6, 'Miscellaneous');
    db._seq.expense_categories = 6;
    didSeed = true;
  }
  if (!(db.expense_categories || []).some(c => String(c.name || '').toLowerCase() === 'supplier invoice payment')) {
    db.expense_categories.push({ id: nextId(db, 'expense_categories'), name: 'Supplier Invoice Payment', created_at: now() });
    didSeed = true;
  }
  if (!db.doctor_departments) db.doctor_departments = [];
  if (db.doctor_departments.length === 0) {
    const dd = (id, name) => db.doctor_departments.push({ id, name, active:true, created_at: now() });
    dd(1, 'General');
    dd(2, 'Operation');
    dd(3, 'Laser');
    db._seq.doctor_departments = 3;
    didSeed = true;
  }
  const defaultDept = (db.doctor_departments || []).find(d => String(d.name || '').toLowerCase() === 'general') || (db.doctor_departments || [])[0];
  if (defaultDept) {
    let updatedStaffDept = false;
    for (const u of (db.users || [])) {
      if ((u.role === 'doctor' || u.role === 'receptionist') && !u.department_id) {
        u.department_id = defaultDept.id;
        updatedStaffDept = true;
      }
    }
    if (updatedStaffDept) didSeed = true;
  }
  let updatedUserStatus = false;
  for (const u of (db.users || [])) {
    if (u.active === undefined) {
      u.active = true;
      updatedUserStatus = true;
    }
  }
  if (updatedUserStatus) didSeed = true;
  if (!db.doctor_schedules) {
    db.doctor_schedules = [];
    didSeed = true;
  }
  if (!db.follow_ups) {
    db.follow_ups = [];
    didSeed = true;
  }
  if (!db.uoms) db.uoms = [];
  if (db.uoms.length === 0) {
    const u = (id,name,symbol,factor) => db.uoms.push({ id, name, symbol, factor, active:true, created_at:now() });
    u(1,'Piece','pcs',1);
    u(2,'Box','box',1);
    u(3,'Strip','strip',1);
    u(4,'Pack','pack',1);
    u(5,'Roll','roll',1);
    u(6,'Milliliter','ml',1);
    u(7,'Liter','ltr',1000);
    u(8,'Gram','g',1);
    u(9,'Kilogram','kg',1000);
    db._seq.uoms = 9;
    didSeed = true;
  }
  if (!db.store_product_categories) db.store_product_categories = [];
  if (db.store_product_categories.length === 0) {
    const c = (id, name) => db.store_product_categories.push({ id, name, active:true, created_at:now() });
    c(1, 'Consumables');
    c(2, 'Medicines');
    c(3, 'Equipment');
    c(4, 'Surgical');
    c(5, 'Diagnostic');
    db._seq.store_product_categories = 5;
    didSeed = true;
  }
  if (db.appointments.length === 0) {
    const td = today();
    const apt = (id,pid,did,date,time,status) =>
      db.appointments.push({ id, patient_id:pid, doctor_id:did, date, time, status, notes:null, created_at:now() });
    apt(1, 1, 2, td, '09:00', 'Booked');
    apt(2, 2, 2, td, '09:30', 'Booked');
    apt(3, 3, 3, td, '10:00', 'Booked');
    apt(4, 4, 2, td, '10:30', 'Completed');
    apt(5, 5, 3, td, '11:00', 'Booked');
    apt(6, 1, 3, td, '14:00', 'Booked');
    apt(7, 2, 2, td, '14:30', 'Cancelled');
    apt(8, 3, 2, td, '15:00', 'Booked');
    db._seq.appointments = 8;
    didSeed = true;
  }

  // Backfill patient registration_date for older records.
  if ((db.patients || []).length) {
    let updatedPatients = false;
    for (const p of db.patients) {
      if (!p.registration_date) {
        p.registration_date = (p.created_at || '').slice(0,10) || today();
        updatedPatients = true;
      }
    }
    if (updatedPatients) didSeed = true;
  }

  // Backfill product UOM links for older records.
  if ((db.store_products || []).length && (db.uoms || []).length) {
    const bySymbol = Object.fromEntries(db.uoms.map(u => [String(u.symbol || '').toLowerCase(), u]));
    let updatedProducts = false;
    for (const p of db.store_products) {
      if (!p.uom_id && p.unit) {
        const matched = bySymbol[String(p.unit).toLowerCase()];
        if (matched) {
          p.uom_id = matched.id;
          updatedProducts = true;
        }
      }
      if (!p.unit && p.uom_id) {
        const u = getUomById(db, p.uom_id);
        if (u) {
          p.unit = u.symbol;
          updatedProducts = true;
        }
      }
    }
    if (updatedProducts) didSeed = true;
  }
  // Seed default role permissions
  if (!db.role_permissions) db.role_permissions = {};
  const ensureRolePerms = (roleName, defaults) => {
    const existing = db.role_permissions[roleName];
    if (Array.isArray(existing)) return;
    db.role_permissions[roleName] = Array.isArray(defaults) ? [...defaults] : [];
    didSeed = true;
  };
  ensureRolePerms('admin', DEFAULT_PERMISSIONS.admin);
  ensureRolePerms('doctor', DEFAULT_PERMISSIONS.doctor);
  ensureRolePerms('receptionist', DEFAULT_PERMISSIONS.receptionist);
  if (!db.activity_logs) db.activity_logs = [];
  if (!db.store_service_consumptions) db.store_service_consumptions = [];
  if (!db.store_manual_consumptions) db.store_manual_consumptions = [];
  if (!db.expenses) db.expenses = [];
  if (!db.expense_categories) db.expense_categories = [];
  if (!db.custom_roles) db.custom_roles = [];
  writeDB(db);
  if (didSeed) console.log('Sample data initialized.');
})();

// ---------- Startup migration: backfill patient_packages from existing bills ----------
(function migratePatientPackages() {
  const db = readDB();
  if (!db.patient_packages) db.patient_packages = [];
  const processedBillIds = new Set(db.patient_packages.map(pp => pp.bill_id));
  const billsToProcess = (db.bills||[]).filter(b =>
    (b.line_items||[]).some(i => i.type === 'package') && !processedBillIds.has(b.id)
  );
  if (!billsToProcess.length) return;
  let changed = false;
  for (const bill of billsToProcess) {
    for (const item of bill.line_items.filter(i => i.type === 'package')) {
      const pkg = (db.packages||[]).find(p => p.id === parseInt(item.ref_id));
      if (!pkg) continue;
      if (!db._seq.patient_packages) db._seq.patient_packages = 0;
      db._seq.patient_packages += 1;
      const selIds = Array.isArray(item.selected_service_ids) ? item.selected_service_ids.map(Number) : [];
      const services = (pkg.service_ids||[]).map(sid => {
        const svc = (db.services||[]).find(s => s.id === sid);
        return { service_id: sid, service_name: svc ? svc.name : '', total: 1, used: selIds.includes(sid) ? 1 : 0 };
      });
      const dateStr = (bill.created_at||'').slice(0,10) || today();
      db.patient_packages.push({
        id: db._seq.patient_packages,
        patient_id: bill.patient_id,
        package_id: pkg.id,
        package_name: pkg.name,
        bill_id: bill.id,
        services,
        total_price: pkg.discount_price || 0,
        purchased_at: dateStr,
        status: (services.length && services.every(s => s.used >= s.total)) ? 'Completed' : 'Active',
        session_log: selIds.length ? [{ date: dateStr, bill_id: bill.id, service_ids: selIds,
          service_names: selIds.map(sid => { const s=(db.services||[]).find(sv=>sv.id===sid); return s?s.name:''; }) }] : []
      });
      changed = true;
    }
  }
  if (changed) { writeDB(db); console.log(`Migrated ${db.patient_packages.length} patient package record(s).`); }
})();

// ---------- Startup migration: backfill missing prescription visit_id ----------
(function migratePrescriptionVisitIds() {
  const db = readDB();
  if (!Array.isArray(db.prescriptions) || !Array.isArray(db.bills) || !db.prescriptions.length) return;

  const usedByPatient = new Map();
  for (const rx of db.prescriptions) {
    const vid = String(rx.visit_id || '').trim();
    if (!vid) continue;
    const pid = parseInt(rx.patient_id);
    if (!usedByPatient.has(pid)) usedByPatient.set(pid, new Set());
    usedByPatient.get(pid).add(vid);
  }

  const byPatientBills = new Map();
  for (const b of db.bills) {
    const pid = parseInt(b.patient_id);
    if (!byPatientBills.has(pid)) byPatientBills.set(pid, []);
    byPatientBills.get(pid).push(b);
  }
  for (const arr of byPatientBills.values()) {
    arr.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  }

  let changed = 0;
  const sortedRx = [...db.prescriptions].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  for (const rx of sortedRx) {
    if (String(rx.visit_id || '').trim()) continue;
    const pid = parseInt(rx.patient_id);
    if (!usedByPatient.has(pid)) usedByPatient.set(pid, new Set());
    const used = usedByPatient.get(pid);
    const bills = byPatientBills.get(pid) || [];
    let pick = null;

    if (rx.appointment_id) {
      pick = bills.find(b => parseInt(b.appointment_id) === parseInt(rx.appointment_id) && !used.has(String(b.visit_id || '').trim()));
    }
    if (!pick) {
      const rxAt = String(rx.created_at || '');
      const before = bills.filter(b => !used.has(String(b.visit_id || '').trim()) && String(b.created_at || '') <= rxAt);
      pick = before.length ? before[before.length - 1] : bills.find(b => !used.has(String(b.visit_id || '').trim()));
    }

    const vid = pick ? String(pick.visit_id || '').trim() : '';
    if (vid) {
      rx.visit_id = vid;
      used.add(vid);
      changed += 1;
    }
  }

  if (changed) {
    writeDB(db);
    console.log(`Backfilled visit ID for ${changed} prescription(s).`);
  }
})();

// ---------- Startup migration: backfill activity logs from historical data ----------
(function migrateActivityLogs() {
  const db = readDB();
  if (!db.activity_logs) db.activity_logs = [];
  if (db.activity_logs.length > 0) return;

  const actorById = new Map((db.users || []).map(u => [u.id, u]));
  const push = (payload) => {
    const id = nextId(db, 'activity_logs');
    db.activity_logs.push({ id, ...payload });
  };

  for (const a of (db.appointments || [])) {
    push({
      at: a.created_at || now(),
      actor_id: null,
      actor_name: 'System Migration',
      actor_role: 'system',
      module: 'appointment',
      action: 'booked',
      entity_type: 'appointment',
      entity_id: a.id,
      patient_id: a.patient_id,
      appointment_id: a.id,
      bill_id: null,
      visit_id: null,
      notes: `Booked appointment on ${a.date || ''} ${a.time || ''}`.trim(),
      meta: null
    });
    if (a.status && a.status !== 'Booked') {
      const actionMap = { Confirmed: 'confirmed', Arrived: 'arrived', Completed: 'completed', Cancelled: 'cancelled' };
      push({
        at: a.created_at || now(),
        actor_id: null,
        actor_name: 'System Migration',
        actor_role: 'system',
        module: 'appointment',
        action: actionMap[a.status] || 'status_changed',
        entity_type: 'appointment',
        entity_id: a.id,
        patient_id: a.patient_id,
        appointment_id: a.id,
        bill_id: null,
        visit_id: null,
        notes: `Appointment status is ${a.status}`,
        meta: null
      });
    }
  }

  for (const b of (db.bills || [])) {
    push({
      at: b.created_at || now(),
      actor_id: null,
      actor_name: 'System Migration',
      actor_role: 'system',
      module: 'billing',
      action: 'bill_created',
      entity_type: 'bill',
      entity_id: b.id,
      patient_id: b.patient_id,
      appointment_id: b.appointment_id || null,
      bill_id: b.id,
      visit_id: b.visit_id || null,
      notes: `Bill ${b.bill_number || b.id} created with status ${b.payment_status || 'Pending'}`,
      meta: { total: b.total || 0, payment_method: b.payment_method || 'Cash' }
    });
    if (b.payment_status === 'Paid') {
      push({
        at: b.created_at || now(),
        actor_id: null,
        actor_name: 'System Migration',
        actor_role: 'system',
        module: 'billing',
        action: 'payment_received',
        entity_type: 'bill',
        entity_id: b.id,
        patient_id: b.patient_id,
        appointment_id: b.appointment_id || null,
        bill_id: b.id,
        visit_id: b.visit_id || null,
        notes: `Payment received for ${b.bill_number || b.id}`,
        meta: { total: b.total || 0, payment_method: b.payment_method || 'Cash' }
      });
    }
  }

  if (db.activity_logs.length) {
    db.activity_logs.sort((a,b) => String(a.at || '').localeCompare(String(b.at || '')));
    writeDB(db);
    console.log(`Backfilled ${db.activity_logs.length} activity log record(s).`);
  }
})();

// ---------- Startup migration: backfill bill.created_by from activity logs ----------
(function migrateBillCreatorsFromActivity() {
  const db = readDB();
  if (!Array.isArray(db.bills) || !db.bills.length) return;
  if (!Array.isArray(db.activity_logs) || !db.activity_logs.length) return;

  const byBill = new Map();
  for (const a of db.activity_logs) {
    const billId = parseInt(a.bill_id || a.entity_id);
    const actorId = parseInt(a.actor_id);
    if (!billId || !actorId) continue;
    if (String(a.module || '').toLowerCase() !== 'billing') continue;
    if (!['bill_created', 'payment_received'].includes(String(a.action || ''))) continue;
    const cur = byBill.get(billId);
    if (!cur || String(a.at || '') < String(cur.at || '')) {
      byBill.set(billId, { actor_id: actorId, at: a.at || '' });
    }
  }

  let changed = 0;
  for (const b of db.bills) {
    const existing = parseInt(b.created_by);
    if (existing) continue;
    const hit = byBill.get(parseInt(b.id));
    if (!hit || !hit.actor_id) continue;
    b.created_by = hit.actor_id;
    changed += 1;
  }

  if (changed) {
    writeDB(db);
    console.log(`Backfilled bill creator for ${changed} bill(s).`);
  }
})();

// ---------- Middleware ----------
app.use(cors({ origin:true, credentials:true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended:true, limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'clinic-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8*60*60*1000 }
}));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
}));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error:'Not authenticated' });
  const db = readDB();
  if (healStaleMaintenanceLocks(db)) {
    writeDB(db);
  }
  const me = (db.users || []).find(u => u.id === req.session.user.id);
  if (!me || me.active === false) {
    req.session.destroy(() => res.status(401).json({ error:'Account inactive. Contact admin.' }));
    return;
  }

  const system = getClinicSystemStatus(db);
  const pathName = req.path || '';
  const ownerPaths = ['/api/me', '/api/system/status', '/api/setup/profile', '/api/setup/complete'];
  const ownerCanBypass = me.role === 'admin' && ownerPaths.some(p => pathName.startsWith(p));
  const setupBlocked = system.setup_required && me.role !== 'admin';
  if ((system.blocked || setupBlocked) && !ownerCanBypass) {
    return res.status(402).json({
      error: system.blocked ? 'Subscription is not active.' : 'Clinic setup is incomplete. Contact admin.',
      code: 'LICENSE_BLOCKED',
      system
    });
  }

  const resetState = getSystemResetState(db);
  const restoreState = getSystemRestoreState(db);
  if (resetState.in_progress || restoreState.in_progress) {
    const allowedDuringReset = [
      '/api/logout',
      '/api/me',
      '/api/system/status',
      '/api/system-reset/status',
      '/api/system-reset/jobs/',
      '/api/system-reset/precheck',
      '/api/system-reset/start',
      '/api/system-restore/status',
      '/api/system-restore/jobs/',
      '/api/system-restore/start'
    ];
    const isAllowed = allowedDuringReset.some((p) => pathName === p || pathName.startsWith(p));
    if (!isAllowed) {
      const active = resetState.in_progress ? resetState : restoreState;
      return res.status(423).json({
        error: 'System maintenance job is in progress. Please wait until completion.',
        code: 'MAINTENANCE_IN_PROGRESS',
        reset: {
          job_id: active.active_job_id || null,
          phase: active.phase || 'running',
          progress: parseInt(active.progress || 0, 10) || 0,
          message: active.message || 'Maintenance in progress'
        }
      });
    }
  }

  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error:'Not authenticated' });
    const userRole = req.session.user.role;
    if (userRole === 'admin') return next();
    if (roles.includes(userRole)) return next();
    // For custom roles: check if their permissions overlap with the default permissions
    // of the required roles - allows custom roles through if they have any matching perm
    if (!['admin','doctor','receptionist'].includes(userRole)) {
      try {
        const db = readDB();
        const userPerms = new Set(getPermissions(db, userRole));
        const neededPerms = roles.filter(r => r !== 'admin').flatMap(r => DEFAULT_PERMISSIONS[r] || []);
        if (neededPerms.some(p => userPerms.has(p))) return next();
      } catch(e) { /* fall through to 403 */ }
    }
    return res.status(403).json({ error:'Forbidden' });
  };
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error:'Not authenticated' });
    const db = readDB();
    if (!hasPermission(db, req.session.user.role, perm)) {
      return res.status(403).json({ error:'Forbidden' });
    }
    next();
  };
}

function sanitizeManualConsumptionEntryForUser(db, req, entry) {
  if (!entry || hasPermission(db, req.session.user.role, 'store.consume.cost')) return entry;
  return {
    ...entry,
    total_cost: undefined,
    items: (entry.items || []).map((item) => ({
      ...item,
      cost: undefined,
      total_cost: undefined,
    })),
  };
}

function getSessionUserRecord(db, req) {
  if (!req || !req.session || !req.session.user) return null;
  return (db.users || []).find(u => u.id === req.session.user.id) || null;
}

function normalizeUserStoreIds(user) {
  if (!user || !Array.isArray(user.store_ids)) return [];
  return [...new Set(user.store_ids.map((id) => parseInt(id, 10)).filter((id) => id > 0))];
}

function getAccessibleStoreIds(db, req) {
  if (!req || !req.session || !req.session.user) return null;
  if (req.session.user.role === 'admin') return null;
  const user = getSessionUserRecord(db, req);
  const storeIds = normalizeUserStoreIds(user);
  return storeIds.length ? new Set(storeIds) : null;
}

function filterStoresForUser(db, req, stores) {
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  if (!allowedStoreIds) return stores;
  return (stores || []).filter((store) => allowedStoreIds.has(parseInt(store.id, 10)));
}

function assertStoreAccess(db, req, storeId, label = 'store') {
  const normalizedStoreId = parseInt(storeId, 10);
  if (!normalizedStoreId) return false;
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  if (!allowedStoreIds) return true;
  return allowedStoreIds.has(normalizedStoreId);
}

function parseSubmittedStoreIds(db, storeIds) {
  ensureStore(db);
  if (storeIds === undefined || storeIds === null) return [];
  let rawIds = [];
  if (Array.isArray(storeIds)) {
    rawIds = storeIds;
  } else if (typeof storeIds === 'string') {
    rawIds = storeIds.split(',').map((part) => part.trim()).filter(Boolean);
  } else if (typeof storeIds === 'number') {
    rawIds = [storeIds];
  } else {
    rawIds = [storeIds];
  }
  const validStoreIds = new Set((db.store_sub_stores || []).map((store) => parseInt(store.id, 10)));
  const normalized = [...new Set(rawIds.map((id) => parseInt(id, 10)).filter((id) => validStoreIds.has(id)))];
  return normalized;
}

function getSubmittedStoreIds(body) {
  if (!body || typeof body !== 'object') return { provided: false, value: [] };
  const keys = ['store_ids', 'storeIds', 'allowed_store_ids', 'allowedStoreIds', 'store_access_ids', 'storeAccessIds'];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return { provided: true, value: body[key] };
    }
  }
  return { provided: false, value: [] };
}

function getVisibleDoctorIds(db, req) {
  if (!req || !req.session || !req.session.user) return null;
  const role = req.session.user.role;
  if (role === 'admin') return null;
  const doctors = (db.users || []).filter(u => u.role === 'doctor');
  const me = getSessionUserRecord(db, req);
  // Support multi-department: use department_ids array if present, fall back to department_id
  const myDeptIds = new Set(
    (Array.isArray(me?.department_ids) && me.department_ids.length
      ? me.department_ids
      : (me?.department_id ? [me.department_id] : [])
    ).map(x => parseInt(x)).filter(x => x > 0)
  );
  if (myDeptIds.size) {
    return new Set(doctors.filter(d => myDeptIds.has(parseInt(d.department_id))).map(d => d.id));
  }
  if (role === 'doctor') return new Set([req.session.user.id]);
  // Non-admin staff without department should not see all doctors.
  return new Set();
}

// ===================== AUTH =====================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error:'Username and password required' });
  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error:'Invalid credentials' });
  if (user.active === false) return res.status(403).json({ error:'Account inactive. Contact admin.' });
  req.session.user = { id:user.id, name:user.name, username:user.username, role:user.role };
  req.session.userId = user.id; // backward compatibility for legacy code paths
  res.json({ success:true, user:req.session.user });
});
app.post('/api/logout', (req, res) => { req.session.destroy(() => res.json({ success:true })); });
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error:'Not logged in' });
  const db = readDB();
  const system = getClinicSystemStatus(db, getTerminalIdFromReq(req));
  const permissions = getPermissions(db, req.session.user.role);
  const full = (db.users || []).find(u => u.id === req.session.user.id) || {};
  const dept = (db.doctor_departments || []).find(d => d.id === parseInt(full.department_id));
  const accessibleStores = filterStoresForUser(db, req, db.store_sub_stores || []).map((store) => ({ id: parseInt(store.id, 10), name: store.name || '' }));
  // Multi-department: normalise department_ids
  const deptIds = Array.isArray(full.department_ids) && full.department_ids.length
    ? full.department_ids
    : (full.department_id ? [full.department_id] : []);
  res.json({
    ...req.session.user,
    department_id: full.department_id || null,
    department_ids: deptIds,
    department_name: dept ? dept.name : '',
    store_ids: normalizeUserStoreIds(full),
    accessible_stores: accessibleStores,
    permissions,
    system
  });
});

app.post('/api/admin/db-backup', requireRole('admin'), async (req, res) => {
  try {
    const who = (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || 'admin';
    const result = await createDbBackup(who);
    res.json({ success: true, backup: result });
  } catch (e) {
    res.status(500).json({ error: `Backup failed: ${e.message}` });
  }
});

app.get('/api/admin/db-backups', requireRole('admin'), (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const rows = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('db-backup-'))
      .map(d => {
        const manifestPath = path.join(BACKUP_DIR, d.name, 'manifest.json');
        let manifest = null;
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) { manifest = null; }
        return {
          backup_id: d.name,
          created_at: manifest && manifest.created_at ? manifest.created_at : null,
          created_by: manifest && manifest.created_by ? manifest.created_by : null,
          counts: manifest && manifest.counts ? manifest.counts : null,
          files: {
            sqlite: `/api/admin/db-backups/${encodeURIComponent(d.name)}/clinic-data.sqlite`,
            json: `/api/admin/db-backups/${encodeURIComponent(d.name)}/clinic-data.json`,
            manifest: `/api/admin/db-backups/${encodeURIComponent(d.name)}/manifest.json`
          }
        };
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: `Unable to list backups: ${e.message}` });
  }
});

app.get('/api/admin/db-backups/:backupId/:fileName', requireRole('admin'), (req, res) => {
  const backupId = String(req.params.backupId || '').trim();
  const fileName = String(req.params.fileName || '').trim();
  if (!/^db-backup-/.test(backupId)) return res.status(400).json({ error: 'Invalid backup id' });
  if (!['clinic-data.sqlite', 'clinic-data.json', 'manifest.json'].includes(fileName)) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const target = path.join(BACKUP_DIR, backupId, fileName);
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'Backup file not found' });
  res.download(target);
});

function runUpdateCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || __dirname,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    timeout: options.timeout || 120000
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    error: result.error ? String(result.error.message || result.error) : ''
  };
}

app.post('/api/admin/system-update', requireRole('admin'), async (req, res) => {
  const db = readDB();
  const me = getSessionUserRecord(db, req);
  if (!me || me.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can run System Update' });
  }

  const body = req.body || {};
  const remote = String(body.remote || 'origin').trim();
  const branch = String(body.branch || 'main').trim();
  if (!/^[\w./-]+$/.test(remote) || !/^[\w./-]+$/.test(branch)) {
    return res.status(400).json({ error: 'Invalid remote or branch name' });
  }

  const GITHUB_OWNER = String(process.env.CLINIC_GITHUB_OWNER || 'mayurmadhwani2011-blip').trim();
  const GITHUB_REPO = String(process.env.CLINIC_GITHUB_REPO || 'VC').trim();
  const GITHUB_BRANCH = branch;
  const GITHUB_TOKEN = String(process.env.CLINIC_GITHUB_TOKEN || '').trim();

  const logs = [];
  const pushLog = (step, result) => {
    logs.push({
      step,
      status: result.status,
      stdout: String(result.stdout || '').slice(0, 2000),
      stderr: String(result.stderr || result.error || '').slice(0, 2000)
    });
  };

  // --- Safety backup first ---
  let backup = null;
  try {
    backup = await createDbBackup(`pre-system-update:${me.username || me.name || 'admin'}`);
  } catch (e) {
    return res.status(500).json({ error: `Failed to create safety backup: ${e.message || e}` });
  }

  const isGitRepo = runUpdateCommand('git', ['rev-parse', '--is-inside-work-tree']);
  const useGit = isGitRepo.status === 0 && /true/i.test(isGitRepo.stdout);
  pushLog('git-repo-check', isGitRepo);

  let beforeCommit = '';
  let afterCommit = '';
  let updated = false;
  let restartRequired = false;

  if (useGit) {
    // ---- Git path ----
    const beforeCommitCmd = runUpdateCommand('git', ['rev-parse', '--short', 'HEAD']);
    pushLog('before-commit', beforeCommitCmd);
    beforeCommit = beforeCommitCmd.stdout || '';

    const dataFiles = ['data/clinic-data.json', 'data/clinic-data.sqlite', 'data/clinic-data.sqlite-shm', 'data/clinic-data.sqlite-wal'];
    for (const file of dataFiles) {
      const trackedCheck = runUpdateCommand('git', ['ls-files', '--error-unmatch', file]);
      if (trackedCheck.status === 0) {
        const skip = runUpdateCommand('git', ['update-index', '--skip-worktree', file]);
        pushLog(`protect-${file}`, skip);
      }
    }

    const fetchCmd = runUpdateCommand('git', ['fetch', remote], { timeout: 180000 });
    pushLog('git-fetch', fetchCmd);
    if (fetchCmd.status !== 0) {
      return res.status(500).json({ error: 'Git fetch failed', backup, logs });
    }

    const pullCmd = runUpdateCommand('git', ['pull', '--ff-only', remote, branch], { timeout: 180000 });
    pushLog('git-pull', pullCmd);
    if (pullCmd.status !== 0) {
      return res.status(409).json({ error: 'Git pull failed. Resolve local repo conflicts, then retry.', backup, logs });
    }

    const afterCommitCmd = runUpdateCommand('git', ['rev-parse', '--short', 'HEAD']);
    pushLog('after-commit', afterCommitCmd);
    afterCommit = afterCommitCmd.stdout || '';
    updated = !!beforeCommit && !!afterCommit && beforeCommit !== afterCommit;

    if (updated) {
      const os = require('os');
      const cp = require('child_process');
      const appDir = path.resolve(__dirname);
      const SERVICE_NAME = process.env.CLINIC_SERVICE_NAME || 'ClinicManagementSystem';
      const stamp = Date.now();
      const logFile = path.join(appDir, 'update-apply.log');
      const applyScriptPath = path.join(os.tmpdir(), `clinic-git-apply-${stamp}.ps1`);
      const applyScript = [
        "$ErrorActionPreference = 'Continue'",
        `$log = ${JSON.stringify(logFile)}`,
        `$dst = ${JSON.stringify(appDir)}`,
        `$svc = ${JSON.stringify(SERVICE_NAME)}`,
        `$svcExe = ${JSON.stringify(SERVICE_NAME + '.exe')}`,
        `$reg = ${JSON.stringify(path.join(appDir, 'scripts', 'register-service.js'))}`,
        "function Write-Log([string]$m) { Add-Content -Path $log -Value $m }",
        "Write-Log ('Git apply started ' + (Get-Date))",
        "Start-Sleep -Seconds 4",
        "Push-Location $dst",
        "Write-Log '[1/3] npm install --omit=dev'",
        "cmd.exe /c \"npm.cmd install --omit=dev >> \"\"$log\"\" 2>&1\"",
        "Write-Log '[2/3] reinstall better-sqlite3'",
        "cmd.exe /c \"npm.cmd install better-sqlite3 >> \"\"$log\"\" 2>&1\"",
        "Write-Log '[3/3] restarting service'",
        "sc.exe stop \"$svc\" | Out-Null",
        "sc.exe stop \"$svcExe\" | Out-Null",
        "taskkill /F /IM node.exe *> $null",
        "Start-Sleep -Seconds 3",
        "sc.exe start \"$svc\" | Out-Null",
        "sc.exe start \"$svcExe\" | Out-Null",
        "Start-Sleep -Seconds 6",
        "$running = ((sc.exe query \"$svc\" | Out-String) -match 'RUNNING') -or ((sc.exe query \"$svcExe\" | Out-String) -match 'RUNNING')",
        "if (-not $running) {",
        "  Write-Log 'Service not running - trying re-register'",
        "  cmd.exe /c \"node \"\"$reg\"\" >> \"\"$log\"\" 2>&1\"",
        "  sc.exe start \"$svc\" | Out-Null",
        "  sc.exe start \"$svcExe\" | Out-Null",
        "}",
        "Write-Log ('Git apply finished ' + (Get-Date))",
        "Pop-Location"
      ].join('\r\n');

      try {
        fs.writeFileSync(applyScriptPath, applyScript, 'utf8');
        logs.push({ step: 'git-script-created', status: 0, stdout: `Git apply script: ${applyScriptPath}`, stderr: '' });
        const taskName = `ClinicGitApply_${stamp}`;
        const schedResult = cp.spawnSync('schtasks.exe', [
          '/Create', '/F', '/TN', taskName,
          '/TR', `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${applyScriptPath}"`,
          '/SC', 'ONCE', '/ST', '00:00', '/RU', 'SYSTEM', '/RL', 'HIGHEST'
        ], { encoding: 'utf8', timeout: 15000 });
        if (schedResult.status === 0) {
          const runResult = cp.spawnSync('schtasks.exe', ['/Run', '/TN', taskName], { encoding: 'utf8', timeout: 10000 });
          if (runResult.status !== 0) {
            logs.push({ step: 'git-apply-run-warn', status: 1, stdout: '', stderr: runResult.stderr || runResult.stdout || 'schtasks run failed' });
          } else {
            logs.push({ step: 'git-apply-scheduled', status: 0, stdout: `Git apply scheduled (${taskName}).`, stderr: '' });
          }
          setTimeout(() => {
            try { cp.spawnSync('schtasks.exe', ['/Delete', '/TN', taskName, '/F'], { timeout: 5000 }); } catch (_) {}
          }, 30000);
        } else {
          logs.push({ step: 'git-apply-create-warn', status: 1, stdout: '', stderr: schedResult.stderr || schedResult.stdout || 'schtasks create failed' });
        }
      } catch (e) {
        logs.push({ step: 'git-apply-script-warn', status: 1, stdout: '', stderr: String(e.message || e) });
      }

      restartRequired = true;
    }

  } else {
    // ---- Zip download path (no git repo) ----
    // Download + extract here, then spawn detached bat to stop/copy/restart.
    // This avoids file-lock errors because copy happens after service stops.
    const https = require('https');
    const os = require('os');
    const cp = require('child_process');
    const zipUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/zipball/${GITHUB_BRANCH}`;
    const requestHeaders = {
      'User-Agent': 'ClinicApp-Updater',
      'Accept': 'application/vnd.github+json',
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
    };
    const stamp = Date.now();
    const tmpZip = path.join(os.tmpdir(), `clinic-update-${stamp}.zip`);
    const tmpExtract = path.join(os.tmpdir(), `clinic-update-${stamp}`);

    // Download zip
    logs.push({ step: 'zip-download', status: 0, stdout: `Downloading ${zipUrl}`, stderr: '' });
    try {
      await new Promise((resolve, reject) => {
        const follow = (url, depth) => {
          if (depth > 5) return reject(new Error('Too many redirects'));
          https.get(url, { headers: requestHeaders }, res2 => {
            if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
              res2.resume();
              return follow(res2.headers.location, depth + 1);
            }
            if (res2.statusCode !== 200) {
              res2.resume();
              return reject(new Error(`Download failed with HTTP ${res2.statusCode}. If repo is private, set CLINIC_GITHUB_TOKEN on the server.`));
            }
            const out = fs.createWriteStream(tmpZip);
            res2.pipe(out);
            out.on('finish', () => out.close(resolve));
            out.on('error', reject);
          }).on('error', reject);
        };
        follow(zipUrl, 0);
      });
      logs.push({ step: 'zip-download', status: 0, stdout: `Saved to ${tmpZip}`, stderr: '' });
    } catch (e) {
      return res.status(500).json({ error: `Failed to download update: ${e.message}`, backup, logs });
    }

    // Extract zip
    const extractCmd = runUpdateCommand('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${tmpZip}' -DestinationPath '${tmpExtract}' -Force`
    ], { timeout: 120000 });
    pushLog('zip-extract', extractCmd);
    if (extractCmd.status !== 0) {
      try { fs.unlinkSync(tmpZip); } catch (_) {}
      return res.status(500).json({ error: 'Failed to extract update zip', backup, logs });
    }
    try { fs.unlinkSync(tmpZip); } catch (_) {}

    // Find source dir inside extracted zip
    const extracted = fs.readdirSync(tmpExtract).find(f => fs.statSync(path.join(tmpExtract, f)).isDirectory());
    if (!extracted) {
      return res.status(500).json({ error: 'Extracted zip has no subfolder', backup, logs });
    }
    const extractedRoot = path.join(tmpExtract, extracted);
    const nestedClinic = path.join(extractedRoot, 'clinic');
    const srcDir = fs.existsSync(path.join(extractedRoot, 'public', 'app.js')) ? extractedRoot : nestedClinic;
    if (!fs.existsSync(path.join(srcDir, 'public', 'app.js'))) {
      return res.status(500).json({ error: 'Update package missing public/app.js', backup, logs });
    }

    const appDir = path.resolve(__dirname);
    const SERVICE_NAME = process.env.CLINIC_SERVICE_NAME || 'ClinicManagementSystem';
    const logFile = path.join(appDir, 'update-apply.log');
    const applyScriptPath = path.join(os.tmpdir(), `clinic-apply-${stamp}.ps1`);

    // Copy files right now inside this node process.
    // JS/HTML/CSS/JSON files are NOT file-locked on Windows while node is running,
    // so this works reliably without stopping the service first.
    // We skip .node native binaries (those ARE locked) and data/node_modules.
    logs.push({ step: 'file-copy-start', status: 0, stdout: `Copying files from ${srcDir} to ${appDir}`, stderr: '' });
    const _skipDirs = new Set(['.git', 'node_modules', 'data']);
    const _skipFiles = new Set(['install.bat', 'uninstall.bat', 'upgrade-preserve-data.bat', 'upgrade-explicit-target.bat', 'safe-update.bat']);
    const copyErrors = [];
    function copyDirSync(src, dst) {
      const items = fs.readdirSync(src, { withFileTypes: true });
      for (const item of items) {
        if (_skipDirs.has(item.name)) continue;
        const srcPath = path.join(src, item.name);
        const dstPath = path.join(dst, item.name);
        if (item.isDirectory()) {
          if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
          copyDirSync(srcPath, dstPath);
        } else {
          if (_skipFiles.has(item.name)) continue;
          if (item.name.endsWith('.node')) continue; // skip locked native binaries
          try { fs.copyFileSync(srcPath, dstPath); }
          catch (e) { copyErrors.push(`${item.name}: ${e.message}`); }
        }
      }
    }
    try {
      copyDirSync(srcDir, appDir);
      logs.push({ step: 'file-copy', status: 0, stdout: `Files copied${copyErrors.length ? ' (some errors: ' + copyErrors.slice(0, 5).join('; ') + ')' : ' successfully'}`, stderr: copyErrors.join('; ') });
    } catch (e) {
      return res.status(500).json({ error: `File copy failed: ${e.message}`, backup, logs });
    }
    try { fs.unlinkSync(path.join(os.tmpdir(), `clinic-update-${stamp}.zip`)); } catch (_) {}

    // Files are already updated. Now schedule a simple service restart via schtasks.
    // The restart script only stops + starts the service — no npm install needed
    // (avoids PATH issues when running as SYSTEM).
    const restartScript = [
      "$ErrorActionPreference = 'Continue'",
      `$log = ${JSON.stringify(logFile)}`,
      `$svc = ${JSON.stringify(SERVICE_NAME)}`,
      `$svcExe = ${JSON.stringify(SERVICE_NAME + '.exe')}`,
      `$reg = ${JSON.stringify(path.join(appDir, 'scripts', 'register-service.js'))}`,
      "function Write-Log([string]$m) { Add-Content -Path $log -Value $m }",
      "Write-Log ('Restart started ' + (Get-Date))",
      "Write-Log 'Files already copied. Stopping service...'",
      "sc.exe stop \"$svc\" | Out-Null",
      "sc.exe stop \"$svcExe\" | Out-Null",
      "taskkill /F /IM node.exe *> $null",
      "Start-Sleep -Seconds 4",
      "Write-Log 'Starting service...'",
      "sc.exe start \"$svc\" | Out-Null",
      "sc.exe start \"$svcExe\" | Out-Null",
      "Start-Sleep -Seconds 6",
      "$running = ((sc.exe query \"$svc\" | Out-String) -match 'RUNNING') -or ((sc.exe query \"$svcExe\" | Out-String) -match 'RUNNING')",
      "if (-not $running) {",
      "  Write-Log 'Service not running - trying to re-register...'",
      "  cmd.exe /c \"node \"\"$reg\"\" >> \"\"$log\"\" 2>&1\"",
      "  sc.exe start \"$svc\" | Out-Null",
      "  sc.exe start \"$svcExe\" | Out-Null",
      "  Start-Sleep -Seconds 5",
      "  $running = ((sc.exe query \"$svc\" | Out-String) -match 'RUNNING') -or ((sc.exe query \"$svcExe\" | Out-String) -match 'RUNNING')",
      "}",
      "if ($running) { Write-Log 'RESTART COMPLETE - OK' } else { Write-Log 'ERROR: Service not running after restart' }",
      "Write-Log ('Finished ' + (Get-Date))"
    ].join('\r\n');

    try {
      fs.writeFileSync(applyScriptPath, restartScript, 'utf8');
      logs.push({ step: 'script-created', status: 0, stdout: `Restart script: ${applyScriptPath}`, stderr: '' });
    } catch (e) {
      return res.status(500).json({ error: `Failed to create restart script: ${e.message}`, backup, logs });
    }

    // Use schtasks to run restart as SYSTEM — works from session-0 Windows services
    try {
      const taskName = `ClinicUpdate_${stamp}`;
      const schedResult = cp.spawnSync('schtasks.exe', [
        '/Create', '/F', '/TN', taskName,
        '/TR', `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${applyScriptPath}"`,
        '/SC', 'ONCE', '/ST', '00:00', '/RU', 'SYSTEM', '/RL', 'HIGHEST'
      ], { encoding: 'utf8', timeout: 15000 });
      if (schedResult.status !== 0) {
        throw new Error(schedResult.stderr || schedResult.stdout || 'schtasks create failed');
      }
      const runResult = cp.spawnSync('schtasks.exe', ['/Run', '/TN', taskName], { encoding: 'utf8', timeout: 10000 });
      if (runResult.status !== 0) {
        throw new Error(runResult.stderr || runResult.stdout || 'schtasks run failed');
      }
      setTimeout(() => {
        try { cp.spawnSync('schtasks.exe', ['/Delete', '/TN', taskName, '/F'], { timeout: 5000 }); } catch (_) {}
      }, 30000);
      logs.push({ step: 'restart-scheduled', status: 0, stdout: `Service restart scheduled (${taskName}). Files already updated.`, stderr: '' });
    } catch (e) {
      // Files are copied — service just needs a manual restart
      logs.push({ step: 'restart-warn', status: 1, stdout: '', stderr: `Could not schedule restart: ${e.message}. Files are updated — restart the service manually.` });
    }

    afterCommit = 'zip-' + GITHUB_BRANCH;
    updated = true;
    restartRequired = true;
  }

  logActivity(db, req, {
    module: 'setup',
    action: 'system_updated',
    entity_type: 'system',
    entity_id: 1,
    notes: `System update initiated from ${beforeCommit || 'unknown'} to ${afterCommit || 'unknown'}`,
    meta: {
      remote,
      branch,
      before_commit: beforeCommit,
      after_commit: afterCommit,
      backup_id: backup && backup.backup_id ? backup.backup_id : null,
      restart_required: restartRequired
    }
  });
  writeDB(db);

  res.json({
    ok: true,
    message: useGit
      ? (updated
        ? 'Update pulled and apply task started. Wait ~20 seconds, then refresh the page.'
        : 'Already up to date. No code changes were pulled.')
      : 'Update in progress. Service will restart in ~15 seconds. Wait 20 seconds then refresh the page.',
    remote,
    branch,
    before_commit: beforeCommit,
    after_commit: afterCommit,
    updated,
    backup,
    restart_required: restartRequired,
    logs
  });
});

app.get('/api/system-reset/status', requireLogin, (req, res) => {
  const db = readDB();
  const state = getSystemResetState(db);
  res.json({
    in_progress: !!state.in_progress,
    active_job_id: state.active_job_id || null,
    phase: state.phase || null,
    progress: parseInt(state.progress || 0, 10) || 0,
    message: state.message || null,
    updated_at: state.updated_at || null
  });
});

app.post('/api/system-reset/precheck', requireRole('admin'), (req, res) => {
  const db = readDB();
  const me = getSessionUserRecord(db, req);
  if (!me || !isSuperAdminUser(db, me.id)) {
    return res.status(403).json({ error: 'Only Super Admin can access System Reset' });
  }
  const includeAuditLogs = !!(req.body && req.body.includeAuditLogs);
  const summary = buildResetSummary(db, includeAuditLogs);
  const state = getSystemResetState(db);
  res.json({
    ok: true,
    in_progress: !!state.in_progress,
    active_job_id: state.active_job_id || null,
    summary,
    warning: 'This will permanently delete all patient and transactional data.'
  });
});

app.post('/api/system-reset/start', requireRole('admin'), async (req, res) => {
  const db = readDB();
  const state = getSystemResetState(db);
  const me = getSessionUserRecord(db, req);
  if (!me || !isSuperAdminUser(db, me.id)) {
    return res.status(403).json({ error: 'Only Super Admin can start System Reset' });
  }
  if (state.in_progress) {
    return res.status(409).json({ error: 'A reset is already in progress', job_id: state.active_job_id || null });
  }

  const body = req.body || {};
  const confirmText = String(body.confirmText || '').trim();
  const password = String(body.password || '');
  const includeAuditLogs = !!body.includeAuditLogs;
  const scope = String(body.scope || 'full_transactional');

  if (confirmText !== 'RESET') {
    return res.status(400).json({ error: 'Confirmation text must be exactly RESET' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required for re-authentication' });
  }
  let passOk = false;
  try {
    passOk = await bcrypt.compare(password, String(me.password || ''));
  } catch (_) {
    passOk = false;
  }
  if (!passOk) {
    return res.status(401).json({ error: 'Password re-authentication failed' });
  }

  const jobId = `reset-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const summaryBefore = buildResetSummary(db, includeAuditLogs);
  const job = {
    job_id: jobId,
    status: 'queued',
    phase: 'queued',
    progress: 1,
    message: 'Reset queued',
    scope,
    include_audit_logs: includeAuditLogs,
    requested_at: now(),
    started_at: now(),
    completed_at: null,
    started_by_user_id: me.id,
    started_by: me.username || me.name || 'admin',
    summary_before: summaryBefore,
    backup: null,
    error: null,
    updated_at: now()
  };

  state.in_progress = true;
  state.active_job_id = jobId;
  state.started_at = now();
  state.started_by = me.username || me.name || 'admin';
  state.phase = 'queued';
  state.message = 'Reset queued';
  state.progress = 1;
  state.updated_at = now();
  state.jobs.push(job);
  if (state.jobs.length > RESET_JOB_KEEP_LIMIT) state.jobs = state.jobs.slice(-RESET_JOB_KEEP_LIMIT);

  pushResetSecurityEvent(db, {
    actor_id: me.id,
    actor_name: me.username || me.name || 'admin',
    action: 'system_reset_started',
    scope,
    include_audit_logs: includeAuditLogs,
    notes: 'System reset job started'
  });

  writeDB(db);

  setImmediate(() => {
    executeSystemResetJob(jobId).catch((e) => {
      const latest = readDB();
      updateResetJob(latest, jobId, {
        status: 'failed',
        phase: 'failed',
        message: `Reset failed: ${e.message}`,
        error: String(e.message || e),
        completed_at: now()
      });
      finalizeResetState(latest, jobId, 'failed');
      writeDB(latest);
    });
  });

  res.json({ ok: true, job_id: jobId, summary: summaryBefore });
});

app.get('/api/system-reset/jobs/:jobId', requireRole('admin'), (req, res) => {
  const db = readDB();
  const me = getSessionUserRecord(db, req);
  if (!me || !isSuperAdminUser(db, me.id)) {
    return res.status(403).json({ error: 'Only Super Admin can view reset job status' });
  }
  const state = getSystemResetState(db);
  const jobId = String(req.params.jobId || '').trim();
  const job = (state.jobs || []).find(j => j.job_id === jobId);
  if (!job) return res.status(404).json({ error: 'Reset job not found' });
  res.json(job);
});

app.get('/api/system-restore/status', requireLogin, (req, res) => {
  const db = readDB();
  const state = getSystemRestoreState(db);
  res.json({
    in_progress: !!state.in_progress,
    active_job_id: state.active_job_id || null,
    phase: state.phase || null,
    progress: parseInt(state.progress || 0, 10) || 0,
    message: state.message || null,
    updated_at: state.updated_at || null
  });
});

app.post('/api/system-restore/start', requireRole('admin'), (req, res) => {
  const db = readDB();
  const me = getSessionUserRecord(db, req);
  if (!me || !isSuperAdminUser(db, me.id)) {
    return res.status(403).json({ error: 'Only Super Admin can start database restore' });
  }
  const resetState = getSystemResetState(db);
  const restoreState = getSystemRestoreState(db);
  if (resetState.in_progress || restoreState.in_progress) {
    return res.status(409).json({ error: 'Another maintenance job is already in progress' });
  }

  const backupId = String((req.body && req.body.backup_id) || '').trim();
  if (!backupId) return res.status(400).json({ error: 'backup_id is required' });
  try {
    loadBackupStateById(backupId);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Invalid backup selection' });
  }

  const jobId = `restore-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const job = {
    job_id: jobId,
    backup_id: backupId,
    status: 'queued',
    phase: 'queued',
    progress: 1,
    message: 'Restore queued',
    requested_at: now(),
    started_at: now(),
    completed_at: null,
    started_by_user_id: me.id,
    started_by: me.username || me.name || 'admin',
    updated_at: now(),
    error: null
  };

  restoreState.in_progress = true;
  restoreState.active_job_id = jobId;
  restoreState.started_at = now();
  restoreState.started_by = me.username || me.name || 'admin';
  restoreState.phase = 'queued';
  restoreState.message = 'Restore queued';
  restoreState.progress = 1;
  restoreState.updated_at = now();
  restoreState.jobs.push(job);
  if (restoreState.jobs.length > RESET_JOB_KEEP_LIMIT) restoreState.jobs = restoreState.jobs.slice(-RESET_JOB_KEEP_LIMIT);
  restoreState.security_events.push({
    id: nextId(db, 'system_restore_security_events'),
    at: now(),
    actor_id: me.id,
    actor_name: me.username || me.name || 'admin',
    action: 'system_restore_started',
    backup_id: backupId,
    notes: 'One-click restore started'
  });
  if (restoreState.security_events.length > 200) restoreState.security_events = restoreState.security_events.slice(-200);
  writeDB(db);

  setImmediate(() => {
    executeSystemRestoreJob(jobId).catch((e) => {
      const latest = readDB();
      updateRestoreJob(latest, jobId, {
        status: 'failed',
        phase: 'failed',
        progress: 100,
        message: `Restore failed: ${e.message}`,
        error: String(e.message || e),
        completed_at: now()
      });
      finalizeRestoreState(latest, 'failed');
      writeDB(latest);
    });
  });

  res.json({ ok: true, job_id: jobId, backup_id: backupId });
});

app.get('/api/system-restore/jobs/:jobId', requireRole('admin'), (req, res) => {
  const db = readDB();
  const me = getSessionUserRecord(db, req);
  if (!me || !isSuperAdminUser(db, me.id)) {
    return res.status(403).json({ error: 'Only Super Admin can view restore job status' });
  }
  const state = getSystemRestoreState(db);
  const jobId = String(req.params.jobId || '').trim();
  const job = (state.jobs || []).find(j => j.job_id === jobId);
  if (!job) return res.status(404).json({ error: 'Restore job not found' });
  res.json(job);
});

app.get('/api/system/public-config', (req, res) => {
  const db = readDB();
  const system = getClinicSystemStatus(db);
  res.json({
    clinic_name: system.clinic.clinic_name,
    trade_name: system.clinic.trade_name,
    logo_url: system.clinic.logo_url
  });
});

app.get('/api/system/status', requireLogin, (req, res) => {
  const db = readDB();
  const system = getClinicSystemStatus(db, getTerminalIdFromReq(req));
  res.json(system);
});

app.get('/api/setup/profile', requireRole('admin'), (req, res) => {
  const db = readDB();
  const system = getClinicSystemStatus(db, getTerminalIdFromReq(req));
  res.json(system);
});

app.put('/api/setup/profile', requireRole('admin'), (req, res) => {
  const db = readDB();
  ensureClinicProfile(db);
  const profile = db.clinic_profile;
  const body = req.body || {};
  const sub = profile.subscription || {};

  profile.clinic_name = String(body.clinic_name || profile.clinic_name || 'ClinicMS').trim() || 'ClinicMS';
  profile.trade_name = String(body.trade_name || '').trim();
  profile.address = String(body.address || '').trim();
  profile.phone = String(body.phone || '').trim();
  profile.email = String(body.email || '').trim();
  profile.tax_number = String(body.tax_number || '').trim();
  profile.logo_url = String(body.logo_url || '').trim();
  profile.receipt_header = String(body.receipt_header || '').trim();
  profile.receipt_footer = String(body.receipt_footer || '').trim() || 'Thank you for visiting our clinic. Get well soon!';
  profile.timezone = String(body.timezone || profile.timezone || 'Asia/Kuwait').trim();
  profile.currency = String(body.currency || profile.currency || 'KD').trim() || 'KD';
  profile.max_users = Math.max(1, parseInt(body.max_users || profile.max_users || 25, 10));
  profile.no_show_booking_limit = Math.max(1, parseInt(body.no_show_booking_limit || profile.no_show_booking_limit || 5, 10));
  const requestedBillingStoreId = body.billing_store_id === '' || body.billing_store_id === null || body.billing_store_id === undefined
    ? null
    : parseInt(body.billing_store_id, 10);
  if (requestedBillingStoreId) {
    const billingStore = (db.store_sub_stores || []).find(s => parseInt(s.id, 10) === requestedBillingStoreId && s.active !== false);
    if (!billingStore) return res.status(400).json({ error:'Selected billing store not found or inactive' });
    profile.billing_store_id = requestedBillingStoreId;
  } else {
    profile.billing_store_id = null;
  }

  sub.plan = ['trial', 'monthly', 'yearly', 'custom'].includes(String(body.plan || sub.plan || 'trial'))
    ? String(body.plan || sub.plan || 'trial') : 'trial';
  sub.status = ['trial', 'active', 'grace', 'expired', 'suspended'].includes(String(body.status || sub.status || 'trial'))
    ? String(body.status || sub.status || 'trial') : 'trial';
  sub.trial_start = String(body.trial_start || sub.trial_start || today()).slice(0, 10);
  sub.trial_end = String(body.trial_end || sub.trial_end || dateAddDays(today(), 14)).slice(0, 10);
  sub.subscription_start = String(body.subscription_start || sub.subscription_start || '').slice(0, 10);
  sub.subscription_end = String(body.subscription_end || sub.subscription_end || '').slice(0, 10);
  sub.grace_days = Math.max(0, parseInt(body.grace_days || sub.grace_days || 3, 10));
  sub.notes = String(body.notes || sub.notes || '').trim();
  sub.last_verified_at = now();
  profile.subscription = sub;
  profile.updated_at = now();
  if (body.setup_completed === true || body.setup_completed === 'true') profile.setup_completed = true;

  writeDB(db);
  res.json(getClinicSystemStatus(db, getTerminalIdFromReq(req)));
});

app.post('/api/setup/complete', requireRole('admin'), (req, res) => {
  const db = readDB();
  ensureClinicProfile(db);
  db.clinic_profile.setup_completed = true;
  db.clinic_profile.updated_at = now();
  if (!db.clinic_profile.clinic_name) db.clinic_profile.clinic_name = 'ClinicMS';
  writeDB(db);
  res.json(getClinicSystemStatus(db, getTerminalIdFromReq(req)));
});

// ===================== PRINTER MANAGEMENT =====================
const { execSync, spawnSync } = require('child_process');
const os = require('os');
const net = require('net');
const { PNG } = require('pngjs');

function printTextToWindowsPrinter(printerName, text) {
  const safePrinter = String(printerName || '').replace(/'/g, "''");
  const safeText = String(text || '').replace(/'/g, "''");

  // Primary path: Out-Printer
  const psOutPrinter = `$printer='${safePrinter}'; $content='${safeText}'; $content | Out-Printer -Name $printer`;
  const outResult = spawnSync('powershell.exe', ['-NoProfile', '-Command', psOutPrinter], { encoding: 'utf-8' });
  if (outResult.status === 0) return null;

  // Fallback path: Notepad print-to specific printer
  const psNotepadFallback = [
    `$printer='${safePrinter}'`,
    `$content='${safeText}'`,
    '$tmp = [System.IO.Path]::Combine($env:TEMP, "clinic-print-" + [Guid]::NewGuid().ToString() + ".txt")',
    'Set-Content -Path $tmp -Value $content -Encoding UTF8',
    'Start-Process -FilePath notepad.exe -ArgumentList "/p","/pt",$tmp,$printer -Wait',
    'Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue'
  ].join('; ');
  const fallbackResult = spawnSync('powershell.exe', ['-NoProfile', '-Command', psNotepadFallback], { encoding: 'utf-8' });
  if (fallbackResult.status === 0) return null;

  return (fallbackResult.stderr || outResult.stderr || fallbackResult.stdout || outResult.stdout || 'Unknown print error').trim();
}

function printEscPosOverTcp(ip, port, text) {
  return new Promise((resolve, reject) => {
    const host = String(ip || '').trim();
    const prt = Math.max(1, Math.min(65535, parseInt(port || 9100, 10) || 9100));
    if (!host) {
      reject(new Error('Printer IP is required for network thermal printing'));
      return;
    }

    const socket = new net.Socket();
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_) {}
      if (err) reject(err); else resolve();
    };


    socket.setTimeout(7000);
    socket.once('error', (err) => finish(err));
    socket.once('timeout', () => finish(new Error('Thermal printer connection timed out')));

    socket.connect(prt, host, () => {
      try {
        const body = String(text || '').replace(/\r?\n/g, '\n');
        const escpos = Buffer.concat([
          Buffer.from([0x1b, 0x40]), // initialize
          Buffer.from([0x1b, 0x74, 0x10]), // select code page
          Buffer.from(body + '\n\n', 'ascii'),
          Buffer.from([0x1d, 0x56, 0x42, 0x00]) // full cut
        ]);
        socket.write(escpos, (err) => {
          if (err) return finish(err);
          socket.end();
        });
      } catch (e) {
        finish(e);
      }
    });

    socket.once('close', () => finish(null));
  });
}

function resizeRgbaNearest(srcRgba, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return srcRgba;
  const out = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      out[di] = srcRgba[si];
      out[di + 1] = srcRgba[si + 1];
      out[di + 2] = srcRgba[si + 2];
      out[di + 3] = srcRgba[si + 3];
    }
  }
  return out;
}

function rgbaToEscPosRaster(rgba, width, height) {
  const widthBytes = Math.ceil(width / 8);
  const raster = Buffer.alloc(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let xb = 0; xb < widthBytes; xb++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xb * 8 + bit;
        if (x >= width) continue;
        const i = (y * width + x) * 4;
        const r = rgba[i];
        const g = rgba[i + 1];
        const b = rgba[i + 2];
        const a = rgba[i + 3];
        const gray = (r * 299 + g * 587 + b * 114) / 1000;
        const mixed = (a < 10) ? 255 : ((gray * a + 255 * (255 - a)) / 255);
        if (mixed < 160) byte |= (0x80 >> bit);
      }
      raster[y * widthBytes + xb] = byte;
    }
  }
  return { raster, widthBytes, height };
}

function printPngDataUrlEscPos(ip, port, dataUrl) {
  return new Promise((resolve, reject) => {
    try {
      const m = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/);
      if (!m) return reject(new Error('Invalid PNG image payload'));
      const pngBuffer = Buffer.from(m[1], 'base64');
      const png = PNG.sync.read(pngBuffer);

      const maxWidth = 576; // 80mm thermal at 203dpi
      let dstW = png.width;
      let dstH = png.height;
      if (dstW > maxWidth) {
        dstH = Math.max(1, Math.round((dstH * maxWidth) / dstW));
        dstW = maxWidth;
      }

      const rgba = resizeRgbaNearest(png.data, png.width, png.height, dstW, dstH);
      const { raster, widthBytes, height } = rgbaToEscPosRaster(rgba, dstW, dstH);

      const xL = widthBytes & 0xff;
      const xH = (widthBytes >> 8) & 0xff;
      const yL = height & 0xff;
      const yH = (height >> 8) & 0xff;

      const head = Buffer.from([0x1b, 0x40, 0x1b, 0x61, 0x00]); // init + left align
      const cmd = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
      const tail = Buffer.from([0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00]);
      const payload = Buffer.concat([head, cmd, raster, tail]);

      const socket = new net.Socket();
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        try { socket.destroy(); } catch (_) {}
        if (err) reject(err); else resolve();
      };

      socket.setTimeout(10000);
      socket.once('error', (err) => finish(err));
      socket.once('timeout', () => finish(new Error('Thermal printer connection timed out')));
      socket.connect(parseInt(port || 9100, 10) || 9100, String(ip || '').trim(), () => {
        socket.write(payload, (err) => {
          if (err) return finish(err);
          socket.end();
        });
      });
      socket.once('close', () => finish(null));
    } catch (e) {
      reject(e);
    }
  });
}

function padRight(str, width) {
  const s = String(str || '');
  if (s.length >= width) return s.slice(0, width);
  return s + ' '.repeat(width - s.length);
}

function padLeft(str, width) {
  const s = String(str || '');
  if (s.length >= width) return s.slice(-width);
  return ' '.repeat(width - s.length) + s;
}

function centerText(str, width) {
  const s = String(str || '').trim();
  if (!s) return '';
  if (s.length >= width) return s.slice(0, width);
  const left = Math.floor((width - s.length) / 2);
  return ' '.repeat(left) + s;
}

function wrapText(str, width) {
  const text = String(str || '').replace(/\s+/g, ' ').trim();
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if ((cur + ' ' + w).length <= width) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function money3(v) {
  const n = parseFloat(v || 0);
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

function buildThermalReceiptText(bill, clinicProfile, settledBy) {
  const width = 42;
  const sep = '-'.repeat(width);
  const lines = [];

  const clinicName = String(clinicProfile?.clinic_name || 'ClinicMS');
  const header = String(clinicProfile?.receipt_header || clinicProfile?.trade_name || '');
  const footer = String(clinicProfile?.receipt_footer || 'Thank you for visiting our clinic. Get well soon!');

  lines.push(centerText(clinicName, width));
  if (header) wrapText(header, width).forEach(l => lines.push(centerText(l, width)));
  lines.push(sep);
  lines.push(`Bill No : ${String(bill?.bill_number || '—')}`);
  lines.push(`Date    : ${String(bill?.created_at || '').replace('T', ' ').slice(0, 16)}`);
  lines.push(`Patient : ${String(bill?.patient_name || '—')}`);
  lines.push(`MR #    : ${String(bill?.mr_number || '—')}`);
  if (bill?.patient_phone) lines.push(`Phone   : ${String(bill.patient_phone)}`);
  lines.push(sep);
  lines.push('Item                     Qty      Amount');
  lines.push(sep);

  const items = Array.isArray(bill?.line_items) ? bill.line_items : [];
  if (items.length) {
    for (const item of items) {
      const name = String(item?.package_name || item?.name || 'Item');
      const qty = parseFloat(item?.qty || item?.quantity || 1) || 1;
      const amt = parseFloat(item?.amount || 0) || 0;
      const wrapped = wrapText(name, 23);
      wrapped.forEach((line, idx) => {
        if (idx === 0) {
          lines.push(`${padRight(line, 23)} ${padLeft(qty.toFixed(3), 7)} ${padLeft(money3(amt), 10)}`);
        } else {
          lines.push(line);
        }
      });
    }
  } else {
    const fallback = [
      ['Consultation Fee', bill?.consultation_fee],
      ['Medicine Charges', bill?.medicine_charge],
      ['Other Charges', bill?.other_charges]
    ];
    for (const [label, amount] of fallback) {
      if (parseFloat(amount || 0) > 0) {
        lines.push(`${padRight(label, 23)} ${padLeft('1.000', 7)} ${padLeft(money3(amount), 10)}`);
      }
    }
  }

  lines.push(sep);
  lines.push(`${padRight('TOTAL (KD)', 30)}${padLeft(money3(bill?.total || 0), 12)}`);
  lines.push(sep);
  lines.push(`Payment : ${String(bill?.payment_method || '—')}`);
  lines.push(`Status  : ${String(bill?.payment_status || '—')}`);
  if (settledBy) lines.push(`Settled : ${String(settledBy)}`);
  lines.push('');
  wrapText(footer, width).forEach(l => lines.push(centerText(l, width)));
  lines.push('');

  return lines.join('\r\n');
}

const getPrinterList = () => {
  try {
    const platform = os.platform();
    let printers = [];

    if (platform === 'win32') {
      // Windows: Prefer PrintManagement cmdlet
      try {
        const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'], {
          encoding: 'utf-8',
          windowsHide: true,
          shell: false
        });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(result.stderr || 'Get-Printer failed');
        const output = result.stdout || '';
        printers = output.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0)
          .map(name => ({ name, displayName: name }));
      } catch (e) {
        console.log('Get-Printer failed, trying wmic:', e.message);
        try {
          const result = spawnSync('wmic.exe', ['printer', 'get', 'name'], {
            encoding: 'utf-8',
            windowsHide: true,
            shell: false
          });
          if (result.error) throw result.error;
          if (result.status !== 0) throw new Error(result.stderr || 'wmic printer get name failed');
          const output = result.stdout || '';
          const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
          printers = lines.slice(1).map(name => ({ name, displayName: name }));
        } catch (e2) {
          console.log('wmic fallback failed:', e2.message);
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Use lpstat
      try {
        const output = execSync('lpstat -p -d', { encoding: 'utf-8' });
        printers = output.split('\n')
          .filter(l => l.startsWith('printer'))
          .map(l => {
            const match = l.match(/printer\s+(\S+)/);
            return match ? { name: match[1], displayName: match[1] } : null;
          })
          .filter(Boolean);
      } catch (e) {
        console.log('Failed to get macOS printers via lpstat:', e.message);
      }
    } else if (platform === 'linux') {
      // Linux: Use lpstat
      try {
        const output = execSync('lpstat -p -d', { encoding: 'utf-8' });
        printers = output.split('\n')
          .filter(l => l.startsWith('printer'))
          .map(l => {
            const match = l.match(/printer\s+(\S+)/);
            return match ? { name: match[1], displayName: match[1] } : null;
          })
          .filter(Boolean);
      } catch (e) {
        console.log('Failed to get Linux printers via lpstat:', e.message);
      }
    }

    console.log(`Found ${printers.length} printers on ${platform}`);
    return printers;
  } catch (e) {
    console.error('Error getting printer list:', e.message);
    return [];
  }
};

app.get('/api/printers/list', requireRole('admin'), (req, res) => {
  const printers = getPrinterList();
  res.json(printers);
});

app.put('/api/setup/printer', requireRole('admin'), (req, res) => {
  const db = readDB();
  ensureClinicProfile(db);
  const profile = db.clinic_profile;
  const terminalId = getTerminalIdFromReq(req);
  
  const body = req.body || {};
  // Require both type+name only when either one is provided (paired validation).
  // Allow saving print_mode alone without a printer being configured.
  const hasType = !!(body.printer_type || '').trim();
  const hasName = !!(body.printer_name || '').trim();
  if (hasType && !hasName) return res.status(400).json({ error: 'Printer name is required when printer type is set' });
  if (!hasType && hasName) return res.status(400).json({ error: 'Printer type is required when printer name is set' });

  if (hasType && hasName) {
    const cfg = {
      printer_type: String(body.printer_type).trim(),
      printer_name: String(body.printer_name).trim(),
      printer_ip: body.printer_type === 'network' ? String(body.printer_ip || '').trim() : '',
      printer_port: body.printer_type === 'network' ? (parseInt(body.printer_port || 9100, 10) || 9100) : 9100
    };
    profile.printer_type = cfg.printer_type;
    profile.printer_name = cfg.printer_name;
    profile.printer_ip = cfg.printer_ip;
    profile.printer_port = cfg.printer_port;
    if (!profile.printer_terminals || typeof profile.printer_terminals !== 'object') profile.printer_terminals = {};
    if (terminalId) {
      profile.printer_terminals[terminalId] = { ...cfg, updated_at: now() };
    }
  }
  profile.print_mode = ['auto', 'manual'].includes(body.print_mode) ? body.print_mode : (profile.print_mode || 'auto');
  profile.updated_at = now();
  
  writeDB(db);
  res.json(getClinicSystemStatus(db, terminalId));
});

app.post('/api/printers/test', requireRole('admin'), async (req, res) => {
  try {
  const body = req.body || {};
  const printerName = String(body.printer_name || '').trim();
  const printerType = String(body.printer_type || '').trim();
  const printerIp = String(body.printer_ip || '').trim();
  const printerPort = parseInt(body.printer_port || 9100, 10) || 9100;
  
  if (!printerName) {
    return res.status(400).json({ error: 'Printer name is required' });
  }

  const testData = [
    '================================',
    'CLINIC MANAGEMENT SYSTEM',
    `Test Print - ${new Date().toLocaleString()}`,
    '================================',
    '',
    'If you see this on your printer,',
    'the connection is working.',
    '',
    '================================'
  ].join('\r\n');

  const tmModel = /tm-?m30/i.test(printerName);
  if (printerType === 'network' || (tmModel && printerIp)) {
    await printEscPosOverTcp(printerIp, printerPort, testData);
    return res.json({ success: true, message: `Test sent to ${printerName} (${printerIp}:${printerPort})` });
  }

  if (os.platform() !== 'win32') {
    return res.status(400).json({ error: 'USB/direct Windows printing is only available on Windows.' });
  }

  const printErr = printTextToWindowsPrinter(printerName, testData);
  if (printErr) {
    return res.status(500).json({ error: `Failed to print test page: ${printErr}` });
  }

  res.json({ success: true, message: `Test sent to ${printerName}` });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to print test page' });
  }
});

app.post('/api/print/bill', requireRole('user'), async (req, res) => {
  try {
    const body = req.body || {};
    const htmlContent = String(body.html || '');
    const billNumber = String(body.bill_number || 'Receipt');
    const billData = body.bill || null;
    const settledBy = String(body.settled_by || '').trim();
    const imageData = String(body.image_data || '');
    
    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    const db = readDB();
    const profile = db.clinic_profile || {};
    const printerCfg = resolvePrinterConfig(profile, getTerminalIdFromReq(req));
    const printerName = printerCfg.printer_name;
    const printerType = printerCfg.printer_type;
    const printerIp = String(printerCfg.printer_ip || '').trim();
    const printerPort = parseInt(printerCfg.printer_port || 9100, 10) || 9100;

    if (!printerName || !printerType) {
      return res.status(400).json({ error: 'Printer not configured' });
    }

    const plainText = String(htmlContent || '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\r?\n\s*\r?\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    const payloadText = billData
      ? buildThermalReceiptText(billData, profile, settledBy)
      : [
          `Bill: ${billNumber}`,
          `Printed: ${new Date().toLocaleString()}`,
          '',
          plainText
        ].join('\r\n');

    const tmModel = /tm-?m30/i.test(String(printerName || ''));
    if (printerType === 'network' || (tmModel && printerIp)) {
      if (imageData) {
        await printPngDataUrlEscPos(printerIp, printerPort, imageData);
        return res.json({ success: true, message: `Bill ${billNumber} image sent to ${printerName} (${printerIp}:${printerPort})` });
      }
      await printEscPosOverTcp(printerIp, printerPort, payloadText);
      return res.json({ success: true, message: `Bill ${billNumber} sent to ${printerName} (${printerIp}:${printerPort})` });
    }

    if (os.platform() !== 'win32') {
      return res.status(400).json({ error: 'USB/direct Windows printing is only available on Windows.' });
    }

    const printErr = printTextToWindowsPrinter(printerName, payloadText);
    if (printErr) {
      return res.status(500).json({ error: `Failed to print bill: ${printErr}` });
    }

    res.json({ success: true, message: `Bill ${billNumber} sent to ${printerName}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== ROLE PERMISSIONS =====================
// ===================== ROLES MASTER =====================
app.get('/api/roles', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.custom_roles) db.custom_roles = [];
  const builtIn = [
    { id: 'admin', name: 'admin', label: 'Admin', built_in: true },
    { id: 'doctor', name: 'doctor', label: 'Doctor', built_in: true },
    { id: 'receptionist', name: 'receptionist', label: 'Receptionist', built_in: true }
  ];
  const custom = (db.custom_roles || []).map(r => ({ ...r, built_in: false }));
  res.json([...builtIn, ...custom]);
});
app.post('/api/roles', requireRole('admin'), (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error:'Role label is required' });
  const db = readDB();
  if (!db.custom_roles) db.custom_roles = [];
  // Generate safe name from label
  const name = label.trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');
  if (!name) return res.status(400).json({ error:'Invalid role name derived from label' });
  const reserved = ['admin','doctor','receptionist'];
  if (reserved.includes(name)) return res.status(400).json({ error:'Cannot create a role with a reserved name' });
  if (db.custom_roles.find(r => r.name === name)) return res.status(400).json({ error:'A role with this name already exists' });
  if (!db._seq.custom_roles) db._seq.custom_roles = 0;
  db._seq.custom_roles += 1;
  const role = { id: db._seq.custom_roles, name, label: label.trim(), created_at: now() };
  db.custom_roles.push(role);
  // Initialize empty permissions for this role
  if (!db.role_permissions) db.role_permissions = {};
  if (!db.role_permissions[name]) db.role_permissions[name] = [];
  writeDB(db);
  res.json(role);
});
app.put('/api/roles/:id', requireRole('admin'), (req, res) => {
  const { label } = req.body;
  const db = readDB();
  if (!db.custom_roles) db.custom_roles = [];
  const idx = db.custom_roles.findIndex(r => r.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Role not found' });
  if (!label || !label.trim()) return res.status(400).json({ error:'Label required' });
  db.custom_roles[idx].label = label.trim();
  writeDB(db);
  res.json(db.custom_roles[idx]);
});
app.delete('/api/roles/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.custom_roles) db.custom_roles = [];
  const idx = db.custom_roles.findIndex(r => r.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Role not found' });
  const role = db.custom_roles[idx];
  const inUse = (db.users || []).some(u => u.role === role.name);
  if (inUse) return res.status(400).json({ error:'Cannot delete role: it is assigned to one or more users' });
  db.custom_roles.splice(idx, 1);
  // Remove its permissions too
  if (db.role_permissions && db.role_permissions[role.name]) delete db.role_permissions[role.name];
  writeDB(db);
  res.json({ success:true });
});

app.get('/api/role-permissions', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.role_permissions) db.role_permissions = {};
  if (!db.custom_roles) db.custom_roles = [];
  res.json({
    permissions: db.role_permissions,
    all_permissions: ALL_PERMISSIONS,
    defaults: DEFAULT_PERMISSIONS,
    custom_roles: db.custom_roles
  });
});
app.put('/api/role-permissions', requireRole('admin'), (req, res) => {
  const { role, permissions } = req.body;
  if (!role) return res.status(400).json({ error:'Role is required' });
  if (!Array.isArray(permissions)) return res.status(400).json({ error:'permissions must be an array' });
  const db = readDB();
  if (!db.custom_roles) db.custom_roles = [];
  const builtInRoles = ['admin','doctor','receptionist'];
  const customRoleNames = (db.custom_roles || []).map(r => r.name);
  const allValidRoles = [...builtInRoles, ...customRoleNames];
  if (!allValidRoles.includes(role)) return res.status(400).json({ error:'Invalid role' });
  const valid = permissions.filter(p => ALL_PERMISSIONS.includes(p));
  if (!db.role_permissions) db.role_permissions = {};
  if (role === 'admin') db.role_permissions.admin = ALL_PERMISSIONS;
  else db.role_permissions[role] = valid;
  writeDB(db);
  res.json({ success:true, role, permissions: db.role_permissions[role] });
});

// ===================== USERS =====================
app.get('/api/users', requireRole('admin'), (req, res) => {
  const db = readDB();
  ensureStore(db);
  const deptById = new Map((db.doctor_departments || []).map(d => [d.id, d]));
  const storesById = new Map((db.store_sub_stores || []).map((store) => [parseInt(store.id, 10), store]));
  res.json(db.users.map(({ password, ...u }) => {
    const departmentIds = Array.isArray(u.department_ids) && u.department_ids.length
      ? u.department_ids.map((id) => parseInt(id, 10)).filter((id) => id > 0)
      : (u.department_id ? [parseInt(u.department_id, 10)] : []);
    const departmentNames = departmentIds
      .map((id) => deptById.get(id)?.name || '')
      .filter(Boolean);
    const storeIds = normalizeUserStoreIds(u);
    return {
      ...u,
      department_ids: departmentIds,
      department_names: departmentNames,
      store_ids: storeIds,
      store_names: storeIds.map((id) => storesById.get(id)?.name || `Store #${id}`),
      department_name: departmentNames[0] || ''
    };
  }));
});
app.post('/api/users', requireRole('admin'), (req, res) => {
  const { name, username, password, role, slot_duration, department_id, active } = req.body;
  const submittedStores = getSubmittedStoreIds(req.body || {});
  const rawDeptIdsPost = req.body.department_ids;
  if (!name||!username||!password||!role) return res.status(400).json({ error:'All fields required' });
  const db = readDB();
  ensureStore(db);
  const builtInRoles = ['admin','doctor','receptionist'];
  const customRoleNames = (db.custom_roles || []).map(r => r.name);
  const allValidRoles = [...builtInRoles, ...customRoleNames];
  if (!allValidRoles.includes(role)) return res.status(400).json({ error:'Invalid role' });
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error:'Username exists' });
  const id = nextId(db,'users');
  const user = { id, name, username, password:bcrypt.hashSync(password,10), role, active: active !== false && active !== 'false' };
  if (role !== 'admin') user.store_ids = parseSubmittedStoreIds(db, submittedStores.value);
  // Multi-department support on create
  if (role !== 'admin') {
    const deptIds = (Array.isArray(rawDeptIdsPost) ? rawDeptIdsPost : (rawDeptIdsPost ? [rawDeptIdsPost] : []))
      .map(x => parseInt(x)).filter(x => x > 0 && (db.doctor_departments||[]).some(d => d.id === x && d.active !== false));
    user.department_ids = deptIds;
    user.department_id = deptIds.length ? deptIds[0] : (department_id ? parseInt(department_id) : null);
  }
  if (role === 'doctor') {
    user.slot_duration = parseInt(slot_duration) || 30;
  }
  db.users.push(user);
  writeDB(db); const { password:_, ...safe } = user; res.json(safe);
});
app.put('/api/users/:id', requireRole('admin'), (req, res) => {
  const db = readDB(); const idx = db.users.findIndex(u => u.id === parseInt(req.params.id));
  ensureStore(db);
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name, slot_duration, department_id, active } = req.body;
  const submittedStores = getSubmittedStoreIds(req.body || {});
  if (name) db.users[idx].name = name;
  if (db.users[idx].role === 'doctor' && slot_duration) db.users[idx].slot_duration = parseInt(slot_duration) || 30;
  if (active !== undefined) {
    const isSelf = req.session.user && req.session.user.id === db.users[idx].id;
    if (isSelf && (active === false || active === 'false')) {
      return res.status(400).json({ error:'You cannot deactivate your own account' });
    }
    db.users[idx].active = !(active === false || active === 'false');
  }
  // Multi-department support: accept department_ids array from body
  const rawDeptIds = req.body.department_ids;
  if (rawDeptIds !== undefined && db.users[idx].role !== 'admin') {
    const ids = (Array.isArray(rawDeptIds) ? rawDeptIds : [rawDeptIds])
      .map(x => parseInt(x)).filter(x => x > 0);
    const validIds = ids.filter(id => (db.doctor_departments || []).some(d => d.id === id && d.active !== false));
    db.users[idx].department_ids = validIds;
    // keep legacy single field in sync (first selection)
    db.users[idx].department_id = validIds.length ? validIds[0] : null;
  } else if (department_id !== undefined && db.users[idx].role !== 'admin') {
    const depId = parseInt(department_id);
    const dep = (db.doctor_departments || []).find(d => d.id === depId && d.active !== false);
    if (dep) {
      db.users[idx].department_id = depId;
      db.users[idx].department_ids = [depId];
    }
  }
  if (db.users[idx].role !== 'admin' && submittedStores.provided) {
    db.users[idx].store_ids = parseSubmittedStoreIds(db, submittedStores.value);
  }
  writeDB(db); const { password:_, ...safe } = db.users[idx]; res.json(safe);
});
app.delete('/api/users/:id', requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id);
  if (req.session.user.id === id) return res.status(400).json({ error:'Cannot delete own account' });
  const db = readDB();
  db.users = db.users.filter(u => u.id !== id);
  writeDB(db); res.json({ success:true });
});
app.get('/api/doctors', requireLogin, (req, res) => {
  const db = readDB();
  const deptById = new Map((db.doctor_departments || []).map(d => [d.id, d]));
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  let docs = db.users.filter(u => u.role==='doctor' && u.active !== false);
  if (visibleDoctorIds) docs = docs.filter(u => visibleDoctorIds.has(u.id));
  res.json(docs.map(({ password, ...u }) => {
    const dep = deptById.get(parseInt(u.department_id));
    const sch = getDoctorSchedule(db, u.id);
    return { ...u, department_name: dep ? dep.name : '', schedule: sch };
  }));
});

app.get('/api/doctor-schedules', requireLogin, (req, res) => {
  const db = readDB();
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  const queryDid = req.query.doctor_id ? parseInt(req.query.doctor_id) : null;
  let doctors = (db.users || []).filter(u => u.role === 'doctor' && u.active !== false);
  if (visibleDoctorIds) doctors = doctors.filter(u => visibleDoctorIds.has(u.id));
  if (queryDid) {
    if (visibleDoctorIds && !visibleDoctorIds.has(queryDid)) return res.status(403).json({ error:'Forbidden for this department' });
    doctors = doctors.filter(u => u.id === queryDid);
  }
  res.json(doctors.map(d => ({ doctor_id: d.id, doctor_name: d.name, ...getDoctorSchedule(db, d.id) })));
});

app.put('/api/doctor-schedules/:doctorId', requireRole('admin','receptionist'), (req, res) => {
  const db = readDB();
  const doctorId = parseInt(req.params.doctorId);
  const doctor = (db.users || []).find(u => u.id === doctorId && u.role === 'doctor' && u.active !== false);
  if (!doctor) return res.status(404).json({ error:'Doctor not found' });
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (visibleDoctorIds && !visibleDoctorIds.has(doctorId)) return res.status(403).json({ error:'Forbidden for this department' });

  const checked = validateDoctorSchedulePayload(req.body || {});
  if (!checked.ok) return res.status(400).json({ error: checked.error });

  const schedule = saveDoctorSchedule(db, doctorId, checked.value, req.session && req.session.user ? req.session.user.id : null);
  writeDB(db);
  res.json({ doctor_id: doctorId, doctor_name: doctor.name, ...schedule });
});

app.post('/api/doctor-schedules/copy', requireRole('admin','receptionist'), (req, res) => {
  const db = readDB();
  const sourceDoctorId = parseInt(req.body.source_doctor_id);
  const targetDoctorIds = Array.isArray(req.body.target_doctor_ids)
    ? [...new Set(req.body.target_doctor_ids.map(v => parseInt(v)).filter(v => !!v))]
    : [];

  if (!sourceDoctorId) return res.status(400).json({ error:'source_doctor_id is required' });
  if (!targetDoctorIds.length) return res.status(400).json({ error:'Select at least one target doctor' });

  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (visibleDoctorIds && !visibleDoctorIds.has(sourceDoctorId)) {
    return res.status(403).json({ error:'Forbidden for source doctor department' });
  }

  const sourceDoctor = (db.users || []).find(u => u.id === sourceDoctorId && u.role === 'doctor' && u.active !== false);
  if (!sourceDoctor) return res.status(404).json({ error:'Source doctor not found' });

  const sourceSchedule = getDoctorSchedule(db, sourceDoctorId);
  const copiedTo = [];
  for (const did of targetDoctorIds) {
    if (did === sourceDoctorId) continue;
    if (visibleDoctorIds && !visibleDoctorIds.has(did)) continue;
    const targetDoctor = (db.users || []).find(u => u.id === did && u.role === 'doctor' && u.active !== false);
    if (!targetDoctor) continue;
    saveDoctorSchedule(db, did, sourceSchedule, req.session && req.session.user ? req.session.user.id : null);
    copiedTo.push({ doctor_id: did, doctor_name: targetDoctor.name });
  }

  if (!copiedTo.length) return res.status(400).json({ error:'No eligible target doctors selected' });
  writeDB(db);
  res.json({ success: true, source_doctor_id: sourceDoctorId, copied_to: copiedTo });
});

// ===================== PATIENTS =====================
app.get('/api/patients', requireLogin, (req, res) => {
  const db = readDB();
  const { search, exclude_blocked, today_only, page, limit } = req.query;
  let list = [...db.patients].reverse();
  if (exclude_blocked === '1') list = list.filter(p => !p.blocked);
  if (today_only === '1') {
    const t = today();
    const todayAppointments = [...(db.appointments || [])]
      .filter(a => a.date === t && a.status !== 'Cancelled')
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    const seenPatientIds = new Set();
    list = todayAppointments
      .map(a => db.patients.find(p => p.id === parseInt(a.patient_id)))
      .filter(Boolean)
      .filter((p) => {
        if (seenPatientIds.has(p.id)) return false;
        seenPatientIds.add(p.id);
        return true;
      });
    if (exclude_blocked === '1') list = list.filter(p => !p.blocked);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => (p.name||'').toLowerCase().includes(q)||(p.phone||'').includes(q)||(p.mr_number||'').toLowerCase().includes(q)||(p.second_name||'').toLowerCase().includes(q)||(p.alt_phone||'').includes(q)||(p.civil_id||'').includes(q));
  }
  // If page/limit params present, return paginated response
  if (page !== undefined || limit !== undefined) {
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const total    = list.length;
    const pages    = Math.ceil(total / pageSize) || 1;
    const data     = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    return res.json({ data, total, page: pageNum, pages, limit: pageSize });
  }
  res.json(list);
});

app.get('/api/patients/lookup', requireLogin, (req, res) => {
  const db = readDB();
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit || '15', 10) || 15));
  const excludeBlocked = req.query.exclude_blocked === '1';
  if (!q || q.length < 2) return res.json([]);

  let list = [...db.patients].reverse();
  if (excludeBlocked) list = list.filter(p => !p.blocked);
  list = list.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.second_name || '').toLowerCase().includes(q) ||
    (p.phone || '').includes(q) ||
    (p.alt_phone || '').includes(q) ||
    (p.mr_number || '').toLowerCase().includes(q) ||
    (p.civil_id || '').includes(q)
  ).slice(0, limit);

  res.json(list.map(p => ({
    id: p.id,
    name: p.name || '',
    second_name: p.second_name || '',
    phone: p.phone || '',
    mr_number: p.mr_number || '',
    civil_id: p.civil_id || '',
    blocked: !!p.blocked
  })));
});

app.get('/api/patients/export', requirePermission('patients.export'), (req, res) => {
  const db = readDB();
  const { search, today_only } = req.query;
  let list = [...db.patients].reverse();
  if (today_only === '1') {
    const t = today();
    const todayAppointments = [...(db.appointments || [])]
      .filter(a => a.date === t && a.status !== 'Cancelled')
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    const seenPatientIds = new Set();
    list = todayAppointments
      .map(a => db.patients.find(p => p.id === parseInt(a.patient_id)))
      .filter(Boolean)
      .filter((p) => {
        if (seenPatientIds.has(p.id)) return false;
        seenPatientIds.add(p.id);
        return true;
      });
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(p => (p.name||'').toLowerCase().includes(q)||(p.phone||'').includes(q)||(p.mr_number||'').toLowerCase().includes(q)||(p.second_name||'').toLowerCase().includes(q)||(p.alt_phone||'').includes(q)||(p.civil_id||'').includes(q));
  }
  const headers = ['mr_number','name','second_name','dob','age','gender','phone','alt_phone','civil_id','address','medical_history','patient_status','blocked','registration_date'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const p of list) {
    lines.push([
      p.mr_number || '', p.name || '', p.second_name || '', p.dob || '', p.age || '', p.gender || '',
      p.phone || '', p.alt_phone || '', p.civil_id || '', p.address || '', p.medical_history || '',
      p.patient_status || 'Good', p.blocked ? '1' : '0', p.registration_date || ''
    ].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="patients_${today()}.csv"`);
  res.send(lines.join('\n'));
});
app.get('/api/patients/import-template', requirePermission('patients.import'), (_req, res) => {
  const headers = ['mr_number','name','second_name','dob','age','gender','phone','alt_phone','civil_id','address','medical_history','patient_status','blocked'];
  const sample = ['MR01001','John Doe','','1990-01-15','36','Male','90000000','','123456789012','Kuwait City','Diabetes','Good','0'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, sample].map(r => r.map(esc).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="patient_import_template.csv"');
  res.send(csv);
});
app.post('/api/patients/import', requirePermission('patients.import'), (req, res) => {
  try {
    const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error:'No rows provided' });

    const db = readDB();
    let created = 0;
    const skipped = [];
    const errors = [];

    const norm = (v) => String(v || '').trim();
    const normGender = (v) => {
      const g = norm(v).toLowerCase();
      if (!g) return '';
      if (g === 'male') return 'Male';
      if (g === 'female') return 'Female';
      if (g === 'other') return 'Other';
      return '';
    };
    const normStatus = (v) => {
      const s = norm(v).toLowerCase();
      if (s === 'vip') return 'VIP';
      if (s === 'not good') return 'Not Good';
      return 'Good';
    };
    const toBlocked = (v) => ['1','true','yes','y'].includes(norm(v).toLowerCase());

    // Build a set of phones/civil_ids/mr_numbers already in db + added this batch
    const usedPhones = new Set(db.patients.map(p => p.phone).filter(Boolean));
    const usedCivils = new Set(db.patients.map(p => p.civil_id).filter(Boolean));
    const usedMRs   = new Set(db.patients.map(p => String(p.mr_number || '').toLowerCase()).filter(Boolean));

    rows.forEach((row, idx) => {
      const line = idx + 2;
      const mrInput = norm(row.mr_number);
      const name = norm(row.name);
      const civilId = norm(row.civil_id);
      const phone = norm(row.phone);
      const altPhone = norm(row.alt_phone);
      if (!name) {
        errors.push(`Line ${line}: name is required`);
        return;
      }
      if (civilId && !/^\d{12}$/.test(civilId)) {
        errors.push(`Line ${line}: civil_id must be exactly 12 digits`);
        return;
      }
      if (phone && usedPhones.has(phone)) {
        skipped.push(`Line ${line}: phone already exists`);
        return;
      }
      if (civilId && usedCivils.has(civilId)) {
        skipped.push(`Line ${line}: civil_id already exists`);
        return;
      }
      if (mrInput && usedMRs.has(mrInput.toLowerCase())) {
        skipped.push(`Line ${line}: mr_number already exists`);
        return;
      }

      const id = nextId(db,'patients');
      let mr_number = mrInput;
      if (!mr_number) {
        const mrSeq = (db._seq.mr || 5) + 1;
        db._seq.mr = mrSeq;
        mr_number = 'MR' + String(mrSeq).padStart(5, '0');
      } else {
        const m = /^MR(\d+)$/i.exec(mr_number);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > (db._seq.mr || 0)) db._seq.mr = n;
        }
      }
      db.patients.push({
        id,
        mr_number,
        name,
        second_name: norm(row.second_name) || null,
        age: norm(row.age) || null,
        gender: normGender(row.gender) || null,
        phone: phone || null,
        alt_phone: altPhone || null,
        address: norm(row.address) || null,
        medical_history: norm(row.medical_history) || null,
        dob: norm(row.dob) || null,
        civil_id: civilId || null,
        patient_status: normStatus(row.patient_status),
        blocked: toBlocked(row.blocked),
        registration_date: today(),
        created_at: now()
      });
      // Track newly added values in this batch too
      if (phone) usedPhones.add(phone);
      if (civilId) usedCivils.add(civilId);
      usedMRs.add(mr_number.toLowerCase());
      created += 1;
    });

    if (created > 0) writeDB(db);
    res.json({ success:true, created, skipped, errors });
  } catch (err) {
    console.error('Patient import error:', err);
    res.status(500).json({ error: err.message || 'Import failed on server' });
  }
});
app.get('/api/patients/check-duplicate', requireLogin, (req, res) => {
  const { phone, alt_phone, civil_id, exclude_id } = req.query;
  const db = readDB();
  const excId = exclude_id ? parseInt(exclude_id) : null;
  const result = {};
  if (phone) result.phone = db.patients.some(p => p.id !== excId && p.phone && p.phone === phone);
  if (alt_phone) result.alt_phone = db.patients.some(p => p.id !== excId && (p.phone === alt_phone || p.alt_phone === alt_phone));
  if (civil_id) result.civil_id = db.patients.some(p => p.id !== excId && p.civil_id && p.civil_id === civil_id);
  res.json(result);
});
app.get('/api/patients/:id', requireLogin, (req, res) => {
  const db = readDB();
  const p = db.patients.find(p => p.id===parseInt(req.params.id));
  if (!p) return res.status(404).json({ error:'Not found' });
  res.json(p);
});
app.get('/api/patients/:id/emr', requireLogin, (req, res) => {
  const db = readDB();
  const patientId = parseInt(req.params.id, 10);
  const patient = (db.patients || []).find(p => p.id === patientId);
  if (!patientId || !patient) return res.status(404).json({ error:'Patient not found' });

  const doctorsById = new Map((db.users || []).map(u => [parseInt(u.id, 10), u]));
  const departmentsById = new Map((db.doctor_departments || []).map(d => [parseInt(d.id, 10), d]));

  const normalizeDateKey = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  };

  const splitList = (value) => String(value || '')
    .replace(/\r/g, '\n')
    .split(/\n|,|;/)
    .map(v => String(v || '').trim())
    .filter(Boolean);

  const buildMedicineRows = (medicines, dosage) => {
    const medRows = splitList(medicines);
    const dosageRows = splitList(dosage);
    const count = Math.max(medRows.length, dosageRows.length);
    if (!count) {
      if (!String(medicines || '').trim() && !String(dosage || '').trim()) return [];
      return [{
        name: String(medicines || '').trim() || 'Medicine',
        dosage: String(dosage || '').trim(),
        instructions: String(dosage || '').trim(),
      }];
    }
    return Array.from({ length: count }, (_, index) => ({
      name: medRows[index] || (index === 0 ? String(medicines || '').trim() : ''),
      dosage: dosageRows[index] || '',
      instructions: dosageRows[index] || '',
    })).filter(row => row.name || row.dosage || row.instructions);
  };

  const isLabLike = (label, category = '') => /lab|test|scan|x\s*-?ray|xray|mri|ct|ultra\s*sound|report/i.test(`${label} ${category}`);
  const uniqByKey = (rows, keyFn) => {
    const seen = new Set();
    return rows.filter(row => {
      const key = keyFn(row);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const pushUniqueText = (list, value) => {
    const text = String(value || '').trim();
    if (text && !list.includes(text)) list.push(text);
  };
  const pushUniqueObject = (list, row, keyFn) => {
    const key = keyFn(row);
    if (!key) return;
    if (list.some(item => keyFn(item) === key)) return;
    list.push(row);
  };

  const allPatientAppointments = (db.appointments || [])
    .filter(a => parseInt(a.patient_id, 10) === patientId);
  const patientAppointments = allPatientAppointments;
  const appointmentsById = new Map(patientAppointments.map(a => [parseInt(a.id, 10), a]));

  const allPatientBills = (db.bills || [])
    .filter(b => parseInt(b.patient_id, 10) === patientId);
  const patientBills = allPatientBills;
  const billsById = new Map(allPatientBills.map(b => [parseInt(b.id, 10), b]));

  const allPatientPrescriptions = (db.prescriptions || [])
    .filter(rx => parseInt(rx.patient_id, 10) === patientId);
  const patientPrescriptions = allPatientPrescriptions;
  const appointmentsByVisitId = new Map(
    allPatientAppointments
      .filter(a => String(a.visit_id || '').trim())
      .map(a => [String(a.visit_id || '').trim(), a])
  );
  const prescriptionsByVisitId = new Map(
    allPatientPrescriptions
      .filter(rx => String(rx.visit_id || '').trim())
      .map(rx => [String(rx.visit_id || '').trim(), rx])
  );

  const patientPackages = (db.patient_packages || [])
    .filter(pkg => parseInt(pkg.patient_id, 10) === patientId);

  const timelineMap = new Map();
  const ensureEntry = (entryKey, seed = {}) => {
    if (!timelineMap.has(entryKey)) {
      timelineMap.set(entryKey, {
        id: entryKey,
        visit_id: '',
        date: '',
        date_time: '',
        appointment_status: '',
        appointment_time: '',
        doctor_id: null,
        doctor_name: '',
        department_id: null,
        department_name: '',
        doctor_ids: [],
        department_ids: [],
        diagnoses: [],
        notes: [],
        prescriptions: [],
        services: [],
        lab_reports: [],
        attachments: [],
        bill_numbers: [],
        payment_statuses: [],
      });
    }
    const entry = timelineMap.get(entryKey);
    if (seed.visit_id && !entry.visit_id) entry.visit_id = seed.visit_id;
    if (seed.date && (!entry.date || seed.date > entry.date)) entry.date = seed.date;
    if (seed.date_time && (!entry.date_time || seed.date_time > entry.date_time)) entry.date_time = seed.date_time;
    if (seed.appointment_status && !entry.appointment_status) entry.appointment_status = seed.appointment_status;
    if (seed.appointment_time && !entry.appointment_time) entry.appointment_time = seed.appointment_time;
    if (seed.doctor_id && !entry.doctor_id) entry.doctor_id = seed.doctor_id;
    if (seed.doctor_name && !entry.doctor_name) entry.doctor_name = seed.doctor_name;
    if (seed.department_id && !entry.department_id) entry.department_id = seed.department_id;
    if (seed.department_name && !entry.department_name) entry.department_name = seed.department_name;
    return entry;
  };

  for (const appointment of patientAppointments) {
    const resolvedDoctorId = parseInt(appointment.doctor_id, 10) || null;
    const doctor = doctorsById.get(resolvedDoctorId) || {};
    const department = departmentsById.get(parseInt(doctor.department_id || appointment.department_id, 10)) || {};
    const dateKey = normalizeDateKey(appointment.date || appointment.created_at);
    const entry = ensureEntry(`appointment:${appointment.id}`, {
      date: dateKey,
      date_time: appointment.date ? `${appointment.date}T${appointment.time || '00:00'}` : String(appointment.created_at || ''),
      appointment_status: appointment.status || '',
      appointment_time: appointment.time || '',
      doctor_id: parseInt(doctor.id || resolvedDoctorId, 10) || null,
      doctor_name: doctor.name || appointment.doctor_name || (resolvedDoctorId ? `Doctor #${resolvedDoctorId}` : ''),
      department_id: parseInt(department.id || doctor.department_id || appointment.department_id, 10) || null,
      department_name: department.name || appointment.doctor_department_name || doctor.department_name || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    pushUniqueObject(entry.notes, {
      source: 'Appointment',
      text: String(appointment.notes || '').trim(),
    }, note => `${note.source}:${note.text}`);
  }

  for (const bill of patientBills) {
    const linkedAppointment = appointmentsById.get(parseInt(bill.appointment_id, 10));
    const visitId = String(bill.visit_id || '').trim();
    const rxForVisit = visitId ? prescriptionsByVisitId.get(visitId) : null;
    const apptForVisit = visitId ? appointmentsByVisitId.get(visitId) : null;
    const resolvedDoctorId = parseInt(
      bill.doctor_id
      || (linkedAppointment && linkedAppointment.doctor_id)
      || (rxForVisit && rxForVisit.doctor_id)
      || (apptForVisit && apptForVisit.doctor_id),
      10
    ) || null;
    const doctor = doctorsById.get(resolvedDoctorId) || {};
    const department = departmentsById.get(parseInt(doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10)) || {};
    const dateKey = normalizeDateKey((linkedAppointment && linkedAppointment.date) || bill.created_at);
    const entryKey = visitId
      ? `visit:${visitId}`
      : (linkedAppointment ? `appointment:${linkedAppointment.id}` : `bill:${bill.id}`);
    const entry = ensureEntry(entryKey, {
      visit_id: visitId,
      date: dateKey,
      date_time: String(bill.created_at || ''),
      appointment_status: linkedAppointment ? (linkedAppointment.status || '') : '',
      appointment_time: linkedAppointment ? (linkedAppointment.time || '') : '',
      doctor_id: parseInt(doctor.id || resolvedDoctorId, 10) || null,
      doctor_name: doctor.name || (linkedAppointment && linkedAppointment.doctor_name) || (rxForVisit && rxForVisit.doctor_name) || (resolvedDoctorId ? `Doctor #${resolvedDoctorId}` : ''),
      department_id: parseInt(department.id || doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10) || null,
      department_name: department.name || (linkedAppointment && linkedAppointment.doctor_department_name) || doctor.department_name || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    pushUniqueText(entry.bill_numbers, bill.bill_number || `Bill #${bill.id}`);
    pushUniqueText(entry.payment_statuses, bill.payment_status || 'Pending');

    const lineItems = enrichBillLineItems(db, bill.line_items || []);
    for (const item of lineItems) {
      const selectedNames = Array.isArray(item.selected_service_names)
        ? item.selected_service_names.map(name => String(name || '').trim()).filter(Boolean)
        : [];
      const itemNames = selectedNames.length
        ? selectedNames
        : [item.name || item.service_name || item.package_name || item.type || 'Service'].filter(Boolean);
      const amountPerItem = itemNames.length > 1
        ? (parseFloat(item.amount || 0) || 0) / itemNames.length
        : (parseFloat(item.amount || 0) || 0);

      for (const itemName of itemNames) {
        const serviceRow = {
          name: itemName,
          category: item.category || item.type || 'service',
          type: item.type || 'service',
          amount: amountPerItem,
        };
        pushUniqueObject(entry.services, serviceRow, svc => `${svc.name}|${svc.category}|${svc.type}|${svc.amount}`);
        if (isLabLike(itemName, item.category || item.type || '')) {
          pushUniqueObject(entry.lab_reports, {
            name: itemName,
            category: item.category || item.type || 'service',
            source: bill.bill_number || `Bill #${bill.id}`,
          }, rep => `${rep.name}|${rep.category}|${rep.source}`);
        }
      }
    }
  }

  for (const rx of patientPrescriptions) {
    const linkedAppointment = appointmentsById.get(parseInt(rx.appointment_id, 10));
    const resolvedDoctorId = parseInt(rx.doctor_id || (linkedAppointment && linkedAppointment.doctor_id), 10) || null;
    const doctor = doctorsById.get(resolvedDoctorId) || {};
    const department = departmentsById.get(parseInt(doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10)) || {};
    const visitId = String(rx.visit_id || '').trim();
    const dateKey = normalizeDateKey((linkedAppointment && linkedAppointment.date) || rx.created_at);
    const entryKey = visitId
      ? `visit:${visitId}`
      : (linkedAppointment ? `appointment:${linkedAppointment.id}` : `prescription:${rx.id}`);
    const entry = ensureEntry(entryKey, {
      visit_id: visitId,
      date: dateKey,
      date_time: String(rx.created_at || ''),
      appointment_status: linkedAppointment ? (linkedAppointment.status || '') : '',
      appointment_time: linkedAppointment ? (linkedAppointment.time || '') : '',
      doctor_id: parseInt(doctor.id || resolvedDoctorId, 10) || null,
      doctor_name: doctor.name || rx.doctor_name || (linkedAppointment && linkedAppointment.doctor_name) || (resolvedDoctorId ? `Doctor #${resolvedDoctorId}` : ''),
      department_id: parseInt(department.id || doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10) || null,
      department_name: department.name || (linkedAppointment && linkedAppointment.doctor_department_name) || doctor.department_name || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    pushUniqueText(entry.diagnoses, rx.diagnosis || '');
    pushUniqueObject(entry.notes, {
      source: 'Prescription Note',
      text: String(rx.notes || '').trim(),
    }, note => `${note.source}:${note.text}`);
    pushUniqueObject(entry.prescriptions, {
      id: parseInt(rx.id, 10),
      created_at: rx.created_at || '',
      diagnosis: rx.diagnosis || '',
      medicines: rx.medicines || '',
      dosage: rx.dosage || '',
      notes: rx.notes || '',
      medicine_rows: buildMedicineRows(rx.medicines, rx.dosage),
    }, row => String(row.id));
  }

  const packageRows = patientPackages.flatMap(pkg => Array.isArray(pkg.session_log) ? pkg.session_log.map(log => ({ pkg, log })) : []);
  for (const row of packageRows) {
    const linkedBill = billsById.get(parseInt(row.log.bill_id, 10));
    const linkedAppointment = linkedBill ? appointmentsById.get(parseInt(linkedBill.appointment_id, 10)) : null;
    const visitId = linkedBill ? String(linkedBill.visit_id || '').trim() : '';
    const rxForVisit = visitId ? prescriptionsByVisitId.get(visitId) : null;
    const apptForVisit = visitId ? appointmentsByVisitId.get(visitId) : null;
    const resolvedDoctorId = parseInt(
      (linkedBill && linkedBill.doctor_id)
      || (linkedAppointment && linkedAppointment.doctor_id)
      || (rxForVisit && rxForVisit.doctor_id)
      || (apptForVisit && apptForVisit.doctor_id),
      10
    ) || null;
    const doctor = doctorsById.get(resolvedDoctorId) || {};
    const department = departmentsById.get(parseInt(doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10)) || {};
    const dateKey = normalizeDateKey(row.log.date);
    const entryKey = visitId
      ? `visit:${visitId}`
      : (linkedAppointment
        ? `appointment:${linkedAppointment.id}`
        : (linkedBill ? `bill:${linkedBill.id}` : `package-log:${row.pkg.id}:${row.log.bill_id || row.log.date}`));
    const entry = ensureEntry(entryKey, {
      visit_id: visitId,
      date: dateKey,
      date_time: row.log.date || row.pkg.purchased_at || '',
      appointment_status: linkedAppointment ? (linkedAppointment.status || '') : '',
      appointment_time: linkedAppointment ? (linkedAppointment.time || '') : '',
      doctor_id: parseInt(doctor.id || resolvedDoctorId, 10) || null,
      doctor_name: doctor.name || (linkedAppointment && linkedAppointment.doctor_name) || (rxForVisit && rxForVisit.doctor_name) || (resolvedDoctorId ? `Doctor #${resolvedDoctorId}` : ''),
      department_id: parseInt(department.id || doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10) || null,
      department_name: department.name || (linkedAppointment && linkedAppointment.doctor_department_name) || doctor.department_name || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    const usedNames = Array.isArray(row.log.service_names) ? row.log.service_names : [];
    for (const serviceName of usedNames) {
      pushUniqueObject(entry.services, {
        name: serviceName,
        category: 'Package Session',
        type: 'package-session',
        amount: 0,
      }, svc => `${svc.name}|${svc.category}|${svc.type}`);
    }
  }

  const allEntries = Array.from(timelineMap.values())
    .map(entry => {
      entry.doctor_ids = uniqByKey(entry.doctor_ids.map(id => ({ id })), row => row.id).map(row => row.id);
      entry.department_ids = uniqByKey(entry.department_ids.map(id => ({ id })), row => row.id).map(row => row.id);
      entry.diagnoses = entry.diagnoses.filter(Boolean);
      entry.notes = entry.notes.filter(note => note && note.text);
      entry.prescriptions.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      entry.services.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      entry.lab_reports.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      entry.bill_numbers.sort();
      entry.payment_statuses.sort();
      entry.attachments = [];
      entry.primary_diagnosis = entry.diagnoses[0] || '';
      entry.has_prescription = entry.prescriptions.length > 0;
      return entry;
    })
    .filter(entry => entry.date || entry.date_time)
    .sort((a, b) => String(b.date_time || b.date || '').localeCompare(String(a.date_time || a.date || '')));

  const filterOptions = {
    doctors: uniqByKey(allEntries
      .filter(entry => entry.doctor_id)
      .map(entry => ({ id: entry.doctor_id, name: entry.doctor_name || `Doctor #${entry.doctor_id}` })), row => String(row.id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    departments: uniqByKey(allEntries
      .filter(entry => entry.department_id)
      .map(entry => ({ id: entry.department_id, name: entry.department_name || `Department #${entry.department_id}` })), row => String(row.id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    services: uniqByKey(allEntries
      .flatMap(entry => entry.services || [])
      .map(service => ({
        value: String(service.name || '').trim().toLowerCase(),
        label: service.name || 'Service',
      }))
      .filter(service => service.value), service => service.value)
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''))),
  };

  const dateFrom = normalizeDateKey(req.query.date_from);
  const dateTo = normalizeDateKey(req.query.date_to);
  const doctorId = parseInt(req.query.doctor_id, 10) || null;
  const departmentId = parseInt(req.query.department_id, 10) || null;
  const serviceKey = String(req.query.service || '').trim().toLowerCase();

  const filteredEntries = allEntries.filter(entry => {
    const hasPrescription = Array.isArray(entry.prescriptions) && entry.prescriptions.length > 0;
    if (!hasPrescription) return false;
    const entryDate = entry.date || normalizeDateKey(entry.date_time);
    if (dateFrom && (!entryDate || entryDate < dateFrom)) return false;
    if (dateTo && (!entryDate || entryDate > dateTo)) return false;
    if (doctorId && !entry.doctor_ids.includes(doctorId) && entry.doctor_id !== doctorId) return false;
    if (departmentId && !entry.department_ids.includes(departmentId) && entry.department_id !== departmentId) return false;
    if (serviceKey) {
      const matchesService = (entry.services || []).some(service => String(service.name || '').trim().toLowerCase() === serviceKey);
      if (!matchesService) return false;
    }
    return true;
  });

  const latestEntry = allEntries.find(entry => entry.prescriptions && entry.prescriptions.length) || null;
  const latestMedicationSource = latestEntry || allEntries.find(entry => entry.prescriptions && entry.prescriptions.length);
  const ongoingMedications = uniqByKey((latestMedicationSource ? latestMedicationSource.prescriptions : [])
    .flatMap(rx => Array.isArray(rx.medicine_rows) ? rx.medicine_rows : [])
    .filter(row => row && row.name)
    .map(row => ({ name: row.name, dosage: row.dosage || row.instructions || '' })), row => `${row.name}|${row.dosage}`)
    .slice(0, 8);
  const chronicConditions = uniqByKey(splitList(patient.medical_history).map(name => ({ name })), row => row.name.toLowerCase());

  res.json({
    patient: {
      id: patient.id,
      mr_number: patient.mr_number || '',
      name: patient.name || '',
      second_name: patient.second_name || '',
      phone: patient.phone || '',
      alt_phone: patient.alt_phone || '',
      civil_id: patient.civil_id || '',
      dob: patient.dob || '',
      age: patient.age || '',
      gender: patient.gender || '',
      address: patient.address || '',
      medical_history: patient.medical_history || '',
      patient_status: patient.patient_status || 'Good',
      registration_date: patient.registration_date || patient.created_at || '',
      blocked: !!patient.blocked,
    },
    summary: {
      latest_visit: latestEntry ? {
        date: latestEntry.date || '',
        doctor_name: latestEntry.doctor_name || '',
        department_name: latestEntry.department_name || '',
        diagnosis: latestEntry.primary_diagnosis || '',
        visit_id: latestEntry.visit_id || '',
      } : null,
      ongoing_medications: ongoingMedications,
      chronic_conditions: chronicConditions,
      counts: {
        visits: allEntries.length,
        prescriptions: patientPrescriptions.length,
        lab_reports: allEntries.reduce((sum, entry) => sum + ((entry.lab_reports || []).length), 0),
      },
    },
    timeline: filteredEntries,
    filters: filterOptions,
    applied_filters: {
      date_from: dateFrom || '',
      date_to: dateTo || '',
      doctor_id: doctorId || '',
      department_id: departmentId || '',
      service: serviceKey || '',
    },
  });
});
app.post('/api/patients', requireRole('admin','receptionist','doctor'), (req, res) => {
  const { mr_number, name, second_name, age, gender, phone, alt_phone, address, medical_history, dob, civil_id, patient_status, blocked } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  if (civil_id && !/^\d{12}$/.test(civil_id)) return res.status(400).json({ error:'Civil ID must be exactly 12 digits' });
  const db = readDB();
  if (phone && db.patients.some(p => p.phone && p.phone === phone)) return res.status(400).json({ error:'Phone number already registered to another patient' });
  if (civil_id && db.patients.some(p => p.civil_id && p.civil_id === civil_id)) return res.status(400).json({ error:'Civil ID already registered to another patient' });
  if (mr_number && db.patients.some(p => String(p.mr_number||'').toLowerCase() === String(mr_number).toLowerCase())) return res.status(400).json({ error:'MR number already exists' });
  const id = nextId(db,'patients');
  let finalMr = String(mr_number || '').trim();
  if (!finalMr) {
    const mrSeq = (db._seq.mr || 5) + 1;
    db._seq.mr = mrSeq;
    finalMr = 'MR' + String(mrSeq).padStart(5, '0');
  } else {
    const m = /^MR(\d+)$/i.exec(finalMr);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > (db._seq.mr || 0)) db._seq.mr = n;
    }
  }
  const p = { id, mr_number: finalMr, name, second_name:second_name||null, age:age||null, gender:gender||null, phone:phone||null, alt_phone:alt_phone||null, address:address||null, medical_history:medical_history||null, dob:dob||null, civil_id:civil_id||null, patient_status:patient_status||'Good', blocked:blocked==='1'||blocked===true||blocked==='true'?true:false, registration_date:today(), created_at:now() };
  db.patients.push(p); writeDB(db); res.json(p);
});
app.put('/api/patients/:id', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB(); const idx = db.patients.findIndex(p=>p.id===parseInt(req.params.id));
  if (idx===-1) return res.status(404).json({ error:'Not found' });
  const pid = db.patients[idx].id;
  const { name,second_name,age,gender,phone,alt_phone,address,medical_history,dob,civil_id,patient_status,blocked } = req.body;
  if (civil_id && !/^\d{12}$/.test(civil_id)) return res.status(400).json({ error:'Civil ID must be exactly 12 digits' });
  if (phone && db.patients.some(p => p.id!==pid && p.phone && p.phone === phone)) return res.status(400).json({ error:'Phone number already registered to another patient' });
  if (civil_id && db.patients.some(p => p.id!==pid && p.civil_id && p.civil_id === civil_id)) return res.status(400).json({ error:'Civil ID already registered to another patient' });
  db.patients[idx] = { ...db.patients[idx],
    name: name || db.patients[idx].name,
    second_name: second_name !== undefined ? (second_name||null) : db.patients[idx].second_name,
    age: age !== undefined ? age : db.patients[idx].age,
    gender: gender !== undefined ? gender : db.patients[idx].gender,
    phone: phone !== undefined ? (phone||null) : db.patients[idx].phone,
    alt_phone: alt_phone !== undefined ? (alt_phone||null) : db.patients[idx].alt_phone,
    address: address !== undefined ? address : db.patients[idx].address,
    medical_history: medical_history !== undefined ? medical_history : db.patients[idx].medical_history,
    dob: dob !== undefined ? (dob||null) : db.patients[idx].dob,
    civil_id: civil_id !== undefined ? (civil_id||null) : db.patients[idx].civil_id,
    patient_status: patient_status || db.patients[idx].patient_status || 'Good',
    blocked: blocked !== undefined ? (blocked==='1'||blocked===true||blocked==='true'?true:false) : db.patients[idx].blocked
  };
  writeDB(db); res.json({ success:true });
});
app.delete('/api/patients/:id', requireRole('admin'), (req, res) => {
  const db = readDB(); db.patients = db.patients.filter(p=>p.id!==parseInt(req.params.id));
  writeDB(db); res.json({ success:true });
});

// ===================== APPOINTMENTS =====================
app.get('/api/appointments', requireLogin, (req, res) => {
  const db = readDB();
  if (autoMarkMissedAppointmentsAsNoShow(db)) writeDB(db);
  const { date, date_from, date_to, status, doctor_id, name, mr_number, civil_id } = req.query;
  const usersById = new Map((db.users || []).map(u => [parseInt(u.id, 10), u]));
  const bookedByByAptId = new Map();
  const paidByByAptId = new Map();
  (db.activity_logs || []).forEach(log => {
    const aptId = parseInt(log.appointment_id || ((log.entity_type === 'appointment') ? log.entity_id : null), 10);
    if (!aptId) return;
    const action = String(log.action || '').toLowerCase();
    const actor = usersById.get(parseInt(log.actor_id, 10)) || null;
    const actorName = (actor ? (actor.name || actor.username || '') : '') || String(log.actor_name || '').trim();
    if (!actorName) return;
    if ((action === 'booked' || action === 'confirmed') && !bookedByByAptId.has(aptId)) {
      bookedByByAptId.set(aptId, actorName);
    }
    if (action === 'payment_received') {
      paidByByAptId.set(aptId, actorName);
    }
  });
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (doctor_id && visibleDoctorIds && !visibleDoctorIds.has(parseInt(doctor_id))) {
    return res.status(403).json({ error:'Forbidden for this department' });
  }
  let list = db.appointments.map(a => {
    const pat = db.patients.find(p=>p.id===a.patient_id)||{};
    const doc = db.users.find(u=>u.id===a.doctor_id)||{};
    const dep = (db.doctor_departments || []).find(d => d.id === parseInt(doc.department_id)) || {};
    return {
      ...a,
      patient_name: pat.name || pat.mr_number || 'Unknown',
      patient_phone:pat.phone,
      doctor_name:doc.name,
      doctor_department_name: dep.name || '',
      mr_number:pat.mr_number,
      civil_id:pat.civil_id||null,
      booked_by_name: bookedByByAptId.get(parseInt(a.id, 10)) || '',
      paid_by_name: paidByByAptId.get(parseInt(a.id, 10)) || ''
    };
  });
  if (visibleDoctorIds) list = list.filter(a => visibleDoctorIds.has(parseInt(a.doctor_id)));
  if (doctor_id) list=list.filter(a=>a.doctor_id===parseInt(doctor_id));
  if (date)      list=list.filter(a=>a.date===date);
  if (date_from) list=list.filter(a=>a.date>=date_from);
  if (date_to)   list=list.filter(a=>a.date<=date_to);
  if (status)    list=list.filter(a=>a.status===status);
  if (name)      list=list.filter(a=>(a.patient_name||'').toLowerCase().includes(name.toLowerCase()));
  if (mr_number) list=list.filter(a=>(a.mr_number||'').toLowerCase().includes(mr_number.toLowerCase()));
  if (civil_id)  list=list.filter(a=>(a.civil_id||'').includes(civil_id));
  list.sort((a,b)=>b.date+b.time < a.date+a.time?-1:1);
  res.json(list);
});
app.get('/api/appointments/:id', requireLogin, (req, res) => {
  const db = readDB();
  if (autoMarkMissedAppointmentsAsNoShow(db)) writeDB(db);
  const a = db.appointments.find(a=>a.id===parseInt(req.params.id));
  if (!a) return res.status(404).json({ error:'Not found' });
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (visibleDoctorIds && !visibleDoctorIds.has(parseInt(a.doctor_id))) return res.status(403).json({ error:'Forbidden for this department' });
  const pat = db.patients.find(p=>p.id===a.patient_id)||{}; const doc = db.users.find(u=>u.id===a.doctor_id)||{};
  const dep = (db.doctor_departments || []).find(d => d.id === parseInt(doc.department_id)) || {};
  const usersById = new Map((db.users || []).map(u => [parseInt(u.id, 10), u]));
  let bookedByName = '';
  let paidByName = '';
  (db.activity_logs || []).forEach(log => {
    const aptId = parseInt(log.appointment_id || ((log.entity_type === 'appointment') ? log.entity_id : null), 10);
    if (aptId !== parseInt(a.id, 10)) return;
    const actor = usersById.get(parseInt(log.actor_id, 10)) || null;
    const actorName = (actor ? (actor.name || actor.username || '') : '') || String(log.actor_name || '').trim();
    if (!actorName) return;
    const action = String(log.action || '').toLowerCase();
    if ((action === 'booked' || action === 'confirmed') && !bookedByName) bookedByName = actorName;
    if (action === 'payment_received') paidByName = actorName;
  });
  res.json({ ...a, patient_name:pat.name, doctor_name:doc.name, doctor_department_name: dep.name || '', booked_by_name: bookedByName, paid_by_name: paidByName });
});
app.post('/api/appointments', requireRole('admin','receptionist','doctor'), (req, res) => {
  const { patient_id, doctor_id, date, time, notes } = req.body;
  if (!patient_id||!doctor_id||!date||!time) return res.status(400).json({ error:'Required fields missing' });
  const db = readDB();
  ensureClinicProfile(db);
  const patientId = parseInt(patient_id, 10);
  const noShowLimit = Math.max(1, parseInt((db.clinic_profile && db.clinic_profile.no_show_booking_limit) || 5, 10));
  const currentNoShowStreak = getPatientConsecutiveNoShowStreak(db, patientId);
  if (currentNoShowStreak >= noShowLimit) {
    return res.status(400).json({
      error: `Booking blocked: patient has ${currentNoShowStreak} consecutive no-shows (limit ${noShowLimit}).`,
      code: 'NO_SHOW_BLOCK',
      no_show_streak: currentNoShowStreak,
      no_show_limit: noShowLimit
    });
  }
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  const did = parseInt(doctor_id);
  if (visibleDoctorIds && !visibleDoctorIds.has(did)) return res.status(403).json({ error:'Cannot book outside your department doctors' });
  const avail = validateDoctorSlotAvailability(db, did, date, time);
  if (!avail.ok) return res.status(400).json({ error: avail.error });
  const id = nextId(db,'appointments');
  const apt = { id, patient_id:patientId, doctor_id:did, date, time, status:'Booked', notes:notes||null, created_at:now() };
  db.appointments.push(apt);
  logActivity(db, req, {
    module: 'appointment',
    action: 'booked',
    entity_type: 'appointment',
    entity_id: id,
    patient_id: apt.patient_id,
    appointment_id: id,
    notes: `Booked appointment on ${date} ${time}`
  });
  writeDB(db); res.json(apt);
});
app.put('/api/appointments/:id', requireLogin, (req, res) => {
  const db = readDB(); const idx = db.appointments.findIndex(a=>a.id===parseInt(req.params.id));
  if (idx===-1) return res.status(404).json({ error:'Not found' });
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (visibleDoctorIds && !visibleDoctorIds.has(parseInt(db.appointments[idx].doctor_id))) {
    return res.status(403).json({ error:'Cannot edit outside your department doctors' });
  }
  // Block edits on Completed appointments (except system-level bill payment cascades which use 'Completed' status only)
  const apt = db.appointments[idx];
  const before = { ...apt };
  const { date,time,doctor_id,status,notes } = req.body;
  if (status === 'Completed') {
    return res.status(403).json({ error:'Completed status is set automatically after bill payment' });
  }
  if (apt.status === 'Completed' && !(Object.keys(req.body).length === 1 && status === 'Completed')) {
    return res.status(403).json({ error:'Cannot edit a completed appointment' });
  }
  if (apt.status === 'Cancelled') {
    return res.status(403).json({ error:'Cannot edit a cancelled appointment' });
  }
  if (doctor_id && visibleDoctorIds && !visibleDoctorIds.has(parseInt(doctor_id))) {
    return res.status(403).json({ error:'Cannot assign appointment to doctor outside your department' });
  }
  if (date || time || doctor_id) {
    const targetDoctorId = doctor_id ? parseInt(doctor_id) : parseInt(apt.doctor_id);
    const targetDate = date || apt.date;
    const targetTime = time || apt.time;
    const avail = validateDoctorSlotAvailability(db, targetDoctorId, targetDate, targetTime, apt.id);
    if (!avail.ok) return res.status(400).json({ error: avail.error });
  }
  if (date)      db.appointments[idx].date=date;
  if (time)      db.appointments[idx].time=time;
  if (doctor_id) db.appointments[idx].doctor_id=parseInt(doctor_id);
  if (status)    db.appointments[idx].status=status;
  if (notes!==undefined) db.appointments[idx].notes=notes;
  const after = db.appointments[idx];
  if (before.status !== after.status) {
    const actionMap = {
      Confirmed: 'confirmed',
      Arrived: 'arrived',
      Completed: 'completed',
      Cancelled: 'cancelled',
      'No-Show': 'no_show',
      Booked: 'booked'
    };
    logActivity(db, req, {
      module: 'appointment',
      action: actionMap[after.status] || 'status_changed',
      entity_type: 'appointment',
      entity_id: after.id,
      patient_id: after.patient_id,
      appointment_id: after.id,
      notes: `Status ${before.status || 'Unknown'} -> ${after.status}`
    });
  } else if (before.date !== after.date || before.time !== after.time || before.doctor_id !== after.doctor_id) {
    logActivity(db, req, {
      module: 'appointment',
      action: 'rescheduled',
      entity_type: 'appointment',
      entity_id: after.id,
      patient_id: after.patient_id,
      appointment_id: after.id,
      notes: `Rescheduled to ${after.date} ${after.time}`
    });
  }
  writeDB(db); res.json({ success:true });
});
app.delete('/api/appointments/:id', requireRole('admin','receptionist'), (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  const target = db.appointments.find(a => a.id === id);
  if (!target) return res.status(404).json({ error:'Not found' });
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (visibleDoctorIds && !visibleDoctorIds.has(parseInt(target.doctor_id))) {
    return res.status(403).json({ error:'Cannot delete outside your department doctors' });
  }
  db.appointments=db.appointments.filter(a=>a.id!==id);
  writeDB(db); res.json({ success:true });
});

// ===================== FOLLOW UPS =====================
app.get('/api/follow-ups', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB();
  if (!db.follow_ups) db.follow_ups = [];
  const { status, date_from, date_to, patient_id, doctor_id, search } = req.query;
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  const patientById = new Map((db.patients || []).map(p => [p.id, p]));
  const doctorById = new Map((db.users || []).filter(u => u.role === 'doctor').map(d => [d.id, d]));

  let changed = false;
  for (const f of (db.follow_ups || [])) {
    if (f.status === 'Pending' && isValidDateStr(f.due_date) && f.due_date < today()) {
      f.status = 'Missed';
      f.updated_at = now();
      changed = true;
    }
  }
  if (changed) writeDB(db);

  let list = (db.follow_ups || []).map(f => {
    const pat = patientById.get(parseInt(f.patient_id)) || {};
    const doc = doctorById.get(parseInt(f.doctor_id)) || {};
    return {
      ...f,
      patient_name: pat.name || '',
      patient_phone: pat.phone || '',
      mr_number: pat.mr_number || '',
      doctor_name: doc.name || ''
    };
  });

  if (req.session.user.role === 'doctor') {
    list = list.filter(f => parseInt(f.doctor_id) === req.session.user.id || !f.doctor_id);
  }
  if (visibleDoctorIds) {
    list = list.filter(f => !f.doctor_id || visibleDoctorIds.has(parseInt(f.doctor_id)));
  }
  if (patient_id) list = list.filter(f => parseInt(f.patient_id) === parseInt(patient_id));
  if (doctor_id) list = list.filter(f => parseInt(f.doctor_id) === parseInt(doctor_id));
  if (date_from) list = list.filter(f => String(f.due_date || '') >= String(date_from));
  if (date_to) list = list.filter(f => String(f.due_date || '') <= String(date_to));
  if (status) {
    const st = normalizeFollowUpStatus(status);
    list = list.filter(f => String(f.status || 'Pending') === st);
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(f => [
      f.patient_name, f.patient_phone, f.mr_number, f.purpose, f.notes, f.doctor_name
    ].map(v => String(v || '').toLowerCase()).some(v => v.includes(q)));
  }

  list.sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')) || String(a.due_time || '').localeCompare(String(b.due_time || '')));
  res.json(list);
});

app.post('/api/follow-ups', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB();
  if (!db.follow_ups) db.follow_ups = [];
  const body = req.body || {};
  const patientId = parseInt(body.patient_id);
  const doctorId = body.doctor_id ? parseInt(body.doctor_id) : null;
  const appointmentId = body.appointment_id ? parseInt(body.appointment_id) : null;
  const dueDate = String(body.due_date || '').slice(0, 10);
  const dueTime = normalizeFollowUpTime(body.due_time);
  const purpose = String(body.purpose || '').trim();
  const notes = String(body.notes || '').trim();

  if (!patientId || !dueDate || !purpose) return res.status(400).json({ error:'patient_id, due_date and purpose are required' });
  if (!isValidDateStr(dueDate)) return res.status(400).json({ error:'Invalid due_date format' });
  const patient = (db.patients || []).find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error:'Patient not found' });

  let finalDoctorId = doctorId;
  if (!finalDoctorId && req.session.user.role === 'doctor') finalDoctorId = req.session.user.id;
  if (finalDoctorId) {
    const doc = (db.users || []).find(u => u.id === finalDoctorId && u.role === 'doctor' && u.active !== false);
    if (!doc) return res.status(400).json({ error:'Invalid doctor_id' });
    const visibleDoctorIds = getVisibleDoctorIds(db, req);
    if (visibleDoctorIds && !visibleDoctorIds.has(finalDoctorId)) return res.status(403).json({ error:'Forbidden for this doctor' });
  }

  if (appointmentId) {
    const apt = (db.appointments || []).find(a => a.id === appointmentId);
    if (!apt) return res.status(404).json({ error:'Appointment not found' });
  }

  const fu = createFollowUpRecord(db, req, {
    patient_id: patientId,
    appointment_id: appointmentId || null,
    doctor_id: finalDoctorId || null,
    due_date: dueDate,
    due_time: dueTime,
    purpose,
    notes,
    status: body.status
  });
  logActivity(db, req, {
    module: 'follow_up',
    action: 'created',
    entity_type: 'follow_up',
    entity_id: fu.id,
    patient_id: patientId,
    appointment_id: appointmentId || null,
    notes: `Follow-up scheduled for ${dueDate}${dueTime ? ' ' + dueTime : ''}`
  });
  writeDB(db);
  res.json(fu);
});

app.put('/api/follow-ups/:id', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB();
  if (!db.follow_ups) db.follow_ups = [];
  const id = parseInt(req.params.id);
  const idx = db.follow_ups.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const cur = db.follow_ups[idx];

  const patientId = req.body.patient_id !== undefined ? parseInt(req.body.patient_id) : cur.patient_id;
  const doctorId = req.body.doctor_id !== undefined
    ? (req.body.doctor_id ? parseInt(req.body.doctor_id) : null)
    : cur.doctor_id;
  const appointmentId = req.body.appointment_id !== undefined
    ? (req.body.appointment_id ? parseInt(req.body.appointment_id) : null)
    : cur.appointment_id;
  const dueDate = req.body.due_date !== undefined ? String(req.body.due_date || '').slice(0, 10) : cur.due_date;
  const dueTime = req.body.due_time !== undefined ? normalizeFollowUpTime(req.body.due_time) : String(cur.due_time || '');
  const purpose = req.body.purpose !== undefined ? String(req.body.purpose || '').trim() : String(cur.purpose || '');
  const notes = req.body.notes !== undefined ? String(req.body.notes || '').trim() : String(cur.notes || '');
  const status = req.body.status !== undefined ? normalizeFollowUpStatus(req.body.status) : String(cur.status || 'Pending');

  if (!patientId || !purpose || !dueDate) return res.status(400).json({ error:'patient_id, due_date and purpose are required' });
  if (!isValidDateStr(dueDate)) return res.status(400).json({ error:'Invalid due_date format' });
  const patient = (db.patients || []).find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error:'Patient not found' });

  if (doctorId) {
    const doc = (db.users || []).find(u => u.id === doctorId && u.role === 'doctor' && u.active !== false);
    if (!doc) return res.status(400).json({ error:'Invalid doctor_id' });
    const visibleDoctorIds = getVisibleDoctorIds(db, req);
    if (visibleDoctorIds && !visibleDoctorIds.has(doctorId)) return res.status(403).json({ error:'Forbidden for this doctor' });
  }
  if (appointmentId) {
    const apt = (db.appointments || []).find(a => a.id === appointmentId);
    if (!apt) return res.status(404).json({ error:'Appointment not found' });
  }

  db.follow_ups[idx] = {
    ...cur,
    patient_id: patientId,
    doctor_id: doctorId || null,
    appointment_id: appointmentId || null,
    due_date: dueDate,
    due_time: dueTime,
    purpose,
    notes,
    status,
    updated_at: now(),
    completed_at: status === 'Completed' ? (cur.completed_at || now()) : null,
    completed_by: status === 'Completed' ? (cur.completed_by || req.session.user.id) : null,
    completion_notes: status === 'Completed' ? String(req.body.completion_notes || cur.completion_notes || '').trim() : ''
  };

  logActivity(db, req, {
    module: 'follow_up',
    action: 'updated',
    entity_type: 'follow_up',
    entity_id: id,
    patient_id: patientId,
    appointment_id: appointmentId || null,
    notes: `Follow-up updated (${status})`
  });
  writeDB(db);
  res.json(db.follow_ups[idx]);
});

app.post('/api/follow-ups/:id/complete', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB();
  if (!db.follow_ups) db.follow_ups = [];
  const id = parseInt(req.params.id);
  const fu = db.follow_ups.find(f => f.id === id);
  if (!fu) return res.status(404).json({ error:'Not found' });
  const completionNotes = String(req.body && req.body.completion_notes || '').trim();
  const nextDueDate = String(req.body && req.body.next_due_date || '').slice(0, 10);
  const nextDueTime = normalizeFollowUpTime(req.body && req.body.next_due_time || '');
  const nextPurpose = String(req.body && req.body.next_purpose || '').trim();
  const nextNotes = String(req.body && req.body.next_notes || '').trim();

  fu.status = 'Completed';
  fu.completed_at = now();
  fu.completed_by = req.session.user.id;
  fu.updated_at = now();
  fu.completion_notes = completionNotes;

  let nextFollowUp = null;
  if (nextDueDate && nextPurpose) {
    if (!isValidDateStr(nextDueDate)) return res.status(400).json({ error:'Invalid next_due_date format' });
    nextFollowUp = createFollowUpRecord(db, req, {
      patient_id: fu.patient_id,
      appointment_id: fu.appointment_id || null,
      doctor_id: fu.doctor_id || null,
      due_date: nextDueDate,
      due_time: nextDueTime,
      purpose: nextPurpose,
      notes: nextNotes,
      status: 'Pending'
    });
  }

  logActivity(db, req, {
    module: 'follow_up',
    action: 'completed',
    entity_type: 'follow_up',
    entity_id: id,
    patient_id: fu.patient_id,
    appointment_id: fu.appointment_id || null,
    notes: nextFollowUp
      ? `Follow-up completed and next follow-up scheduled for ${nextDueDate}${nextDueTime ? ' ' + nextDueTime : ''}`
      : 'Follow-up marked as completed'
  });
  writeDB(db);
  res.json({ ...fu, next_follow_up: nextFollowUp });
});

app.delete('/api/follow-ups/:id', requireRole('admin','receptionist'), (req, res) => {
  const db = readDB();
  if (!db.follow_ups) db.follow_ups = [];
  const id = parseInt(req.params.id);
  const idx = db.follow_ups.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const cur = db.follow_ups[idx];
  db.follow_ups.splice(idx, 1);

  logActivity(db, req, {
    module: 'follow_up',
    action: 'deleted',
    entity_type: 'follow_up',
    entity_id: id,
    patient_id: cur.patient_id,
    appointment_id: cur.appointment_id || null,
    notes: 'Follow-up deleted'
  });
  writeDB(db);
  res.json({ success:true });
});

// ===================== PRESCRIPTIONS =====================
app.get('/api/prescriptions', requireLogin, (req, res) => {
  const db = readDB();
  const { patient_id, appointment_id } = req.query;

  const resolveRxVisitId = (rx) => {
    const direct = String(rx.visit_id || '').trim();
    if (direct) return direct;
    const aptId = parseInt(rx.appointment_id);
    if (aptId) {
      const linkedBill = (db.bills || []).find(b => b.appointment_id === aptId && b.patient_id === rx.patient_id);
      if (linkedBill) return String(linkedBill.visit_id || '').trim();
    }
    const candidates = (db.bills || [])
      .filter(b => b.patient_id === rx.patient_id)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return candidates.length ? String(candidates[0].visit_id || '').trim() : '';
  };

  let list = db.prescriptions.map(rx => {
    const pat=db.patients.find(p=>p.id===rx.patient_id)||{}; const doc=db.users.find(u=>u.id===rx.doctor_id)||{};
    return { ...rx, visit_id: resolveRxVisitId(rx), patient_name:pat.name, mr_number:pat.mr_number || '', doctor_name:doc.name };
  });
  if (req.session.user.role==='doctor') list=list.filter(rx=>rx.doctor_id===req.session.user.id);
  if (patient_id)     list=list.filter(rx=>rx.patient_id===parseInt(patient_id));
  if (appointment_id) list=list.filter(rx=>rx.appointment_id===parseInt(appointment_id));
  list.sort((a,b)=>b.created_at>a.created_at?1:-1);
  res.json(list);
});
app.get('/api/prescriptions/:id', requireLogin, (req, res) => {
  const db=readDB(); const rx=db.prescriptions.find(r=>r.id===parseInt(req.params.id));
  if (!rx) return res.status(404).json({ error:'Not found' });
  const pat=db.patients.find(p=>p.id===rx.patient_id)||{}; const doc=db.users.find(u=>u.id===rx.doctor_id)||{};
  let visit_id = String(rx.visit_id || '').trim();
  if (!visit_id && rx.appointment_id) {
    const linkedBill = (db.bills || []).find(b => b.appointment_id === parseInt(rx.appointment_id) && b.patient_id === rx.patient_id);
    if (linkedBill) visit_id = String(linkedBill.visit_id || '').trim();
  }
  if (!visit_id) {
    const candidates = (db.bills || [])
      .filter(b => b.patient_id === rx.patient_id)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    if (candidates.length) visit_id = String(candidates[0].visit_id || '').trim();
  }
  res.json({ ...rx, visit_id, patient_name:pat.name, mr_number:pat.mr_number || '', doctor_name:doc.name });
});
app.get('/api/patients/:id/available-visits', requireLogin, (req, res) => {
  const db = readDB();
  const patientId = parseInt(req.params.id);
  if (!patientId) return res.status(400).json({ error:'invalid patient id' });
  const includeVisitId = String(req.query.include_visit_id || '').trim();

  const assigned = new Set(
    (db.prescriptions || [])
      .filter(r => r.patient_id === patientId)
      .map(r => String(r.visit_id || '').trim())
      .filter(v => v && v !== includeVisitId)
  );

  const rows = Object.values((db.bills || []).reduce((acc, b) => {
    if (b.patient_id !== patientId) return acc;
    const vid = String(b.visit_id || '').trim();
    if (!vid) return acc;
    if (assigned.has(vid)) return acc;
    const existing = acc[vid];
    if (!existing || String(b.created_at || '') > String(existing.created_at || '')) {
      acc[vid] = { visit_id: vid, created_at: b.created_at || '' };
    }
    return acc;
  }, {}));

  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  res.json(rows);
});
app.post('/api/prescriptions', requireRole('doctor','admin'), (req, res) => {
  const { appointment_id, patient_id, visit_id, diagnosis, medicines, dosage, notes } = req.body;
  if (!patient_id) return res.status(400).json({ error:'patient_id required' });
  if (!String(visit_id || '').trim()) return res.status(400).json({ error:'visit_id required' });
  const db=readDB();
  const pid = parseInt(patient_id);
  const vid = String(visit_id).trim();
  const duplicate = (db.prescriptions || []).some(r => r.patient_id === pid && String(r.visit_id || '').trim() === vid);
  if (duplicate) return res.status(400).json({ error:'visit_id already assigned to another prescription' });

  const appointmentId = appointment_id ? parseInt(appointment_id) : null;
  const explicitDoctorId = parseInt(req.body.doctor_id);
  let doctor_id = null;

  if (req.session.user.role === 'doctor') {
    doctor_id = parseInt(req.session.user.id) || null;
  } else {
    if (explicitDoctorId) doctor_id = explicitDoctorId;

    if (!doctor_id && appointmentId) {
      const linkedAppointment = (db.appointments || []).find(a => parseInt(a.id) === appointmentId);
      if (linkedAppointment && linkedAppointment.doctor_id) doctor_id = parseInt(linkedAppointment.doctor_id) || null;
    }

    if (!doctor_id && vid) {
      const linkedBill = (db.bills || [])
        .filter(b => parseInt(b.patient_id) === pid && String(b.visit_id || '').trim() === vid)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
      if (linkedBill) {
        if (linkedBill.doctor_id) {
          doctor_id = parseInt(linkedBill.doctor_id) || null;
        }
        if (!doctor_id && linkedBill.appointment_id) {
          const linkedAppointment = (db.appointments || []).find(a => parseInt(a.id) === parseInt(linkedBill.appointment_id));
          if (linkedAppointment && linkedAppointment.doctor_id) doctor_id = parseInt(linkedAppointment.doctor_id) || null;
        }
      }
    }
  }

  const doctorUser = (db.users || []).find(u => parseInt(u.id) === parseInt(doctor_id) && String(u.role || '').toLowerCase() === 'doctor' && u.active !== false);
  if (!doctorUser) {
    return res.status(400).json({ error:'Valid doctor is required for prescription' });
  }

  const id=nextId(db,'prescriptions');
  db.prescriptions.push({ id, appointment_id:appointmentId, visit_id:vid, patient_id:pid, doctor_id: parseInt(doctorUser.id), diagnosis:diagnosis||null, medicines:medicines||null, dosage:dosage||null, notes:notes||null, created_at:now() });
  if (appointmentId) { const idx=db.appointments.findIndex(a=>a.id===appointmentId); if (idx!==-1) db.appointments[idx].status='Completed'; }
  writeDB(db); res.json({ id });
});
app.put('/api/prescriptions/:id', requireRole('doctor','admin'), (req, res) => {
  const db=readDB(); const idx=db.prescriptions.findIndex(r=>r.id===parseInt(req.params.id));
  if (idx===-1) return res.status(404).json({ error:'Not found' });
  const { visit_id, diagnosis,medicines,dosage,notes } = req.body;
  if (!String(visit_id || '').trim()) return res.status(400).json({ error:'visit_id required' });
  const vid = String(visit_id).trim();
  const pid = db.prescriptions[idx].patient_id;
  const duplicate = (db.prescriptions || []).some((r, i) => i !== idx && r.patient_id === pid && String(r.visit_id || '').trim() === vid);
  if (duplicate) return res.status(400).json({ error:'visit_id already assigned to another prescription' });
  db.prescriptions[idx]={ ...db.prescriptions[idx], visit_id:vid, diagnosis,medicines,dosage,notes };
  writeDB(db); res.json({ success:true });
});

// ===================== BILLING =====================
app.get('/api/bills', requireLogin, (req, res) => {
  const db=readDB(); const { patient_id,payment_status,date:fd,appointment_id } = req.query;
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  let list=db.bills.map(b=>{ const pat=db.patients.find(p=>p.id===b.patient_id)||{}; const doc=db.users.find(u=>u.id===parseInt(b.doctor_id))||{}; return { ...b, line_items: enrichBillLineItems(db, b.line_items), patient_name:pat.name, patient_phone:pat.phone, mr_number:pat.mr_number||'', doctor_name: doc.name || '' }; });
  if (visibleDoctorIds) list = list.filter(b => {
    const did = parseInt(b.doctor_id, 10);
    return did && visibleDoctorIds.has(did);
  });
  if (patient_id)     list=list.filter(b=>b.patient_id===parseInt(patient_id));
  if (payment_status) list=list.filter(b=>b.payment_status===payment_status);
  if (fd)             list=list.filter(b=>(b.created_at||'').startsWith(fd));
  if (appointment_id) list=list.filter(b=>b.appointment_id===parseInt(appointment_id));
  list.sort((a,b)=>b.created_at>a.created_at?1:-1);
  res.json(list);
});
app.get('/api/bills/:id', requireLogin, (req, res) => {
  const db=readDB(); const b=db.bills.find(b=>b.id===parseInt(req.params.id));
  if (!b) return res.status(404).json({ error:'Not found' });
  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  if (visibleDoctorIds) {
    const did = parseInt(b.doctor_id, 10);
    if (!did || !visibleDoctorIds.has(did)) {
      return res.status(403).json({ error:'Forbidden for this doctor scope' });
    }
  }
  const pat=db.patients.find(p=>p.id===b.patient_id)||{};
  const doc=db.users.find(u=>u.id===parseInt(b.doctor_id,10))||{};
  res.json({ ...b, line_items: enrichBillLineItems(db, b.line_items), patient_name:pat.name, patient_phone:pat.phone, mr_number:pat.mr_number||'', doctor_name: doc.name || '' });
});
app.post('/api/bills', requirePermission('billing.create'), (req, res) => {
  const { patient_id,appointment_id,doctor_id,line_items,consultation_fee,medicine_charge,other_charges,payment_method,payment_status,pkg_sessions,payment_splits,discount_id,discount_type,discount_value,discount_label,discount_amount } = req.body;
  if (!patient_id) return res.status(400).json({ error:'patient_id required' });
  const db=readDB();
  let finalDoctorId = doctor_id ? parseInt(doctor_id) : null;
  if (appointment_id) {
    const apt = (db.appointments || []).find(a => a.id === parseInt(appointment_id));
    if (apt && apt.doctor_id) finalDoctorId = parseInt(apt.doctor_id);
  }
  if (!finalDoctorId) return res.status(400).json({ error:'doctor_id required' });
  const doctorUser = (db.users || []).find(u => u.id === finalDoctorId && String(u.role || '').toLowerCase() === 'doctor' && u.active !== false);
  if (!doctorUser) return res.status(400).json({ error:'Invalid doctor selected' });
  if (!db.patient_packages) db.patient_packages = [];
  let items=[], cf=0, mc=0, oc=0, total=0;
  ensureStore(db);
  if (Array.isArray(line_items) && line_items.length>0) {
    items = line_items.map(i => {
      const item = { ...i };
      if (item.type !== 'package') {
        const validStatuses = ['Pending', 'In Progress', 'Completed'];
        const status = validStatuses.includes(item.service_status) ? item.service_status : 'Completed';
        item.service_status = status;
        item.completion_date = status === 'Completed' ? (item.completion_date || now()) : (item.completion_date || null);
      }
      return item;
    });
    const billingStore = getBillingProductStore(db);
    if (!billingStore) return res.status(400).json({ error:'Billing product store not configured' });

    // Validate stock and normalize amount for product sale lines.
    for (const item of items) {
      if (item.type !== 'product') continue;
      const productId = parseInt(item.ref_id);
      const qty = parseFloat(item.qty || 0);
      if (!productId || !(qty > 0)) return res.status(400).json({ error:'Invalid product line item' });
      const product = (db.store_products || []).find(p => p.id === productId && p.active !== false);
      if (!product) return res.status(400).json({ error:'Product not found or inactive' });
      const stock = getStock(db, productId, billingStore.id);
      const available = parseFloat(stock.qty || 0) || 0;
      if (available < qty) {
        return res.status(400).json({ error:`Insufficient stock for ${product.name} in ${billingStore.name} (available: ${available.toFixed(3)})` });
      }
      const sellPrice = parseFloat(product.sell_price || 0) || 0;
      item.name = item.name || product.name;
      item.qty = parseFloat(qty.toFixed(3));
      item.amount = parseFloat((sellPrice * qty).toFixed(3));
      item.unit = item.unit || product.unit || '';
    }

    total = items.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
  } else {
    cf=parseFloat(consultation_fee)||0; mc=parseFloat(medicine_charge)||0; oc=parseFloat(other_charges)||0; total=cf+mc+oc;
  }
  const id=nextId(db,'bills');
  // Apply discount
  let discAmt = 0; let discLabel = ''; let discType = '';
  if (discount_id) {
    const disc = (db.discounts||[]).find(d => d.id === parseInt(discount_id) && d.active !== false);
    if (disc) {
      discType = String(disc.type || '').toLowerCase();
      if (disc.type === 'percentage') {
        discAmt = parseFloat(((total * (parseFloat(disc.value)||0)) / 100).toFixed(3));
        if (disc.max_limit) discAmt = Math.min(discAmt, parseFloat(disc.max_limit));
        discLabel = `${disc.name} (${disc.value}%)`;
      } else if (disc.type === 'fixed') {
        discAmt = Math.min(parseFloat(disc.value)||0, total);
        discLabel = disc.name;
      } else if (disc.type === 'open') {
        discAmt = Math.min(Math.abs(parseFloat(discount_amount)||0), total);
        discLabel = disc.name + (discAmt ? ` KD ${discAmt.toFixed(3)}` : '');
      }
    }
  } else if (discount_type === 'open' && parseFloat(discount_amount) > 0) {
    discType = 'open';
    discAmt = Math.min(parseFloat(discount_amount)||0, total);
    discLabel = discount_label || 'Manual Discount';
  }
  if (discAmt > 0) total = parseFloat((total - discAmt).toFixed(3));
  const ps = payment_status||'Pending';
  // Generate bill number sequence
  if (!db._seq.bill_number) db._seq.bill_number = 0;
  db._seq.bill_number += 1;
  const bill_number = 'BN' + String(db._seq.bill_number).padStart(5,'0');
  // Generate per-patient visit sequence
  if (!db._seq.patient_visits) db._seq.patient_visits = {};
  const pid = parseInt(patient_id);
  db._seq.patient_visits[pid] = (db._seq.patient_visits[pid] || 0) + 1;
  const visit_id = `V-${String(pid).padStart(3,'0')}-${String(db._seq.patient_visits[pid]).padStart(3,'0')}`;
  const splits = Array.isArray(payment_splits) ? payment_splits : [];
  db.bills.push({ id, bill_number, visit_id, patient_id:pid, appointment_id:appointment_id?parseInt(appointment_id):null, doctor_id:finalDoctorId, line_items:items, consultation_fee:cf, medicine_charge:mc, other_charges:oc, subtotal: parseFloat((total + discAmt).toFixed(3)), discount_id:discount_id?parseInt(discount_id):null, discount_type:discType||null, discount_label:discLabel||null, discount_amount:discAmt||0, total, payment_method:payment_method||'Cash', payment_status:ps, payment_splits:splits, created_by:(req.session && req.session.user && req.session.user.id) || req.session.userId || null, created_at:now() });
  logActivity(db, req, {
    module: 'billing',
    action: 'bill_created',
    entity_type: 'bill',
    entity_id: id,
    bill_id: id,
    patient_id: pid,
    appointment_id: appointment_id ? parseInt(appointment_id) : null,
    visit_id,
    notes: `Bill ${bill_number} created with status ${ps}`,
    meta: { total, payment_method: payment_method || 'Cash', payment_status: ps }
  });
  if (ps === 'Paid') {
    logActivity(db, req, {
      module: 'billing',
      action: 'payment_received',
      entity_type: 'bill',
      entity_id: id,
      bill_id: id,
      patient_id: pid,
      appointment_id: appointment_id ? parseInt(appointment_id) : null,
      visit_id,
      notes: `Payment received for ${bill_number}`,
      meta: { total, payment_method: payment_method || 'Cash' }
    });
  }
  // Auto-complete appointment when paid
  let updatedApt = null;
  if (ps === 'Paid' && appointment_id) {
    const ai = db.appointments.findIndex(a => a.id === parseInt(appointment_id));
    if (ai !== -1 && db.appointments[ai].status !== 'Completed') {
      db.appointments[ai].status = 'Completed';
      updatedApt = db.appointments[ai];
    }
  }
  // Auto-create patient_package subscriptions for package line items
  const pkgLineItems = items.filter(i => i.type === 'package');
  for (const item of pkgLineItems) {
    const pkg = (db.packages||[]).find(p => p.id === parseInt(item.ref_id));
    if (pkg) {
      if (!db._seq.patient_packages) db._seq.patient_packages = 0;
      db._seq.patient_packages += 1;
      const selIds = Array.isArray(item.selected_service_ids) ? item.selected_service_ids.map(Number) : [];
      // Support new `services` format {service_id, total} as well as legacy `service_ids`
      let pkgServices;
      if (Array.isArray(pkg.services) && pkg.services.length) {
        pkgServices = pkg.services.map(it => {
          const sid = parseInt(it.service_id);
          const svc = (db.services||[]).find(s => s.id === sid);
          const totalSessions = parseInt(it.total) || 1;
          return { service_id: sid, service_name: svc ? svc.name : '', total: totalSessions, used: selIds.includes(sid) ? 1 : 0 };
        });
      } else {
        pkgServices = (pkg.service_ids||[]).map(sid => {
          const svc = (db.services||[]).find(s => s.id === sid);
          return { service_id: sid, service_name: svc ? svc.name : '', total: 1, used: selIds.includes(sid) ? 1 : 0 };
        });
      }
      db.patient_packages.push({
        id: db._seq.patient_packages,
        patient_id: parseInt(patient_id),
        package_id: pkg.id,
        package_name: pkg.name,
        bill_id: id,
        services: pkgServices,
        total_price: pkg.discount_price || 0,
        purchased_at: today(),
        status: (pkgServices.length && pkgServices.every(s => s.used >= s.total)) ? 'Completed' : 'Active',
        session_log: selIds.length ? [{ date: today(), bill_id: id, service_ids: selIds,
          service_names: selIds.map(sid => { const s=(db.services||[]).find(sv=>sv.id===sid); return s?s.name:''; }) }] : []
      });
    }
  }
  // Record package session usage
  if (Array.isArray(pkg_sessions) && pkg_sessions.length > 0) {
    for (const usage of pkg_sessions) {
      const pp = db.patient_packages.find(p => p.id === parseInt(usage.patient_package_id));
      if (pp && Array.isArray(usage.service_ids)) {
        const usedNames = [];
        const quantities = usage.service_quantities || {};
        for (const sid of usage.service_ids) {
          const svc = pp.services.find(s => s.service_id === parseInt(sid));
          const qty = parseInt(quantities[sid]) || 1;
          if (svc) {
            const canUse = Math.min(qty, svc.total - svc.used);
            if (canUse > 0) { svc.used += canUse; usedNames.push(svc.service_name + (canUse > 1 ? ` ×${canUse}` : '')); }
          }
        }
        pp.session_log.push({ date: today(), bill_id: id, service_ids: usage.service_ids.map(Number), quantities, service_names: usedNames });
        if (pp.services.every(s => s.used >= s.total)) pp.status = 'Completed';
      }
    }
  }

  // Deduct stock for billed product sales from configured billing store.
  const soldProductItems = items.filter(i => i.type === 'product');
  if (soldProductItems.length) {
    const billingStore = getBillingProductStore(db);
    if (!billingStore) return res.status(400).json({ error:'Billing product store not configured' });
    for (const li of soldProductItems) {
      const productId = parseInt(li.ref_id);
      const qty = parseFloat(li.qty || 0) || 0;
      const stock = getStock(db, productId, billingStore.id);
      stock.qty = parseFloat((parseFloat(stock.qty || 0) - qty).toFixed(3));
    }
  }

  recordServiceProductConsumption(db, req, {
    bill_id: id,
    patient_id: pid,
    appointment_id: appointment_id ? parseInt(appointment_id) : null,
    visit_id,
    line_items: items
  });
  writeDB(db);
  res.json({ id, bill_number, appointment: updatedApt });
});
app.put('/api/bills/:id', requirePermission('billing.edit'), (req, res) => {
  const db=readDB(); const idx=db.bills.findIndex(b=>b.id===parseInt(req.params.id));
  if (idx===-1) return res.status(404).json({ error:'Not found' });
  const hasRefund = (db.refunds || []).some(r => r.bill_id === parseInt(req.params.id));
  if (hasRefund) return res.status(400).json({ error:'This bill cannot be edited because a refund has already been recorded.' });
  if (String(db.bills[idx].payment_status || '') === 'Cancelled') return res.status(400).json({ error:'Cancelled bills cannot be edited.' });
  const before = { ...db.bills[idx] };
  const { line_items, consultation_fee, medicine_charge, other_charges, payment_method, payment_status, payment_splits,
    discount_id, discount_type, discount_label, discount_amount } = req.body;
  let items = db.bills[idx].line_items || [], cf, mc, oc, subtotal, total, discAmt = 0;
  if (Array.isArray(line_items) && line_items.length > 0) {
    items = line_items.map(i => {
      const item = { ...i };
      if (item.type !== 'package') {
        const validStatuses = ['Pending', 'In Progress', 'Completed'];
        const status = validStatuses.includes(item.service_status) ? item.service_status : 'Completed';
        item.service_status = status;
        item.completion_date = status === 'Completed' ? (item.completion_date || now()) : (item.completion_date || null);
      }
      return item;
    });
    subtotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    cf = 0; mc = 0; oc = 0;
  } else {
    cf = parseFloat(consultation_fee) || 0;
    mc = parseFloat(medicine_charge) || 0;
    oc = parseFloat(other_charges) || 0;
    subtotal = cf + mc + oc;
  }
  discAmt = parseFloat(discount_amount) || 0;
  total = Math.max(0, subtotal - discAmt);
  const splits = Array.isArray(payment_splits) ? payment_splits : db.bills[idx].payment_splits || [];
  db.bills[idx] = {
    ...db.bills[idx],
    line_items: items,
    consultation_fee: cf || 0,
    medicine_charge: mc || 0,
    other_charges: oc || 0,
    subtotal,
    discount_id: discount_id ? parseInt(discount_id) : null,
    discount_type: discount_type || null,
    discount_label: discount_label || null,
    discount_amount: discAmt,
    total,
    payment_method: payment_method || db.bills[idx].payment_method,
    payment_status: payment_status || db.bills[idx].payment_status,
    payment_splits: splits
  };
  // Auto-complete appointment when marked Paid
  const apt_id = db.bills[idx].appointment_id;
  if (before.payment_status !== db.bills[idx].payment_status) {
    logActivity(db, req, {
      module: 'billing',
      action: db.bills[idx].payment_status === 'Paid' ? 'payment_received' : 'payment_status_changed',
      entity_type: 'bill',
      entity_id: db.bills[idx].id,
      bill_id: db.bills[idx].id,
      patient_id: db.bills[idx].patient_id,
      appointment_id: db.bills[idx].appointment_id,
      visit_id: db.bills[idx].visit_id,
      notes: `Payment status ${before.payment_status || 'Unknown'} -> ${db.bills[idx].payment_status}`,
      meta: { payment_method: db.bills[idx].payment_method, total: db.bills[idx].total }
    });
  }
  if (payment_status === 'Paid' && apt_id) {
    const ai = db.appointments.findIndex(a => a.id === apt_id);
    if (ai !== -1 && db.appointments[ai].status !== 'Completed') db.appointments[ai].status = 'Completed';
  }
  writeDB(db);
  res.json({ success:true, bill: db.bills[idx] });
});

// ── Bill Attachments ──────────────────────────────────
app.get('/api/bills/:id/attachments', requireLogin, (req, res) => {
  const db = readDB();
  const bill = db.bills.find(b => b.id === parseInt(req.params.id));
  if (!bill) return res.status(404).json({ error:'Bill not found' });
  // Return metadata only — no base64 data
  res.json((bill.attachments || []).map(({ data: _, ...meta }) => meta));
});

app.get('/api/bills/:id/attachments/:attId', requireLogin, (req, res) => {
  const db = readDB();
  const bill = db.bills.find(b => b.id === parseInt(req.params.id));
  if (!bill) return res.status(404).json({ error:'Bill not found' });
  const att = (bill.attachments || []).find(a => String(a.id) === String(req.params.attId));
  if (!att) return res.status(404).json({ error:'Attachment not found' });
  // Serve as binary download
  const base64 = att.data.includes(',') ? att.data.split(',')[1] : att.data;
  const buf = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', att.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${att.name.replace(/"/g, '_')}"`);
  res.send(buf);
});

app.post('/api/bills/:id/attachments', requirePermission('billing.edit'), (req, res) => {
  const { name, type, data } = req.body;
  if (!name || !data) return res.status(400).json({ error:'name and data required' });
  if (Buffer.byteLength(data, 'utf8') > 5 * 1024 * 1024)
    return res.status(413).json({ error:'File too large (max 5 MB)' });
  const db = readDB();
  const idx = db.bills.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Bill not found' });
  if (!db.bills[idx].attachments) db.bills[idx].attachments = [];
  const att = { id: Date.now(), name, type: type || 'application/octet-stream', data, uploaded_at: nowIso(), uploaded_by: req.session.user.username };
  db.bills[idx].attachments.push(att);
  writeDB(db);
  res.json({ success:true, attachment: { id: att.id, name: att.name, type: att.type, uploaded_at: att.uploaded_at, uploaded_by: att.uploaded_by } });
});

app.delete('/api/bills/:id/attachments/:attId', requirePermission('billing.edit'), (req, res) => {
  const db = readDB();
  const idx = db.bills.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Bill not found' });
  const before = (db.bills[idx].attachments || []).length;
  db.bills[idx].attachments = (db.bills[idx].attachments || []).filter(a => String(a.id) !== String(req.params.attId));
  if (db.bills[idx].attachments.length === before) return res.status(404).json({ error:'Attachment not found' });
  writeDB(db);
  res.json({ success:true });
});

app.post('/api/bills/:id/cancel', requirePermission('billing.delete'), (req, res) => {
  const db = readDB();
  const idx = db.bills.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Bill not found' });
  const bill = db.bills[idx];
  if (String(bill.payment_status || '') === 'Cancelled') return res.status(400).json({ error:'Bill is already cancelled.' });
  const hasRefund = (db.refunds || []).some(r => r.bill_id === parseInt(req.params.id));
  if (hasRefund) return res.status(400).json({ error:'Refunded bills cannot be cancelled.' });
  const reason = String(req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ error:'Cancellation reason is required.' });

  bill.payment_status = 'Cancelled';
  bill.cancelled_at = now();
  bill.cancelled_by = (req.session && req.session.user && req.session.user.id) || req.session.userId || null;
  bill.cancellation_reason = reason;

  logActivity(db, req, {
    module: 'billing',
    action: 'bill_cancelled',
    entity_type: 'bill',
    entity_id: bill.id,
    bill_id: bill.id,
    patient_id: bill.patient_id,
    appointment_id: bill.appointment_id,
    visit_id: bill.visit_id,
    notes: `Bill ${bill.bill_number || bill.id} cancelled. Reason: ${reason}`,
    meta: { payment_method: bill.payment_method, total: bill.total, reason }
  });

  writeDB(db);
  res.json({ success:true, id: bill.id, payment_status: bill.payment_status });
});

// ===================== SERVICE COMPLETION =====================

// PATCH /api/bills/:id/items/:idx/status — mark a line item complete/pending
app.patch('/api/bills/:id/items/:itemIdx/status', requireLogin, (req, res) => {
  const db = readDB();
  const billId = parseInt(req.params.id, 10);
  const itemIdx = parseInt(req.params.itemIdx, 10);
  const bill = db.bills.find(b => b.id === billId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  if (String(bill.payment_status || '') === 'Cancelled') return res.status(400).json({ error: 'Cannot update cancelled bill' });
  if (!Array.isArray(bill.line_items) || itemIdx < 0 || itemIdx >= bill.line_items.length) {
    return res.status(404).json({ error: 'Line item not found' });
  }
  const item = bill.line_items[itemIdx];
  // Only allow on normal services (not packages)
  if (item.type === 'package') return res.status(400).json({ error: 'Use package session tracking for packages' });

  const { status, provider_id } = req.body;
  const validStatuses = ['Pending', 'In Progress', 'Completed'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });

  const me = req.session && req.session.user;

  item.service_status = status;
  item.completion_date = status === 'Completed' ? now() : null;
  item.provider_id = provider_id !== undefined ? (provider_id ? parseInt(provider_id, 10) : null) : (item.provider_id || (me ? me.id : null));

  logActivity(db, req, {
    module: 'billing',
    action: 'service_status_changed',
    entity_type: 'bill',
    entity_id: bill.id,
    bill_id: bill.id,
    patient_id: bill.patient_id,
    visit_id: bill.visit_id,
    notes: `Service "${item.name}" marked ${status} on bill ${bill.bill_number || bill.id}`,
    meta: { item_index: itemIdx, service_name: item.name, status }
  });

  writeDB(db);
  res.json({ success: true, item: bill.line_items[itemIdx] });
});

// GET /api/patients/:id/pending-services — pending services for a patient
app.get('/api/patients/:id/pending-services', requireLogin, (req, res) => {
  const db = readDB();
  const patientId = parseInt(req.params.id, 10);
  const patient = (db.patients || []).find(p => p.id === patientId);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const usersById = new Map((db.users || []).map(u => [u.id, u]));
  const pending = [];
  (db.bills || [])
    .filter(b => b.patient_id === patientId && String(b.payment_status || '') !== 'Cancelled')
    .forEach(bill => {
      (bill.line_items || []).forEach((item, idx) => {
        if (item.type === 'package') return;
        const svcStatus = item.service_status || 'Completed';
        if (svcStatus !== 'Completed') {
          const provider = usersById.get(item.provider_id) || null;
          pending.push({
            bill_id: bill.id,
            bill_number: bill.bill_number,
            visit_id: bill.visit_id,
            bill_date: String(bill.created_at || '').slice(0, 10),
            item_index: idx,
            service_name: item.name,
            service_status: svcStatus,
            completion_date: item.completion_date || null,
            provider_id: item.provider_id || null,
            provider_name: provider ? (provider.name || provider.username) : null,
            amount: item.amount || 0
          });
        }
      });
    });

  res.json({ patient_id: patientId, pending_count: pending.length, items: pending });
});

// GET /api/reports/pending-services — clinic-wide pending services report
app.get('/api/reports/pending-services', requireLogin, (req, res) => {
  const db = readDB();
  const me = req.session && req.session.user;
  const userRole = me && me.role;
  if (userRole !== 'admin' && !((db.role_permissions || []).find(rp => rp.role === userRole && (rp.permissions || []).includes('reports.view')))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const dateFrom = String(req.query.date_from || '').slice(0, 10);
  const dateTo = String(req.query.date_to || '').slice(0, 10);
  const filterPatientId = req.query.patient_id ? parseInt(req.query.patient_id, 10) : null;
  const filterProviderId = req.query.provider_id ? parseInt(req.query.provider_id, 10) : null;
  const filterStatus = req.query.status || '';

  const patientsById = new Map((db.patients || []).map(p => [p.id, p]));
  const usersById = new Map((db.users || []).map(u => [u.id, u]));

  const rows = [];
  (db.bills || [])
    .filter(b => String(b.payment_status || '') !== 'Cancelled')
    .forEach(bill => {
      const billDate = String(bill.created_at || '').slice(0, 10);
      if (dateFrom && billDate < dateFrom) return;
      if (dateTo && billDate > dateTo) return;
      if (filterPatientId && bill.patient_id !== filterPatientId) return;

      const patient = patientsById.get(bill.patient_id) || {};
      (bill.line_items || []).forEach((item, idx) => {
        if (item.type === 'package') return;
        const svcStatus = item.service_status || 'Completed';
        if (filterStatus && svcStatus !== filterStatus) return;
        if (filterProviderId && item.provider_id !== filterProviderId) return;

        const provider = usersById.get(item.provider_id) || null;
        rows.push({
          bill_id: bill.id,
          bill_number: bill.bill_number,
          visit_id: bill.visit_id,
          bill_date: billDate,
          item_index: idx,
          patient_id: bill.patient_id,
          patient_name: patient.name || '',
          mr_number: patient.mr_number || '',
          service_name: item.name,
          service_status: svcStatus,
          completion_date: item.completion_date || null,
          provider_id: item.provider_id || null,
          provider_name: provider ? (provider.name || provider.username) : null,
          amount: item.amount || 0
        });
      });
    });

  rows.sort((a, b) => String(a.bill_date).localeCompare(String(b.bill_date)));

  const summary = {
    total: rows.length,
    pending: rows.filter(r => r.service_status === 'Pending').length,
    in_progress: rows.filter(r => r.service_status === 'In Progress').length,
    completed: rows.filter(r => r.service_status === 'Completed').length,
  };

  res.json({ summary, rows });
});

// ===================== REPORTS =====================
function calcFinancialSnapshot(db, dateFrom, dateTo) {
  const billById = new Map((db.bills || []).map(b => [parseInt(b.id), b]));
  const inRange = (day) => {
    const d = String(day || '').slice(0, 10);
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  let grossRevenue = 0;
  let totalDiscount = 0;
  let netRevenue = 0;
  let totalRefund = 0;
  let cancelledBillsCount = 0;
  let cancelledGross = 0;
  let activeBillsCount = 0;

  for (const bill of (db.bills || [])) {
    const billDay = String(bill.created_at || '').slice(0, 10);
    if (!inRange(billDay)) continue;

    const discount = Math.max(0, parseFloat(bill.discount_amount || 0) || 0);
    const gross = Math.max(0, parseFloat(bill.subtotal != null ? bill.subtotal : ((parseFloat(bill.total || 0) || 0) + discount)) || 0);
    const net = Math.max(0, parseFloat(bill.total != null ? bill.total : (gross - discount)) || 0);

    if (String(bill.payment_status || '') === 'Cancelled') {
      cancelledBillsCount += 1;
      cancelledGross += gross;
      continue;
    }

    activeBillsCount += 1;
    grossRevenue += gross;
    totalDiscount += discount;
    netRevenue += net;
  }

  for (const refund of (db.refunds || [])) {
    const refundDay = String(refund.created_at || '').slice(0, 10);
    if (!inRange(refundDay)) continue;
    const linkedBill = billById.get(parseInt(refund.bill_id));
    if (!linkedBill) continue;
    if (String(linkedBill.payment_status || '') === 'Cancelled') continue;
    totalRefund += Math.max(0, parseFloat(refund.refund_amount || 0) || 0);
  }

  const finalRevenue = netRevenue - totalRefund;
  return {
    gross_revenue: parseFloat(grossRevenue.toFixed(3)),
    total_discount: parseFloat(totalDiscount.toFixed(3)),
    net_revenue: parseFloat(netRevenue.toFixed(3)),
    total_refund: parseFloat(totalRefund.toFixed(3)),
    final_revenue: parseFloat(finalRevenue.toFixed(3)),
    cancelled_bills_count: cancelledBillsCount,
    cancelled_gross: parseFloat(cancelledGross.toFixed(3)),
    active_bills_count: activeBillsCount
  };
}

app.get('/api/reports/daily', requireRole('admin','doctor'), (req, res) => {
  const db=readDB(); const d=req.query.date||today();
  if (autoMarkMissedAppointmentsAsNoShow(db)) writeDB(db);
  const apts=db.appointments.filter(a=>a.date===d);
  const seen=apts.filter(a=>!['Cancelled','No-Show'].includes(a.status)).length;
  const pendB=db.bills.filter(b=>(b.created_at||'').startsWith(d)&&b.payment_status==='Pending').length;
  const finance = calcFinancialSnapshot(db, d, d);
  const byStatus=['Booked','Confirmed','Arrived','Completed','Cancelled','No-Show'].map(s=>({ status:s, count:apts.filter(a=>a.status===s).length })).filter(s=>s.count>0);
  res.json({
    date:d,
    patients_seen:seen,
    revenue: finance.final_revenue,
    pending_bills:pendB,
    appointment_by_status:byStatus,
    ...finance
  });
});
app.get('/api/reports/no-show', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  if (autoMarkMissedAppointmentsAsNoShow(db)) writeDB(db);

  const threshold = Math.max(1, parseInt(req.query.threshold || req.query.min_streak || 5, 10));
  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || 25, 10)));
  const q = String(req.query.search || '').trim().toLowerCase();

  const appointmentsByPatient = new Map();
  for (const apt of (db.appointments || [])) {
    const pid = parseInt(apt.patient_id, 10);
    if (!pid) continue;
    if (!appointmentsByPatient.has(pid)) appointmentsByPatient.set(pid, []);
    appointmentsByPatient.get(pid).push(apt);
  }

  const allStreakRows = [];
  const rows = [];
  for (const patient of (db.patients || [])) {
    const pid = parseInt(patient.id, 10);
    if (!pid) continue;
    const patientApts = (appointmentsByPatient.get(pid) || []).sort((a, b) => {
      const ak = `${String(a.date || '')} ${String(a.time || '')} ${String(a.created_at || '')}`;
      const bk = `${String(b.date || '')} ${String(b.time || '')} ${String(b.created_at || '')}`;
      return bk.localeCompare(ak);
    });
    if (!patientApts.length) continue;

    let streak = 0;
    let lastNoShowDate = '';
    for (const apt of patientApts) {
      if (String(apt.status || '').trim() !== 'No-Show') break;
      streak += 1;
      if (!lastNoShowDate) lastNoShowDate = String(apt.date || '').trim();
    }
    const totalNoShows = patientApts.filter(a => String(a.status || '').trim() === 'No-Show').length;
    const latestAppointment = patientApts[0] || null;

    const searchable = [
      patient.name,
      patient.second_name,
      patient.mr_number,
      patient.phone,
      patient.alt_phone,
      patient.civil_id
    ].map(v => String(v || '').toLowerCase());
    if (q && !searchable.some(v => v.includes(q))) continue;

    const reportRow = {
      patient_id: pid,
      mr_number: patient.mr_number || '',
      patient_name: patient.name || '',
      second_name: patient.second_name || '',
      phone: patient.phone || '',
      civil_id: patient.civil_id || '',
      consecutive_no_show_streak: streak,
      total_no_shows: totalNoShows,
      last_no_show_date: lastNoShowDate,
      latest_status: latestAppointment ? (latestAppointment.status || '') : ''
    };
    allStreakRows.push(reportRow);
    if (streak >= threshold) rows.push(reportRow);
  }

  rows.sort((a, b) => {
    const byStreak = (parseInt(b.consecutive_no_show_streak, 10) || 0) - (parseInt(a.consecutive_no_show_streak, 10) || 0);
    if (byStreak !== 0) return byStreak;
    return String(b.last_no_show_date || '').localeCompare(String(a.last_no_show_date || ''));
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;
  const pagedRows = rows.slice(start, start + limit);

  res.json({
    threshold,
    rows: pagedRows,
    page: safePage,
    pages,
    total,
    limit,
    summary: {
      total_flagged_patients: rows.length,
      max_streak: allStreakRows.length ? Math.max(...allStreakRows.map(r => parseInt(r.consecutive_no_show_streak, 10) || 0)) : 0,
      total_any_no_show_streak: allStreakRows.length,
      threshold_counts: {
        1: allStreakRows.filter(r => (parseInt(r.consecutive_no_show_streak, 10) || 0) >= 1).length,
        2: allStreakRows.filter(r => (parseInt(r.consecutive_no_show_streak, 10) || 0) >= 2).length,
        3: allStreakRows.filter(r => (parseInt(r.consecutive_no_show_streak, 10) || 0) >= 3).length,
        5: allStreakRows.filter(r => (parseInt(r.consecutive_no_show_streak, 10) || 0) >= 5).length
      }
    }
  });
});
app.get('/api/reports/revenue', requireRole('admin'), (req, res) => {
  const db=readDB();
  const out = [];
  const base = new Date();
  for (let i = 0; i < 30; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    const day = dt.toLocaleDateString('sv');
    const finance = calcFinancialSnapshot(db, day, day);
    out.push({
      day,
      bills: finance.active_bills_count,
      cancelled_bills: finance.cancelled_bills_count,
      gross_revenue: finance.gross_revenue,
      total_discount: finance.total_discount,
      net_revenue: finance.net_revenue,
      total_refund: finance.total_refund,
      final_revenue: finance.final_revenue,
      revenue: finance.final_revenue
    });
  }
  res.json(out);
});
app.get('/api/reports/billed-services', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  const dateFrom = String(req.query.date_from || req.query.date || today()).slice(0,10);
  const dateTo = String(req.query.date_to || req.query.date || dateFrom).slice(0,10);
  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const doctorFilter = req.query.doctor_id ? parseInt(req.query.doctor_id) : null;
  const deptFilter = req.query.department_id ? parseInt(req.query.department_id) : null;
  const serviceFilter = req.query.service_id ? parseInt(req.query.service_id) : null;
  const q = String(req.query.search || '').trim().toLowerCase();

  const patientsById = new Map((db.patients || []).map(p => [parseInt(p.id), p]));
  const doctorsById = new Map((db.users || []).map(u => [parseInt(u.id), u]));
  const departmentsById = new Map((db.doctor_departments || []).map(d => [parseInt(d.id), d]));
  const servicesById = new Map((db.services || []).map(s => [parseInt(s.id), s]));
  const appointmentsById = new Map((db.appointments || []).map(a => [parseInt(a.id), a]));

  const rows = [];
  for (const bill of (db.bills || [])) {
    const day = String(bill.created_at || '').slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;

    const pt = patientsById.get(parseInt(bill.patient_id)) || {};
    const apt = appointmentsById.get(parseInt(bill.appointment_id)) || null;
    const doctorId = apt ? parseInt(apt.doctor_id) : (bill.doctor_id ? parseInt(bill.doctor_id) : null);
    const doctor = doctorId ? (doctorsById.get(doctorId) || {}) : {};
    const deptId = doctor ? parseInt(doctor.department_id) : null;
    const dept = deptId ? (departmentsById.get(deptId) || {}) : {};

    if (doctorFilter && doctorId !== doctorFilter) continue;
    if (deptFilter && deptId !== deptFilter) continue;

    const items = Array.isArray(bill.line_items) ? bill.line_items : [];
    for (const li of items) {
      const selIds = Array.isArray(li.selected_service_ids) ? li.selected_service_ids.map(Number).filter(Boolean) : [];
      const serviceRows = [];
      const lineType = String(li.type || '').toLowerCase();
      const sourceType = lineType === 'package' ? 'Package' : (lineType === 'pkg_session' ? 'Package Session' : 'Service');
      const sourceName = li.name || '';

      if (li.service_id || li.ref_id || li.type === 'service') {
        const sid = parseInt(li.service_id || li.ref_id);
        if (sid) serviceRows.push({ service_id: sid, qty: parseFloat(li.qty || 1) || 1, amount: parseFloat(li.amount || 0) || 0 });
      } else if (li.type === 'package' && selIds.length) {
        const each = (parseFloat(li.amount || 0) || 0) / selIds.length;
        for (const sid of selIds) serviceRows.push({ service_id: sid, qty: 1, amount: each });
      }

      for (const sr of serviceRows) {
        if (serviceFilter && sr.service_id !== serviceFilter) continue;
        const svc = servicesById.get(parseInt(sr.service_id)) || {};
        const serviceName = svc.name || li.name || 'Service';
        const doctorName = doctor && (doctor.name || doctor.username) ? (doctor.name || doctor.username) : 'Unknown';
        const deptName = dept && dept.name ? dept.name : 'Unknown';

        const searchable = [
          bill.bill_number, bill.visit_id, pt.name, pt.mr_number,
          serviceName, doctorName, deptName, bill.payment_method, bill.payment_status
        ].map(v => String(v || '').toLowerCase()).join(' ');
        if (q && !searchable.includes(q)) continue;

        rows.push({
          date: day,
          bill_id: parseInt(bill.id),
          bill_number: bill.bill_number || '',
          visit_id: bill.visit_id || '',
          item_type: sourceType,
          item_name: sourceName,
          patient_id: parseInt(bill.patient_id) || null,
          patient_name: pt.name || '',
          mr_number: pt.mr_number || '',
          service_id: parseInt(sr.service_id),
          service_name: serviceName,
          doctor_id: doctorId,
          doctor_name: doctorName,
          department_id: deptId,
          department_name: deptName,
          qty: parseFloat((parseFloat(sr.qty || 0) || 0).toFixed(3)),
          amount: parseFloat((parseFloat(sr.amount || 0) || 0).toFixed(3)),
          payment_status: bill.payment_status || 'Pending',
          payment_method: bill.payment_method || 'Cash'
        });
      }
    }
  }

  rows.sort((a,b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.bill_id || 0) - (a.bill_id || 0);
  });

  const totalAmount = rows.reduce((s, r) => s + (parseFloat(r.amount || 0) || 0), 0);
  const uniqueBills = new Set(rows.map(r => r.bill_id)).size;
  const uniqueServices = new Set(rows.map(r => r.service_id)).size;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = rows.slice(start, start + limit);

  const filters = {
    doctors: (db.users || [])
      .filter(u => String(u.role || '').toLowerCase() === 'doctor')
      .map(u => ({ id: parseInt(u.id), name: u.name || u.username || `Doctor #${u.id}`, department_id: parseInt(u.department_id) || null })),
    departments: (db.doctor_departments || []).map(d => ({ id: parseInt(d.id), name: d.name || '' })),
    services: (db.services || []).map(s => ({ id: parseInt(s.id), name: s.name || '' }))
  };

  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary: {
      date_from: dateFrom,
      date_to: dateTo,
      total_amount: parseFloat(totalAmount.toFixed(3)),
      rows_count: total,
      bills_count: uniqueBills,
      services_count: uniqueServices
    },
    filters
  });
});
app.get('/api/reports/user-collections', requireRole('admin','receptionist'), (req, res) => {
  const db = readDB();
  const dateFrom = String(req.query.date_from || req.query.date || today()).slice(0,10);
  const dateTo = String(req.query.date_to || req.query.date || dateFrom).slice(0,10);
  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const userFilter = req.query.user_id ? parseInt(req.query.user_id) : null;
  const methodFilter = String(req.query.payment_method || '').trim().toLowerCase();
  const usersById = new Map((db.users || []).map(u => [parseInt(u.id), u]));
  const patientsById = new Map((db.patients || []).map(p => [parseInt(p.id), p]));
  const actorByBillId = new Map();
  for (const a of (db.activity_logs || [])) {
    if (String(a.module || '').toLowerCase() !== 'billing') continue;
    if (!['bill_created', 'payment_received'].includes(String(a.action || ''))) continue;
    const billId = parseInt(a.bill_id || a.entity_id);
    const actorId = parseInt(a.actor_id);
    if (!billId || !actorId) continue;
    if (!actorByBillId.has(billId)) actorByBillId.set(billId, actorId);
  }

  const grouped = new Map();
  const refundedByBill = new Map();
  for (const r of (db.refunds || [])) {
    const bid = parseInt(r.bill_id);
    if (!bid) continue;
    const amt = parseFloat(r.refund_amount || 0) || 0;
    refundedByBill.set(bid, (refundedByBill.get(bid) || 0) + amt);
  }
  for (const bill of (db.bills || [])) {
    if (!['Paid', 'Partially Refunded', 'Refunded'].includes(String(bill.payment_status || ''))) continue;
    const day = String(bill.created_at || '').slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;

    const collectorId = parseInt(bill.created_by) || actorByBillId.get(parseInt(bill.id)) || null;
    if (userFilter && collectorId !== userFilter) continue;

    const user = collectorId ? usersById.get(collectorId) : null;
    if (user && String(user.role || '').toLowerCase() === 'doctor') continue;
    const collectorName = user ? (user.name || user.username || `User #${collectorId}`) : 'Unknown';

    const splitRows = (Array.isArray(bill.payment_splits) && bill.payment_splits.length)
      ? bill.payment_splits
      : [{ method: bill.payment_method || 'Cash', amount: parseFloat(bill.total || 0) || 0 }];
    const billGross = splitRows.reduce((s, sp) => s + (parseFloat(sp.amount || 0) || 0), 0);
    const billRefunded = Math.max(0, parseFloat((refundedByBill.get(parseInt(bill.id)) || 0).toFixed(3)));

    for (const split of splitRows) {
      const method = String(split.method || bill.payment_method || 'Cash').trim() || 'Cash';
      if (methodFilter && method.toLowerCase() !== methodFilter) continue;
      const amount = parseFloat(split.amount || 0) || 0;
      if (amount <= 0) continue;
      const refundShare = billGross > 0 ? (billRefunded * (amount / billGross)) : 0;
      const netAmount = Math.max(0, parseFloat((amount - refundShare).toFixed(3)));

      const key = `${day}|${collectorId || 0}|${method.toLowerCase()}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: day,
          user_id: collectorId,
          user_name: collectorName,
          payment_method: method,
          gross_amount: 0,
          refunded_amount: 0,
          amount: 0,
          bills_count: 0,
          _bill_ids: new Set(),
          _bill_map: new Map()
        });
      }
      const row = grouped.get(key);
      row.gross_amount += amount;
      row.refunded_amount += refundShare;
      row.amount += netAmount;
      const billId = parseInt(bill.id);
      row._bill_ids.add(billId);
      if (!row._bill_map.has(billId)) {
        const pt = patientsById.get(parseInt(bill.patient_id)) || {};
        row._bill_map.set(billId, {
          bill_id: billId,
          bill_number: bill.bill_number || '',
          patient_name: pt.name || '',
          mr_number: pt.mr_number || '',
          visit_id: bill.visit_id || '',
          total: parseFloat(bill.total || 0) || 0,
          split_amount: 0,
          refunded_amount: 0,
          net_amount: 0,
          payment_status: bill.payment_status || '',
          created_at: bill.created_at || ''
        });
      }
      const bRow = row._bill_map.get(billId);
      bRow.split_amount = parseFloat(((parseFloat(bRow.split_amount || 0) || 0) + amount).toFixed(3));
      bRow.refunded_amount = parseFloat(((parseFloat(bRow.refunded_amount || 0) || 0) + refundShare).toFixed(3));
      bRow.net_amount = parseFloat(((parseFloat(bRow.net_amount || 0) || 0) + netAmount).toFixed(3));
    }
  }

  const rows = [...grouped.values()].map(r => ({
    date: r.date,
    user_id: r.user_id,
    user_name: r.user_name,
    payment_method: r.payment_method,
    gross_amount: parseFloat(r.gross_amount.toFixed(3)),
    refunded_amount: parseFloat(r.refunded_amount.toFixed(3)),
    amount: parseFloat(r.amount.toFixed(3)),
    bills_count: r._bill_ids.size,
    bills: [...r._bill_map.values()]
      .sort((a,b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
      .map(b => ({
        bill_id: b.bill_id,
        bill_number: b.bill_number,
        patient_name: b.patient_name,
        mr_number: b.mr_number,
        visit_id: b.visit_id,
        total: parseFloat((parseFloat(b.total || 0) || 0).toFixed(3)),
        split_amount: parseFloat((parseFloat(b.split_amount || 0) || 0).toFixed(3)),
        refunded_amount: parseFloat((parseFloat(b.refunded_amount || 0) || 0).toFixed(3)),
        net_amount: parseFloat((parseFloat(b.net_amount || 0) || 0).toFixed(3)),
        payment_status: b.payment_status || '',
        created_at: b.created_at
      }))
  })).sort((a,b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const un = String(a.user_name || '').localeCompare(String(b.user_name || ''));
    if (un !== 0) return un;
    return String(a.payment_method || '').localeCompare(String(b.payment_method || ''));
  });

  const totalsByMethodMap = {};
  const totalsByUserMap = {};
  let totalGross = 0;
  let totalRefunded = 0;
  let totalCollection = 0;
  let totalBills = 0;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = rows.slice(start, start + limit);

  for (const r of rows) {
    totalGross += (parseFloat(r.gross_amount || 0) || 0);
    totalRefunded += (parseFloat(r.refunded_amount || 0) || 0);
    totalCollection += r.amount;
    totalBills += r.bills_count;
    totalsByMethodMap[r.payment_method] = (totalsByMethodMap[r.payment_method] || 0) + r.amount;
    totalsByUserMap[r.user_name] = (totalsByUserMap[r.user_name] || 0) + r.amount;
  }

  const availableUsers = Object.values((db.users || []).reduce((acc, u) => {
    const id = parseInt(u.id);
    if (!id) return acc;
    if (String(u.role || '').toLowerCase() === 'doctor') return acc;
    acc[id] = { id, name: u.name || u.username || `User #${id}` };
    return acc;
  }, {})).sort((a,b) => String(a.name).localeCompare(String(b.name)));

  const availableMethods = [...new Set(
    (db.payment_methods || []).map(m => String(m.name || '').trim()).filter(Boolean)
      .concat((db.bills || []).map(b => String(b.payment_method || '').trim()).filter(Boolean))
  )].sort((a,b) => a.localeCompare(b));

  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary: {
      date_from: dateFrom,
      date_to: dateTo,
      gross_collection: parseFloat(totalGross.toFixed(3)),
      total_refunded: parseFloat(totalRefunded.toFixed(3)),
      total_collection: parseFloat(totalCollection.toFixed(3)),
      rows_count: total,
      total_bill_entries: totalBills
    },
    totals_by_payment_method: Object.entries(totalsByMethodMap)
      .map(([method, amount]) => ({ payment_method: method, amount: parseFloat(amount.toFixed(3)) }))
      .sort((a,b) => String(a.payment_method).localeCompare(String(b.payment_method))),
    totals_by_user: Object.entries(totalsByUserMap)
      .map(([user_name, amount]) => ({ user_name, amount: parseFloat(amount.toFixed(3)) }))
      .sort((a,b) => String(a.user_name).localeCompare(String(b.user_name))),
    filters: {
      users: availableUsers,
      payment_methods: availableMethods
    }
  });
});
app.get('/api/reports/service-consumption', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  ensureStore(db);
  const { date_from, date_to, service_id, product_id, search } = req.query;
  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const serviceById = new Map((db.services || []).map(s => [s.id, s]));
  const productById = new Map((db.store_products || []).map(p => [p.id, p]));

  const rows = (db.store_service_consumptions || []).filter(r => {
    const d = String((r.at || r.date || '')).slice(0,10);
    if (date_from && d < date_from) return false;
    if (date_to && d > date_to) return false;
    if (service_id && parseInt(r.service_id) !== parseInt(service_id)) return false;
    if (product_id && parseInt(r.product_id) !== parseInt(product_id)) return false;
    if (search) {
      const svc = serviceById.get(parseInt(r.service_id)) || {};
      const prod = productById.get(parseInt(r.product_id)) || {};
      const q = String(search).toLowerCase().trim();
      const blob = `${svc.name || ''} ${prod.name || ''} ${prod.sku || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const grouped = new Map();
  for (const r of rows) {
    const sid = parseInt(r.service_id);
    const pid = parseInt(r.product_id);
    const key = `${sid}-${pid}`;
    if (!grouped.has(key)) {
      const svc = serviceById.get(sid) || {};
      const prod = productById.get(pid) || {};
      grouped.set(key, {
        service_id: sid,
        service_name: svc.name || `Service #${sid}`,
        product_id: pid,
        product_name: prod.name || `Product #${pid}`,
        product_sku: prod.sku || '',
        unit: prod.uom_symbol || prod.unit || '',
        total_service_qty: 0,
        total_consumed_qty: 0,
        avg_unit_cost: 0,
        total_cost: 0,
        records: 0
      });
    }
    const g = grouped.get(key);
    const unitCost = parseFloat(r.unit_cost != null ? r.unit_cost : (productById.get(pid) || {}).cost_price || 0) || 0;
    const rowCost = parseFloat(r.total_cost != null ? r.total_cost : ((parseFloat(r.consumed_qty || 0) * unitCost).toFixed(3))) || 0;
    g.total_service_qty += parseFloat(r.service_qty || 0);
    g.total_consumed_qty += parseFloat(r.consumed_qty || 0);
    g.total_cost += rowCost;
    g.avg_unit_cost += unitCost;
    g.records += 1;
  }

  const groupedRows = [...grouped.values()]
    .map(x => ({
      ...x,
      total_service_qty: parseFloat(x.total_service_qty.toFixed(3)),
      total_consumed_qty: parseFloat(x.total_consumed_qty.toFixed(3)),
      avg_unit_cost: parseFloat((x.records ? (x.avg_unit_cost / x.records) : 0).toFixed(3)),
      total_cost: parseFloat(x.total_cost.toFixed(3))
    }))
    .sort((a, b) => {
      const sn = String(a.service_name || '').localeCompare(String(b.service_name || ''));
      if (sn !== 0) return sn;
      return String(a.product_name || '').localeCompare(String(b.product_name || ''));
    });

  const total = groupedRows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = groupedRows.slice(start, start + limit);

  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary: {
      entries: total,
      total_records: rows.length,
      total_service_qty: parseFloat(groupedRows.reduce((s, r) => s + (r.total_service_qty || 0), 0).toFixed(3)),
      total_consumed_qty: parseFloat(groupedRows.reduce((s, r) => s + (r.total_consumed_qty || 0), 0).toFixed(3)),
      total_cost: parseFloat(groupedRows.reduce((s, r) => s + (r.total_cost || 0), 0).toFixed(3))
    }
  });
});
app.get('/api/reports/service-consumption-products', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  ensureStore(db);
  const { date_from, date_to, product_id, search } = req.query;
  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const serviceById = new Map((db.services || []).map(s => [s.id, s]));
  const productById = new Map((db.store_products || []).map(p => [p.id, p]));

  const rows = (db.store_service_consumptions || []).filter(r => {
    const d = String((r.at || r.date || '')).slice(0,10);
    if (date_from && d < date_from) return false;
    if (date_to && d > date_to) return false;
    if (product_id && parseInt(r.product_id) !== parseInt(product_id)) return false;
    if (search) {
      const svc = serviceById.get(parseInt(r.service_id)) || {};
      const prod = productById.get(parseInt(r.product_id)) || {};
      const q = String(search).toLowerCase().trim();
      const blob = `${svc.name || ''} ${prod.name || ''} ${prod.sku || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const grouped = new Map();
  for (const r of rows) {
    const sid = parseInt(r.service_id);
    const pid = parseInt(r.product_id);
    const prod = productById.get(pid) || {};
    if (!grouped.has(pid)) {
      grouped.set(pid, {
        product_id: pid,
        product_name: prod.name || `Product #${pid}`,
        product_sku: prod.sku || '',
        unit: prod.uom_symbol || prod.unit || '',
        total_service_qty: 0,
        total_consumed_qty: 0,
        avg_unit_cost: 0,
        total_cost: 0,
        records: 0,
        service_ids: new Set()
      });
    }
    const g = grouped.get(pid);
    const unitCost = parseFloat(r.unit_cost != null ? r.unit_cost : (prod.cost_price || 0)) || 0;
    const rowCost = parseFloat(r.total_cost != null ? r.total_cost : ((parseFloat(r.consumed_qty || 0) * unitCost).toFixed(3))) || 0;
    g.total_service_qty += parseFloat(r.service_qty || 0);
    g.total_consumed_qty += parseFloat(r.consumed_qty || 0);
    g.total_cost += rowCost;
    g.avg_unit_cost += unitCost;
    g.records += 1;
    if (sid) g.service_ids.add(sid);
  }

  const groupedRows = [...grouped.values()]
    .map(x => ({
      product_id: x.product_id,
      product_name: x.product_name,
      product_sku: x.product_sku,
      unit: x.unit,
      services_used_count: x.service_ids.size,
      total_service_qty: parseFloat(x.total_service_qty.toFixed(3)),
      total_consumed_qty: parseFloat(x.total_consumed_qty.toFixed(3)),
      avg_unit_cost: parseFloat((x.records ? (x.avg_unit_cost / x.records) : 0).toFixed(3)),
      total_cost: parseFloat(x.total_cost.toFixed(3)),
      records: x.records
    }))
    .sort((a, b) => {
      if ((b.total_cost || 0) !== (a.total_cost || 0)) return (b.total_cost || 0) - (a.total_cost || 0);
      return String(a.product_name || '').localeCompare(String(b.product_name || ''));
    });

  const grandTotalCost = parseFloat(groupedRows.reduce((s, r) => s + (r.total_cost || 0), 0).toFixed(3));
  for (const r of groupedRows) {
    r.cost_share_pct = grandTotalCost > 0
      ? parseFloat((((r.total_cost || 0) / grandTotalCost) * 100).toFixed(2))
      : 0;
  }

  const total = groupedRows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = groupedRows.slice(start, start + limit);

  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary: {
      entries: total,
      total_records: rows.length,
      total_service_qty: parseFloat(groupedRows.reduce((s, r) => s + (r.total_service_qty || 0), 0).toFixed(3)),
      total_consumed_qty: parseFloat(groupedRows.reduce((s, r) => s + (r.total_consumed_qty || 0), 0).toFixed(3)),
      total_cost: grandTotalCost
    }
  });
});

app.get('/api/reports/manual-consumption-cost', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  ensureStore(db);

  const dateFrom = String(req.query.date_from || req.query.date || today()).slice(0, 10);
  const dateTo = String(req.query.date_to || req.query.date || dateFrom).slice(0, 10);
  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const storeFilter = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
  const reasonFilter = String(req.query.reason || '').trim().toLowerCase();
  const q = String(req.query.search || '').trim().toLowerCase();

  const storesById = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id, 10), s]));
  const productsById = new Map((db.store_products || []).map(p => [parseInt(p.id, 10), p]));
  const usersById = new Map((db.users || []).map(u => [parseInt(u.id, 10), u]));

  const rows = [];
  for (const entry of (db.store_manual_consumptions || [])) {
    const day = String(entry.date || entry.created_at || '').slice(0, 10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;

    const sid = parseInt(entry.store_id, 10);
    if (storeFilter && sid !== storeFilter) continue;
    const store = storesById.get(sid) || {};
    const createdBy = usersById.get(parseInt(entry.created_by, 10)) || {};

    for (const item of (entry.items || [])) {
      const pid = parseInt(item.product_id, 10);
      const p = productsById.get(pid) || {};
      const reason = normalizeManualConsumptionReason(item.reason);
      if (reasonFilter && reason.toLowerCase() !== reasonFilter) continue;

      const qty = parseFloat(item.qty || 0) || 0;
      const cost = parseFloat(item.cost || 0) || 0;
      const totalCost = parseFloat(item.total_cost != null ? item.total_cost : (qty * cost)) || 0;

      const blob = [
        day,
        entry.entry_no,
        store.name,
        p.name,
        p.sku,
        reason,
        item.remarks,
        entry.remarks
      ].map(v => String(v || '').toLowerCase()).join(' ');
      if (q && !blob.includes(q)) continue;

      rows.push({
        date: day,
        at: String(entry.created_at || ''),
        entry_id: parseInt(entry.id, 10),
        entry_no: entry.entry_no || `MC-${entry.id}`,
        store_id: sid,
        store_name: store.name || 'Unknown',
        product_id: pid,
        item_name: p.name || `Product #${pid}`,
        item_sku: p.sku || '',
        qty: parseFloat(qty.toFixed(3)),
        unit: p.unit || '',
        cost: parseFloat(cost.toFixed(3)),
        total_cost: parseFloat(totalCost.toFixed(3)),
        reason,
        remarks: String(item.remarks || '').trim(),
        entry_remarks: String(entry.remarks || '').trim(),
        created_by: parseInt(entry.created_by, 10) || null,
        created_by_name: createdBy.name || createdBy.username || ''
      });
    }
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const atCmp = String(a.at || '').localeCompare(String(b.at || ''));
    if (atCmp !== 0) return -atCmp;
    return parseInt(b.entry_id || 0, 10) - parseInt(a.entry_id || 0, 10);
  });

  const storeTotalsMap = new Map();
  for (const r of rows) {
    const key = parseInt(r.store_id, 10);
    if (!storeTotalsMap.has(key)) {
      storeTotalsMap.set(key, {
        store_id: key,
        store_name: r.store_name || 'Unknown',
        total_qty: 0,
        total_cost: 0,
        rows_count: 0
      });
    }
    const x = storeTotalsMap.get(key);
    x.total_qty += parseFloat(r.qty || 0) || 0;
    x.total_cost += parseFloat(r.total_cost || 0) || 0;
    x.rows_count += 1;
  }

  const storeTotals = [...storeTotalsMap.values()]
    .map(x => ({
      ...x,
      total_qty: parseFloat(x.total_qty.toFixed(3)),
      total_cost: parseFloat(x.total_cost.toFixed(3))
    }))
    .sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = rows.slice(start, start + limit);

  const entryIds = new Set(rows.map(r => parseInt(r.entry_id, 10)).filter(Boolean));
  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary: {
      date_from: dateFrom,
      date_to: dateTo,
      rows_count: total,
      entries_count: entryIds.size,
      total_qty: parseFloat(rows.reduce((s, r) => s + (parseFloat(r.qty || 0) || 0), 0).toFixed(3)),
      total_cost: parseFloat(rows.reduce((s, r) => s + (parseFloat(r.total_cost || 0) || 0), 0).toFixed(3))
    },
    store_totals: storeTotals,
    filters: {
      stores: (db.store_sub_stores || []).map(s => ({ id: parseInt(s.id, 10), name: s.name || '' })),
      reasons: MANUAL_CONSUMPTION_REASONS
    }
  });
});

// ── Supplier Ledger Report ────────────────────────────────
app.get('/api/reports/supplier-ledger', requireRole('admin', 'receptionist'), (req, res) => {
  const db = readDB(); ensureStore(db);

  const supplierId = req.query.supplier_id ? parseInt(req.query.supplier_id, 10) : null;
  const dateFrom   = String(req.query.date_from || '').slice(0, 10);
  const dateTo     = String(req.query.date_to   || '').slice(0, 10);
  const q          = String(req.query.search    || '').trim().toLowerCase();

  const suppliersById = new Map((db.store_suppliers || []).map(s => [parseInt(s.id), s]));

  // Build per-supplier ledger
  const ledgers = new Map(); // supplierId -> { supplier, entries[], totalDebit, totalCredit }

  const getOrCreate = (sid) => {
    if (!ledgers.has(sid)) {
      const s = suppliersById.get(sid) || {};
      ledgers.set(sid, {
        supplier_id: sid,
        supplier_name: s.name || `Supplier #${sid}`,
        supplier_phone: s.phone || '',
        supplier_email: s.email || '',
        entries: [],
        total_debit: 0,
        total_credit: 0,
        total_returns: 0
      });
    }
    return ledgers.get(sid);
  };

  // CREDITS — Purchase Orders (received) — supplier is owed money; liability increases
  for (const po of (db.store_purchase_orders || [])) {
    const sid = parseInt(po.supplier_id, 10);
    if (!sid) continue;
    if (supplierId && sid !== supplierId) continue;
    const day = String(po.received_at || po.order_date || po.created_at || '').slice(0, 10);
    if (dateFrom && day < dateFrom) continue;
    if (dateTo   && day > dateTo)   continue;
    const amount = parseFloat(po.total_cost || 0) || 0;
    const ref    = po.invoice_number || `PO#${po.id}`;
    const blob   = [day, 'purchase', ref, po.notes].map(v => String(v || '').toLowerCase()).join(' ');
    if (q && !blob.includes(q)) continue;
    const ledger = getOrCreate(sid);
    ledger.entries.push({
      date: day || String(po.created_at || '').slice(0, 10),
      type: 'Purchase',
      reference: ref,
      description: `PO Invoice: ${ref}`,
      debit: 0,
      credit: parseFloat(amount.toFixed(3)),
      source: 'purchase_order',
      source_id: po.id
    });
    ledger.total_credit += amount;
  }

  // DEBITS — Supplier Invoice Payments — reduces liability
  for (const p of (db.store_supplier_invoice_payments || [])) {
    const sid = parseInt(p.supplier_id, 10);
    if (!sid) continue;
    if (supplierId && sid !== supplierId) continue;
    const day = String(p.payment_date || p.created_at || '').slice(0, 10);
    if (dateFrom && day < dateFrom) continue;
    if (dateTo   && day > dateTo)   continue;
    const amount = parseFloat(p.amount || 0) || 0;
    const blob   = [day, 'payment', p.invoice_number, p.payment_method, p.reference_no, p.notes].map(v => String(v || '').toLowerCase()).join(' ');
    if (q && !blob.includes(q)) continue;
    const ledger = getOrCreate(sid);
    ledger.entries.push({
      date: day,
      type: 'Payment',
      reference: p.reference_no || p.invoice_number || `PAY#${p.id}`,
      description: `Payment · ${p.invoice_number || '—'} · ${p.payment_method || ''}`,
      debit: parseFloat(amount.toFixed(3)),
      credit: 0,
      source: 'payment',
      source_id: p.id
    });
    ledger.total_debit += amount;
  }

  // CREDIT REDUCTIONS — Supplier Returns — reduce purchase-side credit without counting as debit
  for (const sr of (db.store_supplier_returns || [])) {
    const sid = parseInt(sr.supplier_id, 10);
    if (!sid) continue;
    if (supplierId && sid !== supplierId) continue;
    const day = String(sr.return_date || sr.created_at || '').slice(0, 10);
    if (dateFrom && day < dateFrom) continue;
    if (dateTo   && day > dateTo)   continue;
    const amount = parseFloat(sr.total_amount || 0) || 0;
    const blob   = [day, 'return', sr.return_no, sr.po_invoice, sr.return_reference, sr.notes].map(v => String(v || '').toLowerCase()).join(' ');
    if (q && !blob.includes(q)) continue;
    const ledger = getOrCreate(sid);
    ledger.entries.push({
      date: day,
      type: 'Return',
      reference: sr.return_no || `SR#${sr.id}`,
      description: `Return · PO Invoice: ${sr.po_invoice || '—'} · ${sr.return_type === 'full' ? 'Full' : 'Partial'}`,
      debit: 0,
      credit: parseFloat((-amount).toFixed(3)),
      source: 'supplier_return',
      source_id: sr.id
    });
    ledger.total_returns += amount;
    ledger.total_credit -= amount;
  }

  // Sort entries within each ledger by date, compute running balance
  // Balance = Credit (owed) - Debit (paid/returned) = outstanding payable
  const result = [];
  for (const [, ledger] of ledgers) {
    ledger.entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let balance = 0;
    for (const e of ledger.entries) {
      balance += e.credit - e.debit;
      e.balance = parseFloat(balance.toFixed(3));
    }
    ledger.total_debit  = parseFloat(ledger.total_debit.toFixed(3));
    ledger.total_credit = parseFloat(ledger.total_credit.toFixed(3));
    ledger.total_returns = parseFloat(ledger.total_returns.toFixed(3));
    ledger.balance      = parseFloat((ledger.total_credit - ledger.total_debit).toFixed(3));
    result.push(ledger);
  }

  result.sort((a, b) => String(a.supplier_name).localeCompare(String(b.supplier_name)));

  res.json({
    suppliers: result,
    summary: {
      total_suppliers: result.length,
      total_debit:  parseFloat(result.reduce((s, l) => s + l.total_debit,  0).toFixed(3)),
      total_credit: parseFloat(result.reduce((s, l) => s + l.total_credit, 0).toFixed(3)),
      total_returns: parseFloat(result.reduce((s, l) => s + (l.total_returns || 0), 0).toFixed(3)),
      total_balance: parseFloat(result.reduce((s, l) => s + l.balance,     0).toFixed(3))
    },
    filters: {
      suppliers: (db.store_suppliers || []).map(s => ({ id: parseInt(s.id), name: s.name || '' }))
    }
  });
});

app.get('/api/reports/stock-movement', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  ensureStore(db);

  const dateFrom = String(req.query.date_from || req.query.date || today()).slice(0,10);
  const dateTo = String(req.query.date_to || req.query.date || dateFrom).slice(0,10);
  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const storeFilter = req.query.store_id ? parseInt(req.query.store_id) : null;
  const typeFilter = String(req.query.movement_type || '').trim().toLowerCase();
  const q = String(req.query.search || '').trim().toLowerCase();

  const productsById = new Map((db.store_products || []).map(p => [parseInt(p.id), p]));
  const storesById = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id), s]));
  const usersById = new Map((db.users || []).map(u => [parseInt(u.id), u]));
  const mainStore = (db.store_sub_stores || []).find(s => s.is_main) || (db.store_sub_stores || [])[0] || null;

  const rows = [];

  for (const po of (db.store_purchase_orders || [])) {
    if (String(po.status || '').toLowerCase() !== 'received') continue;
    const at = String(po.received_at || po.created_at || '');
    const day = at.slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    if (typeFilter && typeFilter !== 'purchase') continue;
    const sid = mainStore ? parseInt(mainStore.id) : null;
    if (storeFilter && sid !== storeFilter) continue;

    for (const item of (po.items || [])) {
      const pid = parseInt(item.product_id);
      const p = productsById.get(pid) || {};
      const qty = parseFloat(item.base_qty != null ? item.base_qty : item.qty || 0) || 0;
      const unitCost = parseFloat(item.cost_price || 0) || 0;
      const totalCost = parseFloat((qty * unitCost).toFixed(3));
      const storeName = mainStore ? (mainStore.name || 'Main Store') : 'Main Store';

      const blob = [
        day,
        'Purchase Receive',
        'IN',
        storeName,
        p.name,
        p.sku,
        `PO#${po.id}`,
        po.invoice_number,
        po.notes
      ].map(v => String(v || '').toLowerCase()).join(' ');
      if (q && !blob.includes(q)) continue;

      rows.push({
        at,
        date: day,
        movement_type: 'Purchase',
        direction: 'IN',
        store_id: sid,
        store_name: storeName,
        product_id: pid,
        product_name: p.name || `Product #${pid}`,
        product_sku: p.sku || '',
        qty: parseFloat(qty.toFixed(3)),
        unit: p.unit || '',
        unit_cost: parseFloat(unitCost.toFixed(3)),
        total_cost: totalCost,
        reference: `PO#${po.id}`,
        note: po.invoice_number ? `Invoice: ${po.invoice_number}` : ''
      });
    }
  }

  for (const t of (db.store_transfers || [])) {
    const at = String(t.created_at || '');
    const day = at.slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    if (typeFilter && typeFilter !== 'transfer') continue;

    const fromStore = storesById.get(parseInt(t.from_store_id)) || {};
    const toStore = storesById.get(parseInt(t.to_store_id)) || {};

    for (const item of (t.items || [])) {
      const pid = parseInt(item.product_id);
      const p = productsById.get(pid) || {};
      const qty = parseFloat(item.base_qty != null ? item.base_qty : item.qty || 0) || 0;
      const unitCost = parseFloat(item.unit_cost || 0) || 0;
      const totalCost = parseFloat((qty * unitCost).toFixed(3));

      const outStoreId = parseInt(t.from_store_id) || null;
      const inStoreId = parseInt(t.to_store_id) || null;

      if (!storeFilter || outStoreId === storeFilter) {
        const blobOut = [day, 'Transfer Out', 'OUT', fromStore.name, p.name, p.sku, `TR#${t.id}`, t.notes].map(v => String(v || '').toLowerCase()).join(' ');
        if (!q || blobOut.includes(q)) {
          rows.push({
            at,
            date: day,
            movement_type: 'Transfer',
            direction: 'OUT',
            store_id: outStoreId,
            store_name: fromStore.name || 'Unknown',
            product_id: pid,
            product_name: p.name || `Product #${pid}`,
            product_sku: p.sku || '',
            qty: parseFloat(qty.toFixed(3)),
            unit: p.unit || '',
            unit_cost: parseFloat(unitCost.toFixed(3)),
            total_cost: totalCost,
            reference: `TR#${t.id}`,
            note: `To ${toStore.name || 'Unknown'}`
          });
        }
      }

      if (!storeFilter || inStoreId === storeFilter) {
        const blobIn = [day, 'Transfer In', 'IN', toStore.name, p.name, p.sku, `TR#${t.id}`, t.notes].map(v => String(v || '').toLowerCase()).join(' ');
        if (!q || blobIn.includes(q)) {
          rows.push({
            at,
            date: day,
            movement_type: 'Transfer',
            direction: 'IN',
            store_id: inStoreId,
            store_name: toStore.name || 'Unknown',
            product_id: pid,
            product_name: p.name || `Product #${pid}`,
            product_sku: p.sku || '',
            qty: parseFloat(qty.toFixed(3)),
            unit: p.unit || '',
            unit_cost: parseFloat(unitCost.toFixed(3)),
            total_cost: totalCost,
            reference: `TR#${t.id}`,
            note: `From ${fromStore.name || 'Unknown'}`
          });
        }
      }
    }
  }

  for (const c of (db.store_service_consumptions || [])) {
    const at = String(c.at || c.date || '');
    const day = at.slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    if (typeFilter && typeFilter !== 'consumption') continue;

    const sid = parseInt(c.store_id || (mainStore ? mainStore.id : 0)) || null;
    if (storeFilter && sid !== storeFilter) continue;

    const pid = parseInt(c.product_id);
    const p = productsById.get(pid) || {};
    const qty = parseFloat(c.consumed_qty || 0) || 0;
    const unitCost = parseFloat(c.unit_cost || 0) || 0;
    const totalCost = parseFloat(c.total_cost != null ? c.total_cost : (qty * unitCost)) || 0;
    const svc = (db.services || []).find(s => s.id === parseInt(c.service_id)) || {};
    const store = storesById.get(sid) || {};

    const blob = [day, 'Service Consumption', 'OUT', store.name, p.name, p.sku, `BILL#${c.bill_id || ''}`, svc.name, c.visit_id].map(v => String(v || '').toLowerCase()).join(' ');
    if (q && !blob.includes(q)) continue;

    rows.push({
      at,
      date: day,
      movement_type: 'Consumption',
      direction: 'OUT',
      store_id: sid,
      store_name: store.name || 'Main Store',
      product_id: pid,
      product_name: p.name || `Product #${pid}`,
      product_sku: p.sku || '',
      qty: parseFloat(qty.toFixed(3)),
      unit: p.unit || '',
      unit_cost: parseFloat(unitCost.toFixed(3)),
      total_cost: parseFloat(totalCost.toFixed(3)),
      reference: c.bill_id ? `BILL#${c.bill_id}` : '—',
      note: svc.name ? `Service: ${svc.name}` : (c.visit_id ? `Visit: ${c.visit_id}` : '')
    });
  }

  for (const mc of (db.store_manual_consumptions || [])) {
    const at = String(mc.created_at || `${mc.date || ''} 00:00:00`);
    const day = String(mc.date || at).slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    if (typeFilter && !['consumption', 'manual-consumption'].includes(typeFilter)) continue;

    const sid = parseInt(mc.store_id || 0) || null;
    if (storeFilter && sid !== storeFilter) continue;
    const store = storesById.get(sid) || {};

    for (const item of (mc.items || [])) {
      const pid = parseInt(item.product_id);
      const p = productsById.get(pid) || {};
      const qty = parseFloat(item.qty || 0) || 0;
      const unitCost = parseFloat(item.cost || 0) || 0;
      const totalCost = parseFloat(item.total_cost != null ? item.total_cost : (qty * unitCost)) || 0;
      const reason = normalizeManualConsumptionReason(item.reason);

      const blob = [day, 'Manual Consumption', 'OUT', store.name, p.name, p.sku, `MC#${mc.id}`, reason, item.remarks, mc.remarks]
        .map(v => String(v || '').toLowerCase()).join(' ');
      if (q && !blob.includes(q)) continue;

      rows.push({
        at,
        date: day,
        movement_type: 'Manual Consumption',
        direction: 'OUT',
        store_id: sid,
        store_name: store.name || 'Unknown',
        product_id: pid,
        product_name: p.name || `Product #${pid}`,
        product_sku: p.sku || '',
        qty: parseFloat(qty.toFixed(3)),
        unit: p.unit || '',
        unit_cost: parseFloat(unitCost.toFixed(3)),
        total_cost: parseFloat(totalCost.toFixed(3)),
        reference: mc.entry_no || `MC#${mc.id}`,
        note: [reason, String(item.remarks || '').trim(), String(mc.remarks || '').trim()].filter(Boolean).join(' | ')
      });
    }
  }

  for (const adj of (db.store_adjustments || [])) {
    const at = String(adj.created_at || `${adj.date || ''} 00:00:00`);
    const day = String(adj.date || at).slice(0,10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    if (typeFilter && !['adjustment', 'adjustments'].includes(typeFilter)) continue;

    const sid = parseInt(adj.store_id || 0, 10) || null;
    if (storeFilter && sid !== storeFilter) continue;
    const store = storesById.get(sid) || {};

    const pid = parseInt(adj.product_id || 0, 10);
    const p = productsById.get(pid) || {};
    const direction = String(adj.adjustment_type || '').toUpperCase() === 'IN' ? 'IN' : 'OUT';
    const qty = parseFloat(adj.qty || 0) || 0;
    const unitCost = parseFloat(adj.unit_cost || 0) || 0;
    const totalCost = parseFloat(adj.total_cost != null ? adj.total_cost : (qty * unitCost)) || 0;

    const blob = [
      day,
      'Stock Adjustment',
      direction,
      store.name,
      p.name,
      p.sku,
      adj.adjustment_no || `ADJ#${adj.id || ''}`,
      adj.reason,
      adj.remarks,
      adj.reversal_of_id ? `Reversal of ADJ#${adj.reversal_of_id}` : '',
      adj.reversed_by_adjustment_id ? `Reversed by ADJ#${adj.reversed_by_adjustment_id}` : ''
    ].map(v => String(v || '').toLowerCase()).join(' ');
    if (q && !blob.includes(q)) continue;

    rows.push({
      at,
      date: day,
      movement_type: 'Adjustment',
      direction,
      store_id: sid,
      store_name: store.name || 'Unknown',
      product_id: pid,
      product_name: p.name || `Product #${pid}`,
      product_sku: p.sku || '',
      qty: parseFloat(qty.toFixed(3)),
      unit: p.unit || '',
      unit_cost: parseFloat(unitCost.toFixed(3)),
      total_cost: parseFloat(totalCost.toFixed(3)),
      reference: adj.adjustment_no || `ADJ#${adj.id}`,
      note: [adj.reason, String(adj.remarks || '').trim()].filter(Boolean).join(' | ')
    });
  }

  for (const sr of (db.store_supplier_returns || [])) {
    const at = String(sr.return_date ? `${sr.return_date} 00:00:00` : sr.created_at || '');
    const day = String(sr.return_date || at).slice(0, 10);
    if (!day) continue;
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    if (typeFilter && typeFilter !== 'supplier-return') continue;

    const sid = parseInt(sr.store_id || (mainStore ? mainStore.id : 0)) || null;
    if (storeFilter && sid !== storeFilter) continue;
    const store = storesById.get(sid) || {};

    for (const item of (sr.items || [])) {
      const pid = parseInt(item.product_id);
      const p = productsById.get(pid) || {};
      const qty = parseFloat(item.base_qty != null ? item.base_qty : item.qty || 0) || 0;
      const unitCost = parseFloat(item.cost_price || 0) || 0;
      const totalCost = parseFloat((qty * unitCost).toFixed(3));

      const blob = [day, 'Supplier Return', 'OUT', store.name, p.name, p.sku,
        sr.return_no, sr.return_reference, sr.supplier_name, sr.po_invoice, sr.notes
      ].map(v => String(v || '').toLowerCase()).join(' ');
      if (q && !blob.includes(q)) continue;

      rows.push({
        at,
        date: day,
        movement_type: 'Supplier Return',
        direction: 'OUT',
        store_id: sid,
        store_name: store.name || 'Main Store',
        product_id: pid,
        product_name: p.name || `Product #${pid}`,
        product_sku: p.sku || '',
        qty: parseFloat(qty.toFixed(3)),
        unit: p.unit || '',
        unit_cost: parseFloat(unitCost.toFixed(3)),
        total_cost: totalCost,
        reference: sr.return_no || `SR#${sr.id}`,
        note: [sr.supplier_name, sr.po_invoice ? `PO Invoice: ${sr.po_invoice}` : '', sr.return_reference ? `Ref: ${sr.return_reference}` : ''].filter(Boolean).join(' | ')
      });
    }
  }

  rows.sort((a, b) => {
    const ad = String(a.at || a.date || '');
    const bd = String(b.at || b.date || '');
    if (ad !== bd) return ad < bd ? 1 : -1;
    return String(a.reference || '').localeCompare(String(b.reference || ''));
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = rows.slice(start, start + limit);

  const summary = {
    date_from: dateFrom,
    date_to: dateTo,
    rows_count: total,
    total_in_qty: parseFloat(rows.filter(r => r.direction === 'IN').reduce((s, r) => s + (parseFloat(r.qty || 0) || 0), 0).toFixed(3)),
    total_out_qty: parseFloat(rows.filter(r => r.direction === 'OUT').reduce((s, r) => s + (parseFloat(r.qty || 0) || 0), 0).toFixed(3)),
    total_in_value: parseFloat(rows.filter(r => r.direction === 'IN').reduce((s, r) => s + (parseFloat(r.total_cost || 0) || 0), 0).toFixed(3)),
    total_out_value: parseFloat(rows.filter(r => r.direction === 'OUT').reduce((s, r) => s + (parseFloat(r.total_cost || 0) || 0), 0).toFixed(3))
  };

  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary,
    filters: {
      stores: (db.store_sub_stores || []).map(s => ({ id: parseInt(s.id), name: s.name || '' }))
    }
  });
});

app.get('/api/reports/stock-status', requireRole('admin','doctor','receptionist'), (req, res) => {
  const db = readDB();
  ensureStore(db);

  const safePage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const storeFilter = req.query.store_id ? parseInt(req.query.store_id) : null;
  const lowOnly = String(req.query.low_only || '').toLowerCase() === '1' || String(req.query.low_only || '').toLowerCase() === 'true';
  const q = String(req.query.search || '').trim().toLowerCase();

  const productsById = new Map((db.store_products || []).map(p => [parseInt(p.id), p]));
  const storesById = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id), s]));

  let rows = (db.store_stock || []).map(s => {
    const pid = parseInt(s.product_id);
    const sid = parseInt(s.store_id);
    const p = productsById.get(pid) || {};
    const st = storesById.get(sid) || {};
    const qty = parseFloat(s.qty || 0) || 0;
    const avgCost = parseFloat(s.avg_cost || p.cost_price || 0) || 0;
    const reorder = parseFloat(p.reorder_level || 0) || 0;
    const stockValue = parseFloat((qty * avgCost).toFixed(3));
    return {
      store_id: sid,
      store_name: st.name || 'Unknown',
      product_id: pid,
      product_name: p.name || `Product #${pid}`,
      product_sku: p.sku || '',
      category: p.category || '',
      unit: p.unit || '',
      qty: parseFloat(qty.toFixed(3)),
      reorder_level: parseFloat(reorder.toFixed(3)),
      avg_cost: parseFloat(avgCost.toFixed(3)),
      stock_value: stockValue,
      low_stock: qty <= reorder
    };
  });

  if (storeFilter) rows = rows.filter(r => r.store_id === storeFilter);
  if (lowOnly) rows = rows.filter(r => r.low_stock);
  if (q) {
    rows = rows.filter(r => [r.store_name, r.product_name, r.product_sku, r.category]
      .map(v => String(v || '').toLowerCase())
      .some(v => v.includes(q)));
  }

  rows.sort((a, b) => {
    if ((a.low_stock ? 1 : 0) !== (b.low_stock ? 1 : 0)) return (b.low_stock ? 1 : 0) - (a.low_stock ? 1 : 0);
    const sn = String(a.store_name || '').localeCompare(String(b.store_name || ''));
    if (sn !== 0) return sn;
    return String(a.product_name || '').localeCompare(String(b.product_name || ''));
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(safePage, pages);
  const start = (page - 1) * limit;
  const pagedRows = rows.slice(start, start + limit);

  const summary = {
    rows_count: total,
    low_stock_count: rows.filter(r => r.low_stock).length,
    total_qty: parseFloat(rows.reduce((s, r) => s + (parseFloat(r.qty || 0) || 0), 0).toFixed(3)),
    total_value: parseFloat(rows.reduce((s, r) => s + (parseFloat(r.stock_value || 0) || 0), 0).toFixed(3))
  };

  res.json({
    rows: pagedRows,
    page,
    pages,
    total,
    limit,
    summary,
    filters: {
      stores: (db.store_sub_stores || []).map(s => ({ id: parseInt(s.id), name: s.name || '' }))
    }
  });
});

app.get('/api/activity-logs', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB();
  const { date_from, date_to, module, action, search } = req.query;
  const patientById = new Map((db.patients || []).map(p => [p.id, p]));
  const userById = new Map((db.users || []).map(u => [u.id, u]));
  let list = [...(db.activity_logs || [])].map(l => {
    const pat = patientById.get(parseInt(l.patient_id)) || {};
    const usr = userById.get(parseInt(l.actor_id)) || {};
    return {
      ...l,
      patient_name: pat.name || '',
      patient_mr_number: pat.mr_number || '',
      actor_username: usr.username || ''
    };
  });
  if (req.session.user.role === 'doctor') {
    list = list.filter(l => l.actor_id === req.session.user.id);
  }
  if (date_from) list = list.filter(l => String(l.at || '').slice(0,10) >= date_from);
  if (date_to) list = list.filter(l => String(l.at || '').slice(0,10) <= date_to);
  if (module) list = list.filter(l => String(l.module || '').toLowerCase() === String(module).toLowerCase());
  if (action) list = list.filter(l => String(l.action || '').toLowerCase() === String(action).toLowerCase());
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(l => [l.actor_name, l.actor_username, l.actor_role, l.module, l.action, l.notes, l.visit_id, l.entity_type, l.entity_id, l.patient_id, l.patient_name, l.patient_mr_number, l.appointment_id, l.bill_id]
      .map(v => String(v || '').toLowerCase())
      .some(v => v.includes(q)));
  }
  list.sort((a,b) => String(b.at || '').localeCompare(String(a.at || '')));
  res.json(list);
});

app.get('/api/activity-logs/actions', requireRole('admin','receptionist','doctor'), (req, res) => {
  const db = readDB();
  let list = [...(db.activity_logs || [])];
  if (req.session.user.role === 'doctor') {
    list = list.filter(l => l.actor_id === req.session.user.id);
  }
  const actions = [...new Set(list.map(l => String(l.action || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  res.json(actions);
});

app.get('/api/reports/top-patients', requireRole('admin'), (req, res) => {
  const db=readDB();
  res.json(db.patients.map(p=>({ name:p.name, phone:p.phone, visits:db.appointments.filter(a=>a.patient_id===p.id).length })).sort((a,b)=>b.visits-a.visits).slice(0,10));
});

// WhatsApp Campaign API removed

// ===================== PAYMENT METHODS =====================
app.get('/api/service-categories', requireLogin, (req, res) => {
  const db = readDB();
  res.json(db.service_categories || []);
});
app.post('/api/service-categories', requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const db = readDB();
  if ((db.service_categories||[]).some(c => c.name.toLowerCase() === name.toLowerCase()))
    return res.status(400).json({ error:'Category already exists' });
  if (!db.service_categories) db.service_categories = [];
  const id = nextId(db, 'service_categories');
  const cat = { id, name, created_at: now() };
  db.service_categories.push(cat);
  writeDB(db); res.json(cat);
});
app.put('/api/service-categories/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = (db.service_categories||[]).findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const dup = db.service_categories.find((c,i) => i!==idx && c.name.toLowerCase()===name.toLowerCase());
  if (dup) return res.status(400).json({ error:'Category already exists' });
  db.service_categories[idx].name = name;
  writeDB(db); res.json(db.service_categories[idx]);
});
app.delete('/api/service-categories/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = (db.service_categories||[]).findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  db.service_categories.splice(idx, 1);
  writeDB(db); res.json({ success:true });
});

// ===================== EXPENSE CATEGORIES =====================
app.get('/api/expense-categories', requireLogin, (req, res) => {
  const db = readDB();
  res.json(db.expense_categories || []);
});
app.post('/api/expense-categories', requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const db = readDB();
  if ((db.expense_categories || []).some(c => String(c.name || '').toLowerCase() === String(name).toLowerCase())) {
    return res.status(400).json({ error:'Category already exists' });
  }
  if (!db.expense_categories) db.expense_categories = [];
  const id = nextId(db, 'expense_categories');
  const cat = { id, name, created_at: now() };
  db.expense_categories.push(cat);
  writeDB(db);
  res.json(cat);
});
app.put('/api/expense-categories/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = (db.expense_categories || []).findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const dup = (db.expense_categories || []).find((c, i) => i !== idx && String(c.name || '').toLowerCase() === String(name).toLowerCase());
  if (dup) return res.status(400).json({ error:'Category already exists' });
  const currentName = String(db.expense_categories[idx].name || '');
  db.expense_categories[idx].name = name;
  for (const expense of (db.expenses || [])) {
    if (String(expense.category || '') === currentName) expense.category = name;
  }
  writeDB(db);
  res.json(db.expense_categories[idx]);
});
app.delete('/api/expense-categories/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = (db.expense_categories || []).findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const categoryName = String(db.expense_categories[idx].name || '');
  const inUse = (db.expenses || []).some(expense => String(expense.category || '') === categoryName);
  if (inUse) return res.status(400).json({ error:'Cannot delete category already used in expenses' });
  db.expense_categories.splice(idx, 1);
  writeDB(db);
  res.json({ success:true });
});

// ===================== DOCTOR DEPARTMENTS =====================
app.get('/api/doctor-departments', requireLogin, (req, res) => {
  const db = readDB();
  if (!db.doctor_departments) db.doctor_departments = [];
  res.json(db.doctor_departments);
});
app.post('/api/doctor-departments', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.doctor_departments) db.doctor_departments = [];
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const exists = db.doctor_departments.find(d => String(d.name || '').toLowerCase() === String(name).toLowerCase());
  if (exists) return res.status(400).json({ error:'Department already exists' });
  const dep = { id: nextId(db, 'doctor_departments'), name, active: req.body.active !== false, created_at: now() };
  db.doctor_departments.push(dep);
  writeDB(db);
  res.json(dep);
});
app.put('/api/doctor-departments/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.doctor_departments) db.doctor_departments = [];
  const idx = db.doctor_departments.findIndex(d => d.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const cur = db.doctor_departments[idx];
  const { name, active } = req.body;
  if (name) {
    const dup = db.doctor_departments.find((d, i) => i !== idx && String(d.name || '').toLowerCase() === String(name).toLowerCase());
    if (dup) return res.status(400).json({ error:'Department already exists' });
    cur.name = name;
  }
  if (active !== undefined) cur.active = !!active;
  writeDB(db);
  res.json(cur);
});
app.delete('/api/doctor-departments/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.doctor_departments) db.doctor_departments = [];
  const id = parseInt(req.params.id);
  const idx = db.doctor_departments.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const hasDoctors = (db.users || []).some(u => u.role === 'doctor' && parseInt(u.department_id) === id);
  if (hasDoctors) return res.status(400).json({ error:'Cannot delete: doctors are assigned to this department' });
  db.doctor_departments.splice(idx, 1);
  writeDB(db);
  res.json({ success:true });
});

// ===================== PAYMENT METHODS =====================
app.get('/api/payment-methods', requireLogin, (req, res) => {
  const db = readDB(); res.json(db.payment_methods || []);
});
app.post('/api/payment-methods', requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const db = readDB();
  const id = nextId(db, 'payment_methods');
  const m = { id, name, active: req.body.active !== false, created_at: now() };
  db.payment_methods.push(m); writeDB(db); res.json(m);
});
app.put('/api/payment-methods/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = db.payment_methods.findIndex(m => m.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name, active } = req.body;
  db.payment_methods[idx] = { ...db.payment_methods[idx], name: name||db.payment_methods[idx].name, active: active !== undefined ? active : db.payment_methods[idx].active };
  writeDB(db); res.json(db.payment_methods[idx]);
});
app.delete('/api/payment-methods/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = db.payment_methods.findIndex(m => m.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  db.payment_methods.splice(idx, 1); writeDB(db); res.json({ success:true });
});

// ===================== EXPENSES =====================
app.get('/api/expenses', requirePermission('expenses.view'), (req, res) => {
  const db = readDB();
  if (!db.expenses) db.expenses = [];
  if (!db.expense_categories) db.expense_categories = [];

  const q = String(req.query.search || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const dateFrom = String(req.query.date_from || '').slice(0, 10);
  const dateTo = String(req.query.date_to || '').slice(0, 10);
  const usersById = new Map((db.users || []).map((u) => [parseInt(u.id, 10), u]));

  let rows = db.expenses.map((entry) => {
    const createdBy = usersById.get(parseInt(entry.created_by, 10)) || {};
    const updatedBy = usersById.get(parseInt(entry.updated_by, 10)) || {};
    return {
      ...entry,
      created_by_name: createdBy.name || createdBy.username || '—',
      updated_by_name: updatedBy.name || updatedBy.username || '—'
    };
  });

  if (dateFrom) rows = rows.filter((row) => String(row.expense_date || '').slice(0, 10) >= dateFrom);
  if (dateTo) rows = rows.filter((row) => String(row.expense_date || '').slice(0, 10) <= dateTo);
  if (category) rows = rows.filter((row) => String(row.category || '') === category);
  if (q) {
    rows = rows.filter((row) => [
      row.title,
      row.category,
      row.payment_method,
      row.vendor,
      row.notes,
      row.reference_no,
      row.created_by_name,
      row.updated_by_name
    ].map((v) => String(v || '').toLowerCase()).join(' ').includes(q));
  }

  rows.sort((a, b) => {
    const ad = `${String(a.expense_date || '')} ${String(a.created_at || '')}`;
    const bd = `${String(b.expense_date || '')} ${String(b.created_at || '')}`;
    return ad < bd ? 1 : -1;
  });

  const categories = (db.expense_categories || []).map((row) => String(row.name || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const totalAmount = rows.reduce((sum, row) => sum + (parseFloat(row.amount || 0) || 0), 0);
  const todayAmount = rows.filter((row) => String(row.expense_date || '').slice(0, 10) === today()).reduce((sum, row) => sum + (parseFloat(row.amount || 0) || 0), 0);

  res.json({
    rows,
    summary: {
      total_amount: parseFloat(totalAmount.toFixed(3)),
      today_amount: parseFloat(todayAmount.toFixed(3)),
      rows_count: rows.length,
      categories_count: categories.length
    },
    filters: {
      categories,
      payment_methods: (db.payment_methods || []).filter((m) => m.active !== false).map((m) => m.name)
    }
  });
});

app.post('/api/expenses', requirePermission('expenses.create'), (req, res) => {
  const db = readDB();
  if (!db.expenses) db.expenses = [];
  if (!db.expense_categories) db.expense_categories = [];

  const title = String(req.body.title || '').trim();
  const category = String(req.body.category || '').trim();
  const amount = parseFloat(req.body.amount || 0);
  const expenseDate = String(req.body.expense_date || today()).slice(0, 10);
  const paymentMethod = String(req.body.payment_method || '').trim();
  const vendor = String(req.body.vendor || '').trim();
  const referenceNo = String(req.body.reference_no || '').trim();
  const notes = String(req.body.notes || '').trim();
  const actorId = (req.session && req.session.user && req.session.user.id) || req.session.userId || null;

  if (!title) return res.status(400).json({ error:'Expense title is required' });
  if (!category) return res.status(400).json({ error:'Expense category is required' });
  if (!(db.expense_categories || []).some((item) => String(item.name || '') === category)) {
    return res.status(400).json({ error:'Select a valid expense category from setup master' });
  }
  if (!(amount > 0)) return res.status(400).json({ error:'Amount must be greater than 0' });

  const entry = {
    id: nextId(db, 'expenses'),
    title,
    category,
    amount: parseFloat(amount.toFixed(3)),
    expense_date: expenseDate,
    payment_method: paymentMethod,
    vendor,
    reference_no: referenceNo,
    notes,
    created_by: actorId,
    updated_by: actorId,
    created_at: now(),
    updated_at: now()
  };

  db.expenses.push(entry);
  logActivity(db, req, {
    module: 'finance',
    action: 'expense_created',
    entity_type: 'expense',
    entity_id: entry.id,
    notes: `Expense ${entry.title} recorded for KD ${entry.amount.toFixed(3)}`,
    meta: { category: entry.category, amount: entry.amount, expense_date: entry.expense_date }
  });
  writeDB(db);
  res.json(entry);
});

app.put('/api/expenses/:id', requirePermission('expenses.edit'), (req, res) => {
  const db = readDB();
  if (!db.expenses) db.expenses = [];
  if (!db.expense_categories) db.expense_categories = [];
  const idx = db.expenses.findIndex((row) => parseInt(row.id, 10) === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error:'Expense not found' });

  const current = db.expenses[idx];
  const title = String(req.body.title !== undefined ? req.body.title : current.title).trim();
  const category = String(req.body.category !== undefined ? req.body.category : current.category).trim();
  const amount = parseFloat(req.body.amount !== undefined ? req.body.amount : current.amount);
  const expenseDate = String(req.body.expense_date !== undefined ? req.body.expense_date : current.expense_date).slice(0, 10);
  const paymentMethod = String(req.body.payment_method !== undefined ? req.body.payment_method : current.payment_method || '').trim();
  const vendor = String(req.body.vendor !== undefined ? req.body.vendor : current.vendor || '').trim();
  const referenceNo = String(req.body.reference_no !== undefined ? req.body.reference_no : current.reference_no || '').trim();
  const notes = String(req.body.notes !== undefined ? req.body.notes : current.notes || '').trim();

  if (!title) return res.status(400).json({ error:'Expense title is required' });
  if (!category) return res.status(400).json({ error:'Expense category is required' });
  if (!(db.expense_categories || []).some((item) => String(item.name || '') === category)) {
    return res.status(400).json({ error:'Select a valid expense category from setup master' });
  }
  if (!(amount > 0)) return res.status(400).json({ error:'Amount must be greater than 0' });

  db.expenses[idx] = {
    ...current,
    title,
    category,
    amount: parseFloat(amount.toFixed(3)),
    expense_date: expenseDate,
    payment_method: paymentMethod,
    vendor,
    reference_no: referenceNo,
    notes,
    updated_by: (req.session && req.session.user && req.session.user.id) || req.session.userId || null,
    updated_at: now()
  };
  logActivity(db, req, {
    module: 'finance',
    action: 'expense_updated',
    entity_type: 'expense',
    entity_id: db.expenses[idx].id,
    notes: `Expense ${db.expenses[idx].title} updated`,
    meta: { category: db.expenses[idx].category, amount: db.expenses[idx].amount, expense_date: db.expenses[idx].expense_date }
  });
  writeDB(db);
  res.json(db.expenses[idx]);
});

app.delete('/api/expenses/:id', requirePermission('expenses.delete'), (req, res) => {
  const db = readDB();
  if (!db.expenses) db.expenses = [];
  const idx = db.expenses.findIndex((row) => parseInt(row.id, 10) === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error:'Expense not found' });
  const removed = db.expenses[idx];
  db.expenses.splice(idx, 1);
  logActivity(db, req, {
    module: 'finance',
    action: 'expense_deleted',
    entity_type: 'expense',
    entity_id: removed.id,
    notes: `Expense ${removed.title} deleted`,
    meta: { category: removed.category, amount: removed.amount, expense_date: removed.expense_date }
  });
  writeDB(db);
  res.json({ success:true });
});

// ===================== STORE PRODUCT CATEGORIES =====================
app.get('/api/store/product-categories', requireLogin, (req, res) => {
  const db = readDB();
  if (!db.store_product_categories) db.store_product_categories = [];
  res.json(db.store_product_categories);
});
app.post('/api/store/product-categories', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.store_product_categories) db.store_product_categories = [];
  const { name } = req.body;
  if (!name) return res.status(400).json({ error:'name required' });
  const dup = db.store_product_categories.find(c => c.name.toLowerCase() === String(name).toLowerCase());
  if (dup) return res.status(400).json({ error:'Category already exists' });
  const cat = { id: nextId(db, 'store_product_categories'), name, active: req.body.active !== false, created_at: now() };
  db.store_product_categories.push(cat);
  writeDB(db);
  res.json(cat);
});
app.put('/api/store/product-categories/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.store_product_categories) db.store_product_categories = [];
  const idx = db.store_product_categories.findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const cur = db.store_product_categories[idx];
  const { name, active } = req.body;
  if (name !== undefined) {
    const dup = db.store_product_categories.find((c, i) => i !== idx && c.name.toLowerCase() === String(name).toLowerCase());
    if (dup) return res.status(400).json({ error:'Category already exists' });
    cur.name = name;
  }
  if (active !== undefined) cur.active = active;
  writeDB(db);
  res.json(cur);
});
app.delete('/api/store/product-categories/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.store_product_categories) db.store_product_categories = [];
  const id = parseInt(req.params.id);
  const idx = db.store_product_categories.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const catName = db.store_product_categories[idx].name;
  const inUse = (db.store_products || []).some(p => String(p.category || '').toLowerCase() === String(catName).toLowerCase());
  if (inUse) return res.status(400).json({ error:'Category is in use by products' });
  db.store_product_categories.splice(idx, 1);
  writeDB(db);
  res.json({ success:true });
});

// ===================== UOM MASTER =====================
app.get('/api/uoms', requireLogin, (req, res) => {
  const db = readDB();
  if (!db.uoms) db.uoms = [];
  res.json(db.uoms);
});
app.post('/api/uoms', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.uoms) db.uoms = [];
  const { name, symbol, factor } = req.body;
  if (!name || !symbol) return res.status(400).json({ error:'name and symbol required' });
  const f = parseFloat(factor || 1);
  if (!(f > 0)) return res.status(400).json({ error:'factor must be > 0' });
  const dup = db.uoms.find(u => u.symbol.toLowerCase() === String(symbol).toLowerCase());
  if (dup) return res.status(400).json({ error:'UOM symbol already exists' });
  const uom = { id: nextId(db, 'uoms'), name, symbol, factor: f, active: req.body.active !== false, created_at: now() };
  db.uoms.push(uom);
  writeDB(db);
  res.json(uom);
});
app.put('/api/uoms/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.uoms) db.uoms = [];
  const idx = db.uoms.findIndex(u => u.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const cur = db.uoms[idx];
  const { name, symbol, factor, active } = req.body;
  if (symbol) {
    const dup = db.uoms.find((u, i) => i !== idx && u.symbol.toLowerCase() === String(symbol).toLowerCase());
    if (dup) return res.status(400).json({ error:'UOM symbol already exists' });
  }
  if (factor !== undefined) {
    const f = parseFloat(factor);
    if (!(f > 0)) return res.status(400).json({ error:'factor must be > 0' });
    cur.factor = f;
  }
  if (name !== undefined) cur.name = name;
  if (symbol !== undefined) cur.symbol = symbol;
  if (active !== undefined) cur.active = active;
  writeDB(db);
  res.json(cur);
});
app.delete('/api/uoms/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.uoms) db.uoms = [];
  const id = parseInt(req.params.id);
  const idx = db.uoms.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const inUse = (db.store_products || []).some(p => parseInt(p.uom_id) === id);
  if (inUse) return res.status(400).json({ error:'UOM is in use by products' });
  db.uoms.splice(idx, 1);
  writeDB(db);
  res.json({ success:true });
});

// ===================== SERVICES =====================
app.get('/api/services', requireLogin, (req, res) => {
  const db = readDB();
  res.json(db.services || []);
});
app.post('/api/services', requireRole('admin'), (req, res) => {
  const { name, category, description, price, duration_min } = req.body;
  if (!name || !price) return res.status(400).json({ error:'name and price are required' });
  const db = readDB();
  const id = nextId(db, 'services');
  const svc = { id, name, category:category||'Other', description:description||'', price:parseFloat(price)||0, duration_min:parseInt(duration_min)||0, active:true, created_at:now() };
  db.services.push(svc);
  writeDB(db); res.json(svc);
});
app.put('/api/services/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = db.services.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name, category, description, price, duration_min, active } = req.body;
  db.services[idx] = { ...db.services[idx], name:name||db.services[idx].name, category:category||db.services[idx].category, description:description!==undefined?description:db.services[idx].description, price:parseFloat(price)||db.services[idx].price, duration_min:parseInt(duration_min)||db.services[idx].duration_min, active:active!==undefined?active:db.services[idx].active };
  writeDB(db); res.json(db.services[idx]);
});
app.delete('/api/services/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = db.services.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  db.services.splice(idx, 1);
  writeDB(db); res.json({ success:true });
});

app.get('/api/services/export', requirePermission('services.export'), (req, res) => {
  const db = readDB();
  const q = String(req.query.search || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  let list = [...(db.services || [])];
  if (q) list = list.filter(s => String(s.name || '').toLowerCase().includes(q) || String(s.description || '').toLowerCase().includes(q));
  if (category) list = list.filter(s => String(s.category || '') === category);

  const headers = ['name', 'category', 'description', 'price', 'duration_min', 'active'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const s of list) {
    lines.push([
      s.name || '',
      s.category || 'Other',
      s.description || '',
      parseFloat(s.price || 0).toFixed(3),
      parseInt(s.duration_min || 0, 10) || 0,
      s.active === false ? '0' : '1'
    ].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="services_${today()}.csv"`);
  res.send(lines.join('\n'));
});

app.get('/api/services/import-template', requirePermission('services.import'), (_req, res) => {
  const headers = ['name', 'category', 'description', 'price', 'duration_min', 'active'];
  const sample = ['General Consultation', 'Consultation', 'Standard doctor consultation', '300.000', '20', '1'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, sample].map(r => r.map(esc).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="service_import_template.csv"');
  res.send(csv);
});

app.post('/api/services/import', requirePermission('services.import'), (req, res) => {
  try {
    const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error:'No rows provided' });

    const db = readDB();
    if (!Array.isArray(db.services)) db.services = [];
    let created = 0;
    const skipped = [];
    const errors = [];
    const usedNames = new Set((db.services || []).map(s => String(s.name || '').trim().toLowerCase()).filter(Boolean));

    const norm = (v) => String(v || '').trim();
    const normCategory = (v) => {
      const c = norm(v);
      return c || 'Other';
    };
    const toActive = (v) => {
      const n = norm(v).toLowerCase();
      if (!n) return true;
      if (['0', 'false', 'no', 'n', 'inactive'].includes(n)) return false;
      return true;
    };

    rows.forEach((row, idx) => {
      const line = idx + 2;
      const name = norm(row.name);
      const price = parseFloat(row.price);
      const duration = parseInt(row.duration_min || 0, 10) || 0;
      const category = normCategory(row.category);
      const description = norm(row.description);
      const active = toActive(row.active);

      if (!name) {
        errors.push(`Line ${line}: service name is required`);
        return;
      }
      if (!(price > 0)) {
        errors.push(`Line ${line}: price must be greater than 0`);
        return;
      }

      const key = name.toLowerCase();
      if (usedNames.has(key)) {
        skipped.push(`Line ${line}: service already exists`);
        return;
      }

      const id = nextId(db, 'services');
      db.services.push({
        id,
        name,
        category,
        description,
        price: parseFloat(price.toFixed(3)),
        duration_min: Math.max(0, duration),
        active,
        created_at: now()
      });
      usedNames.add(key);
      created += 1;
    });

    writeDB(db);
    res.json({ created, skipped, errors });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Import failed' });
  }
});

// ===================== PACKAGES =====================
app.get('/api/packages', requireLogin, (req, res) => {
  const db = readDB();
  const svcs = db.services || [];
  const list = (db.packages || []).map(pkg => {
    // Support legacy `service_ids` (array of ids) and new `services` (array of {service_id, total})
    let linked = [];
    if (Array.isArray(pkg.services) && pkg.services.length) {
      linked = pkg.services.map(it => {
        const svc = svcs.find(s=>s.id===parseInt(it.service_id));
        return svc ? { service_id: svc.id, name: svc.name, price: svc.price, total: parseInt(it.total)||1 } : null;
      }).filter(Boolean);
    } else {
      linked = (pkg.service_ids||[]).map(sid => {
        const svc = svcs.find(s=>s.id===sid);
        return svc ? { service_id: svc.id, name: svc.name, price: svc.price, total: 1 } : null;
      }).filter(Boolean);
    }
    const total_price = linked.reduce((s,v)=>s + (v.price * (v.total||1)), 0);
    return { ...pkg, services: linked, total_price };
  });
  res.json(list);
});
app.post('/api/packages', requireRole('admin'), (req, res) => {
  const { name, description, service_ids, services, discount_price } = req.body;
  if (!name) return res.status(400).json({ error:'name is required' });
  const db = readDB();
  const id = nextId(db, 'packages');
  const pkg = { id, name, description:description||'', discount_price:parseFloat(discount_price)||0, active:true, created_at:now() };
  // Normalize incoming service specification: prefer `services` (with quantities), fall back to `service_ids`
  if (Array.isArray(services) && services.length) {
    pkg.services = services.map(it => ({ service_id: parseInt(it.service_id), total: parseInt(it.total)||1 }));
  } else {
    pkg.service_ids = Array.isArray(service_ids) ? service_ids.map(Number) : [];
  }
  db.packages.push(pkg);
  writeDB(db); res.json(pkg);
});
app.put('/api/packages/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = db.packages.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name, description, service_ids, services, discount_price, active } = req.body;
  const pkg = db.packages[idx];
  const oldName = pkg.name;
  const updated = { ...pkg, name:name||pkg.name, description:description!==undefined?description:pkg.description, discount_price:parseFloat(discount_price)||pkg.discount_price, active:active!==undefined?active:pkg.active };
  if (Array.isArray(services) && services.length) {
    updated.services = services.map(it => ({ service_id: parseInt(it.service_id), total: parseInt(it.total)||1 }));
    // remove old service_ids for clarity
    delete updated.service_ids;
  } else if (Array.isArray(service_ids)) {
    updated.service_ids = service_ids.map(Number);
    delete updated.services;
  }
  db.packages[idx] = updated;
  if (String(oldName || '').trim() !== String(updated.name || '').trim()) {
    logActivity(db, req, {
      module: 'package',
      action: 'package_renamed',
      entity_type: 'package',
      entity_id: updated.id,
      notes: `Package renamed: ${oldName || 'Unknown'} -> ${updated.name || 'Unknown'}`
    });
  }
  writeDB(db); res.json(db.packages[idx]);
});
app.delete('/api/packages/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = db.packages.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  db.packages.splice(idx, 1);
  writeDB(db); res.json({ success:true });
});

// ===================== PATIENT PACKAGES (subscriptions) =====================
app.get('/api/patient-packages', requireLogin, (req, res) => {
  const db = readDB();
  if (!db.patient_packages) db.patient_packages = [];
  let list = db.patient_packages;
  if (req.query.patient_id) list = list.filter(p => p.patient_id === parseInt(req.query.patient_id));
  if (req.query.status) list = list.filter(p => p.status === req.query.status);
  const patients = db.patients || [];
  list = list.map(pp => {
    const pt = patients.find(p => p.id === pp.patient_id) || {};
    return { ...pp, patient_name: pt.name || '', mr_number: pt.mr_number || '' };
  });
  res.json(list);
});
app.get('/api/patient-packages/:id', requireLogin, (req, res) => {
  const db = readDB();
  if (!db.patient_packages) return res.status(404).json({ error:'Not found' });
  const pp = db.patient_packages.find(p => p.id === parseInt(req.params.id));
  if (!pp) return res.status(404).json({ error:'Not found' });
  const patient = (db.patients||[]).find(p => p.id === pp.patient_id);
  res.json({
    ...pp,
    patient_name: patient ? patient.name : '',
    mr_number: patient ? (patient.mr_number || '') : ''
  });
});
app.delete('/api/patient-packages/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.patient_packages) return res.status(404).json({ error:'Not found' });
  const idx = db.patient_packages.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  db.patient_packages.splice(idx, 1);
  writeDB(db); res.json({ success: true });
});

// ===================== STORE MODULE =====================

// Helper: ensure store collections exist
function ensureStore(db) {
  db.store_products        = db.store_products        || [];
  db.store_suppliers       = db.store_suppliers       || [];
  db.store_sub_stores      = db.store_sub_stores      || [];
  db.store_stock           = db.store_stock           || [];
  db.store_purchase_orders = db.store_purchase_orders || [];
  db.store_supplier_invoice_payments = db.store_supplier_invoice_payments || [];
  db.store_transfers       = db.store_transfers       || [];
  db.store_adjustments     = db.store_adjustments     || [];
  db.store_service_products= db.store_service_products|| [];
  db.store_service_consumptions = db.store_service_consumptions || [];
  db.store_manual_consumptions = db.store_manual_consumptions || [];
  db.store_supplier_returns = db.store_supplier_returns || [];
  db.expenses              = db.expenses              || [];
  db.expense_categories    = db.expense_categories    || [];
  db.uoms                  = db.uoms                  || [];
  db.store_product_categories = db.store_product_categories || [];
  db.store_product_uoms    = db.store_product_uoms    || [];
  for (const s of (db.store_stock || [])) {
    if (s.avg_cost === undefined || isNaN(parseFloat(s.avg_cost))) {
      const p = (db.store_products || []).find(x => x.id === parseInt(s.product_id)) || {};
      s.avg_cost = parseFloat(p.cost_price || 0) || 0;
    }
  }
  // ensure main store exists
  if (!db.store_sub_stores.find(s => s.is_main)) {
    db.store_sub_stores.unshift({ id: nextId(db,'store_sub_stores'), name:'Main Store', code:'MAIN', is_main:true, active:true, created_at:now() });
    writeDB(db);
  }
}

// Stock helper: get or create stock record
function getStock(db, productId, storeId) {
  let s = db.store_stock.find(x => x.product_id===productId && x.store_id===storeId);
  if (!s) {
    const p = (db.store_products || []).find(x => x.id === parseInt(productId)) || {};
    s = { id:nextId(db,'store_stock'), product_id:productId, store_id:storeId, qty:0, avg_cost:parseFloat(p.cost_price || 0) || 0 };
    db.store_stock.push(s);
  }
  if (s.avg_cost === undefined || isNaN(parseFloat(s.avg_cost))) {
    const p = (db.store_products || []).find(x => x.id === parseInt(productId)) || {};
    s.avg_cost = parseFloat(p.cost_price || 0) || 0;
  }
  return s;
}

function computeWac(currentQty, currentAvgCost, incomingQty, incomingUnitCost) {
  const cq = parseFloat(currentQty || 0) || 0;
  const cc = parseFloat(currentAvgCost || 0) || 0;
  const iq = parseFloat(incomingQty || 0) || 0;
  const ic = parseFloat(incomingUnitCost || 0) || 0;
  const totalQty = cq + iq;
  if (!(totalQty > 0)) return cc;
  const totalCost = (cq * cc) + (iq * ic);
  return parseFloat((totalCost / totalQty).toFixed(6));
}

function getProductExpiryInfo(db, productId, storeId = null) {
  const pid = parseInt(productId);
  const sid = storeId == null ? null : parseInt(storeId);
  const expiryDates = [];
  let missingExpiryCount = 0;
  for (const po of (db.store_purchase_orders || [])) {
    if (String(po.status || '').toLowerCase() !== 'received') continue;
    if (sid !== null && parseInt(po.received_store_id || 0) !== sid) continue;
    for (const item of (po.items || [])) {
      if (parseInt(item.product_id) !== pid) continue;
      const expiryDate = String(item.expiry_date || item.expiry || item.exp_date || '').slice(0,10);
      if (expiryDate) expiryDates.push(expiryDate);
      else missingExpiryCount += 1;
    }
  }
  const uniqueDates = [...new Set(expiryDates)].sort();
  return {
    next_expiry: uniqueDates[0] || '',
    expiry_dates: uniqueDates,
    expiry_count: uniqueDates.length,
    missing_expiry_count: missingExpiryCount
  };
}

// ── Sub-stores ──────────────────────────────────────────
app.get('/api/store/sub-stores', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  res.json(filterStoresForUser(db, req, db.store_sub_stores));
});
app.post('/api/store/sub-stores', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const { name, code } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  const s = { id:nextId(db,'store_sub_stores'), name, code:code||'', is_main:false, active:true, created_at:now() };
  db.store_sub_stores.push(s); writeDB(db); res.json(s);
});
app.put('/api/store/sub-stores/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const s = db.store_sub_stores.find(x => x.id===parseInt(req.params.id));
  if (!s) return res.status(404).json({ error:'Not found' });
  const { name, code, active } = req.body;
  if (name !== undefined) s.name = name;
  if (code !== undefined) s.code = code;
  if (active !== undefined) s.active = active;
  writeDB(db); res.json(s);
});
app.delete('/api/store/sub-stores/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const s = db.store_sub_stores.find(x => x.id===parseInt(req.params.id));
  if (!s) return res.status(404).json({ error:'Not found' });
  if (s.is_main) return res.status(400).json({ error:'Cannot delete main store' });
  db.store_sub_stores = db.store_sub_stores.filter(x => x.id !== s.id);
  writeDB(db); res.json({ success:true });
});

// ── Suppliers ───────────────────────────────────────────
app.get('/api/store/suppliers', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db); res.json(db.store_suppliers);
});
app.post('/api/store/suppliers', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const { name, contact_name, phone, email, address, notes } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  const s = { id:nextId(db,'store_suppliers'), name, contact_name:contact_name||'', phone:phone||'', email:email||'', address:address||'', notes:notes||'', active:true, created_at:now() };
  db.store_suppliers.push(s); writeDB(db); res.json(s);
});
app.put('/api/store/suppliers/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const s = db.store_suppliers.find(x => x.id===parseInt(req.params.id));
  if (!s) return res.status(404).json({ error:'Not found' });
  Object.assign(s, req.body); writeDB(db); res.json(s);
});
app.delete('/api/store/suppliers/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  db.store_suppliers = db.store_suppliers.filter(x => x.id!==parseInt(req.params.id));
  writeDB(db); res.json({ success:true });
});

// ── Products ────────────────────────────────────────────
app.get('/api/store/products', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  const isManualConsumptionContext = String(req.query.context || '') === 'manual-consumption';
  const includeCostPrice = !isManualConsumptionContext || hasPermission(db, req.session.user.role, 'store.consume.cost');
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  const products = db.store_products.map(p => {
    const totalStock = db.store_stock
      .filter((s) => s.product_id === p.id && (!allowedStoreIds || allowedStoreIds.has(parseInt(s.store_id, 10))))
      .reduce((t, s) => t + s.qty, 0);
    const uom = getUomById(db, p.uom_id);
    const expiryInfo = getProductExpiryInfo(db, p.id);
    return { ...p, cost_price: includeCostPrice ? p.cost_price : undefined, total_stock: totalStock, uom_symbol: uom ? uom.symbol : (p.unit || ''), uom_name: uom ? uom.name : (p.unit || ''), uom_options: getProductUomOptions(db, p), ...expiryInfo };
  });
  res.json(products);
});
app.post('/api/store/products', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const { name, sku, unit, uom_id, category, cost_price, sell_price, reorder_level, description, uom_conversions } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  if (!category) return res.status(400).json({ error:'Category required' });
  const validCategories = (db.store_product_categories || []).filter(c => c.active !== false).map(c => String(c.name).toLowerCase());
  if (!validCategories.includes(String(category).toLowerCase())) return res.status(400).json({ error:'Invalid product category' });
  const pickedUom = getUomById(db, uom_id);
  const p = { id:nextId(db,'store_products'), name, sku:sku||'', uom_id: pickedUom ? pickedUom.id : null, unit:(pickedUom ? pickedUom.symbol : (unit||'pcs')), category:category||'', cost_price:parseFloat(cost_price||0), sell_price:parseFloat(sell_price||0), reorder_level:parseFloat(reorder_level||0), description:description||'', active:true, created_at:now() };
  db.store_products.push(p);
  if (Array.isArray(uom_conversions)) {
    const seen = new Set();
    for (const c of uom_conversions) {
      const uid = parseInt(c.uom_id);
      const factor = parseFloat(c.factor || 0);
      if (!uid || !(factor > 0) || uid === p.uom_id || seen.has(uid)) continue;
      const u = getUomById(db, uid);
      if (!u || u.active === false) continue;
      db.store_product_uoms.push({ product_id: p.id, uom_id: uid, factor: parseFloat(factor.toFixed(3)), created_at: now() });
      seen.add(uid);
    }
  }
  writeDB(db);
  res.json(p);
});
app.put('/api/store/products/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const p = db.store_products.find(x => x.id===parseInt(req.params.id));
  if (!p) return res.status(404).json({ error:'Not found' });
  const { name, sku, unit, uom_id, category, cost_price, sell_price, reorder_level, description, active, uom_conversions } = req.body;
  if (name!==undefined) p.name=name; if (sku!==undefined) p.sku=sku; if (unit!==undefined) p.unit=unit;
  if (uom_id !== undefined) {
    const pickedUom = getUomById(db, uom_id);
    p.uom_id = pickedUom ? pickedUom.id : null;
    if (pickedUom) p.unit = pickedUom.symbol;
  }
  if (category!==undefined) {
    const validCategories = (db.store_product_categories || []).filter(c => c.active !== false).map(c => String(c.name).toLowerCase());
    if (!validCategories.includes(String(category).toLowerCase())) return res.status(400).json({ error:'Invalid product category' });
    p.category=category;
  }
  if (cost_price!==undefined) p.cost_price=parseFloat(cost_price);
  if (sell_price!==undefined) p.sell_price=parseFloat(sell_price); if (reorder_level!==undefined) p.reorder_level=parseFloat(reorder_level);
  if (description!==undefined) p.description=description; if (active!==undefined) p.active=active;
  if (Array.isArray(uom_conversions)) {
    db.store_product_uoms = (db.store_product_uoms || []).filter(x => x.product_id !== p.id);
    const seen = new Set();
    for (const c of uom_conversions) {
      const uid = parseInt(c.uom_id);
      const factor = parseFloat(c.factor || 0);
      if (!uid || !(factor > 0) || uid === p.uom_id || seen.has(uid)) continue;
      const u = getUomById(db, uid);
      if (!u || u.active === false) continue;
      db.store_product_uoms.push({ product_id: p.id, uom_id: uid, factor: parseFloat(factor.toFixed(3)), created_at: now() });
      seen.add(uid);
    }
  }
  writeDB(db); res.json(p);
});
app.delete('/api/store/products/:id', requireRole('admin'), (req,res) => {
  return res.status(403).json({ error:'Product master deletion is locked. Edit the product or mark it inactive instead.' });
});

// ── Stock levels ────────────────────────────────────────
app.get('/api/store/stock', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  const { store_id } = req.query;
  const includeAvgCost = String(req.query.context || '') !== 'manual-consumption'
    || hasPermission(db, req.session.user.role, 'store.consume.cost');
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  if (store_id && !assertStoreAccess(db, req, store_id)) return res.status(403).json({ error:'Store access denied' });
  let stock = db.store_stock;
  if (allowedStoreIds) stock = stock.filter((s) => allowedStoreIds.has(parseInt(s.store_id, 10)));
  if (store_id) stock = stock.filter(s => s.store_id===parseInt(store_id));
  const enriched = stock.map(s => {
    const product = db.store_products.find(p => p.id===s.product_id) || {};
    const store   = db.store_sub_stores.find(st => st.id===s.store_id) || {};
    const uom = getUomById(db, product.uom_id);
    const expiryInfo = getProductExpiryInfo(db, s.product_id, s.store_id);
    return { ...s, avg_cost: includeAvgCost ? (parseFloat(s.avg_cost || 0) || 0) : undefined, product_name:product.name, product_unit:(uom ? uom.symbol : product.unit), product_sku:product.sku, reorder_level:product.reorder_level||0, store_name:store.name, ...expiryInfo };
  });
  res.json(enriched);
});

// ── Purchase Orders ─────────────────────────────────────
app.get('/api/store/purchase-orders', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  const paidByPo = new Map();
  for (const p of (db.store_supplier_invoice_payments || [])) {
    const pid = parseInt(p.po_id, 10);
    if (!pid) continue;
    paidByPo.set(pid, (paidByPo.get(pid) || 0) + (parseFloat(p.amount || 0) || 0));
  }
  const orders = db.store_purchase_orders.filter((order) => {
    if (!allowedStoreIds) return true;
    const receivedStoreId = parseInt(order.received_store_id, 10);
    if (!receivedStoreId) return true;
    return allowedStoreIds.has(receivedStoreId);
  }).map(o => {
    const supplier = db.store_suppliers.find(s=>s.id===o.supplier_id)||{};
    const receivedStore = db.store_sub_stores.find(st => st.id === parseInt(o.received_store_id)) || {};
    const totalAmount = parseFloat(o.total_cost || 0) || 0;
    const paidAmount = parseFloat((paidByPo.get(parseInt(o.id, 10)) || 0).toFixed(3));
    const dueAmount = parseFloat(Math.max(0, totalAmount - paidAmount).toFixed(3));
    const paymentStatus = dueAmount <= 0.0005 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid');
    return {
      ...o,
      supplier_name: supplier.name||'—',
      received_store_name: receivedStore.name || '',
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_status: paymentStatus
    };
  });
  res.json(orders.sort((a,b)=>b.id-a.id));
});
app.get('/api/store/purchase-orders/:id', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  const o = db.store_purchase_orders.find(x=>x.id===parseInt(req.params.id));
  if (!o) return res.status(404).json({ error:'Not found' });
  if (o.received_store_id && !assertStoreAccess(db, req, o.received_store_id)) return res.status(403).json({ error:'Store access denied' });
  const supplier = db.store_suppliers.find(s=>s.id===o.supplier_id)||{};
  const receivedStore = db.store_sub_stores.find(st => st.id === parseInt(o.received_store_id)) || {};
  const items = (o.items||[]).map(i => {
    const product = db.store_products.find(p=>p.id===i.product_id)||{};
    const uom = getUomById(db, i.uom_id) || getUomById(db, product.uom_id);
    return { ...i, product_name:product.name, product_unit:product.unit, uom_symbol: uom ? uom.symbol : product.unit };
  });
  res.json({ ...o, supplier_name:supplier.name||'—', received_store_name: receivedStore.name || '', items });
});
app.post('/api/store/purchase-orders', requireRole('admin','receptionist'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const { supplier_id, items, notes, order_date, invoice_number } = req.body;
  if (!supplier_id || !items || !items.length) return res.status(400).json({ error:'Supplier and items required' });
  const missingExpiry = (items || []).some(i => !String(i.expiry_date || '').slice(0,10));
  if (missingExpiry) return res.status(400).json({ error:'Expiry date is required for every product' });
  const mappedItems = items.map(i => {
    const qty = parseFloat(i.qty || 0);
    const cost = parseFloat(i.cost_price || 0);
    const factor = resolveLineFactor(db, i.product_id, i.uom_id, i.factor || 1);
    const baseQty = qty * factor;
    const lineTotal = parseFloat((qty * cost).toFixed(3));
    const expiryDate = String(i.expiry_date || '').slice(0,10);
    return {
      product_id: parseInt(i.product_id),
      qty,
      uom_id: i.uom_id ? parseInt(i.uom_id) : null,
      factor,
      base_qty: parseFloat(baseQty.toFixed(3)),
      expiry_date: expiryDate,
      cost_price: cost,
      line_total: lineTotal
    };
  });
  const total = mappedItems.reduce((t,i)=>t+(parseFloat(i.line_total || 0) || (i.cost_price * i.qty)),0);
  const o = {
    id:nextId(db,'store_purchase_orders'),
    supplier_id:parseInt(supplier_id),
    items: mappedItems,
    total_cost:parseFloat(total.toFixed(3)),
    status:'Pending',
    invoice_number:String(invoice_number || '').trim(),
    notes:notes||'',
    order_date:order_date||today(),
    created_at:now()
  };
  db.store_purchase_orders.push(o); writeDB(db); res.json(o);
});
app.put('/api/store/purchase-orders/:id/expiry', requireRole('admin','receptionist'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const o = db.store_purchase_orders.find(x=>x.id===parseInt(req.params.id));
  if (!o) return res.status(404).json({ error:'Not found' });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length || items.length !== (o.items || []).length) return res.status(400).json({ error:'Expiry details are incomplete' });
  const normalized = items.map(i => String(i.expiry_date || '').slice(0,10));
  if (normalized.some(v => !v)) return res.status(400).json({ error:'Expiry date is required for every product' });
  (o.items || []).forEach((item, idx) => {
    item.expiry_date = normalized[idx];
  });
  o.updated_at = now();
  writeDB(db);
  res.json(o);
});
// Receive a purchase order → add stock to selected store (defaults to main store)
app.post('/api/store/purchase-orders/:id/receive', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const o = db.store_purchase_orders.find(x=>x.id===parseInt(req.params.id));
  if (!o) return res.status(404).json({ error:'Not found' });
  if (o.status === 'Received') return res.status(400).json({ error:'Already received' });

  const selectedStoreId = req.body && req.body.store_id ? parseInt(req.body.store_id) : null;
  const targetStore = selectedStoreId
    ? db.store_sub_stores.find(s => s.id === selectedStoreId)
    : (db.store_sub_stores.find(s => s.is_main) || db.store_sub_stores[0]);

  if (!targetStore) return res.status(500).json({ error:'No store found' });
  if (targetStore.active === false) return res.status(400).json({ error:'Selected store is inactive' });

  (o.items||[]).forEach(item => {
    const product = (db.store_products || []).find(p => p.id === parseInt(item.product_id));
    const stock = getStock(db, item.product_id, targetStore.id);
    const addQty = item.base_qty !== undefined ? parseFloat(item.base_qty) : parseFloat(item.qty || 0);
    const factor = parseFloat(item.factor || 1) || 1;
    const purchaseCostPerSelectedUom = parseFloat(item.cost_price || 0) || 0;
    const baseUnitCost = factor > 0 ? (purchaseCostPerSelectedUom / factor) : purchaseCostPerSelectedUom;
    stock.avg_cost = computeWac(stock.qty, stock.avg_cost, addQty, baseUnitCost);
    stock.qty += addQty;
    if (product) product.cost_price = parseFloat(stock.avg_cost || 0) || 0;
  });
  o.status = 'Received';
  o.received_at = now();
  o.received_store_id = targetStore.id;
  writeDB(db);
  res.json({ ...o, received_store_name: targetStore.name || '' });
});
app.delete('/api/store/purchase-orders/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const o = db.store_purchase_orders.find(x=>x.id===parseInt(req.params.id));
  if (!o) return res.status(404).json({ error:'Not found' });
  if (o.status === 'Received') return res.status(400).json({ error:'Cannot delete received order' });
  db.store_purchase_orders = db.store_purchase_orders.filter(x=>x.id!==o.id);
  writeDB(db); res.json({ success:true });
});

// ── Supplier Invoice Payments (Expense Integration) ─────
app.get('/api/store/supplier-invoices', requirePermission('expenses.view'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const q = String(req.query.search || '').trim().toLowerCase();
  const dueOnly = ['1', 'true', 'yes'].includes(String(req.query.due_only || '').toLowerCase());
  const supplierId = req.query.supplier_id ? parseInt(req.query.supplier_id, 10) : null;
  const allowedStoreIds = getAccessibleStoreIds(db, req);

  const paidByPo = new Map();
  for (const p of (db.store_supplier_invoice_payments || [])) {
    const pid = parseInt(p.po_id, 10);
    if (!pid) continue;
    paidByPo.set(pid, (paidByPo.get(pid) || 0) + (parseFloat(p.amount || 0) || 0));
  }

  let rows = (db.store_purchase_orders || []).filter((po) => {
    if (!po || !po.supplier_id) return false;
    if (supplierId && parseInt(po.supplier_id, 10) !== supplierId) return false;
    if (allowedStoreIds && po.received_store_id && !allowedStoreIds.has(parseInt(po.received_store_id, 10))) return false;
    return true;
  }).map((po) => {
    const supplier = (db.store_suppliers || []).find((s) => parseInt(s.id, 10) === parseInt(po.supplier_id, 10)) || {};
    const totalAmount = parseFloat(po.total_cost || 0) || 0;
    const paidAmount = parseFloat((paidByPo.get(parseInt(po.id, 10)) || 0).toFixed(3));
    const dueAmount = parseFloat(Math.max(0, totalAmount - paidAmount).toFixed(3));
    const paymentStatus = dueAmount <= 0.0005 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid');
    return {
      po_id: po.id,
      supplier_id: po.supplier_id,
      supplier_name: supplier.name || '—',
      invoice_number: String(po.invoice_number || '').trim() || `PO-${po.id}`,
      order_date: po.order_date || '',
      purchase_status: po.status || 'Pending',
      total_amount: parseFloat(totalAmount.toFixed(3)),
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_status: paymentStatus
    };
  });

  if (dueOnly) rows = rows.filter((r) => (parseFloat(r.due_amount || 0) || 0) > 0.0005);
  if (q) {
    rows = rows.filter((r) => [
      r.po_id,
      r.supplier_name,
      r.invoice_number,
      r.order_date,
      r.purchase_status,
      r.payment_status
    ].map((v) => String(v || '').toLowerCase()).join(' ').includes(q));
  }

  rows.sort((a, b) => {
    const ad = String(a.order_date || '');
    const bd = String(b.order_date || '');
    if (ad !== bd) return ad < bd ? 1 : -1;
    return parseInt(b.po_id || 0, 10) - parseInt(a.po_id || 0, 10);
  });

  res.json(rows);
});

app.get('/api/store/supplier-invoices/:id/payments', requirePermission('expenses.view'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const poId = parseInt(req.params.id, 10);
  const po = (db.store_purchase_orders || []).find((x) => parseInt(x.id, 10) === poId);
  if (!po) return res.status(404).json({ error:'Supplier invoice not found' });
  if (po.received_store_id && !assertStoreAccess(db, req, po.received_store_id)) return res.status(403).json({ error:'Store access denied' });

  const usersById = new Map((db.users || []).map((u) => [parseInt(u.id, 10), u]));
  const rows = (db.store_supplier_invoice_payments || [])
    .filter((p) => parseInt(p.po_id, 10) === poId)
    .map((p) => {
      const actor = usersById.get(parseInt(p.created_by, 10)) || {};
      return {
        ...p,
        created_by_name: actor.name || actor.username || '—'
      };
    })
    .sort((a, b) => {
      const ad = `${String(a.payment_date || '')} ${String(a.created_at || '')}`;
      const bd = `${String(b.payment_date || '')} ${String(b.created_at || '')}`;
      if (ad !== bd) return ad < bd ? 1 : -1;
      return parseInt(b.id || 0, 10) - parseInt(a.id || 0, 10);
    });

  res.json(rows);
});

app.post('/api/store/supplier-invoices/:id/payments', requirePermission('expenses.create'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const poId = parseInt(req.params.id, 10);
  const po = (db.store_purchase_orders || []).find((x) => parseInt(x.id, 10) === poId);
  if (!po) return res.status(404).json({ error:'Supplier invoice not found' });
  if (po.received_store_id && !assertStoreAccess(db, req, po.received_store_id)) return res.status(403).json({ error:'Store access denied' });

  const supplier = (db.store_suppliers || []).find((s) => parseInt(s.id, 10) === parseInt(po.supplier_id, 10)) || {};
  const invoiceNumber = String(po.invoice_number || '').trim() || `PO-${po.id}`;
  const totalAmount = parseFloat(po.total_cost || 0) || 0;
  const paidSoFar = (db.store_supplier_invoice_payments || [])
    .filter((p) => parseInt(p.po_id, 10) === poId)
    .reduce((sum, p) => sum + (parseFloat(p.amount || 0) || 0), 0);
  const dueAmount = parseFloat(Math.max(0, totalAmount - paidSoFar).toFixed(3));

  const amount = parseFloat(req.body.amount || 0);
  const paymentMethod = String(req.body.payment_method || '').trim();
  const paymentDate = String(req.body.payment_date || today()).slice(0, 10);
  const referenceNo = String(req.body.reference_no || '').trim();
  const notes = String(req.body.notes || '').trim();
  const categoryName = String(req.body.expense_category || 'Supplier Invoice Payment').trim() || 'Supplier Invoice Payment';
  const actorId = (req.session && req.session.user && req.session.user.id) || req.session.userId || null;

  if (!(amount > 0)) return res.status(400).json({ error:'Payment amount must be greater than 0' });
  if (!(dueAmount > 0)) return res.status(400).json({ error:'This invoice is already fully paid' });
  if (amount - dueAmount > 0.0005) return res.status(400).json({ error:`Amount exceeds due (KD ${dueAmount.toFixed(3)})` });

  if (!db.expense_categories) db.expense_categories = [];
  if (!(db.expense_categories || []).some((c) => String(c.name || '') === categoryName)) {
    db.expense_categories.push({ id: nextId(db, 'expense_categories'), name: categoryName, created_at: now() });
  }

  const payment = {
    id: nextId(db, 'store_supplier_invoice_payments'),
    po_id: poId,
    supplier_id: parseInt(po.supplier_id, 10) || null,
    invoice_number: invoiceNumber,
    amount: parseFloat(amount.toFixed(3)),
    payment_method: paymentMethod,
    payment_date: paymentDate,
    reference_no: referenceNo,
    notes,
    expense_id: null,
    created_by: actorId,
    created_at: now()
  };

  const expense = {
    id: nextId(db, 'expenses'),
    title: `Supplier Invoice Payment · ${supplier.name || 'Supplier'} · ${invoiceNumber}`,
    category: categoryName,
    amount: payment.amount,
    expense_date: paymentDate,
    payment_method: paymentMethod,
    vendor: supplier.name || '',
    reference_no: referenceNo || invoiceNumber,
    notes: notes || `Payment for supplier invoice ${invoiceNumber}`,
    source_type: 'supplier_invoice_payment',
    source_id: payment.id,
    supplier_invoice_id: poId,
    created_by: actorId,
    updated_by: actorId,
    created_at: now(),
    updated_at: now()
  };

  payment.expense_id = expense.id;
  db.store_supplier_invoice_payments.push(payment);
  db.expenses.push(expense);

  const paidAfter = paidSoFar + payment.amount;
  const dueAfter = parseFloat(Math.max(0, totalAmount - paidAfter).toFixed(3));
  const paymentStatus = dueAfter <= 0.0005 ? 'Paid' : (paidAfter > 0 ? 'Partially Paid' : 'Unpaid');

  logActivity(db, req, {
    module: 'finance',
    action: 'supplier_invoice_payment_recorded',
    entity_type: 'store_purchase_order',
    entity_id: poId,
    notes: `Supplier invoice ${invoiceNumber} payment of KD ${payment.amount.toFixed(3)} recorded (${paymentStatus})`,
    meta: {
      supplier_name: supplier.name || '',
      invoice_number: invoiceNumber,
      total_amount: parseFloat(totalAmount.toFixed(3)),
      paid_amount: parseFloat(paidAfter.toFixed(3)),
      due_amount: dueAfter,
      payment_method: paymentMethod
    }
  });

  writeDB(db);
  res.json({
    payment,
    expense,
    summary: {
      total_amount: parseFloat(totalAmount.toFixed(3)),
      paid_amount: parseFloat(paidAfter.toFixed(3)),
      due_amount: dueAfter,
      payment_status: paymentStatus
    }
  });
});

// ── Stock Transfers ─────────────────────────────────────
app.get('/api/store/transfers', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  const transfers = db.store_transfers.filter((transfer) => {
    if (!allowedStoreIds) return true;
    return allowedStoreIds.has(parseInt(transfer.from_store_id, 10)) || allowedStoreIds.has(parseInt(transfer.to_store_id, 10));
  }).map(t => {
    const from = db.store_sub_stores.find(s=>s.id===t.from_store_id)||{};
    const to   = db.store_sub_stores.find(s=>s.id===t.to_store_id)||{};
    return { ...t, from_store_name:from.name||'—', to_store_name:to.name||'—' };
  });
  res.json(transfers.sort((a,b)=>b.id-a.id));
});
app.post('/api/store/transfers', requireRole('admin','receptionist'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const { from_store_id, to_store_id, items, notes } = req.body;
  if (!from_store_id || !to_store_id || !items || !items.length) return res.status(400).json({ error:'From, to store and items required' });
  if (parseInt(from_store_id)===parseInt(to_store_id)) return res.status(400).json({ error:'From and to store must differ' });
  if (!assertStoreAccess(db, req, from_store_id) || !assertStoreAccess(db, req, to_store_id)) return res.status(403).json({ error:'Store access denied' });
  // validate stock availability
  for (const item of items) {
    const factor = resolveLineFactor(db, item.product_id, item.uom_id, item.factor || 1);
    const reqQty = parseFloat(item.qty || 0) * factor;
    const stock = getStock(db, parseInt(item.product_id), parseInt(from_store_id));
    if (stock.qty < reqQty) {
      const product = db.store_products.find(p=>p.id===parseInt(item.product_id))||{};
      return res.status(400).json({ error:`Insufficient stock for ${product.name||'product'} (available: ${stock.qty})` });
    }
  }
  // deduct from source, add to destination
  const mappedItems = [];
  for (const item of items) {
    const factor = resolveLineFactor(db, item.product_id, item.uom_id, item.factor || 1);
    const baseQty = parseFloat(item.qty || 0) * factor;
    const fromStock = getStock(db, parseInt(item.product_id), parseInt(from_store_id));
    const toStock   = getStock(db, parseInt(item.product_id), parseInt(to_store_id));
    const transferUnitCost = parseFloat(fromStock.avg_cost || 0) || 0;
    fromStock.qty  -= baseQty;
    // Outgoing transfer uses source WAC as the transfer value.
    toStock.avg_cost = computeWac(toStock.qty, toStock.avg_cost, baseQty, transferUnitCost);
    toStock.qty    += baseQty;
    mappedItems.push({
      product_id:parseInt(item.product_id),
      qty:parseFloat(item.qty || 0),
      uom_id:item.uom_id ? parseInt(item.uom_id) : null,
      factor,
      base_qty:parseFloat(baseQty.toFixed(3)),
      unit_cost: parseFloat(transferUnitCost.toFixed(3)),
      total_cost: parseFloat((baseQty * transferUnitCost).toFixed(3))
    });
  }
  const t = { id:nextId(db,'store_transfers'), from_store_id:parseInt(from_store_id), to_store_id:parseInt(to_store_id), items:mappedItems, notes:notes||'', created_by:(req.session && req.session.user && req.session.user.id) || req.session.userId || null, created_at:now() };
  db.store_transfers.push(t); writeDB(db); res.json(t);
});

// ── Stock Adjustments (IN / OUT) ───────────────────────
app.get('/api/store/adjustments', requirePermission('store.adjust'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const dateFrom = String(req.query.date_from || '').slice(0, 10);
  const dateTo = String(req.query.date_to || '').slice(0, 10);
  const storeFilter = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
  const q = String(req.query.search || '').trim().toLowerCase();
  const allowedStoreIds = getAccessibleStoreIds(db, req);
  if (storeFilter && !assertStoreAccess(db, req, storeFilter)) return res.status(403).json({ error:'Store access denied' });

  const storesById = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id, 10), s]));
  const productsById = new Map((db.store_products || []).map(p => [parseInt(p.id, 10), p]));
  const usersById = new Map((db.users || []).map(u => [parseInt(u.id, 10), u]));
  const adjustmentNoById = new Map((db.store_adjustments || []).map(a => [parseInt(a.id, 10), a.adjustment_no || `ADJ-${String(a.id || '').padStart(6, '0')}`]));

  let rows = (db.store_adjustments || []).map((entry) => {
    const store = storesById.get(parseInt(entry.store_id, 10)) || {};
    const product = productsById.get(parseInt(entry.product_id, 10)) || {};
    const user = usersById.get(parseInt(entry.created_by, 10)) || {};
    return {
      ...entry,
      store_name: store.name || 'Unknown',
      product_name: product.name || `Product #${entry.product_id}`,
      product_sku: product.sku || '',
      created_by_name: user.name || user.username || '—',
      reversal_of_adjustment_no: entry.reversal_of_id ? (adjustmentNoById.get(parseInt(entry.reversal_of_id, 10)) || null) : null,
      reversed_by_adjustment_no: entry.reversed_by_adjustment_id ? (adjustmentNoById.get(parseInt(entry.reversed_by_adjustment_id, 10)) || null) : null
    };
  });

  if (allowedStoreIds) rows = rows.filter(r => allowedStoreIds.has(parseInt(r.store_id, 10)));
  if (dateFrom) rows = rows.filter(r => String(r.date || r.created_at || '').slice(0,10) >= dateFrom);
  if (dateTo) rows = rows.filter(r => String(r.date || r.created_at || '').slice(0,10) <= dateTo);
  if (storeFilter) rows = rows.filter(r => parseInt(r.store_id, 10) === storeFilter);
  if (q) {
    rows = rows.filter(r => [
      r.adjustment_no,
      r.store_name,
      r.product_name,
      r.product_sku,
      r.reason,
      r.remarks,
      r.adjustment_type,
      r.created_by_name,
      r.created_at
    ].map(v => String(v || '').toLowerCase()).join(' ').includes(q));
  }

  rows.sort((a,b) => {
    const ad = String(a.date || a.created_at || '');
    const bd = String(b.date || b.created_at || '');
    if (ad !== bd) return ad < bd ? 1 : -1;
    return parseInt(b.id || 0, 10) - parseInt(a.id || 0, 10);
  });

  res.json(rows);
});

app.post('/api/store/adjustments', requirePermission('store.adjust'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const { store_id, product_id, adjustment_type, qty, unit_cost, reason, remarks, date } = req.body || {};
  const sid = parseInt(store_id, 10);
  const pid = parseInt(product_id, 10);
  const type = String(adjustment_type || '').toUpperCase();
  const quantity = parseFloat(qty || 0);
  const note = String(remarks || '').trim();
  const why = String(reason || '').trim() || 'Adjustment';
  const normalizedDate = String(date || today()).slice(0, 10);

  if (!sid) return res.status(400).json({ error:'Store is required' });
  if (!assertStoreAccess(db, req, sid)) return res.status(403).json({ error:'Store access denied' });
  if (!pid) return res.status(400).json({ error:'Product is required' });
  if (!['IN','OUT'].includes(type)) return res.status(400).json({ error:'Adjustment type must be IN or OUT' });
  if (!(quantity > 0)) return res.status(400).json({ error:'Quantity must be greater than 0' });

  const store = (db.store_sub_stores || []).find(s => parseInt(s.id, 10) === sid);
  if (!store || store.active === false) return res.status(400).json({ error:'Invalid store' });
  const product = (db.store_products || []).find(p => parseInt(p.id, 10) === pid);
  if (!product || product.active === false) return res.status(400).json({ error:'Invalid product' });

  const stock = getStock(db, pid, sid);
  const stockBefore = parseFloat(stock.qty || 0) || 0;
  if (type === 'OUT' && stockBefore < quantity) {
    return res.status(400).json({ error:`Insufficient stock (available: ${stockBefore.toFixed(3)})` });
  }

  let resolvedUnitCost = parseFloat(unit_cost || 0);
  if (!(resolvedUnitCost >= 0)) resolvedUnitCost = 0;
  if (!(resolvedUnitCost > 0)) {
    resolvedUnitCost = parseFloat(stock.avg_cost || product.cost_price || 0) || 0;
  }

  if (type === 'IN') {
    stock.avg_cost = computeWac(stock.qty, stock.avg_cost, quantity, resolvedUnitCost);
    stock.qty = parseFloat((stock.qty + quantity).toFixed(3));
    product.cost_price = parseFloat(stock.avg_cost || 0) || 0;
  } else {
    stock.qty = parseFloat((stock.qty - quantity).toFixed(3));
  }

  const stockAfter = parseFloat(stock.qty || 0) || 0;
  const totalCost = parseFloat((quantity * resolvedUnitCost).toFixed(3));
  const id = nextId(db, 'store_adjustments');
  const entry = {
    id,
    adjustment_no: `ADJ-${String(id).padStart(6, '0')}`,
    date: normalizedDate,
    store_id: sid,
    product_id: pid,
    adjustment_type: type,
    qty: parseFloat(quantity.toFixed(3)),
    unit_cost: parseFloat(resolvedUnitCost.toFixed(3)),
    total_cost: totalCost,
    stock_before: parseFloat(stockBefore.toFixed(3)),
    stock_after: parseFloat(stockAfter.toFixed(3)),
    reversal_of_id: null,
    reversed_by_adjustment_id: null,
    reason: why,
    remarks: note,
    created_by: (req.session && req.session.user && req.session.user.id) || req.session.userId || null,
    created_at: now()
  };

  db.store_adjustments.push(entry);
  logActivity(db, req, {
    module: 'store',
    action: 'stock_adjusted',
    entity_type: 'store_adjustment',
    entity_id: id,
    notes: `${type} ${entry.qty.toFixed(3)} of ${product.name || ('Product #' + pid)} at ${store.name || ('Store #' + sid)} (${entry.adjustment_no})`,
    meta: { store_id: sid, product_id: pid, adjustment_type: type, qty: entry.qty, total_cost: entry.total_cost }
  });
  writeDB(db);
  res.json(entry);
});

app.post('/api/store/adjustments/:id/reverse', requirePermission('store.adjust'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const actor = (req.session && req.session.user) || {};
  if (String(actor.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error:'Only admin can reverse adjustments' });
  }

  const targetId = parseInt(req.params.id, 10);
  const target = (db.store_adjustments || []).find(a => parseInt(a.id, 10) === targetId);
  if (!target) return res.status(404).json({ error:'Adjustment not found' });

  const sid = parseInt(target.store_id, 10);
  if (!assertStoreAccess(db, req, sid)) return res.status(403).json({ error:'Store access denied' });
  if (target.reversal_of_id) return res.status(400).json({ error:'Reversal entry cannot be reversed again' });
  if (target.reversed_by_adjustment_id) return res.status(400).json({ error:'Adjustment already reversed' });

  const pid = parseInt(target.product_id, 10);
  const qty = parseFloat(target.qty || 0) || 0;
  if (!(qty > 0)) return res.status(400).json({ error:'Invalid adjustment quantity' });

  const store = (db.store_sub_stores || []).find(s => parseInt(s.id, 10) === sid);
  const product = (db.store_products || []).find(p => parseInt(p.id, 10) === pid);
  if (!store || store.active === false) return res.status(400).json({ error:'Invalid store' });
  if (!product || product.active === false) return res.status(400).json({ error:'Invalid product' });

  const reverseType = String(target.adjustment_type || '').toUpperCase() === 'IN' ? 'OUT' : 'IN';
  const stock = getStock(db, pid, sid);
  const stockBefore = parseFloat(stock.qty || 0) || 0;
  if (reverseType === 'OUT' && stockBefore < qty) {
    return res.status(400).json({ error:`Cannot reverse: available stock is ${stockBefore.toFixed(3)}, required ${qty.toFixed(3)}` });
  }

  const sourceUnitCost = parseFloat(target.unit_cost || 0) || 0;
  if (reverseType === 'IN') {
    stock.avg_cost = computeWac(stock.qty, stock.avg_cost, qty, sourceUnitCost);
    stock.qty = parseFloat((stock.qty + qty).toFixed(3));
    product.cost_price = parseFloat(stock.avg_cost || 0) || 0;
  } else {
    stock.qty = parseFloat((stock.qty - qty).toFixed(3));
  }

  const stockAfter = parseFloat(stock.qty || 0) || 0;
  const reversalId = nextId(db, 'store_adjustments');
  const reversalNo = `ADJ-${String(reversalId).padStart(6, '0')}`;
  const reasonNote = String((req.body && req.body.reason) || '').trim();
  const entry = {
    id: reversalId,
    adjustment_no: reversalNo,
    date: String(today()).slice(0, 10),
    store_id: sid,
    product_id: pid,
    adjustment_type: reverseType,
    qty: parseFloat(qty.toFixed(3)),
    unit_cost: parseFloat(sourceUnitCost.toFixed(3)),
    total_cost: parseFloat((qty * sourceUnitCost).toFixed(3)),
    stock_before: parseFloat(stockBefore.toFixed(3)),
    stock_after: parseFloat(stockAfter.toFixed(3)),
    reversal_of_id: target.id,
    reversed_by_adjustment_id: null,
    reason: `Reversal of ${target.adjustment_no || ('ADJ#' + target.id)}`,
    remarks: reasonNote,
    created_by: actor.id || req.session.userId || null,
    created_at: now()
  };

  target.reversed_by_adjustment_id = reversalId;
  target.reversed_at = now();
  target.reversed_by = actor.id || req.session.userId || null;
  target.reversal_reason = reasonNote;

  db.store_adjustments.push(entry);
  logActivity(db, req, {
    module: 'store',
    action: 'stock_adjustment_reversed',
    entity_type: 'store_adjustment',
    entity_id: target.id,
    notes: `Reversed ${target.adjustment_no || ('ADJ#' + target.id)} with ${reversalNo}`,
    meta: { source_adjustment_id: target.id, reversal_adjustment_id: reversalId, reverse_type: reverseType, qty: entry.qty }
  });
  writeDB(db);
  res.json({ success: true, source: target, reversal: entry });
});

// ── Manual Consumption ─────────────────────────────────
app.get('/api/store/manual-consumptions', requirePermission('store.consume'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const dateFrom = String(req.query.date_from || '').slice(0, 10);
  const dateTo = String(req.query.date_to || '').slice(0, 10);
  const storeFilter = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
  const q = String(req.query.search || '').trim().toLowerCase();
  if (storeFilter && !assertStoreAccess(db, req, storeFilter)) return res.status(403).json({ error:'Store access denied' });
  const allowedStoreIds = getAccessibleStoreIds(db, req);

  const storesById = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id, 10), s]));
  const productsById = new Map((db.store_products || []).map(p => [parseInt(p.id, 10), p]));

  let rows = (db.store_manual_consumptions || []).map((entry) => {
    const sid = parseInt(entry.store_id, 10);
    const store = storesById.get(sid) || {};
    const items = (entry.items || []).map((it) => {
      const pid = parseInt(it.product_id, 10);
      const p = productsById.get(pid) || {};
      return {
        ...it,
        product_name: p.name || `Product #${pid}`,
        product_sku: p.sku || '',
        unit: p.unit || ''
      };
    });
    return {
      ...entry,
      store_id: sid,
      store_name: store.name || 'Unknown',
      items
    };
  });

  if (allowedStoreIds) rows = rows.filter((row) => allowedStoreIds.has(parseInt(row.store_id, 10)));

  if (dateFrom) rows = rows.filter(r => String(r.date || r.created_at || '').slice(0, 10) >= dateFrom);
  if (dateTo) rows = rows.filter(r => String(r.date || r.created_at || '').slice(0, 10) <= dateTo);
  if (storeFilter) rows = rows.filter(r => parseInt(r.store_id, 10) === storeFilter);
  if (q) {
    rows = rows.filter(r => {
      const blob = [
        r.entry_no,
        r.store_name,
        r.remarks,
        ...(r.items || []).flatMap(it => [it.product_name, it.product_sku, it.reason, it.remarks])
      ].map(v => String(v || '').toLowerCase()).join(' ');
      return blob.includes(q);
    });
  }

  rows.sort((a, b) => {
    const ad = String(a.date || a.created_at || '');
    const bd = String(b.date || b.created_at || '');
    if (ad !== bd) return ad < bd ? 1 : -1;
    return parseInt(b.id || 0, 10) - parseInt(a.id || 0, 10);
  });

  res.json(rows.map((row) => sanitizeManualConsumptionEntryForUser(db, req, row)));
});

app.post('/api/store/manual-consumptions', requirePermission('store.consume'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const canViewCost = hasPermission(db, req.session.user.role, 'store.consume.cost');
  const { store_id, date, remarks, items } = req.body || {};
  const sid = parseInt(store_id, 10);
  if (!assertStoreAccess(db, req, sid)) return res.status(403).json({ error:'Store access denied' });
  const store = (db.store_sub_stores || []).find(s => parseInt(s.id, 10) === sid);
  if (!sid || !store) return res.status(400).json({ error:'Store is required' });
  if (store.active === false) return res.status(400).json({ error:'Selected store is inactive' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error:'At least one item is required' });

  const normalizedDate = String(date || today()).slice(0, 10);
  const normalizedItems = [];
  const insufficient = [];

  for (let i = 0; i < items.length; i += 1) {
    const row = items[i] || {};
    const productId = parseInt(row.product_id, 10);
    const qty = parseFloat(row.qty || 0);
    const providedCost = canViewCost && row.cost !== undefined && row.cost !== null && String(row.cost).trim() !== '';
    const cost = providedCost ? parseFloat(row.cost || 0) : null;
    const reason = normalizeManualConsumptionReason(row.reason);
    const lineRemarks = String(row.remarks || '').trim();

    if (!productId) return res.status(400).json({ error:`Item is required on row ${i + 1}` });
    if (!(qty > 0)) return res.status(400).json({ error:`Quantity must be greater than 0 on row ${i + 1}` });
    if (providedCost && !(cost >= 0)) return res.status(400).json({ error:`Cost cannot be negative on row ${i + 1}` });

    const product = (db.store_products || []).find(p => parseInt(p.id, 10) === productId);
    if (!product) return res.status(400).json({ error:`Invalid item on row ${i + 1}` });

    const stock = getStock(db, productId, sid);
    const availableQty = parseFloat(stock.qty || 0) || 0;
    if (availableQty < qty) {
      insufficient.push({
        row: i + 1,
        product_id: productId,
        product_name: product.name || `Product #${productId}`,
        requested_qty: qty,
        available_qty: parseFloat(availableQty.toFixed(3))
      });
    }

    normalizedItems.push({
      product_id: productId,
      qty: parseFloat(qty.toFixed(3)),
      cost,
      reason,
      remarks: lineRemarks
    });
  }

  if (insufficient.length) {
    return res.status(400).json({
      error: 'Insufficient stock for one or more items',
      insufficient
    });
  }

  const createdBy = (req.session && req.session.user && req.session.user.id) || req.session.userId || null;
  const lines = [];
  let totalEntryCost = 0;

  for (const row of normalizedItems) {
    const product = (db.store_products || []).find(p => parseInt(p.id, 10) === parseInt(row.product_id, 10)) || {};
    const stock = getStock(db, parseInt(row.product_id, 10), sid);
    const stockBefore = parseFloat(stock.qty || 0) || 0;
    const unitCost = row.cost != null
      ? parseFloat(row.cost || 0)
      : (parseFloat(stock.avg_cost || product.cost_price || 0) || 0);
    const lineTotal = parseFloat((row.qty * unitCost).toFixed(3));
    stock.qty = parseFloat((stock.qty - row.qty).toFixed(3));
    const stockAfter = parseFloat(stock.qty || 0) || 0;

    totalEntryCost += lineTotal;
    lines.push({
      product_id: parseInt(row.product_id, 10),
      qty: parseFloat(row.qty.toFixed(3)),
      cost: parseFloat(unitCost.toFixed(3)),
      total_cost: lineTotal,
      reason: row.reason,
      remarks: row.remarks || '',
      stock_before: parseFloat(stockBefore.toFixed(3)),
      stock_after: parseFloat(stockAfter.toFixed(3))
    });
  }

  const id = nextId(db, 'store_manual_consumptions');
  const entry = {
    id,
    entry_no: `MC-${String(id).padStart(6, '0')}`,
    movement_type: 'Manual Consumption',
    store_id: sid,
    date: normalizedDate,
    items: lines,
    total_cost: parseFloat(totalEntryCost.toFixed(3)),
    remarks: String(remarks || '').trim(),
    created_by: createdBy,
    created_at: now()
  };

  db.store_manual_consumptions.push(entry);
  writeDB(db);
  res.json(sanitizeManualConsumptionEntryForUser(db, req, entry));
});

// ── Service–Product links ───────────────────────────────
app.get('/api/store/service-products', requireLogin, (req,res) => {
  const db = readDB(); ensureStore(db);
  const sidFilter = req.query.service_id ? parseInt(req.query.service_id) : null;
  const links = db.store_service_products.map(l => {
    const svc  = (db.services||[]).find(s=>s.id===l.service_id)||{};
    const prod = db.store_products.find(p=>p.id===l.product_id)||{};
    const product_cost = parseFloat(prod.cost_price || 0) || 0;
    return {
      ...l,
      service_name:svc.name||'—',
      product_name:prod.name||'—',
      product_unit:prod.uom_symbol||prod.unit||'',
      product_cost,
      cost_per_use: parseFloat(((parseFloat(l.qty_per_use || 0) || 0) * product_cost).toFixed(3))
    };
  });
  res.json(sidFilter ? links.filter(x => x.service_id === sidFilter) : links);
});
app.post('/api/store/service-products', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  const { service_id, product_id, qty_per_use } = req.body;
  if (!service_id || !product_id) return res.status(400).json({ error:'service_id and product_id required' });
  // prevent duplicate
  const exists = db.store_service_products.find(l=>l.service_id===parseInt(service_id)&&l.product_id===parseInt(product_id));
  if (exists) { exists.qty_per_use=parseFloat(qty_per_use||1); writeDB(db); return res.json(exists); }
  const l = { id:nextId(db,'store_service_products'), service_id:parseInt(service_id), product_id:parseInt(product_id), qty_per_use:parseFloat(qty_per_use||1) };
  db.store_service_products.push(l); writeDB(db); res.json(l);
});
app.delete('/api/store/service-products/:id', requireRole('admin'), (req,res) => {
  const db = readDB(); ensureStore(db);
  db.store_service_products = db.store_service_products.filter(x=>x.id!==parseInt(req.params.id));
  writeDB(db); res.json({ success:true });
});

// ===================== DISCOUNTS =====================
app.get('/api/discounts', requireLogin, (req, res) => {
  const db = readDB();
  res.json(db.discounts || []);
});
app.get('/api/discounts/:id', requireLogin, (req, res) => {
  const db = readDB();
  const d = (db.discounts||[]).find(d => d.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ error:'Not found' });
  res.json(d);
});
app.post('/api/discounts', requireRole('admin'), (req, res) => {
  const { name, type, value, applicable_on, max_limit, valid_from, valid_to, active } = req.body;
  if (!name || !type) return res.status(400).json({ error:'name and type required' });
  if (!['percentage','fixed','open'].includes(type)) return res.status(400).json({ error:'Invalid discount type' });
  const db = readDB();
  if (!db.discounts) db.discounts = [];
  const id = nextId(db, 'discounts');
  const disc = { id, name:String(name).trim(), type, value: type==='open' ? 0 : (parseFloat(value)||0), applicable_on: applicable_on||'all', max_limit: max_limit ? parseFloat(max_limit) : null, valid_from: valid_from||null, valid_to: valid_to||null, active: active !== false, created_at: now() };
  db.discounts.push(disc); writeDB(db); res.json(disc);
});
app.put('/api/discounts/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.discounts) db.discounts = [];
  const idx = db.discounts.findIndex(d => d.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error:'Not found' });
  const { name, type, value, applicable_on, max_limit, valid_from, valid_to, active } = req.body;
  const cur = db.discounts[idx];
  const newType = type || cur.type;
  db.discounts[idx] = { ...cur, name: String(name||cur.name).trim(), type: newType, value: newType==='open' ? 0 : (value!==undefined ? (parseFloat(value)||0) : cur.value), applicable_on: applicable_on||cur.applicable_on, max_limit: max_limit!==undefined ? (max_limit ? parseFloat(max_limit) : null) : cur.max_limit, valid_from: valid_from!==undefined ? (valid_from||null) : cur.valid_from, valid_to: valid_to!==undefined ? (valid_to||null) : cur.valid_to, active: active!==undefined ? (active!==false && active!=='false') : cur.active, updated_at: now() };
  writeDB(db); res.json(db.discounts[idx]);
});
app.delete('/api/discounts/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  if (!db.discounts) db.discounts = [];
  db.discounts = db.discounts.filter(d => d.id !== parseInt(req.params.id));
  writeDB(db); res.json({ success:true });
});

// ===================== REFUNDS =====================
app.get('/api/refunds', requireLogin, (req, res) => {
  const db = readDB();
  const { bill_id, patient_id, date_from, date_to } = req.query;
  let list = (db.refunds||[]).map(r => {
    const bill = (db.bills||[]).find(b => b.id === r.bill_id) || {};
    const pat = (db.patients||[]).find(p => p.id === r.patient_id) || {};
    const user = (db.users||[]).find(u => u.id === r.refunded_by) || {};
    return { ...r, bill_number: bill.bill_number||'—', patient_name: pat.name||'—', mr_number: pat.mr_number||'—', refunded_by_name: user.name||user.username||'—' };
  });
  if (bill_id) list = list.filter(r => r.bill_id === parseInt(bill_id));
  if (patient_id) list = list.filter(r => r.patient_id === parseInt(patient_id));
  if (date_from) list = list.filter(r => String(r.created_at||'').slice(0,10) >= date_from);
  if (date_to)   list = list.filter(r => String(r.created_at||'').slice(0,10) <= date_to);
  list.sort((a,b) => String(b.created_at||'') > String(a.created_at||'') ? 1 : -1);
  res.json(list);
});
app.post('/api/bills/:id/refund', requireLogin, (req, res) => {
  const db = readDB();
  const userId = (req.session && req.session.user && req.session.user.id) || req.session.userId;
  const userRole = (req.session && req.session.user && req.session.user.role) || '';
  if (!hasPermission(db, userRole, 'billing.refund.initiate')) return res.status(403).json({ error:'Permission denied: billing.refund.initiate required' });
  const bill = db.bills.find(b => b.id === parseInt(req.params.id));
  if (!bill) return res.status(404).json({ error:'Bill not found' });
  if (bill.payment_status !== 'Paid') return res.status(400).json({ error:'Refunds only allowed for Paid bills' });
  const { refund_type, refund_amount, refund_items, refund_reason, refund_payment_type } = req.body;
  if (!refund_reason || !String(refund_reason).trim()) return res.status(400).json({ error:'Refund reason is mandatory' });
  if (!refund_payment_type) return res.status(400).json({ error:'Refund payment type is required' });
  const subtotal = parseFloat(bill.subtotal != null ? bill.subtotal : bill.total) || 0;
  const discountAmt = parseFloat(bill.discount_amount || 0) || 0;
  const netAmount = Math.max(0, parseFloat((subtotal - discountAmt).toFixed(3)));
  const maxRefund = parseFloat((bill.total != null ? bill.total : netAmount).toFixed(3));
  const existingRefunds = (db.refunds||[]).filter(r => r.bill_id === bill.id).reduce((s,r) => s + (parseFloat(r.refund_amount)||0), 0);
  const availableToRefund = parseFloat((maxRefund - existingRefunds).toFixed(3));
  const amt = parseFloat(refund_amount) || 0;
  if (amt <= 0) return res.status(400).json({ error:'Refund amount must be greater than 0' });
  if (amt > availableToRefund) return res.status(400).json({ error:`Refund amount KD ${amt.toFixed(3)} exceeds available KD ${availableToRefund.toFixed(3)}` });
  if (!db.refunds) db.refunds = [];
  const id = nextId(db, 'refunds');
  const refund = { id, bill_id: bill.id, patient_id: bill.patient_id, bill_number: bill.bill_number, visit_id: bill.visit_id, refund_type: refund_type||'partial', refund_amount: amt, refund_items: refund_items||[], refund_reason: String(refund_reason).trim(), refund_payment_type: refund_payment_type, refunded_by: userId, created_at: now() };
  db.refunds.push(refund);
  const totalRefunded = existingRefunds + amt;
  if (Math.abs(totalRefunded - maxRefund) < 0.01) bill.payment_status = 'Refunded';
  else bill.payment_status = 'Partially Refunded';
  logActivity(db, req, { module:'billing', action:'refund_issued', entity_type:'bill', entity_id:bill.id, bill_id:bill.id, patient_id:bill.patient_id, notes:`Refund KD ${amt.toFixed(3)} for ${bill.bill_number}. Reason: ${refund.refund_reason}`, meta:{ refund_type, refund_amount:amt, refund_payment_type } });
  writeDB(db); res.json({ id, success:true, refund });
});

// ===================== DISCOUNT & REFUND REPORTS =====================
app.get('/api/reports/discounts', requireRole('admin'), (req, res) => {
  const db = readDB();
  const { date_from, date_to } = req.query;
  let bills = (db.bills||[]).filter(b => b.discount_amount > 0);
  if (date_from) bills = bills.filter(b => String(b.created_at||'').slice(0,10) >= date_from);
  if (date_to)   bills = bills.filter(b => String(b.created_at||'').slice(0,10) <= date_to);
  const totalDiscount = bills.reduce((s,b) => s + (parseFloat(b.discount_amount)||0), 0);
  const byType = {};
  for (const b of bills) {
    const disc = b.discount_id ? (db.discounts||[]).find(d => d.id === b.discount_id) : null;
    const type = disc ? disc.type : 'open';
    if (!byType[type]) byType[type] = { count:0, total:0 };
    byType[type].count++;
    byType[type].total = parseFloat((byType[type].total + (parseFloat(b.discount_amount)||0)).toFixed(3));
  }
  const discountedBills = bills.map(b => {
    const pat = (db.patients||[]).find(p => p.id === b.patient_id)||{};
    const user = (db.users||[]).find(u => u.id === b.created_by)||{};
    return { bill_number:b.bill_number, visit_id:b.visit_id, patient_name:pat.name||'—', mr_number:pat.mr_number||'—', discount_label:b.discount_label||'—', discount_amount:b.discount_amount, subtotal:b.subtotal||b.total, total:b.total, created_by_name:user.name||user.username||'—', created_at:b.created_at };
  });
  res.json({ total_discount: parseFloat(totalDiscount.toFixed(3)), bill_count: bills.length, by_type: byType, bills: discountedBills });
});
app.get('/api/reports/refunds', requireRole('admin'), (req, res) => {
  const db = readDB();
  const { date_from, date_to } = req.query;
  let refunds = db.refunds||[];
  if (date_from) refunds = refunds.filter(r => String(r.created_at||'').slice(0,10) >= date_from);
  if (date_to)   refunds = refunds.filter(r => String(r.created_at||'').slice(0,10) <= date_to);
  const total = refunds.reduce((s,r) => s + (parseFloat(r.refund_amount)||0), 0);
  const byUser = {}; const byPayType = {}; const reasons = {};
  for (const r of refunds) {
    const user = (db.users||[]).find(u => u.id === r.refunded_by)||{};
    const uname = user.name||user.username||`User ${r.refunded_by}`;
    if (!byUser[uname]) byUser[uname] = { count:0, total:0 };
    byUser[uname].count++; byUser[uname].total = parseFloat((byUser[uname].total+(parseFloat(r.refund_amount)||0)).toFixed(3));
    const pt = r.refund_payment_type||'—';
    if (!byPayType[pt]) byPayType[pt] = { count:0, total:0 };
    byPayType[pt].count++; byPayType[pt].total = parseFloat((byPayType[pt].total+(parseFloat(r.refund_amount)||0)).toFixed(3));
    const reason = String(r.refund_reason||'—').slice(0,50);
    reasons[reason] = (reasons[reason]||0) + 1;
  }
  const list = refunds.map(r => {
    const pat = (db.patients||[]).find(p => p.id === r.patient_id)||{};
    const user = (db.users||[]).find(u => u.id === r.refunded_by)||{};
    return { ...r, patient_name:pat.name||'—', mr_number:pat.mr_number||'—', refunded_by_name:user.name||user.username||'—' };
  });
  res.json({ total_refunded: parseFloat(total.toFixed(3)), refund_count: refunds.length, by_user: byUser, by_payment_type: byPayType, top_reasons: Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([reason,count])=>({reason,count})), refunds: list });
});

app.get('/api/reports/doctor-performance', requireLogin, (req, res) => {
  const db = readDB();
  if (autoMarkMissedAppointmentsAsNoShow(db)) writeDB(db);

  const me = (req.session && req.session.user) || {};
  const role = String(me.role || '').toLowerCase();
  const perms = getPermissions(db, me.role);
  if (role !== 'admin' && !perms.includes('reports.view')) return res.status(403).json({ error:'Forbidden' });

  const isAccountant = role.includes('accountant');
  const queryDoctorId = req.query.doctor_id ? parseInt(req.query.doctor_id, 10) : null;
  const dateFrom = String(req.query.date_from || '').slice(0, 10);
  const dateTo = String(req.query.date_to || '').slice(0, 10);
  const trend = String(req.query.trend || 'daily').toLowerCase() === 'monthly' ? 'monthly' : 'daily';
  const discountThreshold = Math.max(0, parseFloat(req.query.discount_threshold || 20) || 20);
  const refundThreshold = Math.max(0, parseFloat(req.query.refund_threshold || 10) || 10);
  const retentionThreshold = Math.max(0, parseFloat(req.query.retention_threshold || 30) || 30);
  const cancellationThreshold = Math.max(0, parseFloat(req.query.cancellation_threshold || 25) || 25);
  const commissionEnabled = String(req.query.commission_enabled || '0').toLowerCase() === '1' || String(req.query.commission_enabled || '').toLowerCase() === 'true';
  const commissionType = String(req.query.commission_type || 'percentage').toLowerCase() === 'fixed_per_service' ? 'fixed_per_service' : 'percentage';
  const commissionValue = Math.max(0, parseFloat(req.query.commission_value || 0) || 0);

  const inRange = (day) => {
    const d = String(day || '').slice(0, 10);
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const bucketLabel = (day) => {
    const d = String(day || '').slice(0, 10);
    if (!d) return '';
    if (trend === 'monthly') {
      const m = d.match(/^(\d{4})-(\d{2})-/);
      return m ? `${m[1]}-${m[2]}` : d;
    }
    return d;
  };

  const doctorsById = new Map((db.users || []).filter(u => String(u.role || '').toLowerCase() === 'doctor').map(d => [parseInt(d.id, 10), d]));
  const deptById = new Map((db.doctor_departments || []).map(dep => [parseInt(dep.id, 10), dep]));
  const servicesById = new Map((db.services || []).map(s => [parseInt(s.id, 10), s]));
  const appointmentsById = new Map((db.appointments || []).map(a => [parseInt(a.id, 10), a]));
  const billById = new Map((db.bills || []).map(b => [parseInt(b.id, 10), b]));

  const visibleDoctorIds = getVisibleDoctorIds(db, req);
  let doctorRows = (db.users || []).filter(u => String(u.role || '').toLowerCase() === 'doctor' && u.active !== false);
  if (visibleDoctorIds) doctorRows = doctorRows.filter(d => visibleDoctorIds.has(parseInt(d.id, 10)));
  if (role === 'doctor') doctorRows = doctorRows.filter(d => parseInt(d.id, 10) === parseInt(me.id, 10));
  if (queryDoctorId) doctorRows = doctorRows.filter(d => parseInt(d.id, 10) === queryDoctorId);

  const feedbackRows = Array.isArray(db.feedbacks)
    ? db.feedbacks
    : (Array.isArray(db.feedback) ? db.feedback : (Array.isArray(db.ratings) ? db.ratings : []));

  const dayCursorStart = dateFrom || today();
  const dayCursorEnd = dateTo || dayCursorStart;
  const countSlotsForDoctor = (doctorId) => {
    const sch = getDoctorSchedule(db, doctorId);
    const doctor = doctorsById.get(parseInt(doctorId, 10)) || {};
    const slotDuration = Math.max(1, parseInt(doctor.slot_duration || 30, 10));
    const ws = parseTimeToMinutes(sch.work_start);
    const we = parseTimeToMinutes(sch.work_end);
    if (isNaN(ws) || isNaN(we) || we <= ws) return 0;
    const baseMinutes = we - ws;
    const breakMinutes = (sch.breaks || []).reduce((sum, b) => {
      const bs = parseTimeToMinutes(b.start);
      const be = parseTimeToMinutes(b.end);
      if (isNaN(bs) || isNaN(be) || be <= bs) return sum;
      return sum + (be - bs);
    }, 0);
    const usable = Math.max(0, baseMinutes - breakMinutes);
    const slotsPerWorkingDay = Math.floor(usable / slotDuration);
    if (slotsPerWorkingDay <= 0) return 0;

    let slots = 0;
    const s = new Date(`${dayCursorStart}T00:00:00`);
    const e = new Date(`${dayCursorEnd}T00:00:00`);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    for (let cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
      const dow = cur.getDay();
      if ((sch.weekly_off_days || []).includes(dow)) continue;
      slots += slotsPerWorkingDay;
    }
    return slots;
  };

  const summaries = doctorRows.map((doctor) => {
    const doctorId = parseInt(doctor.id, 10);
    const dept = deptById.get(parseInt(doctor.department_id, 10)) || {};
    const specialization = String(doctor.specialization || dept.name || 'General').trim();

    const allDoctorAppointments = (db.appointments || [])
      .filter(a => parseInt(a.doctor_id, 10) === doctorId)
      .sort((a, b) => `${String(a.date || '')} ${String(a.time || '')}`.localeCompare(`${String(b.date || '')} ${String(b.time || '')}`));

    const appointments = allDoctorAppointments.filter(a => inRange(a.date));
    const totalVisits = appointments.length;
    const totalPatients = new Set(appointments.map(a => parseInt(a.patient_id, 10)).filter(Boolean)).size;
    const completedAppointments = appointments.filter(a => String(a.status || '') === 'Completed');
    const cancelledAppointments = appointments.filter(a => String(a.status || '') === 'Cancelled');
    const noShowAppointments = appointments.filter(a => String(a.status || '') === 'No-Show');
    const bookedSlots = appointments.filter(a => String(a.status || '') !== 'Cancelled').length;
    const totalSlots = countSlotsForDoctor(doctorId);
    const utilizationPercent = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;

    let newPatients = 0;
    let followUpPatients = 0;
    for (const apt of appointments) {
      const pid = parseInt(apt.patient_id, 10);
      if (!pid) continue;
      const aptKey = `${String(apt.date || '')} ${String(apt.time || '')} ${String(apt.created_at || '')}`;
      const hadPrevious = allDoctorAppointments.some(prev => parseInt(prev.patient_id, 10) === pid && `${String(prev.date || '')} ${String(prev.time || '')} ${String(prev.created_at || '')}` < aptKey);
      if (hadPrevious) followUpPatients += 1;
      else newPatients += 1;
    }

    const doctorBills = (db.bills || []).filter(b => parseInt(b.doctor_id, 10) === doctorId && inRange(b.created_at));
    const activeBills = doctorBills.filter(b => String(b.payment_status || '') !== 'Cancelled');
    let grossRevenue = 0;
    let totalDiscount = 0;
    let netRevenue = 0;

    const serviceMap = new Map();
    let totalServicesPerformed = 0;
    const registerService = (sid, qty, amount, fallbackName) => {
      const serviceId = parseInt(sid, 10);
      if (!serviceId) return;
      const svc = servicesById.get(serviceId) || {};
      const key = String(serviceId);
      if (!serviceMap.has(key)) {
        serviceMap.set(key, {
          service_id: serviceId,
          service_name: svc.name || fallbackName || `Service #${serviceId}`,
          count: 0,
          revenue: 0
        });
      }
      const row = serviceMap.get(key);
      row.count += qty;
      row.revenue = parseFloat((row.revenue + amount).toFixed(3));
      totalServicesPerformed += qty;
    };

    for (const bill of activeBills) {
      const discount = Math.max(0, parseFloat(bill.discount_amount || 0) || 0);
      const gross = Math.max(0, parseFloat(bill.subtotal != null ? bill.subtotal : ((parseFloat(bill.total || 0) || 0) + discount)) || 0);
      const net = Math.max(0, parseFloat(bill.total != null ? bill.total : (gross - discount)) || 0);
      grossRevenue += gross;
      totalDiscount += discount;
      netRevenue += net;

      const lineItems = Array.isArray(bill.line_items) ? bill.line_items : [];
      for (const li of lineItems) {
        const lineAmount = parseFloat(li.amount || 0) || 0;
        const qty = Math.max(1, parseFloat(li.qty || 1) || 1);
        const selected = Array.isArray(li.selected_service_ids) ? li.selected_service_ids.map(v => parseInt(v, 10)).filter(Boolean) : [];
        if (selected.length) {
          const each = selected.length ? lineAmount / selected.length : 0;
          selected.forEach((sid) => registerService(sid, 1, each, li.name));
          continue;
        }
        const sid = parseInt(li.service_id || li.ref_id, 10);
        if (sid) registerService(sid, qty, lineAmount, li.name);
      }
    }

    const doctorRefundRows = (db.refunds || []).filter((r) => {
      if (!inRange(r.created_at)) return false;
      const linkedBill = billById.get(parseInt(r.bill_id, 10));
      if (!linkedBill) return false;
      if (String(linkedBill.payment_status || '') === 'Cancelled') return false;
      return parseInt(linkedBill.doctor_id, 10) === doctorId;
    });
    const totalRefund = doctorRefundRows.reduce((sum, r) => sum + (parseFloat(r.refund_amount || 0) || 0), 0);
    const finalRevenue = netRevenue - totalRefund;

    let consultMinutesSum = 0;
    let consultCount = 0;
    const doctorSlotDuration = Math.max(1, parseInt(doctor.slot_duration || 30, 10));
    for (const apt of completedAppointments) {
      let minutes = 0;
      const linkedBill = activeBills.find(b => parseInt(b.appointment_id, 10) === parseInt(apt.id, 10));
      if (linkedBill && Array.isArray(linkedBill.line_items) && linkedBill.line_items.length) {
        for (const li of linkedBill.line_items) {
          const qty = Math.max(1, parseFloat(li.qty || 1) || 1);
          const sid = parseInt(li.service_id || li.ref_id, 10);
          if (sid && servicesById.has(sid)) {
            const dur = parseInt((servicesById.get(sid) || {}).duration_min || 0, 10) || 0;
            if (dur > 0) minutes += dur * qty;
          } else if (Array.isArray(li.selected_service_ids) && li.selected_service_ids.length) {
            for (const selSid of li.selected_service_ids) {
              const dur = parseInt((servicesById.get(parseInt(selSid, 10)) || {}).duration_min || 0, 10) || 0;
              if (dur > 0) minutes += dur;
            }
          }
        }
      }
      if (minutes <= 0) minutes = doctorSlotDuration;
      consultMinutesSum += minutes;
      consultCount += 1;
    }
    const avgConsultationTimeMin = consultCount > 0 ? (consultMinutesSum / consultCount) : 0;

    const appointmentLogs = (db.activity_logs || []).filter(l => String(l.module || '') === 'appointment' && parseInt(l.appointment_id, 10));
    let delaySum = 0;
    let delayCount = 0;
    for (const apt of appointments) {
      const aptDate = String(apt.date || '');
      const aptTime = String(apt.time || '').slice(0, 5);
      if (!aptDate || !aptTime) continue;
      const scheduled = new Date(`${aptDate}T${aptTime}:00`);
      if (isNaN(scheduled.getTime())) continue;
      const startLog = appointmentLogs.find(l => parseInt(l.appointment_id, 10) === parseInt(apt.id, 10) && ['arrived', 'completed'].includes(String(l.action || '')));
      if (!startLog || !startLog.created_at) continue;
      const actual = new Date(startLog.created_at);
      if (isNaN(actual.getTime())) continue;
      const delayMin = (actual.getTime() - scheduled.getTime()) / 60000;
      delaySum += delayMin;
      delayCount += 1;
    }
    const avgDelayMin = delayCount > 0 ? (delaySum / delayCount) : 0;

    const followUps = (db.follow_ups || []).filter(f => parseInt(f.doctor_id, 10) === doctorId);
    const followUpsAdvised = followUps.filter(f => inRange(f.created_at || f.due_date)).length;
    const followUpsCompleted = followUps.filter(f => String(f.status || '') === 'Completed' && inRange(f.completed_at || f.updated_at || f.due_date)).length;
    const followUpConversionPercent = followUpsAdvised > 0 ? (followUpsCompleted / followUpsAdvised) * 100 : 0;

    const feedback = feedbackRows.filter(f => parseInt(f.doctor_id, 10) === doctorId && inRange(f.created_at || f.date || today()));
    const totalReviews = feedback.length;
    const avgRating = totalReviews
      ? feedback.reduce((sum, f) => sum + (parseFloat(f.rating || f.stars || f.score || 0) || 0), 0) / totalReviews
      : 0;
    const comments = feedback
      .map(f => String(f.comment || f.notes || '').trim())
      .filter(Boolean)
      .slice(0, 20);

    const riskFlags = [];
    const discountPercent = grossRevenue > 0 ? (totalDiscount / grossRevenue) * 100 : 0;
    const refundPercent = netRevenue > 0 ? (totalRefund / netRevenue) * 100 : 0;
    const retentionPercent = totalVisits > 0 ? (followUpPatients / totalVisits) * 100 : 0;
    const cancellationRatePercent = totalVisits > 0 ? (cancelledAppointments.length / totalVisits) * 100 : 0;
    if (discountPercent > discountThreshold) riskFlags.push(`High Discount (${discountPercent.toFixed(1)}%)`);
    if (refundPercent > refundThreshold) riskFlags.push(`High Refund (${refundPercent.toFixed(1)}%)`);
    if (retentionPercent < retentionThreshold) riskFlags.push(`Low Retention (${retentionPercent.toFixed(1)}%)`);
    if (cancellationRatePercent > cancellationThreshold) riskFlags.push(`High Cancellation (${cancellationRatePercent.toFixed(1)}%)`);

    const commission = !commissionEnabled
      ? 0
      : (commissionType === 'fixed_per_service'
        ? totalServicesPerformed * commissionValue
        : (netRevenue * commissionValue / 100));

    const revenueBucket = new Map();
    for (const bill of activeBills) {
      const label = bucketLabel(bill.created_at);
      if (!label) continue;
      if (!revenueBucket.has(label)) revenueBucket.set(label, { label, net_revenue: 0, total_refund: 0, final_revenue: 0 });
      const row = revenueBucket.get(label);
      row.net_revenue += parseFloat(bill.total || 0) || 0;
      row.final_revenue += parseFloat(bill.total || 0) || 0;
    }
    for (const r of doctorRefundRows) {
      const label = bucketLabel(r.created_at);
      if (!label) continue;
      if (!revenueBucket.has(label)) revenueBucket.set(label, { label, net_revenue: 0, total_refund: 0, final_revenue: 0 });
      const row = revenueBucket.get(label);
      const amt = parseFloat(r.refund_amount || 0) || 0;
      row.total_refund += amt;
      row.final_revenue -= amt;
    }
    const revenueTrend = Array.from(revenueBucket.values())
      .sort((a, b) => String(a.label).localeCompare(String(b.label)))
      .map(r => ({
        label: r.label,
        net_revenue: parseFloat(r.net_revenue.toFixed(3)),
        total_refund: parseFloat(r.total_refund.toFixed(3)),
        final_revenue: parseFloat(r.final_revenue.toFixed(3))
      }));

    const patientBucket = new Map();
    for (const apt of appointments.filter(a => !['Cancelled', 'No-Show'].includes(String(a.status || '')))) {
      const label = bucketLabel(apt.date);
      if (!label) continue;
      if (!patientBucket.has(label)) patientBucket.set(label, { label, visits: 0, set: new Set() });
      const row = patientBucket.get(label);
      row.visits += 1;
      const pid = parseInt(apt.patient_id, 10);
      if (pid) row.set.add(pid);
    }
    const patientTrend = Array.from(patientBucket.values())
      .sort((a, b) => String(a.label).localeCompare(String(b.label)))
      .map(r => ({ label: r.label, visits: r.visits, patients: r.set.size }));

    const serviceDistribution = Array.from(serviceMap.values())
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 10)
      .map(s => ({ ...s, count: parseFloat(s.count.toFixed(3)), revenue: parseFloat(s.revenue.toFixed(3)) }));
    const topServices = serviceDistribution.slice(0, 5);
    const highValueServices = [...serviceDistribution].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      doctor_id: doctorId,
      doctor_name: doctor.name || doctor.username || `Doctor #${doctorId}`,
      specialization,
      total_patients: totalPatients,
      total_visits: totalVisits,
      new_patients: newPatients,
      follow_up_patients: followUpPatients,
      total_slots: totalSlots,
      booked_slots: bookedSlots,
      completed_appointments: completedAppointments.length,
      cancelled_appointments: cancelledAppointments.length,
      no_show_appointments: noShowAppointments.length,
      utilization_percent: parseFloat(utilizationPercent.toFixed(2)),
      avg_consultation_time_min: parseFloat(avgConsultationTimeMin.toFixed(2)),
      avg_delay_min: parseFloat(avgDelayMin.toFixed(2)),
      gross_revenue: parseFloat(grossRevenue.toFixed(3)),
      total_discount: parseFloat(totalDiscount.toFixed(3)),
      net_revenue: parseFloat(netRevenue.toFixed(3)),
      total_refund: parseFloat(totalRefund.toFixed(3)),
      final_revenue: parseFloat(finalRevenue.toFixed(3)),
      total_services_performed: parseFloat(totalServicesPerformed.toFixed(3)),
      top_services: topServices,
      high_value_services: highValueServices,
      follow_ups_advised: followUpsAdvised,
      follow_ups_completed: followUpsCompleted,
      follow_up_conversion_percent: parseFloat(followUpConversionPercent.toFixed(2)),
      average_rating: parseFloat(avgRating.toFixed(2)),
      total_reviews: totalReviews,
      feedback_comments: comments,
      discount_percent: parseFloat(discountPercent.toFixed(2)),
      refund_percent: parseFloat(refundPercent.toFixed(2)),
      retention_percent: parseFloat(retentionPercent.toFixed(2)),
      cancellation_rate_percent: parseFloat(cancellationRatePercent.toFixed(2)),
      risk_flags: riskFlags,
      commission: parseFloat(commission.toFixed(3)),
      commission_meta: {
        enabled: commissionEnabled,
        type: commissionType,
        value: commissionValue
      },
      revenue_trend: revenueTrend,
      patient_trend: patientTrend,
      service_distribution: serviceDistribution
    };
  });

  const chartFocusDoctorId = queryDoctorId || (summaries[0] && summaries[0].doctor_id) || null;
  const chartFocus = summaries.find(r => parseInt(r.doctor_id, 10) === parseInt(chartFocusDoctorId, 10)) || (summaries[0] || null);
  const outputRows = isAccountant
    ? summaries.map(r => ({
        doctor_id: r.doctor_id,
        doctor_name: r.doctor_name,
        specialization: r.specialization,
        gross_revenue: r.gross_revenue,
        total_discount: r.total_discount,
        net_revenue: r.net_revenue,
        total_refund: r.total_refund,
        final_revenue: r.final_revenue,
        commission: r.commission,
        commission_meta: r.commission_meta
      }))
    : summaries;

  res.json({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    trend,
    metric_scope: isAccountant ? 'financial-only' : 'full',
    thresholds: {
      discount_threshold: discountThreshold,
      refund_threshold: refundThreshold,
      retention_threshold: retentionThreshold,
      cancellation_threshold: cancellationThreshold
    },
    filters: {
      doctors: doctorRows.map(d => ({ id: parseInt(d.id, 10), name: d.name || d.username || `Doctor #${d.id}` }))
    },
    summary: outputRows,
    chart_focus: chartFocus,
    generated_at: now()
  });
});

app.get('/api/reports/cancelled-bills', requireRole('admin','receptionist'), (req, res) => {
  const db = readDB();
  const { date_from, date_to } = req.query;

  let bills = (db.bills || []).filter(b => String(b.payment_status || '') === 'Cancelled');
  if (date_from) bills = bills.filter(b => String(b.cancelled_at || b.created_at || '').slice(0, 10) >= date_from);
  if (date_to) bills = bills.filter(b => String(b.cancelled_at || b.created_at || '').slice(0, 10) <= date_to);

  const byUser = {};
  const reasons = {};
  let totalCancelledAmount = 0;
  let totalSubtotal = 0;
  let totalDiscount = 0;

  const detailed = bills.map((b) => {
    const patient = (db.patients || []).find(p => p.id === b.patient_id) || {};
    const cancelledByUser = (db.users || []).find(u => u.id === b.cancelled_by) || {};
    const cancelledByName = cancelledByUser.name || cancelledByUser.username || 'Unknown';
    const subtotal = parseFloat(b.subtotal != null ? b.subtotal : b.total) || 0;
    const discountAmount = parseFloat(b.discount_amount || 0) || 0;
    const total = parseFloat(b.total || 0) || 0;
    const reason = String(b.cancellation_reason || '—').trim() || '—';

    totalCancelledAmount += total;
    totalSubtotal += subtotal;
    totalDiscount += discountAmount;

    if (!byUser[cancelledByName]) byUser[cancelledByName] = { count: 0, total: 0 };
    byUser[cancelledByName].count += 1;
    byUser[cancelledByName].total = parseFloat((byUser[cancelledByName].total + total).toFixed(3));

    reasons[reason] = (reasons[reason] || 0) + 1;

    return {
      id: b.id,
      bill_number: b.bill_number,
      visit_id: b.visit_id,
      patient_id: b.patient_id,
      patient_name: patient.name || '—',
      mr_number: patient.mr_number || '—',
      subtotal,
      discount_amount: discountAmount,
      total,
      payment_method: b.payment_method || '—',
      cancelled_at: b.cancelled_at || b.updated_at || b.created_at || '',
      cancelled_by: b.cancelled_by || null,
      cancelled_by_name: cancelledByName,
      cancellation_reason: reason,
      created_at: b.created_at || ''
    };
  });

  detailed.sort((a, b) => String(b.cancelled_at || '').localeCompare(String(a.cancelled_at || '')));

  res.json({
    cancelled_count: detailed.length,
    total_cancelled_amount: parseFloat(totalCancelledAmount.toFixed(3)),
    total_subtotal: parseFloat(totalSubtotal.toFixed(3)),
    total_discount: parseFloat(totalDiscount.toFixed(3)),
    by_user: byUser,
    top_reasons: Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count })),
    bills: detailed
  });
});

// ===================== Supplier Returns =====================

app.get('/api/store/supplier-returns', requirePermission('store.purchase'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const q = String(req.query.search || '').trim().toLowerCase();
  const from = String(req.query.from || '').slice(0, 10);
  const to   = String(req.query.to   || '').slice(0, 10);
  const supplierId = req.query.supplier_id ? parseInt(req.query.supplier_id, 10) : null;

  const supplierMap = new Map((db.store_suppliers || []).map(s => [parseInt(s.id), s]));
  const productMap  = new Map((db.store_products  || []).map(p => [parseInt(p.id), p]));
  const poMap       = new Map((db.store_purchase_orders || []).map(o => [parseInt(o.id), o]));
  const storeMap    = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id), s]));
  const userMap     = new Map((db.users || []).map(u => [parseInt(u.id), u]));

  let rows = (db.store_supplier_returns || []).map(r => {
    const sup  = supplierMap.get(parseInt(r.supplier_id)) || {};
    const po   = poMap.get(parseInt(r.purchase_order_id)) || {};
    const st   = storeMap.get(parseInt(r.store_id)) || {};
    const usr  = userMap.get(parseInt(r.created_by)) || {};
    return {
      ...r,
      supplier_name:  sup.name || '—',
      po_invoice:     po.invoice_number || '—',
      store_name:     st.name || '—',
      created_by_name: usr.name || usr.username || '—',
      items: (r.items || []).map(it => {
        const p = productMap.get(parseInt(it.product_id)) || {};
        return { ...it, product_name: it.product_name || p.name || `Product #${it.product_id}` };
      })
    };
  });

  if (supplierId) rows = rows.filter(r => parseInt(r.supplier_id) === supplierId);
  if (from) rows = rows.filter(r => String(r.return_date || r.created_at || '').slice(0, 10) >= from);
  if (to)   rows = rows.filter(r => String(r.return_date || r.created_at || '').slice(0, 10) <= to);
  if (q) {
    rows = rows.filter(r =>
      [r.return_no, r.supplier_name, r.po_invoice, r.return_reference, r.notes, r.return_type, r.store_name]
        .map(v => String(v || '').toLowerCase()).some(v => v.includes(q))
    );
  }

  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  res.json(rows);
});

app.get('/api/store/supplier-returns/:id', requirePermission('store.purchase'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const id = parseInt(req.params.id, 10);
  const r  = (db.store_supplier_returns || []).find(x => parseInt(x.id) === id);
  if (!r) return res.status(404).json({ error: 'Supplier return not found' });

  const supplierMap = new Map((db.store_suppliers || []).map(s => [parseInt(s.id), s]));
  const productMap  = new Map((db.store_products  || []).map(p => [parseInt(p.id), p]));
  const poMap       = new Map((db.store_purchase_orders || []).map(o => [parseInt(o.id), o]));
  const storeMap    = new Map((db.store_sub_stores || []).map(s => [parseInt(s.id), s]));
  const sup  = supplierMap.get(parseInt(r.supplier_id)) || {};
  const po   = poMap.get(parseInt(r.purchase_order_id)) || {};
  const st   = storeMap.get(parseInt(r.store_id)) || {};
  res.json({
    ...r,
    supplier_name: sup.name || '—',
    po_invoice: po.invoice_number || '—',
    store_name: st.name || '—',
    items: (r.items || []).map(it => {
      const p = productMap.get(parseInt(it.product_id)) || {};
      return { ...it, product_name: it.product_name || p.name || `Product #${it.product_id}` };
    })
  });
});

app.post('/api/store/supplier-returns', requirePermission('store.purchase'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const body = req.body || {};
  const poId = parseInt(body.purchase_order_id, 10);
  if (!poId) return res.status(400).json({ error: 'Purchase order is required' });

  const po = (db.store_purchase_orders || []).find(x => parseInt(x.id) === poId);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });
  if (String(po.status || '').toLowerCase() !== 'received') {
    return res.status(400).json({ error: 'Can only return items from a Received purchase order' });
  }

  const storeId = parseInt(po.received_store_id || (db.store_sub_stores.find(s => s.is_main) || {}).id);
  const store = (db.store_sub_stores || []).find(s => parseInt(s.id) === storeId);
  if (!store || store.active === false) return res.status(400).json({ error: 'Source store not found or inactive' });

  const inputItems = Array.isArray(body.items) ? body.items : [];
  if (!inputItems.length) return res.status(400).json({ error: 'At least one item is required' });

  const productMap = new Map((db.store_products || []).map(p => [parseInt(p.id), p]));

  const returnItems = [];
  for (const it of inputItems) {
    const pid = parseInt(it.product_id, 10);
    if (!pid) return res.status(400).json({ error: 'Each item must have a product_id' });
    const qty = parseFloat(it.qty);
    if (!(qty > 0)) return res.status(400).json({ error: `Return quantity must be > 0 for product #${pid}` });

    const poItem = (po.items || []).find(i => parseInt(i.product_id) === pid);
    if (!poItem) return res.status(400).json({ error: `Product #${pid} was not in the original purchase order` });

    const baseQty = parseFloat(it.base_qty || qty);
    const stock = getStock(db, pid, storeId);
    const available = parseFloat(stock.qty || 0) || 0;
    const product = productMap.get(pid) || {};
    if (available < baseQty) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name || `Product #${pid}`}: available ${available.toFixed(3)}, requested ${baseQty.toFixed(3)}` });
    }

    const costPrice = parseFloat(it.cost_price || poItem.cost_price || stock.avg_cost || 0);
    returnItems.push({
      product_id: pid,
      product_name: product.name || `Product #${pid}`,
      qty: parseFloat(qty.toFixed(3)),
      base_qty: parseFloat(baseQty.toFixed(3)),
      cost_price: parseFloat(costPrice.toFixed(3)),
      line_total: parseFloat((baseQty * costPrice).toFixed(3))
    });
  }

  // Deduct stock for each returned item
  for (const it of returnItems) {
    const stock = getStock(db, it.product_id, storeId);
    stock.qty = parseFloat((stock.qty - it.base_qty).toFixed(3));
  }

  const totalAmount = parseFloat(returnItems.reduce((s, i) => s + i.line_total, 0).toFixed(3));
  const id = nextId(db, 'store_supplier_returns');
  const returnNo = `SR-${String(id).padStart(6, '0')}`;
  const returnType = String(body.return_type || 'partial').trim();
  const actor = (req.session && req.session.user) || {};

  const entry = {
    id,
    return_no: returnNo,
    purchase_order_id: poId,
    supplier_id: parseInt(po.supplier_id),
    store_id: storeId,
    return_type: returnType,
    return_date: String(body.return_date || today()).slice(0, 10),
    return_reference: String(body.return_reference || '').trim(),
    notes: String(body.notes || '').trim(),
    items: returnItems,
    total_amount: totalAmount,
    status: 'Completed',
    created_by: actor.id || null,
    created_at: now(),
    updated_at: now()
  };

  db.store_supplier_returns.push(entry);
  logActivity(db, req, {
    module: 'store',
    action: 'supplier_return_created',
    entity_type: 'store_supplier_return',
    entity_id: id,
    notes: `Supplier return ${returnNo} (${returnType}) for PO ${po.invoice_number || `#${poId}`} — KD ${totalAmount.toFixed(3)}`,
    meta: { return_no: returnNo, po_id: poId, supplier_id: entry.supplier_id, total_amount: totalAmount }
  });
  writeDB(db);
  res.json(entry);
});

app.delete('/api/store/supplier-returns/:id', requireRole('admin'), (req, res) => {
  const db = readDB(); ensureStore(db);
  const id = parseInt(req.params.id, 10);
  const r  = (db.store_supplier_returns || []).find(x => parseInt(x.id) === id);
  if (!r) return res.status(404).json({ error: 'Supplier return not found' });
  if (r.voided) return res.status(400).json({ error: 'Already voided' });

  // Restore stock
  for (const it of (r.items || [])) {
    const pid = parseInt(it.product_id);
    const baseQty = parseFloat(it.base_qty || it.qty || 0);
    if (pid > 0 && baseQty > 0) {
      const stock = getStock(db, pid, parseInt(r.store_id));
      const costPrice = parseFloat(it.cost_price || 0);
      stock.avg_cost = computeWac(stock.qty, stock.avg_cost, baseQty, costPrice);
      stock.qty = parseFloat((stock.qty + baseQty).toFixed(3));
    }
  }

  db.store_supplier_returns = db.store_supplier_returns.filter(x => parseInt(x.id) !== id);
  logActivity(db, req, {
    module: 'store',
    action: 'supplier_return_voided',
    entity_type: 'store_supplier_return',
    entity_id: id,
    notes: `Supplier return ${r.return_no} voided — stock restored`,
    meta: { return_no: r.return_no, po_id: r.purchase_order_id }
  });
  writeDB(db);
  res.json({ success: true });
});

// ===================== SPA fallback =====================
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, () => {
  console.log(`\nClinic Management System -> http://localhost:${PORT}`);
  console.log(`Logins: admin/admin123  |  doctor1/doctor123  |  receptionist1/recep123\n`);

  // Periodic WAL checkpoint every 10 minutes to prevent WAL from growing too large
  setInterval(() => {
    try {
      sqlite.pragma('wal_checkpoint(PASSIVE)');
    } catch (e) {
      // Non-fatal — skip if busy
    }
  }, 10 * 60 * 1000);
});
