import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const stockStatus = (qty, reorderLevel) => {
  if (qty === 0) return { label: 'Out of stock', className: 'text-red-700 bg-red-50' };
  if (qty < reorderLevel) return { label: 'Low stock', className: 'text-orange-700 bg-orange-50' };
  return { label: 'In stock', className: 'text-green-700 bg-green-50' };
};

// Read-only view of a purchase request's line items, cross-referenced against
// live inventory stock (not just the snapshot taken when the request was raised).
const ViewPurchaseRequestModal = ({ request, onClose }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'inventory'));
      setInventory(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error loading inventory:', e);
    } finally {
      setLoading(false);
    }
  };

  const items = request.medicines || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold">Purchase Request {request.request_id}</h2>
            <p className="text-blue-100 text-sm">
              Requested by {request.requested_by} on {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Priority</p>
              <p className="font-semibold text-gray-800 capitalize">{request.priority || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Status</p>
              <p className="font-semibold text-gray-800 capitalize">{(request.status || '').replace(/_/g, ' ')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Estimated Total</p>
              <p className="font-semibold text-gray-800">₹{(request.total_estimated || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Requested Items</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading current inventory levels…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">No items on this request.</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Requested Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost/Unit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">In Inventory Now</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const invItem = inventory.find(m => item.medicine_id && m.docId === item.medicine_id)
                      || inventory.find(m => item.item_code && m.item_code === item.item_code);
                    const currentStock = invItem ? (invItem.stock_quantity || 0) : (item.current_stock ?? null);
                    const reorderLevel = invItem ? (invItem.reorder_level || invItem.reorder_point || 20) : (item.reorder_level ?? 20);
                    const status = currentStock === null ? null : stockStatus(currentStock, reorderLevel);
                    const unit = (invItem && (invItem.unit_of_measurement || invItem.unit)) || item.unit || '';

                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.medicine_name}</td>
                        <td className="px-4 py-3 text-gray-600">{item.item_code || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-800">{item.quantity} {item.unit || ''}</td>
                        <td className="px-4 py-3 text-right text-gray-700">₹{Number(item.estimated_cost || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          ₹{Number((item.quantity || 0) * (item.estimated_cost || 0)).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800">
                          {currentStock === null ? '—' : `${currentStock} ${unit}`}
                          {!invItem && (
                            <span className="block text-xs text-gray-400">not found in inventory — showing value at request time</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {status && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>{status.label}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {request.status === 'rejected' && request.rejection_reason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Rejection reason:</strong> {request.rejection_reason}
            </div>
          )}

          {request.status === 'approved' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Approved by {request.approval_by} on {request.approval_date ? new Date(request.approval_date).toLocaleDateString() : '-'}.
              {request.po_created ? ` Purchase order ${request.po_number} has been created.` : ' Use "Create PO" to order these items from a vendor.'}
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

export default ViewPurchaseRequestModal;
