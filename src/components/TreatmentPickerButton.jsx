import React, { useState, useEffect, useRef } from 'react';
import { ListPlus, Search } from 'lucide-react';
import { fetchTreatmentCharges } from './TreatmentCharges';

// Small popover button that lets a doctor browse the Treatment Charges price
// list and insert a treatment (with its price) into a free-text field.
const TreatmentPickerButton = ({ onSelect, label = 'Add from Price List' }) => {
  const [open, setOpen] = useState(false);
  const [treatments, setTreatments] = useState([]);
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
    if (treatments.length === 0) {
      try {
        setLoading(true);
        const data = await fetchTreatmentCharges();
        setTreatments(data);
      } catch (e) {
        console.error('Error loading treatment charges:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  const filtered = treatments.filter(t => (t.name || '').toLowerCase().includes(search.toLowerCase()));

  const handlePick = (t) => {
    onSelect(t);
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
        <ListPlus className="w-3.5 h-3.5" /> {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg right-0">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search treatment..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No treatments found</p>
            ) : (
              filtered.map(t => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handlePick(t)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-teal-50"
                >
                  <span className="text-gray-800">{t.name}</span>
                  <span className="text-teal-700 font-semibold ml-2 whitespace-nowrap">₹{Number(t.price || 0).toLocaleString('en-IN')}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentPickerButton;
