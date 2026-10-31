// Calculations behind the Analytics "Inventory" dashboard. Stock records are
// grouped into medicines by name (the same medicine is often several records,
// one per batch), and each medicine's real sales from medicine_sales bills
// decide whether it is selling, slow, or dead stock — instead of guessing from
// when the stock record was last edited.

import { addDays, daysBetween, saleDay } from './salesAnalytics';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(v * 100) / 100;

export const normName = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');

const toDay = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Earliest expiry among the batches that still hold stock (falls back to the
// record's own expiry date).
export const recordExpiry = (rec) => {
  const fromBatches = (rec.batches || [])
    .filter(b => num(b.quantity) > 0)
    .map(b => toDay(b.expiry_date))
    .filter(Boolean);
  const own = toDay(rec.expiry_date);
  const all = fromBatches.length ? fromBatches : (own ? [own] : []);
  return all.sort()[0] || '';
};

export const buildMedicines = ({ inventory, lines, today, lowLimit = 10, coverDays = 14, soonDays = 90 }) => {
  const byId = new Map(inventory.map(r => [r.id, r]));
  const byCode = new Map();
  inventory.forEach(r => { if (r.item_code) byCode.set(String(r.item_code).toLowerCase(), r); });

  const groups = new Map();
  inventory.forEach(r => {
    const key = normName(r.item_name) || `id:${r.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, name: r.item_name || r.item_code || 'Unnamed', records: [], salesLines: [] };
      groups.set(key, g);
    }
    g.records.push(r);
  });

  // Link each sold line to a medicine: by stock record id, then item code, then name.
  const unlinked = { lines: 0, units: 0, names: new Set() };
  lines.forEach(l => {
    const rec = (l.inventoryId && byId.get(l.inventoryId)) || (l.code && byCode.get(String(l.code).toLowerCase()));
    const key = rec ? (normName(rec.item_name) || `id:${rec.id}`) : normName(l.name);
    const g = groups.get(key);
    if (g) g.salesLines.push(l);
    else { unlinked.lines += 1; unlinked.units += l.qty; unlinked.names.add(l.name); }
  });

  const d30 = addDays(today, -29);
  const d90 = addDays(today, -89);
  const historyStart = lines.reduce((min, l) => (!min || l.date < min ? l.date : min), '');

  const medicines = [...groups.values()].map(g => {
    const stock = round2(g.records.reduce((n, r) => n + num(r.stock_quantity), 0));
    const costOf = (r) => num(r.purchase_price ?? r.purchase_rate);
    const mrpOf = (r) => num(r.MRP ?? r.mrp);
    const costValue = g.records.reduce((n, r) => n + Math.max(0, num(r.stock_quantity)) * costOf(r), 0);
    const mrpValue = g.records.reduce((n, r) => n + Math.max(0, num(r.stock_quantity)) * mrpOf(r), 0);
    const negative = g.records.some(r => num(r.stock_quantity) < 0);
    const reorderLevel = Math.max(0, ...g.records.map(r => num(r.reorder_level)));
    const expiry = g.records.filter(r => num(r.stock_quantity) > 0).map(recordExpiry).filter(Boolean).sort()[0] || '';

    const sold = (from) => round2(g.salesLines.filter(l => l.date >= from).reduce((n, l) => n + l.qty, 0));
    const sold30 = sold(d30);
    const sold90 = sold(d90);
    const soldAll = round2(g.salesLines.reduce((n, l) => n + l.qty, 0));
    const lastSold = g.salesLines.reduce((max, l) => (l.date > max ? l.date : max), '');

    const inStock = stock > 0;
    const health = inStock ? (sold30 > 0 ? 'active' : sold90 > 0 ? 'slow' : 'dead') : 'out';
    const velocity = sold30 > 0 ? sold30 / 30 : sold90 > 0 ? sold90 / 90 : 0;
    const daysLeft = inStock && velocity > 0 ? Math.round(stock / velocity) : null;
    const expiryDays = expiry ? daysBetween(today, expiry) : null;

    return {
      key: g.key,
      name: g.name,
      codes: [...new Set(g.records.map(r => r.item_code).filter(Boolean))],
      manufacturer: g.records.map(r => (r.manufacturer || '').trim()).find(Boolean) || '',
      records: g.records,
      salesLines: g.salesLines,
      stock, costValue: round2(costValue), mrpValue: round2(mrpValue),
      reorderLevel, expiry, expiryDays,
      sold30, sold90, soldAll, lastSold, daysLeft,
      health, inStock,
      flags: {
        inStock,
        out: !inStock,
        negative,
        low: inStock && (reorderLevel > 0 ? stock <= reorderLevel : stock < lowLimit),
        reorder: inStock && daysLeft !== null && daysLeft < coverDays,
        outSelling: !inStock && sold90 > 0,
        expiring: inStock && expiryDays !== null && expiryDays >= 0 && expiryDays <= soonDays,
        expired: inStock && expiryDays !== null && expiryDays < 0,
        active: health === 'active',
        slow: health === 'slow',
        dead: health === 'dead',
      },
    };
  });

  const totals = {
    medicines: medicines.length,
    inStock: medicines.filter(m => m.inStock).length,
    costValue: round2(medicines.reduce((n, m) => n + m.costValue, 0)),
    mrpValue: round2(medicines.reduce((n, m) => n + m.mrpValue, 0)),
    withExpiry: medicines.filter(m => m.inStock && m.expiry).length,
    soldLast30: medicines.filter(m => m.sold30 > 0).length,
  };

  return { medicines, unlinked: { lines: unlinked.lines, units: round2(unlinked.units), names: [...unlinked.names] }, historyStart, totals };
};

// Last `count` calendar months, oldest first: money billed for medicines vs
// medicine purchases entered in Expenses. Keys are YYYY-MM.
export const monthlyTrend = (sales, expenses, today, count = 6) => {
  const [ty, tm] = today.split('-').map(Number);
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ty, tm - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      fullLabel: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      sales: 0, purchases: 0, bills: [], purchaseRows: [],
    });
  }
  const index = new Map(months.map(m => [m.key, m]));
  sales.forEach(s => {
    const m = index.get(saleDay(s).slice(0, 7));
    if (!m) return;
    m.sales += num(s.total_amount);
    m.bills.push(s);
  });
  expenses.forEach(e => {
    if (String(e.category || '').toLowerCase() !== 'medicine_purchase') return;
    const day = toDay(e.date || e.created_at);
    const m = index.get(day.slice(0, 7));
    if (!m) return;
    m.purchases += num(e.amount);
    m.purchaseRows.push({ ...e, day });
  });
  months.forEach(m => { m.sales = round2(m.sales); m.purchases = round2(m.purchases); });
  return months;
};

// ── Reorder & expiry ────────────────────────────────────────────────────────

export const EXPIRY_BUCKETS = [
  { id: 'expired', label: 'Expired', test: d => d < 0 },
  { id: 'd30', label: 'Within 30 days', test: d => d >= 0 && d <= 30 },
  { id: 'd60', label: '31–60 days', test: d => d > 30 && d <= 60 },
  { id: 'd90', label: '61–90 days', test: d => d > 60 && d <= 90 },
  { id: 'd180', label: '91–180 days', test: d => d > 90 && d <= 180 },
  { id: 'later', label: 'Later', test: d => d > 180 },
];

export const expiryBucket = (days) => (EXPIRY_BUCKETS.find(b => b.test(days)) || { id: 'later' }).id;

// One row per stock record that still holds stock, with its expiry (if entered).
export const stockRecords = (inventory, today) => inventory
  .filter(r => num(r.stock_quantity) > 0)
  .map(r => {
    const stock = num(r.stock_quantity);
    const expiry = recordExpiry(r);
    const days = expiry ? daysBetween(today, expiry) : null;
    return {
      id: r.id,
      name: r.item_name || r.item_code || 'Unnamed',
      code: r.item_code || '',
      batch: r.batch_number || r.batches?.[0]?.batch_number || '',
      stock,
      costValue: round2(stock * num(r.purchase_price ?? r.purchase_rate)),
      expiry,
      days,
      bucket: expiry ? expiryBucket(days) : 'none',
      record: r,
    };
  });

const latestCost = (records) => {
  const sorted = [...records].sort((a, b) => String(b.purchase_date || b.last_purchase_date || '').localeCompare(String(a.purchase_date || a.last_purchase_date || '')));
  const hit = sorted.find(r => num(r.purchase_price ?? r.purchase_rate) > 0);
  return hit ? num(hit.purchase_price ?? hit.purchase_rate) : 0;
};

// Medicines worth reordering: running short against their sales, already out but still selling,
// or at their own reorder level. The suggested quantity covers `targetDays` of sales
// at the recent selling rate, less what is already in stock.
export const suggestReorder = (medicines, targetDays = 30) => medicines
  .filter(m => m.flags.outSelling || m.flags.reorder || (m.reorderLevel > 0 && m.flags.low))
  .map(m => {
    const velocity = m.sold30 > 0 ? m.sold30 / 30 : m.sold90 > 0 ? m.sold90 / 90 : 0;
    const have = Math.max(0, m.stock);
    const suggested = Math.max(1, Math.ceil(velocity * targetDays - have));
    const unitCost = latestCost(m.records);
    const priority = m.flags.outSelling ? 'urgent' : (m.daysLeft !== null && m.daysLeft < 7) ? 'high' : 'normal';
    const recordId = (m.records.find(r => r.item_name === m.name) || m.records[0])?.id || '';
    return { key: m.key, recordId, reorderLevel: m.reorderLevel, name: m.name, code: m.codes[0] || '', stock: m.stock, sold30: m.sold30, sold90: m.sold90, daysLeft: m.daysLeft, lastSold: m.lastSold, velocity, suggested, unitCost, priority };
  })
  .sort((a, b) => ({ urgent: 0, high: 1, normal: 2 }[a.priority] - { urgent: 0, high: 1, normal: 2 }[b.priority]) || ((a.daysLeft ?? -1) - (b.daysLeft ?? -1)));
