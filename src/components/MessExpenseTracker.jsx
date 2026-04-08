import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Download, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

const MessExpenseTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [stats, setStats] = useState({
    todayTotal: 0,
    weekTotal: 0,
    monthTotal: 0,
    totalExpenses: 0
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    items: [{ name: '', quantity: '', unit: 'kg', price: 0 }],
    vendor: '',
    paid_by: '',
    payment_method: 'Cash',
    notes: ''
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [expenses]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const expensesRef = collection(db, 'mess_expenses');
      const q = query(expensesRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setExpenses(expensesData);
    } catch (error) {
      console.error('Error loading expenses:', error);
      alert('Failed to load expenses: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = {
      todayTotal: 0,
      weekTotal: 0,
      monthTotal: 0,
      totalExpenses: 0
    };

    expenses.forEach(expense => {
      const expenseDate = new Date(expense.date);
      const total = expense.total_amount || 0;

      stats.totalExpenses += total;

      if (expenseDate >= todayStart) {
        stats.todayTotal += total;
      }
      if (expenseDate >= weekStart) {
        stats.weekTotal += total;
      }
      if (expenseDate >= monthStart) {
        stats.monthTotal += total;
      }
    });

    setStats(stats);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', quantity: '', unit: 'kg', price: 0 }]
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      return sum + price;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.items.length === 0 || !formData.items[0].name) {
      alert('Please add at least one item');
      return;
    }

    try {
      const totalAmount = calculateTotal();

      const expenseData = {
        date: formData.date,
        items: formData.items,
        vendor: formData.vendor,
        paid_by: formData.paid_by || JSON.parse(localStorage.getItem('currentUser') || '{}').name,
        payment_method: formData.payment_method,
        notes: formData.notes,
        total_amount: totalAmount,
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      };

      await addDoc(collection(db, 'mess_expenses'), expenseData);
      
      alert('Expense added successfully!');
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        items: [{ name: '', quantity: '', unit: 'kg', price: 0 }],
        vendor: '',
        paid_by: '',
        payment_method: 'Cash',
        notes: ''
      });
      
      setShowAddForm(false);
      loadExpenses();

    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'mess_expenses', id));
      alert('Expense deleted successfully!');
      loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense: ' + error.message);
    }
  };

  const handleExport = () => {
    const exportData = expenses.map(expense => ({
      Date: expense.date,
      Vendor: expense.vendor,
      'Total Amount': expense.total_amount,
      'Paid By': expense.paid_by,
      'Payment Method': expense.payment_method,
      Items: expense.items.map(item => `${item.name} (${item.quantity} ${item.unit})`).join(', '),
      Notes: expense.notes
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mess Expenses');
    XLSX.writeFile(wb, `MessExpenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getFilteredExpenses = () => {
    if (dateFilter === 'all') return expenses;

    const now = new Date();
    let filterDate;

    if (dateFilter === 'today') {
      filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateFilter === 'week') {
      filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'month') {
      filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return expenses.filter(expense => new Date(expense.date) >= filterDate);
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">₹{value.toLocaleString()}</p>
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Mess Expense Tracker</h1>
              <p className="text-gray-600 text-sm">Track grocery purchases and daily expenses</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Expense
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Today's Expenses" value={stats.todayTotal} icon={Calendar} color="#f97316" />
        <StatCard title="This Week" value={stats.weekTotal} icon={TrendingUp} color="#3b82f6" />
        <StatCard title="This Month" value={stats.monthTotal} icon={DollarSign} color="#10b981" />
        <StatCard title="Total Expenses" value={stats.totalExpenses} icon={ShoppingCart} color="#8b5cf6" />
      </div>

      {/* Add Expense Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Expense</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="Shop name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-6 gap-3 mb-2">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    required
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="pack">pack</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price ₹"
                    value={item.price}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                    required
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={formData.items.length === 1}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                + Add Item
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paid By</label>
                <input
                  type="text"
                  value={formData.paid_by}
                  onChange={(e) => setFormData({ ...formData, paid_by: e.target.value })}
                  placeholder="Person name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-lg font-bold text-gray-800">
                Total: ₹{calculateTotal().toFixed(2)}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Save Expense
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm ${dateFilter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm ${dateFilter === 'today' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-lg text-sm ${dateFilter === 'week' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            This Week
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded-lg text-sm ${dateFilter === 'month' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading expenses...</p>
          </div>
        ) : getFilteredExpenses().length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No expenses recorded yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Add First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredExpenses().map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="max-w-xs">
                        {expense.items.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-xs">
                            {item.name} ({item.quantity} {item.unit})
                          </div>
                        ))}
                        {expense.items.length > 2 && (
                          <div className="text-xs text-gray-500">+{expense.items.length - 2} more</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{expense.vendor || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      ₹{expense.total_amount?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{expense.paid_by || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{expense.payment_method}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

export default MessExpenseTracker;
