import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Package, AlertTriangle, IndianRupee, ShoppingCart, Activity } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import InventoryCategoryModal from './InventoryCategoryModal';

const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

// Last 6 calendar months, oldest first, for the Sales vs Purchase trend.
const lastSixMonths = () => {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return months;
};

const inRange = (dateVal, start, end) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  return !isNaN(d) && d >= start && d <= end;
};

const getLastMovementDate = (item) => item.last_updated || item.imported_at || item.purchase_date || item.created_at;

const daysSinceMovement = (item) => {
  const dateStr = getLastMovementDate(item);
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
};

const isOutOfStockItem = (item) => (parseFloat(item.stock_quantity) || 0) === 0;

const isLowStockItem = (item) => {
  const stock = parseFloat(item.stock_quantity) || 0;
  return stock > 0 && stock < 10;
};

// No update in 2 months
const isStagnantItem = (item) => {
  const days = daysSinceMovement(item);
  return days !== null && days > 60;
};

const isFastMovingItem = (item) => {
  const days = daysSinceMovement(item);
  return days !== null && days < 7;
};

const InventoryAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalValue: 0,
    totalPurchasePrice: 0,
    totalSalesPrice: 0,
    totalItems: 0,
    lowStockItems: 0,
    outOfStock: 0,
    stagnantItems: 0,
    highMovingItems: 0,
    lowMovingItems: 0
  });

  const [chartData, setChartData] = useState({
    topItems: [],
    stockDistribution: [],
    categoryDistribution: [],
    monthlyTrend: [],
    movementAnalysis: []
  });

  const [drillDown, setDrillDown] = useState(null); // { title, items }

  const openDrillDown = (title, predicate) => {
    setDrillDown({ title, items: inventory.filter(predicate) });
  };

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);

      const [inventorySnap, salesSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'medicine_sales')),
        getDocs(collection(db, 'expenses')),
      ]);

      // Spread first, id last: some inventory docs carry their own legacy
      // numeric `id` field, which would otherwise clobber the real doc id.
      const items = inventorySnap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      const sales = salesSnap.docs.map(d => d.data());
      const expenses = expensesSnap.docs.map(d => d.data());

      setInventory(items);
      calculateAnalytics(items);
      generateChartData(items, sales, expenses);

    } catch (error) {
      console.error('Error loading inventory:', error);
      alert('Failed to load inventory: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (items) => {
    let totalValue = 0;
    let totalPurchasePrice = 0;
    let totalSalesPrice = 0;
    let lowStockItems = 0;
    let outOfStock = 0;
    let stagnantItems = 0;
    let highMovingItems = 0;
    let lowMovingItems = 0;

    items.forEach(item => {
      const stock = parseFloat(item.stock_quantity) || 0;
      const purchaseRate = parseFloat(item.purchase_rate) || 0;
      const mrp = parseFloat(item.MRP ?? item.mrp) || 0;
      const stockValue = parseFloat(item.stock_value) || (stock * purchaseRate);

      totalValue += stockValue;
      totalPurchasePrice += (stock * purchaseRate);
      totalSalesPrice += (stock * mrp);

      if (isLowStockItem(item)) lowStockItems++;
      if (isOutOfStockItem(item)) outOfStock++;
      if (isStagnantItem(item)) stagnantItems++;
      if (isFastMovingItem(item)) highMovingItems++;
      else if (!isStagnantItem(item)) lowMovingItems++;
    });

    setAnalytics({
      totalValue,
      totalPurchasePrice,
      totalSalesPrice,
      totalItems: items.length,
      lowStockItems,
      outOfStock,
      stagnantItems,
      highMovingItems,
      lowMovingItems
    });
  };

  const generateChartData = (items, sales = [], expenses = []) => {
    // Top 10 items by value
    const topItems = items
      .map(item => ({
        name: item.item_name?.substring(0, 20) || item.item_code,
        value: parseFloat(item.stock_value) || 0,
        stock: parseFloat(item.stock_quantity) || 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Stock distribution
    const stockRanges = {
      'Out of Stock': 0,
      '1-10': 0,
      '11-50': 0,
      '51-100': 0,
      '100+': 0
    };

    items.forEach(item => {
      const stock = parseFloat(item.stock_quantity) || 0;
      if (stock === 0) stockRanges['Out of Stock']++;
      else if (stock <= 10) stockRanges['1-10']++;
      else if (stock <= 50) stockRanges['11-50']++;
      else if (stock <= 100) stockRanges['51-100']++;
      else stockRanges['100+']++;
    });

    const stockDistribution = Object.entries(stockRanges).map(([name, value]) => ({
      name,
      value
    }));

    // Movement analysis
    const movementCategories = {
      'High Moving': 0,
      'Medium Moving': 0,
      'Low Moving': 0,
      'Stagnant': 0
    };

    items.forEach(item => {
      const daysSinceUpdate = daysSinceMovement(item);

      if (isStagnantItem(item)) movementCategories['Stagnant']++;
      else if (isFastMovingItem(item)) movementCategories['High Moving']++;
      else if (daysSinceUpdate !== null && daysSinceUpdate < 30) movementCategories['Medium Moving']++;
      else movementCategories['Low Moving']++;
    });

    const movementAnalysis = Object.entries(movementCategories).map(([name, value]) => ({
      name,
      value
    }));

    // Monthly trend — real medicine sales vs. medicine-purchase expenses for
    // the last 6 calendar months (same source/field semantics as Reports.jsx's
    // Inventory Report, the vetted place this data is aggregated elsewhere).
    const monthlyTrend = lastSixMonths().map(({ year, month, label }) => {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const salesAmount = sales
        .filter(s => inRange(s.sale_date || s.created_at, monthStart, monthEnd))
        .reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
      const purchaseAmount = expenses
        .filter(e => (e.category || '').toLowerCase() === 'medicine_purchase' && inRange(e.date || e.created_at, monthStart, monthEnd))
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      return { month: label, sales: salesAmount, purchases: purchaseAmount };
    });

    setChartData({
      topItems,
      stockDistribution,
      movementAnalysis,
      monthlyTrend
    });
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {trend && (
        <div className="flex items-center mt-2 text-xs">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
          )}
          <span className={trend > 0 ? 'text-green-600' : 'text-red-600'}>
            {Math.abs(trend)}% from last month
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Inventory Analytics</h1>
              <p className="text-gray-600 text-sm">Real-time insights and performance metrics</p>
            </div>
          </div>
          <button
            onClick={loadInventoryData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              title="Total Inventory Value"
              value={`₹${analytics.totalValue.toLocaleString()}`}
              icon={IndianRupee}
              color="#10b981"
            />
            <StatCard
              title="Total Purchase Price"
              value={`₹${analytics.totalPurchasePrice.toLocaleString()}`}
              icon={ShoppingCart}
              color="#3b82f6"
            />
            <StatCard
              title="Potential Sales Value"
              value={`₹${analytics.totalSalesPrice.toLocaleString()}`}
              icon={TrendingUp}
              color="#8b5cf6"
            />
            <StatCard
              title="Total Items"
              value={analytics.totalItems.toLocaleString()}
              icon={Package}
              color="#f59e0b"
            />
          </div>

          {/* Alert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div
              onClick={() => openDrillDown('Out of Stock', isOutOfStockItem)}
              className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-sm text-red-600 font-medium">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-700">{analytics.outOfStock}</p>
                </div>
              </div>
            </div>
            <div
              onClick={() => openDrillDown('Low Stock', isLowStockItem)}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-700">{analytics.lowStockItems}</p>
                </div>
              </div>
            </div>
            <div
              onClick={() => openDrillDown('Stagnant (>2 months)', isStagnantItem)}
              className="bg-orange-50 border border-orange-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-600 font-medium">Stagnant (&gt;2 months)</p>
                  <p className="text-2xl font-bold text-orange-700">{analytics.stagnantItems}</p>
                </div>
              </div>
            </div>
            <div
              onClick={() => openDrillDown('Fast Moving', isFastMovingItem)}
              className="bg-green-50 border border-green-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">Fast Moving</p>
                  <p className="text-2xl font-bold text-green-700">{analytics.highMovingItems}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top 10 Items by Value */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Top 10 Items by Stock Value</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.topItems}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" name="Stock Value (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stock Distribution */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Stock Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.stockDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.stockDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Movement Analysis */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Inventory Movement Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.movementAnalysis} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#10b981" name="Number of Items" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Trend */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Sales vs Purchase Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} name="Sales (₹)" />
                  <Line type="monotone" dataKey="purchases" stroke="#3b82f6" strokeWidth={2} name="Purchases (₹)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Profit Margin Potential</h4>
                <p className="text-3xl font-bold text-blue-700">
                  ₹{(analytics.totalSalesPrice - analytics.totalPurchasePrice).toLocaleString()}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  {((analytics.totalSalesPrice - analytics.totalPurchasePrice) / analytics.totalPurchasePrice * 100).toFixed(1)}% margin
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Healthy Stock</h4>
                <p className="text-3xl font-bold text-green-700">
                  {analytics.totalItems - analytics.outOfStock - analytics.lowStockItems}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {((analytics.totalItems - analytics.outOfStock - analytics.lowStockItems) / analytics.totalItems * 100).toFixed(1)}% well-stocked
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-2">Needs Attention</h4>
                <p className="text-3xl font-bold text-orange-700">
                  {analytics.stagnantItems + analytics.lowStockItems}
                </p>
                <p className="text-sm text-orange-600 mt-1">Items requiring action</p>
              </div>
            </div>
          </div>
        </>
      )}

      {drillDown && (
        <InventoryCategoryModal
          title={drillDown.title}
          items={drillDown.items}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
};

export default InventoryAnalytics;
