import React, { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PurchaseOrderModal = ({ request, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [poItems, setPOItems] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30 days');
  const [expectedDelivery, setExpectedDelivery] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [newVendor, setNewVendor] = useState({
    name: '',
    contact: '',
    email: '',
    gst_number: '',
    address: ''
  });

  useEffect(() => {
    loadVendors();
    initializePOItems();
  }, []);

  const loadVendors = async () => {
    try {
      const vendorsRef = collection(db, 'vendors');
      const snapshot = await getDocs(vendorsRef);
      const vendorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const initializePOItems = () => {
    const items = request.medicines.map(med => ({
      medicine_name: med.medicine_name,
      quantity: med.quantity,
      rate: med.estimated_cost,
      amount: med.quantity * med.estimated_cost,
      gst_percent: 12,
      gst_amount: (med.quantity * med.estimated_cost * 12) / 100,
      total: med.quantity * med.estimated_cost * 1.12
    }));
    setPOItems(items);
  };

  const handleVendorSelect = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setSelectedVendor(vendor);
  };

  const handleSaveNewVendor = async () => {
    if (!newVendor.name || !newVendor.contact) {
      alert('Please enter vendor name and contact');
      return;
    }

    try {
      const vendorData = {
        ...newVendor,
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      };

      const docRef = await addDoc(collection(db, 'vendors'), vendorData);
      const vendor = { id: docRef.id, ...vendorData };
      
      setVendors([...vendors, vendor]);
      setSelectedVendor(vendor);
      setShowNewVendor(false);
      setNewVendor({ name: '', contact: '', email: '', gst_number: '', address: '' });
      
      alert('✅ Vendor added successfully!');
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor: ' + error.message);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...poItems];
    updated[index][field] = parseFloat(value) || 0;
    
    // Recalculate totals
    updated[index].amount = updated[index].quantity * updated[index].rate;
    updated[index].gst_amount = (updated[index].amount * updated[index].gst_percent) / 100;
    updated[index].total = updated[index].amount + updated[index].gst_amount;
    
    setPOItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = poItems.reduce((sum, item) => sum + item.amount, 0);
    const gst = poItems.reduce((sum, item) => sum + item.gst_amount, 0);
    const grandTotal = poItems.reduce((sum, item) => sum + item.total, 0);
    return { subtotal, gst, grandTotal };
  };

  const handleCreatePO = async () => {
    if (!selectedVendor) {
      alert('Please select a vendor');
      return;
    }

    try {
      setSaving(true);

      const { subtotal, gst, grandTotal } = calculateTotals();

      const poData = {
        po_number: `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        request_id: request.request_id,
        vendor: {
          id: selectedVendor.id,
          name: selectedVendor.name,
          contact: selectedVendor.contact,
          email: selectedVendor.email,
          gst_number: selectedVendor.gst_number
        },
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery: expectedDelivery,
        items: poItems,
        subtotal: subtotal,
        gst: gst,
        grand_total: grandTotal,
        payment_terms: paymentTerms,
        status: 'sent_to_vendor',
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      };

      await addDoc(collection(db, 'purchase_orders'), poData);

      // Update request status
      await updateDoc(doc(db, 'purchase_requests', request.id), {
        po_created: true,
        po_date: new Date().toISOString()
      });

      alert('✅ Purchase Order created successfully!');
      if (onSave) onSave();

    } catch (error) {
      console.error('Error creating PO:', error);
      alert('Failed to create PO: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold">Create Purchase Order</h2>
            <p className="text-sm text-blue-100">From Request: {request.request_id}</p>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Vendor Selection */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Vendor Details
              </h3>
              <button
                onClick={() => setShowNewVendor(!showNewVendor)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {showNewVendor ? 'Cancel' : '+ New Vendor'}
              </button>
            </div>

            {!showNewVendor ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Vendor</label>
                  <select
                    value={selectedVendor?.id || ''}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Choose vendor...</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} - {vendor.contact}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedVendor && (
                  <div className="p-3 bg-white rounded border">
                    <p className="text-sm font-semibold text-gray-800">{selectedVendor.name}</p>
                    <p className="text-xs text-gray-600">{selectedVendor.contact}</p>
                    <p className="text-xs text-gray-600">{selectedVendor.email}</p>
                    {selectedVendor.gst_number && (
                      <p className="text-xs text-gray-600">GST: {selectedVendor.gst_number}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name *</label>
                  <input
                    type="text"
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="ABC Pharma Distributors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                  <input
                    type="tel"
                    value={newVendor.contact}
                    onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="sales@abcpharma.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    value={newVendor.gst_number}
                    onChange={(e) => setNewVendor({ ...newVendor, gst_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="27AABCU9603R1ZM"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    value={newVendor.address}
                    onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows="2"
                    placeholder="Complete address..."
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={handleSaveNewVendor}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save Vendor
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PO Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Net 7 days">Net 7 days</option>
                <option value="Net 15 days">Net 15 days</option>
                <option value="Net 30 days">Net 30 days</option>
                <option value="Net 45 days">Net 45 days</option>
                <option value="Advance Payment">Advance Payment</option>
                <option value="COD">Cash on Delivery</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Items</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Medicine</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Rate</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">GST%</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">GST Amt</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {poItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">{item.medicine_name}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-20 px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={item.gst_percent}
                          onChange={(e) => handleItemChange(index, 'gst_percent', e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.gst_amount.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold">₹{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan="3" className="px-4 py-2 text-right">Subtotal:</td>
                    <td className="px-4 py-2 text-right">₹{totals.subtotal.toLocaleString()}</td>
                    <td colSpan="3"></td>
                  </tr>
                  <tr>
                    <td colSpan="3" className="px-4 py-2 text-right">Total GST:</td>
                    <td className="px-4 py-2 text-right">₹{totals.gst.toLocaleString()}</td>
                    <td colSpan="3"></td>
                  </tr>
                  <tr className="text-blue-600">
                    <td colSpan="3" className="px-4 py-2 text-right text-lg">Grand Total:</td>
                    <td className="px-4 py-2 text-right text-lg">₹{totals.grandTotal.toLocaleString()}</td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePO}
              disabled={saving || !selectedVendor}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderModal;
