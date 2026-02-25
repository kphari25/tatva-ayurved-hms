import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Package, Calendar, Clock, BarChart3,
  Download, Filter, AlertCircle, CheckCircle, Archive, Zap,
  Activity, Layers, Timer, Award
} from 'lucide-react';

const InventoryAnalytics = ({ inventory = [], salesHistory = [] }) => {
  const [dateRange, setDateRange] = useState('30'); // days
  const [sortBy, setSortBy] = useState('movement'); // movement, age, value

  // Calculate analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (parseInt(dateRange) * 24 * 60 * 60 * 1000));

    return inventory.map(medicine => {
      // Calculate sales in date range
      const medicineSales = salesHistory.filter(sale => 
        sale.medicineId === medicine.id &&
        new Date(sale.date) >= cutoffDate
      );

      const totalSold = medicineSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const totalRevenue = medicineSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const totalProfit = medicineSales.reduce((sum, sale) => sum + sale.profit, 0);

      // Calculate shelf age
      const purchaseDate = new Date(medicine.purchaseDate);
      const shelfAgeDays = Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24));

      // Calculate turnover rate (sales per day)
      const turnoverRate = totalSold / parseInt(dateRange);

      // Days until expiry
      const expiryDate = new Date(medicine.expiryDate);
      const daysToExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

      // Movement classification
      let movementClass = 'slow';
      if (turnoverRate >= 5) movementClass = 'fast';
      else if (turnoverRate >= 2) movementClass = 'medium';

      // Risk assessment
      let riskLevel = 'low';
      if (daysToExpiry < 90 && medicine.quantity > totalSold) riskLevel = 'high';
      else if (shelfAgeDays > 180 && totalSold < 10) riskLevel = 'medium';

      return {
        ...medicine,
        totalSold,
        totalRevenue,
        totalProfit,
        shelfAgeDays,
        turnoverRate,
        daysToExpiry,
        movementClass,
        riskLevel,
        stockValue: medicine.quantity * medicine.purchasePrice
      };
    });
  }, [inventory, salesHistory, dateRange]);

  // Sort analytics
  const sortedAnalytics = useMemo(() => {
    const sorted = [...analytics];
    switch (sortBy) {
      case 'movement':
        return sorted.sort((a, b) => b.turnoverRate - a.turnoverRate);
      case 'age':
        return sorted.sort((a, b) => b.shelfAgeDays - a.shelfAgeDays);
      case 'value':
        return sorted.sort((a, b) => b.stockValue - a.stockValue);
      default:
        return sorted;
    }
  }, [analytics, sortBy]);

  // Summary statistics
  const summary = useMemo(() => {
    const fast = analytics.filter(a => a.movementClass === 'fast');
    const medium = analytics.filter(a => a.movementClass === 'medium');
    const slow = analytics.filter(a => a.movementClass === 'slow');
    const highRisk = analytics.filter(a => a.riskLevel === 'high');

    return {
      fastMoving: fast.length,
      mediumMoving: medium.length,
      slowMoving: slow.length,
      highRisk: highRisk.length,
      totalStockValue: analytics.reduce((sum, a) => sum + a.stockValue, 0),
      totalRevenue: analytics.reduce((sum, a) => sum + a.totalRevenue, 0),
      totalProfit: analytics.reduce((sum, a) => sum + a.totalProfit, 0),
      averageShelfAge: Math.round(analytics.reduce((sum, a) => sum + a.shelfAgeDays, 0) / analytics.length)
    };
  }, [analytics]);

  const exportReport = () => {
    alert('Export functionality: Download CSV/Excel report with all analytics data');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Inventory Analytics
            </h1>
            <p className="text-slate-600">Movement analysis, shelf age tracking, and risk assessment</p>
          </div>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-3 border-2 border-purple-200 rounded-xl focus:border-purple-500 font-semibold"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg"
            >
              <Download className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-emerald-600" />
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Fast Moving</p>
          <p className="text-3xl font-bold text-slate-800">{summary.fastMoving}</p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">High turnover rate</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <Activity className="w-7 h-7 text-blue-600" />
            </div>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Medium Moving</p>
          <p className="text-3xl font-bold text-slate-800">{summary.mediumMoving}</p>
          <p className="text-xs text-blue-600 font-semibold mt-1">Moderate turnover</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-amber-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
              <Archive className="w-7 h-7 text-amber-600" />
            </div>
            <TrendingDown className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Slow Moving</p>
          <p className="text-3xl font-bold text-slate-800">{summary.slowMoving}</p>
          <p className="text-xs text-amber-600 font-semibold mt-1">Low turnover rate</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">High Risk</p>
          <p className="text-3xl font-bold text-slate-800">{summary.highRisk}</p>
          <p className="text-xs text-red-600 font-semibold mt-1">Expiring or stagnant</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 shadow-lg text-white">
          <p className="text-purple-100 text-sm font-medium mb-2">Total Stock Value</p>
          <p className="text-4xl font-bold">₹{summary.totalStockValue.toLocaleString()}</p>
          <p className="text-sm text-purple-200 mt-2">Current inventory worth</p>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg text-white">
          <p className="text-blue-100 text-sm font-medium mb-2">Revenue ({dateRange} days)</p>
          <p className="text-4xl font-bold">₹{summary.totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-blue-200 mt-2">From medicine sales</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 shadow-lg text-white">
          <p className="text-emerald-100 text-sm font-medium mb-2">Profit ({dateRange} days)</p>
          <p className="text-4xl font-bold">₹{summary.totalProfit.toLocaleString()}</p>
          <p className="text-sm text-emerald-200 mt-2">Net margin from sales</p>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <span className="font-semibold text-slate-700">Sort by:</span>
          <div className="flex gap-2">
            {[
              { value: 'movement', label: 'Movement Rate', icon: Activity },
              { value: 'age', label: 'Shelf Age', icon: Clock },
              { value: 'value', label: 'Stock Value', icon: BarChart3 }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                  sortBy === option.value
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <option.icon className="w-4 h-4" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Medicine</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Movement</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Sales Data</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Shelf Age</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Stock Info</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Expiry</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAnalytics.map((item) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      <p className="text-sm text-slate-500">{item.category}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.batchNumber}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold w-fit ${
                        item.movementClass === 'fast' ? 'bg-emerald-100 text-emerald-700' :
                        item.movementClass === 'medium' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.movementClass === 'fast' && <Zap className="w-3 h-3" />}
                        {item.movementClass === 'medium' && <Activity className="w-3 h-3" />}
                        {item.movementClass === 'slow' && <Archive className="w-3 h-3" />}
                        {item.movementClass.toUpperCase()}
                      </span>
                      <p className="text-xs text-slate-600">
                        {item.turnoverRate.toFixed(2)} units/day
                      </p>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Sold:</span>
                        <span className="font-bold text-slate-800">{item.totalSold} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Revenue:</span>
                        <span className="font-bold text-blue-600">₹{item.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Profit:</span>
                        <span className="font-bold text-emerald-600">₹{item.totalProfit.toLocaleString()}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Timer className={`w-5 h-5 ${
                        item.shelfAgeDays > 180 ? 'text-red-500' :
                        item.shelfAgeDays > 90 ? 'text-amber-500' :
                        'text-emerald-500'
                      }`} />
                      <div>
                        <p className="font-bold text-lg text-slate-800">{item.shelfAgeDays}</p>
                        <p className="text-xs text-slate-500">days on shelf</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Current:</span>
                        <span className="font-bold text-slate-800">{item.quantity} {item.unit}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Value:</span>
                        <span className="font-bold text-purple-600">₹{item.stockValue.toLocaleString()}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div>
                      <p className={`text-sm font-bold ${
                        item.daysToExpiry < 30 ? 'text-red-600' :
                        item.daysToExpiry < 90 ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {item.daysToExpiry} days
                      </p>
                      <p className="text-xs text-slate-500">{new Date(item.expiryDate).toLocaleDateString()}</p>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      item.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                      item.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {item.riskLevel.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Panel */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-8 h-8" />
            <h3 className="text-xl font-bold">Top Performers</h3>
          </div>
          <div className="space-y-3">
            {sortedAnalytics.slice(0, 3).map((item, i) => (
              <div key={item.id} className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-white/80">#{i + 1}</span>
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-white/80">{item.totalSold} units sold</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold">₹{item.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h3 className="text-xl font-bold">Action Required</h3>
          </div>
          <div className="space-y-3">
            {sortedAnalytics
              .filter(item => item.riskLevel === 'high' || item.movementClass === 'slow')
              .slice(0, 3)
              .map((item, i) => (
                <div key={item.id} className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-white/80">
                        {item.shelfAgeDays} days on shelf • {item.daysToExpiry} days to expiry
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-white/30 rounded text-xs font-bold">
                      {item.quantity} left
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAnalytics;
