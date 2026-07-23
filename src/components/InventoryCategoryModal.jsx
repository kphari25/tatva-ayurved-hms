import React from 'react';
import { X } from 'lucide-react';

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)));
};

const getPurchaseDate = (item) => item.last_purchase_date || item.purchase_date || item.imported_at || item.created_at || null;

// Read-only drill-down list for an Analytics alert card (Out of Stock, Low Stock,
// Stagnant, Fast Moving) - shown when the user clicks the card.
const InventoryCategoryModal = ({ title, items, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-blue-100 text-sm">{items.length} item{items.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No items in this category.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date of Purchase</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days in Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const purchaseDate = getPurchaseDate(item);
                    const age = daysSince(purchaseDate);
                    return (
                      <tr key={item.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{item.item_code || '-'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-3 text-right text-gray-800">
                          {item.stock_quantity || 0} {item.unit_of_measurement || ''}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.reorder_level || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {purchaseDate ? new Date(purchaseDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {age !== null ? `${age} day${age === 1 ? '' : 's'}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryCategoryModal;
