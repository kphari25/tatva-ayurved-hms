import React, { useState, useEffect } from 'react';
import { ShoppingBag, TrendingUp, AlertCircle, Download, Calendar } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

const MedicineOrderingTable = () => {
  const [loading, setLoading] = useState(true);
  const [orderPredictions, setOrderPredictions] = useState([]);
  const [filterPriority, setFilterPriority] = useState('all'); // all, urgent, high, medium, low

  useEffect(() => {
    loadOrderPredictions();
  }, []);

  const loadOrderPredictions = async () => {
    try {
      setLoading(true);

      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);

      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const predictions = analyzeAndPredict(items);
      setOrderPredictions(predictions);

    } catch (error) {
      console.error('Error loading predictions:', error);
      alert('Failed to load predictions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeAndPredict = (items) => {
    const predictions = [];
    const today = new Date();

    items.forEach(item => {
      const stock = parseFloat(item.stock_quantity) || 0;
      const purchaseRate = parseFloat(item.purchase_rate) || 0;
      const mrp = parseFloat(item.mrp) || 0;

      // Calculate days since last update (simulating usage rate)
      const lastUpdated = item.last_updated 
        ? new Date(item.last_updated) 
        : new Date(item.imported_at || item.purchase_date || today);
      
      const daysSinceUpdate = Math.floor((today - lastUpdated) / (1000 * 60 * 60 * 24));

      // Estimate daily usage rate (mock calculation)
      // In real system, this would be calculated from actual sales/prescription data
      let dailyUsageRate = 0;
      if (daysSinceUpdate > 0) {
        // Assume some usage based on how recently it was updated
        if (daysSinceUpdate < 7) dailyUsageRate = 5; // Fast moving
        else if (daysSinceUpdate < 30) dailyUsageRate = 2; // Medium moving
        else if (daysSinceUpdate < 60) dailyUsageRate = 0.5; // Slow moving
        else dailyUsageRate = 0.1; // Very slow/stagnant
      }

      // Calculate days until stock out
      const daysUntilStockOut = dailyUsageRate > 0 ? stock / dailyUsageRate : 999;

      // Determine priority
      let priority = 'low';
      let action = 'Monitor';
      let recommendedQuantity = 0;

      if (stock === 0) {
        priority = 'urgent';
        action = 'Order Immediately';
        recommendedQuantity = Math.max(100, Math.ceil(dailyUsageRate * 30)); // 30 days supply
      } else if (daysUntilStockOut < 7) {
        priority = 'urgent';
        action = 'Order This Week';
        recommendedQuantity = Math.max(50, Math.ceil(dailyUsageRate * 30));
      } else if (daysUntilStockOut < 14) {
        priority = 'high';
        action = 'Order Within 2 Weeks';
        recommendedQuantity = Math.ceil(dailyUsageRate * 30);
      } else if (daysUntilStockOut < 30) {
        priority = 'medium';
        action = 'Order This Month';
        recommendedQuantity = Math.ceil(dailyUsageRate * 30);
      } else if (stock < 20 && dailyUsageRate > 0) {
        priority = 'low';
        action = 'Order Next Month';
        recommendedQuantity = Math.ceil(dailyUsageRate * 30);
      }

      // Only add items that need ordering
      if (priority !== 'low' || stock < 20) {
        predictions.push({
          item_code: item.item_code,
          item_name: item.item_name,
          current_stock: stock,
          daily_usage: dailyUsageRate.toFixed(2),
          days_until_stockout: Math.floor(daysUntilStockOut),
          priority,
          action,
          recommended_quantity: recommendedQuantity,
          estimated_cost: recommendedQuantity * purchaseRate,
          purchase_rate: purchaseRate,
          mrp: mrp,
          last_updated: lastUpdated.toISOString().split('T')[0]
        });
      }
    });

    // Sort by priority (urgent first)
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    predictions.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.days_until_stockout - b.days_until_stockout;
    });

    return predictions;
  };

  const getFilteredPredictions = () => {
    if (filterPriority === 'all') return orderPredictions;
    return orderPredictions.filter(p => p.priority === filterPriority);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityBadge = (priority) => {
    const color = getPriorityColor(priority);
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  const calculateTotalCost = () => {
    return getFilteredPredictions().reduce((sum, item) => sum + item.estimated_cost, 0);
  };

  const handleExport = () => {
    const exportData = getFilteredPredictions().map(item => ({
      'Item Code': item.item_code,
      'Item Name': item.item_name,
      'Current Stock': item.current_stock,
      'Daily Usage': item.daily_usage,
      'Days Until Stockout': item.days_until_stockout,
      'Priority': item.priority.toUpperCase(),
      'Action': item.action,
      'Recommended Quantity': item.recommended_quantity,
      'Purchase Rate': item.purchase_rate,
      'Estimated Cost': item.estimated_cost.toFixed(2),
      'Last Updated': item.last_updated
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order Predictions');
    XLSX.writeFile(wb, `Medicine_Ordering_Predictions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const stats = {
    urgent: orderPredictions.filter(p => p.priority === 'urgent').length,
    high: orderPredictions.filter(p => p.priority === 'high').length,
    medium: orderPredictions.filter(p => p.priority === 'medium').length,
    total: orderPredictions.length
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Medicine Ordering Predictions</h1>
              <p className="text-gray-600 text-sm">AI-powered inventory forecasting and recommendations</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadOrderPredictions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Urgent Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.urgent}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Priority</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.high}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-orange-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Medium Priority</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.medium}</p>
            </div>
            <Calendar className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <ShoppingBag className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter by Priority:</span>
          <button
            onClick={() => setFilterPriority('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterPriority === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({orderPredictions.length})
          </button>
          <button
            onClick={() => setFilterPriority('urgent')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterPriority === 'urgent'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Urgent ({stats.urgent})
          </button>
          <button
            onClick={() => setFilterPriority('high')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterPriority === 'high'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            High ({stats.high})
          </button>
          <button
            onClick={() => setFilterPriority('medium')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterPriority === 'medium'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Medium ({stats.medium})
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-md p-6 mb-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-purple-100 text-sm mb-1">Items to Order</p>
            <p className="text-3xl font-bold">{getFilteredPredictions().length}</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm mb-1">Total Estimated Cost</p>
            <p className="text-3xl font-bold">₹{calculateTotalCost().toLocaleString()}</p>
          </div>
          <div>
            <p className="text-purple-100 text-sm mb-1">Next 30 Days</p>
            <p className="text-3xl font-bold">
              {getFilteredPredictions().filter(p => p.days_until_stockout < 30).length} items
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Analyzing inventory...</p>
          </div>
        ) : getFilteredPredictions().length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No items need ordering in this category</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Daily Usage</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days Left</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Order Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredPredictions().map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_code}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{item.item_name}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`font-semibold ${item.current_stock === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.current_stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 text-center">{item.daily_usage}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`font-semibold ${
                        item.days_until_stockout < 7 ? 'text-red-600' :
                        item.days_until_stockout < 14 ? 'text-orange-600' :
                        item.days_until_stockout < 30 ? 'text-yellow-600' :
                        'text-gray-900'
                      }`}>
                        {item.days_until_stockout} days
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">{getPriorityBadge(item.priority)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.action}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                      {item.recommended_quantity}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                      ₹{item.estimated_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineOrderingTable;
