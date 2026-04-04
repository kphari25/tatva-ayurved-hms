import React, { useState, useEffect } from 'react';
import { 
  Package, Plus, Edit, Trash2, Search, Upload, Download, 
  X, Save, FileSpreadsheet, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check if current user is admin
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    item_code: '',
    item_name: '',
    purchase_rate: '',
    stock_quantity: '',
    mrp: '',
    category: ''
  });

  useEffect(() => {
    loadInventory();
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = inventory.filter(item =>
        item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredInventory(filtered);
    } else {
      setFilteredInventory(inventory);
    }
  }, [searchTerm, inventory]);

  const checkAdminStatus = () => {
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        setIsAdmin(user.role === 'Admin' || user.permissions?.includes('all'));
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadInventory = () => {
    try {
      const saved = localStorage.getItem('inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        setInventory(parsed);
        setFilteredInventory(parsed);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  };

  const calculateStockValue = (quantity, purchaseRate) => {
    return (parseFloat(quantity || 0) * parseFloat(purchaseRate || 0)).toFixed(2);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      month: new Date().toISOString().slice(0, 7),
      item_code: '',
      item_name: '',
      purchase_rate: '',
      stock_quantity: '',
      mrp: '',
      category: ''
    });
    setShowAddModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      month: item.month || new Date().toISOString().slice(0, 7),
      item_code: item.item_code || item.code || '',
      item_name: item.item_name || item.name || '',
      purchase_rate: item.purchase_rate || item.price || '',
      stock_quantity: item.stock_quantity || item.quantity || '',
      mrp: item.mrp || '',
      category: item.category || ''
    });
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!formData.item_name || !formData.stock_quantity) {
      alert('Please fill Item Name and Stock Quantity');
      return;
    }

    const stockValue = calculateStockValue(formData.stock_quantity, formData.purchase_rate);
    const newItem = {
      id: editingItem ? editingItem.id : Date.now(),
      month: formData.month,
      item_code: formData.item_code,
      item_name: formData.item_name,
      purchase_rate: parseFloat(formData.purchase_rate) || 0,
      stock_quantity: parseInt(formData.stock_quantity),
      stock_value: parseFloat(stockValue),
      mrp: parseFloat(formData.mrp) || 0,
      category: formData.category,
      name: formData.item_name,
      quantity: parseInt(formData.stock_quantity),
      price: parseFloat(formData.purchase_rate) || 0
    };

    let updatedInventory;
    if (editingItem) {
      updatedInventory = inventory.map(item => item.id === editingItem.id ? newItem : item);
    } else {
      updatedInventory = [...inventory, newItem];
    }

    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    setInventory(updatedInventory);
    setShowAddModal(false);
    alert(editingItem ? '✅ Item updated!' : '✅ Item added!');
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this item?')) return;
    const updated = inventory.filter(item => item.id !== id);
    localStorage.setItem('inventory', JSON.stringify(updated));
    setInventory(updated);
    alert('✅ Item deleted!');
  };

  const handleClearAll = () => {
    if (!confirm('⚠️ WARNING: Delete ALL inventory items?\n\nThis will permanently delete all ' + inventory.length + ' items.\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
      return;
    }

    // Double confirmation for safety
    if (!confirm('⚠️ FINAL CONFIRMATION:\n\nYou are about to delete ALL inventory.\n\nClick OK to proceed or Cancel to abort.')) {
      return;
    }

    localStorage.removeItem('inventory');
    setInventory([]);
    setFilteredInventory([]);
    alert('✅ All inventory items have been deleted!');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const importedItems = jsonData.map((row, index) => {
          const quantity = parseFloat(row['Stock Quantity'] || row['stock_quantity'] || 0);
          const pRate = parseFloat(row['PRate'] || row['purchase_rate'] || 0);
          const stockValue = parseFloat(row['Stock Value'] || row['stock_value'] || (quantity * pRate));

          return {
            id: Date.now() + index,
            month: row['Month'] || row['month'] || new Date().toISOString().slice(0, 7),
            item_code: row['ItemCode'] || row['item_code'] || `ITM${Date.now() + index}`,
            item_name: row['ItemName'] || row['item_name'] || 'Unknown',
            purchase_rate: pRate,
            stock_quantity: quantity,
            stock_value: stockValue,
            mrp: parseFloat(row['MRP'] || row['mrp'] || 0),
            category: row['Category'] || row['category'] || 'General',
            name: row['ItemName'] || row['item_name'] || 'Unknown',
            quantity: quantity,
            price: pRate
          };
        });

        const existingCodes = new Set(inventory.map(item => item.item_code));
        const newItems = importedItems.filter(item => !existingCodes.has(item.item_code));
        const mergedInventory = [...inventory, ...newItems];

        localStorage.setItem('inventory', JSON.stringify(mergedInventory));
        setInventory(mergedInventory);
        setShowImportModal(false);
        
        alert(`✅ Imported ${newItems.length} items!\n${importedItems.length - newItems.length} duplicates skipped.`);
      } catch (error) {
        alert('❌ Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleExport = () => {
    if (inventory.length === 0) {
      alert('No inventory to export');
      return;
    }

    const exportData = inventory.map(item => ({
      'Month': item.month,
      'ItemCode': item.item_code,
      'ItemName': item.item_name,
      'PRate': item.purchase_rate,
      'Stock Quantity': item.stock_quantity,
      'Stock Value': item.stock_value,
      'MRP': item.mrp,
      'Category': item.category
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    alert('✅ Exported successfully!');
  };

  const downloadTemplate = () => {
    const templateData = [{
      'Month': '2026-03',
      'ItemCode': 'MED001',
      'ItemName': 'Paracetamol 650mg',
      'PRate': 2.50,
      'Stock Quantity': 100,
      'Stock Value': 250.00,
      'MRP': 5.00,
      'Category': 'Pain Relief'
    }];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Inventory_Template.xlsx');
    alert('✅ Template downloaded!');
  };

  const totalItems = inventory.length;
  const totalQuantity = inventory.reduce((sum, item) => sum + (item.stock_quantity || 0), 0);
  const totalValue = inventory.reduce((sum, item) => sum + (item.stock_value || 0), 0);
  const lowStockItems = inventory.filter(item => (item.stock_quantity || 0) < 10).length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
            <p className="text-gray-600">Manage medicines and supplies</p>
          </div>
          <div className="flex space-x-3">
            <button onClick={() => setShowImportModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Upload className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
            <button onClick={handleExport} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            {/* Admin Only: Clear All Button */}
            {isAdmin && (
              <button 
                onClick={handleClearAll} 
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                title="Admin Only: Delete all inventory items"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            )}
            <button onClick={handleAdd} className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Total Quantity</p>
            <p className="text-2xl font-bold text-gray-800">{totalQuantity}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold text-gray-800">₹{totalValue.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Low Stock</p>
            <p className="text-2xl font-bold text-red-600">{lowStockItems}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">CODE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">ITEM NAME</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">CATEGORY</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">P.RATE</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">STOCK</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">VALUE</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">MRP</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No items found</p>
                </td>
              </tr>
            ) : (
              filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{item.item_code}</td>
                  <td className="px-4 py-3 font-medium">{item.item_name}</td>
                  <td className="px-4 py-3 text-sm">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-right">₹{(item.purchase_rate || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={item.stock_quantity < 10 ? 'text-red-600 font-semibold' : 'font-semibold'}>
                      {item.stock_quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">₹{(item.stock_value || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right">₹{(item.mrp || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleEdit(item)} className="p-1 text-teal-600 hover:bg-teal-50 rounded mr-2">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between">
              <h2 className="text-xl font-bold">{editingItem ? 'Edit' : 'Add'} Item</h2>
              <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Month</label>
                  <input type="month" name="month" value={formData.month} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Item Code</label>
                  <input type="text" name="item_code" value={formData.item_code} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Item Name *</label>
                  <input type="text" name="item_name" value={formData.item_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase Rate</label>
                  <input type="number" step="0.01" name="purchase_rate" value={formData.purchase_rate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stock Quantity *</label>
                  <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stock Value</label>
                  <input type="text" value={calculateStockValue(formData.stock_quantity, formData.purchase_rate)} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">MRP</label>
                  <input type="number" step="0.01" name="mrp" value={formData.mrp} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select</option>
                    <option>Antibiotic</option>
                    <option>Pain Relief</option>
                    <option>Ayurvedic</option>
                    <option>General</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-teal-600 text-white rounded-lg">
                <Save className="w-4 h-4 inline mr-2" />{editingItem ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b px-6 py-4 flex justify-between">
              <h2 className="text-xl font-bold">Import Excel</h2>
              <button onClick={() => setShowImportModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <AlertCircle className="w-5 h-5 text-blue-600 inline mr-2" />
                <span className="text-sm text-blue-800">Required: Month, ItemCode, ItemName, PRate, Stock Quantity, Stock Value, MRP</span>
              </div>
              <button onClick={downloadTemplate} className="w-full mb-4 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <FileSpreadsheet className="w-5 h-5 inline mr-2" />Download Template
              </button>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="px-6 py-2 bg-teal-600 text-white rounded-lg cursor-pointer">
                  {loading ? 'Importing...' : 'Select File'}
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
