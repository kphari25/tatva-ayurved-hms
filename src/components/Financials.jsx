import React, { useState, useEffect, useMemo } from 'react';
import { IndianRupee, Printer, RefreshCw, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const emptyTotals = () => ({
  opRevenue: 0,
  ipRevenue: 0,
  medicineRevenueInvoices: 0,
  medicineRevenueStandalone: 0,
  totalRevenue: 0,
  medicinePurchaseExpense: 0,
  messExpense: 0,
  salaryExpense: 0,
  otherExpenseByCategory: {},
  totalExpenses: 0,
  netProfit: 0
});

const aggregateRange = (data, startDate, endDate) => {
  const totals = emptyTotals();

  data.invoices.forEach((inv) => {
    const d = new Date(inv.invoice_date || inv.created_at);
    if (isNaN(d) || d < startDate || d > endDate) return;
    const total = parseFloat(inv.total_amount) || 0;
    if (inv.invoice_type === 'IP') totals.ipRevenue += total;
    else totals.opRevenue += total;
    const medAmount = (inv.medicines || []).reduce(
      (sum, med) => sum + (parseFloat(med.quantity) || 0) * (parseFloat(med.rate) || 0), 0
    );
    totals.medicineRevenueInvoices += medAmount;
  });

  data.medicineSales.forEach((sale) => {
    const d = new Date(sale.sale_date || sale.created_at);
    if (isNaN(d) || d < startDate || d > endDate) return;
    totals.medicineRevenueStandalone += parseFloat(sale.total_amount) || 0;
  });

  data.expenses.forEach((exp) => {
    const d = new Date(exp.date || exp.created_at);
    if (isNaN(d) || d < startDate || d > endDate) return;
    const category = (exp.category || 'other').toLowerCase();
    if (category === 'salary' || category === 'salaries') return; // salary comes from hr_payroll
    const amount = parseFloat(exp.amount) || 0;
    if (category === 'medicine_purchase') {
      totals.medicinePurchaseExpense += amount;
    } else {
      totals.otherExpenseByCategory[category] = (totals.otherExpenseByCategory[category] || 0) + amount;
    }
  });

  data.messExpenses.forEach((exp) => {
    const d = new Date(exp.date || exp.created_at);
    if (isNaN(d) || d < startDate || d > endDate) return;
    totals.messExpense += parseFloat(exp.total_amount) || 0;
  });

  data.hrPayroll.forEach((p) => {
    if (!p.month) return;
    const [y, m] = p.month.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    if (isNaN(d) || d < startDate || d > endDate) return;
    totals.salaryExpense += parseFloat(p.netSalary) || 0;
  });

  totals.totalRevenue =
    totals.opRevenue + totals.ipRevenue + totals.medicineRevenueInvoices + totals.medicineRevenueStandalone;

  const otherExpenseTotal = Object.values(totals.otherExpenseByCategory).reduce((s, v) => s + v, 0);

  totals.totalExpenses =
    totals.medicinePurchaseExpense + totals.messExpense + totals.salaryExpense + otherExpenseTotal;

  totals.netProfit = totals.totalRevenue - totals.totalExpenses;

  return totals;
};

const quickRanges = {
  'this-month': () => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth(), 1), now];
  },
  'last-month': () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return [start, end];
  },
  'this-year': () => {
    const now = new Date();
    return [new Date(now.getFullYear(), 0, 1), now];
  }
};

const Financials = () => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState(null);
  const [rangeMode, setRangeMode] = useState('this-month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoicesSnap, medicineSalesSnap, expensesSnap, messExpensesSnap, hrPayrollSnap] = await Promise.all([
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'medicine_sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'mess_expenses')),
        getDocs(collection(db, 'hr_payroll'))
      ]);

      setRawData({
        invoices: invoicesSnap.docs.map((d) => d.data()),
        medicineSales: medicineSalesSnap.docs.map((d) => d.data()),
        expenses: expensesSnap.docs.map((d) => d.data()),
        messExpenses: messExpensesSnap.docs.map((d) => d.data()),
        hrPayroll: hrPayrollSnap.docs.map((d) => d.data())
      });
    } catch (error) {
      console.error('Error loading financials data:', error);
      alert('Failed to load financials data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRange = useMemo(() => {
    if (rangeMode === 'custom') {
      const now = new Date();
      const start = customStart ? new Date(customStart + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = customEnd ? new Date(customEnd + 'T23:59:59') : now;
      return [start, end];
    }
    return quickRanges[rangeMode]();
  }, [rangeMode, customStart, customEnd]);

  const summary = useMemo(() => {
    if (!rawData) return emptyTotals();
    return aggregateRange(rawData, selectedRange[0], selectedRange[1]);
  }, [rawData, selectedRange]);

  const monthlyLedger = useMemo(() => {
    if (!rawData) return [];

    const allDates = [
      ...rawData.invoices.map((i) => new Date(i.invoice_date || i.created_at)),
      ...rawData.medicineSales.map((s) => new Date(s.sale_date || s.created_at)),
      ...rawData.expenses.map((e) => new Date(e.date || e.created_at)),
      ...rawData.messExpenses.map((e) => new Date(e.date || e.created_at)),
      ...rawData.hrPayroll.map((p) => {
        if (!p.month) return null;
        const [y, m] = p.month.split('-').map(Number);
        return new Date(y, (m || 1) - 1, 1);
      })
    ].filter((d) => d && !isNaN(d));

    const now = new Date();
    let earliest = new Date(now.getFullYear(), now.getMonth() - 11, 1); // fallback: last 12 months
    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates));
      earliest = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    }

    const months = [];
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor >= earliest) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      months.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: monthLabel(year, month),
        totals: aggregateRange(rawData, monthStart, monthEnd)
      });
      cursor = new Date(year, month - 1, 1);
    }

    return months;
  }, [rawData]);

  const handlePrintSummary = () => {
    const [start, end] = selectedRange;
    const rangeLabel = `${start.toLocaleDateString('en-IN')} - ${end.toLocaleDateString('en-IN')}`;
    const spansMultipleMonths =
      start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth();

    const otherExpenseRows = Object.entries(summary.otherExpenseByCategory)
      .map(
        ([cat, amt]) => `
        <tr><td>${cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</td><td style="text-align:right;">${fmt(amt)}</td></tr>`
      )
      .join('');

    const monthlyRows = spansMultipleMonths
      ? monthlyLedger
          .filter((m) => {
            const [y, mo] = m.key.split('-').map(Number);
            const mDate = new Date(y, mo - 1, 1);
            return mDate >= new Date(start.getFullYear(), start.getMonth(), 1) && mDate <= end;
          })
          .map(
            (m) => `
            <tr>
              <td>${m.label}</td>
              <td style="text-align:right;">${fmt(m.totals.totalRevenue)}</td>
              <td style="text-align:right;">${fmt(m.totals.totalExpenses)}</td>
              <td style="text-align:right;">${fmt(m.totals.netProfit)}</td>
            </tr>`
          )
          .join('')
      : '';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Summary</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #14b8a6; padding-bottom: 10px; }
          .header img { height: 80px; margin-bottom: 10px; }
          .header h1 { color: #14b8a6; margin: 10px 0; }
          .header .tagline { color: #666; font-size: 14px; margin: 5px 0; }
          h3 { color: #14b8a6; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #14b8a6; color: white; }
          .grand-total { background: #14b8a6; color: white; font-weight: bold; font-size: 16px; }
          .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'">
          <h1>Tatva Ayurved</h1>
          <p class="tagline">Ayurveda for Health &amp; Happiness</p>
          <p style="margin: 5px 0; font-size: 12px;">Financial Summary</p>
        </div>

        <p><strong>Period:</strong> ${rangeLabel}</p>
        <p><strong>Generated on:</strong> ${new Date().toLocaleString('en-IN')}</p>

        <h3>Revenue</h3>
        <table>
          <tr><td>OP Revenue</td><td style="text-align:right;">${fmt(summary.opRevenue)}</td></tr>
          <tr><td>IP Revenue</td><td style="text-align:right;">${fmt(summary.ipRevenue)}</td></tr>
          <tr><td>Medicine Revenue (Invoices)</td><td style="text-align:right;">${fmt(summary.medicineRevenueInvoices)}</td></tr>
          <tr><td>Medicine Revenue (Counter Sales)</td><td style="text-align:right;">${fmt(summary.medicineRevenueStandalone)}</td></tr>
          <tr class="grand-total"><td>Total Revenue</td><td style="text-align:right;">${fmt(summary.totalRevenue)}</td></tr>
        </table>

        <h3>Expenses</h3>
        <table>
          <tr><td>Medicine Purchase</td><td style="text-align:right;">${fmt(summary.medicinePurchaseExpense)}</td></tr>
          <tr><td>Mess Expense</td><td style="text-align:right;">${fmt(summary.messExpense)}</td></tr>
          <tr><td>Salaries</td><td style="text-align:right;">${fmt(summary.salaryExpense)}</td></tr>
          ${otherExpenseRows}
          <tr class="grand-total"><td>Total Expenses</td><td style="text-align:right;">${fmt(summary.totalExpenses)}</td></tr>
        </table>

        <h3>Net Profit</h3>
        <table>
          <tr class="grand-total"><td>Net Profit</td><td style="text-align:right;">${fmt(summary.netProfit)}</td></tr>
        </table>

        ${spansMultipleMonths ? `
          <h3>Monthly Breakdown</h3>
          <table>
            <thead>
              <tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Net</th></tr>
            </thead>
            <tbody>${monthlyRows}</tbody>
          </table>
        ` : ''}

        <div class="footer">
          <p>Thank you for choosing Tatva Ayurved Hospital</p>
          <p>This is a computer-generated financial summary</p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 30px; background: #14b8a6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
            Print
          </button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Revenue', value: summary.totalRevenue, color: 'text-green-600' },
    { label: 'Total Expenses', value: summary.totalExpenses, color: 'text-red-600' },
    { label: 'Net Profit', value: summary.netProfit, color: summary.netProfit >= 0 ? 'text-teal-600' : 'text-red-600' }
  ];

  const revenueSplit = [
    { label: 'OP Revenue', value: summary.opRevenue },
    { label: 'IP Revenue', value: summary.ipRevenue },
    { label: 'Medicine (Invoices)', value: summary.medicineRevenueInvoices },
    { label: 'Medicine (Counter Sales)', value: summary.medicineRevenueStandalone }
  ];

  const otherExpenseTotal = Object.values(summary.otherExpenseByCategory).reduce((s, v) => s + v, 0);
  const expenseSplit = [
    { label: 'Medicine Purchase', value: summary.medicinePurchaseExpense },
    { label: 'Mess', value: summary.messExpense },
    { label: 'Salaries', value: summary.salaryExpense },
    { label: 'Other', value: otherExpenseTotal }
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <IndianRupee className="w-7 h-7 text-teal-600" />
          <h1 className="text-2xl font-bold text-gray-800">Financials</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'this-month', label: 'This Month' },
            { id: 'last-month', label: 'Last Month' },
            { id: 'this-year', label: 'This Year' },
            { id: 'custom', label: 'Custom' }
          ].map((opt) => (
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
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-sm outline-none"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-sm outline-none"
              />
            </div>
          )}
          <button
            onClick={handlePrintSummary}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
          >
            <Printer className="w-4 h-4" />
            Print Summary
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {selectedRange[0].toLocaleDateString('en-IN')} - {selectedRange[1].toLocaleDateString('en-IN')}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Revenue / Expense split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue Split</h3>
          {revenueSplit.map((r) => (
            <div key={r.label} className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
              <span className="text-gray-600">{r.label}</span>
              <span className="font-medium text-gray-800">{fmt(r.value)}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Expense Split</h3>
          {expenseSplit.map((r) => (
            <div key={r.label} className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
              <span className="text-gray-600">{r.label}</span>
              <span className="font-medium text-gray-800">{fmt(r.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly ledger */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Monthly Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium text-right">OP Revenue</th>
                <th className="px-4 py-3 font-medium text-right">IP Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Medicine Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Total Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Total Expenses</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyLedger.map((m) => {
                const isExpanded = expandedMonth === m.key;
                const medicineRevenue = m.totals.medicineRevenueInvoices + m.totals.medicineRevenueStandalone;
                const otherExp = Object.values(m.totals.otherExpenseByCategory).reduce((s, v) => s + v, 0);
                return (
                  <React.Fragment key={m.key}>
                    <tr
                      onClick={() => setExpandedMonth(isExpanded ? null : m.key)}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
                      <td className="px-4 py-3 text-right">{fmt(m.totals.opRevenue)}</td>
                      <td className="px-4 py-3 text-right">{fmt(m.totals.ipRevenue)}</td>
                      <td className="px-4 py-3 text-right">{fmt(medicineRevenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(m.totals.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(m.totals.totalExpenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.totals.netProfit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                        {fmt(m.totals.netProfit)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td></td>
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Revenue</p>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between"><span>OP Revenue</span><span>{fmt(m.totals.opRevenue)}</span></div>
                                <div className="flex justify-between"><span>IP Revenue</span><span>{fmt(m.totals.ipRevenue)}</span></div>
                                <div className="flex justify-between"><span>Medicine (Invoices)</span><span>{fmt(m.totals.medicineRevenueInvoices)}</span></div>
                                <div className="flex justify-between"><span>Medicine (Counter Sales)</span><span>{fmt(m.totals.medicineRevenueStandalone)}</span></div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Expenses</p>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between"><span>Medicine Purchase</span><span>{fmt(m.totals.medicinePurchaseExpense)}</span></div>
                                <div className="flex justify-between"><span>Mess</span><span>{fmt(m.totals.messExpense)}</span></div>
                                <div className="flex justify-between"><span>Salaries</span><span>{fmt(m.totals.salaryExpense)}</span></div>
                                {Object.entries(m.totals.otherExpenseByCategory).map(([cat, amt]) => (
                                  <div key={cat} className="flex justify-between">
                                    <span>{cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                                    <span>{fmt(amt)}</span>
                                  </div>
                                ))}
                                {otherExp === 0 && Object.keys(m.totals.otherExpenseByCategory).length === 0 && null}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {monthlyLedger.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No financial data found yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Financials;
