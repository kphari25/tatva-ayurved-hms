// Calculations behind the Analytics "Medicines Sold" dashboard: date ranges
// (day / week / month, weeks run Monday-Sunday) and roll-ups of medicine_sales
// bills into per-medicine and per-day totals. Pure functions, no Firestore.

import { localDateString } from './expenses';

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

export const addMonths = (s, n) => {
  const d = parse(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return fmt(d);
};

export const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 86400000);

const nice = (s, opts) => parse(s).toLocaleDateString('en-IN', opts);

// The calendar period containing `anchor` for the chosen mode.
export const periodRange = (mode, anchor) => {
  if (mode === 'day') {
    return { from: anchor, to: anchor, label: nice(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
  }
  if (mode === 'week') {
    const d = parse(anchor);
    const mondayOffset = (d.getDay() + 6) % 7; // Monday = 0
    const from = addDays(anchor, -mondayOffset);
    const to = addDays(from, 6);
    return { from, to, label: `${nice(from, { day: 'numeric', month: 'short' })} – ${nice(to, { day: 'numeric', month: 'short', year: 'numeric' })}` };
  }
  const d = parse(anchor);
  const from = fmt(new Date(d.getFullYear(), d.getMonth(), 1));
  const to = fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { from, to, label: nice(anchor, { month: 'long', year: 'numeric' }) };
};

// Same mode, one period earlier — used for the "vs previous" comparison.
export const previousRange = (mode, range) => {
  if (mode === 'day') return periodRange('day', addDays(range.from, -1));
  if (mode === 'week') return periodRange('week', addDays(range.from, -7));
  return periodRange('month', addMonths(range.from, -1));
};

export const stepAnchor = (mode, anchor, direction) => {
  if (mode === 'day') return addDays(anchor, direction);
  if (mode === 'week') return addDays(anchor, 7 * direction);
  return addMonths(anchor, direction);
};

// The day a bill belongs to (YYYY-MM-DD, local time).
export const saleDay = (sale) => {
  if (sale.sale_date) return String(sale.sale_date).slice(0, 10);
  const d = new Date(sale.created_at);
  return isNaN(d) ? '' : localDateString(d);
};

const round2 = (v) => Math.round(v * 100) / 100;
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const medicineKey = (line) =>
  line.inventoryId || (line.code ? `code:${String(line.code).toLowerCase()}` : `name:${String(line.name).trim().toLowerCase()}`);

// One row per medicine on a bill.
export const flattenLines = (sales) => {
  const lines = [];
  sales.forEach(s => {
    const date = saleDay(s);
    if (!date) return;
    (s.items || []).forEach((it, idx) => {
      const qty = num(it.quantity);
      if (!(qty > 0)) return;
      const line = {
        id: `${s.id}-${idx}`,
        date,
        billId: s.id,
        billNo: s.bill_number || '',
        customer: s.customer_name || '',
        name: it.name || it.item_name || 'Unnamed item',
        code: it.item_code || '',
        inventoryId: it.inventory_id || '',
        qty,
        rate: num(it.rate),
      };
      line.value = line.qty * line.rate;
      line.key = medicineKey(line);
      lines.push(line);
    });
  });
  return lines;
};

// Totals for bills / lines dated from..to (inclusive).
export const summarizePeriod = (sales, lines, from, to) => {
  const bills = sales.filter(s => { const d = saleDay(s); return d >= from && d <= to; });
  const inRange = lines.filter(l => l.date >= from && l.date <= to);

  const byMed = new Map();
  inRange.forEach(l => {
    let m = byMed.get(l.key);
    if (!m) {
      m = { key: l.key, name: l.name, code: l.code, inventoryId: l.inventoryId, qty: 0, value: 0, billIds: new Set(), lastSold: '' };
      byMed.set(l.key, m);
    }
    m.qty += l.qty;
    m.value += l.value;
    m.billIds.add(l.billId);
    if (l.date > m.lastSold) m.lastSold = l.date;
  });
  const medicines = [...byMed.values()].map(m => ({ ...m, qty: round2(m.qty), value: round2(m.value), bills: m.billIds.size, billIds: undefined }));

  const units = round2(inRange.reduce((n, l) => n + l.qty, 0));
  const itemValue = round2(inRange.reduce((n, l) => n + l.value, 0));
  const billed = bills.reduce((n, s) => n + num(s.total_amount), 0);

  return {
    medicines,
    units,
    itemValue,
    billed,
    billCount: bills.length,
    distinct: medicines.length,
    avgBill: bills.length ? billed / bills.length : 0,
  };
};

// One entry per day from..to — units, item value and bill count.
export const dailySeries = (sales, lines, from, to) => {
  const days = [];
  const index = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const entry = { date: d, units: 0, value: 0, bills: 0 };
    index.set(d, entry);
    days.push(entry);
  }
  lines.forEach(l => {
    const e = index.get(l.date);
    if (e) { e.units = round2(e.units + l.qty); e.value = round2(e.value + l.value); }
  });
  sales.forEach(s => {
    const e = index.get(saleDay(s));
    if (e) e.bills += 1;
  });
  return days;
};

// Percentage change vs the previous period; null when there's nothing to compare to.
export const pctChange = (current, previous) => {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
};
