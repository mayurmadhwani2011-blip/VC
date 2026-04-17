const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'clinic-data.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '-');
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data directory not found: ${DATA_DIR}`);
  }
  if (!fs.existsSync(SQLITE_FILE)) {
    throw new Error(`SQLite file not found: ${SQLITE_FILE}`);
  }
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const backupId = `db-backup-${stamp()}`;
  const outDir = path.join(BACKUP_DIR, backupId);
  fs.mkdirSync(outDir, { recursive: true });

  const sqliteOut = path.join(outDir, 'clinic-data.sqlite');
  const jsonOut = path.join(outDir, 'clinic-data.json');
  const manifestOut = path.join(outDir, 'manifest.json');

  const sqlite = new Database(SQLITE_FILE, { readonly: true });
  const row = sqlite.prepare('SELECT data FROM app_state WHERE id = 1').get();
  const state = row && row.data ? JSON.parse(row.data) : {};
  await sqlite.backup(sqliteOut);
  sqlite.close();

  fs.writeFileSync(jsonOut, JSON.stringify(state, null, 2), 'utf8');

  const manifest = {
    backup_id: backupId,
    created_at: new Date().toISOString(),
    created_by: 'npm backup:db',
    files: {
      sqlite: 'clinic-data.sqlite',
      json: 'clinic-data.json'
    },
    counts: {
      users: Array.isArray(state.users) ? state.users.length : 0,
      patients: Array.isArray(state.patients) ? state.patients.length : 0,
      appointments: Array.isArray(state.appointments) ? state.appointments.length : 0,
      prescriptions: Array.isArray(state.prescriptions) ? state.prescriptions.length : 0,
      bills: Array.isArray(state.bills) ? state.bills.length : 0,
      services: Array.isArray(state.services) ? state.services.length : 0,
      discounts: Array.isArray(state.discounts) ? state.discounts.length : 0
    }
  };

  fs.writeFileSync(manifestOut, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Backup created: ${outDir}`);
  console.log(`SQLite: ${sqliteOut}`);
  console.log(`JSON: ${jsonOut}`);
}

main().catch((err) => {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
});
