// Registers the Clinic App as a Windows Service using node-windows
// Run once during installation: node scripts/register-service.js

const path = require('path');
const Service = require('node-windows').Service;

const installDir = process.env.CLINIC_INSTALL_DIR
  ? path.resolve(process.env.CLINIC_INSTALL_DIR)
  : path.resolve(__dirname, '..');
const serviceName = process.env.CLINIC_SERVICE_NAME || 'ClinicManagementSystem';
const serviceDescription = process.env.CLINIC_SERVICE_DESCRIPTION || 'Clinic Management System - Web Server on port 5050';
const port = String(process.env.CLINIC_PORT || process.env.PORT || '5050');
const githubToken = String(process.env.CLINIC_GITHUB_TOKEN || '').trim();
const githubOwner = String(process.env.CLINIC_GITHUB_OWNER || 'mayurmadhwani2011-blip').trim();
const githubRepo = String(process.env.CLINIC_GITHUB_REPO || 'CMS').trim();

const svc = new Service({
  name: serviceName,
  description: serviceDescription,
  script: path.join(installDir, 'server.js'),
  workingDirectory: installDir,
  env: [
    { name: 'PORT', value: port },
    { name: 'NODE_ENV', value: 'production' },
    { name: 'CLINIC_INSTALL_DIR', value: installDir },
    { name: 'CLINIC_GITHUB_OWNER', value: githubOwner },
    { name: 'CLINIC_GITHUB_REPO', value: githubRepo },
    { name: 'CLINIC_GITHUB_TOKEN', value: githubToken }
  ],
  maxRetries: 5,
  wait: 2,
  grow: 0.5
});

svc.on('install', function () {
  console.log(`Service installed successfully at ${installDir}.`);
  svc.start();
  console.log('Service started.');
});

svc.on('alreadyinstalled', function () {
  console.log('Service already installed. Starting...');
  svc.start();
});

svc.on('start', function () {
  console.log(`Clinic service is running on http://localhost:${port}`);
});

svc.on('error', function (err) {
  console.error('Service error:', err);
  process.exit(1);
});

svc.install();
