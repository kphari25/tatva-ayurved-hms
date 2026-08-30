import React, { useState, useEffect, useRef } from 'react';
import { Package, Search } from 'lucide-react';
import { fetchPackages } from './PackageManagement';

// Sibling to TreatmentPickerButton, sourced from Treatment Packages instead
// of the Treatment Charges price list. A package has one bundled cost (not
// per-inclusion pricing), so picking one inserts a single line item — same
// shape ({name, price}) the caller already pushes into treatment_items for
// TreatmentPickerButton picks, so the invoice's existing auto-sync (which
// just sums treatment_items) picks packages up with no further changes.
const PackagePickerButton = ({ onSelect, label = 'Add from Package' }) => {
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState([]);
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
    if (packages.length === 0) {
      try {
        setLoading(true);
        const data = await fetchPackages();
        setPackages(data);
      } catch (e) {
        console.error('Error loading packages:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  const filtered = packages.filter(p => (p.name || '').toLowerCase().includes(search.toLowerCase()));

  const handlePick = (p) => {
    onSelect(p);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 hover:bg-green-50 px-2 py-1 rounded"
      >
        <Package className="w-3.5 h-3.5" /> {label}
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
                placeholder="Search package..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No packages found</p>
            ) : (
              filtered.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handlePick(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-green-50"
                >
                  <span className="text-gray-800">
                    {p.name}
                    {p.category && <span className="block text-[10px] text-gray-400">{p.category}</span>}
                  </span>
                  <span className="text-green-700 font-semibold ml-2 whitespace-nowrap">₹{Number(p.cost || 0).toLocaleString('en-IN')}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagePickerButton;
