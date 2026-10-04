import React, { useState, useEffect, useMemo } from 'react';
import { FileBarChart, Users, Package, Calendar, Download, Bed, UserRound, Phone, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, UserPlus, Repeat, Baby, Stethoscope } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { loadDoctorsList } from '../lib/doctors';
import { buildContext, classifyPatients, summarize, ROW_FILTERS, byDoctor } from '../lib/patientReport';
import ReportPatientList from './ReportPatientList';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

const inRange = (dateVal, start, end) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  return !isNaN(d) && d >= start && d <= end;
};

const quickRanges = {
  'this-month': () => { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth(), 1), now]; },
  'last-3': () => { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth() - 2, 1), now]; },
  'last-6': () => { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth() - 5, 1), now]; },
  'last-12': () => { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth() - 11, 1), now]; },
  'this-year': () => { const now = new Date(); return [new Date(now.getFullYear(), 0, 1), now]; },
};

const buildMonthList = (start, end) => {
  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endCursor) {
    months.push({ key: monthKey(cursor), label: monthLabel(cursor.getFullYear(), cursor.getMonth()), year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
};

const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:bg-gray-50 transition' : ''}`}
    style={{ borderLeftColor: color }}
    title={onClick ? 'Click to see the patients' : undefined}
  >
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('patients'); // patients | doctors | inventory
  const [rangeMode, setRangeMode] = useState('last-6');
  const [detail, setDetail] = useState(null); // { title, subtitle, rows } — patient drill-down
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rawData, setRawData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [patientsSnap, leadsSnap, salesSnap, expensesSnap, purchaseEntriesSnap, inventorySnap, apptSnap, opSnap, ipSnap, summarySnap, doctors] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'leads')),
        getDocs(collection(db, 'medicine_sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'purchase_entries')),
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'op_case_sheets')),
        getDocs(collection(db, 'ip_case_sheets')),
        getDocs(collection(db, 'discharge_summaries')),
        loadDoctorsList().catch(() => []),
      ]);
      setRawData({
        patients: patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        leads: leadsSnap.docs.map(d => d.data()),
        medicineSales: salesSnap.docs.map(d => d.data()),
        expenses: expensesSnap.docs.map(d => d.data()),
        purchaseEntries: purchaseEntriesSnap.docs.map(d => d.data()),
        // Spread first, id last: some inventory docs carry their own legacy
        // numeric `id` field, which would otherwise clobber the real doc id.
        inventory: inventorySnap.docs.map(d => ({ ...d.data(), id: d.id })),
        reportContext: buildContext({
          appointments: apptSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          opSheets: opSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          ipSheets: ipSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          summaries: summarySnap.docs.map(d => ({ id: d.id, ...d.data() })),
          doctors,
        }),
      });
    } catch (error) {
      console.error('Error loading report data:', error);
      alert('Failed to load report data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRange = useMemo(() => {
    if (rangeMode === 'custom') {
      const now = new Date();
      const start = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = customTo ? new Date(customTo + 'T23:59:59') : now;
      return [start, end];
    }
    return quickRanges[rangeMode]();
  }, [rangeMode, customFrom, customTo]);

  const months = useMemo(() => buildMonthList(selectedRange[0], selectedRange[1]), [selectedRange]);

  // ── Patient Reports ──────────────────────────────────────────────────
  // Every patient seen in the selected range (new registrations + returning
  // visits), and the same per month (clipped to the range) for the table/chart.
  const rangeRows = useMemo(() => {
    if (!rawData) return [];
    return classifyPatients(rawData.patients, rawData.reportContext, selectedRange[0], selectedRange[1]);
  }, [rawData, selectedRange]);

  const patientMonthly = useMemo(() => {
    if (!rawData) return [];
    return months.map(m => {
      const monthStart = new Date(m.year, m.month, 1);
      const monthEnd = new Date(m.year, m.month + 1, 0, 23, 59, 59);
      const start = monthStart < selectedRange[0] ? selectedRange[0] : monthStart;
      const end = monthEnd > selectedRange[1] ? selectedRange[1] : monthEnd;
      const rows = classifyPatients(rawData.patients, rawData.reportContext, start, end);
      const calledIn = rawData.leads.filter(l => inRange(l.created_at, start, end)).length;
      return { ...m, rows, calledIn, ...summarize(rows) };
    });
  }, [rawData, months, selectedRange]);

  const patientSummary = useMemo(() => ({
    ...summarize(rangeRows),
    calledIn: patientMonthly.reduce((sum, m) => sum + m.calledIn, 0),
  }), [rangeRows, patientMonthly]);

  const doctorRows = useMemo(() => byDoctor(rangeRows), [rangeRows]);

  const openDetail = (title, rows, scope) => setDetail({ title, subtitle: scope, rows });
  const openFiltered = (key, label, sourceRows, scope) =>
    openDetail(label, sourceRows.filter(ROW_FILTERS[key]), scope);

  // ── Inventory Reports ────────────────────────────────────────────────
  const inventoryMonthly = useMemo(() => {
    if (!rawData) return [];
    return months.map(m => {
      const monthStart = new Date(m.year, m.month, 1);
      const monthEnd = new Date(m.year, m.month + 1, 0, 23, 59, 59);
      const salesAmount = rawData.medicineSales
        .filter(s => inRange(s.sale_date || s.created_at, monthStart, monthEnd))
        .reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
      const purchaseAmount = rawData.expenses
        .filter(e => (e.category || '').toLowerCase() === 'medicine_purchase' && inRange(e.date || e.created_at, monthStart, monthEnd))
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const purchaseQty = rawData.purchaseEntries
        .filter(pe => inRange(pe.invoice_date || pe.entry_date, monthStart, monthEnd))
        .reduce((sum, pe) => sum + (pe.items || []).reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0), 0);
      return { ...m, salesAmount, purchaseAmount, purchaseQty };
    });
  }, [rawData, months]);

  const inventorySummary = useMemo(() => inventoryMonthly.reduce((acc, m) => ({
    sales: acc.sales + m.salesAmount,
    purchases: acc.purchases + m.purchaseAmount,
    purchaseQty: acc.purchaseQty + m.purchaseQty,
  }), { sales: 0, purchases: 0, purchaseQty: 0 }), [inventoryMonthly]);

  // Fast-moving / dead inventory — derived from Medicine Sale bills within the
  // selected range, matched to inventory items by name (this app has no
  // dedicated stock-out/dispense log; inventory.stock_quantity only ever
  // increases via purchases, so real depletion isn't tracked — sales bills
  // are the best available signal of actual demand).
  const { fastMoving, deadInventory } = useMemo(() => {
    if (!rawData) return { fastMoving: [], deadInventory: [] };
    const [start, end] = selectedRange;
    const soldQtyByName = {};
    rawData.medicineSales.forEach(sale => {
      if (!inRange(sale.sale_date || sale.created_at, start, end)) return;
      (sale.items || []).forEach(item => {
        const key = (item.name || '').trim().toLowerCase();
        if (!key) return;
        soldQtyByName[key] = (soldQtyByName[key] || 0) + (parseFloat(item.quantity) || 0);
      });
    });

    const fast = Object.entries(soldQtyByName)
      .map(([key, qty]) => {
        const invItem = rawData.inventory.find(i => (i.item_name || '').trim().toLowerCase() === key);
        return { name: invItem?.item_name || key, qtySold: qty, currentStock: invItem?.stock_quantity ?? null };
      })
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 15);

    const dead = rawData.inventory
      .filter(item => (item.stock_quantity || 0) > 0)
      .filter(item => !soldQtyByName[(item.item_name || '').trim().toLowerCase()])
      .map(item => {
        const price = item.purchase_price || item.purchase_rate || 0;
        return {
          name: item.item_name || '—',
          stock: item.stock_quantity || 0,
          purchasePrice: price,
          stockValue: (item.stock_quantity || 0) * price,
          lastPurchase: item.last_purchase_date || item.last_updated || item.created_at || '',
        };
      })
      .sort((a, b) => b.stockValue - a.stockValue);

    return { fastMoving: fast, deadInventory: dead };
  }, [rawData, selectedRange]);

  const handleExportPatients = () => {
    const wb = XLSX.utils.book_new();
    const monthlySheet = XLSX.utils.json_to_sheet(patientMonthly.map(m => ({
      Month: m.label, 'Patients Seen': m.total, OP: m.op, IP: m.ip, New: m.new, Return: m.returning, PNC: m.pnc, 'Called In': m.calledIn,
    })));
    XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Summary');
    const detailSheet = XLSX.utils.json_to_sheet(rangeRows.map(r => ({
      Patient: r.name, MRD: r.mrd, 'IP No': r.ip, Phone: r.phone, Type: r.type, 'New / Return': r.kind,
      Category: r.category, PNC: r.pnc ? 'Yes' : '', Doctor: r.doctor,
      Registered: r.registered ? new Date(r.registered).toLocaleDateString('en-IN') : '', 'Last Visit': r.lastVisit,
    })));
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Patients');
    XLSX.writeFile(wb, `Patient_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportDoctors = () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(doctorRows.map(d => ({
      Doctor: d.doctor, Patients: d.total, OP: d.op, IP: d.ip, New: d.new, Return: d.returning, PNC: d.pnc,
      'Share %': patientSummary.total ? Math.round((d.total / patientSummary.total) * 1000) / 10 : 0,
    })));
    XLSX.utils.book_append_sheet(wb, sheet, 'By Doctor');
    const detailSheet = XLSX.utils.json_to_sheet(doctorRows.flatMap(d => d.rows.map(r => ({
      Doctor: d.doctor, Patient: r.name, MRD: r.mrd, Type: r.type, 'New / Return': r.kind, PNC: r.pnc ? 'Yes' : '', Phone: r.phone,
    }))));
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Patients by Doctor');
    XLSX.writeFile(wb, `Patients_By_Doctor_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportInventory = () => {
    const wb = XLSX.utils.book_new();
    const monthlySheet = XLSX.utils.json_to_sheet(inventoryMonthly.map(m => ({
      Month: m.label,
      'Sales (₹)': m.salesAmount,
      'Purchases (₹)': m.purchaseAmount,
      'Qty Purchased': m.purchaseQty,
    })));
    XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Summary');
    const fastSheet = XLSX.utils.json_to_sheet(fastMoving.map(f => ({
      Item: f.name, 'Qty Sold': f.qtySold, 'Current Stock': f.currentStock ?? '—',
    })));
    XLSX.utils.book_append_sheet(wb, fastSheet, 'Fast Moving');
    const deadSheet = XLSX.utils.json_to_sheet(deadInventory.map(d => ({
      Item: d.name, Stock: d.stock, 'Purchase Price': d.purchasePrice, 'Stock Value (₹)': d.stockValue,
      'Last Purchase': d.lastPurchase ? new Date(d.lastPurchase).toLocaleDateString('en-IN') : '—',
    })));
    XLSX.utils.book_append_sheet(wb, deadSheet, 'Dead Inventory');
    XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const rangeLabel = `${months[0]?.label || ''} – ${months[months.length - 1]?.label || ''}`;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <FileBarChart className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
            <p className="text-gray-600 text-sm">Patients, doctors and inventory movement</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'this-month', label: '1 Month' },
            { id: 'last-3', label: 'Last 3 Months' },
            { id: 'last-6', label: 'Last 6 Months' },
            { id: 'last-12', label: 'Last 12 Months' },
            { id: 'this-year', label: 'This Year' },
            { id: 'custom', label: 'Custom' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setRangeMode(opt.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                rangeMode === opt.id ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {rangeMode === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm outline-none"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
            <div className="flex border-b border-gray-100">
              {[
                { id: 'patients', label: 'Patient Reports', icon: Users },
                { id: 'doctors', label: 'Patients by Doctor', icon: Stethoscope },
                { id: 'inventory', label: 'Inventory Reports', icon: Package },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${
                      activeTab === tab.id ? 'text-teal-700 border-b-2 border-teal-600 bg-teal-50/50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'patients' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">
                Patients seen in {rangeLabel}: <strong>New</strong> = registered in this period, <strong>Return</strong> = registered earlier and visited in this period. Click any count to see the patients.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <StatCard title="Patients Seen" value={patientSummary.total} icon={Users} color="#14b8a6" subtitle="New + Return" onClick={() => openFiltered('total', 'All Patients', rangeRows, rangeLabel)} />
                <StatCard title="OP Patients" value={patientSummary.op} icon={UserRound} color="#3b82f6" subtitle={rangeLabel} onClick={() => openFiltered('op', 'OP Patients', rangeRows, rangeLabel)} />
                <StatCard title="IP Patients" value={patientSummary.ip} icon={Bed} color="#8b5cf6" subtitle={rangeLabel} onClick={() => openFiltered('ip', 'IP Patients', rangeRows, rangeLabel)} />
                <StatCard title="New Patients" value={patientSummary.new} icon={UserPlus} color="#10b981" subtitle="Registered in range" onClick={() => openFiltered('new', 'New Patients', rangeRows, rangeLabel)} />
                <StatCard title="Return Patients" value={patientSummary.returning} icon={Repeat} color="#f59e0b" subtitle="Registered earlier" onClick={() => openFiltered('returning', 'Return Patients', rangeRows, rangeLabel)} />
                <StatCard title="PNC Patients" value={patientSummary.pnc} icon={Baby} color="#ec4899" subtitle="Category or diagnosis" onClick={() => openFiltered('pnc', 'PNC Patients', rangeRows, rangeLabel)} />
                <StatCard title="Called In" value={patientSummary.calledIn} icon={Phone} color="#6b7280" subtitle="From Lead Management" />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Monthly Trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={patientMonthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="op" name="OP Patients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ip" name="IP Patients" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="new" name="New" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="returning" name="Return" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pnc" name="PNC" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Monthly Breakdown</h3>
                  <button
                    onClick={handleExportPatients}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                        {['Patients Seen', 'OP', 'IP', 'New', 'Return', 'PNC'].map(h => (
                          <th key={h} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Called In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {patientMonthly.map(m => (
                        <tr key={m.key} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">{m.label}</td>
                          {[['total', 'Patients Seen', 'All Patients'], ['op', 'OP', 'OP Patients'], ['ip', 'IP', 'IP Patients'], ['new', 'New', 'New Patients'], ['returning', 'Return', 'Return Patients'], ['pnc', 'PNC', 'PNC Patients']].map(([key, , label]) => (
                            <td key={key} className="px-6 py-3 text-sm text-right">
                              {m[key] > 0 ? (
                                <button onClick={() => openFiltered(key, `${label} — ${m.label}`, m.rows, m.label)} className="text-teal-700 font-medium underline decoration-dotted hover:text-teal-900">{m[key]}</button>
                              ) : <span className="text-gray-400">0</span>}
                            </td>
                          ))}
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{m.calledIn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">
                Patients seen in {rangeLabel}, grouped by the doctor on each patient's record (Assign Doctor). Each patient is counted once. Click a doctor or a count to see the patients.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Patients Seen" value={patientSummary.total} icon={Users} color="#14b8a6" subtitle={rangeLabel} onClick={() => openFiltered('total', 'All Patients', rangeRows, rangeLabel)} />
                <StatCard title="Doctors" value={doctorRows.filter(d => d.doctor !== 'Unassigned').length} icon={Stethoscope} color="#3b82f6" subtitle="With patients in range" />
                <StatCard title="Busiest Doctor" value={doctorRows.find(d => d.doctor !== 'Unassigned')?.doctor || '—'} icon={TrendingUp} color="#8b5cf6" subtitle={doctorRows.find(d => d.doctor !== 'Unassigned') ? `${doctorRows.find(d => d.doctor !== 'Unassigned').total} patients` : ''} />
                <StatCard title="Unassigned" value={doctorRows.find(d => d.doctor === 'Unassigned')?.total || 0} icon={UserRound} color="#6b7280" subtitle="No doctor on record" onClick={() => { const u = doctorRows.find(d => d.doctor === 'Unassigned'); if (u) openDetail('Unassigned patients', u.rows, rangeLabel); }} />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Patients per Doctor</h3>
                {doctorRows.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No patients in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(180, doctorRows.length * 48)}>
                    <BarChart data={doctorRows} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="doctor" width={170} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="op" name="OP" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="ip" name="IP" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Distribution by Doctor</h3>
                  <button onClick={handleExportDoctors} className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                    <Download className="w-4 h-4" /> Export
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                        {['Patients', 'Share', 'OP', 'IP', 'New', 'Return', 'PNC'].map(h => (
                          <th key={h} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {doctorRows.map(d => (
                        <tr key={d.doctor} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">
                            <button onClick={() => openDetail(`${d.doctor} — patients`, d.rows, rangeLabel)} className="text-teal-700 hover:underline">{d.doctor}</button>
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">{d.total}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-600">{patientSummary.total ? `${Math.round((d.total / patientSummary.total) * 1000) / 10}%` : '—'}</td>
                          {[['op', 'OP'], ['ip', 'IP'], ['new', 'New'], ['returning', 'Return'], ['pnc', 'PNC']].map(([key, label]) => (
                            <td key={key} className="px-6 py-3 text-sm text-right">
                              {d[key] > 0 ? (
                                <button onClick={() => openFiltered(key, `${d.doctor} — ${label} patients`, d.rows, rangeLabel)} className="text-teal-700 underline decoration-dotted hover:text-teal-900">{d[key]}</button>
                              ) : <span className="text-gray-400">0</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-6 py-3 text-sm text-gray-900">Total</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-900">{patientSummary.total}</td>
                        <td className="px-6 py-3 text-sm text-right text-gray-600">{patientSummary.total ? '100%' : '—'}</td>
                        <td className="px-6 py-3 text-sm text-right">{patientSummary.op}</td>
                        <td className="px-6 py-3 text-sm text-right">{patientSummary.ip}</td>
                        <td className="px-6 py-3 text-sm text-right">{patientSummary.new}</td>
                        <td className="px-6 py-3 text-sm text-right">{patientSummary.returning}</td>
                        <td className="px-6 py-3 text-sm text-right">{patientSummary.pnc}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Total Inventory Sales" value={fmt(inventorySummary.sales)} icon={IndianRupee} color="#14b8a6" subtitle={rangeLabel} />
                <StatCard title="Total Medicine Purchased" value={fmt(inventorySummary.purchases)} icon={ShoppingCart} color="#3b82f6" subtitle={`${inventorySummary.purchaseQty.toLocaleString('en-IN')} units`} />
                <StatCard title="Dead Inventory Items" value={deadInventory.length} icon={TrendingDown} color="#ef4444" subtitle={`${fmt(deadInventory.reduce((s, d) => s + d.stockValue, 0))} tied up`} />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Monthly Sales vs Purchases</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inventoryMonthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="salesAmount" name="Sales" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purchaseAmount" name="Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800">Monthly Breakdown</h3>
                  <button
                    onClick={handleExportInventory}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                  >
                    <Download className="w-4 h-4" /> Export All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchases</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Purchased</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventoryMonthly.map(m => (
                        <tr key={m.key} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">{m.label}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(m.salesAmount)}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(m.purchaseAmount)}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{m.purchaseQty.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-gray-800">Fast Moving Inventory</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {fastMoving.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No medicine sales recorded in this range</p>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty Sold</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">In Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {fastMoving.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-green-700">{item.qtySold}</td>
                              <td className="px-4 py-2 text-sm text-right text-gray-500">{item.currentStock ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <h3 className="font-bold text-gray-800">Dead Inventory</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {deadInventory.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">Nothing in stock went unsold this range</p>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value Tied Up</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {deadInventory.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                              <td className="px-4 py-2 text-sm text-right text-gray-700">{item.stock}</td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-red-600">{fmt(item.stockValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 px-1">
                Fast Moving / Dead Inventory are derived from Medicine Sale bills in the selected range, matched to inventory items by name — this app doesn't track stock-outs directly, so this is the closest available signal to actual demand.
              </p>
            </div>
          )}
        </>
      )}
      {detail && <ReportPatientList title={detail.title} subtitle={detail.subtitle} rows={detail.rows} onClose={() => setDetail(null)} />}
    </div>
  );
};

export default Reports;
