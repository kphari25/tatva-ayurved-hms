import React, { useState, useEffect } from 'react';
import { Package, Upload, Plus, Search, Edit, Trash2, Download, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load inventory from Firebase
  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      const items = snapshot.docs.map(doc => ({
        firebaseId: doc.id,
        ...doc.data()
      }));

      setInventory(items);
      setFilteredInventory(items);
      setMessage({ type: 'success', text: `Loaded ${items.length} items from Firebase` });
      
    } catch (error) {
      console.error('Error loading inventory:', error);
      setMessage({ type: 'error', text: 'Failed to load inventory: ' + error.message });
      setInventory([]);
      setFilteredInventory([]);
    } finally {
      setLoading(false);
    }
  };

  // Search/filter
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredInventory(inventory);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = inventory.filter(item =>
      (item.item_code || '').toLowerCase().includes(term) ||
      (item.item_name || '').toLowerCase().includes(term)
    );
    setFilteredInventory(filtered);
  }, [searchTerm, inventory]);

  // Handle Excel file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage({ type: 'info', text: 'Reading Excel file...' });

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          if (jsonData.length === 0) {
            setMessage({ type: 'error', text: 'Excel file is empty!' });
            setUploading(false);
            return;
          }

          setMessage({ type: 'info', text: `Found ${jsonData.length} items. Uploading to Firebase...` });
          setUploadProgress({ current: 0, total: jsonData.length });

          // Upload in batches of 500 (Firebase limit)
          const batchSize = 500;
          let uploadedCount = 0;

          for (let i = 0; i < jsonData.length; i += batchSize) {
            const batch = writeBatch(db);
            const batchItems = jsonData.slice(i, i + batchSize);

            batchItems.forEach((row) => {
              const docRef = doc(collection(db, 'inventory'));
              
              // Parse purchase date/month
              let purchaseDate = null;
              const dateField = row.purchase_date || row['Purchase Date'] || row.date || row.Date || 
                               row.month || row.Month || row.purchase_month || row['Purchase Month'];
              
              if (dateField) {
                // Handle Excel date serial numbers
                if (typeof dateField === 'number') {
                  // Excel date serial to JS Date
                  const excelEpoch = new Date(1899, 11, 30);
                  const jsDate = new Date(excelEpoch.getTime() + dateField * 86400000);
                  purchaseDate = jsDate.toISOString().split('T')[0]; // YYYY-MM-DD
                } else if (typeof dateField === 'string') {
                  // Try to parse string date
                  purchaseDate = dateField;
                } else if (dateField instanceof Date) {
                  purchaseDate = dateField.toISOString().split('T')[0];
                }
              }

              const item = {
                id: row.id || row.ID || Date.now() + Math.random(),
                item_code: row.item_code || row['Item Code'] || row.code || '',
                item_name: row.item_name || row['Item Name'] || row.name || 'Unknown',
                stock_quantity: parseInt(row.stock_quantity || row['Stock Quantity'] || row.quantity || 0),
                purchase_rate: parseFloat(row.purchase_rate || row['Purchase Rate'] || row.rate || 0),
                mrp: parseFloat(row.mrp || row.MRP || 0),
                stock_value: parseFloat(row.stock_value || row['Stock Value'] || 0),
                purchase_date: purchaseDate,
                month: purchaseDate, // Store in both fields for compatibility
                imported: true,
                imported_at: new Date().toISOString()
              };

              batch.set(docRef, item);
            });

            await batch.commit();
            uploadedCount += batchItems.length;
            setUploadProgress({ current: uploadedCount, total: jsonData.length });

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          setMessage({ 
            type: 'success', 
            text: `✅ Successfully uploaded ${uploadedCount} items to Firebase!` 
          });

          // Reload inventory
          await loadInventory();

        } catch (error) {
          console.error('Error processing Excel:', error);
          setMessage({ type: 'error', text: 'Failed to process Excel: ' + error.message });
        } finally {
          setUploading(false);
          event.target.value = ''; // Reset file input
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error('Error reading file:', error);
      setMessage({ type: 'error', text: 'Failed to read file: ' + error.message });
      setUploading(false);
    }
  };

  // Export to Excel
  const handleExport = () => {
    const exportData = inventory.map(item => ({
      'Item Code': item.item_code,
      'Item Name': item.item_name,
      'Stock Quantity': item.stock_quantity,
      'Purchase Rate': item.purchase_rate,
      'MRP': item.mrp,
      'Stock Value': item.stock_value,
      'Purchase Date': item.purchase_date || item.month || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    setMessage({ type: 'success', text: 'Inventory exported successfully!' });
  };

  // Delete all inventory
  const handleClearInventory = async () => {
    if (!window.confirm(`Are you sure you want to delete all ${inventory.length} items from Firebase? This cannot be undone!`)) {
      return;
    }

    if (!window.confirm('FINAL WARNING: This will permanently delete all inventory data. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Deleting all inventory...' });

      // Delete in batches
      const batchSize = 500;
      for (let i = 0; i < inventory.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchItems = inventory.slice(i, i + batchSize);

        batchItems.forEach(item => {
          if (item.firebaseId) {
            const docRef = doc(db, 'inventory', item.firebaseId);
            batch.delete(docRef);
          }
        });

        await batch.commit();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setMessage({ type: 'success', text: 'All inventory deleted!' });
      setInventory([]);
      setFilteredInventory([]);

    } catch (error) {
      console.error('Error clearing inventory:', error);
      setMessage({ type: 'error', text: 'Failed to clear inventory: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <Package className="w-8 h-8 text-teal-600" />
          Inventory Management
        </h1>
        <p className="text-gray-600 mt-1">Manage your medicine inventory with Firebase cloud storage</p>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> :
           message.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" /> :
           <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />}
          <div className={`text-sm ${
            message.type === 'success' ? 'text-green-800' :
            message.type === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && uploadProgress.total > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex justify-between text-sm text-yellow-800 mb-2">
            <span>Uploading to Firebase...</span>
            <span>{uploadProgress.current} / {uploadProgress.total}</span>
          </div>
          <div className="w-full bg-yellow-200 rounded-full h-2">
            <div 
              className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by item code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <label className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer flex items-center gap-2 font-medium">
              <Upload className="w-5 h-5" />
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
              disabled={inventory.length === 0}
            >
              <Download className="w-5 h-5" />
              Export
            </button>

            <button
              onClick={handleClearInventory}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 font-medium"
              disabled={inventory.length === 0}
            >
              <Trash2 className="w-5 h-5" />
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-6 text-sm">
          <div>
            <span className="text-gray-600">Total Items:</span>
            <span className="ml-2 font-semibold text-gray-900">{inventory.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Showing:</span>
            <span className="ml-2 font-semibold text-gray-900">{filteredInventory.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Storage:</span>
            <span className="ml-2 font-semibold text-teal-600">Firebase Cloud</span>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading inventory from Firebase...</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">
              {searchTerm ? 'No items match your search' : 'No inventory items yet'}
            </p>
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'Try a different search term' : 'Import an Excel file to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchase Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">MRP</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventory.map((item, index) => (
                  <tr key={item.firebaseId || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_code}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.item_name}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{item.stock_quantity}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">₹{item.purchase_rate?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">₹{item.mrp?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">₹{item.stock_value?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.purchase_date || item.month || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Firebase Cloud Storage Active</p>
            <p>Your inventory is stored in Firebase and syncs across all devices. Upload Excel files with columns: item_code, item_name, stock_quantity, purchase_rate, mrp, stock_value, purchase_date (or month)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
