const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'clinic-data.sqlite');
const JSON_FILE = path.join(DATA_DIR, 'clinic-data.json');

const sqlite = new Database(SQLITE_FILE);
const row = sqlite.prepare('SELECT data FROM app_state WHERE id = 1').get();

if (!row || !row.data) {
  throw new Error('app_state not found');
}

const state = JSON.parse(row.data);
state.store_products = Array.isArray(state.store_products) ? state.store_products : [];
state.store_product_uoms = Array.isArray(state.store_product_uoms) ? state.store_product_uoms : [];
state.store_stock = Array.isArray(state.store_stock) ? state.store_stock : [];
state.bills = Array.isArray(state.bills) ? state.bills : [];
state._seq = state._seq || {};

const existingById = new Map(state.store_products.map((product) => [parseInt(product.id, 10), product]));
const stockByProduct = new Map();
const billHints = new Map();

for (const stockRow of state.store_stock) {
  const productId = parseInt(stockRow.product_id, 10);
  if (!productId) continue;
  const current = stockByProduct.get(productId) || { avgCostTotal: 0, count: 0 };
  current.avgCostTotal += Number(stockRow.avg_cost || 0);
  current.count += 1;
  stockByProduct.set(productId, current);
}

for (const bill of state.bills) {
  for (const item of Array.isArray(bill.line_items) ? bill.line_items : []) {
    if (String(item.type || '').toLowerCase() !== 'product') continue;
    const productId = parseInt(item.ref_id, 10);
    if (!productId) continue;
    const current = billHints.get(productId) || {};
    if (!current.name && item.name && !String(item.name).startsWith('Deleted product #')) {
      current.name = String(item.name);
    }
    if (!current.unit && item.unit) {
      current.unit = String(item.unit);
    }
    const qty = Number(item.qty || 0);
    const amount = Number(item.amount || 0);
    if (!current.sell_price && qty > 0 && amount > 0) {
      current.sell_price = Number((amount / qty).toFixed(3));
    }
    billHints.set(productId, current);
  }
}

const restoreDefs = [
  { id: 1, name: 'Disposable Gloves (Box)', unit: 'box', uom_id: 2, category: 'Consumables' },
  { id: 2, name: 'Restored product #2', unit: 'pcs', uom_id: 1, category: 'Consumables' },
  { id: 3, name: 'Paracetamol 500mg', unit: 'strip', uom_id: 3, category: 'Medicines' },
  { id: 4, name: 'Restored product #4', unit: 'pcs', uom_id: 1, category: 'Consumables' },
  { id: 5, name: 'Restored product #5', unit: 'pcs', uom_id: 1, category: 'Consumables' },
  { id: 6, name: 'Restored product #6', unit: 'pcs', uom_id: 1, category: 'Consumables' },
  { id: 7, name: 'Restored product #7', unit: 'pcs', uom_id: 1, category: 'Consumables' }
];

const uomConversions = [
  { product_id: 6, uom_id: 2, factor: 5 },
  { product_id: 7, uom_id: 2, factor: 2 }
];

const restored = [];

for (const def of restoreDefs) {
  const stock = stockByProduct.get(def.id) || { avgCostTotal: 0, count: 0 };
  const hint = billHints.get(def.id) || {};
  const costPrice = stock.count ? Number((stock.avgCostTotal / stock.count).toFixed(3)) : 0;
  const sellPrice = hint.sell_price || costPrice;
  const product = existingById.get(def.id);

  if (product) {
    product.name = product.name || hint.name || def.name;
    product.unit = product.unit || hint.unit || def.unit;
    product.uom_id = product.uom_id || def.uom_id;
    product.category = product.category || def.category;
    product.cost_price = Number(product.cost_price || costPrice || 0);
    product.sell_price = Number(product.sell_price || sellPrice || 0);
    product.reorder_level = Number(product.reorder_level || 0);
    product.description = product.description || 'Restored from stock history';
    product.active = true;
    restored.push({ id: def.id, name: product.name, mode: 'reactivated' });
    continue;
  }

  const createdAt = new Date().toLocaleString('sv').replace('T', ' ');
  const recovered = {
    id: def.id,
    name: hint.name || def.name,
    sku: '',
    uom_id: def.uom_id,
    unit: hint.unit || def.unit,
    category: def.category,
    cost_price: costPrice,
    sell_price: sellPrice,
    reorder_level: 0,
    description: 'Restored from stock history',
    active: true,
    created_at: createdAt
  };
  state.store_products.push(recovered);
  existingById.set(def.id, recovered);
  restored.push({ id: def.id, name: recovered.name, mode: 'restored' });
}

for (const conversion of uomConversions) {
  const exists = state.store_product_uoms.some((item) => parseInt(item.product_id, 10) === conversion.product_id && parseInt(item.uom_id, 10) === conversion.uom_id);
  if (!exists) {
    state.store_product_uoms.push({
      product_id: conversion.product_id,
      uom_id: conversion.uom_id,
      factor: conversion.factor,
      created_at: new Date().toLocaleString('sv').replace('T', ' ')
    });
  }
}

state._seq.store_products = Math.max(Number(state._seq.store_products || 0), 7);

const payload = JSON.stringify(state);
sqlite.prepare('UPDATE app_state SET data = ?, updated_at = ? WHERE id = 1').run(payload, new Date().toISOString());
fs.writeFileSync(JSON_FILE, JSON.stringify(state, null, 2));

console.log(JSON.stringify(restored, null, 2));