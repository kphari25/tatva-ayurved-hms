import React, { useState, useEffect } from 'react';
import {
  Package, Plus, Upload, Download, Search, Filter, Edit, Trash2,
  Calendar, DollarSign, TrendingUp, AlertCircle, Check, X, FileSpreadsheet,
  BarChart3, ShoppingCart, Archive, Clock, Hash, FileText, Save, RefreshCw
} from 'lucide-react';

const InventoryManagement = ({ inventory, setInventory, userRole, supabase }) => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [newMedicine, setNewMedicine] = useState({
    name: '',
    category: 'Tablet',
    batchNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    quantity: 0,
    unit: 'strips',
    purchasePrice: 0,
    marginPercent: 40,
    supplier: '',
    invoiceNumber: '',
    reorderLevel: 10
  });

  // Load medicines from database
  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    if (!supabase) {
      setMedicines(inventory || []);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedicines(data || []);
      if (setInventory) setInventory(data || []);
    } catch (error) {
      console.error('Error loading medicines:', error);
      showMessage('error', 'Failed to load inventory: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const calculateSalePrice = (purchasePrice, marginPercent) => {
    return Math.round(purchasePrice * (1 + marginPercent / 100));
  };

  // Add new medicine to database
  const handleAddMedicine = async () => {
    if (!newMedicine.name || !newMedicine.category) {
      showMessage('error', 'Please enter medicine name and category');
      return;
    }

    setSaving(true);
    try {
      const salePrice = calculateSalePrice(newMedicine.purchasePrice, newMedicine.marginPercent);
      const status = newMedicine.quantity > newMedicine.reorderLevel ? 'in-stock' : 
                     newMedicine.quantity === 0 ? 'out-of-stock' : 'low-stock';

      const medicineData = {
        name: newMedicine.name,
        category: newMedicine.category,
        batch_number: newMedicine.batchNumber || null,
        purchase_date: newMedicine.purchaseDate || null,
        expiry_date: newMedicine.expiryDate || null,
        quantity: parseFloat(newMedicine.quantity) || 0,
        unit: newMedicine.unit,
        purchase_price: parseFloat(newMedicine.purchasePrice) || 0,
        margin_percent: parseFloat(newMedicine.marginPercent) || 40,
        sale_price: salePrice,
        supplier: newMedicine.supplier || null,
        invoice_number: newMedicine.invoiceNumber || null,
        reorder_level: parseFloat(newMedicine.reorderLevel) || 10,
        status: status
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('inventory')
          .insert([medicineData])
          .select();

        if (error) throw error;
        showMessage('success', '✅ Medicine added successfully!');
      } else {
        // Fallback for non-Supabase mode
        const medicine = {
          ...medicineData,
          id: Date.now().toString(),
          created_at: new Date().toISOString()
        };
        setMedicines([medicine, ...medicines]);
      }

      // Reset form
      setNewMedicine({
        name: '',
        category: 'Tablet',
        batchNumber: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        quantity: 0,
        unit: 'strips',
        purchasePrice: 0,
        marginPercent: 40,
        supplier: '',
        invoiceNumber: '',
        reorderLevel: 10
      });
      setShowAddModal(false);

      // Reload medicines
      await loadMedicines();

    } catch (error) {
      console.error('Error adding medicine:', error);
      showMessage('error', 'Failed to add medicine: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Update medicine
  const handleUpdateMedicine = async () => {
    if (!editingMedicine) return;

    setSaving(true);
    try {
      const salePrice = calculateSalePrice(editingMedicine.purchase_price, editingMedicine.margin_percent);
      const status = editingMedicine.quantity > editingMedicine.reorder_level ? 'in-stock' : 
                     editingMedicine.quantity === 0 ? 'out-of-stock' : 'low-stock';

      if (supabase) {
        const { error } = await supabase
          .from('inventory')
          .update({
            name: editingMedicine.name,
            category: editingMedicine.category,
            quantity: parseFloat(editingMedicine.quantity),
            unit: editingMedicine.unit,
            purchase_price: parseFloat(editingMedicine.purchase_price),
            margin_percent: parseFloat(editingMedicine.margin_percent),
            sale_price: salePrice,
            reorder_level: parseFloat(editingMedicine.reorder_level),
            status: status
          })
          .eq('id', editingMedicine.id);

        if (error) throw error;
        showMessage('success', '✅ Medicine updated!');
      }

      setEditingMedicine(null);
      await loadMedicines();

    } catch (error) {
      console.error('Error updating medicine:', error);
      showMessage('error', 'Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete medicine
  const handleDeleteMedicine = async (id) => {
    if (!confirm('Are you sure you want to delete this medicine?')) return;

    try {
      if (supabase) {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showMessage('success', '✅ Medicine deleted!');
      }

      await loadMedicines();
    } catch (error) {
      console.error('Error deleting medicine:', error);
      showMessage('error', 'Failed to delete: ' + error.message);
    }
  };

  const filteredMedicines = medicines.filter(med => {
    const matchesSearch = med.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         med.batch_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         med.supplier?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || med.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    totalItems: medicines.length,
    totalValue: medicines.reduce((sum, m) => sum + ((m.quantity || 0) * (m.sale_price || 0)), 0),
    lowStock: medicines.filter(m => m.status === 'low-stock' || m.status === 'out-of-stock').length,
    expiringSoon: medicines.filter(m => {
      if (!m.expiry_date) return false;
      const daysToExpiry = Math.floor((new Date(m.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
      return daysToExpiry < 90 && daysToExpiry > 0;
    }).length
  };

  const categories = ['all', 'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Churna', 'Tailam', 'Other'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Inventory Management
            </h1>
            <p className="text-slate-600">Manage medicine stock, batches, and pricing</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadMedicines}
              className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold">
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-lg">
              <Plus className="w-5 h-5" />
              Add Medicine
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
          'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'blue' },
          { label: 'Total Value', value: `₹${stats.totalValue.toLocaleString()}`, icon: DollarSign, color: 'emerald' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertCircle, color: 'amber' },
          { label: 'Expiring Soon', value: stats.expiringSoon, icon: Clock, color: 'red' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className={`w-12 h-12 bg-${stat.color}-100 rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
            </div>
            <p className="text-slate-600 text-sm mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search medicines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-6 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none font-semibold"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
          ))}
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading inventory...</p>
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">No medicines found</p>
            <button onClick={() => setShowAddModal(true)}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">
              Add First Medicine
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Medicine</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Category</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Stock</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Price</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.map((med) => (
                <tr key={med.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{med.name}</p>
                    <p className="text-xs text-slate-500">{med.batch_number || 'No batch'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                      {med.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{med.quantity} {med.unit}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">₹{med.sale_price}</p>
                    <p className="text-xs text-slate-500">Cost: ₹{med.purchase_price}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      med.status === 'in-stock' ? 'bg-emerald-100 text-emerald-700' :
                      med.status === 'low-stock' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {med.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => setEditingMedicine({...med})}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteMedicine(med.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Add New Medicine</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="block text-sm font-bold mb-2">Medicine Name *</label>
                <input type="text" value={newMedicine.name}
                  onChange={(e) => setNewMedicine({...newMedicine, name: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="e.g., Paracetamol 500mg" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Category *</label>
                <select value={newMedicine.category}
                  onChange={(e) => setNewMedicine({...newMedicine, category: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none">
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Batch Number</label>
                <input type="text" value={newMedicine.batchNumber}
                  onChange={(e) => setNewMedicine({...newMedicine, batchNumber: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Quantity *</label>
                <input type="number" value={newMedicine.quantity}
                  onChange={(e) => setNewMedicine({...newMedicine, quantity: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Unit *</label>
                <select value={newMedicine.unit}
                  onChange={(e) => setNewMedicine({...newMedicine, unit: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none">
                  <option value="strips">Strips</option>
                  <option value="bottles">Bottles</option>
                  <option value="tablets">Tablets</option>
                  <option value="ml">ML</option>
                  <option value="grams">Grams</option>
                  <option value="pieces">Pieces</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Purchase Price (₹) *</label>
                <input type="number" value={newMedicine.purchasePrice}
                  onChange={(e) => setNewMedicine({...newMedicine, purchasePrice: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Margin (%) *</label>
                <input type="number" value={newMedicine.marginPercent}
                  onChange={(e) => setNewMedicine({...newMedicine, marginPercent: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-600">
                  Sale Price: <strong className="text-blue-600">
                    ₹{calculateSalePrice(newMedicine.purchasePrice, newMedicine.marginPercent)}
                  </strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Reorder Level</label>
                <input type="number" value={newMedicine.reorderLevel}
                  onChange={(e) => setNewMedicine({...newMedicine, reorderLevel: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Supplier</label>
                <input type="text" value={newMedicine.supplier}
                  onChange={(e) => setNewMedicine({...newMedicine, supplier: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 px-6 py-3 border-2 rounded-xl font-semibold">
                Cancel
              </button>
              <button onClick={handleAddMedicine} disabled={saving}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Add Medicine</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Medicine Modal */}
      {editingMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Medicine</h2>
              <button onClick={() => setEditingMedicine(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold mb-2">Quantity</label>
                <input type="number" value={editingMedicine.quantity}
                  onChange={(e) => setEditingMedicine({...editingMedicine, quantity: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Purchase Price (₹)</label>
                <input type="number" value={editingMedicine.purchase_price}
                  onChange={(e) => setEditingMedicine({...editingMedicine, purchase_price: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Reorder Level</label>
                <input type="number" value={editingMedicine.reorder_level}
                  onChange={(e) => setEditingMedicine({...editingMedicine, reorder_level: e.target.value})}
                  className="w-full px-4 py-3 border-2 rounded-xl" />
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setEditingMedicine(null)}
                className="flex-1 px-6 py-3 border-2 rounded-xl font-semibold">
                Cancel
              </button>
              <button onClick={handleUpdateMedicine} disabled={saving}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
