import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
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
        // Spread first, id last: some inventory docs carry their own legacy
        // numeric `id` field, which would otherwise clobber the real doc id.
        setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) {
        console.error('Error loading inventory:', e);
      } finally {
        setLoadingInventory(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (openDropdown === null) return;
    // The dropdown is portaled to <body> (see render), so a click inside it
    // isn't a descendant of containerRef — check both before treating it as "outside".
    const handleClickOutside = (e) => {
      const insideContainer = containerRef.current && containerRef.current.contains(e.target);
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!insideContainer && !insideDropdown) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    // Close rather than track a stale position while the page scrolls/resizes.
    const closeOnScrollOrResize = () => setOpenDropdown(null);
    window.addEventListener('scroll', closeOnScrollOrResize, true);
    window.addEventListener('resize', closeOnScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', closeOnScrollOrResize, true);
      window.removeEventListener('resize', closeOnScrollOrResize);
    };
  }, [openDropdown]);

  const setRows = (nextRows) => onChange(nextRows);

  // Positions the suggestions dropdown (portaled to <body>) against the row's
  // Medicine input — a plain absolutely-positioned dropdown gets clipped by the
  // table wrapper's overflow-x-auto (setting overflow-x forces overflow-y to
  // behave as auto too, per the CSS spec), so it needs to escape via a portal.
  const openDropdownFor = (rowId) => {
    setOpenDropdown(rowId);
    const el = fieldRefs.current[`${rowId}_item_name`];
    if (el) {
      const r = el.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    }
  };

  // Computed fresh from the current `inventory` on every render (rather than
  // snapshotted into state at keystroke time) so results stay correct even if
  // the ~4700-item inventory is still loading when the user starts typing.
  const getSuggestions = (q) =>
    q.length < 2 ? [] :
    inventory.filter(m =>
      (m.item_name || '').toLowerCase().includes(q.toLowerCase()) ||
      (m.item_code || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8);

  const handleNameChange = (rowId, value) => {
    setRows(rows.map(r => r.id === rowId ? { ...r, item_name: value, item_code: '', mrp: 0 } : r));
    openDropdownFor(rowId);
  };

  const handleSelectMedicine = (rowId, med) => {
    let updated = rows.map(r =>
      r.id === rowId
        ? { ...r, item_name: med.item_name || med.item_code, item_code: med.item_code || '', mrp: Number(med.mrp) || 0 }
        : r
    );
    if (updated[updated.length - 1].id === rowId) updated = [...updated, emptyRow()];
    setRows(updated);
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
              const rowSuggestions = getSuggestions(row.item_name);
              return (
                <tr key={row.id}>
                  <td className="px-2 py-1.5 text-gray-400 align-top pt-2.5">{i + 1}</td>
                  <td className="px-2 py-1.5 relative align-top">
                    <input
                      type="text"
                      value={row.item_name}
                      onChange={e => handleNameChange(row.id, e.target.value)}
                      onFocus={() => openDropdownFor(row.id)}
                      onKeyDown={advanceWithinRow(row.id, 'item_name')}
                      ref={el => { fieldRefs.current[`${row.id}_item_name`] = el; }}
                      placeholder="Search medicine…"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    {status && <span className={`block text-[11px] mt-0.5 ${status.className}`}>{status.text}</span>}
                    {openDropdown === row.id && row.item_name.length >= 2 && dropdownRect && createPortal(
                      <div
                        ref={dropdownRef}
                        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
                        style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
                      >
                        {loadingInventory ? (
                          <p className="text-xs text-gray-400 text-center py-3">Loading medicines…</p>
                        ) : rowSuggestions.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-3">No medicines found</p>
                        ) : (
                          rowSuggestions.map(m => {
                            const st = stockLabel(m);
                            return (
                              <button
                                type="button"
                                key={m.id}
                                onClick={() => handleSelectMedicine(row.id, m)}
                                className="w-full flex flex-col items-start px-3 py-2 text-xs text-left hover:bg-teal-50 border-b border-gray-50 last:border-0"
                              >
                                <span className="text-gray-800 font-medium">{m.item_name}</span>
                                <span className="flex items-center gap-2">
                                  <span className="text-gray-400">₹{Number(m.mrp || 0).toLocaleString('en-IN')}</span>
                                  {st && <span className={st.className}>{st.text}</span>}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>,
                      document.body
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
