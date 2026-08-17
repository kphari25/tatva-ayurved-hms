import React, { useState, useEffect, useMemo } from 'react';
import { FileBarChart, Users, Package, Calendar, Download, Bed, UserRound, Phone, TrendingUp, TrendingDown, IndianRupee, ShoppingCart } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

const inRange = (dateVal, start, end) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  return !isNaN(d) && d >= start && d <= end;
};

const quickRanges = {
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

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4" style={{ borderLeftColor: color }}>
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
  const [activeTab, setActiveTab] = useState('patients'); // patients | inventory
  const [rangeMode, setRangeMode] = useState('last-6');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rawData, setRawData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [patientsSnap, leadsSnap, salesSnap, expensesSnap, purchaseEntriesSnap, inventorySnap] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'leads')),
        getDocs(collection(db, 'medicine_sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'purchase_entries')),
        getDocs(collection(db, 'inventory')),
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
  const patientMonthly = useMemo(() => {
    if (!rawData) return [];
    return months.map(m => {
      const monthStart = new Date(m.year, m.month, 1);
      const monthEnd = new Date(m.year, m.month + 1, 0, 23, 59, 59);
      const ip = rawData.patients.filter(p => p.patient_type === 'IP' && inRange(p.created_at, monthStart, monthEnd)).length;
      const op = rawData.patients.filter(p => p.patient_type === 'OP' && inRange(p.created_at, monthStart, monthEnd)).length;
      const calledIn = rawData.leads.filter(l => inRange(l.created_at, monthStart, monthEnd)).length;
      return { ...m, ip, op, calledIn, total: ip + op };
    });
  }, [rawData, months]);

  const patientSummary = useMemo(() => patientMonthly.reduce((acc, m) => ({
    ip: acc.ip + m.ip,
    op: acc.op + m.op,
    calledIn: acc.calledIn + m.calledIn,
  }), { ip: 0, op: 0, calledIn: 0 }), [patientMonthly]);

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
    const exportData = patientMonthly.map(m => ({
      Month: m.label,
      'New IP Patients': m.ip,
      'New OP Patients': m.op,
      'Called In': m.calledIn,
      Total: m.total,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patient Report');
    XLSX.writeFile(wb, `Patient_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
            <p className="text-gray-600 text-sm">Patient intake and inventory movement, by month</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="New IP Patients" value={patientSummary.ip} icon={Bed} color="#8b5cf6" subtitle={rangeLabel} />
                <StatCard title="New OP Patients" value={patientSummary.op} icon={UserRound} color="#3b82f6" subtitle={rangeLabel} />
                <StatCard title="Called In" value={patientSummary.calledIn} icon={Phone} color="#f59e0b" subtitle="From Lead Management" />
                <StatCard title="Total Patients" value={patientSummary.ip + patientSummary.op} icon={Users} color="#14b8a6" subtitle="IP + OP" />
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
                    <Bar dataKey="ip" name="IP Patients" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="op" name="OP Patients" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="calledIn" name="Called In" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">New IP</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">New OP</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Called In</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {patientMonthly.map(m => (
                        <tr key={m.key} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">{m.label}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{m.ip}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{m.op}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-700">{m.calledIn}</td>
                          <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">{m.total}</td>
                        </tr>
                      ))}
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
    </div>
  );
};

export default Reports;
