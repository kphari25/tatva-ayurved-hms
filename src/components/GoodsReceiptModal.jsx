import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const GoodsReceiptModal = ({ po, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]); // Actual delivery/arrival date
  const [receivedItems, setReceivedItems] = useState(
    po.items.map(item => ({
      ...item,
      hsn_code: item.hsn_code || '',
      ordered_qty: item.quantity,
      received_qty: item.quantity,
      damaged_qty: 0,
      batch_number: '',
      expiry_date: '',
      mrp: item.rate * 2, // Default MRP as 2x purchase price
      purchase_price: item.rate,
      status: 'accepted'
    }))
  );
  const [vendorInvoice, setVendorInvoice] = useState({
    number: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [deliveryNotes, setDeliveryNotes] = useState(''); // Notes about delivery condition

  const handleItemChange = (index, field, value) => {
    const updated = [...receivedItems];
    updated[index][field] = value;
    setReceivedItems(updated);
  };

  const handleReceive = async () => {
    // Validate
    const hasEmptyBatch = receivedItems.some(item => 
      item.received_qty > 0 && !item.batch_number
    );
    const hasEmptyExpiry = receivedItems.some(item => 
      item.received_qty > 0 && !item.expiry_date
    );

    if (hasEmptyBatch || hasEmptyExpiry) {
      alert('Please enter batch number and expiry date for all received items');
      return;
    }

    if (!vendorInvoice.number) {
      alert('Please enter vendor invoice number');
      return;
    }

    try {
      setSaving(true);

      const grnNumber = `GRN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      // 1. Create GRN
      const grnData = {
        grn_number: grnNumber,
        po_number: po.po_number,
        po_id: po.id,
        po_date: po.po_date,
        vendor_name: po.vendor.name,
        vendor_invoice_number: vendorInvoice.number,
        vendor_invoice_date: vendorInvoice.date,
        
        // Delivery Tracking
        delivery_date: deliveryDate, // Actual arrival date
        received_date: new Date().toISOString().split('T')[0], // When GRN was created
        expected_delivery: po.expected_delivery, // Original expected date
        delivery_status: deliveryDate <= po.expected_delivery ? 'on_time' : 'delayed',
        delivery_notes: deliveryNotes,
        
        received_by: currentUser.email,
        items_received: receivedItems,
        created_at: new Date().toISOString()
      };

      await addDoc(collection(db, 'goods_receipt_notes'), grnData);

      // 2. Create Purchase Entry (for P&L)
      const totalAmount = receivedItems.reduce((sum, item) => sum + item.total, 0);
      
      const purchaseEntry = {
        entry_id: `PE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        grn_number: grnNumber,
        po_number: po.po_number,
        vendor: po.vendor.name,
        invoice_number: vendorInvoice.number,
        invoice_date: vendorInvoice.date,
        items: receivedItems.map(item => ({
          medicine_name: item.medicine_name,
          hsn_code: item.hsn_code || '',
          quantity: item.received_qty,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          rate: item.purchase_price,
          amount: item.amount,
          tax_percent: item.gst_percent,
          tax_amount: item.gst_amount,
          net_payable: item.total,
          purchase_price: item.purchase_price,
          mrp: item.mrp,
          margin: ((item.mrp - item.purchase_price) / item.purchase_price * 100).toFixed(2)
        })),
        subtotal: po.subtotal,
        total_tax: po.gst,
        net_payable: totalAmount,
        payment_status: 'pending',
        payment_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        entry_date: new Date().toISOString(),
        entered_by: currentUser.email
      };

      await addDoc(collection(db, 'purchase_entries'), purchaseEntry);

      // 3. Create Expense for P&L
      const expenseData = {
        date: new Date().toISOString().split('T')[0],
        category: 'medicine_purchase',
        amount: totalAmount,
        description: `Purchase from ${po.vendor.name} - ${grnNumber}\nInvoice: ${vendorInvoice.number}`,
        payment_mode: 'credit',
        vendor: po.vendor.name,
        invoice: vendorInvoice.number,
        grn: grnNumber,
        po_number: po.po_number,
        created_at: new Date().toISOString(),
        created_by: currentUser.email
      };

      await addDoc(collection(db, 'expenses'), expenseData);

      // 4. Update Inventory
      for (const item of receivedItems) {
        if (item.received_qty > 0) {
          await updateInventory(item);
        }
      }

      // 5. Update PO Status
      const allReceived = receivedItems.every(item => item.received_qty === item.ordered_qty);
      const anyReceived = receivedItems.some(item => item.received_qty > 0);
      
      const newStatus = allReceived ? 'received' : (anyReceived ? 'partially_received' : 'sent_to_vendor');
      
      await updateDoc(doc(db, 'purchase_orders', po.id), {
        status: newStatus,
        grn_created: true,
        grn_number: grnNumber,
        grn_date: new Date().toISOString(),
        actual_delivery_date: deliveryDate,
        delivery_status: grnData.delivery_status
      });

      // Calculate totals for summary
      const totalReceived = receivedItems.reduce((sum, item) => sum + item.received_qty, 0);
      const totalOrdered = receivedItems.reduce((sum, item) => sum + item.ordered_qty, 0);
      const totalDamaged = receivedItems.reduce((sum, item) => sum + (item.damaged_qty || 0), 0);
      
      // Delivery status message
      const deliveryStatusMsg = deliveryDate <= po.expected_delivery ? 
        '✅ Delivered On Time' : 
        `⚠️ Delayed (Expected: ${new Date(po.expected_delivery).toLocaleDateString()})`;

      // Enhanced success message
      alert(`✅ Goods Receipt Note Created Successfully!

GRN Number: ${grnNumber}
PO Number: ${po.po_number}
Vendor: ${po.vendor.name}

📦 DELIVERY DETAILS:
Arrival Date: ${new Date(deliveryDate).toLocaleDateString()}
${deliveryStatusMsg}
Invoice: ${vendorInvoice.number}

📊 ITEMS RECEIVED:
Total Ordered: ${totalOrdered} items
Total Received: ${totalReceived} items
${totalDamaged > 0 ? `Damaged: ${totalDamaged} items` : ''}

✅ UPDATES COMPLETED:
• Inventory updated with new stock
• Batches and expiry dates recorded
• P&L expense entry created (₹${totalAmount.toLocaleString()})
• Purchase entry logged

${allReceived ? '✅ All items received!' : '⚠️ Partially received - remaining items pending'}`);
      
      if (onSave) onSave();

    } catch (error) {
      console.error('Error creating GRN:', error);
      alert('Failed to create GRN: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateInventory = async (item) => {
    try {
      // Find inventory item by medicine name
      const inventoryRef = collection(db, 'inventory');
      const inventorySnapshot = await getDocs(inventoryRef);
      
      let inventoryItemId = null;
      let currentInventory = null;

      inventorySnapshot.forEach(doc => {
        if (doc.data().item_name === item.medicine_name) {
          inventoryItemId = doc.id;
          currentInventory = doc.data();
        }
      });

      if (!inventoryItemId) {
        console.warn(`Inventory item not found for ${item.medicine_name}`);
        return;
      }

      // Update inventory with batch tracking
      const currentStock = currentInventory.stock_quantity || 0;
      const newStock = currentStock + item.received_qty;

      // Add new batch
      const batches = currentInventory.batches || [];
      batches.push({
        batch_number: item.batch_number,
        quantity: item.received_qty,
        purchase_date: new Date().toISOString().split('T')[0],
        expiry_date: item.expiry_date,
        purchase_price: item.purchase_price,
        mrp: item.mrp
      });

      // Calculate weighted average purchase price
      let totalValue = 0;
      let totalQty = 0;
      batches.forEach(batch => {
        totalValue += batch.quantity * batch.purchase_price;
        totalQty += batch.quantity;
      });
      const weightedAvgPrice = totalQty > 0 ? totalValue / totalQty : item.purchase_price;

      // Update inventory document
      await updateDoc(doc(db, 'inventory', inventoryItemId), {
        stock_quantity: newStock,
        batches: batches,
        purchase_price: Math.round(weightedAvgPrice),
        MRP: item.mrp,
        last_purchase_date: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  };

  const calculateItemTotal = (item) => {
    const amount = item.received_qty * item.purchase_price;
    const gstAmount = (amount * item.gst_percent) / 100;
    return amount + gstAmount;
  };

  const getTotalReceived = () => {
    return receivedItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-xl font-bold">Goods Receipt Note</h2>
            <p className="text-sm text-green-100">PO: {po.po_number} | Vendor: {po.vendor.name}</p>
          </div>
          <button onClick={onClose} className="hover:bg-green-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Vendor Invoice Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-800 mb-3">Vendor Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number *</label>
                <input
                  type="text"
                  value={vendorInvoice.number}
                  onChange={(e) => setVendorInvoice({ ...vendorInvoice, number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="VENDOR-INV-12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date</label>
                <input
                  type="date"
                  value={vendorInvoice.date}
                  onChange={(e) => setVendorInvoice({ ...vendorInvoice, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Delivery Tracking */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              📦 Delivery & Arrival Tracking
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actual Delivery/Arrival Date *
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Expected: {new Date(po.expected_delivery).toLocaleDateString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Condition/Notes
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows="2"
                  placeholder="e.g., Good condition, minor packaging damage, etc."
                />
              </div>
            </div>
            {deliveryDate > po.expected_delivery && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold">
                  ⚠️ Delivery is delayed by {Math.ceil((new Date(deliveryDate) - new Date(po.expected_delivery)) / (1000 * 60 * 60 * 24))} day(s)
                </p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Received Items</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Medicine</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">HSN Code</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Ordered</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Received</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Damaged</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch #</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Purchase Price</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">MRP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receivedItems.map((item, index) => (
                    <tr key={index} className={item.received_qty !== item.ordered_qty ? 'bg-yellow-50' : ''}>
                      <td className="px-3 py-2">{item.medicine_name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.hsn_code}
                          onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                          className="w-20 px-2 py-1 border rounded"
                          placeholder="HSN"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">{item.ordered_qty}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.received_qty}
                          onChange={(e) => handleItemChange(index, 'received_qty', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded text-right"
                          min="0"
                          max={item.ordered_qty}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.damaged_qty}
                          onChange={(e) => handleItemChange(index, 'damaged_qty', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded text-right"
                          min="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.batch_number}
                          onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)}
                          className="w-32 px-2 py-1 border rounded"
                          placeholder="BATCH-001"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.expiry_date}
                          onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                          className="w-36 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.purchase_price}
                          onChange={(e) => handleItemChange(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.mrp}
                          onChange={(e) => handleItemChange(index, 'mrp', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Items Ordered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {receivedItems.reduce((sum, item) => sum + item.ordered_qty, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Items Received</p>
                <p className="text-2xl font-bold text-green-600">
                  {receivedItems.reduce((sum, item) => sum + item.received_qty, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{getTotalReceived().toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Discrepancies Warning */}
          {receivedItems.some(item => item.received_qty !== item.ordered_qty || item.damaged_qty > 0) && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800">Discrepancy Detected</p>
                <p className="text-sm text-yellow-700">
                  Received quantity doesn't match ordered quantity or there are damaged items. 
                  Please verify before proceeding.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              disabled={saving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {saving ? 'Processing...' : 'Confirm Receipt & Update Inventory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsReceiptModal;
