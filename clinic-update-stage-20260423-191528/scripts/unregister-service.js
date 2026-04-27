// Removes the Clinic App Windows Service
// Run during uninstall: node scripts/unregister-service.js

const path = require('path');
const Service = require('node-windows').Service;

const installDir = process.env.CLINIC_INSTALL_DIR
  ? path.resolve(process.env.CLINIC_INSTALL_DIR)
  : path.resolve(__dirname, '..');
const serviceName = process.env.CLINIC_SERVICE_NAME || 'ClinicManagementSystem';

const svc = new Service({
  name: serviceName,
  script: path.join(installDir, 'server.js')
});

svc.on('uninstall', function () {
  console.log('Service uninstalled successfully.');
  process.exit(0);
});

svc.on('error', function (err) {
  console.error('Error:', err);
  process.exit(1);
});

svc.uninstall();
