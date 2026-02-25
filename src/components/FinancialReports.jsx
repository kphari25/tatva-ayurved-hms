import React, { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3, Download,
  Calendar, Package, Users, Home, Briefcase, Award, CreditCard,
  ArrowUpRight, ArrowDownRight, Activity, Target, Zap, Shield
} from 'lucide-react';

const FinancialReports = ({ dateRange = '30' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days
  const [viewMode, setViewMode] = useState('summary'); // summary, detailed

  // Sample data - In real app, fetch from database
  const financialData = {
    // Medicine Sales
    medicineSales: {
      totalRevenue: 450000,
      totalCost: 270000,
      totalProfit: 180000,
      transactions: 234,
      items: [
        { name: 'Ashwagandha Churna', sold: 150, revenue: 94500, cost: 67500, profit: 27000 },
        { name: 'Triphala Tablets', sold: 200, revenue: 54000, cost: 36000, profit: 18000 },
        { name: 'Brahmi Oil', sold: 80, revenue: 13920, cost: 9600, profit: 4320 }
      ]
    },

    // Consultation Revenue
    consultations: {
      total: 125000,
      count: 125,
      average: 1000
    },

    // Panchakarma Revenue
    panchakarma: {
      total: 85000,
      sessions: 34,
      average: 2500
    },

    // Expenses
    expenses: {
      rent: 35000,
      salary: [
        { name: 'Dr. Arjun Vaidya', role: 'Doctor', amount: 75000, paidDate: '2025-01-31', bonus: 10000 },
        { name: 'Reception Staff', role: 'Admin', amount: 25000, paidDate: '2025-01-31', bonus: 0 },
        { name: 'Therapist Maya', role: 'Therapist', amount: 30000, paidDate: '2025-01-31', bonus: 5000 },
        { name: 'Pharmacy Staff', role: 'Pharmacy', amount: 22000, paidDate: '2025-01-31', bonus: 0 }
      ],
      totalSalary: 152000,
      totalBonus: 15000,
      electricity: 8500,
      water: 1200,
      internet: 1500,
      supplies: 12000,
      maintenance: 5500,
      marketing: 8000,
      miscellaneous: [
        { category: 'Office Supplies', amount: 3200 },
        { category: 'Cleaning', amount: 2500 },
        { category: 'Medical Consumables', amount: 4800 },
        { category: 'Equipment Maintenance', amount: 2500 },
        { category: 'Professional Fees', amount: 5000 }
      ]
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = 
      financialData.medicineSales.totalRevenue +
      financialData.consultations.total +
      financialData.panchakarma.total;

    const totalExpenses = 
      financialData.expenses.rent +
      financialData.expenses.totalSalary +
      financialData.expenses.totalBonus +
      financialData.expenses.electricity +
      financialData.expenses.water +
      financialData.expenses.internet +
      financialData.expenses.supplies +
      financialData.expenses.maintenance +
      financialData.expenses.marketing +
      financialData.expenses.miscellaneous.reduce((sum, item) => sum + item.amount, 0);

    const grossProfit = totalRevenue - financialData.medicineSales.totalCost;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = (netProfit / totalRevenue) * 100;

    return {
      totalRevenue,
      totalExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      medicineCost: financialData.medicineSales.totalCost
    };
  }, [financialData]);

  const exportReport = () => {
    alert('Export Financial Report as PDF/Excel');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
              Financial Reports
            </h1>
            <p className="text-slate-600">Comprehensive profit & loss statement with expense breakdown</p>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 font-semibold"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last Quarter</option>
              <option value="365">Last Year</option>
            </select>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-semibold shadow-lg"
            >
              <Download className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-10 h-10" />
            <ArrowUpRight className="w-6 h-6 text-emerald-200" />
          </div>
          <p className="text-emerald-100 text-sm font-medium mb-1">Total Revenue</p>
          <p className="text-4xl font-bold">₹{totals.totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-emerald-200 mt-2">All income sources</p>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-10 h-10" />
            <Target className="w-6 h-6 text-blue-200" />
          </div>
          <p className="text-blue-100 text-sm font-medium mb-1">Net Profit</p>
          <p className="text-4xl font-bold">₹{totals.netProfit.toLocaleString()}</p>
          <p className="text-sm text-blue-200 mt-2">After all expenses</p>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <ArrowDownRight className="w-10 h-10" />
            <CreditCard className="w-6 h-6 text-red-200" />
          </div>
          <p className="text-red-100 text-sm font-medium mb-1">Total Expenses</p>
          <p className="text-4xl font-bold">₹{totals.totalExpenses.toLocaleString()}</p>
          <p className="text-sm text-red-200 mt-2">All costs combined</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-10 h-10" />
            <Zap className="w-6 h-6 text-purple-200" />
          </div>
          <p className="text-purple-100 text-sm font-medium mb-1">Profit Margin</p>
          <p className="text-4xl font-bold">{totals.profitMargin.toFixed(1)}%</p>
          <p className="text-sm text-purple-200 mt-2">Net margin ratio</p>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            Revenue Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { 
                label: 'Medicine Sales', 
                amount: financialData.medicineSales.totalRevenue, 
                color: 'emerald',
                icon: Package,
                details: `${financialData.medicineSales.transactions} transactions`
              },
              { 
                label: 'Consultations', 
                amount: financialData.consultations.total, 
                color: 'blue',
                icon: Users,
                details: `${financialData.consultations.count} consultations @ ₹${financialData.consultations.average} avg`
              },
              { 
                label: 'Panchakarma', 
                amount: financialData.panchakarma.total, 
                color: 'purple',
                icon: Activity,
                details: `${financialData.panchakarma.sessions} sessions @ ₹${financialData.panchakarma.average} avg`
              }
            ].map((item, i) => {
              const percentage = (item.amount / totals.totalRevenue) * 100;
              return (
                <div key={i} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                      <span className="font-semibold text-slate-700">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-slate-800">₹{item.amount.toLocaleString()}</span>
                      <span className="text-sm text-slate-500 ml-2">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 mb-1">
                    <div
                      className={`bg-gradient-to-r from-${item.color}-500 to-${item.color}-600 h-3 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500">{item.details}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Medicine Sales Detail */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Medicine Sales Analysis
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <p className="text-xs text-emerald-600 font-semibold mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-700">₹{financialData.medicineSales.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-xs text-red-600 font-semibold mb-1">Cost Price</p>
                <p className="text-2xl font-bold text-red-700">₹{financialData.medicineSales.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-xs text-blue-600 font-semibold mb-1">Gross Profit</p>
                <p className="text-2xl font-bold text-blue-700">₹{financialData.medicineSales.totalProfit.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-700 mb-2">Top Selling Medicines:</p>
              {financialData.medicineSales.items.map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800">{item.name}</span>
                    <span className="text-sm font-bold text-emerald-600">₹{item.profit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{item.sold} units sold</span>
                    <span>Revenue: ₹{item.revenue.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-red-600" />
          Expense Breakdown
        </h3>
        
        <div className="grid grid-cols-2 gap-8">
          {/* Fixed Expenses */}
          <div>
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Fixed Expenses
            </h4>
            <div className="space-y-3">
              {[
                { label: 'Rent', amount: financialData.expenses.rent, icon: Home },
                { label: 'Salary', amount: financialData.expenses.totalSalary, icon: Users },
                { label: 'Bonus', amount: financialData.expenses.totalBonus, icon: Award },
                { label: 'Electricity', amount: financialData.expenses.electricity, icon: Zap },
                { label: 'Water', amount: financialData.expenses.water, icon: Activity },
                { label: 'Internet', amount: financialData.expenses.internet, icon: Activity }
              ].map((expense, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <expense.icon className="w-4 h-4 text-slate-500" />
                    <span className="font-medium text-slate-700">{expense.label}</span>
                  </div>
                  <span className="font-bold text-slate-800">₹{expense.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Variable Expenses */}
          <div>
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              Variable Expenses
            </h4>
            <div className="space-y-3">
              {[
                { label: 'Supplies', amount: financialData.expenses.supplies },
                { label: 'Maintenance', amount: financialData.expenses.maintenance },
                { label: 'Marketing', amount: financialData.expenses.marketing }
              ].map((expense, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-medium text-slate-700">{expense.label}</span>
                  <span className="font-bold text-slate-800">₹{expense.amount.toLocaleString()}</span>
                </div>
              ))}

              <div className="mt-4">
                <p className="font-semibold text-slate-700 mb-2">Miscellaneous:</p>
                <div className="space-y-2">
                  {financialData.expenses.miscellaneous.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-amber-50 rounded border border-amber-200">
                      <span className="text-slate-600">{item.category}</span>
                      <span className="font-bold text-slate-800">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Salary Details */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6 mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Users className="w-6 h-6 text-purple-600" />
          Salary & Bonus Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Employee</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Role</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Salary</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Bonus</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Total</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Paid Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financialData.expenses.salary.map((employee, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-800">{employee.name}</td>
                  <td className="px-6 py-4 text-slate-600">{employee.role}</td>
                  <td className="px-6 py-4 font-bold text-blue-600">₹{employee.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">
                    {employee.bonus > 0 ? `₹${employee.bonus.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 font-bold text-purple-600">
                    ₹{(employee.amount + employee.bonus).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{new Date(employee.paidDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan="2" className="px-6 py-4 font-bold text-slate-800">TOTAL</td>
                <td className="px-6 py-4 font-bold text-blue-600">₹{financialData.expenses.totalSalary.toLocaleString()}</td>
                <td className="px-6 py-4 font-bold text-emerald-600">₹{financialData.expenses.totalBonus.toLocaleString()}</td>
                <td className="px-6 py-4 font-bold text-purple-600">
                  ₹{(financialData.expenses.totalSalary + financialData.expenses.totalBonus).toLocaleString()}
                </td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary P&L Statement */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl p-8 text-white">
        <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <BarChart3 className="w-8 h-8" />
          Profit & Loss Statement
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-white/20">
            <span className="text-lg font-semibold">Total Revenue</span>
            <span className="text-2xl font-bold text-emerald-400">₹{totals.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/20">
            <span className="text-lg font-semibold">Medicine Cost</span>
            <span className="text-2xl font-bold text-red-400">- ₹{totals.medicineCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/20 bg-white/5 px-4 rounded-lg">
            <span className="text-lg font-semibold">Gross Profit</span>
            <span className="text-2xl font-bold text-blue-400">₹{totals.grossProfit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/20">
            <span className="text-lg font-semibold">Operating Expenses</span>
            <span className="text-2xl font-bold text-red-400">- ₹{(totals.totalExpenses - totals.medicineCost).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-4 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 rounded-xl mt-4">
            <span className="text-xl font-bold">NET PROFIT</span>
            <span className="text-3xl font-bold">₹{totals.netProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReports;
