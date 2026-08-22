import React, { useState, useEffect, useRef } from 'react';
import { Package, Upload, Plus, Search, Edit, Trash2, Download, AlertCircle, CheckCircle, EyeOff, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch,
  query, orderBy, limit, startAfter, startAt, endAt, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import AddMedicine from './AddMedicine';

const PAGE_SIZE = 100;
const SEARCH_LIMIT = 50;

const getPurchaseDate = (item) => item.last_purchase_date || item.purchase_date || item.created_at || null;

const getDaysInInventory = (item) => {
  const dateStr = getPurchaseDate(item);
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)));
};

const toItem = (d) => ({ ...d.data(), firebaseId: d.id });

const InventoryManagement = () => {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(null); // cheap aggregate count, independent of what's loaded
  const [lastDoc, setLastDoc] = useState(null); // pagination cursor (browse mode only)
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); // first page / reset
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null); // For showing detailed view

  const searchDebounce = useRef(null);
  const isSearchMode = searchTerm.trim().length > 0;

  useEffect(() => {
    loadCount();
    loadFirstPage();
  }, []);

  // Debounced search — re-queries on pause so we're not hitting Firestore on every keystroke.
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      if (searchTerm.trim()) {
        runSearch(searchTerm.trim());
      } else {
        loadFirstPage();
      }
    }, 350);
    return () => clearTimeout(searchDebounce.current);
  }, [searchTerm]);

  const loadCount = async () => {
    try {
      const snap = await getCountFromServer(collection(db, 'inventory'));
      setTotalCount(snap.data().count);
    } catch (error) {
      console.error('Error counting inventory:', error);
    }
  };

  // Loads (or reloads) the first page of the alphabetical browse list — the
  // default view. Only PAGE_SIZE documents are read here instead of the
  // whole collection, which is what made the page slow to open.
  const loadFirstPage = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'inventory'), orderBy('item_name'), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      setItems(docs.map(toItem));
      setLastDoc(docs[docs.length - 1] || null);
      setHasMore(docs.length === PAGE_SIZE);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Error loading inventory:', error);
      setMessage({ type: 'error', text: 'Failed to load inventory: ' + error.message });
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!lastDoc || !hasMore || loadingMore) return;
    try {
      setLoadingMore(true);
      const q = query(collection(db, 'inventory'), orderBy('item_name'), startAfter(lastDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      setItems(prev => [...prev, ...docs.map(toItem)]);
      setLastDoc(docs[docs.length - 1] || lastDoc);
      setHasMore(docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more inventory:', error);
      setMessage({ type: 'error', text: 'Failed to load more items: ' + error.message });
    } finally {
      setLoadingMore(false);
    }
  };

  // Search is a "starts with" match against item name/code — Firestore has
  // no full-text search, so this is a range query, not the old substring
  // filter. Item data is ~99% stored upper-case, so we also try an
  // upper-cased pass to catch that convention without requiring every
  // record to carry a separate lower-cased search field.
  const runSearch = async (term) => {
    try {
      setSearching(true);
      const upper = term.toUpperCase();
      const invRef = collection(db, 'inventory');
      const prefixQuery = (field, value) =>
        getDocs(query(invRef, orderBy(field), startAt(value), endAt(value + ''), limit(SEARCH_LIMIT)));

      const queries = [prefixQuery('item_name', term), prefixQuery('item_code', upper)];
      if (upper !== term) queries.push(prefixQuery('item_name', upper));

      const snaps = await Promise.all(queries);
      const seen = new Map();
      snaps.forEach(snap => snap.docs.forEach(d => seen.set(d.id, toItem(d))));
      const merged = [...seen.values()].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));

      setItems(merged);
      setHasMore(false);
      setLastDoc(null);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Error searching inventory:', error);
      setMessage({ type: 'error', text: 'Search failed: ' + error.message });
    } finally {
      setSearching(false);
    }
  };

  const visibleItems = hideOutOfStock ? items.filter(i => (i.stock_quantity || 0) > 0) : items;

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
                // String(...) guards against Excel cells typed as numbers (e.g. a
                // purely numeric item code) coming through as a JS number — that
                // broke every .toLowerCase() search/autocomplete over item_code
                // elsewhere in the app.
                item_code: String(row.item_code || row['Item Code'] || row.code || ''),
                item_name: row.item_name || row['Item Name'] || row.name || 'Unknown',
                stock_quantity: parseInt(row.stock_quantity || row['Stock Quantity'] || row.quantity || 0),
                purchase_rate: parseFloat(row.purchase_rate || row['Purchase Rate'] || row.rate || 0),
                mrp: parseFloat(row.mrp || row.MRP || 0),
                stock_value: parseFloat(row.stock_value || row['Stock Value'] || 0),
                purchase_date: purchaseDate,
                month: purchaseDate, // Store in both fields for compatibility
                last_purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
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

          // Reload count + first page
          await loadCount();
          await loadFirstPage();

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

  // Export to Excel — a deliberate, occasional action, so a full-collection
  // read here (unlike on every page load) is a reasonable cost for completeness.
  const handleExport = async () => {
    setMessage({ type: 'info', text: 'Fetching full inventory for export...' });
    try {
      const snapshot = await getDocs(collection(db, 'inventory'));
      const all = snapshot.docs.map(toItem);
      const exportData = all.map(item => ({
        'Item Code': item.item_code,
        'Item Name': item.item_name,
        'Stock Quantity': item.stock_quantity,
        'Purchase Rate': item.purchase_price || item.purchase_rate,
        'MRP': item.MRP || item.mrp,
        'Stock Value': item.stock_value,
        'Purchase Date': item.purchase_date || item.month || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, `Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);

      setMessage({ type: 'success', text: `Exported ${all.length} items successfully!` });
    } catch (error) {
      console.error('Error exporting inventory:', error);
      setMessage({ type: 'error', text: 'Failed to export inventory: ' + error.message });
    }
  };

  // Delete all inventory
  const handleClearInventory = async () => {
    const count = totalCount ?? items.length;
    if (!window.confirm(`Are you sure you want to delete all ${count} items from Firebase? This cannot be undone!`)) {
      return;
    }

    if (!window.confirm('FINAL WARNING: This will permanently delete all inventory data. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Fetching and deleting all inventory...' });

      const snapshot = await getDocs(collection(db, 'inventory'));
      const allDocs = snapshot.docs;

      // Delete in batches
      const batchSize = 500;
      for (let i = 0; i < allDocs.length; i += batchSize) {
        const batch = writeBatch(db);
        allDocs.slice(i, i + batchSize).forEach(d => batch.delete(doc(db, 'inventory', d.id)));
        await batch.commit();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setMessage({ type: 'success', text: 'All inventory deleted!' });
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
      setLastDoc(null);

    } catch (error) {
      console.error('Error clearing inventory:', error);
      setMessage({ type: 'error', text: 'Failed to clear inventory: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}" from inventory? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'inventory', item.firebaseId));
      setItems(prev => prev.filter(i => i.firebaseId !== item.firebaseId));
      setTotalCount(prev => (prev != null ? Math.max(0, prev - 1) : prev));
      setExpandedRow(null);
      setMessage({ type: 'success', text: `${item.item_name} deleted.` });
    } catch (error) {
      console.error('Error deleting item:', error);
      setMessage({ type: 'error', text: 'Failed to delete item: ' + error.message });
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
          <div className="flex-1 min-w-[300px] flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by item code or name (starts with)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={(e) => setHideOutOfStock(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <EyeOff className="w-4 h-4 text-gray-400" />
              Hide out of stock
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddMedicine(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Medicine
            </button>

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
              disabled={!totalCount}
            >
              <Download className="w-5 h-5" />
              Export
            </button>

            <button
              onClick={handleClearInventory}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 font-medium"
              disabled={!totalCount}
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
            <span className="ml-2 font-semibold text-gray-900">{totalCount ?? '…'}</span>
          </div>
          <div>
            <span className="text-gray-600">{isSearchMode ? 'Matches' : 'Loaded'}:</span>
            <span className="ml-2 font-semibold text-gray-900">{visibleItems.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Storage:</span>
            <span className="ml-2 font-semibold text-teal-600">Firebase Cloud</span>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading || searching ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">{searching ? 'Searching...' : 'Loading inventory from Firebase...'}</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">
              {isSearchMode ? 'No items match your search' : hideOutOfStock ? 'No in-stock items on this page' : 'No inventory items yet'}
            </p>
            <p className="text-gray-500 text-sm">
              {isSearchMode ? 'Search matches the start of the item name or code' : 'Import an Excel file to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expand</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchase Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">MRP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GST</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch/Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date of Purchase</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days in Inventory</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleItems.map((item, index) => (
                  <React.Fragment key={item.firebaseId || index}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === item.firebaseId ? null : item.firebaseId)}>
                      <td className="px-6 py-4 text-sm">
                        <button className="text-blue-600 hover:text-blue-800">
                          {expandedRow === item.firebaseId ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_code || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.category || '-'}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <span className={`font-semibold ${
                          (item.stock_quantity || 0) === 0 ? 'text-red-600' :
                          (item.stock_quantity || 0) < (item.reorder_level || 10) ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {item.stock_quantity || 0} {item.unit_of_measurement || 'Nos'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">₹{(item.purchase_price || item.purchase_rate || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">₹{(item.MRP || item.mrp || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.gst_percentage || 12}%
                        {item.cgst_percentage && item.sgst_percentage && (
                          <span className="text-xs block text-gray-500">
                            C:{item.cgst_percentage}% S:{item.sgst_percentage}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.batch_number || (item.batches && item.batches[0]?.batch_number) || '-'}
                        {(item.expiry_date || (item.batches && item.batches[0]?.expiry_date)) && (
                          <span className="text-xs block text-gray-500">
                            Exp: {item.expiry_date || item.batches[0]?.expiry_date}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getPurchaseDate(item) ? new Date(getPurchaseDate(item)).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getDaysInInventory(item) !== null ? `${getDaysInInventory(item)} day${getDaysInInventory(item) === 1 ? '' : 's'}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded Row with Complete Details */}
                    {expandedRow === item.firebaseId && (
                      <tr className="bg-blue-50">
                        <td colSpan="12" className="px-6 py-6">
                          <div className="grid grid-cols-3 gap-6">
                            {/* Column 1: Basic Information */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b">📋 Basic Information</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-gray-600">Item Code:</span>
                                <span className="font-medium">{item.item_code || '-'}</span>

                                <span className="text-gray-600">Item Name:</span>
                                <span className="font-medium">{item.item_name}</span>

                                <span className="text-gray-600">Category:</span>
                                <span className="font-medium">{item.category || '-'}</span>

                                <span className="text-gray-600">Manufacturer:</span>
                                <span className="font-medium">{item.manufacturer || '-'}</span>

                                <span className="text-gray-600">HSN Code:</span>
                                <span className="font-medium">{item.hsn_code || '-'}</span>

                                <span className="text-gray-600">Dosage Form:</span>
                                <span className="font-medium">{item.dosage_form || '-'}</span>

                                <span className="text-gray-600">Strength:</span>
                                <span className="font-medium">{item.strength || '-'}</span>

                                <span className="text-gray-600">Composition:</span>
                                <span className="font-medium">{item.composition || '-'}</span>
                              </div>
                            </div>

                            {/* Column 2: Pricing & Stock */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b">💰 Pricing & Stock</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-gray-600">Purchase Price:</span>
                                <span className="font-medium text-green-700">₹{(item.purchase_price || item.purchase_rate || 0).toFixed(2)}</span>

                                <span className="text-gray-600">MRP:</span>
                                <span className="font-medium text-blue-700">₹{(item.MRP || item.mrp || 0).toFixed(2)}</span>

                                <span className="text-gray-600">Discount:</span>
                                <span className="font-medium">{item.discount_percentage || 0}%</span>

                                <span className="text-gray-600">Total GST:</span>
                                <span className="font-medium">{item.gst_percentage || 12}%</span>

                                <span className="text-gray-600">CGST:</span>
                                <span className="font-medium">{item.cgst_percentage || (item.gst_percentage/2) || 6}%</span>

                                <span className="text-gray-600">SGST:</span>
                                <span className="font-medium">{item.sgst_percentage || (item.gst_percentage/2) || 6}%</span>

                                <span className="text-gray-600">Stock Quantity:</span>
                                <span className={`font-bold ${
                                  (item.stock_quantity || 0) === 0 ? 'text-red-600' :
                                  (item.stock_quantity || 0) < (item.reorder_level || 10) ? 'text-orange-600' :
                                  'text-green-600'
                                }`}>
                                  {item.stock_quantity || 0} {item.unit_of_measurement || 'Nos'}
                                </span>

                                <span className="text-gray-600">Reorder Level:</span>
                                <span className="font-medium">{item.reorder_level || '-'}</span>

                                <span className="text-gray-600">Stock Value:</span>
                                <span className="font-medium text-purple-700">₹{(item.stock_value || ((item.stock_quantity || 0) * (item.purchase_price || item.purchase_rate || 0))).toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Column 3: Batch & Storage */}
                            <div className="space-y-3">
                              <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b">📦 Batch & Storage</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-gray-600">Batch Number:</span>
                                <span className="font-medium">{item.batch_number || (item.batches && item.batches[0]?.batch_number) || '-'}</span>

                                <span className="text-gray-600">Mfg Date:</span>
                                <span className="font-medium">{item.manufacturing_date || (item.batches && item.batches[0]?.manufacturing_date) || '-'}</span>

                                <span className="text-gray-600">Expiry Date:</span>
                                <span className="font-medium">{item.expiry_date || (item.batches && item.batches[0]?.expiry_date) || '-'}</span>

                                <span className="text-gray-600">Storage Location:</span>
                                <span className="font-medium">{item.storage_location || '-'}</span>

                                <span className="text-gray-600">Rack Number:</span>
                                <span className="font-medium">{item.rack_number || '-'}</span>

                                <span className="text-gray-600">Supplier:</span>
                                <span className="font-medium">{item.supplier_name || '-'}</span>

                                <span className="text-gray-600">Supplier Contact:</span>
                                <span className="font-medium">{item.supplier_contact || '-'}</span>

                                <span className="text-gray-600">Rx Required:</span>
                                <span className={`font-medium ${item.prescription_required ? 'text-red-600' : 'text-green-600'}`}>
                                  {item.prescription_required ? 'Yes' : 'No'}
                                </span>

                                <span className="text-gray-600">Date of Purchase:</span>
                                <span className="font-medium">{getPurchaseDate(item) ? new Date(getPurchaseDate(item)).toLocaleDateString() : '-'}</span>

                                <span className="text-gray-600">Days in Inventory:</span>
                                <span className="font-medium">{getDaysInInventory(item) !== null ? `${getDaysInInventory(item)} day${getDaysInInventory(item) === 1 ? '' : 's'}` : '-'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Additional Information Row */}
                          {(item.description || item.usage_instructions || item.side_effects || item.contraindications) && (
                            <div className="mt-6 pt-4 border-t border-blue-200">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {item.description && (
                                  <div>
                                    <span className="font-semibold text-gray-700">Description:</span>
                                    <p className="text-gray-600 mt-1">{item.description}</p>
                                  </div>
                                )}
                                {item.usage_instructions && (
                                  <div>
                                    <span className="font-semibold text-gray-700">Usage Instructions:</span>
                                    <p className="text-gray-600 mt-1">{item.usage_instructions}</p>
                                  </div>
                                )}
                                {item.side_effects && (
                                  <div>
                                    <span className="font-semibold text-gray-700">Side Effects:</span>
                                    <p className="text-gray-600 mt-1">{item.side_effects}</p>
                                  </div>
                                )}
                                {item.contraindications && (
                                  <div>
                                    <span className="font-semibold text-gray-700">Contraindications:</span>
                                    <p className="text-gray-600 mt-1">{item.contraindications}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 pt-4 border-t border-blue-200 flex gap-3">
                            <button
                              onClick={() => setEditingItem(item)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {!isSearchMode && hasMore && (
              <div className="p-4 border-t border-gray-100 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Load {Math.min(PAGE_SIZE, (totalCount ?? Infinity) - items.length)} more
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Firebase Cloud Storage Active</p>
            <p>Your inventory is stored in Firebase and syncs across all devices. The list loads {PAGE_SIZE} items at a time, sorted alphabetically — search matches the start of an item's name or code. Upload Excel files with columns: item_code, item_name, stock_quantity, purchase_rate, mrp, stock_value, purchase_date (or month)</p>
          </div>
        </div>
      </div>

      {/* Add Medicine Modal */}
      {showAddMedicine && (
        <AddMedicine
          onClose={() => setShowAddMedicine(false)}
          onSuccess={() => {
            setShowAddMedicine(false);
            loadCount();
            loadFirstPage();
          }}
        />
      )}

      {/* Edit Medicine Modal */}
      {editingItem && (
        <AddMedicine
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={(savedData) => {
            const updatedId = editingItem.firebaseId;
            setEditingItem(null);
            // Patch in place rather than a full reload — keeps scroll/pagination
            // position, and re-fetching the whole page just to reflect one
            // edited item would defeat the point of paginating in the first place.
            setItems(prev => prev.map(i => i.firebaseId === updatedId ? { ...i, ...savedData } : i));
          }}
        />
      )}
    </div>
  );
};

export default InventoryManagement;
