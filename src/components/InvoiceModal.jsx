import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, FileText, MessageSquare, Plus } from 'lucide-react';
import { collection, addDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendInvoiceSMS } from '../lib/sms';
import { getRoomInfo } from '../lib/rooms';
import { addDaysToDateString } from '../lib/formatDate';
import { buildInvoicePrintHTML } from '../lib/invoicePrint';

const DOCTOR_FEE_PER_DAY = 200;
const NURSE_FEE_PER_DAY = 150;

const InvoiceModal = ({ patient, onClose, onSave, registrationFee = 0, consultationFee = 0 }) => {
  const isRegistrationInvoice = registrationFee > 0;
  const isConsultationInvoice = consultationFee > 0;
  const [invoiceType, setInvoiceType] = useState(patient?.patient_type === 'IP' ? 'IP' : 'OP');
  const [saving, setSaving] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null); // null | 'sent' | 'failed'
  const [savedInvoiceData, setSavedInvoiceData] = useState(null);

  // Print preview — in-page iframe printed via its own contentWindow, same
  // pattern as MedicineSaleModal (see medicineSalePrint.js for why this
  // replaced window.open()+document.write(): unreliable across Chrome/Safari).
  const [printPreviewData, setPrintPreviewData] = useState(null);
  const [closeOnPreviewDismiss, setCloseOnPreviewDismiss] = useState(false);
  const printIframeRef = useRef(null);

  // Treatments picked from the price list on the patient's case sheet (OP or IP) — read-only, auto-synced.
  const [priceListItems, setPriceListItems] = useState([]);
  // Ad-hoc charges added directly on the invoice, on top of the price-list treatments.
  const [additionalCharges, setAdditionalCharges] = useState([]);
  // Medicines administered during the IP stay (from the case sheet + each Daily
  // Progress entry's MedicineTable) — billed as one aggregate total, not itemized,
  // since these are clinical dosing entries rather than priced treatment picks.
  const [medicinesTotal, setMedicinesTotal] = useState(0);

  // Doctor signature block on the printed invoice — looked up from the
  // patient's assigned doctor, same pattern as the prescription printout.
  const [doctorInfo, setDoctorInfo] = useState({ name: '', qualification: '', registrationNumber: '' });

  useEffect(() => {
    if (!patient?.assigned_doctor) return;
    const loadDoctorInfo = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'hr_employees'), where('name', '==', patient.assigned_doctor)));
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setDoctorInfo({
            name: patient.assigned_doctor.replace(/^Dr\.?\s*/i, ''),
            qualification: d.qualification || '',
            registrationNumber: d.isDoctor ? (d.registrationNumber || '') : '',
          });
        } else {
          setDoctorInfo({ name: patient.assigned_doctor.replace(/^Dr\.?\s*/i, ''), qualification: '', registrationNumber: '' });
        }
      } catch (e) {
        console.error('Error loading doctor info:', e);
      }
    };
    loadDoctorInfo();
  }, [patient?.assigned_doctor]);

  useEffect(() => {
    const patientId = patient?.firebaseId || patient?.id;
    if (!patientId) return;
    const loadTreatmentItems = async () => {
      try {
        const items = [];
        let medsTotal = 0;
        const caseSheetCollection = invoiceType === 'IP' ? 'ip_case_sheets' : 'op_case_sheets';
        const caseSheetSnap = await getDoc(doc(db, caseSheetCollection, patientId));
        if (caseSheetSnap.exists()) {
          const cs = caseSheetSnap.data();
          (cs.treatment_items || []).forEach(it => items.push({ ...it, source: 'Case Sheet' }));
          if (invoiceType === 'IP') {
            (cs.medicine_items || []).forEach(m => { medsTotal += Number(m.mrp) || 0; });
          }
        }

        // IP treatments are mostly logged day-to-day; OP follow-ups are logged per visit — both should bill too.
        const logCollection = invoiceType === 'IP' ? 'daily_progress' : 'op_visit_notes';
        const logSnap = await getDocs(query(collection(db, logCollection), where('patient_id', '==', patientId)));
        const sourceLabel = invoiceType === 'IP' ? 'Daily Progress' : 'Visit';
        logSnap.docs.forEach(d => {
          const data = d.data();
          (data.treatment_items || []).forEach(it => items.push({ ...it, source: data.date ? `${sourceLabel} · ${data.date}` : sourceLabel }));
          if (invoiceType === 'IP') {
            (data.medicine_items || []).forEach(m => { medsTotal += Number(m.mrp) || 0; });
          }
        });

        setPriceListItems(items);
        setMedicinesTotal(medsTotal);
      } catch (e) {
        console.error('Error loading treatment items:', e);
      }
    };
    loadTreatmentItems();
  }, [invoiceType, patient]);

  const addAdditionalCharge = () => setAdditionalCharges(prev => [...prev, { label: '', amount: 0 }]);
  const updateAdditionalCharge = (idx, field, value) =>
    setAdditionalCharges(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  const removeAdditionalCharge = (idx) => setAdditionalCharges(prev => prev.filter((_, i) => i !== idx));

  const priceListTotal = priceListItems.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

  const calculateTreatmentCharges = () =>
    priceListTotal +
    additionalCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) +
    medicinesTotal;

  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    nursing_fees: 0,
    doctor_fees: 0,
    lab_test_charges: 0,
    // Registration fee shown for records but deducted from balance due
    registration_fee: isRegistrationInvoice ? registrationFee : 0,
    reg_fee_already_paid: isRegistrationInvoice,
    consultation_fees: isConsultationInvoice ? consultationFee : 0,
    room_rent: 0,
    room_type: '',
    room_number: '',
    admission_date: patient?.admission_date || '',
    discharge_date: '',
    days: 0,
    mess_days: 0,
    patient_meals: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 },
    bystander_meals: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 },
    gst_percentage: 0,
    discount: 0,
    payment_mode: 'Cash',
    notes: isRegistrationInvoice
      ? 'Registration fee invoice — fee collected at time of registration.'
      : isConsultationInvoice
        ? 'Consultation fee invoice — returning patient check-in.'
        : ''
  });

  const [messTab, setMessTab] = useState('patient'); // 'patient' | 'bystander'

  const calcMessTotal = (meals) =>
    Object.values(meals).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const calcStayDays = (admissionDate, dischargeDate) => {
    if (!admissionDate || !dischargeDate) return null;
    const admission = new Date(admissionDate);
    const discharge = new Date(dischargeDate);
    if (isNaN(admission) || isNaN(discharge) || discharge < admission) return null;
    return Math.max(1, Math.round((discharge - admission) / (1000 * 60 * 60 * 24)));
  };

  // Doctor's/Nursing fees are a fixed per-day rate for IP stays — always kept in
  // sync with the current "Days" value so they never drift out of date when the
  // stay length changes, the same way "Days" itself tracks the admission/discharge dates.
  const applyAutoFees = (data) => {
    if (invoiceType !== 'IP') return data;
    const days = parseFloat(data.days) || 0;
    return { ...data, doctor_fees: days * DOCTOR_FEE_PER_DAY, nursing_fees: days * NURSE_FEE_PER_DAY };
  };

  const handleStayDateChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    const stayDays = calcStayDays(updated.admission_date, updated.discharge_date);
    if (stayDays !== null) {
      updated.days = stayDays;
      updated.mess_days = stayDays;
    }
    setFormData(applyAutoFees(updated));
  };

  // Pre-fill room + stay dates from the IP Case Sheet the moment this opens
  // for an IP patient, so staff don't have to re-enter what was already
  // recorded at admission. Runs once on open — later manual edits here are
  // left alone rather than being overwritten.
  useEffect(() => {
    const patientId = patient?.firebaseId || patient?.id;
    if (invoiceType !== 'IP' || !patientId) return;
    getDoc(doc(db, 'ip_case_sheets', patientId)).then(snap => {
      if (!snap.exists()) return;
      const cs = snap.data();
      const room = getRoomInfo(cs.room_number);
      const dischargeDate = cs.discharge_date
        || (patient?.admission_date && patient?.expected_stay_days != null
          ? addDaysToDateString(patient.admission_date, Number(patient.expected_stay_days))
          : '');
      setFormData(prev => {
        const updated = {
          ...prev,
          // Patient record's own admission_date takes priority; the IP Case
          // Sheet's admission_date (entered separately by the ward) is only
          // used to fill the gap when the patient record never got one.
          ...(!prev.admission_date && cs.admission_date ? { admission_date: cs.admission_date } : {}),
          ...(room ? { room_number: room.number, room_type: room.type, room_rent: room.rate } : {}),
          ...(dischargeDate ? { discharge_date: dischargeDate } : {}),
        };
        const stayDays = calcStayDays(updated.admission_date, updated.discharge_date);
        if (stayDays !== null) {
          updated.days = stayDays;
          updated.mess_days = stayDays;
          updated.doctor_fees = stayDays * DOCTOR_FEE_PER_DAY;
          updated.nursing_fees = stayDays * NURSE_FEE_PER_DAY;
        }
        return updated;
      });
    }).catch(e => console.error('Error pre-filling room/stay info:', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the per-day meal rates from Mess Management's Set Prices, so
  // staff aren't re-typing ₹80/₹120/etc. on every invoice — still fully
  // editable below for a one-off adjustment.
  useEffect(() => {
    if (invoiceType !== 'IP') return;
    getDoc(doc(db, 'meal_prices', 'default')).then(snap => {
      if (!snap.exists()) return;
      const prices = snap.data();
      setFormData(prev => ({
        ...prev,
        patient_meals: {
          breakfast: prev.patient_meals.breakfast || prices.breakfast || 0,
          lunch: prev.patient_meals.lunch || prices.lunch || 0,
          dinner: prev.patient_meals.dinner || prices.dinner || 0,
          snacks: prev.patient_meals.snacks || prices.snacks || 0,
        },
        bystander_meals: {
          breakfast: prev.bystander_meals.breakfast || prices.breakfast || 0,
          lunch: prev.bystander_meals.lunch || prices.lunch || 0,
          dinner: prev.bystander_meals.dinner || prices.dinner || 0,
          snacks: prev.bystander_meals.snacks || prices.snacks || 0,
        },
      }));
    }).catch(e => console.error('Error loading meal prices:', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceType]);

  // Gross = every line item including registration fee
  const calculateGross = () => {
    let gross = 0;
    gross += calculateTreatmentCharges();
    gross += parseFloat(formData.nursing_fees) || 0;
    gross += parseFloat(formData.doctor_fees) || 0;
    gross += parseFloat(formData.lab_test_charges) || 0;
    gross += parseFloat(formData.registration_fee) || 0;
    gross += parseFloat(formData.consultation_fees) || 0;
    if (invoiceType === 'IP') {
      gross += (parseFloat(formData.room_rent) || 0) * (parseFloat(formData.days) || 0);
      gross += calcMessTotal(formData.patient_meals) * (parseFloat(formData.mess_days) || 0);
      gross += calcMessTotal(formData.bystander_meals) * (parseFloat(formData.mess_days) || 0);
    }
    return gross;
  };

  // Subtotal = gross minus registration fee already paid
  const calculateSubtotal = () => {
    const gross = calculateGross();
    const regPaid = formData.reg_fee_already_paid ? (parseFloat(formData.registration_fee) || 0) : 0;
    return gross - regPaid;
  };

  const calculateGST = () => {
    return (calculateSubtotal() * (parseFloat(formData.gst_percentage) || 0)) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST() - (parseFloat(formData.discount) || 0);
  };

  // Same approach as MedicineSaleModal's getNextBillNumber — "A" + a plain,
  // zero-padded running count instead of the old MED-YYYY-NNNN style, so
  // it's short enough to read out over the phone and track against.
  // Counted separately from medicine_sales, since these are a different
  // invoice series.
  const getNextInvoiceNumber = async () => {
    const snap = await getDocs(collection(db, 'invoices'));
    return `A${String(snap.size + 1).padStart(4, '0')}`;
  };

  const handleSaveInvoice = async () => {
    try {
      setSaving(true);

      const invoiceData = {
        invoice_number: await getNextInvoiceNumber(),
        patient_id: patient.firebaseId || patient.id,
        patient_number: patient.patient_number,
        mrd_number: patient.mrd_number || '',
        ip_number: patient.ip_number || '',
        patient_name: `${patient.first_name} ${patient.last_name}`,
        patient_phone: patient.phone,
        patient_address: patient.address,
        invoice_type: invoiceType,
        invoice_date: formData.invoice_date,
        treatment_charges: calculateTreatmentCharges(),
        treatment_items: priceListItems,
        additional_charges: additionalCharges,
        medicines_total: invoiceType === 'IP' ? medicinesTotal : 0,
        nursing_fees: parseFloat(formData.nursing_fees) || 0,
        doctor_fees: parseFloat(formData.doctor_fees) || 0,
        lab_test_charges: parseFloat(formData.lab_test_charges) || 0,
        room_rent: invoiceType === 'IP' ? parseFloat(formData.room_rent) || 0 : 0,
        room_type: invoiceType === 'IP' ? formData.room_type : '',
        room_number: invoiceType === 'IP' ? formData.room_number : '',
        admission_date: invoiceType === 'IP' ? formData.admission_date : '',
        discharge_date: invoiceType === 'IP' ? formData.discharge_date : '',
        days: invoiceType === 'IP' ? parseFloat(formData.days) || 0 : 0,
        mess_days: invoiceType === 'IP' ? parseFloat(formData.mess_days) || 0 : 0,
        patient_mess_per_day: invoiceType === 'IP' ? calcMessTotal(formData.patient_meals) : 0,
        bystander_mess_per_day: invoiceType === 'IP' ? calcMessTotal(formData.bystander_meals) : 0,
        mess_charges: invoiceType === 'IP' ? (calcMessTotal(formData.patient_meals) + calcMessTotal(formData.bystander_meals)) : 0,
        patient_meals: invoiceType === 'IP' ? formData.patient_meals : null,
        bystander_meals: invoiceType === 'IP' ? formData.bystander_meals : null,
        registration_fee: parseFloat(formData.registration_fee) || 0,
        reg_fee_already_paid: formData.reg_fee_already_paid,
        is_registration_invoice: isRegistrationInvoice,
        consultation_fees: parseFloat(formData.consultation_fees) || 0,
        is_consultation_invoice: isConsultationInvoice,
        gross_total: calculateGross(),
        subtotal: calculateSubtotal(),
        gst_percentage: parseFloat(formData.gst_percentage) || 0,
        gst_amount: calculateGST(),
        discount: parseFloat(formData.discount) || 0,
        total_amount: calculateTotal(),
        payment_mode: formData.payment_mode,
        notes: formData.notes,
        status: 'paid',
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      };

      const invoicesRef = collection(db, 'invoices');
      const docRef = await addDoc(invoicesRef, invoiceData);

      console.log('✅ Invoice created:', docRef.id);

      setSavedInvoiceData(invoiceData);
      setSmsStatus(null);
      alert('✅ Invoice saved successfully!');

      if (onSave) onSave(invoiceData);

      // Open print view
      handlePrint(invoiceData);

    } catch (error) {
      console.error('❌ Error saving invoice:', error);
      alert('Failed to save invoice: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendSMS = async () => {
    const phone = patient.phone;
    if (!phone) {
      alert('No phone number on file for this patient.');
      return;
    }
    const data = savedInvoiceData || {
      invoice_type: invoiceType,
      invoice_date: formData.invoice_date,
      total_amount: calculateTotal(),
      payment_mode: formData.payment_mode,
      patient_number: patient.patient_number
    };
    const patientName = `${patient.first_name} ${patient.last_name}`;
    try {
      setSendingSMS(true);
      setSmsStatus(null);
      const result = await sendInvoiceSMS(phone, patientName, data);
      setSmsStatus(result.success ? 'sent' : 'failed');
      if (!result.success) console.warn('Invoice SMS failed:', result.error);
    } catch (err) {
      setSmsStatus('failed');
      console.error('SMS error:', err);
    } finally {
      setSendingSMS(false);
    }
  };

  const handlePrint = async (invoiceData = null) => {
    const data = invoiceData || {
      invoice_number: await getNextInvoiceNumber(),
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_number: patient.patient_number,
      patient_phone: patient.phone,
      patient_address: patient.address,
      invoice_type: invoiceType,
      invoice_date: formData.invoice_date,
      treatment_charges: calculateTreatmentCharges(),
      treatment_items: priceListItems,
      additional_charges: additionalCharges,
      medicines_total: invoiceType === 'IP' ? medicinesTotal : 0,
      nursing_fees: parseFloat(formData.nursing_fees) || 0,
      doctor_fees: parseFloat(formData.doctor_fees) || 0,
      lab_test_charges: parseFloat(formData.lab_test_charges) || 0,
      registration_fee: parseFloat(formData.registration_fee) || 0,
      reg_fee_already_paid: formData.reg_fee_already_paid,
      consultation_fees: parseFloat(formData.consultation_fees) || 0,
      room_rent: parseFloat(formData.room_rent) || 0,
      room_type: formData.room_type,
      room_number: formData.room_number,
      admission_date: formData.admission_date,
      discharge_date: formData.discharge_date,
      days: parseFloat(formData.days) || 0,
      mess_days: parseFloat(formData.mess_days) || 0,
      patient_mess_per_day: calcMessTotal(formData.patient_meals),
      bystander_mess_per_day: calcMessTotal(formData.bystander_meals),
      gross_total: calculateGross(),
      subtotal: calculateSubtotal(),
      gst_percentage: parseFloat(formData.gst_percentage) || 0,
      gst_amount: calculateGST(),
      discount: parseFloat(formData.discount) || 0,
      total_amount: calculateTotal(),
      payment_mode: formData.payment_mode,
      notes: formData.notes
    };

    // Saving already leaves this form open (see handleSaveInvoice) so the
    // user can still Send SMS — a plain "Preview & Print" behaves the same
    // way either way, but "Save & Print" should close once the preview is
    // dismissed, matching MedicineSaleModal's Save & Print.
    setCloseOnPreviewDismiss(!!invoiceData);
    setPrintPreviewData(data);
  };

  const handlePrintFromPreview = () => {
    const win = printIframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const handleClosePreview = () => {
    setPrintPreviewData(null);
    // Distinguishes "closed after Save & Print" from a plain Cancel/X click
    // (onClick={() => onClose()} elsewhere) — callers that only want to
    // cascade-close on an actual save (e.g. PatientRegistrationNew) check
    // this flag rather than treating any onClose call as a completed save.
    if (closeOnPreviewDismiss) onClose(true);
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-2xl font-bold">Generate Invoice</h2>
              <p className="text-teal-100 text-sm">
                {patient.first_name} {patient.last_name}
              </p>
            </div>
          </div>
          <button onClick={() => onClose()} className="hover:bg-teal-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Patient Info Card */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Patient Details</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 shrink-0">Name:</span>
                <span className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 shrink-0">MRD No:</span>
                <span className="font-semibold text-teal-700">{patient.mrd_number || patient.patient_number || '—'}</span>
              </div>
              {patient.ip_number && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-24 shrink-0">IP No:</span>
                  <span className="font-semibold text-blue-700">{patient.ip_number}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 shrink-0">Phone:</span>
                <span className="font-medium text-gray-800">{patient.phone || '—'}</span>
              </div>
              {patient.address && (
                <div className="flex gap-2 col-span-2">
                  <span className="text-gray-500 w-24 shrink-0">Address:</span>
                  <span className="text-gray-800">{patient.address}</span>
                </div>
              )}
              {patient.patient_type && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-24 shrink-0">Type:</span>
                  <span className={`font-semibold ${patient.patient_type === 'IP' ? 'text-blue-700' : 'text-green-700'}`}>
                    {patient.patient_type === 'IP' ? 'In-Patient' : 'Out-Patient'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Invoice Type</label>
            <div className="flex gap-4">
              <button
                onClick={() => setInvoiceType('OP')}
                className={`flex-1 py-3 px-6 rounded-lg border-2 font-medium transition-colors ${
                  invoiceType === 'OP'
                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                    : 'border-gray-300 hover:border-teal-300'
                }`}
              >
                Out Patient (O/P)
              </button>
              <button
                onClick={() => setInvoiceType('IP')}
                className={`flex-1 py-3 px-6 rounded-lg border-2 font-medium transition-colors ${
                  invoiceType === 'IP'
                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                    : 'border-gray-300 hover:border-teal-300'
                }`}
              >
                In Patient (I/P)
              </button>
            </div>
          </div>

          {/* Invoice Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date</label>
            <input
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* ── Charges Section ── */}
          <div className="mb-6 border border-teal-300 rounded-xl overflow-hidden">
            <div className="bg-teal-50 px-4 py-3 border-b border-teal-200">
              <h3 className="font-bold text-teal-800">💊 Charges Breakdown</h3>
            </div>
            <div className="p-4 space-y-4">

              {/* Registration Fee row — always shown when present */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 border border-teal-200">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-teal-800 mb-1">Registration Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.registration_fee}
                    onChange={(e) => setFormData({ ...formData, registration_fee: e.target.value })}
                    className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0.00"
                    readOnly={isRegistrationInvoice}
                  />
                </div>
                <div className="flex flex-col items-center gap-1 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-teal-700 font-medium">
                    <input
                      type="checkbox"
                      checked={formData.reg_fee_already_paid}
                      onChange={(e) => setFormData({ ...formData, reg_fee_already_paid: e.target.checked })}
                      className="w-4 h-4 accent-teal-600"
                    />
                    Already Paid
                  </label>
                  {formData.reg_fee_already_paid && (
                    <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full">Deducted from total</span>
                  )}
                </div>
              </div>

              {/* Treatment Charges — auto-synced from the price-list picks on the case sheet, plus any additional charges */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Treatment Charges (₹)</label>
                  <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                    Auto-synced from {invoiceType} case sheet & {invoiceType === 'IP' ? 'daily progress' : 'visit log'}
                  </span>
                </div>

                {priceListItems.length === 0 && additionalCharges.length === 0 && medicinesTotal === 0 && (
                  <p className="text-xs text-gray-400 mb-2">
                    No treatments picked from the price list yet. Add treatments via "Add from Price List" in the {invoiceType} case sheet{invoiceType === 'IP' ? ' or Daily Progress' : "'s Visit Log"}, or add a charge manually below.
                  </p>
                )}

                <div className="space-y-1.5 mb-2">
                  {priceListItems.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        Treatments <span className="text-xs text-teal-600">({invoiceType} case sheet & {invoiceType === 'IP' ? 'daily progress' : 'visit log'})</span>
                      </span>
                      <span className="font-medium text-gray-800">₹{priceListTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {invoiceType === 'IP' && medicinesTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Medicines Administered <span className="text-xs text-teal-600">(case sheet & daily progress)</span></span>
                      <span className="font-medium text-gray-800">₹{medicinesTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-2">
                  {additionalCharges.map((charge, idx) => (
                    <div key={`ac-${idx}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={charge.label}
                        placeholder="Description"
                        onChange={(e) => updateAdditionalCharge(idx, 'label', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                      <input
                        type="number"
                        value={charge.amount}
                        placeholder="0.00"
                        onChange={(e) => updateAdditionalCharge(idx, 'amount', e.target.value)}
                        className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeAdditionalCharge(idx)}
                        className="text-red-500 hover:text-red-700"
                        title="Remove charge"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addAdditionalCharge}
                  className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 py-1 rounded"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Charge
                </button>

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200 text-sm font-bold text-gray-800">
                  <span>Total Treatment Charges</span>
                  <span>₹{calculateTreatmentCharges().toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Other charges grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Doctor's Fees (₹) {invoiceType === 'IP' && (
                      <span className="text-xs font-normal text-teal-600">(auto: ₹{DOCTOR_FEE_PER_DAY}/day × {formData.days || 0})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={formData.doctor_fees}
                    onChange={(e) => setFormData({ ...formData, doctor_fees: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nursing Fees (₹) {invoiceType === 'IP' && (
                      <span className="text-xs font-normal text-teal-600">(auto: ₹{NURSE_FEE_PER_DAY}/day × {formData.days || 0})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={formData.nursing_fees}
                    onChange={(e) => setFormData({ ...formData, nursing_fees: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lab Test Charges (₹)</label>
                  <input
                    type="number"
                    value={formData.lab_test_charges}
                    onChange={(e) => setFormData({ ...formData, lab_test_charges: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.consultation_fees}
                    onChange={(e) => setFormData({ ...formData, consultation_fees: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* IP Specific Fields */}
          {invoiceType === 'IP' && (
            <>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-4">In-Patient Charges</h3>
                
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Admission Date</label>
                    <input
                      type="date"
                      value={formData.admission_date}
                      onChange={(e) => handleStayDateChange('admission_date', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Date</label>
                    <input
                      type="date"
                      value={formData.discharge_date}
                      min={formData.admission_date || undefined}
                      onChange={(e) => handleStayDateChange('discharge_date', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
                    <select
                      value={formData.room_type}
                      onChange={(e) => {
                        const type = e.target.value;
                        const rent = type === 'A/C' ? 1000 : type === 'Non-A/C' ? 700 : formData.room_rent;
                        setFormData({ ...formData, room_type: type, room_rent: rent });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Type</option>
                      <option value="A/C">A/C</option>
                      <option value="Non-A/C">Non-A/C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Number</label>
                    <select
                      value={formData.room_number || ''}
                      onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select</option>
                      <option value="21">21</option>
                      <option value="22">22</option>
                      <option value="23">23</option>
                      <option value="24">24</option>
                      <option value="25">25</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Rent/Day (₹)</label>
                    <input
                      type="number"
                      value={formData.room_rent}
                      onChange={(e) => setFormData({ ...formData, room_rent: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Days {calcStayDays(formData.admission_date, formData.discharge_date) !== null && (
                        <span className="text-xs font-normal text-teal-600">(auto)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={formData.days}
                      onChange={(e) => setFormData(applyAutoFees({ ...formData, days: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Mess Charges */}
                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMessTab('patient')}
                        className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${messTab === 'patient' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-200'}`}
                      >
                        Patient Mess
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessTab('bystander')}
                        className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${messTab === 'bystander' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-200'}`}
                      >
                        Bystander
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Days:</label>
                      <input
                        type="number"
                        value={formData.mess_days}
                        onChange={(e) => setFormData({ ...formData, mess_days: e.target.value })}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="p-4">
                    {(['patient', 'bystander']).map((tab) => (
                      messTab === tab && (
                        <div key={tab}>
                          <div className="grid grid-cols-2 gap-3">
                            {['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => (
                              <div key={meal}>
                                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{meal} (₹/day)</label>
                                <input
                                  type="number"
                                  value={formData[`${tab}_meals`][meal]}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    [`${tab}_meals`]: { ...formData[`${tab}_meals`], [meal]: e.target.value }
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder="0.00"
                                  min="0"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 text-right text-sm text-gray-600">
                            Daily total: <span className="font-semibold text-teal-700">₹{calcMessTotal(formData[`${tab}_meals`]).toFixed(2)}</span>
                            {formData.mess_days > 0 && (
                              <span className="ml-2">× {formData.mess_days} days = <span className="font-bold text-gray-800">₹{(calcMessTotal(formData[`${tab}_meals`]) * formData.mess_days).toFixed(2)}</span></span>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>

                  <div className="bg-blue-50 px-4 py-2 text-sm text-blue-800 flex justify-between">
                    <span>Total Mess Charges ({formData.mess_days || 0} days)</span>
                    <span className="font-bold">₹{((calcMessTotal(formData.patient_meals) + calcMessTotal(formData.bystander_meals)) * (parseFloat(formData.mess_days) || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* GST & Discount */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">GST (%)</label>
              <input
                type="number"
                value={formData.gst_percentage}
                onChange={(e) => setFormData({ ...formData, gst_percentage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount (₹)</label>
              <input
                type="number"
                value={formData.discount}
                onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Payment Mode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
            <select
              value={formData.payment_mode}
              onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Additional notes..."
            />
          </div>

          {/* Totals Summary */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 rounded-lg mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Gross Total:</span>
                <span>₹{calculateGross().toFixed(2)}</span>
              </div>
              {formData.reg_fee_already_paid && parseFloat(formData.registration_fee) > 0 && (
                <div className="flex justify-between text-sm text-teal-200">
                  <span>Less: Registration Fee (already paid):</span>
                  <span>-₹{parseFloat(formData.registration_fee).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(formData.gst_percentage) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>GST ({formData.gst_percentage}%):</span>
                  <span>₹{calculateGST().toFixed(2)}</span>
                </div>
              )}
              {parseFloat(formData.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>-₹{parseFloat(formData.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-bold pt-2 border-t border-teal-500">
                <span>BALANCE DUE:</span>
                <span>₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => onClose()}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handlePrint()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Preview & Print
            </button>
            <button
              onClick={handleSaveInvoice}
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save & Print
                </>
              )}
            </button>
            <button
              onClick={handleSendSMS}
              disabled={sendingSMS}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              title={patient.phone ? `Send invoice SMS to ${patient.phone}` : 'No phone number on file'}
            >
              {sendingSMS ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5" />
                  Send SMS
                </>
              )}
            </button>
          </div>
          {smsStatus && (
            <div className={`text-center text-sm mt-2 font-medium ${smsStatus === 'sent' ? 'text-green-600' : 'text-red-500'}`}>
              {smsStatus === 'sent' ? '✅ Invoice SMS sent successfully!' : '⚠️ SMS failed — check MSG91 config in .env'}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Print Preview — in-page iframe, printed via its own contentWindow,
        rather than a popup window (see printPreviewData state above). */}
    {printPreviewData && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
          <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
            <div>
              <h2 className="text-xl font-bold">Print Preview</h2>
              <p className="text-teal-100 text-sm">{printPreviewData.patient_name}</p>
            </div>
            <button onClick={handleClosePreview} className="hover:bg-teal-700 p-2 rounded">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-end bg-gray-50">
            <button
              onClick={handlePrintFromPreview}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center">
            <iframe
              ref={printIframeRef}
              title="Invoice print preview"
              srcDoc={buildInvoicePrintHTML(printPreviewData, doctorInfo)}
              // "Save & Print" should actually print, not just open a
              // preview the user then has to print manually — fire it
              // automatically once the invoice has finished rendering in
              // the iframe. "Preview & Print" leaves this to the Print
              // button instead, since the whole point there is to look
              // before printing.
              onLoad={() => { if (closeOnPreviewDismiss) handlePrintFromPreview(); }}
              className="bg-white shadow-lg"
              style={{ width: '794px', minHeight: '1123px', border: 'none' }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default InvoiceModal;
