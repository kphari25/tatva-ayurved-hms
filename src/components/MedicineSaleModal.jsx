import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Trash2, ShoppingBag, Search, User, AlertTriangle } from 'lucide-react';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, increment, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { basePriceFromMRP, gstPercentForItem, buildMedicineSalePrintHTML } from '../lib/medicineSalePrint';

const emptyRow = () => ({ name: '', item_code: '', quantity: 1, rate: 0, gst_percentage: 0, stock: null, inventory_id: '', id: Date.now() + Math.random() });

// initialCustomer: optional { customer_name, mrd_number, phone, patientId, assignedDoctor } —
// pre-fills the bill for a patient handed off from elsewhere (e.g. discharge advice).
// initialMedicineNames: optional string[] of raw advice-line text to pre-populate as rows,
// matched against inventory by name once it loads (each line may carry trailing dose/
// instructions text, so matching is a prefix check rather than an exact one).
const MedicineSaleModal = ({ onClose, onSave, initialCustomer, initialMedicineNames }) => {
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [patients, setPatients] = useState([]);
  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    customer_name: initialCustomer?.customer_name || '',
    mrd_number: initialCustomer?.mrd_number || '',
    phone: initialCustomer?.phone || '',
    discount: 0,
    payment_mode: 'Cash',
    notes: '',
  });
  const [rows, setRows] = useState([emptyRow()]);
  const initialMedicinesAppliedRef = useRef(false);

  // Patient search
  const [patientQuery, setPatientQuery] = useState(initialCustomer?.customer_name || '');
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const patientRef = useRef(null);

  // Medicine autocomplete
  const [suggestions, setSuggestions] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const medRef = useRef(null);

  // Prescription sync
  const [selectedPatientId, setSelectedPatientId] = useState(initialCustomer?.patientId || null);
  const [prescriptionSynced, setPrescriptionSynced] = useState(null); // null | number of items found

  // Doctor signature block — only populated when a registered patient (with
  // an assigned doctor) is selected; stays blank for a true walk-in sale.
  const [doctorInfo, setDoctorInfo] = useState({ name: '', qualification: '', registrationNumber: '' });

  useEffect(() => {
    loadInventory();
    loadPatients();
    if (initialCustomer?.assignedDoctor) loadDoctorInfo(initialCustomer.assignedDoctor);

    const handler = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) setShowPatientDrop(false);
      if (medRef.current && !medRef.current.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-populate rows from advice-line text handed off from elsewhere (e.g.
  // discharge advice) once inventory has loaded — only runs once, so it
  // never clobbers rows the user has already started editing.
  useEffect(() => {
    if (initialMedicinesAppliedRef.current) return;
    if (!initialMedicineNames?.length || inventory.length === 0) return;
    initialMedicinesAppliedRef.current = true;
    const newRows = initialMedicineNames.map(rawName => {
      const lower = rawName.toLowerCase();
      const candidates = inventory.filter(inv => inv.item_name && lower.startsWith(inv.item_name.toLowerCase()));
      const matched = candidates.sort((a, b) => (b.item_name.length - a.item_name.length))[0];
      return {
        name: matched ? matched.item_name : rawName,
        item_code: matched?.item_code || '',
        quantity: 1,
        rate: matched ? basePriceFromMRP(matched) : 0,
        gst_percentage: matched ? gstPercentForItem(matched) : 0,
        stock: matched ? (parseFloat(matched.stock_quantity) ?? null) : null,
        inventory_id: matched?.id || '',
        id: Date.now() + Math.random(),
      };
    });
    setRows([...newRows, emptyRow()]);
  }, [inventory, initialMedicineNames]);

  const loadInventory = async () => {
    try {
      const snap = await getDocs(collection(db, 'inventory'));
      // Spread first, id last: some inventory docs carry their own legacy
      // numeric `id` field, which would otherwise clobber the real doc id.
      setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (e) {
      console.error('Error loading inventory:', e);
    }
  };

  const loadPatients = async () => {
    try {
      const snap = await getDocs(collection(db, 'patients'));
      setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error loading patients:', e);
    }
  };

  // ── Patient search ──────────────────────────────────────────
  const handlePatientQuery = (val) => {
    setPatientQuery(val);
    if (val.trim().length < 2) { setPatientSuggestions([]); setShowPatientDrop(false); return; }
    const q = val.toLowerCase();
    const found = patients.filter(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (p.mrd_number || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q)
      );
    }).slice(0, 8);
    setPatientSuggestions(found);
    setShowPatientDrop(true);
  };

  const selectPatient = (p) => {
    setFormData(f => ({
      ...f,
      customer_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      mrd_number: p.mrd_number || p.patient_number || '',
      phone: p.phone || '',
    }));
    setPatientQuery(`${p.first_name || ''} ${p.last_name || ''}`.trim());
    setPatientSuggestions([]);
    setShowPatientDrop(false);

    const patientId = p.firebaseId || p.id;
    setSelectedPatientId(patientId);
    // Only auto-fill if the bill is still blank — never clobber medicines already typed in.
    if (rows.length === 1 && !rows[0].name) {
      syncFromPrescription(patientId);
    } else {
      setPrescriptionSynced(null);
    }

    loadDoctorInfo(p.assigned_doctor);
  };

  const loadDoctorInfo = async (assignedDoctorName) => {
    if (!assignedDoctorName) { setDoctorInfo({ name: '', qualification: '', registrationNumber: '' }); return; }
    try {
      const snap = await getDocs(query(collection(db, 'hr_employees'), where('name', '==', assignedDoctorName)));
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setDoctorInfo({
          name: assignedDoctorName.replace(/^Dr\.?\s*/i, ''),
          qualification: d.qualification || '',
          registrationNumber: d.isDoctor ? (d.registrationNumber || '') : '',
        });
      } else {
        setDoctorInfo({ name: assignedDoctorName.replace(/^Dr\.?\s*/i, ''), qualification: '', registrationNumber: '' });
      }
    } catch (e) {
      console.error('Error loading doctor info:', e);
    }
  };

  // ── Prescription sync ────────────────────────────────────────
  // Pulls every medicine picked from inventory across the OP/IP case sheets,
  // OP visit log, and IP daily progress so the bill doesn't need retyping.
  const loadPrescriptionMedicines = async (patientId) => {
    if (!patientId) return [];
    try {
      const items = [];

      const opCaseSnap = await getDoc(doc(db, 'op_case_sheets', patientId));
      if (opCaseSnap.exists()) (opCaseSnap.data().medicine_items || []).forEach(m => items.push(m));

      const opVisitsSnap = await getDocs(query(collection(db, 'op_visit_notes'), where('patient_id', '==', patientId)));
      opVisitsSnap.docs.forEach(d => (d.data().medicine_items || []).forEach(m => items.push(m)));

      const ipCaseSnap = await getDoc(doc(db, 'ip_case_sheets', patientId));
      if (ipCaseSnap.exists()) (ipCaseSnap.data().medicine_items || []).forEach(m => items.push(m));

      const dailySnap = await getDocs(query(collection(db, 'daily_progress'), where('patient_id', '==', patientId)));
      dailySnap.docs.forEach(d => (d.data().medicine_items || []).forEach(m => items.push(m)));

      return items;
    } catch (e) {
      console.error('Error loading prescription medicines:', e);
      return [];
    }
  };

  const syncFromPrescription = async (patientId) => {
    const prescribed = await loadPrescriptionMedicines(patientId || selectedPatientId);
    setPrescriptionSynced(prescribed.length);
    if (prescribed.length === 0) return;

    const newRows = prescribed.map(m => {
      const matched = inventory.find(inv => m.item_code && inv.item_code === m.item_code)
        || inventory.find(inv => inv.item_name === m.item_name);
      return {
        name: m.item_name,
        item_code: m.item_code || '',
        quantity: 1,
        rate: matched ? basePriceFromMRP(matched) : 0,
        gst_percentage: matched ? gstPercentForItem(matched) : 0,
        stock: matched ? (parseFloat(matched.stock_quantity) ?? null) : null,
        inventory_id: matched?.id || '',
        id: Date.now() + Math.random(),
      };
    });
    setRows([...newRows, emptyRow()]);
  };

  // ── Medicine autocomplete ───────────────────────────────────
  const getMedSuggestions = (q) =>
    q.length < 2 ? [] :
    inventory.filter(m =>
      (m.item_name || '').toLowerCase().includes(q.toLowerCase()) ||
      String(m.item_code || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8);

  const handleRowNameChange = (id, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, name: value, item_code: '', rate: 0, gst_percentage: 0, stock: null, inventory_id: '' } : r));
    setSuggestions(prev => ({ ...prev, [id]: getMedSuggestions(value) }));
    setOpenDropdown(id);
  };

  const handleSelectMedicine = (rowId, med) => {
    setRows(prev => {
      const updated = prev.map(r =>
        r.id === rowId
          ? {
              ...r,
              name: med.item_name || med.item_code,
              item_code: med.item_code || '',
              rate: basePriceFromMRP(med),
              gst_percentage: gstPercentForItem(med),
              stock: parseFloat(med.stock_quantity) ?? null,
              inventory_id: med.id || '',
            }
          : r
      );
      // auto-add new row if this was the last one
      if (updated[updated.length - 1].id === rowId) return [...updated, emptyRow()];
      return updated;
    });
    setSuggestions(prev => ({ ...prev, [rowId]: [] }));
    setOpenDropdown(null);
  };

  const handleRowChange = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRemoveRow = (id) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  // ── Calculations ────────────────────────────────────────────
  // Each row's `rate` is the item's GST-exclusive base price, backed out of
  // its MRP (see basePriceFromMRP) — not a flat bill-wide markup, since
  // different medicines can carry different GST rates (Standard/Traditional/
  // Cosmetics GST Categories). GST is added back on top per line so the
  // receipt's line "Amount" is the taxable value and the bill's CGST/SGST
  // total up correctly even when lines mix rates.
  const calcLineTaxable = (r) => (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0);
  const calcLineTax = (r) => calcLineTaxable(r) * (parseFloat(r.gst_percentage) || 0) / 100;
  const calcLine = (r) => calcLineTaxable(r) + calcLineTax(r); // tax-inclusive (= qty × MRP)
  const calcSubtotal = () => rows.reduce((s, r) => s + calcLine(r), 0); // tax-inclusive
  const calcTaxableAmount = () => rows.reduce((s, r) => s + calcLineTaxable(r), 0);
  const calcTotalTax = () => rows.reduce((s, r) => s + calcLineTax(r), 0);
  const calcCGST = () => calcTotalTax() / 2;
  const calcSGST = () => calcTotalTax() / 2;
  const calcTotal = () => calcSubtotal() - (parseFloat(formData.discount) || 0);
  const validRows = () => rows.filter(r => r.name && parseFloat(r.rate) > 0 && parseFloat(r.quantity) > 0);

  // ── Print ───────────────────────────────────────────────────
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
      taxable_amount: calcTaxableAmount(),
      cgst_amount: calcCGST(),
      sgst_amount: calcSGST(),
      gst_amount: calcTotalTax(),
      discount: parseFloat(formData.discount) || 0,
      total_amount: calcTotal(),
      notes: formData.notes,
    };
    const w = window.open('', '_blank');
    w.document.write(buildMedicineSalePrintHTML(data, doctorInfo));
    w.document.close();
  };

  const handleSave = async () => {
    const items = validRows();
    if (items.length === 0) { alert('Please add at least one medicine.'); return; }
    try {
      setSaving(true);
      const snap = await getDocs(collection(db, 'medicine_sales'));
      const billNumber = `MED-${new Date().getFullYear()}-${String(snap.size + 1).padStart(4, '0')}`;
      const saleData = {
        bill_number: billNumber,
        // Durable link back to the patient (and therefore their
        // prescription/case sheet) — lets sales be traced by patient id
        // rather than just the customer_name text on the bill.
        patient_id: selectedPatientId || null,
        customer_name: formData.customer_name || 'Walk-in Customer',
        mrd_number: formData.mrd_number || '',
        phone: formData.phone || '',
        sale_date: formData.sale_date,
        payment_mode: formData.payment_mode,
        items,
        subtotal: calcSubtotal(),
        taxable_amount: calcTaxableAmount(),
        cgst_amount: calcCGST(),
        sgst_amount: calcSGST(),
        gst_amount: calcTotalTax(),
        discount: parseFloat(formData.discount) || 0,
        total_amount: calcTotal(),
        notes: formData.notes,
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email || '',
      };
      await addDoc(collection(db, 'medicine_sales'), saleData);

      // Deduct sold quantity from stock — this previously never happened,
      // so stock_quantity only ever went up (via purchases) and never down.
      // increment() is an atomic server-side op, so concurrent sales/receipts
      // can't race each other into a wrong count.
      for (const item of items) {
        if (item.inventory_id && parseFloat(item.quantity) > 0) {
          try {
            await updateDoc(doc(db, 'inventory', item.inventory_id), {
              stock_quantity: increment(-parseFloat(item.quantity)),
              last_updated: new Date().toISOString(),
            });
          } catch (stockErr) {
            console.error(`Failed to deduct stock for ${item.name}:`, stockErr);
          }
        }
      }

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

  // ── Stock badge helper ──────────────────────────────────────
  const StockBadge = ({ stock, qty }) => {
    if (stock === null || stock === undefined) return null;
    const remaining = stock - (parseFloat(qty) || 0);
    if (stock === 0) return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
        <AlertTriangle className="w-3 h-3" /> Out of stock
      </span>
    );
    if (remaining < 0) return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
        <AlertTriangle className="w-3 h-3" /> Only {stock} available
      </span>
    );
    if (stock <= 10) return (
      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
        ⚠ Low stock: {stock} left
      </span>
    );
    return (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
        ✓ In stock: {stock}
      </span>
    );
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
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

          {/* ── Patient Search ── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Customer / Patient</h3>

            {/* Search box */}
            <div ref={patientRef} className="relative mb-4">
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-teal-500 bg-white">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={patientQuery}
                  onChange={e => handlePatientQuery(e.target.value)}
                  onFocus={() => patientQuery.length >= 2 && setShowPatientDrop(true)}
                  placeholder="Search by name, MRD number, or phone…"
                  className="flex-1 text-sm outline-none bg-transparent"
                />
                {patientQuery && (
                  <button onClick={() => { setPatientQuery(''); setPatientSuggestions([]); setShowPatientDrop(false); setFormData(f => ({ ...f, customer_name: '', mrd_number: '', phone: '' })); }}>
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>

              {showPatientDrop && patientSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {patientSuggestions.map(p => (
                    <div
                      key={p.id}
                      onMouseDown={() => selectPatient(p)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-gray-500 flex gap-3">
                          {p.mrd_number && <span>MRD: {p.mrd_number}</span>}
                          {p.phone && <span>📞 {p.phone}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showPatientDrop && patientQuery.length >= 2 && patientSuggestions.length === 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-500">
                  No patients found — you can still fill in details below for a walk-in customer.
                </div>
              )}
            </div>

            {selectedPatientId && (
              <div className="flex items-center justify-between mb-4 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                <span className="text-xs text-teal-800">
                  {prescriptionSynced === null
                    ? 'Sync the bill items from this patient\'s prescription (OP/IP Medication Details).'
                    : prescriptionSynced === 0
                      ? 'No medicines found in this patient\'s prescription yet.'
                      : `${prescriptionSynced} medicine${prescriptionSynced === 1 ? '' : 's'} loaded from prescription.`}
                </span>
                <button
                  type="button"
                  onClick={() => syncFromPrescription(selectedPatientId)}
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-100 px-2 py-1 rounded"
                >
                  Sync from Prescription
                </button>
              </div>
            )}

            {/* Manual / auto-filled fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={e => setFormData(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Walk-in / Patient name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">MRD Number</label>
                <input
                  type="text"
                  value={formData.mrd_number}
                  onChange={e => setFormData(f => ({ ...f, mrd_number: e.target.value }))}
                  placeholder="MRD-XXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sale Date</label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={e => setFormData(f => ({ ...f, sale_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                <select
                  value={formData.payment_mode}
                  onChange={e => setFormData(f => ({ ...f, payment_mode: e.target.value }))}
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

          {/* ── Medicine Rows ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800">Medicines</h3>
              <span className="text-xs text-gray-400">Select a medicine to auto-add the next row</span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-teal-600 text-white text-xs font-semibold rounded-t-lg">
              <div className="col-span-5">Medicine</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Price (₹)</div>
              <div className="col-span-2 text-right">Amount (₹)</div>
              <div className="col-span-1"></div>
            </div>

            <div ref={medRef} className="border border-gray-200 rounded-b-lg divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <div key={row.id} className="px-3 py-2 hover:bg-gray-50">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Medicine search */}
                    <div className="col-span-5 relative">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                        <Search className="w-3.5 h-3.5 text-gray-400 ml-2 shrink-0" />
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => handleRowNameChange(row.id, e.target.value)}
                          onFocus={() => {
                            if (row.name.length >= 2) {
                              setSuggestions(p => ({ ...p, [row.id]: getMedSuggestions(row.name) }));
                              setOpenDropdown(row.id);
                            }
                          }}
                          placeholder={idx === 0 ? 'Type medicine name…' : 'Add another…'}
                          className="w-full px-2 py-1.5 text-sm outline-none bg-transparent"
                        />
                      </div>
                      {/* Dropdown */}
                      {openDropdown === row.id && suggestions[row.id]?.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                          {suggestions[row.id].map(med => {
                            const stock = parseFloat(med.stock_quantity) || 0;
                            return (
                              <div
                                key={med.id}
                                onMouseDown={() => handleSelectMedicine(row.id, med)}
                                className="px-3 py-2 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm text-gray-900">{med.item_code}</div>
                                    <div className="text-xs text-gray-500">{med.item_name}</div>
                                    <div className="text-xs text-teal-600 mt-0.5">Price: ₹{basePriceFromMRP(med).toFixed(2)} <span className="text-gray-400">(MRP ₹{(parseFloat(med.MRP ?? med.mrp) || 0).toFixed(2)}, + {gstPercentForItem(med)}% GST)</span></div>
                                  </div>
                                  <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    stock === 0 ? 'bg-red-100 text-red-700' :
                                    stock <= 10 ? 'bg-orange-100 text-orange-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {stock === 0 ? 'Out of stock' : `Stock: ${stock}`}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="col-span-2">
                      <input
                        type="number" min="1"
                        value={row.quantity}
                        onChange={e => handleRowChange(row.id, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>

                    {/* Price (base, GST-exclusive) */}
                    <div className="col-span-2">
                      <input
                        type="number" min="0"
                        value={row.rate}
                        onChange={e => handleRowChange(row.id, 'rate', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                      {row.name && (
                        <span className="block text-[11px] text-gray-400 text-right mt-0.5">
                          + {parseFloat(row.gst_percentage) || 0}% GST
                        </span>
                      )}
                    </div>

                    {/* Line total — taxable value (Price × Qty), matching the printed
                        receipt; GST is added on top in the totals below. */}
                    <div className="col-span-2 text-right text-sm font-semibold text-gray-800 pr-1">
                      ₹{calcLineTaxable(row).toFixed(2)}
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 flex justify-center">
                      {rows.length > 1 && (
                        <button onClick={() => handleRemoveRow(row.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock badge below row */}
                  {row.name && (
                    <div className="mt-1 ml-1">
                      <StockBadge stock={row.stock} qty={row.quantity} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Discount ── */}
          {/* GST is no longer typed in manually — each row already carries its
              own medicine's GST rate (via its GST Category), and the totals
              below decompose it into CGST/SGST automatically. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (₹)</label>
              <input
                type="number" min="0"
                value={formData.discount}
                onChange={e => setFormData(f => ({ ...f, discount: e.target.value }))}
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
              onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* ── Totals ── */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-5 rounded-xl">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Taxable Amount:</span>
                <span>₹{calcTaxableAmount().toFixed(2)}</span>
              </div>
              {calcTotalTax() > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>CGST:</span>
                    <span>₹{calcCGST().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>SGST:</span>
                    <span>₹{calcSGST().toFixed(2)}</span>
                  </div>
                </>
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

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              Cancel
            </button>
            <button
              onClick={() => handlePrint()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
            >
              <Printer className="w-4 h-4" /> Preview & Print
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                : <><Save className="w-4 h-4" />Save & Print</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineSaleModal;
