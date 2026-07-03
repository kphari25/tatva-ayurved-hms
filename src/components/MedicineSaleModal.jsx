import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Trash2, ShoppingBag, Search } from 'lucide-react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Your Hospital Address, City, State - PIN',
  phone: '+91 XXXXXXXXXX',
  email: 'info@tatvaayurved.com',
  gstin: 'YOUR_GSTIN_HERE',
};

const emptyRow = () => ({ name: '', item_code: '', quantity: 1, rate: 0, id: Date.now() + Math.random() });

const MedicineSaleModal = ({ onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    mrd_number: '',
    phone: '',
    gst_percentage: 0,
    discount: 0,
    payment_mode: 'Cash',
    notes: '',
  });
  const [rows, setRows] = useState([emptyRow()]);
  // per-row autocomplete state
  const [suggestions, setSuggestions] = useState({});  // rowId -> []
  const [openDropdown, setOpenDropdown] = useState(null); // rowId
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadInventory();
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadInventory = async () => {
    try {
      const snap = await getDocs(collection(db, 'inventory'));
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error loading inventory:', e);
    }
  };

  const getSuggestions = (query) =>
    query.length < 2 ? [] :
    inventory.filter(m =>
      (m.item_name || '').toLowerCase().includes(query.toLowerCase()) ||
      (m.item_code || '').toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);

  const handleRowNameChange = (id, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, name: value, item_code: '', rate: 0 } : r));
    const sugg = getSuggestions(value);
    setSuggestions(prev => ({ ...prev, [id]: sugg }));
    setOpenDropdown(id);
  };

  const handleSelectSuggestion = (rowId, med) => {
    setRows(prev => prev.map(r =>
      r.id === rowId
        ? { ...r, name: med.item_name || med.item_code, item_code: med.item_code || '', rate: parseFloat(med.mrp) || 0 }
        : r
    ));
    setSuggestions(prev => ({ ...prev, [rowId]: [] }));
    setOpenDropdown(null);
    // auto-add new row if this is the last row
    setRows(prev => {
      if (prev[prev.length - 1].id === rowId) return [...prev, emptyRow()];
      return prev;
    });
  };

  const handleRowChange = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    // auto-add row when quantity or rate is filled on last row and name exists
    if (field === 'rate' || field === 'quantity') {
      setRows(prev => {
        const last = prev[prev.length - 1];
        if (last.id === id && last.name && parseFloat(last.rate) > 0 && parseFloat(last.quantity) > 0) {
          // only add if last row is complete and it was the trigger
          if (prev.every(r => r.id !== 'NEW_PENDING')) return [...prev, emptyRow()];
        }
        return prev;
      });
    }
  };

  const handleRemoveRow = (id) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  const calcLineTotal = (r) => (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0);

  const calcSubtotal = () => rows.reduce((s, r) => s + calcLineTotal(r), 0);
  const calcGST = () => (calcSubtotal() * (parseFloat(formData.gst_percentage) || 0)) / 100;
  const calcTotal = () => calcSubtotal() + calcGST() - (parseFloat(formData.discount) || 0);

  const validRows = () => rows.filter(r => r.name && parseFloat(r.rate) > 0 && parseFloat(r.quantity) > 0);

  const buildPrintHTML = (saleData) => {
    const rowsHTML = saleData.items.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.item_code ? `<strong>${r.item_code}</strong><br><small>${r.name}</small>` : r.name}</td>
        <td style="text-align:center">${r.quantity}</td>
        <td style="text-align:right">₹${parseFloat(r.rate).toFixed(2)}</td>
        <td style="text-align:right">₹${(r.quantity * r.rate).toFixed(2)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <title>Medicine Sale - ${saleData.bill_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #1a1a1a; }
    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 14px; margin-bottom: 18px; }
    .header h1 { color: #0d9488; font-size: 26px; margin: 8px 0 4px; }
    .header .tagline { color: #666; font-size: 12px; }
    .header .contact { color: #444; font-size: 11px; margin-top: 6px; }
    .badge { display: inline-block; background: #0d9488; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 14px; }
    .info { display: flex; justify-content: space-between; margin-bottom: 18px; }
    .info-block { font-size: 13px; line-height: 1.8; }
    .info-block strong { color: #0d9488; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { background: #0d9488; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { border: 1px solid #ddd; padding: 7px 10px; font-size: 12px; }
    tr:nth-child(even) td { background: #f0fdfa; }
    .totals { float: right; width: 280px; }
    .totals table { margin: 0; }
    .totals td { border: none; border-bottom: 1px solid #eee; padding: 5px 8px; }
    .totals .grand { background: #0d9488; color: #fff; font-size: 15px; font-weight: bold; }
    .footer { clear: both; text-align: center; margin-top: 40px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'" style="height:70px;margin-bottom:6px">
    <h1>${HOSPITAL.name}</h1>
    <div class="tagline">${HOSPITAL.tagline}</div>
    <div class="contact">${HOSPITAL.address} | ${HOSPITAL.phone} | ${HOSPITAL.email}</div>
    ${HOSPITAL.gstin !== 'YOUR_GSTIN_HERE' ? `<div class="contact">GSTIN: ${HOSPITAL.gstin}</div>` : ''}
  </div>

  <div style="text-align:center;margin-bottom:14px">
    <span class="badge">MEDICINE SALE BILL</span>
  </div>

  <div class="info">
    <div class="info-block">
      <div><strong>Customer:</strong> ${saleData.customer_name || 'Walk-in Customer'}</div>
      ${saleData.mrd_number ? `<div><strong>MRD No:</strong> ${saleData.mrd_number}</div>` : ''}
      ${saleData.phone ? `<div><strong>Phone:</strong> ${saleData.phone}</div>` : ''}
    </div>
    <div class="info-block" style="text-align:right">
      <div><strong>Bill No:</strong> ${saleData.bill_number}</div>
      <div><strong>Date:</strong> ${new Date(saleData.sale_date).toLocaleDateString('en-IN')}</div>
      <div><strong>Payment:</strong> ${saleData.payment_mode}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Medicine</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate (₹)</th>
        <th style="text-align:right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">₹${saleData.subtotal.toFixed(2)}</td></tr>
      ${saleData.gst_percentage > 0 ? `<tr><td>GST (${saleData.gst_percentage}%)</td><td style="text-align:right">₹${saleData.gst_amount.toFixed(2)}</td></tr>` : ''}
      ${saleData.discount > 0 ? `<tr><td style="color:red">Discount</td><td style="text-align:right;color:red">-₹${saleData.discount.toFixed(2)}</td></tr>` : ''}
      <tr class="grand"><td>TOTAL</td><td style="text-align:right">₹${saleData.total_amount.toFixed(2)}</td></tr>
    </table>
  </div>

  <div style="clear:both"></div>
  ${saleData.notes ? `<div style="margin-top:16px"><strong>Notes:</strong> ${saleData.notes}</div>` : ''}

  <div class="footer">
    <p>Thank you for choosing ${HOSPITAL.name}!</p>
    <p>This is a computer-generated bill — no signature required.</p>
  </div>

  <div style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 30px;background:#0d9488;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer">
      🖨️ Print Bill
    </button>
  </div>
</body>
</html>`;
  };

  const handlePrint = (saleData = null) => {
    const data = saleData || {
      bill_number: 'PREVIEW',
      customer_name: formData.customer_name,
      mrd_number: formData.mrd_number,
      phone: formData.phone,
      sale_date: formData.sale_date,
      payment_mode: formData.payment_mode,
      items: validRows(),
      subtotal: calcSubtotal(),
      gst_percentage: parseFloat(formData.gst_percentage) || 0,
      gst_amount: calcGST(),
      discount: parseFloat(formData.discount) || 0,
      total_amount: calcTotal(),
      notes: formData.notes,
    };
    const w = window.open('', '_blank');
    w.document.write(buildPrintHTML(data));
    w.document.close();
  };

  const handleSave = async () => {
    const items = validRows();
    if (items.length === 0) {
      alert('Please add at least one medicine.');
      return;
    }
    try {
      setSaving(true);
      // generate bill number
      const snap = await getDocs(collection(db, 'medicine_sales'));
      const billNumber = `MED-${new Date().getFullYear()}-${String(snap.size + 1).padStart(4, '0')}`;

      const saleData = {
        bill_number: billNumber,
        customer_name: formData.customer_name || 'Walk-in Customer',
        mrd_number: formData.mrd_number || '',
        phone: formData.phone || '',
        sale_date: formData.sale_date,
        payment_mode: formData.payment_mode,
        items,
        subtotal: calcSubtotal(),
        gst_percentage: parseFloat(formData.gst_percentage) || 0,
        gst_amount: calcGST(),
        discount: parseFloat(formData.discount) || 0,
        total_amount: calcTotal(),
        notes: formData.notes,
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email || '',
      };

      await addDoc(collection(db, 'medicine_sales'), saleData);
      if (onSave) onSave(saleData);
      handlePrint(saleData);
      onClose();
    } catch (e) {
      console.error('Error saving medicine sale:', e);
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6" />
            <div>
              <h2 className="text-2xl font-bold">Medicine Sale</h2>
              <p className="text-teal-100 text-sm">Direct medicine billing</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Customer Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Customer Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Walk-in / Patient name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MRD Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={formData.mrd_number}
                  onChange={e => setFormData({ ...formData, mrd_number: e.target.value })}
                  placeholder="MRD-XXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={e => setFormData({ ...formData, sale_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={formData.payment_mode}
                  onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option>Cash</option>
                  <option>Card</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
            </div>
          </div>

          {/* Medicine Rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800">Medicines</h3>
              <span className="text-xs text-gray-400">Complete a row to auto-add the next one</span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-teal-600 text-white text-xs font-semibold rounded-t-lg">
              <div className="col-span-5">Medicine</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate (₹)</div>
              <div className="col-span-2 text-right">Amount (₹)</div>
              <div className="col-span-1"></div>
            </div>

            <div ref={dropdownRef} className="border border-gray-200 rounded-b-lg divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-gray-50 relative">
                  {/* Medicine autocomplete */}
                  <div className="col-span-5 relative">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                      <Search className="w-3.5 h-3.5 text-gray-400 ml-2 shrink-0" />
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => handleRowNameChange(row.id, e.target.value)}
                        onFocus={() => {
                          if (row.name.length >= 2) {
                            setSuggestions(p => ({ ...p, [row.id]: getSuggestions(row.name) }));
                            setOpenDropdown(row.id);
                          }
                        }}
                        placeholder={idx === 0 ? "Type medicine name..." : "Add another medicine..."}
                        className="w-full px-2 py-1.5 text-sm outline-none bg-transparent"
                      />
                    </div>
                    {row.item_code && (
                      <div className="text-xs text-teal-600 mt-0.5 pl-1">{row.item_code}</div>
                    )}
                    {openDropdown === row.id && suggestions[row.id]?.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {suggestions[row.id].map(med => (
                          <div
                            key={med.id}
                            onMouseDown={() => handleSelectSuggestion(row.id, med)}
                            className="px-3 py-2 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0"
                          >
                            <div className="font-medium text-sm text-gray-900">{med.item_code}</div>
                            <div className="text-xs text-gray-500">{med.item_name}</div>
                            <div className="text-xs text-teal-600">Stock: {med.stock_quantity} · MRP: ₹{med.mrp}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={e => handleRowChange(row.id, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  {/* Rate */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      value={row.rate}
                      onChange={e => handleRowChange(row.id, 'rate', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  {/* Line total */}
                  <div className="col-span-2 text-right text-sm font-semibold text-gray-800 pr-1">
                    ₹{calcLineTotal(row).toFixed(2)}
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-center">
                    {rows.length > 1 && (
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GST / Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
              <input
                type="number"
                min="0"
                value={formData.gst_percentage}
                onChange={e => setFormData({ ...formData, gst_percentage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.discount}
                onChange={e => setFormData({ ...formData, discount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* Totals */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-5 rounded-xl">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₹{calcSubtotal().toFixed(2)}</span>
              </div>
              {parseFloat(formData.gst_percentage) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>GST ({formData.gst_percentage}%):</span>
                  <span>₹{calcGST().toFixed(2)}</span>
                </div>
              )}
              {parseFloat(formData.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>-₹{parseFloat(formData.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-bold pt-2 border-t border-teal-500">
                <span>TOTAL:</span>
                <span>₹{calcTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => handlePrint()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
            >
              <Printer className="w-4 h-4" />
              Preview & Print
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4" />Save & Print</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineSaleModal;
