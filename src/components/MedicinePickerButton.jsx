import React, { useState, useEffect, useRef } from 'react';
import { ListPlus, Search } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Small popover button that lets staff browse Inventory and add a medicine
// (with its MRP) as a billed line item — same pattern as TreatmentPickerButton
// / PackagePickerButton, sourced from the inventory collection instead.
const MedicinePickerButton = ({ onSelect, label = 'Add Medicine' }) => {
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
        const items = snap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));
        setMedicines(items);
      } catch (e) {
        console.error('Error loading inventory:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  const filtered = medicines.filter(m =>
    (m.item_name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(m.item_code || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);

  const handlePick = (m) => {
    onSelect(m);
    setOpen(false);
    setSearch('');
  };

  const stockLabel = (item) => {
    const qty = item.stock_quantity || 0;
    if (qty === 0) return { text: 'Out of stock', className: 'text-red-600' };
    if (qty < (item.reorder_level || 10)) return { text: `Low: ${qty}`, className: 'text-orange-600' };
    return { text: `In stock: ${qty}`, className: 'text-green-700' };
  };

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 py-1 rounded"
      >
        <ListPlus className="w-3.5 h-3.5" /> {label}
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
                const st = stockLabel(m);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => handlePick(m)}
                    className="w-full flex flex-col items-start px-3 py-2 text-xs text-left hover:bg-teal-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-800 font-medium">{m.item_name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-teal-700 font-semibold">₹{Number(m.mrp || 0).toLocaleString('en-IN')}</span>
                      <span className={st.className}>{st.text}</span>
                    </span>
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
