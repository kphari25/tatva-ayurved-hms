import React from 'react';
import { X } from 'lucide-react';

// Displays treatments or medicines picked from a price list / inventory as removable chips,
// with a running subtotal. This list is the structured data source that invoices read from.
const TreatmentItemsList = ({ items = [], onRemove, note = "this will be reflected automatically in the invoice's Treatment Charges" }) => {
  if (!items.length) return null;

  const subtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span
            key={`${item.name}-${idx}`}
            className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 text-xs px-2.5 py-1 rounded-full"
          >
            {item.name} · ₹{Number(item.price || 0).toLocaleString('en-IN')}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="text-teal-500 hover:text-red-600"
              title="Remove from billing"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Subtotal: <span className="font-semibold text-gray-700">₹{subtotal.toLocaleString('en-IN')}</span> — {note}.
      </p>
    </div>
  );
};

export default TreatmentItemsList;
