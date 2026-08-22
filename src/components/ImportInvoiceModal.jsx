import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, AlertTriangle, Trash2, Loader2, FileText } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { parseInvoicePdf } from '../lib/anthropic';

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Matches an AI-read line description against existing inventory by normalized
// word overlap — avoids GoodsReceiptModal's fragile exact-string-equality match,
// since vendor invoice wording rarely matches the inventory item name exactly.
const findBestInventoryMatch = (description, inventory) => {
  const descNorm = normalize(description);
  if (!descNorm) return null;
  const descWords = new Set(descNorm.split(' ').filter(w => w.length > 2));
  let best = null;
  let bestScore = 0;
  for (const inv of inventory) {
    const invNorm = normalize(inv.item_name);
    if (!invNorm) continue;
    if (invNorm === descNorm) return inv;
    const invWords = invNorm.split(' ').filter(w => w.length > 2);
    if (invWords.length === 0) continue;
    const overlap = invWords.filter(w => descWords.has(w)).length;
    const score = overlap / invWords.length;
    if (score > bestScore) { bestScore = score; best = inv; }
  }
  return bestScore >= 0.5 ? best : null;
};

const findBestVendorMatch = (name, gstin, vendors) => {
  const gstinNorm = normalize(gstin);
  if (gstinNorm) {
    const byGstin = vendors.find(v => v.gstin && normalize(v.gstin) === gstinNorm);
    if (byGstin) return byGstin;
  }
  const nameNorm = normalize(name);
  if (!nameNorm) return null;
  return vendors.find(v => normalize(v.name) === nameNorm) || null;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const computeItemAmount = (it) => (it.quantity || 0) * (it.purchase_price || 0) - (it.discount_amount || 0);
const computeItemTotal = (it) => {
  const amount = computeItemAmount(it);
  return amount + (amount * (it.gst_percent || 0)) / 100;
};

// Imports a vendor PDF invoice directly into a Goods Receipt — no pre-existing
// Purchase Order required. Mirrors GoodsReceiptModal's 4-collection write
// (goods_receipt_notes, purchase_entries, expenses, inventory), but the AI-read
// line items always land in an editable review table first; nothing is written
// to Firestore until the user confirms.
const ImportInvoiceModal = ({ onClose, onSave }) => {
  const [step, setStep] = useState('upload'); // upload | parsing | review
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfName, setPdfName] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [vendorsSnap, inventorySnap] = await Promise.all([
          getDocs(collection(db, 'vendors')),
          getDocs(collection(db, 'inventory')),
        ]);
        setVendors(vendorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setInventory(
          inventorySnap.docs
            // Spread first, id last: some inventory docs carry their own legacy
            // numeric `id` field in the data, which would otherwise clobber the
            // real Firestore document id and break doc(db, 'inventory', id) calls.
            .map(d => ({ ...d.data(), id: d.id }))
            .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''))
        );
      } catch (err) {
        console.error('Error loading vendors/inventory:', err);
      }
    })();
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('File is too large (max 15MB).'); return; }

    setError('');
    setPdfName(file.name);
    setStep('parsing');

    try {
      const path = `vendor_invoices/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setPdfUrl(url);

      const base64 = await fileToBase64(file);
      const result = await parseInvoicePdf(base64);
      if (!result.success) throw new Error(result.error);

      const parsed = result.data || {};

      const matchedVendor = findBestVendorMatch(parsed.vendor_name, parsed.vendor_gstin, vendors);
      setVendorId(matchedVendor ? matchedVendor.id : '');
      setVendorName(matchedVendor ? matchedVendor.name : (parsed.vendor_name || ''));
      setVendorGstin(parsed.vendor_gstin || '');
      setInvoiceNumber(parsed.invoice_number || '');
      setInvoiceDate(parsed.invoice_date || new Date().toISOString().split('T')[0]);

      const mappedItems = (parsed.items || []).map((it, idx) => {
        const match = findBestInventoryMatch(it.description, inventory);
        const purchasePrice = Math.round(Number(it.unit_price) || 0);
        return {
          key: idx,
          description: it.description || '',
          hsn_code: it.hsn_code || '',
          inventory_id: match ? match.id : '',
          new_item_name: match ? '' : (it.description || ''),
          quantity: Number(it.quantity) || 0,
          purchase_price: purchasePrice,
          mrp: purchasePrice * 2,
          batch_number: it.batch_number || '',
          expiry_date: it.expiry_date || '',
          gst_percent: Number(it.gst_percent) || 0,
          discount_amount: Number(it.discount_amount) || 0,
        };
      });
      setItems(mappedItems);
      setStep('review');
    } catch (err) {
      console.error('Error reading invoice:', err);
      setError('Failed to read invoice: ' + err.message);
      setStep('upload');
    }
  };

  const handleItemChange = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleRemoveItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const grandTotal = items.reduce((sum, it) => sum + computeItemTotal(it), 0);

  const updateOrCreateInventory = async (it, purchaseRef) => {
    const today = new Date().toISOString().split('T')[0];
    const batchEntry = {
      batch_number: it.batch_number,
      quantity: it.quantity,
      purchase_date: today,
      expiry_date: it.expiry_date,
      purchase_price: it.purchase_price,
      mrp: it.mrp,
      // Lets the inventory item's purchase history show which invoice/GRN
      // this batch came from, without a separate lookup into
      // goods_receipt_notes.
      vendor_invoice_number: purchaseRef?.invoiceNumber || '',
      vendor_name: purchaseRef?.vendorName || '',
      grn_number: purchaseRef?.grnNumber || '',
    };

    if (it.inventory_id) {
      const invItem = inventory.find(i => i.id === it.inventory_id);
      const currentStock = invItem?.stock_quantity || 0;
      const batches = [...(invItem?.batches || []), batchEntry];
      let totalValue = 0, totalQty = 0;
      batches.forEach(b => { totalValue += b.quantity * b.purchase_price; totalQty += b.quantity; });
      const weightedAvgPrice = totalQty > 0 ? totalValue / totalQty : it.purchase_price;

      await updateDoc(doc(db, 'inventory', it.inventory_id), {
        stock_quantity: currentStock + it.quantity,
        batches,
        purchase_price: Math.round(weightedAvgPrice),
        MRP: it.mrp,
        last_purchase_date: today,
        last_updated: new Date().toISOString(),
      });
    } else {
      await addDoc(collection(db, 'inventory'), {
        item_name: it.new_item_name.trim(),
        category: 'Uncategorized',
        stock_quantity: it.quantity,
        batches: [batchEntry],
        purchase_price: it.purchase_price,
        MRP: it.mrp,
        created_at: new Date().toISOString(),
        last_purchase_date: today,
        last_updated: new Date().toISOString(),
      });
    }
  };

  const handleImport = async () => {
    setError('');
    const activeItems = items.filter(it => it.quantity > 0);

    if (!invoiceNumber.trim()) { setError('Please enter the vendor invoice number.'); return; }
    if (!vendorName.trim()) { setError('Please enter the vendor name.'); return; }
    if (activeItems.length === 0) { setError('Add at least one item with quantity greater than 0.'); return; }
    if (activeItems.some(it => !it.batch_number)) { setError('Please enter a batch number for every item.'); return; }
    if (activeItems.some(it => !it.expiry_date)) { setError('Please enter an expiry date for every item.'); return; }
    if (activeItems.some(it => !it.inventory_id && !it.new_item_name.trim())) {
      setError('Please select a matching inventory item or enter a name for new items.');
      return;
    }

    setSaving(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      let resolvedVendorName = vendorName.trim();
      if (!vendorId) {
        await addDoc(collection(db, 'vendors'), {
          name: resolvedVendorName,
          gstin: vendorGstin.trim(),
          contact: '',
          created_at: new Date().toISOString(),
        });
      }

      const grnNumber = `GRN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const itemsReceived = activeItems.map(it => {
        const medicineName = it.inventory_id
          ? (inventory.find(i => i.id === it.inventory_id)?.item_name || it.description)
          : it.new_item_name.trim();
        const amount = computeItemAmount(it);
        const gstAmount = (amount * (it.gst_percent || 0)) / 100;
        return {
          medicine_name: medicineName,
          hsn_code: it.hsn_code || '',
          ordered_qty: it.quantity,
          received_qty: it.quantity,
          damaged_qty: 0,
          batch_number: it.batch_number,
          expiry_date: it.expiry_date,
          purchase_price: it.purchase_price,
          mrp: it.mrp,
          gst_percent: it.gst_percent || 0,
          gst_amount: gstAmount,
          discount_amount: it.discount_amount || 0,
          amount,
          total: amount + gstAmount,
          status: 'accepted',
        };
      });

      const totalAmount = itemsReceived.reduce((sum, it) => sum + it.total, 0);

      await addDoc(collection(db, 'goods_receipt_notes'), {
        grn_number: grnNumber,
        po_number: null,
        po_id: null,
        source: 'pdf_import',
        vendor_name: resolvedVendorName,
        vendor_invoice_number: invoiceNumber,
        vendor_invoice_date: invoiceDate,
        delivery_date: invoiceDate,
        received_date: new Date().toISOString().split('T')[0],
        delivery_status: 'on_time',
        delivery_notes: 'Imported from vendor PDF invoice',
        received_by: currentUser.email,
        items_received: itemsReceived,
        source_file_url: pdfUrl,
        created_at: new Date().toISOString(),
      });

      await addDoc(collection(db, 'purchase_entries'), {
        entry_id: `PE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        grn_number: grnNumber,
        po_number: null,
        vendor: resolvedVendorName,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        items: itemsReceived.map(it => ({
          medicine_name: it.medicine_name,
          hsn_code: it.hsn_code || '',
          quantity: it.received_qty,
          batch_number: it.batch_number,
          expiry_date: it.expiry_date,
          rate: it.purchase_price,
          amount: it.amount,
          tax_percent: it.gst_percent,
          tax_amount: it.gst_amount,
          net_payable: it.total,
          purchase_price: it.purchase_price,
          mrp: it.mrp,
          margin: it.purchase_price > 0 ? (((it.mrp - it.purchase_price) / it.purchase_price) * 100).toFixed(2) : '0',
        })),
        subtotal: itemsReceived.reduce((sum, it) => sum + it.amount, 0),
        total_tax: itemsReceived.reduce((sum, it) => sum + it.gst_amount, 0),
        net_payable: totalAmount,
        payment_status: 'pending',
        payment_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        entry_date: new Date().toISOString(),
        entered_by: currentUser.email,
      });

      await addDoc(collection(db, 'expenses'), {
        date: new Date().toISOString().split('T')[0],
        category: 'medicine_purchase',
        amount: totalAmount,
        description: `Purchase from ${resolvedVendorName} - ${grnNumber} (PDF import)\nInvoice: ${invoiceNumber}`,
        payment_mode: 'credit',
        vendor: resolvedVendorName,
        invoice: invoiceNumber,
        grn: grnNumber,
        created_at: new Date().toISOString(),
        created_by: currentUser.email,
      });

      for (const it of activeItems) {
        await updateOrCreateInventory(it, { invoiceNumber, vendorName: resolvedVendorName, grnNumber });
      }

      alert(`✅ Invoice imported successfully!\n\nGRN Number: ${grnNumber}\nVendor: ${resolvedVendorName}\nItems: ${activeItems.length}\nTotal: ₹${totalAmount.toLocaleString()}`);
      if (onSave) onSave();
    } catch (err) {
      console.error('Error importing invoice:', err);
      setError('Failed to import invoice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-purple-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Import Invoice (PDF)</h2>
              <p className="text-sm text-purple-100">Read a vendor invoice with AI and add it straight to inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-purple-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {step === 'upload' && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Upload a vendor invoice PDF. AI will read the vendor and line-item details for you to review before anything is saved.</p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer font-medium">
                <Upload className="w-5 h-5" />
                Choose PDF File
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
              </label>
            </div>
          )}

          {step === 'parsing' && (
            <div className="p-16 text-center">
              <Loader2 className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-700 font-medium">Reading {pdfName} with AI…</p>
              <p className="text-sm text-gray-500 mt-1">This can take a few seconds for longer invoices.</p>
            </div>
          )}

          {step === 'review' && (
            <>
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span>{pdfName}</span>
                {pdfUrl && <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">View original</a>}
              </div>

              {/* Vendor & Invoice Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-3">Vendor & Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                    <select
                      value={vendorId || '__new__'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__new__') { setVendorId(''); }
                        else {
                          const v = vendors.find(v => v.id === val);
                          setVendorId(val);
                          setVendorName(v?.name || '');
                          setVendorGstin(v?.gstin || vendorGstin);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                    >
                      <option value="__new__">+ New Vendor{!vendorId ? ' (no match found)' : ''}</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    {!vendorId && (
                      <input
                        type="text"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Vendor name"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">GSTIN</label>
                    <input
                      type="text"
                      value={vendorGstin}
                      onChange={(e) => setVendorGstin(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Vendor GSTIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number *</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="VENDOR-INV-12345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3">Line Items</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Matched Inventory Item</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">HSN Code</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch #</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Purchase Price</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">MRP</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">GST %</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((it, idx) => (
                        <tr key={it.key} className={!it.inventory_id ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-2 min-w-[200px]">
                            <p className="text-xs text-gray-400 mb-1 truncate" title={it.description}>{it.description}</p>
                            <select
                              value={it.inventory_id || '__new__'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__new__') {
                                  handleItemChange(idx, 'inventory_id', '');
                                  if (!it.new_item_name) handleItemChange(idx, 'new_item_name', it.description);
                                } else {
                                  handleItemChange(idx, 'inventory_id', val);
                                }
                              }}
                              className="w-full px-2 py-1 border rounded"
                            >
                              <option value="__new__">+ New Item{!it.inventory_id ? ' (no match)' : ''}</option>
                              {inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.item_name}</option>)}
                            </select>
                            {!it.inventory_id && (
                              <input
                                type="text"
                                value={it.new_item_name}
                                onChange={(e) => handleItemChange(idx, 'new_item_name', e.target.value)}
                                className="w-full mt-1 px-2 py-1 border rounded"
                                placeholder="New item name"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={it.hsn_code}
                              onChange={(e) => handleItemChange(idx, 'hsn_code', e.target.value)}
                              className="w-20 px-2 py-1 border rounded"
                              placeholder="HSN"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded text-right"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={it.batch_number}
                              onChange={(e) => handleItemChange(idx, 'batch_number', e.target.value)}
                              className="w-28 px-2 py-1 border rounded"
                              placeholder="BATCH-001"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={it.expiry_date}
                              onChange={(e) => handleItemChange(idx, 'expiry_date', e.target.value)}
                              className="w-36 px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={it.purchase_price}
                              onChange={(e) => handleItemChange(idx, 'purchase_price', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={it.mrp}
                              onChange={(e) => handleItemChange(idx, 'mrp', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={it.gst_percent}
                              onChange={(e) => handleItemChange(idx, 'gst_percent', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border rounded text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            ₹{computeItemTotal(it).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">No line items — AI could not find any on this invoice.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {items.some(it => !it.inventory_id) && (
                  <p className="text-xs text-amber-700 mt-2">Rows highlighted amber have no confident inventory match — verify the item name or pick the correct existing item.</p>
                )}
              </div>

              <div className="mb-6 p-4 bg-purple-50 rounded-lg flex items-center justify-between">
                <p className="text-sm text-gray-600">Grand Total ({items.filter(it => it.quantity > 0).length} items)</p>
                <p className="text-2xl font-bold text-purple-700">₹{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={saving}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {saving ? 'Importing…' : 'Confirm & Add to Inventory'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportInvoiceModal;
