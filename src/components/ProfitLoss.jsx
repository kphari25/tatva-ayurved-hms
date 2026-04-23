import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, RefreshCw, Plus, Filter } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const ProfitLoss = () => {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('month'); // today, week, month, year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  
  const [plData, setPLData] = useState({
    // Revenue
    patientRevenue: 0,
    medicineRevenue: 0,
    packageRevenue: 0,
    totalRevenue: 0,

    // Cost of Goods Sold (Medicine Purchase)
    medicinePurchaseCost: 0,
    
    // Gross Profit
    grossProfit: 0,
    grossProfitMargin: 0,

    // Expenses
    messExpense: 0,
    salaryExpense: 0,
    electricityExpense: 0,
    rentExpense: 0,
    maintenanceExpense: 0,
    marketingExpense: 0,
    miscExpense: 0,
    totalExpenses: 0,

    // Net Profit
    netProfit: 0,
    netProfitMargin: 0,

    // Detailed breakdowns
    revenueBreakdown: [],
    expenseBreakdown: [],
    monthlyTrend: []
  });

  useEffect(() => {
    loadPLData();
  }, [dateFilter, customStartDate, customEndDate]);

  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = customEndDate ? new Date(customEndDate) : now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    return { startDate, endDate };
  };

  const loadPLData = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      // Load all data sources
      const [invoices, inventory, messExpenses, expenses] = await Promise.all([
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'mess_expenses')),
        getDocs(collection(db, 'expenses'))
      ]);

      // Calculate Revenue from Invoices
      let patientRevenue = 0;
      let medicineRevenue = 0;
      let packageRevenue = 0;

      invoices.docs.forEach(doc => {
        const invoice = doc.data();
        const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
        
        if (invoiceDate >= startDate && invoiceDate <= endDate) {
          const total = parseFloat(invoice.total_amount) || 0;
          
          // Revenue from treatments (OP/IP without medicines)
          const treatmentAmount = (parseFloat(invoice.treatment_charges) || 0) +
                                 (parseFloat(invoice.room_charges) || 0) +
                                 (parseFloat(invoice.mess_charges) || 0);
          patientRevenue += treatmentAmount;

          // Revenue from medicines sold
          const medicineAmount = invoice.medicines?.reduce((sum, med) => 
            sum + (parseFloat(med.quantity) * parseFloat(med.rate)), 0) || 0;
          medicineRevenue += medicineAmount;

          // If package mentioned, count as package revenue
          if (invoice.package_name) {
            packageRevenue += total;
          }
        }
      });

      // Calculate Medicine Purchase Cost (COGS)
      let medicinePurchaseCost = 0;
      inventory.docs.forEach(doc => {
        const item = doc.data();
        const purchasePrice = parseFloat(item.purchase_price) || 0;
        const quantity = parseFloat(item.stock_quantity) || 0;
        medicinePurchaseCost += purchasePrice * quantity;
      });

      // Calculate Mess Expenses
      let messExpense = 0;
      messExpenses.docs.forEach(doc => {
        const expense = doc.data();
        const expenseDate = new Date(expense.date);
        
        if (expenseDate >= startDate && expenseDate <= endDate) {
          messExpense += parseFloat(expense.total_amount) || 0;
        }
      });

      // Calculate Other Expenses
      let salaryExpense = 0;
      let electricityExpense = 0;
      let rentExpense = 0;
      let maintenanceExpense = 0;
      let marketingExpense = 0;
      let miscExpense = 0;

      expenses.docs.forEach(doc => {
        const expense = doc.data();
        const expenseDate = new Date(expense.date);
        
        if (expenseDate >= startDate && expenseDate <= endDate) {
          const amount = parseFloat(expense.amount) || 0;
          
          switch (expense.category?.toLowerCase()) {
            case 'salary':
            case 'salaries':
              salaryExpense += amount;
              break;
            case 'electricity':
            case 'utilities':
              electricityExpense += amount;
              break;
            case 'rent':
              rentExpense += amount;
              break;
            case 'maintenance':
            case 'repairs':
              maintenanceExpense += amount;
              break;
            case 'marketing':
            case 'advertising':
              marketingExpense += amount;
              break;
            default:
              miscExpense += amount;
          }
        }
      });

      // Calculate totals
      const totalRevenue = patientRevenue + medicineRevenue + packageRevenue;
      const grossProfit = totalRevenue - medicinePurchaseCost;
      const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;
      
      const totalExpenses = messExpense + salaryExpense + electricityExpense + 
                           rentExpense + maintenanceExpense + marketingExpense + miscExpense;
      
      const netProfit = grossProfit - totalExpenses;
      const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

      // Prepare breakdown data for charts
      const revenueBreakdown = [
        { name: 'Patient Services', value: patientRevenue, color: '#3b82f6' },
        { name: 'Medicine Sales', value: medicineRevenue, color: '#10b981' },
        { name: 'Package Revenue', value: packageRevenue, color: '#8b5cf6' }
      ];

      const expenseBreakdown = [
        { name: 'Medicine Purchase', value: medicinePurchaseCost, color: '#ef4444' },
        { name: 'Mess Expense', value: messExpense, color: '#f59e0b' },
        { name: 'Salaries', value: salaryExpense, color: '#ec4899' },
        { name: 'Electricity', value: electricityExpense, color: '#14b8a6' },
        { name: 'Rent', value: rentExpense, color: '#6366f1' },
        { name: 'Maintenance', value: maintenanceExpense, color: '#f97316' },
        { name: 'Marketing', value: marketingExpense, color: '#06b6d4' },
        { name: 'Miscellaneous', value: miscExpense, color: '#84cc16' }
      ].filter(item => item.value > 0);

      setPLData({
        patientRevenue,
        medicineRevenue,
        packageRevenue,
        totalRevenue,
        medicinePurchaseCost,
        grossProfit,
        grossProfitMargin,
        messExpense,
        salaryExpense,
        electricityExpense,
        rentExpense,
        maintenanceExpense,
        marketingExpense,
        miscExpense,
        totalExpenses,
        netProfit,
        netProfitMargin,
        revenueBreakdown,
        expenseBreakdown
      });

      console.log('✅ P&L data loaded');

    } catch (error) {
      console.error('Error loading P&L data:', error);
      alert('Failed to load P&L data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = [
      { Category: 'REVENUE', Description: '', Amount: '' },
      { Category: '', Description: 'Patient Services', Amount: plData.patientRevenue },
      { Category: '', Description: 'Medicine Sales', Amount: plData.medicineRevenue },
      { Category: '', Description: 'Package Revenue', Amount: plData.packageRevenue },
      { Category: '', Description: 'Total Revenue', Amount: plData.totalRevenue },
      { Category: '', Description: '', Amount: '' },
      { Category: 'COST OF GOODS SOLD', Description: '', Amount: '' },
      { Category: '', Description: 'Medicine Purchase', Amount: plData.medicinePurchaseCost },
      { Category: '', Description: '', Amount: '' },
      { Category: 'GROSS PROFIT', Description: '', Amount: plData.grossProfit },
      { Category: '', Description: `Gross Margin: ${plData.grossProfitMargin.toFixed(1)}%`, Amount: '' },
      { Category: '', Description: '', Amount: '' },
      { Category: 'OPERATING EXPENSES', Description: '', Amount: '' },
      { Category: '', Description: 'Mess Expense', Amount: plData.messExpense },
      { Category: '', Description: 'Salaries', Amount: plData.salaryExpense },
      { Category: '', Description: 'Electricity', Amount: plData.electricityExpense },
      { Category: '', Description: 'Rent', Amount: plData.rentExpense },
      { Category: '', Description: 'Maintenance', Amount: plData.maintenanceExpense },
      { Category: '', Description: 'Marketing', Amount: plData.marketingExpense },
      { Category: '', Description: 'Miscellaneous', Amount: plData.miscExpense },
      { Category: '', Description: 'Total Expenses', Amount: plData.totalExpenses },
      { Category: '', Description: '', Amount: '' },
      { Category: 'NET PROFIT', Description: '', Amount: plData.netProfit },
      { Category: '', Description: `Net Margin: ${plData.netProfitMargin.toFixed(1)}%`, Amount: '' }
    ];

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Statement');
    XLSX.writeFile(wb, `PL_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      {trend !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );

  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Profit & Loss Statement</h1>
              <p className="text-gray-600 text-sm">Real-time financial performance overview</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Expense
            </button>
            <button
              onClick={loadPLData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div className="flex gap-2">
            {['today', 'week', 'month', 'year', 'custom'].map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateFilter === filter
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          {dateFilter === 'custom' && (
            <div className="flex gap-2 ml-4">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span className="self-center">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Revenue"
          value={`₹${plData.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="#10b981"
          subtitle="All income sources"
        />
        <StatCard
          title="Gross Profit"
          value={`₹${plData.grossProfit.toLocaleString()}`}
          icon={TrendingUp}
          color="#3b82f6"
          subtitle={`${plData.grossProfitMargin.toFixed(1)}% margin`}
        />
        <StatCard
          title="Total Expenses"
          value={`₹${plData.totalExpenses.toLocaleString()}`}
          icon={TrendingDown}
          color="#ef4444"
          subtitle="Operating costs"
        />
        <StatCard
          title="Net Profit"
          value={`₹${plData.netProfit.toLocaleString()}`}
          icon={DollarSign}
          color={plData.netProfit >= 0 ? '#10b981' : '#ef4444'}
          subtitle={`${plData.netProfitMargin.toFixed(1)}% margin`}
        />
      </div>

      {/* Main P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* P&L Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Statement Details</h2>
          </div>
          <div className="p-6">
            {/* Revenue Section */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">REVENUE</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Patient Services</span>
                  <span className="font-semibold text-gray-900">₹{plData.patientRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Medicine Sales</span>
                  <span className="font-semibold text-gray-900">₹{plData.medicineRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Package Revenue</span>
                  <span className="font-semibold text-gray-900">₹{plData.packageRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total Revenue</span>
                  <span className="font-bold text-green-600 text-lg">₹{plData.totalRevenue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* COGS Section */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">COST OF GOODS SOLD</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Medicine Purchase</span>
                  <span className="font-semibold text-gray-900">₹{plData.medicinePurchaseCost.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-900 text-lg">GROSS PROFIT</span>
                  <p className="text-xs text-gray-600 mt-1">Margin: {plData.grossProfitMargin.toFixed(1)}%</p>
                </div>
                <span className="font-bold text-blue-600 text-2xl">₹{plData.grossProfit.toLocaleString()}</span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3 text-lg border-b pb-2">OPERATING EXPENSES</h3>
              <div className="space-y-2">
                {plData.messExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Mess Expense</span>
                    <span className="font-semibold text-gray-900">₹{plData.messExpense.toLocaleString()}</span>
                  </div>
                )}
                {plData.salaryExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Salaries</span>
                    <span className="font-semibold text-gray-900">₹{plData.salaryExpense.toLocaleString()}</span>
                  </div>
                )}
                {plData.electricityExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Electricity</span>
                    <span className="font-semibold text-gray-900">₹{plData.electricityExpense.toLocaleString()}</span>
                  </div>
                )}
                {plData.rentExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Rent</span>
                    <span className="font-semibold text-gray-900">₹{plData.rentExpense.toLocaleString()}</span>
                  </div>
                )}
                {plData.maintenanceExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Maintenance</span>
                    <span className="font-semibold text-gray-900">₹{plData.maintenanceExpense.toLocaleString()}</span>
                  </div>
                )}
                {plData.marketingExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Marketing</span>
                    <span className="font-semibold text-gray-900">₹{plData.marketingExpense.toLocaleString()}</span>
                  </div>
                )}
                {plData.miscExpense > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Miscellaneous</span>
                    <span className="font-semibold text-gray-900">₹{plData.miscExpense.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total Expenses</span>
                  <span className="font-bold text-red-600 text-lg">₹{plData.totalExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className={`p-4 rounded-lg ${plData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-900 text-xl">NET PROFIT</span>
                  <p className="text-xs text-gray-600 mt-1">Margin: {plData.netProfitMargin.toFixed(1)}%</p>
                </div>
                <span className={`font-bold text-3xl ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{plData.netProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Column */}
        <div className="space-y-6">
          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">Revenue Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={plData.revenueBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {plData.revenueBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">Expense Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={plData.expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {plData.expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-1">
              {plData.expenseBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="font-semibold">₹{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <AddExpenseModal
          onClose={() => setShowAddExpenseModal(false)}
          onSave={() => {
            setShowAddExpenseModal(false);
            loadPLData();
          }}
        />
      )}
    </div>
  );
};

// Add Expense Modal Component
const AddExpenseModal = ({ onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'salary',
    amount: 0,
    description: '',
    payment_mode: 'cash'
  });

  const handleSave = async () => {
    if (!formData.amount || formData.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, 'expenses'), {
        ...formData,
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      });

      alert('✅ Expense added successfully!');
      if (onSave) onSave();

    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-orange-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold">Add Expense</h2>
          <button onClick={onClose} className="hover:bg-orange-700 p-2 rounded">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="salary">Salary</option>
              <option value="electricity">Electricity</option>
              <option value="rent">Rent</option>
              <option value="maintenance">Maintenance</option>
              <option value="marketing">Marketing</option>
              <option value="miscellaneous">Miscellaneous</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Optional notes..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
            <select
              value={formData.payment_mode}
              onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;
