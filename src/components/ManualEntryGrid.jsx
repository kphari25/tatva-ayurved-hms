import React, { useState, useRef, useEffect } from 'react';
import { Plus, Save, X, Package, Trash2, AlertCircle } from 'lucide-react';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GST_CATEGORIES, rateForGSTCategory, splitGST } from '../lib/gstCategories';

// Spreadsheet-style bulk entry for inventory. Column order here is also the
// order cells are filled when pasting from Excel (tab-separated).
const COLUMNS = [
  { key: 'item_name', label: 'Medicine Name', width: 'min-w-[200px]' },
  { key: 'item_code', label: 'Item Code', width: 'min-w-[110px]' },
  { key: 'batch_number', label: 'Batch Code', width: 'min-w-[110px]' },
  { key: 'manufacturer', label: 'Manufacturer', width: 'min-w-[150px]' },
  { key: 'hsn_code', label: 'HSN Code', width: 'min-w-[100px]' },
  { key: 'purchase_price', label: 'Purchase Price', type: 'number', width: 'min-w-[110px]' },
  { key: 'MRP', label: 'MRP', type: 'number', width: 'min-w-[90px]' },
  { key: 'discount_percentage', label: 'Discount %', type: 'number', width: 'min-w-[90px]' },
  { key: 'gst_category', label: 'GST Category', type: 'select', width: 'min-w-[200px]' },
  { key: 'stock_quantity', label: 'Stock Qty', type: 'number', width: 'min-w-[90px]' },
  { key: 'entry_date', label: 'Entry Date', type: 'date', width: 'min-w-[140px]' },
  { key: 'manufacturing_date', label: 'Mfg Date', type: 'date', width: 'min-w-[140px]' },
  { key: 'expiry_date', label: 'Expiry Date', type: 'date', width: 'min-w-[140px]' },
];

const today = () => new Date().toISOString().split('T')[0];
const emptyRow = () => ({
  id: Date.now() + Math.random(),
  item_name: '', item_code: '', batch_number: '', manufacturer: '', hsn_code: '',
  purchase_price: '', MRP: '', discount_percentage: '', gst_category: '',
  stock_quantity: '', entry_date: today(), manufacturing_date: '', expiry_date: '',
});
const isBlank = (r) => !r.item_name.trim() && !r.item_code.trim() && !r.purchase_price && !r.MRP && !r.stock_quantity;

// Maps a pasted GST cell ("standard", "Ayurvedic Cosmetics", "12"...) to a key.
const matchCategory = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  return GST_CATEGORIES.find(c => c.key === s || c.label.toLowerCase().startsWith(s) || s.startsWith(c.key))?.key || '';
};

const ManualEntryGrid = ({ onClose, onSuccess, onSwitchToForm }) => {
  const [rows, setRows] = useState(() => Array.from({ length: 10 }, emptyRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorIds, setErrorIds] = useState(new Set());
  const gridRef = useRef(null);
  // Existing inventory, for name autocomplete (same source AddMedicine uses).
  const [inventory, setInventory] = useState([]);
  // { rowId, rowIdx, rect, list, index } while the Medicine Name dropdown is open.
  const [sugg, setSugg] = useState(null);

  useEffect(() => {
    getDocs(collection(db, 'inventory'))
      .then(snap => setInventory(snap.docs.map(d => d.data())))
      .catch(err => console.error('Error loading inventory for autocomplete:', err));
  }, []);

  const focusCell = (r, c) => setTimeout(() => gridRef.current?.querySelector(`[data-cell="${r}-${c}"]`)?.focus(), 0);

  const updateSuggestions = (row, rowIdx, value, el) => {
    const term = value.trim().toLowerCase();
    if (term.length < 2) { setSugg(null); return; }
    const seen = new Set();
    const list = inventory.filter(m => {
      const name = String(m.item_name || '');
      if (!name || seen.has(name.toLowerCase())) return false;
      const hit = name.toLowerCase().includes(term) || String(m.item_code || '').toLowerCase().includes(term);
      if (hit) seen.add(name.toLowerCase());
      return hit;
    }).slice(0, 8);
    setSugg(list.length ? { rowId: row.id, rowIdx, rect: el.getBoundingClientRect(), list, index: -1 } : null);
  };

  // Picking an existing medicine fills its master details (like Add Medicine
  // does) but leaves batch, stock and dates for the new stock being entered.
  const pickSuggestion = (rowId, rowIdx, m) => {
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r,
      item_name: m.item_name || '',
      item_code: m.item_code != null ? String(m.item_code) : '',
      manufacturer: m.manufacturer || '',
      hsn_code: m.hsn_code || '',
      purchase_price: String(m.purchase_price ?? m.purchase_rate ?? ''),
      MRP: String(m.MRP ?? m.mrp ?? ''),
      discount_percentage: m.discount_percentage ? String(m.discount_percentage) : '',
      gst_category: m.gst_category || '',
    } : r));
    setSugg(null);
    focusCell(rowIdx, 2); // Batch Code — name and code are already filled
  };

  const setCell = (id, key, value) => setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
  const addRows = (n = 5) => setRows(prev => [...prev, ...Array.from({ length: n }, emptyRow)]);
  const removeRow = (id) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  // Enter acts like Tab: moves to the next column in the row, and from the
  // last column wraps to the first column of the next row. Works from the
  // GST Category dropdown too (it lands there, pick with arrows, Enter moves on).
  const handleKeyDown = (e, rowIdx, colIdx) => {
    if (colIdx === 0 && sugg && sugg.rowId === rows[rowIdx].id) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSugg({ ...sugg, index: Math.min(sugg.index + 1, sugg.list.length - 1) }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSugg({ ...sugg, index: Math.max(sugg.index - 1, -1) }); return; }
      if (e.key === 'Escape') { setSugg(null); return; }
      if (e.key === 'Enter' && sugg.index >= 0) { e.preventDefault(); pickSuggestion(sugg.rowId, rowIdx, sugg.list[sugg.index]); return; }
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    setSugg(null);
    const lastCol = colIdx === COLUMNS.length - 1;
    const nextRow = lastCol ? rowIdx + 1 : rowIdx;
    const nextCol = lastCol ? 0 : colIdx + 1;
    if (nextRow >= rows.length) addRows(1);
    focusCell(nextRow, nextCol);
  };

  // Pasting multi-cell data copied from Excel/Sheets fills down and across
  // from the cell it was pasted into.
  const handlePaste = (e, rowIdx, colIdx) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1);
    setRows(prev => {
      const next = [...prev];
      while (next.length < rowIdx + lines.length) next.push(emptyRow());
      lines.forEach((line, li) => {
        const row = { ...next[rowIdx + li] };
        line.split('\t').forEach((cell, ci) => {
          const col = COLUMNS[colIdx + ci];
          if (!col) return;
          const v = cell.trim();
          row[col.key] = col.key === 'gst_category' ? matchCategory(v) : v;
        });
        next[rowIdx + li] = row;
      });
      return next;
    });
  };

  const handleSave = async () => {
    const filled = rows.filter(r => !isBlank(r));
    if (filled.length === 0) { setError('Enter at least one medicine.'); return; }

    const bad = new Set();
    filled.forEach(r => {
      if (!r.item_name.trim() || !r.item_code.trim() || !(parseFloat(r.MRP) > 0) || r.purchase_price === '' || isNaN(parseFloat(r.purchase_price)) || r.stock_quantity === '' || isNaN(parseInt(r.stock_quantity))) bad.add(r.id);
    });
    setErrorIds(bad);
    if (bad.size > 0) {
      setError(`${bad.size} highlighted row(s) are incomplete — Medicine Name, Item Code, Purchase Price, MRP and Stock Qty are required.`);
      return;
    }

    try {
      setSaving(true);
      setError('');
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}').email;
      const now = new Date().toISOString();
      // Firestore batches cap at 500 writes.
      for (let i = 0; i < filled.length; i += 400) {
        const wb = writeBatch(db);
        filled.slice(i, i + 400).forEach(r => {
          const catRate = rateForGSTCategory(r.gst_category);
          const gst = catRate ?? 12;
          const { cgst, sgst } = splitGST(gst);
          const qty = parseInt(r.stock_quantity);
          const purchaseDate = r.entry_date || today();
          wb.set(doc(collection(db, 'inventory')), {
            item_name: r.item_name.trim(),
            item_code: r.item_code.trim().toUpperCase(),
            category: '',
            manufacturer: r.manufacturer.trim(),
            hsn_code: r.hsn_code.trim(),
            purchase_price: parseFloat(r.purchase_price),
            MRP: parseFloat(r.MRP),
            discount_percentage: parseFloat(r.discount_percentage) || 0,
            gst_category: r.gst_category || '',
            gst_percentage: gst,
            cgst_percentage: cgst,
            sgst_percentage: sgst,
            stock_quantity: qty,
            reorder_level: 10,
            unit_of_measurement: 'Nos',
            manufacturing_date: r.manufacturing_date || '',
            expiry_date: r.expiry_date || '',
            batch_number: r.batch_number.trim(),
            purchase_date: purchaseDate,
            last_purchase_date: purchaseDate,
            batches: [{
              batch_number: r.batch_number.trim(),
              quantity: qty,
              manufacturing_date: r.manufacturing_date || null,
              expiry_date: r.expiry_date || null,
              purchase_date: purchaseDate,
              purchase_price: parseFloat(r.purchase_price),
              mrp: parseFloat(r.MRP),
            }],
            is_active: true,
            prescription_required: false,
            created_at: now,
            created_by: user,
            last_updated: now,
          });
        });
        await wb.commit();
      }
      alert(`✅ ${filled.length} medicine${filled.length === 1 ? '' : 's'} added to inventory.`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Manual entry save failed:', err);
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filledCount = rows.filter(r => !isBlank(r)).length;
  const cellCls = 'w-full px-2 py-1.5 text-sm border border-transparent focus:border-blue-500 focus:outline-none bg-transparent';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[96vw] max-h-[92vh] flex flex-col">
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Add New Medicine</h2>
              <p className="text-sm text-blue-100">Type directly in the grid, or paste rows copied from Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex gap-1 px-6 pt-3 border-b border-gray-200">
          <button onClick={onSwitchToForm} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent">Single Entry Form</button>
          <button className="px-4 py-2 text-sm font-medium text-blue-700 border-b-2 border-blue-600">Manual Entry</button>
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6" ref={gridRef} onScroll={() => setSugg(null)}>
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-2 w-10 text-gray-500">#</th>
                {COLUMNS.map(c => (
                  <th key={c.key} className={`border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap ${c.width}`}>{c.label}</th>
                ))}
                <th className="border border-gray-300 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.id} className={errorIds.has(r.id) ? 'bg-red-50' : ''}>
                  <td className="border border-gray-300 px-2 text-center text-gray-400 bg-gray-50">{ri + 1}</td>
                  {COLUMNS.map((c, ci) => (
                    <td key={c.key} className="border border-gray-300 p-0">
                      {c.type === 'select' ? (
                        <select
                          data-cell={`${ri}-${ci}`}
                          value={r.gst_category}
                          onChange={e => setCell(r.id, c.key, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, ri, ci)}
                          className={cellCls}
                        >
                          <option value="">Default (12%)</option>
                          {GST_CATEGORIES.map(g => <option key={g.key} value={g.key}>{g.label} — {g.rate}%</option>)}
                        </select>
                      ) : (
                        <input
                          data-cell={`${ri}-${ci}`}
                          type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                          min={c.type === 'number' ? 0 : undefined}
                          step={c.type === 'number' ? 'any' : undefined}
                          value={r[c.key]}
                          onChange={e => { setCell(r.id, c.key, e.target.value); if (ci === 0) updateSuggestions(r, ri, e.target.value, e.target); }}
                          onBlur={ci === 0 ? () => setTimeout(() => setSugg(null), 150) : undefined}
                          autoComplete="off"
                          onKeyDown={e => handleKeyDown(e, ri, ci)}
                          onPaste={e => handlePaste(e, ri, ci)}
                          className={cellCls}
                        />
                      )}
                    </td>
                  ))}
                  <td className="border border-gray-300 text-center">
                    <button onClick={() => removeRow(r.id)} className="p-1 text-gray-400 hover:text-red-600" title="Remove row"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => addRows(5)} className="mt-3 flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium">
            <Plus className="w-4 h-4" /> Add 5 more rows
          </button>
        </div>

        {sugg && (
          <ul
            className="fixed z-[60] bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-auto text-sm"
            style={{ top: sugg.rect.bottom + 2, left: sugg.rect.left, minWidth: Math.max(sugg.rect.width, 320) }}
          >
            {sugg.list.map((m, i) => (
              <li
                key={i}
                onMouseDown={e => { e.preventDefault(); pickSuggestion(sugg.rowId, sugg.rowIdx, m); }}
                className={`px-3 py-2 cursor-pointer ${i === sugg.index ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              >
                <div className="font-medium text-gray-800">{m.item_name}</div>
                <div className="text-xs text-gray-500">{[m.item_code, m.manufacturer, (m.MRP ?? m.mrp) ? `MRP ₹${m.MRP ?? m.mrp}` : ''].filter(Boolean).join(' · ')}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">{filledCount} medicine{filledCount === 1 ? '' : 's'} entered · Blank rows are ignored</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || filledCount === 0} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : `Save ${filledCount || ''} to Inventory`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualEntryGrid;
