let currentSystem = null;
let _whatsappWin = null;
function openWhatsApp(phone) {
  const clean = String(phone).replace(/[^0-9]/g, '');
  window.location.href = 'whatsapp://send?phone=' + clean;
}
const API = (() => {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      return 'http://127.0.0.1:5000';
    }
  } catch (_) {}
  return '';
})();

function getTerminalId() {
  const key = 'clinic-terminal-id';
  let id = '';
  try { id = String(localStorage.getItem(key) || '').trim(); } catch (_) { id = ''; }
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = `term-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    try { localStorage.setItem(key, id); } catch (_) {}
  }
  return id;
}

/* -------------------------------------------------------
  Clinic Management System - Frontend SPA (app.js)
  Modern UI with dark mode, skeleton loaders, toasts
  ------------------------------------------------------- */
let currentPageId = '';
let _pageRenderSeq = 0;
let _navOpenSection = localStorage.getItem('navOpenSection') || '';
let _navBadgeData = {};
let _navBadgeTimer = null;
let _openPageTabs = [];
let _activePageTab = '';
let _tabDragIndex = -1;

function beginPageRender(page) {
  currentPageId = page;
  _pageRenderSeq += 1;
  return _pageRenderSeq;
}

function isActivePageRender(page, seq) {
  return currentPageId === page && seq === _pageRenderSeq;
}

// --- Permission helper -----------------------------------
function can(perm) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (!Array.isArray(currentUser.permissions)) return false;
  return currentUser.permissions.includes(perm);
}

// --- SVG icon helpers ------------------------------------
const IC = {
  dashboard:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  patients:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  appointments: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  prescriptions:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6"/><path d="M12 9v6"/><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>',
  billing:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  expense:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 17V5a2 2 0 0 0-2-2H6"/><path d="M6 12h4"/></svg>',
  reports:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  users:        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  calendar:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  list:         '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  plus:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  search:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  edit:         '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  print:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  eye:          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  sun:          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon:         '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  chevLeft:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
  chevRight:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  check:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  x:            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  clock:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  rx:           '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h8a4 4 0 0 1 0 8H6z"/><path d="M6 10h4l6 10"/><path d="M14 14l4 6"/></svg>',
  empty:        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  apts:         '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  revenue:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  pending:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  hospital:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></svg>',
  scheduler:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  services:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  packages:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  setup:        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  store:        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  supplier:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="m16 8 4 4-4 4"/><path d="M19 12H9"/><path d="M1 18h22"/><path d="M5 21v-3"/><path d="M19 21v-3"/></svg>',
  transfer:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 8-4-4-4 4"/><path d="M14 4v10.5a2.5 2.5 0 0 1-5 0v-1"/><path d="m6 16 4 4 4-4"/><path d="M10 20V9.5a2.5 2.5 0 0 1 5 0v1"/></svg>',
  product:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  discount:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M21 3h-4"/><path d="M21 21h-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><line x1="17" y1="3" x2="21" y2="3"/><line x1="17" y1="21" x2="21" y2="21"/><path d="m15 9-6 6"/><circle cx="9.5" cy="9.5" r="0.5" fill="currentColor"/><circle cx="14.5" cy="14.5" r="0.5" fill="currentColor"/></svg>',
  refund:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
  supreturn:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  download:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
};

// --- Nav config - unified list filtered by permission ----
const NAV_ALL = [
  { section: 'Overview' },
  // WhatsApp Campaign nav item will be added after NAV_ALL declaration
  { id: 'dashboard',         label: 'Dashboard',          icon: IC.dashboard,      perm: 'dashboard.view',          roles: ['admin','doctor','receptionist'] },
  { section: 'Patients' },
  { id: 'patients',          label: 'Active Patient List', icon: IC.patients,       perm: 'patients.view',           roles: ['admin','doctor','receptionist'] },
  { id: 'appointments',      label: 'Appointments',        icon: IC.appointments,   perm: 'appointments.view',       roles: ['admin','receptionist'] },
  { id: 'appointments',      label: 'My Appointments',     icon: IC.appointments,   perm: 'appointments.view',       roles: ['doctor'] },
  { id: 'follow-ups',        label: 'Follow Ups',          icon: IC.clock,          perm: 'appointments.view',       roles: ['admin','doctor','receptionist'] },
  { id: 'scheduler',         label: 'Doctor Scheduler',    icon: IC.scheduler,      perm: 'scheduler.view',          roles: ['admin','doctor','receptionist'] },
  { id: 'patient-packages',  label: 'Patient Packages',    icon: IC.packages,       perm: 'patient_packages.view',   roles: ['admin','doctor','receptionist'] },
  { section: 'Clinical' },
  { id: 'prescriptions',     label: 'Prescriptions',       icon: IC.prescriptions,  perm: 'prescriptions.view',      roles: ['admin','doctor','receptionist'] },
  { section: 'Finance' },
  { id: 'billing',           label: 'Billing',             icon: IC.billing,        perm: 'billing.view',            roles: ['admin','receptionist'] },
  { id: 'expenses',          label: 'Expenses',            icon: IC.expense,        perm: 'expenses.view',           roles: ['admin','receptionist'] },
  { id: 'discount-master',   label: 'Discounts',           icon: IC.discount,       perm: 'billing.discount.view',   roles: ['admin','receptionist'] },
  { section: 'Reports' },
  { id: 'reports',           label: 'Reports',             icon: IC.reports,        perm: 'reports.view',            roles: ['admin','doctor','receptionist'] },
  { section: 'Settings' },
  { id: 'users',             label: 'Manage Users',        icon: IC.users,          perm: 'users.view',              roles: ['admin'] },
  { id: 'role-permissions',  label: 'Role Permissions',    icon: IC.setup,          perm: 'role_permissions.view',   roles: ['admin'] },
  { id: 'owner-control',     label: 'Owner Control',       icon: IC.hospital,       perm: 'setup.view',              roles: ['admin'] },
  { id: 'setup',             label: 'Setup',               icon: IC.setup,          perm: 'setup.view',              roles: ['admin'] },
  { section: 'Catalog' },
  { id: 'services',          label: 'Services',             icon: IC.services,       perm: 'services.view',           roles: ['admin','receptionist'] },
  { id: 'packages',          label: 'Packages',             icon: IC.packages,       perm: 'packages.view',           roles: ['admin','receptionist'] },
  { section: 'Store' },
  { id: 'store',             label: 'Store Overview',       icon: IC.store,          perm: 'store.view',              roles: ['admin','doctor','receptionist'] },
  { id: 'store-products',    label: 'Products',             icon: IC.product,        perm: 'store.view',              roles: ['admin','receptionist'] },
  { id: 'store-suppliers',   label: 'Suppliers',            icon: IC.supplier,       perm: 'store.manage',            roles: ['admin'] },
  { id: 'store-purchase',    label: 'Purchase Orders',      icon: IC.billing,        perm: 'store.purchase',          roles: ['admin','receptionist'] },
  { id: 'store-transfers',   label: 'Stock Transfers',      icon: IC.transfer,       perm: 'store.transfer',          roles: ['admin','receptionist'] },
  { id: 'store-adjustments', label: 'Stock Adjustment',     icon: IC.transfer,       perm: 'store.adjust',            roles: ['admin','receptionist'] },
  { id: 'store-consumption', label: 'Manual Consumption',   icon: IC.product,        perm: 'store.consume',           roles: ['admin','doctor','receptionist'] },
  { id: 'store-sub-stores',  label: 'Sub-Stores',           icon: IC.store,          perm: 'store.manage',            roles: ['admin'] },
  { id: 'store-supplier-returns', label: 'Supplier Returns', icon: IC.supreturn,      perm: 'store.purchase',          roles: ['admin','receptionist'] },
];
// Add WhatsApp Campaign to admin nav (after NAV_ALL is declared)


// Page id ? required view permission
const PAGE_PERM = {
  dashboard: 'dashboard.view', patients: 'patients.view',
  appointments: 'appointments.view', 'follow-ups': 'appointments.view', scheduler: 'scheduler.view',
  'patient-packages': 'patient_packages.view', prescriptions: 'prescriptions.view',
  billing: 'billing.view', expenses: 'expenses.view', 'discount-master': 'billing.discount.view', reports: 'reports.view',
  users: 'users.view', 'role-permissions': 'role_permissions.view',
  'owner-control': 'setup.view', setup: 'setup.view', services: 'services.view', packages: 'packages.view',
  store: 'store.view', 'store-products': 'store.view', 'store-suppliers': 'store.manage',
  'store-purchase': 'store.purchase', 'store-transfers': 'store.transfer', 'store-adjustments': 'store.adjust', 'store-consumption': 'store.consume', 'store-sub-stores': 'store.manage',
  'store-supplier-returns': 'store.purchase',
};

const PAGE_TITLES = {
  dashboard: ['Dashboard', 'Overview of today\'s activity'],
  patients: ['Active Patient List', 'Today\'s patients and old-patient search'],
  appointments: ['Appointments', 'Schedule and manage appointments'],
  'follow-ups': ['Follow Ups', 'Track patient return visits and reminders'],
  scheduler: ['Doctor Scheduler', 'Daily schedule view by doctor'],
  prescriptions: ['Prescriptions', 'View and create prescriptions'],
  billing: ['Billing', 'Manage bills and payments'],
  expenses: ['Expenses', 'Track day-to-day clinic expenses'],
  reports: ['Reports', 'View clinic reports and analytics'],
  users: ['Manage Users', 'Add and manage system users'],
  services: ['Services', 'Manage clinic services and pricing'],
  packages: ['Packages', 'Manage service bundles and packages'],
  'owner-control': ['Owner Control', 'Clinic profile, subscription, backup, restore, and reset controls'],
  setup: ['Setup', 'Clinic configuration, payment methods, and printer settings'],
  'patient-packages': ['Patient Packages', 'All patient package subscriptions'],
  'role-permissions': ['Role Permissions', 'Configure access control per role'],
  store: ['Store Overview', 'Stock levels across all stores'],
  'store-products': ['Products', 'Manage product catalog'],
  'store-suppliers': ['Suppliers', 'Manage product suppliers'],
  'store-purchase': ['Purchase Orders', 'Buy products from suppliers'],
  'store-transfers': ['Stock Transfers', 'Move stock between stores'],
  'store-adjustments': ['Stock Adjustment', 'Adjust stock in and out with reason tracking'],
  'store-consumption': ['Manual Consumption', 'Consume stock manually with cost tracking'],
  'store-sub-stores': ['Sub-Stores', 'Manage store locations'],
  'store-supplier-returns': ['Supplier Returns', 'Return items to suppliers from received purchase orders'],
};

function getAccessibleNavPages() {
  if (!currentUser) return [];
  const isCustomRole = !['admin','doctor','receptionist'].includes(currentUser.role);
  const seen = new Set();
  const pages = [];
  NAV_ALL.forEach(item => {
    if (!item || item.section || !item.id) return;
    if (!isCustomRole && item.roles && !item.roles.includes(currentUser.role)) return;
    if (item.perm && !can(item.perm)) return;
    if (seen.has(item.id)) return;
    seen.add(item.id);
    pages.push(item.id);
  });
  return pages;
}

function getPageDisplayLabel(pageId) {
  if (PAGE_TITLES[pageId] && PAGE_TITLES[pageId][0]) return PAGE_TITLES[pageId][0];
  const fromNav = NAV_ALL.find(i => i && i.id === pageId && i.label);
  return fromNav ? fromNav.label : pageId;
}

function _normalizeTab(item) {
  if (typeof item === 'string') return { id: item, pinned: false };
  if (item && typeof item === 'object' && item.id) return { id: item.id, pinned: !!item.pinned };
  return null;
}

function _canCloseTab(pageId) {
  const tab = _openPageTabs.find(t => t.id === pageId);
  if (!tab) return false;
  if (tab.pinned) return false;
  return _openPageTabs.length > 1;
}

function _sortPinnedTabsFirst() {
  const indexed = _openPageTabs.map((tab, idx) => ({ tab, idx }));
  indexed.sort((a, b) => {
    if (!!a.tab.pinned === !!b.tab.pinned) return a.idx - b.idx;
    return a.tab.pinned ? -1 : 1;
  });
  _openPageTabs = indexed.map(x => x.tab);
}

function persistPageTabsState() {
  try {
    localStorage.setItem('openPageTabs', JSON.stringify(_openPageTabs));
    localStorage.setItem('activePageTab', _activePageTab || '');
  } catch (_) {}
}

function loadPageTabsState(defaultPage = '') {
  const allowed = new Set(getAccessibleNavPages());
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('openPageTabs') || '[]'); } catch (_) { saved = []; }
  _openPageTabs = Array.isArray(saved)
    ? saved.map(_normalizeTab).filter(Boolean).filter(t => allowed.has(t.id))
    : [];
  if (defaultPage && allowed.has(defaultPage) && !_openPageTabs.some(t => t.id === defaultPage)) {
    _openPageTabs.push({ id: defaultPage, pinned: false });
  }
  if (!_openPageTabs.length) {
    const firstAllowed = [...allowed][0];
    if (firstAllowed) _openPageTabs = [{ id: firstAllowed, pinned: false }];
  }
  _sortPinnedTabsFirst();
  _activePageTab = localStorage.getItem('activePageTab') || defaultPage || (_openPageTabs[0]?.id || '');
  if (_activePageTab && !_openPageTabs.some(t => t.id === _activePageTab)) _activePageTab = _openPageTabs[_openPageTabs.length - 1]?.id || '';
  persistPageTabsState();
}

function ensurePageTab(pageId) {
  if (!pageId) return;
  if (!_openPageTabs.some(t => t.id === pageId)) _openPageTabs.push({ id: pageId, pinned: false });
  _sortPinnedTabsFirst();
  _activePageTab = pageId;
  persistPageTabsState();
}

function togglePinPageTab(pageId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const idx = _openPageTabs.findIndex(t => t.id === pageId);
  if (idx < 0) return;
  _openPageTabs[idx].pinned = !_openPageTabs[idx].pinned;
  _sortPinnedTabsFirst();
  persistPageTabsState();
  renderPageTabs();
}

function handleTabAuxClick(event, pageId) {
  if (!event || event.button !== 1) return;
  event.preventDefault();
  closePageTab(pageId, event, { middleClick: true });
}

function onTabDragStart(index, event) {
  _tabDragIndex = index;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function onTabDragOver(index, event) {
  if (!event) return;
  event.preventDefault();
  const tabEl = event.currentTarget;
  if (tabEl) tabEl.classList.add('drag-over');
}

function onTabDragLeave(event) {
  const tabEl = event?.currentTarget;
  if (tabEl) tabEl.classList.remove('drag-over');
}

function onTabDrop(index, event) {
  if (event) event.preventDefault();
  const tabEl = event?.currentTarget;
  if (tabEl) tabEl.classList.remove('drag-over');
  let from = _tabDragIndex;
  if (from < 0 && event?.dataTransfer) {
    const raw = parseInt(event.dataTransfer.getData('text/plain') || '-1', 10);
    if (!Number.isNaN(raw)) from = raw;
  }
  if (from < 0 || from === index || from >= _openPageTabs.length || index >= _openPageTabs.length) {
    _tabDragIndex = -1;
    return;
  }
  const moved = _openPageTabs.splice(from, 1)[0];
  const targetIndex = from < index ? index - 1 : index;
  _openPageTabs.splice(targetIndex, 0, moved);
  _sortPinnedTabsFirst();
  persistPageTabsState();
  renderPageTabs();
  _tabDragIndex = -1;
}

function onTabDragEnd() {
  _tabDragIndex = -1;
  document.querySelectorAll('.page-tab.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function renderPageTabs() {
  const wrap = document.getElementById('pageTabs');
  if (!wrap) return;
  if (!currentUser || !_openPageTabs.length) {
    wrap.innerHTML = '';
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  wrap.innerHTML = _openPageTabs.map((tab, idx) => {
    const pageId = tab.id;
    const active = _activePageTab === pageId;
    const canClose = _canCloseTab(pageId);
    return `<button class="page-tab ${active ? 'active' : ''} ${tab.pinned ? 'pinned' : ''}" role="tab" aria-selected="${active ? 'true' : 'false'}" draggable="true" ondragstart="onTabDragStart(${idx}, event)" ondragover="onTabDragOver(${idx}, event)" ondragleave="onTabDragLeave(event)" ondrop="onTabDrop(${idx}, event)" ondragend="onTabDragEnd()" onauxclick="handleTabAuxClick(event, '${pageId}')" onclick="navigate('${pageId}')" title="${escHtml(getPageDisplayLabel(pageId))}">
      <span class="page-tab-label">${escHtml(getPageDisplayLabel(pageId))}</span>
      <span class="page-tab-pin ${tab.pinned ? 'active' : ''}" onclick="togglePinPageTab('${pageId}', event)" title="${tab.pinned ? 'Unpin tab' : 'Pin tab'}">PIN</span>
      ${canClose ? `<span class="page-tab-close" onclick="closePageTab('${pageId}', event)" aria-label="Close tab">&times;</span>` : ''}
    </button>`;
  }).join('');
}

function closePageTab(pageId, event, meta = {}) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const idx = _openPageTabs.findIndex(t => t.id === pageId);
  if (idx < 0) return;
  if (!_canCloseTab(pageId)) return;
  const wasActive = _activePageTab === pageId;
  _openPageTabs.splice(idx, 1);
  if (wasActive) {
    const fallback = _openPageTabs[Math.min(idx, _openPageTabs.length - 1)]?.id || _openPageTabs[0]?.id || '';
    _activePageTab = fallback;
  }
  persistPageTabsState();
  renderPageTabs();
  if (wasActive && _activePageTab) navigate(_activePageTab);
}

// --- API helper ------------------------------------------
async function apiFetch(url, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 15000);
  const bases = [];
  const pushBase = (b) => {
    const key = String(b || '');
    if (!bases.includes(key)) bases.push(key);
  };
  pushBase(API);
  pushBase('');
  try {
    if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol || '')) {
      pushBase(window.location.origin || '');
    }
  } catch (_) {}
  pushBase('http://127.0.0.1:5000');
  pushBase('http://localhost:5000');

  let res;
  let lastErr = null;
  for (const base of bases) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      res = await fetch(base + url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Terminal-Id': getTerminalId(),
          ...(opts.headers || {})
        },
        signal: controller ? controller.signal : undefined,
        ...opts,
      });
      if (timer) clearTimeout(timer);
      lastErr = null;
      break;
    } catch (e) {
      if (timer) clearTimeout(timer);
      lastErr = e;
    }
  }
  if (!res) {
    if (lastErr && String(lastErr.name || '').toLowerCase() === 'aborterror') {
      throw new Error('Request timed out. Please check Clinic service and try again.');
    }
    throw (lastErr || new Error('Network request failed'));
  }
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = { raw };
    }
  }
  if (!res.ok && data && data.code === 'LICENSE_BLOCKED') {
    if (data.system) {
      currentSystem = data.system;
      applyClinicBranding();
      renderAccessLockScreen();
    }
  }
  if (!res.ok) {
    const fallback = typeof data.raw === 'string' && data.raw.trim()
      ? data.raw.trim().replace(/\s+/g, ' ').slice(0, 220)
      : '';
    const msg = data.error || fallback || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function isSystemBlockedForCurrentUser() {
  if (!currentSystem) return false;
  if (currentSystem.blocked && currentUser?.role !== 'admin') return true;
  if (currentSystem.setup_required && currentUser?.role !== 'admin') return true;
  return false;
}

function applyClinicBranding() {
  const clinicName = (currentSystem && currentSystem.clinic && currentSystem.clinic.clinic_name) ? currentSystem.clinic.clinic_name : 'ClinicMS';
  const tradeName = (currentSystem && currentSystem.clinic && currentSystem.clinic.trade_name) ? currentSystem.clinic.trade_name : 'Clinic Management System';

  document.title = `${clinicName} - ${tradeName}`;
  const loginNameEl = document.getElementById('loginClinicName');
  if (loginNameEl) loginNameEl.textContent = clinicName;
  const loginSubEl = document.getElementById('loginClinicSub');
  if (loginSubEl) loginSubEl.textContent = tradeName;
  const topbarClinicEl = document.getElementById('topbarClinicName');
  if (topbarClinicEl) topbarClinicEl.textContent = clinicName;
}

function renderAccessLockScreen() {
  const ca = document.getElementById('contentArea');
  if (!ca) return;
  const status = currentSystem?.subscription?.status || 'blocked';
  const endDate = currentSystem?.subscription?.plan === 'trial'
    ? (currentSystem?.subscription?.trial_end || 'N/A')
    : (currentSystem?.subscription?.subscription_end || 'N/A');
  const setupRequired = !!currentSystem?.setup_required;
  const isAdmin = currentUser?.role === 'admin';
  const title = setupRequired
    ? 'Clinic Setup Pending'
    : (status === 'suspended' ? 'Subscription Suspended' : 'Subscription Expired');
  const detail = setupRequired
    ? 'Admin must complete setup before other users can use the system.'
    : `Plan status: ${String(status).toUpperCase()} - End date: ${endDate}`;
  const cta = isAdmin
    ? `<button class="btn btn-primary" onclick="navigate('owner-control')">${IC.setup} Open Owner Setup</button>`
    : `<button class="btn" onclick="doLogout()">Sign Out</button>`;

  ca.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;padding:20px;">
      <div class="card" style="max-width:640px;width:100%;text-align:center;padding:26px;">
        <div style="font-size:42px;line-height:1;margin-bottom:10px">${IC.setup}</div>
        <div class="card-title" style="font-size:24px;margin-bottom:10px">${title}</div>
        <div class="text-muted" style="margin-bottom:18px">${detail}</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">${cta}</div>
      </div>
    </div>`;
}

// --- Toast notifications ---------------------------------
function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: IC.check, error: IC.x, info: IC.clock };
  el.innerHTML = `<span style="flex-shrink:0">${icons[type]||icons.info}</span><span>${escHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('toast-exit'); setTimeout(() => el.remove(), 300); }, 3500);
}

// Global DOB -> Age auto-fill for any form: when a date input named 'dob' changes,
// compute years and set the sibling 'age' input within the same form.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'INPUT' || el.type !== 'date' || el.name !== 'dob') return;
  const form = el.closest('form') || document;
  const ageEl = form.querySelector('input[name="age"]');
  if (!ageEl) return;
  const v = el.value;
  if (!v) { ageEl.value = ''; return; }
  const dob = new Date(v);
  if (isNaN(dob)) { ageEl.value = ''; return; }
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years--;
  ageEl.value = Math.max(0, years);
});

// --- Skeleton loaders ------------------------------------
function skeletonStats(n = 4) {
  return `<div class="stats-grid">${Array(n).fill('<div class="skeleton skeleton-stat"></div>').join('')}</div>`;
}
function skeletonTable(rows = 5) {
  return Array(rows).fill('<div class="skeleton skeleton-table-row"></div>').join('');
}

function toLocalDateTimeInputValue(value = new Date()) {
  const dt = value instanceof Date ? value : new Date(value);
  if (isNaN(dt)) return '';
  const local = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, d] = value.trim().split('-').map(Number);
    const dtOnly = new Date(y, (m || 1) - 1, d || 1);
    return dtOnly.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  const dt = new Date(value);
  if (isNaN(dt)) return String(value);
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function doctorDisplayName(d) {
  if (!d) return '';
  return d.department_name ? `${d.name} (${d.department_name})` : (d.name || '');
}

// --- Auth ------------------------------------------------
function fillDemo(u, p) {
  document.getElementById('loginUsername').value = u;
  document.getElementById('loginPassword').value = p;
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!username || !password) { showLoginError('Enter username and password'); return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.querySelector('span').textContent = 'Signing in-';
  btn.classList.add('loading');
  try {
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    // login returns minimal user; fetch /api/me to get permissions and full user info
    try {
      currentUser = await apiFetch('/api/me');
      currentSystem = currentUser?.system || null;
      applyClinicBranding();
    } catch (e) {
      console.error('Failed to fetch /api/me after login:', e.message || e);
      // fallback to returned user if /api/me unavailable
      currentUser = data.user;
    }
    startApp();
  } catch (e) {
    showLoginError(e.message);
  } finally {
    btn.disabled = false; btn.querySelector('span').textContent = 'Sign In';
    btn.classList.remove('loading');
  }
}
function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg; el.classList.remove('hidden');
}
async function doLogout() {
  await apiFetch('/api/logout', { method: 'POST' });
  currentUser = null;
  if (_navBadgeTimer) {
    clearInterval(_navBadgeTimer);
    _navBadgeTimer = null;
  }
  _resetAppState();
  try {
    localStorage.removeItem('openPageTabs');
    localStorage.removeItem('activePageTab');
  } catch (_) {}
  const dock = document.getElementById('quickDock');
  if (dock) dock.classList.add('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('loginPassword').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  // Always show login page and hide main app on load
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');

  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('loginUsername').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  // Restore theme
  const saved = localStorage.getItem('clinic-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcons();
  checkSession();
});

async function checkSession() {
  try {
    currentUser = await apiFetch('/api/me');
    currentSystem = currentUser?.system || null;
    applyClinicBranding();
    startApp();
  } catch {
    try {
      currentSystem = await apiFetch('/api/system/public-config');
      currentSystem = { clinic: currentSystem };
      applyClinicBranding();
    } catch (_) {}
  }
}

// --- Theme toggle ----------------------------------------
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('clinic-theme', next);
  updateThemeIcons();
}
function updateThemeIcons() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const icon = isDark ? IC.sun : IC.moon;
  ['themeIcon', 'themeIconTop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.outerHTML = `<span id="${id}">${icon}</span>`;
  });
}

// --- App bootstrap ---------------------------------------
function _resetAppState() {
  // Clear all module-level state so stale data from a previous user session never bleeds through
  try { _billingAll = []; } catch(e) {}
  try { _expenseRows = []; _expenseMeta = { categories: [], payment_methods: [] }; } catch(e) {}
  try { _billLineItems = []; _billPkgSessions = []; } catch(e) {}
  try { _reportView = 'daily'; } catch(e) {}
  try { _allRolesList = []; } catch(e) {}
  try { userStatusFilter = ''; } catch(e) {}
  try { window._billServices = []; window._billPackages = []; } catch(e) {}
  try { window._lastProductConsumptionRows = []; } catch(e) {}
  try { currentSystem = null; } catch(e) {}
  _openPageTabs = [];
  _activePageTab = '';
  // Clear content area immediately so the previous user's page is never visible
  const ca = document.getElementById('contentArea');
  if (ca) ca.innerHTML = '';
  const sideNav = document.getElementById('sideNav');
  if (sideNav) sideNav.innerHTML = '';
  const tabs = document.getElementById('pageTabs');
  if (tabs) tabs.innerHTML = '';
}

function startApp() {
  _resetAppState();
  currentSystem = currentUser?.system || currentSystem;
  applyClinicBranding();
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  if (isSystemBlockedForCurrentUser()) {
    buildNav();
    renderAccessLockScreen();
    return;
  }

  buildNav();
  const collapsed = localStorage.getItem('sidebarCollapsed') === '1';
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  refreshSidebarBadges();
  if (_navBadgeTimer) clearInterval(_navBadgeTimer);
  _navBadgeTimer = setInterval(refreshSidebarBadges, 60000);
  ensureQuickDock();
  registerGlobalShortcuts();

  // User badge in sidebar
  const initials = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('userBadge').innerHTML = `
    <div class="avatar">${initials}</div>
    <div class="user-info">
      <span class="user-name">${escHtml(currentUser.name)}</span>
      <span class="user-role-label">${escHtml(currentUser.role)}</span>
    </div>`;

  // Topbar user
  document.getElementById('topbarAvatar').textContent = initials;
  document.getElementById('topbarUser').textContent = currentUser.name;
  document.getElementById('topbarRole').textContent = currentUser.role;

  loadServiceCategories();

  // Navigate to the first page the user actually has access to
  const firstPage = NAV_ALL.find(item => {
    if (!item.id || item.section) return false;
    if (!item.perm) return true;
    return can(item.perm);
  });
  if (firstPage) {
    const forceSetup = currentSystem?.setup_required && currentUser?.role === 'admin';
    const initialPage = forceSetup ? 'owner-control' : firstPage.id;
    loadPageTabsState(initialPage);
    renderPageTabs();
    navigate(_activePageTab || initialPage);
    if (forceSetup) toast('Complete Owner Setup to activate the system for all users.', 'info');
    setTimeout(() => focusPrimarySearch(), 120);
    if (currentUser?.role === 'receptionist' && !localStorage.getItem('receptionist-speed-tip-seen')) {
      setTimeout(() => {
        toast('Speed mode: Alt+P Patients, Alt+A Appointments, Alt+B Billing, Alt+N Quick New, / Search', 'info');
        localStorage.setItem('receptionist-speed-tip-seen', '1');
      }, 600);
    }
  } else {
    // No accessible pages at all
    const ca = document.getElementById('contentArea');
    if (ca) ca.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px">
      <div style="font-size:48px;opacity:.3">!</div>
      <div style="font-size:20px;font-weight:700;color:var(--text)">Access Denied</div>
      <div style="color:var(--text-muted)">Your account has no pages assigned. Contact your administrator.</div>
      <button class="btn btn-sm" onclick="doLogout()">Sign Out</button>
    </div>`;
  }
}

function _sectionId(label) {
  return String(label || 'module').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getSidebarModules() {
  const isCustomRole = !['admin', 'doctor', 'receptionist'].includes(currentUser.role);
  const rendered = new Set();
  const modules = [];
  let currentSection = 'General';
  let currentModule = { id: _sectionId(currentSection), label: currentSection, icon: IC.dashboard, items: [] };

  const pushModule = () => {
    if (currentModule.items.length) modules.push(currentModule);
  };

  NAV_ALL.forEach((item) => {
    if (item.section) {
      pushModule();
      currentSection = item.section;
      currentModule = { id: _sectionId(currentSection), label: currentSection, icon: null, items: [] };
      return;
    }
    if (!item.id) return;
    if (!isCustomRole && item.roles && !item.roles.includes(currentUser.role)) return;
    if (item.perm && !can(item.perm)) return;
    if (rendered.has(item.id)) return;
    rendered.add(item.id);
    currentModule.items.push(item);
    if (!currentModule.icon) currentModule.icon = item.icon || IC.dashboard;
  });

  pushModule();
  return modules;
}

function getNavBadge(pageId) {
  if (pageId === 'appointments' && _navBadgeData.aptsToday > 0) return _navBadgeData.aptsToday;
  if (pageId === 'follow-ups' && _navBadgeData.followupsToday > 0) return _navBadgeData.followupsToday;
  if (pageId === 'billing' && _navBadgeData.pendingBills > 0) return _navBadgeData.pendingBills;
  return null;
}

function moduleQuickAction(module) {
  if (!module || !Array.isArray(module.items)) return '';
  const has = (id) => module.items.some(i => i.id === id);
  if (has('appointments') && can('appointments.create')) {
    return `<button class="nav-quick-btn" onclick="event.stopPropagation();openNewAppointmentModal()">+ Add Appointment</button>`;
  }
  if (has('patients') && can('patients.create')) {
    return `<button class="nav-quick-btn" onclick="event.stopPropagation();openPatientModal()">+ Add Patient</button>`;
  }
  if (has('billing') && can('billing.create')) {
    return `<button class="nav-quick-btn" onclick="event.stopPropagation();openBillModal()">+ New Bill</button>`;
  }
  return '';
}

function toggleNavModule(moduleId) {
  const isCollapsed = document.body.classList.contains('sidebar-collapsed');
  const sb = document.getElementById('sidebar');
  if (isCollapsed && sb && !sb.classList.contains('temp-expanded')) {
    sb.classList.add('temp-expanded');
  }
  _navOpenSection = (_navOpenSection === moduleId) ? '' : moduleId;
  localStorage.setItem('navOpenSection', _navOpenSection);
  buildNav();
}

function handleNavModuleKeydown(event, moduleId) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleNavModule(moduleId);
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (_navOpenSection !== moduleId) toggleNavModule(moduleId);
    return;
  }
  if (event.key === 'ArrowLeft' && _navOpenSection === moduleId) {
    event.preventDefault();
    toggleNavModule(moduleId);
  }
}

function buildNav() {
  const nav = document.getElementById('sideNav');
  if (!nav) return;
  const modules = getSidebarModules();
  const lastPage = localStorage.getItem('lastNavPage') || '';
  const activePage = currentPageId;

  if (!_navOpenSection && modules.length) {
    const activeModule = modules.find(m => m.items.some(i => i.id === activePage));
    _navOpenSection = activeModule ? activeModule.id : (localStorage.getItem('navOpenSection') || modules[0].id);
  }

  nav.innerHTML = modules.map((module) => {
    const isOpen = _navOpenSection === module.id;
    const hasActive = module.items.some(i => i.id === activePage);
    const quickBtn = moduleQuickAction(module);
    return `<div class="nav-module ${isOpen ? 'open' : ''} ${hasActive ? 'module-active' : ''}" data-module="${module.id}">
      <button class="nav-module-btn" type="button" title="${escHtml(module.label)}" onclick="toggleNavModule('${module.id}')" onkeydown="handleNavModuleKeydown(event,'${module.id}')" aria-expanded="${isOpen ? 'true' : 'false'}">
        <span class="nav-module-icon">${module.icon || IC.dashboard}</span>
        <span class="nav-module-label">${escHtml(module.label)}</span>
        <span class="nav-module-arrow">${IC.chevRight}</span>
      </button>
      <div class="nav-sublist ${isOpen ? 'open' : ''}">
        ${quickBtn ? `<div class="nav-quick-wrap">${quickBtn}</div>` : ''}
        ${module.items.map((item) => {
          const isActive = item.id === activePage;
          const isLast = item.id === lastPage;
          const badge = getNavBadge(item.id);
          return `<a href="#" class="nav-subitem ${isActive ? 'active' : ''} ${isLast ? 'last-used' : ''}" data-page="${item.id}" title="${escHtml(item.label)}" onclick="event.preventDefault();navigate('${item.id}')">
            <span class="nav-sub-dot"></span>
            <span class="nav-sub-label">${escHtml(item.label)}</span>
            ${badge ? `<span class="nav-count-badge">${badge}</span>` : ''}
          </a>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

async function refreshSidebarBadges() {
  if (!currentUser) return;
  const today = new Date().toLocaleDateString('sv');
  try {
    const [apts, followups, bills] = await Promise.all([
      apiFetch(`/api/appointments?date=${today}`).catch(() => []),
      apiFetch(`/api/follow-ups?status=Pending&date_from=${today}&date_to=${today}`).catch(() => []),
      apiFetch('/api/bills').catch(() => []),
    ]);
    _navBadgeData = {
      aptsToday: Array.isArray(apts) ? apts.length : 0,
      followupsToday: Array.isArray(followups) ? followups.length : 0,
      pendingBills: Array.isArray(bills) ? bills.filter(b => String(b.payment_status || '') === 'Pending').length : 0,
    };
    buildNav();
  } catch (_) {
    // Ignore transient badge fetch errors.
  }
}

function toggleSidebarCollapsed(forceExpanded = null) {
  const nextCollapsed = typeof forceExpanded === 'boolean'
    ? !forceExpanded
    : !document.body.classList.contains('sidebar-collapsed');
  document.body.classList.toggle('sidebar-collapsed', nextCollapsed);
  localStorage.setItem('sidebarCollapsed', nextCollapsed ? '1' : '0');
  const sb = document.getElementById('sidebar');
  if (sb && !nextCollapsed) sb.classList.remove('temp-expanded');
}

function navigate(page) {
  if (currentPageId === 'patients' && page !== 'patients') {
    _patRenderedMode = '';
    clearTimeout(_patSearchTimer);
  }
  if (currentSystem?.blocked && currentUser?.role === 'admin' && !['setup', 'owner-control'].includes(page)) {
    toast('Subscription is blocked. Only Owner Control is available for renewal.', 'error');
    page = 'owner-control';
  }
  if (isSystemBlockedForCurrentUser() && !['setup', 'owner-control'].includes(page)) {
    renderAccessLockScreen();
    return;
  }

  // Guard: check permission to view this page
  const requiredPerm = PAGE_PERM[page];
  if (requiredPerm && !can(requiredPerm)) {
    const ca = document.getElementById('contentArea');
    if (ca) ca.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px">
      <div style="font-size:48px;opacity:.3">!</div>
      <div style="font-size:20px;font-weight:700;color:var(--text)">Access Denied</div>
      <div style="color:var(--text-muted)">You don't have permission to view this page.</div>
    </div>`;
    toast('Access denied - you do not have permission to view this page.', 'error');
    return;
  }

  localStorage.setItem('lastNavPage', page);
  ensurePageTab(page);
  const renderSeq = beginPageRender(page);
  renderPageTabs();
  const modules = getSidebarModules();
  const activeModule = modules.find(m => m.items.some(i => i.id === page));
  if (activeModule) {
    _navOpenSection = activeModule.id;
    localStorage.setItem('navOpenSection', _navOpenSection);
  }
  buildNav();

  const sb = document.getElementById('sidebar');
  if (document.body.classList.contains('sidebar-collapsed') && sb?.classList.contains('temp-expanded')) {
    setTimeout(() => sb.classList.remove('temp-expanded'), 260);
  }
  closeSidebar();

  const [title, sub] = PAGE_TITLES[page] || [page, ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSub').textContent = sub;

  // Force re-animation
  const ca = document.getElementById('contentArea');
  ca.style.animation = 'none';
  ca.offsetHeight; // trigger reflow
  ca.style.animation = '';

  const pages = { dashboard, patients, appointments, 'follow-ups': followUps, scheduler, prescriptions, billing, expenses, reports, users, services, packages, setup, 'owner-control': ownerControl, 'patient-packages': patientPackages, 'role-permissions': rolePermissions,
    store: storeOverview, 'store-products': storeProducts, 'store-suppliers': storeSuppliers, 'store-purchase': storePurchase, 'store-transfers': storeTransfers, 'store-adjustments': storeAdjustments, 'store-consumption': storeManualConsumption, 'store-sub-stores': storeSubStores, 'discount-master': discountMaster, 'store-supplier-returns': storeSupplierReturns };
  if (pages[page]) {
    if (page === 'scheduler' || page === 'patient-packages') {
      pages[page](renderSeq);
    } else if (page === 'patients') {
      pages[page]('', undefined, _patMode, renderSeq);
    } else {
      pages[page]();
    }
  }
  updateQuickDock(page);
}

function isTypingContext(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function showShortcutGuide() {
  showModal('Speed Shortcuts', `
    <div class="text-sm" style="display:grid;gap:10px">
      <div><strong>Alt + P</strong> - Open Patients</div>
      <div><strong>Alt + A</strong> - Open Appointments</div>
      <div><strong>Alt + B</strong> - Open Billing</div>
      <div><strong>Alt + N</strong> - Quick New (context-aware)</div>
      <div><strong>/</strong> - Focus main search box on current page</div>
      <div class="text-muted" style="margin-top:6px">Designed for receptionist speed: most actions in one or two clicks.</div>
    </div>`);
}

function focusPrimarySearch() {
  const map = {
    dashboard: '#dashDateFilter',
    patients: '#patientSearch',
    appointments: '#aptName',
    billing: '#billSearch',
    reports: '#reportSearch'
  };
  const selector = map[currentPageId];
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el && !el.disabled) {
    el.focus();
    if (typeof el.select === 'function' && el.type !== 'date') el.select();
  }
}

const QUICK_DOCK_RULES = [
  {
    id: 'patients',
    page: 'patients',
    label: 'Patient',
    title: 'Add patient (Alt+N)',
    icon: IC.plus,
    perm: 'patients.create',
    roles: ['admin', 'doctor', 'receptionist'],
    onclick: 'openPatientModal()'
  },
  {
    id: 'appointments',
    page: 'appointments',
    label: 'Appointment',
    title: 'Book appointment',
    icon: IC.calendar,
    perm: 'appointments.create',
    roles: ['admin', 'doctor', 'receptionist'],
    onclick: 'openNewAppointmentModal()'
  },
  {
    id: 'billing',
    page: 'billing',
    label: 'Bill',
    title: 'New bill',
    icon: IC.billing,
    perm: 'billing.create',
    roles: ['admin', 'receptionist'],
    onclick: 'openBillModal()'
  },
  {
    id: 'help',
    page: '',
    label: 'Help',
    title: 'Shortcut guide',
    icon: '?',
    perm: '',
    roles: ['admin', 'doctor', 'receptionist'],
    onclick: 'showShortcutGuide()',
    className: 'quick-dock-help'
  }
];

function canAccessQuickDockRule(rule) {
  if (!currentUser || !rule) return false;
  const role = String(currentUser.role || '').toLowerCase();
  const isDefaultRole = ['admin', 'doctor', 'receptionist'].includes(role);
  if (isDefaultRole && Array.isArray(rule.roles) && rule.roles.length && !rule.roles.includes(role)) return false;
  if (rule.perm && !can(rule.perm)) return false;
  if (rule.page) {
    const allowedPages = new Set(getAccessibleNavPages());
    if (!allowedPages.has(rule.page)) return false;
  }
  return true;
}

function quickCreateByPage() {
  if (currentPageId === 'patients' && can('patients.create')) return openPatientModal();
  if (currentPageId === 'appointments' && can('appointments.create')) return openNewAppointmentModal();
  if (currentPageId === 'billing' && can('billing.create')) return openBillModal();
  if (can('appointments.create')) return openNewAppointmentModal();
  if (can('patients.create')) return openPatientModal();
}

function ensureQuickDock() {
  if (!currentUser) return;
  let dock = document.getElementById('quickDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'quickDock';
    dock.className = 'quick-dock';
    document.body.appendChild(dock);
  }
  const html = QUICK_DOCK_RULES
    .filter(canAccessQuickDockRule)
    .map((rule) => {
      const pageAttr = rule.page ? ` data-page="${rule.page}"` : '';
      const extraClass = rule.className ? ` ${rule.className}` : '';
      return `<button class="quick-dock-btn${extraClass}"${pageAttr} title="${escHtml(rule.title || rule.label || '')}" onclick="${rule.onclick}">${rule.icon}<span>${escHtml(rule.label || '')}</span></button>`;
    })
    .join('');
  dock.innerHTML = html;
  updateQuickDock(currentPageId);
}

function updateQuickDock(page) {
  const dock = document.getElementById('quickDock');
  if (!dock) return;
  const hideOnLogin = !currentUser || document.getElementById('mainApp')?.classList.contains('hidden');
  dock.classList.toggle('hidden', hideOnLogin);
  dock.querySelectorAll('.quick-dock-btn').forEach(btn => btn.classList.remove('active'));
  dock.querySelector(`.quick-dock-btn[data-page="${page}"]`)?.classList.add('active');
}

function registerGlobalShortcuts() {
  if (window._shortcutsBound) return;
  window._shortcutsBound = true;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'w') {
      if (_activePageTab && _canCloseTab(_activePageTab)) {
        e.preventDefault();
        closePageTab(_activePageTab);
      }
      return;
    }
    if (isTypingContext(e.target)) return;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      focusPrimarySearch();
      return;
    }
    if (!e.altKey) return;
    const key = (e.key || '').toLowerCase();
    if (key === 'p') { e.preventDefault(); navigate('patients'); return; }
    if (key === 'a') { e.preventDefault(); navigate('appointments'); return; }
    if (key === 'b') { e.preventDefault(); navigate('billing'); return; }
    if (key === 'n') { e.preventDefault(); quickCreateByPage(); }
  });
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escHtmlMultiline(s) {
  return escHtml(s || '').replace(/\r?\n/g, '<br/>');
}

// -- View toggle helpers (grid / list) ----------------------
function getViewPref(page) {
  try { return JSON.parse(localStorage.getItem('viewPrefs')||'{}')[page] || 'list'; } catch { return 'list'; }
}
function setViewPref(page, view) {
  try { const p = JSON.parse(localStorage.getItem('viewPrefs')||'{}'); p[page]=view; localStorage.setItem('viewPrefs', JSON.stringify(p)); } catch {}
  document.querySelectorAll(`.vt-btn[data-page="${page}"]`).forEach(btn => {
    btn.classList.toggle('vt-active', btn.dataset.mode === view);
  });
  // pages whose render function handles view mode themselves - just re-render
  if (page === 'packages') {
    const isAdmin = currentUser && currentUser.role === 'admin';
    renderPackagesTable(window._allPackages || [], isAdmin);
    return;
  }
  if (page === 'patientPackages') {
    if (typeof _applyPPFilter === 'function') _applyPPFilter();
    return;
  }
  // for table-based pages: toggle CSS class on the table-wrap
  document.querySelectorAll('.table-wrap[data-vpage="'+page+'"]').forEach(w => {
    w.classList.toggle('view-grid', view === 'grid');
  });
}
function viewToggleHTML(page) {
  const v = getViewPref(page);
  return `<div class="vt-group">
    <button class="vt-btn${v==='list'?' vt-active':''}" data-page="${page}" data-mode="list" onclick="setViewPref('${page}','list')" title="List view"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect y="0" width="14" height="2.5" rx="1" fill="currentColor"/><rect y="5.5" width="14" height="2.5" rx="1" fill="currentColor"/><rect y="11" width="14" height="2.5" rx="1" fill="currentColor"/></svg></button>
    <button class="vt-btn${v==='grid'?' vt-active':''}" data-page="${page}" data-mode="grid" onclick="setViewPref('${page}','grid')" title="Grid view"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="0" y="0" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="8" y="0" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="0" y="8" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="8" y="8" width="6" height="6" rx="1.5" fill="currentColor"/></svg></button>
  </div>`;
}
function applyViewPref(page, wrapSelector) {
  const wrap = document.querySelector(wrapSelector + ' .table-wrap') || document.querySelector('.table-wrap');
  if (!wrap) return;
  wrap.setAttribute('data-vpage', page);
  wrap.classList.toggle('view-grid', getViewPref(page) === 'grid');
}
function confirmDialog(msg, title = 'Confirm') {
  return new Promise((resolve) => {
    const existing = document.getElementById('confirmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay-stack';
    overlay.id = 'confirmOverlay';
    overlay.innerHTML = `
      <div class="modal modal-compact">
        <div class="modal-header">
          <h3>${escHtml(title)}</h3>
        </div>
        <div class="modal-body">${escHtml(msg || '').replace(/\r?\n/g, '<br/>')}</div>
        <div class="modal-footer">
          <button class="btn" id="confirmCancelBtn">Cancel</button>
          <button class="btn btn-danger" id="confirmOkBtn">Confirm</button>
        </div>
      </div>`;

    const done = (result) => {
      if (overlay.parentNode) overlay.remove();
      resolve(!!result);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) e.stopPropagation();
    });

    document.body.appendChild(overlay);
    const cancelBtn = overlay.querySelector('#confirmCancelBtn');
    const okBtn = overlay.querySelector('#confirmOkBtn');
    if (cancelBtn) cancelBtn.onclick = () => done(false);
    if (okBtn) okBtn.onclick = () => done(true);

    setTimeout(() => { if (okBtn) okBtn.focus(); }, 30);
  });
}

function confirmWithReasonDialog(msg, title = 'Confirm', reasonLabel = 'Reason (optional)', defaultReason = '') {
  return new Promise((resolve) => {
    const existing = document.getElementById('confirmReasonOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay-stack';
    overlay.id = 'confirmReasonOverlay';
    overlay.innerHTML = `
      <div class="modal modal-compact">
        <div class="modal-header">
          <h3>${escHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:10px">${escHtml(msg || '').replace(/\r?\n/g, '<br/>')}</div>
          <div class="form-group" style="margin:0">
            <label>${escHtml(reasonLabel)}</label>
            <textarea id="confirmReasonInput" rows="3" placeholder="Enter reason">${escHtml(defaultReason || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="confirmReasonCancelBtn">Cancel</button>
          <button class="btn btn-danger" id="confirmReasonOkBtn">Confirm</button>
        </div>
      </div>`;

    const done = (confirmed) => {
      const reason = String(overlay.querySelector('#confirmReasonInput')?.value || '').trim();
      if (overlay.parentNode) overlay.remove();
      resolve({ confirmed: !!confirmed, reason });
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) e.stopPropagation();
    });

    document.body.appendChild(overlay);
    const cancelBtn = overlay.querySelector('#confirmReasonCancelBtn');
    const okBtn = overlay.querySelector('#confirmReasonOkBtn');
    const reasonEl = overlay.querySelector('#confirmReasonInput');

    if (cancelBtn) cancelBtn.onclick = () => done(false);
    if (okBtn) okBtn.onclick = () => done(true);
    if (reasonEl) {
      reasonEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) done(true);
      });
    }

    setTimeout(() => { if (reasonEl) reasonEl.focus(); }, 30);
  });
}

function statusBadge(s) {
  const map = { Booked:'badge-scheduled', Confirmed:'badge-confirmed', Arrived:'badge-arrived', Completed:'badge-completed', Cancelled:'badge-cancelled', 'No-Show':'badge-no-show', Paid:'badge-paid', Pending:'badge-unpaid', Scheduled:'badge-scheduled', Active:'badge-confirmed' };
  return `<span class="badge ${map[s]||''}">${escHtml(s)}</span>`;
}
function roleBadge(r, label) {
  const map = { admin:'badge-admin', doctor:'badge-doctor', receptionist:'badge-receptionist' };
  const display = label || r;
  return `<span class="badge ${map[r]||'badge-scheduled'}">${escHtml(display)}</span>`;
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${desc}</p>
  </div>`;
}

// --------------------------------------------------------
//  DASHBOARD
// --------------------------------------------------------
let _dashAutoTimer = null;
async function dashboard() {
  const today = new Date().toLocaleDateString('sv');
  const ca = document.getElementById('contentArea');
  ca.innerHTML = skeletonStats(4) + skeletonTable(4);
  const isDoctor = currentUser.role === 'doctor';

  if (_dashAutoTimer) clearTimeout(_dashAutoTimer);

  try {
    const [rep, apts, fuTodayList, fuMissedList] = await Promise.all([
      apiFetch(`/api/reports/daily?date=${today}`),
      apiFetch('/api/appointments?date=' + today),
      apiFetch(`/api/follow-ups?status=Pending&date_from=${today}&date_to=${today}`).catch(() => []),
      apiFetch('/api/follow-ups?status=Missed').catch(() => []),
    ]);

    // For doctors: show a date filter on the dashboard
    let dashDateFilter = '';
    if (isDoctor) {
      dashDateFilter = `
        <div class="flex gap-sm mb-2" style="align-items:end">
          <div class="form-group" style="margin:0">
            <label class="text-sm text-muted">Filter Date</label>
            <input type="date" id="dashDateFilter" value="${today}" style="width:auto" onchange="loadDashApts(this.value)"/>
          </div>
          <button class="btn btn-sm btn-primary" onclick="document.getElementById('dashDateFilter').value='${today}';loadDashApts('${today}')">Today</button>
        </div>`;
    }

    ca.innerHTML = `
      <div class="page-hero">
        <div>
          <h2 class="page-hero-title">Clinic Command Center</h2>
          <p class="page-hero-sub">Fast actions, live counters, and zero clutter for today's workflow.</p>
        </div>
        <div class="live-chip"><span class="live-dot"></span> Auto-refresh every 60s</div>
      </div>

      <div class="quick-actions-grid">
        ${can('patients.create') ? `<button class="quick-action-btn" onclick="openPatientModal()">${IC.plus}<span>Add Patient <em class="qa-key">Alt+N</em></span></button>` : ''}
        ${can('appointments.create') ? `<button class="quick-action-btn" onclick="openNewAppointmentModal()">${IC.calendar}<span>Book Appointment <em class="qa-key">Alt+A</em></span></button>` : ''}
        ${can('billing.create') ? `<button class="quick-action-btn" onclick="openBillModal()">${IC.billing}<span>Create Bill <em class="qa-key">Alt+B</em></span></button>` : ''}
        ${can('prescriptions.create') ? `<button class="quick-action-btn" onclick="navigate('prescriptions')">${IC.rx}<span>Open Prescriptions</span></button>` : ''}
        <button class="quick-action-btn" onclick="navigate('follow-ups')">${IC.clock}<span>Follow-Ups</span></button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">${IC.apts}</div>
          <div class="stat-content"><div class="stat-label">${isDoctor ? 'My Appointments Today' : "Today's Appointments"}</div><div class="stat-value">${apts.length}</div></div>
        </div>
        ${!isDoctor ? `<div class="stat-card">
          <div class="stat-icon green">${IC.revenue}</div>
          <div class="stat-content"><div class="stat-label">Today's Final Revenue</div><div class="stat-value">KD ${parseFloat(rep.final_revenue ?? rep.revenue ?? 0).toFixed(3)}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">${IC.pending}</div>
          <div class="stat-content"><div class="stat-label">Pending Bills</div><div class="stat-value">${rep.pending_bills}</div></div>
        </div>` : `
        <div class="stat-card">
          <div class="stat-icon green">${IC.revenue}</div>
          <div class="stat-content"><div class="stat-label">Booked</div><div class="stat-value">${apts.filter(a=>a.status==='Booked').length}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">${IC.check}</div>
          <div class="stat-content"><div class="stat-label">Confirmed</div><div class="stat-value">${apts.filter(a=>a.status==='Confirmed').length}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">${IC.check}</div>
          <div class="stat-content"><div class="stat-label">Arrived</div><div class="stat-value">${apts.filter(a=>a.status==='Arrived').length}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">${IC.pending}</div>
          <div class="stat-content"><div class="stat-label">Completed</div><div class="stat-value">${apts.filter(a=>a.status==='Completed').length}</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">${IC.x}</div>
          <div class="stat-content"><div class="stat-label">No-Show</div><div class="stat-value">${apts.filter(a=>a.status==='No-Show').length}</div></div>
        </div>`}
        <div class="stat-card">
          <div class="stat-icon purple">${IC.hospital}</div>
          <div class="stat-content"><div class="stat-label">Total Today</div><div class="stat-value">${apts.length}</div></div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="navigate('follow-ups')" title="Open follow-up list">
          <div class="stat-icon blue">${IC.clock}</div>
          <div class="stat-content"><div class="stat-label">Follow-Ups Today</div><div class="stat-value">${(fuTodayList || []).length}</div></div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="navigate('follow-ups')" title="Open follow-up list">
          <div class="stat-icon amber">${IC.pending}</div>
          <div class="stat-content"><div class="stat-label">Overdue Follow-Ups</div><div class="stat-value">${(fuMissedList || []).length}</div></div>
        </div>
      </div>

      ${!isDoctor ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px">
        <span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>Gross:</strong> KD ${parseFloat(rep.gross_revenue || 0).toFixed(3)}</span>
        <span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>Discount:</strong> KD ${parseFloat(rep.total_discount || 0).toFixed(3)}</span>
        <span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>Net:</strong> KD ${parseFloat(rep.net_revenue || 0).toFixed(3)}</span>
        <span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>Refund:</strong> KD ${parseFloat(rep.total_refund || 0).toFixed(3)}</span>
        <span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>Cancelled Gross:</strong> KD ${parseFloat(rep.cancelled_gross || 0).toFixed(3)}</span>
      </div>` : ''}

      <div class="card">
        <div class="card-title">${IC.appointments} ${isDoctor ? 'My' : "Today's"} Appointments - ${today}</div>
        ${dashDateFilter}
        <div id="dashAptsWrap">
          ${renderDashAptTable(apts)}
        </div>
      </div>`;

    _dashAutoTimer = setTimeout(() => {
      if (currentPageId === 'dashboard') dashboard();
    }, 60000);
  } catch (e) {
    ca.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function renderDashAptTable(apts) {
  const isDoctor = currentUser.role === 'doctor';
  if (apts.length === 0) return emptyState(IC.empty, 'No appointments', 'No appointments for this date');
  return `<div class="table-wrap"><table>
    <thead><tr><th>Patient Name</th><th>MR#</th><th>Time</th>${!isDoctor?'<th>Doctor Name</th>':''}<th>Status</th><th>Actions</th></tr></thead>
    <tbody>${apts.map(a => `<tr>
      <td><strong>${escHtml(a.patient_name)}</strong><br><span class="text-muted text-sm">${escHtml(a.patient_phone||'')}</span></td>
      <td><span class="code-id code-id-primary">${escHtml(a.mr_number||'-')}</span></td>
      <td>${escHtml(a.time)}</td>
      ${!isDoctor ? `<td>${escHtml(a.doctor_name)}</td>` : ''}
      <td>${appointmentStatusTag(a)}</td>
      <td class="td-actions"><div class="apt-actions">
        ${isDoctor && a.status==='Booked' ? `<button class="btn btn-primary btn-sm" onclick="startConsultation(${a.id},${a.patient_id})">${IC.rx} Start</button>` : ''}
        ${canOpenRxFromAppointment(a) ? `<button class="btn btn-sm" onclick="openPrescriptionModal(${a.id},${a.patient_id})">${IC.rx} Rx</button>` : ''}
        ${!isDoctor && !['Completed','Cancelled'].includes(a.status) ? `<button class="btn btn-sm btn-outline-primary" onclick="openEditAppointmentModal(${a.id})">${IC.edit} Edit</button>` : ''}
        ${!isDoctor && a.status==='Booked' ? `<button class="btn btn-danger btn-sm" onclick="cancelAptAndRefresh(${a.id})">${IC.x} Cancel</button>` : ''}
        ${['Completed','Cancelled'].includes(a.status) ? `<span class="locked-badge ${a.status==='Completed'?'locked-paid':'locked-cancelled'}">${a.status==='Completed'?'Paid':'Cancelled'}</span>` : ''}
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function appointmentStatusTag(a) {
  const bookedBy = String(a && a.booked_by_name || '').trim();
  const paidBy = String(a && a.paid_by_name || '').trim();
  const s = String(a && a.status || '');
  let meta = '';
  if ((s === 'Booked' || s === 'Confirmed' || s === 'Completed') && bookedBy) {
    meta += `<div class="text-muted text-sm" style="margin-top:2px">Booked by: ${escHtml(bookedBy)}</div>`;
  }
  if (s === 'Completed' && paidBy) {
    meta += `<div class="text-muted text-sm">Paid by: ${escHtml(paidBy)}</div>`;
  }
  return `<div>${statusBadge(s)}${meta}</div>`;
}

function canOpenRxFromAppointment(a) {
  if (!can('prescriptions.create') || !a || a.status === 'Cancelled') return false;
  const isDoctor = currentUser.role === 'doctor';
  if (isDoctor) return a.status !== 'Booked';
  return a.status === 'Completed';
}

async function loadDashApts(date) {
  const wrap = document.getElementById('dashAptsWrap');
  if (!wrap) return;
  wrap.innerHTML = skeletonTable(3);
  try {
    const apts = await apiFetch('/api/appointments?date=' + date);
    wrap.innerHTML = renderDashAptTable(apts);
  } catch(e) { wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`; }
}

// --------------------------------------------------------
//  PATIENTS
// --------------------------------------------------------
let patientTab = 'list';
let _patPage = 1;
let _patMode = 'active';
let _patRenderedMode = '';
let _patLastSearch = '';
let _patSearchTimer = null;
const PAT_PAGE_SIZE = 100;

function _setPatientMode(mode) {
  _patMode = mode === 'search' ? 'search' : 'active';
  _patPage = 1;
  _patLastSearch = '';
  patients('', 1, _patMode, _pageRenderSeq);
}

function _debouncePatientSearch(query) {
  clearTimeout(_patSearchTimer);
  _patSearchTimer = setTimeout(() => {
    _patPage = 1;
    patients(query, 1, _patMode, _pageRenderSeq);
  }, 400);
}

async function patients(search = '', page, mode, renderSeq = _pageRenderSeq) {
  if (mode) _patMode = mode === 'search' ? 'search' : 'active';
  if (page === undefined || page === null) page = (search !== _patLastSearch ? 1 : _patPage);
  _patPage = page;
  _patLastSearch = search;

  const ca = document.getElementById('contentArea');
  const wrapExists = !!document.getElementById('patientTableWrap');
  if (!wrapExists || _patRenderedMode !== _patMode) {
    ca.innerHTML = `
      <div class="action-bar patient-action-bar">
        <div class="patient-mode-group">
          <button id="patModeActiveBtn" class="btn ${_patMode === 'active' ? 'btn-primary' : ''}" onclick="_setPatientMode('active')">Active Patient List</button>
          <button id="patModeSearchBtn" class="btn ${_patMode === 'search' ? 'btn-primary' : ''}" onclick="_setPatientMode('search')">Patient Search</button>
        </div>
        <div class="search-box">
          <input type="text" id="patientSearch" name="patientSearchUi" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${_patMode === 'active' ? 'Search today\'s appointment patients by name, phone, MR, civil ID...' : 'Search old patient by name, phone, MR, civil ID...'}" value="${escHtml(search)}" oninput="_debouncePatientSearch(this.value)"/>
        </div>
        ${_patMode === 'active' ? `<div class="text-sm text-muted patient-mode-note">Today appts</div>` : `<div class="text-sm text-muted patient-mode-note">All history</div>`}
        ${viewToggleHTML('patients')}
        ${can('patients.export') ? `<button class="btn" onclick="exportPatientsList()">Export Patients</button>` : ''}
        ${can('patients.import') ? `<button class="btn" onclick="downloadPatientImportFormat()">Import Format</button>` : ''}
        ${can('patients.import') ? `<button class="btn" onclick="triggerPatientImport()">Import Patients</button>` : ''}
        ${can('patients.create') ? `<button class="btn btn-primary" onclick="openPatientModal()">${IC.plus} Register Patient</button>` : ''}
      </div>
      <input type="file" id="patientImportFile" accept=".csv,text/csv" style="display:none" onchange="handlePatientImportFile(event)"/>
      <div id="patientTableWrap">${skeletonTable(5)}</div>`;
    _patRenderedMode = _patMode;
    setTimeout(() => focusPrimarySearch(), 100);
  } else {
    const searchInput = document.getElementById('patientSearch');
    if (searchInput && searchInput.value !== search) searchInput.value = search;
  }
  try {
    const qs = new URLSearchParams({ page: String(_patPage), limit: String(PAT_PAGE_SIZE) });
    if (_patMode === 'active') qs.set('today_only', '1');
    if (search) qs.set('search', search);
    const resp = await apiFetch('/api/patients?' + qs.toString());
    if (!isActivePageRender('patients', renderSeq)) return;
    // Support both old flat array and new paginated { data, total, pages }
    const list  = Array.isArray(resp) ? resp : (resp.data || []);
    const total = Array.isArray(resp) ? list.length : (resp.total || list.length);
    const pages = Array.isArray(resp) ? 1 : (resp.pages || 1);
    window._lastPatientList = list;
    const wrap = document.getElementById('patientTableWrap');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = emptyState(IC.search, 'No patients found', _patMode === 'active' ? 'No patient appointments found for today' : (search ? 'Try a different search term' : 'Type a patient detail to search')); return;
    }
    const pagerHtml = pages > 1 ? `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 4px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${((_patPage-1)*PAT_PAGE_SIZE)+1}-${Math.min(_patPage*PAT_PAGE_SIZE,total)} of ${total}</span>
        <div style="display:flex;gap:4px;margin-left:auto">
          <button class="btn btn-sm" onclick="patients('${escHtml(search)}',${_patPage-1},'${_patMode}')" ${_patPage<=1?'disabled':''}>&#8592; Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${_patPage} / ${pages}</span>
          <button class="btn btn-sm" onclick="patients('${escHtml(search)}',${_patPage+1},'${_patMode}')" ${_patPage>=pages?'disabled':''}>Next &#8594;</button>
        </div>
      </div>` : `<div class="text-muted text-sm" style="padding:8px 4px">Showing ${total} patient${total!==1?'s':''}</div>`;
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>MR#</th><th>Name</th><th>Civil ID</th><th>DOB</th><th>Age/Gender</th><th>Phone</th><th>Status</th><th>Registered</th><th>Actions</th></tr></thead>
      <tbody>${list.map((p) => {
        const statusColor = p.patient_status === 'VIP' ? 'var(--c-primary)' : p.patient_status === 'Not Good' ? 'var(--c-danger)' : 'var(--c-success)';
        const blockedBadge = p.blocked ? `<span style="background:var(--c-danger);color:#fff;border-radius:4px;font-size:10px;padding:1px 5px;margin-left:4px">BLOCKED</span>` : '';
        return `<tr style="cursor:pointer${p.blocked ? ';opacity:0.6' : ''}" onclick="viewPatient(${p.id})">
        <td><span class="code-id code-id-primary">${escHtml(p.mr_number)||'-'}</span></td>
        <td>${escHtml(p.name)}${p.second_name ? ` <span class="text-muted text-sm">${escHtml(p.second_name)}</span>` : ''}${blockedBadge}</td>
        <td>${escHtml(p.civil_id)||'-'}</td>
        <td>${escHtml(p.dob)||'-'}</td>
        <td>${escHtml(p.age)||'-'} / ${escHtml(p.gender)||'-'}</td>
        <td>${escHtml(p.phone)||'-'}</td>
        <td><span style="background:${statusColor}22;color:${statusColor};border-radius:4px;font-size:11px;padding:2px 7px;font-weight:600">${escHtml(p.patient_status||'Good')}</span></td>
        <td class="text-muted text-sm">${escHtml(formatDateTime(p.registration_date || p.created_at || ''))}</td>
        <td class="td-actions patient-actions-cell" onclick="event.stopPropagation()">
          <div class="patient-row-actions">
            <button class="btn btn-sm patient-row-emr-btn" title="View Full EMR" onclick="openPatientEmr(${p.id})">EMR</button>
            ${can('patients.edit') ? `<button class="btn btn-sm" title="Edit" onclick="openPatientModal(${p.id})">${IC.edit}</button>` : ''}
            ${can('appointments.create') ? `<button class="btn btn-sm" title="New Appointment" onclick="openNewAppointmentModal(${p.id})">${IC.plus}</button>` : ''}
            ${can('patients.edit') ? `<button class="btn btn-sm ${p.blocked ? 'btn-success' : 'btn-danger'}" title="${p.blocked ? 'Unblock' : 'Block'}" onclick="togglePatientBlocked(${p.id}, ${p.blocked ? 'false' : 'true'}, '${escHtml(p.name)}')">${p.blocked ? 'Unblock' : 'Block'}</button>` : ''}
          </div>
        </td>
      </tr>`;}).join('')}</tbody>
    </table></div>${pagerHtml}`;
    applyViewPref('patients', '#patientTableWrap');
  } catch (e) {
    document.getElementById('patientTableWrap').innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function exportPatientsList() {
  if (!can('patients.export')) { toast('No permission to export patients', 'error'); return; }
  const search = document.getElementById('patientSearch')?.value || _patLastSearch || '';
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const toCsv = (rows) => {
    const headers = ['mr_number','name','second_name','dob','age','gender','phone','alt_phone','civil_id','address','medical_history','patient_status','blocked','registration_date'];
    return [headers.join(',')].concat(rows.map(p => [
      p.mr_number || '', p.name || '', p.second_name || '', p.dob || '', p.age || '', p.gender || '',
      p.phone || '', p.alt_phone || '', p.civil_id || '', p.address || '', p.medical_history || '',
      p.patient_status || 'Good', p.blocked ? '1' : '0', p.registration_date || ''
    ].map(esc).join(','))).join('\n');
  };

  const fallbackExport = () => {
    const rows = Array.isArray(window._lastPatientList) ? window._lastPatientList : [];
    if (!rows.length) { toast('No patients to export', 'error'); return; }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients_${new Date().toLocaleDateString('sv')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Patients exported', 'success');
  };

  const params = new URLSearchParams();
  if (_patMode === 'active') params.set('today_only', '1');
  if (search) params.set('search', search);

  fetch('/api/patients/export' + (params.toString() ? `?${params.toString()}` : ''), { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error('fallback');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${new Date().toLocaleDateString('sv')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Patients exported', 'success');
    })
    .catch(() => fallbackExport());
}

function downloadPatientImportFormat() {
  if (!can('patients.import')) { toast('No permission to download import format', 'error'); return; }
  const fallbackTemplate = () => {
    const headers = ['mr_number','name','second_name','dob','age','gender','phone','alt_phone','civil_id','address','medical_history','patient_status','blocked'];
    const sample = ['MR01001','John Doe','','1990-01-15','36','Male','90000000','','123456789012','Kuwait City','Diabetes','Good','0'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, sample].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patient_import_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  fetch('/api/patients/import-template', { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error('fallback');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patient_import_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => fallbackTemplate());
}

function triggerPatientImport() {
  if (!can('patients.import')) { toast('No permission to import patients', 'error'); return; }
  const input = document.getElementById('patientImportFile');
  if (input) {
    input.value = '';
    input.click();
  }
}

function detectCsvDelimiter(line) {
  const sample = String(line || '');
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length
  };
  let best = ',';
  let max = counts[best];
  Object.keys(counts).forEach(k => {
    if (counts[k] > max) {
      best = k;
      max = counts[k];
    }
  });
  return best;
}

function parseCsvLine(line, delimiter = ',') {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(v => v.trim());
}

function parsePatientsCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(h => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows, delimiter };
}

const PATIENT_IMPORT_FIELDS = [
  { key: 'mr_number', label: 'MR Number' },
  { key: 'name', label: 'Full Name', required: true },
  { key: 'second_name', label: 'Second Name' },
  { key: 'dob', label: 'Date of Birth (YYYY-MM-DD)' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Phone' },
  { key: 'alt_phone', label: 'Alternative Phone' },
  { key: 'civil_id', label: 'Civil ID (12 digits)' },
  { key: 'address', label: 'Address' },
  { key: 'medical_history', label: 'Medical History' },
  { key: 'patient_status', label: 'Patient Status (Good/VIP/Not Good)' },
  { key: 'blocked', label: 'Blocked (0/1)' }
];

const PATIENT_IMPORT_ALIASES = {
  mr_number: ['mr','mr number','mr no','mr#','mr_number','medical record number'],
  name: ['name','full name','patient name','patient'],
  second_name: ['second name','lastname','last name','family name','surname'],
  dob: ['dob','date of birth','birthdate','birthday'],
  age: ['age'],
  gender: ['gender','sex'],
  phone: ['phone','mobile','phone number','contact','contact number'],
  alt_phone: ['alt phone','alternative phone','secondary phone','phone 2','mobile 2'],
  civil_id: ['civil id','civilid','id number','civil number'],
  address: ['address','location'],
  medical_history: ['medical history','history','medical notes','notes'],
  patient_status: ['status','patient status'],
  blocked: ['blocked','is blocked','blacklist']
};

function normalizeImportHeader(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function suggestPatientImportMapping(headers) {
  const normalizedHeaders = headers.map(h => ({ raw: h, n: normalizeImportHeader(h) }));
  const mapping = {};
  PATIENT_IMPORT_FIELDS.forEach(f => {
    const aliases = (PATIENT_IMPORT_ALIASES[f.key] || [f.key]).map(normalizeImportHeader);
    const exact = normalizedHeaders.find(h => aliases.includes(h.n));
    if (exact) {
      mapping[f.key] = exact.raw;
      return;
    }
    const fallback = normalizedHeaders.find(h => h.n.includes(normalizeImportHeader(f.key)) || normalizeImportHeader(f.key).includes(h.n));
    mapping[f.key] = fallback ? fallback.raw : '';
  });
  return mapping;
}

function buildMappedPatientRows(sourceRows, mapping) {
  return sourceRows.map(src => {
    const row = {};
    PATIENT_IMPORT_FIELDS.forEach(f => {
      const col = mapping[f.key];
      row[f.key] = col ? (src[col] || '') : '';
    });
    return row;
  }).filter(r => Object.values(r).some(v => String(v || '').trim()));
}

async function runPatientImportRows(rows) {
  let res;
  try {
    const chunkSize = 100;
    let created = 0;
    const skipped = [];
    const errors = [];
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const part = await apiFetch('/api/patients/import', {
        method: 'POST',
        body: JSON.stringify({ rows: chunk })
      });
      created += parseInt(part.created || 0, 10) || 0;
      skipped.push(...(part.skipped || []));
      errors.push(...(part.errors || []));
      if (rows.length > chunkSize) {
        toast(`Importing ${Math.min(start + chunk.length, rows.length)} / ${rows.length}`, 'success');
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    res = { created, skipped, errors };
  } catch (e) {
    if (!String(e.message || '').toLowerCase().includes('not found')) throw e;
    toast(`Importing ${rows.length} patients...`, 'success');
    let created = 0;
    const skipped = [];
    const errors = [];
    for (let i = 0; i < rows.length; i += 1) {
      if (i > 0 && i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const r = rows[i] || {};
      const line = i + 2;
      const body = {
        mr_number: String(r.mr_number || '').trim(),
        name: String(r.name || '').trim(),
        second_name: String(r.second_name || '').trim(),
        dob: String(r.dob || '').trim(),
        age: String(r.age || '').trim(),
        gender: String(r.gender || '').trim(),
        phone: String(r.phone || '').trim(),
        alt_phone: String(r.alt_phone || '').trim(),
        civil_id: String(r.civil_id || '').trim(),
        address: String(r.address || '').trim(),
        medical_history: String(r.medical_history || '').trim(),
        patient_status: String(r.patient_status || 'Good').trim(),
        blocked: ['1','true','yes','y'].includes(String(r.blocked || '').toLowerCase()) ? '1' : '0'
      };
      if (!body.name) {
        errors.push(`Line ${line}: name is required`);
        continue;
      }
      try {
        await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(body) });
        created += 1;
      } catch (rowErr) {
        const m = String(rowErr.message || 'failed');
        if (m.toLowerCase().includes('already')) skipped.push(`Line ${line}: ${m}`);
        else errors.push(`Line ${line}: ${m}`);
      }
    }
    res = { created, skipped, errors };
  }
  const msg = `Import done. Created: ${res.created || 0}, Skipped: ${(res.skipped || []).length}, Errors: ${(res.errors || []).length}`;
  toast(msg, (res.errors || []).length ? 'error' : 'success');
  if ((res.errors || []).length) {
    showModal('Import Result', `
      <div class="text-sm" style="margin-bottom:8px">${escHtml(msg)}</div>
      ${(res.errors || []).length ? `<div class="alert alert-error" style="max-height:180px;overflow:auto"><strong>Errors</strong><br>${(res.errors || []).map(e => escHtml(e)).join('<br>')}</div>` : ''}
      ${(res.skipped || []).length ? `<div class="alert" style="margin-top:8px;max-height:180px;overflow:auto"><strong>Skipped</strong><br>${(res.skipped || []).map(e => escHtml(e)).join('<br>')}</div>` : ''}
    `, null, 'modal-md');
  }
  patients(document.getElementById('patientSearch')?.value || '', 1);
}

function openPatientImportMappingModal(headers, sourceRows, delimiter = ',') {
  const initial = suggestPatientImportMapping(headers);
  const options = [`<option value="">(Not mapped)</option>`]
    .concat(headers.map(h => `<option value="${escHtml(h)}">${escHtml(h)}</option>`))
    .join('');
  const delimiterLabel = delimiter === '\t' ? 'tab' : delimiter === ';' ? 'semicolon' : 'comma';
  const body = `
    <div class="text-sm" style="margin-bottom:10px">
      Map your file columns to patient fields. You can keep your original column order and names.
    </div>
    <div class="alert" style="margin-bottom:12px">
      <strong>Detected columns (${headers.length})</strong> - delimiter: ${escHtml(delimiterLabel)}<br>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${headers.map(h => `<span style="padding:4px 8px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px">${escHtml(h)}</span>`).join('') || '<span class="text-muted">No headers detected</span>'}
      </div>
    </div>
    <div class="table-wrap" style="max-height:52vh;overflow:auto">
      <table>
        <thead><tr><th>System Field</th><th>Your Column</th></tr></thead>
        <tbody>
          ${PATIENT_IMPORT_FIELDS.map(f => `
            <tr>
              <td><strong>${escHtml(f.label)}</strong>${f.required ? ' <span style="color:var(--c-danger)">*</span>' : ''}</td>
              <td>
                <select id="map_${f.key}" style="min-width:260px;width:100%">
                  ${options}
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  showModal('Map Import Columns', body, async () => {
    const mapping = {};
    PATIENT_IMPORT_FIELDS.forEach(f => {
      mapping[f.key] = document.getElementById(`map_${f.key}`)?.value || '';
    });
    if (!mapping.name) {
      toast('Please map Full Name field before import', 'error');
      return false;
    }
    const mappedRows = buildMappedPatientRows(sourceRows, mapping);
    if (!mappedRows.length) {
      toast('No importable rows after mapping', 'error');
      return false;
    }
    closeModal();
    toast(`Starting import for ${mappedRows.length} row${mappedRows.length !== 1 ? 's' : ''}...`, 'success');
    setTimeout(() => {
      runPatientImportRows(mappedRows).catch(err => {
        toast(err.message || 'Import failed', 'error');
      });
    }, 0);
  }, 'modal-lg');

  PATIENT_IMPORT_FIELDS.forEach(f => {
    const el = document.getElementById(`map_${f.key}`);
    if (el && initial[f.key]) el.value = initial[f.key];
  });
}

async function handlePatientImportFile(ev) {
  const file = ev && ev.target && ev.target.files ? ev.target.files[0] : null;
  if (!file) return;
  if (!can('patients.import')) { toast('No permission to import patients', 'error'); return; }
  try {
    const text = await file.text();
    const parsed = parsePatientsCsv(text);
    if (!parsed.rows.length) { toast('No valid rows found in CSV', 'error'); return; }
    openPatientImportMappingModal(parsed.headers, parsed.rows, parsed.delimiter);
  } catch (e) {
    toast(e.message || 'Import failed', 'error');
  }
}

async function _renderPatientPackagesInTab() {
  const wrap = document.getElementById('patientMainWrap');
  if (!wrap) return;
  wrap.innerHTML = skeletonTable(5);
  try {
    const subs = await apiFetch('/api/patient-packages').catch(() => []);
    const wrap2 = document.getElementById('patientMainWrap');
    if (!wrap2) return;
    if (!subs || subs.length === 0) {
      wrap2.innerHTML = emptyState(IC.packages, 'No Patient Packages', 'No package subscriptions found.');
      return;
    }
    wrap2.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>Patient</th><th>Package</th><th>Purchased</th><th>Status</th><th>Services</th>
            </tr>
          </thead>
          <tbody>
            ${subs.map(s => {
              const services = (s.services || []).map(sv =>
                `<div style="font-size:12px">${escHtml(sv.service_name)}: <b>${sv.used}/${sv.total}</b></div>`
              ).join('');
              return `<tr>
                <td>${s.id}</td>
                <td>${escHtml(s.patient_name || ('Patient #' + s.patient_id))}</td>
                <td>${escHtml(s.package_name)}</td>
                <td>${escHtml(formatDateTime(s.purchased_at || ''))}</td>
                <td>${statusBadge(s.status)}</td>
                <td>${services || '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) { toast(e.message, 'error'); }
}

async function viewPatient(id) {
  try {
    const [p, apts, rxs, bills, pkgs] = await Promise.all([
      apiFetch(`/api/patients/${id}`),
      apiFetch(`/api/appointments?`),
      apiFetch(`/api/prescriptions?patient_id=${id}`),
      apiFetch(`/api/bills?patient_id=${id}`),
      apiFetch(`/api/patient-packages?patient_id=${id}`).catch(()=>[]),
    ]);
    const patApts = apts.filter(a => a.patient_id === id);
    // Flatten all service line_items from bills
    const allServices = bills.flatMap(b => (b.line_items||[]).map(li => ({ ...li, bill_at: (b.created_at||''), visit_id: b.visit_id||'-', payment_status: b.payment_status })));
    const statusColor = p.patient_status === 'VIP' ? 'var(--c-primary)' : p.patient_status === 'Not Good' ? 'var(--c-danger)' : 'var(--c-success)';

    showModal(`Patient Profile - ${escHtml(p.name)}`, `
      <!-- Patient Info Card -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:22px;font-weight:700">${escHtml(p.name)}${p.second_name ? ` <span style=\"font-weight:400;color:var(--text-muted,#888)\">${escHtml(p.second_name)}</span>` : ''}</div>
            <div style="color:var(--text-muted,#888);font-size:13px;margin-top:2px">MR# <strong style="color:var(--c-primary)">${escHtml(p.mr_number)||'-'}</strong>${p.civil_id ? ` &nbsp;-&nbsp; Civil ID: ${escHtml(p.civil_id)}` : ''}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="openPatientEmr(${p.id})">View Full EMR</button>
            <span style="background:${statusColor}22;color:${statusColor};border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700">${escHtml(p.patient_status||'Good')}</span>
            ${p.blocked ? `<span style="background:var(--c-danger);color:#fff;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700">BLOCKED</span>` : ''}
            ${(Array.isArray(bills) && bills.length) ? (() => {
              // Prefer bill for current appointment if available, else latest bill
              let latestBill = bills[0];
              if (Array.isArray(bills) && bills.length > 1) {
                // Try to find a bill for the latest appointment
                const latestApt = patApts && patApts.length ? patApts.slice().sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))[0] : null;
                if (latestApt) {
                  const aptBill = bills.find(b => b.appointment_id && latestApt.id && String(b.appointment_id) === String(latestApt.id));
                  if (aptBill) latestBill = aptBill;
                  else latestBill = bills.slice().sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))[0];
                } else {
                  latestBill = bills.slice().sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''))[0];
                }
              }
              // Print Bill button removed from patient profile as per user request
              return '';
            })() : '<span style="color:#c00;font-size:12px;margin-left:6px">No bills found</span>'}
          </div>
        </div>
        <div class="detail-grid" style="margin-top:12px">
          <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${escHtml(p.phone)||'-'}</div></div>
          <div class="detail-item"><div class="detail-label">Alt Phone</div><div class="detail-value">${escHtml(p.alt_phone)||'-'}</div></div>
          <div class="detail-item"><div class="detail-label">Date of Birth</div><div class="detail-value">${escHtml(p.dob)||'-'}</div></div>
          <div class="detail-item"><div class="detail-label">Age / Gender</div><div class="detail-value">${p.age||'-'} / ${escHtml(p.gender)||'-'}</div></div>
          <div class="detail-item"><div class="detail-label">Address</div><div class="detail-value">${escHtml(p.address)||'-'}</div></div>
          <div class="detail-item"><div class="detail-label">Registered</div><div class="detail-value">${escHtml(formatDateTime(p.registration_date || p.created_at || ''))}</div></div>
        </div>
        ${p.medical_history ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><span class="detail-label">Medical History: </span><span class="detail-value">${escHtml(p.medical_history)}</span></div>` : ''}
      </div>

      <!-- Summary badges - clickable to switch tabs -->
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px;align-items:stretch">
        <div class="ph-stat-box ph-stat-active" id="phStatAppts" onclick="_phTab('phAppts')" style="background:var(--c-primary-bg);border:1.5px solid var(--c-primary);border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer;transition:var(--transition);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div style="font-size:22px;font-weight:700;color:var(--c-primary);line-height:1">${patApts.length}</div>
          <div style="font-size:10px;font-weight:600;color:var(--c-primary);text-transform:uppercase;letter-spacing:.4px">Appointments</div>
        </div>
        <div class="ph-stat-box" id="phStatBills" onclick="_phTab('phBills')" style="background:var(--bg-hover);border:1.5px solid var(--border);border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer;transition:var(--transition);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${bills.length}</div>
          <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Bills</div>
        </div>
        <div class="ph-stat-box" id="phStatRxs" onclick="_phTab('phRxs')" style="background:var(--bg-hover);border:1.5px solid var(--border);border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer;transition:var(--transition);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${rxs.length}</div>
          <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Prescriptions</div>
        </div>
        <div class="ph-stat-box" id="phStatPkgs" onclick="_phTab('phPkgs')" style="background:var(--bg-hover);border:1.5px solid var(--border);border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer;transition:var(--transition);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${pkgs.length}</div>
          <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Packages</div>
        </div>
        <div class="ph-stat-box" id="phStatSvcs" onclick="_phTab('phSvcs')" style="background:var(--bg-hover);border:1.5px solid var(--border);border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer;transition:var(--transition);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${allServices.length}</div>
          <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Services</div>
        </div>
        <div style="background:var(--c-success-bg);border:1.5px solid var(--c-success);border-radius:10px;padding:12px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div style="font-size:16px;font-weight:700;color:var(--c-success);line-height:1;word-break:break-all">${bills.reduce((s,b)=>s+(parseFloat(b.total)||0),0).toFixed(3)}</div>
          <div style="font-size:10px;font-weight:600;color:var(--c-success);text-transform:uppercase;letter-spacing:.4px">Total Billed</div>
        </div>
      </div>

      <!-- Appointments tab -->
      <div id="phAppts">
        ${patApts.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>${patApts.sort((a,b)=>b.date+b.time<a.date+a.time?-1:1).map(a=>`<tr>
            <td>${escHtml(a.date)}</td>
            <td>${escHtml(a.time||'-')}</td>
            <td>${escHtml(a.doctor_name||'-')}</td>
            <td>${statusBadge(a.status)}</td>
            <td class="text-muted text-sm">${escHtml(a.notes||'-')}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<p class="text-muted text-sm">No appointments on file.</p>`}
      </div>

      <!-- Bills tab -->
      <div id="phBills" style="display:none">
        ${bills.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Bill No.</th><th>Visit ID</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
          <tbody>${bills.map(b=>`<tr>
            <td><span class="code-id code-id-primary">${escHtml(b.bill_number||'-')}</span></td>
            <td><span class="code-id code-id-muted">${escHtml(b.visit_id||'-')}</span></td>
            <td class="text-sm">${escHtml(formatDateTime(b.created_at||''))}</td>
            <td><strong>${(parseFloat(b.total)||0).toFixed(3)}</strong></td>
            <td class="text-sm">${escHtml(b.payment_method||'-')}</td>
            <td>
              <span class="status-badges-wrap">
                ${statusBadge(b.payment_status)}
                ${(Number(b.discount_amount) > 0) ? `<span class="badge badge-discounted">${IC.discount} Discounted</span>` : ''}
              </span>
            </td>
            <td>${canPrintBill(b.created_at) ? `<button class="btn btn-sm" onclick="printBill(${b.id})">${IC.print}</button>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<p class="text-muted text-sm">No bills on file.</p>`}
      </div>


      <!-- Prescriptions tab -->
      <div id="phRxs" style="display:none">
        ${rxs.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Doctor</th><th>Diagnosis</th><th>Medicines</th><th>Dosage</th><th>Progress Note</th><th></th></tr></thead>
          <tbody>${rxs.map(r => {
            const medList = (r.medicines||'').split(/[,\n]/).map(m=>m.trim()).filter(Boolean);
            const dosageList = (r.dosage||'').split(/[,\n]/).map(d=>d.trim()).filter(Boolean);
            return `<tr>
              <td class="text-sm">${escHtml(formatDateTime(r.created_at||''))}</td>
              <td class="text-sm">${escHtml(r.doctor_name||'-')}</td>
              <td class="text-sm">${escHtml(r.diagnosis||'-')}</td>
              <td class="text-sm">${medList.length ? medList.map(m=>`<div>${escHtml(m)}</div>`).join('') : '-'}</td>
              <td class="text-sm">${dosageList.length ? dosageList.map(d=>`<div>${escHtml(d)}</div>`).join('') : '-'}</td>
              <td class="text-sm text-muted">${escHtml(r.progress_note||'-')}</td>
              <td><button class="btn btn-sm" onclick="printPrescription(${r.id})">${IC.print}</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>` : `<p class="text-muted text-sm">No prescriptions on file.</p>`}
      </div>

      <!-- Packages tab -->
      <div id="phPkgs" style="display:none">
        ${pkgs.length ? '<div class="table-wrap"><table>' +
          '<thead><tr><th>Package</th><th>Purchased</th><th>Status</th><th>Services Used</th></tr></thead>' +
          '<tbody>' + pkgs.map(pk => {
            const svcs = (pk.services||[]).map(sv =>
              '<div style="font-size:12px;margin-bottom:2px">' +
                '<span>' + escHtml(sv.service_name||'') + '</span>' +
                '<span style="margin-left:6px;font-weight:600;color:' + (sv.used>=sv.total ? 'var(--c-danger)' : 'var(--c-success)') + '">' + sv.used + '/' + sv.total + ' used</span>' +
              '</div>').join('');
            return '<tr>' +
              '<td><strong>' + escHtml(pk.package_name||'-') + '</strong></td>' +
              '<td class="text-sm">' + escHtml(formatDateTime(pk.purchased_at||'')) + '</td>' +
              '<td>' + statusBadge(pk.status) + '</td>' +
              '<td>' + (svcs || '-') + '</td>' +
              '</tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="text-muted text-sm">No packages on file.</p>'}
      </div>

      <!-- Services tab -->
      <div id="phSvcs" style="display:none">
        ${allServices.length ? '<div class="table-wrap"><table>' +
          '<thead><tr><th>Date</th><th>Visit ID</th><th>Service / Item</th><th>Type</th><th>Amount</th></tr></thead>' +
          '<tbody>' + allServices.map(sv =>
            '<tr>' +
              '<td class="text-sm">' + escHtml(formatDateTime(sv.bill_at||'')) + '</td>' +
              '<td><span class="code-id code-id-muted">' + escHtml(sv.visit_id||'-') + '</span></td>' +
              '<td><strong>' + escHtml(sv.name||sv.service_name||'-') + '</strong></td>' +
              '<td><span style="font-size:11px;background:var(--bg-hover);border-radius:4px;padding:2px 6px">' + escHtml(sv.type||'service') + '</span></td>' +
              '<td>' + (parseFloat(sv.amount)||0).toFixed(3) + '</td>' +
            '</tr>').join('') + '</tbody></table></div>'
        : '<p class="text-muted text-sm">No services on file.</p>'}
      </div>
    `, null, 'modal-lg');
    setTimeout(() => _phTab('phAppts'), 0);
  } catch(e) { toast(e.message, 'error'); }
}

function _phTab(showId) {
  const statMap = { phAppts:'phStatAppts', phBills:'phStatBills', phRxs:'phStatRxs', phPkgs:'phStatPkgs', phSvcs:'phStatSvcs' };
  ['phAppts','phBills','phRxs','phPkgs','phSvcs'].forEach(id => {
    const panel = document.getElementById(id);
    if (panel) panel.style.display = id === showId ? '' : 'none';
    const box = document.getElementById(statMap[id]);
    if (box) {
      box.style.borderColor = id === showId ? 'var(--c-primary)' : 'var(--border)';
      box.style.background = id === showId ? 'var(--c-primary)' : 'var(--bg-card)';
      const numEl = box.querySelector('div:first-child');
      const lblEl = box.querySelector('div:last-child');
      if (numEl) numEl.style.color = id === showId ? '#fff' : 'var(--c-primary)';
      if (lblEl) lblEl.style.color = id === showId ? 'rgba(255,255,255,0.85)' : 'var(--text-muted,#888)';
    }
  });
}

let _patientEmrState = { patientId: null, data: null, loading: false };

function getPatientEmrFiltersFromUI() {
  return {
    date_from: document.getElementById('emrDateFrom')?.value || '',
    date_to: document.getElementById('emrDateTo')?.value || '',
    doctor_id: document.getElementById('emrDoctorFilter')?.value || '',
    department_id: document.getElementById('emrDepartmentFilter')?.value || '',
  };
}

function patientEmrFileStem() {
  const p = _patientEmrState?.data?.patient || {};
  return String(`${p.mr_number || 'patient'}_${p.name || 'emr'}`)
    .replace(/[^a-z0-9_-]+/ig, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'patient_emr';
}

function normalizePatientEmrDateKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function splitPatientEmrList(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .split(/\n|,|;/)
    .map(v => String(v || '').trim())
    .filter(Boolean);
}

function buildPatientEmrMedicineRows(medicines, dosage) {
  const medRows = splitPatientEmrList(medicines);
  const dosageRows = splitPatientEmrList(dosage);
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
}

function patientEmrIsLabLike(label, category = '') {
  return /lab|test|scan|x\s*-?ray|xray|mri|ct|ultra\s*sound|report/i.test(`${label} ${category}`);
}

function uniqPatientEmrByKey(rows, keyFn) {
  const seen = new Set();
  return rows.filter(row => {
    const key = keyFn(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPatientEmrClientData(payload, appliedFilters = {}) {
  const patient = payload.patient || {};
  const appointments = Array.isArray(payload.appointments) ? payload.appointments : [];
  const prescriptions = Array.isArray(payload.prescriptions) ? payload.prescriptions : [];
  const bills = Array.isArray(payload.bills) ? payload.bills : [];
  const patientPackages = Array.isArray(payload.patientPackages) ? payload.patientPackages : [];
  const doctors = Array.isArray(payload.doctors) ? payload.doctors : [];
  const departments = Array.isArray(payload.departments) ? payload.departments : [];

  const doctorsById = new Map(doctors.map(d => [parseInt(d.id, 10), d]));
  const departmentsById = new Map(departments.map(d => [parseInt(d.id, 10), d]));
  const appointmentsById = new Map(appointments.map(a => [parseInt(a.id, 10), a]));
  const billsById = new Map(bills.map(b => [parseInt(b.id, 10), b]));
  const appointmentsByVisitId = new Map(
    appointments
      .filter(a => String(a.visit_id || '').trim())
      .map(a => [String(a.visit_id || '').trim(), a])
  );
  const prescriptionsByVisitId = new Map(
    prescriptions
      .filter(rx => String(rx.visit_id || '').trim())
      .map(rx => [String(rx.visit_id || '').trim(), rx])
  );

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

  appointments.forEach(appointment => {
    const doctor = doctorsById.get(parseInt(appointment.doctor_id, 10)) || {};
    const department = departmentsById.get(parseInt(doctor.department_id || appointment.department_id || '', 10)) || {};
    const dateKey = normalizePatientEmrDateKey(appointment.date || appointment.created_at);
    const entry = ensureEntry(`appointment:${appointment.id}`, {
      date: dateKey,
      date_time: appointment.date ? `${appointment.date}T${appointment.time || '00:00'}` : String(appointment.created_at || ''),
      appointment_status: appointment.status || '',
      appointment_time: appointment.time || '',
      doctor_id: parseInt(doctor.id || appointment.doctor_id, 10) || null,
      doctor_name: doctor.name || appointment.doctor_name || '',
      department_id: parseInt(department.id || doctor.department_id || '', 10) || null,
      department_name: department.name || appointment.doctor_department_name || doctor.department_name || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    const noteText = String(appointment.notes || '').trim();
    if (noteText && !entry.notes.some(n => n.source === 'Appointment' && n.text === noteText)) {
      entry.notes.push({ source: 'Appointment', text: noteText });
    }
  });

  bills.forEach(bill => {
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
    const dateKey = normalizePatientEmrDateKey((linkedAppointment && linkedAppointment.date) || bill.created_at);
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
      doctor_name: doctor.name || (linkedAppointment && linkedAppointment.doctor_name) || '',
      department_id: parseInt(department.id || doctor.department_id, 10) || null,
      department_name: department.name || (linkedAppointment && linkedAppointment.doctor_department_name) || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    if (bill.bill_number && !entry.bill_numbers.includes(bill.bill_number)) entry.bill_numbers.push(bill.bill_number);
    if (bill.payment_status && !entry.payment_statuses.includes(bill.payment_status)) entry.payment_statuses.push(bill.payment_status);

    (bill.line_items || []).forEach(item => {
      const selectedNames = Array.isArray(item.selected_service_names)
        ? item.selected_service_names.map(name => String(name || '').trim()).filter(Boolean)
        : [];
      const itemNames = selectedNames.length
        ? selectedNames
        : [item.name || item.service_name || item.package_name || item.type || 'Service'].filter(Boolean);
      const amountPerItem = itemNames.length > 1
        ? (parseFloat(item.amount || 0) || 0) / itemNames.length
        : (parseFloat(item.amount || 0) || 0);

      itemNames.forEach(itemName => {
        const serviceRow = {
          name: itemName,
          category: item.category || item.type || 'service',
          type: item.type || 'service',
          amount: amountPerItem,
        };
        if (!entry.services.some(s => `${s.name}|${s.category}|${s.type}|${s.amount}` === `${serviceRow.name}|${serviceRow.category}|${serviceRow.type}|${serviceRow.amount}`)) {
          entry.services.push(serviceRow);
        }
        if (patientEmrIsLabLike(itemName, item.category || item.type || '')) {
          const labRow = { name: itemName, category: item.category || item.type || 'service', source: bill.bill_number || `Bill #${bill.id}` };
          if (!entry.lab_reports.some(r => `${r.name}|${r.category}|${r.source}` === `${labRow.name}|${labRow.category}|${labRow.source}`)) {
            entry.lab_reports.push(labRow);
          }
        }
      });
    });
  });

  prescriptions.forEach(rx => {
    const linkedAppointment = appointmentsById.get(parseInt(rx.appointment_id, 10));
    const doctor = doctorsById.get(parseInt(rx.doctor_id || (linkedAppointment && linkedAppointment.doctor_id), 10)) || {};
    const department = departmentsById.get(parseInt(doctor.department_id || (linkedAppointment && linkedAppointment.department_id), 10)) || {};
    const visitId = String(rx.visit_id || '').trim();
    const dateKey = normalizePatientEmrDateKey((linkedAppointment && linkedAppointment.date) || rx.created_at);
    const entryKey = visitId
      ? `visit:${visitId}`
      : (linkedAppointment ? `appointment:${linkedAppointment.id}` : `prescription:${rx.id}`);
    const entry = ensureEntry(entryKey, {
      visit_id: visitId,
      date: dateKey,
      date_time: String(rx.created_at || ''),
      appointment_status: linkedAppointment ? (linkedAppointment.status || '') : '',
      appointment_time: linkedAppointment ? (linkedAppointment.time || '') : '',
      doctor_id: parseInt(doctor.id || rx.doctor_id, 10) || null,
      doctor_name: doctor.name || rx.doctor_name || '',
      department_id: parseInt(department.id || doctor.department_id, 10) || null,
      department_name: department.name || (linkedAppointment && linkedAppointment.doctor_department_name) || doctor.department_name || '',
    });
    if (entry.doctor_id && !entry.doctor_ids.includes(entry.doctor_id)) entry.doctor_ids.push(entry.doctor_id);
    if (entry.department_id && !entry.department_ids.includes(entry.department_id)) entry.department_ids.push(entry.department_id);
    if (rx.diagnosis && !entry.diagnoses.includes(rx.diagnosis)) entry.diagnoses.push(rx.diagnosis);
    if (!entry.prescriptions.some(item => String(item.id) === String(rx.id))) {
      entry.prescriptions.push({
        id: parseInt(rx.id, 10),
        created_at: rx.created_at || '',
        diagnosis: rx.diagnosis || '',
        medicines: rx.medicines || '',
        dosage: rx.dosage || '',
        notes: rx.notes || '',
        medicine_rows: buildPatientEmrMedicineRows(rx.medicines, rx.dosage),
      });
    }
  });

  patientPackages
    .flatMap(pkg => Array.isArray(pkg.session_log) ? pkg.session_log.map(log => ({ pkg, log })) : [])
    .forEach(row => {
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
      const dateKey = normalizePatientEmrDateKey(row.log.date);
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
      (Array.isArray(row.log.service_names) ? row.log.service_names : []).forEach(serviceName => {
        const svc = { name: serviceName, category: 'Package Session', type: 'package-session', amount: 0 };
        if (!entry.services.some(s => `${s.name}|${s.category}|${s.type}` === `${svc.name}|${svc.category}|${svc.type}`)) entry.services.push(svc);
      });
    });

  const allEntries = Array.from(timelineMap.values())
    .map(entry => {
      entry.doctor_ids = uniqPatientEmrByKey(entry.doctor_ids.map(id => ({ id })), row => row.id).map(row => row.id);
      entry.department_ids = uniqPatientEmrByKey(entry.department_ids.map(id => ({ id })), row => row.id).map(row => row.id);
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
    doctors: uniqPatientEmrByKey(allEntries
      .filter(entry => entry.doctor_id)
      .map(entry => ({ id: entry.doctor_id, name: entry.doctor_name || `Doctor #${entry.doctor_id}` })), row => String(row.id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    departments: uniqPatientEmrByKey(allEntries
      .filter(entry => entry.department_id)
      .map(entry => ({ id: entry.department_id, name: entry.department_name || `Department #${entry.department_id}` })), row => String(row.id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    services: uniqPatientEmrByKey(allEntries
      .flatMap(entry => entry.services || [])
      .map(service => ({ value: String(service.name || '').trim().toLowerCase(), label: service.name || 'Service' }))
      .filter(service => service.value), service => service.value)
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''))),
  };

  const dateFrom = normalizePatientEmrDateKey(appliedFilters.date_from);
  const dateTo = normalizePatientEmrDateKey(appliedFilters.date_to);
  const doctorId = parseInt(appliedFilters.doctor_id, 10) || null;
  const departmentId = parseInt(appliedFilters.department_id, 10) || null;
  const serviceKey = String(appliedFilters.service || '').trim().toLowerCase();

  const filteredEntries = allEntries.filter(entry => {
    const hasPrescription = Array.isArray(entry.prescriptions) && entry.prescriptions.length > 0;
    if (!hasPrescription) return false;
    const entryDate = entry.date || normalizePatientEmrDateKey(entry.date_time);
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
  const ongoingMedications = uniqPatientEmrByKey((latestMedicationSource ? latestMedicationSource.prescriptions : [])
    .flatMap(rx => Array.isArray(rx.medicine_rows) ? rx.medicine_rows : [])
    .filter(row => row && row.name)
    .map(row => ({ name: row.name, dosage: row.dosage || row.instructions || '' })), row => `${row.name}|${row.dosage}`)
    .slice(0, 8);
  const chronicConditions = uniqPatientEmrByKey(splitPatientEmrList(patient.medical_history).map(name => ({ name })), row => row.name.toLowerCase());

  return {
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
        prescriptions: prescriptions.length,
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
  };
}

async function fetchPatientEmrFallback(patientId, filters = {}) {
  const [patient, doctors, departments, appointments, prescriptions, bills, patientPackages] = await Promise.all([
    apiFetch(`/api/patients/${patientId}`),
    apiFetch('/api/doctors').catch(() => []),
    apiFetch('/api/doctor-departments').catch(() => []),
    apiFetch('/api/appointments').catch(() => []),
    apiFetch(`/api/prescriptions?patient_id=${patientId}`).catch(() => []),
    apiFetch(`/api/bills?patient_id=${patientId}`).catch(() => []),
    apiFetch(`/api/patient-packages?patient_id=${patientId}`).catch(() => []),
  ]);

  return buildPatientEmrClientData({
    patient,
    doctors,
    departments,
    appointments: (appointments || []).filter(a => parseInt(a.patient_id, 10) === parseInt(patientId, 10)),
    prescriptions,
    bills,
    patientPackages,
  }, filters);
}

function renderPatientEmrSummaryList(items, fallbackText) {
  if (!Array.isArray(items) || !items.length) return `<div class="text-sm text-muted">${escHtml(fallbackText)}</div>`;
  return `<div class="patient-emr-chip-list">${items.map(item => {
    const label = item && typeof item === 'object' ? (item.name || item.label || '') : String(item || '');
    const sub = item && typeof item === 'object' ? (item.dosage || item.value || '') : '';
    return `<span class="patient-emr-chip">${escHtml(label)}${sub ? `<small>${escHtml(sub)}</small>` : ''}</span>`;
  }).join('')}</div>`;
}

function renderPatientEmrTimelineEntry(entry, index) {
  const isPackageSessionOnly = (!entry.doctor_name) && Array.isArray(entry.services) && entry.services.length > 0
    && entry.services.every(s => String(s.type || '').toLowerCase() === 'package-session');
  const doctorLabel = entry.doctor_name || (isPackageSessionOnly ? 'Package Session' : 'Doctor not linked');
  const diagnosisHtml = Array.isArray(entry.diagnoses) && entry.diagnoses.length
    ? entry.diagnoses.map(d => `<span class="patient-emr-pill">${escHtml(d)}</span>`).join('')
    : '<span class="text-sm text-muted">No diagnosis recorded</span>';

  const notesHtml = Array.isArray(entry.notes) && entry.notes.length
    ? `<div class="patient-emr-note-list">${entry.notes.map(note => `
        <div class="patient-emr-note-item">
          <strong>${escHtml(note.source || 'Note')}</strong>
          <p>${escHtml(note.text || '')}</p>
        </div>`).join('')}
      </div>`
    : '<div class="text-sm text-muted">No notes recorded.</div>';

  const prescriptionsHtml = Array.isArray(entry.prescriptions) && entry.prescriptions.length
    ? entry.prescriptions.map(rx => `
      <div class="patient-emr-rx-card">
        <div class="patient-emr-rx-head">
          <span class="text-sm text-muted">${escHtml(formatDateTime(rx.created_at || entry.date || ''))}</span>
        </div>
        ${Array.isArray(rx.medicine_rows) && rx.medicine_rows.length ? `
          <div class="patient-emr-med-grid">
            ${rx.medicine_rows.map(row => `
              <div class="patient-emr-med-item">
                <strong>${escHtml(row.name || 'Medicine')}</strong>
                <span>${escHtml(row.dosage || 'No dosage recorded')}</span>
                ${row.instructions ? `<small>${escHtml(row.instructions)}</small>` : ''}
              </div>`).join('')}
          </div>` : '<div class="text-sm text-muted">No medicine details recorded.</div>'}
        ${rx.notes ? `<div class="patient-emr-inline-note"><strong>Instructions:</strong> ${escHtml(rx.notes)}</div>` : ''}
      </div>`).join('')
    : '<div class="text-sm text-muted">No prescriptions recorded for this visit.</div>';

  const labHtml = Array.isArray(entry.lab_reports) && entry.lab_reports.length
    ? `<div class="patient-emr-chip-list">${entry.lab_reports.map(report => `<span class="patient-emr-chip"><strong>${escHtml(report.name || 'Report')}</strong><small>${escHtml(report.source || 'Linked service')}</small></span>`).join('')}</div>`
    : '<div class="text-sm text-muted">No lab reports linked for this visit.</div>';

  const attachmentsHtml = Array.isArray(entry.attachments) && entry.attachments.length
    ? `<div class="patient-emr-attachment-list">${entry.attachments.map(att => {
      const label = att && typeof att === 'object' ? (att.name || att.label || 'Attachment') : String(att || 'Attachment');
      const href = att && typeof att === 'object' ? (att.url || att.path || '') : '';
      return href
        ? `<a class="patient-emr-attachment" href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">${escHtml(label)}</a>`
        : `<span class="patient-emr-attachment">${escHtml(label)}</span>`;
    }).join('')}</div>`
    : '<div class="text-sm text-muted">No attachments uploaded for this visit.</div>';

  return `
    <details class="patient-emr-entry" ${index === 0 ? 'open' : ''}>
      <summary>
        <div class="patient-emr-entry-date">${escHtml(formatDateTime(entry.date || entry.date_time || ''))}</div>
        <div class="patient-emr-entry-main">
          <div class="patient-emr-entry-head">
            <strong>${escHtml(doctorLabel)}</strong>
            ${entry.department_name ? `<span class="patient-emr-pill patient-emr-pill-soft">${escHtml(entry.department_name)}</span>` : ''}
            ${entry.appointment_status ? statusBadge(entry.appointment_status) : ''}
          </div>
          <div class="patient-emr-entry-meta">
            ${entry.visit_id ? `<span>Visit ID: ${escHtml(entry.visit_id)}</span>` : ''}
            ${entry.bill_numbers && entry.bill_numbers.length ? `<span>${escHtml(entry.bill_numbers.join(', '))}</span>` : ''}
          </div>
        </div>
      </summary>
      <div class="patient-emr-entry-body">
        <section>
          <h5>Diagnosis</h5>
          <div class="patient-emr-pill-wrap">${diagnosisHtml}</div>
        </section>
        <section>
          <h5>Prescriptions</h5>
          ${prescriptionsHtml}
        </section>
        <section>
          <h5>Notes</h5>
          ${notesHtml}
        </section>
        <section>
          <h5>Lab Reports</h5>
          ${labHtml}
        </section>
        <section>
          <h5>Attachments</h5>
          ${attachmentsHtml}
        </section>
      </div>
    </details>`;
}

function renderPatientEmrModal() {
  const data = _patientEmrState.data;
  if (!data) return;
  const p = data.patient || {};
  const summary = data.summary || {};
  const latest = summary.latest_visit || null;
  const filters = data.filters || {};
  const applied = data.applied_filters || {};
  const timeline = (Array.isArray(data.timeline) ? data.timeline : [])
    .filter(entry => Array.isArray(entry.prescriptions) && entry.prescriptions.length > 0);

  const bodyHtml = `
    <div class="patient-emr" id="patientEmrPrintable">
      <div class="patient-emr-top no-print">
        <div class="patient-emr-filters">
          <div class="form-group"><label>From</label><input type="date" id="emrDateFrom" value="${escHtml(applied.date_from || '')}"/></div>
          <div class="form-group"><label>To</label><input type="date" id="emrDateTo" value="${escHtml(applied.date_to || '')}"/></div>
          <div class="form-group"><label>Doctor</label>
            <select id="emrDoctorFilter">
              <option value="">All Doctors</option>
              ${(filters.doctors || []).map(d => `<option value="${d.id}" ${String(applied.doctor_id || '') === String(d.id) ? 'selected' : ''}>${escHtml(d.name || `Doctor #${d.id}`)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Department</label>
            <select id="emrDepartmentFilter">
              <option value="">All Departments</option>
              ${(filters.departments || []).map(d => `<option value="${d.id}" ${String(applied.department_id || '') === String(d.id) ? 'selected' : ''}>${escHtml(d.name || `Department #${d.id}`)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="patient-emr-actions">
          <button class="btn btn-primary" onclick="openPatientEmr(${parseInt(p.id, 10)}, getPatientEmrFiltersFromUI())">${IC.search} Apply</button>
          <button class="btn" onclick="openPatientEmr(${parseInt(p.id, 10)})">Reset</button>
          <button class="btn" onclick="printPatientEmr()">${IC.print} Print</button>
          <button class="btn" onclick="exportPatientEmrPdf()">Export PDF</button>
        </div>
      </div>

      <div class="patient-emr-layout">
        <aside class="patient-emr-left">
          <div class="patient-emr-patient-card">
            <h4>${escHtml(p.name || 'Patient')}</h4>
            <div class="text-sm text-muted">MR#: <strong>${escHtml(p.mr_number || '-')}</strong></div>
            <div class="text-sm text-muted">Phone: ${escHtml(p.phone || '-')}</div>
            <div class="text-sm text-muted">Civil ID: ${escHtml(p.civil_id || '-')}</div>
            <div class="text-sm text-muted">DOB: ${escHtml(p.dob || '-')}</div>
            <div class="text-sm text-muted">Registered: ${escHtml(formatDateTime(p.registration_date || ''))}</div>
          </div>

          <div class="patient-emr-summary-card">
            <h5>Quick Summary</h5>
            <div class="text-sm"><strong>Latest Visit:</strong> ${latest ? escHtml(formatDateTime(latest.date || '')) : '-'}</div>
            <div class="text-sm text-muted">${latest ? escHtml(latest.doctor_name || 'Doctor not linked') : 'No visit found'}</div>
            <div class="text-sm text-muted">${latest && latest.diagnosis ? escHtml(latest.diagnosis) : 'No diagnosis yet'}</div>
            <div class="patient-emr-counts">
              <span>Visits: <strong>${(summary.counts && summary.counts.visits) || 0}</strong></span>
              <span>Prescriptions: <strong>${(summary.counts && summary.counts.prescriptions) || 0}</strong></span>
              <span>Lab Reports: <strong>${(summary.counts && summary.counts.lab_reports) || 0}</strong></span>
            </div>
          </div>

          <div class="patient-emr-summary-card">
            <h5>Ongoing Medications</h5>
            ${renderPatientEmrSummaryList(summary.ongoing_medications, 'No ongoing medications recorded.')}
          </div>

          <div class="patient-emr-summary-card">
            <h5>Chronic Conditions</h5>
            ${renderPatientEmrSummaryList(summary.chronic_conditions, 'No chronic conditions recorded.')}
          </div>
        </aside>

        <section class="patient-emr-right">
          <div class="patient-emr-timeline-header">
            <h4>Date-wise Consolidated Timeline</h4>
            <span class="text-sm text-muted">${timeline.length} entr${timeline.length === 1 ? 'y' : 'ies'}</span>
          </div>
          <div class="patient-emr-timeline">
            ${timeline.length
              ? timeline.map((entry, idx) => renderPatientEmrTimelineEntry(entry, idx)).join('')
              : '<div class="text-sm text-muted">No EMR entries found for selected filters.</div>'}
          </div>
        </section>
      </div>
    </div>`;

  showModal(`Patient EMR - ${escHtml(p.name || '')}`, bodyHtml, null, 'modal-emr');
}

async function openPatientEmr(patientId, filters = null) {
  const id = parseInt(patientId, 10);
  if (!id) return;
  const query = new URLSearchParams();
  const f = filters || {};
  Object.keys(f).forEach(key => {
    const val = String(f[key] || '').trim();
    if (val) query.set(key, val);
  });
  _patientEmrState = { patientId: id, data: null, loading: true };
  try {
    let data = await apiFetch(`/api/patients/${id}/emr${query.toString() ? `?${query.toString()}` : ''}`);
    if (!data.patient || (!data.patient.name && !data.patient.mr_number)) {
      try {
        const p = await apiFetch(`/api/patients/${id}`);
        data.patient = {
          ...(data.patient || {}),
          id: p.id,
          mr_number: p.mr_number || '',
          name: p.name || '',
          second_name: p.second_name || '',
          phone: p.phone || '',
          alt_phone: p.alt_phone || '',
          civil_id: p.civil_id || '',
          dob: p.dob || '',
          age: p.age || '',
          gender: p.gender || '',
          address: p.address || '',
          medical_history: p.medical_history || '',
          patient_status: p.patient_status || 'Good',
          registration_date: p.registration_date || p.created_at || '',
          blocked: !!p.blocked,
        };
      } catch (_) {
        // Keep EMR payload if direct patient fetch fails.
      }
    }
    const missingTimeline = !Array.isArray(data.timeline) || data.timeline.length === 0;
    const missingFilters = !data.filters || (!Array.isArray(data.filters.doctors) || !Array.isArray(data.filters.departments) || !Array.isArray(data.filters.services));
    const emptyDropdowns = !missingFilters && data.filters.doctors.length === 0 && data.filters.departments.length === 0 && data.filters.services.length === 0;
    if (missingTimeline || missingFilters || emptyDropdowns) {
      data = await fetchPatientEmrFallback(id, f);
    }
    _patientEmrState = { patientId: id, data, loading: false };
    renderPatientEmrModal();
  } catch (e) {
    _patientEmrState.loading = false;
    toast(e.message || 'Failed to load EMR', 'error');
  }
}

function printPatientEmr() {
  const source = document.getElementById('patientEmrPrintable');
  if (!source) return;
  const clone = source.cloneNode(true);
  clone.querySelectorAll('.no-print').forEach(el => el.remove());
  clone.querySelectorAll('details').forEach(el => el.setAttribute('open', 'open'));
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) { toast('Popup blocked. Please allow popups to print EMR.', 'error'); return; }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Patient EMR</title><link rel="stylesheet" href="style.css"></head><body>${clone.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function exportPatientEmrPdf() {
  const source = document.getElementById('patientEmrPrintable');
  if (!source) return;
  const clone = source.cloneNode(true);
  clone.querySelectorAll('.no-print').forEach(el => el.remove());
  clone.querySelectorAll('details').forEach(el => el.setAttribute('open', 'open'));
  const fileName = `${patientEmrFileStem()}_${new Date().toISOString().slice(0, 10)}.pdf`;
  html2pdf().set({
    margin: 8,
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { allowTaint: true, scale: 1.5 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  }).from(clone).save();
}


function openPatientModal(id = null) {
  const edit = id !== null;
  showModal(edit ? 'Edit Patient' : 'Register Patient', `
    <form id="patientForm">
      ${edit ? '' : '<p class="text-muted text-sm" style="margin-bottom:8px">MR Number will be assigned automatically.</p>'}
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input name="name" required/></div>
        <div class="form-group"><label>Second Name</label><input name="second_name" placeholder="Optional second / family name"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Civil ID Number</label><input name="civil_id" id="pfCivilId" pattern="\\d{12}" maxlength="12" placeholder="12-digit number" title="Must be exactly 12 digits" inputmode="numeric" oninput="checkPatDup('civil_id',this.value,${id||'null'})"/><div id="pfCivilIdMsg" class="text-sm" style="min-height:16px;margin-top:3px"></div></div>
        <div class="form-group"><label>Date of Birth</label><input name="dob" type="date"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input name="phone" id="pfPhone" type="tel" placeholder="Primary phone" oninput="checkPatDup('phone',this.value,${id||'null'})"/><div id="pfPhoneMsg" class="text-sm" style="min-height:16px;margin-top:3px"></div></div>
        <div class="form-group"><label>Alternative Phone</label><input name="alt_phone" id="pfAltPhone" type="tel" placeholder="Optional alternative number" oninput="checkPatDup('alt_phone',this.value,${id||'null'})"/><div id="pfAltPhoneMsg" class="text-sm" style="min-height:16px;margin-top:3px"></div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Age</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="age" type="number" min="0" max="120"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Gender</label><select name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Patient Status</label>
          <select name="patient_status">
            <option value="Good">Good</option>
            <option value="VIP">VIP</option>
            <option value="Not Good">Not Good</option>
          </select>
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end;padding-bottom:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" name="blocked" value="1" class="theme-checkbox"/>
            <span>Block this patient <span class="text-muted text-sm">(hidden from appointment registration)</span></span>
          </label>
        </div>
      </div>
      <div class="form-group"><label>Address</label><textarea name="address" rows="2"></textarea></div>
      <div class="form-group"><label>Medical History</label><textarea name="medical_history" rows="2"></textarea></div>
    </form>`,
    async () => {
      const f = document.getElementById('patientForm');
      const body = Object.fromEntries(new FormData(f));
      // Checkbox handling: if unchecked it won't appear in FormData
      body.blocked = f.elements['blocked']?.checked ? '1' : '0';
      if (body.civil_id && !/^\d{12}$/.test(body.civil_id)) { toast('Civil ID must be exactly 12 digits','error'); return false; }
      try {
        if (edit) {
          await apiFetch(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('Patient updated', 'success');
        } else {
          await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(body) });
          toast('Patient registered', 'success');
        }
        closeModal(); patients();
      } catch(e) { toast(e.message, 'error'); return false; }
    }, 'modal-lg');

  if (edit) {
    apiFetch(`/api/patients/${id}`).then(p => {
      const f = document.getElementById('patientForm');
      Object.keys(p).forEach(k => {
        const el = f.elements[k];
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!p[k];
        else el.value = p[k] || '';
      });
    });
  }
  // Attach DOB -> Age auto-fill handler
  setTimeout(() => {
    const f = document.getElementById('patientForm');
    if (!f) return;
    const dobEl = f.elements['dob'];
    const ageEl = f.elements['age'];
    function computeAgeFromDob() {
      if (!dobEl || !ageEl) return;
      const v = dobEl.value;
      if (!v) { ageEl.value = ''; return; }
      const dob = new Date(v);
      if (isNaN(dob)) { ageEl.value = ''; return; }
      const today = new Date();
      let years = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years--;
      ageEl.value = Math.max(0, years);
    }
    dobEl?.addEventListener('change', computeAgeFromDob);
    dobEl?.addEventListener('input', computeAgeFromDob);
    // compute initially if value present
    computeAgeFromDob();
  }, 50);
}

async function deletePatient(id, name) {
  if (!await confirmDialog(`Delete patient "${name}"? This cannot be undone.`)) return;
  try { await apiFetch(`/api/patients/${id}`, { method: 'DELETE' }); toast('Patient deleted', 'success'); patients(); }
  catch(e) { toast(e.message, 'error'); }
}

async function togglePatientBlocked(id, shouldBlock, name) {
  const actionLabel = shouldBlock ? 'block' : 'unblock';
  if (!await confirmDialog(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} patient "${name}"?`)) return;
  try {
    await apiFetch(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ blocked: shouldBlock ? '1' : '0' })
    });
    toast(`Patient ${shouldBlock ? 'blocked' : 'unblocked'}`, 'success');
    patients(_patLastSearch || '', _patPage || 1, _patMode || 'all');
  } catch(e) {
    toast(e.message, 'error');
  }
}

const _patDupTimers = {};
async function checkPatDup(field, value, excludeId) {
  const msgEl = document.getElementById(`pf${field.charAt(0).toUpperCase()+field.slice(1).replace('_p','P')}Msg`);
  // Map field names to msg element IDs
  const msgIds = { phone: 'pfPhoneMsg', alt_phone: 'pfAltPhoneMsg', civil_id: 'pfCivilIdMsg' };
  const el = document.getElementById(msgIds[field]);
  if (!el) return;
  clearTimeout(_patDupTimers[field]);
  if (!value || value.length < 3) { el.textContent = ''; return; }
  _patDupTimers[field] = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ [field]: value });
      if (excludeId) params.set('exclude_id', excludeId);
      const res = await apiFetch(`/api/patients/check-duplicate?${params}`);
      if (res[field]) {
        el.style.color = 'var(--c-danger)';
        el.textContent = `This ${field === 'civil_id' ? 'Civil ID' : field === 'alt_phone' ? 'alt phone' : 'phone number'} is already registered to another patient.`;
      } else {
        el.style.color = 'var(--c-success)';
        el.textContent = 'Available';
      }
    } catch { el.textContent = ''; }
  }, 400);
}

// --------------------------------------------------------
//  APPOINTMENTS (Calendar + List)
// --------------------------------------------------------
let calYear, calMonth, calSelectedDate = '', calAllApts = [], aptViewMode = 'list';
let aptFilterDateFrom = '', aptFilterDateTo = '', aptFilterDoctor = '', aptFilterStatus = '';
let aptFilterName = '', aptFilterMR = '', aptFilterCivil = '';

function aptTodayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

async function appointments() {
  const now = new Date();
  if (!calYear)  calYear  = now.getFullYear();
  if (!calMonth && calMonth !== 0) calMonth = now.getMonth();

  // Always reset to today when opening the appointments page
  aptFilterDateFrom = aptTodayStr();
  aptFilterDateTo   = aptTodayStr();

  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="page-hero compact">
      <div>
        <h2 class="page-hero-title">Appointment Flow</h2>
        <p class="page-hero-sub">Switch views, reschedule quickly, and keep queue status visible.</p>
      </div>
    </div>

    <div class="action-bar">
      <div class="tabs">
        <button class="tab-btn ${aptViewMode==='calendar'?'active':''}" onclick="aptViewMode='calendar';appointments()">${IC.calendar} Calendar</button>
        <button class="tab-btn ${aptViewMode==='list'?'active':''}" onclick="aptViewMode='list';appointments()">${IC.list} List</button>
      </div>
      <button class="btn" onclick="aptSetToday()">${IC.calendar} Today</button>
      <button class="btn" onclick="aptFilterDateFrom=aptTodayStr();aptFilterDateTo='';appointmentsList()">Next Window</button>
      ${can('appointments.create') ? `<button class="btn btn-primary" onclick="openNewAppointmentModal()">${IC.plus} Book Appointment</button>` : ''}
    </div>
    <div id="aptViewBody">${skeletonTable(5)}</div>`;

  if (aptViewMode === 'list') { appointmentsList(); return; }

  try {
    let url = '/api/appointments?';
    if (aptFilterDoctor) url += `doctor_id=${aptFilterDoctor}&`;
    calAllApts = await apiFetch(url);
    renderCalendar();
  } catch(e) {
    document.getElementById('aptViewBody').innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function renderCalendar() {
  const body   = document.getElementById('aptViewBody');
  const todayS = new Date().toISOString().slice(0,10);
  const first  = new Date(calYear, calMonth, 1);
  const last   = new Date(calYear, calMonth+1, 0);
  const startDow = first.getDay();
  const daysInMonth = last.getDate();
  const monthName = first.toLocaleString('en-IN', { month:'long', year:'numeric' });

  let cells = '';
  const prevLast = new Date(calYear, calMonth, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i;
    const dt = fmtDate(calYear, calMonth - 1, d);
    cells += calCellHtml(d, dt, true, todayS);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = fmtDate(calYear, calMonth, d);
    cells += calCellHtml(d, dt, false, todayS);
  }
  const totalCells = startDow + daysInMonth;
  const rem = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= rem; d++) {
    const dt = fmtDate(calYear, calMonth + 1, d);
    cells += calCellHtml(d, dt, true, todayS);
  }

  body.innerHTML = `
    <div class="cal-header">
      <button class="btn btn-sm" onclick="calPrev()">${IC.chevLeft} Prev</button>
      <h3>${monthName}</h3>
      <button class="btn btn-sm" onclick="calNext()">Next ${IC.chevRight}</button>
      <button class="btn btn-sm btn-primary" onclick="calToday()">Today</button>
    </div>
    <div class="cal-grid">
      <div class="cal-day-name">Sun</div><div class="cal-day-name">Mon</div><div class="cal-day-name">Tue</div>
      <div class="cal-day-name">Wed</div><div class="cal-day-name">Thu</div><div class="cal-day-name">Fri</div><div class="cal-day-name">Sat</div>
      ${cells}
    </div>
    <div id="calDayDetail" class="cal-day-detail">
      ${calSelectedDate ? '' : `<p class="text-muted" style="text-align:center;padding:16px">Click a date to see appointments</p>`}
    </div>`;

  if (calSelectedDate) showDayDetail(calSelectedDate);
}

function calCellHtml(day, dateStr, isOther, todayStr) {
  const apts = calAllApts.filter(a => a.date === dateStr);
  const isToday    = dateStr === todayStr;
  const isSelected = dateStr === calSelectedDate;
  const cls = ['cal-cell'];
  if (isOther)    cls.push('other-month');
  if (isToday)    cls.push('today');
  if (isSelected) cls.push('selected');

  let aptHTML = '';
  const maxShow = 3;
  apts.slice(0, maxShow).forEach(a => {
    const statusCls = (a.status||'Booked').toLowerCase().replace(/[\s-]/g,'-');
    const pillClass = statusCls === 'booked' ? 'scheduled' : statusCls;
    aptHTML += `<div class="cal-pill ${pillClass}" title="${escHtml(a.patient_name)} - ${escHtml(a.time)}" onclick="event.stopPropagation();openEditAppointmentModal(${a.id})">${escHtml(a.time)} ${escHtml(a.patient_name)}</div>`;
  });
  if (apts.length > maxShow) {
    aptHTML += `<div class="cal-pill" style="background:var(--bg-hover);color:var(--text-muted)">+${apts.length - maxShow} more</div>`;
  }

  return `<div class="${cls.join(' ')}" onclick="calSelectDate('${dateStr}')">
    <div class="day-num">${day}</div>
    ${aptHTML}
  </div>`;
}

function fmtDate(y, m, d) {
  const dt = new Date(y, m, d);
  return dt.toISOString().slice(0,10);
}

function calPrev() { calMonth--; if (calMonth<0){ calMonth=11; calYear--; } renderCalendar(); }
function calNext() { calMonth++; if (calMonth>11){ calMonth=0; calYear++; } renderCalendar(); }
function calToday() {
  const n = new Date();
  calYear=n.getFullYear(); calMonth=n.getMonth();
  calSelectedDate = n.toISOString().slice(0,10);
  renderCalendar();
}

function calSelectDate(dateStr) {
  calSelectedDate = dateStr;
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
  const cells = document.querySelectorAll('.cal-cell');
  cells.forEach(c => {
    if (c.getAttribute('onclick')?.includes(dateStr)) c.classList.add('selected');
  });
  showDayDetail(dateStr);
}

function showDayDetail(dateStr) {
  const detail = document.getElementById('calDayDetail');
  const dayApts = calAllApts.filter(a => a.date === dateStr).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const nice = new Date(dateStr+'T00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  detail.innerHTML = `
    <h4>${IC.appointments} ${nice} - ${dayApts.length} appointment${dayApts.length!==1?'s':''}</h4>
    ${can('appointments.create') ? `<button class="btn btn-primary btn-sm mb-2" onclick="openNewAppointmentModal(null,'${dateStr}')">${IC.plus} Book on this date</button>` : ''}
    ${dayApts.length === 0
      ? emptyState(IC.empty, 'No appointments', 'No appointments on this date')
      : `<div class="table-wrap"><table>
          <thead><tr><th>Time</th><th>Patient</th><th>MR#</th><th>Doctor</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${dayApts.map(a => aptRowHtml(a)).join('')}</tbody>
        </table></div>`}`;
}

function aptRowHtml(a) {
  const isDoctor = currentUser.role === 'doctor';
  const isLocked = ['Completed','Cancelled'].includes(a.status);
  return `<tr>
    <td><strong>${escHtml(a.time||'-')}</strong></td>
    <td><strong>${escHtml(a.patient_name)}</strong><br><span class="text-muted text-sm">${escHtml(a.patient_phone||'')}</span></td>
    <td><span class="code-id code-id-primary">${escHtml(a.mr_number||'-')}</span></td>
    ${!isDoctor ? `<td class="text-sm">${escHtml(a.doctor_name||'-')}</td>` : ''}
    <td>${appointmentStatusTag(a)}</td>
    <td class="td-actions"><div class="apt-actions">
      <button class="btn btn-info btn-sm" title="Patient Info" onclick="viewPatient(${a.patient_id})">${IC.eye} Info</button>
      ${isDoctor && a.status==='Booked' ? `<button class="btn btn-primary btn-sm" onclick="startConsultation(${a.id},${a.patient_id})">${IC.rx} Start</button>` : ''}
      ${canOpenRxFromAppointment(a) ? `<button class="btn btn-sm" onclick="openPrescriptionModal(${a.id},${a.patient_id})">${IC.rx} Rx</button>` : ''}
      ${!isDoctor && !isLocked ? `<button class="btn btn-sm btn-outline-primary" onclick="openEditAppointmentModal(${a.id})">${IC.edit} Edit</button>` : ''}
      ${!isDoctor && a.status==='Booked' ? `<button class="btn btn-danger btn-sm" onclick="cancelAptAndRefresh(${a.id})">${IC.x} Cancel</button>` : ''}
      ${isLocked ? `<span class="locked-badge ${a.status==='Completed'?'locked-paid':'locked-cancelled'}">${a.status==='Completed'?'Paid':'Cancelled'}</span>` : ''}
    </div></td>
  </tr>`;
}

// List-view row - columns: Date | Time | Patient | MR# | Doctor (non-doctor only) | Status | Actions
function listAptRowHtml(a) {
  const isDoctor = currentUser.role === 'doctor';
  const isLocked = ['Completed','Cancelled'].includes(a.status);
  const fmtDate = d => d ? new Date(d+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '-';
  return `<tr>
    <td class="text-sm text-muted">${fmtDate(a.date)}</td>
    <td><strong>${escHtml(a.time||'-')}</strong></td>
    <td>
      <strong>${escHtml(a.patient_name)}</strong>
      ${a.patient_phone ? `<br><span class="text-muted text-sm">${escHtml(a.patient_phone)}</span>` : ''}
    </td>
    <td><span class="code-id code-id-primary">${escHtml(a.mr_number||'-')}</span></td>
    ${!isDoctor ? `<td class="text-sm">${escHtml(a.doctor_name||'-')}</td>` : ''}
    <td>${appointmentStatusTag(a)}</td>
    <td class="td-actions"><div class="apt-actions">
      <button class="btn btn-info btn-sm" title="Patient Info" onclick="viewPatient(${a.patient_id})">${IC.eye} Info</button>
      ${isDoctor && a.status==='Booked' ? `<button class="btn btn-primary btn-sm" onclick="startConsultation(${a.id},${a.patient_id})">${IC.rx} Start</button>` : ''}
      ${canOpenRxFromAppointment(a) ? `<button class="btn btn-sm" onclick="openPrescriptionModal(${a.id},${a.patient_id})">${IC.rx} Rx</button>` : ''}
      ${!isDoctor && !isLocked ? `<button class="btn btn-sm btn-outline-primary" onclick="openEditAppointmentModal(${a.id})">${IC.edit} Edit</button>` : ''}
      ${!isDoctor && a.status==='Booked' ? `<button class="btn btn-danger btn-sm" onclick="cancelAptAndRefresh(${a.id})">${IC.x} Cancel</button>` : ''}
      ${isLocked ? `<span class="locked-badge ${a.status==='Completed'?'locked-paid':'locked-cancelled'}">${a.status==='Completed'?'Paid':'Cancelled'}</span>` : ''}
    </div></td>
  </tr>`;
}

async function startConsultation(aptId, patientId) {
  try {
    await apiFetch(`/api/appointments/${aptId}`, { method:'PUT', body:JSON.stringify({ status:'Arrived' }) });
    toast('Consultation started', 'success');
    openPrescriptionModal(aptId, patientId);
    // refresh list behind the modal
    if (aptViewMode === 'list') appointmentsList();
    else { calAllApts = await apiFetch('/api/appointments'); renderCalendar(); }
  } catch(e) { toast(e.message, 'error'); }
}

async function cancelAptAndRefresh(id) {
  if (!await confirmDialog('Cancel this appointment?')) return;
  try {
    await apiFetch(`/api/appointments/${id}`, { method:'PUT', body:JSON.stringify({ status:'Cancelled' }) });
    toast('Appointment cancelled', 'success');
    if (aptViewMode === 'list') appointmentsList();
    else { calAllApts = await apiFetch('/api/appointments'); renderCalendar(); }
  } catch(e) { toast(e.message, 'error'); }
}

// ---------- List view ----------
async function appointmentsList() {
  const body = document.getElementById('aptViewBody');
  const isDoctor = currentUser.role === 'doctor';

  // Only build the filter bar if it isn't already rendered (avoid destroying focused inputs)
  if (!document.getElementById('aptFilterBar')) {
    let filterHtml = `<div class="apt-filter-bar" id="aptFilterBar">
      <div class="apt-filter-toolbar">
        <div class="apt-filter-fields">
          <input class="apt-filter-field" type="date" id="aptDateFrom" value="${aptFilterDateFrom}" title="From date" onchange="aptFilterDateFrom=this.value;aptRefreshTable()"/>
          <input class="apt-filter-field" type="date" id="aptDateTo" value="${aptFilterDateTo}" title="To date" onchange="aptFilterDateTo=this.value;aptRefreshTable()"/>
          <input class="apt-filter-field" type="text" id="aptName" value="${escHtml(aptFilterName)}" placeholder="Search name..." oninput="aptFilterName=this.value;aptDebouncedSearch()"/>
          <input class="apt-filter-field" type="text" id="aptMR" value="${escHtml(aptFilterMR)}" placeholder="MR#..." oninput="aptFilterMR=this.value;aptDebouncedSearch()"/>
          <input class="apt-filter-field" type="text" id="aptCivil" value="${escHtml(aptFilterCivil)}" placeholder="Civil ID..." oninput="aptFilterCivil=this.value;aptDebouncedSearch()"/>`;

    if (!isDoctor) {
      filterHtml += `
          <select id="aptDoctorFilter" class="apt-filter-field" title="Doctor" onchange="aptFilterDoctor=this.value;aptRefreshTable()">
            <option value="">All Doctors</option>
          </select>`;
    }

    filterHtml += `
          <select id="aptStatus" class="apt-filter-field" title="Status" onchange="aptFilterStatus=this.value;aptRefreshTable()">
            <option value="">All Status</option>
            <option>Booked</option>
            <option>Confirmed</option>
            <option>Arrived</option>
            <option>Completed</option>
            <option>No-Show</option>
            <option>Cancelled</option>
          </select>
        </div>
        <div class="apt-filter-actions">
          <button class="btn btn-sm btn-primary" onclick="aptSetToday()">${IC.calendar} Today</button>
          <button class="btn btn-sm" onclick="aptClearFilters()">${IC.x} Clear</button>
        </div>
      </div>
    </div>`;

    body.innerHTML = filterHtml + `<div id="aptListStats" class="kpi-mini-grid"></div><div id="aptTableWrap">${skeletonTable(5)}</div>`;

    // Populate doctor dropdown
    if (!isDoctor) {
      try {
        const doctors = await apiFetch('/api/doctors');
        const sel = document.getElementById('aptDoctorFilter');
        if (sel) {
          doctors.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id; opt.textContent = doctorDisplayName(d);
            if (String(d.id) === String(aptFilterDoctor)) opt.selected = true;
            sel.appendChild(opt);
          });
        }
      } catch(e) { /* ignore */ }
    }
  }

  // Sync select values in case they were changed via aptSetToday/aptClearFilters
  const elFrom = document.getElementById('aptDateFrom');
  const elTo   = document.getElementById('aptDateTo');
  const elSt   = document.getElementById('aptStatus');
  const elDr   = document.getElementById('aptDoctorFilter');
  if (elFrom) elFrom.value = aptFilterDateFrom;
  if (elTo)   elTo.value   = aptFilterDateTo;
  if (elSt)   elSt.value   = aptFilterStatus;
  if (elDr)   elDr.value   = aptFilterDoctor;

  await aptRefreshTable();
  setTimeout(() => focusPrimarySearch(), 100);
}

async function aptRefreshTable() {
  const isDoctor = currentUser.role === 'doctor';
  const wrap = document.getElementById('aptTableWrap');
  if (!wrap) return;
  wrap.innerHTML = skeletonTable(5);
  try {
    let url = '/api/appointments?';
    if (aptFilterDateFrom) url += `date_from=${aptFilterDateFrom}&`;
    if (aptFilterDateTo)   url += `date_to=${aptFilterDateTo}&`;
    if (aptFilterStatus)   url += `status=${encodeURIComponent(aptFilterStatus)}&`;
    if (aptFilterDoctor)   url += `doctor_id=${aptFilterDoctor}&`;
    if (aptFilterName)     url += `name=${encodeURIComponent(aptFilterName)}&`;
    if (aptFilterMR)       url += `mr_number=${encodeURIComponent(aptFilterMR)}&`;
    if (aptFilterCivil)    url += `civil_id=${encodeURIComponent(aptFilterCivil)}&`;
    const list = await apiFetch(url);
    const statsEl = document.getElementById('aptListStats');
    if (statsEl) {
      const waiting = list.filter(a => ['Booked','Confirmed'].includes(String(a.status || ''))).length;
      const inProgress = list.filter(a => String(a.status || '') === 'Arrived').length;
      const completed = list.filter(a => String(a.status || '') === 'Completed').length;
      statsEl.innerHTML = `
        <div class="kpi-mini"><span>Total</span><strong>${list.length}</strong></div>
        <div class="kpi-mini"><span>Waiting</span><strong>${waiting}</strong></div>
        <div class="kpi-mini"><span>In Progress</span><strong>${inProgress}</strong></div>
        <div class="kpi-mini"><span>Completed</span><strong>${completed}</strong></div>`;
    }
    if (!list.length) { wrap.innerHTML = emptyState(IC.empty, 'No appointments found', 'Try adjusting filters or book a new appointment'); return; }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>
        <th>Date</th><th>Time</th><th>Patient</th><th>MR#</th>
        ${!isDoctor ? '<th>Doctor</th>' : ''}
        <th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>${list.map(a => listAptRowHtml(a)).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

let _aptSearchTimer = null;
function aptDebouncedSearch() { clearTimeout(_aptSearchTimer); _aptSearchTimer = setTimeout(aptRefreshTable, 350); }
let _doctorsCache = null;
let _doctorsCacheAt = 0;
const DOCTORS_CACHE_MS = 60000;

async function getDoctorsCached(force = false) {
  const fresh = _doctorsCache && ((Date.now() - _doctorsCacheAt) < DOCTORS_CACHE_MS);
  if (!force && fresh) return _doctorsCache;
  const docs = await apiFetch('/api/doctors');
  _doctorsCache = Array.isArray(docs) ? docs : [];
  _doctorsCacheAt = Date.now();
  return _doctorsCache;
}

function aptSetToday() {
  const t = aptTodayStr();
  aptFilterDateFrom = t; aptFilterDateTo = t;
  const elFrom = document.getElementById('aptDateFrom');
  const elTo   = document.getElementById('aptDateTo');
  if (elFrom) elFrom.value = t;
  if (elTo)   elTo.value   = t;
  aptRefreshTable();
}
function aptClearFilters() {
  const t = aptTodayStr();
  aptFilterDateFrom=t; aptFilterDateTo=t; aptFilterDoctor=''; aptFilterStatus=''; aptFilterName=''; aptFilterMR=''; aptFilterCivil='';
  const el = id => document.getElementById(id);
  if (el('aptDateFrom'))    el('aptDateFrom').value    = t;
  if (el('aptDateTo'))      el('aptDateTo').value      = t;
  if (el('aptDoctorFilter'))el('aptDoctorFilter').value= '';
  if (el('aptStatus'))      el('aptStatus').value      = '';
  if (el('aptName'))        el('aptName').value        = '';
  if (el('aptMR'))          el('aptMR').value          = '';
  if (el('aptCivil'))       el('aptCivil').value       = '';
  aptRefreshTable();
}

async function openNewAppointmentModal(prePatientId = null, preDate = null, preDoctorId = null, preTime = null) {
  // Open modal immediately; doctor list is hydrated async to avoid blocking UI.
  const preSlotStepSec = Math.max(60, (parseInt(30, 10) || 30) * 60);
  const defaultDate = preDate || new Date().toISOString().slice(0,10);
  showModal('New Appointment', `
    <form id="aptForm">
      <div class="form-group">
        <label>Patient *</label>
        <div class="psd-wrap">
          <input name="patient_search" id="patientSearchInput" placeholder="Type name or phone to search..." autocomplete="off" oninput="searchPatientsForAppt(this.value)"/>
          <input type="hidden" name="patient_id" id="selectedPatientId" value="${prePatientId||''}"/>
          <div id="patientDropdown" class="psd-list" style="display:none"></div>
        </div>
        <div id="selectedPatientLabel" class="text-muted text-sm mt-1"></div>
        ${!prePatientId ? `<div style="margin-top:10px">
          <button type="button" class="btn btn-primary btn-sm" onmousedown="event.preventDefault();quickRegisterFromAppt()">${IC.plus} New Patient - Quick Register</button>
        </div>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group"><label>Doctor *</label>
          <select name="doctor_id" id="aptDoctorSelect" required onchange="updateAptTimeStepByDoctor(this.value)">
            <option value="">Loading doctors...</option>
          </select>
        </div>
        <div class="form-group"><label>Date *</label><input type="date" name="date" value="${defaultDate}" required/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Time *</label><input type="time" id="aptTimeInput" name="time" step="${preSlotStepSec}" value="${preTime||''}" required/></div>
        <div class="form-group"><label>Notes</label><input name="notes"/></div>
      </div>
    </form>`,
    async () => {
      const f = document.getElementById('aptForm');
      const body = Object.fromEntries(new FormData(f));
      body.patient_id = document.getElementById('selectedPatientId').value;
      if (!body.patient_id) { toast('Please select a patient', 'error'); return false; }
      if (!body.doctor_id || !body.date || !body.time) { toast('Fill all required fields', 'error'); return false; }
      try {
        await apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(body) });
        toast('Appointment booked', 'success');
        closeModal();
        // Refresh whichever view is active
        if (typeof scheduler === 'function' && document.querySelector('.sched-container')) scheduler();
        else appointments();
      } catch(e) { toast(e.message, 'error'); return false; }
    });

  getDoctorsCached().then((doctors) => {
    const sel = document.getElementById('aptDoctorSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="">Select Doctor</option>${(doctors || []).map(d => `<option value="${d.id}" ${preDoctorId && d.id === parseInt(preDoctorId, 10) ? 'selected' : ''}>${escHtml(doctorDisplayName(d))}</option>`).join('')}`;
    window._aptDoctorSlotMap = Object.fromEntries((doctors || []).map(d => [String(d.id), parseInt(d.slot_duration || 30, 10) || 30]));
    updateAptTimeStepByDoctor(sel.value || preDoctorId || '');
  }).catch(() => {
    const sel = document.getElementById('aptDoctorSelect');
    if (sel) sel.innerHTML = '<option value="">Failed to load doctors</option>';
    toast('Unable to load doctor list', 'error');
  });

  if (prePatientId) {
    apiFetch(`/api/patients/${prePatientId}`).then(p => {
      document.getElementById('patientSearchInput').value = `${p.name} - ${p.phone||''}`;
      document.getElementById('selectedPatientLabel').textContent = `Selected: ${p.name}`;
    });
  }
}

function updateAptTimeStepByDoctor(doctorId) {
  const t = document.getElementById('aptTimeInput');
  if (!t) return;
  const map = window._aptDoctorSlotMap || {};
  const mins = parseInt(map[String(doctorId)] || 30, 10) || 30;
  t.step = String(Math.max(60, mins * 60));
}

let patSearchTimer = null;
let patSearchAbortCtrl = null;
function searchPatientsForAppt(q) {
  clearTimeout(patSearchTimer);
  if (patSearchAbortCtrl) {
    try { patSearchAbortCtrl.abort(); } catch {}
    patSearchAbortCtrl = null;
  }
  if (q.length < 2) { document.getElementById('patientDropdown').style.display='none'; return; }
  patSearchTimer = setTimeout(async () => {
    const dd = document.getElementById('patientDropdown');
    if (!dd) return;
    try {
      patSearchAbortCtrl = new AbortController();
      const list = await apiFetch(`/api/patients/lookup?q=${encodeURIComponent(q)}&exclude_blocked=1&limit=15`, { signal: patSearchAbortCtrl.signal });
      if (!Array.isArray(list) || !list.length) { dd.style.display='none'; return; }
      dd.innerHTML = list.map(p =>
        `<div onmousedown="selectPatientFromDropdown(${p.id},'${escHtml(p.name)}','${escHtml(p.phone||'')}')">
           <strong>${escHtml(p.name)}</strong> <span class="text-muted">${escHtml(p.phone||'')}</span>${p.mr_number ? ` <span class="code-id code-id-primary" style="margin-left:6px">${escHtml(p.mr_number)}</span>` : ''}
         </div>`).join('');
      dd.style.display = 'block';
    } catch (e) {
      if (!String(e.message || '').toLowerCase().includes('abort')) dd.style.display = 'none';
    } finally {
      patSearchAbortCtrl = null;
    }
  }, 250);
}

function selectPatientFromDropdown(id, name, phone) {
  document.getElementById('selectedPatientId').value = id;
  document.getElementById('patientSearchInput').value = `${name} - ${phone}`;
  document.getElementById('selectedPatientLabel').textContent = `Selected: ${name}`;
  document.getElementById('patientDropdown').style.display = 'none';
}

async function openEditAppointmentModal(id) {
  try {
    const me = await apiFetch('/api/me');
    if (me && typeof me === 'object') {
      currentUser = { ...currentUser, ...me };
      currentSystem = currentUser?.system || currentSystem;
    }
  } catch (_) {}
  const isDoctor = currentUser?.role === 'doctor';
  const [a, doctors] = await Promise.all([apiFetch(`/api/appointments/${id}`), getDoctorsCached()]);
  if (['Completed','Cancelled'].includes(a.status)) {
    toast(`Cannot edit a ${a.status} appointment`, 'error');
    return;
  }
  showModal('Edit Appointment', `
    <form id="editAptForm">
      <div class="form-group"><label>Patient</label><input value="${escHtml(a.patient_name)}" disabled/></div>
      <div class="form-row">
        <div class="form-group"><label>Doctor *</label>
          <select name="doctor_id" required>
            ${doctors.map(d => `<option value="${d.id}" ${d.id===a.doctor_id?'selected':''}>${escHtml(doctorDisplayName(d))}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Status</label>
          <select name="status">
            <option ${a.status==='Booked'?'selected':''}>Booked</option>
            <option ${a.status==='Confirmed'?'selected':''}>Confirmed</option>
            <option ${a.status==='Arrived'?'selected':''}>Arrived</option>
            ${(!isDoctor && can('billing.create')) ? `<option value="Arrived+Billing">Arrived + Billing</option>` : ''}
            <option ${a.status==='No-Show'?'selected':''}>No-Show</option>
            <option ${a.status==='Cancelled'?'selected':''}>Cancelled</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date *</label><input type="date" name="date" value="${a.date}" required/></div>
        <div class="form-group"><label>Time *</label><input type="time" name="time" value="${a.time}" required/></div>
      </div>
      <div class="form-group"><label>Notes</label><input name="notes" value="${escHtml(a.notes||'')}"/></div>
      ${(!isDoctor && can('billing.create') && a.status === 'Arrived') ? `
      <div class="modal-bill-row">
        <hr class="modal-divider"/>
        <button type="button" class="btn btn-success btn-full" onclick="closeModal();openBillModal(${a.patient_id},${a.id})">${IC.billing} Generate Bill for this Appointment</button>
      </div>` : ''}
    </form>`,
    async () => {
      const body = Object.fromEntries(new FormData(document.getElementById('editAptForm')));
      const arrivedWithBilling = body.status === 'Arrived+Billing';
      if (arrivedWithBilling) body.status = 'Arrived';
      try {
        await apiFetch(`/api/appointments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('Appointment updated', 'success');
        closeModal();
        if (arrivedWithBilling && can('billing.create')) {
          setTimeout(() => openBillModal(a.patient_id, id), 80);
          return;
        }
        // Stay on current page
        if (document.querySelector('.sched-toolbar')) { scheduler(); } else { appointments(); }
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

async function cancelAppointment(id) {
  if (!await confirmDialog('Cancel this appointment?')) return;
  try {
    await apiFetch(`/api/appointments/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Cancelled' }) });
    toast('Appointment cancelled', 'success');
    if (document.querySelector('.sched-toolbar')) { scheduler(); } else { appointments(); }
  } catch(e) { toast(e.message, 'error'); }
}

// --------------------------------------------------------
//  FOLLOW UPS
// --------------------------------------------------------
let _followUpsAll = [];
let _followUpPromptCtx = null;

function formatDateInputLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fuToday() {
  return formatDateInputLocal(new Date());
}

function fuAfterDays(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() + parseInt(days || 0, 10));
  return formatDateInputLocal(dt);
}

function fuStatusBadge(status) {
  const s = String(status || 'Pending');
  if (s === 'Completed') return '<span class="badge badge-paid">Completed</span>';
  if (s === 'Missed') return '<span class="badge badge-cancelled">Missed</span>';
  if (s === 'Cancelled') return '<span class="badge badge-cancelled">Cancelled</span>';
  return '<span class="badge badge-pending">Pending</span>';
}

async function followUps() {
  const ca = document.getElementById('contentArea');
  const today = fuToday();
  ca.innerHTML = `
    <div class="action-bar">
      <div></div>
      <button class="btn btn-primary" onclick="openFollowUpModal()">${IC.plus} Add Follow Up</button>
    </div>
    <div class="apt-filter-bar" id="fuFilterBar">
      <div class="apt-filter-toolbar">
        <div class="apt-filter-fields" style="grid-template-columns:2fr 1fr minmax(150px,180px) minmax(150px,180px)">
          <input class="apt-filter-field" type="text" id="fuSearch" placeholder="Search patient, MR#, purpose, notes-" oninput="fuDebouncedSearch()"/>
          <select class="apt-filter-field" id="fuStatus" onchange="loadFollowUps()">
            <option value="">All Status</option>
            <option value="Pending" selected>Pending</option>
            <option value="Completed">Completed</option>
            <option value="Missed">Missed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input class="apt-filter-field" type="date" id="fuFrom" value="${today}" title="Due from" onchange="loadFollowUps()"/>
          <input class="apt-filter-field" type="date" id="fuTo" value="${fuAfterDays(30)}" title="Due to" onchange="loadFollowUps()"/>
        </div>
        <div class="apt-filter-actions">
          <button class="btn btn-sm" onclick="clearFollowUpFilters()">${IC.x} Clear</button>
        </div>
      </div>
    </div>
    <div id="followUpWrap">${skeletonTable(6)}</div>`;
  loadFollowUps();
}

let _fuSearchTimer = null;
function fuDebouncedSearch() { clearTimeout(_fuSearchTimer); _fuSearchTimer = setTimeout(loadFollowUps, 350); }

function clearFollowUpFilters() {
  const today = fuToday();
  const s = document.getElementById('fuSearch'); if (s) s.value = '';
  const st = document.getElementById('fuStatus'); if (st) st.value = 'Pending';
  const fr = document.getElementById('fuFrom'); if (fr) fr.value = today;
  const to = document.getElementById('fuTo'); if (to) to.value = fuAfterDays(30);
  loadFollowUps();
}

async function loadFollowUps() {
  const wrap = document.getElementById('followUpWrap');
  if (!wrap) return;
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('fuSearch')?.value?.trim();
    const status = document.getElementById('fuStatus')?.value || '';
    const from = document.getElementById('fuFrom')?.value || '';
    const to = document.getElementById('fuTo')?.value || '';
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);

    const list = await apiFetch(`/api/follow-ups?${params.toString()}`);
    _followUpsAll = Array.isArray(list) ? list : [];
    if (!_followUpsAll.length) {
      wrap.innerHTML = emptyState(IC.clock, 'No Follow Ups', 'Create a follow-up to track patient revisit reminders.');
      return;
    }

    const fmtDue = f => {
      const d = f.due_date ? new Date(f.due_date + 'T00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '-';
      return f.due_time ? `${d} <span class="text-muted text-sm">${escHtml(f.due_time)}</span>` : d;
    };
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Due Date</th><th>Patient</th><th>MR#</th><th>Doctor</th><th>Purpose</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${_followUpsAll.map((f, i) => {
        return `<tr>
          <td><span class="billing-index">${i + 1}</span></td>
          <td><strong>${fmtDue(f)}</strong></td>
          <td><strong>${escHtml(f.patient_name || 'Patient')}</strong>${f.patient_phone ? `<br><span class="text-muted text-sm">${escHtml(f.patient_phone)}</span>` : ''}</td>
          <td><span class="code-id code-id-primary">${escHtml(f.mr_number || '-')}</span></td>
          <td class="text-sm">${escHtml(f.doctor_name || '-')}</td>
          <td class="text-sm">${escHtml(f.purpose || '-')}</td>
          <td>${fuStatusBadge(f.status)}</td>
          <td class="text-muted text-sm">${escHtml(f.notes || '-')}</td>
          <td class="td-actions">
            <div class="billing-actions">
              <div class="billing-actions-top">
                ${(f.status === 'Pending' || f.status === 'Missed') ? `<button class="btn btn-sm btn-success" onclick="completeFollowUp(${f.id})">${IC.check} Complete</button>` : ''}
                ${(f.status === 'Pending' || f.status === 'Missed') ? `<button class="btn btn-sm btn-primary" onclick="bookAptFromFollowUp(${f.id})" title="Book appointment for this follow-up">${IC.appointments} Book Apt</button>` : ''}
                ${f.patient_phone ? `<button class="btn btn-sm btn-whatsapp" onclick="openWhatsApp('${String(f.patient_phone).replace(/[^0-9]/g,'')}')" title="WhatsApp ${escHtml(f.patient_name || '')}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.859L.054 23.454a.5.5 0 0 0 .492.597.498.498 0 0 0 .123-.015l5.796-1.527A11.938 11.938 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.938a9.926 9.926 0 0 1-5.058-1.377l-.363-.215-3.761.991 1.006-3.671-.236-.378A9.916 9.916 0 0 1 2.063 12C2.063 6.52 6.52 2.063 12 2.063S21.938 6.52 21.938 12 17.48 21.938 12 21.938z"/></svg> WhatsApp</button>` : ''}
              </div>
              <div class="billing-actions-bottom">
                <button class="btn btn-sm" onclick="openFollowUpModal(${f.id})">${IC.edit}</button>
                ${(currentUser && currentUser.role !== 'doctor') ? `<button class="btn btn-danger btn-sm" onclick="deleteFollowUp(${f.id})">${IC.trash}</button>` : ''}
              </div>
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function openFollowUpModal(id = null) {
  const edit = !!id;
  try {
    const [patientsList, doctorsList] = await Promise.all([
      apiFetch('/api/patients'),
      apiFetch('/api/doctors').catch(() => [])
    ]);
    const row = edit ? (_followUpsAll || []).find(f => f.id === id) : null;
    if (edit && !row) {
      toast('Follow-up not found. Please refresh.', 'error');
      return;
    }

    const patientOptions = (patientsList || []).map(p => `<option value="${p.id}" ${row && parseInt(row.patient_id) === p.id ? 'selected' : ''}>${escHtml(p.name)} ${p.mr_number ? `(${escHtml(p.mr_number)})` : ''}</option>`).join('');
    const doctorOptions = [`<option value="">Unassigned</option>`, ...(doctorsList || []).map(d => `<option value="${d.id}" ${row && parseInt(row.doctor_id) === d.id ? 'selected' : ''}>${escHtml(doctorDisplayName(d))}</option>`)]
      .join('');

    showModal(edit ? 'Edit Follow Up' : 'Add Follow Up', `
      <form id="followUpForm">
        <div class="form-grid-2">
          <div class="form-group"><label>Patient *</label><select name="patient_id" required>${patientOptions}</select></div>
          <div class="form-group"><label>Doctor</label><select name="doctor_id">${doctorOptions}</select></div>
          <div class="form-group"><label>Due Date *</label><input name="due_date" type="date" value="${escHtml((row && row.due_date) || fuToday())}" required/></div>
          <div class="form-group"><label>Due Time</label><input name="due_time" type="time" value="${escHtml((row && row.due_time) || '')}"/></div>
          <div class="form-group" style="grid-column:1/-1"><label>Purpose *</label><input name="purpose" value="${escHtml((row && row.purpose) || '')}" placeholder="e.g. Review test results" required/></div>
          <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" rows="3" placeholder="Extra instructions, call notes, reminder detail">${escHtml((row && row.notes) || '')}</textarea></div>
          <div class="form-group"><label>Status</label>
            <select name="status">
              <option value="Pending" ${!row || row.status==='Pending' ? 'selected' : ''}>Pending</option>
              <option value="Completed" ${row && row.status==='Completed' ? 'selected' : ''}>Completed</option>
              <option value="Missed" ${row && row.status==='Missed' ? 'selected' : ''}>Missed</option>
              <option value="Cancelled" ${row && row.status==='Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
      </form>
    `, async () => {
      const form = document.getElementById('followUpForm');
      const body = Object.fromEntries(new FormData(form));
      if (!body.patient_id || !body.due_date || !body.purpose) {
        toast('Please fill required fields.', 'error');
        return false;
      }
      try {
        if (body.doctor_id === '') body.doctor_id = null;
        if (edit) await apiFetch(`/api/follow-ups/${id}`, { method:'PUT', body: JSON.stringify(body) });
        else await apiFetch('/api/follow-ups', { method:'POST', body: JSON.stringify(body) });
        toast(edit ? 'Follow-up updated' : 'Follow-up created', 'success');
        closeModal();
        loadFollowUps();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    });
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function completeFollowUp(id) {
  const row = (_followUpsAll || []).find(f => f.id === id);
  showModal('Complete Follow Up', `
    <form id="fuCompleteForm">
      <div class="form-group"><label>Outcome Notes</label><textarea name="completion_notes" rows="3" placeholder="What happened in this follow-up?"></textarea></div>
      <div style="margin:8px 0 4px;font-weight:700">Schedule Next Follow-Up (optional)</div>
      <div class="form-grid-2">
        <div class="form-group"><label>Next Due Date</label><input type="date" name="next_due_date"/></div>
        <div class="form-group"><label>Next Due Time</label><input type="time" name="next_due_time"/></div>
        <div class="form-group" style="grid-column:1/-1"><label>Next Purpose</label><input name="next_purpose" placeholder="e.g. 1-week review"/></div>
        <div class="form-group" style="grid-column:1/-1"><label>Next Notes</label><textarea name="next_notes" rows="2"></textarea></div>
      </div>
      ${row ? `<div class="text-muted text-sm">Patient: ${escHtml(row.patient_name || '')} - Current Due: ${escHtml(row.due_date || '')}</div>` : ''}
    </form>
  `, async () => {
    const form = document.getElementById('fuCompleteForm');
    const body = Object.fromEntries(new FormData(form));
    if (body.next_due_date && !body.next_purpose) {
      toast('Please enter next purpose for chained follow-up.', 'error');
      return false;
    }
    try {
      await apiFetch(`/api/follow-ups/${id}/complete`, { method:'POST', body: JSON.stringify(body) });
      toast('Follow-up marked as completed', 'success');
      closeModal();
      loadFollowUps();
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  });
}

function offerFollowUpFromContext(patientId, doctorId = null, appointmentId = null, purposeHint = '') {
  if (!patientId) return;
  _followUpPromptCtx = { patientId, doctorId, appointmentId, purposeHint };
  showModal('Schedule Follow Up?', `
    <div style="padding:4px 2px 2px">
      <p style="margin:0;color:var(--text)">Do you want to schedule a follow-up now?</p>
      <p class="text-muted text-sm" style="margin:8px 0 0">You can also do this later from the Follow Ups page.</p>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
        <button type="button" class="btn" onclick="followUpPromptNo()">No</button>
        <button type="button" class="btn btn-primary" onclick="followUpPromptYes()">Yes</button>
      </div>
    </div>
  `);
}

function followUpPromptNo() {
  _followUpPromptCtx = null;
  closeModal();
}

function followUpPromptYes() {
  const ctx = _followUpPromptCtx;
  _followUpPromptCtx = null;
  closeModal();
  if (!ctx) return;
  openQuickFollowUpFromContext(ctx.patientId, ctx.doctorId, ctx.appointmentId, ctx.purposeHint);
}

function openQuickFollowUpFromContext(patientId, doctorId = null, appointmentId = null, purposeHint = '') {
  const defaultDate = fuAfterDays(7);
  showModal('Schedule Follow Up', `
    <form id="fuQuickForm">
      <div class="form-grid-2">
        <div class="form-group"><label>Due Date *</label><input type="date" name="due_date" value="${defaultDate}" required/></div>
        <div class="form-group"><label>Due Time</label><input type="time" name="due_time"/></div>
        <div class="form-group" style="grid-column:1/-1"><label>Purpose *</label><input name="purpose" value="${escHtml(purposeHint || 'Follow-up visit')}" required/></div>
        <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      </div>
    </form>
  `, async () => {
    const body = Object.fromEntries(new FormData(document.getElementById('fuQuickForm')));
    if (!body.due_date || !body.purpose) {
      toast('Please fill required fields.', 'error');
      return false;
    }
    body.patient_id = patientId;
    if (doctorId) body.doctor_id = doctorId;
    if (appointmentId) body.appointment_id = appointmentId;
    try {
      await apiFetch('/api/follow-ups', { method: 'POST', body: JSON.stringify(body) });
      toast('Follow-up scheduled', 'success');
      closeModal();
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  });
}

async function autoCreateFollowUpFromContext(patientId, doctorId = null, appointmentId = null, purposeHint = '', navigateAfter = false) {
  if (!patientId) return false;
  const body = {
    patient_id: patientId,
    due_date: fuAfterDays(7),
    due_time: '',
    purpose: purposeHint || 'Post billing follow-up',
    notes: ''
  };
  const parsedDoctorId = parseInt(doctorId, 10);
  const parsedAppointmentId = parseInt(appointmentId, 10);
  if (parsedDoctorId) body.doctor_id = parsedDoctorId;
  if (parsedAppointmentId) body.appointment_id = parsedAppointmentId;

  const goToFollowUps = () => {
    if (!navigateAfter) return;
    navigate('follow-ups');
    setTimeout(() => {
      if (currentPageId === 'follow-ups') loadFollowUps();
    }, 120);
  };
  try {
    await apiFetch('/api/follow-ups', { method: 'POST', body: JSON.stringify(body) });
    goToFollowUps();
    return true;
  } catch (_) {
    // Fallback: retry without doctor/appointment linkage in case older IDs are invalid.
    const retryBody = {
      patient_id: patientId,
      due_date: body.due_date,
      due_time: body.due_time,
      purpose: body.purpose,
      notes: body.notes
    };
    try {
      await apiFetch('/api/follow-ups', { method: 'POST', body: JSON.stringify(retryBody) });
      goToFollowUps();
      return true;
    } catch (_) {
      goToFollowUps();
      return false;
    }
  }
}

async function deleteFollowUp(id) {
  if (!await confirmDialog('Delete this follow-up?')) return;
  try {
    await apiFetch(`/api/follow-ups/${id}`, { method:'DELETE' });
    toast('Follow-up deleted', 'success');
    loadFollowUps();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function bookAptFromFollowUp(fuId) {
  const f = (_followUpsAll || []).find(r => r.id === fuId);
  if (!f) { toast('Follow-up not found', 'error'); return; }
  const patId = f.patient_id || null;
  const docId = f.doctor_id || null;
  const dueDate = f.due_date || null;
  // Open appointment modal without leaving Follow Ups.
  // After saving, reload follow-ups instead of navigating to appointments.
  const preSlotStepSec = Math.max(60, 30 * 60);
  const defaultDate = dueDate || new Date().toISOString().slice(0, 10);
  showModal('Book Appointment', `
    <form id="aptFormFU">
      <div class="form-group">
        <label>Patient *</label>
        <div class="psd-wrap">
          <input name="patient_search" id="patientSearchInput" placeholder="Type name or phone to search..." autocomplete="off" oninput="searchPatientsForAppt(this.value)"/>
          <input type="hidden" name="patient_id" id="selectedPatientId" value="${patId || ''}"/>
          <div id="patientDropdown" class="psd-list" style="display:none"></div>
        </div>
        <div id="selectedPatientLabel" class="text-muted text-sm mt-1"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Doctor *</label>
          <select name="doctor_id" id="aptDoctorSelect" required onchange="updateAptTimeStepByDoctor(this.value)">
            <option value="">Loading doctors...</option>
          </select>
        </div>
        <div class="form-group"><label>Date *</label><input type="date" name="date" value="${defaultDate}" required/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Time *</label><input type="time" id="aptTimeInput" name="time" step="${preSlotStepSec}" required/></div>
        <div class="form-group"><label>Notes</label><input name="notes"/></div>
      </div>
    </form>`,
    async () => {
      const f2 = document.getElementById('aptFormFU');
      const body = Object.fromEntries(new FormData(f2));
      body.patient_id = document.getElementById('selectedPatientId').value;
      if (!body.patient_id) { toast('Please select a patient', 'error'); return false; }
      if (!body.doctor_id || !body.date || !body.time) { toast('Fill all required fields', 'error'); return false; }
      try {
        await apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(body) });
        toast('Appointment booked', 'success');
        closeModal();
        loadFollowUps(); // Stay on follow-ups screen and refresh
      } catch(e) { toast(e.message, 'error'); return false; }
    });

  getDoctorsCached().then(doctors => {
    const sel = document.getElementById('aptDoctorSelect');
    if (!sel) return;
    sel.innerHTML = `<option value="">Select Doctor</option>${(doctors || []).map(d => `<option value="${d.id}" ${docId && d.id === parseInt(docId, 10) ? 'selected' : ''}>${escHtml(doctorDisplayName(d))}</option>`).join('')}`;
    window._aptDoctorSlotMap = Object.fromEntries((doctors || []).map(d => [String(d.id), parseInt(d.slot_duration || 30, 10) || 30]));
    updateAptTimeStepByDoctor(sel.value || docId || '');
  }).catch(() => {});

  if (patId) {
    apiFetch(`/api/patients/${patId}`).then(p => {
      const inp = document.getElementById('patientSearchInput');
      const lbl = document.getElementById('selectedPatientLabel');
      if (inp) inp.value = `${p.name} - ${p.phone || ''}`;
      if (lbl) lbl.textContent = `Selected: ${p.name}`;
    }).catch(() => {});
  }
}

// --------------------------------------------------------
//  DOCTOR SCHEDULER (Day-view time-grid)
// --------------------------------------------------------
let schedDate = '';
let schedDept = ''; // '' = all departments
let _schedDoctorsById = {};
let _schedDoctorSchedules = {};

const SCHED_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function schedParseMinutes(time) {
  const m = String(time || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
  return hh * 60 + mm;
}

function schedDefaultSchedule(doctorId) {
  return {
    doctor_id: parseInt(doctorId),
    work_start: '09:00',
    work_end: '17:00',
    weekly_off_days: [5],
    breaks: []
  };
}

function schedGetSchedule(doctorId) {
  return _schedDoctorSchedules[String(doctorId)] || schedDefaultSchedule(doctorId);
}

function schedGetDateWeekday(dateStr) {
  const dt = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dt)) return -1;
  return dt.getDay();
}

function schedCheckSlotBlocked(doctor, dateStr, timeStr) {
  if (!doctor) return { blocked: false };
  const sch = schedGetSchedule(doctor.id);
  const slotDur = parseInt(doctor.slot_duration || 30, 10) || 30;
  const day = schedGetDateWeekday(dateStr);
  if (Array.isArray(sch.weekly_off_days) && sch.weekly_off_days.includes(day)) {
    return { blocked: true, reason: `${SCHED_DAY_NAMES[day]} is a holiday for this doctor.` };
  }

  const start = schedParseMinutes(timeStr);
  const end = start + slotDur;
  const ws = schedParseMinutes(sch.work_start || '09:00');
  const we = schedParseMinutes(sch.work_end || '17:00');
  if (!isNaN(start) && !isNaN(ws) && !isNaN(we) && (start < ws || end > we)) {
    return { blocked: true, reason: `Working hours are ${sch.work_start}-${sch.work_end}.` };
  }

  for (const b of (sch.breaks || [])) {
    const bs = schedParseMinutes(b.start);
    const be = schedParseMinutes(b.end);
    if (isNaN(bs) || isNaN(be)) continue;
    if (start < be && end > bs) {
      return { blocked: true, reason: `Blocked by break (${b.start}-${b.end}).` };
    }
  }
  return { blocked: false };
}

function schedRenderDoctorBlockedLayers(doctor, dateStr, startHour, endHour, slotHeight) {
  const sch = schedGetSchedule(doctor.id);
  const day = schedGetDateWeekday(dateStr);
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;
  const pxPerMin = slotHeight / 15;

  const segs = [];
  const markers = [];
  const addSeg = (sMin, eMin, label, cls = '') => {
    const s = Math.max(gridStart, sMin);
    const e = Math.min(gridEnd, eMin);
    if (e <= s) return;
    segs.push({ start: s, end: e, label, cls });
  };
  const addMarker = (mMin, label, cls = '') => {
    if (mMin < gridStart || mMin > gridEnd) return;
    markers.push({ at: mMin, label, cls });
  };

  if ((sch.weekly_off_days || []).includes(day)) {
    addSeg(gridStart, gridEnd, `${SCHED_DAY_NAMES[day]} Holiday`, 'holiday');
  } else {
    const ws = schedParseMinutes(sch.work_start || '09:00');
    const we = schedParseMinutes(sch.work_end || '17:00');
    if (!isNaN(ws) && ws > gridStart) addSeg(gridStart, ws, 'No Duty', 'offduty');
    if (!isNaN(we) && we < gridEnd) addSeg(we, gridEnd, 'No Duty', 'offduty');
    if (!isNaN(ws)) addMarker(ws, `Start ${sch.work_start || '09:00'}`, 'start');
    if (!isNaN(we)) addMarker(we, `End ${sch.work_end || '17:00'}`, 'end');
    for (const b of (sch.breaks || [])) {
      const bs = schedParseMinutes(b.start);
      const be = schedParseMinutes(b.end);
      if (!isNaN(bs) && !isNaN(be) && be > bs) addSeg(bs, be, b.label || `Break ${b.start}-${b.end}`, 'break');
    }
  }

  const segHtml = segs.map(seg => {
    const top = (seg.start - gridStart) * pxPerMin;
    const height = Math.max(8, (seg.end - seg.start) * pxPerMin);
    const bg = 'rgba(239,68,68,.22)';
    const border = '1px solid rgba(239,68,68,.65)';
    return `<div class="sched-blocked-layer" style="position:absolute;left:4px;right:4px;top:${top}px;height:${height}px;z-index:2;background:${bg};border:${border};border-radius:8px;pointer-events:none;display:flex;align-items:center;justify-content:center;padding:2px 6px;text-align:center;color:#991b1b;font-size:10px;font-weight:700">${escHtml(seg.label)}</div>`;
  }).join('');

  const markerHtml = markers.map(m => {
    const top = (m.at - gridStart) * pxPerMin;
    const color = m.cls === 'start' ? 'rgba(34,197,94,.7)' : 'rgba(59,130,246,.7)';
    return `<div style="position:absolute;left:6px;right:6px;top:${top}px;height:0;z-index:2;border-top:1px dashed ${color};pointer-events:none"></div>
      <div style="position:absolute;right:8px;top:${Math.max(0, top - 11)}px;z-index:2;padding:1px 6px;border-radius:999px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);font-size:10px;line-height:1.2;pointer-events:none">${escHtml(m.label)}</div>`;
  }).join('');

  return segHtml + markerHtml;
}

async function openDoctorScheduleModal(doctorId) {
  try {
    const docs = await apiFetch('/api/doctors');
    const doc = (docs || []).find(d => d.id === parseInt(doctorId));
    if (!doc) { toast('Doctor not found', 'error'); return; }
    const existing = await apiFetch(`/api/doctor-schedules?doctor_id=${doctorId}`);
    const sch = (existing && existing[0]) || schedGetSchedule(doctorId);

    const dayChecks = SCHED_DAY_NAMES.map((name, idx) => {
      const checked = (sch.weekly_off_days || []).includes(idx) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="weekly_off_day" value="${idx}" ${checked}/> ${name}</label>`;
    }).join('');

    const breakRows = (sch.breaks || []).map((b, i) => `
      <div class="form-row break-row" data-break-row="${i}">
        <div class="form-group"><label>Break Start</label><input type="time" class="br-start" value="${escHtml(b.start || '')}"/></div>
        <div class="form-group"><label>Break End</label><input type="time" class="br-end" value="${escHtml(b.end || '')}"/></div>
        <div class="form-group"><label>Label</label><input type="text" class="br-label" value="${escHtml(b.label || 'Break')}"/></div>
      </div>`).join('');

    showModal(`Doctor Schedule - ${escHtml(doc.name)}`, `
      <form id="doctorScheduleForm">
        <div class="form-row">
          <div class="form-group"><label>Working Start</label><input type="time" name="work_start" value="${escHtml(sch.work_start || '09:00')}" required/></div>
          <div class="form-group"><label>Working End</label><input type="time" name="work_end" value="${escHtml(sch.work_end || '17:00')}" required/></div>
        </div>
        <div class="form-group">
          <label>Weekly Holidays</label>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:8px">${dayChecks}</div>
        </div>
        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="margin:0">Break Timings</label>
            <button type="button" class="btn btn-sm" onclick="addDoctorBreakRow()">${IC.plus} Add Break</button>
          </div>
          <div id="doctorBreakRows">${breakRows || ''}</div>
          <div class="text-sm text-muted" style="margin-top:6px">Breaks are auto-blocked on scheduler.</div>
        </div>
      </form>`,
      [
        {
          label: `${IC.users} Copy To...`,
          class: '',
          onclick: async () => {
            const payload = readDoctorScheduleFormPayload();
            if (!payload) return false;
            openCopyDoctorScheduleModal(doctorId, doc.name, docs, payload);
          }
        },
        {
          label: `${IC.check} Save`,
          class: 'btn-primary',
          onclick: async () => {
            const payload = readDoctorScheduleFormPayload();
            if (!payload) return false;
            try {
              await apiFetch(`/api/doctor-schedules/${doctorId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
              });
              toast('Doctor schedule saved', 'success');
              closeModal();
              if (document.getElementById('dsWrap')) loadDoctorSchedulesTable();
              if (currentPageId === 'scheduler' || document.querySelector('.sched-container')) scheduler();
            } catch (e) {
              toast(e.message, 'error');
              return false;
            }
          }
        }
      ]
    );
  } catch (e) {
    toast(e.message, 'error');
  }
}

function readDoctorScheduleFormPayload() {
  const f = document.getElementById('doctorScheduleForm');
  if (!f) { toast('Schedule form not found', 'error'); return null; }
  const work_start = f.querySelector('input[name="work_start"]')?.value || '';
  const work_end = f.querySelector('input[name="work_end"]')?.value || '';
  if (!work_start || !work_end) { toast('Working start and end are required', 'error'); return null; }
  const weekly_off_days = Array.from(f.querySelectorAll('input[name="weekly_off_day"]:checked')).map(x => parseInt(x.value));
  const breaks = Array.from(f.querySelectorAll('#doctorBreakRows .break-row')).map(row => ({
    start: row.querySelector('.br-start')?.value || '',
    end: row.querySelector('.br-end')?.value || '',
    label: row.querySelector('.br-label')?.value || 'Break',
  })).filter(b => b.start && b.end);
  return { work_start, work_end, weekly_off_days, breaks };
}

function openCopyDoctorScheduleModal(sourceDoctorId, sourceDoctorName, doctors, payload) {
  const targets = (doctors || []).filter(d => d.id !== parseInt(sourceDoctorId));
  showModal(`Copy Schedule - ${escHtml(sourceDoctorName)}`, `
    <form id="copyDoctorScheduleForm">
      <div class="form-group">
        <label>Copy to doctors</label>
        <div style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--bg-card)">
          ${targets.length ? targets.map(d => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)">
              <input type="checkbox" name="target_doctor" value="${d.id}"/>
              <span>${escHtml(doctorDisplayName(d))}</span>
            </label>`).join('') : '<div class="text-muted text-sm">No other doctors available.</div>'}
        </div>
        <div class="text-sm text-muted" style="margin-top:8px">This will apply the same holidays, breaks, and working hours.</div>
      </div>
    </form>`,
    async () => {
      const ids = Array.from(document.querySelectorAll('input[name="target_doctor"]:checked')).map(x => parseInt(x.value));
      if (!ids.length) { toast('Select at least one doctor', 'error'); return false; }
      try {
        // Save current source schedule draft first.
        await apiFetch(`/api/doctor-schedules/${sourceDoctorId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        const res = await apiFetch('/api/doctor-schedules/copy', {
          method: 'POST',
          body: JSON.stringify({ source_doctor_id: sourceDoctorId, target_doctor_ids: ids })
        });
        const copied = (res && res.copied_to && res.copied_to.length) || 0;
        toast(`Schedule copied to ${copied} doctor${copied !== 1 ? 's' : ''}`, 'success');
        closeModal();
        if (document.getElementById('dsWrap')) loadDoctorSchedulesTable();
        if (currentPageId === 'scheduler' || document.querySelector('.sched-container')) scheduler();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }
  );
}

function addDoctorBreakRow() {
  const wrap = document.getElementById('doctorBreakRows');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', `
    <div class="form-row break-row">
      <div class="form-group"><label>Break Start</label><input type="time" class="br-start"/></div>
      <div class="form-group"><label>Break End</label><input type="time" class="br-end"/></div>
      <div class="form-group"><label>Label</label><input type="text" class="br-label" value="Break"/></div>
    </div>`);
}

function quickRegisterPatient() {
  showModal('Quick Register Patient', `
    <form id="quickPatForm">
      <div class="form-group">
        <label>Full Name <span style="color:var(--c-danger)">*</span></label>
        <input name="name" id="qpName" placeholder="Patient full name" required autofocus/>
      </div>
      <div class="form-group">
        <label>Phone <span style="color:var(--c-danger)">*</span></label>
        <input name="phone" id="qpPhone" type="tel" placeholder="Phone number" required/>
      </div>
      <p class="text-sm" style="color:var(--text-muted);margin-top:8px">${IC.info || '&#9432;'} Full details (age, gender, civil ID, etc.) will be required when generating a bill.</p>
    </form>`,
    async () => {
      const name  = document.getElementById('qpName')?.value?.trim();
      const phone = document.getElementById('qpPhone')?.value?.trim();
      if (!name)  { toast('Name is required','error'); return false; }
      if (!phone) { toast('Phone is required','error'); return false; }
      try {
        const p = await apiFetch('/api/patients', { method:'POST', body: JSON.stringify({ name, phone }) });
        toast(`Patient "${name}" registered (MR: ${p.mr_number || p.id})`, 'success');
        closeModal();
      } catch(e) { toast(e.message,'error'); return false; }
    });
}

function quickRegisterFromAppt() {
  document.getElementById('quickRegOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'quickRegOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-modal-overlay,rgba(0,0,0,.5));z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:var(--bg-card);border-radius:12px;padding:24px;width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.3)">
      <h3 style="margin:0 0 16px">Quick Register Patient</h3>
      <div class="form-group">
        <label>Full Name <span style="color:var(--c-danger)">*</span></label>
        <input id="qrName" placeholder="Patient full name" style="width:100%" autofocus/>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>Phone <span style="color:var(--c-danger)">*</span></label>
        <input id="qrPhone" type="tel" placeholder="Phone number" style="width:100%"/>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:10px">&#9432; Full details will be required when generating a bill.</p>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="document.getElementById('quickRegOverlay')?.remove()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="submitQuickRegFromAppt(this)">Register &amp; Select</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('#qrName')?.focus(), 50);
}

async function submitQuickRegFromAppt(btn) {
  const name  = document.getElementById('qrName')?.value?.trim();
  const phone = document.getElementById('qrPhone')?.value?.trim();
  if (!name)  { toast('Name is required','error'); return; }
  if (!phone) { toast('Phone is required','error'); return; }
  btn.disabled = true; btn.textContent = 'Registering-';
  try {
    const p = await apiFetch('/api/patients', { method:'POST', body: JSON.stringify({ name, phone }) });
    document.getElementById('quickRegOverlay')?.remove();
    const inp = document.getElementById('patientSearchInput');
    const hid = document.getElementById('selectedPatientId');
    const lbl = document.getElementById('selectedPatientLabel');
    if (inp) inp.value = `${name} - ${phone}`;
    if (hid) hid.value = p.id;
    if (lbl) lbl.textContent = `? Selected: ${name} (MR: ${p.mr_number || p.id})`;
    toast(`Patient "${name}" registered & selected`, 'success');
  } catch(e) {
    btn.disabled = false; btn.textContent = 'Register & Select';
    toast(e.message,'error');
  }
}

async function scheduler(renderSeq = _pageRenderSeq) {
  if (!isActivePageRender('scheduler', renderSeq)) return;
  // Default to today only on first open; preserve user-selected date on refresh/re-render.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(schedDate || ''))) {
    const _sn = new Date();
    schedDate = _sn.getFullYear() + '-' + String(_sn.getMonth()+1).padStart(2,'0') + '-' + String(_sn.getDate()).padStart(2,'0');
  }
  // Department scope for non-admin users: support multi-department access.
  const userDeptIds = (currentUser && currentUser.role !== 'admin')
    ? ((Array.isArray(currentUser.department_ids) && currentUser.department_ids.length
        ? currentUser.department_ids
        : (currentUser.department_id ? [currentUser.department_id] : []))
      .map(id => String(parseInt(id, 10))).filter(id => id && id !== 'NaN'))
    : [];
  const hasDeptScope = userDeptIds.length > 0;
  const isDeptLocked = hasDeptScope && userDeptIds.length === 1;
  if (isDeptLocked) schedDept = userDeptIds[0];
  if (hasDeptScope && schedDept && !userDeptIds.includes(String(schedDept))) schedDept = '';

  const ca = document.getElementById('contentArea');
  ca.innerHTML = skeletonTable(8);

  try {
    const [allDoctors, departments, schedules, allVisibleApts] = await Promise.all([
      apiFetch('/api/doctors'),
      apiFetch('/api/doctor-departments'),
      apiFetch('/api/doctor-schedules'),
      apiFetch('/api/appointments?date=' + schedDate)
    ]);
    _schedDoctorSchedules = {};
    (schedules || []).forEach(s => { _schedDoctorSchedules[String(s.doctor_id)] = s; });
    // Filter by selected department
    const doctors = schedDept
      ? allDoctors.filter(d => String(d.department_id) === schedDept)
      : allDoctors;
    const doctorIds = new Set(doctors.map(d => parseInt(d.id, 10)));
    _schedDoctorsById = {};
    doctors.forEach(d => { _schedDoctorsById[String(d.id)] = d; });
    const allApts = (Array.isArray(allVisibleApts) ? allVisibleApts : [])
      .filter(a => doctorIds.has(parseInt(a.doctor_id, 10)));
    const docAptsById = {};
    allApts.forEach(a => {
      const key = String(a.doctor_id);
      if (!docAptsById[key]) docAptsById[key] = [];
      docAptsById[key].push(a);
    });
    Object.values(docAptsById).forEach(list => list.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    if (!isActivePageRender('scheduler', renderSeq)) return;

    const dateObj = new Date(schedDate + 'T00:00');
    const niceDateStr = dateObj.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    // Time slots: build a compact window from doctor duty hours and existing appointments.
    let minMinute = Number.POSITIVE_INFINITY;
    let maxMinute = Number.NEGATIVE_INFINITY;
    doctors.forEach(doc => {
      const sch = schedGetSchedule(doc.id);
      const ws = schedParseMinutes(sch.work_start || '09:00');
      const we = schedParseMinutes(sch.work_end || '17:00');
      if (!isNaN(ws)) minMinute = Math.min(minMinute, ws);
      if (!isNaN(we)) maxMinute = Math.max(maxMinute, we);
      (sch.breaks || []).forEach(b => {
        const bs = schedParseMinutes(b.start);
        const be = schedParseMinutes(b.end);
        if (!isNaN(bs)) minMinute = Math.min(minMinute, bs);
        if (!isNaN(be)) maxMinute = Math.max(maxMinute, be);
      });
    });
    allApts.forEach(a => {
      const am = schedParseMinutes(a.time || '');
      const doc = _schedDoctorsById[String(a.doctor_id)] || {};
      const dur = parseInt(doc.slot_duration || 30, 10) || 30;
      if (!isNaN(am)) {
        minMinute = Math.min(minMinute, am);
        maxMinute = Math.max(maxMinute, am + dur);
      }
    });
    if (!isFinite(minMinute) || !isFinite(maxMinute) || maxMinute <= minMinute) {
      minMinute = 9 * 60;
      maxMinute = 17 * 60;
    }
    const startHour = Math.max(0, Math.floor(minMinute / 60));
    let endHour = Math.min(24, Math.ceil(maxMinute / 60));
    if (endHour <= startHour) endHour = Math.min(24, startHour + 1);
    const visibleStartLabel = `${String(startHour).padStart(2, '0')}:00`;
    const visibleEndLabel = `${String(endHour).padStart(2, '0')}:00`;

    const slotMinutes = 15; // 15-min granularity
    const totalSlots = ((endHour - startHour) * 60) / slotMinutes;
    const slotHeight = 30; // px per 15-min slot
    const hourHeight = slotHeight * 4; // px per hour block

    // Build time labels - one per hour block, with 2x2 sub-labels
    let timeLabels = '';
    for (let h = startHour; h < endHour; h++) {
      const top = (h - startHour) * hourHeight;
      const hh = String(h).padStart(2,'0');
      timeLabels += `<div class="sched-time-label sched-hour" style="top:${top}px;height:${hourHeight}px">
        <div class="sched-hour-grid">
          <span class="sched-q">${hh}:00</span><span class="sched-q">${hh}:15</span>
          <span class="sched-q">${hh}:30</span><span class="sched-q">${hh}:45</span>
        </div>
      </div>`;
    }

    // Build horizontal gridlines
    let gridlines = '';
    for (let s = 0; s <= totalSlots; s++) {
      const top = s * slotHeight;
      const mins = startHour * 60 + s * slotMinutes;
      const isHour = mins % 60 === 0;
      const isHalf = mins % 30 === 0 && !isHour;
      gridlines += `<div class="sched-gridline ${isHour ? 'sched-gridline-hour' : ''} ${isHalf ? 'sched-gridline-half' : ''}" style="top:${top}px"></div>`;
    }

    // Current time indicator
    const nowDate = new Date();
    const todayStr = nowDate.getFullYear() + '-' + String(nowDate.getMonth()+1).padStart(2,'0') + '-' + String(nowDate.getDate()).padStart(2,'0');
    let nowLine = '';
    if (schedDate === todayStr) {
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      const startMinutes = startHour * 60;
      if (nowMinutes >= startMinutes && nowMinutes <= endHour * 60) {
        const top = ((nowMinutes - startMinutes) / slotMinutes) * slotHeight;
        nowLine = `<div class="sched-now-line" style="top:${top}px"><span>Now</span></div>`;
      }
    }

    const gridHeight = totalSlots * slotHeight;

    // Build doctor columns
    let colHeaders = '';
    let colBodies = '';

    doctors.forEach((doc, ci) => {
      const docApts = docAptsById[String(doc.id)] || [];
      const docSchedule = schedGetSchedule(doc.id);
      const weeklyOff = (docSchedule.weekly_off_days || []).map(d => SCHED_DAY_NAMES[d].slice(0, 3)).join(', ') || 'None';
      const breakSummary = (docSchedule.breaks || []).map(b => `${b.start}-${b.end}`).join(', ') || 'None';

      // Color palette for doctor columns
      const colors = [
        { bg:'rgba(99,102,241,.07)', border:'var(--c-primary)' },
        { bg:'rgba(34,197,94,.07)',  border:'var(--c-success)' },
        { bg:'rgba(245,158,11,.07)', border:'var(--c-warning)' },
        { bg:'rgba(59,130,246,.07)', border:'var(--c-info)' },
        { bg:'rgba(239,68,68,.07)',  border:'var(--c-danger)' },
      ];
      const color = colors[ci % colors.length];

      colHeaders += `<div class="sched-col-header" style="border-bottom: 3px solid ${color.border}">
        <div class="sched-doc-name">${escHtml(doc.name)}</div>
        <div class="sched-doc-count">${docApts.length} apt${docApts.length!==1?'s':''} - ${doc.slot_duration||30} min slots${doc.department_name ? ` - ${escHtml(doc.department_name)}` : ''}</div>
        <div class="text-muted text-sm">Work ${escHtml(docSchedule.work_start || '09:00')} - ${escHtml(docSchedule.work_end || '17:00')}</div>
        <div class="text-muted text-sm">Off: ${escHtml(weeklyOff)} | Breaks: ${escHtml(breakSummary)}</div>
      </div>`;

      let aptBlocks = '';
      docApts.forEach((a, ai) => {
        const [hh, mm] = (a.time || '00:00').split(':').map(Number);
        const aptMinutes = hh * 60 + mm;
        const startMinutes = startHour * 60;
        if (aptMinutes < startMinutes || aptMinutes >= endHour * 60) return;
        const top = ((aptMinutes - startMinutes) / slotMinutes) * slotHeight;
        const docSlot = doc.slot_duration || 30;
        let blockHeight = Math.max((docSlot / slotMinutes) * slotHeight - 4, slotHeight - 4);
        // Clip height if next appointment would overlap
        if (ai < docApts.length - 1) {
          const [nh, nm] = (docApts[ai+1].time || '00:00').split(':').map(Number);
          const nextTop = ((nh * 60 + nm - startMinutes) / slotMinutes) * slotHeight;
          const maxH = nextTop - top - 4;
          if (blockHeight > maxH && maxH > 20) blockHeight = maxH;
        }

        const statusMap = { Booked:'sched-apt-booked', Confirmed:'sched-apt-confirmed', Arrived:'sched-apt-arrived', Completed:'sched-apt-completed', 'No-Show':'sched-apt-no-show', Cancelled:'sched-apt-cancelled' };
        const statusCls = statusMap[a.status] || 'sched-apt-booked';

        const draggable = (a.status !== 'Cancelled' && a.status !== 'Completed') ? 'draggable="true"' : '';
        const tooltipHtml = `
          <div class="sched-tooltip" onmouseleave="schedHideTooltip()">
            <div class="sched-tooltip-header">${escHtml(a.patient_name)}</div>
            <div class="sched-tooltip-row"><strong>MR#:</strong> <span class="code-id code-id-primary">${escHtml(a.mr_number||'N/A')}</span></div>
            <div class="sched-tooltip-row"><strong>Phone:</strong> ${escHtml(a.patient_phone||'N/A')}</div>
            <div class="sched-tooltip-row"><strong>Doctor:</strong> ${escHtml(doctorDisplayName(doc))}</div>
            <div class="sched-tooltip-row"><strong>Date:</strong> ${escHtml(a.date)}</div>
            <div class="sched-tooltip-row"><strong>Time:</strong> ${escHtml(a.time)}</div>
            <div class="sched-tooltip-row"><strong>Status:</strong> <span class="badge ${({'Booked':'badge-scheduled','Confirmed':'badge-confirmed','Arrived':'badge-arrived','Completed':'badge-completed','No-Show':'badge-no-show','Cancelled':'badge-cancelled'})[a.status]||''}">${escHtml(a.status)}</span></div>
            ${a.notes ? `<div class="sched-tooltip-row"><strong>Notes:</strong> ${escHtml(a.notes)}</div>` : ''}
            ${a.status === 'Arrived' && can('billing.create') ? `<div class="sched-tooltip-actions"><button class="btn btn-success btn-sm" onmousedown="event.stopPropagation();schedHideTooltip();openBillModal(${a.patient_id},${a.id})">${IC.billing} Generate Receipt</button></div>` : ''}
          </div>`;
        aptBlocks += `<div class="sched-apt-block ${statusCls}" ${draggable} style="top:${top + 2}px;height:${blockHeight}px" onclick="schedAptClick(event,${a.id},'${escHtml(a.status)}',${a.patient_id},'${escHtml(a.patient_name).replace(/'/g,'&#39;')}')" ondragstart="schedDragStart(event,${a.id},'${escHtml(a.patient_name)}','${escHtml(a.time)}')" ondragend="schedDragEnd(event)" onmouseenter="schedShowTooltip(event,this)" onmouseleave="schedCheckLeave(event,this)">
          ${tooltipHtml}
          <div class="sched-apt-status"></div>
          <div class="sched-apt-info">
            <div class="sched-apt-name">${escHtml(a.patient_name)}</div>
            <div class="sched-apt-meta">${a.mr_number ? `<span class="code-id code-id-primary">${escHtml(a.mr_number)}</span>` : ''}${a.patient_phone ? (a.mr_number ? ' - ' : '') + escHtml(a.patient_phone) : ''}</div>
            <div class="sched-apt-time">${escHtml(a.time)} - ${escHtml(a.status)}</div>
          </div>
          ${a.status !== 'Cancelled' ? '<div class="sched-drag-handle" title="Drag to reschedule">::</div>' : ''}
        </div>`;
      });

      // Build slot row backgrounds - alternate per hour
      let slotRows = '';
      for (let h = 0; h < (endHour - startHour); h++) {
        const top = h * hourHeight;
        slotRows += `<div class="sched-slot-row ${h%2===0?'even':'odd'}" style="top:${top}px;height:${hourHeight}px"></div>`;
      }

      const blockedLayers = schedRenderDoctorBlockedLayers(doc, schedDate, startHour, endHour, slotHeight);

      colBodies += `<div class="sched-col-body" data-doctor-id="${doc.id}" style="height:${gridHeight}px" onclick="schedSlotClick(event,${doc.id},${startHour},${slotMinutes},${slotHeight})" onmousemove="schedHoverSlot(event,${doc.id},${slotMinutes},${slotHeight})" onmouseleave="schedClearHoverSlot(event.currentTarget)" ondragover="schedDragOver(event)" ondragleave="schedDragLeave(event)" ondrop="schedDrop(event,${doc.id},${startHour},${slotMinutes},${slotHeight})">
        ${gridlines}
        ${nowLine}
        ${slotRows}
        ${blockedLayers}
        ${aptBlocks}
      </div>`;
    });

    // Build department filter control
    const activeDepts = (departments || []).filter(d => d.active !== false);
    const allowedDepts = hasDeptScope
      ? activeDepts.filter(d => userDeptIds.includes(String(d.id)))
      : activeDepts;
    const deptFilterHTML = isDeptLocked
      ? `<span class="badge badge-scheduled" style="white-space:nowrap">${escHtml(allowedDepts[0]?.name || currentUser.department_name || 'Dept')}</span>`
      : `<select style="width:auto" onchange="schedDept=this.value;scheduler()">
          <option value="">All Departments</option>
          ${allowedDepts.map(d => `<option value="${d.id}" ${schedDept===String(d.id)?'selected':''}>${escHtml(d.name)}</option>`).join('')}
        </select>`;

    // If no doctors after filter
    if (!doctors.length) {
      const noDocMsg = schedDept ? 'No doctors in the selected department' : 'Add doctors in the Manage Users section';
      if (!isActivePageRender('scheduler', renderSeq)) return;
      ca.innerHTML = `
        <div class="sched-toolbar">
          <div class="sched-nav">
            <button class="btn btn-sm" onclick="schedPrev()">${IC.chevLeft}</button>
            <button class="btn btn-sm btn-primary" onclick="schedToday()">Today</button>
            <button class="btn btn-sm" onclick="schedNext()">${IC.chevRight}</button>
          </div>
          <div class="sched-date-display"><h3>${niceDateStr}</h3></div>
          <div class="sched-date-pick" style="display:flex;gap:8px;align-items:center">
            ${deptFilterHTML}
            <input type="date" value="${schedDate}" onchange="schedDate=this.value;scheduler()" style="width:auto"/>
          </div>
        </div>
        ${emptyState(IC.scheduler, 'No doctors found', noDocMsg)}`;
      return;
    }

    if (!isActivePageRender('scheduler', renderSeq)) return;
    ca.innerHTML = `
      <div class="sched-toolbar">
        <div class="sched-nav">
          <button class="btn btn-sm" onclick="schedPrev()">${IC.chevLeft}</button>
          <button class="btn btn-sm btn-primary" onclick="schedToday()">Today</button>
          <button class="btn btn-sm" onclick="schedNext()">${IC.chevRight}</button>
        </div>
        <div class="sched-date-display">
          <h3>${niceDateStr}</h3>
          <div class="text-muted text-sm">Visible Hours: ${visibleStartLabel} - ${visibleEndLabel}</div>
        </div>
        <div class="sched-date-pick" style="display:flex;gap:8px;align-items:center">
          ${deptFilterHTML}
          <input type="date" value="${schedDate}" onchange="schedDate=this.value;scheduler()" style="width:auto"/>
          ${can('patients.create') ? `<button class="btn btn-primary btn-sm" style="white-space:nowrap" onclick="quickRegisterPatient()">${IC.plus} Quick Register</button>` : ''}
        </div>
      </div>

      <div class="sched-legend">
        <span class="sched-legend-item"><span class="sched-legend-dot booked"></span> Booked</span>
        <span class="sched-legend-item"><span class="sched-legend-dot confirmed"></span> Confirmed</span>
        <span class="sched-legend-item"><span class="sched-legend-dot arrived"></span> Arrived</span>
        <span class="sched-legend-item"><span class="sched-legend-dot completed"></span> Completed</span>
        <span class="sched-legend-item"><span class="sched-legend-dot no-show"></span> No-Show</span>
        <span class="sched-legend-item"><span class="sched-legend-dot cancelled"></span> Cancelled</span>
        <span class="sched-legend-item">Shaded blocks = holidays / breaks / off-hours</span>
        <span class="sched-legend-item">${IC.clock} ${doctors.length} Doctor${doctors.length!==1?'s':''} - ${allApts.length} Appointment${allApts.length!==1?'s':''}</span>
        ${schedDept && !isDeptLocked ? `<span class="sched-legend-item"><button class="btn btn-sm" style="padding:2px 8px;font-size:11px" onclick="schedDept='';scheduler()">? Clear Filter</button></span>` : ''}
      </div>

      <div class="sched-container">
        <div class="sched-grid" style="--col-count:${doctors.length}">
          <!-- Header row -->
          <div class="sched-time-header">Time</div>
          ${colHeaders}

          <!-- Body -->
          <div class="sched-time-col" style="height:${gridHeight}px">
            ${timeLabels}
          </div>
          <div class="sched-body" style="height:${gridHeight}px">
            ${colBodies}
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    ca.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function schedPrev() {
  try {
    const d = new Date(schedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    schedDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    scheduler();
  } catch(e) { console.error('schedPrev error:', e); }
}
function schedNext() {
  try {
    const d = new Date(schedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    schedDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    scheduler();
  } catch(e) { console.error('schedNext error:', e); }
}
function schedToday() {
  try {
    const d = new Date();
    schedDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    scheduler();
  } catch(e) { console.error('schedToday error:', e); }
}

function schedSlotClick(event, doctorId, startHour, slotMinutes, slotHeight) {
  // Ignore clicks on appointment blocks
  if (event.target.closest('.sched-apt-block')) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const y = event.clientY - rect.top + event.currentTarget.scrollTop;
  const doc = _schedDoctorsById[String(doctorId)] || {};
  const docSlotMins = parseInt(doc.slot_duration || (slotMinutes || 15), 10) || (slotMinutes || 15);
  const docSlotPx = (docSlotMins / slotMinutes) * slotHeight;
  const slotIndex = Math.floor(y / docSlotPx);
  const totalMinutes = startHour * 60 + slotIndex * docSlotMins;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const time = hh + ':' + mm;
  const blocked = schedCheckSlotBlocked(doc, schedDate, time);
  if (blocked.blocked) {
    toast(blocked.reason || 'Selected slot is blocked by doctor schedule.', 'error');
    return;
  }
  openNewAppointmentModal(null, schedDate, doctorId, time);
}

// Prevent click from firing after drag and repeated rapid clicks
let schedAptClickBusy = false;
let schedAptClickLastAt = 0;
async function schedAptClick(event, aptId, status, patientId, patientName) {
  if (event.target.closest('.sched-apt-block')?.classList.contains('sched-dragging')) return;
  if (schedAptClickBusy) return;
  const now = Date.now();
  if (now - schedAptClickLastAt < 900) return;
  schedAptClickLastAt = now;
  schedAptClickBusy = true;
  try {
    schedHideTooltip();
    if (status === 'Completed' && can('billing.create')) {
      await openAddServicesToBillModal(aptId, patientId, patientName);
      return;
    }
    await openEditAppointmentModal(aptId);
  } finally {
    // Keep a short post-action lock to absorb extra click events.
    setTimeout(() => { schedAptClickBusy = false; }, 300);
  }
}

// --- Tooltip on hover ------------------------------------
let schedTooltipTimer = null;
function schedShowTooltip(event, el) {
  clearTimeout(schedTooltipTimer);
  // Small delay to avoid flickering
  schedTooltipTimer = setTimeout(() => {
    const tip = el.querySelector('.sched-tooltip');
    if (!tip) return;
    tip.classList.add('visible');
    // Position: try to show above, fall back to below
    const block = el.getBoundingClientRect();
    const container = el.closest('.sched-container');
    if (container) {
      const cRect = container.getBoundingClientRect();
      if (block.top - cRect.top < 160) {
        tip.classList.add('below');
        tip.classList.remove('above');
      } else {
        tip.classList.add('above');
        tip.classList.remove('below');
      }
    }
  }, 200);
}
function schedCheckLeave(event, el) {
  const tt = el.querySelector('.sched-tooltip');
  if (tt && tt.contains(event.relatedTarget)) return; // mouse moved into tooltip
  schedHideTooltip();
}
function schedHideTooltip() {
  clearTimeout(schedTooltipTimer);
  document.querySelectorAll('.sched-tooltip.visible').forEach(t => t.classList.remove('visible', 'above', 'below'));
}

// --- Drag & Drop Reschedule ------------------------------
let schedDragAptId = null;

function schedDragStart(event, aptId, patientName, oldTime) {
  schedDragAptId = aptId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', aptId);
  const el = event.target.closest('.sched-apt-block');
  if (el) {
    el.classList.add('sched-dragging');
    // Store offset within block for precise placement
    const rect = el.getBoundingClientRect();
    event.dataTransfer.setData('application/x-offset', String(event.clientY - rect.top));
  }
  // Highlight all drop columns
  setTimeout(() => {
    document.querySelectorAll('.sched-col-body').forEach(c => c.classList.add('sched-drop-target'));
  }, 0);
}

function schedDragEnd(event) {
  schedDragAptId = null;
  document.querySelectorAll('.sched-col-body').forEach(c => {
    c.classList.remove('sched-drop-target', 'sched-drop-hover');
    const p = c.querySelector('.sched-drop-preview');
    if (p) p.remove();
  });
  document.querySelectorAll('.sched-dragging').forEach(e => e.classList.remove('sched-dragging'));
}

function schedDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const col = event.currentTarget;
  col.classList.add('sched-drop-hover');
  // Show drop preview
  let preview = col.querySelector('.sched-drop-preview');
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'sched-drop-preview';
    col.appendChild(preview);
  }
  const rect = col.getBoundingClientRect();
  const y = event.clientY - rect.top + col.scrollTop;
  const docId = parseInt(col.getAttribute('data-doctor-id'));
  const doc = _schedDoctorsById[String(docId)] || {};
  const slotH = 30;
  const baseMins = 15;
  const docSlotMins = parseInt(doc.slot_duration || baseMins, 10) || baseMins;
  const docSlotPx = (docSlotMins / baseMins) * slotH;
  const snappedY = Math.floor(y / docSlotPx) * docSlotPx;
  preview.style.top = snappedY + 'px';
  preview.style.height = docSlotPx + 'px';
}

function schedHoverSlot(event, doctorId, slotMinutes, slotHeight) {
  const col = event.currentTarget;
  if (!col || col.classList.contains('sched-drop-hover')) return;
  // Avoid hover overlay when pointer is on top of an existing appointment block.
  if (event.target && event.target.closest('.sched-apt-block')) {
    schedClearHoverSlot(col);
    return;
  }
  let hover = col.querySelector('.sched-hover-slot');
  if (!hover) {
    hover = document.createElement('div');
    hover.className = 'sched-hover-slot';
    hover.style.cssText = 'position:absolute;left:6px;right:6px;z-index:1;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.45);border-radius:8px;pointer-events:none;transition:top .05s linear,height .05s linear';
    col.appendChild(hover);
  }
  const rect = col.getBoundingClientRect();
  const y = event.clientY - rect.top + col.scrollTop;
  const doc = _schedDoctorsById[String(doctorId)] || {};
  const docSlotMins = parseInt(doc.slot_duration || slotMinutes, 10) || slotMinutes;
  const docSlotPx = (docSlotMins / slotMinutes) * slotHeight;
  const snappedY = Math.floor(y / docSlotPx) * docSlotPx;
  hover.style.top = snappedY + 'px';
  hover.style.height = Math.max(slotHeight, docSlotPx) + 'px';
}

function schedClearHoverSlot(col) {
  if (!col) return;
  const hover = col.querySelector('.sched-hover-slot');
  if (hover) hover.remove();
}

function schedDragLeave(event) {
  const col = event.currentTarget;
  // Only remove if leaving the col-body itself
  if (!col.contains(event.relatedTarget)) {
    col.classList.remove('sched-drop-hover');
    const preview = col.querySelector('.sched-drop-preview');
    if (preview) preview.remove();
  }
}

async function schedDrop(event, doctorId, startHour, slotMinutes, slotHeight) {
  event.preventDefault();
  event.stopPropagation();
  const aptId = parseInt(event.dataTransfer.getData('text/plain')) || parseInt(schedDragAptId);
  if (!aptId) return;

  // Clean up UI
  document.querySelectorAll('.sched-col-body').forEach(c => {
    c.classList.remove('sched-drop-target', 'sched-drop-hover');
    schedClearHoverSlot(c);
    const p = c.querySelector('.sched-drop-preview');
    if (p) p.remove();
  });
  document.querySelectorAll('.sched-dragging').forEach(e => e.classList.remove('sched-dragging'));
  schedDragAptId = null;

  // Calculate new time from drop position
  const rect = event.currentTarget.getBoundingClientRect();
  const y = event.clientY - rect.top + event.currentTarget.scrollTop;
  const doc = _schedDoctorsById[String(doctorId)] || {};
  const docSlotMins = parseInt(doc.slot_duration || slotMinutes, 10) || slotMinutes;
  const docSlotPx = (docSlotMins / slotMinutes) * slotHeight;
  const slotIndex = Math.floor(y / docSlotPx);
  const totalMinutes = startHour * 60 + slotIndex * docSlotMins;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  const newTime = hh + ':' + mm;

  const blocked = schedCheckSlotBlocked(doc, schedDate, newTime);
  if (blocked.blocked) {
    toast(blocked.reason || 'Cannot reschedule into a blocked slot.', 'error');
    return;
  }

  // Show reschedule confirmation modal
  showRescheduleModal(aptId, doctorId, schedDate, newTime);
}

function showRescheduleModal(aptId, doctorId, date, time) {
  const modalHtml = `
    <div id="rescheduleModal" class="modal-overlay active" onclick="if(event.target===this)closeRescheduleModal()">
      <div class="modal-content" style="max-width:420px">
        <div class="modal-header">
          <h3>${IC.clock} Reschedule Appointment</h3>
          <button class="btn-icon" onclick="closeRescheduleModal()">${IC.x}</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:16px;color:var(--text-secondary)">Move appointment <strong>#${aptId}</strong> to:</p>
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="reschedDate" value="${date}" />
          </div>
          <div class="form-group">
            <label>Time</label>
            <input type="time" id="reschedTime" value="${time}" />
          </div>
          <input type="hidden" id="reschedDoctorId" value="${doctorId}" />
          <input type="hidden" id="reschedAptId" value="${aptId}" />
          <div class="btn-row" style="margin-top:20px">
            <button class="btn" onclick="closeRescheduleModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmReschedule()">Reschedule</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeRescheduleModal() {
  const m = document.getElementById('rescheduleModal');
  if (m) m.remove();
}

async function confirmReschedule() {
  const aptId = parseInt(document.getElementById('reschedAptId').value);
  const newDate = document.getElementById('reschedDate').value;
  const newTime = document.getElementById('reschedTime').value;
  const doctorId = parseInt(document.getElementById('reschedDoctorId').value);
  if (!newDate || !newTime) { toast('Please select date and time', 'error'); return; }
  try {
    await apiFetch('/api/appointments/' + aptId, {
      method: 'PUT',
      body: JSON.stringify({ date: newDate, time: newTime, doctor_id: doctorId })
    });
    closeRescheduleModal();
    toast('Appointment rescheduled to ' + newDate + ' ' + newTime, 'success');
    // If date changed, navigate to that date
    schedDate = newDate;
    scheduler();
  } catch(e) {
    toast(e.message, 'error');
  }
}

// --------------------------------------------------------
//  PRESCRIPTIONS
// --------------------------------------------------------
let _rxAll = [];
async function prescriptions() {
  const ca = document.getElementById('contentArea');
  const todayStr = new Date().toLocaleDateString('sv');
  ca.innerHTML = `
    <div class="action-bar bill-action-bar">
      <div class="search-box"><input id="rxSearch" type="text" placeholder="Search patient, visit ID, doctor, diagnosis..." oninput="filterPrescriptions()"/></div>
      <div class="bill-filter-group">
        <input id="rxDateFrom" type="date" value="${todayStr}" title="From date"/>
        <input id="rxDateTo" type="date" value="${todayStr}" title="To date"/>
        <button class="btn report-apply-btn" onclick="filterPrescriptions()">${IC.search} Filter</button>
        <button class="btn report-clear-btn" onclick="clearRxFilters()">Clear</button>
      </div>
      <div class="bill-action-spacer"></div>
      ${can('prescriptions.create') ? `<button class="btn btn-primary" onclick="openPrescriptionModal()">${IC.plus} New Prescription</button>` : ''}
    </div>
    <div id="rxWrap">${skeletonTable(5)}</div>`;
  try {
    _rxAll = await apiFetch('/api/prescriptions');
    filterPrescriptions();
  } catch(e) {
    document.getElementById('rxWrap').innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}
function clearRxFilters() {
  const t = new Date().toLocaleDateString('sv');
  const f = document.getElementById('rxDateFrom');
  const to = document.getElementById('rxDateTo');
  const s = document.getElementById('rxSearch');
  if (f) f.value = t;
  if (to) to.value = t;
  if (s) s.value = '';
  filterPrescriptions();
}

function renderPrescriptionRows(list) {
  const wrap = document.getElementById('rxWrap');
  if (!wrap) return;
  if (!list.length) {
    wrap.innerHTML = emptyState(IC.prescriptions, 'No prescriptions found', 'Try changing search or date filters');
    return;
  }
  wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>MR#</th><th>Patient</th><th>Visit ID</th><th>Doctor</th><th>Diagnosis</th><th>Medicines</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${list.map((r,i) => `<tr>
        <td>${i+1}</td>
        <td><span class="code-id code-id-primary">${escHtml(r.mr_number||'-')}</span></td>
        <td><strong>${escHtml(r.patient_name)}</strong></td>
        <td><span class="code-id code-id-muted">${escHtml(r.visit_id||'-')}</span></td>
        <td>${escHtml(r.doctor_name)}</td>
        <td>${escHtml(r.diagnosis)||'-'}</td>
        <td class="truncate" style="max-width:160px">${escHtml(r.medicines)||'-'}</td>
        <td class="text-muted text-sm">${escHtml(formatDateTime(r.created_at||''))}</td>
        <td class="td-actions">
          <button class="btn btn-sm" onclick="printPrescription(${r.id})">${IC.print} Print</button>
          ${currentUser.role === 'doctor' ? `<button class="btn btn-sm" onclick="editPrescription(${r.id})">${IC.edit} Edit</button>` : ''}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function filterPrescriptions() {
  const q = (document.getElementById('rxSearch')?.value || '').toLowerCase().trim();
  const from = document.getElementById('rxDateFrom')?.value || '';
  const to = document.getElementById('rxDateTo')?.value || '';
  const filtered = (_rxAll || []).filter(r => {
    const rowText = [
      r.mr_number,
      r.patient_name,
      r.visit_id,
      r.doctor_name,
      r.diagnosis,
      r.medicines,
    ].map(v => String(v || '').toLowerCase()).join(' ');
    const rxDate = String(r.created_at || '').slice(0,10);
    const matchSearch = !q || rowText.includes(q);
    const matchFrom = !from || (rxDate && rxDate >= from);
    const matchTo = !to || (rxDate && rxDate <= to);
    return matchSearch && matchFrom && matchTo;
  });
  renderPrescriptionRows(filtered);
}

async function openPrescriptionModal(appointmentId = null, patientId = null) {
  let patName = '';
  if (patientId) {
    const p = await apiFetch(`/api/patients/${patientId}`);
    patName = p.name;
  }

  let doctorFieldHtml = '';
  if (currentUser?.role !== 'doctor') {
    let doctors = [];
    try {
      doctors = await apiFetch('/api/doctors');
    } catch (_) {
      doctors = [];
    }
    let selectedDoctorId = '';
    if (appointmentId) {
      try {
        const appt = await apiFetch(`/api/appointments/${appointmentId}`);
        selectedDoctorId = appt && appt.doctor_id ? String(appt.doctor_id) : '';
      } catch (_) {
        selectedDoctorId = '';
      }
    }
    doctorFieldHtml = `
      <div class="form-group">
        <label>Doctor *</label>
        <select name="doctor_id" id="rxDoctorId" required>
          <option value="">Select doctor</option>
          ${(Array.isArray(doctors) ? doctors : []).map(d => `<option value="${d.id}" ${selectedDoctorId === String(d.id) ? 'selected' : ''}>${escHtml(d.name || d.username || `Doctor #${d.id}`)}</option>`).join('')}
        </select>
      </div>`;
  }

  showModal('New Prescription', `
    <form id="rxForm">
      <div class="form-group">
        <label>Patient *</label>
        ${patientId
          ? `<input value="${escHtml(patName)}" disabled/><input type="hidden" name="patient_id" value="${patientId}"/>`
          : `<div class="psd-wrap">
               <input name="patient_search_rx" id="rxPatSearch" placeholder="Search patient..." oninput="searchPatientRx(this.value)" autocomplete="off"/>
               <input type="hidden" name="patient_id" id="rxPatientId"/>
               <div id="rxPatDropdown" class="psd-list" style="display:none"></div>
             </div>
             <div id="rxPatLabel" class="text-muted text-sm mt-1"></div>`}
        <input type="hidden" name="appointment_id" value="${appointmentId||''}"/>
      </div>
      ${doctorFieldHtml}
      <div class="form-group">
        <label>Visit ID *</label>
        <select name="visit_id" id="rxVisitId" required>
          <option value="">Select visit ID</option>
        </select>
        <div id="rxVisitHint" class="text-muted text-sm mt-1"></div>
      </div>
      <div class="form-group"><label>Diagnosis</label><textarea name="diagnosis" rows="2"></textarea></div>
      <div class="form-group"><label>Medicines</label><textarea name="medicines" rows="2" placeholder="e.g. Paracetamol 500mg, Amoxicillin 250mg"></textarea></div>
      <div class="form-group"><label>Dosage / Instructions</label><textarea name="dosage" rows="2" placeholder="e.g. 1 tablet 3 times a day after meals"></textarea></div>
      <div class="form-group"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
    </form>`,
    async () => {
      const f = document.getElementById('rxForm');
      const body = Object.fromEntries(new FormData(f));
      if (!body.patient_id) { toast('Please select a patient', 'error'); return false; }
      if (currentUser?.role !== 'doctor' && !String(body.doctor_id || '').trim()) { toast('Please select doctor', 'error'); return false; }
      if (!String(body.visit_id || '').trim()) { toast('Please enter visit ID', 'error'); return false; }
      try {
        await apiFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify(body) });
        toast('Prescription created', 'success');
        closeModal();
        // If opened from appointment page, stay on appointment page; otherwise go to prescriptions
        if (appointmentId) {
          appointments();
        } else {
          prescriptions();
        }
        offerFollowUpFromContext(parseInt(body.patient_id, 10), currentUser?.role === 'doctor' ? currentUser.id : null, appointmentId || null, 'Prescription review');
      } catch(e) { toast(e.message, 'error'); return false; }
    });

  if (patientId) {
    await loadRxVisitOptions(patientId);
  }
}

async function loadRxVisitOptions(patientId, selectedVisitId = '', fieldId = 'rxVisitId', hintId = 'rxVisitHint') {
  const selectEl = document.getElementById(fieldId);
  const hintEl = document.getElementById(hintId);
  if (!selectEl || !hintEl) return;
  if (!patientId) {
    selectEl.innerHTML = '<option value="">Select patient first</option>';
    selectEl.value = '';
    selectEl.disabled = true;
    hintEl.textContent = 'Select patient first to see previous visits.';
    return;
  }
  selectEl.disabled = false;
  try {
    const include = selectedVisitId ? `?include_visit_id=${encodeURIComponent(selectedVisitId)}` : '';
    let visitRows = await apiFetch(`/api/patients/${encodeURIComponent(patientId)}/available-visits${include}`);
    if (!Array.isArray(visitRows)) visitRows = [];

    // Fallback for older server versions: derive available visits from bills and prescriptions.
    if (!visitRows.length) {
      const [bills, existingRx] = await Promise.all([
        apiFetch(`/api/bills?patient_id=${encodeURIComponent(patientId)}`).catch(() => []),
        apiFetch(`/api/prescriptions?patient_id=${encodeURIComponent(patientId)}`).catch(() => []),
      ]);
      const assigned = new Set((existingRx || [])
        .map(r => String(r.visit_id || '').trim())
        .filter(v => v && v !== selectedVisitId));
      visitRows = Object.values((bills || []).reduce((acc, b) => {
        const vid = String(b.visit_id || '').trim();
        if (!vid || assigned.has(vid)) return acc;
        const existing = acc[vid];
        if (!existing || String(b.created_at || '') > String(existing.created_at || '')) {
          acc[vid] = { visit_id: vid, created_at: b.created_at || '' };
        }
        return acc;
      }, {})).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    const options = visitRows.map(v => {
      const dt = formatDateTime(v.created_at || '');
      const label = dt !== '-' ? `${v.visit_id} - ${dt}` : v.visit_id;
      return `<option value="${escHtml(v.visit_id)}">${escHtml(label)}</option>`;
    }).join('');
    selectEl.innerHTML = `<option value="">Select visit ID</option>${options}`;
    hintEl.textContent = visitRows.length
      ? `Available visits: ${visitRows.slice(0, 5).map(v => `${v.visit_id} (${formatDateTime(v.created_at || '')})`).join(', ')}`
      : 'No unassigned visit IDs available for this patient.';
    if (selectedVisitId) {
      selectEl.value = selectedVisitId;
      if (selectEl.value !== selectedVisitId) {
        const extra = document.createElement('option');
        extra.value = selectedVisitId;
        extra.textContent = `${selectedVisitId} (already assigned)`;
        selectEl.appendChild(extra);
        selectEl.value = selectedVisitId;
      }
    }
  } catch {
    selectEl.innerHTML = '<option value="">Unable to load visit IDs</option>';
    hintEl.textContent = 'Could not load visit IDs right now.';
  }
}

let rxPatTimer = null;
function searchPatientRx(q) {
  clearTimeout(rxPatTimer);
  if (q.length < 1) { document.getElementById('rxPatDropdown').style.display='none'; return; }
  rxPatTimer = setTimeout(async () => {
    const list = await apiFetch(`/api/patients?search=${encodeURIComponent(q)}`);
    const dd = document.getElementById('rxPatDropdown');
    if (!list.length) { dd.style.display='none'; return; }
    dd.innerHTML = list.map(p =>
      `<div onmousedown="selectRxPatient(${p.id},'${escHtml(p.name)}')">
         <strong>${escHtml(p.name)}</strong> <span class="text-muted">${escHtml(p.phone||'')}</span>
       </div>`).join('');
    dd.style.display = 'block';
  }, 250);
}
async function selectRxPatient(id, name) {
  document.getElementById('rxPatientId').value = id;
  document.getElementById('rxPatSearch').value = name;
  document.getElementById('rxPatLabel').textContent = `Selected: ${name}`;
  document.getElementById('rxPatDropdown').style.display='none';
  await loadRxVisitOptions(id);
}

async function editPrescription(id) {
  const rx = await apiFetch(`/api/prescriptions/${id}`);
  showModal('Edit Prescription', `
    <form id="editRxForm">
      <div class="form-group"><label>Patient</label><input value="${escHtml(rx.patient_name)}" disabled/></div>
      <div class="form-group">
        <label>Visit ID *</label>
        <select name="visit_id" id="editRxVisitId" required>
          <option value="">Select visit ID</option>
        </select>
        <div id="editRxVisitHint" class="text-muted text-sm mt-1"></div>
      </div>
      <div class="form-group"><label>Diagnosis</label><textarea name="diagnosis" rows="2">${escHtml(rx.diagnosis||'')}</textarea></div>
      <div class="form-group"><label>Medicines</label><textarea name="medicines" rows="2">${escHtml(rx.medicines||'')}</textarea></div>
      <div class="form-group"><label>Dosage / Instructions</label><textarea name="dosage" rows="2">${escHtml(rx.dosage||'')}</textarea></div>
      <div class="form-group"><label>Notes</label><textarea name="notes" rows="2">${escHtml(rx.notes||'')}</textarea></div>
    </form>`,
    async () => {
      const body = Object.fromEntries(new FormData(document.getElementById('editRxForm')));
      if (!String(body.visit_id || '').trim()) { toast('Please enter visit ID', 'error'); return false; }
      try {
        await apiFetch(`/api/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('Prescription updated', 'success');
        closeModal(); prescriptions();
      } catch(e) { toast(e.message, 'error'); return false; }
    });

  await loadRxVisitOptions(rx.patient_id, rx.visit_id || '', 'editRxVisitId', 'editRxVisitHint');
}

async function printPrescription(id) {
  const rx = await apiFetch(`/api/prescriptions/${id}`);
  const printArea = document.getElementById('printArea');
  printArea.classList.remove('hidden');
  printArea.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <h2 style="margin:0">ClinicMS - Clinic Management System</h2>
      <p style="color:#666;margin:4px 0">Prescription</p>
      <hr/>
    </div>
    <table style="width:100%;margin-bottom:16px">
      <tr><td><strong>Patient:</strong> ${escHtml(rx.patient_name)}</td><td><strong>Date:</strong> ${escHtml(formatDateTime(rx.created_at||''))}</td></tr>
      <tr><td><strong>MR#:</strong> ${escHtml(rx.mr_number || '-')}</td><td><strong>Visit ID:</strong> ${escHtml(rx.visit_id || '-')}</td></tr>
      <tr><td><strong>Doctor:</strong> ${escHtml(rx.doctor_name)}</td><td></td></tr>
    </table>
    <h4>Diagnosis</h4><p>${escHtml(rx.diagnosis)||'-'}</p>
    <h4>Medicines</h4><p>${escHtml(rx.medicines)||'-'}</p>
    <h4>Dosage &amp; Instructions</h4><p>${escHtml(rx.dosage)||'-'}</p>
    ${rx.notes ? `<h4>Notes</h4><p>${escHtml(rx.notes)}</p>` : ''}
    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:13px">
      <span>Patient Signature: _______________</span>
      <span>Doctor Signature: _______________</span>
    </div>`;
  window.print();
  setTimeout(() => printArea.classList.add('hidden'), 500);
}

// --------------------------------------------------------
//  DISCOUNT MASTER
// --------------------------------------------------------
let _discountAll = [];
async function discountMaster() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar">
      <div class="page-title">${IC.discount} Discount Master</div>
      <div style="flex:1"></div>
      ${can('billing.discount.view') ? `<button class="btn btn-primary" onclick="openDiscountModal()">${IC.plus} New Discount</button>` : ''}
    </div>
    <div id="discountWrap">${skeletonTable(4)}</div>`;
  try {
    _discountAll = await apiFetch('/api/discounts');
    renderDiscountTable();
  } catch(e) { toast('Failed to load discounts','error'); }
}
function renderDiscountTable() {
  const wrap = document.getElementById('discountWrap');
  if (!wrap) return;
  if (!_discountAll.length) {
    wrap.innerHTML = emptyState(IC.discount, 'No discounts configured', 'Create predefined discounts to apply during billing');
    return;
  }
  const todayISO = new Date().toISOString().slice(0,10);
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Name</th><th>Type</th><th>Value</th><th>Applicable On</th><th>Max Limit</th><th>Validity</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${_discountAll.map((d,i) => {
      const expired = d.valid_to && d.valid_to < todayISO;
      const notStarted = d.valid_from && d.valid_from > todayISO;
      const validLabel = expired ? '<span class="badge badge-cancelled">Expired</span>' : notStarted ? '<span class="badge badge-pending">Not Started</span>' : '<span class="badge badge-confirmed">Valid</span>';
      const typeLabel = d.type === 'percentage' ? `<span class="badge badge-admin">${IC.discount} %</span>` : d.type === 'fixed' ? `<span class="badge badge-arrived">Fixed</span>` : `<span class="badge badge-secondary">Open</span>`;
      const valueLabel = d.type === 'percentage' ? `${d.value}%` : d.type === 'fixed' ? `KD ${parseFloat(d.value||0).toFixed(3)}` : '- (manual)';
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${escHtml(d.name)}</strong></td>
        <td>${typeLabel}</td>
        <td>${escHtml(valueLabel)}</td>
        <td>${escHtml(d.applicable_on||'all')}</td>
        <td>${d.max_limit ? `KD ${parseFloat(d.max_limit).toFixed(3)}` : '-'}</td>
        <td style="font-size:12px">${escHtml(d.valid_from||'-')} ? ${escHtml(d.valid_to||'-')}<br/>${validLabel}</td>
        <td>${d.active !== false ? '<span class="badge badge-confirmed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
        <td class="td-actions">
          <button class="btn btn-sm" onclick="openDiscountModal(${d.id})">${IC.edit}</button>
          <button class="btn btn-sm" style="color:#e57373" onclick="deleteDiscount(${d.id})">${IC.trash}</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}
async function openDiscountModal(id = null) {
  let d = { name:'', type:'percentage', value:'', applicable_on:'all', max_limit:'', valid_from:'', valid_to:'', active:true };
  if (id) {
    try { d = await apiFetch(`/api/discounts/${id}`); } catch { toast('Failed to load','error'); return; }
  }
  showModal(id ? `Edit Discount - ${escHtml(d.name)}` : 'New Discount', `
    <form id="discountForm">
      <div class="form-group"><label>Discount Name *</label><input name="name" value="${escHtml(d.name||'')}" required maxlength="80"/></div>
      <div class="form-row">
        <div class="form-group"><label>Type *</label>
          <select name="type" id="discTypeSelect" onchange="document.getElementById('discValueGrp').style.display=this.value==='open'?'none':''" required>
            <option value="percentage"${d.type==='percentage'?' selected':''}>Percentage (%)</option>
            <option value="fixed"${d.type==='fixed'?' selected':''}>Fixed Amount (KD)</option>
            <option value="open"${d.type==='open'?' selected':''}>Open Discount (manual entry)</option>
          </select>
        </div>
        <div class="form-group" id="discValueGrp" style="${d.type==='open'?'display:none':''}"><label>Value</label><input name="value" type="number" min="0" step="0.001" value="${escHtml(String(d.value||''))}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Applicable On</label>
          <select name="applicable_on">
            <option value="all"${d.applicable_on==='all'?' selected':''}>All (Services/Products/Packages)</option>
            <option value="services"${d.applicable_on==='services'?' selected':''}>Services only</option>
            <option value="products"${d.applicable_on==='products'?' selected':''}>Products only</option>
            <option value="packages"${d.applicable_on==='packages'?' selected':''}>Packages only</option>
          </select>
        </div>
        <div class="form-group"><label>Max Discount Limit (KD)</label><input name="max_limit" type="number" min="0" step="0.001" placeholder="Optional" value="${escHtml(String(d.max_limit!=null?d.max_limit:''))}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Valid From</label><input name="valid_from" type="date" value="${escHtml(d.valid_from||'')}"/></div>
        <div class="form-group"><label>Valid To</label><input name="valid_to" type="date" value="${escHtml(d.valid_to||'')}"/></div>
      </div>
      <div class="form-group"><label>Status</label>
        <select name="active">
          <option value="true"${d.active!==false?' selected':''}>Active</option>
          <option value="false"${d.active===false?' selected':''}>Inactive</option>
        </select>
      </div>
    </form>`,
    async () => {
      const body = Object.fromEntries(new FormData(document.getElementById('discountForm')));
      if (!body.name.trim()) { toast('Discount name required','error'); return false; }
      body.active = body.active !== 'false';
      try {
        if (id) await apiFetch(`/api/discounts/${id}`, { method:'PUT', body:JSON.stringify(body) });
        else    await apiFetch('/api/discounts', { method:'POST', body:JSON.stringify(body) });
        toast(id ? 'Discount updated':'Discount created', 'success');
        closeModal(); _discountAll = await apiFetch('/api/discounts'); renderDiscountTable();
      } catch(e) { toast(e.message,'error'); return false; }
    });
}
async function deleteDiscount(id) {
  if (!await confirmDialog('Delete this discount?')) return;
  try { await apiFetch(`/api/discounts/${id}`, { method:'DELETE' }); toast('Deleted','success'); _discountAll = await apiFetch('/api/discounts'); renderDiscountTable(); }
  catch(e) { toast(e.message,'error'); }
}

// --------------------------------------------------------
//  EXPENSES
// --------------------------------------------------------
let _expenseRows = [];
let _expenseMeta = { categories: [], payment_methods: [] };
let _supplierInvoiceCandidates = [];

function expenseTodayISO() {
  return new Date().toLocaleDateString('sv');
}

function expenseMonthStartISO() {
  const dt = new Date();
  dt.setDate(1);
  return dt.toLocaleDateString('sv');
}

function expenseMoney(value) {
  return `KD ${(parseFloat(value || 0) || 0).toFixed(3)}`;
}

function expenseCategoryOptions(selected = '') {
  const current = String(selected || '');
  const items = Array.from(new Set([...(Array.isArray(_expenseMeta.categories) ? _expenseMeta.categories : []), ...(current ? [current] : [])].filter(Boolean)));
  return ['<option value="">All Categories</option>']
    .concat(items.sort((a, b) => a.localeCompare(b)).map((cat) => `<option value="${escHtml(cat)}"${cat === current ? ' selected' : ''}>${escHtml(cat)}</option>`))
    .join('');
}

function expenseCategorySelectOptions(selected = '', placeholder = 'Select Category') {
  const current = String(selected || '');
  const items = Array.from(new Set((Array.isArray(_expenseMeta.categories) ? _expenseMeta.categories : []).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [`<option value="">${escHtml(placeholder)}</option>`]
    .concat(items.map((cat) => `<option value="${escHtml(cat)}"${cat === current ? ' selected' : ''}>${escHtml(cat)}</option>`))
    .join('');
}

function expensePaymentDatalistOptions() {
  return Array.from(new Set((Array.isArray(_expenseMeta.payment_methods) ? _expenseMeta.payment_methods : []).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${escHtml(name)}"></option>`)
    .join('');
}

function setExpensePreset(mode) {
  const fromEl = document.getElementById('expenseDateFrom');
  const toEl = document.getElementById('expenseDateTo');
  if (!fromEl || !toEl) return;
  if (mode === 'today') {
    const today = expenseTodayISO();
    fromEl.value = today;
    toEl.value = today;
  } else {
    fromEl.value = expenseMonthStartISO();
    toEl.value = expenseTodayISO();
  }
  loadExpenses();
}

function selectedSupplierInvoiceForPayment() {
  const id = parseInt(document.getElementById('sipInvoiceId')?.value || 0, 10);
  if (!id) return null;
  return _supplierInvoiceCandidates.find((row) => parseInt(row.po_id, 10) === id) || null;
}

function refreshSupplierInvoicePaymentMeta() {
  const inv = selectedSupplierInvoiceForPayment();
  const metaEl = document.getElementById('sipInvoiceMeta');
  if (!metaEl) return;
  if (!inv) {
    metaEl.innerHTML = `<div class="text-muted text-sm">Select an invoice to view due details.</div>`;
    return;
  }

  metaEl.innerHTML = `
    <div class="form-row" style="margin:0">
      <div class="form-group" style="margin:0"><label>Supplier</label><div><strong>${escHtml(inv.supplier_name || '-')}</strong></div></div>
      <div class="form-group" style="margin:0"><label>Invoice #</label><div><strong>${escHtml(inv.invoice_number || `PO-${inv.po_id}`)}</strong></div></div>
    </div>
    <div class="form-row" style="margin-top:8px">
      <div class="form-group" style="margin:0"><label>Total</label><div>${expenseMoney(inv.total_amount || 0)}</div></div>
      <div class="form-group" style="margin:0"><label>Paid</label><div>${expenseMoney(inv.paid_amount || 0)}</div></div>
      <div class="form-group" style="margin:0"><label>Due</label><div><strong style="color:var(--c-danger)">${expenseMoney(inv.due_amount || 0)}</strong></div></div>
    </div>`;

  const amountEl = document.getElementById('sipAmount');
  if (amountEl) {
    const currentAmount = parseFloat(amountEl.value || 0);
    const due = parseFloat(inv.due_amount || 0) || 0;
    if (!(currentAmount > 0) || currentAmount > due) amountEl.value = due.toFixed(3);
    amountEl.max = String(due.toFixed(3));
  }
}

async function openSupplierInvoicePaymentModal(preselectPoId = null) {
  if (!can('expenses.create')) { toast('No permission to record supplier invoice payments', 'error'); return; }

  try {
    const [invoicesResp, methodsResp, poResp] = await Promise.all([
      apiFetch('/api/store/supplier-invoices'),
      apiFetch('/api/payment-methods').catch(() => []),
      apiFetch('/api/store/purchase-orders').catch(() => [])
    ]);

    let allInvoices = Array.isArray(invoicesResp) ? invoicesResp : [];
    if (!allInvoices.length && Array.isArray(poResp) && poResp.length) {
      allInvoices = poResp
        .filter((po) => parseInt(po.supplier_id, 10) > 0)
        .map((po) => {
          const total = parseFloat(po.total_cost || 0) || 0;
          const paid = parseFloat(po.paid_amount || 0) || 0;
          const due = parseFloat((po.due_amount !== undefined ? po.due_amount : Math.max(0, total - paid)) || 0) || 0;
          const paymentStatus = due <= 0.0005 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid');
          return {
            po_id: po.id,
            supplier_id: po.supplier_id,
            supplier_name: po.supplier_name || '-',
            invoice_number: String(po.invoice_number || '').trim() || `PO-${po.id}`,
            order_date: po.order_date || String(po.created_at || '').slice(0, 10),
            purchase_status: po.status || 'Pending',
            total_amount: parseFloat(total.toFixed(3)),
            paid_amount: parseFloat(paid.toFixed(3)),
            due_amount: parseFloat(due.toFixed(3)),
            payment_status: paymentStatus
          };
        });
    }

    const preferredId = preselectPoId ? parseInt(preselectPoId, 10) : 0;
    _supplierInvoiceCandidates = allInvoices.filter((inv) => {
      const due = parseFloat(inv && inv.due_amount || 0) || 0;
      if (due > 0.0005) return true;
      return preferredId > 0 && parseInt(inv && inv.po_id, 10) === preferredId;
    });
    if (!_supplierInvoiceCandidates.length) {
      toast('No unpaid supplier invoices found', 'error');
      return;
    }

    const paymentMethods = (Array.isArray(_expenseMeta.payment_methods) && _expenseMeta.payment_methods.length)
      ? _expenseMeta.payment_methods
      : (Array.isArray(methodsResp) ? methodsResp.filter((m) => m.active !== false).map((m) => m.name) : []);

    const invoiceOpts = _supplierInvoiceCandidates.map((inv) => `
      <option value="${inv.po_id}">${escHtml(`${inv.supplier_name || 'Supplier'} - ${inv.invoice_number || `PO-${inv.po_id}`} - Due ${expenseMoney(inv.due_amount || 0)}`)}</option>`).join('');
    const methodOpts = (paymentMethods.length ? paymentMethods : ['Cash']).map((name) => `<option value="${escHtml(name)}">${escHtml(name)}</option>`).join('');

    showModal('Pay Supplier Invoice', `
      <form id="sipForm">
        <div class="form-group">
          <label>Supplier Invoice *</label>
          <select id="sipInvoiceId" name="invoice_id" onchange="refreshSupplierInvoicePaymentMeta()" required>
            <option value="">- Select Invoice -</option>
            ${invoiceOpts}
          </select>
        </div>
        <div id="sipInvoiceMeta" class="alert" style="margin-bottom:10px"><div class="text-muted text-sm">Select an invoice to view due details.</div></div>
        <div class="form-row">
          <div class="form-group"><label>Payment Amount (KD) *</label><input id="sipAmount" name="amount" type="number" min="0.001" step="0.001" required/></div>
          <div class="form-group"><label>Payment Date *</label><input name="payment_date" type="date" value="${expenseTodayISO()}" required/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Payment Method</label><select name="payment_method">${methodOpts}</select></div>
          <div class="form-group"><label>Reference No</label><input name="reference_no" maxlength="80" placeholder="Receipt / transfer ref"/></div>
        </div>
        <div class="form-group"><label>Notes</label><input name="notes" maxlength="240" placeholder="Optional note"/></div>
      </form>`,
      async () => {
        const inv = selectedSupplierInvoiceForPayment();
        if (!inv) { toast('Select a supplier invoice', 'error'); return false; }

        const body = Object.fromEntries(new FormData(document.getElementById('sipForm')));
        body.amount = parseFloat(body.amount || 0);
        if (!(body.amount > 0)) { toast('Enter a valid payment amount', 'error'); return false; }
        const due = parseFloat(inv.due_amount || 0) || 0;
        if (body.amount - due > 0.0005) { toast(`Amount exceeds due (${expenseMoney(due)})`, 'error'); return false; }

        try {
          const result = await apiFetch(`/api/store/supplier-invoices/${inv.po_id}/payments`, {
            method: 'POST',
            body: JSON.stringify(body)
          });
          const dueAfter = parseFloat(result?.summary?.due_amount || 0) || 0;
          toast(`Payment recorded. Remaining due: ${expenseMoney(dueAfter)}`, 'success');
          closeModal();
          await loadExpenses();
          if (currentPageId === 'store-purchase') storePurchase();
        } catch (e) {
          toast(e.message || 'Failed to record payment', 'error');
          return false;
        }
      }
    );

    const selectEl = document.getElementById('sipInvoiceId');
    if (selectEl) {
      const preferred = preselectPoId && _supplierInvoiceCandidates.some((row) => parseInt(row.po_id, 10) === parseInt(preselectPoId, 10))
        ? String(preselectPoId)
        : String((_supplierInvoiceCandidates[0] || {}).po_id || '');
      selectEl.value = preferred;
      refreshSupplierInvoicePaymentMeta();
    }
  } catch (e) {
    toast(e.message || 'Failed to load supplier invoices', 'error');
  }
}

async function expenses() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar bill-action-bar">
      <div class="search-box">
        <input id="expenseSearch" placeholder="Search title, category, vendor, notes, ref..." onkeydown="if(event.key==='Enter') loadExpenses()" />
      </div>
      <div class="bill-filter-group">
        <input id="expenseDateFrom" type="date" value="${expenseMonthStartISO()}" onchange="loadExpenses()" title="From date"/>
        <input id="expenseDateTo" type="date" value="${expenseTodayISO()}" onchange="loadExpenses()" title="To date"/>
        <select id="expenseCategoryFilter" class="form-select" onchange="loadExpenses()">
          <option value="">All Categories</option>
        </select>
        <button class="btn" onclick="setExpensePreset('today')">Today</button>
        <button class="btn" onclick="setExpensePreset('month')">This Month</button>
        <button class="btn report-apply-btn" onclick="loadExpenses()">${IC.search} Apply</button>
      </div>
      <div class="bill-action-spacer"></div>
      ${can('expenses.create') ? `<button class="btn" onclick="openSupplierInvoicePaymentModal()">${IC.billing} Pay Supplier Invoice</button>` : ''}
      ${can('expenses.create') ? `<button class="btn btn-primary" onclick="openExpenseModal()">${IC.plus} New Expense</button>` : ''}
    </div>
    <div id="expenseSummary">${skeletonStats(4)}</div>
    <div id="expenseWrap">${skeletonTable(4)}</div>`;
  await loadExpenses();
}

async function loadExpenses() {
  const wrap = document.getElementById('expenseWrap');
  const summaryWrap = document.getElementById('expenseSummary');
  const search = document.getElementById('expenseSearch')?.value.trim() || '';
  const dateFrom = document.getElementById('expenseDateFrom')?.value || '';
  const dateTo = document.getElementById('expenseDateTo')?.value || '';
  const category = document.getElementById('expenseCategoryFilter')?.value || '';
  if (wrap) wrap.innerHTML = skeletonTable(4);
  if (summaryWrap) summaryWrap.innerHTML = skeletonStats(4);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (category) params.set('category', category);

  try {
    const data = await apiFetch(`/api/expenses${params.toString() ? `?${params.toString()}` : ''}`);
    _expenseRows = Array.isArray(data.rows) ? data.rows : [];
    _expenseMeta = {
      categories: Array.isArray(data.filters?.categories) ? data.filters.categories : [],
      payment_methods: Array.isArray(data.filters?.payment_methods) ? data.filters.payment_methods : []
    };

    const categoryEl = document.getElementById('expenseCategoryFilter');
    if (categoryEl) categoryEl.innerHTML = expenseCategoryOptions(category);

    renderExpenseSummary(data.summary || {});
    renderExpenseTable();
  } catch (e) {
    if (summaryWrap) summaryWrap.innerHTML = '';
    if (wrap) wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message || 'Failed to load expenses')}</div>`;
  }
}

function renderExpenseSummary(summary = {}) {
  const wrap = document.getElementById('expenseSummary');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">${IC.expense}</div>
        <div class="stat-content"><div class="stat-label">Filtered Expense</div><div class="stat-value">${expenseMoney(summary.total_amount || 0)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">${IC.calendar}</div>
        <div class="stat-content"><div class="stat-label">Today</div><div class="stat-value">${expenseMoney(summary.today_amount || 0)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">${IC.list}</div>
        <div class="stat-content"><div class="stat-label">Entries</div><div class="stat-value">${parseInt(summary.rows_count || 0, 10)}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">${IC.services}</div>
        <div class="stat-content"><div class="stat-label">Categories</div><div class="stat-value">${parseInt(summary.categories_count || 0, 10)}</div></div>
      </div>
    </div>`;
}

function renderExpenseTable() {
  const wrap = document.getElementById('expenseWrap');
  if (!wrap) return;
  if (!_expenseRows.length) {
    wrap.innerHTML = emptyState(IC.expense, 'No expenses found', 'Create your first day-to-day expense or change the filters.');
    return;
  }

  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Amount</th><th>Paid Via</th><th>Vendor / Ref</th><th>Updated By</th><th>Actions</th></tr></thead>
    <tbody>${_expenseRows.map((row) => {
      const vendorBits = [row.vendor, row.reference_no ? `Ref: ${row.reference_no}` : ''].filter(Boolean);
      const canEditRow = can('expenses.edit');
      const canDeleteRow = can('expenses.delete');
      return `<tr>
        <td><strong>${escHtml(row.expense_date || '-')}</strong><div class="text-muted text-sm">${escHtml(formatDateTime(row.created_at || ''))}</div></td>
        <td><strong>${escHtml(row.title || '-')}</strong>${row.notes ? `<div class="text-muted text-sm expense-notes-cell">${escHtml(row.notes)}</div>` : ''}</td>
        <td><span class="badge badge-secondary">${escHtml(row.category || '-')}</span></td>
        <td><strong class="expense-amount">${expenseMoney(row.amount || 0)}</strong></td>
        <td>${escHtml(row.payment_method || '-')}</td>
        <td>${vendorBits.length ? vendorBits.map((item) => `<div>${escHtml(item)}</div>`).join('') : '-'}</td>
        <td>${escHtml(row.updated_by_name || row.created_by_name || '-')}<div class="text-muted text-sm">${escHtml(formatDateTime(row.updated_at || row.created_at || ''))}</div></td>
        <td class="td-actions">
          ${canEditRow ? `<button class="btn btn-sm" onclick="openExpenseModal(${row.id})">${IC.edit}</button>` : ''}
          ${canDeleteRow ? `<button class="btn btn-sm" style="color:#e57373" onclick="deleteExpense(${row.id})">${IC.trash}</button>` : ''}
          ${!canEditRow && !canDeleteRow ? '-' : ''}
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

async function openExpenseModal(id = null) {
  if (!_expenseMeta.categories.length) {
    toast('Add expense categories first in Setup master', 'error');
    return;
  }
  let entry = {
    title: '',
    category: '',
    amount: '',
    expense_date: expenseTodayISO(),
    payment_method: '',
    vendor: '',
    reference_no: '',
    notes: ''
  };
  if (id != null) {
    const found = _expenseRows.find((row) => parseInt(row.id, 10) === parseInt(id, 10));
    if (!found) { toast('Expense not found', 'error'); return; }
    entry = { ...entry, ...found };
  }

  showModal(id != null ? `Edit Expense - ${escHtml(entry.title || '')}` : 'New Expense', `
    <form id="expenseForm">
      <div class="form-row">
        <div class="form-group"><label>Expense Title *</label><input name="title" maxlength="120" value="${escHtml(entry.title || '')}" placeholder="e.g. Tea for staff, Courier, Petrol" required /></div>
        <div class="form-group"><label>Category *</label><select name="category" required>${expenseCategorySelectOptions(entry.category || '', 'Select Category')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Amount (KD) *</label><input name="amount" type="number" min="0.001" step="0.001" value="${escHtml(String(entry.amount || ''))}" required /></div>
        <div class="form-group"><label>Expense Date *</label><input name="expense_date" type="date" value="${escHtml(entry.expense_date || expenseTodayISO())}" required /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Paid Via</label><input name="payment_method" list="expensePaymentMethodList" maxlength="60" value="${escHtml(entry.payment_method || '')}" placeholder="Cash, Card, Bank Transfer" /></div>
        <div class="form-group"><label>Vendor / Payee</label><input name="vendor" maxlength="120" value="${escHtml(entry.vendor || '')}" placeholder="Optional" /></div>
      </div>
      <datalist id="expensePaymentMethodList">${expensePaymentDatalistOptions()}</datalist>
      <div class="form-row">
        <div class="form-group"><label>Reference No</label><input name="reference_no" maxlength="80" value="${escHtml(entry.reference_no || '')}" placeholder="Invoice / receipt no" /></div>
        <div class="form-group"><label>Notes</label><input name="notes" maxlength="240" value="${escHtml(entry.notes || '')}" placeholder="Optional note" /></div>
      </div>
    </form>`,
    async () => {
      const form = document.getElementById('expenseForm');
      const body = Object.fromEntries(new FormData(form));
      body.amount = parseFloat(body.amount || 0);
      if (!String(body.title || '').trim()) { toast('Expense title is required', 'error'); return false; }
      if (!String(body.category || '').trim()) { toast('Expense category is required', 'error'); return false; }
      if (!(body.amount > 0)) { toast('Amount must be greater than 0', 'error'); return false; }
      try {
        if (id != null) await apiFetch(`/api/expenses/${id}`, { method:'PUT', body: JSON.stringify(body) });
        else await apiFetch('/api/expenses', { method:'POST', body: JSON.stringify(body) });
        toast(id != null ? 'Expense updated' : 'Expense recorded', 'success');
        closeModal();
        await loadExpenses();
      } catch (e) {
        toast(e.message || 'Failed to save expense', 'error');
        return false;
      }
    });
}

async function deleteExpense(id) {
  const row = _expenseRows.find((item) => parseInt(item.id, 10) === parseInt(id, 10));
  const title = row && row.title ? row.title : `#${id}`;
  if (!await confirmDialog(`Delete expense "${title}"?`)) return;
  try {
    await apiFetch(`/api/expenses/${id}`, { method:'DELETE' });
    toast('Expense deleted', 'success');
    await loadExpenses();
  } catch (e) {
    toast(e.message || 'Failed to delete expense', 'error');
  }
}

// --------------------------------------------------------
//  BILLING
// --------------------------------------------------------
let _billingAll = [];
function _sortPkgSessionLogs(logs = []) {
  return [...logs].sort((a, z) => {
    const ai = parseInt(a && a.bill_id || 0) || 0;
    const zi = parseInt(z && z.bill_id || 0) || 0;
    if (ai && zi && ai !== zi) return ai - zi;
    return String(a && a.date || '').localeCompare(String(z && z.date || ''));
  });
}
function _normPkgText(v) {
  return String(v || '').toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[-x]\s*\d+(?:\.\d+)?/g, '').replace(/\s+/g, ' ').trim();
}
function resolvePkgSessionServiceId(item, patientPackage) {
  const sid = parseInt(item && item.service_id);
  if (sid) return sid;
  if (!patientPackage || !Array.isArray(patientPackage.services)) return 0;
  const nameNorm = _normPkgText(item && item.name);
  if (!nameNorm) return 0;
  const hit = patientPackage.services.find(s => {
    const svcNorm = _normPkgText(s && (s.service_name || s.name));
    return svcNorm && (nameNorm.includes(svcNorm) || svcNorm.includes(nameNorm));
  });
  return hit ? (parseInt(hit.service_id) || 0) : 0;
}
function getPkgSessionPackageForItem(item, bill, pkgByRefId, patientPackages = []) {
  const refId = parseInt(item && item.ref_id);
  if (refId && pkgByRefId && pkgByRefId.get(refId)) return pkgByRefId.get(refId);
  const billId = parseInt(bill && bill.id || 0) || 0;
  if (!billId || !Array.isArray(patientPackages) || !patientPackages.length) return null;
  const sid = parseInt(item && item.service_id) || 0;
  const nameNorm = _normPkgText(item && item.name);
  const candidates = patientPackages.filter(pp => Array.isArray(pp.session_log) && pp.session_log.some(log => parseInt(log && log.bill_id || 0) === billId));
  if (!candidates.length) return null;
  if (sid) {
    const bySid = candidates.find(pp => Array.isArray(pp.services) && pp.services.some(s => parseInt(s.service_id) === sid));
    if (bySid) return bySid;
  }
  if (nameNorm) {
    const byName = candidates.find(pp => Array.isArray(pp.services) && pp.services.some(s => {
      const svcNorm = _normPkgText(s && (s.service_name || s.name));
      return svcNorm && (nameNorm.includes(svcNorm) || svcNorm.includes(nameNorm));
    }));
    if (byName) return byName;
  }
  return candidates[0] || null;
}
function getPkgSessionProgressLabel(item, bill, patientPackage) {
  if (!item || !bill || !patientPackage || !Array.isArray(patientPackage.services)) return '';
  const sid = resolvePkgSessionServiceId(item, patientPackage);
  if (!sid) return '';
  const svc = patientPackage.services.find(s => parseInt(s.service_id) === sid);
  const totalSessions = svc ? (parseInt(svc.total || 0) || 0) : 0;
  if (!(totalSessions > 0)) return '';
  const billId = parseInt(bill.id || 0) || 0;
  const billDate = String(bill.created_at || '').slice(0, 10);
  const qtyThisBill = Math.max(1, parseInt(item.qty || item.quantity || 1) || 1);
  let usedBefore = 0;
  const logs = _sortPkgSessionLogs(Array.isArray(patientPackage.session_log) ? patientPackage.session_log : []);
  const logQtyForService = (log) => {
    const quantities = log && log.quantities ? log.quantities : {};
    const key = String(sid);
    const q = parseInt(quantities[key] != null ? quantities[key] : quantities[sid]);
    if (q > 0) return q;
    if (Array.isArray(log && log.service_ids) && log.service_ids.map(Number).includes(sid)) return 1;
    return 0;
  };
  for (const log of logs) {
    const logBillId = parseInt(log && log.bill_id || 0) || 0;
    const logDate = String(log && log.date || '').slice(0, 10);
    const isBefore = (billId && logBillId) ? (logBillId < billId) : (billDate && logDate ? logDate < billDate : false);
    if (isBefore) usedBefore += logQtyForService(log);
  }
  const startSession = Math.min(totalSessions, usedBefore + 1);
  const endSession = Math.min(totalSessions, usedBefore + qtyThisBill);
  const usedAfter = Math.min(totalSessions, usedBefore + qtyThisBill);
  const leftAfter = Math.max(0, totalSessions - usedAfter);
  const base = qtyThisBill > 1 && endSession > startSession
    ? `Sessions ${startSession}-${endSession} of ${totalSessions}`
    : `Session ${endSession} of ${totalSessions}`;
  return `${base} - Used ${usedAfter}/${totalSessions} - Left ${leftAfter}`;
}
function getPackageUsageDetailLabel(item, bill, patientPackages = []) {
  if (!item || item.type !== 'package' || !bill) return '';
  const pkgId = parseInt(item.ref_id || 0) || 0;
  const billId = parseInt(bill.id || 0) || 0;
  const selectedIds = Array.isArray(item.selected_service_ids) ? item.selected_service_ids.map(Number) : [];
  const candidates = (Array.isArray(patientPackages) ? patientPackages : []).filter(pp => {
    const sameBill = billId && parseInt(pp && pp.bill_id || 0) === billId;
    const samePkg = pkgId && parseInt(pp && pp.package_id || 0) === pkgId;
    const byName = !samePkg && String(pp && pp.package_name || '').trim() && String(item.package_name || item.name || '').includes(String(pp.package_name || '').trim());
    return sameBill && (samePkg || byName);
  });
  const pp = candidates[0];
  if (!pp || !Array.isArray(pp.services) || !pp.services.length) return '';
  const rows = pp.services
    .filter(s => (parseInt(s.total || 0) || 0) > 0)
    .map(s => {
      const used = parseInt(s.used || 0) || 0;
      const total = parseInt(s.total || 0) || 0;
      if (!(total > 0)) return '';
      const left = Math.max(0, total - used);
      const nm = s.service_name || `Service #${s.service_id}`;
      const sid = parseInt(s.service_id || 0) || 0;
      const selectedMark = selectedIds.length && sid && selectedIds.includes(sid) ? ' (this visit)' : '';
      return `${nm}${selectedMark}: Used ${used}/${total}, Left ${left}`;
    })
    .filter(Boolean);
  return rows.join(' - ');
}
async function enrichBillingPkgSessionProgress(list) {
  const bills = Array.isArray(list) ? list : [];
  const billsWithPackages = bills.filter(b => (Array.isArray(b && b.line_items) ? b.line_items : []).some(it => it && (it.type === 'pkg_session' || it.type === 'package')));
  const patientIds = [...new Set(billsWithPackages.map(b => parseInt(b && b.patient_id)).filter(Boolean))];

  const patientPkgCache = new Map();
  if (patientIds.length) {
    const rowsByPatient = await Promise.all(patientIds.map(pid => apiFetch(`/api/patient-packages?patient_id=${pid}`).catch(() => [])));
    patientIds.forEach((pid, idx) => {
      const rows = Array.isArray(rowsByPatient[idx]) ? rowsByPatient[idx] : [];
      patientPkgCache.set(pid, rows);
    });
  }

  const byPkgId = new Map();
  patientPkgCache.forEach(rows => {
    (Array.isArray(rows) ? rows : []).forEach(pp => {
      const id = parseInt(pp && pp.id);
      if (id) byPkgId.set(id, pp);
    });
  });

  for (const b of billsWithPackages) {
    const pid = parseInt(b && b.patient_id);
    const patientPkgs = pid ? (patientPkgCache.get(pid) || []) : [];
    (Array.isArray(b.line_items) ? b.line_items : []).forEach(it => {
      if (!it) return;
      if (it.type === 'pkg_session') {
        const pp = byPkgId.get(parseInt(it.ref_id || 0)) || getPkgSessionPackageForItem(it, b, byPkgId, patientPkgs);
        const label = getPkgSessionProgressLabel(it, b, pp);
        if (label) it.session_progress_label = label;
        return;
      }
      if (it.type === 'package') {
        const usageLabel = getPackageUsageDetailLabel(it, b, patientPkgs);
        if (usageLabel) it.package_usage_label = usageLabel;
      }
    });
  }
}
async function billing() {
  const ca = document.getElementById('contentArea');
  const todayStr = new Date().toLocaleDateString('sv');
  ca.innerHTML = `
    <div class="page-hero compact">
      <div>
        <h2 class="page-hero-title">Billing Workstation</h2>
        <p class="page-hero-sub">POS-like workflow with live totals and quick collections.</p>
      </div>
    </div>

    <div class="action-bar bill-action-bar">
      <div class="search-box"><input id="billSearch" type="text" placeholder="Search bill no, visit ID, patient, MR #..." oninput="filterBills()"/></div>
      <div class="bill-filter-group">
        <input id="billDateFrom" type="date" value="${todayStr}" title="From date"/>
        <input id="billDateTo" type="date" value="${todayStr}" title="To date"/>
        <button class="btn report-apply-btn" onclick="filterBills()">${IC.search} Filter</button>
        <button class="btn report-clear-btn" onclick="clearBillFilters()">Clear</button>
      </div>
      <div class="bill-action-spacer"></div>
      ${can('billing.create') ? `<button class="btn btn-primary" onclick="openBillModal()">${IC.plus} New Bill</button>` : ''}
      <div class="bill-vt-wrap">${viewToggleHTML('billing')}</div>
    </div>
    <div id="billTopStats" class="kpi-mini-grid"></div>
    <div id="billWrap">${skeletonTable(5)}</div>`;
  setTimeout(() => focusPrimarySearch(), 100);
  try {
    _billingAll = await apiFetch('/api/bills');
    renderBillTopStats(_billingAll);
    filterBills();
    enrichBillingPkgSessionProgress(_billingAll)
      .then(() => {
        // Repaint once labels are enriched, without blocking initial render.
        filterBills();
      })
      .catch(() => {});
  } catch(e) {
  }
}
function renderBillTopStats(rows) {
  const el = document.getElementById('billTopStats');
  if (!el) return;
  const list = Array.isArray(rows) ? rows : [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todays = list.filter(b => String(b.created_at || '').slice(0, 10) === todayStr);
  const collected = todays.reduce((sum, b) => sum + parseFloat(b.total || 0), 0);
  const pending = todays.filter(b => String(b.payment_status || '') === 'Pending').length;
  const paid = todays.filter(b => String(b.payment_status || '') === 'Paid').length;
  el.innerHTML = `
    <div class="kpi-mini"><span>Today's Bills</span><strong>${todays.length}</strong></div>
    <div class="kpi-mini"><span>Collected</span><strong>KD ${collected.toFixed(3)}</strong></div>
    <div class="kpi-mini"><span>Pending</span><strong>${pending}</strong></div>
    <div class="kpi-mini"><span>Paid</span><strong>${paid}</strong></div>`;
}
function clearBillFilters() {
  const todayStr = new Date().toLocaleDateString('sv');
  const f = document.getElementById('billDateFrom');
  const t = document.getElementById('billDateTo');
  const s = document.getElementById('billSearch');
  if (f) f.value = todayStr;
  if (t) t.value = todayStr;
  if (s) s.value = '';
  filterBills();
}
function filterBills() {
  const q = (document.getElementById('billSearch')?.value || '').toLowerCase().trim();
  const from = document.getElementById('billDateFrom')?.value || '';
  const to = document.getElementById('billDateTo')?.value || '';
  const filtered = (_billingAll || []).filter(b => {
    const textMatch = !q || [
      b.bill_number,
      b.visit_id,
      b.patient_name,
      b.doctor_name,
      b.mr_number,
      b.patient_phone,
      b.payment_method,
      b.payment_status,
      b.created_at
    ].map(v => String(v || '').toLowerCase()).some(v => v.includes(q));
    const billDate = String(b.created_at || '').slice(0,10);
    const fromOk = !from || (billDate && billDate >= from);
    const toOk = !to || (billDate && billDate <= to);
    return textMatch && fromOk && toOk;
  });
  renderBillingRows(filtered);
}
function renderBillingRows(list) {
  const wrap = document.getElementById('billWrap');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.billing, 'No bills found', 'Try a different search or create a new bill'); return; }
  wrap.innerHTML = `<div class="table-wrap billing-table-wrap"><table class="billing-table">
      <thead><tr><th>#</th><th>Bill No.</th><th>Visit ID</th><th>MR #</th><th>Patient</th><th>Doctor</th><th>Items</th><th>Total</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${list.map((b,i) => {
        const itemLabel = (l) => {
          const pkg = l.package_name && !String(l.name || '').includes(String(l.package_name)) ? ` [${l.package_name}]` : '';
          const prog = l.type === 'pkg_session' && l.session_progress_label ? ` (${l.session_progress_label})` : '';
          const pkgUsage = l.type === 'package' && l.package_usage_label ? ` (${l.package_usage_label})` : '';
          return escHtml(`${l.name || ''}${pkg}${prog}${pkgUsage}`.trim());
        };
        const itemsFullSummary = b.line_items && b.line_items.length
          ? b.line_items.map(l=>itemLabel(l)).join(', ')
          : [b.consultation_fee?`Consult KD ${b.consultation_fee}`:'', b.medicine_charge?`Meds KD ${b.medicine_charge}`:'', b.other_charges?`Other KD ${b.other_charges}`:''].filter(Boolean).join(', ')||'-';
        const itemsSummary = b.line_items && b.line_items.length
          ? b.line_items.slice(0,2).map(l=>itemLabel(l)).join(', ') + (b.line_items.length>2?` +${b.line_items.length-2} more`: '')
          : [b.consultation_fee?`Consult KD ${b.consultation_fee}`:'', b.medicine_charge?`Meds KD ${b.medicine_charge}`:'', b.other_charges?`Other KD ${b.other_charges}`:''].filter(Boolean).join(', ')||'-';
        return `<tr class="billing-row">
          <td><span class="billing-index">${i+1}</span></td>
          <td><span class="code-id code-id-primary">${escHtml(b.bill_number||'-')}</span></td>
          <td><span class="code-id code-id-primary">${escHtml(b.visit_id||'-')}</span></td>
          <td><span class="code-id code-id-primary">${escHtml(b.mr_number||'-')}</span></td>
          <td>
            <div class="billing-patient-cell">
              <span class="billing-patient-avatar">${escHtml((b.patient_name||'?').charAt(0).toUpperCase())}</span>
              <div class="billing-patient-info">
                <strong class="billing-patient">${escHtml(b.patient_name||'-')}</strong>
                ${b.doctor_name ? `<span class="billing-patient-doctor">${escHtml(b.doctor_name)}</span>` : ''}
              </div>
            </div>
          </td>
          <td>${escHtml(b.doctor_name || '-')}</td>
          <td class="text-muted text-sm billing-items-cell" title="${itemsFullSummary}">${itemsSummary}</td>
          <td><strong class="billing-total">KD ${b.total}</strong></td>
          <td>${(b.payment_splits && b.payment_splits.length > 1)
            ? `<div class="billing-splits">${b.payment_splits.map(s=>`<span class="billing-split-chip">${escHtml(s.method)} KD ${parseFloat(s.amount).toFixed(3)}</span>`).join('')}</div>`
            : escHtml(b.payment_method)}</td>
          <td>
            <span class="status-badges-wrap">
              ${statusBadge(b.payment_status)}
              ${(Number(b.discount_amount) > 0) ? `<span class="badge badge-discounted">${IC.discount} Discounted</span>` : ''}
            </span>
          </td>
          <td class="text-muted text-sm">${escHtml(formatDateTime(b.created_at||''))}</td>
          <td class="td-actions">
            <div class="billing-actions">
              <div class="billing-actions-top">
                <button class="btn btn-sm" onclick="viewBillModal(${b.id})" title="View details">${IC.eye}</button>
                ${can('billing.edit') && !['Refunded','Partially Refunded','Cancelled'].includes(String(b.payment_status || '')) ? `<button class="btn btn-sm" onclick="openEditBillModal(${b.id})">${IC.edit}</button>` : ''}
                ${canPrintBill(b.created_at) ? `<button class="btn btn-sm" onclick="printBill(${b.id})">${IC.print}</button>` : ''}
                ${b.payment_status === 'Pending' ? `<button class="btn btn-success btn-sm" onclick="markBillPaid(${b.id})">${IC.check} Paid</button>` : ''}
              </div>
              <div class="billing-actions-bottom">
                ${b.payment_status === 'Paid' && can('billing.refund.initiate') ? `<button class="btn btn-sm" style="color:#e57373" onclick="openRefundModal(${b.id})" title="Refund">${IC.refund} Refund</button>` : ''}
                ${can('billing.delete') && !['Refunded','Partially Refunded','Cancelled'].includes(String(b.payment_status || '')) ? `<button class="btn btn-sm" style="color:#c62828" onclick="openCancelBillModal(${b.id})" title="Cancel Bill">${IC.x} Cancel</button>` : ''}
              </div>
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  applyViewPref('billing', '#billWrap');
}

let _billLineItems = [];
let _billPkgSessions = [];
let _billPaymentMode = 'full';

// ----------------------------------------------------------------
// Add extra services to an existing bill (from Dr Scheduler)
// ----------------------------------------------------------------
async function openAddServicesToBillModal(aptId, patientId, patientName) {
  _billPaymentMode = 'newOnly';
  // Find the bill linked to this appointment
  let bills = [];
  try { bills = await apiFetch(`/api/bills?appointment_id=${aptId}`); } catch {}
  if (!bills || !bills.length) {
    toast('No bill found for this appointment', 'error'); return;
  }
  const bill = bills[0]; // use most recent
  const billId = bill.id;

  // Locked items = already billed, cannot be removed
  const lockedItems = Array.isArray(bill.line_items) ? bill.line_items.map(i => ({ ...i, _locked: true })) : [];
  _billLineItems = [...lockedItems];
  _billPkgSessions = [];

  const [pms, svcs, pkgs, docs, discountsRaw] = await Promise.all([
    apiFetch('/api/payment-methods').catch(()=>[]),
    apiFetch('/api/services').catch(()=>[]),
    apiFetch('/api/packages').catch(()=>[]),
    apiFetch('/api/doctors').catch(()=>[]),
    apiFetch('/api/discounts').catch(()=>[]),
  ]);
  const [productsRaw, stockRaw, subStoresRaw] = await Promise.all([
    apiFetch('/api/store/products').catch(()=>[]),
    apiFetch('/api/store/stock').catch(()=>[]),
    apiFetch('/api/store/sub-stores').catch(()=>[]),
  ]);
  const payMethods = (pms||[]).filter(m=>m.active).map(m=>m.name);
  if (!payMethods.length) payMethods.push('Cash','Card','UPI','Online');
  window._billPayMethods = payMethods;
  window._billServices = (svcs||[]).filter(s=>s.active);
  window._billPackages = (pkgs||[]).filter(p=>p.active);
  const configuredBillingStoreId = parseInt(currentSystem?.clinic?.billing_store_id || '', 10);
  const mainStore = (subStoresRaw || []).find(s => parseInt(s.id,10) === configuredBillingStoreId && s.active !== false)
    || (subStoresRaw || []).find(s => s.is_main)
    || (subStoresRaw || [])[0] || null;
  const productStockById = (stockRaw || [])
    .filter(s => !mainStore || parseInt(s.store_id) === parseInt(mainStore.id))
    .reduce((acc,s) => { const pid = parseInt(s.product_id); acc[pid]=(acc[pid]||0)+(parseFloat(s.qty||0)||0); return acc; }, {});
  window._billProducts = (productsRaw||[]).filter(p=>p.active!==false)
    .map(p=>({...p, current_stock: parseFloat((productStockById[parseInt(p.id)]||0).toFixed(3))}));
  window._billProductQtyMap = {};
  const billDoctors = (docs||[]).filter(d=>d.active!==false);

  showModal(`Add Services - ${escHtml(patientName)} - ${escHtml(bill.bill_number||'#'+billId)}`, `
    <div class="bill-layout">
      <div class="bill-left">
        <div class="bill-patient-row">
          <div class="bill-patient-fixed"><span class="bill-patient-name-badge">${escHtml(patientName)}</span></div>
          <input type="hidden" name="patient_id" value="${patientId}"/>
          <input type="hidden" name="appointment_id" value="${aptId}"/>
        </div>
        <div class="bill-amend-note">
          <span class="bill-amend-note-icon">${IC.billing}</span>
          <span class="bill-amend-note-text">Adding to existing bill <strong>${escHtml(bill.bill_number||'#'+billId)}</strong> - Previously billed items are locked.</span>
        </div>
        <div class="bill-tabs">
          <button type="button" class="bill-tab active" onclick="billSwitchTab('services',this)">${IC.services||''} Services</button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('packages',this)">${IC.packages||''} Packages</button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('products',this)">${IC.product||''} Products</button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('custom',this)">+ Custom</button>
        </div>
        <div id="billTab-services" class="bill-tab-panel">
          <div class="bill-search-row">${IC.search}<input id="billSvcSearch" placeholder="Search services..." oninput="billFilterServices(this.value)"/><select id="billSvcCategoryFilter" style="width:auto;min-width:170px" onchange="billFilterServices(document.getElementById('billSvcSearch')?.value || '')">${billServiceGroupOptionsHtml()}</select></div>
          ${window._billServices.length
            ? `<div class="bill-svc-grid" id="billSvcGrid">${window._billServices.map(s=>`
              <label class="bill-svc-card" data-svc-id="${s.id}">
                <input type="checkbox" data-svc-id="${s.id}" onchange="billToggleService(${s.id})" style="display:none"/>
                <span class="bill-svc-card-check">&#10003;</span>
                <div class="bill-svc-card-body"><span class="bill-svc-card-name">${escHtml(s.name)}</span><span class="bill-svc-card-cat">${escHtml(s.category)}</span></div>
                <span class="bill-svc-card-price">KD ${s.price.toFixed(3)}</span>
              </label>`).join('')}</div>`
            : '<p class="text-muted text-sm p-2">No active services</p>'}
        </div>
        <div id="billTab-packages" class="bill-tab-panel" style="display:none">
          <div class="bill-search-row">${IC.search}<input id="billPkgSearch" placeholder="Search packages..." oninput="billFilterPackages(this.value)"/></div>
          ${window._billPackages.length
            ? `<div class="bill-pkg-list" id="billPkgList">${window._billPackages.map(p=>`
              <div class="bill-pkg-card" id="billPkgCard-${p.id}" data-pkg-name="${escHtml(p.name).toLowerCase()}">
                <label class="bill-pkg-card-header" onclick="event.preventDefault();billTogglePackage(${p.id})">
                  <div class="bill-pkg-card-check-wrap">
                    <span class="bill-pkg-card-checkbox" id="billPkgCb-${p.id}"></span>
                  </div>
                  <div class="bill-pkg-card-info">
                    <span class="bill-pkg-card-name">${escHtml(p.name)}</span>
                    <span class="bill-pkg-card-svcs">${(p.services||[]).map(s=>escHtml(s.name)+((s.total||1)>1?` -${s.total}`:'')).join(' - ')}</span>
                  </div>
                  <div class="bill-pkg-card-right">
                    <span class="bill-pkg-card-price">KD ${(p.discount_price||0).toFixed(3)}</span>
                    <span class="bill-pkg-card-count">${(p.services||[]).reduce((t,s)=>t+(s.total||1),0)} sessions</span>
                  </div>
                </label>
                <div class="bill-pkg-svc-picker" id="pkgSvcPicker-${p.id}" style="display:none">
                  <div class="bill-pkg-svc-picker-label">Select services for this visit</div>
                  <div class="bill-pkg-svc-grid">
                    ${(p.services||[]).map(s=>`
                    <label class="bill-pkg-svc-tile bill-pkg-svc-tile-sel">
                      <input type="checkbox" data-pkg-svc="${p.id}" data-svc="${s.service_id}" style="display:none" onchange="billUpdatePackageServices(${p.id})"/>
                      <span class="bill-pkg-svc-tile-name">${escHtml(s.name)}${(s.total||1)>1?` <span class='text-muted' style='font-size:11px'>-${s.total} sessions</span>`:''}</span>
                      <span class="bill-pkg-svc-tile-check">&#10003;</span>
                    </label>`).join('')}
                  </div>
                </div>
              </div>`).join('')}</div>`
            : '<p class="text-muted text-sm p-2">No active packages</p>'}
        </div>
        <div id="billTab-products" class="bill-tab-panel" style="display:none">
          <div class="bill-search-row">${IC.search}<input id="billProdSearch" placeholder="Search products..." oninput="billFilterProducts(this.value)"/></div>
          ${window._billProducts.length
            ? `<div class="bill-svc-grid" id="billProdGrid">${window._billProducts.map(p=>`
              <div class="bill-svc-card bill-prod-card" data-prod-id="${p.id}">
                <span class="bill-prod-badge">${IC.product||'Product'}</span>
                <div class="bill-svc-card-body"><span class="bill-svc-card-name">${escHtml(p.name)}</span><span class="bill-svc-card-cat">Stock: ${parseFloat(p.current_stock||0).toFixed(3)}</span></div>
                <span class="bill-svc-card-price">KD ${parseFloat(p.sell_price||0).toFixed(3)}</span>
                <div class="bill-prod-actions"><div class="num-stepper bill-prod-stepper">
                  <button type="button" class="num-step-btn" onclick="billChangeProductQty(${p.id},-1)">-</button>
                  <input id="billProdQty-${p.id}" type="number" min="1" step="1" value="1" oninput="billNormalizeProductQty(${p.id})"/>
                  <button type="button" class="num-step-btn" onclick="billChangeProductQty(${p.id},1)">+</button>
                </div><button type="button" class="btn btn-sm bill-prod-add-btn" onclick="billAddOrUpdateProduct(${p.id})">Add</button></div>
              </div>`).join('')}</div>`
            : '<p class="text-muted text-sm p-2">No active products</p>'}
        </div>
        <div id="billTab-custom" class="bill-tab-panel" style="display:none">
          <div class="bill-custom-modern">
            <div class="bill-custom-modern-fields">
              <input id="customItemName" class="bill-custom-desc" placeholder="Item description"/>
              <div class="num-stepper bill-custom-amt"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input id="customItemAmt" type="number" min="0" step="0.001" placeholder="Amount (KD)"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div>
            </div>
            <button type="button" class="btn btn-primary" onclick="billAddCustomItem()">${IC.plus} Add Item</button>
          </div>
        </div>
      </div>
      <div class="bill-right">
        <div class="bill-items-section">
          <div class="bill-items-header">Items</div>
          <div id="billItemsList" class="bill-items-list"></div>
          <div class="bill-total-row"><span>Total</span><strong id="billTotalAmt">KD 0.000</strong></div>
          <div id="billDiscountRow" class="bill-total-row" style="display:none;color:var(--c-success)"><span id="billDiscLabelDisplay">Discount</span><strong>-KD <span id="billDiscAmtDisplay">0.000</span></strong></div>
          <div id="billNetTotalRow" class="bill-total-row" style="display:none;margin-top:6px"><span>Net Total</span><strong id="billNetTotalAmt">KD 0.000</strong></div>
        </div>
        <div id="billSplitWrap">
          <div class="bill-split-header"><span>Payment for New Items</span><span id="billSplitBalance" class="bill-split-balance"></span></div>
          <div id="billSplitRows"></div>
          <button type="button" class="bill-split-add-btn" onclick="billAddSplitRow()">${IC.plus} Add Payment Method</button>
          <div id="billAutoPaidNote" style="display:none;font-size:12px;color:var(--text-muted);margin-top:4px">Auto-marked Paid (zero amount)</div>
        </div>
        <div class="bill-doctor-row">
          <label>Doctor</label>
          <select name="doctor_id" id="billDoctorId" class="bill-doctor-select">
            <option value="">- Select doctor -</option>
            ${billDoctors.map(d=>`<option value="${d.id}" ${String(d.id)===String(bill.doctor_id)?'selected':''}>${escHtml(doctorDisplayName(d))}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <input type="hidden" name="patient_id" id="billPatientId2" value="${patientId}"/>`,
    async () => {
      const newItems = _billLineItems.filter(i => !i._locked);
      if (!newItems.length) { toast('Please add at least one new item', 'error'); return false; }
      const allItems = _billLineItems.map(({_locked, ...rest}) => rest);
      // collect payment splits for the new items
      let splits = [];
      document.querySelectorAll('.bill-split-row').forEach(row => {
        const method = row.querySelector('.bsplit-method')?.value;
        const amt = parseFloat(row.querySelector('.bsplit-amt')?.value) || 0;
        if (method && amt > 0) splits.push({ method, amount: amt });
      });
      const newTotal = newItems.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
      const splitsTotal = splits.reduce((a,s)=>a+s.amount,0);
      if (newTotal > 0 && Math.abs(splitsTotal - newTotal) > 0.01) {
        toast(`Payment splits (KD ${splitsTotal.toFixed(3)}) must equal new items total (KD ${newTotal.toFixed(3)})`, 'error'); return false;
      }
      // Merge existing payment_splits with new ones; normalize older bills that only had payment_method.
      const oldItemsTotal = _billLineItems
        .filter(i => i._locked)
        .reduce((s,i)=>s + (parseFloat(i.amount)||0), 0);
      let existingSplits = Array.isArray(bill.payment_splits)
        ? bill.payment_splits
            .map(s => ({ method: s.method, amount: parseFloat(s.amount)||0 }))
            .filter(s => s.method && s.amount > 0)
        : [];
      if (!existingSplits.length && bill.payment_method && oldItemsTotal > 0 && String(bill.payment_status || '') === 'Paid') {
        existingSplits = [{ method: bill.payment_method, amount: parseFloat(oldItemsTotal.toFixed(3)) }];
      }
      const mergedSplits = [...existingSplits, ...splits];
      const grandTotal = allItems.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
      const allPaid = mergedSplits.reduce((s,sp)=>s+(parseFloat(sp.amount)||0),0);
      const newPayStatus = (grandTotal === 0 || Math.abs(allPaid - grandTotal) < 0.01) ? 'Paid' : 'Pending';
      try {
        await apiFetch(`/api/bills/${billId}`, {
          method: 'PUT',
          body: JSON.stringify({
            line_items: allItems,
            payment_splits: mergedSplits,
            payment_status: newPayStatus
          })
        });
        toast('Services added to bill', 'success');
        closeModal();
        if (currentPageId === 'scheduler') scheduler();
      } catch(e) { toast(e.message, 'error'); return false; }
    }, 'modal-bill');
  setTimeout(() => {
    renderBillItemsList();
    if (window._checkBillPaymentUI) window._checkBillPaymentUI();
  }, 0);
}

async function openBillModal(prePatientId = null, preAptId = null) {
  _billPaymentMode = 'full';
  showBillLoadingModal(preAptId ? 'Opening billing for appointment...' : 'Loading billing details...');
  // If patient came via quick register, check for missing mandatory info first
  let prePatient = null;
  if (prePatientId) {
    try {
      prePatient = await apiFetch(`/api/patients/${prePatientId}`);
      const missing = [];
      if (!prePatient.age)      missing.push('Age');
      if (!prePatient.gender)   missing.push('Gender');
      if (!prePatient.civil_id) missing.push('Civil ID');
      if (!prePatient.dob)      missing.push('Date of Birth');
      if (missing.length) {
        const proceed = await new Promise(resolve => {
          showModal(`Complete Patient Profile - ${escHtml(prePatient.name)}`, `
            <div class="alert" style="background:var(--c-warning,#f59e0b)22;border:1px solid var(--c-warning,#f59e0b);border-radius:8px;padding:12px;margin-bottom:16px;color:var(--text)">
              <strong>Missing required information:</strong> ${missing.join(', ')}<br>
              <span class="text-sm text-muted">Please complete these fields before creating a bill.</span>
            </div>
            <form id="completePatientForm">
              <div class="form-row">
                <div class="form-group"><label>Civil ID <span style="color:var(--c-danger)">*</span></label>
                  <input name="civil_id" id="pfCivilId" value="${escHtml(prePatient.civil_id||'')}" pattern="\\d{12}" maxlength="12" placeholder="12-digit number" inputmode="numeric" oninput="checkPatDup('civil_id',this.value,${prePatient.id})"/>
                  <div id="pfCivilIdMsg" class="text-sm" style="min-height:16px;margin-top:3px"></div>
                </div>
                <div class="form-group"><label>Date of Birth <span style="color:var(--c-danger)">*</span></label>
                  <input name="dob" type="date" value="${escHtml(prePatient.dob||'')}"/>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>Age <span style="color:var(--c-danger)">*</span></label>
                  <div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="age" type="number" min="0" max="120" value="${escHtml(String(prePatient.age||''))}"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div>
                </div>
                <div class="form-group"><label>Gender <span style="color:var(--c-danger)">*</span></label>
                  <select name="gender">
                    <option value="">Select</option>
                    <option ${prePatient.gender==='Male'?'selected':''}>Male</option>
                    <option ${prePatient.gender==='Female'?'selected':''}>Female</option>
                    <option ${prePatient.gender==='Other'?'selected':''}>Other</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>Alternative Phone</label>
                  <input name="alt_phone" id="pfAltPhone" type="tel" value="${escHtml(prePatient.alt_phone||'')}" placeholder="Optional" oninput="checkPatDup('alt_phone',this.value,${prePatient.id})"/>
                  <div id="pfAltPhoneMsg" class="text-sm" style="min-height:16px;margin-top:3px"></div>
                </div>
                <div class="form-group"><label>Address</label>
                  <input name="address" value="${escHtml(prePatient.address||'')}"/>
                </div>
              </div>
              <div class="form-group"><label>Medical History</label>
                <textarea name="medical_history" rows="2">${escHtml(prePatient.medical_history||'')}</textarea>
              </div>
            </form>`,
            async () => {
              const f = document.getElementById('completePatientForm');
              const body = Object.fromEntries(new FormData(f));
              if (!body.age)    { toast('Age is required','error'); return false; }
              if (!body.gender) { toast('Gender is required','error'); return false; }
              if (!body.civil_id) { toast('Civil ID is required','error'); return false; }
              if (!body.dob)    { toast('Date of Birth is required','error'); return false; }
              if (!/^\d{12}$/.test(body.civil_id)) { toast('Civil ID must be exactly 12 digits','error'); return false; }
              try {
                await apiFetch(`/api/patients/${prePatient.id}`, { method:'PUT', body: JSON.stringify(body) });
                toast('Patient profile updated', 'success');
                closeModal();
                prePatient = { ...prePatient, ...body };
                resolve(true);
              } catch(e) { toast(e.message,'error'); return false; }
            }, 'modal-lg');
          // Handle modal close without saving
          const origClose = window._modalCloseCallback;
          window._modalCloseCallback = () => { resolve(false); if (origClose) origClose(); };
        });
        if (!proceed) return;
      }
    } catch(e) { /* patient fetch failed, continue anyway */ }
  }

  _billLineItems = [];
  _billPkgSessions = [];
  let patName = prePatient && prePatient.name ? prePatient.name : '';
  const [pms, svcs, pkgs, docs, discountsRaw, aptData] = await Promise.all([
    apiFetch('/api/payment-methods').catch(()=>[]),
    apiFetch('/api/services').catch(()=>[]),
    apiFetch('/api/packages').catch(()=>[]),
    apiFetch('/api/doctors').catch(()=>[]),
    apiFetch('/api/discounts').catch(()=>[]),
    preAptId ? apiFetch(`/api/appointments/${preAptId}`).catch(()=>null) : Promise.resolve(null),
  ]);
  const todayISO = new Date().toISOString().slice(0,10);
  const activeDiscounts = (discountsRaw||[]).filter(d => d.active !== false && (!d.valid_from || d.valid_from <= todayISO) && (!d.valid_to || d.valid_to >= todayISO));
  const [productsRaw, stockRaw, subStoresRaw] = await Promise.all([
    apiFetch('/api/store/products').catch(()=>[]),
    apiFetch('/api/store/stock').catch(()=>[]),
    apiFetch('/api/store/sub-stores').catch(()=>[]),
  ]);
  const payMethods = (pms||[]).filter(m=>m.active).map(m=>m.name);
  if (!payMethods.length) payMethods.push('Cash','Card','UPI','Online');
  window._billPayMethods = payMethods;
  window._billServices = (svcs||[]).filter(s=>s.active);
  window._billPackages = (pkgs||[]).filter(p=>p.active);
  const configuredBillingStoreId = parseInt(currentSystem?.clinic?.billing_store_id || '', 10);
  const mainStore = (subStoresRaw || []).find(s => parseInt(s.id, 10) === configuredBillingStoreId && s.active !== false)
    || (subStoresRaw || []).find(s => s.is_main)
    || (subStoresRaw || [])[0]
    || null;
  const productStockById = (stockRaw || [])
    .filter(s => !mainStore || parseInt(s.store_id) === parseInt(mainStore.id))
    .reduce((acc, s) => {
    const pid = parseInt(s.product_id);
    acc[pid] = (acc[pid] || 0) + (parseFloat(s.qty || 0) || 0);
    return acc;
  }, {});
  window._billProducts = (productsRaw||[])
    .filter(p => p.active !== false)
    .map(p => ({ ...p, current_stock: parseFloat((productStockById[parseInt(p.id)] || 0).toFixed(3)) }));
  window._billProductQtyMap = {};
  const billDoctors = (docs||[]).filter(d => d.active !== false);
  const preDoctorId = aptData && aptData.doctor_id ? String(aptData.doctor_id) : '';
  showModal('Create Receipt', `
    <div class="bill-layout">
      <!-- LEFT: patient + item picker -->
      <div class="bill-left">
        <div class="bill-patient-row">
          ${prePatientId
            ? `<div class="bill-patient-fixed"><span class="bill-patient-name-badge">${escHtml(patName)}</span><input type="hidden" name="patient_id" value="${prePatientId}"/></div>`
            : `<div class="psd-wrap">
                 <input name="pat_search_bill" id="billPatSearch" placeholder="Search patient..." oninput="searchPatientBill(this.value)" autocomplete="off"/>
                 <input type="hidden" name="patient_id" id="billPatientId"/>
                 <div id="billPatDropdown" class="psd-list" style="display:none"></div>
               </div>
               <div id="billPatLabel" class="text-muted text-sm"></div>
               <div id="billPendingServicesAlert"></div>`}
          <input type="hidden" name="appointment_id" value="${preAptId||''}"/>
        </div>
        <div class="bill-doctor-row">
          <label>Doctor *</label>
          <select name="doctor_id" id="billDoctorId" class="bill-doctor-select" required>
            <option value="">- Select doctor -</option>
            ${billDoctors.map(d => `<option value="${d.id}" ${String(d.id)===String(preDoctorId)?'selected':''}>${escHtml(doctorDisplayName(d))}</option>`).join('')}
          </select>
        </div>
        <div class="bill-tabs">
          <button type="button" class="bill-tab active" onclick="billSwitchTab('services',this)">
            ${IC.services||''} Services
          </button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('packages',this)">
            ${IC.packages||''} Packages
          </button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('pkg-session',this)">Pkg Sessions</button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('products',this)">${IC.product||''} Products</button>
          <button type="button" class="bill-tab" onclick="billSwitchTab('custom',this)">+ Custom</button>
        </div>

        <div id="billTab-services" class="bill-tab-panel">
          <div class="bill-search-row">
            ${IC.search}<input id="billSvcSearch" placeholder="Search services..." oninput="billFilterServices(this.value)"/>
            <select id="billSvcCategoryFilter" style="width:auto;min-width:170px" onchange="billFilterServices(document.getElementById('billSvcSearch')?.value || '')">${billServiceGroupOptionsHtml()}</select>
          </div>
          ${window._billServices.length
            ? `<div class="bill-svc-grid" id="billSvcGrid">${window._billServices.map(s=>`
              <label class="bill-svc-card" data-svc-id="${s.id}">
                <input type="checkbox" data-svc-id="${s.id}" onchange="billToggleService(${s.id})" style="display:none"/>
                <span class="bill-svc-card-check">&#10003;</span>
                <div class="bill-svc-card-body">
                  <span class="bill-svc-card-name">${escHtml(s.name)}</span>
                  <span class="bill-svc-card-cat">${escHtml(s.category)}</span>
                </div>
                <span class="bill-svc-card-price">KD ${s.price.toFixed(3)}</span>
              </label>`).join('')}</div>`
            : '<p class="text-muted text-sm p-2">No active services</p>'}
        </div>

        <div id="billTab-packages" class="bill-tab-panel" style="display:none">
          <div class="bill-search-row">
            ${IC.search}<input id="billPkgSearch" placeholder="Search packages..." oninput="billFilterPackages(this.value)"/>
          </div>
          ${window._billPackages.length
            ? `<div class="bill-pkg-list" id="billPkgList">${window._billPackages.map(p=>`
              <div class="bill-pkg-card" id="billPkgCard-${p.id}" data-pkg-name="${escHtml(p.name).toLowerCase()}">
                <label class="bill-pkg-card-header" onclick="event.preventDefault();billTogglePackage(${p.id})">
                  <div class="bill-pkg-card-check-wrap">
                    <span class="bill-pkg-card-checkbox" id="billPkgCb-${p.id}"></span>
                  </div>
                  <div class="bill-pkg-card-info">
                    <span class="bill-pkg-card-name">${escHtml(p.name)}</span>
                    <span class="bill-pkg-card-svcs">${(p.services||[]).map(s=>escHtml(s.name)+((s.total||1)>1?` -${s.total}`:'')).join(' - ')}</span>
                  </div>
                  <div class="bill-pkg-card-right">
                    <span class="bill-pkg-card-price">KD ${(p.discount_price||0).toFixed(3)}</span>
                    <span class="bill-pkg-card-count">${(p.services||[]).reduce((t,s)=>t+(s.total||1),0)} sessions</span>
                  </div>
                </label>
                <div class="bill-pkg-svc-picker" id="pkgSvcPicker-${p.id}" style="display:none">
                  <div class="bill-pkg-svc-picker-label">Select services for this visit</div>
                  <div class="bill-pkg-svc-grid">
                    ${(p.services||[]).map(s=>`
                    <label class="bill-pkg-svc-tile bill-pkg-svc-tile-sel">
                      <input type="checkbox" data-pkg-svc="${p.id}" data-svc="${s.service_id}" style="display:none" onchange="billUpdatePackageServices(${p.id})"/>
                      <span class="bill-pkg-svc-tile-name">${escHtml(s.name)}${(s.total||1)>1?` <span class='text-muted' style='font-size:11px'>-${s.total} sessions</span>`:''}</span>
                      <span class="bill-pkg-svc-tile-check">&#10003;</span>
                    </label>`).join('')}
                  </div>
                </div>
              </div>`).join('')}</div>`
            : '<p class="text-muted text-sm p-2">No active packages</p>'}
        </div>

        <div id="billTab-pkg-session" class="bill-tab-panel" style="display:none">
          <div id="billPkgSessionContent" class="bill-pkg-session-content"><p class="text-muted text-sm p-2">Select a patient first to see active package sessions</p></div>
        </div>

        <div id="billTab-products" class="bill-tab-panel" style="display:none">
          <div class="bill-search-row">
            ${IC.search}<input id="billProdSearch" placeholder="Search products..." oninput="billFilterProducts(this.value)"/>
          </div>
          ${window._billProducts.length
            ? `<div class="bill-svc-grid" id="billProdGrid">${window._billProducts.map(p=>`
              <div class="bill-svc-card bill-prod-card" data-prod-id="${p.id}">
                <span class="bill-prod-badge">${IC.product||'Product'}</span>
                <div class="bill-svc-card-body">
                  <span class="bill-svc-card-name">${escHtml(p.name)}</span>
                  <span class="bill-svc-card-cat">Stock: ${parseFloat(p.current_stock||0).toFixed(3)} ${escHtml(p.uom_symbol || p.unit || '')}</span>
                </div>
                <span class="bill-svc-card-price">KD ${parseFloat(p.sell_price||0).toFixed(3)}</span>
                <div class="bill-prod-actions">
                  <div class="num-stepper bill-prod-stepper">
                    <button type="button" class="num-step-btn" onclick="billChangeProductQty(${p.id},-1)">-</button>
                    <input id="billProdQty-${p.id}" type="number" min="1" step="1" value="1" oninput="billNormalizeProductQty(${p.id})"/>
                    <button type="button" class="num-step-btn" onclick="billChangeProductQty(${p.id},1)">+</button>
                  </div>
                  <button type="button" class="btn btn-sm bill-prod-add-btn" onclick="billAddOrUpdateProduct(${p.id})">Add</button>
                </div>
              </div>`).join('')}</div>`
            : '<p class="text-muted text-sm p-2">No active products</p>'}
        </div>

        <div id="billTab-custom" class="bill-tab-panel" style="display:none">
          <div class="bill-custom-modern">
            <div class="bill-custom-modern-fields">
              <input id="customItemName" class="bill-custom-desc" placeholder="Item description (e.g. Ambulance charge)"/>
              <div class="num-stepper bill-custom-amt"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input id="customItemAmt" type="number" min="0" step="0.001" placeholder="Amount (KD)"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div>
            </div>
            <button type="button" class="btn btn-primary" onclick="billAddCustomItem()">${IC.plus} Add Item</button>
          </div>
        </div>
      </div>

      <!-- RIGHT: cart + payment -->
      <div class="bill-right">
        <div class="bill-right-title">Cart</div>
        <div id="billItemsList" class="bill-items-list bill-items-list-tall"><p class="text-muted text-sm" style="padding:16px;text-align:center">No items added yet</p></div>
        <div class="bill-total-row"><span>Subtotal</span><strong id="billTotalAmt">KD 0.00</strong></div>
        <div style="margin:8px 0 10px">
          <button type="button" class="btn btn-sm" id="billDiscountToggleBtn" onclick="toggleBillDiscountPanel()">${IC.discount} Apply Discount</button>
        </div>
        <div id="billDiscountPanel" style="display:none;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--bg-card)">
          ${(can('billing.discount.apply') || can('billing.discount.open'))
            ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                 ${can('billing.discount.apply') ? `<select id="billDiscountSelect" style="flex:1;min-width:160px" onchange="applyBillDiscount()">
                   <option value="" data-type="" data-value="0">Select Discount</option>
                   ${activeDiscounts.map(d => {
                     const label = d.type==='percentage'
                       ? `${escHtml(d.name)} (${parseFloat(d.value||0).toFixed(2)}%)`
                       : d.type==='fixed'
                         ? `${escHtml(d.name)} (KD ${parseFloat(d.value||0).toFixed(3)})`
                         : `${escHtml(d.name)} (Open)`;
                     return `<option value="${d.id}" data-type="${escHtml(d.type)}" data-value="${parseFloat(d.value||0)}" data-max="${d.max_limit!=null ? parseFloat(d.max_limit) : ''}">${label}</option>`;
                   }).join('')}
                 </select>` : ''}
                 ${can('billing.discount.open') ? `<div id="billOpenDiscWrap" style="display:none;align-items:center;gap:6px">
                   <span class="text-muted text-sm">KD</span>
                   <input id="billOpenDiscAmt" type="number" min="0" step="0.001" placeholder="Manual amount" style="width:120px" oninput="applyBillDiscount()"/>
                 </div>` : ''}
               </div>
               <div id="billDiscountRow" style="display:none;margin-top:8px;font-size:12px;color:#d32f2f">
                 <span id="billDiscLabelDisplay"></span>: <strong>- KD <span id="billDiscAmtDisplay">0.000</span></strong>
               </div>
               <div id="billNetTotalRow" class="bill-total-row" style="display:none;margin-top:6px"><span>Net Total</span><strong id="billNetTotalAmt">KD 0.000</strong></div>`
            : `<div class="text-muted text-sm">You do not have discount permission. Required: billing.discount.apply or billing.discount.open.</div>`}
        </div>
        <div id="billSplitWrap">
          <div class="bill-split-header">
            <span>Payment Splits</span>
            <span id="billSplitBalance" class="bill-split-balance"></span>
          </div>
          <div id="billSplitRows"></div>
          <button type="button" class="bill-split-add-btn" onclick="billAddSplitRow()">${IC.plus} Add Payment Method</button>
          <div id="billAutoPaidNote" style="display:none;font-size:12px;color:var(--text-muted);margin-top:4px">Auto-marked Paid (zero amount)</div>
        </div>

      </div>
    </div>
    <input type="hidden" name="patient_id" id="billPatientId2" value="${prePatientId||''}"/>`, async () => {
      const patId = prePatientId
        ? prePatientId
        : (document.getElementById('billPatientId')?.value || document.getElementById('billPatientId2')?.value);
      if (!patId) { toast('Please select a patient', 'error'); return false; }
      if (!_billLineItems.length) { toast('Please add at least one item', 'error'); return false; }

      const apt = document.querySelector('#modalOverlay [name=appointment_id]')?.value  || '';
      const doctorId = document.getElementById('billDoctorId')?.value || '';
      if (!doctorId) { toast('Please select doctor', 'error'); return false; }
      // Ensure pkg_session line-items include `qty` from _billPkgSessions before sending
      const pkgQtyMap = {};
      (_billPkgSessions||[]).forEach(pss => {
        if (pss.service_quantities) Object.entries(pss.service_quantities).forEach(([sid, q]) => {
          pkgQtyMap[`${pss.patient_package_id}-${sid}`] = parseInt(q) || 1;
        });
      });
      _billLineItems = _billLineItems.map(it => {
        if (it.type === 'pkg_session') {
          const key = `${it.ref_id}-${it.service_id}`;
          return { ...it, qty: pkgQtyMap[key] || it.qty || 1 };
        }
        return it;
      });
      const subtotal = (_billLineItems || []).reduce((s,i)=>s + (parseFloat(i.amount)||0), 0);
      // collect discount from current UI state (single source of truth)
      const discountInfo = getCurrentBillDiscount();
      const discountId = discountInfo.id || '';
      const discountType = discountInfo.type || '';
      const discountAmount = discountInfo.amount || 0;
      const billTotal = Math.max(0, subtotal - discountAmount);
      // collect payment splits
      let splits = [];
      document.querySelectorAll('.bill-split-row').forEach(row => {
        const method = row.querySelector('.bsplit-method')?.value;
        const amt    = parseFloat(row.querySelector('.bsplit-amt')?.value) || 0;
        if (method && amt > 0) splits.push({ method, amount: amt });
      });
      if (billTotal > 0 && !splits.length) { toast('Add at least one payment method with an amount', 'error'); return false; }
      const splitsTotal = splits.reduce((a,s)=>a+s.amount, 0);
      if (billTotal > 0 && Math.abs(splitsTotal - billTotal) > 0.01) { toast(`Payment splits (KD ${splitsTotal.toFixed(3)}) must equal bill total (KD ${billTotal.toFixed(3)})`, 'error'); return false; }
      const isAutoSettled = billTotal === 0;
      const splitsTotal2 = splits.reduce((a,s)=>a+s.amount, 0);
      const finalPaymentStatus = (billTotal === 0 || splitsTotal2 >= billTotal - 0.01) ? 'Paid' : 'Pending';
      const finalPaymentMethod = splits.length === 1 ? splits[0].method : (splits.length > 1 ? 'Split' : 'Cash');
      const body = { patient_id: patId, appointment_id: apt, doctor_id: doctorId, payment_method: finalPaymentMethod, payment_status: finalPaymentStatus,
        payment_splits: billTotal === 0 ? [] : splits,
        line_items: _billLineItems, pkg_sessions: _billPkgSessions,
        discount_id: discountId || null,
        discount_type: discountType || null,
        discount_amount: discountAmount || 0,
        discount_label: discountInfo.label || '' };
      try {
        const billRes = await apiFetch('/api/bills', { method: 'POST', body: JSON.stringify(body) });
        toast('Receipt created', 'success');
        // Close bill modal first, then print
        closeModal();
        // Automatically print the bill if created successfully and bill id is available
        if (billRes && billRes.id) {
          await printBill(billRes.id);
        }
        // Update appointment status in scheduler/calendar immediately if bill paid
        if (finalPaymentStatus === 'Paid' && apt) {
          const aptIdNum = parseInt(apt, 10);
          let updated = false;
          if (aptIdNum && Array.isArray(calAllApts)) {
            // Use updated appointment from backend if available
            if (billRes && billRes.appointment && billRes.appointment.id) {
              for (let i = 0; i < calAllApts.length; ++i) {
                if (parseInt(calAllApts[i].id) === parseInt(billRes.appointment.id)) {
                  calAllApts[i] = { ...calAllApts[i], ...billRes.appointment };
                  updated = true;
                  break;
                }
              }
            } else {
              // fallback: just set status
              for (let i = 0; i < calAllApts.length; ++i) {
                if (parseInt(calAllApts[i].id) === aptIdNum) {
                  calAllApts[i].status = 'Completed';
                  updated = true;
                  break;
                }
              }
            }
            if (updated && typeof renderCalendar === 'function') renderCalendar();
          }
          await refreshAppointmentViewsAfterBilling();
        }
        closeModal();
        if (finalPaymentStatus === 'Paid') {
          const created = await autoCreateFollowUpFromContext(parseInt(patId, 10), parseInt(doctorId, 10), apt ? parseInt(apt, 10) : null, 'Post billing follow-up', false);
          if (!created) {
            toast('Bill settled. Could not auto-create follow-up. You can add one now.', 'error');
          } else {
            toast('Bill settled and follow-up created', 'success');
          }
        } else {
          navigate('billing');
        }
      } catch(e) { toast(e.message, 'error'); return false; }
    }, 'modal-bill');
  // Change the save button label to "Save & Print"
  setTimeout(() => {
    const btn = document.getElementById('modalSaveBtn');
    if (btn) btn.innerHTML = `${IC.print} Save &amp; Print`;
  }, 0);
  if (prePatientId) loadBillPackageSessions(prePatientId);
}

async function refreshAppointmentViewsAfterBilling() {
  if (currentPageId === 'scheduler' || document.querySelector('.sched-container')) {
    await scheduler();
    return;
  }
  if (currentPageId === 'appointments') {
    await appointments();
    return;
  }
  if (currentPageId === 'billing') {
    await billing();
  }
}

function showBillLoadingModal(message = 'Loading billing details...') {
  showModal('Create Receipt', `
    <div style="display:flex;align-items:center;justify-content:center;min-height:180px;padding:20px 12px;flex-direction:column;gap:12px">
      <div style="padding:8px 12px;border-radius:999px;background:var(--bg-hover);color:var(--c-primary);font-weight:700">${IC.clock || '...'}</div>
      <div style="font-weight:700;color:var(--text)">${escHtml(message)}</div>
      <div class="text-sm text-muted">Please wait...</div>
    </div>`, null, 'modal-sm');
}

function billServiceGroupOptionsHtml() {
  const seen = new Set();
  const groups = [];
  (window._billServices || []).forEach((service) => {
    const name = String(service.category || '').trim() || 'Other';
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      groups.push(name);
    }
  });
  groups.sort((a, b) => a.localeCompare(b));
  return ['<option value="">All Groups</option>', ...groups.map((group) => `<option value="${escHtml(group)}">${escHtml(group)}</option>`)].join('');
}

function billSwitchTab(tab, btn) {
  document.querySelectorAll('.bill-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bill-tab-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  const el = document.getElementById('billTab-' + tab);
  if (el) el.style.display = '';
}
function billFilterServices(q) {
  const v = q.toLowerCase().trim();
  const selectedGroup = String(document.getElementById('billSvcCategoryFilter')?.value || '').toLowerCase().trim();
  document.querySelectorAll('#billSvcGrid .bill-svc-card').forEach(card => {
    const name  = (card.querySelector('.bill-svc-card-name')?.textContent || '').toLowerCase();
    const cat   = (card.querySelector('.bill-svc-card-cat')?.textContent  || '').toLowerCase();
    const matchesText = !v || name.includes(v) || cat.includes(v);
    const matchesGroup = !selectedGroup || cat === selectedGroup;
    card.style.display = (matchesText && matchesGroup) ? '' : 'none';
  });
}
function billFilterPackages(q) {
  const v = q.toLowerCase().trim();
  document.querySelectorAll('#billPkgList .bill-pkg-card').forEach(card => {
    const name = (card.querySelector('.bill-pkg-card-name')?.textContent || '').toLowerCase();
    const svcs = (card.querySelector('.bill-pkg-card-svcs')?.textContent || '').toLowerCase();
    card.style.display = (!v || name.includes(v) || svcs.includes(v)) ? '' : 'none';
  });
}
function billFilterProducts(q) {
  const v = q.toLowerCase().trim();
  document.querySelectorAll('#billProdGrid .bill-svc-card').forEach(card => {
    const name = (card.querySelector('.bill-svc-card-name')?.textContent || '').toLowerCase();
    const sub = (card.querySelector('.bill-svc-card-cat')?.textContent || '').toLowerCase();
    card.style.display = (!v || name.includes(v) || sub.includes(v)) ? '' : 'none';
  });
}
function billNormalizeProductQty(productId) {
  const input = document.getElementById(`billProdQty-${productId}`);
  if (!input) return 1;
  let qty = parseInt(input.value, 10);
  if (!Number.isFinite(qty) || qty < 1) qty = 1;
  input.value = String(qty);
  return qty;
}
function billChangeProductQty(productId, delta) {
  const input = document.getElementById(`billProdQty-${productId}`);
  if (!input) return;
  const current = billNormalizeProductQty(productId);
  const next = Math.max(1, current + parseInt(delta || 0, 10));
  input.value = String(next);
}
function billAddOrUpdateProduct(productId) {
  const prod = (window._billProducts || []).find(p => p.id === productId);
  if (!prod) return;
  const qty = billNormalizeProductQty(productId);
  const available = parseFloat(prod.current_stock || 0) || 0;
  if (available <= 0) {
    toast(`No stock available for ${prod.name}`, 'error');
    return;
  }
  if (qty > available) {
    toast(`Only ${available.toFixed(3)} available for ${prod.name}`, 'error');
    return;
  }
  const amount = parseFloat((qty * (parseFloat(prod.sell_price || 0) || 0)).toFixed(3));
  const name = `${prod.name}`;
  const idx = _billLineItems.findIndex(i => !i._locked && i.type === 'product' && parseInt(i.ref_id) === parseInt(productId));
  const item = { ref_id: productId, name, amount, type: 'product', qty, unit: prod.uom_symbol || prod.unit || '' };
  if (idx >= 0) _billLineItems[idx] = item;
  else _billLineItems.push(item);
  renderBillItemsList();
}
function billToggleService(id) {
  const svc = (window._billServices||[]).find(s => s.id === id);
  if (!svc) return;
  const idx = _billLineItems.findIndex(i => !i._locked && i.type === 'service' && i.ref_id === id);
  const card = document.querySelector(`.bill-svc-card[data-svc-id="${id}"]`);
  if (idx >= 0) {
    _billLineItems.splice(idx, 1);
    if (card) card.classList.remove('selected');
  } else {
    _billLineItems.push({ ref_id: id, name: svc.name, amount: svc.price, type: 'service' });
    if (card) card.classList.add('selected');
  }
  renderBillItemsList();
}
function billTogglePackage(id) {
  const pkg = (window._billPackages||[]).find(p => p.id === id);
  if (!pkg) return;
  const picker = document.getElementById(`pkgSvcPicker-${id}`);
  const cb = document.getElementById(`billPkgCb-${id}`);
  const idx = _billLineItems.findIndex(i => !i._locked && i.type === 'package' && i.ref_id === id);
  if (idx >= 0) {
    _billLineItems.splice(idx, 1);
    if (picker) picker.style.display = 'none';
    if (cb) cb.classList.remove('checked');
    renderBillItemsList();
  } else {
    if (picker) picker.style.display = '';
    if (cb) cb.classList.add('checked');
    billUpdatePackageServices(id); // adds item + renders
  }
}
function billUpdatePackageServices(pkgId) {
  const pkg = (window._billPackages||[]).find(p => p.id === pkgId);
  if (!pkg) return;
  const checkboxes = [...document.querySelectorAll(`[data-pkg-svc="${pkgId}"][data-svc]:checked`)];
  const selectedIds = checkboxes.map(cb => parseInt(cb.dataset.svc));
  // update tile visual
  document.querySelectorAll(`[data-pkg-svc="${pkgId}"]`).forEach(cb => {
    const tile = cb.closest('label');
    if (tile) tile.classList.toggle('selected', cb.checked);
  });
  const selectedNames = (pkg.services||[]).filter(s => selectedIds.includes(s.service_id || s.id)).map(s => s.name);
  const label = selectedNames.length ? `${pkg.name} - ${selectedNames.join(', ')}` : pkg.name;
  const idx = _billLineItems.findIndex(i => !i._locked && i.type === 'package' && i.ref_id === pkgId);
  const item = { ref_id: pkgId, name: label, package_name: pkg.name, amount: pkg.discount_price||0, type: 'package', selected_service_ids: selectedIds };
  if (idx >= 0) _billLineItems[idx] = item;
  else _billLineItems.push(item);
  renderBillItemsList();
}
function billTogglePkgSession(checkbox) {
  const patPkgId = parseInt(checkbox.dataset.ppkgId);
  const svcId    = parseInt(checkbox.dataset.svcId);
  const pp  = (window._billPkgSessionList||[]).find(p => p.id === patPkgId);
  const svc = pp ? pp.services.find(s => s.service_id === svcId) : null;
  const svcName = svc ? svc.service_name : '';
  const pkgName = pp ? pp.package_name : '';
  const qtyEl = document.getElementById(`pkgSessQty-${patPkgId}-${svcId}`);
  const qty = qtyEl ? Math.max(1, parseInt(qtyEl.value)||1) : 1;
  const lineIdx = _billLineItems.findIndex(i => !i._locked && i.type === 'pkg_session' && i.ref_id === patPkgId && i.service_id === svcId);
  if (lineIdx >= 0) {
    _billLineItems.splice(lineIdx, 1);
    const si = _billPkgSessions.findIndex(s => s.patient_package_id === patPkgId);
    if (si >= 0) {
      _billPkgSessions[si].service_ids = _billPkgSessions[si].service_ids.filter(id => id !== svcId);
      delete _billPkgSessions[si].service_quantities;
      if (!_billPkgSessions[si].service_ids.length) _billPkgSessions.splice(si, 1);
    }
  } else {
    const qtyLabel = qty > 1 ? ` -${qty}` : '';
    _billLineItems.push({ ref_id: patPkgId, service_id: svcId, name: `${svcName}${qtyLabel}`, package_name: pkgName, amount: 0, type: 'pkg_session', qty });
    const si = _billPkgSessions.findIndex(s => s.patient_package_id === patPkgId);
    if (si >= 0) {
      _billPkgSessions[si].service_ids.push(svcId);
      if (!_billPkgSessions[si].service_quantities) _billPkgSessions[si].service_quantities = {};
      _billPkgSessions[si].service_quantities[svcId] = qty;
    } else {
      _billPkgSessions.push({ patient_package_id: patPkgId, service_ids: [svcId], service_quantities: { [svcId]: qty } });
    }
  }
  renderBillItemsList();
}
// Update qty in line item when qty spinner changes while checkbox is checked
function billUpdatePkgSessionQty(patPkgId, svcId, input) {
  const qty = Math.max(1, parseInt(input.value)||1);
  const pp = (window._billPkgSessionList||[]).find(p => p.id === patPkgId);
  const svc = pp ? pp.services.find(s => s.service_id === svcId) : null;
  const remaining = svc ? svc.total - svc.used : 1;
  if (qty > remaining) { input.value = remaining; return billUpdatePkgSessionQty(patPkgId, svcId, input); }
  const lineIdx = _billLineItems.findIndex(i => !i._locked && i.type === 'pkg_session' && i.ref_id === patPkgId && i.service_id === svcId);
  if (lineIdx >= 0) {
    const svcName = svc ? svc.service_name : '';
    const pkgName = pp ? pp.package_name : '';
    const qtyLabel = qty > 1 ? ` -${qty}` : '';
    _billLineItems[lineIdx].name = `${svcName}${qtyLabel}`;
    _billLineItems[lineIdx].package_name = pkgName;
    _billLineItems[lineIdx].qty = qty;
    // update session quantities
    const si = _billPkgSessions.findIndex(s => s.patient_package_id === patPkgId);
    if (si >= 0) {
      if (!_billPkgSessions[si].service_quantities) _billPkgSessions[si].service_quantities = {};
      _billPkgSessions[si].service_quantities[svcId] = qty;
    }
    renderBillItemsList();
  }
}
function billAddCustomItem() {
  const name = document.getElementById('customItemName')?.value?.trim();
  const amount = parseFloat(document.getElementById('customItemAmt')?.value);
  if (!name || isNaN(amount) || amount <= 0) { toast('Enter a description and valid amount', 'error'); return; }
  _billLineItems.push({ name, amount, type: 'custom' });
  document.getElementById('customItemName').value = '';
  document.getElementById('customItemAmt').value = '';
  renderBillItemsList();
}
function billRemoveItem(idx) {
  const item = _billLineItems[idx];
  if (!item || item._locked) return;
  _billLineItems.splice(idx, 1);
  // Uncheck the checkbox if service/package
  if (item.type === 'service') {
    const card = document.querySelector(`.bill-svc-card[data-svc-id="${item.ref_id}"]`);
    if (card) { card.classList.remove('selected'); const cb = card.querySelector('input'); if(cb) cb.checked=false; }
  } else if (item.type === 'package') {
    const card = document.getElementById(`billPkgCard-${item.ref_id}`);
    if (card) card.classList.remove('selected');
    const cb = document.getElementById(`billPkgCb-${item.ref_id}`);
    if (cb) cb.classList.remove('checked');
    const picker = document.getElementById(`pkgSvcPicker-${item.ref_id}`);
    if (picker) picker.style.display = 'none';
  } else if (item.type === 'pkg_session') {
    const cb = document.querySelector(`[data-ppkg-id="${item.ref_id}"][data-svc-id="${item.service_id}"]`);
    if (cb) cb.checked = false;
    const si = _billPkgSessions.findIndex(s => s.patient_package_id === item.ref_id);
    if (si >= 0) {
      _billPkgSessions[si].service_ids = _billPkgSessions[si].service_ids.filter(id => id !== item.service_id);
      if (!_billPkgSessions[si].service_ids.length) _billPkgSessions.splice(si, 1);
    }
  } else if (item.type === 'product') {
    const input = document.getElementById(`billProdQty-${item.ref_id}`);
    if (input) input.value = '1';
  }
  renderBillItemsList();
}
function renderBillItemsList() {
  const el = document.getElementById('billItemsList');
  if (!el) return;
  if (!_billLineItems.length) {
    el.innerHTML = '<p class="text-muted text-sm" style="padding:8px;text-align:center">No items added yet</p>';
    const t = document.getElementById('billTotalAmt'); if (t) t.textContent = 'KD 0.00';
    if (window._checkBillPaymentUI) window._checkBillPaymentUI();
    applyBillDiscount();
    return;
  }
  const total = _billLineItems.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
  const typeClr = { service:'confirmed', package:'arrived', pkg_session:'admin', product:'scheduled', custom:'secondary' };
  const billItemDisplayName = (item) => {
    const base = String(item.name || '').trim();
    const pkg = String(item.package_name || '').trim();
    if (!pkg) return base;
    if (base.toLowerCase().includes(pkg.toLowerCase())) return base;
    return `${base} [Package: ${pkg}]`.trim();
  };
  el.innerHTML = _billLineItems.map((item, i) => `
    <div class="bill-line-item${item._locked ? ' bill-item-locked' : ''}">
      <span class="badge badge-${typeClr[item.type]||'secondary'} bill-item-type">${item.type}</span>
      ${item._locked ? `<span class="bill-item-locked-badge" title="Previously billed - cannot be removed">\uD83D\uDD12</span>` : ''}
      <span class="bill-item-name">${escHtml(billItemDisplayName(item))}${item.type==='product' ? ` <span class="text-muted text-sm">x ${parseFloat(item.qty||0).toFixed(3)} ${escHtml(item.unit||'')}</span>` : ''}</span>
      <span class="bill-item-amount">KD ${parseFloat(item.amount).toFixed(3)}</span>
      ${item._locked ? '' : `<button type="button" class="btn-icon-sm" onclick="billRemoveItem(${i})" title="Remove">${IC.x}</button>`}
    </div>`).join('');
  const t = document.getElementById('billTotalAmt'); if (t) t.textContent = `KD ${total.toFixed(3)}`;
  if (window._checkBillPaymentUI) window._checkBillPaymentUI();
  applyBillDiscount();
}

function applyBillDiscount() {
  const subtotal = (_billLineItems||[]).reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
  const discSel = document.getElementById('billDiscountSelect');
  const openDiscWrap = document.getElementById('billOpenDiscWrap');
  const discRow = document.getElementById('billDiscountRow');
  const netRow = document.getElementById('billNetTotalRow');
  const discAmtEl = document.getElementById('billDiscAmtDisplay');
  const discLabelEl = document.getElementById('billDiscLabelDisplay');
  const netTotalEl = document.getElementById('billNetTotalAmt');

  const selOpt = discSel?.selectedOptions[0];
  const type = selOpt?.dataset?.type || '';
  
  // Show/hide open discount input
  if (openDiscWrap) openDiscWrap.style.display = (type === 'open') ? 'flex' : 'none';

  const discountInfo = getCurrentBillDiscount();
  const discAmt = discountInfo.amount || 0;
  const label = discountInfo.label || '';

  if (discRow) discRow.style.display = discAmt > 0 ? '' : 'none';
  if (netRow)  netRow.style.display  = discAmt > 0 ? '' : 'none';
  if (discAmtEl)  discAmtEl.textContent  = discAmt.toFixed(3);
  if (discLabelEl) discLabelEl.textContent = label;
  const netTotal = Math.max(0, subtotal - discAmt);
  if (netTotalEl) netTotalEl.textContent = `KD ${netTotal.toFixed(3)}`;
  billAutoAllocateSplits();
  billUpdateSplitBalance();
}

function toggleBillDiscountPanel() {
  const panel = document.getElementById('billDiscountPanel');
  const btn = document.getElementById('billDiscountToggleBtn');
  if (!panel) return;
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? '' : 'none';
  if (btn) btn.textContent = opening ? 'Hide Discount' : `${IC.discount} Apply Discount`;
  if (opening) applyBillDiscount();
}

function billAddSplitRow(method, amount) {
  const wrap = document.getElementById('billSplitRows');
  if (!wrap) return;
  const methods = window._billPayMethods || ['Cash','Card','UPI'];
  const div = document.createElement('div');
  div.className = 'bill-split-row';
  div.innerHTML = `
    <select class="bsplit-method" onchange="billUpdateSplitBalance()">
      ${methods.map(m=>`<option${m===(method||methods[0])?' selected':''}>${escHtml(m)}</option>`).join('')}
    </select>
    <div class="bsplit-amt-wrap">
      <span class="bsplit-prefix">KD</span>
      <input type="number" class="bsplit-amt" min="0" step="0.001" placeholder="0.000" value="${amount||''}" data-manual="0" oninput="billHandleSplitAmtInput(this)"/>
    </div>
    <button type="button" class="bsplit-remove" onclick="this.closest('.bill-split-row').remove();billAutoAllocateSplits();billUpdateSplitBalance()" title="Remove">${IC.x}</button>`;
  wrap.appendChild(div);
  billAutoAllocateSplits();
  billUpdateSplitBalance();
}
function billHandleSplitAmtInput(inputEl) {
  if (inputEl) inputEl.dataset.manual = '1';
  billUpdateSplitBalance();
}
function billAutoAllocateSplits() {
  const total = getBillPayableTotal();
  const amtEls = [...document.querySelectorAll('.bsplit-amt')];
  if (!amtEls.length) return;

  if (amtEls.length === 1) {
    const only = amtEls[0];
    if (only.dataset.manual !== '1') {
      only.value = total > 0 ? total.toFixed(3) : '';
      only.dataset.manual = '0';
    }
    return;
  }

  const manualEls = amtEls.filter(el => el.dataset.manual === '1');
  const autoEls = amtEls.filter(el => el.dataset.manual !== '1');
  if (!autoEls.length) return;

  const manualSum = manualEls.reduce((s,el)=>s + (parseFloat(el.value)||0), 0);
  let remaining = Math.max(0, total - manualSum);

  autoEls.forEach((el, idx) => {
    if (idx === 0) el.value = total > 0 ? remaining.toFixed(3) : '';
    else el.value = '';
    el.dataset.manual = '0';
  });
}
function billUpdateSplitBalance() {
  const total = getBillPayableTotal();
  const splitsTotal = [...document.querySelectorAll('.bsplit-amt')].reduce((a,el)=>a+(parseFloat(el.value)||0),0);
  const bal = total - splitsTotal;
  const el = document.getElementById('billSplitBalance');
  if (!el) return;
  if (total === 0) { el.textContent=''; return; }
  if (Math.abs(bal) < 0.01) { el.textContent='Balanced'; el.style.color='var(--c-success)'; }
  else if (bal > 0) { el.textContent=`KD ${bal.toFixed(3)} unallocated`; el.style.color='var(--c-warning,orange)'; }
  else { el.textContent=`KD ${Math.abs(bal).toFixed(3)} over`; el.style.color='var(--c-danger)'; }
}
// Toggle payment fields in the bill modal when total is zero
window._checkBillPaymentUI = function() {
  const total = getBillPayableTotal();
  const note = document.getElementById('billAutoPaidNote');
  const splitWrap = document.getElementById('billSplitWrap');
  const splitRows = document.getElementById('billSplitRows');
  if (splitRows && !splitRows.children.length && total > 0) billAddSplitRow();
  if (total === 0) {
    if (splitWrap) splitWrap.style.display = 'none';
    if (note) note.style.display = 'block';
  } else {
    if (splitWrap) splitWrap.style.display = '';
    if (note) note.style.display = 'none';
    billAutoAllocateSplits();
    billUpdateSplitBalance();
  }
};

function getBillPayableTotal() {
  const items = (_billPaymentMode === 'newOnly')
    ? (_billLineItems||[]).filter(i => !i._locked)
    : (_billLineItems||[]);
  const subtotal = items.reduce((s,i)=>s + (parseFloat(i.amount)||0),0);
  const discAmt = (getCurrentBillDiscount().amount || 0);
  return Math.max(0, parseFloat((subtotal - discAmt).toFixed(3)));
}

function getCurrentBillDiscount() {
  const subtotal = (_billLineItems||[]).reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
  const discSel = document.getElementById('billDiscountSelect');
  const openDiscEl = document.getElementById('billOpenDiscAmt');
  const selOpt = discSel?.selectedOptions[0] || null;
  const id = discSel?.value || '';
  const type = selOpt?.dataset?.type || '';
  const val = parseFloat(selOpt?.dataset?.value || 0) || 0;
  const maxLim = parseFloat(selOpt?.dataset?.max || 0) || 0;

  let amount = 0;
  let label = '';
  if (type === 'percentage') {
    amount = parseFloat(((subtotal * val) / 100).toFixed(3));
    if (maxLim > 0) amount = Math.min(amount, maxLim);
    label = selOpt?.textContent || '';
  } else if (type === 'fixed') {
    amount = Math.min(val, subtotal);
    label = selOpt?.textContent || '';
  } else if (type === 'open') {
    amount = Math.min(parseFloat(openDiscEl?.value || 0) || 0, subtotal);
    label = 'Manual Discount';
  }
  amount = Math.max(0, parseFloat(amount.toFixed(3)));
  return { id, type, amount, label };
}

let billPatTimer = null;
function searchPatientBill(q) {
  clearTimeout(billPatTimer);
  if (q.length < 1) { document.getElementById('billPatDropdown').style.display='none'; return; }
  billPatTimer = setTimeout(async () => {
    const list = await apiFetch(`/api/patients?search=${encodeURIComponent(q)}`);
    const dd = document.getElementById('billPatDropdown');
    if (!list.length) { dd.style.display='none'; return; }
    dd.innerHTML = list.map(p =>
      `<div onmousedown="selectBillPatient(${p.id},'${escHtml(p.name)}')">
         <strong>${escHtml(p.name)}</strong> <span class="text-muted">${escHtml(p.phone||'')}</span>
       </div>`).join('');
    dd.style.display='block';
  }, 250);
}
function selectBillPatient(id, name) {
  document.getElementById('billPatientId').value = id;
  document.getElementById('billPatSearch').value = name;
  document.getElementById('billPatLabel').textContent = `Selected: ${name}`;
  document.getElementById('billPatDropdown').style.display='none';
  loadBillPackageSessions(id);
  loadPendingServicesAlert(id);
}
async function loadPendingServicesAlert(patientId) {
  const alertEl = document.getElementById('billPendingServicesAlert');
  if (!alertEl || !patientId) return;
  alertEl.style.display = 'none';
  alertEl.innerHTML = '';
  try {
    const data = await apiFetch(`/api/patients/${patientId}/pending-services`);
    if (!data.pending_count) return;
    alertEl.style.display = 'block';
    alertEl.innerHTML = `
      <div style="background:#fff3e0;border:2px solid #e65100;border-radius:8px;padding:10px 14px;margin-bottom:12px">
        <div style="font-weight:700;color:#bf360c;margin-bottom:6px;font-size:14px">&#9888; ${data.pending_count} Pending Service(s) from Previous Visit(s)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${data.items.map(it => `
            <span style="background:#fff;border:1px solid #bf360c;border-radius:4px;padding:3px 8px;font-size:12px;display:inline-flex;align-items:center;gap:6px">
              <span style="color:${it.service_status==='In Progress'?'#1565c0':'#e65100'};font-weight:700">${it.service_status==='In Progress'?'&#9654;':'&#9679;'}</span>
              <span style="color:#212121;font-weight:600">${escHtml(it.service_name)}</span>
              <span style="color:#555;font-size:11px">${escHtml(it.bill_number)}</span>
              <button type="button" onclick="viewBillModal(${it.bill_id})" style="background:none;border:none;color:#1565c0;cursor:pointer;font-size:11px;font-weight:700;text-decoration:underline">View</button>
            </span>`).join('')}
        </div>
      </div>`;
  } catch (_) { /* ignore */ }
}
async function loadBillPackageSessions(patientId) {
  const el = document.getElementById('billPkgSessionContent');
  if (!el || !patientId) return;
  try {
    const list = await apiFetch(`/api/patient-packages?patient_id=${patientId}&status=Active`);
    window._billPkgSessionList = list;
    if (!list.length) {
      el.innerHTML = '<p class="text-muted text-sm p-2">No active package subscriptions for this patient</p>';
      return;
    }
    el.innerHTML = list.map(pp => {
      const totalUsed  = pp.services.reduce((a,s)=>a+(s.used||0),0);
      const totalSess  = pp.services.reduce((a,s)=>a+(s.total||0),0);
      const pct = totalSess > 0 ? Math.min(100, Math.round(totalUsed/totalSess*100)) : 0;
      return `
      <div class="bps-pkg-card" id="bpsPkg-${pp.id}">
        <div class="bps-pkg-header">
          <div>
            <div class="bps-pkg-name">${escHtml(pp.package_name)}</div>
            <div class="bps-pkg-meta">${totalUsed}/${totalSess} sessions used</div>
          </div>
          <div class="bps-pkg-pct">${100-pct}% left</div>
        </div>
        <div class="bps-svc-list">
          ${pp.services.map(svc => {
            const remaining = svc.total - (svc.used||0);
            const done = remaining <= 0;
            return `
            <div class="bps-svc-row${done ? ' bps-svc-done' : ''}" id="bpsSvcRow-${pp.id}-${svc.service_id}">
              <div class="bps-svc-info">
                <span class="bps-svc-name">${escHtml(svc.service_name)}</span>
                <span class="bps-svc-rem ${done?'bps-rem-zero':'bps-rem-ok'}">${remaining} of ${svc.total} left</span>
              </div>
              ${done ? `<span class="bps-done-label">All used</span>` : `
              <div class="bps-stepper" id="bpsStepper-${pp.id}-${svc.service_id}">
                <button type="button" class="bps-step-btn" onclick="bpsStep(${pp.id},${svc.service_id},-1,${remaining})">-</button>
                <span class="bps-step-val" id="bpsQty-${pp.id}-${svc.service_id}">0</span>
                <button type="button" class="bps-step-btn bps-step-plus" onclick="bpsStep(${pp.id},${svc.service_id},1,${remaining})">+</button>
              </div>
              <button type="button" class="bps-add-btn${_billLineItems.some(i=>i.type==='pkg_session'&&i.ref_id===pp.id&&i.service_id===svc.service_id)?' bps-add-active':''}"
                id="bpsAddBtn-${pp.id}-${svc.service_id}"
                onclick="bpsToggleAdd(${pp.id},${svc.service_id},'${escHtml(svc.service_name).replace(/'/g,"\\'")}','${escHtml(pp.package_name).replace(/'/g,"\\'")}',${remaining})">
                ${_billLineItems.some(i=>i.type==='pkg_session'&&i.ref_id===pp.id&&i.service_id===svc.service_id) ? 'Added' : '+ Add'}
              </button>`}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<p class="text-muted text-sm p-2">Could not load package sessions</p>';
  }
}

function bpsStep(pkgId, svcId, delta, remaining) {
  const el = document.getElementById(`bpsQty-${pkgId}-${svcId}`);
  if (!el) return;
  let val = parseInt(el.textContent)||0;
  val = Math.min(remaining, Math.max(0, val + delta));
  el.textContent = val;
  // If value > 0 and already added, update qty live
  const lineIdx = _billLineItems.findIndex(i=>i.type==='pkg_session'&&i.ref_id===pkgId&&i.service_id===svcId);
  if (lineIdx >= 0) {
    const pp = (window._billPkgSessionList||[]).find(p=>p.id===pkgId);
    const svc = pp ? pp.services.find(s=>s.service_id===svcId) : null;
    if (!val) {
      // remove if stepped to 0
      _billLineItems.splice(lineIdx, 1);
      const si = _billPkgSessions.findIndex(s=>s.patient_package_id===pkgId);
      if (si>=0) { _billPkgSessions[si].service_ids=_billPkgSessions[si].service_ids.filter(id=>id!==svcId); if(!_billPkgSessions[si].service_ids.length) _billPkgSessions.splice(si,1); }
      const btn = document.getElementById(`bpsAddBtn-${pkgId}-${svcId}`);
      if (btn) { btn.textContent='+ Add'; btn.classList.remove('bps-add-active'); }
    } else {
      const qtyLabel = val > 1 ? ` -${val}` : '';
      const svcName = svc ? svc.service_name : '';
      const pkgName = pp ? pp.package_name : '';
      _billLineItems[lineIdx].name = `${svcName}${qtyLabel} [${pkgName}]`;
      _billLineItems[lineIdx].qty = val;
      const si = _billPkgSessions.findIndex(s=>s.patient_package_id===pkgId);
      if (si>=0) { if(!_billPkgSessions[si].service_quantities) _billPkgSessions[si].service_quantities={}; _billPkgSessions[si].service_quantities[svcId]=val; }
    }
    renderBillItemsList();
  }
}

function bpsToggleAdd(pkgId, svcId, svcName, pkgName, remaining) {
  const qtyEl = document.getElementById(`bpsQty-${pkgId}-${svcId}`);
  let qty = qtyEl ? (parseInt(qtyEl.textContent)||0) : 0;
  if (qty === 0) qty = 1; // default to 1 if not set
  if (qtyEl) qtyEl.textContent = qty;

  const btn = document.getElementById(`bpsAddBtn-${pkgId}-${svcId}`);
  const lineIdx = _billLineItems.findIndex(i=>i.type==='pkg_session'&&i.ref_id===pkgId&&i.service_id===svcId);
  if (lineIdx >= 0) {
    // remove
    _billLineItems.splice(lineIdx, 1);
    const si = _billPkgSessions.findIndex(s=>s.patient_package_id===pkgId);
    if (si>=0) { _billPkgSessions[si].service_ids=_billPkgSessions[si].service_ids.filter(id=>id!==svcId); if(!_billPkgSessions[si].service_ids.length) _billPkgSessions.splice(si,1); }
    if (btn) { btn.textContent='+ Add'; btn.classList.remove('bps-add-active'); }
    if (qtyEl) qtyEl.textContent = '0';
  } else {
    // add
    const qtyLabel = qty > 1 ? ` -${qty}` : '';
    _billLineItems.push({ ref_id: pkgId, service_id: svcId, name: `${svcName}${qtyLabel} [${pkgName}]`, amount: 0, type: 'pkg_session', qty });
    const si = _billPkgSessions.findIndex(s=>s.patient_package_id===pkgId);
    if (si>=0) { _billPkgSessions[si].service_ids.push(svcId); if(!_billPkgSessions[si].service_quantities) _billPkgSessions[si].service_quantities={}; _billPkgSessions[si].service_quantities[svcId]=qty; }
    else _billPkgSessions.push({ patient_package_id: pkgId, service_ids:[svcId], service_quantities:{[svcId]:qty} });
    if (btn) { btn.textContent='Added'; btn.classList.add('bps-add-active'); }
  }
  renderBillItemsList();
}

async function openEditBillModal(id) {
  _billPaymentMode = 'full';
  const b = await apiFetch(`/api/bills/${id}`);
  if (['Refunded','Partially Refunded'].includes(String(b.payment_status || ''))) {
    toast('This bill cannot be edited because a refund has already been recorded.', 'error');
    return;
  }
  if (String(b.payment_status || '') === 'Cancelled') {
    toast('Cancelled bills cannot be edited.', 'error');
    return;
  }
  _billLineItems = Array.isArray(b.line_items) ? b.line_items.map(i => ({...i})) : [];
  // If old-style bill with no line_items, convert to line items
  if (!_billLineItems.length) {
    if (b.consultation_fee) _billLineItems.push({ name:'Consultation Fee', amount:b.consultation_fee, type:'custom' });
    if (b.medicine_charge)  _billLineItems.push({ name:'Medicine Charges',  amount:b.medicine_charge,  type:'custom' });
    if (b.other_charges)    _billLineItems.push({ name:'Other Charges',     amount:b.other_charges,    type:'custom' });
  }
  let payMethods = [];
  try { payMethods = (await apiFetch('/api/payment-methods')).filter(m=>m.active).map(m=>m.name); } catch {}
  if (!payMethods.length) payMethods = ['Cash','Card','UPI','Online'];
  if (!payMethods.includes(b.payment_method)) payMethods.unshift(b.payment_method);

  // Fetch discounts for dropdown
  let discountsRaw = [];
  try { discountsRaw = await apiFetch('/api/discounts'); } catch {}
  const todayISO = new Date().toISOString().slice(0,10);
  const activeDiscounts = (discountsRaw||[]).filter(d => d.active !== false && (!d.valid_from || d.valid_from <= todayISO) && (!d.valid_to || d.valid_to >= todayISO));
  let editAttachments = [];
  try { editAttachments = await apiFetch(`/api/bills/${id}/attachments`); } catch {}
  showModal(`Edit Receipt - ${escHtml(b.patient_name)}`, `
    <form id="editBillForm">
      <div class="form-group"><label>Patient</label><input value="${escHtml(b.patient_name)}" disabled/></div>
      <div class="form-group">
        <label>Line Items</label>
        <div id="billItemsList" class="bill-items-list"></div>
        <div class="bill-total-row"><span>Total</span><strong id="billTotalAmt">KD 0.00</strong></div>
        <div class="bill-custom-row" style="margin-top:8px">
          <input id="customItemName" placeholder="Add custom item description"/>
          <div class="num-stepper" style="width:140px;flex-shrink:0"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input id="customItemAmt" type="number" min="0" step="0.001" placeholder="Amount"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div>
          <button type="button" class="btn btn-sm btn-primary" onclick="billAddCustomItem()">${IC.plus} Add</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Payment Method</label>
          <select name="payment_method">${payMethods.map(m=>`<option${m===b.payment_method?' selected':''}>${escHtml(m)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Payment Status</label>
          <select name="payment_status">
            <option${b.payment_status==='Pending'?' selected':''}>Pending</option>
            <option${b.payment_status==='Paid'?' selected':''}>Paid</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Discount</label>
          <select name="discount_id" id="editBillDiscountSelect">
            <option value="" data-type="" data-value="0">Select Discount</option>
            ${activeDiscounts.map(d => {
              const label = d.type==='percentage'
                ? `${escHtml(d.name)} (${parseFloat(d.value||0).toFixed(2)}%)`
                : d.type==='fixed'
                  ? `${escHtml(d.name)} (KD ${parseFloat(d.value||0).toFixed(3)})`
                  : `${escHtml(d.name)} (Open)`;
              return `<option value="${d.id}" data-type="${escHtml(d.type)}" data-value="${parseFloat(d.value||0)}" data-max="${d.max_limit!=null ? parseFloat(d.max_limit) : ''}"${String(d.id)===String(b.discount_id)?' selected':''}>${label}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group" id="editBillOpenDiscWrap" style="display:${b.discount_type==='open'?'':'none'}">
          <label>Manual Discount Amount (KD)</label>
          <input name="discount_amount" id="editBillOpenDiscAmt" type="number" min="0" step="0.001" value="${b.discount_type==='open'?parseFloat(b.discount_amount||0):''}"/>
        </div>
      </div>
    </form>
    <hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <label style="color:#666;font-size:12px;font-weight:700">ATTACHMENTS</label>
        <button type="button" class="btn btn-sm btn-primary" onclick="billPickAttachment(${id})" style="font-size:12px;padding:3px 10px">+ Add</button>
      </div>
      <input type="file" id="billAttachInput_${id}" accept="*/*" style="display:none" onchange="billHandleAttachFile(${id}, this)"/>
      <div id="billAttachList_${id}">${renderBillAttachList(editAttachments, id)}</div>
    </div>`,
    async () => {
      const f = document.getElementById('editBillForm');
      const body = Object.fromEntries(new FormData(f));
      if (!_billLineItems.length) { toast('Please add at least one item','error'); return false; }
      body.line_items = _billLineItems;
      // Discount logic
      const sel = f.querySelector('#editBillDiscountSelect');
      const selectedOpt = sel.options[sel.selectedIndex];
      body.discount_id = sel.value || null;
      body.discount_type = selectedOpt.getAttribute('data-type') || null;
      body.discount_label = selectedOpt.textContent || '';
      if (body.discount_type === 'open') {
        body.discount_amount = parseFloat(f.querySelector('#editBillOpenDiscAmt').value) || 0;
      } else if (body.discount_type === 'percentage') {
        const perc = parseFloat(selectedOpt.getAttribute('data-value')) || 0;
        const subtotal = (_billLineItems||[]).reduce((s,i)=>s + (parseFloat(i.amount)||0), 0);
        body.discount_amount = parseFloat(((subtotal * perc) / 100).toFixed(3));
      } else if (body.discount_type === 'fixed') {
        body.discount_amount = parseFloat(selectedOpt.getAttribute('data-value')) || 0;
      } else {
        body.discount_amount = 0;
      }
      try {
        await apiFetch(`/api/bills/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast('Receipt updated', 'success');
        closeModal();
        billing(); // Refresh bill list to show updated discount/total
      } catch(e) { toast(e.message, 'error'); return false; }
    });
  // Show/hide open discount field on change
  setTimeout(() => {
    const sel = document.getElementById('editBillDiscountSelect');
    if (sel) {
      sel.addEventListener('change', function() {
        const type = sel.options[sel.selectedIndex].getAttribute('data-type');
        document.getElementById('editBillOpenDiscWrap').style.display = (type === 'open') ? '' : 'none';
      });
    }
  }, 0);
  // Render existing items after modal is in DOM
  setTimeout(() => renderBillItemsList(), 0);
}

async function openCancelBillModal(id) {
  let b;
  // Accept pre-fetched bill if provided (for instant UI update after save)
  if (arguments.length > 1 && arguments[1]) {
    b = arguments[1];
  } else {
    b = await apiFetch(`/api/bills/${id}`);
  }
  if (['Refunded','Partially Refunded'].includes(String(b.payment_status || ''))) {
    toast('Refunded bills cannot be cancelled.', 'error');
    return;
  }
  if (String(b.payment_status || '') === 'Cancelled') {
    toast('Bill is already cancelled.', 'warning');
    return;
  }
  showModal(`Cancel Bill - ${escHtml(b.bill_number || ('Bill #' + id))}`, `
    <form id="cancelBillForm">
      <div style="margin-bottom:12px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px">
        <div><strong>Patient:</strong> ${escHtml(b.patient_name || '-')}</div>
        <div><strong>Total:</strong> KD ${parseFloat(b.total || 0).toFixed(3)}</div>
        <div><strong>Status:</strong> ${statusBadge(b.payment_status || 'Pending')}</div>
      </div>
      <div class="form-group">
        <label>Cancellation Reason *</label>
        <textarea id="cancelBillReason" rows="4" placeholder="Enter reason for cancelling this bill" required></textarea>
      </div>
      <div class="text-sm text-muted">Cancelled bills are excluded from user collection totals and cannot be edited or refunded.</div>
    </form>`,
    async () => {
      const reason = document.getElementById('cancelBillReason')?.value?.trim();
      if (!reason) { toast('Cancellation reason is required.', 'error'); return false; }
      try {
        await apiFetch(`/api/bills/${id}/cancel`, { method:'POST', body: JSON.stringify({ reason }) });
        toast('Bill cancelled', 'success');
        closeModal();
        billing();
      } catch (e) { toast(e.message, 'error'); return false; }
    });
}

async function openRefundModal(billId) {
  const b = await apiFetch(`/api/bills/${billId}`);
  let payMethods = [];
  try { payMethods = (await apiFetch('/api/payment-methods')).filter(m=>m.active).map(m=>m.name); } catch {}
  if (!payMethods.length) payMethods = ['Cash','Card','UPI','Online'];
  // Existing refunds
  let existingRefunds = [];
  try { existingRefunds = await apiFetch(`/api/refunds?bill_id=${billId}`); } catch {}
  const totalRefunded = existingRefunds.reduce((s,r) => s + (parseFloat(r.refund_amount)||0), 0);
  const available = parseFloat((parseFloat(b.total||0) - totalRefunded).toFixed(3));
  if (available <= 0) { toast('This bill has already been fully refunded','warning'); return; }
  
  const items = Array.isArray(b.line_items) ? b.line_items : [];
  
  showModal(`Refund - ${escHtml(b.bill_number)} - ${escHtml(b.patient_name)}`, `
    <div style="margin-bottom:12px;padding:10px;background:var(--bg-card);border-radius:6px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        <div><span style="color:var(--text-muted)">Bill Total:</span> <strong>KD ${parseFloat(b.total||0).toFixed(3)}</strong></div>
        <div><span style="color:var(--text-muted)">Already Refunded:</span> <strong>KD ${totalRefunded.toFixed(3)}</strong></div>
        <div><span style="color:var(--text-muted)">Available to Refund:</span> <strong style="color:#e53935">KD ${available.toFixed(3)}</strong></div>
      </div>
    </div>
    <form id="refundForm">
      <div class="form-row">
        <div class="form-group"><label>Refund Type *</label>
          <select name="refund_type">
            <option value="partial">Partial Refund</option>
            <option value="full">Full Refund</option>
          </select>
        </div>
        <div class="form-group"><label>Refund Amount (KD) *</label>
          <input name="refund_amount" type="number" min="0.001" max="${available}" step="0.001" placeholder="Max KD ${available.toFixed(3)}" required/>
        </div>
      </div>
      <div class="form-group"><label>Payment Type for Refund *</label>
        <select name="refund_payment_type">${payMethods.map(m=>`<option>${escHtml(m)}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Reason for Refund *</label><textarea name="refund_reason" rows="3" placeholder="Mandatory: explain refund reason..." required></textarea></div>
      ${items.length ? `<div class="form-group"><label>Items (select refunded items)</label><div style="border:1px solid var(--border);border-radius:6px;padding:8px;max-height:160px;overflow-y:auto">${items.map((item,i) => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0"><input type="checkbox" name="ref_item_${i}" value="${escHtml(item.name||'')}" checked/><span>${escHtml(item.name||'')}</span><span style="margin-left:auto;font-size:12px;color:var(--text-muted)">KD ${parseFloat(item.amount||0).toFixed(3)}</span></label>`).join('')}</div></div>` : ''}
    </form>`,
    async () => {
      const f = document.getElementById('refundForm');
      const body = Object.fromEntries(new FormData(f));
      if (!body.refund_reason || !String(body.refund_reason).trim()) { toast('Refund reason is required','error'); return false; }
      const amt = parseFloat(body.refund_amount) || 0;
      if (amt <= 0 || amt > available) { toast(`Amount must be between 0 and KD ${available.toFixed(3)}`,'error'); return false; }
      // Collect selected items
      const refundItems = items.map((item,i) => f.querySelector(`[name="ref_item_${i}"]`)?.checked ? item.name : null).filter(Boolean);
      body.refund_items = refundItems;
      body.refund_amount = amt;
      try {
        await apiFetch(`/api/bills/${billId}/refund`, { method:'POST', body:JSON.stringify(body) });
        toast('Refund recorded successfully','success');
        closeModal(); billing();
      } catch(e) { toast(e.message,'error'); return false; }
    });
}

async function markBillPaid(id) {
  const b = await apiFetch(`/api/bills/${id}`);
  try {
    await apiFetch(`/api/bills/${id}`, { method: 'PUT', body: JSON.stringify({ ...b, payment_status: 'Paid' }) });
    await refreshAppointmentViewsAfterBilling();
    const created = await autoCreateFollowUpFromContext(
      parseInt(b.patient_id, 10),
      parseInt(b.doctor_id, 10) || null,
      parseInt(b.appointment_id, 10) || null,
      'Post billing follow-up',
      true
    );
    if (created) {
      toast('Bill marked as paid and follow-up created', 'success');
    } else {
      toast('Bill marked as paid. Could not auto-create follow-up.', 'error');
      navigate('follow-ups');
    }
  } catch(e) { toast(e.message, 'error'); }
}

function canPrintBill(createdAt) {
  if (!createdAt) return can('billing.view');
  const billDate = String(createdAt).slice(0, 10);
  const todayDate = new Date().toISOString().slice(0, 10);
  if (billDate === todayDate) return can('billing.view'); // today's bill - any user with billing.view can print
  return can('billing.print_history'); // older bill - requires explicit permission
}

async function printBill(id) {
  const b = await apiFetch(`/api/bills/${id}`);
  let refunds = [];
  try { refunds = await apiFetch(`/api/refunds?bill_id=${id}`); } catch {}
  let cancelledByName = '-';
  if (b.cancelled_by) {
    try {
      const users = await apiFetch('/api/users');
      const user = users.find(u => u.id === parseInt(b.cancelled_by));
      if (user) cancelledByName = user.name || user.username || '-';
    } catch(e) { /* ignore */ }
  }
  const billDate = String(b.created_at || '').slice(0, 10);
  const todayDate = new Date().toISOString().slice(0, 10);
  if (billDate !== todayDate && !can('billing.print_history')) {
    toast('You do not have permission to print previous bills.', 'error');
    return;
  }
  
  let createdByName = '-';
  if (b.created_by) {
    try {
      const users = await apiFetch('/api/users');
      const user = users.find(u => u.id === parseInt(b.created_by));
      if (user) createdByName = user.name || user.username || '-';
    } catch(e) { /* ignore */ }
  }
  
  const printArea = document.getElementById('printArea');
  printArea.classList.remove('hidden');
  let itemRows = '';
  const pkgProgressByPkgId = new Map();
  let printPatientPackages = [];
  if (b.patient_id && Array.isArray(b.line_items) && b.line_items.some(li => li && (li.type === 'pkg_session' || li.type === 'package') && li.ref_id)) {
    try {
      const pkgIds = [...new Set(b.line_items
        .filter(li => li && li.type === 'pkg_session' && li.ref_id)
        .map(li => parseInt(li.ref_id))
        .filter(Boolean))];
      if (pkgIds.length) {
        const pkgRows = await Promise.all(pkgIds.map(pid => apiFetch(`/api/patient-packages/${pid}`).catch(() => null)));
        pkgRows.filter(Boolean).forEach(pp => pkgProgressByPkgId.set(parseInt(pp.id), pp));
      }
      printPatientPackages = await apiFetch(`/api/patient-packages?patient_id=${b.patient_id}`).catch(() => []);
    } catch (_) { /* ignore */ }
  }
  if (b.line_items && b.line_items.length) {
    itemRows = b.line_items.map(item => {
      const amount = parseFloat(item.amount || 0) || 0;
      const qty = parseFloat(item.qty || item.quantity || 1) || 1;
      const unit = item.type === 'product'
        ? (item.unit || 'pcs')
        : (item.type === 'pkg_session' ? 'sess' : (item.type === 'package' ? 'pkg' : 'svc'));
      const rate = qty > 0 ? (amount / qty) : amount;
      const svcStatus = item.service_status || 'Completed';
      const serviceNames = Array.isArray(item.selected_service_names) ? item.selected_service_names.filter(Boolean) : [];
      let descHtml = escHtml(item.name || '');

      if (item.type === 'package' && item.package_name) {
        const sub = serviceNames.length
          ? escHtml(serviceNames.join(', '))
          : escHtml(String(item.name || '').replace(`${item.package_name} - `, '').replace(item.package_name, '').trim());
        const usage = getPackageUsageDetailLabel(item, b, printPatientPackages);
        const usageHtml = usage ? `<div style="font-size:13px;color:#111;margin-top:2px"><strong>${escHtml(usage)}</strong></div>` : '';
        descHtml = `<div style="font-weight:700;font-size:16px">${escHtml(item.package_name)}</div>${sub ? `<div style="font-size:14px;color:#333;margin-top:2px">${sub}</div>` : ''}${usageHtml}`;
      } else if (item.type === 'pkg_session' && item.package_name) {
        const sub = serviceNames.length ? escHtml(serviceNames.join(', ')) : escHtml(item.name || '');
        const pp = getPkgSessionPackageForItem(item, b, pkgProgressByPkgId, printPatientPackages);
        const progress = getPkgSessionProgressLabel(item, b, pp);
        const progressHtml = progress ? `<div style="font-size:13px;color:#111;margin-top:2px"><strong>${escHtml(progress)}</strong></div>` : '';
        descHtml = `<div style="font-weight:700;font-size:16px">${escHtml(item.package_name)}</div><div style="font-size:14px;color:#333;margin-top:2px">${sub}</div>${progressHtml}`;
      }

      if (item.type !== 'package') {
        const statusColor = svcStatus === 'Completed' ? '#1b5e20' : (svcStatus === 'In Progress' ? '#0d47a1' : '#b45309');
        const statusIcon = svcStatus === 'Completed' ? '&#10003;' : (svcStatus === 'In Progress' ? '&#9654;' : '&#9679;');
        const completionText = item.completion_date ? ` - ${escHtml(String(item.completion_date).slice(0, 10))}` : '';
        descHtml += `<div style="font-size:13px;color:${statusColor};margin-top:3px"><strong>${statusIcon} ${escHtml(svcStatus)}${completionText}</strong></div>`;
      }

      return `<tr style="border-bottom:1px solid #bbb">
        <td style="padding:6px 3px;font-size:15px;color:#000">${descHtml}</td>
        <td style="padding:6px 3px;font-size:15px;text-align:right;color:#000;white-space:nowrap">${Number.isInteger(qty) || qty % 1 === 0 ? Math.round(qty) : qty.toFixed(3)}</td>
        <td style="padding:6px 3px;font-size:15px;text-align:center;color:#000">${escHtml(unit)}</td>
        <td style="padding:6px 3px;font-size:15px;text-align:right;color:#000">${rate.toFixed(3)}</td>
        <td style="padding:6px 3px;font-size:15px;text-align:right;color:#000">KD ${amount.toFixed(3)}</td>
      </tr>`;
    }).join('');
  } else {
    if (b.consultation_fee) itemRows += `<tr><td>Consultation Fee</td><td style="text-align:right">1</td><td style="text-align:center">svc</td><td style="text-align:right;white-space:nowrap">KD ${parseFloat(b.consultation_fee).toFixed(3)}</td><td style="text-align:right;white-space:nowrap">KD ${parseFloat(b.consultation_fee).toFixed(3)}</td></tr>`;
    if (b.medicine_charge)  itemRows += `<tr><td>Medicine Charges</td><td style="text-align:right">1</td><td style="text-align:center">pcs</td><td style="text-align:right;white-space:nowrap">KD ${parseFloat(b.medicine_charge).toFixed(3)}</td><td style="text-align:right;white-space:nowrap">KD ${parseFloat(b.medicine_charge).toFixed(3)}</td></tr>`;
    if (b.other_charges)    itemRows += `<tr><td>Other Charges</td><td style="text-align:right">1</td><td style="text-align:center">pcs</td><td style="text-align:right;white-space:nowrap">KD ${parseFloat(b.other_charges).toFixed(3)}</td><td style="text-align:right;white-space:nowrap">KD ${parseFloat(b.other_charges).toFixed(3)}</td></tr>`;
  }
  const paymentSection = (b.payment_splits && b.payment_splits.length > 1)
    ? `<table style="width:100%;border-collapse:collapse;margin-top:6px">
        <thead><tr><th style="text-align:left;padding:6px 3px;font-size:17px;color:#000;border-bottom:1px solid #999">Payment Method</th><th style="text-align:right;padding:6px 3px;font-size:17px;color:#000;border-bottom:1px solid #999">Amount</th></tr></thead>
        <tbody>${b.payment_splits.map(s=>`<tr><td style="padding:6px 3px;font-size:17px;color:#000">${escHtml(s.method)}</td><td style="padding:6px 3px;font-size:17px;text-align:right;color:#000">KD ${parseFloat(s.amount).toFixed(3)}</td></tr>`).join('')}</tbody>
       </table>`
    : `<p style="margin:8px 0;color:#000;font-size:18px;line-height:1.35"><strong>Payment Method:</strong> ${escHtml(b.payment_method||'-')} &nbsp;|&nbsp; <strong>Status:</strong> ${escHtml(b.payment_status||'-')}</p>`;
  const hasDiscount = (parseFloat(b.discount_amount || 0) || 0) > 0;
  const hasRefunds = Array.isArray(refunds) && refunds.length > 0;
  const isCancelled = String(b.payment_status || '') === 'Cancelled';
  const discountTypeRaw = String(b.discount_type || '').toLowerCase();
  const discountTypeLabel = discountTypeRaw === 'percentage'
    ? 'Percentage'
    : (discountTypeRaw === 'fixed' ? 'Fixed Amount' : (discountTypeRaw === 'open' ? 'Open / Manual' : (String(b.discount_label || '').includes('%') ? 'Percentage' : 'Discount')));
  const refundDetailsHtml = hasRefunds ? `
    <div style="margin-top:12px;border-top:2px dashed #b71c1c;padding-top:10px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#b71c1c">REFUND DETAILS</p>
      ${refunds.map((r, idx) => {
        const refundItems = Array.isArray(r.refund_items) ? r.refund_items.filter(Boolean) : [];
        return `<div style="margin-bottom:${idx === refunds.length - 1 ? '0' : '10px'};padding:8px 0;${idx < refunds.length - 1 ? 'border-bottom:1px solid #ddd;' : ''}">
          <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Refund ${idx + 1}:</strong> ${escHtml(String(r.refund_type || 'partial').replace(/\b\w/g, c => c.toUpperCase()))}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Refund Date:</strong> ${escHtml(formatDateTime(r.created_at || ''))}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Refund Amount:</strong> <span style="color:#b71c1c;font-weight:700">KD ${parseFloat(r.refund_amount || 0).toFixed(3)}</span></p>
          <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Refund Payment Type:</strong> ${escHtml(r.refund_payment_type || '-')}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Refunded By:</strong> ${escHtml(r.refunded_by_name || '-')}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Reason:</strong> ${escHtml(r.refund_reason || '-')}</p>
          ${refundItems.length ? `<p style="margin:0;font-size:14px;color:#000"><strong>Refunded Items:</strong> ${escHtml(refundItems.join(', '))}</p>` : ''}
        </div>`;
      }).join('')}
    </div>` : '';
  const cancellationHtml = isCancelled ? `
    <div style="margin-top:12px;border-top:2px dashed #c62828;padding-top:10px">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#c62828">BILL CANCELLED</p>
      <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Cancelled Date:</strong> ${escHtml(formatDateTime(b.cancelled_at || ''))}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#000"><strong>Cancelled By:</strong> ${escHtml(cancelledByName)}</p>
      <p style="margin:0;font-size:14px;color:#000"><strong>Reason:</strong> ${escHtml(b.cancellation_reason || '-')}</p>
    </div>` : '';

  const clinicCfg = (currentSystem && currentSystem.clinic) ? currentSystem.clinic : {};
  const printClinicName = clinicCfg.clinic_name || 'ClinicMS';
  const printHeader = clinicCfg.receipt_header || clinicCfg.trade_name || 'Clinic Management System';
  const printFooter = clinicCfg.receipt_footer || 'Thank you for visiting our clinic. Get well soon!';
  const logoUrl = String(clinicCfg.logo_url || '').trim();
  const logoHtml = logoUrl
    ? `<img src="${escHtml(logoUrl)}" alt="Clinic Logo" style="max-height:68px;max-width:140px;object-fit:contain;display:block;margin:0 auto 8px" onerror="this.style.display='none'"/>`
    : '';

  printArea.innerHTML = `
    <div style="width:100%;text-align:center;padding:0 0 10px;border-bottom:3px solid #000;margin-bottom:14px;box-sizing:border-box">
      ${logoHtml}
      <h2 style="margin:0 0 3px;font-size:28px;font-weight:700;font-family:Arial,sans-serif;color:#000">${escHtml(printClinicName)}</h2>
      <p style="margin:0;font-size:16px;color:#000">${escHtmlMultiline(printHeader)}</p>
      <p style="margin:5px 0 0;font-size:19px;font-weight:700;color:#000">PAYMENT RECEIPT</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
      <tr>
        <td style="padding:5px 3px;font-size:15px;width:50%;color:#000"><strong>Bill No:</strong> ${escHtml(b.bill_number||'-')}</td>
        <td style="padding:5px 3px;font-size:15px;text-align:right;color:#000"><strong>Date:</strong> ${escHtml(formatDateTime(b.created_at||''))}</td>
      </tr>
      <tr>
        <td style="padding:5px 3px;font-size:15px;color:#000"><strong>Patient:</strong> ${escHtml(b.patient_name||'-')}</td>
        <td style="padding:5px 3px;font-size:15px;text-align:right;color:#000"><strong>MR #:</strong> ${escHtml(b.mr_number||'-')}</td>
      </tr>
      <tr>
        <td style="padding:5px 3px;font-size:15px;color:#000"><strong>Phone:</strong> ${escHtml(b.patient_phone||'-')}</td>
        <td style="padding:5px 3px;font-size:15px;text-align:right;color:#000"><strong>Visit ID:</strong> ${escHtml(b.visit_id||'-')}</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <thead><tr><th style="text-align:left;padding:6px 3px;font-size:15px;background:#e0e0e0;border-bottom:2px solid #000">Description</th><th style="text-align:right;padding:6px 3px;font-size:15px;background:#e0e0e0;border-bottom:2px solid #000;width:50px">Qty</th><th style="text-align:center;padding:6px 3px;font-size:15px;background:#e0e0e0;border-bottom:2px solid #000;width:50px">Unit</th><th style="text-align:right;padding:6px 3px;font-size:15px;background:#e0e0e0;border-bottom:2px solid #000;width:65px">Rate</th><th style="text-align:right;padding:6px 3px;font-size:15px;background:#e0e0e0;border-bottom:2px solid #000;width:65px">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        ${hasDiscount
          ? `<tr style="border-top:2px solid #000"><td colspan="4" style="text-align:right;padding:7px 3px;font-size:15px;color:#000"><strong>Subtotal</strong></td><td style="text-align:right;padding:7px 3px;font-size:15px;color:#000"><strong>KD ${parseFloat(b.subtotal||b.total||0).toFixed(3)}</strong></td></tr>
             <tr><td colspan="4" style="text-align:right;padding:6px 3px;font-size:14px;color:#000"><strong>Discount (${escHtml(discountTypeLabel)})</strong></td><td style="text-align:right;padding:6px 3px;font-size:14px;color:#d32f2f"><strong>- KD ${parseFloat(b.discount_amount||0).toFixed(3)}</strong></td></tr>`
          : ''}
        <tr style="${hasDiscount ? 'border-top:1px solid #bbb' : 'border-top:2px solid #000'}"><td colspan="4" style="text-align:right;padding:7px 3px;font-size:16px;font-weight:700;color:#000"><strong>Total</strong></td><td style="text-align:right;padding:7px 3px;font-size:16px;font-weight:700;color:#000;white-space:nowrap"><strong>KD ${parseFloat(b.total||0).toFixed(3)}</strong></td></tr>
      </tfoot>
    </table>
    ${hasDiscount ? `<p style="margin:6px 0;color:#000;font-size:15px;line-height:1.35"><strong>Discount Name:</strong> ${escHtml(b.discount_label||'Discount')} &nbsp;|&nbsp; <strong>Discount Type:</strong> ${escHtml(discountTypeLabel)}</p>` : ''}
    <div id="printPaymentRow">${paymentSection}</div>
    ${refundDetailsHtml}
    ${cancellationHtml}
    <p style="margin:8px 0 0;font-size:15px;color:#000"><strong>Settled By:</strong> ${escHtml(createdByName)}</p>
    <p style="text-align:center;margin-top:12px;font-size:15px;color:#000">${escHtmlMultiline(printFooter)}</p>`;
  // If bill total is zero and appears to be a package-session bill, show original package purchase amount instead of 'Paid (Cash)'
  if ((b.total || 0) === 0 && b.patient_id) {
    try {
      const pps = await apiFetch(`/api/patient-packages?patient_id=${b.patient_id}`).catch(()=>[]);
      // find patient_package which has a session_log entry referencing this bill
      const matched = (pps||[]).find(pp => Array.isArray(pp.session_log) && pp.session_log.some(sl => sl.bill_id === b.id));
      if (matched) {
        const payRow = document.getElementById('printPaymentRow');
        if (payRow) payRow.innerHTML = `<p style="margin-top:16px;font-size:18px;line-height:1.35"><strong>Payment:</strong> Package (paid at time of purchase)</p>`;
      }
    } catch(e) { /* ignore */ }
  }

  // Wait for logo image to load before printing
  if (logoUrl) {
    const logoImg = printArea.querySelector('img');
    if (logoImg) {
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
        if (logoImg.complete) resolve();
      });
    }
  }

  async function captureReceiptImageData() {
    const renderer = (typeof window !== 'undefined' && typeof window.html2canvas === 'function')
      ? window.html2canvas
      : (typeof html2canvas === 'function' ? html2canvas : null);
    if (!renderer) return '';
    const html = String(printArea.innerHTML || '').trim();
    if (!html) return '';

    // Thermal-only readability boost: enlarge inline font sizes for TM receipts.
    const boostedHtml = html.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, (_, n) => {
      const base = parseFloat(n || '0') || 0;
      const next = Math.max(base + 2, base * 1.22);
      return `font-size:${next.toFixed(1)}px`;
    });

    const tempWrap = document.createElement('div');
    tempWrap.style.position = 'fixed';
    tempWrap.style.left = '-10000px';
    tempWrap.style.top = '0';
    tempWrap.style.width = '560px'; // near full 80mm raster width
    tempWrap.style.background = '#ffffff';
    tempWrap.style.padding = '0';
    tempWrap.style.margin = '0';
    tempWrap.style.boxSizing = 'border-box';
    tempWrap.style.zIndex = '-1';
    tempWrap.innerHTML = boostedHtml;
    document.body.appendChild(tempWrap);

    try {
      const canvas = await renderer(tempWrap, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        logging: false
      });
      return canvas.toDataURL('image/png');
    } catch (_) {
      return '';
    } finally {
      tempWrap.remove();
    }
  }

  // Fetch fresh printer config to avoid using stale cached values
  let printerCfg = currentSystem && currentSystem.printer ? { ...currentSystem.printer } : {};
  try {
    const freshCfg = await apiFetch('/api/setup/profile');
    if (freshCfg && freshCfg.printer) printerCfg = freshCfg.printer;
  } catch (_) { /* use cached */ }

  const hasPrinter = printerCfg.printer_name;
  const printMode = printerCfg.print_mode || 'auto';

  if (printMode === 'manual') {
    // --- Manual Print: trigger browser print popup directly ---
    window.print();
    setTimeout(() => printArea.classList.add('hidden'), 500);
    return;
  }

  // --- Auto Print (default) ---
  if (hasPrinter) {
    // Send to backend printer
    try {
      const htmlContent = printArea.innerHTML;
      const isNetworkThermal = String(printerCfg.printer_type || '').toLowerCase() === 'network';
      const imageData = isNetworkThermal ? await captureReceiptImageData() : '';
      if (isNetworkThermal && !imageData) {
        throw new Error('Receipt image capture failed. Please hard refresh and try again.');
      }
      await apiFetch('/api/print/bill', {
        method: 'POST',
        body: JSON.stringify({
          html: htmlContent,
          bill_number: b.bill_number || 'Receipt',
          bill: b,
          settled_by: createdByName,
          image_data: imageData,
          terminal_id: getTerminalId()
        })
      });
      toast('Bill sent to printer.', 'success');
      setTimeout(() => printArea.classList.add('hidden'), 500);
      return;
    } catch (e) {
      toast(`Printer error: ${e.message}. Using browser print dialog.`, 'warning');
    }
  }

  // Fallback to browser print
  window.print();
  setTimeout(() => printArea.classList.add('hidden'), 500);
}

function showManualPrintPreview(bill, onPrint) {
  const previewHtml = document.getElementById('printArea')?.innerHTML || '';

  showModal(`${IC.print} Print Preview`, `
    <div style="border:1px solid var(--border);border-radius:8px;padding:16px;background:#fff;max-height:480px;overflow-y:auto;color:#000">
      ${previewHtml}
    </div>`,
    [
      {
        label: `${IC.print} Print`,
        class: 'btn-primary',
        onclick: () => {
          closeModal();
          onPrint();
        }
      }
    ],
    'modal-lg'
  );
}

async function manualPrintRefreshPrinters() {
  const sel = document.getElementById('manualPrintPrinterSelect');
  const statusEl = document.getElementById('manualPrintStatus');
  if (!sel) return;
  if (statusEl) statusEl.textContent = 'Fetching printers...';
  try {
    const printers = await apiFetch('/api/printers/list');
    const currentVal = sel.value;
    // Keep the "browser print" option and rebuild the rest
    sel.innerHTML = '<option value="">- Browser print (no printer) -</option>';
    if (Array.isArray(printers) && printers.length) {
      printers.forEach(p => {
        const name = (p && (p.name || p.displayName)) ? String(p.name || p.displayName).trim() : String(p || '').trim();
        if (!name) return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = (p && p.displayName) ? p.displayName : name;
        opt.dataset.type = 'usb';
        sel.appendChild(opt);
      });
      if (currentVal) sel.value = currentVal;
      if (statusEl) statusEl.textContent = `? Found ${printers.length} printer(s).`;
    } else {
      if (statusEl) statusEl.textContent = '? No printers found.';
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = `? Error: ${e.message}`;
  }
}

async function viewBillModal(id) {
  const b = await apiFetch(`/api/bills/${id}`);
  const items = Array.isArray(b.line_items) ? b.line_items : [];
  const pkgProgressByPkgId = new Map();
  let viewPatientPackages = [];
  const pkgIds = [...new Set(items.filter(it => it && (it.type === 'pkg_session' || it.type === 'package') && it.ref_id).map(it => parseInt(it.ref_id)).filter(Boolean))];
  if (pkgIds.length) {
    try {
      const pkgRows = await Promise.all(pkgIds.map(pid => apiFetch(`/api/patient-packages/${pid}`).catch(() => null)));
      pkgRows.filter(Boolean).forEach(pp => pkgProgressByPkgId.set(parseInt(pp.id), pp));
    } catch (_) { /* ignore */ }
  }
  if (b.patient_id) {
    try { viewPatientPackages = await apiFetch(`/api/patient-packages?patient_id=${b.patient_id}`).catch(() => []); } catch (_) { /* ignore */ }
  }
  let refunds = [];
  try { refunds = await apiFetch(`/api/refunds?bill_id=${id}`); } catch {}
  let attachments = [];
  try { attachments = await apiFetch(`/api/bills/${id}/attachments`); } catch {}
  let cancelledByName = '-';
  if (b.cancelled_by) {
    try {
      const users = await apiFetch('/api/users');
      const user = users.find(u => u.id === parseInt(b.cancelled_by));
      if (user) cancelledByName = user.name || user.username || '-';
    } catch (e) { /* ignore */ }
  }
  
  let itemsHtml = '';
  if (items.length) {
    itemsHtml = items.map((item, idx) => {
      const amount = parseFloat(item.amount || 0) || 0;
      const qty = parseFloat(item.qty || item.quantity || 1) || 1;
      const unit = item.type === 'product'
        ? (item.unit || 'pcs')
        : (item.type === 'pkg_session' ? 'session' : (item.type === 'package' ? 'package' : 'service'));
      const rate = qty > 0 ? (amount / qty) : amount;
      const name = item.package_name && items.name !== item.package_name ? `${item.package_name} - ${item.name}` : (item.name || '-');
      const packageUsage = item.type === 'package' ? getPackageUsageDetailLabel(item, b, viewPatientPackages) : '';
      const pp = item.type === 'pkg_session'
        ? getPkgSessionPackageForItem(item, b, pkgProgressByPkgId, viewPatientPackages)
        : null;
      const progress = item.type === 'pkg_session'
        ? getPkgSessionProgressLabel(item, b, pp)
        : '';
      const viewExtra = progress || packageUsage;
      const viewName = viewExtra
        ? `${escHtml(name)}<div style="font-size:12px;color:#2f3a4a;margin-top:2px"><strong>${escHtml(viewExtra)}</strong></div>`
        : escHtml(name);
      const svcStatus = item.service_status || 'Completed';
      const isPackageType = item.type === 'package' || item.type === 'pkg_session';
      const statusColor = svcStatus === 'Completed' ? '#16a34a' : (svcStatus === 'In Progress' ? '#2563eb' : '#d97706');
      const statusIcon = svcStatus === 'Completed' ? '&#10003;' : (svcStatus === 'In Progress' ? '&#9654;' : '&#9679;');
      const statusBadgeHtml = isPackageType ? '' : `<div style="margin-top:4px;font-size:11px;color:${statusColor};font-weight:600">${statusIcon} ${escHtml(svcStatus)}${item.completion_date ? ` - ${escHtml(String(item.completion_date).slice(0,10))}` : ''}</div>`;
      const canComplete = !isPackageType && svcStatus !== 'Completed';
      const actionBtn = canComplete ? `<button type="button" onclick="markServiceComplete(${b.id}, ${idx}, '${svcStatus === 'In Progress' ? 'Completed' : 'In Progress'}')" style="background:none;border:1px solid ${statusColor};color:${statusColor};border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;margin-top:4px">${svcStatus === 'In Progress' ? '&#10003; Mark Completed' : '&#9654; Start'}</button>` : (svcStatus === 'Completed' ? `<button type="button" onclick="markServiceComplete(${b.id}, ${idx}, 'Pending')" style="background:none;border:1px solid #999;color:#666;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;margin-top:4px">&#8635; Revert</button>` : '');
      const viewNameWithStatus = `<div>${viewName}${statusBadgeHtml}${actionBtn ? `<div>${actionBtn}</div>` : ''}</div>`;
      return `<tr><td>${viewNameWithStatus}</td><td style="text-align:right">${qty.toFixed(3)}</td><td style="text-align:center">${escHtml(unit)}</td><td style="text-align:right">KD ${rate.toFixed(3)}</td><td style="text-align:right"><strong>KD ${amount.toFixed(3)}</strong></td></tr>`;
    }).join('');
  } else {
    if (b.consultation_fee) itemsHtml += `<tr><td>Consultation Fee</td><td style="text-align:right">1.000</td><td style="text-align:center">service</td><td style="text-align:right">KD ${parseFloat(b.consultation_fee).toFixed(3)}</td><td style="text-align:right"><strong>KD ${parseFloat(b.consultation_fee).toFixed(3)}</strong></td></tr>`;
    if (b.medicine_charge)  itemsHtml += `<tr><td>Medicine Charges</td><td style="text-align:right">1.000</td><td style="text-align:center">item</td><td style="text-align:right">KD ${parseFloat(b.medicine_charge).toFixed(3)}</td><td style="text-align:right"><strong>KD ${parseFloat(b.medicine_charge).toFixed(3)}</strong></td></tr>`;
    if (b.other_charges)    itemsHtml += `<tr><td>Other Charges</td><td style="text-align:right">1.000</td><td style="text-align:center">item</td><td style="text-align:right">KD ${parseFloat(b.other_charges).toFixed(3)}</td><td style="text-align:right"><strong>KD ${parseFloat(b.other_charges).toFixed(3)}</strong></td></tr>`;
  }
  
  const paymentHtml = (b.payment_splits && b.payment_splits.length > 1)
    ? `<div style="margin-top:12px"><strong>Payments:</strong><table style="width:100%;margin-top:6px"><tbody>${b.payment_splits.map(s=>`<tr><td>${escHtml(s.method)}</td><td style="text-align:right">KD ${parseFloat(s.amount).toFixed(3)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div style="margin-top:12px"><strong>Payment Method:</strong> ${escHtml(b.payment_method||'-')} &nbsp;|&nbsp; <strong>Status:</strong> ${statusBadge(b.payment_status||'')}</div>`;
  const discountTypeRaw = String(b.discount_type || '').toLowerCase();
  const discountTypeLabel = discountTypeRaw === 'percentage'
    ? 'Percentage'
    : (discountTypeRaw === 'fixed' ? 'Fixed Amount' : (discountTypeRaw === 'open' ? 'Open / Manual' : (String(b.discount_label || '').includes('%') ? 'Percentage' : 'Discount')));
  const discountHtml = b.discount_amount > 0 ? `
    <div style="margin-top:8px;padding:8px 12px;background:var(--c-danger-bg);border-radius:6px;border:1px solid rgba(239,68,68,.2);font-size:13px;color:var(--text)">
      <strong>Discount Applied:</strong> ${escHtml(b.discount_label||'Discount')} &nbsp;|&nbsp; <span style="color:var(--c-danger)"><strong>- KD ${parseFloat(b.discount_amount||0).toFixed(3)}</strong></span>
      &nbsp;|&nbsp; <strong>Discount Type:</strong> ${escHtml(discountTypeLabel)}
      &nbsp;|&nbsp; <strong>Subtotal:</strong> KD ${parseFloat(b.subtotal||b.total||0).toFixed(3)}
    </div>` : '';
  const refundsHtml = refunds.length ? `
    <hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>
    <label style="color:#e53935;font-size:12px;font-weight:700">REFUND HISTORY</label>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">
      <thead><tr style="background:#fff3f3"><th style="padding:6px;text-align:left;font-size:12px">Date</th><th style="padding:6px;text-align:left;font-size:12px">Type</th><th style="padding:6px;text-align:right;font-size:12px">Amount</th><th style="padding:6px;text-align:left;font-size:12px">Payment</th><th style="padding:6px;text-align:left;font-size:12px">Reason</th><th style="padding:6px;text-align:left;font-size:12px">By</th></tr></thead>
      <tbody>${refunds.map(r=>`<tr>
        <td style="padding:6px;font-size:12px">${escHtml(formatDateTime(r.created_at||''))}</td>
        <td style="padding:6px;font-size:12px">${statusBadge(r.refund_type||'partial')}</td>
        <td style="padding:6px;font-size:12px;text-align:right;color:#e53935"><strong>- KD ${parseFloat(r.refund_amount||0).toFixed(3)}</strong></td>
        <td style="padding:6px;font-size:12px">${escHtml(r.refund_payment_type||'-')}</td>
        <td style="padding:6px;font-size:12px">${escHtml(r.refund_reason||'-')}</td>
        <td style="padding:6px;font-size:12px">${escHtml(r.refunded_by_name||'-')}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';
  const cancellationHtml = String(b.payment_status || '') === 'Cancelled' ? `
    <hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>
    <div style="padding:10px 12px;background:#fff5f5;border:1px solid #ffcdd2;border-radius:6px">
      <div style="font-size:12px;font-weight:700;color:#c62828;margin-bottom:6px">CANCELLATION DETAILS</div>
      <div style="font-size:13px;margin-bottom:4px"><strong>Cancelled At:</strong> ${escHtml(formatDateTime(b.cancelled_at || ''))}</div>
      <div style="font-size:13px;margin-bottom:4px"><strong>Cancelled By:</strong> ${escHtml(cancelledByName)}</div>
      <div style="font-size:13px"><strong>Reason:</strong> ${escHtml(b.cancellation_reason || '-')}</div>
    </div>` : '';
  
  showModal(`Bill Details - ${escHtml(b.patient_name)}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div><label style="color:#666;font-size:12px">BILL NUMBER</label><div style="font-size:16px;font-weight:600">${escHtml(b.bill_number||'-')}</div></div>
      <div><label style="color:#666;font-size:12px">DATE</label><div style="font-size:16px;font-weight:600">${escHtml(formatDateTime(b.created_at||''))}</div></div>
      <div><label style="color:#666;font-size:12px">PATIENT</label><div style="font-size:16px;font-weight:600">${escHtml(b.patient_name||'-')}</div></div>
      <div><label style="color:#666;font-size:12px">MR #</label><div style="font-size:16px;font-weight:600">${escHtml(b.mr_number||'-')}</div></div>
      <div><label style="color:#666;font-size:12px">PHONE</label><div style="font-size:16px">${escHtml(b.patient_phone||'-')}</div></div>
      <div><label style="color:#666;font-size:12px">VISIT ID</label><div style="font-size:16px">${escHtml(b.visit_id||'-')}</div></div>
    </div>
    <hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>
    <div style="margin-bottom:16px">
      <label style="color:#666;font-size:12px;display:block;margin-bottom:8px">ITEMS</label>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Description</th><th style="padding:8px;text-align:right;width:70px">Qty</th><th style="padding:8px;text-align:center;width:60px">Unit</th><th style="padding:8px;text-align:right;width:80px">Rate</th><th style="padding:8px;text-align:right;width:80px">Amount</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
    <hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <div style="padding:12px 16px;background:var(--bg-hover);border:1px solid var(--border);border-radius:8px">
        <div style="font-size:12px;color:var(--text-muted)">${b.discount_amount > 0 ? 'SUBTOTAL' : 'TOTAL'}</div>
        <div style="font-size:24px;font-weight:700;color:var(--text)">KD ${parseFloat(b.subtotal||b.total||0).toFixed(3)}</div>
        ${b.discount_amount > 0 ? `
          <div style="font-size:12px;color:var(--c-danger);margin-top:4px">
            Discount (${escHtml(b.discount_label || discountTypeLabel)}${b.discount_type === 'percentage' && b.discount_value ? ` - ${parseFloat(b.discount_value)}%` : b.discount_type === 'fixed' ? ' - Fixed' : ''}): - KD ${parseFloat(b.discount_amount||0).toFixed(3)}
          </div>
          <div style="font-size:18px;font-weight:700;color:var(--text);margin-top:4px">Net: KD ${parseFloat(b.total||0).toFixed(3)}</div>` : ''}
      </div>
    </div>
    ${discountHtml}
    ${paymentHtml}
    ${refundsHtml}
    ${cancellationHtml}
    <hr style="margin:16px 0;border:none;border-top:1px solid #ddd"/>
    <div id="billAttachmentsSection">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <label style="color:#666;font-size:12px;font-weight:700">ATTACHMENTS</label>
        <button type="button" class="btn btn-sm btn-primary" onclick="billPickAttachment(${id})" style="font-size:12px;padding:3px 10px">+ Add</button>
      </div>
      <input type="file" id="billAttachInput_${id}" accept="*/*" style="display:none" onchange="billHandleAttachFile(${id}, this)"/>
      <div id="billAttachList_${id}">${renderBillAttachList(attachments, id)}</div>
    </div>
  `, canPrintBill(b.created_at) ? [{label: `${IC.print} Print Bill`, class: 'btn-primary', onclick: () => { printBill(id); return false; }}] : null, 'close'); // read-only modal
}

function renderBillAttachList(attachments, billId) {
  if (!attachments || !attachments.length) {
    return '<div style="color:#aaa;font-size:13px;padding:6px 0">No attachments yet.</div>';
  }
  return attachments.map(a => {
    const t = String(a.type || '').toLowerCase();
    const n = String(a.name || '');
    const icon = t.startsWith('image/') ? 'IMG' : (t.includes('pdf') || /\.pdf$/i.test(n)) ? 'PDF' : (t.includes('spreadsheet') || t.includes('excel') || /\.(xlsx?|csv)$/i.test(n)) ? 'XLS' : (t.includes('word') || t.includes('document') || /\.(docx?)$/i.test(n)) ? 'DOC' : 'FILE';
    const date = a.uploaded_at ? formatDateTime(a.uploaded_at) : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0">
      <span style="font-size:10px;font-weight:700;min-width:34px;text-align:center;background:#eef2ff;color:#374151;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px">${icon}</span>
      <div style="flex:1;min-width:0">
        <a href="/api/bills/${billId}/attachments/${a.id}" target="_blank" style="font-size:13px;font-weight:500;color:#2563eb;word-break:break-all">${escHtml(a.name)}</a>
        <div style="font-size:11px;color:#888">${escHtml(date)}${a.uploaded_by ? ' | ' + escHtml(a.uploaded_by) : ''}</div>
      </div>
      <button type="button" onclick="billDeleteAttachment(${billId}, ${a.id}, '${escHtml(a.name).replace(/'/g,"\\'")}', this)" style="background:none;border:1px solid #fecaca;cursor:pointer;color:#e53935;font-size:11px;line-height:1;padding:4px 6px;border-radius:4px" title="Delete">DEL</button>
    </div>`;
  }).join('');
}

function billPickAttachment(billId) {
  const inp = document.getElementById(`billAttachInput_${billId}`);
  if (inp) inp.click();
}

async function billHandleAttachFile(billId, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5 MB)'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      await apiFetch(`/api/bills/${billId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ name: file.name, type: file.type, data: e.target.result })
      });
      // Refresh the attachment list
      const updated = await apiFetch(`/api/bills/${billId}/attachments`);
      const listEl = document.getElementById(`billAttachList_${billId}`);
      if (listEl) listEl.innerHTML = renderBillAttachList(updated, billId);
    } catch (err) {
      alert('Upload failed: ' + (err.message || err));
    }
    input.value = '';
  };
  reader.readAsDataURL(file);
}

async function billDeleteAttachment(billId, attId, name, btnEl) {
  if (!confirm(`Delete attachment "${name}"?`)) return;
  try {
    await apiFetch(`/api/bills/${billId}/attachments/${attId}`, { method: 'DELETE' });
    const updated = await apiFetch(`/api/bills/${billId}/attachments`);
    const listEl = document.getElementById(`billAttachList_${billId}`);
    if (listEl) listEl.innerHTML = renderBillAttachList(updated, billId);
  } catch (err) {
    alert('Delete failed: ' + (err.message || err));
  }
}

// --------------------------------------------------------
//  SERVICE COMPLETION
// --------------------------------------------------------
async function markServiceComplete(billId, itemIdx, newStatus, opts = {}) {
  const refreshBillModal = opts.refreshBillModal !== false;
  const refreshPendingReport = !!opts.refreshPendingReport;
  try {
    await apiFetch(`/api/bills/${billId}/items/${itemIdx}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    toast(`Service marked as ${newStatus}`, 'success');
    if (refreshBillModal) await viewBillModal(billId);
    if (refreshPendingReport && _reportView === 'pending-services') await loadPendingSvcReport();
  } catch (e) {
    toast(e.message || 'Failed to update service status', 'error');
    throw e;
  }
}

// --------------------------------------------------------
//  REPORTS
// --------------------------------------------------------
let _reportView = 'daily';
let _fullPatientsReportPage = 1;
let _fullPatientsReportSearchTimer = null;
let _noShowReportPage = 1;
let _userCollectionReportPage = 1;
let _serviceConsumptionReportPage = 1;
let _billedServicesReportPage = 1;
let _productConsumptionReportPage = 1;
let _manualConsumptionCostReportPage = 1;
let _stockMovementReportPage = 1;
let _stockStatusReportPage = 1;
const REPORT_PAGE_SIZE = 50;
const NO_SHOW_REPORT_PAGE_SIZE = 25;

// --------- Export Helper Functions ---------
function downloadCSV(fileName, headers, rows) {
  if (!rows || !rows.length) { toast('No data to export', 'error'); return; }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`${fileName} exported`, 'success');
}

function exportTableToCSV(tableSelector, fileName) {
  const table = document.querySelector(tableSelector);
  if (!table) { toast('Table not found', 'error'); return; }
  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('td, th').forEach(td => {
      cells.push(td.innerText.trim());
    });
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) { toast('No data in table', 'error'); return; }
  const headers = rows[0];
  const data = rows.slice(1);
  downloadCSV(fileName, headers, data);
}

function exportTableToPDF(tableSelector, fileName) {
  const table = document.querySelector(tableSelector);
  if (!table) { toast('Table not found', 'error'); return; }
  const clonedTable = table.cloneNode(true);
  const pdf = new html2pdf.HTML2PDF({
    margin: 10,
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { allowTaint: true, scale: 2 },
    jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
  });
  pdf.setData(clonedTable).save();
  toast(`${fileName} exported as PDF`, 'success');
}

function exportContentToPDF(contentSelector, reportName) {
  const element = document.querySelector(contentSelector);
  if (!element) { toast('Content not found', 'error'); return; }
  const clone = element.cloneNode(true);
  const fileName = `${reportName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const opt = {
    margin: 8,
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { allowTaint: true, scale: 1.5 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };
  html2pdf().set(opt).from(clone).save();
  toast(`${fileName} saved`, 'success');
}

async function reports() {
  const ca = document.getElementById('contentArea');
  const options = [
    { value: 'daily', label: 'Daily Report', desc: 'Appointments, revenue and pending for selected date', icon: IC.reports },
    { value: 'no-show', label: 'No-Show Report', desc: 'Patients with consecutive no-shows based on a threshold', icon: IC.pending },
    { value: 'full-patients', label: 'Full Patient Report', desc: 'All patients list with pagination and search', icon: IC.patients },
    { value: 'user-collection', label: 'User Collection', desc: 'Daily collection by user and payment method', icon: IC.billing },
    { value: 'billed-services', label: 'Billed Services', desc: 'Service-wise billed amount with doctor and department', icon: IC.services },
    { value: 'activity', label: 'Activity Logs', desc: 'Track who booked, confirmed, arrived and paid', icon: IC.users },
    { value: 'service-consumption', label: 'Service Consumption', desc: 'Product consumption by each billed service', icon: IC.product || IC.store },
    { value: 'product-consumption', label: 'Product Cost Summary', desc: 'Grand total consumption and cost by product', icon: IC.store },
    { value: 'manual-consumption-cost', label: 'Manual Consumption Cost', desc: 'Manual stock consumption with cost and reasons', icon: IC.store },
    { value: 'stock-movement', label: 'Stock Movement', desc: 'Incoming and outgoing stock transactions', icon: IC.transfer || IC.store },
    { value: 'stock-status', label: 'Stock Status', desc: 'Current stock levels with low-stock highlights', icon: IC.store },
    { value: 'supplier-ledger', label: 'Supplier Ledger', desc: 'Per-supplier debit, credit and outstanding balance', icon: IC.billing || IC.reports },
    { value: 'pending-services', label: 'Pending Services', desc: 'Services billed but not yet completed across all patients', icon: IC.pending || IC.services },
    { value: 'pending-orders', label: 'Pending Orders', desc: 'Purchase orders awaiting receipt from suppliers', icon: IC.supplier }
  ];
  if (currentUser.role === 'admin') options.push({ value: 'revenue', label: 'Revenue', desc: 'Last 30 days billing trend', icon: IC.revenue });
  if (currentUser.role === 'admin') options.push({ value: 'discounts-report', label: 'Discount Report', desc: 'Total discounts given by type and user', icon: IC.discount });
  if (currentUser.role === 'admin') options.push({ value: 'refunds-report', label: 'Refund Report', desc: 'Refunds issued with reasons and payment types', icon: IC.refund });
  if (currentUser.role === 'admin' || currentUser.role === 'receptionist') options.push({ value: 'cancelled-bills-report', label: 'Cancelled Bills', desc: 'Cancelled bills with reason and cancelled by user', icon: IC.x });
  if (currentUser.role === 'admin' || currentUser.role === 'doctor' || String(currentUser.role || '').toLowerCase().includes('accountant')) {
    options.push({ value: 'doctor-performance', label: 'Doctor Performance', desc: 'Doctor-wise financial, patient, slot and service metrics', icon: IC.users });
  }

  if (_reportView === 'revenue' && currentUser.role !== 'admin') _reportView = 'daily';

  ca.innerHTML = `
    <div class="card mb-3">
      <div class="card-title mb-2">${IC.reports} Reports</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px">
        ${options.map(o => {
          const active = _reportView === o.value;
          return `<button type="button" class="report-select-box" data-report="${o.value}" onclick="changeReportView('${o.value}')" style="text-align:left;border:1.5px solid ${active ? 'var(--c-primary)' : 'var(--border)'};background:${active ? 'var(--c-primary-bg,#eef3ff)' : 'var(--bg-card)'};border-radius:10px;padding:12px 12px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;transition:.15s all">
            <span class="report-select-box-icon" style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;color:${active ? 'var(--c-primary)' : 'var(--text-muted)'}">${o.icon}</span>
            <span style="display:flex;flex-direction:column;gap:2px;min-width:0">
              <span style="font-size:13px;font-weight:700;color:var(--text)">${o.label}</span>
              <span style="font-size:11px;color:var(--text-muted)">${o.desc}</span>
            </span>
          </button>`;
        }).join('')}
      </div>
      <div id="reportViewPanel"></div>
    </div>`;

  syncReportSelectionUI();
  renderSelectedReport();
}

function changeReportView(view) {
  _reportView = view || 'daily';
  syncReportSelectionUI();
  renderSelectedReport();
}

function syncReportSelectionUI() {
  document.querySelectorAll('.report-select-box').forEach(btn => {
    const active = btn.getAttribute('data-report') === _reportView;
    btn.style.borderColor = active ? 'var(--c-primary)' : 'var(--border)';
    btn.style.background = active ? 'var(--c-primary-bg,#eef3ff)' : 'var(--bg-card)';
    const icon = btn.querySelector('.report-select-box-icon');
    if (icon) icon.style.color = active ? 'var(--c-primary)' : 'var(--text-muted)';
  });
}

function renderSelectedReport() {
  const panel = document.getElementById('reportViewPanel');
  if (!panel) return;
  const today = new Date().toLocaleDateString('sv');

  if (_reportView === 'daily') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.reports} Daily Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="date" id="reportDate" value="${today}" style="width:auto" onchange="loadDailyReport(this.value)"/>
            <button class="btn btn-sm report-clear-btn" onclick="resetDailyReportDate()">Today</button>
          </div>
        </div>
        <div id="dailyReportBody">${skeletonStats(3)}</div>
      </div>`;
    loadDailyReport(today);

  // Add setReportRange function for quick range selection
  window.setReportRange = function(range) {
    const dateInput = document.getElementById('reportDate');
    const now = new Date();
    let dateStr = '';
    if (range === 'week') {
      // Set to Monday of this week
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      dateStr = monday.toISOString().slice(0,10);
    } else if (range === 'month') {
      // Set to first day of this month
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      dateStr = first.toISOString().slice(0,10);
    } else if (range === 'year') {
      // Set to Jan 1 of this year
      const first = new Date(now.getFullYear(), 0, 1);
      dateStr = first.toISOString().slice(0,10);
    } else if (range === 'prevYear') {
      // Set to Jan 1 of previous year
      const first = new Date(now.getFullYear() - 1, 0, 1);
      dateStr = first.toISOString().slice(0,10);
    } else {
      // Today
      dateStr = new Date().toISOString().slice(0,10);
    }
    if (dateInput) {
      dateInput.value = dateStr;
      loadDailyReport(dateStr);
    }
  }
    return;
  }

  if (_reportView === 'full-patients') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.patients} Full Patient Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportFullPatientReportCSV()">CSV</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="fullPatientReportSearch" type="text" placeholder="Search name, MR, phone, civil ID..." oninput="debounceFullPatientsReportSearch(this.value)"/></div>
          <div class="bill-filter-group report-filter-group">
            <button class="btn btn-sm report-apply-btn" onclick="loadFullPatientsReport(1)">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearFullPatientsReportFilters()">Clear</button>
          </div>
        </div>
        <div id="fullPatientsReportBody">${skeletonTable(8)}</div>
      </div>`;
    loadFullPatientsReport(1);
    return;
  }

  if (_reportView === 'no-show') {
    const defaultThreshold = 1;
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.pending} No-Show Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#noShowReportBody table', 'no_show_report_${today}.csv')">${IC.download} CSV</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="nsrSearch" type="text" placeholder="Search patient, MR, phone, civil ID..." oninput="loadNoShowReport(1)"/></div>
          <div class="bill-filter-group report-filter-group">
            <label class="text-sm text-muted" for="nsrThreshold">Consecutive No-Show Threshold</label>
            <input id="nsrThreshold" type="number" min="1" step="1" value="${defaultThreshold}" style="width:96px"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadNoShowReport(1)">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearNoShowReportFilters(${defaultThreshold})">Clear</button>
          </div>
        </div>
        <div id="noShowReportBody">${skeletonTable(6)}</div>
      </div>`;
    loadNoShowReport();
    return;
  }

  if (_reportView === 'revenue') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.revenue} Revenue - Last 30 Days</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#revenueReportBody table', 'revenue_report_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#revenueReportBody', 'revenue_report')">${IC.print} PDF</button>
          </div>
        </div>
        <div id="revenueReportBody">${skeletonTable(5)}</div>
      </div>`;
    loadRevenueReport();
    return;
  }

  if (_reportView === 'discounts-report') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.discount} Discount Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="discRptFrom" type="date" value="${today}" title="From date"/>
            <input id="discRptTo" type="date" value="${today}" title="To date"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadDiscountsReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="document.getElementById('discRptFrom').value='';document.getElementById('discRptTo').value='';loadDiscountsReport()">All Time</button>
            <button class="btn btn-sm" onclick="exportTableToCSV('#discountReportBody table', 'discounts_report.csv')">${IC.download} CSV</button>
          </div>
        </div>
        <div id="discountReportBody">${skeletonTable(4)}</div>
      </div>`;
    loadDiscountsReport();
    return;
  }

  if (_reportView === 'refunds-report') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.refund} Refund Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="refRptFrom" type="date" value="${today}" title="From date"/>
            <input id="refRptTo" type="date" value="${today}" title="To date"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadRefundsReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="document.getElementById('refRptFrom').value='';document.getElementById('refRptTo').value='';loadRefundsReport()">All Time</button>
            <button class="btn btn-sm" onclick="exportTableToCSV('#refundReportBody table', 'refunds_report.csv')">${IC.download} CSV</button>
          </div>
        </div>
        <div id="refundReportBody">${skeletonTable(4)}</div>
      </div>`;
    loadRefundsReport();
    return;
  }

  if (_reportView === 'cancelled-bills-report') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.x} Cancelled Bills Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="canRptFrom" type="date" value="" title="From date"/>
            <input id="canRptTo" type="date" value="" title="To date"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadCancelledBillsReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="document.getElementById('canRptFrom').value='';document.getElementById('canRptTo').value='';loadCancelledBillsReport()">All Time</button>
            <button class="btn btn-sm" onclick="exportTableToCSV('#cancelledBillReportBody table', 'cancelled_bills_report.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#cancelledBillReportBody', 'cancelled_bills_report')">${IC.print} PDF</button>
          </div>
        </div>
        <div id="cancelledBillReportBody">${skeletonTable(4)}</div>
      </div>`;
    loadCancelledBillsReport();
    return;
  }

  if (_reportView === 'doctor-performance') {
    const monthStart = (() => {
      const dt = new Date();
      return new Date(dt.getFullYear(), dt.getMonth(), 1).toLocaleDateString('sv');
    })();
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.users} Doctor Performance</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#doctorPerformanceBody table', 'doctor_performance_report.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#doctorPerformanceBody', 'doctor_performance_report')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="bill-filter-group report-filter-group report-filter-group-users" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="dprFrom" type="date" value="${monthStart}" title="From date"/>
            <input id="dprTo" type="date" value="${today}" title="To date"/>
            <select id="dprDoctor"><option value="">All Doctors</option></select>
            <select id="dprTrend" title="Trend bucket">
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
            </select>
            <input id="dprDiscThreshold" type="number" min="0" max="100" step="0.1" value="20" title="Discount risk %" style="width:130px"/>
            <input id="dprRefThreshold" type="number" min="0" max="100" step="0.1" value="10" title="Refund risk %" style="width:130px"/>
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px"><input id="dprCommissionEnabled" type="checkbox"/> Commission</label>
            <select id="dprCommissionType" title="Commission type" style="width:130px">
              <option value="percentage">%</option>
              <option value="fixed_per_service">Fixed/Service</option>
            </select>
            <input id="dprCommissionValue" type="number" min="0" step="0.001" value="0" title="Commission value" style="width:110px"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadDoctorPerformanceReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearDoctorPerformanceFilters()">Clear</button>
          </div>
        </div>
        <div id="doctorPerformanceBody">${skeletonTable(6)}</div>
      </div>`;
    loadDoctorPerformanceReport();
    return;
  }

  if (_reportView === 'user-collection') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.billing} User Collection Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#userCollectionBody table', 'user_collection_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#userCollectionBody', 'user_collection')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="bill-filter-group report-filter-group report-filter-group-users">
            <input id="ucrFrom" type="date" value="${today}" title="From date"/>
            <input id="ucrTo" type="date" value="${today}" title="To date"/>
            <select id="ucrUser"><option value="">All Users</option></select>
            <select id="ucrMethod"><option value="">All Payment Methods</option></select>
            <button class="btn btn-sm report-apply-btn" onclick="loadUserCollectionReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearUserCollectionFilters()">Clear</button>
          </div>
        </div>
        <div id="userCollectionBody">${skeletonTable(6)}</div>
      </div>`;
    loadUserCollectionReport();
    return;
  }

  if (_reportView === 'billed-services') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.services} Billed Services Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#billedServicesBody table', 'billed_services_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#billedServicesBody', 'billed_services')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="bsrSearch" type="text" placeholder="Search service, doctor, department, patient, bill..." oninput="loadBilledServicesReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <input id="bsrFrom" type="date" value="${today}" onchange="loadBilledServicesReport()" title="From date"/>
            <input id="bsrTo" type="date" value="${today}" onchange="loadBilledServicesReport()" title="To date"/>
            <select id="bsrDepartment" onchange="loadBilledServicesReport()"><option value="">All Departments</option></select>
            <select id="bsrDoctor" onchange="loadBilledServicesReport()"><option value="">All Doctors</option></select>
            <select id="bsrService" onchange="loadBilledServicesReport()"><option value="">All Services</option></select>
            <button class="btn btn-sm report-apply-btn" onclick="loadBilledServicesReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearBilledServicesFilters()">Clear</button>
          </div>
        </div>
        <div id="billedServicesBody">${skeletonTable(8)}</div>
      </div>`;
    loadBilledServicesReport();
    return;
  }

  if (_reportView === 'service-consumption') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.product || IC.store} Service Consumption</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#serviceConsumptionBody table', 'service_consumption_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#serviceConsumptionBody', 'service_consumption')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="scnSearch" type="text" placeholder="Search service or product..." oninput="loadServiceConsumptionReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <input id="scnFrom" type="date" value="${today}" onchange="loadServiceConsumptionReport()" title="From date"/>
            <input id="scnTo" type="date" value="${today}" onchange="loadServiceConsumptionReport()" title="To date"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadServiceConsumptionReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearServiceConsumptionFilters()">Clear</button>
          </div>
        </div>
        <div id="serviceConsumptionBody">${skeletonTable(7)}</div>
      </div>`;
    loadServiceConsumptionReport();
    return;
  }

  if (_reportView === 'product-consumption') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.store} Product Cost Summary</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#productConsumptionBody table', 'product_consumption_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#productConsumptionBody', 'product_consumption')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="pcnSearch" type="text" placeholder="Search product or service..." oninput="loadProductConsumptionReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <input id="pcnFrom" type="date" value="${today}" onchange="loadProductConsumptionReport()" title="From date"/>
            <input id="pcnTo" type="date" value="${today}" onchange="loadProductConsumptionReport()" title="To date"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadProductConsumptionReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearProductConsumptionFilters()">Clear</button>
          </div>
        </div>
        <div id="productConsumptionBody">${skeletonTable(7)}</div>
      </div>`;
    loadProductConsumptionReport();
    return;
  }

  if (_reportView === 'manual-consumption-cost') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.store} Manual Consumption Cost</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#manualConsumptionCostBody table', 'manual_consumption_cost_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#manualConsumptionCostBody', 'manual_consumption_cost')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="mccSearch" type="text" placeholder="Search store, item, reason, remarks..." oninput="loadManualConsumptionCostReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <input id="mccFrom" type="date" value="${today}" onchange="loadManualConsumptionCostReport()" title="From date"/>
            <input id="mccTo" type="date" value="${today}" onchange="loadManualConsumptionCostReport()" title="To date"/>
            <select id="mccStore" onchange="loadManualConsumptionCostReport()"><option value="">All Stores</option></select>
            <select id="mccReason" onchange="loadManualConsumptionCostReport()">
              <option value="">All Reasons</option>
              <option value="Treatment Usage">Treatment Usage</option>
              <option value="Wastage">Wastage</option>
              <option value="Expired">Expired</option>
              <option value="Internal Use">Internal Use</option>
              <option value="Sample">Sample</option>
              <option value="Adjustment">Adjustment</option>
            </select>
            <button class="btn btn-sm report-apply-btn" onclick="loadManualConsumptionCostReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearManualConsumptionCostFilters()">Clear</button>
          </div>
        </div>
        <div id="manualConsumptionCostBody">${skeletonTable(8)}</div>
      </div>`;
    loadManualConsumptionCostReport();
    return;
  }

  if (_reportView === 'stock-movement') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.transfer || IC.store} Stock Movement</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#stockMovementBody table', 'stock_movement_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#stockMovementBody', 'stock_movement')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="smSearch" type="text" placeholder="Search store, product, SKU, ref..." oninput="loadStockMovementReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <input id="smFrom" type="date" value="${today}" onchange="loadStockMovementReport()" title="From date"/>
            <input id="smTo" type="date" value="${today}" onchange="loadStockMovementReport()" title="To date"/>
            <select id="smStore" onchange="loadStockMovementReport()"><option value="">All Stores</option></select>
            <select id="smType" onchange="loadStockMovementReport()">
              <option value="">All Types</option>
              <option value="purchase">Purchase</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Adjustment</option>
              <option value="consumption">Consumption</option>
              <option value="manual-consumption">Manual Consumption</option>
              <option value="supplier-return">Supplier Return</option>
            </select>
            <button class="btn btn-sm report-apply-btn" onclick="loadStockMovementReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearStockMovementFilters()">Clear</button>
          </div>
        </div>
        <div id="stockMovementBody">${skeletonTable(8)}</div>
      </div>`;
    loadStockMovementReport();
    return;
  }

  if (_reportView === 'stock-status') {
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.store} Stock Status</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#stockStatusBody table', 'stock_status_${today}.csv')">${IC.download} CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#stockStatusBody', 'stock_status')">${IC.print} PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="ssSearch" type="text" placeholder="Search store, product, SKU, category..." oninput="loadStockStatusReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <select id="ssStore" onchange="loadStockStatusReport()"><option value="">All Stores</option></select>
            <label class="text-sm" style="display:flex;align-items:center;gap:6px;padding:0 8px;height:36px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input)">
              <input id="ssLowOnly" type="checkbox" onchange="loadStockStatusReport()"/>
              Low stock only
            </label>
            <button class="btn btn-sm report-apply-btn" onclick="loadStockStatusReport()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearStockStatusFilters()">Clear</button>
          </div>
        </div>
        <div id="stockStatusBody">${skeletonTable(8)}</div>
      </div>`;
    loadStockStatusReport();
    return;
  }

  if (_reportView === 'supplier-ledger') {
    const today2 = new Date().toLocaleDateString('sv');
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.billing || IC.reports} Supplier Ledger</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#supplierLedgerBody table', 'supplier_ledger_${today2}.csv')">&#x1F4E5; CSV</button>
            <button class="btn btn-sm" onclick="exportContentToPDF('#supplierLedgerBody', 'supplier_ledger')">&#x1F4C4; PDF</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="slSearch" type="text" placeholder="Search supplier, reference, type..." oninput="loadSupplierLedger()"/></div>
          <div class="bill-filter-group report-filter-group">
            <select id="slSupplier" onchange="loadSupplierLedger()"><option value="">All Suppliers</option></select>
            <input id="slFrom" type="date" value="" title="From date" onchange="loadSupplierLedger()"/>
            <input id="slTo"   type="date" value="" title="To date"   onchange="loadSupplierLedger()"/>
            <button class="btn btn-sm report-apply-btn" onclick="loadSupplierLedger()">Apply Filter</button>
            <button class="btn btn-sm report-clear-btn" onclick="clearSupplierLedgerFilters()">Clear</button>
          </div>
        </div>
        <div id="supplierLedgerBody">${skeletonTable(6)}</div>
      </div>`;
    loadSupplierLedger();
    return;
  }

  if (_reportView === 'pending-services') {
    const today2 = new Date().toLocaleDateString('sv');
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.pending || IC.services} Pending Services Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#pendingSvcBody table', 'pending_services_${today2}.csv')">&#x1F4E5; CSV</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="bill-filter-group report-filter-group">
            <input id="psvFrom" type="date" value="" title="From date" onchange="loadPendingSvcReport()"/>
            <input id="psvTo"   type="date" value="" title="To date"   onchange="loadPendingSvcReport()"/>
            <select id="psvStatus" onchange="loadPendingSvcReport()">
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <button class="btn btn-sm report-apply-btn" onclick="loadPendingSvcReport()">Apply</button>
            <button class="btn btn-sm report-clear-btn" onclick="document.getElementById('psvFrom').value='';document.getElementById('psvTo').value='';document.getElementById('psvStatus').value='';loadPendingSvcReport()">Clear</button>
          </div>
        </div>
        <div id="pendingSvcBody">${skeletonTable(6)}</div>
      </div>`;
    loadPendingSvcReport();
    return;
  }

  if (_reportView === 'pending-orders') {
    const today3 = new Date().toLocaleDateString('sv');
    panel.innerHTML = `
      <div class="card" style="margin:0;border:1px solid var(--border-light)">
        <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
          <div class="card-title">${IC.supplier} Pending Orders Report</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="exportTableToCSV('#pendingOrdersBody table', 'pending_orders_${today3}.csv')">${IC.download} CSV</button>
          </div>
        </div>
        <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
          <div class="search-box"><input id="poRptSearch" type="text" placeholder="Search supplier, invoice #..." oninput="loadPendingOrdersReport()"/></div>
          <div class="bill-filter-group report-filter-group">
            <input id="poRptFrom" type="date" title="From order date" onchange="loadPendingOrdersReport()"/>
            <input id="poRptTo"   type="date" title="To order date"   onchange="loadPendingOrdersReport()"/>
            <select id="poRptPayStatus" onchange="loadPendingOrdersReport()">
              <option value="">All Payment Statuses</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
            <select id="poRptOrdStatus" onchange="loadPendingOrdersReport()">
              <option value="">All Order Statuses</option>
              <option value="Pending">Pending (Not Received)</option>
              <option value="Received">Received</option>
            </select>
            <button class="btn btn-sm report-apply-btn" onclick="loadPendingOrdersReport()">Apply</button>
            <button class="btn btn-sm report-clear-btn" onclick="document.getElementById('poRptSearch').value='';document.getElementById('poRptFrom').value='';document.getElementById('poRptTo').value='';document.getElementById('poRptPayStatus').value='';document.getElementById('poRptOrdStatus').value='';loadPendingOrdersReport()">Clear</button>
          </div>
        </div>
        <div id="pendingOrdersBody">${skeletonTable(5)}</div>
      </div>`;
    loadPendingOrdersReport();
    return;
  }

  panel.innerHTML = `
    <div class="card" style="margin:0;border:1px solid var(--border-light)">
      <div class="flex-between mb-2" style="gap:10px;flex-wrap:wrap">
        <div class="card-title">${IC.reports} Activity Logs</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="exportTableToCSV('#activityLogBody table', 'activity_logs_${today}.csv')">${IC.download} CSV</button>
          <button class="btn btn-sm" onclick="exportContentToPDF('#activityLogBody', 'activity_logs')">${IC.print} PDF</button>
        </div>
      </div>
      <div class="action-bar bill-action-bar report-filter-bar" style="padding:0;border:0;margin:10px 0 12px;box-shadow:none;background:transparent">
        <div class="search-box"><input id="logSearch" type="text" placeholder="Search patient name, username, action, visit ID..." oninput="loadActivityLogs()"/></div>
        <div class="bill-filter-group report-filter-group">
          <input id="logFrom" type="date" value="${today}" onchange="loadActivityLogs()" title="From date"/>
          <input id="logTo" type="date" value="${today}" onchange="loadActivityLogs()" title="To date"/>
          <select id="logAction" onchange="loadActivityLogs()">
            <option value="">All Actions</option>
          </select>
          <button class="btn btn-sm report-apply-btn" onclick="loadActivityLogs()">Apply Filter</button>
          <button class="btn btn-sm report-clear-btn" onclick="clearActivityLogFilters()">Clear</button>
        </div>
      </div>
      <div id="activityLogBody" style="height:68vh;min-height:420px;overflow:auto;border:1px solid var(--border-light);border-radius:10px;padding:8px;background:var(--bg)">${skeletonTable(8)}</div>
    </div>`;
  loadActivityLogActions();
  loadActivityLogs();
}

function resetDailyReportDate() {
  const today = new Date().toLocaleDateString('sv');
  const i = document.getElementById('reportDate');
  if (i) i.value = today;
  loadDailyReport(today);
}

function clearUserCollectionFilters() {
  const today = new Date().toLocaleDateString('sv');
  const from = document.getElementById('ucrFrom');
  const to = document.getElementById('ucrTo');
  const user = document.getElementById('ucrUser');
  const method = document.getElementById('ucrMethod');
  if (from) from.value = today;
  if (to) to.value = today;
  if (user) user.value = '';
  if (method) method.value = '';
  loadUserCollectionReport();
}

function clearBilledServicesFilters() {
  const today = new Date().toLocaleDateString('sv');
  const search = document.getElementById('bsrSearch');
  const from = document.getElementById('bsrFrom');
  const to = document.getElementById('bsrTo');
  const dept = document.getElementById('bsrDepartment');
  const doctor = document.getElementById('bsrDoctor');
  const service = document.getElementById('bsrService');
  if (search) search.value = '';
  if (from) from.value = today;
  if (to) to.value = today;
  if (dept) dept.value = '';
  if (doctor) doctor.value = '';
  if (service) service.value = '';
  loadBilledServicesReport();
}

function clearServiceConsumptionFilters() {
  const today = new Date().toLocaleDateString('sv');
  const search = document.getElementById('scnSearch');
  const from = document.getElementById('scnFrom');
  const to = document.getElementById('scnTo');
  if (search) search.value = '';
  if (from) from.value = today;
  if (to) to.value = today;
  loadServiceConsumptionReport();
}

function clearProductConsumptionFilters() {
  const today = new Date().toLocaleDateString('sv');
  const search = document.getElementById('pcnSearch');
  const from = document.getElementById('pcnFrom');
  const to = document.getElementById('pcnTo');
  if (search) search.value = '';
  if (from) from.value = today;
  if (to) to.value = today;
  loadProductConsumptionReport();
}

function clearManualConsumptionCostFilters() {
  const today = new Date().toLocaleDateString('sv');
  const search = document.getElementById('mccSearch');
  const from = document.getElementById('mccFrom');
  const to = document.getElementById('mccTo');
  const store = document.getElementById('mccStore');
  const reason = document.getElementById('mccReason');
  if (search) search.value = '';
  if (from) from.value = today;
  if (to) to.value = today;
  if (store) store.value = '';
  if (reason) reason.value = '';
  loadManualConsumptionCostReport();
}

function clearActivityLogFilters() {
  const today = new Date().toLocaleDateString('sv');
  const search = document.getElementById('logSearch');
  const from = document.getElementById('logFrom');
  const to = document.getElementById('logTo');
  const action = document.getElementById('logAction');
  if (search) search.value = '';
  if (from) from.value = today;
  if (to) to.value = today;
  if (action) action.value = '';
  loadActivityLogs();
}

function formatActivityActionLabel(action) {
  const raw = String(action || '').trim();
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

async function loadActivityLogActions() {
  const sel = document.getElementById('logAction');
  if (!sel) return;
  const previous = sel.value || '';
  sel.innerHTML = '<option value="">All Actions</option>';
  try {
    const actions = await apiFetch('/api/activity-logs/actions');
    const list = Array.isArray(actions) ? actions : [];
    list.forEach(action => {
      const value = String(action || '').trim();
      if (!value) return;
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = formatActivityActionLabel(value);
      sel.appendChild(opt);
    });
    if (previous && list.includes(previous)) sel.value = previous;
  } catch (_) {
    // Keep All Actions option if loading fails.
  }
}

function clearStockMovementFilters() {
  const today = new Date().toLocaleDateString('sv');
  const search = document.getElementById('smSearch');
  const from = document.getElementById('smFrom');
  const to = document.getElementById('smTo');
  const store = document.getElementById('smStore');
  const type = document.getElementById('smType');
  if (search) search.value = '';
  if (from) from.value = today;
  if (to) to.value = today;
  if (store) store.value = '';
  if (type) type.value = '';
  loadStockMovementReport();
}

function clearStockStatusFilters() {
  const search = document.getElementById('ssSearch');
  const store = document.getElementById('ssStore');
  const lowOnly = document.getElementById('ssLowOnly');
  if (search) search.value = '';
  if (store) store.value = '';
  if (lowOnly) lowOnly.checked = false;
  loadStockStatusReport();
}

function clearStockStatusFilters() {
  const search = document.getElementById('ssSearch');
  const store = document.getElementById('ssStore');
  const lowOnly = document.getElementById('ssLowOnly');
  if (search) search.value = '';
  if (store) store.value = '';
  if (lowOnly) lowOnly.checked = false;
  loadStockStatusReport();
}

// -- Supplier Ledger Report ------------------------------
function clearSupplierLedgerFilters() {
  const s = document.getElementById('slSearch');
  const sup = document.getElementById('slSupplier');
  const from = document.getElementById('slFrom');
  const to = document.getElementById('slTo');
  if (s) s.value = '';
  if (sup) sup.value = '';
  if (from) from.value = '';
  if (to) to.value = '';
  loadSupplierLedger();
}

async function loadSupplierLedger() {
  const wrap = document.getElementById('supplierLedgerBody');
  if (!wrap) return;
  const search   = document.getElementById('slSearch')?.value?.trim() || '';
  const supplier = document.getElementById('slSupplier')?.value || '';
  const from     = document.getElementById('slFrom')?.value || '';
  const to       = document.getElementById('slTo')?.value || '';

  const params = new URLSearchParams();
  if (search)   params.set('search', search);
  if (supplier) params.set('supplier_id', supplier);
  if (from)     params.set('date_from', from);
  if (to)       params.set('date_to', to);

  wrap.innerHTML = skeletonTable(6);
  try {
    const data = await apiFetch(`/api/reports/supplier-ledger?${params.toString()}`);

    // Populate supplier dropdown on first load
    const supSel = document.getElementById('slSupplier');
    if (supSel && supSel.options.length <= 1 && (data.filters?.suppliers || []).length) {
      data.filters.suppliers.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id; o.textContent = s.name;
        supSel.appendChild(o);
      });
      if (supplier) supSel.value = supplier;
    }

    const { suppliers = [], summary = {} } = data;
    if (!suppliers.length) {
      wrap.innerHTML = emptyState(IC.billing || IC.reports, 'No supplier ledger data', 'No purchase orders or payments found for the selected filters');
      return;
    }

    const summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
        <div class="stat-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">Suppliers</div>
          <div style="font-size:20px;font-weight:700">${summary.total_suppliers || 0}</div>
        </div>
        <div class="stat-card" style="background:#fff5f5;border:1px solid #fdd;border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">Total Payments (Dr.)</div>
          <div style="font-size:20px;font-weight:700;color:#c0392b">KD ${(summary.total_debit || 0).toFixed(3)}</div>
        </div>
        <div class="stat-card" style="background:#f0fff4;border:1px solid #c3e6cb;border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">Net Purchases (Cr.)</div>
          <div style="font-size:20px;font-weight:700;color:#27ae60">KD ${(summary.total_credit || 0).toFixed(3)}</div>
        </div>
        <div class="stat-card" style="background:#fff8e1;border:1px solid #ffecb3;border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">Total Returns</div>
          <div style="font-size:20px;font-weight:700;color:#e67e22">KD ${(summary.total_returns || 0).toFixed(3)}</div>
        </div>
        <div class="stat-card" style="background:${(summary.total_balance || 0) > 0 ? '#fff8e1' : '#f0fff4'};border:1px solid ${(summary.total_balance || 0) > 0 ? '#ffc107' : '#c3e6cb'};border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">Outstanding Balance</div>
          <div style="font-size:20px;font-weight:700;color:${(summary.total_balance || 0) > 0 ? '#e67e22' : '#27ae60'}">KD ${(summary.total_balance || 0).toFixed(3)}</div>
        </div>
      </div>`;

    const tables = suppliers.map(ledger => {
      const balColor = ledger.balance > 0.0005 ? '#c0392b' : '#27ae60';
      const balLabel = ledger.balance > 0.0005 ? 'Outstanding' : 'Settled';
      const rows = ledger.entries.map(e => {
        const typeClass = e.type === 'Purchase' ? 'badge-unpaid' : (e.type === 'Payment' ? 'badge-paid' : 'badge-scheduled');
        const debit  = e.debit  > 0 ? `<span style="color:#c0392b;font-weight:600">KD ${e.debit.toFixed(3)}</span>`  : '<span class="text-muted">-</span>';
        const credit = e.credit !== 0
          ? (e.credit > 0
            ? `<span style="color:#27ae60;font-weight:600">KD ${e.credit.toFixed(3)}</span>`
            : `<span style="color:#e67e22;font-weight:600">- KD ${Math.abs(e.credit).toFixed(3)}</span>`)
          : '<span class="text-muted">-</span>';
        const balTxt = e.balance > 0.0005
          ? `<span style="color:#e67e22;font-weight:600">KD ${e.balance.toFixed(3)}</span>`
          : `<span style="color:#27ae60;font-weight:600">KD 0.000</span>`;
        return `<tr>
          <td class="text-muted text-sm">${escHtml(e.date || '-')}</td>
          <td><span class="badge ${typeClass}">${escHtml(e.type)}</span></td>
          <td class="text-sm">${escHtml(e.reference || '-')}</td>
          <td class="text-sm text-muted">${escHtml(e.description || '-')}</td>
          <td style="text-align:right">${debit}</td>
          <td style="text-align:right">${credit}</td>
          <td style="text-align:right">${balTxt}</td>
        </tr>`;
      }).join('');

      return `
        <div style="margin-bottom:24px;border:1px solid var(--border-light);border-radius:10px;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-card);border-bottom:1px solid var(--border-light)">
            <div>
              <strong style="font-size:15px">${escHtml(ledger.supplier_name)}</strong>
              ${ledger.supplier_phone ? `<span class="text-muted text-sm" style="margin-left:10px">${escHtml(ledger.supplier_phone)}</span>` : ''}
            </div>
            <div style="display:flex;gap:16px;align-items:center">
              <span class="text-sm text-muted">Dr. <strong style="color:#c0392b">KD ${ledger.total_debit.toFixed(3)}</strong></span>
              <span class="text-sm text-muted">Cr. <strong style="color:#27ae60">KD ${ledger.total_credit.toFixed(3)}</strong></span>
              <span class="badge" style="background:${balColor};color:#fff;font-size:12px">${balLabel}: KD ${ledger.balance.toFixed(3)}</span>
            </div>
          </div>
          ${ledger.entries.length ? `
          <div class="table-wrap" style="margin:0">
            <table style="font-size:13px">
              <thead><tr>
                <th>Date</th><th>Type</th><th>Reference</th><th>Description</th>
                <th style="text-align:right">Debit (Dr.) Payment</th>
                <th style="text-align:right">Credit (Cr.) Purchase/Adj.</th>
                <th style="text-align:right">Balance</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="font-weight:700;background:var(--bg-card)">
                <td colspan="4" style="text-align:right">Total</td>
                <td style="text-align:right;color:#c0392b">KD ${ledger.total_debit.toFixed(3)}</td>
                <td style="text-align:right;color:#27ae60">KD ${ledger.total_credit.toFixed(3)}</td>
                <td style="text-align:right;color:${balColor}">KD ${ledger.balance.toFixed(3)}</td>
              </tr></tfoot>
            </table>
          </div>` : `<div class="text-muted text-sm" style="padding:12px 14px">No transactions in selected date range.</div>`}
        </div>`;
    }).join('');

    wrap.innerHTML = summaryHtml + `<div id="slTables">${tables}</div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="text-danger" style="padding:16px">${escHtml(e.message || 'Failed to load supplier ledger')}</div>`;
  }
}

let _psvAllRows = [];
let _psvRenderedCount = 0;
let _psvScrollObserver = null;
const PSV_BATCH = 50;

function _psvDisconnect() {
  if (_psvScrollObserver) { _psvScrollObserver.disconnect(); _psvScrollObserver = null; }
}

function _psvRenderBatch() {
  const tbody = document.getElementById('psvTableBody');
  if (!tbody) return;
  const next = _psvAllRows.slice(_psvRenderedCount, _psvRenderedCount + PSV_BATCH);
  if (!next.length) { _psvDisconnect(); return; }
  const statusColor = s => s === 'Completed' ? '#16a34a' : (s === 'In Progress' ? '#2563eb' : '#d97706');
  const statusIcon  = s => s === 'Completed' ? '&#10003;' : (s === 'In Progress' ? '&#9654;' : '&#9679;');
  tbody.insertAdjacentHTML('beforeend', next.map(r => `
    <tr>
      <td class="text-sm">${escHtml(r.bill_date || '-')}</td>
      <td><button class="btn-link" onclick="viewBillModal(${r.bill_id})">${escHtml(r.bill_number || '-')}</button></td>
      <td class="text-sm">${escHtml(r.patient_name || '-')} <span class="text-muted text-sm">${escHtml(r.mr_number || '')}</span></td>
      <td class="text-sm">${escHtml(r.service_name || '-')}</td>
      <td><span style="color:${statusColor(r.service_status)};font-weight:600;font-size:12px">${statusIcon(r.service_status)} ${escHtml(r.service_status)}</span></td>
      <td class="text-sm text-muted">${r.completion_date ? escHtml(String(r.completion_date).slice(0,10)) : '-'}</td>
      <td class="text-sm text-muted">${escHtml(r.provider_name || '-')}</td>
      <td style="text-align:right" class="text-sm">KD ${parseFloat(r.amount || 0).toFixed(3)}</td>
      <td>
        ${r.service_status !== 'Completed'
          ? `<button class="btn btn-sm" style="padding:2px 8px;font-size:11px" onclick="markServiceComplete(${r.bill_id},${r.item_index},'${r.service_status === 'In Progress' ? 'Completed' : 'In Progress'}',{refreshBillModal:false,refreshPendingReport:true})">${r.service_status === 'In Progress' ? '&#10003; Complete' : '&#9654; Start'}</button>`
          : '<span class="text-muted text-sm">-</span>'}
      </td>
    </tr>`).join(''));
  _psvRenderedCount += next.length;
  const state = document.getElementById('psvLoadState');
  if (state) state.textContent = _psvRenderedCount < _psvAllRows.length ? `Showing ${_psvRenderedCount} of ${_psvAllRows.length} items` : `${_psvAllRows.length} item${_psvAllRows.length !== 1 ? 's' : ''}`;
  if (_psvRenderedCount >= _psvAllRows.length) _psvDisconnect();
}

function _psvAttachScroll() {
  _psvDisconnect();
  const sentinel = document.getElementById('psvSentinel');
  if (!sentinel || _psvRenderedCount >= _psvAllRows.length) return;
  _psvScrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) _psvRenderBatch();
  }, { root: null, rootMargin: '0px 0px 240px 0px', threshold: 0.01 });
  _psvScrollObserver.observe(sentinel);
}

async function loadPendingSvcReport() {
  const wrap = document.getElementById('pendingSvcBody');
  if (!wrap) return;
  _psvDisconnect();
  _psvAllRows = [];
  _psvRenderedCount = 0;
  const from   = document.getElementById('psvFrom')?.value || '';
  const to     = document.getElementById('psvTo')?.value || '';
  const status = document.getElementById('psvStatus')?.value || '';
  const params = new URLSearchParams();
  if (from)   params.set('date_from', from);
  if (to)     params.set('date_to', to);
  if (status) params.set('status', status);
  wrap.innerHTML = skeletonTable(6);
  try {
    const data = await apiFetch(`/api/reports/pending-services?${params.toString()}`);
    const { summary = {}, rows = [] } = data;
    _psvAllRows = rows;
    const summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">Total Items</div>
          <div style="font-size:22px;font-weight:700">${summary.total || 0}</div>
        </div>
        <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">? Pending</div>
          <div style="font-size:22px;font-weight:700;color:#d97706">${summary.pending || 0}</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">?? In Progress</div>
          <div style="font-size:22px;font-weight:700;color:#2563eb">${summary.in_progress || 0}</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px">
          <div class="text-muted text-sm">? Completed</div>
          <div style="font-size:22px;font-weight:700;color:#16a34a">${summary.completed || 0}</div>
        </div>
      </div>`;
    if (!rows.length) {
      wrap.innerHTML = summaryHtml + emptyState(IC.pending || IC.services, 'No service records found', 'Try adjusting the filters');
      return;
    }
    wrap.innerHTML = summaryHtml + `
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Date</th><th>Bill #</th><th>Patient</th><th>Service</th>
          <th>Status</th><th>Completed On</th><th>Provider</th><th style="text-align:right">Amount</th><th>Action</th>
        </tr></thead>
        <tbody id="psvTableBody"></tbody>
      </table></div>
      <div class="svc-load-state" id="psvLoadState"></div>
      <div style="height:2px" id="psvSentinel" aria-hidden="true"></div>`;
    _psvRenderBatch();
    _psvAttachScroll();
  } catch (e) {
    wrap.innerHTML = `<div class="text-danger" style="padding:16px">${escHtml(e.message || 'Failed to load report')}</div>`;
  }
}


async function loadPendingOrdersReport() {
  const wrap = document.getElementById('pendingOrdersBody');
  if (!wrap) return;
  wrap.innerHTML = skeletonTable(5);
  try {
    const orders = await apiFetch('/api/store/purchase-orders');
    const search = (document.getElementById('poRptSearch')?.value || '').toLowerCase();
    const from   = document.getElementById('poRptFrom')?.value || '';
    const to     = document.getElementById('poRptTo')?.value || '';
    const paySt  = document.getElementById('poRptPayStatus')?.value || '';
    const ordSt  = document.getElementById('poRptOrdStatus')?.value || '';
    const filtered = orders.filter(o => {
      const d = String(o.order_date || '').slice(0, 10);
      if (search && !String(o.supplier_name || '').toLowerCase().includes(search) && !String(o.invoice_number || '').toLowerCase().includes(search)) return false;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      if (paySt && String(o.payment_status || 'Unpaid') !== paySt) return false;
      if (ordSt && String(o.status || 'Pending') !== ordSt) return false;
      return true;
    });
    const totalCost = filtered.reduce((s, o) => s + parseFloat(o.total_cost || 0), 0);
    const totalDue  = filtered.reduce((s, o) => s + parseFloat(o.due_amount  || 0), 0);
    if (!filtered.length) {
      wrap.innerHTML = emptyState(IC.supplier, 'No orders found', 'No purchase orders match the selected filters');
      return;
    }
    wrap.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
        <div style="padding:10px 16px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-muted)">TOTAL ORDERS</div>
          <div style="font-size:20px;font-weight:700">${filtered.length}</div>
        </div>
        <div style="padding:10px 16px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-muted)">TOTAL COST</div>
          <div style="font-size:20px;font-weight:700">KD ${totalCost.toFixed(3)}</div>
        </div>
        <div style="padding:10px 16px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-muted)">TOTAL DUE</div>
          <div style="font-size:20px;font-weight:700;color:var(--c-danger)">KD ${totalDue.toFixed(3)}</div>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#</th><th>Supplier</th><th>Invoice #</th><th>Order Date</th>
          <th>Items</th><th>Order Status</th><th style="text-align:right">Total Cost</th>
          <th style="text-align:right">Paid</th><th style="text-align:right">Due</th><th>Payment Status</th>
        </tr></thead>
        <tbody>${filtered.map((o, i) => {
          const payStatus = String(o.payment_status || 'Unpaid');
          const payBadge = payStatus === 'Paid'
            ? '<span class="badge badge-paid">Paid</span>'
            : (payStatus === 'Partially Paid' ? '<span class="badge badge-arrived">Partly Paid</span>' : '<span class="badge badge-unpaid">Unpaid</span>');
          return `<tr>
            <td>${i + 1}</td>
            <td><strong>${escHtml(o.supplier_name || '-')}</strong></td>
            <td class="text-muted text-sm">${escHtml(o.invoice_number || '-')}</td>
            <td class="text-muted text-sm">${escHtml(o.order_date || '-')}</td>
            <td>${(o.items || []).length} item(s)</td>
            <td>${o.status === 'Received' ? '<span class="badge badge-paid">Received</span>' : '<span class="badge badge-scheduled">Pending</span>'}</td>
            <td style="text-align:right"><strong>KD ${parseFloat(o.total_cost || 0).toFixed(3)}</strong></td>
            <td style="text-align:right">KD ${parseFloat(o.paid_amount || 0).toFixed(3)}</td>
            <td style="text-align:right;color:var(--c-danger)"><strong>KD ${parseFloat(o.due_amount || 0).toFixed(3)}</strong></td>
            <td>${payBadge}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  } catch (e) { wrap.innerHTML = `<div class="text-muted p-3">Error loading orders: ${escHtml(e.message)}</div>`; }
}

function debounceFullPatientsReportSearch() {
  clearTimeout(_fullPatientsReportSearchTimer);
  _fullPatientsReportSearchTimer = setTimeout(() => loadFullPatientsReport(1), 400);
}

function clearFullPatientsReportFilters() {
  const search = document.getElementById('fullPatientReportSearch');
  if (search) search.value = '';
  loadFullPatientsReport(1);
}

async function loadFullPatientsReport(page = 1) {
  _fullPatientsReportPage = Math.max(1, parseInt(page, 10) || 1);
  const wrap = document.getElementById('fullPatientsReportBody');
  if (!wrap) return;
  try {
    const q = (document.getElementById('fullPatientReportSearch')?.value || '').trim();
    const params = new URLSearchParams({ page: String(_fullPatientsReportPage), limit: '100' });
    if (q) params.set('search', q);
    const rep = await apiFetch('/api/patients?' + params.toString());
    const rows = Array.isArray(rep) ? rep : (rep.data || []);
    const total = Array.isArray(rep) ? rows.length : parseInt(rep.total || 0, 10);
    const pages = Array.isArray(rep) ? 1 : Math.max(1, parseInt(rep.pages || 1, 10));
    window._lastFullPatientsReportRows = rows;

    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.patients, 'No patients found', q ? 'Try a different search term' : 'No patient records available');
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>MR#</th><th>Name</th><th>Civil ID</th><th>DOB</th><th>Age/Gender</th><th>Phone</th><th>Status</th><th>Registered</th></tr></thead>
        <tbody>${rows.map(p => `<tr>
          <td><span class="code-id code-id-primary">${escHtml(p.mr_number || '-')}</span></td>
          <td>${escHtml(p.name || '-')}${p.second_name ? ` <span class="text-muted text-sm">${escHtml(p.second_name)}</span>` : ''}</td>
          <td>${escHtml(p.civil_id || '-')}</td>
          <td>${escHtml(p.dob || '-')}</td>
          <td>${escHtml(p.age || '-')} / ${escHtml(p.gender || '-')}</td>
          <td>${escHtml(p.phone || '-')}</td>
          <td>${escHtml(p.patient_status || 'Good')}</td>
          <td class="text-muted text-sm">${escHtml(formatDateTime(p.registration_date || p.created_at || ''))}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 4px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${((_fullPatientsReportPage - 1) * 100) + 1}-${Math.min(_fullPatientsReportPage * 100, total)} of ${total}</span>
        <div style="display:flex;gap:4px;margin-left:auto">
          <button class="btn btn-sm" onclick="loadFullPatientsReport(${_fullPatientsReportPage - 1})" ${_fullPatientsReportPage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${_fullPatientsReportPage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadFullPatientsReport(${_fullPatientsReportPage + 1})" ${_fullPatientsReportPage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function exportFullPatientReportCSV() {
  const q = (document.getElementById('fullPatientReportSearch')?.value || '').trim();
  const params = new URLSearchParams();
  if (q) params.set('search', q);
  fetch('/api/patients/export' + (params.toString() ? `?${params.toString()}` : ''), { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full_patients_report_${new Date().toLocaleDateString('sv')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Full patient report exported', 'success');
    })
    .catch((e) => toast(e.message || 'Export failed', 'error'));
}

async function loadDailyReport(date) {
  try {
    const rep = await apiFetch(`/api/reports/daily?date=${date}`);
    window._lastDailyReportRows = rep.appointment_by_status || [];
    document.getElementById('dailyReportBody').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card" style="margin:0;border:1px solid var(--border-light)">
          <div class="card-title" style="margin-bottom:10px">Financial Summary</div>
          <div class="stats-grid" style="margin-bottom:0;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon green">${IC.revenue}</div>
              <div class="stat-content"><div class="stat-label">Gross Revenue</div><div class="stat-value" style="font-size:22px">KD ${parseFloat(rep.gross_revenue || 0).toFixed(3)}</div></div>
            </div>
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon amber">${IC.discount || IC.billing}</div>
              <div class="stat-content"><div class="stat-label">Total Discount</div><div class="stat-value" style="font-size:22px">KD ${parseFloat(rep.total_discount || 0).toFixed(3)}</div></div>
            </div>
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon blue">${IC.billing}</div>
              <div class="stat-content"><div class="stat-label">Net Revenue</div><div class="stat-value" style="font-size:22px">KD ${parseFloat(rep.net_revenue || 0).toFixed(3)}</div></div>
            </div>
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon amber">${IC.refund || IC.x}</div>
              <div class="stat-content"><div class="stat-label">Total Refund</div><div class="stat-value" style="font-size:22px">KD ${parseFloat(rep.total_refund || 0).toFixed(3)}</div></div>
            </div>
            <div class="stat-card" style="padding:12px;border:1px solid color-mix(in oklab, var(--c-success) 35%, var(--border))">
              <div class="stat-icon green">${IC.revenue}</div>
              <div class="stat-content"><div class="stat-label">Final Revenue</div><div class="stat-value" style="font-size:22px">KD ${parseFloat(rep.final_revenue ?? rep.revenue ?? 0).toFixed(3)}</div></div>
            </div>
          </div>
        </div>

        <div class="card" style="margin:0;border:1px solid var(--border-light)">
          <div class="card-title" style="margin-bottom:10px">Operations Summary</div>
          <div class="stats-grid" style="margin-bottom:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon blue">${IC.apts}</div>
              <div class="stat-content"><div class="stat-label">Patients Seen</div><div class="stat-value" style="font-size:22px">${rep.patients_seen}</div></div>
            </div>
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon amber">${IC.pending}</div>
              <div class="stat-content"><div class="stat-label">Pending Bills</div><div class="stat-value" style="font-size:22px">${rep.pending_bills}</div></div>
            </div>
            <div class="stat-card" style="padding:12px">
              <div class="stat-icon amber">${IC.x}</div>
              <div class="stat-content"><div class="stat-label">Cancelled Bills</div><div class="stat-value" style="font-size:22px">${parseInt(rep.cancelled_bills_count || 0, 10)}</div></div>
            </div>
          </div>

          <strong class="text-sm" style="display:block;margin-bottom:8px">Appointments by Status</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(rep.appointment_by_status||[]).map(s =>
              `<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-hover);border:1px solid var(--border);border-radius:var(--radius-xs);font-size:13px">
                 ${statusBadge(s.status)} <strong>${s.count}</strong>
               </div>`).join('') || '<span class="text-muted">No appointments</span>'}
          </div>
        </div>
      </div>`;
  } catch(e) {
    document.getElementById('dailyReportBody').innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function clearNoShowReportFilters(defaultThreshold = 5) {
  const search = document.getElementById('nsrSearch');
  const threshold = document.getElementById('nsrThreshold');
  if (search) search.value = '';
  if (threshold) threshold.value = String(Math.max(1, parseInt(defaultThreshold || 5, 10)));
  loadNoShowReport(1);
}

function noShowReportSortKey(row) {
  return `${String(row.date || '')} ${String(row.time || '')} ${String(row.created_at || '')}`;
}

async function loadNoShowReportFallback(threshold, searchValue, page = 1, limit = NO_SHOW_REPORT_PAGE_SIZE) {
  const list = await apiFetch('/api/appointments');
  const appointments = Array.isArray(list) ? list : [];
  const q = String(searchValue || '').trim().toLowerCase();
  const byPatient = new Map();

  appointments.forEach((a) => {
    const pid = parseInt(a.patient_id, 10);
    if (!pid) return;
    if (!byPatient.has(pid)) byPatient.set(pid, []);
    byPatient.get(pid).push(a);
  });

  const allStreakRows = [];
  byPatient.forEach((rows, pid) => {
    const ordered = rows.slice().sort((a, b) => noShowReportSortKey(b).localeCompare(noShowReportSortKey(a)));
    if (!ordered.length) return;

    let streak = 0;
    let lastNoShowDate = '';
    for (const row of ordered) {
      if (String(row.status || '').trim() !== 'No-Show') break;
      streak += 1;
      if (!lastNoShowDate) lastNoShowDate = String(row.date || '').trim();
    }
    if (streak < 1) return;

    const totalNoShows = ordered.filter(r => String(r.status || '').trim() === 'No-Show').length;
    const latest = ordered[0] || {};
    const sample = ordered.find(r => String(r.status || '').trim() === 'No-Show') || latest;

    const reportRow = {
      patient_id: pid,
      mr_number: sample.mr_number || '',
      patient_name: sample.patient_name || 'Unknown',
      second_name: '',
      phone: sample.patient_phone || '',
      civil_id: sample.civil_id || '',
      consecutive_no_show_streak: streak,
      total_no_shows: totalNoShows,
      last_no_show_date: lastNoShowDate,
      latest_status: latest.status || ''
    };

    const searchHay = [reportRow.patient_name, reportRow.mr_number, reportRow.phone, reportRow.civil_id]
      .map(v => String(v || '').toLowerCase());
    if (q && !searchHay.some(v => v.includes(q))) return;

    allStreakRows.push(reportRow);
  });

  allStreakRows.sort((a, b) => {
    const byStreak = (parseInt(b.consecutive_no_show_streak || 0, 10) - parseInt(a.consecutive_no_show_streak || 0, 10));
    if (byStreak !== 0) return byStreak;
    return String(b.last_no_show_date || '').localeCompare(String(a.last_no_show_date || ''));
  });

  const filteredRows = allStreakRows.filter(r => (parseInt(r.consecutive_no_show_streak || 0, 10) >= threshold));
  const total = filteredRows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
  const start = (safePage - 1) * limit;
  const rows = filteredRows.slice(start, start + limit);
  return {
    threshold,
    rows,
    page: safePage,
    pages,
    total,
    limit,
    summary: {
      total_flagged_patients: filteredRows.length,
      max_streak: allStreakRows.length ? Math.max(...allStreakRows.map(r => parseInt(r.consecutive_no_show_streak || 0, 10))) : 0,
      total_any_no_show_streak: allStreakRows.length,
      threshold_counts: {
        1: allStreakRows.filter(r => parseInt(r.consecutive_no_show_streak || 0, 10) >= 1).length,
        2: allStreakRows.filter(r => parseInt(r.consecutive_no_show_streak || 0, 10) >= 2).length,
        3: allStreakRows.filter(r => parseInt(r.consecutive_no_show_streak || 0, 10) >= 3).length,
        5: allStreakRows.filter(r => parseInt(r.consecutive_no_show_streak || 0, 10) >= 5).length
      }
    }
  };
}

async function loadNoShowReport(page = _noShowReportPage || 1) {
  _noShowReportPage = Math.max(1, parseInt(page, 10) || 1);
  const wrap = document.getElementById('noShowReportBody');
  if (!wrap) return;
  try {
    const thresholdValue = Math.max(1, parseInt(document.getElementById('nsrThreshold')?.value || '1', 10));
    const searchValue = (document.getElementById('nsrSearch')?.value || '').trim();
    const params = new URLSearchParams({
      threshold: String(thresholdValue),
      page: String(_noShowReportPage),
      limit: String(NO_SHOW_REPORT_PAGE_SIZE)
    });
    if (searchValue) params.set('search', searchValue);

    let rep = null;
    try {
      rep = await apiFetch(`/api/reports/no-show?${params.toString()}`);
    } catch (_) {
      rep = await loadNoShowReportFallback(thresholdValue, searchValue, _noShowReportPage, NO_SHOW_REPORT_PAGE_SIZE);
    }
    let rows = Array.isArray(rep.rows) ? rep.rows : [];
    let summary = rep.summary || {};
    const effectiveThreshold = Math.max(1, parseInt(rep.threshold || thresholdValue, 10));
    let total = Math.max(0, parseInt(rep.total || rows.length, 10));
    let pages = Math.max(1, parseInt(rep.pages || Math.ceil(Math.max(1, total) / NO_SHOW_REPORT_PAGE_SIZE), 10));
    let safePage = Math.min(Math.max(1, parseInt(rep.page || _noShowReportPage, 10)), pages);
    _noShowReportPage = safePage;
    const thresholdInput = document.getElementById('nsrThreshold');
    if (thresholdInput) thresholdInput.value = String(effectiveThreshold);

    // If backend responds successfully but with empty rows (stale server/build), use local fallback data.
    if (!rows.length) {
      try {
        const localRep = await loadNoShowReportFallback(effectiveThreshold, searchValue, _noShowReportPage, NO_SHOW_REPORT_PAGE_SIZE);
        if (Array.isArray(localRep.rows) && localRep.rows.length) {
          rows = localRep.rows;
          summary = localRep.summary || summary;
          total = Math.max(0, parseInt(localRep.total || rows.length, 10));
          pages = Math.max(1, parseInt(localRep.pages || Math.ceil(Math.max(1, total) / NO_SHOW_REPORT_PAGE_SIZE), 10));
          safePage = Math.min(Math.max(1, parseInt(localRep.page || _noShowReportPage, 10)), pages);
          _noShowReportPage = safePage;
        }
      } catch (_) {
        // keep original API response path
      }
    }

    window._lastNoShowRows = rows;

    if (!rows.length) {
      const anyStreak = parseInt(summary.total_any_no_show_streak || 0, 10);
      const tc = summary.threshold_counts || {};
      let previewRows = [];
      if (effectiveThreshold > 1) {
        try {
          const preview = await loadNoShowReportFallback(1, searchValue, 1, 10);
          previewRows = Array.isArray(preview.rows) ? preview.rows.slice(0, 10) : [];
        } catch (_) {
          previewRows = [];
        }
      }
      const hint = anyStreak > 0
        ? `No patients with ${effectiveThreshold}+ consecutive no-shows. Try threshold 1 or 2. (>=1: ${parseInt(tc[1] || 0, 10)}, >=2: ${parseInt(tc[2] || 0, 10)}, >=3: ${parseInt(tc[3] || 0, 10)}, >=5: ${parseInt(tc[5] || 0, 10)})`
        : 'No no-show streaks found for current filter.';
      if (!previewRows.length) {
        wrap.innerHTML = emptyState(IC.pending, 'No patients found', hint);
        return;
      }
      wrap.innerHTML = `
        <div class="alert" style="margin-bottom:10px;border:1px solid var(--c-warning);background:var(--c-warning-bg);color:var(--text)">
          No matches for threshold <strong>${effectiveThreshold}</strong>. Showing preview for threshold <strong>1</strong>.
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>MR#</th><th>Patient</th><th>Phone</th><th>No-Show Streak</th><th>Last No-Show Date</th></tr></thead>
          <tbody>${previewRows.map(r => `<tr>
            <td><span class="code-id code-id-primary">${escHtml(r.mr_number || '-')}</span></td>
            <td>${escHtml(r.patient_name || 'Unknown')}</td>
            <td>${escHtml(r.phone || '-')}</td>
            <td><strong>${parseInt(r.consecutive_no_show_streak || 0, 10)}</strong></td>
            <td>${escHtml(formatDateTime(r.last_no_show_date || ''))}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Threshold</div><div class="stat-value">${effectiveThreshold}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Flagged Patients</div><div class="stat-value">${parseInt(summary.total_flagged_patients || rows.length, 10)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Max Streak</div><div class="stat-value">${parseInt(summary.max_streak || 0, 10)}</div></div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>MR#</th><th>Patient</th><th>Phone</th><th>Civil ID</th><th>Consecutive No-Show</th><th>Total No-Show</th><th>Last No-Show Date</th><th>Latest Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><span class="code-id code-id-primary">${escHtml(r.mr_number || '-')}</span></td>
          <td>${escHtml(r.patient_name || 'Unknown')}${r.second_name ? ` <span class="text-muted text-sm">${escHtml(r.second_name)}</span>` : ''}</td>
          <td>${escHtml(r.phone || '-')}</td>
          <td>${escHtml(r.civil_id || '-')}</td>
          <td><strong>${parseInt(r.consecutive_no_show_streak || 0, 10)}</strong></td>
          <td>${parseInt(r.total_no_shows || 0, 10)}</td>
          <td>${escHtml(formatDateTime(r.last_no_show_date || ''))}</td>
          <td>${statusBadge(r.latest_status || 'No-Show')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 4px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${((safePage - 1) * NO_SHOW_REPORT_PAGE_SIZE) + 1}-${Math.min(safePage * NO_SHOW_REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:4px;margin-left:auto">
          <button class="btn btn-sm" onclick="loadNoShowReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadNoShowReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadRevenueReport() {
  try {
    const rows = await apiFetch('/api/reports/revenue');
    window._lastRevenueRows = rows || [];
    const el = document.getElementById('revenueReportBody');
    if (!rows.length) { el.innerHTML = emptyState(IC.reports, 'No revenue data', 'Revenue data will appear here when bills are paid'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Active Bills</th><th>Cancelled Bills</th><th>Gross Revenue</th><th>Total Discount</th><th>Net Revenue</th><th>Total Refund</th><th>Final Revenue</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.day}</td>
        <td>${parseInt(r.bills || 0, 10)}</td>
        <td>${parseInt(r.cancelled_bills || 0, 10)}</td>
        <td>KD ${parseFloat(r.gross_revenue || 0).toFixed(3)}</td>
        <td>KD ${parseFloat(r.total_discount || 0).toFixed(3)}</td>
        <td>KD ${parseFloat(r.net_revenue || 0).toFixed(3)}</td>
        <td style="color:#d32f2f">KD ${parseFloat(r.total_refund || 0).toFixed(3)}</td>
        <td><strong>KD ${parseFloat(r.final_revenue ?? r.revenue ?? 0).toFixed(3)}</strong></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    document.getElementById('revenueReportBody').innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadDiscountsReport() {
  const el = document.getElementById('discountReportBody');
  if (!el) return;
  el.innerHTML = skeletonTable(4);
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('discRptFrom')?.value || '';
    const to   = document.getElementById('discRptTo')?.value || '';
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to', to);
    const rep = await apiFetch(`/api/reports/discounts?${params.toString()}`);
    const bills = rep.bills || [];
    const byType = rep.by_type || {};
    const summaryHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Total Discounts</div><div class="stat-value">KD ${parseFloat(rep.total_discount||0).toFixed(3)}</div></div>
      <div class="stat-card"><div class="stat-label">Bills with Discount</div><div class="stat-value">${rep.bill_count||0}</div></div>
      ${Object.entries(byType).map(([type, d]) => `<div class="stat-card"><div class="stat-label">${escHtml(type)} discounts</div><div class="stat-value">${d.count} - KD ${d.total.toFixed(3)}</div></div>`).join('')}
    </div>`;
    if (!bills.length) { el.innerHTML = summaryHtml + emptyState(IC.discount, 'No discounts found', 'No bills with discounts in selected period'); return; }
    el.innerHTML = summaryHtml + `<div class="table-wrap"><table>
      <thead><tr><th>Bill No.</th><th>Visit ID</th><th>Patient</th><th>Discount</th><th>Discount Amt</th><th>Subtotal</th><th>Net Total</th><th>Created By</th><th>Date</th></tr></thead>
      <tbody>${bills.map(b => `<tr>
        <td><span class="code-id code-id-primary">${escHtml(b.bill_number||'-')}</span></td>
        <td><span class="code-id code-id-primary">${escHtml(b.visit_id||'-')}</span></td>
        <td>${escHtml(b.patient_name)}</td>
        <td>${escHtml(b.discount_label||'-')}</td>
        <td style="color:#e53935"><strong>- KD ${parseFloat(b.discount_amount||0).toFixed(3)}</strong></td>
        <td>KD ${parseFloat(b.subtotal||0).toFixed(3)}</td>
        <td><strong>KD ${parseFloat(b.total||0).toFixed(3)}</strong></td>
        <td>${escHtml(b.created_by_name||'-')}</td>
        <td class="text-muted text-sm">${escHtml(formatDateTime(b.created_at||''))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`; }
}

async function loadRefundsReport() {
  const el = document.getElementById('refundReportBody');
  if (!el) return;
  el.innerHTML = skeletonTable(4);
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('refRptFrom')?.value || '';
    const to   = document.getElementById('refRptTo')?.value || '';
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to', to);
    const rep = await apiFetch(`/api/reports/refunds?${params.toString()}`);
    const refunds = rep.refunds || [];
    const byUser = rep.by_user || {};
    const byPay  = rep.by_payment_type || {};
    const topReasons = rep.top_reasons || [];
    const summaryHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Total Refunded</div><div class="stat-value">KD ${parseFloat(rep.total_refunded||0).toFixed(3)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Refunds</div><div class="stat-value">${rep.refund_count||0}</div></div>
    </div>
    ${Object.keys(byUser).length ? `<div style="margin-bottom:12px"><strong>By User:</strong> ${Object.entries(byUser).map(([u,d])=>`${escHtml(u)}: ${d.count} refunds - KD ${d.total.toFixed(3)}`).join(' | ')}</div>` : ''}
    ${Object.keys(byPay).length ? `<div style="margin-bottom:12px"><strong>By Payment Type:</strong> ${Object.entries(byPay).map(([p,d])=>`${escHtml(p)}: ${d.count} - KD ${d.total.toFixed(3)}`).join(' | ')}</div>` : ''}
    ${topReasons.length ? `<div style="margin-bottom:12px"><strong>Top Reasons:</strong> ${topReasons.map(r=>`${escHtml(r.reason)} (${r.count}x)`).join(', ')}</div>` : ''}`;
    if (!refunds.length) { el.innerHTML = summaryHtml + emptyState(IC.refund, 'No refunds found', 'No refunds in selected period'); return; }
    el.innerHTML = summaryHtml + `<div class="table-wrap"><table>
      <thead><tr><th>Bill No.</th><th>Patient</th><th>Type</th><th>Amount</th><th>Payment Type</th><th>Reason</th><th>Refunded By</th><th>Date</th></tr></thead>
      <tbody>${refunds.map(r => `<tr>
        <td><span class="code-id code-id-primary">${escHtml(r.bill_number||'-')}</span></td>
        <td>${escHtml(r.patient_name||'-')}</td>
        <td>${statusBadge(r.refund_type||'partial')}</td>
        <td style="color:#e53935"><strong>- KD ${parseFloat(r.refund_amount||0).toFixed(3)}</strong></td>
        <td>${escHtml(r.refund_payment_type||'-')}</td>
        <td class="text-sm">${escHtml(r.refund_reason||'-')}</td>
        <td>${escHtml(r.refunded_by_name||'-')}</td>
        <td class="text-muted text-sm">${escHtml(formatDateTime(r.created_at||''))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`; }
}

async function loadCancelledBillsReport() {
  const el = document.getElementById('cancelledBillReportBody');
  if (!el) return;
  el.innerHTML = skeletonTable(4);
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('canRptFrom')?.value || '';
    const to = document.getElementById('canRptTo')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    const rep = await apiFetch(`/api/reports/cancelled-bills?${params.toString()}`);
    const rows = rep.bills || [];
    const byUser = rep.by_user || {};
    const topReasons = rep.top_reasons || [];

    const summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:12px">
        <div class="stat-card"><div class="stat-label">Cancelled Bills</div><div class="stat-value">${parseInt(rep.cancelled_count || 0, 10)}</div></div>
        <div class="stat-card"><div class="stat-label">Cancelled Amount (Net)</div><div class="stat-value">KD ${parseFloat(rep.total_cancelled_amount || 0).toFixed(3)}</div></div>
        <div class="stat-card"><div class="stat-label">Cancelled Subtotal</div><div class="stat-value">KD ${parseFloat(rep.total_subtotal || 0).toFixed(3)}</div></div>
        <div class="stat-card"><div class="stat-label">Discount on Cancelled</div><div class="stat-value" style="color:#d32f2f">KD ${parseFloat(rep.total_discount || 0).toFixed(3)}</div></div>
      </div>
      ${Object.keys(byUser).length ? `<div style="margin-bottom:10px"><strong>By User:</strong> ${Object.entries(byUser).map(([u,d])=>`${escHtml(u)}: ${d.count} bills - KD ${parseFloat(d.total || 0).toFixed(3)}`).join(' | ')}</div>` : ''}
      ${topReasons.length ? `<div style="margin-bottom:12px"><strong>Top Reasons:</strong> ${topReasons.map(r=>`${escHtml(r.reason)} (${parseInt(r.count || 0, 10)}x)`).join(', ')}</div>` : ''}`;

    if (!rows.length) {
      el.innerHTML = summaryHtml + emptyState(IC.x, 'No cancelled bills found', 'No cancelled bills in selected period');
      return;
    }

    el.innerHTML = summaryHtml + `<div class="table-wrap"><table>
      <thead><tr><th>Cancelled Date</th><th>Bill No.</th><th>Visit ID</th><th>Patient</th><th>Amount</th><th>Payment Method</th><th>Cancelled By</th><th>Reason</th><th>Bill Created</th></tr></thead>
      <tbody>${rows.map(b => `<tr>
        <td class="text-muted text-sm">${escHtml(formatDateTime(b.cancelled_at || ''))}</td>
        <td><span class="code-id code-id-primary">${escHtml(b.bill_number || '-')}</span></td>
        <td><span class="code-id code-id-primary">${escHtml(b.visit_id || '-')}</span></td>
        <td>${escHtml(b.patient_name || '-')} ${b.mr_number ? `<span class="code-id code-id-muted">${escHtml(b.mr_number)}</span>` : ''}</td>
        <td><strong>KD ${parseFloat(b.total || 0).toFixed(3)}</strong></td>
        <td>${escHtml(b.payment_method || '-')}</td>
        <td>${escHtml(b.cancelled_by_name || '-')}</td>
        <td class="text-sm">${escHtml(b.cancellation_reason || '-')}</td>
        <td class="text-muted text-sm">${escHtml(formatDateTime(b.created_at || ''))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function clearDoctorPerformanceFilters() {
  const today = new Date().toLocaleDateString('sv');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('sv');
  const from = document.getElementById('dprFrom');
  const to = document.getElementById('dprTo');
  const doctor = document.getElementById('dprDoctor');
  const trend = document.getElementById('dprTrend');
  const disc = document.getElementById('dprDiscThreshold');
  const ref = document.getElementById('dprRefThreshold');
  const comEnabled = document.getElementById('dprCommissionEnabled');
  const comType = document.getElementById('dprCommissionType');
  const comVal = document.getElementById('dprCommissionValue');
  if (from) from.value = monthStart;
  if (to) to.value = today;
  if (doctor) doctor.value = '';
  if (trend) trend.value = 'daily';
  if (disc) disc.value = '20';
  if (ref) ref.value = '10';
  if (comEnabled) comEnabled.checked = false;
  if (comType) comType.value = 'percentage';
  if (comVal) comVal.value = '0';
  loadDoctorPerformanceReport();
}

async function loadDoctorPerformanceReport() {
  const el = document.getElementById('doctorPerformanceBody');
  if (!el) return;
  el.innerHTML = skeletonTable(6);
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('dprFrom')?.value || '';
    const to = document.getElementById('dprTo')?.value || '';
    const doctorId = document.getElementById('dprDoctor')?.value || '';
    const trend = document.getElementById('dprTrend')?.value || 'daily';
    const discountThreshold = document.getElementById('dprDiscThreshold')?.value || '20';
    const refundThreshold = document.getElementById('dprRefThreshold')?.value || '10';
    const commissionEnabled = !!document.getElementById('dprCommissionEnabled')?.checked;
    const commissionType = document.getElementById('dprCommissionType')?.value || 'percentage';
    const commissionValue = document.getElementById('dprCommissionValue')?.value || '0';

    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (doctorId) params.set('doctor_id', doctorId);
    params.set('trend', trend);
    params.set('discount_threshold', discountThreshold);
    params.set('refund_threshold', refundThreshold);
    params.set('commission_enabled', commissionEnabled ? '1' : '0');
    params.set('commission_type', commissionType);
    params.set('commission_value', commissionValue);

    const rep = await apiFetch(`/api/reports/doctor-performance?${params.toString()}`);
    const rows = Array.isArray(rep.summary) ? rep.summary : [];
    window._lastDoctorPerformanceRows = rows;
    const financialOnly = String(rep.metric_scope || '') === 'financial-only';

    const doctorSelect = document.getElementById('dprDoctor');
    if (doctorSelect) {
      const selected = doctorSelect.value || '';
      doctorSelect.innerHTML = `<option value="">All Doctors</option>${(rep.filters?.doctors || []).map(d => `<option value="${d.id}"${String(d.id)===selected?' selected':''}>${escHtml(d.name || ('Doctor #' + d.id))}</option>`).join('')}`;
    }

    if (!rows.length) {
      el.innerHTML = emptyState(IC.users, 'No doctor performance data', 'No records for selected filters');
      return;
    }

    const sums = rows.reduce((acc, r) => {
      acc.patients += parseInt(r.total_patients || 0, 10);
      acc.visits += parseInt(r.total_visits || 0, 10);
      acc.final += parseFloat(r.final_revenue || 0) || 0;
      acc.util += parseFloat(r.utilization_percent || 0) || 0;
      acc.rating += parseFloat(r.average_rating || 0) || 0;
      return acc;
    }, { patients: 0, visits: 0, final: 0, util: 0, rating: 0 });

    const doctorCount = Math.max(1, rows.length);
    const chartFocus = rep.chart_focus || rows[0] || {};

    const renderBars = (points, valueKey, labelKey, colorVar, isCurrency = false) => {
      const maxVal = Math.max(1, ...(points || []).map(p => parseFloat(p[valueKey] || 0) || 0));
      return (points || []).map(p => {
        const val = parseFloat(p[valueKey] || 0) || 0;
        const pct = Math.max(2, Math.min(100, (val / maxVal) * 100));
        return `<div style="display:grid;grid-template-columns:120px 1fr auto;gap:8px;align-items:center;margin-bottom:6px">
          <span class="text-muted text-sm">${escHtml(String(p[labelKey] || ''))}</span>
          <div style="height:10px;background:var(--bg-hover);border-radius:999px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${colorVar};border-radius:999px"></div></div>
          <strong class="text-sm">${isCurrency ? 'KD ' : ''}${val.toFixed(isCurrency ? 3 : 0)}</strong>
        </div>`;
      }).join('') || '<span class="text-muted text-sm">No trend data</span>';
    };

    const summaryHtml = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Final Revenue</div><div class="stat-value">KD ${sums.final.toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Patients Seen</div><div class="stat-value">${sums.patients}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Utilization Avg</div><div class="stat-value">${(sums.util / doctorCount).toFixed(1)}%</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Avg Rating</div><div class="stat-value">${(sums.rating / doctorCount).toFixed(2)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Visits</div><div class="stat-value">${sums.visits}</div></div></div>
      </div>`;

    const headers = financialOnly
      ? '<tr><th>Doctor</th><th>Specialization</th><th>Gross Revenue</th><th>Total Discount</th><th>Net Revenue</th><th>Refund</th><th>Final Revenue</th><th>Commission</th></tr>'
      : '<tr><th>Doctor</th><th>Specialization</th><th>Total Patients</th><th>Total Visits</th><th>Gross Revenue</th><th>Total Discount</th><th>Net Revenue</th><th>Refund</th><th>Final Revenue</th><th>Utilization %</th><th>Avg Consultation</th><th>Avg Delay</th><th>Rating</th><th>Risk Flags</th></tr>';

    const bodyRows = rows.map(r => {
      if (financialOnly) {
        return `<tr>
          <td><strong>${escHtml(r.doctor_name || 'Doctor')}</strong></td>
          <td>${escHtml(r.specialization || '-')}</td>
          <td>KD ${parseFloat(r.gross_revenue || 0).toFixed(3)}</td>
          <td style="color:#d32f2f">KD ${parseFloat(r.total_discount || 0).toFixed(3)}</td>
          <td>KD ${parseFloat(r.net_revenue || 0).toFixed(3)}</td>
          <td style="color:#d32f2f">KD ${parseFloat(r.total_refund || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.final_revenue || 0).toFixed(3)}</strong></td>
          <td>KD ${parseFloat(r.commission || 0).toFixed(3)}</td>
        </tr>`;
      }
      return `<tr>
        <td><strong>${escHtml(r.doctor_name || 'Doctor')}</strong></td>
        <td>${escHtml(r.specialization || '-')}</td>
        <td>${parseInt(r.total_patients || 0, 10)}</td>
        <td>${parseInt(r.total_visits || 0, 10)}</td>
        <td>KD ${parseFloat(r.gross_revenue || 0).toFixed(3)}</td>
        <td style="color:#d32f2f">KD ${parseFloat(r.total_discount || 0).toFixed(3)}</td>
        <td>KD ${parseFloat(r.net_revenue || 0).toFixed(3)}</td>
        <td style="color:#d32f2f">KD ${parseFloat(r.total_refund || 0).toFixed(3)}</td>
        <td><strong>KD ${parseFloat(r.final_revenue || 0).toFixed(3)}</strong></td>
        <td>${parseFloat(r.utilization_percent || 0).toFixed(1)}%</td>
        <td>${parseFloat(r.avg_consultation_time_min || 0).toFixed(1)} min</td>
        <td>${parseFloat(r.avg_delay_min || 0).toFixed(1)} min</td>
        <td>${parseFloat(r.average_rating || 0).toFixed(2)} (${parseInt(r.total_reviews || 0, 10)})</td>
        <td>${Array.isArray(r.risk_flags) && r.risk_flags.length ? r.risk_flags.map(f => `<span class="badge badge-warning" style="margin-right:4px">${escHtml(f)}</span>`).join('') : '<span class="text-muted text-sm">None</span>'}</td>
      </tr>`;
    }).join('');

    const trendHtml = !financialOnly ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:12px">
        <div class="card" style="margin:0;border:1px solid var(--border-light)">
          <div class="card-title" style="margin-bottom:8px">Revenue Trend - ${escHtml(chartFocus.doctor_name || 'Selected Doctor')}</div>
          ${renderBars(chartFocus.revenue_trend || [], 'final_revenue', 'label', 'var(--c-primary)', true)}
        </div>
        <div class="card" style="margin:0;border:1px solid var(--border-light)">
          <div class="card-title" style="margin-bottom:8px">Patient Trend</div>
          ${renderBars(chartFocus.patient_trend || [], 'patients', 'label', 'var(--c-success)')}
        </div>
        <div class="card" style="margin:0;border:1px solid var(--border-light)">
          <div class="card-title" style="margin-bottom:8px">Service Distribution</div>
          ${renderBars(chartFocus.service_distribution || [], 'count', 'service_name', 'var(--c-warning)')}
        </div>
      </div>` : '';

    el.innerHTML = summaryHtml + `<div class="table-wrap"><table><thead>${headers}</thead><tbody>${bodyRows}</tbody></table></div>` + trendHtml;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadUserCollectionReport(page) {
  const wrap = document.getElementById('userCollectionBody');
  if (!wrap) return;
  _userCollectionReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('ucrFrom')?.value || '';
    const to = document.getElementById('ucrTo')?.value || '';
    const userId = document.getElementById('ucrUser')?.value || '';
    const method = document.getElementById('ucrMethod')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (userId) params.set('user_id', userId);
    if (method) params.set('payment_method', method);
    params.set('page', String(_userCollectionReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));

    const rep = await apiFetch(`/api/reports/user-collections?${params.toString()}`);
    const rows = rep.rows || [];
    window._lastUserCollectionRows = rows;
    const summary = rep.summary || {};
    const methodTotals = rep.totals_by_payment_method || [];
    const filterData = rep.filters || { users: [], payment_methods: [] };
    const total = Math.max(0, parseInt(rep.total, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || 1);
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _userCollectionReportPage), pages);
    _userCollectionReportPage = safePage;

    const uSel = document.getElementById('ucrUser');
    const mSel = document.getElementById('ucrMethod');
    if (uSel) {
      const selected = uSel.value || '';
      uSel.innerHTML = `<option value="">All Users</option>${(filterData.users || []).map(u => `<option value="${u.id}"${String(u.id)===selected?' selected':''}>${escHtml(u.name)}</option>`).join('')}`;
    }
    if (mSel) {
      const selected = mSel.value || '';
      mSel.innerHTML = `<option value="">All Payment Methods</option>${(filterData.payment_methods || []).map(pm => `<option${pm===selected?' selected':''}>${escHtml(pm)}</option>`).join('')}`;
    }

    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.billing, 'No collection data', 'No paid bills found for selected filters');
      return;
    }

    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Net Collection</div><div class="stat-value">KD ${parseFloat(summary.total_collection || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Gross Collection</div><div class="stat-value">KD ${parseFloat(summary.gross_collection || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Refund Deduction</div><div class="stat-value" style="color:#d32f2f">- KD ${parseFloat(summary.total_refunded || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Rows</div><div class="stat-value">${parseInt(summary.rows_count || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Bill Entries</div><div class="stat-value">${parseInt(summary.total_bill_entries || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Date Range</div><div class="stat-value" style="font-size:14px">${escHtml(summary.date_from || '-')} to ${escHtml(summary.date_to || '-')}</div></div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${methodTotals.map(m => `<span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>${escHtml(m.payment_method)}</strong>: KD ${parseFloat(m.amount || 0).toFixed(3)}</span>`).join('')}
      </div>
      <div class="table-wrap"><table class="user-collection-table">
        <thead><tr><th>Date</th><th>User</th><th>Payment Method</th><th>Gross</th><th>Refund</th><th>Net Amount</th><th>Bill Count</th><th>Breakdown</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escHtml(r.date || '-')}</td>
          <td><strong>${escHtml(r.user_name || 'Unknown')}</strong></td>
          <td>${escHtml(r.payment_method || '-')}</td>
          <td>KD ${parseFloat(r.gross_amount || 0).toFixed(3)}</td>
          <td style="color:#d32f2f">- KD ${parseFloat(r.refunded_amount || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.amount || 0).toFixed(3)}</strong></td>
          <td>${parseInt(r.bills_count || 0)}</td>
          <td>
            ${(Array.isArray(r.bills) && r.bills.length)
              ? `<details class="ucr-breakdown"><summary>${r.bills.length} bill${r.bills.length !== 1 ? 's' : ''}</summary>
                   <div class="ucr-breakdown-list">${r.bills.map(b => `<div class="ucr-breakdown-item">
                     <div><strong>${escHtml(b.bill_number || ('Bill #' + b.bill_id))}</strong> - ${escHtml(b.patient_name || 'Unknown')} ${b.mr_number ? `<span class="code-id code-id-muted">${escHtml(b.mr_number)}</span>` : ''}</div>
                     <div class="text-sm text-muted">Visit: ${escHtml(b.visit_id || '-')} | Status: ${escHtml(b.payment_status || '-')} | Gross: KD ${parseFloat(b.split_amount || 0).toFixed(3)} | Refund: KD ${parseFloat(b.refunded_amount || 0).toFixed(3)} | Net: KD ${parseFloat(b.net_amount || 0).toFixed(3)}</div>
                   </div>`).join('')}</div>
                 </details>`
              : '<span class="text-muted text-sm">-</span>'}
          </td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadUserCollectionReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadUserCollectionReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadActivityLogs() {
  const wrap = document.getElementById('activityLogBody');
  if (!wrap) return;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('logFrom')?.value || '';
    const to = document.getElementById('logTo')?.value || '';
    const q = document.getElementById('logSearch')?.value || '';
    const action = document.getElementById('logAction')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (q.trim()) params.set('search', q.trim());
    if (action) params.set('action', action);
    const rows = await apiFetch(`/api/activity-logs?${params.toString()}`);
    window._lastActivityLogRows = rows || [];
    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.reports, 'No activity logs', 'No matching system activity for selected filters');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap" style="margin:0"><table>
      <thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Module</th><th>Patient Name</th><th>MR Number</th><th>Visit ID</th><th>Notes</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="text-sm text-muted">${escHtml(formatDateTime(r.at || ''))}</td>
        <td><strong>${escHtml(r.actor_name || 'System')}</strong><br><span class="text-muted text-sm">${escHtml(r.actor_username || r.actor_role || 'system')}</span></td>
        <td><span class="badge badge-scheduled">${escHtml((r.action || '').replace(/_/g,' '))}</span></td>
        <td>${escHtml(r.module || 'system')}</td>
        <td>${escHtml(r.patient_name || '-')}</td>
        <td>${r.patient_mr_number ? `<span class="code-id code-id-muted">${escHtml(r.patient_mr_number)}</span>` : '-'}</td>
        <td>${r.visit_id ? `<span class="code-id code-id-primary">${escHtml(r.visit_id)}</span>` : '-'}</td>
        <td class="text-sm">${escHtml(r.notes || '-')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadServiceConsumptionReport(page) {
  const wrap = document.getElementById('serviceConsumptionBody');
  if (!wrap) return;
  _serviceConsumptionReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('scnFrom')?.value || '';
    const to = document.getElementById('scnTo')?.value || '';
    const q = document.getElementById('scnSearch')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (q.trim()) params.set('search', q.trim());
    params.set('page', String(_serviceConsumptionReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));
    const rep = await apiFetch(`/api/reports/service-consumption?${params.toString()}`);
    const rows = rep.rows || [];
    window._lastServiceConsumptionRows = rows;
    const summary = rep.summary || { total_service_qty: 0, total_consumed_qty: 0, total_records: 0, total_cost: 0 };
    const total = Math.max(0, parseInt(rep.total, 10) || parseInt(summary.entries, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || Math.ceil(Math.max(1, total) / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _serviceConsumptionReportPage), pages);
    _serviceConsumptionReportPage = safePage;
    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.product || IC.empty, 'No consumption data', 'No service-product consumption found for selected filters');
      return;
    }
    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Service Uses</div><div class="stat-value">${summary.total_service_qty || 0}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Consumption</div><div class="stat-value">${summary.total_consumed_qty || 0}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Cost</div><div class="stat-value">KD ${parseFloat(summary.total_cost || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Entries</div><div class="stat-value">${summary.entries || 0}</div></div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Service</th><th>Product</th><th>SKU</th><th>Service Uses</th><th>Total Consumed</th><th>Unit</th><th>Unit Cost</th><th>Total Cost</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>
          <td>${((safePage - 1) * REPORT_PAGE_SIZE) + i + 1}</td>
          <td><strong>${escHtml(r.service_name || '')}</strong></td>
          <td>${escHtml(r.product_name || '')}</td>
          <td>${escHtml(r.product_sku || '-')}</td>
          <td>${r.total_service_qty || 0}</td>
          <td><strong>${r.total_consumed_qty || 0}</strong></td>
          <td>${escHtml(r.unit || '-')}</td>
          <td>KD ${parseFloat(r.avg_unit_cost || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.total_cost || 0).toFixed(3)}</strong></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadServiceConsumptionReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadServiceConsumptionReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadBilledServicesReport(page) {
  const wrap = document.getElementById('billedServicesBody');
  if (!wrap) return;
  _billedServicesReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('bsrFrom')?.value || '';
    const to = document.getElementById('bsrTo')?.value || '';
    const deptId = document.getElementById('bsrDepartment')?.value || '';
    const doctorId = document.getElementById('bsrDoctor')?.value || '';
    const serviceId = document.getElementById('bsrService')?.value || '';
    const search = document.getElementById('bsrSearch')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (deptId) params.set('department_id', deptId);
    if (doctorId) params.set('doctor_id', doctorId);
    if (serviceId) params.set('service_id', serviceId);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', String(_billedServicesReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));

    const rep = await apiFetch(`/api/reports/billed-services?${params.toString()}`);
    const rows = rep.rows || [];
    window._lastBilledServicesRows = rows;
    const summary = rep.summary || {};
    const f = rep.filters || { doctors: [], departments: [], services: [] };
    const total = Math.max(0, parseInt(rep.total, 10) || parseInt(summary.rows_count, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || Math.ceil(Math.max(1, total) / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _billedServicesReportPage), pages);
    _billedServicesReportPage = safePage;

    const dSel = document.getElementById('bsrDepartment');
    const drSel = document.getElementById('bsrDoctor');
    const sSel = document.getElementById('bsrService');
    if (dSel) {
      const selected = dSel.value || '';
      dSel.innerHTML = `<option value="">All Departments</option>${(f.departments || []).map(d => `<option value="${d.id}"${String(d.id)===selected?' selected':''}>${escHtml(d.name || 'Unknown')}</option>`).join('')}`;
    }
    if (drSel) {
      const selected = drSel.value || '';
      drSel.innerHTML = `<option value="">All Doctors</option>${(f.doctors || []).map(d => `<option value="${d.id}"${String(d.id)===selected?' selected':''}>${escHtml(d.name || 'Unknown')}</option>`).join('')}`;
    }
    if (sSel) {
      const selected = sSel.value || '';
      sSel.innerHTML = `<option value="">All Services</option>${(f.services || []).map(s => `<option value="${s.id}"${String(s.id)===selected?' selected':''}>${escHtml(s.name || 'Service')}</option>`).join('')}`;
    }

    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.services, 'No billed services', 'No billed service records found for selected filters');
      return;
    }

    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Amount</div><div class="stat-value">KD ${parseFloat(summary.total_amount || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Rows</div><div class="stat-value">${parseInt(summary.rows_count || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Bills</div><div class="stat-value">${parseInt(summary.bills_count || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Services</div><div class="stat-value">${parseInt(summary.services_count || 0)}</div></div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Bill</th><th>Patient</th><th>MR#</th><th>Billed Item</th><th>Service</th><th>Department</th><th>Doctor</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escHtml(r.date || '-')}</td>
          <td>${escHtml(r.bill_number || ('#' + r.bill_id))}<br><span class="text-muted text-sm">${escHtml(r.visit_id || '')}</span></td>
          <td>${escHtml(r.patient_name || '-')}</td>
          <td>${r.mr_number ? `<span class="code-id code-id-muted">${escHtml(r.mr_number)}</span>` : '-'}</td>
          <td><span class="badge badge-secondary">${escHtml(r.item_type || 'Service')}</span><br><span class="text-sm">${escHtml(r.item_name || '-')}</span></td>
          <td><strong>${escHtml(r.service_name || 'Service')}</strong></td>
          <td>${escHtml(r.department_name || 'Unknown')}</td>
          <td>${escHtml(r.doctor_name || 'Unknown')}</td>
          <td>${parseFloat(r.qty || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.amount || 0).toFixed(3)}</strong></td>
          <td>${statusBadge(r.payment_status || 'Pending')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadBilledServicesReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadBilledServicesReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadProductConsumptionReport(page) {
  const wrap = document.getElementById('productConsumptionBody');
  if (!wrap) return;
  _productConsumptionReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('pcnFrom')?.value || '';
    const to = document.getElementById('pcnTo')?.value || '';
    const q = document.getElementById('pcnSearch')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (q.trim()) params.set('search', q.trim());
    params.set('page', String(_productConsumptionReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));
    const rep = await apiFetch(`/api/reports/service-consumption-products?${params.toString()}`);
    const rows = rep.rows || [];
    const summary = rep.summary || { entries: 0, total_service_qty: 0, total_consumed_qty: 0, total_cost: 0 };
    window._lastProductConsumptionRows = rows;
    const total = Math.max(0, parseInt(rep.total, 10) || parseInt(summary.entries, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || Math.ceil(Math.max(1, total) / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _productConsumptionReportPage), pages);
    _productConsumptionReportPage = safePage;
    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.store || IC.empty, 'No product consumption', 'No product-level consumption found for selected filters');
      return;
    }
    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Products</div><div class="stat-value">${summary.entries || 0}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Service Uses</div><div class="stat-value">${summary.total_service_qty || 0}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Consumption</div><div class="stat-value">${summary.total_consumed_qty || 0}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Grand Cost</div><div class="stat-value">KD ${parseFloat(summary.total_cost || 0).toFixed(3)}</div></div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Services Used</th><th>Service Uses</th><th>Total Consumed</th><th>Unit</th><th>Avg Unit Cost</th><th>Total Cost</th><th>Cost Share</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>
          <td>${((safePage - 1) * REPORT_PAGE_SIZE) + i + 1}</td>
          <td><strong>${escHtml(r.product_name || '')}</strong></td>
          <td>${escHtml(r.product_sku || '-')}</td>
          <td>${parseInt(r.services_used_count || 0)}</td>
          <td>${r.total_service_qty || 0}</td>
          <td><strong>${r.total_consumed_qty || 0}</strong></td>
          <td>${escHtml(r.unit || '-')}</td>
          <td>KD ${parseFloat(r.avg_unit_cost || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.total_cost || 0).toFixed(3)}</strong></td>
          <td><strong>${parseFloat(r.cost_share_pct || 0).toFixed(2)}%</strong></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadProductConsumptionReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadProductConsumptionReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadManualConsumptionCostReport(page) {
  const wrap = document.getElementById('manualConsumptionCostBody');
  if (!wrap) return;
  _manualConsumptionCostReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('mccFrom')?.value || '';
    const to = document.getElementById('mccTo')?.value || '';
    const q = document.getElementById('mccSearch')?.value || '';
    const storeId = document.getElementById('mccStore')?.value || '';
    const reason = document.getElementById('mccReason')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (q.trim()) params.set('search', q.trim());
    if (storeId) params.set('store_id', storeId);
    if (reason) params.set('reason', reason);
    params.set('page', String(_manualConsumptionCostReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));

    const rep = await apiFetch(`/api/reports/manual-consumption-cost?${params.toString()}`);
    const rows = rep.rows || [];
    const summary = rep.summary || {};
    const storeTotals = rep.store_totals || [];
    const filters = rep.filters || { stores: [] };
    window._lastManualConsumptionCostRows = rows;

    const total = Math.max(0, parseInt(rep.total, 10) || parseInt(summary.rows_count, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || Math.ceil(Math.max(1, total) / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _manualConsumptionCostReportPage), pages);
    _manualConsumptionCostReportPage = safePage;

    const storeSel = document.getElementById('mccStore');
    if (storeSel) {
      const selected = storeSel.value || '';
      storeSel.innerHTML = `<option value="">All Stores</option>${(filters.stores || []).map(s => `<option value="${s.id}"${String(s.id)===selected?' selected':''}>${escHtml(s.name || 'Store')}</option>`).join('')}`;
    }

    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.store || IC.empty, 'No manual consumption data', 'No manual stock consumption found for selected filters');
      return;
    }

    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Rows</div><div class="stat-value">${parseInt(summary.rows_count || 0, 10)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Entries</div><div class="stat-value">${parseInt(summary.entries_count || 0, 10)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Qty</div><div class="stat-value">${parseFloat(summary.total_qty || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Cost</div><div class="stat-value">KD ${parseFloat(summary.total_cost || 0).toFixed(3)}</div></div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${storeTotals.map(s => `<span style="padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px"><strong>${escHtml(s.store_name || 'Store')}</strong>: KD ${parseFloat(s.total_cost || 0).toFixed(3)}</span>`).join('')}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Store</th><th>Entry #</th><th>Item</th><th>Qty</th><th>Unit</th><th>Cost</th><th>Total Cost</th><th>Reason</th><th>Remarks</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escHtml(r.date || '-')}</td>
          <td><strong>${escHtml(r.store_name || '-')}</strong></td>
          <td>${escHtml(r.entry_no || ('MC#' + r.entry_id))}</td>
          <td><strong>${escHtml(r.item_name || '-')}</strong>${r.item_sku ? `<div class="text-muted text-sm">${escHtml(r.item_sku)}</div>` : ''}</td>
          <td>${parseFloat(r.qty || 0).toFixed(3)}</td>
          <td>${escHtml(r.unit || '-')}</td>
          <td>KD ${parseFloat(r.cost || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.total_cost || 0).toFixed(3)}</strong></td>
          <td>${escHtml(r.reason || '-')}</td>
          <td class="text-sm text-muted">${escHtml(r.remarks || r.entry_remarks || '-')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadManualConsumptionCostReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadManualConsumptionCostReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function exportProductConsumptionCSV() {
  const rows = Array.isArray(window._lastProductConsumptionRows) ? window._lastProductConsumptionRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Product', 'SKU', 'Services Used', 'Service Uses', 'Total Consumed', 'Unit', 'Avg Unit Cost', 'Total Cost', 'Cost Share %'];
  const csvRows = rows.map(r => [
    r.product_name || '',
    r.product_sku || '',
    parseInt(r.services_used_count || 0),
    r.total_service_qty || 0,
    r.total_consumed_qty || 0,
    r.unit || '',
    parseFloat(r.avg_unit_cost || 0).toFixed(3),
    parseFloat(r.total_cost || 0).toFixed(3),
    parseFloat(r.cost_share_pct || 0).toFixed(2)
  ]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...csvRows].map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `product_consumption_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('CSV exported', 'success');
}

async function loadStockMovementReport(page) {
  const wrap = document.getElementById('stockMovementBody');
  if (!wrap) return;
  _stockMovementReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const from = document.getElementById('smFrom')?.value || '';
    const to = document.getElementById('smTo')?.value || '';
    const search = document.getElementById('smSearch')?.value || '';
    const storeId = document.getElementById('smStore')?.value || '';
    const movementType = document.getElementById('smType')?.value || '';
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    if (search.trim()) params.set('search', search.trim());
    if (storeId) params.set('store_id', storeId);
    if (movementType) params.set('movement_type', movementType);
    params.set('page', String(_stockMovementReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));

    const rep = await apiFetch(`/api/reports/stock-movement?${params.toString()}`);
    const rows = rep.rows || [];
    const summary = rep.summary || {};
    const filters = rep.filters || { stores: [] };
    window._lastStockMovementRows = rows;
    const total = Math.max(0, parseInt(rep.total, 10) || parseInt(summary.rows_count, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || Math.ceil(Math.max(1, total) / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _stockMovementReportPage), pages);
    _stockMovementReportPage = safePage;

    const storeSel = document.getElementById('smStore');
    if (storeSel) {
      const selected = storeSel.value || '';
      storeSel.innerHTML = `<option value="">All Stores</option>${(filters.stores || []).map(s => `<option value="${s.id}"${String(s.id)===selected?' selected':''}>${escHtml(s.name || 'Store')}</option>`).join('')}`;
    }

    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.transfer || IC.store, 'No stock movement', 'No stock movement records found for selected filters');
      return;
    }

    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Rows</div><div class="stat-value">${parseInt(summary.rows_count || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">In Qty</div><div class="stat-value">${parseFloat(summary.total_in_qty || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Out Qty</div><div class="stat-value">${parseFloat(summary.total_out_qty || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">In Value</div><div class="stat-value">KD ${parseFloat(summary.total_in_value || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Out Value</div><div class="stat-value">KD ${parseFloat(summary.total_out_value || 0).toFixed(3)}</div></div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Store</th><th>Product</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total Value</th><th>Reference</th><th>Note</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escHtml(r.date || '-')}</td>
          <td>${escHtml(r.movement_type || '-')}</td>
          <td>${r.direction === 'IN' ? '<span class="badge badge-completed">IN</span>' : '<span class="badge badge-cancelled">OUT</span>'}</td>
          <td>${escHtml(r.store_name || '-')}</td>
          <td><strong>${escHtml(r.product_name || '-')}</strong></td>
          <td>${escHtml(r.product_sku || '-')}</td>
          <td>${parseFloat(r.qty || 0).toFixed(3)}</td>
          <td>${escHtml(r.unit || '-')}</td>
          <td>KD ${parseFloat(r.unit_cost || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.total_cost || 0).toFixed(3)}</strong></td>
          <td>${escHtml(r.reference || '-')}</td>
          <td class="text-sm text-muted">${escHtml(r.note || '-')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadStockMovementReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadStockMovementReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadStockStatusReport(page) {
  const wrap = document.getElementById('stockStatusBody');
  if (!wrap) return;
  _stockStatusReportPage = page != null ? Math.max(1, parseInt(page, 10) || 1) : 1;
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('ssSearch')?.value || '';
    const storeId = document.getElementById('ssStore')?.value || '';
    const lowOnly = !!document.getElementById('ssLowOnly')?.checked;
    if (search.trim()) params.set('search', search.trim());
    if (storeId) params.set('store_id', storeId);
    if (lowOnly) params.set('low_only', '1');
    params.set('page', String(_stockStatusReportPage));
    params.set('limit', String(REPORT_PAGE_SIZE));

    const rep = await apiFetch(`/api/reports/stock-status?${params.toString()}`);
    const rows = rep.rows || [];
    const summary = rep.summary || {};
    const filters = rep.filters || { stores: [] };
    window._lastStockStatusRows = rows;
    const total = Math.max(0, parseInt(rep.total, 10) || parseInt(summary.rows_count, 10) || 0);
    const pages = Math.max(1, parseInt(rep.pages, 10) || Math.ceil(Math.max(1, total) / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, parseInt(rep.page, 10) || _stockStatusReportPage), pages);
    _stockStatusReportPage = safePage;

    const storeSel = document.getElementById('ssStore');
    if (storeSel) {
      const selected = storeSel.value || '';
      storeSel.innerHTML = `<option value="">All Stores</option>${(filters.stores || []).map(s => `<option value="${s.id}"${String(s.id)===selected?' selected':''}>${escHtml(s.name || 'Store')}</option>`).join('')}`;
    }

    if (!rows.length) {
      wrap.innerHTML = emptyState(IC.store || IC.empty, 'No stock status rows', 'No stock records found for selected filters');
      return;
    }

    wrap.innerHTML = `
      <div class="stats-grid" style="margin-bottom:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Rows</div><div class="stat-value">${parseInt(summary.rows_count || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Low Stock</div><div class="stat-value">${parseInt(summary.low_stock_count || 0)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Qty</div><div class="stat-value">${parseFloat(summary.total_qty || 0).toFixed(3)}</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-label">Total Value</div><div class="stat-value">KD ${parseFloat(summary.total_value || 0).toFixed(3)}</div></div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Store</th><th>Product</th><th>SKU</th><th>Category</th><th>Qty</th><th>Unit</th><th>Reorder</th><th>Avg Cost</th><th>Stock Value</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escHtml(r.store_name || '-')}</td>
          <td><strong>${escHtml(r.product_name || '-')}</strong></td>
          <td>${escHtml(r.product_sku || '-')}</td>
          <td>${escHtml(r.category || '-')}</td>
          <td>${parseFloat(r.qty || 0).toFixed(3)}</td>
          <td>${escHtml(r.unit || '-')}</td>
          <td>${parseFloat(r.reorder_level || 0).toFixed(3)}</td>
          <td>KD ${parseFloat(r.avg_cost || 0).toFixed(3)}</td>
          <td><strong>KD ${parseFloat(r.stock_value || 0).toFixed(3)}</strong></td>
          <td>${r.low_stock ? '<span class="badge badge-cancelled">Low</span>' : '<span class="badge badge-completed">OK</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="text-muted text-sm">Showing ${total ? ((safePage - 1) * REPORT_PAGE_SIZE) + 1 : 0}-${Math.min(safePage * REPORT_PAGE_SIZE, total)} of ${total}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="loadStockStatusReport(${safePage - 1})" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="text-muted text-sm" style="padding:4px 8px">${safePage} / ${pages}</span>
          <button class="btn btn-sm" onclick="loadStockStatusReport(${safePage + 1})" ${safePage >= pages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function exportStockMovementCSV() {
  const rows = Array.isArray(window._lastStockMovementRows) ? window._lastStockMovementRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Date', 'Type', 'Direction', 'Store', 'Product', 'SKU', 'Qty', 'Unit', 'Unit Cost', 'Total Value', 'Reference', 'Note'];
  const csvRows = rows.map(r => [
    r.date || '',
    r.movement_type || '',
    r.direction || '',
    r.store_name || '',
    r.product_name || '',
    r.product_sku || '',
    parseFloat(r.qty || 0).toFixed(3),
    r.unit || '',
    parseFloat(r.unit_cost || 0).toFixed(3),
    parseFloat(r.total_cost || 0).toFixed(3),
    r.reference || '',
    r.note || ''
  ]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...csvRows].map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_movement_${new Date().toLocaleDateString('sv')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('CSV exported', 'success');
}

function exportStockStatusCSV() {
  const rows = Array.isArray(window._lastStockStatusRows) ? window._lastStockStatusRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Store', 'Product', 'SKU', 'Category', 'Qty', 'Unit', 'Reorder', 'Avg Cost', 'Stock Value', 'Low Stock'];
  const csvRows = rows.map(r => [
    r.store_name || '',
    r.product_name || '',
    r.product_sku || '',
    r.category || '',
    parseFloat(r.qty || 0).toFixed(3),
    r.unit || '',
    parseFloat(r.reorder_level || 0).toFixed(3),
    parseFloat(r.avg_cost || 0).toFixed(3),
    parseFloat(r.stock_value || 0).toFixed(3),
    r.low_stock ? 'Yes' : 'No'
  ]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...csvRows].map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_status_${new Date().toLocaleDateString('sv')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('CSV exported', 'success');
}

function exportDailyReportCSV() {
  const rows = Array.isArray(window._lastDailyReportRows) ? window._lastDailyReportRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Metric', 'Count', 'Value'];
  const csvRows = rows.map(r => [r.label || '', r.count || 0, r.value || '']);
  downloadCSV(`daily_report_${new Date().toLocaleDateString('sv')}.csv`, header, csvRows);
}

function exportRevenueReportCSV() {
  const rows = Array.isArray(window._lastRevenueRows) ? window._lastRevenueRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Date', 'Active Bills', 'Cancelled Bills', 'Gross Revenue', 'Total Discount', 'Net Revenue', 'Total Refund', 'Final Revenue'];
  const csvRows = rows.map(r => [
    r.day || '',
    parseInt(r.bills || 0, 10),
    parseInt(r.cancelled_bills || 0, 10),
    parseFloat(r.gross_revenue || 0).toFixed(3),
    parseFloat(r.total_discount || 0).toFixed(3),
    parseFloat(r.net_revenue || 0).toFixed(3),
    parseFloat(r.total_refund || 0).toFixed(3),
    parseFloat((r.final_revenue ?? r.revenue ?? 0) || 0).toFixed(3)
  ]);
  downloadCSV(`revenue_report_${new Date().toLocaleDateString('sv')}.csv`, header, csvRows);
}

function exportUserCollectionCSV() {
  const rows = Array.isArray(window._lastUserCollectionRows) ? window._lastUserCollectionRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Date', 'User', 'Payment Method', 'Gross', 'Refund', 'Net Amount', 'Bill Count'];
  const csvRows = rows.map(r => [
    r.date || '',
    r.user_name || '',
    r.payment_method || '',
    parseFloat(r.gross_amount || 0).toFixed(3),
    parseFloat(r.refunded_amount || 0).toFixed(3),
    parseFloat(r.amount || 0).toFixed(3),
    parseInt(r.bills_count || 0, 10)
  ]);
  downloadCSV(`user_collection_${new Date().toLocaleDateString('sv')}.csv`, header, csvRows);
}

function exportBilledServicesCSV() {
  const rows = Array.isArray(window._lastBilledServicesRows) ? window._lastBilledServicesRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Date', 'Bill', 'Patient', 'Service', 'Doctor', 'Department', 'Qty', 'Amount', 'Payment'];
  const csvRows = rows.map(r => [
    r.date || '',
    r.bill_code || '',
    r.patient_name || '',
    r.service_name || '',
    r.doctor_name || '',
    r.department || '',
    r.qty || 1,
    parseFloat(r.amount || 0).toFixed(2),
    r.payment_status || ''
  ]);
  downloadCSV(`billed_services_${new Date().toLocaleDateString('sv')}.csv`, header, csvRows);
}

function exportServiceConsumptionCSV() {
  const rows = Array.isArray(window._lastServiceConsumptionRows) ? window._lastServiceConsumptionRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Service', 'Product', 'SKU', 'Total Consumed', 'Unit', 'Avg Cost', 'Total Cost'];
  const csvRows = rows.map(r => [
    r.service_name || '',
    r.product_name || '',
    r.product_sku || '',
    parseFloat(r.total_consumed_qty || 0).toFixed(3),
    r.unit || '',
    parseFloat(r.avg_unit_cost || 0).toFixed(3),
    parseFloat(r.total_cost || 0).toFixed(3)
  ]);
  downloadCSV(`service_consumption_${new Date().toLocaleDateString('sv')}.csv`, header, csvRows);
}

function exportActivityLogsCSV() {
  const rows = Array.isArray(window._lastActivityLogRows) ? window._lastActivityLogRows : [];
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Date/Time', 'User', 'Role', 'Module', 'Action', 'Entity', 'Patient', 'Notes'];
  const csvRows = rows.map(r => [
    r.created_at || '',
    r.actor_name || '',
    r.actor_role || '',
    r.module || '',
    r.action || '',
    r.entity_type ? `${r.entity_type} #${r.entity_id}` : '',
    r.patient_name || '',
    r.notes || ''
  ]);
  downloadCSV(`activity_logs_${new Date().toLocaleDateString('sv')}.csv`, header, csvRows);
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// USER MANAGEMENT
let userStatusFilter = '';
let userRoleFilter = '';
let userNameFilter = '';

async function users() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `<div class="action-bar"><div style="flex:1"></div></div><div id="usersWrap">${skeletonTable(4)}</div>`;
  try {
    const [list, allRoles] = await Promise.all([apiFetch('/api/users'), apiFetch('/api/roles').catch(()=>[])]);
    window._usersCache = list || [];
    const roleOpts = [
      '<option value="">All Roles</option>',
      ...(allRoles||[]).map(r => `<option value="${escHtml(r.name)}" ${userRoleFilter===r.name?'selected':''}>${escHtml(r.label||r.name)}</option>`)
    ].join('');
    ca.innerHTML = `
      <div class="action-bar">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="search" placeholder="Search by name-" style="width:170px" value="${escHtml(userNameFilter)}" oninput="userNameFilter=this.value;renderUsersTable(window._usersCache||[])" />
          <select style="width:auto;min-width:130px" onchange="userRoleFilter=this.value;renderUsersTable(window._usersCache||[])">
            ${roleOpts}
          </select>
          <select style="width:auto;min-width:130px" onchange="userStatusFilter=this.value;renderUsersTable(window._usersCache||[])">
            <option value="" ${userStatusFilter===''?'selected':''}>All Status</option>
            <option value="active" ${userStatusFilter==='active'?'selected':''}>Active</option>
            <option value="inactive" ${userStatusFilter==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
        <div style="flex:1"></div>
        ${can('users.create') ? `<button class="btn btn-primary" onclick="openAddUserModal()">${IC.plus} Add User</button>` : ''}
        ${currentUser && currentUser.role === 'admin' ? `<button id="ownerSystemUpdateBtn" class="btn btn-warning" onclick="triggerSystemUpdate()" title="Download and apply latest update from GitHub">${IC.clock || '&#x21bb;'} System Update</button>` : ''}
        ${viewToggleHTML('users')}
      </div>
      ${currentUser && currentUser.role === 'admin' ? `<div id="ownerSystemUpdateState" class="text-muted text-sm" style="padding:4px 0 0 4px"></div>` : ''}
      <div id="usersWrap"></div>`;
    renderUsersTable(window._usersCache);
  } catch(e) {
    document.getElementById('usersWrap').innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function renderUsersTable(list) {
  const q = userNameFilter.toLowerCase().trim();
  const filtered = list.filter(u => {
    if (userStatusFilter === 'active' && u.active === false) return false;
    if (userStatusFilter === 'inactive' && u.active !== false) return false;
    if (userRoleFilter && u.role !== userRoleFilter) return false;
    if (q && !u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
    return true;
  });
  const wrap = document.getElementById('usersWrap');
  if (!wrap) return;
  wrap.innerHTML = filtered.length === 0
    ? `<div class="empty-state">No users match the current filters.</div>`
    : `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Department</th><th>Store Access</th><th>Slot Duration</th><th>Actions</th></tr></thead>
      <tbody>${filtered.map((u,i) => `<tr>
        <td>${i+1}</td>
        <td><strong>${escHtml(u.name)}</strong></td>
        <td>${escHtml(u.username)}</td>
        <td>${roleBadge(u.role)}</td>
        <td>${u.active === false ? '<span class="badge badge-cancelled">Inactive</span>' : '<span class="badge badge-completed">Active</span>'}</td>
        <td>${escHtml((u.department_names || []).length ? u.department_names.join(', ') : (u.department_name || '')) || '-'}</td>
        <td>${u.role === 'admin' ? 'All Stores' : escHtml((u.store_names || []).length ? u.store_names.join(', ') : 'All Stores')}</td>
        <td>${u.role==='doctor' ? `<span class="badge badge-scheduled">${u.slot_duration||30} min</span>` : '-'}</td>
        <td class="td-actions">
          <button class="btn btn-sm" onclick="openEditUserModal(${u.id})">${IC.edit} Edit</button>
          ${u.id !== currentUser.id
            ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.name)}')">${IC.trash} Delete</button>`
            : `<span class="text-muted text-sm">(you)</span>`}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  applyViewPref('users', '#usersWrap');
}


function userStoreChecklistHtml(stores, selectedIds = [], inputName = 'store_ids') {
  const normalizedSelected = new Set((selectedIds || []).map((id) => String(id)));
  const activeStores = (stores || []).filter((store) => store.active !== false);
  if (!activeStores.length) {
    return '<div class="text-sm text-muted">No stores available.</div>';
  }
  return activeStores.map((store) => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)">
      <input type="checkbox" name="${inputName}" value="${store.id}" ${normalizedSelected.has(String(store.id)) ? 'checked' : ''}/>
      <span>${escHtml(store.name || `Store #${store.id}`)}</span>
    </label>`).join('');
}

function collectCheckedValues(formEl, inputName) {
  return Array.from(formEl.querySelectorAll(`input[name="${inputName}"]:checked`)).map((input) => parseInt(input.value, 10)).filter((value) => value > 0);
}

async function openAddUserModal() {
  let departments = [];
  let allRoles = [];
  let stores = [];
  try {
    [departments, allRoles, stores] = await Promise.all([
      apiFetch('/api/doctor-departments'),
      apiFetch('/api/roles'),
      apiFetch('/api/store/sub-stores')
    ]);
  } catch(e) {
    toast(e.message, 'error');
    return;
  }
  const deptChecklistHtml = (departments || []).filter(d => d.active !== false)
    .map(d => `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)"><input type="checkbox" name="department_ids" value="${d.id}"/><span>${escHtml(d.name)}</span></label>`).join('');
  const roleOptions = (allRoles || [])
    .map(r => `<option value="${r.name}">${escHtml(r.label || r.name)}</option>`).join('');
  showModal('Add User', `
    <form id="addUserForm">
      <div class="form-group"><label>Full Name *</label><input name="name" required/></div>
      <div class="form-row">
        <div class="form-group"><label>Username *</label><input name="username" required/></div>
        <div class="form-group"><label>Password *</label><input type="password" name="password" required/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Role *</label>
          <select name="role" required onchange="const isDoc=this.value==='doctor';const limitStores=this.value!==''&&this.value!=='admin';document.getElementById('slotDurGroup').style.display=isDoc?'':'none';document.getElementById('storeAccessGroup').style.display=limitStores?'':'none'">
            <option value="">Select Role</option>
            ${roleOptions}
          </select>
        </div>
        <div class="form-group" id="slotDurGroup" style="display:none">
          <label>Slot Duration *</label>
          <select name="slot_duration">
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30" selected>30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select name="active">
            <option value="true" selected>Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Department Access</label>
        <div style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--bg-card)">
          ${deptChecklistHtml || '<div class="text-sm text-muted">No departments available.</div>'}
        </div>
        <div class="text-sm text-muted" style="margin-top:6px">Select one or more departments to restrict access. Leave all unchecked for no restriction.</div>
      </div>
      <div class="form-group" id="storeAccessGroup" style="display:none">
        <label>Store Access</label>
        <div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--bg-card)">
          ${userStoreChecklistHtml(stores)}
        </div>
        <div class="text-sm text-muted" style="margin-top:6px">Leave all unchecked to allow all stores. Select one or more stores to restrict access.</div>
      </div>
    </form>`,
    async () => {
      const form = document.getElementById('addUserForm');
      const body = Object.fromEntries(new FormData(form));
      body.store_ids = collectCheckedValues(form, 'store_ids');
      body.department_ids = collectCheckedValues(form, 'department_ids');
      if (!body.name || !body.username || !body.password || !body.role) { toast('All fields required', 'error'); return false; }
      try {
        await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(body) });
        toast('User added', 'success');
        closeModal(); users();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}
async function openEditUserModal(id) {
  try {
    const [list, departments, stores] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/doctor-departments'),
      apiFetch('/api/store/sub-stores')
    ]);
    const u = list.find(x => x.id === id);
    if (!u) { toast('User not found', 'error'); return; }
    const depOptions = (departments || []).filter(d => d.active !== false || d.id === u.department_id)
      .map(d => `<option value="${d.id}" ${parseInt(u.department_id)===d.id?'selected':''}>${escHtml(d.name)}</option>`).join('');
    showModal(`Edit - ${escHtml(u.name)}`, `
      <form id="editUserForm">
        <div class="form-group"><label>Full Name</label><input name="name" value="${escHtml(u.name)}"/></div>
        <div class="form-group"><label>Role</label><input value="${escHtml(u.role)}" disabled/></div>
        ${u.role !== 'admin' ? `
        <div class="form-group">
          <label>Department Access</label>
          <div style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--bg-card)">
            ${(departments || []).filter(d => d.active !== false || (u.department_ids||[u.department_id]).includes(d.id)).map(d => `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)"><input type="checkbox" name="department_ids" value="${d.id}" ${(u.department_ids||[u.department_id]).map(Number).includes(d.id)?'checked':''}/><span>${escHtml(d.name)}</span></label>`).join('')|| '<div class="text-sm text-muted">No departments available.</div>'}
          </div>
          <div class="text-sm text-muted" style="margin-top:6px">Leave all unchecked for no restriction. Select one or more to restrict access.</div>
        </div>` : ''}
        <div class="form-group">
          <label>Status</label>
          <select name="active" ${u.id === currentUser.id ? 'disabled' : ''}>
            <option value="true" ${u.active===false?'':'selected'}>Active</option>
            <option value="false" ${u.active===false?'selected':''}>Inactive</option>
          </select>
          ${u.id === currentUser.id ? '<div class="text-sm text-muted" style="margin-top:6px">You cannot deactivate your own account.</div>' : ''}
        </div>
        ${u.role !== 'admin' ? `
        <div class="form-group">
          <label>Store Access</label>
          <div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--bg-card)">
            ${userStoreChecklistHtml(stores, u.store_ids || [])}
          </div>
          <div class="text-sm text-muted" style="margin-top:6px">Leave all unchecked to allow all stores. Select one or more stores to restrict access.</div>
        </div>` : ''}
        ${u.role==='doctor' ? `
        <div class="form-group">
          <label>Slot Duration</label>
          <select name="slot_duration">
            <option value="15" ${u.slot_duration===15?'selected':''}>15 minutes</option>
            <option value="20" ${u.slot_duration===20?'selected':''}>20 minutes</option>
            <option value="30" ${(u.slot_duration===30||!u.slot_duration)?'selected':''}>30 minutes</option>
            <option value="45" ${u.slot_duration===45?'selected':''}>45 minutes</option>
            <option value="60" ${u.slot_duration===60?'selected':''}>1 hour</option>
          </select>
        </div>` : ''}
      </form>`,
      async () => {
        const form = document.getElementById('editUserForm');
        const body = Object.fromEntries(new FormData(form));
        if (u.role !== 'admin') body.store_ids = collectCheckedValues(form, 'store_ids');
        if (u.role !== 'admin') body.department_ids = collectCheckedValues(form, 'department_ids');
        try {
          await apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('User updated', 'success');
          closeModal(); users();
        } catch(e) { toast(e.message, 'error'); return false; }
      });
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!await confirmDialog(`Delete user "${name}"?`)) return;
  try {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    toast('User deleted', 'success');
    users();
  } catch(e) { toast(e.message, 'error'); }
}

// --------------------------------------------------------
//  MODAL SYSTEM
// --------------------------------------------------------
function showModal(title, bodyHtml, onSave = null, extraClass = '') {
  closeModal();
  const isActionArray = Array.isArray(onSave);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = `
    <div class="modal ${extraClass}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${onSave ? `<div class="modal-footer">
        <button class="btn" onclick="closeModal()">Cancel</button>
        ${isActionArray
          ? onSave.map((a, i) => `<button class="btn ${a.class || ''}" id="modalActionBtn-${i}" onclick="handleModalAction(${i})">${a.label || 'Action'}</button>`).join('')
          : `<button class="btn btn-primary" id="modalSaveBtn" onclick="handleModalSave()">${IC.check} Save</button>`}
      </div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  // Intentionally ignore overlay clicks so users don't accidentally lose form state.
  overlay.addEventListener('click', e => {
    if (e.target === overlay) e.stopPropagation();
  });
  if (isActionArray) overlay._actions = onSave;
  else if (onSave) overlay._onSave = onSave;
  // Focus first input
  setTimeout(() => {
    const first = overlay.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    if (first) first.focus();
  }, 100);
}

async function handleModalAction(index) {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay || !overlay._actions || !overlay._actions[index]) return;
  const action = overlay._actions[index];
  const btn = document.getElementById(`modalActionBtn-${index}`);
  if (btn) {
    btn.disabled = true;
    btn.dataset.prevHtml = btn.innerHTML;
    btn.innerHTML = `${IC.clock} Working...`;
  }
  try {
    const result = await (action.onclick ? action.onclick(overlay) : null);
    if (result === false && btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.prevHtml || action.label || 'Action';
    }
  } catch (e) {
    toast(e.message || 'Action failed', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.prevHtml || action.label || 'Action';
    }
  }
}

async function handleModalSave() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay || !overlay._onSave) return;
  const btn = document.getElementById('modalSaveBtn');
  btn.disabled = true; btn.innerHTML = `${IC.clock} Saving...`;
  const result = await overlay._onSave();
  if (result === false) { btn.disabled = false; btn.innerHTML = `${IC.check} Save`; }
}

function closeModal() {
  const el = document.getElementById('modalOverlay');
  if (el) el.remove();
}

// Escape key to close modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// -----------------------------------------------
//  SERVICES
// -----------------------------------------------
let SERVICE_CATEGORIES = ['Consultation','Diagnostic','Procedure','Therapy','Other'];
const SERVICES_BATCH_SIZE = 100;
let _filteredServices = [];
let _servicesRenderedCount = 0;
let _servicesInfiniteObserver = null;

function renderServiceRow(s, index, isAdmin) {
  return `<tr>
    <td>${index + 1}</td>
    <td><strong>${escHtml(s.name)}</strong></td>
    <td>${serviceCategoryBadgeHtml(s.category)}</td>
    <td>${escHtml(s.description||'-')}</td>
    <td><strong>KD ${s.price.toFixed(3)}</strong></td>
    <td>${s.duration_min ? s.duration_min+' min' : '-'}</td>
    <td>${s.active ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
    ${isAdmin?`<td class="action-btns">
      <button class="btn btn-sm" onclick="openServiceProductModal(${s.id})" title="Assign Products">${IC.product || IC.store}</button>
      <button class="btn btn-sm btn-ghost" onclick="openEditServiceModal(${s.id})" title="Edit">${IC.edit}</button>
      ${can('services.delete') ? `<button class="btn btn-sm btn-danger-ghost" onclick="deleteService(${s.id},'${escHtml(s.name)}')" title="Delete">${IC.trash}</button>` : ''}
    </td>`:''}
  </tr>`;
}

function disconnectServicesInfiniteScroll() {
  if (_servicesInfiniteObserver) {
    _servicesInfiniteObserver.disconnect();
    _servicesInfiniteObserver = null;
  }
}

function updateServicesLoadState() {
  const info = document.getElementById('svcLoadState');
  if (!info) return;
  const total = Array.isArray(_filteredServices) ? _filteredServices.length : 0;
  const rendered = Math.min(_servicesRenderedCount, total);
  info.textContent = total > SERVICES_BATCH_SIZE
    ? `Showing ${rendered} of ${total} services`
    : `${total} service${total !== 1 ? 's' : ''}`;
}

function appendMoreServices(isAdmin) {
  const tbody = document.getElementById('svcTableBody');
  if (!tbody) return;
  const start = _servicesRenderedCount;
  const nextRows = (_filteredServices || []).slice(start, start + SERVICES_BATCH_SIZE);
  if (!nextRows.length) {
    disconnectServicesInfiniteScroll();
    return;
  }
  tbody.insertAdjacentHTML('beforeend', nextRows.map((service, offset) => renderServiceRow(service, start + offset, isAdmin)).join(''));
  _servicesRenderedCount += nextRows.length;
  updateServicesLoadState();
  if (_servicesRenderedCount >= (_filteredServices || []).length) {
    disconnectServicesInfiniteScroll();
  }
}

function attachServicesInfiniteScroll(isAdmin) {
  disconnectServicesInfiniteScroll();
  const sentinel = document.getElementById('svcLoadMoreSentinel');
  if (!sentinel) return;
  if (_servicesRenderedCount >= (_filteredServices || []).length) return;
  _servicesInfiniteObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) appendMoreServices(isAdmin);
    });
  }, { root: null, rootMargin: '0px 0px 240px 0px', threshold: 0.01 });
  _servicesInfiniteObserver.observe(sentinel);
}

async function loadServiceCategories() {
  try {
    const cats = await apiFetch('/api/service-categories');
    if (cats && cats.length) SERVICE_CATEGORIES = cats.map(c => c.name);
  } catch { /* keep defaults */ }
}

async function services() {
  const ca = document.getElementById('contentArea');
  const isAdmin = currentUser && currentUser.role === 'admin';
  ca.innerHTML = `
    <div class="action-bar svc-action-bar">
      <div class="search-box">
        <input id="svcSearch" type="text" placeholder="Search services..." oninput="filterServices()" />
      </div>
      <select id="svcCatFilter" class="form-select svc-cat-filter" onchange="filterServices()">
        <option value="">All Categories</option>
        ${SERVICE_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
      </select>
      ${can('services.export') ? `<button class="btn" onclick="exportServicesList()">Export Services</button>` : ''}
      ${can('services.import') ? `<button class="btn" onclick="downloadServiceImportFormat()">Import Format</button>` : ''}
      ${can('services.import') ? `<button class="btn" onclick="triggerServiceImport()">Import Services</button>` : ''}
      ${can('services.create') ? `<button class="btn btn-primary" onclick="openAddServiceModal()">${IC.plus} Add Service</button>` : ''}
      ${viewToggleHTML('services')}
    </div>
    <input type="file" id="serviceImportFile" accept=".csv,text/csv" style="display:none" onchange="handleServiceImportFile(event)"/>
    <div id="svcWrap">${skeletonTable(5)}</div>`;
  try {
    const list = await apiFetch('/api/services');
    window._allServices = list;
    _filteredServices = list.slice();
    renderServicesTable(list, isAdmin);
  } catch(e) { toast(e.message, 'error'); }
}

function filterServices() {
  const q = (document.getElementById('svcSearch')?.value||'').toLowerCase();
  const cat = document.getElementById('svcCatFilter')?.value||'';
  const isAdmin = currentUser && currentUser.role === 'admin';
  const filtered = (window._allServices||[]).filter(s =>
    (!q || s.name.toLowerCase().includes(q) || (s.description||'').toLowerCase().includes(q)) &&
    (!cat || s.category === cat)
  );
  _filteredServices = filtered;
  renderServicesTable(filtered, isAdmin);
}

function renderServicesTable(list, isAdmin) {
  const wrap = document.getElementById('svcWrap');
  if (!wrap) return;
  disconnectServicesInfiniteScroll();
  if (!list.length) { wrap.innerHTML = `<div class="empty-state">${IC.empty}<p>No services found</p></div>`; return; }
  _filteredServices = Array.isArray(list) ? list.slice() : [];
  _servicesRenderedCount = 0;
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Name</th><th>Category</th><th>Description</th><th>Price (KD)</th><th>Duration</th><th>Status</th>${isAdmin?'<th>Actions</th>':''}</tr></thead>
    <tbody id="svcTableBody"></tbody>
  </table></div>
  <div class="svc-load-state" id="svcLoadState"></div>
  <div class="svc-load-more-sentinel" id="svcLoadMoreSentinel" aria-hidden="true"></div>`;
  appendMoreServices(isAdmin);
  attachServicesInfiniteScroll(isAdmin);
  applyViewPref('services', '#svcWrap');
}

function serviceCategoryBadgeStyle(cat) {
  const presets = {
    consultation: { bg: 'rgba(14, 165, 233, .14)', color: '#0369a1' },
    diagnostic: { bg: 'rgba(79, 70, 229, .12)', color: '#4338ca' },
    procedure: { bg: 'rgba(249, 115, 22, .14)', color: '#c2410c' },
    therapy: { bg: 'rgba(34, 197, 94, .14)', color: '#15803d' },
    other: { bg: 'rgba(100, 116, 139, .14)', color: '#475569' }
  };
  const raw = String(cat || 'Other').trim();
  const key = raw.toLowerCase();
  if (presets[key]) return presets[key];

  const palette = [
    { bg: 'rgba(190, 24, 93, .14)', color: '#be185d' },
    { bg: 'rgba(124, 58, 237, .14)', color: '#7c3aed' },
    { bg: 'rgba(8, 145, 178, .14)', color: '#0e7490' },
    { bg: 'rgba(22, 163, 74, .14)', color: '#15803d' },
    { bg: 'rgba(202, 138, 4, .18)', color: '#a16207' },
    { bg: 'rgba(234, 88, 12, .14)', color: '#c2410c' },
    { bg: 'rgba(37, 99, 235, .14)', color: '#1d4ed8' },
    { bg: 'rgba(217, 70, 239, .14)', color: '#a21caf' },
    { bg: 'rgba(15, 118, 110, .14)', color: '#0f766e' },
    { bg: 'rgba(220, 38, 38, .14)', color: '#b91c1c' }
  ];

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  const picked = palette[Math.abs(hash) % palette.length];
  return picked;
}

function serviceCategoryBadgeHtml(cat) {
  const label = String(cat || 'Other').trim() || 'Other';
  const style = serviceCategoryBadgeStyle(label);
  return `<span class="badge" style="background:${style.bg};color:${style.color}">${escHtml(label)}</span>`;
}

function openAddServiceModal() {
  showModal('Add New Service', `
    <form id="svcForm">
      <div class="form-row">
        <div class="form-group"><label>Service Name *</label><input name="name" required placeholder="e.g. General Consultation"/></div>
        <div class="form-group"><label>Category</label>
          <select name="category">${SERVICE_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-group"><label>Description</label><input name="description" placeholder="Brief description"/></div>
      <div class="form-row">
        <div class="form-group"><label>Price (KD) *</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="price" type="number" min="0" step="0.001" required placeholder="0.000"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Duration (minutes)</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="duration_min" type="number" min="0" placeholder="e.g. 20"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
      </div>
    </form>`,
    async () => {
    const form = document.getElementById('svcForm');
    const data = Object.fromEntries(new FormData(form));
    if (!data.name) { toast('Service name is required','error'); return false; }
    if (!data.price) { toast('Price is required','error'); return false; }
    try {
      await apiFetch('/api/services', { method:'POST', body: JSON.stringify(data) });
      toast('Service added','success'); closeModal(); services();
    } catch(e) { toast(e.message,'error'); return false; }
  });
}

async function openEditServiceModal(id) {
  try {
    const list = await apiFetch('/api/services');
    const s = list.find(x => x.id === id);
    if (!s) { toast('Not found','error'); return; }
    showModal(`Edit - ${escHtml(s.name)}`, `
      <form id="svcForm">
        <div class="form-row">
          <div class="form-group"><label>Service Name *</label><input name="name" value="${escHtml(s.name)}" required/></div>
          <div class="form-group"><label>Category</label>
            <select name="category">${SERVICE_CATEGORIES.map(c=>`<option${c===s.category?' selected':''}>${c}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-group"><label>Description</label><input name="description" value="${escHtml(s.description||'')}"/></div>
        <div class="form-row">
          <div class="form-group"><label>Price (KD) *</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="price" type="number" min="0" step="0.001" value="${s.price}" required/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
          <div class="form-group"><label>Duration (minutes)</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="duration_min" type="number" min="0" value="${s.duration_min||''}"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        </div>
        <div class="form-group"><label>Status</label>
          <select name="active">
            <option value="true"${s.active?' selected':''}>Active</option>
            <option value="false"${!s.active?' selected':''}>Inactive</option>
          </select>
        </div>
      </form>`,
      async () => {
      const form = document.getElementById('svcForm');
      const data = Object.fromEntries(new FormData(form));
      data.active = data.active === 'true';
      try {
        await apiFetch(`/api/services/${id}`, { method:'PUT', body: JSON.stringify(data) });
        toast('Service updated','success'); closeModal(); services();
      } catch(e) { toast(e.message,'error'); return false; }
    });
  } catch(e) { toast(e.message,'error'); }
}

async function deleteService(id, name) {
  if (!await confirmDialog(`Delete service "${name}"? This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/services/${id}`, { method:'DELETE' });
    toast('Service deleted','success'); services();
  } catch(e) { toast(e.message,'error'); }
}

function exportServicesList() {
  if (!can('services.export')) { toast('No permission to export services', 'error'); return; }
  const q = (document.getElementById('svcSearch')?.value || '').trim();
  const category = (document.getElementById('svcCatFilter')?.value || '').trim();

  const fallbackExport = () => {
    const rows = Array.isArray(window._allServices) ? window._allServices : [];
    let list = rows.slice();
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter(s => String(s.name || '').toLowerCase().includes(qq) || String(s.description || '').toLowerCase().includes(qq));
    }
    if (category) list = list.filter(s => String(s.category || '') === category);
    if (!list.length) { toast('No services to export', 'error'); return; }

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['name', 'category', 'description', 'price', 'duration_min', 'active'];
    const lines = [headers.join(',')];
    list.forEach(s => {
      lines.push([
        s.name || '',
        s.category || 'Other',
        s.description || '',
        parseFloat(s.price || 0).toFixed(3),
        parseInt(s.duration_min || 0, 10) || 0,
        s.active === false ? '0' : '1'
      ].map(esc).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `services_${new Date().toLocaleDateString('sv')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Services exported', 'success');
  };

  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (category) params.set('category', category);

  fetch('/api/services/export' + (params.toString() ? `?${params.toString()}` : ''), { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error('fallback');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `services_${new Date().toLocaleDateString('sv')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Services exported', 'success');
    })
    .catch(() => fallbackExport());
}

function downloadServiceImportFormat() {
  if (!can('services.import')) { toast('No permission to download import format', 'error'); return; }

  const fallbackTemplate = () => {
    const headers = ['name', 'category', 'description', 'price', 'duration_min', 'active'];
    const sample = ['General Consultation', 'Consultation', 'Standard doctor consultation', '300.000', '20', '1'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, sample].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'service_import_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  fetch('/api/services/import-template', { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error('fallback');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'service_import_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => fallbackTemplate());
}

function triggerServiceImport() {
  if (!can('services.import')) { toast('No permission to import services', 'error'); return; }
  const input = document.getElementById('serviceImportFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function parseServicesCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(h => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i], delimiter);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows, delimiter };
}

const SERVICE_IMPORT_FIELDS = [
  { key: 'name', label: 'Service Name', required: true },
  { key: 'category', label: 'Category' },
  { key: 'description', label: 'Description' },
  { key: 'price', label: 'Price (KD)', required: true },
  { key: 'duration_min', label: 'Duration (minutes)' },
  { key: 'active', label: 'Active (1/0)' }
];

const SERVICE_IMPORT_ALIASES = {
  name: ['name', 'service', 'service name', 'service_name'],
  category: ['category', 'type', 'service category', 'service_category'],
  description: ['description', 'desc', 'details', 'notes'],
  price: ['price', 'amount', 'cost', 'rate'],
  duration_min: ['duration', 'duration min', 'duration_min', 'minutes', 'time'],
  active: ['active', 'status', 'is active', 'enabled']
};

function suggestServiceImportMapping(headers) {
  const normalizedHeaders = headers.map(h => ({ raw: h, n: normalizeImportHeader(h) }));
  const mapping = {};
  SERVICE_IMPORT_FIELDS.forEach(f => {
    const aliases = (SERVICE_IMPORT_ALIASES[f.key] || [f.key]).map(normalizeImportHeader);
    const exact = normalizedHeaders.find(h => aliases.includes(h.n));
    if (exact) {
      mapping[f.key] = exact.raw;
      return;
    }
    const fallback = normalizedHeaders.find(h => h.n.includes(normalizeImportHeader(f.key)) || normalizeImportHeader(f.key).includes(h.n));
    mapping[f.key] = fallback ? fallback.raw : '';
  });
  return mapping;
}

function buildMappedServiceRows(sourceRows, mapping) {
  return sourceRows.map(src => {
    const row = {};
    SERVICE_IMPORT_FIELDS.forEach(f => {
      const col = mapping[f.key];
      row[f.key] = col ? (src[col] || '') : '';
    });
    return row;
  }).filter(r => Object.values(r).some(v => String(v || '').trim()));
}

async function runServiceImportRows(rows) {
  let res;
  try {
    const chunkSize = 100;
    let created = 0;
    const skipped = [];
    const errors = [];
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const part = await apiFetch('/api/services/import', {
        method: 'POST',
        body: JSON.stringify({ rows: chunk })
      });
      created += parseInt(part.created || 0, 10) || 0;
      skipped.push(...(part.skipped || []));
      errors.push(...(part.errors || []));
      if (rows.length > chunkSize) toast(`Importing ${Math.min(start + chunk.length, rows.length)} / ${rows.length}`, 'success');
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    res = { created, skipped, errors };
  } catch (e) {
    if (!String(e.message || '').toLowerCase().includes('not found')) throw e;
    let created = 0;
    const skipped = [];
    const errors = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const line = i + 2;
      const name = String(row.name || '').trim();
      const price = parseFloat(row.price);
      const payload = {
        name,
        category: String(row.category || 'Other').trim() || 'Other',
        description: String(row.description || '').trim(),
        price: Number.isFinite(price) ? price : row.price,
        duration_min: parseInt(row.duration_min || 0, 10) || 0,
        active: ['1','true','yes','y'].includes(String(row.active || '1').toLowerCase())
      };
      if (!payload.name) {
        errors.push(`Line ${line}: service name is required`);
        continue;
      }
      if (!(parseFloat(payload.price) > 0)) {
        errors.push(`Line ${line}: price must be greater than 0`);
        continue;
      }
      try {
        await apiFetch('/api/services', { method: 'POST', body: JSON.stringify(payload) });
        created += 1;
      } catch (rowErr) {
        const m = String(rowErr.message || 'failed');
        if (m.toLowerCase().includes('already')) skipped.push(`Line ${line}: ${m}`);
        else errors.push(`Line ${line}: ${m}`);
      }
    }
    res = { created, skipped, errors };
  }

  const msg = `Import done. Created: ${res.created || 0}, Skipped: ${(res.skipped || []).length}, Errors: ${(res.errors || []).length}`;
  toast(msg, (res.errors || []).length ? 'error' : 'success');
  if ((res.errors || []).length) {
    showModal('Import Result', `
      <div class="text-sm" style="margin-bottom:8px">${escHtml(msg)}</div>
      ${(res.errors || []).length ? `<div class="alert alert-error" style="max-height:180px;overflow:auto"><strong>Errors</strong><br>${(res.errors || []).map(e => escHtml(e)).join('<br>')}</div>` : ''}
      ${(res.skipped || []).length ? `<div class="alert" style="margin-top:8px;max-height:180px;overflow:auto"><strong>Skipped</strong><br>${(res.skipped || []).map(e => escHtml(e)).join('<br>')}</div>` : ''}
    `, null, 'modal-md');
  }
  services();
}

function openServiceImportMappingModal(headers, sourceRows, delimiter = ',') {
  const initial = suggestServiceImportMapping(headers);
  const options = [`<option value="">(Not mapped)</option>`]
    .concat(headers.map(h => `<option value="${escHtml(h)}">${escHtml(h)}</option>`))
    .join('');
  const delimiterLabel = delimiter === '\t' ? 'tab' : delimiter === ';' ? 'semicolon' : 'comma';
  const body = `
    <div class="text-sm" style="margin-bottom:10px">Map your file columns to service fields.</div>
    <div class="alert" style="margin-bottom:12px">
      <strong>Detected columns (${headers.length})</strong> - delimiter: ${escHtml(delimiterLabel)}<br>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${headers.map(h => `<span style="padding:4px 8px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover);font-size:12px">${escHtml(h)}</span>`).join('') || '<span class="text-muted">No headers detected</span>'}
      </div>
    </div>
    <div class="table-wrap" style="max-height:52vh;overflow:auto">
      <table>
        <thead><tr><th>System Field</th><th>Your Column</th></tr></thead>
        <tbody>
          ${SERVICE_IMPORT_FIELDS.map(f => `
            <tr>
              <td><strong>${escHtml(f.label)}</strong>${f.required ? ' <span style="color:var(--c-danger)">*</span>' : ''}</td>
              <td><select id="svc_map_${f.key}" style="min-width:260px;width:100%">${options}</select></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  showModal('Map Service Import Columns', body, async () => {
    const mapping = {};
    SERVICE_IMPORT_FIELDS.forEach(f => { mapping[f.key] = document.getElementById(`svc_map_${f.key}`)?.value || ''; });
    if (!mapping.name || !mapping.price) {
      toast('Please map Service Name and Price fields before import', 'error');
      return false;
    }
    const mappedRows = buildMappedServiceRows(sourceRows, mapping);
    if (!mappedRows.length) {
      toast('No importable rows after mapping', 'error');
      return false;
    }
    closeModal();
    toast(`Starting import for ${mappedRows.length} row${mappedRows.length !== 1 ? 's' : ''}...`, 'success');
    setTimeout(() => {
      runServiceImportRows(mappedRows).catch(err => toast(err.message || 'Import failed', 'error'));
    }, 0);
  }, 'modal-lg');

  SERVICE_IMPORT_FIELDS.forEach(f => {
    const el = document.getElementById(`svc_map_${f.key}`);
    if (el && initial[f.key]) el.value = initial[f.key];
  });
}

async function handleServiceImportFile(ev) {
  const file = ev && ev.target && ev.target.files ? ev.target.files[0] : null;
  if (!file) return;
  if (!can('services.import')) { toast('No permission to import services', 'error'); return; }
  try {
    const text = await file.text();
    const parsed = parseServicesCsv(text);
    if (!parsed.rows.length) { toast('No valid rows found in CSV', 'error'); return; }
    openServiceImportMappingModal(parsed.headers, parsed.rows, parsed.delimiter);
  } catch (e) {
    toast(e.message || 'Import failed', 'error');
  }
}

async function openServiceProductModal(serviceId) {
  try {
    const [servicesList, products, links] = await Promise.all([
      apiFetch('/api/services'),
      apiFetch('/api/store/products'),
      apiFetch('/api/store/service-products')
    ]);
    const svc = (servicesList || []).find(s => s.id === serviceId);
    if (!svc) { toast('Service not found', 'error'); return; }
    const serviceLinks = (links || []).filter(l => l.service_id === serviceId);
    const productOptions = (products || []).filter(p => p.active !== false)
      .map(p => {
        const cost = parseFloat(p.cost_price || 0) || 0;
        return `<option value="${p.id}">${escHtml(p.name)}${p.uom_symbol ? ` (${escHtml(p.uom_symbol)})` : ''} - KD ${cost.toFixed(3)}</option>`;
      }).join('');

    showModal(`Assign Products - ${escHtml(svc.name)}`, `
      <div id="svcProdModalWrap">
        <div class="form-row">
          <div class="form-group">
            <label>Product</label>
            <select id="spmProductId"><option value="">- Select Product -</option>${productOptions}</select>
          </div>
          <div class="form-group">
            <label>Qty per Service Use</label>
            <div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input id="spmQtyPerUse" type="number" min="0.001" step="0.001" value="1"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div>
          </div>
        </div>
        <div class="text-muted text-sm" style="margin-top:-4px;margin-bottom:10px">This defines auto-consumption from Main Store each time this service is billed.</div>
        <div id="spmList" style="max-height:280px;overflow:auto;border:1px solid var(--border-light);border-radius:10px;padding:8px;background:var(--bg)">
          ${renderServiceProductList(serviceLinks)}
        </div>
      </div>`,
      [
        { label:'Add / Update', class:'btn-primary', async onclick(modal) {
          const product_id = parseInt(modal.querySelector('#spmProductId')?.value || 0);
          const qty_per_use = parseFloat(modal.querySelector('#spmQtyPerUse')?.value || 0);
          if (!product_id) { toast('Select product', 'error'); return false; }
          if (!(qty_per_use > 0)) { toast('Enter valid quantity per use', 'error'); return false; }
          await apiFetch('/api/store/service-products', { method:'POST', body: JSON.stringify({ service_id: serviceId, product_id, qty_per_use }) });
          const latest = await apiFetch(`/api/store/service-products?service_id=${serviceId}`);
          const listWrap = modal.querySelector('#spmList');
          if (listWrap) listWrap.innerHTML = renderServiceProductList(latest || []);
          toast('Product mapping saved', 'success');
          return false;
        } }
      ]
    );
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderServiceProductList(links) {
  if (!links || !links.length) {
    return `<div class="text-muted text-sm" style="padding:10px">No product mapped to this service yet.</div>`;
  }
  return `<div class="table-wrap" style="margin:0"><table>
    <thead><tr><th>Product</th><th>Qty / Use</th><th>Unit Cost</th><th>Cost / Use</th><th>Unit</th><th>Action</th></tr></thead>
    <tbody>${links.map(l => `<tr>
      <td><strong>${escHtml(l.product_name || '')}</strong></td>
      <td>${parseFloat(l.qty_per_use || 0).toFixed(3)}</td>
      <td>KD ${parseFloat(l.product_cost || 0).toFixed(3)}</td>
      <td><strong>KD ${parseFloat(l.cost_per_use || 0).toFixed(3)}</strong></td>
      <td>${escHtml(l.product_unit || '-')}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteServiceProductLink(${l.id},${l.service_id})">${IC.trash}</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function deleteServiceProductLink(id, serviceId) {
  if (!await confirmDialog('Remove this product from service?')) return;
  try {
    await apiFetch(`/api/store/service-products/${id}`, { method:'DELETE' });
    const modal = document.getElementById('modalOverlay');
    if (modal && modal.querySelector('#spmList')) {
      const latest = await apiFetch(`/api/store/service-products?service_id=${serviceId}`);
      modal.querySelector('#spmList').innerHTML = renderServiceProductList(latest || []);
    }
    toast('Mapping removed', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// -----------------------------------------------
//  PACKAGES
// -----------------------------------------------
async function packages() {
  const ca = document.getElementById('contentArea');
  const isAdmin = currentUser && currentUser.role === 'admin';
  ca.innerHTML = `
    <div class="action-bar">
      <div class="search-box">
        <input id="pkgSearch" type="text" placeholder="Search packages..." oninput="filterPackages()" />
      </div>
      <select id="pkgStatusFilter" class="form-select svc-cat-filter" onchange="filterPackages()" style="min-width:140px;max-width:180px">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      ${can('packages.create') ? `<button class="btn btn-primary" onclick="openAddPackageModal()">${IC.plus} Add Package</button>` : ''}
      ${viewToggleHTML('packages')}
    </div>
    <div id="pkgWrap">${skeletonTable(4)}</div>`;
  try {
    const list = await apiFetch('/api/packages');
    window._allPackages = list;
    renderPackagesTable(list, isAdmin);
  } catch(e) { toast(e.message, 'error'); }
}

function filterPackages() {
  const q = (document.getElementById('pkgSearch')?.value||'').toLowerCase();
  const status = (document.getElementById('pkgStatusFilter')?.value||'').toLowerCase();
  const isAdmin = currentUser && currentUser.role === 'admin';
  const filtered = (window._allPackages||[]).filter(p =>
    (!q || p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q))
    && (!status || (status === 'active' ? !!p.active : !p.active))
  );
  renderPackagesTable(filtered, isAdmin);
}

function renderPackagesTable(list, isAdmin) {
  const wrap = document.getElementById('pkgWrap');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = `<div class="empty-state">${IC.empty}<p>No packages found</p></div>`; return; }
  if (getViewPref('packages') === 'list') {
    wrap.innerHTML = `<div class="table-wrap" data-vpage="packages"><table>
      <thead><tr><th>#</th><th>Name</th><th>Services</th><th>Sessions</th><th>Price</th><th>Status</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map((p,i) => {
        const totalSessions = (p.services||[]).reduce((t,s)=>t+(s.total||1),0);
        const svcNames = (p.services||[]).map(s=>escHtml(s.name)+(s.total>1?` -${s.total}`:'')).join(', ');
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${escHtml(p.name)}</strong>${p.description?`<div class="text-muted text-sm">${escHtml(p.description)}</div>`:''}</td>
          <td class="text-sm">${svcNames||'-'}</td>
          <td>${totalSessions}</td>
          <td><strong>KD ${(p.discount_price||0).toFixed(3)}</strong>${p.total_price&&p.total_price>p.discount_price?`<br><span class="text-muted text-sm" style="text-decoration:line-through">KD ${(p.total_price).toFixed(3)}</span>`:''}</td>
          <td>${p.active ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-unpaid">Inactive</span>'}</td>
          ${isAdmin ? `<td class="td-actions">
            ${can('packages.edit') ? `<button class="btn btn-sm" onclick="openEditPackageModal(${p.id})">${IC.edit} Edit</button>` : ''}
            ${can('packages.edit') ? `<button class="btn btn-sm ${p.active ? 'btn-danger' : 'btn-success'}" onclick="togglePackageActive(${p.id})">${p.active ? 'Set Inactive' : 'Set Active'}</button>` : ''}
          </td>` : ''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
    return;
  }
  wrap.innerHTML = `<div class="pkg-card-grid">${list.map(p => {
    const mrp = p.total_price || 0;
    const pkg = p.discount_price || 0;
    const saving = mrp - pkg;
    const savingPct = mrp > 0 ? Math.round((saving / mrp) * 100) : 0;
    const totalSessions = (p.services||[]).reduce((t,s)=>t+(s.total||1),0);
    const chips = (p.services||[]).map(s =>
      `<span class="pkg-svc-chip">${escHtml(s.name)}${(s.total||1)>1?`<em> -${s.total}</em>`:''}</span>`
    ).join('');
    return `
    <div class="pkg-card${p.active ? '' : ' pkg-card-inactive'}">
      ${(savingPct > 0 || !p.active) ? `<div class="pkg-card-badges">
        ${savingPct > 0 ? `<div class="pkg-card-badge">Save ${savingPct}%</div>` : ''}
        ${!p.active ? `<div class="pkg-card-badge pkg-card-badge-off">Inactive</div>` : ''}
      </div>` : ''}
      <div class="pkg-card-top">
        <div class="pkg-card-icon">${IC.packages}</div>
        <div class="pkg-card-name">${escHtml(p.name)}</div>
        ${p.description ? `<div class="pkg-card-desc">${escHtml(p.description)}</div>` : ''}
      </div>
      <div class="pkg-card-svcs">${chips || '<span class="text-muted">No services</span>'}</div>
      <div class="pkg-card-footer">
        <div class="pkg-card-price-wrap">
          ${mrp > pkg ? `<span class="pkg-card-mrp">KD ${mrp.toFixed(3)}</span>` : ''}
          <span class="pkg-card-price">KD ${pkg.toFixed(3)}</span>
        </div>
        <div class="pkg-card-sessions">${totalSessions} session${totalSessions !== 1 ? 's' : ''}</div>
      </div>
      ${(isAdmin && can('packages.edit')) ? `
      <div class="pkg-card-actions">
        ${can('packages.edit') ? `<button class="btn btn-sm btn-ghost pkg-card-btn" onclick="openEditPackageModal(${p.id})">${IC.edit} Edit</button>` : ''}
        ${can('packages.edit') ? `<button class="btn btn-sm ${p.active ? 'btn-danger-ghost' : 'btn-success'} pkg-card-btn" onclick="togglePackageActive(${p.id})">${p.active ? 'Inactive' : 'Active'}</button>` : ''}
      </div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

async function togglePackageActive(id) {
  try {
    const p = (window._allPackages || []).find(x => x.id === id);
    if (!p) { toast('Package not found', 'error'); return; }
    const nextActive = !p.active;
    await apiFetch(`/api/packages/${id}`, { method:'PUT', body: JSON.stringify({ active: nextActive }) });
    toast(`Package set ${nextActive ? 'Active' : 'Inactive'}`, 'success');
    packages();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function openAddPackageModal() {
  let allSvcs = [];
  try { allSvcs = await apiFetch('/api/services'); } catch {}
  const activeServices = allSvcs.filter(s => s.active);
  showModal('Add New Package', `
    <form id="pkgForm">
      <div class="form-group"><label>Package Name *</label><input name="name" required placeholder="e.g. Basic Health Checkup"/></div>
      <div class="form-group"><label>Description</label><input name="description" placeholder="Brief description"/></div>
      <div class="form-group">
        <label>Included Services *</label>
        <div style="margin-bottom:8px"><input id="pkgSvcGridSearch" oninput="_filterPkgSvcGrid(this.value)" placeholder="Search services..." style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text)"/></div>
        <div class="svc-grid" id="pkgSvcGrid">
          ${activeServices.map(s=>`
            <div class="svc-card" data-svc-name="${escHtml(s.name).toLowerCase()}">
              <div class="svc-card-body">
                <div class="svc-card-title">${escHtml(s.name)}</div>
                <div class="svc-card-desc">${escHtml(s.category||'')}</div>
              </div>
              <div class="svc-card-actions">
                <div class="svc-card-price">KD ${s.price.toFixed(3)}</div>
                <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                  <label class="svc-select"><input type="checkbox" name="service_ids" value="${s.id}" id="pkgCb-${s.id}" onchange="recalcPkgPrice()"/></label>
                  <input type="hidden" name="svc_qty_${s.id}" id="pkgQtyVal-${s.id}" value="1"/>
                  <div class="bps-stepper">
                    <button type="button" class="bps-step-btn" onclick="pkgStep('${s.id}',false)">-</button>
                    <span class="bps-step-val" id="pkgQtyDisp-${s.id}">1</span>
                    <button type="button" class="bps-step-btn bps-step-plus" onclick="pkgStep('${s.id}',true)">+</button>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div class="svc-price-summary" id="pkgMrpRow">MRP: <strong id="pkgMrpVal">KD 0.00</strong></div>
      </div>
      <div class="form-group"><label>Package Price (KD) *</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="discount_price" id="pkgDiscountPrice" type="number" min="0" step="0.001" required placeholder="0.000"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
    </form>
    <script>window._svcPriceMap=${JSON.stringify(Object.fromEntries(activeServices.map(s=>[s.id,s.price])))};window._filterPkgSvcGrid=function(q){const v=(q||'').toLowerCase();document.querySelectorAll('#pkgSvcGrid .svc-card').forEach(c=>{const n=c.getAttribute('data-svc-name')||'';c.style.display = (!v || n.includes(v)) ? '' : 'none';})} <\/script>`, async () => {
    const form = document.getElementById('pkgForm');
    const data = Object.fromEntries(new FormData(form));
    const checkedEls = [...form.querySelectorAll('[name=service_ids]:checked')];
    const serviceIds = checkedEls.map(el=>parseInt(el.value));
    // build services with quantities
    const services = checkedEls.map(el => ({ service_id: parseInt(el.value), total: parseInt(form.querySelector(`[name=svc_qty_${el.value}]`).value) || 1 }));
    if (!data.name) { toast('Package name is required','error'); return false; }
    if (!serviceIds.length) { toast('Select at least one service','error'); return false; }
    if (!data.discount_price) { toast('Package price is required','error'); return false; }
    try {
      await apiFetch('/api/packages', { method:'POST', body: JSON.stringify({ ...data, services }) });
      toast('Package added','success'); closeModal(); packages();
    } catch(e) { toast(e.message,'error'); return false; }
  });

  // Inline helper to filter service checklist inside the modal
  window._filterPkgSvcList = function(q) {
    const qv = (q||'').toLowerCase().trim();
    const wrap = document.getElementById('pkgSvcChecklist');
    if (!wrap) return;
    [...wrap.querySelectorAll('.svc-check-item')].forEach(el => {
      const name = (el.getAttribute('data-svc-name')||'');
      el.style.display = (!qv || name.includes(qv)) ? '' : 'none';
    });
  };
}

function pkgStep(svcId, inc) {
  const dispEl = document.getElementById(`pkgQtyDisp-${svcId}`);
  const hidEl  = document.getElementById(`pkgQtyVal-${svcId}`);
  if (!dispEl || !hidEl) return;
  let val = parseInt(dispEl.textContent) || 1;
  val = Math.max(1, inc ? val + 1 : val - 1);
  dispEl.textContent = val;
  hidEl.value = val;
  // auto-check the service when stepping up
  const cb = document.getElementById(`pkgCb-${svcId}`);
  if (cb && inc && !cb.checked) { cb.checked = true; }
  recalcPkgPrice();
}
function recalcPkgPrice() {
  const map = window._svcPriceMap || {};
  const checkedEls = [...document.querySelectorAll('[name=service_ids]:checked')];
  const total = checkedEls.reduce((s,el)=>{
    const id = parseInt(el.value);
    const qtyEl = document.querySelector(`[name=svc_qty_${el.value}]`);
    const qty = qtyEl ? parseInt(qtyEl.value) || 1 : 1;
    return s + ((map[id]||0) * qty);
  }, 0);
  const mrpEl = document.getElementById('pkgMrpVal');
  if (mrpEl) mrpEl.textContent = `KD ${total.toFixed(3)}`;
  const discEl = document.getElementById('pkgDiscountPrice');
  if (discEl && !discEl.value) discEl.value = total.toFixed(3);
}

async function openEditPackageModal(id) {
  try {
    const [pkgList, allSvcs] = await Promise.all([apiFetch('/api/packages'), apiFetch('/api/services')]);
    const p = pkgList.find(x => x.id === id);
    if (!p) { toast('Not found','error'); return; }
    const activeServices = allSvcs.filter(s => s.active);
    // p may expose services (with totals) or service_ids (legacy)
    const selMap = new Map();
    if (Array.isArray(p.services) && p.services.length) {
      p.services.forEach(s => selMap.set(s.service_id, s.total||1));
    } else if (Array.isArray(p.service_ids)) {
      p.service_ids.forEach(id => selMap.set(id, 1));
    }
    showModal(`Edit - ${escHtml(p.name)}`, `
      <form id="pkgForm">
        <div class="form-group"><label>Package Name *</label><input name="name" value="${escHtml(p.name)}" required/></div>
        <div class="form-group"><label>Description</label><input name="description" value="${escHtml(p.description||'')}"/></div>
        <div class="form-group">
          <label>Included Services *</label>
          <div style="margin-bottom:8px"><input id="pkgSvcGridSearchEdit" oninput="_filterPkgSvcGridEdit(this.value)" placeholder="Search services..." style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text)"/></div>
          <div class="svc-grid" id="pkgSvcGridEdit">
            ${activeServices.map(s => `
              <div class="svc-card" data-svc-name="${escHtml(s.name).toLowerCase()}">
                <div class="svc-card-body">
                  <div class="svc-card-title">${escHtml(s.name)}</div>
                  <div class="svc-card-desc">${escHtml(s.category||'')}</div>
                </div>
                <div class="svc-card-actions">
                  <div class="svc-card-price">KD ${s.price.toFixed(3)}</div>
                  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                    <label class="svc-select"><input type="checkbox" name="service_ids" value="${s.id}" id="pkgCb-${s.id}" ${selMap.has(s.id)?'checked':''} onchange="recalcPkgPrice()"/></label>
                    <input type="hidden" name="svc_qty_${s.id}" id="pkgQtyVal-${s.id}" value="${selMap.get(s.id)||1}"/>
                    <div class="bps-stepper">
                      <button type="button" class="bps-step-btn" onclick="pkgStep('${s.id}',false)">-</button>
                      <span class="bps-step-val" id="pkgQtyDisp-${s.id}">${selMap.get(s.id)||1}</span>
                      <button type="button" class="bps-step-btn bps-step-plus" onclick="pkgStep('${s.id}',true)">+</button>
                    </div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
          <div class="svc-price-summary" id="pkgMrpRow">MRP: <strong id="pkgMrpVal">KD ${p.total_price?.toFixed(3)||'0.000'}</strong></div>
        </div>
        <div class="form-group"><label>Package Price (KD) *</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="discount_price" id="pkgDiscountPrice" type="number" min="0" step="0.001" value="${p.discount_price}" required/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Status</label>
          <select name="active">
            <option value="true"${p.active?' selected':''}>Active</option>
            <option value="false"${!p.active?' selected':''}>Inactive</option>
          </select>
        </div>
      </form>
      <script>window._svcPriceMap=${JSON.stringify(Object.fromEntries(activeServices.map(s=>[s.id,s.price])))};window._filterPkgSvcGridEdit=function(q){const v=(q||'').toLowerCase();document.querySelectorAll('#pkgSvcGridEdit .svc-card').forEach(c=>{const n=c.getAttribute('data-svc-name')||'';c.style.display=(!v||n.includes(v))?'':'none';})}<\/script>`, async () => {
      const form = document.getElementById('pkgForm');
      const data = Object.fromEntries(new FormData(form));
      const checkedEls = [...form.querySelectorAll('[name=service_ids]:checked')];
      if (!checkedEls.length) { toast('Select at least one service','error'); return false; }
      const services = checkedEls.map(el => ({ service_id: parseInt(el.value), total: parseInt(form.querySelector(`[name=svc_qty_${el.value}]`).value) || 1 }));
      data.active = data.active === 'true';
      try {
        await apiFetch(`/api/packages/${id}`, { method:'PUT', body: JSON.stringify({ ...data, services }) });
        toast('Package updated','success'); closeModal(); packages();
      } catch(e) { toast(e.message,'error'); return false; }
    });
  } catch(e) { toast(e.message,'error'); }
}

async function deletePackage(id, name) {
  if (!await confirmDialog(`Delete package "${name}"? This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/packages/${id}`, { method:'DELETE' });
    toast('Package deleted','success'); packages();
  } catch(e) { toast(e.message,'error'); }
}

// -----------------------------------------------
//  SETUP
// -----------------------------------------------
async function ownerControl() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="setup-layout">
      <div class="setup-head">
        <div>
          <div class="setup-title">Owner Control</div>
          <div class="setup-subtitle">Manage clinic profile, subscription, backups, restore, and system reset.</div>
        </div>
      </div>

      <section class="setup-section setup-section-clinic">
        <div class="setup-section-head">
          <div class="setup-section-title"><span class="setup-section-icon">${IC.setup}</span><span>Owner Control</span></div>
        </div>
        <div class="setup-grid setup-grid-2">
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.hospital} Clinic Profile</div>
            </div>
            <div class="card-body">
              <form id="ownerClinicForm" class="grid-2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
                <div class="form-group"><label>Clinic Name *</label><input name="clinic_name" required /></div>
                <div class="form-group"><label>Trade Name</label><input name="trade_name" /></div>
                <div class="form-group"><label>Phone</label><input name="phone" /></div>
                <div class="form-group"><label>Email</label><input name="email" type="email" /></div>
                <div class="form-group"><label>Tax Number</label><input name="tax_number" /></div>
                <div class="form-group"><label>Max Users</label><input name="max_users" type="number" min="1" step="1" /></div>
                <div class="form-group"><label>No-Show Booking Limit</label><input name="no_show_booking_limit" type="number" min="1" step="1" /></div>
                <div class="form-group" style="grid-column:1/-1"><label>Address</label><textarea name="address" rows="2"></textarea></div>
                <div class="form-group" style="grid-column:1/-1">
                  <label>Clinic Logo</label>
                  <input id="ownerLogoFile" type="file" accept="image/*" onchange="onOwnerLogoSelected(event)" />
                  <input id="ownerLogoData" name="logo_url" type="hidden" />
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;">
                    <img id="ownerLogoPreview" alt="Logo preview" style="display:none;max-height:70px;max-width:180px;object-fit:contain;border:1px solid var(--line);border-radius:8px;padding:4px;background:var(--bg-elev-2);" />
                    <button type="button" class="btn btn-sm" onclick="clearOwnerLogo()">Remove Logo</button>
                  </div>
                  <div class="text-muted text-sm" style="margin-top:6px;">Attach PNG/JPG logo (max 1 MB).</div>
                </div>
                <div class="form-group" style="grid-column:1/-1"><label>Receipt Header (below clinic name)</label><textarea name="receipt_header" rows="2" placeholder="Address, phone, tagline"></textarea></div>
                <div class="form-group" style="grid-column:1/-1"><label>Receipt Footer Note</label><textarea name="receipt_footer" rows="2" placeholder="Thank you note or policy text"></textarea></div>
              </form>
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.revenue} Subscription Control</div>
            </div>
            <div class="card-body">
              <form id="ownerSubscriptionForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">
                <div class="form-group"><label>Plan</label>
                  <select name="plan"><option value="trial">Trial</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select>
                </div>
                <div class="form-group"><label>Status</label>
                  <select name="status"><option value="trial">Trial</option><option value="active">Active</option><option value="grace">Grace</option><option value="expired">Expired</option><option value="suspended">Suspended</option></select>
                </div>
                <div class="form-group"><label>Trial Start</label><input name="trial_start" type="date" /></div>
                <div class="form-group"><label>Trial End</label><input name="trial_end" type="date" /></div>
                <div class="form-group"><label>Subscription Start</label><input name="subscription_start" type="date" /></div>
                <div class="form-group"><label>Subscription End</label><input name="subscription_end" type="date" /></div>
                <div class="form-group"><label>Grace Days</label><input name="grace_days" type="number" min="0" step="1" /></div>
                <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
              </form>
              <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="saveOwnerControl()">${IC.check} Save Owner Settings</button>
                <button class="btn" onclick="completeOwnerSetup()">${IC.setup} Mark Setup Complete</button>
                ${currentUser && currentUser.role === 'admin' ? `<button id="ownerBackupBtn" class="btn" onclick="triggerDbBackup()">${IC.download || IC.reports} Create DB Backup</button>` : ''}
                ${currentUser && currentUser.role === 'admin' ? `<button id="ownerSystemUpdateBtn" class="btn btn-warning" onclick="triggerSystemUpdate()">${IC.clock || ''} System Update</button>` : ''}
              </div>
              <div id="ownerSubscriptionState" class="text-muted" style="margin-top:10px"></div>
              <div id="ownerAppVersionState" class="text-muted" style="margin-top:6px"></div>
              ${currentUser && currentUser.role === 'admin' ? `<div id="ownerBackupState" class="text-muted" style="margin-top:6px"></div>` : ''}
              ${currentUser && currentUser.role === 'admin' ? `<div id="ownerSystemUpdateState" class="text-muted" style="margin-top:6px"></div>` : ''}
              ${currentUser && currentUser.role === 'admin' ? `<div id="ownerRestorePanel" style="margin-top:10px;border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--bg-hover)">
                <div style="font-weight:700;color:var(--text);margin-bottom:8px">One-Click Data Restore</div>
                <div class="text-sm text-muted" style="margin-bottom:8px">Restore full database from backup file. A safety backup is created automatically before restore.</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
                  <select id="restoreBackupSelect" class="form-select" style="min-width:280px;max-width:100%"></select>
                  <button id="restoreLatestBtn" class="btn btn-danger" onclick="startDbRestoreLatest()">${IC.download || IC.reports} Restore Latest</button>
                  <button id="restoreSelectedBtn" class="btn" onclick="startDbRestoreSelected()">${IC.download || IC.reports} Restore Selected</button>
                </div>
                <div id="restoreProgressWrap" style="display:none;margin-top:8px">
                  <div style="height:10px;border-radius:999px;background:var(--bg);overflow:hidden"><div id="restoreProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--c-warning),var(--c-danger));transition:width .25s ease"></div></div>
                  <div id="restoreProgressText" class="text-sm text-muted" style="margin-top:6px"></div>
                  <div id="restoreBackupSafety" class="text-sm" style="margin-top:6px"></div>
                </div>
              </div>` : ''}
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.x} System Reset</div>
            </div>
            <div class="card-body">
              <div style="border:1px solid color-mix(in srgb, var(--c-danger) 40%, var(--border) 60%);background:color-mix(in srgb, var(--c-danger-bg) 75%, transparent);padding:10px 12px;border-radius:10px;color:var(--c-danger);font-weight:700;font-size:13px;">
                This will permanently delete all patient and transactional data.
              </div>
              <div id="resetSummary" class="text-sm" style="margin-top:10px;color:var(--text-secondary)">Loading reset summary...</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                <input id="resetIncludeAudit" type="checkbox" onchange="refreshResetSummary()" />
                <label for="resetIncludeAudit" class="text-sm">Also delete audit logs</label>
              </div>
              <div class="form-row" style="margin-top:10px;">
                <div class="form-group">
                  <label>Type RESET to confirm</label>
                  <input id="resetConfirmText" placeholder="RESET" />
                </div>
                <div class="form-group">
                  <label>Re-enter Admin Password</label>
                  <input id="resetPassword" type="password" placeholder="Password" />
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <button id="startResetBtn" class="btn btn-danger" onclick="startSystemResetJob()">${IC.x} Start One-Click Tenant Reset</button>
                <button class="btn" onclick="loadSystemResetPanel()">${IC.clock} Refresh Status</button>
              </div>
              <div id="resetProgressWrap" style="display:none;margin-top:10px;">
                <div style="height:10px;border-radius:999px;background:var(--bg-hover);overflow:hidden;">
                  <div id="resetProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--c-danger),color-mix(in srgb,var(--c-warning) 50%, var(--c-danger) 50%));transition:width .25s ease"></div>
                </div>
                <div id="resetProgressText" class="text-sm text-muted" style="margin-top:6px"></div>
                <div id="resetBackupLinks" class="text-sm" style="margin-top:6px"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>`;
  loadOwnerControl();
  loadSystemResetPanel();
}

async function setup() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="setup-layout">
      <div class="setup-head">
        <div>
          <div class="setup-title">Setup Center</div>
          <div class="setup-subtitle">Manage clinic masters, doctor availability, and store-related settings.</div>
        </div>
      </div>

      <section class="setup-section setup-section-clinic">
        <div class="setup-section-head">
          <div class="setup-section-title"><span class="setup-section-icon">${IC.billing}</span><span>Clinic & Billing Masters</span></div>
        </div>
        <div class="setup-grid setup-grid-2">
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.billing} Payment Methods</div>
              ${can('setup.edit') ? `<button class="btn btn-primary btn-sm" onclick="openAddPaymentMethodModal()">${IC.plus} Add</button>` : ''}
            </div>
            <div class="card-body">
              <div id="pmWrap">${skeletonTable(4)}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.services} Service Categories</div>
              ${can('setup.edit') ? `<button class="btn btn-primary btn-sm" onclick="openAddServiceCategoryModal()">${IC.plus} Add</button>` : ''}
            </div>
            <div class="card-body">
              <div id="scWrap">${skeletonTable(4)}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.expense} Expense Categories</div>
              ${can('setup.edit') ? `<button class="btn btn-primary btn-sm" onclick="openAddExpenseCategoryModal()">${IC.plus} Add</button>` : ''}
            </div>
            <div class="card-body">
              <div id="ecWrap">${skeletonTable(4)}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.print} Printer Configuration</div>
            </div>
            <div class="card-body">
              <form id="setupPrinterForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                <div class="form-group"><label>Print Mode</label>
                  <select name="print_mode">
                    <option value="auto">Auto Print - print immediately after bill creation</option>
                    <option value="manual">Manual Print - show preview with Print / Cancel</option>
                  </select>
                </div>
                <div class="form-group"><label>Printer Type</label>
                  <select name="printer_type" onchange="updatePrinterTypeFields()">
                    <option value="">-- Not Configured --</option>
                    <option value="usb">USB Printer</option>
                    <option value="network">Network Printer</option>
                  </select>
                </div>
                <div class="form-group"><label>Printer Name</label>
                  <select id="printerNameSelect" name="printer_name" onchange="updatePrinterNameInput()">
                    <option value="">Select available printer...</option>
                  </select>
                  <div style="font-size:12px;color:#666;margin-top:4px">Or enter manually:</div>
                  <input id="printerNameManual" name="printer_name_manual" type="text" placeholder="e.g., HP LaserJet" style="margin-top:4px" onchange="updatePrinterNameFromInput()" />
                  <button type="button" class="btn btn-sm" style="margin-top:6px" onclick="refreshAvailablePrinters()">Refresh List</button>
                </div>
                <div class="form-group" style="display:none" id="networkIPField"><label>Network IP Address</label><input name="printer_ip" placeholder="192.168.1.100" /></div>
                <div class="form-group" style="display:none" id="networkPortField"><label>Network Port</label><input name="printer_port" type="number" min="1" max="65535" placeholder="9100" /></div>
              </form>
              <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="savePrinterConfig()">${IC.check} Save Printer Config</button>
                <button class="btn" onclick="testPrinterConnection()">?? Test Printer</button>
              </div>
              <div id="printerStatus" class="text-muted" style="margin-top:8px;font-size:13px"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="setup-section setup-section-doctor">
        <div class="setup-section-head">
          <div class="setup-section-title"><span class="setup-section-icon">${IC.users}</span><span>Doctor Setup</span></div>
        </div>
        <div class="setup-grid setup-grid-2">
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.users} Doctor Departments</div>
              ${can('setup.edit') ? `<button class="btn btn-primary btn-sm" onclick="openAddDoctorDepartmentModal()">${IC.plus} Add</button>` : ''}
            </div>
            <div class="card-body">
              <div id="ddWrap">${skeletonTable(4)}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.scheduler} Doctor Schedules</div>
            </div>
            <div class="card-body">
              <div id="dsWrap">${skeletonTable(4)}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="setup-section setup-section-store">
        <div class="setup-section-head">
          <div class="setup-section-title"><span class="setup-section-icon">${IC.store}</span><span>Store Masters</span></div>
        </div>
        <div class="setup-grid setup-grid-2">
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.product || ''} UOM Master</div>
              ${can('setup.edit') ? `<button class="btn btn-primary btn-sm" onclick="openAddUomModal()">${IC.plus} Add</button>` : ''}
            </div>
            <div class="card-body">
              <div id="uomWrap">${skeletonTable(4)}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header-row">
              <div class="card-title">${IC.product || ''} Product Categories</div>
              ${can('setup.edit') ? `<button class="btn btn-primary btn-sm" onclick="openAddProductCategoryModal()">${IC.plus} Add</button>` : ''}
            </div>
            <div class="card-body">
              <div id="spcWrap">${skeletonTable(4)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>`;
  loadPaymentMethods();
  loadServiceCategoriesTable();
  loadExpenseCategoriesTable();
  loadSetupPrinterConfig();
  loadDoctorDepartmentsTable();
  loadDoctorSchedulesTable();
  loadUomsTable();
  loadProductCategoriesTable();
}

async function loadSetupPrinterConfig() {
  if (!can('setup.edit')) return;
  try {
    const cfg = await apiFetch('/api/setup/profile');
    currentSystem = cfg;
    const printerForm = document.getElementById('setupPrinterForm');
    const printer = cfg.printer || {};
    if (!printerForm) return;

    printerForm.print_mode.value = printer.print_mode || 'auto';
    printerForm.printer_type.value = printer.printer_type || '';
    printerForm.printer_ip.value = printer.printer_ip || '';
    printerForm.printer_port.value = printer.printer_port || 9100;
    const manual = document.getElementById('printerNameManual');
    if (manual) manual.value = printer.printer_name || '';
    updatePrinterTypeFields();

    const printerStatus = document.getElementById('printerStatus');
    if (printer.printer_name && printerStatus) {
      printerStatus.textContent = `? Configured: ${printer.printer_name} (${printer.printer_type || 'unknown'})`;
    } else if (printerStatus) {
      printerStatus.textContent = '';
    }

    // Don't auto-load printers - let user click "Refresh List" to avoid command prompt popup
    // refreshAvailablePrinters(printer.printer_name || '');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadOwnerControl() {
  if (!can('setup.edit')) return;
  try {
    const cfg = await apiFetch('/api/setup/profile');
    currentSystem = cfg;
    applyClinicBranding();

    const clinic = cfg.clinic || {};
    const sub = cfg.subscription || {};
    const clinicForm = document.getElementById('ownerClinicForm');
    const subForm = document.getElementById('ownerSubscriptionForm');
    if (!clinicForm || !subForm) return;

    clinicForm.clinic_name.value = clinic.clinic_name || '';
    clinicForm.trade_name.value = clinic.trade_name || '';
    clinicForm.phone.value = clinic.phone || '';
    clinicForm.email.value = clinic.email || '';
    clinicForm.tax_number.value = clinic.tax_number || '';
    clinicForm.max_users.value = clinic.max_users || 25;
    clinicForm.no_show_booking_limit.value = clinic.no_show_booking_limit ?? 5;
    clinicForm.address.value = clinic.address || '';
    clinicForm.logo_url.value = clinic.logo_url || '';
    const logoPreview = document.getElementById('ownerLogoPreview');
    if (logoPreview) {
      if (clinic.logo_url) {
        logoPreview.src = clinic.logo_url;
        logoPreview.style.display = '';
      } else {
        logoPreview.removeAttribute('src');
        logoPreview.style.display = 'none';
      }
    }
    clinicForm.receipt_header.value = clinic.receipt_header || '';
    clinicForm.receipt_footer.value = clinic.receipt_footer || '';

    subForm.plan.value = sub.plan || 'trial';
    subForm.status.value = sub.status || 'trial';
    subForm.trial_start.value = sub.trial_start || '';
    subForm.trial_end.value = sub.trial_end || '';
    subForm.subscription_start.value = sub.subscription_start || '';
    subForm.subscription_end.value = sub.subscription_end || '';
    subForm.grace_days.value = sub.grace_days ?? 3;
    subForm.notes.value = sub.notes || '';

    const state = document.getElementById('ownerSubscriptionState');
    if (state) {
      const statusText = (sub.status || '').toUpperCase() || 'UNKNOWN';
      const daysLeft = (sub.days_left === null || sub.days_left === undefined) ? 'N/A' : String(sub.days_left);
      state.textContent = `Current Status: ${statusText} | Days Left: ${daysLeft} | Setup Completed: ${cfg.setup_required ? 'No' : 'Yes'}`;
    }

    const build = cfg.build || {};
    const appVersionState = document.getElementById('ownerAppVersionState');
    if (appVersionState) {
      const ver = build.version || 'unknown';
      const commit = build.git_commit ? ` (${build.git_commit})` : '';
      const started = build.started_at ? formatDateTime(build.started_at) : 'unknown';
      const latest = build.latest_file_mtime ? formatDateTime(build.latest_file_mtime) : 'unknown';
      appVersionState.textContent = `App Version: v${ver}${commit} | Server Started: ${started} | Latest Code File: ${latest}`;
    }

    if (currentUser && currentUser.role === 'admin') {
      loadOwnerBackupStatus();
      loadSystemResetPanel();
      loadSystemRestorePanel();
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

let _resetJobPollTimer = null;
let _restoreJobPollTimer = null;
let _ownerBackupsCache = [];

function renderResetSummary(summary) {
  const el = document.getElementById('resetSummary');
  if (!el) return;
  if (!summary) {
    el.textContent = 'Summary unavailable.';
    return;
  }
  const rows = [
    ['Patients', summary.patients || 0],
    ['Appointments', summary.appointments || 0],
    ['Follow Ups', summary.follow_ups || 0],
    ['EMR (Prescriptions)', summary.prescriptions || 0],
    ['Billing & Invoices', summary.bills || 0],
    ['Refunds', summary.refunds || 0],
    ['Expenses', summary.expenses || 0],
    ['Services', summary.services || 0],
    ['Packages', summary.packages || 0],
    ['Inventory Tx', summary.inventory_transactions || 0],
    ['Audit Logs', summary.audit_logs || 0]
  ];
  el.innerHTML = rows.map(([k, v]) => `<span style="display:inline-block;margin-right:10px;margin-bottom:6px;padding:4px 8px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover)"><strong>${escHtml(String(k))}:</strong> ${escHtml(String(v))}</span>`).join('');
}

async function refreshResetSummary() {
  const includeAudit = !!document.getElementById('resetIncludeAudit')?.checked;
  try {
    const res = await apiFetch('/api/system-reset/precheck', {
      method: 'POST',
      body: JSON.stringify({ scope: 'full_transactional', includeAuditLogs: includeAudit })
    });
    renderResetSummary(res.summary || null);
  } catch (e) {
    const el = document.getElementById('resetSummary');
    if (el) el.textContent = e.message || 'Unable to load summary';
  }
}

function renderResetProgress(job) {
  const wrap = document.getElementById('resetProgressWrap');
  const bar = document.getElementById('resetProgressBar');
  const txt = document.getElementById('resetProgressText');
  const links = document.getElementById('resetBackupLinks');
  if (!wrap || !bar || !txt || !links) return;
  if (!job) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  const progress = Math.max(0, Math.min(100, parseInt(job.progress || 0, 10) || 0));
  bar.style.width = `${progress}%`;
  txt.textContent = `${progress}% - ${job.phase || 'running'} - ${job.message || ''}`;
  if (job.backup && job.backup.files) {
    links.innerHTML = `Backup: <a href="${escHtml(job.backup.files.sqlite || '#')}" target="_blank" rel="noopener">Download SQLite</a> - <a href="${escHtml(job.backup.files.json || '#')}" target="_blank" rel="noopener">Download JSON</a>`;
  } else {
    links.textContent = '';
  }
}

async function loadSystemResetPanel() {
  if (!can('setup.edit')) return;
  try {
    await refreshResetSummary();
    const st = await apiFetch('/api/system-reset/status');
    if (st && st.in_progress && st.active_job_id) {
      pollSystemResetJob(st.active_job_id);
    } else {
      renderResetProgress(null);
      if (_resetJobPollTimer) {
        clearInterval(_resetJobPollTimer);
        _resetJobPollTimer = null;
      }
    }
  } catch (_) {
    // Hide silently if endpoint not available for current role.
  }
}

async function pollSystemResetJob(jobId) {
  if (!jobId) return;
  const run = async () => {
    try {
      const job = await apiFetch(`/api/system-reset/jobs/${encodeURIComponent(jobId)}`);
      renderResetProgress(job);
      const btn = document.getElementById('startResetBtn');
      if (btn) btn.disabled = !!(job && ['queued', 'running'].includes(String(job.status || '')));
      if (job && ['completed', 'failed', 'cancelled'].includes(String(job.status || ''))) {
        if (_resetJobPollTimer) {
          clearInterval(_resetJobPollTimer);
          _resetJobPollTimer = null;
        }
        if (String(job.status) === 'completed') toast('System reset completed successfully.', 'success');
        if (String(job.status) === 'failed') toast(job.error || 'System reset failed.', 'error');
        refreshResetSummary();
      }
    } catch (e) {
      if (_resetJobPollTimer) {
        clearInterval(_resetJobPollTimer);
        _resetJobPollTimer = null;
      }
      toast(e.message || 'Unable to fetch reset progress', 'error');
    }
  };
  await run();
  if (_resetJobPollTimer) clearInterval(_resetJobPollTimer);
  _resetJobPollTimer = setInterval(run, 1200);
}

async function startSystemResetJob() {
  const confirmText = String(document.getElementById('resetConfirmText')?.value || '').trim();
  const password = String(document.getElementById('resetPassword')?.value || '');
  const includeAudit = !!document.getElementById('resetIncludeAudit')?.checked;
  if (confirmText !== 'RESET') {
    toast('Type RESET exactly to confirm.', 'error');
    return;
  }
  if (!password) {
    toast('Password is required.', 'error');
    return;
  }
  if (!await confirmDialog('This will permanently delete all patient and transaction data. Continue?', 'Confirm System Reset')) return;

  const btn = document.getElementById('startResetBtn');
  const oldText = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `${IC.clock} Starting...`;
    }
    const res = await apiFetch('/api/system-reset/start', {
      method: 'POST',
      body: JSON.stringify({
        scope: 'full_transactional',
        includeAuditLogs: includeAudit,
        confirmText: 'RESET',
        password
      })
    });
    const jobId = res && res.job_id;
    if (!jobId) throw new Error('Reset job id missing from response');
    toast('Reset job started. System is now locked during cleanup.', 'info');
    pollSystemResetJob(jobId);
  } catch (e) {
    toast(e.message || 'Unable to start system reset', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldText || `${IC.x} Start One-Click Tenant Reset`;
    }
  }
}

async function loadOwnerBackupStatus() {
  const state = document.getElementById('ownerBackupState');
  if (!state) return;
  try {
    const rows = await apiFetch('/api/admin/db-backups');
    const list = Array.isArray(rows) ? rows : [];
    _ownerBackupsCache = list;
    if (!list.length) {
      state.textContent = 'No backups yet. Click Create DB Backup to make your first snapshot.';
      renderRestoreBackupOptions([]);
      return;
    }
    const latest = list[0];
    const when = latest && latest.created_at ? formatDateTime(latest.created_at) : 'Unknown time';
    const bid = latest && latest.backup_id ? latest.backup_id : 'Unknown';
    state.innerHTML = `Latest backup: <strong>${escHtml(bid)}</strong> - ${escHtml(when)} - <a href="${escHtml((latest.files && latest.files.sqlite) || '#')}" target="_blank" rel="noopener">Download SQLite</a> - <a href="${escHtml((latest.files && latest.files.json) || '#')}" target="_blank" rel="noopener">Download JSON</a>`;
    renderRestoreBackupOptions(list);
  } catch (e) {
    state.textContent = 'Backup status unavailable. If you just updated server code, restart server once.';
    renderRestoreBackupOptions([]);
  }
}

function renderRestoreBackupOptions(backups) {
  const sel = document.getElementById('restoreBackupSelect');
  const latestBtn = document.getElementById('restoreLatestBtn');
  const selectedBtn = document.getElementById('restoreSelectedBtn');
  if (!sel) return;
  if (!Array.isArray(backups) || !backups.length) {
    sel.innerHTML = '<option value="">No backups available</option>';
    sel.disabled = true;
    if (latestBtn) latestBtn.disabled = true;
    if (selectedBtn) selectedBtn.disabled = true;
    return;
  }
  sel.disabled = false;
  if (latestBtn) latestBtn.disabled = false;
  if (selectedBtn) selectedBtn.disabled = false;
  sel.innerHTML = backups.map((b, i) => `<option value="${escHtml(String(b.backup_id || ''))}" ${i === 0 ? 'selected' : ''}>${escHtml(String(b.backup_id || ''))} ${b.created_at ? `(${escHtml(formatDateTime(b.created_at))})` : ''}</option>`).join('');
}

function renderRestoreProgress(job) {
  const wrap = document.getElementById('restoreProgressWrap');
  const bar = document.getElementById('restoreProgressBar');
  const txt = document.getElementById('restoreProgressText');
  const safety = document.getElementById('restoreBackupSafety');
  if (!wrap || !bar || !txt || !safety) return;
  if (!job) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  const progress = Math.max(0, Math.min(100, parseInt(job.progress || 0, 10) || 0));
  bar.style.width = `${progress}%`;
  txt.textContent = `${progress}% - ${job.phase || 'running'} - ${job.message || ''}`;
  if (job.safety_backup) {
    safety.innerHTML = `Safety backup: <strong>${escHtml(String(job.safety_backup.backup_id || 'created'))}</strong> ${job.safety_backup.files ? `- <a href="${escHtml(job.safety_backup.files.sqlite || '#')}" target="_blank" rel="noopener">SQLite</a> - <a href="${escHtml(job.safety_backup.files.json || '#')}" target="_blank" rel="noopener">JSON</a>` : ''}`;
  } else {
    safety.textContent = '';
  }
}

async function pollSystemRestoreJob(jobId) {
  if (!jobId) return;
  const run = async () => {
    try {
      const job = await apiFetch(`/api/system-restore/jobs/${encodeURIComponent(jobId)}`);
      renderRestoreProgress(job);
      const latestBtn = document.getElementById('restoreLatestBtn');
      const selectedBtn = document.getElementById('restoreSelectedBtn');
      const busy = !!(job && ['queued', 'running'].includes(String(job.status || '')));
      if (latestBtn) latestBtn.disabled = busy;
      if (selectedBtn) selectedBtn.disabled = busy;
      if (job && ['completed', 'failed', 'cancelled'].includes(String(job.status || ''))) {
        if (_restoreJobPollTimer) {
          clearInterval(_restoreJobPollTimer);
          _restoreJobPollTimer = null;
        }
        if (String(job.status) === 'completed') {
          toast('Database restore completed successfully.', 'success');
          try {
            currentUser = await apiFetch('/api/me');
            currentSystem = currentUser?.system || null;
            applyClinicBranding();
            startApp();
          } catch (_) {
            currentUser = null;
            _resetAppState();
            const dock = document.getElementById('quickDock');
            if (dock) dock.classList.add('hidden');
            document.getElementById('mainApp').classList.add('hidden');
            document.getElementById('loginPage').classList.remove('hidden');
            toast('Restore completed. Please sign in again.', 'info');
          }
        }
        if (String(job.status) === 'failed') toast(job.error || 'Database restore failed.', 'error');
        loadOwnerBackupStatus();
      }
    } catch (e) {
      if (_restoreJobPollTimer) {
        clearInterval(_restoreJobPollTimer);
        _restoreJobPollTimer = null;
      }
      toast(e.message || 'Unable to fetch restore progress', 'error');
    }
  };
  await run();
  if (_restoreJobPollTimer) clearInterval(_restoreJobPollTimer);
  _restoreJobPollTimer = setInterval(run, 1200);
}

async function loadSystemRestorePanel() {
  if (!can('setup.edit')) return;
  try {
    const st = await apiFetch('/api/system-restore/status');
    if (st && st.in_progress && st.active_job_id) {
      pollSystemRestoreJob(st.active_job_id);
    } else {
      renderRestoreProgress(null);
      if (_restoreJobPollTimer) {
        clearInterval(_restoreJobPollTimer);
        _restoreJobPollTimer = null;
      }
    }
  } catch (_) {
    // Hide silently if endpoint is unavailable.
  }
}

async function startDbRestoreSelected() {
  const sel = document.getElementById('restoreBackupSelect');
  const backupId = String(sel?.value || '').trim();
  if (!backupId) {
    toast('Please select a backup to restore.', 'error');
    return;
  }
  if (!await confirmDialog(`Restore database from backup ${backupId}? This replaces current data.`, 'Confirm Restore')) return;
  try {
    const res = await apiFetch('/api/system-restore/start', {
      method: 'POST',
      body: JSON.stringify({ backup_id: backupId })
    });
    if (res && res.job_id) {
      toast('Restore started. Please wait for completion.', 'info');
      pollSystemRestoreJob(res.job_id);
    }
  } catch (e) {
    toast(e.message || 'Restore failed to start', 'error');
  }
}

async function startDbRestoreLatest() {
  const latest = Array.isArray(_ownerBackupsCache) && _ownerBackupsCache.length ? _ownerBackupsCache[0] : null;
  if (!latest || !latest.backup_id) {
    toast('No backups available to restore.', 'error');
    return;
  }
  const sel = document.getElementById('restoreBackupSelect');
  if (sel) sel.value = String(latest.backup_id);
  await startDbRestoreSelected();
}

async function triggerDbBackup() {
  if (!currentUser || currentUser.role !== 'admin') {
    toast('Only admin can create backups.', 'error');
    return;
  }
  const btn = document.getElementById('ownerBackupBtn');
  const state = document.getElementById('ownerBackupState');
  const prevLabel = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `${IC.clock || ''} Creating Backup...`;
    }
    const res = await apiFetch('/api/admin/db-backup', { method: 'POST' });
    const backup = res && res.backup ? res.backup : null;
    const bid = backup && backup.backup_id ? backup.backup_id : 'created';
    toast(`Backup created: ${bid}`, 'success');
    if (state && backup) {
      state.innerHTML = `Latest backup: <strong>${escHtml(backup.backup_id || '')}</strong> - ${escHtml(formatDateTime(backup.created_at || ''))} - <a href="${escHtml((backup.files && backup.files.sqlite) || '#')}" target="_blank" rel="noopener">Download SQLite</a> - <a href="${escHtml((backup.files && backup.files.json) || '#')}" target="_blank" rel="noopener">Download JSON</a>`;
    } else {
      loadOwnerBackupStatus();
    }
  } catch (e) {
    toast(e.message || 'Backup failed', 'error');
    if (state) state.textContent = 'Backup failed. Check server logs or restart server if endpoint is not active yet.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prevLabel || `${IC.download || IC.reports} Create DB Backup`;
    }
  }
}

async function triggerSystemUpdate() {
  if (!currentUser || currentUser.role !== 'admin') {
    toast('Only admin can run system update.', 'error');
    return;
  }

  // Show settings dialog so admin can configure repo/token even if server defaults are wrong
  const dlgId = 'sysUpdateDlg_' + Date.now();
  const html = `
    <div id="${dlgId}" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center">
      <div style="background:var(--bg-card);border-radius:14px;padding:28px 28px 20px;width:420px;max-width:95vw;box-shadow:0 8px 40px rgba(0,0,0,.35)">
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:16px">System Update Settings</div>
        <div class="form-group" style="margin-bottom:12px">
          <label style="font-size:.85rem;font-weight:600">GitHub Owner</label>
          <input id="su_owner" class="form-control" value="mayurmadhwani2011-blip" placeholder="e.g. mayurmadhwani2011-blip" style="width:100%" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label style="font-size:.85rem;font-weight:600">Repository Name</label>
          <input id="su_repo" class="form-control" value="CMS" placeholder="e.g. CMS" style="width:100%" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label style="font-size:.85rem;font-weight:600">Branch</label>
          <input id="su_branch" class="form-control" value="main" placeholder="main" style="width:100%" />
        </div>
        <div class="form-group" style="margin-bottom:16px">
          <label style="font-size:.85rem;font-weight:600">GitHub Token <span class="text-muted" style="font-weight:400">(required for private repos)</span></label>
          <input id="su_token" class="form-control" type="password" placeholder="ghp_xxxxxxxxxxxx (leave blank if public)" style="width:100%" />
        </div>
        <div class="text-muted" style="font-size:.8rem;margin-bottom:16px">A safety backup of your data will be created before updating. The service will restart automatically after the update.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn" onclick="document.getElementById('${dlgId}').remove()">Cancel</button>
          <button class="btn btn-warning" id="su_runBtn" onclick="runSystemUpdateNow('${dlgId}')">Run Update</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function runSystemUpdateNow(dlgId) {
  const dlg = document.getElementById(dlgId);
  const owner = (document.getElementById('su_owner').value || '').trim();
  const repo = (document.getElementById('su_repo').value || '').trim();
  const branch = (document.getElementById('su_branch').value || 'main').trim();
  const token = (document.getElementById('su_token').value || '').trim();

  if (!owner || !repo) { toast('Owner and Repo are required.', 'error'); return; }

  if (dlg) dlg.remove();

  const btn = document.getElementById('ownerSystemUpdateBtn');
  const state = document.getElementById('ownerSystemUpdateState');
  const prevLabel = btn ? btn.innerHTML : '';
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = `${IC.clock || ''} Updating...`; }
    if (state) state.textContent = `Downloading update from ${owner}/${repo}@${branch}... this can take a few minutes.`;

    const res = await apiFetch('/api/admin/system-update', {
      method: 'POST',
      body: JSON.stringify({ remote: 'origin', branch, github_owner: owner, github_repo: repo, github_token: token }),
      timeoutMs: 300000
    });

    const backupId = res && res.backup && res.backup.backup_id ? res.backup.backup_id : 'created';
    const from = res && res.before_commit ? res.before_commit : '-';
    const to = res && res.after_commit ? res.after_commit : '-';
    const changed = !!(res && res.updated);
    const restartNote = (res && res.restart_required) ? ' Service restarting - refresh in 20 seconds.' : '';
    if (state) {
      state.innerHTML = changed
        ? `Update applied: <strong>${escHtml(from)}</strong> &rarr; <strong>${escHtml(to)}</strong> - Backup: <strong>${escHtml(backupId)}</strong>${escHtml(restartNote)}`
        : `Already up to date (${escHtml(from)}). No code changes were found in ${escHtml(owner)}/${escHtml(repo)}@${escHtml(branch)}.`;
    }
    toast(changed ? 'Update applied! Service restarting...' : `Already up to date in ${repo}@${branch}.`, changed ? 'success' : 'info');
  } catch (e) {
    const msg = e && e.message ? e.message : 'System update failed';
    if (state) state.textContent = msg;
    toast(msg, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = prevLabel || `${IC.clock || ''} System Update`; }
  }
}

async function saveOwnerControl() {
  const clinicForm = document.getElementById('ownerClinicForm');
  const subForm = document.getElementById('ownerSubscriptionForm');
  if (!clinicForm || !subForm) return;
  if (_ownerLogoReadPromise) {
    try {
      const logoData = await _ownerLogoReadPromise;
      if (logoData && _ownerLogoDataUrl) {
        _ownerLogoDataUrl = logoData;
      }
    } catch (_) {
      toast('Failed to read logo image. Please select it again.', 'error');
      _ownerLogoDataUrl = null;
      _ownerLogoReadPromise = null;
      return;
    }
    _ownerLogoReadPromise = null;
  }
  const payload = {
    clinic_name: clinicForm.clinic_name.value.trim(),
    trade_name: clinicForm.trade_name.value.trim(),
    phone: clinicForm.phone.value.trim(),
    email: clinicForm.email.value.trim(),
    tax_number: clinicForm.tax_number.value.trim(),
    max_users: parseInt(clinicForm.max_users.value || '25', 10),
    no_show_booking_limit: parseInt(clinicForm.no_show_booking_limit.value || '5', 10),
    address: clinicForm.address.value.trim(),
    logo_url: _ownerLogoDataUrl || clinicForm.logo_url.value.trim(),
    receipt_header: clinicForm.receipt_header.value.trim(),
    receipt_footer: clinicForm.receipt_footer.value.trim(),
    plan: subForm.plan.value,
    status: subForm.status.value,
    trial_start: subForm.trial_start.value,
    trial_end: subForm.trial_end.value,
    subscription_start: subForm.subscription_start.value,
    subscription_end: subForm.subscription_end.value,
    grace_days: parseInt(subForm.grace_days.value || '0', 10),
    notes: subForm.notes.value.trim()
  };
  if (!payload.clinic_name) {
    toast('Clinic name is required.', 'error');
    return;
  }
  try {
    const next = await apiFetch('/api/setup/profile', { method:'PUT', body: JSON.stringify(payload) });
    currentSystem = next;
    applyClinicBranding();
    toast('Owner settings saved.', 'success');
    _ownerLogoDataUrl = null;
    loadOwnerControl();
  } catch (e) {
    toast(e.message, 'error');
  }
}

let _ownerLogoReadPromise = null;
let _ownerLogoDataUrl = null;

function onOwnerLogoSelected(event) {
  const file = event && event.target && event.target.files ? event.target.files[0] : null;
  if (!file) return;
  if (!String(file.type || '').startsWith('image/')) {
    toast('Please select an image file.', 'error');
    event.target.value = '';
    _ownerLogoReadPromise = null;
    return;
  }
  const maxBytes = 1024 * 1024;
  if (file.size > maxBytes) {
    toast('Logo must be 1 MB or smaller.', 'error');
    event.target.value = '';
    _ownerLogoReadPromise = null;
    return;
  }
  const reader = new FileReader();
  _ownerLogoReadPromise = new Promise((resolve, reject) => {
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      _ownerLogoDataUrl = dataUrl;
      const hidden = document.getElementById('ownerLogoData');
      const preview = document.getElementById('ownerLogoPreview');
      if (hidden) hidden.value = dataUrl;
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = '';
      }
      resolve(dataUrl);
    };
    reader.onerror = () => {
      toast('Failed to read image file.', 'error');
      reject(new Error('logo_read_failed'));
    };
  });
  reader.readAsDataURL(file);
}

function clearOwnerLogo() {
  const hidden = document.getElementById('ownerLogoData');
  const picker = document.getElementById('ownerLogoFile');
  const preview = document.getElementById('ownerLogoPreview');
  _ownerLogoReadPromise = null;
  _ownerLogoDataUrl = null;
  if (hidden) hidden.value = '';
  if (picker) picker.value = '';
  if (preview) {
    preview.removeAttribute('src');
    preview.style.display = 'none';
  }
}

async function completeOwnerSetup() {
  try {
    const next = await apiFetch('/api/setup/complete', { method:'POST' });
    currentSystem = next;
    applyClinicBranding();
    toast('Setup marked as complete.', 'success');
    loadOwnerControl();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function updatePrinterTypeFields() {
  const form = document.getElementById('setupPrinterForm');
  const type = form ? form.printer_type.value : '';
  const ipField = document.getElementById('networkIPField');
  const portField = document.getElementById('networkPortField');
  if (ipField) ipField.style.display = type === 'network' ? 'block' : 'none';
  if (portField) portField.style.display = type === 'network' ? 'block' : 'none';
}

function updatePrinterNameInput() {
  const select = document.getElementById('printerNameSelect');
  const input = document.getElementById('printerNameManual');
  if (select && input && select.value) {
    input.value = select.value;
  }
}

function updatePrinterNameFromInput() {
  const input = document.getElementById('printerNameManual');
  const select = document.getElementById('printerNameSelect');
  if (input && select && input.value) {
    select.value = '';
  }
}

async function refreshAvailablePrinters(preferredName = '') {
  try {
    const status = document.getElementById('printerStatus');
    if (status) status.textContent = 'Fetching available printers...';
    const printers = await apiFetch('/api/printers/list');
    const select = document.getElementById('printerNameSelect');
    const manual = document.getElementById('printerNameManual');
    const desiredName = String(preferredName || (manual && manual.value) || (select && select.value) || '').trim();
    if (select) {
      select.innerHTML = '<option value="">Select available printer...</option>';
      if (printers && Array.isArray(printers) && printers.length > 0) {
        printers.forEach(p => {
          const name = (p && (p.name || p.displayName)) ? String(p.name || p.displayName).trim() : String(p || '').trim();
          if (!name) return;
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = (p && p.displayName) ? p.displayName : name;
          select.appendChild(opt);
        });
        if (desiredName && !Array.from(select.options).some(o => o.value === desiredName)) {
          const savedOpt = document.createElement('option');
          savedOpt.value = desiredName;
          savedOpt.textContent = `${desiredName} (saved)`;
          select.appendChild(savedOpt);
        }
        if (desiredName) select.value = desiredName;
        if (manual && desiredName) manual.value = desiredName;
        if (status) status.textContent = `? Found ${printers.length} printer(s). Select one above.`;
      } else {
        if (status) status.textContent = `? No printers found. Check your system printer settings or enter printer name manually below.`;
        if (desiredName) {
          const savedOpt = document.createElement('option');
          savedOpt.value = desiredName;
          savedOpt.textContent = `${desiredName} (saved)`;
          select.appendChild(savedOpt);
          select.value = desiredName;
        }
      }
    }
  } catch (e) {
    const status = document.getElementById('printerStatus');
    if (status) {
      status.textContent = `? Error fetching printers: ${e.message}. Check browser console for details.`;
    }
    console.error('Printer fetch error:', e);
    toast(`Failed to list printers: ${e.message}`, 'error');
  }
}

async function savePrinterConfig() {
  const form = document.getElementById('setupPrinterForm');
  if (!form) return;
  const type = form.printer_type.value;
  const select = document.getElementById('printerNameSelect');
  const manual = document.getElementById('printerNameManual');
  
  // Get printer name from either dropdown or manual input
  let name = (select && select.value) || (manual && manual.value) || '';
  name = name.trim();

  // Validate only when a printer type is selected
  if (type && !name) {
    toast('Please select or enter a printer name.', 'error');
    return;
  }
  if (!type && name) {
    toast('Please select a printer type.', 'error');
    return;
  }
  
  try {
    const payload = {
      printer_type: type,
      printer_name: name,
      printer_ip: type === 'network' ? (form.printer_ip.value.trim() || null) : null,
      printer_port: type === 'network' ? (parseInt(form.printer_port.value || 9100, 10) || 9100) : null,
      print_mode: form.print_mode ? (form.print_mode.value || 'auto') : 'auto',
      terminal_id: getTerminalId()
    };
    
    const result = await apiFetch('/api/setup/printer', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    
    currentSystem = result;
    toast('Printer configuration saved.', 'success');
    const status = document.getElementById('printerStatus');
    if (status) status.textContent = name ? `? Configured: ${name} (${type})` : '';
    if (currentPageId === 'setup') {
      loadSetupPrinterConfig();
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function testPrinterConnection() {
  const form = document.getElementById('setupPrinterForm');
  const select = document.getElementById('printerNameSelect');
  const manual = document.getElementById('printerNameManual');
  
  // Get printer name from either dropdown or manual input
  let name = (select && select.value) || (manual && manual.value) || '';
  name = name.trim();
  
  if (!name) {
    toast('Please select or enter a printer name first.', 'error');
    return;
  }
  
  try {
    const status = document.getElementById('printerStatus');
    if (status) status.textContent = 'Testing printer connection...';
    
    await apiFetch('/api/printers/test', {
      method: 'POST',
      body: JSON.stringify({
        printer_name: name,
        printer_type: form ? form.printer_type.value : '',
        printer_ip: form ? String(form.printer_ip.value || '').trim() : '',
        printer_port: form ? (parseInt(form.printer_port.value || 9100, 10) || 9100) : 9100,
        terminal_id: getTerminalId()
      })
    });
    
    toast('Printer test sent successfully!', 'success');
    if (status) status.textContent = '? Test print sent (check your printer)';
  } catch (e) {
    toast(`Printer test failed: ${e.message}`, 'error');
    if (document.getElementById('printerStatus')) {
      document.getElementById('printerStatus').textContent = `? Test failed: ${e.message}`;
    }
  }
}

async function loadDoctorSchedulesTable() {
  const wrap = document.getElementById('dsWrap');
  if (!wrap) return;
  try {
    const doctors = await apiFetch('/api/doctors');
    if (!doctors.length) {
      wrap.innerHTML = emptyState(IC.scheduler, 'No Doctors', 'Add active doctors first to configure schedules.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Doctor</th><th>Working Hours</th><th>Weekly Off</th><th>Breaks</th>${can('setup.edit') ? '<th>Action</th>' : ''}</tr></thead>
      <tbody>${doctors.map((d, i) => {
        const sch = d.schedule || schedDefaultSchedule(d.id);
        const off = (sch.weekly_off_days || []).map(x => SCHED_DAY_NAMES[x].slice(0,3)).join(', ') || 'None';
        const br = (sch.breaks || []).map(b => `${b.start}-${b.end}`).join(', ') || 'None';
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${escHtml(doctorDisplayName(d))}</strong></td>
          <td>${escHtml(sch.work_start || '09:00')} - ${escHtml(sch.work_end || '17:00')}</td>
          <td>${escHtml(off)}</td>
          <td>${escHtml(br)}</td>
          ${can('setup.edit') ? `<td><button class="btn btn-sm" onclick="openDoctorScheduleModal(${d.id})">${IC.setup} Configure</button></td>` : ''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

async function loadPaymentMethods() {
  const wrap = document.getElementById('pmWrap');
  if (!wrap) return;
  try {
    const list = await apiFetch('/api/payment-methods');
    if (!list.length) {
      wrap.innerHTML = emptyState(IC.billing, 'No Payment Methods', 'Add your first payment method above.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Status</th>${can('setup.edit') ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map((m, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(m.name)}</strong></td>
        <td>${m.active
          ? '<span class="badge badge-paid">Active</span>'
          : '<span class="badge badge-cancelled">Inactive</span>'}</td>
        ${can('setup.edit') ? `<td class="td-actions">
          <button class="btn btn-sm" onclick="togglePaymentMethod(${m.id},${!m.active})">${m.active ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-danger btn-sm" onclick="deletePaymentMethod(${m.id},'${escHtml(m.name)}')">${IC.trash}</button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function openAddPaymentMethodModal() {
  showModal('Add Payment Method', `
    <label class="form-label">Method Name</label>
    <input id="pmName" class="form-control" placeholder="e.g. Cash, Card, UPI-" />
  `, async () => {
    const name = document.getElementById('pmName').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    await apiFetch('/api/payment-methods', { method:'POST', body: JSON.stringify({ name }) });
    toast('Payment method added', 'success');
    closeModal();
    loadPaymentMethods();
  });
}

async function togglePaymentMethod(id, active) {
  try {
    await apiFetch(`/api/payment-methods/${id}`, { method:'PUT', body: JSON.stringify({ active }) });
    toast(`Payment method ${active ? 'activated' : 'deactivated'}`, 'success');
    loadPaymentMethods();
  } catch(e) { toast(e.message, 'error'); }
}

async function deletePaymentMethod(id, name) {
  if (!await confirmDialog(`Delete payment method "${name}"?`)) return;
  try {
    await apiFetch(`/api/payment-methods/${id}`, { method:'DELETE' });
    toast('Payment method deleted', 'success');
    loadPaymentMethods();
  } catch(e) { toast(e.message, 'error'); }
}

// --- Expense Categories (Setup) --------------------------
async function loadExpenseCategoriesTable() {
  const wrap = document.getElementById('ecWrap');
  if (!wrap) return;
  try {
    const list = await apiFetch('/api/expense-categories');
    _expenseMeta.categories = list.map(c => c.name);
    if (!list.length) {
      wrap.innerHTML = emptyState(IC.expense, 'No Expense Categories', 'Add predefined categories for daily expense entry.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Category Name</th>${can('setup.edit') ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map((c, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(c.name)}</strong></td>
        ${can('setup.edit') ? `<td class="td-actions">
          <button class="btn btn-sm" onclick='openEditExpenseCategoryModal(${c.id}, ${JSON.stringify(String(c.name || ''))})'>${IC.edit}</button>
          <button class="btn btn-danger btn-sm" onclick='deleteExpenseCategory(${c.id}, ${JSON.stringify(String(c.name || ''))})'>${IC.trash}</button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function openAddExpenseCategoryModal() {
  showModal('Add Expense Category', `
    <div class="form-group">
      <label>Category Name <span style="color:var(--c-danger)">*</span></label>
      <input id="ecName" class="form-control" placeholder="e.g. Utilities, Rent, Travel" autofocus/>
    </div>`,
    async () => {
      const name = document.getElementById('ecName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      try {
        await apiFetch('/api/expense-categories', { method:'POST', body: JSON.stringify({ name }) });
        toast('Expense category added', 'success');
        closeModal();
        loadExpenseCategoriesTable();
        if (currentPageId === 'expenses') loadExpenses();
      } catch (e) { toast(e.message, 'error'); return false; }
    });
}

function openEditExpenseCategoryModal(id, currentName) {
  showModal('Edit Expense Category', `
    <div class="form-group">
      <label>Category Name <span style="color:var(--c-danger)">*</span></label>
      <input id="ecEditName" class="form-control" value="${escHtml(currentName)}" autofocus/>
    </div>`,
    async () => {
      const name = document.getElementById('ecEditName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      try {
        await apiFetch(`/api/expense-categories/${id}`, { method:'PUT', body: JSON.stringify({ name }) });
        toast('Expense category updated', 'success');
        closeModal();
        loadExpenseCategoriesTable();
        if (currentPageId === 'expenses') loadExpenses();
      } catch (e) { toast(e.message, 'error'); return false; }
    });
}

async function deleteExpenseCategory(id, name) {
  if (!await confirmDialog(`Delete expense category "${name}"?`)) return;
  try {
    await apiFetch(`/api/expense-categories/${id}`, { method:'DELETE' });
    toast('Expense category deleted', 'success');
    loadExpenseCategoriesTable();
    if (currentPageId === 'expenses') loadExpenses();
  } catch (e) { toast(e.message, 'error'); }
}

// --- Service Categories (Setup) --------------------------
async function loadServiceCategoriesTable() {
  const wrap = document.getElementById('scWrap');
  if (!wrap) return;
  try {
    const list = await apiFetch('/api/service-categories');
    SERVICE_CATEGORIES = list.length ? list.map(c => c.name) : SERVICE_CATEGORIES;
    if (!list.length) {
      wrap.innerHTML = emptyState(IC.services, 'No Categories', 'Add your first service category.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Category Name</th>${can('setup.edit') ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map((c, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(c.name)}</strong></td>
        ${can('setup.edit') ? `<td class="td-actions">
          <button class="btn btn-sm" onclick="openEditServiceCategoryModal(${c.id},'${escHtml(c.name)}')">${IC.edit}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteServiceCategory(${c.id},'${escHtml(c.name)}')">${IC.trash}</button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function openAddServiceCategoryModal() {
  showModal('Add Service Category', `
    <div class="form-group">
      <label>Category Name <span style="color:var(--c-danger)">*</span></label>
      <input id="scName" class="form-control" placeholder="e.g. Radiology, Surgery-" autofocus/>
    </div>`,
    async () => {
      const name = document.getElementById('scName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      try {
        await apiFetch('/api/service-categories', { method:'POST', body: JSON.stringify({ name }) });
        toast('Category added', 'success');
        closeModal();
        loadServiceCategoriesTable();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

function openEditServiceCategoryModal(id, currentName) {
  showModal('Edit Service Category', `
    <div class="form-group">
      <label>Category Name <span style="color:var(--c-danger)">*</span></label>
      <input id="scEditName" class="form-control" value="${escHtml(currentName)}" autofocus/>
    </div>`,
    async () => {
      const name = document.getElementById('scEditName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      try {
        await apiFetch(`/api/service-categories/${id}`, { method:'PUT', body: JSON.stringify({ name }) });
        toast('Category updated', 'success');
        closeModal();
        loadServiceCategoriesTable();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

async function deleteServiceCategory(id, name) {
  if (!await confirmDialog(`Delete category "${name}"?\n\nExisting services using this category will keep their current value.`)) return;
  try {
    await apiFetch(`/api/service-categories/${id}`, { method:'DELETE' });
    toast('Category deleted', 'success');
    loadServiceCategoriesTable();
  } catch(e) { toast(e.message, 'error'); }
}

// --- Doctor Departments (Setup) --------------------------
async function loadDoctorDepartmentsTable() {
  const wrap = document.getElementById('ddWrap');
  if (!wrap) return;
  try {
    const [deps, usersList] = await Promise.all([
      apiFetch('/api/doctor-departments'),
      apiFetch('/api/users')
    ]);
    if (!deps.length) {
      wrap.innerHTML = emptyState(IC.users, 'No Departments', 'Add doctor departments like Operation, Laser, etc.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Department</th><th>Doctors</th><th>Status</th>${can('setup.edit') ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${deps.map((d, i) => {
        const doctorCount = (usersList || []).filter(u => u.role === 'doctor' && parseInt(u.department_id) === d.id).length;
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${escHtml(d.name)}</strong></td>
          <td>${doctorCount}</td>
          <td>${d.active ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
          ${can('setup.edit') ? `<td class="td-actions">
            <button class="btn btn-sm" onclick="openEditDoctorDepartmentModal(${d.id})">${IC.edit}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteDoctorDepartment(${d.id},'${escHtml(d.name)}')">${IC.trash}</button>
          </td>` : ''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function openAddDoctorDepartmentModal() {
  showModal('Add Doctor Department', `
    <div class="form-group">
      <label>Department Name <span style="color:var(--c-danger)">*</span></label>
      <input id="ddName" class="form-control" placeholder="e.g. Operation, Laser..." autofocus/>
    </div>`,
    async () => {
      const name = document.getElementById('ddName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      try {
        await apiFetch('/api/doctor-departments', { method:'POST', body: JSON.stringify({ name }) });
        toast('Department added', 'success');
        closeModal();
        loadDoctorDepartmentsTable();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

async function openEditDoctorDepartmentModal(id) {
  try {
    const deps = await apiFetch('/api/doctor-departments');
    const d = (deps || []).find(x => x.id === id);
    if (!d) { toast('Department not found', 'error'); return; }
    showModal('Edit Doctor Department', `
      <form id="editDDForm">
        <div class="form-group"><label>Name</label><input name="name" value="${escHtml(d.name)}" required/></div>
        <div class="form-group"><label>Status</label>
          <select name="active">
            <option value="true" ${d.active ? 'selected' : ''}>Active</option>
            <option value="false" ${!d.active ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </form>`,
      async () => {
        const body = Object.fromEntries(new FormData(document.getElementById('editDDForm')));
        body.active = body.active === 'true';
        try {
          await apiFetch(`/api/doctor-departments/${id}`, { method:'PUT', body: JSON.stringify(body) });
          toast('Department updated', 'success');
          closeModal();
          loadDoctorDepartmentsTable();
        } catch(e) { toast(e.message, 'error'); return false; }
      });
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteDoctorDepartment(id, name) {
  if (!await confirmDialog(`Delete department "${name}"?`)) return;
  try {
    await apiFetch(`/api/doctor-departments/${id}`, { method:'DELETE' });
    toast('Department deleted', 'success');
    loadDoctorDepartmentsTable();
  } catch(e) { toast(e.message, 'error'); }
}

// --- UOM Master (Setup) --------------------------------
let _allUoms = [];

async function loadUomsTable() {
  const wrap = document.getElementById('uomWrap');
  if (!wrap) return;
  try {
    const list = await apiFetch('/api/uoms');
    _allUoms = list;
    if (!list.length) {
      wrap.innerHTML = emptyState(IC.product || IC.empty, 'No UOM', 'Add your first unit of measure.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Symbol</th><th>Factor</th><th>Status</th>${can('setup.edit') ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map((u, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(u.name)}</strong></td>
        <td><span class="badge badge-scheduled">${escHtml(u.symbol)}</span></td>
        <td>${parseFloat(u.factor || 1).toFixed(3)}</td>
        <td>${u.active ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
        ${can('setup.edit') ? `<td class="td-actions">
          <button class="btn btn-sm" onclick="openEditUomModal(${u.id})">${IC.edit}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUom(${u.id},'${escHtml(u.symbol)}')">${IC.trash}</button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function openAddUomModal() {
  showModal('Add UOM', `
    <form id="uomAddForm">
      <div class="form-row">
        <div class="form-group"><label>Name *</label><input name="name" placeholder="e.g. Box" required/></div>
        <div class="form-group"><label>Symbol *</label><input name="symbol" placeholder="e.g. box" required/></div>
      </div>
      <div class="form-group"><label>Unit Factor *</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="factor" type="number" min="0.001" step="0.001" value="1" required/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
      <div class="text-muted text-sm">Factor means: 1 entered qty in this UOM equals factor base units in stock.</div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#uomAddForm'));
      const body = Object.fromEntries(fd.entries());
      try {
        await apiFetch('/api/uoms', { method:'POST', body: JSON.stringify(body) });
        toast('UOM added', 'success');
        closeModal();
        loadUomsTable();
      } catch(e) { toast(e.message, 'error'); }
    }}]);
}

function openEditUomModal(id) {
  const u = _allUoms.find(x => x.id === id);
  if (!u) return;
  showModal('Edit UOM', `
    <form id="uomEditForm">
      <div class="form-row">
        <div class="form-group"><label>Name *</label><input name="name" value="${escHtml(u.name)}" required/></div>
        <div class="form-group"><label>Symbol *</label><input name="symbol" value="${escHtml(u.symbol)}" required/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Unit Factor *</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="factor" type="number" min="0.001" step="0.001" value="${parseFloat(u.factor || 1)}" required/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Status</label><select name="active"><option value="true" ${u.active ? 'selected' : ''}>Active</option><option value="false" ${!u.active ? 'selected' : ''}>Inactive</option></select></div>
      </div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#uomEditForm'));
      const body = Object.fromEntries(fd.entries());
      body.active = body.active === 'true';
      try {
        await apiFetch(`/api/uoms/${id}`, { method:'PUT', body: JSON.stringify(body) });
        toast('UOM updated', 'success');
        closeModal();
        loadUomsTable();
      } catch(e) { toast(e.message, 'error'); }
    }}]);
}

async function deleteUom(id, symbol) {
  if (!await confirmDialog(`Delete UOM "${symbol}"?`)) return;
  try {
    await apiFetch(`/api/uoms/${id}`, { method:'DELETE' });
    toast('UOM deleted', 'success');
    loadUomsTable();
  } catch(e) { toast(e.message, 'error'); }
}

// --- Store Product Categories (Setup) -----------------
let _storeProductCategories = [];

async function loadProductCategoriesTable() {
  const wrap = document.getElementById('spcWrap');
  if (!wrap) return;
  try {
    const list = await apiFetch('/api/store/product-categories');
    _storeProductCategories = list;
    if (!list.length) {
      wrap.innerHTML = emptyState(IC.product || IC.empty, 'No Product Categories', 'Add your first product category.');
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Name</th><th>Status</th>${can('setup.edit') ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>${list.map((c, i) => `<tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(c.name)}</strong></td>
        <td>${c.active ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
        ${can('setup.edit') ? `<td class="td-actions">
          <button class="btn btn-sm" onclick="openEditProductCategoryModal(${c.id})">${IC.edit}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProductCategory(${c.id},'${escHtml(c.name)}')">${IC.trash}</button>
        </td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function openAddProductCategoryModal() {
  showModal('Add Product Category', `
    <div class="form-group">
      <label>Category Name *</label>
      <input id="spcName" class="form-control" placeholder="e.g. Cosmetics" autofocus/>
    </div>`,
    async () => {
      const name = document.getElementById('spcName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      try {
        await apiFetch('/api/store/product-categories', { method:'POST', body: JSON.stringify({ name }) });
        toast('Product category added', 'success');
        closeModal();
        loadProductCategoriesTable();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

function openEditProductCategoryModal(id) {
  const c = _storeProductCategories.find(x => x.id === id);
  if (!c) return;
  showModal('Edit Product Category', `
    <div class="form-group">
      <label>Category Name *</label>
      <input id="spcEditName" class="form-control" value="${escHtml(c.name)}" autofocus/>
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="spcEditActive"><option value="true" ${c.active ? 'selected' : ''}>Active</option><option value="false" ${!c.active ? 'selected' : ''}>Inactive</option></select>
    </div>`,
    async () => {
      const name = document.getElementById('spcEditName')?.value?.trim();
      if (!name) { toast('Name is required', 'error'); return false; }
      const active = document.getElementById('spcEditActive')?.value === 'true';
      try {
        await apiFetch(`/api/store/product-categories/${id}`, { method:'PUT', body: JSON.stringify({ name, active }) });
        toast('Product category updated', 'success');
        closeModal();
        loadProductCategoriesTable();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

async function deleteProductCategory(id, name) {
  if (!await confirmDialog(`Delete product category "${name}"?`)) return;
  try {
    await apiFetch(`/api/store/product-categories/${id}`, { method:'DELETE' });
    toast('Product category deleted', 'success');
    loadProductCategoriesTable();
  } catch(e) { toast(e.message, 'error'); }
}

async function quickAddProductCategory(targetSelectId) {
  if (!can('setup.edit')) {
    toast('You do not have permission to add categories', 'error');
    return;
  }
  const existing = document.getElementById('quickProductCategoryOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay modal-overlay-stack';
  overlay.id = 'quickProductCategoryOverlay';
  overlay.innerHTML = `
    <div class="modal modal-compact">
      <div class="modal-header">
        <h3>Add Product Category</h3>
        <button class="modal-close" onclick="closeQuickProductCategoryModal()" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Category Name *</label>
          <input id="quickProductCategoryName" placeholder="e.g. Cosmetics" autofocus/>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeQuickProductCategoryModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveQuickProductCategory('${targetSelectId}')">${IC.check} Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) e.stopPropagation();
  });
  const input = document.getElementById('quickProductCategoryName');
  if (input) {
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveQuickProductCategory(targetSelectId);
      }
    });
  }
}

function closeQuickProductCategoryModal() {
  const overlay = document.getElementById('quickProductCategoryOverlay');
  if (overlay) overlay.remove();
}

async function saveQuickProductCategory(targetSelectId) {
  const input = document.getElementById('quickProductCategoryName');
  const name = input ? input.value.trim() : '';
  if (!name) {
    toast('Category name is required', 'error');
    return false;
  }
  try {
    const created = await apiFetch('/api/store/product-categories', { method:'POST', body: JSON.stringify({ name }) });
    try {
      _storeProductCategories = await apiFetch('/api/store/product-categories');
    } catch {}
    if (document.getElementById('spcWrap')) await loadProductCategoriesTable();
    const sel = document.getElementById(targetSelectId);
    if (sel) {
      const options = (_storeProductCategories || []).filter(c => c.active !== false)
        .map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');
      sel.innerHTML = `<option value="">- Select Category -</option>${options}`;
      sel.value = created.name;
    }
    closeQuickProductCategoryModal();
    toast('Product category added', 'success');
  } catch(e) {
    toast(e.message, 'error');
    return false;
  }
}

// -----------------------------------------------
//  PATIENT PACKAGES (new tab)
// -----------------------------------------------
let _ppAllSubs = [];
async function patientPackages(renderSeq = _pageRenderSeq) {
  const ca = document.getElementById('contentArea');
  const today = new Date().toLocaleDateString('sv');
  ca.innerHTML = `
    <div class="action-bar">
      <div></div>
      <div class="pp-filter-toggle">${viewToggleHTML('patientPackages')}</div>
    </div>
    <div class="apt-filter-bar">
      <div class="apt-filter-toolbar">
        <div class="apt-filter-fields" style="grid-template-columns:repeat(3,1fr) minmax(140px,170px) minmax(140px,170px) minmax(140px,160px)">
          <input class="apt-filter-field" type="text" id="ppFilterMR" placeholder="Search MR#-" oninput="_applyPPFilter()"/>
          <input class="apt-filter-field" type="text" id="ppFilterPatient" placeholder="Search patient-" oninput="_applyPPFilter()"/>
          <input class="apt-filter-field" type="text" id="ppFilterPackage" placeholder="Search package-" oninput="_applyPPFilter()"/>
          <input class="apt-filter-field" type="date" id="ppFilterFrom" value="${today}" onchange="_applyPPFilter()" title="Purchased from"/>
          <input class="apt-filter-field" type="date" id="ppFilterTo" value="${today}" onchange="_applyPPFilter()" title="Purchased to"/>
          <select class="apt-filter-field" id="ppFilterStatus" onchange="_applyPPFilter()">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div class="apt-filter-actions">
          <button class="btn btn-sm" onclick="_ppClearFilters('${today}')">${IC.x} Clear</button>
        </div>
      </div>
    </div>
    <div id="patPkgSubsWrap">${skeletonTable(5)}</div>`;
  try {
    _ppAllSubs = await apiFetch('/api/patient-packages').catch(() => []);
    if (!isActivePageRender('patient-packages', renderSeq)) return;
    _applyPPFilter();
  } catch(e) { toast(e.message, 'error'); }
}

function _ppClearFilters(today) {
  const f = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  f('ppFilterMR', ''); f('ppFilterPatient', ''); f('ppFilterPackage', '');
  f('ppFilterFrom', today); f('ppFilterTo', today); f('ppFilterStatus', '');
  _applyPPFilter();
}

function _applyPPFilter() {
  const mr      = (document.getElementById('ppFilterMR')?.value || '').toLowerCase();
  const patient = (document.getElementById('ppFilterPatient')?.value || '').toLowerCase();
  const pkg     = (document.getElementById('ppFilterPackage')?.value || '').toLowerCase();
  const from    = document.getElementById('ppFilterFrom')?.value || '';
  const to      = document.getElementById('ppFilterTo')?.value || '';
  const status  = document.getElementById('ppFilterStatus')?.value || '';
  const filtered = _ppAllSubs.filter(s => {
    const purchased = String(s.purchased_at || '').slice(0,10);
    return (
      (!mr      || (s.mr_number || '').toLowerCase().includes(mr)) &&
      (!patient || (s.patient_name || '').toLowerCase().includes(patient)) &&
      (!pkg     || (s.package_name || '').toLowerCase().includes(pkg)) &&
      (!from    || (purchased && purchased >= from)) &&
      (!to      || (purchased && purchased <= to)) &&
      (!status  || s.status === status)
    );
  });
  const wrap = document.getElementById('patPkgSubsWrap');
  if (!wrap) return;
  if (!filtered.length) {
    wrap.innerHTML = emptyState(IC.packages, 'No Results', 'No package subscriptions match your filters.');
    return;
  }
  if (getViewPref('patientPackages') === 'list') {
    wrap.innerHTML = `<div class="table-wrap" data-vpage="patientPackages"><table>
      <thead><tr><th>#</th><th>MR#</th><th>Patient</th><th>Package</th><th>Sessions</th><th>Status</th><th>Purchased</th><th>Actions</th></tr></thead>
      <tbody>${filtered.map((s,i)=>{
        const svcs=s.services||[];
        const totalUsed=svcs.reduce((a,sv)=>a+(sv.used||0),0);
        const totalSess=svcs.reduce((a,sv)=>a+(sv.total||0),0);
        return `<tr>
          <td><span class="billing-index">${i+1}</span></td>
          <td><span class="code-id code-id-primary">${escHtml(s.mr_number||'-')}</span></td>
          <td><strong>${escHtml(s.patient_name||'Patient #'+s.patient_id)}</strong></td>
          <td class="text-sm">${escHtml(s.package_name)}</td>
          <td class="text-sm">${totalUsed}/${totalSess}</td>
          <td>${statusBadge(s.status)}</td>
          <td class="text-muted text-sm">${escHtml(formatDateTime(s.purchased_at||''))}</td>
          <td class="td-actions">
            <button class="btn btn-sm" onclick="viewPatientPackage(${s.id})">${IC.eye} View</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
    return;
  }
  wrap.innerHTML = `<div class="pp-card-grid">${filtered.map(s => {
    const svcs = s.services || [];
    const totalUsed = svcs.reduce((a,sv)=>a+(sv.used||0),0);
    const totalSess = svcs.reduce((a,sv)=>a+(sv.total||0),0);
    const pct = totalSess > 0 ? Math.min(100, Math.round((totalUsed/totalSess)*100)) : 0;
    const isComplete = s.status === 'Completed' || pct >= 100;
    const progressBars = svcs.map(sv => {
      const sp = sv.total > 0 ? Math.min(100, Math.round(((sv.used||0)/sv.total)*100)) : 0;
      return `<div class="pp-svc-row">
        <div class="pp-svc-label">
          <span>${escHtml(sv.service_name)}</span>
          <span class="pp-svc-count">${sv.used||0}/${sv.total}</span>
        </div>
        <div class="pp-progress-track">
          <div class="pp-progress-fill${sp>=100?' pp-progress-done':''}" style="width:${sp}%"></div>
        </div>
      </div>`;
    }).join('');
    return `<div class="pp-card${isComplete ? ' pp-card-done' : ''}">
      <div class="pp-card-header">
        <div class="pp-card-patient">
          <div class="pp-card-mr">${escHtml(s.mr_number || '#' + s.patient_id)}</div>
          <div class="pp-card-name">${escHtml(s.patient_name || 'Patient #' + s.patient_id)}</div>
        </div>
        <div class="pp-card-status">${statusBadge(s.status)}</div>
      </div>
      <div class="pp-card-pkg-name">${IC.packages} ${escHtml(s.package_name)}</div>
      <div class="pp-card-progress-wrap">
        <div class="pp-overall-row">
          <span class="pp-overall-label">Overall: ${totalUsed}/${totalSess} sessions</span>
          <span class="pp-overall-pct">${pct}%</span>
        </div>
        <div class="pp-progress-track pp-progress-track-lg">
          <div class="pp-progress-fill${pct>=100?' pp-progress-done':''}" style="width:${pct}%"></div>
        </div>
      </div>
      ${svcs.length ? `<div class="pp-services-list">${progressBars}</div>` : ''}
      <div class="pp-card-footer">
        <span class="pp-purchased">${IC.calendar} ${escHtml(formatDateTime(s.purchased_at||''))}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="viewPatientPackage(${s.id})">${IC.eye} View</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

async function viewPatientPackage(id) {
  const s = await apiFetch(`/api/patient-packages/${id}`).catch(() => null);
  if (!s) { toast('Package not found', 'error'); return; }
  const svcs = s.services || [];
  const totalUsed = svcs.reduce((a,sv)=>a+(sv.used||0),0);
  const totalSess = svcs.reduce((a,sv)=>a+(sv.total||0),0);
  const pendingRows = svcs.map(sv => {
    const remaining = (sv.total||0) - (sv.used||0);
    const pct = sv.total > 0 ? Math.min(100, Math.round(((sv.used||0)/sv.total)*100)) : 0;
    const isDone = remaining <= 0;
    return `<tr style="${isDone?'opacity:.55':''}">
      <td>${escHtml(sv.service_name)}</td>
      <td style="text-align:center">${sv.total||0}</td>
      <td style="text-align:center">${sv.used||0}</td>
      <td style="text-align:center;font-weight:${remaining>0?'700':'400'};color:${remaining>0?'var(--c-primary)':'var(--text-muted)'}">${remaining}</td>
      <td>
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--c-success)':'var(--c-primary)'};border-radius:4px"></div>
        </div>
      </td>
      <td style="text-align:center">${isDone ? '<span class="badge badge-success">Done</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
    </tr>`;
  }).join('');
  const pending = svcs.filter(sv => (sv.total||0)-(sv.used||0) > 0);
  showModal(
    `${IC.packages} Package Details`,
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border-light)">
        <div><div class="text-muted text-sm">Patient</div><strong style="word-break:break-word">${escHtml(s.patient_name||'#'+s.patient_id)}</strong></div>
        <div><div class="text-muted text-sm">MR#</div><strong>${escHtml(s.mr_number||'-')}</strong></div>
        <div><div class="text-muted text-sm">Package</div><strong style="word-break:break-word">${escHtml(s.package_name)}</strong></div>
        <div style="display:flex;flex-direction:column;gap:4px"><div class="text-muted text-sm">Status</div><div style="display:flex;align-items:center;min-height:22px">${statusBadge(s.status)}</div></div>
        <div><div class="text-muted text-sm">Overall</div><strong>${totalUsed}/${totalSess}</strong></div>
        <div><div class="text-muted text-sm">Pending</div><strong style="color:var(--c-primary)">${pending.length} service${pending.length!==1?'s':''}</strong></div>
      </div>
      <div class="table-wrap" style="overflow-x:auto">
        <table style="width:100%;min-width:460px">
          <thead><tr><th>Service</th><th style="text-align:center;white-space:nowrap">Total</th><th style="text-align:center;white-space:nowrap">Used</th><th style="text-align:center;white-space:nowrap">Remaining</th><th style="min-width:80px">Progress</th><th style="text-align:center">Status</th></tr></thead>
          <tbody>${pendingRows || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:16px">No services found</td></tr>'}</tbody>
        </table>
      </div>`,
    null,
    'modal-lg'
  );
}

function renderPatPkgSubs(subs, isAdmin) {
  const wrap = document.getElementById('patPkgSubsWrap') || document.getElementById('patientMainWrap');
  if (!wrap) return;
  if (!subs || subs.length === 0) {
    wrap.innerHTML = emptyState(IC.packages, 'No Patient Packages', 'No package subscriptions found.');
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Patient</th>
            <th>Package</th>
            <th>Purchased</th>
            <th>Status</th>
            <th>Services</th>
          </tr>
        </thead>
        <tbody>
          ${subs.map((s, idx) => {
            const svcs = (s.services||[]).map(sv=>`<div style="font-size:12px;color:var(--text-muted)">${escHtml(sv.service_name||'')}: ${sv.used||0}/${sv.total||0}</div>`).join('');
            const statusBadge = s.status === 'active'
              ? `<span class="badge badge-success">Active</span>`
              : `<span class="badge badge-secondary">${escHtml(s.status||'')}</span>`;
            return `<tr>
              <td>${idx+1}</td>
              <td>${escHtml(s.patient_name||s.patient_id||'')}</td>
              <td>${escHtml(s.package_name||'')}</td>
              <td>${escHtml(formatDateTime(s.purchased_at||''))}</td>
              <td>${statusBadge}</td>
              <td>${svcs||'-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ===================== ROLE PERMISSIONS =====================
const PERM_GROUPS = [
  { label: 'Dashboard',         perms: ['dashboard.view'] },
  { label: 'Patients',          perms: ['patients.view','patients.create','patients.edit','patients.delete','patients.import','patients.export'] },
  { label: 'Appointments',      perms: ['appointments.view','appointments.create','appointments.edit','appointments.delete'] },
  { label: 'Scheduler',         perms: ['scheduler.view'] },
  { label: 'Patient Packages',  perms: ['patient_packages.view','patient_packages.create','patient_packages.edit','patient_packages.delete'] },
  { label: 'Prescriptions',     perms: ['prescriptions.view','prescriptions.create','prescriptions.delete'] },
  { label: 'Billing',           perms: [
    'billing.view','billing.create','billing.edit','billing.delete','billing.print_history',
    'billing.discount.view','billing.discount.apply','billing.discount.open','billing.discount.override',
    'billing.refund.view','billing.refund.initiate'
  ] },
  { label: 'Expenses',          perms: ['expenses.view','expenses.create','expenses.edit','expenses.delete'] },
  { label: 'Reports',           perms: ['reports.view'] },
  { label: 'Users',             perms: ['users.view','users.create','users.edit','users.delete'] },
  { label: 'Services',          perms: ['services.view','services.create','services.edit','services.delete','services.import','services.export'] },
  { label: 'Packages',          perms: ['packages.view','packages.create','packages.edit','packages.delete'] },
  { label: 'Setup',             perms: ['setup.view','setup.edit'] },
  { label: 'Role Permissions',  perms: ['role_permissions.view','role_permissions.edit'] },
  { label: 'Store',             perms: ['store.view','store.manage','store.purchase','store.transfer','store.adjust','store.consume','store.consume.cost'] },
];

// Roles list is now loaded dynamically from the API
let _allRolesList = [];

function formatPermissionActionLabel(permissionKey) {
  const p = String(permissionKey || '').trim();
  if (!p) return '';

  const explicitLabels = {
    'store.consume.cost': 'Manual Consumption Cost'
  };
  if (explicitLabels[p]) return explicitLabels[p];

  const parts = p.split('.').filter(Boolean);
  if (!parts.length) return p;

  const toTitle = (s) => String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  // For nested keys like billing.discount.view -> Discount View
  if (parts.length >= 3) {
    const scope = parts.slice(1, -1).map(toTitle).join(' ');
    const action = toTitle(parts[parts.length - 1]);
    return `${scope} ${action}`.trim();
  }

  // For regular keys like patients.create -> Create
  return toTitle(parts[1] || parts[0]);
}

async function rolePermissions() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `<div style="padding:24px">${skeletonTable(6)}</div>`;
  try {
    const [data, allRoles] = await Promise.all([
      apiFetch('/api/role-permissions'),
      apiFetch('/api/roles')
    ]);
    _allRolesList = allRoles || [];
    renderRolePermissionsPage(data);
  } catch(e) {
    ca.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

function renderRolePermissionsPage(data) {
  const ca = document.getElementById('contentArea');
  const perms = data.permissions || {};
  const customRoles = (_allRolesList || []).filter(r => !r.built_in);

  // Header: built-ins + custom roles
  const colRoles = _allRolesList.map(r => r.name);
  const totalCols = 1 + colRoles.length; // feature col + role cols

  const headerCols = _allRolesList.map(r =>
    `<th style="text-align:center;min-width:120px">
       <div style="display:flex;align-items:center;justify-content:center;gap:6px">
         ${roleBadge(r.name, r.label)}
         ${!r.built_in ? `<button type="button" onclick="deleteCustomRole(${r.id},'${escHtml(r.name)}','${escHtml(r.label || r.name)}')" title="Delete role" style="background:none;border:none;color:var(--c-danger);cursor:pointer;padding:2px;font-size:14px;line-height:1">${IC.x}</button>` : ''}
       </div>
     </th>`
  ).join('');

  const rows = PERM_GROUPS.map(g => {
    const groupRows = g.perms.map(p => {
      const action = formatPermissionActionLabel(p);
      const cells = colRoles.map(role => {
        const isAdmin = role === 'admin';
        const checked = isAdmin || (perms[role] || []).includes(p);
        const disabled = isAdmin ? 'disabled title="Admin always has all permissions"' : '';
        return `<td style="text-align:center">
          <input type="checkbox" class="theme-checkbox" ${checked ? 'checked' : ''} ${disabled}
            style="cursor:${isAdmin?'not-allowed':'pointer'}"
            onchange="toggleRolePerm(this,'${role}','${p}')"/>
        </td>`;
      }).join('');
      return `<tr><td style="padding-left:28px;color:var(--text-muted);font-size:13px" title="${escHtml(p)}">${escHtml(action)}</td>${cells}</tr>`;
    }).join('');
    return `<tr style="background:var(--bg-hover)"><td colspan="${totalCols}" style="font-weight:700;padding:8px 12px;font-size:13px;text-transform:uppercase;letter-spacing:.5px">${g.label}</td></tr>${groupRows}`;
  }).join('');

  ca.innerHTML = `<div style="padding:24px;display:flex;flex-direction:column;gap:16px">
    <!-- Role Master Card -->
    <div class="card" style="margin:0">
      <div class="card-body">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div class="card-title" style="margin:0">${IC.users} Role Master</div>
          <button class="btn btn-primary btn-sm" onclick="openAddRoleModal()">${IC.plus} Create New Role</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="roleMasterChips">
          ${_allRolesList.map(r => `
            <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:var(--bg-hover)">
              ${roleBadge(r.name, r.label)}
              ${!r.built_in
                ? `<button type="button" onclick="openEditRoleModal(${r.id},'${escHtml(r.label || r.name)}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:1px 3px" title="Rename">${IC.edit}</button>
                   <button type="button" onclick="deleteCustomRole(${r.id},'${r.name}','${escHtml(r.label || r.name)}')" style="background:none;border:none;cursor:pointer;color:var(--c-danger);padding:1px 3px" title="Delete">${IC.x}</button>`
                : `<span style="font-size:11px;color:var(--text-muted)">built-in</span>`}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Permissions matrix card -->
    <div class="card" style="margin:0">
      <div class="card-body">
        <div class="card-title">${IC.setup} Permissions Matrix</div>
        <p style="color:var(--text-muted);margin-bottom:16px">Control which features each role can access. Changes apply immediately. Admin always has full permissions.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th style="min-width:200px">Feature / Action</th>${headerCols}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}

async function openAddRoleModal() {
  showModal('Create New Role', `
    <form id="addRoleForm">
      <div class="form-group">
        <label>Role Label (display name) *</label>
        <input id="newRoleLabel" name="label" required placeholder="e.g. Nurse, Pharmacist, Cashier"/>
        <div class="text-sm text-muted" style="margin-top:4px">A safe internal name is generated automatically from this label.</div>
      </div>
    </form>`,
    async () => {
      const label = document.getElementById('newRoleLabel')?.value?.trim();
      if (!label) { toast('Label is required', 'error'); return false; }
      try {
        await apiFetch('/api/roles', { method:'POST', body: JSON.stringify({ label }) });
        toast('Role created', 'success');
        closeModal();
        rolePermissions(); // reload page
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

async function openEditRoleModal(id, currentLabel) {
  showModal('Rename Role', `
    <form id="editRoleForm">
      <div class="form-group">
        <label>Role Label *</label>
        <input id="editRoleLabel" name="label" value="${escHtml(currentLabel)}" required/>
      </div>
    </form>`,
    async () => {
      const label = document.getElementById('editRoleLabel')?.value?.trim();
      if (!label) { toast('Label required', 'error'); return false; }
      try {
        await apiFetch(`/api/roles/${id}`, { method:'PUT', body: JSON.stringify({ label }) });
        toast('Role renamed', 'success');
        closeModal();
        rolePermissions();
      } catch(e) { toast(e.message, 'error'); return false; }
    });
}

async function deleteCustomRole(id, name, label) {
  if (!await confirmDialog(`Delete role "${label}"?\n\nThis will fail if any users are still assigned this role.`)) return;
  try {
    await apiFetch(`/api/roles/${id}`, { method:'DELETE' });
    toast(`Role "${label}" deleted`, 'success');
    rolePermissions();
  } catch(e) { toast(e.message, 'error'); }
}


// Track pending permission changes per role to batch-save
const _permChanges = { doctor: null, receptionist: null };

async function toggleRolePerm(checkbox, role, perm) {
  if (role === 'admin') { checkbox.checked = true; return; }
  if (!can('role_permissions.edit')) {
    checkbox.checked = !checkbox.checked;
    toast('You do not have permission to edit role permissions.', 'error');
    return;
  }
  try {
    // Collect all currently checked permissions for this role from the UI
    const allCheckboxes = document.querySelectorAll(`input[onchange*="'${role}'"]`);
    const permissions = [];
    allCheckboxes.forEach(cb => {
      const match = cb.getAttribute('onchange').match(/'[^']+','([^']+)'\)/);
      if (match && cb.checked) permissions.push(match[1]);
    });
    await apiFetch('/api/role-permissions', {
      method: 'PUT',
      body: JSON.stringify({ role, permissions })
    });
    toast(`${role} permissions updated`, 'success');
  } catch(e) {
    checkbox.checked = !checkbox.checked; // revert
    toast(e.message, 'error');
  }
}


// --------------------------------------------------------
//  STORE MODULE
// --------------------------------------------------------

// -- Store Overview --------------------------------------
const STORE_OVERVIEW_ITEMS_PER_VIEW = 6;
let _storeOverviewCache = { storesById: new Map(), rowsByStore: new Map() };

function renderStoreOverviewCard(storeId) {
  const sid = parseInt(storeId, 10);
  const st = _storeOverviewCache.storesById.get(sid);
  const visibleRows = (_storeOverviewCache.rowsByStore.get(sid) || []).slice();
  if (!st) return '';

  const storeLowCount = visibleRows.filter((s) => (parseFloat(s.qty || 0) || 0) <= (parseFloat(s.reorder_level || 0) || 0)).length;
  const storeQty = visibleRows.reduce((sum, s) => sum + (parseFloat(s.qty || 0) || 0), 0);
  const storeValue = visibleRows.reduce((sum, s) => sum + ((parseFloat(s.qty || 0) || 0) * (parseFloat(s.avg_cost || 0) || 0)), 0);
  const healthPct = visibleRows.length ? Math.max(0, Math.min(100, Math.round(((visibleRows.length - storeLowCount) / visibleRows.length) * 100))) : 100;

  const fillerCount = Math.max(0, STORE_OVERVIEW_ITEMS_PER_VIEW - Math.min(visibleRows.length, STORE_OVERVIEW_ITEMS_PER_VIEW));

  return `<article class="card store-store-card new-look" id="storeCard-${sid}">
    <div class="store-store-head">
      <div>
        <div class="card-title">${IC.store} ${escHtml(st.name)} ${st.is_main ? '<span class="badge badge-admin" style="font-size:10px;margin-left:4px">Main</span>' : ''}</div>
        <div class="text-muted text-sm">${visibleRows.length} product${visibleRows.length !== 1 ? 's' : ''} - KD ${storeValue.toFixed(3)}</div>
      </div>
      <span class="badge ${storeLowCount ? 'badge-unpaid' : 'badge-paid'}">${storeLowCount} low</span>
    </div>
    <div class="store-health-row">
      <div class="store-health-track"><span style="width:${healthPct}%"></span></div>
      <div class="text-muted text-sm">Health ${healthPct}%</div>
    </div>
    <div class="store-mini-metrics">
      <span><strong>${storeQty.toFixed(3)}</strong> units</span>
      <span><strong>${visibleRows.length}</strong> total items</span>
      <span>${expiryChipHtml(visibleRows[0]?.next_expiry, visibleRows[0]?.missing_expiry_count)}</span>
    </div>
    ${visibleRows.length ? `<div class="store-product-stack" title="Use mouse wheel to scroll">${visibleRows.map((row) => {
      const isLow = (parseFloat(row.qty || 0) || 0) <= (parseFloat(row.reorder_level || 0) || 0);
      return `<div class="store-product-item ${isLow ? 'is-low' : ''}">
        <div class="store-product-main">
          <strong>${escHtml(row.product_name || '-')}</strong>
          <div class="text-muted text-sm">${escHtml(row.product_sku || 'No SKU')}</div>
        </div>
        <div class="store-product-meta">
          <span class="badge ${isLow ? 'badge-unpaid' : 'badge-paid'}">${parseFloat(row.qty || 0).toFixed(3)} ${escHtml(row.product_unit || '')}</span>
          <span class="store-product-cost">KD ${parseFloat(row.avg_cost || 0).toFixed(3)}</span>
          <span>${expiryChipHtml(row.next_expiry, row.missing_expiry_count)}</span>
        </div>
      </div>`;
    }).join('')}
    ${fillerCount > 0 ? Array.from({ length: fillerCount }).map(() => `<div class="store-product-item store-product-item-placeholder"></div>`).join('') : ''}
    </div>
    ` : `<div class="store-spotlight-empty">No stock in this location.</div>`}
  </article>`;
}

async function storeOverview() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `<div class="store-loading">${skeletonStats(4)}</div>`;
  try {
    const [products, stock, subStores, orders] = await Promise.all([
      apiFetch('/api/store/products'),
      apiFetch('/api/store/stock'),
      apiFetch('/api/store/sub-stores'),
      apiFetch('/api/store/purchase-orders'),
    ]);
    const safeStock = Array.isArray(stock) ? stock : [];
    const safeStores = Array.isArray(subStores) ? subStores : [];
    const safeOrders = Array.isArray(orders) ? orders : [];

    _storeOverviewCache = {
      storesById: new Map(safeStores.map((s) => [parseInt(s.id, 10), s])),
      rowsByStore: new Map()
    };

    const totalProducts = Array.isArray(products) ? products.length : 0;
    const pendingOrders = safeOrders.filter(o => String(o.status || '') === 'Pending').length;
    const totalStoresCnt = safeStores.length;
    const lowRows = safeStock.filter((s) => (parseFloat(s.qty || 0) || 0) <= (parseFloat(s.reorder_level || 0) || 0));
    const lowStock = lowRows.length;
    const totalQty = safeStock.reduce((sum, row) => sum + (parseFloat(row.qty || 0) || 0), 0);
    const totalValue = safeStock.reduce((sum, row) => sum + ((parseFloat(row.qty || 0) || 0) * (parseFloat(row.avg_cost || 0) || 0)), 0);
    const activeStores = safeStores.filter((s) => s.active !== false).length;

    const urgentLow = lowRows
      .map((row) => {
        const qty = parseFloat(row.qty || 0) || 0;
        const reorder = parseFloat(row.reorder_level || 0) || 0;
        return { ...row, shortage: Math.max(0, reorder - qty) };
      })
      .sort((a, b) => b.shortage - a.shortage)
      .slice(0, 6);

    const recentOrders = safeOrders
      .slice()
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 5);

    ca.innerHTML = `
      <div class="store-overview-shell">
        <section class="store-overview-hero">
          <div>
            <div class="store-overview-eyebrow">Inventory Command Center</div>
            <h2 class="store-overview-title">Store Overview</h2>
            <p class="store-overview-subtitle">Track stock health, pending purchase pressure, and store-level value at a glance.</p>
            <div class="store-overview-meta">
              <span>${activeStores} active store${activeStores !== 1 ? 's' : ''}</span>
              <span>${totalQty.toFixed(3)} units on hand</span>
              <span>KD ${totalValue.toFixed(3)} estimated value</span>
            </div>
          </div>
          <div class="store-overview-actions">
            <button class="btn btn-primary" onclick="navigate('store-products')">${IC.product} Manage Products</button>
            <button class="btn" onclick="navigate('store-purchase')">${IC.billing} Purchase Orders</button>
            <button class="btn" onclick="navigate('store-adjustments')">${IC.transfer} Stock Adjustments</button>
          </div>
        </section>

        <section class="store-overview-kpis">
          <article class="store-kpi-card accent-products">
            <div class="store-kpi-label">Total Products</div>
            <div class="store-kpi-value">${totalProducts}</div>
            <div class="store-kpi-note">Across all store locations</div>
          </article>
          <article class="store-kpi-card accent-alert">
            <div class="store-kpi-label">Low Stock Alerts</div>
            <div class="store-kpi-value">${lowStock}</div>
            <div class="store-kpi-note">Needs replenishment soon</div>
          </article>
          <article class="store-kpi-card accent-stores">
            <div class="store-kpi-label">Store Locations</div>
            <div class="store-kpi-value">${totalStoresCnt}</div>
            <div class="store-kpi-note">${activeStores} currently active</div>
          </article>
          <article class="store-kpi-card accent-orders">
            <div class="store-kpi-label">Pending Orders</div>
            <div class="store-kpi-value">${pendingOrders}</div>
            <div class="store-kpi-note">Waiting for receipt update</div>
          </article>
        </section>

        <section class="store-overview-panels">
          <article class="card store-spotlight-card">
            <div class="card-header-row">
              <div class="card-title">${IC.pending} Low Stock Spotlight</div>
              <span class="text-muted text-sm">Top ${urgentLow.length || 0}</span>
            </div>
            ${urgentLow.length ? `<div class="store-spotlight-list">${urgentLow.map((row) => `
              <div class="store-spotlight-item">
                <div>
                  <div class="store-spotlight-name">${escHtml(row.product_name || 'Product')}</div>
                  <div class="text-muted text-sm">${escHtml(row.store_name || 'Unknown Store')} - ${escHtml(row.product_sku || '')}</div>
                </div>
                <div class="store-spotlight-metrics">
                  <span class="badge badge-unpaid">${parseFloat(row.qty || 0).toFixed(3)} ${escHtml(row.product_unit || '')}</span>
                  <span class="store-spotlight-gap">Gap ${parseFloat(row.shortage || 0).toFixed(3)}</span>
                </div>
              </div>`).join('')}</div>` : `<div class="store-spotlight-empty">All good. No low-stock alerts right now.</div>`}
          </article>

          <article class="card store-orders-card">
            <div class="card-header-row">
              <div class="card-title">${IC.billing} Recent Purchase Orders</div>
              <button class="btn btn-sm" onclick="navigate('store-purchase')">Open</button>
            </div>
            ${recentOrders.length ? `<div class="store-order-list">${recentOrders.map((po) => `<div class="store-order-item">
              <div>
                <div><strong>PO#${parseInt(po.id || 0, 10)}</strong></div>
                <div class="text-muted text-sm">${escHtml(formatDateTime(po.created_at || ''))}</div>
              </div>
              <div class="store-order-right">
                <div>${statusBadge(po.status || 'Pending')}</div>
                <div class="text-muted text-sm">${(po.items || []).length} item${(po.items || []).length !== 1 ? 's' : ''}</div>
              </div>
            </div>`).join('')}</div>` : `<div class="store-spotlight-empty">No purchase orders found.</div>`}
          </article>
        </section>

        <section class="store-overview-grid">
          ${safeStores.map((st) => {
            const sid = parseInt(st.id, 10);
            const visibleRows = safeStock
              .filter((s) => parseInt(s.store_id, 10) === sid)
              .slice()
              .sort((a, b) => {
                const aLow = (parseFloat(a.qty || 0) || 0) <= (parseFloat(a.reorder_level || 0) || 0) ? 1 : 0;
                const bLow = (parseFloat(b.qty || 0) || 0) <= (parseFloat(b.reorder_level || 0) || 0) ? 1 : 0;
                if (aLow !== bLow) return bLow - aLow;
                return String(a.product_name || '').localeCompare(String(b.product_name || ''));
              });
            _storeOverviewCache.rowsByStore.set(sid, visibleRows);
            return renderStoreOverviewCard(sid);
          }).join('')}
        </section>
      </div>`;
  } catch(e) { toast(e.message,'error'); }
}

// -- Store Products --------------------------------------
let _storeAllProducts = [];
async function storeProducts() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="spSearch" type="text" placeholder="Search products..." oninput="filterStoreProducts()"/></div>
      <div class="store-action-spacer"></div>
      ${can('store.manage')?`<button class="btn btn-primary" onclick="openAddProductModal()">${IC.plus} Add Product</button>`:''}
    </div>
    <div id="spWrap">${skeletonTable(5)}</div>`;
  try {
    const [plist, ulist, clist] = await Promise.all([apiFetch('/api/store/products'), apiFetch('/api/uoms'), apiFetch('/api/store/product-categories')]);
    _storeAllProducts = plist;
    _allUoms = ulist;
    _storeProductCategories = clist;
    renderStoreProducts(_storeAllProducts);
  } catch(e) { toast(e.message,'error'); }
}
function filterStoreProducts() {
  const q = (document.getElementById('spSearch')?.value||'').toLowerCase();
  renderStoreProducts(_storeAllProducts.filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q)));
}
function renderStoreProducts(list) {
  const wrap = document.getElementById('spWrap'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.product,'No products','Add your first product'); return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Name</th><th>SKU</th><th>Category</th><th>Unit</th><th>Cost</th><th>Sell Price</th><th>Total Stock</th><th>Next Expiry</th><th>Reorder Lvl</th><th>Status</th>${can('store.manage')?'<th>Actions</th>':''}</tr></thead>
    <tbody>${list.map((p,i) => {
      const isLow = p.total_stock <= p.reorder_level;
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${escHtml(p.name)}</strong>${p.description?`<div class="text-muted text-sm">${escHtml(p.description)}</div>`:''}</td>
        <td class="text-muted text-sm">${escHtml(p.sku||'-')}</td>
        <td>${escHtml(p.category||'-')}</td>
        <td>${escHtml(p.uom_symbol || p.unit || '-')}</td>
        <td>KD ${(p.cost_price||0).toFixed(3)}</td>
        <td>${p.sell_price>0?`KD ${p.sell_price.toFixed(3)}`:'-'}</td>
        <td><span class="badge ${isLow?'badge-unpaid':'badge-paid'}">${p.total_stock} ${escHtml(p.uom_symbol || p.unit || '')}</span>${isLow?` <span class="badge badge-cancelled" style="font-size:10px">Low</span>`:''}</td>
        <td>${expiryChipHtml(p.next_expiry, p.missing_expiry_count)}</td>
        <td>${p.reorder_level}</td>
        <td>${p.active?'<span class="badge badge-paid">Active</span>':'<span class="badge badge-unpaid">Inactive</span>'}</td>
        ${can('store.manage')?`<td class="td-actions">
          <button class="btn btn-sm" onclick="openEditProductModal(${p.id})">${IC.edit}</button>
        </td>`:''}
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}
function renderProductUomConversionRow(containerId, selectedUomId = '', factor = '') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const modal = wrap.closest('.modal');
  const baseSel = modal ? modal.querySelector('select[name="uom_id"]') : null;
  const baseUomId = baseSel ? parseInt(baseSel.value || 0) : 0;
  const uomOpts = (_allUoms || [])
    .filter(u => u.active !== false && u.id !== baseUomId)
    .map(u => `<option value="${u.id}" ${String(selectedUomId) === String(u.id) ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.symbol)})</option>`)
    .join('');
  wrap.insertAdjacentHTML('beforeend', `
    <div class="prod-uom-row" style="display:grid;grid-template-columns:1fr 150px 30px;gap:8px;align-items:center;margin-bottom:6px">
      <select class="prod-uom-sel" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text)">
        <option value="">- Select UOM -</option>${uomOpts}
      </select>
      <div class="num-stepper prod-uom-factor-wrap"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input class="prod-uom-factor" type="number" min="0.001" step="0.001" value="${factor !== '' ? factor : ''}" placeholder="Factor"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div>
      <button type="button" onclick="this.closest('.prod-uom-row').remove()" style="background:none;border:none;cursor:pointer;color:var(--c-danger)">${IC.trash}</button>
    </div>`);
}
function collectProductUomConversions(modal, baseUomId) {
  const rows = modal.querySelectorAll('.prod-uom-row');
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const uid = parseInt(row.querySelector('.prod-uom-sel')?.value || 0);
    const factor = parseFloat(row.querySelector('.prod-uom-factor')?.value || 0);
    if (!uid && !factor) continue;
    if (!uid) throw new Error('Select UOM for all conversion rows');
    if (!(factor > 0)) throw new Error('Conversion factor must be greater than 0');
    if (uid === parseInt(baseUomId || 0)) throw new Error('Conversion UOM cannot be the same as base UOM');
    if (seen.has(uid)) throw new Error('Duplicate conversion UOM found');
    seen.add(uid);
    out.push({ uom_id: uid, factor });
  }
  return out;
}
function openAddProductModal() {
  const uomOpts = (_allUoms || []).filter(u => u.active !== false).map(u => `<option value="${u.id}">${escHtml(u.name)} (${escHtml(u.symbol)}) - factor ${parseFloat(u.factor || 1).toFixed(3)}</option>`).join('');
  const catOpts = (_storeProductCategories || []).filter(c => c.active !== false).map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');
  showModal('Add Product', `
    <form id="addProductForm">
      <div class="form-row">
        <div class="form-group"><label>Product Name *</label><input name="name" required/></div>
        <div class="form-group"><label>SKU</label><input name="sku" placeholder="e.g. MED-001"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Base UOM *</label><select name="uom_id" required>${uomOpts}</select></div>
        <div class="form-group">
          <label style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>Category *</span>
            ${can('setup.edit') ? `<button type="button" class="btn btn-sm" onclick="quickAddProductCategory('addProductCategorySel')">${IC.plus} Category</button>` : ''}
          </label>
          <select id="addProductCategorySel" name="category" required><option value="">- Select Category -</option>${catOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Cost Price (KD)</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="cost_price" type="number" step="0.001" min="0" value="0"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Sell Price (KD)</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="sell_price" type="number" step="0.001" min="0" value="0"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Reorder Level</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="reorder_level" type="number" min="0" value="0"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>Additional UOM Conversions</span>
          <button type="button" class="btn btn-sm" onclick="renderProductUomConversionRow('addProdUomConvWrap')">${IC.plus} Add Conversion</button>
        </label>
        <div id="addProdUomConvWrap"></div>
        <div class="text-muted text-sm">Example: Box factor 10 means 1 box equals 10 base units.</div>
      </div>
      <div class="form-group"><label>Description</label><input name="description"/></div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#addProductForm'));
      const body = Object.fromEntries(fd.entries());
      try {
        body.uom_conversions = collectProductUomConversions(modal, body.uom_id);
        await apiFetch('/api/store/products',{method:'POST',body:JSON.stringify(body)});
        toast('Product added','success'); closeModal(); storeProducts();
      } catch(e){toast(e.message,'error');}
    }}]);
}
async function openEditProductModal(id) {
  const p = _storeAllProducts.find(x=>x.id===id); if(!p) return;
  const uomOpts = (_allUoms || []).map(u => `<option value="${u.id}" ${parseInt(p.uom_id) === u.id ? 'selected' : ''}>${escHtml(u.name)} (${escHtml(u.symbol)}) - factor ${parseFloat(u.factor || 1).toFixed(3)}</option>`).join('');
  const catOpts = (_storeProductCategories || []).map(c => `<option value="${escHtml(c.name)}" ${String(p.category||'') === String(c.name) ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
  showModal('Edit Product', `
    <form id="editProductForm">
      <div class="form-row">
        <div class="form-group"><label>Product Name *</label><input name="name" value="${escHtml(p.name)}" required/></div>
        <div class="form-group"><label>SKU</label><input name="sku" value="${escHtml(p.sku||'')}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Base UOM *</label><select name="uom_id" required>${uomOpts}</select></div>
        <div class="form-group">
          <label style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>Category *</span>
            ${can('setup.edit') ? `<button type="button" class="btn btn-sm" onclick="quickAddProductCategory('editProductCategorySel')">${IC.plus} Category</button>` : ''}
          </label>
          <select id="editProductCategorySel" name="category" required><option value="">- Select Category -</option>${catOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Cost Price (KD)</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="cost_price" type="number" step="0.001" min="0" value="${p.cost_price||0}"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Sell Price (KD)</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="sell_price" type="number" step="0.001" min="0" value="${p.sell_price||0}"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Reorder Level</label><div class="num-stepper"><button type="button" class="num-step-btn" onclick="stepNum(this,-1)">-</button><input name="reorder_level" type="number" min="0" value="${p.reorder_level||0}"/><button type="button" class="num-step-btn" onclick="stepNum(this,1)">+</button></div></div>
        <div class="form-group"><label>Active</label><select name="active"><option value="true" ${p.active?'selected':''}>Active</option><option value="false" ${!p.active?'selected':''}>Inactive</option></select></div>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>Additional UOM Conversions</span>
          <button type="button" class="btn btn-sm" onclick="renderProductUomConversionRow('editProdUomConvWrap')">${IC.plus} Add Conversion</button>
        </label>
        <div id="editProdUomConvWrap"></div>
        <div class="text-muted text-sm">Example: Carton factor 10 means 1 carton equals 10 base units.</div>
      </div>
      <div class="form-group"><label>Description</label><input name="description" value="${escHtml(p.description||'')}"/></div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#editProductForm'));
      const body = Object.fromEntries(fd.entries());
      body.active = body.active === 'true';
      try {
        body.uom_conversions = collectProductUomConversions(modal, body.uom_id);
        await apiFetch(`/api/store/products/${id}`,{method:'PUT',body:JSON.stringify(body)});
        toast('Product updated','success'); closeModal(); storeProducts();
      } catch(e){toast(e.message,'error');}
    }}]);
  const existing = (p.uom_options || []).filter(o => !o.is_base);
  existing.forEach(o => renderProductUomConversionRow('editProdUomConvWrap', o.uom_id, parseFloat(o.factor || 1)));
}
async function deleteStoreProduct(id, name) {
  toast('Product master deletion is locked. Edit the product or mark it inactive instead.', 'error');
}

// -- Suppliers -------------------------------------------
let _storeAllSuppliers = [];
async function storeSuppliers() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="suppSearch" type="text" placeholder="Search suppliers..." oninput="filterStoreSuppliers()"/></div>
      <div class="store-action-spacer"></div>
      ${can('store.manage')?`<button class="btn btn-primary" onclick="openAddSupplierModal()">${IC.plus} Add Supplier</button>`:''}
    </div>
    <div id="suppWrap">${skeletonTable(4)}</div>`;
  try {
    _storeAllSuppliers = await apiFetch('/api/store/suppliers');
    renderSuppliers(_storeAllSuppliers);
  } catch(e) { toast(e.message,'error'); }
}
function filterStoreSuppliers() {
  const q = (document.getElementById('suppSearch')?.value || '').toLowerCase().trim();
  renderSuppliers(_storeAllSuppliers.filter(s => {
    if (!q) return true;
    return [s.name, s.contact_name, s.phone, s.email, s.address]
      .map(v => String(v || '').toLowerCase())
      .some(v => v.includes(q));
  }));
}
function renderSuppliers(list) {
  const wrap = document.getElementById('suppWrap'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.supplier,'No suppliers','Add your first supplier'); return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Address</th><th>Status</th>${can('store.manage')?'<th>Actions</th>':''}</tr></thead>
    <tbody>${list.map((s,i)=>`<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.contact_name||'-')}</td>
      <td>${escHtml(s.phone||'-')}</td>
      <td>${escHtml(s.email||'-')}</td>
      <td>${escHtml(s.address||'-')}</td>
      <td>${s.active?'<span class="badge badge-paid">Active</span>':'<span class="badge badge-unpaid">Inactive</span>'}</td>
      ${can('store.manage')?`<td class="td-actions">
        <button class="btn btn-sm" onclick="openEditSupplierModal(${s.id})">${IC.edit}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id},'${escHtml(s.name)}')">${IC.trash}</button>
      </td>`:''}
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function openAddSupplierModal() {
  showModal('Add Supplier', `
    <form id="addSupplierForm">
      <div class="form-row">
        <div class="form-group"><label>Supplier Name *</label><input name="name" required/></div>
        <div class="form-group"><label>Contact Person</label><input name="contact_name"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input name="phone"/></div>
        <div class="form-group"><label>Email</label><input name="email" type="email"/></div>
      </div>
      <div class="form-group"><label>Address</label><input name="address"/></div>
      <div class="form-group"><label>Notes</label><input name="notes"/></div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#addSupplierForm'));
      try { await apiFetch('/api/store/suppliers',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))}); toast('Supplier added','success'); closeModal(); storeSuppliers(); } catch(e){toast(e.message,'error');}
    }}]);
}
async function openEditSupplierModal(id) {
  const s = _storeAllSuppliers.find(x=>x.id===id); if(!s) return;
  showModal('Edit Supplier', `
    <form id="editSupplierForm">
      <div class="form-row">
        <div class="form-group"><label>Name *</label><input name="name" value="${escHtml(s.name)}" required/></div>
        <div class="form-group"><label>Contact Person</label><input name="contact_name" value="${escHtml(s.contact_name||'')}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input name="phone" value="${escHtml(s.phone||'')}"/></div>
        <div class="form-group"><label>Email</label><input name="email" type="email" value="${escHtml(s.email||'')}"/></div>
      </div>
      <div class="form-group"><label>Address</label><input name="address" value="${escHtml(s.address||'')}"/></div>
      <div class="form-group"><label>Notes</label><input name="notes" value="${escHtml(s.notes||'')}"/></div>
      <div class="form-group"><label>Active</label><select name="active"><option value="true" ${s.active?'selected':''}>Active</option><option value="false" ${!s.active?'selected':''}>Inactive</option></select></div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#editSupplierForm'));
      const body = Object.fromEntries(fd.entries()); body.active = body.active==='true';
      try { await apiFetch(`/api/store/suppliers/${id}`,{method:'PUT',body:JSON.stringify(body)}); toast('Supplier updated','success'); closeModal(); storeSuppliers(); } catch(e){toast(e.message,'error');}
    }}]);
}
async function deleteSupplier(id, name) {
  if (!await confirmDialog(`Delete supplier "${name}"?`)) return;
  try { await apiFetch(`/api/store/suppliers/${id}`,{method:'DELETE'}); toast('Supplier deleted','success'); storeSuppliers(); } catch(e){toast(e.message,'error');}
}

// -- Purchase Orders -------------------------------------
let _storePOs = [];
let _poFilters = { search: '', from: '', to: '' };
async function storePurchase() {
  const ca = document.getElementById('contentArea');
  const todayStr = new Date().toLocaleDateString('sv');
  const fromVal = _poFilters.from || todayStr;
  const toVal = _poFilters.to || todayStr;
  const searchVal = _poFilters.search || '';
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="poSearch" type="text" placeholder="Search purchase orders..." value="${escHtml(searchVal)}" oninput="filterStorePOs()"/></div>
      <div class="bill-filter-group">
        <input id="poDateFrom" type="date" value="${fromVal}" title="From date"/>
        <input id="poDateTo" type="date" value="${toVal}" title="To date"/>
        <button class="btn report-apply-btn" onclick="filterStorePOs()">${IC.search} Filter</button>
        <button class="btn report-clear-btn" onclick="clearPOFilters()">Clear</button>
      </div>
      <div class="store-action-spacer"></div>
      ${can('store.purchase')?`<button class="btn btn-primary" onclick="openNewPOModal()">${IC.plus} New Purchase Order</button>`:''}
    </div>
    <div id="poWrap">${skeletonTable(5)}</div>`;
  try {
    _storePOs = await apiFetch('/api/store/purchase-orders');
    filterStorePOs();
  } catch(e) { toast(e.message,'error'); }
}
function clearPOFilters() {
  const t = new Date().toLocaleDateString('sv');
  const f = document.getElementById('poDateFrom');
  const to = document.getElementById('poDateTo');
  const s = document.getElementById('poSearch');
  if (f) f.value = t;
  if (to) to.value = t;
  if (s) s.value = '';
  _poFilters = { search: '', from: t, to: t };
  filterStorePOs();
}
function filterStorePOs() {
  const rawSearch = (document.getElementById('poSearch')?.value || '').trim();
  const q = rawSearch.toLowerCase();
  const from = document.getElementById('poDateFrom')?.value || '';
  const to = document.getElementById('poDateTo')?.value || '';
  _poFilters = { search: rawSearch, from, to };
  renderPOs(_storePOs.filter(o => {
    const status = o.status === 'Received' ? 'received' : 'pending';
    const textMatch = !q || [o.supplier_name, o.invoice_number, o.order_date, o.notes, status, o.payment_status]
      .map(v => String(v || '').toLowerCase()).some(v => v.includes(q));
    const d = String(o.order_date || o.created_at || '').slice(0,10);
    const fromOk = !from || (d && d >= from);
    const toOk = !to || (d && d <= to);
    return textMatch && fromOk && toOk;
  }));
}
function renderPOs(list) {
  const wrap = document.getElementById('poWrap'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.billing,'No purchase orders','Create your first purchase order'); return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Supplier</th><th>Invoice #</th><th>Items</th><th>Total Cost</th><th>Payment</th><th>Status</th><th>Order Date</th><th>Actions</th></tr></thead>
    <tbody>${list.map((o,i)=>{
      const missingExpiry = (o.items||[]).some(x => !String(x.expiry_date || x.expiry || x.exp_date || '').slice(0,10));
      const payStatus = String(o.payment_status || 'Unpaid');
      const payBadge = payStatus === 'Paid'
        ? '<span class="badge badge-paid">Paid</span>'
        : (payStatus === 'Partially Paid' ? '<span class="badge badge-arrived">Partially Paid</span>' : '<span class="badge badge-unpaid">Unpaid</span>');
      const dueAmount = o.due_amount != null ? parseFloat(o.due_amount) : parseFloat(o.total_cost || 0);
      return `<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(o.supplier_name||'-')}</strong></td>
      <td class="text-muted text-sm">${escHtml(o.invoice_number||'-')}</td>
      <td>${(o.items||[]).length} item(s)${missingExpiry ? ` <span class="expiry-chip missing">Expiry Missing</span>` : ''}</td>
      <td><strong>KD ${(o.total_cost||0).toFixed(3)}</strong></td>
      <td>${payBadge}<div class="text-muted text-sm">Due KD ${dueAmount.toFixed(3)}</div></td>
      <td>${o.status==='Received'?'<span class="badge badge-paid">Received</span>':'<span class="badge badge-scheduled">Pending</span>'}</td>
      <td class="text-muted text-sm">${escHtml(o.order_date||'-')}</td>
      <td class="td-actions">
        <div class="apt-actions po-actions">
          <button class="btn btn-sm" onclick="viewPODetails(${o.id})">${IC.eye} View</button>
          ${can('expenses.create') && dueAmount > 0.0005 ? `<button class="btn btn-sm" onclick="openSupplierInvoicePaymentModal(${o.id})">${IC.billing} Pay</button>` : ''}
          ${can('store.purchase')?`<button class="btn btn-sm" onclick="openPOExpiryEditor(${o.id})">Expiry</button>`:''}
          ${o.status==='Pending'&&can('store.manage')?`<button class="btn btn-sm btn-success" onclick="receivePO(${o.id})">${IC.check} Receive</button>`:''}
          ${o.status==='Pending'&&can('store.manage')?`<button class="btn btn-sm btn-danger" onclick="deletePO(${o.id})">${IC.trash}</button>`:''}
        </div>
      </td>
    </tr>`;}).join('')}</tbody>
  </table></div>`;
}
function formatExpiryDisplay(dateStr) {
  const raw = String(dateStr || '').slice(0,10);
  if (!raw) return '-';
  const dt = new Date(`${raw}T00:00`);
  return Number.isNaN(dt.getTime()) ? raw : dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function expiryChipHtml(dateStr, missingCount = 0) {
  const raw = String(dateStr || '').slice(0,10);
  const todayStr = new Date().toLocaleDateString('sv');
  const chips = [];
  if (raw) {
    chips.push(`<span class="expiry-chip ${raw < todayStr ? 'expired' : ''}">${escHtml(formatExpiryDisplay(raw))}</span>`);
  }
  if (missingCount > 0) {
    chips.push(`<span class="expiry-chip missing">${missingCount} missing</span>`);
  }
  return chips.join(' ') || '-';
}
async function poCreateOrderFromModal() {
  const supplier_id = document.getElementById('poSupplier')?.value;
  if (!supplier_id) { toast('Select a supplier','error'); return false; }
  const rows = document.querySelectorAll('.po-item-row');
  if (!rows.length) { toast('Add at least one item','error'); return false; }
  const items = [];
  for (const row of rows) {
    const pid = row.querySelector('.po-prod-sel')?.value;
    const qty = parseFloat(row.querySelector('.po-qty')?.value || 0);
    const cost = parseFloat(row.querySelector('.po-cost')?.value || 0);
    const uom_id = row.querySelector('.po-uom-sel')?.value || '';
    const expiry_date = row.querySelector('.po-expiry')?.value || '';
    if (!pid || qty <= 0 || !expiry_date) { toast('Fill all item fields, including expiry date','error'); return false; }
    items.push({ product_id:pid, qty, cost_price:cost, line_total: parseFloat((qty * cost).toFixed(3)), uom_id, expiry_date });
  }
  try {
    await apiFetch('/api/store/purchase-orders',{
      method:'POST',
      body:JSON.stringify({
        supplier_id,
        items,
        invoice_number: document.getElementById('poInvoiceNumber')?.value || '',
        notes: document.getElementById('poNotes')?.value || '',
        order_date: document.getElementById('poDate')?.value || ''
      })
    });
    toast('Purchase order created','success');
    closeModal();
    storePurchase();
    return true;
  } catch(e){
    toast(e.message,'error');
    return false;
  }
}
function poBuildProductOptions(selectedId = '') {
  return window._poProducts.map(p => `<option value="${p.id}" data-cost="${p.cost_price}" ${String(selectedId) === String(p.id) ? 'selected' : ''}>${escHtml(p.name)} (${p.unit})</option>`).join('');
}
function poSyncProductSelects(preferredProductId = '') {
  const rows = [...document.querySelectorAll('.po-item-row')];
  let assignedPreferred = false;
  rows.forEach(row => {
    const sel = row.querySelector('.po-prod-sel');
    if (!sel) return;
    const current = sel.value;
    const exists = (window._poProducts || []).some(p => String(p.id) === String(current));
    const nextValue = exists ? current : ((!assignedPreferred && preferredProductId) ? String(preferredProductId) : '');
    sel.innerHTML = `<option value="">- Product -</option>${poBuildProductOptions(nextValue)}`;
    sel.value = nextValue;
    if (!assignedPreferred && nextValue === String(preferredProductId)) assignedPreferred = true;
    if (nextValue) poOnProductChange(sel);
  });
  if (preferredProductId && !assignedPreferred) {
    poAddItem();
    const newRow = [...document.querySelectorAll('.po-item-row')].pop();
    const sel = newRow ? newRow.querySelector('.po-prod-sel') : null;
    if (sel) {
      sel.innerHTML = `<option value="">- Product -</option>${poBuildProductOptions(preferredProductId)}`;
      sel.value = String(preferredProductId);
      poOnProductChange(sel);
    }
  }
}
function poQuickProductCategoryOptions() {
  return (_storeProductCategories || []).filter(c => c.active !== false).map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('');
}
function poQuickProductUomOptions() {
  return (_allUoms || []).filter(u => u.active !== false).map(u => `<option value="${u.id}">${escHtml(u.name)} (${escHtml(u.symbol)}) - factor ${parseFloat(u.factor || 1).toFixed(3)}</option>`).join('');
}
function poToggleQuickProduct() {
  const panel = document.getElementById('poQuickProductPanel');
  if (!panel) return;
  panel.classList.toggle('open');
}
async function poQuickAddProduct() {
  if (!can('store.manage')) { toast('You do not have permission to add products', 'error'); return false; }
  const form = document.getElementById('poQuickProductForm');
  if (!form) return false;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  if (!body.name || !body.category || !body.uom_id) {
    toast('Product name, base UOM, and category are required', 'error');
    return false;
  }
  try {
    const created = await apiFetch('/api/store/products', { method:'POST', body:JSON.stringify(body) });
    const products = await apiFetch('/api/store/products');
    window._poProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      unit: (p.uom_symbol || p.unit),
      uom_id: p.uom_id,
      cost_price: p.cost_price || 0,
      uom_options: p.uom_options || []
    }));
    poSyncProductSelects(created.id);
    form.reset();
    const reorder = form.querySelector('input[name="reorder_level"]');
    const cost = form.querySelector('input[name="cost_price"]');
    const sell = form.querySelector('input[name="sell_price"]');
    if (reorder) reorder.value = '0';
    if (cost) cost.value = '0';
    if (sell) sell.value = '0';
    document.getElementById('poQuickProductPanel')?.classList.remove('open');
    toast('Product added to purchase order list', 'success');
    return true;
  } catch(e) {
    toast(e.message, 'error');
    return false;
  }
}
async function openNewPOModal() {
  let suppliers = [], products = [], uoms = [], categories = [];
  try { [suppliers, products, uoms, categories] = await Promise.all([apiFetch('/api/store/suppliers'), apiFetch('/api/store/products'), apiFetch('/api/uoms'), apiFetch('/api/store/product-categories')]); } catch{}
  const supplierOpts = suppliers.map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  _allUoms = Array.isArray(uoms) ? uoms : _allUoms;
  _storeProductCategories = Array.isArray(categories) ? categories : _storeProductCategories;
  window._poProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    unit: (p.uom_symbol || p.unit),
    uom_id: p.uom_id,
    cost_price: p.cost_price || 0,
    uom_options: p.uom_options || []
  }));
  window._poItemCount = 0;
  showModal('New Purchase Order', `
    <div class="po-meta-grid">
      <div class="form-group"><label>Supplier *</label><select id="poSupplier" required><option value="">- Select Supplier -</option>${supplierOpts}</select></div>
      <div class="form-group"><label>Order Date</label><input type="date" id="poDate" value="${new Date().toLocaleDateString('sv')}"/></div>
      <div class="form-group"><label>Supplier Invoice #</label><input id="poInvoiceNumber" placeholder="e.g. INV-2026-001"/></div>
      <div class="form-group"><label>Notes</label><input id="poNotes"/></div>
    </div>
    ${can('store.manage') ? `
    <div class="po-quick-add-wrap">
      <button type="button" class="btn btn-sm" onclick="poToggleQuickProduct()">${IC.plus} New Item</button>
      <div id="poQuickProductPanel" class="po-quick-product-panel">
        <form id="poQuickProductForm">
          <div class="po-quick-product-grid">
            <div class="form-group"><label>Product Name *</label><input name="name" required/></div>
            <div class="form-group"><label>SKU</label><input name="sku" placeholder="e.g. MED-001"/></div>
            <div class="form-group"><label>Base UOM *</label><select name="uom_id" required><option value="">- Select UOM -</option>${poQuickProductUomOptions()}</select></div>
            <div class="form-group">
              <label style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <span>Category *</span>
                ${can('setup.edit') ? `<button type="button" class="btn btn-sm" onclick="quickAddProductCategory('poQuickCategory')">${IC.plus} Category</button>` : ''}
              </label>
              <select id="poQuickCategory" name="category" required><option value="">- Select Category -</option>${poQuickProductCategoryOptions()}</select>
            </div>
            <div class="form-group"><label>Cost Price</label><input name="cost_price" type="number" min="0" step="0.001" value="0"/></div>
            <div class="form-group"><label>Sell Price</label><input name="sell_price" type="number" min="0" step="0.001" value="0"/></div>
            <div class="form-group"><label>Reorder Level</label><input name="reorder_level" type="number" min="0" step="1" value="0"/></div>
            <div class="form-group po-quick-product-actions"><button type="button" class="btn btn-primary" onclick="poQuickAddProduct()">${IC.check || ''} Save Item</button></div>
          </div>
        </form>
      </div>
    </div>` : ''}
    <div style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px">
      <strong>Items</strong>
      <button class="btn btn-sm btn-primary" type="button" onclick="poAddItem()">${IC.plus} Add Item</button>
    </div>
    <div class="po-items-shell">
      <div class="po-item-head">
        <span>Product</span>
        <span>Purchase UOM</span>
        <span>Qty</span>
        <span>Expiry Date</span>
        <span>Price / UOM</span>
        <span>Line Total</span>
        <span></span>
      </div>
      <div id="poItemsWrap" class="po-items-wrap"></div>
    </div>
    <div id="poTotal" class="po-total-bar">
      <div class="po-total-main">Total: KD 0.000</div>
      <div class="po-total-actions">
        <button type="button" class="btn btn-primary" onclick="poCreateOrderFromModal()">${IC.check || ''} Create Order</button>
      </div>
    </div>`,
    [], 'modal-po');
}
function poAddItem() {
  const wrap = document.getElementById('poItemsWrap'); if(!wrap) return;
  if(!window._poProducts) return;
  const opts = poBuildProductOptions();
  wrap.insertAdjacentHTML('beforeend',`<div class="po-item-row">
    <select class="po-prod-sel" onchange="poOnProductChange(this)"><option value="">- Product -</option>${opts}</select>
    <select class="po-uom-sel" onchange="poOnUomChange(this)"><option value="">- UOM -</option></select>
    <div class="po-num-wrap" title="Quantity">
      <button type="button" class="po-step-btn" onclick="poStepQty(this,-1)">-</button>
      <input class="po-qty" type="number" min="1" step="1" value="1" placeholder="Qty" oninput="poCalcTotal()" onchange="poCalcTotal()"/>
      <button type="button" class="po-step-btn" onclick="poStepQty(this,1)">+</button>
    </div>
    <input class="po-expiry" type="date" title="Expiry date"/>
    <input class="po-cost" type="number" step="0.001" min="0" value="0.000" placeholder="Price for 1 selected UOM" oninput="poCalcTotal()" onchange="poCalcTotal()"/>
    <div class="po-line-total">KD 0.000</div>
    <button type="button" class="po-remove-btn" onclick="this.closest('.po-item-row').remove();poCalcTotal()">${IC.trash}</button>
  </div>`);
}
function poStepQty(btn, delta) {
  const row = btn.closest('.po-item-row');
  if (!row) return;
  const input = row.querySelector('.po-qty');
  if (!input) return;
  const step = parseInt(input.step || '1', 10) || 1;
  const min = parseInt(input.min || '1', 10) || 1;
  const cur = parseInt(input.value || '0', 10) || 0;
  const next = Math.max(min, cur + (delta * step));
  input.value = String(next);
  poCalcTotal();
}
function stepNum(btn, delta) {
  const wrap = btn.closest('.num-stepper');
  if (!wrap) return;
  const input = wrap.querySelector('input[type="number"]');
  if (!input) return;
  const rawStep = parseFloat(input.getAttribute('step'));
  const step = isNaN(rawStep) ? 1 : rawStep;
  const rawMin = parseFloat(input.getAttribute('min'));
  const rawMax = parseFloat(input.getAttribute('max'));
  const cur = parseFloat(input.value) || 0;
  const decimals = (step.toString().split('.')[1] || '').length;
  let next = parseFloat((cur + delta * step).toFixed(decimals));
  if (!isNaN(rawMin)) next = Math.max(rawMin, next);
  if (!isNaN(rawMax)) next = Math.min(rawMax, next);
  input.value = next.toFixed(decimals);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function poOnProductChange(sel) {
  const opt = sel.options[sel.selectedIndex];
  const cost = parseFloat(opt.dataset.cost||0);
  const row = sel.closest('.po-item-row');
  row.querySelector('.po-cost').value = cost.toFixed(3);
  const p = (window._poProducts || []).find(x => String(x.id) === String(sel.value));
  const uomSel = row.querySelector('.po-uom-sel');
  if (uomSel) {
    const options = (p && Array.isArray(p.uom_options) && p.uom_options.length)
      ? p.uom_options
      : (p && p.uom_id ? [{ uom_id: p.uom_id, factor: 1, symbol: p.unit }] : []);
    uomSel.innerHTML = options.length
      ? options.map(o => `<option value="${o.uom_id}" data-factor="${parseFloat(o.factor || 1)}">${escHtml(o.symbol || '')} (x${parseFloat(o.factor || 1).toFixed(3)})</option>`).join('')
      : `<option value="">- UOM -</option>`;
    if (p && p.uom_id) uomSel.value = String(p.uom_id);
  }
  poCalcTotal();
}
function poOnUomChange(sel) {
  const row = sel.closest('.po-item-row');
  if (!row) return;
  const productId = row.querySelector('.po-prod-sel')?.value;
  const product = (window._poProducts || []).find(x => String(x.id) === String(productId));
  const factor = parseFloat(sel.options[sel.selectedIndex]?.dataset.factor || 1) || 1;
  const baseCost = parseFloat(product?.cost_price || 0) || 0;
  const costInput = row.querySelector('.po-cost');
  if (costInput && baseCost >= 0) costInput.value = (baseCost * factor).toFixed(3);
  poCalcTotal();
}
function poCalcTotal() {
  let total = 0;
  document.querySelectorAll('.po-item-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.po-qty').value||0);
    const cost = parseFloat(row.querySelector('.po-cost').value||0);
    const lineTotal = qty * cost;
    total += lineTotal;
    const lineTotalEl = row.querySelector('.po-line-total');
    if (lineTotalEl) lineTotalEl.textContent = `KD ${lineTotal.toFixed(3)}`;
  });
  const el = document.getElementById('poTotal');
  const main = document.querySelector('#poTotal .po-total-main');
  if (main) main.textContent = `Total: KD ${total.toFixed(3)}`;
  else if (el) el.textContent = `Total: KD ${total.toFixed(3)}`;
}
async function viewPODetails(id) {
  try {
    const [o, subStores] = await Promise.all([
      apiFetch(`/api/store/purchase-orders/${id}`),
      apiFetch('/api/store/sub-stores')
    ]);
    const mainStore = (subStores || []).find(s => s.is_main);
    const stock = mainStore ? await apiFetch(`/api/store/stock?store_id=${mainStore.id}`) : [];
    const wacByProduct = new Map((stock || []).map(s => [parseInt(s.product_id), parseFloat(s.avg_cost || 0) || 0]));

    const rows = (o.items||[]).map(i => {
      const purchaseCost = parseFloat(i.cost_price || 0) || 0;
      const currentWac = wacByProduct.get(parseInt(i.product_id)) || 0;
      const delta = currentWac - purchaseCost;
      const deltaColor = delta > 0 ? 'var(--c-danger)' : (delta < 0 ? 'var(--c-success)' : 'var(--text-muted)');
      const expiryRaw = i.expiry_date || i.expiry || i.exp_date || '';
      const expiryLabel = expiryRaw ? new Date(`${expiryRaw}T00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '-';
      return `<tr><td style="padding:6px 4px;font-size:13px">${escHtml(i.product_name||'-')}</td><td style="padding:6px 4px;font-size:13px;text-align:center">${i.qty} ${escHtml(i.uom_symbol || i.product_unit || '')}</td><td style="padding:6px 4px;font-size:13px;text-align:center"><span class="po-expiry-chip">${escHtml(expiryLabel)}</span></td><td style="padding:6px 4px;font-size:13px;text-align:right">KD ${purchaseCost.toFixed(3)}</td><td style="padding:6px 4px;font-size:13px;text-align:right">KD ${currentWac.toFixed(3)}</td><td style="padding:6px 4px;font-size:13px;text-align:right;color:${deltaColor};font-weight:600">${delta >= 0 ? '+' : ''}KD ${delta.toFixed(3)}</td><td style="padding:6px 4px;font-size:13px;text-align:right">KD ${(parseFloat(i.line_total || 0) || (i.qty * purchaseCost)).toFixed(3)}</td></tr>`;
    }).join('');
    showModal(`PO - ${escHtml(o.supplier_name||'-')}`,`
      <div style="background:var(--bg-card);border-radius:6px;padding:12px;margin-bottom:12px;border-left:4px solid var(--c-primary)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
          <div><span class="text-muted">Supplier:</span> <strong style="display:block;margin-top:2px">${escHtml(o.supplier_name||'-')}</strong></div>
          <div><span class="text-muted">Invoice #:</span> <strong style="display:block;margin-top:2px">${escHtml(o.invoice_number||'-')}</strong></div>
          <div><span class="text-muted">Order Date:</span> <strong style="display:block;margin-top:2px">${escHtml(o.order_date||'-')}</strong></div>
          <div><span class="text-muted">Status:</span> <strong style="display:block;margin-top:2px">${o.status==='Received'?'<span class="badge badge-paid">Received</span>':'<span class="badge badge-scheduled">Pending</span>'}</strong></div>
          ${o.received_at?`<div><span class="text-muted">Received Date:</span> <strong style="display:block;margin-top:2px">${escHtml(o.received_at)}</strong></div>`:''}
          ${o.received_store_name?`<div><span class="text-muted">Received To:</span> <strong style="display:block;margin-top:2px">${escHtml(o.received_store_name)}</strong></div>`:''}
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div class="table-wrap po-view-table-wrap"><table style="width:100%;font-size:12px;min-width:900px"><thead><tr style="background:#f5f5f5"><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:left">Product</th><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:center">Qty</th><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:center">Expiry</th><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:right">Cost/Unit</th><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:right">WAC</th><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:right">Diff</th><th style="padding:6px 3px;font-size:12px;font-weight:600;text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
      <div style="background:var(--bg-card);border-radius:6px;padding:10px;text-align:right;font-weight:700;font-size:15px;color:var(--c-primary)">Total: KD ${(o.total_cost||0).toFixed(3)}</div>
      ${o.notes?`<div style="margin-top:10px;padding:10px;background:var(--bg-input);border-radius:6px;font-size:12px;color:var(--text-muted)"><strong>Notes:</strong> ${escHtml(o.notes)}</div>`:''}`,
      can('store.purchase') ? [{ label:'Edit Expiry', class:'btn-primary', async onclick() { closeModal(); openPOExpiryEditor(id); } }] : [], 'modal-po-view');
  } catch(e){toast(e.message,'error');}
}
async function openPOExpiryEditor(id) {
  try {
    const order = await apiFetch(`/api/store/purchase-orders/${id}`);
    const rows = (order.items || []).map((item, idx) => `
      <tr>
        <td><strong>${escHtml(item.product_name || '-')}</strong></td>
        <td class="text-muted text-sm">${escHtml(item.qty)} ${escHtml(item.uom_symbol || item.product_unit || '')}</td>
        <td><input class="po-edit-expiry" data-idx="${idx}" type="date" value="${escHtml(String(item.expiry_date || '').slice(0,10))}"/></td>
      </tr>`).join('');
    showModal(`Update Expiry - PO #${id}`, `
      <div class="text-muted text-sm" style="margin-bottom:10px">This backfills the saved purchase order record used by the View dialog and inventory screens.</div>
      <div class="table-wrap po-view-table-wrap"><table style="width:100%;min-width:560px"><thead><tr><th>Product</th><th>Qty</th><th>Expiry Date</th></tr></thead><tbody>${rows}</tbody></table></div>
    `, async () => {
      const items = [...document.querySelectorAll('.po-edit-expiry')].map(input => ({ expiry_date: input.value }));
      if (items.some(x => !x.expiry_date)) {
        toast('Expiry date is required for every product', 'error');
        return false;
      }
      try {
        await apiFetch(`/api/store/purchase-orders/${id}/expiry`, { method:'PUT', body: JSON.stringify({ items }) });
        toast('Purchase order expiry updated', 'success');
        closeModal();
        _storePOs = await apiFetch('/api/store/purchase-orders');
        filterStorePOs();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }, 'modal-po-view');
  } catch (e) {
    toast(e.message, 'error');
  }
}
async function receivePO(id) {
  try {
    const stores = await apiFetch('/api/store/sub-stores');
    const activeStores = (stores || []).filter(s => s.active !== false);
    if (!activeStores.length) { toast('No active store available', 'error'); return; }
    const defaultStore = activeStores.find(s => s.is_main) || activeStores[0];
    const storeOptions = activeStores.map(s => `<option value="${s.id}" ${s.id===defaultStore.id?'selected':''}>${escHtml(s.name)}${s.is_main?' (Main)':''}</option>`).join('');

    showModal('Receive Purchase Order', `
      <div class="form-group">
        <label>Receive To Store *</label>
        <select id="poReceiveStore">${storeOptions}</select>
      </div>
      <p class="text-muted text-sm">Stock will be added to the selected store and PO status will become Received.</p>
    `, [{
      label: 'Receive',
      class: 'btn-success',
      async onclick() {
        const storeId = document.getElementById('poReceiveStore')?.value;
        if (!storeId) { toast('Select store', 'error'); return false; }
        try {
          const res = await apiFetch(`/api/store/purchase-orders/${id}/receive`, { method:'POST', body: JSON.stringify({ store_id: parseInt(storeId) }) });
          toast(`Stock received in ${res.received_store_name || 'selected store'}`, 'success');
          closeModal();
          storePurchase();
        } catch(e) {
          toast(e.message,'error');
          return false;
        }
      }
    }]);
  } catch(e) {
    toast(e.message,'error');
  }
}
async function deletePO(id) {
  if (!await confirmDialog('Delete this purchase order?')) return;
  try { await apiFetch(`/api/store/purchase-orders/${id}`,{method:'DELETE'}); toast('Order deleted','success'); storePurchase(); } catch(e){toast(e.message,'error');}
}

// -- Stock Transfers -------------------------------------
let _storeTrans = [];
async function storeTransfers() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="transSearch" type="text" placeholder="Search transfers..." oninput="filterStoreTransfers()"/></div>
      <div class="store-action-spacer"></div>
      ${can('store.transfer')?`<button class="btn btn-primary" onclick="openNewTransferModal()">${IC.plus} New Transfer</button>`:''}
    </div>
    <div id="transWrap">${skeletonTable(5)}</div>`;
  try {
    _storeTrans = await apiFetch('/api/store/transfers');
    renderTransfers(_storeTrans);
  } catch(e) { toast(e.message,'error'); }
}
function filterStoreTransfers() {
  const q = (document.getElementById('transSearch')?.value || '').toLowerCase().trim();
  renderTransfers(_storeTrans.filter(t => {
    if (!q) return true;
    return [t.from_store_name, t.to_store_name, t.notes, t.created_at]
      .map(v => String(v || '').toLowerCase())
      .some(v => v.includes(q));
  }));
}
function renderTransfers(list) {
  const wrap = document.getElementById('transWrap'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.transfer,'No transfers','Create your first stock transfer'); return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>From</th><th>To</th><th>Items</th><th>Transfer Value (WAC)</th><th>Date</th><th>Notes</th><th>Actions</th></tr></thead>
    <tbody>${list.map((t,i)=>`<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(t.from_store_name||'-')}</strong></td>
      <td><strong>${escHtml(t.to_store_name||'-')}</strong></td>
      <td>${(t.items||[]).length} item(s)</td>
      <td><strong>KD ${(t.items||[]).reduce((s,it)=>s + (parseFloat(it.total_cost||0)||0),0).toFixed(3)}</strong></td>
      <td class="text-muted text-sm">${escHtml((t.created_at||'').slice(0,16))}</td>
      <td class="text-muted text-sm">${escHtml(t.notes||'-')}</td>
      <td class="td-actions"><button class="btn btn-sm" onclick="viewTransferDetails(${t.id})">${IC.eye} View</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function viewTransferDetails(id) {
  try {
    const [transfers, products] = await Promise.all([
      apiFetch('/api/store/transfers'),
      apiFetch('/api/store/products')
    ]);
    const t = (transfers || []).find(x => x.id === parseInt(id));
    if (!t) { toast('Transfer not found', 'error'); return; }
    const productById = new Map((products || []).map(p => [parseInt(p.id), p]));

    const rows = (t.items || []).map(it => {
      const p = productById.get(parseInt(it.product_id)) || {};
      const name = p.name || `Product #${it.product_id}`;
      const unit = p.uom_symbol || p.unit || '';
      const qty = parseFloat(it.qty || 0) || 0;
      const baseQty = parseFloat(it.base_qty || qty) || 0;
      const unitCost = parseFloat(it.unit_cost || 0) || 0;
      const totalCost = parseFloat(it.total_cost || (baseQty * unitCost) || 0);
      return `<tr>
        <td>${escHtml(name)}</td>
        <td>${qty} ${escHtml(unit || '')}</td>
        <td>${baseQty.toFixed(3)}</td>
        <td>KD ${unitCost.toFixed(3)}</td>
        <td><strong>KD ${totalCost.toFixed(3)}</strong></td>
      </tr>`;
    }).join('');

    const transferTotal = (t.items || []).reduce((sum, it) => sum + (parseFloat(it.total_cost || 0) || 0), 0);
    showModal(`Transfer #${t.id}`, `
      <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap">
        <div><span class="text-muted">From:</span> <strong>${escHtml(t.from_store_name || '-')}</strong></div>
        <div><span class="text-muted">To:</span> <strong>${escHtml(t.to_store_name || '-')}</strong></div>
        <div><span class="text-muted">Date:</span> ${escHtml((t.created_at || '').slice(0,16) || '-')}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Qty</th><th>Base Qty</th><th>Unit Cost (WAC)</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div style="text-align:right;font-weight:700;margin-top:8px">Total Transfer Value: KD ${transferTotal.toFixed(3)}</div>
      ${t.notes ? `<div class="text-muted text-sm" style="margin-top:8px">Notes: ${escHtml(t.notes)}</div>` : ''}
    `, []);
  } catch (e) {
    toast(e.message, 'error');
  }
}
async function openNewTransferModal() {
  let subStores = [], products = [];
  try { [subStores, products] = await Promise.all([apiFetch('/api/store/sub-stores'), apiFetch('/api/store/products')]); } catch{}
  const storeOpts = subStores.map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  window._transProducts = products;
  window._transItemCount = 0;
  showModal('New Stock Transfer', `
    <div class="form-row">
      <div class="form-group"><label>From Store *</label><select id="transFrom" required><option value="">- Select -</option>${storeOpts}</select></div>
      <div class="form-group"><label>To Store *</label><select id="transTo" required><option value="">- Select -</option>${storeOpts}</select></div>
    </div>
    <div class="form-group"><label>Notes</label><input id="transNotes"/></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px">
      <strong>Items</strong>
      <button class="btn btn-sm btn-primary" type="button" onclick="transAddItem()">${IC.plus} Add Item</button>
    </div>
    <div id="transItemsWrap"></div>`,
    [{ label:'Transfer', class:'btn-primary', async onclick() {
      const from_store_id = document.getElementById('transFrom').value;
      const to_store_id   = document.getElementById('transTo').value;
      if (!from_store_id || !to_store_id) { toast('Select both stores','error'); return; }
      if (from_store_id === to_store_id) { toast('From and to store must differ','error'); return; }
      const rows = document.querySelectorAll('.trans-item-row');
      if (!rows.length) { toast('Add at least one item','error'); return; }
      const items = [];
      for (const row of rows) {
        const pid = row.querySelector('.trans-prod-sel').value;
        const qty = parseFloat(row.querySelector('.trans-qty').value||0);
        const uom_id = row.querySelector('.trans-uom-sel')?.value || '';
        if (!pid || qty<=0) { toast('Fill all item fields correctly','error'); return; }
        items.push({ product_id:pid, qty, uom_id });
      }
      try {
        await apiFetch('/api/store/transfers',{method:'POST',body:JSON.stringify({ from_store_id, to_store_id, items, notes:document.getElementById('transNotes').value })});
        toast('Transfer completed','success'); closeModal(); storeTransfers();
      } catch(e){toast(e.message,'error');}
    }}], 'modal-lg');
}
function transAddItem() {
  const wrap = document.getElementById('transItemsWrap'); if(!wrap) return;
  let allProds = window._transProducts || _storeAllProducts;
  const opts = allProds.map(p=>`<option value="${p.id}">${escHtml(p.name)} (${p.uom_symbol || p.unit})</option>`).join('');
  ++window._transItemCount;
  wrap.insertAdjacentHTML('beforeend',`<div class="trans-item-row" style="display:grid;grid-template-columns:1fr 170px 90px 30px;gap:6px;align-items:center;margin-bottom:6px">
    <select class="trans-prod-sel" onchange="transOnProductChange(this)" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text)"><option value="">- Product -</option>${opts}</select>
    <select class="trans-uom-sel" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text)"><option value="">- UOM -</option></select>
    <input class="trans-qty" type="number" min="0.001" step="0.001" value="1" placeholder="Qty" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text);text-align:center"/>
    <button type="button" onclick="this.closest('.trans-item-row').remove()" style="background:none;border:none;cursor:pointer;color:var(--c-danger)">${IC.trash}</button>
  </div>`);
}
function transOnProductChange(sel) {
  const row = sel.closest('.trans-item-row');
  const p = (window._transProducts || []).find(x => String(x.id) === String(sel.value));
  if (!row) return;
  const uomSel = row.querySelector('.trans-uom-sel');
  if (!uomSel) return;
  const options = (p && Array.isArray(p.uom_options) && p.uom_options.length)
    ? p.uom_options
    : (p && p.uom_id ? [{ uom_id: p.uom_id, factor: 1, symbol: p.uom_symbol || p.unit }] : []);
  uomSel.innerHTML = options.length
    ? options.map(o => `<option value="${o.uom_id}" data-factor="${parseFloat(o.factor || 1)}">${escHtml(o.symbol || '')} (x${parseFloat(o.factor || 1).toFixed(3)})</option>`).join('')
    : `<option value="">- UOM -</option>`;
  if (p && p.uom_id) uomSel.value = String(p.uom_id);
}

// -- Stock Adjustments ----------------------------------
let _storeAdjustments = [];
let _saStores = [];
let _saProducts = [];

async function storeAdjustments() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="saSearch" type="text" placeholder="Search adjustments..." oninput="filterStoreAdjustments()"/></div>
      <button class="btn" onclick="exportStoreAdjustmentsCSV()">${IC.download || 'CSV'} Export CSV</button>
      <div class="store-action-spacer"></div>
      ${can('store.adjust') ? `<button class="btn btn-primary" onclick="openNewStockAdjustmentModal()">${IC.plus} New Adjustment</button>` : ''}
    </div>
    <div id="saWrap">${skeletonTable(5)}</div>`;
  try {
    _storeAdjustments = await apiFetch('/api/store/adjustments');
    renderStoreAdjustments(_storeAdjustments);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function filterStoreAdjustments() {
  renderStoreAdjustments(getFilteredStoreAdjustments());
}

function getFilteredStoreAdjustments() {
  const q = (document.getElementById('saSearch')?.value || '').toLowerCase().trim();
  return (_storeAdjustments || []).filter((row) => {
    if (!q) return true;
    return [
      row.adjustment_no,
      row.adjustment_type,
      row.store_name,
      row.product_name,
      row.product_sku,
      row.reason,
      row.remarks,
      row.created_by_name,
      row.created_at
    ].map((v) => String(v || '').toLowerCase()).some((v) => v.includes(q));
  });
}

function renderStoreAdjustments(list) {
  const wrap = document.getElementById('saWrap');
  if (!wrap) return;
  if (!list.length) {
    wrap.innerHTML = emptyState(IC.transfer, 'No adjustments', 'Create stock adjustments for IN or OUT movements');
    return;
  }
  const isAdmin = currentUser && currentUser.role === 'admin';
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Adj No</th><th>Type</th><th>Store</th><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Stock (Before ? After)</th><th>Reason</th><th>Status</th><th>Date</th><th>By</th>${isAdmin ? '<th>Action</th>' : ''}</tr></thead>
    <tbody>${list.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td><span class="code-id code-id-primary">${escHtml(r.adjustment_no || ('ADJ#' + r.id))}</span></td>
      <td>${String(r.adjustment_type || '').toUpperCase() === 'IN' ? '<span class="badge badge-paid">IN</span>' : '<span class="badge badge-unpaid">OUT</span>'}</td>
      <td><strong>${escHtml(r.store_name || '-')}</strong></td>
      <td>${escHtml(r.product_name || '-')}<br><span class="text-muted text-sm">${escHtml(r.product_sku || '')}</span></td>
      <td>${parseFloat(r.qty || 0).toFixed(3)}</td>
      <td>KD ${parseFloat(r.unit_cost || 0).toFixed(3)}</td>
      <td><strong>KD ${parseFloat(r.total_cost || 0).toFixed(3)}</strong></td>
      <td>${parseFloat(r.stock_before || 0).toFixed(3)} ? ${parseFloat(r.stock_after || 0).toFixed(3)}</td>
      <td>${escHtml(r.reason || '-')}<br><span class="text-muted text-sm">${escHtml(r.remarks || '')}</span></td>
      <td>${r.reversal_of_id ? `<span class="badge badge-secondary">Reversal</span>${r.reversal_of_adjustment_no ? `<div class="text-muted text-sm">of ${escHtml(r.reversal_of_adjustment_no)}</div>` : ''}` : (r.reversed_by_adjustment_id ? `<span class="badge badge-cancelled">Reversed</span>${r.reversed_by_adjustment_no ? `<div class="text-muted text-sm">by ${escHtml(r.reversed_by_adjustment_no)}</div>` : ''}` : '<span class="badge badge-completed">Active</span>')}</td>
      <td class="text-muted text-sm">${escHtml(formatDateTime(r.date || r.created_at || ''))}</td>
      <td class="text-muted text-sm">${escHtml(r.created_by_name || '-')}</td>
      ${isAdmin ? `<td>${(!r.reversal_of_id && !r.reversed_by_adjustment_id) ? `<button class="btn btn-sm" onclick="reverseStoreAdjustment(${parseInt(r.id, 10)}, '${escHtml(r.adjustment_no || ('ADJ#' + r.id))}')">${IC.transfer || '?'} Reverse</button>` : '<span class="text-muted text-sm">-</span>'}</td>` : ''}
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function exportStoreAdjustmentsCSV() {
  const rows = getFilteredStoreAdjustments();
  if (!rows.length) { toast('No rows to export', 'error'); return; }
  const header = ['Adjustment No', 'Type', 'Store', 'Product', 'SKU', 'Qty', 'Unit Cost', 'Total Cost', 'Stock Before', 'Stock After', 'Reason', 'Remarks', 'Status', 'Reversal Ref', 'Date', 'Created By'];
  const csvRows = rows.map((r) => {
    const status = r.reversal_of_id ? 'Reversal' : (r.reversed_by_adjustment_id ? 'Reversed' : 'Active');
    const reversalRef = r.reversal_of_adjustment_no || r.reversed_by_adjustment_no || '';
    return [
      r.adjustment_no || ('ADJ#' + r.id),
      r.adjustment_type || '',
      r.store_name || '',
      r.product_name || '',
      r.product_sku || '',
      parseFloat(r.qty || 0).toFixed(3),
      parseFloat(r.unit_cost || 0).toFixed(3),
      parseFloat(r.total_cost || 0).toFixed(3),
      parseFloat(r.stock_before || 0).toFixed(3),
      parseFloat(r.stock_after || 0).toFixed(3),
      r.reason || '',
      r.remarks || '',
      status,
      reversalRef,
      r.date || r.created_at || '',
      r.created_by_name || ''
    ];
  });
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...csvRows].map((row) => row.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_adjustments_${new Date().toLocaleDateString('sv')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('CSV exported', 'success');
}

async function reverseStoreAdjustment(id, adjustmentNo) {
  const label = String(adjustmentNo || ('ADJ#' + id));
  const result = await confirmWithReasonDialog(
    `Reverse adjustment ${label}? This creates an opposite entry.`,
    'Reverse Adjustment',
    'Reversal Reason (optional)',
    'Correction'
  );
  if (!result.confirmed) return;
  try {
    await apiFetch(`/api/store/adjustments/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason: result.reason })
    });
    toast('Adjustment reversed successfully', 'success');
    storeAdjustments();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function openNewStockAdjustmentModal() {
  try {
    const [stores, products] = await Promise.all([
      apiFetch('/api/store/sub-stores'),
      apiFetch('/api/store/products')
    ]);
    _saStores = (stores || []).filter((s) => s.active !== false);
    _saProducts = (products || []).filter((p) => p.active !== false);
    if (!_saStores.length) { toast('No active stores available', 'error'); return; }
    if (!_saProducts.length) { toast('No active products available', 'error'); return; }

    const storeOpts = _saStores.map((s) => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    const productOpts = _saProducts.map((p) => `<option value="${p.id}">${escHtml(p.name)}${p.sku ? ` (${escHtml(p.sku)})` : ''}</option>`).join('');
    const todayStr = new Date().toLocaleDateString('sv');

    showModal('New Stock Adjustment', `
      <form id="saForm">
        <div class="form-row">
          <div class="form-group"><label>Store *</label><select id="saStoreId" name="store_id" onchange="saRefreshStockHint()" required>${storeOpts}</select></div>
          <div class="form-group"><label>Date *</label><input id="saDate" name="date" type="date" value="${todayStr}" required/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Product *</label><select id="saProductId" name="product_id" onchange="saRefreshStockHint()" required>${productOpts}</select></div>
          <div class="form-group"><label>Type *</label><select id="saType" name="adjustment_type" onchange="saRefreshStockHint()" required><option value="IN">IN</option><option value="OUT">OUT</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Quantity *</label><input id="saQty" name="qty" type="number" min="0.001" step="0.001" value="1" required/></div>
          <div class="form-group"><label>Unit Cost (optional)</label><input id="saUnitCost" name="unit_cost" type="number" min="0" step="0.001" value="0"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Reason *</label><input id="saReason" name="reason" value="Adjustment" required/></div>
          <div class="form-group"><label>Remarks</label><input id="saRemarks" name="remarks" placeholder="Optional"/></div>
        </div>
        <div id="saStockHint" class="text-sm text-muted">Loading stock...</div>
      </form>
    `, [{
      label: 'Save Adjustment',
      class: 'btn-primary',
      async onclick(modal) {
        const form = modal.querySelector('#saForm');
        const body = Object.fromEntries(new FormData(form));
        body.store_id = parseInt(body.store_id, 10);
        body.product_id = parseInt(body.product_id, 10);
        body.qty = parseFloat(body.qty || 0);
        body.unit_cost = parseFloat(body.unit_cost || 0);
        if (!body.store_id || !body.product_id || !body.adjustment_type || !(body.qty > 0)) {
          toast('Fill all required fields', 'error');
          return false;
        }
        try {
          await apiFetch('/api/store/adjustments', { method: 'POST', body: JSON.stringify(body) });
          toast('Stock adjustment saved', 'success');
          closeModal();
          storeAdjustments();
        } catch (e) {
          toast(e.message, 'error');
          return false;
        }
      }
    }]);

    saRefreshStockHint();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function saRefreshStockHint() {
  const hint = document.getElementById('saStockHint');
  const storeId = document.getElementById('saStoreId')?.value;
  const productId = parseInt(document.getElementById('saProductId')?.value || 0, 10);
  const type = (document.getElementById('saType')?.value || 'IN').toUpperCase();
  if (!hint || !storeId || !productId) return;
  try {
    const stockRows = await apiFetch(`/api/store/stock?store_id=${encodeURIComponent(storeId)}`);
    const row = (stockRows || []).find((s) => parseInt(s.product_id, 10) === productId);
    const avail = parseFloat(row?.qty || 0) || 0;
    const avgCost = parseFloat(row?.avg_cost || 0) || 0;
    hint.textContent = `${type === 'OUT' ? 'Available' : 'Current'} stock: ${avail.toFixed(3)}${type === 'OUT' ? ' (OUT cannot exceed available)' : ''} - Avg Cost: KD ${avgCost.toFixed(3)}`;
    const costInput = document.getElementById('saUnitCost');
    if (costInput && !(parseFloat(costInput.value || 0) > 0)) costInput.value = avgCost.toFixed(3);
  } catch (e) {
    hint.textContent = `Unable to load stock: ${e.message}`;
  }
}

// -- Sub-Stores ------------------------------------------
let _storeSubStoresList = [];
let _storeBillingStoreId = '';
async function storeSubStores() {
  const ca = document.getElementById('contentArea');
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="ssSearch" type="text" placeholder="Search sub-stores..." oninput="filterSubStores()"/></div>
      ${can('store.manage') ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <label class="text-sm text-muted" for="storeBillingStoreSelect">Billing Store</label>
        <select id="storeBillingStoreSelect" class="form-select" style="width:auto;min-width:220px"></select>
        <button class="btn btn-sm btn-primary" onclick="saveStoreBillingProductStore()">${IC.check} Save</button>
      </div>` : ''}
      <div class="store-action-spacer"></div>
      ${can('store.manage')?`<button class="btn btn-primary" onclick="openAddSubStoreModal()">${IC.plus} Add Sub-Store</button>`:''}
    </div>
    <div id="ssWrap">${skeletonTable(4)}</div>`;
  try {
    const [stores, cfg] = await Promise.all([
      apiFetch('/api/store/sub-stores'),
      can('store.manage') ? apiFetch('/api/setup/profile').catch(() => null) : Promise.resolve(null)
    ]);
    _storeSubStoresList = stores;
    _storeBillingStoreId = cfg && cfg.clinic && cfg.clinic.billing_store_id ? String(cfg.clinic.billing_store_id) : '';
    const billingStoreSelect = document.getElementById('storeBillingStoreSelect');
    if (billingStoreSelect) {
      const activeStores = (_storeSubStoresList || []).filter(s => s.active !== false);
      const fallbackStore = activeStores.find(s => s.is_main) || activeStores[0] || null;
      const effectiveStoreId = _storeBillingStoreId || (fallbackStore ? String(fallbackStore.id) : '');
      billingStoreSelect.innerHTML = activeStores.map(s => `<option value="${s.id}">${escHtml(s.name)}${s.is_main ? ' (Default Main Store)' : ''}</option>`).join('');
      billingStoreSelect.value = effectiveStoreId;
    }
    renderSubStores(_storeSubStoresList);
  } catch(e) { toast(e.message,'error'); }
}

async function saveStoreBillingProductStore() {
  const select = document.getElementById('storeBillingStoreSelect');
  if (!select) return;
  try {
    const next = await apiFetch('/api/setup/profile', {
      method: 'PUT',
      body: JSON.stringify({ billing_store_id: select.value || '' })
    });
    currentSystem = next;
    _storeBillingStoreId = next && next.clinic && next.clinic.billing_store_id ? String(next.clinic.billing_store_id) : '';
    toast('Billing store updated', 'success');
    storeSubStores();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function filterSubStores() {
  const q = (document.getElementById('ssSearch')?.value || '').toLowerCase().trim();
  renderSubStores(_storeSubStoresList.filter(s => {
    if (!q) return true;
    const type = s.is_main ? 'main store' : 'sub-store';
    return [s.name, s.code, type, s.active ? 'active' : 'inactive']
      .map(v => String(v || '').toLowerCase())
      .some(v => v.includes(q));
  }));
}
function renderSubStores(list) {
  const wrap = document.getElementById('ssWrap'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.store,'No sub-stores','Create store locations'); return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Name</th><th>Code</th><th>Type</th><th>Status</th>${can('store.manage')?'<th>Actions</th>':''}</tr></thead>
    <tbody>${list.map((s,i)=>`<tr>
      <td>${i+1}</td>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.code||'-')}</td>
      <td>${s.is_main?'<span class="badge badge-admin">Main Store</span>':'<span class="badge badge-scheduled">Sub-Store</span>'}</td>
      <td>${s.active?'<span class="badge badge-paid">Active</span>':'<span class="badge badge-unpaid">Inactive</span>'}</td>
      ${can('store.manage')?`<td class="td-actions">
        ${!s.is_main?`<button class="btn btn-sm" onclick="openEditSubStoreModal(${s.id})">${IC.edit}</button>`:''}
        ${!s.is_main?`<button class="btn btn-sm btn-danger" onclick="deleteSubStore(${s.id},'${escHtml(s.name)}')">${IC.trash}</button>`:''}
      </td>`:''}
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function openAddSubStoreModal() {
  showModal('Add Sub-Store', `
    <form id="addSSForm">
      <div class="form-row">
        <div class="form-group"><label>Store Name *</label><input name="name" required placeholder="e.g. Pharmacy"/></div>
        <div class="form-group"><label>Code</label><input name="code" placeholder="e.g. PHARM"/></div>
      </div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#addSSForm'));
      try { await apiFetch('/api/store/sub-stores',{method:'POST',body:JSON.stringify(Object.fromEntries(fd.entries()))}); toast('Sub-store added','success'); closeModal(); storeSubStores(); } catch(e){toast(e.message,'error');}
    }}]);
}
async function openEditSubStoreModal(id) {
  const s = _storeSubStoresList.find(x=>x.id===id); if(!s) return;
  showModal('Edit Sub-Store', `
    <form id="editSSForm">
      <div class="form-row">
        <div class="form-group"><label>Store Name *</label><input name="name" value="${escHtml(s.name)}" required/></div>
        <div class="form-group"><label>Code</label><input name="code" value="${escHtml(s.code||'')}"/></div>
      </div>
      <div class="form-group"><label>Active</label><select name="active"><option value="true" ${s.active?'selected':''}>Active</option><option value="false" ${!s.active?'selected':''}>Inactive</option></select></div>
    </form>`,
    [{ label:'Save', class:'btn-primary', async onclick(modal) {
      const fd = new FormData(modal.querySelector('#editSSForm'));
      const body = Object.fromEntries(fd.entries()); body.active = body.active==='true';
      try { await apiFetch(`/api/store/sub-stores/${id}`,{method:'PUT',body:JSON.stringify(body)}); toast('Updated','success'); closeModal(); storeSubStores(); } catch(e){toast(e.message,'error');}
    }}]);
}
async function deleteSubStore(id, name) {
  if (!await confirmDialog(`Delete sub-store "${name}"?`)) return;
  try { await apiFetch(`/api/store/sub-stores/${id}`,{method:'DELETE'}); toast('Deleted','success'); storeSubStores(); } catch(e){toast(e.message,'error');}
}

// -- Manual Consumption ----------------------------------
let _manualConsumptionProducts = [];
let _manualConsumptionStores = [];
let _manualConsumptionStockMap = new Map();

function mcCanViewCost() {
  return can('store.consume.cost');
}

function mcReasonOptions(selected = '') {
  const reasons = ['Treatment Usage', 'Wastage', 'Expired', 'Internal Use', 'Sample', 'Adjustment'];
  return reasons.map(r => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`).join('');
}

function mcAvailableProducts() {
  return _manualConsumptionProducts.filter((product) => {
    if (product.active === false) return false;
    const productId = parseInt(product.id, 10);
    const availableQty = _manualConsumptionStockMap.get(productId)?.qty || 0;
    return availableQty > 0;
  });
}

function mcProductOptions(selectedId = '') {
  return mcAvailableProducts()
    .map(p => `<option value="${p.id}" ${String(selectedId) === String(p.id) ? 'selected' : ''}>${escHtml(p.name)}${p.sku ? ` (${escHtml(p.sku)})` : ''}</option>`)
    .join('');
}

function mcStoreOptions(selectedId = '') {
  return _manualConsumptionStores
    .filter(s => s.active !== false)
    .map(s => `<option value="${s.id}" ${String(selectedId) === String(s.id) ? 'selected' : ''}>${escHtml(s.name)}</option>`)
    .join('');
}

async function storeManualConsumption() {
  const ca = document.getElementById('contentArea');
  const todayStr = new Date().toLocaleDateString('sv');
  const canViewCost = mcCanViewCost();
  ca.innerHTML = `${skeletonTable(6)}`;
  try {
    const [stores, products] = await Promise.all([
      apiFetch('/api/store/sub-stores'),
      apiFetch('/api/store/products?context=manual-consumption')
    ]);
    _manualConsumptionStores = Array.isArray(stores) ? stores : [];
    _manualConsumptionProducts = Array.isArray(products) ? products : [];
    const defaultStore = _manualConsumptionStores.find(s => s.active !== false && s.is_main) || _manualConsumptionStores.find(s => s.active !== false) || null;

    ca.innerHTML = `
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="margin-bottom:10px">${IC.store} Manual Consumption Entry</div>
        <div class="form-row" style="margin-bottom:10px">
          <div class="form-group"><label>Store *</label><select id="mcStore" onchange="mcOnStoreChange()"><option value="">- Select Store -</option>${mcStoreOptions(defaultStore ? defaultStore.id : '')}</select></div>
          <div class="form-group"><label>Date</label><input id="mcDate" type="date" value="${todayStr}"/></div>
        </div>
        <div class="table-wrap"><table class="mc-grid-table">
          <thead><tr><th style="width:24%">Item *</th><th style="width:9%">Qty *</th>${canViewCost ? '<th style="width:10%">Cost</th><th style="width:11%">Total Cost</th>' : ''}<th style="width:16%">Reason</th><th style="width:17%">Remarks</th><th style="width:11%">Stock</th><th style="width:2%"></th></tr></thead>
          <tbody id="mcRows"></tbody>
        </table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="mcAddRow()">${IC.plus} Add Item</button>
            <span class="text-muted text-sm">${canViewCost ? 'Cost auto-fills from store average cost and can be edited.' : 'Cost is applied automatically based on store average cost.'}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${canViewCost ? '<strong>Total Entry Cost: <span id="mcEntryTotal">KD 0.000</span></strong>' : ''}
            <button class="btn btn-success" onclick="saveManualConsumptionEntry()">${IC.check} Save Consumption</button>
          </div>
        </div>
        <div id="mcWarningBox" class="text-sm" style="margin-top:8px;color:var(--c-danger)"></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:8px">Recent Manual Consumption</div>
        <div id="mcRecentWrap">${skeletonTable(3)}</div>
      </div>`;

    await mcOnStoreChange(false);
    mcAddRow();
    mcLoadRecent();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function mcOnStoreChange(recalcRows = true) {
  const storeId = document.getElementById('mcStore')?.value;
  _manualConsumptionStockMap = new Map();
  if (!storeId) {
    mcRefreshProductDropdowns();
    if (recalcRows) mcRecalcAllRows();
    return;
  }
  try {
    const stockRows = await apiFetch(`/api/store/stock?store_id=${encodeURIComponent(storeId)}&context=manual-consumption`);
    for (const s of (stockRows || [])) {
      _manualConsumptionStockMap.set(parseInt(s.product_id, 10), {
        qty: parseFloat(s.qty || 0) || 0,
        cost: parseFloat(s.avg_cost || 0) || 0
      });
    }
    mcRefreshProductDropdowns();
    if (recalcRows) mcRecalcAllRows();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function mcRefreshProductDropdowns() {
  document.querySelectorAll('#mcRows .mc-item').forEach((selectEl) => {
    const selectedValue = selectEl.value;
    const hasSelectedOption = mcAvailableProducts().some((product) => String(product.id) === String(selectedValue));
    selectEl.innerHTML = `<option value="">- Select Item -</option>${mcProductOptions(hasSelectedOption ? selectedValue : '')}`;
    if (!hasSelectedOption) selectEl.value = '';
  });
}

function mcAddRow(seed = {}) {
  const rows = document.getElementById('mcRows');
  if (!rows) return;
  const canViewCost = mcCanViewCost();
  const row = document.createElement('tr');
  row.className = 'mc-row';
  row.innerHTML = `
    <td><select class="mc-item" onchange="mcOnProductChange(this)"><option value="">- Select Item -</option>${mcProductOptions(seed.product_id || '')}</select></td>
    <td><input class="mc-qty" type="number" min="0.001" step="0.001" value="${seed.qty != null ? escHtml(String(seed.qty)) : '1'}" oninput="mcRecalcRow(this.closest('tr'))"/></td>
    ${canViewCost ? `<td><input class="mc-cost" type="number" min="0" step="0.001" value="${seed.cost != null ? escHtml(String(seed.cost)) : '0.000'}" oninput="mcRecalcRow(this.closest('tr'))"/></td>
    <td><strong class="mc-total">KD 0.000</strong></td>` : ''}
    <td><select class="mc-reason" onchange="mcRecalcRow(this.closest('tr'))">${mcReasonOptions(seed.reason || 'Treatment Usage')}</select></td>
    <td><input class="mc-remarks" placeholder="Optional" value="${escHtml(seed.remarks || '')}"/></td>
    <td><span class="mc-stock-note text-muted text-sm">-</span></td>
    <td><button class="btn btn-sm btn-danger" onclick="this.closest('tr').remove();mcRecalcAllRows()">${IC.trash}</button></td>`;
  rows.appendChild(row);
  if (seed.product_id) {
    const sel = row.querySelector('.mc-item');
    if (sel) sel.value = String(seed.product_id);
  }
  mcRecalcRow(row);
}

function mcOnProductChange(sel) {
  const row = sel.closest('tr');
  if (!row) return;
  if (!mcCanViewCost()) {
    mcRecalcRow(row);
    return;
  }
  const productId = parseInt(sel.value, 10);
  const product = _manualConsumptionProducts.find(p => parseInt(p.id, 10) === productId) || null;
  const stockInfo = _manualConsumptionStockMap.get(productId) || null;
  const costInput = row.querySelector('.mc-cost');
  if (costInput) {
    const cost = stockInfo ? stockInfo.cost : (parseFloat(product?.cost_price || 0) || 0);
    costInput.value = cost.toFixed(3);
  }
  mcRecalcRow(row);
}

function mcRecalcRow(row) {
  if (!row) return;
  const canViewCost = mcCanViewCost();
  const productId = parseInt(row.querySelector('.mc-item')?.value || 0, 10);
  const qty = parseFloat(row.querySelector('.mc-qty')?.value || 0) || 0;
  const cost = canViewCost ? (parseFloat(row.querySelector('.mc-cost')?.value || 0) || 0) : 0;
  const total = qty * cost;
  const totalEl = row.querySelector('.mc-total');
  const stockEl = row.querySelector('.mc-stock-note');
  if (canViewCost && totalEl) totalEl.textContent = `KD ${total.toFixed(3)}`;

  if (!productId || !stockEl) {
    if (stockEl) {
      stockEl.textContent = '-';
      stockEl.classList.remove('mc-stock-low');
    }
    mcRecalcEntryTotal();
    return;
  }

  const stockInfo = _manualConsumptionStockMap.get(productId);
  const available = stockInfo ? stockInfo.qty : 0;
  if (qty > available) {
    stockEl.innerHTML = `<span class="mc-stock-low">Low: ${available.toFixed(3)}</span>`;
    stockEl.classList.add('mc-stock-low');
  } else {
    stockEl.textContent = `Avail: ${available.toFixed(3)}`;
    stockEl.classList.remove('mc-stock-low');
  }
  mcRecalcEntryTotal();
}

function mcRecalcEntryTotal() {
  const rows = [...document.querySelectorAll('#mcRows .mc-row')];
  let total = 0;
  let lowCount = 0;
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.mc-qty')?.value || 0) || 0;
    const cost = mcCanViewCost() ? (parseFloat(row.querySelector('.mc-cost')?.value || 0) || 0) : 0;
    total += (qty * cost);
    const productId = parseInt(row.querySelector('.mc-item')?.value || 0, 10);
    const available = (_manualConsumptionStockMap.get(productId)?.qty) || 0;
    if (productId && qty > available) lowCount += 1;
  });
  const totalEl = document.getElementById('mcEntryTotal');
  if (totalEl && mcCanViewCost()) totalEl.textContent = `KD ${total.toFixed(3)}`;

  const warn = document.getElementById('mcWarningBox');
  if (warn) warn.textContent = lowCount ? `${lowCount} row(s) have insufficient stock.` : '';
}

function mcRecalcAllRows() {
  document.querySelectorAll('#mcRows .mc-row').forEach(row => {
    const productSel = row.querySelector('.mc-item');
    if (mcCanViewCost() && productSel && productSel.value) {
      const pid = parseInt(productSel.value, 10);
      const product = _manualConsumptionProducts.find(p => parseInt(p.id, 10) === pid) || null;
      const stockInfo = _manualConsumptionStockMap.get(pid) || null;
      const costInput = row.querySelector('.mc-cost');
      if (costInput && !document.activeElement?.isSameNode(costInput)) {
        const fallbackCost = parseFloat(costInput.value || 0) || 0;
        const nextCost = stockInfo ? stockInfo.cost : (product ? parseFloat(product.cost_price || 0) || 0 : fallbackCost);
        costInput.value = nextCost.toFixed(3);
      }
    }
    mcRecalcRow(row);
  });
  mcRecalcEntryTotal();
}

function mcCollectPayload() {
  const canViewCost = mcCanViewCost();
  const storeId = document.getElementById('mcStore')?.value;
  const date = document.getElementById('mcDate')?.value || new Date().toLocaleDateString('sv');
  if (!storeId) throw new Error('Store is required');
  const rows = [...document.querySelectorAll('#mcRows .mc-row')];
  if (!rows.length) throw new Error('Add at least one item');

  const items = rows.map((row, idx) => {
    const product_id = parseInt(row.querySelector('.mc-item')?.value || 0, 10);
    const qty = parseFloat(row.querySelector('.mc-qty')?.value || 0) || 0;
    const cost = canViewCost ? (parseFloat(row.querySelector('.mc-cost')?.value || 0) || 0) : undefined;
    const reason = row.querySelector('.mc-reason')?.value || 'Adjustment';
    const remarks = row.querySelector('.mc-remarks')?.value || '';
    if (!product_id) throw new Error(`Item is required on row ${idx + 1}`);
    if (!(qty > 0)) throw new Error(`Quantity must be greater than 0 on row ${idx + 1}`);
    return { product_id, qty, ...(canViewCost ? { cost } : {}), reason, remarks };
  });

  return { store_id: parseInt(storeId, 10), date, items };
}

async function saveManualConsumptionEntry() {
  try {
    const payload = mcCollectPayload();
    await apiFetch('/api/store/manual-consumptions', { method:'POST', body: JSON.stringify(payload) });
    toast('Manual consumption saved', 'success');
    storeManualConsumption();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function mcLoadRecent() {
  const wrap = document.getElementById('mcRecentWrap');
  if (!wrap) return;
  const canViewCost = mcCanViewCost();
  try {
    const todayStr = new Date().toLocaleDateString('sv');
    const rows = await apiFetch(`/api/store/manual-consumptions?date_from=${todayStr}&date_to=${todayStr}`);
    if (!rows.length) {
      wrap.innerHTML = '<div class="text-muted">No manual consumption entries today.</div>';
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Entry</th><th>Store</th><th>Lines</th>${canViewCost ? '<th>Total Cost</th>' : ''}<th>Remarks</th></tr></thead>
      <tbody>${rows.slice(0, 20).map(r => `<tr>
        <td>${escHtml(String(r.date || '').slice(0,10) || '-')}</td>
        <td>${escHtml(r.entry_no || ('MC#' + r.id))}</td>
        <td>${escHtml(r.store_name || '-')}</td>
        <td>${(r.items || []).length}</td>
        ${canViewCost ? `<td><strong>KD ${parseFloat(r.total_cost || 0).toFixed(3)}</strong></td>` : ''}
        <td class="text-muted text-sm">${escHtml(r.remarks || '-')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${escHtml(e.message)}</div>`;
  }
}

// =================== Supplier Returns ===================
function openModal(html) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) e.stopPropagation(); });
  setTimeout(() => {
    const first = overlay.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    if (first) first.focus();
  }, 100);
}

let _supplierReturns = [];

async function storeSupplierReturns() {
  const ca = document.getElementById('contentArea');
  const todayStr = new Date().toLocaleDateString('sv');
  ca.innerHTML = `
    <div class="action-bar store-action-bar">
      <div class="search-box"><input id="srSearch" type="text" placeholder="Search returns..." oninput="filterSupplierReturns()"/></div>
      <div class="bill-filter-group">
        <input id="srDateFrom" type="date" value="${todayStr}" title="From date"/>
        <input id="srDateTo"   type="date" value="${todayStr}" title="To date"/>
        <button class="btn report-apply-btn" onclick="filterSupplierReturns()">${IC.search} Filter</button>
        <button class="btn report-clear-btn" onclick="clearSRFilters()">Clear</button>
      </div>
      <div class="store-action-spacer"></div>
      ${can('store.purchase') ? `<button type="button" class="btn btn-primary" id="srNewReturnBtn" onclick="openNewSRModal()">${IC.plus} New Return</button>` : ''}
    </div>
    <div id="srWrap">${skeletonTable(5)}</div>`;
  const newReturnBtn = document.getElementById('srNewReturnBtn');
  if (newReturnBtn) {
    newReturnBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      openNewSRModal();
    });
  }
  try {
    _supplierReturns = await apiFetch('/api/store/supplier-returns');
    filterSupplierReturns();
  } catch (e) { toast(e.message, 'error'); }
}

function clearSRFilters() {
  const t = new Date().toLocaleDateString('sv');
  const f = document.getElementById('srDateFrom');
  const to = document.getElementById('srDateTo');
  const s = document.getElementById('srSearch');
  if (f) f.value = t; if (to) to.value = t; if (s) s.value = '';
  filterSupplierReturns();
}

function filterSupplierReturns() {
  const q    = (document.getElementById('srSearch')?.value || '').toLowerCase().trim();
  const from = document.getElementById('srDateFrom')?.value || '';
  const to   = document.getElementById('srDateTo')?.value || '';
  renderSupplierReturns((_supplierReturns || []).filter(r => {
    const d = String(r.return_date || r.created_at || '').slice(0, 10);
    const textMatch = !q || [r.return_no, r.supplier_name, r.po_invoice, r.return_reference, r.return_type, r.store_name, r.notes]
      .map(v => String(v || '').toLowerCase()).some(v => v.includes(q));
    return textMatch && (!from || d >= from) && (!to || d <= to);
  }));
}

function renderSupplierReturns(list) {
  const wrap = document.getElementById('srWrap'); if (!wrap) return;
  if (!list.length) { wrap.innerHTML = emptyState(IC.supreturn, 'No supplier returns', 'Create a return against a received purchase order'); return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Return No</th><th>Supplier</th><th>PO Invoice</th><th>Type</th><th>Items</th><th>Total</th><th>Return Date</th><th>Actions</th></tr></thead>
    <tbody>${list.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(r.return_no || '-')}</strong></td>
      <td>${escHtml(r.supplier_name || '-')}</td>
      <td class="text-muted text-sm">${escHtml(r.po_invoice || '-')}</td>
      <td>${r.return_type === 'full' ? '<span class="badge badge-paid">Full</span>' : '<span class="badge badge-arrived">Partial</span>'}</td>
      <td>${(r.items || []).length} item(s)</td>
      <td><strong>KD ${parseFloat(r.total_amount || 0).toFixed(3)}</strong></td>
      <td class="text-muted text-sm">${escHtml(r.return_date || '-')}</td>
      <td class="td-actions">
        <div class="apt-actions">
          <button class="btn btn-sm" onclick="viewSRDetails(${r.id})">${IC.eye} View</button>
          ${can('store.manage') ? `<button class="btn btn-sm btn-danger" onclick="voidSR(${r.id},'${escHtml(r.return_no || '')}')">${IC.trash} Void</button>` : ''}
        </div>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function viewSRDetails(id) {
  try {
    const r = await apiFetch(`/api/store/supplier-returns/${id}`);
    const itemRows = (r.items || []).map(it => `<tr>
      <td>${escHtml(it.product_name || `Product #${it.product_id}`)}</td>
      <td>${parseFloat(it.qty || 0).toFixed(3)}</td>
      <td>KD ${parseFloat(it.cost_price || 0).toFixed(3)}</td>
      <td><strong>KD ${parseFloat(it.line_total || 0).toFixed(3)}</strong></td>
    </tr>`).join('');
    openModal(`
      <div class="modal-header"><h3>${IC.supreturn} Return Details - ${escHtml(r.return_no || '')}</h3></div>
      <div class="modal-body">
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:14px;">
          <div><span class="text-muted">Supplier</span><div><strong>${escHtml(r.supplier_name || '-')}</strong></div></div>
          <div><span class="text-muted">PO Invoice</span><div>${escHtml(r.po_invoice || '-')}</div></div>
          <div><span class="text-muted">Return Type</span><div>${r.return_type === 'full' ? '<span class="badge badge-paid">Full Return</span>' : '<span class="badge badge-arrived">Partial Return</span>'}</div></div>
          <div><span class="text-muted">Return Date</span><div>${escHtml(r.return_date || '-')}</div></div>
          <div><span class="text-muted">Store</span><div>${escHtml(r.store_name || '-')}</div></div>
          <div><span class="text-muted">Reference</span><div>${escHtml(r.return_reference || '-')}</div></div>
          ${r.notes ? `<div style="grid-column:1/-1"><span class="text-muted">Notes</span><div>${escHtml(r.notes)}</div></div>` : ''}
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Product</th><th>Qty (Base)</th><th>Unit Cost</th><th>Line Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr><td colspan="3" style="text-align:right"><strong>Total</strong></td><td><strong>KD ${parseFloat(r.total_amount || 0).toFixed(3)}</strong></td></tr></tfoot>
        </table></div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal()">Close</button>
      </div>`);
  } catch (e) { toast(e.message, 'error'); }
}

async function voidSR(id, returnNo) {
  if (!confirm(`Void return ${returnNo}? This will restore all items back into stock.`)) return;
  try {
    await apiFetch(`/api/store/supplier-returns/${id}`, { method: 'DELETE' });
    toast('Return voided - stock restored', 'success');
    storeSupplierReturns();
  } catch (e) { toast(e.message, 'error'); }
}

// --- New Supplier Return Modal ---------------------------
let _srPOs = [];
let _srSelectedPO = null;

async function openNewSRModal() {
  openModal(`
    <div class="modal-header"><h3>${IC.supreturn} New Supplier Return</h3></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Purchase Order (Received only) <span class="required">*</span></label>
        <select id="srPOSel" onchange="srLoadPOItems()" style="width:100%">
          <option value="">Loading...</option>
        </select>
      </div>
      <div id="srItemsSection" style="display:none">
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:12px;">
          <div class="form-group" style="margin:0">
            <label>Return Type <span class="required">*</span></label>
            <select id="srReturnType" onchange="srToggleReturnType()">
              <option value="partial">Partial Return</option>
              <option value="full">Full Return</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label>Return Date</label>
            <input type="date" id="srReturnDate" value="${new Date().toLocaleDateString('sv')}"/>
          </div>
          <div class="form-group" style="margin:0">
            <label>Return Reference #</label>
            <input type="text" id="srReturnRef" placeholder="e.g. CRN-001"/>
          </div>
          <div class="form-group" style="margin:0">
            <label>Notes</label>
            <input type="text" id="srNotes" placeholder="Optional notes"/>
          </div>
        </div>
        <div id="srItemsTable"></div>
        <div style="margin-top:12px;text-align:right">
          <strong>Total: KD <span id="srTotalDisplay">0.000</span></strong>
        </div>
      </div>
      <div id="srLoadingMsg" class="text-muted" style="display:none">Loading items...</div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="srSubmitBtn" onclick="submitSR()" style="display:none">${IC.check} Submit Return</button>
    </div>`);

  const sel = document.getElementById('srPOSel');
  if (!sel) return;
  const isReceivedPO = (p) => {
    const status = String((p && p.status) || '').trim().toLowerCase();
    const hasReceivedAt = !!String((p && p.received_at) || '').trim();
    const hasReceivedStore = Number.isFinite(parseInt((p && p.received_store_id), 10));
    return status === 'received' || hasReceivedAt || hasReceivedStore;
  };

  try {
    const [pos, existingReturns] = await Promise.all([
      apiFetch('/api/store/purchase-orders'),
      apiFetch('/api/store/supplier-returns').catch(() => [])
    ]);
    const fetched = Array.isArray(pos) ? pos : [];
    const fallback = Array.isArray(_storePOs) ? _storePOs : [];
    const allPOs = fetched.length ? fetched : fallback;
    // Build set of PO ids that are already fully returned (and not voided)
    const fullyReturnedPoIds = new Set(
      (Array.isArray(existingReturns) ? existingReturns : [])
        .filter(r => String(r.return_type || '').toLowerCase() === 'full' && !r.voided)
        .map(r => parseInt(r.purchase_order_id))
    );
    _srPOs = allPOs.filter(p => {
      if (!isReceivedPO(p)) return false;
      if (fullyReturnedPoIds.has(parseInt(p.id))) return false;
      // Only allow fully paid POs
      const payStatus = String(p.payment_status || '').toLowerCase();
      return payStatus === 'paid';
    })
      .sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));
    if (!_srPOs.length) {
      sel.innerHTML = `<option value="">No eligible purchase orders (must be Received &amp; Paid)</option>`;
      return;
    }
    sel.innerHTML = `<option value="">- Select Purchase Order -</option>${_srPOs.map(p =>
      `<option value="${p.id}">${escHtml(p.invoice_number || `PO #${p.id}`)} - ${escHtml(p.supplier_name || '-')} (${escHtml(p.order_date || '')})</option>`
    ).join('')}`;
  } catch (e) {
    const fallback = Array.isArray(_storePOs) ? _storePOs : [];
    _srPOs = fallback.filter(isReceivedPO).sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));
    if (_srPOs.length) {
      sel.innerHTML = `<option value="">- Select Purchase Order -</option>${_srPOs.map(p =>
        `<option value="${p.id}">${escHtml(p.invoice_number || `PO #${p.id}`)} - ${escHtml(p.supplier_name || '-')} (${escHtml(p.order_date || '')})</option>`
      ).join('')}`;
      toast('Loaded received POs from local cache', 'warn');
      return;
    }
    sel.innerHTML = `<option value="">Unable to load purchase orders: ${escHtml(e.message || 'Unknown error')}</option>`;
    toast(e.message, 'error');
  }
}

function srLoadPOItems() {
  const poId = parseInt(document.getElementById('srPOSel')?.value || 0);
  const section  = document.getElementById('srItemsSection');
  const loadMsg  = document.getElementById('srLoadingMsg');
  const submitBtn = document.getElementById('srSubmitBtn');
  if (!poId) {
    if (section)  section.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    return;
  }
  _srSelectedPO = _srPOs.find(p => parseInt(p.id) === poId) || null;
  if (!_srSelectedPO) return;
  if (section)  section.style.display = 'block';
  if (submitBtn) submitBtn.style.display = '';
  srRenderItemRows();
}

function srToggleReturnType() {
  const type = document.getElementById('srReturnType')?.value;
  if (type === 'full') {
    const po = _srSelectedPO;
    if (!po) return;
    document.querySelectorAll('.sr-qty-input').forEach((inp, idx) => {
      const item = (po.items || [])[idx];
      if (item) {
        inp.value = parseFloat(item.qty || item.base_qty || 0).toFixed(3);
        inp.readOnly = true;
      }
    });
  } else {
    document.querySelectorAll('.sr-qty-input').forEach(inp => { inp.readOnly = false; inp.value = ''; });
  }
  srRecalcTotal();
}

function srRenderItemRows() {
  const po = _srSelectedPO;
  const wrap = document.getElementById('srItemsTable'); if (!wrap || !po) return;
  const isFull = document.getElementById('srReturnType')?.value === 'full';
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Product</th><th>Ordered Qty</th><th>Unit Cost</th><th>Return Qty <span class="required">*</span></th><th>Line Total</th></tr></thead>
    <tbody>${(po.items || []).map((it, idx) => {
      const ordQty = parseFloat(it.qty || it.base_qty || 0);
      const cost   = parseFloat(it.cost_price || 0);
      const defQty = isFull ? ordQty.toFixed(3) : '';
      const pName  = it.product_name || `Product #${it.product_id}`;
      return `<tr data-pidx="${idx}" data-cost="${cost}">
        <td>${escHtml(pName)}<input type="hidden" class="sr-pid" value="${it.product_id}"/></td>
        <td class="text-muted">${ordQty.toFixed(3)}</td>
        <td>KD ${cost.toFixed(3)}</td>
        <td><input type="number" class="sr-qty-input form-control" style="width:100px" min="0.001" max="${ordQty}" step="0.001" value="${defQty}" ${isFull ? 'readonly' : ''} oninput="srRecalcTotal()"/></td>
        <td class="sr-line-total">KD 0.000</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
  srRecalcTotal();
}

function srRecalcTotal() {
  let total = 0;
  document.querySelectorAll('#srItemsTable tbody tr').forEach(row => {
    const qty  = parseFloat(row.querySelector('.sr-qty-input')?.value || 0) || 0;
    const cost = parseFloat(row.dataset.cost || 0) || 0;
    const lineTotal = qty * cost;
    total += lineTotal;
    const ltCell = row.querySelector('.sr-line-total');
    if (ltCell) ltCell.textContent = `KD ${lineTotal.toFixed(3)}`;
  });
  const disp = document.getElementById('srTotalDisplay');
  if (disp) disp.textContent = total.toFixed(3);
}

async function submitSR() {
  const poId = parseInt(document.getElementById('srPOSel')?.value || 0);
  const returnType = document.getElementById('srReturnType')?.value || 'partial';
  const returnDate = document.getElementById('srReturnDate')?.value || '';
  const returnRef  = document.getElementById('srReturnRef')?.value?.trim() || '';
  const notes      = document.getElementById('srNotes')?.value?.trim() || '';
  if (!poId) { toast('Select a purchase order', 'error'); return; }

  const items = [];
  document.querySelectorAll('#srItemsTable tbody tr').forEach(row => {
    const pid = parseInt(row.querySelector('.sr-pid')?.value || 0);
    const qty = parseFloat(row.querySelector('.sr-qty-input')?.value || 0);
    const cost = parseFloat(row.dataset.cost || 0);
    if (pid > 0 && qty > 0) {
      items.push({ product_id: pid, qty, base_qty: qty, cost_price: cost });
    }
  });

  if (!items.length) { toast('Enter return quantity for at least one item', 'error'); return; }

  const btn = document.getElementById('srSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    await apiFetch('/api/store/supplier-returns', {
      method: 'POST',
      body: JSON.stringify({ purchase_order_id: poId, return_type: returnType, return_date: returnDate, return_reference: returnRef, notes, items })
    });
    toast('Supplier return created successfully', 'success');
    closeModal();
    storeSupplierReturns();
  } catch (e) {
    toast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = `${IC.check} Submit Return`; }
  }
}

if (typeof window !== 'undefined') {
  window.storeSupplierReturns = storeSupplierReturns;
  window.openNewSRModal = openNewSRModal;
  window.srLoadPOItems = srLoadPOItems;
  window.srToggleReturnType = srToggleReturnType;
  window.submitSR = submitSR;
}


