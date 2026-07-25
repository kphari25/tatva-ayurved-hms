import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const emptyRow = () => ({
  id: Date.now() + Math.random(),
  item_name: '',
  item_code: '',
  mrp: 0,
  dose: '',
  frequency: '',
  instructions: '',
  days: '',
});

const stockLabel = (item) => {
  if (!item) return null;
  const qty = item.stock_quantity || 0;
  if (qty === 0) return { text: 'Out of stock', className: 'text-red-600' };
  if (qty < (item.reorder_level || 10)) return { text: `Low: ${qty}`, className: 'text-orange-600' };
  return { text: `In stock: ${qty}`, className: 'text-green-700' };
};

// Structured, multi-row "Medication Details" editor — autocomplete against
// inventory (like the Medicine Sale bill), with Dose/Frequency/Instructions/Days
// columns matching the clinic's printed prescription format. Enter moves across
// a row's fields, and off the last field it adds (or jumps to) the next row.
const MedicineTable = ({ items, onChange, label = 'Medication Details' }) => {
  const [inventory, setInventory] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const containerRef = useRef(null);
  const fieldRefs = useRef({});
  // Stable placeholder row so it isn't re-created (with a new id/key) on every
  // render while `items` is empty — that was remounting the row's <input> and
  // stealing focus out of it after every keystroke.
  const [placeholderRow] = useState(() => emptyRow());
  const rows = items && items.length > 0 ? items : [placeholderRow];

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'inventory'));
        setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error loading inventory:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (openDropdown === null) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const setRows = (nextRows) => onChange(nextRows);

  const getSuggestions = (q) =>
    q.length < 2 ? [] :
    inventory.filter(m =>
      (m.item_name || '').toLowerCase().includes(q.toLowerCase()) ||
      (m.item_code || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8);

  const handleNameChange = (rowId, value) => {
    setRows(rows.map(r => r.id === rowId ? { ...r, item_name: value, item_code: '', mrp: 0 } : r));
    setSuggestions(prev => ({ ...prev, [rowId]: getSuggestions(value) }));
    setOpenDropdown(rowId);
  };

  const handleSelectMedicine = (rowId, med) => {
    let updated = rows.map(r =>
      r.id === rowId
        ? { ...r, item_name: med.item_name || med.item_code, item_code: med.item_code || '', mrp: Number(med.mrp) || 0 }
        : r
    );
    if (updated[updated.length - 1].id === rowId) updated = [...updated, emptyRow()];
    setRows(updated);
    setSuggestions(prev => ({ ...prev, [rowId]: [] }));
    setOpenDropdown(null);
    focusField(rowId, 'dose');
  };

  const handleFieldChange = (rowId, field, value) => {
    setRows(rows.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const handleRemoveRow = (rowId) => {
    setRows(rows.length > 1 ? rows.filter(r => r.id !== rowId) : [emptyRow()]);
  };

  const focusField = (rowId, field) => {
    const el = fieldRefs.current[`${rowId}_${field}`];
    if (el) { el.focus(); if (el.select) el.select(); }
  };

  const ROW_FIELD_ORDER = ['item_name', 'dose', 'frequency', 'instructions', 'days'];

  const advanceWithinRow = (rowId, field) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Keep row navigation self-contained — don't let the outer case sheet's
    // tab-level Enter-to-advance also react to this keypress.
    e.stopPropagation();
    const idx = ROW_FIELD_ORDER.indexOf(field);
    if (idx < ROW_FIELD_ORDER.length - 1) {
      focusField(rowId, ROW_FIELD_ORDER[idx + 1]);
      return;
    }
    // Last field in the row (Days) — move to (or create) the next row.
    const rowIdx = rows.findIndex(r => r.id === rowId);
    if (rowIdx === rows.length - 1) {
      const next = emptyRow();
      setRows([...rows, next]);
      setTimeout(() => focusField(next.id, 'item_name'), 0);
    } else {
      focusField(rows[rowIdx + 1].id, 'item_name');
    }
  };

  return (
    <div ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => setRows([...rows, emptyRow()])}
          className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 py-1 rounded"
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[180px]">Medicine</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Dose</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Instructions</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase w-20">Days</th>
              <th className="px-2 py-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const status = stockLabel(inventory.find(m => m.item_code && m.item_code === row.item_code));
              return (
                <tr key={row.id}>
                  <td className="px-2 py-1.5 text-gray-400 align-top pt-2.5">{i + 1}</td>
                  <td className="px-2 py-1.5 relative align-top">
                    <input
                      type="text"
                      value={row.item_name}
                      onChange={e => handleNameChange(row.id, e.target.value)}
                      onFocus={() => setOpenDropdown(row.id)}
                      onKeyDown={advanceWithinRow(row.id, 'item_name')}
                      ref={el => { fieldRefs.current[`${row.id}_item_name`] = el; }}
                      placeholder="Search medicine…"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    {status && <span className={`block text-[11px] mt-0.5 ${status.className}`}>{status.text}</span>}
                    {openDropdown === row.id && (suggestions[row.id] || []).length > 0 && (
                      <div className="absolute z-20 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg">
                        {suggestions[row.id].map(m => (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => handleSelectMedicine(row.id, m)}
                            className="w-full flex flex-col items-start px-3 py-2 text-xs text-left hover:bg-teal-50 border-b border-gray-50 last:border-0"
                          >
                            <span className="text-gray-800 font-medium">{m.item_name}</span>
                            <span className="text-gray-400">₹{Number(m.mrp || 0).toLocaleString('en-IN')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      value={row.dose}
                      onChange={e => handleFieldChange(row.id, 'dose', e.target.value)}
                      onKeyDown={advanceWithinRow(row.id, 'dose')}
                      ref={el => { fieldRefs.current[`${row.id}_dose`] = el; }}
                      placeholder="e.g. 2-0-2"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      value={row.frequency}
                      onChange={e => handleFieldChange(row.id, 'frequency', e.target.value)}
                      onKeyDown={advanceWithinRow(row.id, 'frequency')}
                      ref={el => { fieldRefs.current[`${row.id}_frequency`] = el; }}
                      placeholder="e.g. BD A/F"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      value={row.instructions}
                      onChange={e => handleFieldChange(row.id, 'instructions', e.target.value)}
                      onKeyDown={advanceWithinRow(row.id, 'instructions')}
                      ref={el => { fieldRefs.current[`${row.id}_instructions`] = el; }}
                      placeholder="e.g. with hot water"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="number"
                      min="0"
                      value={row.days}
                      onChange={e => handleFieldChange(row.id, 'days', e.target.value)}
                      onKeyDown={advanceWithinRow(row.id, 'days')}
                      ref={el => { fieldRefs.current[`${row.id}_days`] = el; }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top pt-2.5">
                    <button type="button" onClick={() => handleRemoveRow(row.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicineTable;
