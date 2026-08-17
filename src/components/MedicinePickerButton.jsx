import React, { useState, useEffect, useRef } from 'react';
import { Pill, Search } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const stockStatus = (item) => {
  const qty = item.stock_quantity || 0;
  const reorderLevel = item.reorder_level || 10;
  if (qty === 0) return { label: 'Out of stock', className: 'text-red-600' };
  if (qty < reorderLevel) return { label: `Low stock: ${qty} ${item.unit_of_measurement || ''}`.trim(), className: 'text-orange-600' };
  return { label: `In stock: ${qty} ${item.unit_of_measurement || ''}`.trim(), className: 'text-green-700' };
};

// Small popover button that lets a doctor search the medicine inventory and
// insert an item name (with live stock status) into a free-text field.
const MedicinePickerButton = ({ onSelect, label = 'Add from Inventory' }) => {
  const [open, setOpen] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = async () => {
    setOpen(true);
    if (medicines.length === 0) {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, 'inventory'));
        // Spread first, id last: some inventory docs carry their own legacy
        // numeric `id` field, which would otherwise clobber the real doc id.
        setMedicines(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) {
        console.error('Error loading inventory:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  const filtered = medicines.filter(m => {
    const term = search.toLowerCase();
    return (m.item_name || '').toLowerCase().includes(term) || (m.item_code || '').toLowerCase().includes(term);
  }).slice(0, 20);

  const handlePick = (m) => {
    onSelect(m);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 py-1 rounded"
      >
        <Pill className="w-3.5 h-3.5" /> {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg right-0">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search medicine..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No medicines found</p>
            ) : (
              filtered.map(m => {
                const status = stockStatus(m);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => handlePick(m)}
                    className="w-full flex flex-col items-start px-3 py-2 text-xs text-left hover:bg-teal-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-800 font-medium">{m.item_name}</span>
                    <span className={`mt-0.5 ${status.className}`}>{status.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicinePickerButton;
