import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Download, Search, X, TrendingUp, TrendingDown,
  Pill, Receipt, ShoppingBag, IndianRupee, PackageX, ArrowUpDown, Users,
} from 'lucide-react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { localDateString } from '../lib/expenses';
import {
  periodRange, previousRange, stepAnchor, addDays, flattenLines, summarizePeriod,
  dailySeries, pctChange,
} from '../lib/salesAnalytics';

const TEAL = '#0d9488';
const ORANGE = '#f97316';
const TEAL_LIGHT = '#5eead4';

const n0 = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const n2 = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const rupees = (v) => `₹${n0(v)}`;
const fmtDay = (s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', opts) : '—';

const MODES = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

const Delta = ({ current, previous, className = '' }) => {
  const pct = pctChange(current, previous);
  if (pct === null) return <span className={`text-xs text-gray-400 ${className}`}>new</span>;
  if (Math.abs(pct) < 0.05) return <span className={`text-xs text-gray-400 ${className}`}>no change</span>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'} ${className}`}>
      <Icon className="w-3.5 h-3.5" />{Math.abs(pct).toFixed(0)}%
    </span>
  );
};

const Tile = ({ icon: Icon, color, label, value, children, onClick }) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${onClick ? 'hover:shadow-md hover:border-amber-300 transition cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}1f` }}>
          {React.createElement(Icon, { className: "w-5 h-5", style: { color } })}
        </span>
      </div>
      <div className="text-3xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="mt-2 min-h-[1.25rem]">{children}</div>
    </Wrapper>
  );
};

const ChartTooltip = ({ active, payload, metric }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-semibold mb-1">{fmtDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      <div>{n2(d.units)} units sold</div>
      <div>{rupees(d.value)} value</div>
      <div>{d.bills} bill{d.bills === 1 ? '' : 's'}</div>
      <div className="text-xs text-gray-400 mt-1">Click to open this day · {metric === 'units' ? 'units' : 'value'}</div>
    </div>
  );
};

// ── Medicine detail ─────────────────────────────────────────────────────────
const MedicineDetail = ({ med, allLines, range, stock, onClose }) => {
  const mine = useMemo(
    () => allLines.filter(l => l.key === med.key).sort((a, b) => b.date.localeCompare(a.date) || b.billNo.localeCompare(a.billNo)),
    [allLines, med.key]
  );
  const inPeriod = mine.filter(l => l.date >= range.from && l.date <= range.to);
  const totalQty = mine.reduce((n, l) => n + l.qty, 0);
  const totalValue = mine.reduce((n, l) => n + l.value, 0);
  const periodQty = inPeriod.reduce((n, l) => n + l.qty, 0);
  const periodValue = inPeriod.reduce((n, l) => n + l.value, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-teal-700 text-white px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">{med.name}</h2>
            <p className="text-teal-100 text-sm">{med.code ? `Code ${med.code}` : 'No item code'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-teal-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              ['Sold this period', `${n0(periodQty)} units`, rupees(periodValue)],
              ['Sold all time', `${n0(totalQty)} units`, rupees(totalValue)],
              ['In stock now', stock === null ? 'Not linked' : `${n0(stock)} units`, stock === null ? 'to a stock item' : ''],
              ['Last sold', fmtDay(mine[0]?.date), `${new Set(mine.map(l => l.billId)).size} bills in total`],
            ].map(([label, big, small]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-lg font-bold">{big}</div>
                <div className="text-xs text-gray-500">{small}</div>
              </div>
            ))}
          </div>

          <h3 className="font-semibold mb-2">Every sale of this medicine</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Bill</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Rate</th>
                  <th className="py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {mine.map(l => {
                  const current = l.date >= range.from && l.date <= range.to;
                  return (
                    <tr key={l.id} className={`border-b last:border-0 ${current ? 'bg-teal-50' : ''}`}>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(l.date)}</td>
                      <td className="py-2 pr-3">{l.billNo || '—'}</td>
                      <td className="py-2 pr-3">{l.customer || '—'}</td>
                      <td className="py-2 pr-3 text-right">{n2(l.qty)}</td>
                      <td className="py-2 pr-3 text-right">{n2(l.rate)}</td>
                      <td className="py-2 text-right font-medium">{rupees(l.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">Rows shaded green fall in the selected period.</p>
        </div>
      </div>
    </div>
  );
};

// ── In stock but not sold ───────────────────────────────────────────────────
const UnsoldList = ({ items, range, onClose }) => {
  const [q, setQ] = useState('');
  const shown = items.filter(i => {
    const t = q.trim().toLowerCase();
    return !t || `${i.item_name} ${i.item_code}`.toLowerCase().includes(t);
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-amber-600 text-white px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">In stock, not sold this period</h2>
            <p className="text-amber-100 text-sm">{items.length} medicines · {range.label}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-amber-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search medicine or code"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Medicine</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3 text-right">In stock</th>
                <th className="py-2 text-right">Stock value (cost)</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 300).map(i => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{i.item_name}</td>
                  <td className="py-2 pr-3 text-gray-500">{i.item_code}</td>
                  <td className="py-2 pr-3 text-right">{n0(i.stock)}</td>
                  <td className="py-2 text-right font-medium">{rupees(i.stockValue)}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-500">Nothing matches</td></tr>}
            </tbody>
          </table>
          {shown.length > 300 && <p className="text-xs text-gray-500 mt-3">Showing the first 300 of {shown.length} — search to narrow down.</p>}
        </div>
      </div>
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
const MedicinesSoldDashboard = () => {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('week');
  const [anchor, setAnchor] = useState(localDateString());
  const [metric, setMetric] = useState('units');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'qty', dir: 'desc' });
  const [detailKey, setDetailKey] = useState(null);
  const [showUnsold, setShowUnsold] = useState(false);

  // Sales are live (a new bill appears here by itself); stock is read once and
  // re-read on Refresh.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'medicine_sales'),
      (snap) => { setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (e) => { setError('Could not load sales: ' + e.message); setLoading(false); }
    );
    return unsub;
  }, []);

  const loadInventory = async () => {
    try {
      const snap = await getDocs(collection(db, 'inventory'));
      setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (e) {
      setError('Could not load stock: ' + e.message);
    }
  };
  useEffect(() => { loadInventory(); }, []);

  const today = localDateString();
  const range = useMemo(() => periodRange(mode, anchor), [mode, anchor]);
  const prevRange = useMemo(() => previousRange(mode, range), [mode, range]);
  const lines = useMemo(() => flattenLines(sales), [sales]);
  const cur = useMemo(() => summarizePeriod(sales, lines, range.from, range.to), [sales, lines, range]);
  const prev = useMemo(() => summarizePeriod(sales, lines, prevRange.from, prevRange.to), [sales, lines, prevRange]);

  // Chart: the days inside the period — except Day view, which shows the 14
  // days up to the chosen day so a single day has some context.
  const chartFrom = mode === 'day' ? addDays(range.to, -13) : range.from;
  const series = useMemo(() => {
    const raw = dailySeries(sales, lines, chartFrom, range.to);
    return raw.map(d => ({
      ...d,
      label: mode === 'month'
        ? String(Number(d.date.slice(8)))
        : fmtDay(d.date, { weekday: 'short', day: 'numeric' }),
      selected: mode === 'day' ? d.date === anchor : true,
    }));
  }, [sales, lines, chartFrom, range.to, mode, anchor]);
  const metricKey = metric === 'units' ? 'units' : 'value';
  const busiest = useMemo(() => {
    const inPeriod = series.filter(d => d.date >= range.from && d.date <= range.to);
    return inPeriod.reduce((best, d) => (d[metricKey] > (best?.[metricKey] ?? 0) ? d : best), null);
  }, [series, range, metricKey]);

  // Stock lookups for "stock left" and the not-sold list.
  const invById = useMemo(() => new Map(inventory.map(i => [i.id, i])), [inventory]);
  const invByCode = useMemo(() => {
    const m = new Map();
    inventory.forEach(i => { if (i.item_code) m.set(String(i.item_code).toLowerCase(), i); });
    return m;
  }, [inventory]);
  const stockFor = (m) => {
    const item = (m.inventoryId && invById.get(m.inventoryId)) || (m.code && invByCode.get(String(m.code).toLowerCase()));
    return item ? (parseFloat(item.stock_quantity) || 0) : null;
  };

  const prevQty = useMemo(() => new Map(prev.medicines.map(m => [m.key, m.qty])), [prev]);
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = cur.medicines
      .filter(m => !t || `${m.name} ${m.code}`.toLowerCase().includes(t))
      .map(m => ({ ...m, stock: stockFor(m), prevQty: prevQty.get(m.key) || 0 }));
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'string' || typeof bv === 'string') return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      return ((av ?? -1) - (bv ?? -1)) * dir;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, search, sort, prevQty, invById, invByCode]);

  const top10 = useMemo(
    () => [...cur.medicines].sort((a, b) => b.qty - a.qty).slice(0, 10).map(m => ({ ...m, short: m.name.length > 22 ? m.name.slice(0, 21) + '…' : m.name })),
    [cur]
  );

  const unsold = useMemo(() => {
    const soldIds = new Set();
    const soldCodes = new Set();
    cur.medicines.forEach(m => {
      if (m.inventoryId) soldIds.add(m.inventoryId);
      if (m.code) soldCodes.add(String(m.code).toLowerCase());
    });
    return inventory
      .map(i => {
        const stock = parseFloat(i.stock_quantity) || 0;
        const rate = parseFloat(i.purchase_price ?? i.purchase_rate) || 0;
        return { id: i.id, item_name: i.item_name || '', item_code: i.item_code || '', stock, stockValue: stock * rate };
      })
      .filter(i => i.stock > 0 && !soldIds.has(i.id) && !soldCodes.has(String(i.item_code).toLowerCase()))
      .sort((a, b) => b.stockValue - a.stockValue);
  }, [cur, inventory]);

  const detailMed = detailKey ? (cur.medicines.find(m => m.key === detailKey) || lines.find(l => l.key === detailKey)) : null;

  const toggleSort = (key) => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'code' ? 'asc' : 'desc' }));
  const SortTh = ({ k, children, right }) => (
    <th className={`py-2 pr-3 ${right ? 'text-right' : ''} whitespace-nowrap`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gray-900">
        {children}<ArrowUpDown className={`w-3 h-3 ${sort.key === k ? 'text-teal-600' : 'text-gray-300'}`} />
      </button>
    </th>
  );

  const openDay = (date) => { setMode('day'); setAnchor(date); };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      ['Medicines Sold'],
      [range.label],
      [],
      ['Units sold', cur.units],
      ['Total billed (incl. GST)', cur.billed],
      ['Bills', cur.billCount],
      ['Different medicines sold', cur.distinct],
      ['Average bill', Math.round(cur.avgBill * 100) / 100],
      ['Item value (quantity × rate)', cur.itemValue],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      [...cur.medicines].sort((a, b) => b.qty - a.qty).map(m => ({
        Medicine: m.name, Code: m.code, 'Qty sold': m.qty, Bills: m.bills, 'Value (qty × rate)': m.value,
        'In stock': stockFor(m) ?? '', 'Last sold': m.lastSold,
      }))
    ), 'Medicines Sold');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      series.filter(d => d.date >= range.from && d.date <= range.to).map(d => ({ Date: d.date, Units: d.units, Value: d.value, Bills: d.bills }))
    ), 'By Day');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      lines.filter(l => l.date >= range.from && l.date <= range.to).sort((a, b) => a.date.localeCompare(b.date))
        .map(l => ({ Date: l.date, Bill: l.billNo, Customer: l.customer, Medicine: l.name, Code: l.code, Qty: l.qty, Rate: l.rate, Value: l.value }))
    ), 'Bill Lines');
    XLSX.writeFile(wb, `Medicines_Sold_${range.from}_to_${range.to}.xlsx`);
  };

  const tickStyle = { fontSize: 12, fill: '#6b7280' };

  return (
    <div className="p-6 text-gray-900">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex rounded-xl border border-gray-300 bg-white overflow-hidden">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-5 py-2 text-sm font-medium transition ${mode === m.id ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <button onClick={() => setAnchor(stepAnchor(mode, anchor, -1))} className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50" title="Previous"><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={() => setAnchor(stepAnchor(mode, anchor, 1))}
            disabled={range.to >= today}
            className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
        <input
          type="date"
          value={anchor}
          max={today}
          onChange={e => e.target.value && setAnchor(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
        />
        <button onClick={() => setAnchor(today)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50">Today</button>
        <div className="text-lg font-semibold ml-1">{range.label}</div>
        <button onClick={exportExcel} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <Tile icon={Pill} color={TEAL} label="Units sold" value={n2(cur.units)}>
              <Delta current={cur.units} previous={prev.units} /> <span className="text-xs text-gray-400">vs previous {mode}</span>
            </Tile>
            <Tile icon={IndianRupee} color={ORANGE} label="Total billed" value={rupees(cur.billed)}>
              <Delta current={cur.billed} previous={prev.billed} /> <span className="text-xs text-gray-400">incl. GST</span>
            </Tile>
            <Tile icon={Receipt} color="#6366f1" label="Bills" value={n0(cur.billCount)}>
              <Delta current={cur.billCount} previous={prev.billCount} />
            </Tile>
            <Tile icon={ShoppingBag} color="#0ea5e9" label="Different medicines" value={n0(cur.distinct)}>
              <Delta current={cur.distinct} previous={prev.distinct} />
            </Tile>
            <Tile icon={Users} color="#ec4899" label="Average bill" value={rupees(cur.avgBill)}>
              <Delta current={cur.avgBill} previous={prev.avgBill} />
            </Tile>
            <Tile icon={PackageX} color="#d97706" label="In stock, not sold" value={n0(unsold.length)} onClick={() => setShowUnsold(true)}>
              <span className="text-xs text-amber-700">Click to see the list</span>
            </Tile>
          </div>

          {/* Sales chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">{mode === 'day' ? 'Last 14 days' : mode === 'week' ? 'Day by day this week' : 'Day by day this month'}</h2>
                <p className="text-sm text-gray-500">Click a bar to open that day{busiest && busiest[metricKey] > 0 ? ` · busiest: ${fmtDay(busiest.date, { weekday: 'short', day: 'numeric', month: 'short' })} (${metric === 'units' ? `${n0(busiest.units)} units` : rupees(busiest.value)})` : ''}</p>
              </div>
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                {[['units', 'Units'], ['value', 'Value']].map(([id, label]) => (
                  <button key={id} onClick={() => setMetric(id)} className={`px-4 py-1.5 ${metric === id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval={mode === 'month' ? 1 : 0} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={metric === 'value' ? 60 : 40} tickFormatter={v => (metric === 'value' ? `₹${n0(v)}` : n0(v))} />
                  <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ fill: 'rgba(13,148,136,0.08)' }} />
                  <Bar dataKey={metricKey} radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => openDay(d.date)}>
                    {series.map(d => (
                      <Cell key={d.date} fill={d.selected ? (metric === 'units' ? TEAL : ORANGE) : TEAL_LIGHT} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Top sellers */}
            <div className="xl:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold mb-1">Top sellers</h2>
              <p className="text-sm text-gray-500 mb-3">By units · click a bar for its sales history</p>
              {top10.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No medicines sold in this period</p>
              ) : (
                <div style={{ width: '100%', height: Math.max(220, top10.length * 36) }}>
                  <ResponsiveContainer>
                    <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="short" width={165} tick={{ fontSize: 12, fill: "#374151" }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => [`${n2(v)} units`, 'Sold']} labelFormatter={(_, p) => p?.[0]?.payload?.name} cursor={{ fill: 'rgba(13,148,136,0.08)' }} />
                      <Bar dataKey="qty" fill={TEAL} radius={[0, 6, 6, 0]} cursor="pointer" label={{ position: 'right', fontSize: 12, fill: '#374151' }} onClick={(d) => setDetailKey(d.key)} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Medicines table */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-bold">Medicines sold</h2>
                  <p className="text-sm text-gray-500">{rows.length} medicine{rows.length === 1 ? '' : 's'} · click a row for its sales history</p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search medicine or code"
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                </div>
              </div>
              <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-gray-500 border-b">
                      <SortTh k="name">Medicine</SortTh>
                      <SortTh k="qty" right>Qty sold</SortTh>
                      <SortTh k="prevQty" right>vs prev.</SortTh>
                      <SortTh k="bills" right>Bills</SortTh>
                      <SortTh k="value" right>Value</SortTh>
                      <SortTh k="stock" right>In stock</SortTh>
                      <SortTh k="lastSold">Last sold</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(m => (
                      <tr key={m.key} onClick={() => setDetailKey(m.key)} className="border-b last:border-0 hover:bg-teal-50 cursor-pointer">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{m.name}</div>
                          {m.code && <div className="text-xs text-gray-400">{m.code}</div>}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold">{n2(m.qty)}</td>
                        <td className="py-2 pr-3 text-right"><Delta current={m.qty} previous={m.prevQty} /></td>
                        <td className="py-2 pr-3 text-right">{m.bills}</td>
                        <td className="py-2 pr-3 text-right">{rupees(m.value)}</td>
                        <td className={`py-2 pr-3 text-right ${m.stock !== null && m.stock <= 0 ? 'text-red-600 font-semibold' : ''}`}>{m.stock === null ? '—' : n0(m.stock)}</td>
                        <td className="py-2 whitespace-nowrap">{fmtDay(m.lastSold, { day: 'numeric', month: 'short' })}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="py-10 text-center text-gray-500">{cur.medicines.length === 0 ? 'No medicines were sold in this period' : 'Nothing matches your search'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Value is quantity × item rate. “Total billed” above also includes GST and rounding, so the two differ slightly. Counts cover Medicine Sale bills only.
              </p>
            </div>
          </div>
        </>
      )}

      {detailMed && (
        <MedicineDetail
          med={detailMed}
          allLines={lines}
          range={range}
          stock={stockFor(detailMed)}
          onClose={() => setDetailKey(null)}
        />
      )}
      {showUnsold && <UnsoldList items={unsold} range={range} onClose={() => setShowUnsold(false)} />}
    </div>
  );
};

export default MedicinesSoldDashboard;
