import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, X, Download, ArrowUpDown, IndianRupee, Package, TrendingUp, PackageX, AlertTriangle,
  Hourglass, ShoppingCart, CalendarClock, Ban, Info,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { localDateString } from '../lib/expenses';
import { flattenLines } from '../lib/salesAnalytics';
import { buildMedicines, monthlyTrend } from '../lib/inventoryHealth';

const TEAL = '#0d9488';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GRAY = '#9ca3af';

const n0 = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const n2 = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const rupees = (v) => `₹${n0(v)}`;
const fmtDay = (s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', opts) : '—';

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'inStock', label: 'In stock', test: m => m.flags.inStock },
  { id: 'out', label: 'Out of stock', test: m => m.flags.out },
  { id: 'low', label: 'Low stock', test: m => m.flags.low },
  { id: 'reorder', label: 'Reorder soon', test: m => m.flags.reorder },
  { id: 'outSelling', label: 'Out of stock but selling', test: m => m.flags.outSelling },
  { id: 'active', label: 'Selling (30 days)', test: m => m.flags.active },
  { id: 'slow', label: 'Slow (31–90 days)', test: m => m.flags.slow },
  { id: 'dead', label: 'Dead stock', test: m => m.flags.dead },
  { id: 'expiring', label: 'Expiring / expired', test: m => m.flags.expiring || m.flags.expired },
  { id: 'negative', label: 'Negative stock', test: m => m.flags.negative },
];

const STATUS = {
  active: { label: 'Selling', cls: 'bg-green-100 text-green-800' },
  slow: { label: 'Slow', cls: 'bg-amber-100 text-amber-800' },
  dead: { label: 'Dead', cls: 'bg-red-100 text-red-800' },
  out: { label: 'Out of stock', cls: 'bg-gray-200 text-gray-700' },
};

const Tile = ({ icon: Icon, color, label, value, sub, onClick, active }) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border shadow-sm p-4 transition ${active ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200'} ${onClick ? 'hover:shadow-md hover:border-teal-300 cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500 leading-tight">{label}</span>
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1f` }}>
          {React.createElement(Icon, { className: 'w-4 h-4', style: { color } })}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="mt-1.5 text-xs text-gray-500 min-h-[1rem]">{sub}</div>
    </Wrapper>
  );
};

// ── Medicine detail ─────────────────────────────────────────────────────────
const MedicineModal = ({ med, onClose }) => {
  const sales = [...med.salesLines].sort((a, b) => b.date.localeCompare(a.date) || b.billNo.localeCompare(a.billNo));
  const st = STATUS[med.health];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-teal-700 text-white px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">{med.name}</h2>
            <p className="text-teal-100 text-sm">{med.records.length} stock record{med.records.length === 1 ? '' : 's'}{med.codes[0] ? ` · ${med.codes[0]}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-teal-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
            {med.flags.negative && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Negative stock record</span>}
            {med.flags.low && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Low stock</span>}
            {med.flags.reorder && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Reorder soon</span>}
            {med.flags.outSelling && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Out of stock but selling</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              ['In stock', n2(med.stock), `Worth ${rupees(med.costValue)} at cost`],
              ['Sold last 30 days', n2(med.sold30), `${n2(med.sold90)} in 90 days`],
              ['Sold all time', n2(med.soldAll), med.lastSold ? `Last sold ${fmtDay(med.lastSold)}` : 'Never sold'],
              ['Stock lasts about', med.daysLeft === null ? '—' : `${n0(med.daysLeft)} days`, med.daysLeft === null ? 'no recent sales to estimate' : 'at the recent selling rate'],
            ].map(([label, big, small]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-bold">{big}</div>
                <div className="text-xs text-gray-500">{small}</div>
              </div>
            ))}
          </div>

          <h3 className="font-semibold mb-2">Stock records</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3 text-right">In stock</th>
                  <th className="py-2 pr-3 text-right">Cost</th>
                  <th className="py-2 pr-3 text-right">MRP</th>
                  <th className="py-2 pr-3">Bought</th>
                  <th className="py-2">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {med.records.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-gray-500">{r.item_code || '—'}</td>
                    <td className="py-2 pr-3">{r.batch_number || r.batches?.[0]?.batch_number || '—'}</td>
                    <td className={`py-2 pr-3 text-right ${Number(r.stock_quantity) < 0 ? 'text-red-600 font-semibold' : ''}`}>{n2(r.stock_quantity)}</td>
                    <td className="py-2 pr-3 text-right">{n2(r.purchase_price ?? r.purchase_rate)}</td>
                    <td className="py-2 pr-3 text-right">{n2(r.MRP ?? r.mrp)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.purchase_date ? fmtDay(String(r.purchase_date).slice(0, 10), { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                    <td className="py-2">{r.expiry_date ? fmtDay(String(r.expiry_date).slice(0, 10)) : <span className="text-gray-400">not entered</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mb-2">Sales history</h3>
          {sales.length === 0 ? (
            <p className="text-sm text-gray-500">No sales recorded for this medicine.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Bill</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 50).map(l => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(l.date)}</td>
                      <td className="py-2 pr-3">{l.billNo || '—'}</td>
                      <td className="py-2 pr-3">{l.customer || '—'}</td>
                      <td className="py-2 text-right">{n2(l.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Month drill-down ────────────────────────────────────────────────────────
const MonthModal = ({ month, onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 bg-indigo-700 text-white px-6 py-4 flex items-start justify-between rounded-t-2xl">
        <div>
          <h2 className="text-xl font-bold">{month.fullLabel}</h2>
          <p className="text-indigo-100 text-sm">Medicine sales {rupees(month.sales)} · purchases {rupees(month.purchases)}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded hover:bg-indigo-800"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6">
        <h3 className="font-semibold mb-2">Medicine bills ({month.bills.length})</h3>
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Bill</th><th className="py-2 pr-3">Customer</th><th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...month.bills].sort((a, b) => String(b.sale_date).localeCompare(String(a.sale_date))).map(b => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(String(b.sale_date || '').slice(0, 10))}</td>
                <td className="py-2 pr-3">{b.bill_number || '—'}</td>
                <td className="py-2 pr-3">{b.customer_name || '—'}</td>
                <td className="py-2 text-right font-medium">{rupees(b.total_amount)}</td>
              </tr>
            ))}
            {month.bills.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-500">No medicine bills this month</td></tr>}
          </tbody>
        </table>
        <h3 className="font-semibold mb-2">Medicine purchases from Expenses ({month.purchaseRows.length})</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Details</th><th className="py-2 pr-3">Vendor</th><th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[...month.purchaseRows].sort((a, b) => b.day.localeCompare(a.day)).map((e, i) => (
              <tr key={i} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(e.day)}</td>
                <td className="py-2 pr-3 whitespace-pre-line break-words">{String(e.description || '—').split('\n')[0]}</td>
                <td className="py-2 pr-3">{e.vendor || '—'}</td>
                <td className="py-2 text-right font-medium">{rupees(e.amount)}</td>
              </tr>
            ))}
            {month.purchaseRows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-500">No medicine purchases this month</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ── Page ────────────────────────────────────────────────────────────────────
const InventoryHealthDashboard = () => {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState({ inventory: false, sales: false, expenses: false });
  const [error, setError] = useState('');
  const [lowLimit, setLowLimit] = useState(10);
  const [coverDays, setCoverDays] = useState(14);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'costValue', dir: 'desc' });
  const [limit, setLimit] = useState(100);
  const [detailKey, setDetailKey] = useState(null);
  const [monthKey, setMonthKey] = useState(null);

  // Everything is live: a sale, a stock edit or a new purchase updates this page by itself.
  useEffect(() => {
    const done = (name) => setLoaded(p => ({ ...p, [name]: true }));
    const watch = (name, collectionName, setter, mapper) => onSnapshot(
      collection(db, collectionName),
      (snap) => { setter(snap.docs.map(mapper)); done(name); },
      (e) => { setError(`Could not load ${name}: ${e.message}`); done(name); }
    );
    const unsubs = [
      watch('inventory', 'inventory', setInventory, d => ({ ...d.data(), id: d.id })),
      watch('sales', 'medicine_sales', setSales, d => ({ id: d.id, ...d.data() })),
      watch('expenses', 'expenses', setExpenses, d => d.data()),
    ];
    return () => unsubs.forEach(u => u());
  }, []);
  const loading = !(loaded.inventory && loaded.sales && loaded.expenses);

  const today = localDateString();
  const lines = useMemo(() => flattenLines(sales), [sales]);
  const data = useMemo(
    () => buildMedicines({ inventory, lines, today, lowLimit: Number(lowLimit) || 0, coverDays: Number(coverDays) || 0 }),
    [inventory, lines, today, lowLimit, coverDays]
  );
  const { medicines, totals, unlinked, historyStart } = data;
  const months = useMemo(() => monthlyTrend(sales, expenses, today, 6), [sales, expenses, today]);

  const count = (id) => medicines.filter(FILTERS.find(f => f.id === id).test).length;
  const deadValue = useMemo(() => medicines.filter(m => m.flags.dead).reduce((n, m) => n + m.costValue, 0), [medicines]);
  const expiryTracked = totals.withExpiry > 0;

  const health = useMemo(() => ([
    { id: 'active', name: 'Selling (sold in 30 days)', color: TEAL, count: count('active'), value: medicines.filter(m => m.flags.active).reduce((n, m) => n + m.costValue, 0) },
    { id: 'slow', name: 'Slow (31–90 days)', color: AMBER, count: count('slow'), value: medicines.filter(m => m.flags.slow).reduce((n, m) => n + m.costValue, 0) },
    { id: 'dead', name: 'Dead (no sale in 90 days)', color: RED, count: count('dead'), value: deadValue },
    { id: 'out', name: 'Out of stock', color: GRAY, count: count('out'), value: 0 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [medicines, deadValue]);

  const top10 = useMemo(
    () => [...medicines].sort((a, b) => b.costValue - a.costValue).slice(0, 10).map(m => ({ ...m, short: m.name.length > 22 ? m.name.slice(0, 21) + '…' : m.name })),
    [medicines]
  );

  const rows = useMemo(() => {
    const test = FILTERS.find(f => f.id === filter).test;
    const t = search.trim().toLowerCase();
    const list = medicines.filter(m => test(m) && (!t || `${m.name} ${m.codes.join(' ')}`.toLowerCase().includes(t)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'string' || typeof bv === 'string') return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * dir;
    });
    return list;
  }, [medicines, filter, search, sort]);

  const toggleSort = (key) => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const SortTh = ({ k, children, right }) => (
    <th className={`py-2 pr-3 ${right ? 'text-right' : ''} whitespace-nowrap`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gray-900">
        {children}<ArrowUpDown className={`w-3 h-3 ${sort.key === k ? 'text-teal-600' : 'text-gray-300'}`} />
      </button>
    </th>
  );

  const goFilter = (id) => {
    setFilter(id);
    setLimit(100);
    document.getElementById('stock-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const detailMed = detailKey ? medicines.find(m => m.key === detailKey) : null;
  const month = monthKey ? months.find(m => m.key === monthKey) : null;
  const tickStyle = { fontSize: 12, fill: '#6b7280' };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Inventory Health', today],
      ['Stock value at cost', totals.costValue],
      ['Stock value at MRP', totals.mrpValue],
      ['Medicines in stock', totals.inStock],
      ['Out of stock', count('out')],
      ['Low stock', count('low')],
      ['Reorder soon', count('reorder')],
      ['Out of stock but selling', count('outSelling')],
      ['Dead stock (no sale in 90 days)', count('dead')],
      ['Dead stock value at cost', deadValue],
      ['Negative stock', count('negative')],
    ]), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(m => ({
      Medicine: m.name, Code: m.codes.join(', '), 'In stock': m.stock, 'Sold 30 days': m.sold30, 'Sold 90 days': m.sold90,
      'Sold all time': m.soldAll, 'Days of stock left': m.daysLeft ?? '', 'Last sold': m.lastSold,
      'Cost value': m.costValue, 'MRP value': m.mrpValue, Expiry: m.expiry, Status: STATUS[m.health].label,
    }))), `Stock (${FILTERS.find(f => f.id === filter).label})`.slice(0, 31));
    XLSX.writeFile(wb, `Inventory_Health_${today}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 text-gray-900">
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Tile icon={IndianRupee} color={TEAL} label="Stock value (at cost)" value={rupees(totals.costValue)} sub={`${rupees(totals.mrpValue)} at selling price (MRP)`} />
        <Tile icon={Package} color="#6366f1" label="Medicines in stock" value={`${n0(totals.inStock)} of ${n0(totals.medicines)}`} sub="Click to list" onClick={() => goFilter('inStock')} active={filter === 'inStock'} />
        <Tile icon={TrendingUp} color="#0ea5e9" label="Sold in last 30 days" value={`${n0(totals.soldLast30)} medicines`} sub="Based on medicine bills" />
        <Tile icon={Hourglass} color={RED} label="Dead stock tied up" value={rupees(deadValue)} sub={`${n0(count('dead'))} medicines, no sale in 90 days`} onClick={() => goFilter('dead')} active={filter === 'dead'} />
      </div>

      {/* Needs attention */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-lg font-bold">Needs attention</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <label className="inline-flex items-center gap-2">Low stock below
            <input type="number" min="0" value={lowLimit} onChange={e => setLowLimit(e.target.value)} className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-gray-900 dark:text-white" />
          </label>
          <label className="inline-flex items-center gap-2">Reorder when under
            <input type="number" min="0" value={coverDays} onChange={e => setCoverDays(e.target.value)} className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-gray-900 dark:text-white" /> days left
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <Tile icon={PackageX} color={GRAY} label="Out of stock" value={n0(count('out'))} sub="Click to list" onClick={() => goFilter('out')} active={filter === 'out'} />
        <Tile icon={AlertTriangle} color={AMBER} label="Low stock" value={n0(count('low'))} sub={`below ${lowLimit}, or its reorder level`} onClick={() => goFilter('low')} active={filter === 'low'} />
        <Tile icon={ShoppingCart} color="#f97316" label="Reorder soon" value={n0(count('reorder'))} sub={`under ${coverDays} days of stock`} onClick={() => goFilter('reorder')} active={filter === 'reorder'} />
        <Tile icon={Ban} color={RED} label="Out of stock, still selling" value={n0(count('outSelling'))} sub="sold in last 90 days" onClick={() => goFilter('outSelling')} active={filter === 'outSelling'} />
        <Tile icon={CalendarClock} color="#8b5cf6" label="Expiring ≤ 90 days" value={expiryTracked ? n0(count('expiring')) : 'Not tracked'} sub={expiryTracked ? `${n0(count('expired'))} already expired` : 'no expiry dates entered'} onClick={() => goFilter('expiring')} active={filter === 'expiring'} />
        <Tile icon={Hourglass} color={AMBER} label="Slow movers" value={n0(count('slow'))} sub="last sale 31–90 days ago" onClick={() => goFilter('slow')} active={filter === 'slow'} />
        <Tile icon={AlertTriangle} color={RED} label="Negative stock" value={n0(count('negative'))} sub="stock errors to fix" onClick={() => goFilter('negative')} active={filter === 'negative'} />
      </div>

      {/* Notices */}
      <div className="space-y-2 mb-6 text-sm">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Selling status comes from medicine bills{historyStart ? `, which start on ${fmtDay(historyStart)}` : ''}. “Dead” means in stock with no sale in the last 90 days. Medicines given to IP patients through daily logs are not counted.</span>
        </div>
        {!expiryTracked && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-900">
            <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>No medicine in stock has an expiry date entered, so expiry alerts can’t work yet. Add dates in Add Medicine, or use the Expiry Date column when importing from Excel.</span>
          </div>
        )}
        {unlinked.lines > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{unlinked.lines} sold line{unlinked.lines === 1 ? '' : 's'} ({n2(unlinked.units)} units) couldn’t be matched to a stock item — {unlinked.names.slice(0, 3).join(', ')}{unlinked.names.length > 3 ? '…' : ''}. They are left out of the per-medicine numbers.</span>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold mb-1">Stock health</h2>
          <p className="text-sm text-gray-500 mb-2">By real sales · click a slice to list it</p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={health} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} cursor="pointer" onClick={(d) => goFilter(d.id)}>
                  {health.map(h => <Cell key={h.id} fill={h.color} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} medicines`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {health.map(h => (
              <button key={h.id} onClick={() => goFilter(h.id)} className="w-full flex items-center justify-between text-sm hover:bg-gray-50 rounded px-2 py-1">
                <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />{h.name}</span>
                <span className="font-semibold">{h.count}{h.value > 0 ? <span className="text-gray-400 font-normal"> · {rupees(h.value)}</span> : ''}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold mb-1">Most money in stock</h2>
          <p className="text-sm text-gray-500 mb-3">Top 10 by value at cost · click a bar for details</p>
          <div style={{ width: '100%', height: Math.max(260, top10.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="short" width={165} tick={{ fontSize: 12, fill: '#374151' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [rupees(v), 'Value at cost']} labelFormatter={(_, p) => p?.[0]?.payload?.name} cursor={{ fill: 'rgba(13,148,136,0.08)' }} />
                <Bar dataKey="costValue" fill={TEAL} radius={[0, 6, 6, 0]} cursor="pointer" label={{ position: 'right', fontSize: 11, fill: '#374151', formatter: (v) => rupees(v) }} onClick={(d) => setDetailKey(d.key)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold mb-1">Sales vs purchases</h2>
          <p className="text-sm text-gray-500 mb-3">Last 6 months · click a month for its bills and purchases</p>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval={0} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={56} tickFormatter={v => `₹${n0(v)}`} />
                <Tooltip formatter={(v) => rupees(v)} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Legend />
                <Bar dataKey="sales" name="Medicine sales" fill={TEAL} radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => setMonthKey(d.key)} />
                <Bar dataKey="purchases" name="Medicine purchases" fill="#f97316" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => setMonthKey(d.key)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stock table */}
      <div id="stock-table" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold">Stock list</h2>
            <p className="text-sm text-gray-500">{n0(rows.length)} medicine{rows.length === 1 ? '' : 's'} · click a row for its stock records and sales</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => { setSearch(e.target.value); setLimit(100); }} placeholder="Search medicine or code" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900 dark:text-white" />
            </div>
            <button onClick={exportExcel} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setLimit(100); }}
              className={`px-3 py-1 rounded-full text-sm border transition ${filter === f.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {f.label} <span className={filter === f.id ? 'text-teal-100' : 'text-gray-400'}>{n0(count(f.id))}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-gray-500 border-b">
                <SortTh k="name">Medicine</SortTh>
                <SortTh k="stock" right>In stock</SortTh>
                <SortTh k="sold30" right>Sold 30d</SortTh>
                <SortTh k="sold90" right>Sold 90d</SortTh>
                <SortTh k="daysLeft" right>Days left</SortTh>
                <SortTh k="lastSold">Last sold</SortTh>
                <SortTh k="costValue" right>Value (cost)</SortTh>
                <SortTh k="expiry">Expiry</SortTh>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(m => (
                <tr key={m.key} onClick={() => setDetailKey(m.key)} className="border-b last:border-0 hover:bg-teal-50 cursor-pointer">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.codes[0] || ''}{m.records.length > 1 ? ` · ${m.records.length} records` : ''}</div>
                  </td>
                  <td className={`py-2 pr-3 text-right font-semibold ${m.stock < 0 ? 'text-red-600' : ''}`}>{n2(m.stock)}</td>
                  <td className="py-2 pr-3 text-right">{m.sold30 ? n2(m.sold30) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{m.sold90 ? n2(m.sold90) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{m.daysLeft === null ? '—' : n0(m.daysLeft)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{m.lastSold ? fmtDay(m.lastSold, { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{m.costValue ? rupees(m.costValue) : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{m.expiry ? fmtDay(m.expiry, { day: 'numeric', month: 'short', year: '2-digit' }) : <span className="text-gray-300">—</span>}</td>
                  <td className="py-2 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS[m.health].cls}`}>{STATUS[m.health].label}</span>
                    {m.flags.negative && <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">negative</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-gray-500">Nothing matches this filter</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="text-center mt-4">
            <button onClick={() => setLimit(l => l + 200)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              Show more ({n0(rows.length - limit)} more)
            </button>
          </div>
        )}
      </div>

      {detailMed && <MedicineModal med={detailMed} onClose={() => setDetailKey(null)} />}
      {month && <MonthModal month={month} onClose={() => setMonthKey(null)} />}
    </div>
  );
};

export default InventoryHealthDashboard;
