import React from 'react';
import { X, Building2 } from 'lucide-react';

const getStatusColor = (status) => {
  const colors = {
    sent_to_vendor: 'bg-blue-100 text-blue-800',
    partially_received: 'bg-orange-100 text-orange-800',
    received: 'bg-green-100 text-green-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Read-only view of a Purchase Order — opened from a Goods Receipt entry so
// staff can see what was originally ordered without re-entering the create-PO flow.
const ViewPurchaseOrderModal = ({ po, onClose }) => {
  const items = po.items || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold">Purchase Order {po.po_number}</h2>
            <p className="text-blue-100 text-sm">
              {po.po_date ? new Date(po.po_date).toLocaleDateString() : '-'}
              {po.request_id ? ` · From request ${po.request_id}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Vendor
              </h3>
              <p className="text-sm font-semibold text-gray-900">{po.vendor?.name || '-'}</p>
              {po.vendor?.contact && <p className="text-xs text-gray-600">{po.vendor.contact}</p>}
              {po.vendor?.email && <p className="text-xs text-gray-600">{po.vendor.email}</p>}
              {po.vendor?.gst_number && <p className="text-xs text-gray-600">GST: {po.vendor.gst_number}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Status</p>
                <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(po.status)}`}>
                  {(po.status || '').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Payment Terms</p>
                <p className="font-semibold text-gray-800 text-sm mt-1">{po.payment_terms || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Expected Delivery</p>
                <p className="font-semibold text-gray-800 text-sm mt-1">
                  {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString() : '-'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Grand Total</p>
                <p className="font-semibold text-gray-800 text-sm mt-1">₹{(po.grand_total || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Items</h3>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">No items on this order.</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">GST%</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.medicine_name}</td>
                      <td className="px-4 py-3 text-right text-gray-800">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{Number(item.rate || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{Number(item.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.gst_percent || 0}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{Number(item.total || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan="3" className="px-4 py-2 text-right">Subtotal:</td>
                    <td className="px-4 py-2 text-right" colSpan="3">₹{(po.subtotal || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="px-4 py-2 text-right">Total GST:</td>
                    <td className="px-4 py-2 text-right" colSpan="3">₹{(po.gst || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="text-blue-600">
                    <td colSpan="3" className="px-4 py-2 text-right text-lg">Grand Total:</td>
                    <td className="px-4 py-2 text-right text-lg" colSpan="3">₹{(po.grand_total || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {po.grn_created && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Received via GRN {po.grn_number} on {po.grn_date ? new Date(po.grn_date).toLocaleDateString() : '-'}.
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

export default ViewPurchaseOrderModal;
