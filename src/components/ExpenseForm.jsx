import React, { useState } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  EXPENSE_CATEGORIES, PAYMENT_MODES, getCurrentUser,
  diffExpense, expenseSnapshot, scanExpenseDocument, localDateString,
} from '../lib/expenses';

const today = () => localDateString();
const emptyForm = () => ({
  date: today(),
  category: 'other',
  amount: '',
  description: '',
  payment_mode: 'cash',
  vendor: '',
  invoice: '',
});

// Add / edit form for one expense. `expense` present = edit mode (admin only —
// the Expenses page decides who can reach it). Every save also writes an entry
// to expense_audit_log in the same batch, so the log can never miss a change.
const ExpenseForm = ({ expense, onSaved, onCancel }) => {
  const isEdit = Boolean(expense);
  const [formData, setFormData] = useState(() => (isEdit
    ? {
        date: expense.date ? String(expense.date).split('T')[0] : today(),
        category: expense.category || 'other',
        amount: expense.amount ?? '',
        description: expense.description || '',
        payment_mode: expense.payment_mode || 'cash',
        vendor: expense.vendor || '',
        invoice: expense.invoice || '',
      }
    : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanned, setScanned] = useState(null); // AI result for this entry
  const [scannedImage, setScannedImage] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  const set = (field, value) => {
    setJustSaved(false);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFile = async (event) => {
    const file = event.target.files[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setScanError('Please upload an image (JPG, PNG, WEBP) or a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanError('File size must be less than 10MB.');
      return;
    }

    setScanError('');
    setJustSaved(false);
    setScanning(true);
    const result = await scanExpenseDocument(file);
    setScanning(false);

    if (!result.success) {
      setScanError(`Could not read this bill automatically (${result.error}). You can still fill the details in manually.`);
      return;
    }

    const d = result.data;
    setScanned(d);
    setScannedImage(result.previewImage);
    const lines = (d.items || []).map(it => `• ${it.description}: ₹${it.amount}`).join('\n');
    setFormData(prev => ({
      ...prev,
      date: /^\d{4}-\d{2}-\d{2}$/.test(d.bill_date || '') ? d.bill_date : prev.date,
      amount: d.total_amount > 0 ? d.total_amount : prev.amount,
      category: EXPENSE_CATEGORIES.some(c => c.value === d.category) ? d.category : prev.category,
      payment_mode: PAYMENT_MODES.some(p => p.value === d.payment_mode) ? d.payment_mode : prev.payment_mode,
      vendor: d.vendor_name || prev.vendor,
      invoice: d.invoice_number || prev.invoice,
      description: [d.summary, lines].filter(Boolean).join('\n'),
    }));
  };

  const handleSave = async () => {
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!formData.date) {
      alert('Please choose a date');
      return;
    }

    const user = getCurrentUser();
    const now = new Date().toISOString();
    const fields = {
      date: formData.date,
      category: formData.category,
      amount,
      description: formData.description.trim(),
      payment_mode: formData.payment_mode,
      vendor: formData.vendor.trim(),
      invoice: formData.invoice.trim(),
    };

    try {
      setSaving(true);
      const batch = writeBatch(db);
      const logRef = doc(collection(db, 'expense_audit_log'));
      const actor = { by_email: user.email || '', by_name: user.name || '', by_role: user.role || '', at: now };

      if (isEdit) {
        const changes = diffExpense(expense, fields);
        if (changes.length === 0) {
          onSaved?.(expense, false);
          return;
        }
        const update = { ...fields, updated_at: now, updated_by: user.email || '', updated_by_name: user.name || '' };
        batch.update(doc(db, 'expenses', expense.id), update);
        batch.set(logRef, { action: 'edited', expense_id: expense.id, ...actor, changes, snapshot: expenseSnapshot(fields) });
        await batch.commit();
        onSaved?.({ ...expense, ...update }, true);
      } else {
        const expenseRef = doc(collection(db, 'expenses'));
        const data = {
          ...fields,
          created_at: now,
          created_by: user.email || '',
          created_by_name: user.name || '',
        };
        if (scannedImage) data.invoice_image = scannedImage;
        if (scanned) data.extracted_data = scanned;
        batch.set(expenseRef, data);
        batch.set(logRef, { action: 'created', expense_id: expenseRef.id, ...actor, snapshot: expenseSnapshot(fields) });
        await batch.commit();
        setFormData(emptyForm());
        setScanned(null);
        setScannedImage(null);
        setScanError('');
        setJustSaved(true);
        onSaved?.({ id: expenseRef.id, ...data }, true);
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg';

  return (
    <div>
      {/* Invoice scanning — new expenses only */}
      {!isEdit && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800">Scan Invoice / Receipt</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Document</label>
              <input type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" id="expense-file-upload" />
              <button
                type="button"
                onClick={() => document.getElementById('expense-file-upload').click()}
                disabled={scanning}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                {scanning ? 'Reading bill...' : 'Upload Invoice/Receipt'}
              </button>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, PDF (max 10MB)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Take Photo</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" id="expense-camera-input" />
              <button
                type="button"
                onClick={() => document.getElementById('expense-camera-input').click()}
                disabled={scanning}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Use Camera
              </button>
              <p className="text-xs text-gray-500 mt-1">Scan with phone camera</p>
            </div>
          </div>

          {scanning && (
            <div className="mt-3 p-3 bg-blue-100 rounded-lg flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-800 font-medium">Reading the bill and extracting details...</span>
            </div>
          )}

          {scanError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{scanError}</span>
            </div>
          )}

          {scanned && (
            <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Bill read — details filled in below</span>
              </div>
              <p className="text-xs text-green-700 mb-2">Read by AI — please check the date, amount and category before saving.</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Vendor:</span><span className="ml-2 font-semibold">{scanned.vendor_name || '—'}</span></div>
                <div><span className="text-gray-600">Invoice #:</span><span className="ml-2 font-semibold">{scanned.invoice_number || '—'}</span></div>
                <div><span className="text-gray-600">Date:</span><span className="ml-2 font-semibold">{scanned.bill_date || 'not found'}</span></div>
                <div><span className="text-gray-600">Total:</span><span className="ml-2 font-semibold text-green-700">{scanned.total_amount > 0 ? `₹${Number(scanned.total_amount).toLocaleString('en-IN')}` : 'not found'}</span></div>
              </div>
            </div>
          )}

          {scannedImage && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Scanned Image</label>
              <img src={scannedImage} alt="Scanned invoice" className="max-h-48 rounded-lg border border-gray-300 object-contain" />
            </div>
          )}
        </div>
      )}

      {isEdit && expense.invoice_image && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Attached bill image</label>
          <img src={expense.invoice_image} alt="Attached bill" className="max-h-48 rounded-lg border border-gray-300 object-contain" />
        </div>
      )}

      {justSaved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Expense added successfully. You can add another below.
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-bold text-gray-800 border-b pb-2">Expense Details</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input type="date" value={formData.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select value={formData.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
            {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {formData.category === 'medicine_purchase' && (
            <p className="text-xs text-amber-700 mt-1">
              Medicine purchases are counted in the P&amp;L automatically from Inventory / Goods Receipt, so an expense saved with this category is not added to the P&amp;L again.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) => set('amount', e.target.value)}
            className={inputCls}
            placeholder="0.00"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vendor / Shop <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={formData.vendor} onChange={(e) => set('vendor', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice / Bill No. <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={formData.invoice} onChange={(e) => set('invoice', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => set('description', e.target.value)}
            rows="3"
            className={inputCls}
            placeholder="Optional notes..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
          <select value={formData.payment_mode} onChange={(e) => set('payment_mode', e.target.value)} className={inputCls}>
            {PAYMENT_MODES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || scanning}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseForm;
