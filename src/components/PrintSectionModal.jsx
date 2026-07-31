import React from 'react';
import { X, Printer, FileStack } from 'lucide-react';

// Lets the user choose to print the whole case sheet or just one section/tab of it.
// Clicking any row prints immediately — no separate confirm step.
const PrintSectionModal = ({ title = 'Print', sections = [], onPrint, onClose }) => {
  const handlePick = (sectionId) => {
    // Close first so the picker doesn't stay stuck open if the print window
    // itself fails to open (e.g. a popup blocker).
    onClose();
    onPrint(sectionId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-teal-700 rounded-t-xl">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 text-white hover:bg-teal-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs text-gray-500 mb-1">Choose what to print:</p>

          <button
            onClick={() => handlePick('all')}
            className="w-full flex items-center gap-3 px-4 py-3 border border-teal-200 bg-teal-50 rounded-lg text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            <FileStack className="w-4 h-4" /> All Pages
          </button>

          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => handlePick(s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-teal-300"
            >
              <Printer className="w-4 h-4 text-gray-400" /> {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrintSectionModal;
