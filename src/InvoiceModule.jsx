import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, Printer, Eye, X, Save, CheckCircle,
  AlertCircle, RefreshCw, User, Phone, MapPin, Calendar,
  Stethoscope, Activity, Pill, DollarSign, Percent, Hash,
  ArrowLeft
} from 'lucide-react';

const InvoiceModule = ({ supabase, currentUser, userRole }) => {
  const [view, setView] = useState('list');
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [newInvoice, setNewInvoice] = useState({
    patientId: '',
    patientName: '',
    patientAddress: '',
    patientPhone: '',
    patientAge: '',
    patientGender: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    consultationFee: 500,
    doctorName: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim(),
    treatments: [],
    medicines: [],
    followupDate: '',
    discount: 0,
    notes: ''
  });

  const hospitalDetails = {
    name: 'Tatva Ayurved Hospital',
    address: 'Thekkuveedu Lane,Kannur Rd.,Near Christian College, Calicut, Kerala - 673006',
    phone: '+91 9895112264',
    email: 'info@tatvaayurved.com',
    gstin: 'GSTIN (if applicable)',
    registrationNo: 'Hospital Registration Number'
  };

  useEffect(() => {
    loadInvoices();
    loadPatients();
  }, []);

  const loadInvoices = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_type', 'OP')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('first_name');
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handlePatientSelect = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setNewInvoice({
        ...newInvoice,
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        patientAddress: `${patient.address || ''}, ${patient.city || ''}`.trim(),
        patientPhone: patient.phone,
        patientAge: patient.age || '',
        patientGender: patient.gender || ''
      });
    }
  };

  const addTreatment = () => {
    setNewInvoice({
      ...newInvoice,
      treatments: [...newInvoice.treatments, { name: '', charges: 0 }]
    });
  };

  const updateTreatment = (index, field, value) => {
    const updated = [...newInvoice.treatments];
    updated[index][field] = value;
    setNewInvoice({ ...newInvoice, treatments: updated });
  };

  const removeTreatment = (index) => {
    setNewInvoice({
      ...newInvoice,
      treatments: newInvoice.treatments.filter((_, i) => i !== index)
    });
  };

  const addMedicine = () => {
    setNewInvoice({
      ...newInvoice,
      medicines: [...newInvoice.medicines, {
        name: '', quantity: 1, unitPrice: 0, hsnCode: '', batchNo: ''
      }]
    });
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...newInvoice.medicines];
    updated[index][field] = value;
    setNewInvoice({ ...newInvoice, medicines: updated });
  };

  const removeMedicine = (index) => {
    setNewInvoice({
      ...newInvoice,
      medicines: newInvoice.medicines.filter((_, i) => i !== index)
    });
  };

  const calculateTotals = (invoice = newInvoice) => {
    const consultationFee = parseFloat(invoice.consultationFee) || 0;
    const treatmentTotal = (invoice.treatments || []).reduce((sum, t) => sum + (parseFloat(t.charges) || 0), 0);
    const medicineTotal = (invoice.medicines || []).reduce((sum, m) =>
      sum + ((parseFloat(m.quantity) || 0) * (parseFloat(m.unitPrice) || 0)), 0);

    const subtotal = consultationFee + treatmentTotal + medicineTotal;
    const discount = parseFloat(invoice.discount) || 0;
    const afterDiscount = subtotal - discount;
    const gst = afterDiscount * 0.18;
    const total = afterDiscount + gst;

    return { subtotal, discount, gst, total, consultationFee, treatmentTotal, medicineTotal };
  };

  const handleSaveInvoice = async () => {
    if (!newInvoice.patientId) {
      showMessage('error', 'Please select a patient');
      return;
    }

    setSaving(true);
    try {
      const totals = calculateTotals();
      const invoiceNumber = `OP-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(5, '0')}`;

      const invoiceData = {
        invoice_number: invoiceNumber,
        invoice_type: 'OP',
        patient_id: newInvoice.patientId,
        patient_name: newInvoice.patientName,
        patient_address: newInvoice.patientAddress,
        patient_phone: newInvoice.patientPhone,
        invoice_date: newInvoice.invoiceDate,
        doctor_name: newInvoice.doctorName,
        invoice_data: JSON.stringify({
          ...newInvoice,
          consultationFee: parseFloat(newInvoice.consultationFee) || 0,
          discount: parseFloat(newInvoice.discount) || 0,
          treatments: newInvoice.treatments.map(t => ({
            name: t.name,
            charges: parseFloat(t.charges) || 0
          })),
          medicines: newInvoice.medicines.map(m => ({
            name: m.name,
            quantity: parseFloat(m.quantity) || 0,
            unitPrice: parseFloat(m.unitPrice) || 0,
            hsnCode: m.hsnCode,
            batchNo: m.batchNo
          }))
        }),
        subtotal: totals.subtotal,
        discount: totals.discount,
        gst_amount: totals.gst,
        total_amount: totals.total,
        created_by: currentUser?.id
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select()
          .single();
        if (error) throw error;
        
        const parsedData = JSON.parse(data.invoice_data);
        setSelectedInvoice({ ...data, invoice_data: parsedData });
      }

      showMessage('success', '✅ Invoice created successfully!');
      await loadInvoices();
      setView('preview');

    } catch (error) {
      console.error('Save error:', error);
      showMessage('error', 'Failed to save invoice: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetForm = () => {
    setNewInvoice({
      patientId: '',
      patientName: '',
      patientAddress: '',
      patientPhone: '',
      patientAge: '',
      patientGender: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      consultationFee: 500,
      doctorName: `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim(),
      treatments: [],
      medicines: [],
      followupDate: '',
      discount: 0,
      notes: ''
    });
    setView('list');
  };

  // LIST VIEW
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">OP Invoices</h1>
            <p className="text-slate-600">Outpatient invoice management with GST</p>
          </div>
          <button onClick={() => setView('create')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700">
            <Plus className="w-5 h-5" />
            Create Invoice
          </button>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
            'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="font-semibold">{message.text}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search invoices..."
                className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-500">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">No invoices yet</p>
              <button onClick={() => setView('create')}
                className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">
                Create First Invoice
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Invoice #</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Patient</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Doctor</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600">
                      {inv.invoice_number}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold">{inv.patient_name}</p>
                      <p className="text-xs text-slate-500">{inv.patient_phone}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(inv.invoice_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm">{inv.doctor_name}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-lg text-slate-800">₹{inv.total_amount?.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          try {
                            const parsedData = typeof inv.invoice_data === 'string' 
                              ? JSON.parse(inv.invoice_data) 
                              : inv.invoice_data;
                            
                            setSelectedInvoice({
                              ...inv,
                              invoice_data: parsedData
                            });
                            setView('preview');
                          } catch (error) {
                            console.error('Error loading invoice:', error);
                            showMessage('error', 'Error loading invoice. Please try again.');
                          }
                        }}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // CREATE VIEW
  if (view === 'create') {
    const totals = calculateTotals();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Create OP Invoice</h1>
            <p className="text-slate-600">Outpatient consultation & treatment billing</p>
          </div>
          <button onClick={resetForm}
            className="px-4 py-2 border-2 border-slate-300 rounded-xl font-semibold hover:bg-slate-50">
            Cancel
          </button>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="col-span-2 space-y-6">
            {/* Patient Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Patient Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Select Patient *</label>
                  <select
                    value={newInvoice.patientId}
                    onChange={(e) => handlePatientSelect(e.target.value)}
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none">
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.patient_number})
                      </option>
                    ))}
                  </select>
                </div>
                {newInvoice.patientName && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl">
                    <div>
                      <p className="text-xs text-slate-600">Name</p>
                      <p className="font-semibold">{newInvoice.patientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Phone</p>
                      <p className="font-semibold">{newInvoice.patientPhone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-600">Address</p>
                      <p className="font-semibold text-sm">{newInvoice.patientAddress}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Consultation */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-600" />
                Consultation Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Doctor Name</label>
                  <input type="text" value={newInvoice.doctorName}
                    onChange={(e) => setNewInvoice({...newInvoice, doctorName: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Consultation Fee (₹)</label>
                  <input type="number" value={newInvoice.consultationFee}
                    onChange={(e) => setNewInvoice({...newInvoice, consultationFee: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Invoice Date</label>
                  <input type="date" value={newInvoice.invoiceDate}
                    onChange={(e) => setNewInvoice({...newInvoice, invoiceDate: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Follow-up Date</label>
                  <input type="date" value={newInvoice.followupDate}
                    onChange={(e) => setNewInvoice({...newInvoice, followupDate: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Treatments */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Treatments & Procedures
                </h3>
                <button onClick={addTreatment}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
                  + Add Treatment
                </button>
              </div>
              {newInvoice.treatments.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No treatments added yet</p>
              ) : (
                <div className="space-y-3">
                  {newInvoice.treatments.map((treatment, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <input type="text" placeholder="Treatment name (e.g., Abhyanga, Shirodhara)"
                        value={treatment.name}
                        onChange={(e) => updateTreatment(idx, 'name', e.target.value)}
                        className="flex-1 px-4 py-3 border-2 rounded-xl" />
                      <input type="number" placeholder="Charges"
                        value={treatment.charges}
                        onChange={(e) => updateTreatment(idx, 'charges', e.target.value)}
                        className="w-32 px-4 py-3 border-2 rounded-xl" />
                      <button onClick={() => removeTreatment(idx)}
                        className="p-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medicines */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Pill className="w-5 h-5 text-amber-600" />
                  Medicines & Pharmacy
                </h3>
                <button onClick={addMedicine}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
                  + Add Medicine
                </button>
              </div>
              {newInvoice.medicines.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No medicines added yet</p>
              ) : (
                <div className="space-y-3">
                  {newInvoice.medicines.map((med, idx) => (
                    <div key={idx} className="border-2 border-slate-200 rounded-xl p-4">
                      <div className="grid grid-cols-5 gap-3 mb-2">
                        <div className="col-span-2">
                          <input type="text" placeholder="Medicine name"
                            value={med.name}
                            onChange={(e) => updateMedicine(idx, 'name', e.target.value)}
                            className="w-full px-3 py-2 border-2 rounded-lg text-sm" />
                        </div>
                        <input type="number" placeholder="Qty"
                          value={med.quantity}
                          onChange={(e) => updateMedicine(idx, 'quantity', e.target.value)}
                          className="px-3 py-2 border-2 rounded-lg text-sm" />
                        <input type="number" placeholder="Price"
                          value={med.unitPrice}
                          onChange={(e) => updateMedicine(idx, 'unitPrice', e.target.value)}
                          className="px-3 py-2 border-2 rounded-lg text-sm" />
                        <button onClick={() => removeMedicine(idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="HSN Code"
                          value={med.hsnCode}
                          onChange={(e) => updateMedicine(idx, 'hsnCode', e.target.value)}
                          className="px-3 py-2 border-2 rounded-lg text-sm" />
                        <input type="text" placeholder="Batch Number"
                          value={med.batchNo}
                          onChange={(e) => updateMedicine(idx, 'batchNo', e.target.value)}
                          className="px-3 py-2 border-2 rounded-lg text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border">
              <label className="block text-sm font-bold mb-2">Additional Notes</label>
              <textarea value={newInvoice.notes}
                onChange={(e) => setNewInvoice({...newInvoice, notes: e.target.value})}
                placeholder="Any special instructions or notes..."
                rows={3}
                className="w-full px-4 py-3 border-2 rounded-xl resize-none" />
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 border sticky top-6">
              <h3 className="text-lg font-bold mb-4">Invoice Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Consultation Fee</span>
                  <span className="font-semibold">₹{totals.consultationFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Treatments</span>
                  <span className="font-semibold">₹{totals.treatmentTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Medicines</span>
                  <span className="font-semibold">₹{totals.medicineTotal.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Subtotal</span>
                  <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Discount (₹)</label>
                  <input type="number" value={newInvoice.discount}
                    onChange={(e) => setNewInvoice({...newInvoice, discount: e.target.value})}
                    className="w-full px-3 py-2 border-2 rounded-lg" />
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>GST (18%)</span>
                  <span className="font-semibold">₹{totals.gst.toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-blue-200 pt-3 flex justify-between text-lg">
                  <span className="font-bold text-blue-600">Total Amount</span>
                  <span className="font-bold text-blue-600">₹{totals.total.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={handleSaveInvoice} disabled={saving || !newInvoice.patientId}
                className="w-full mt-6 px-6 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Generating...</>
                ) : (
                  <><Save className="w-5 h-5" /> Generate Invoice</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PREVIEW & PRINT VIEW
  if (view === 'preview' && selectedInvoice) {
    const invoiceData = selectedInvoice.invoice_data || {};
    const totals = calculateTotals(invoiceData);

    return (
      <div>
        {/* Screen View - Hidden on Print */}
        <div className="no-print min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
          <div className="mb-6 flex items-center justify-between">
            <button onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 border-2 border-slate-300 rounded-xl font-semibold hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4" />
              Back to List
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700">
              <Printer className="w-5 h-5" />
              Print Invoice
            </button>
          </div>
        </div>

        {/* Printable Invoice */}
        <div className="invoice-print-content bg-white max-w-4xl mx-auto my-6 shadow-2xl">
          <div className="p-12">
            {/* Header */}
            <div className="text-center border-b-4 border-blue-600 pb-6 mb-6">
              <h1 className="text-4xl font-bold text-blue-600 mb-2">{hospitalDetails.name}</h1>
              <p className="text-slate-600">{hospitalDetails.address}</p>
              <p className="text-slate-600">Phone: {hospitalDetails.phone} | Email: {hospitalDetails.email}</p>
              {hospitalDetails.gstin && <p className="text-sm text-slate-500">GSTIN: {hospitalDetails.gstin}</p>}
              <p className="text-sm text-slate-500">Reg. No: {hospitalDetails.registrationNo}</p>
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-bold text-lg text-blue-600 mb-3">Patient Details</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {invoiceData.patientName || selectedInvoice.patient_name}</p>
                  <p><strong>Phone:</strong> {invoiceData.patientPhone || selectedInvoice.patient_phone}</p>
                  <p><strong>Address:</strong> {invoiceData.patientAddress || selectedInvoice.patient_address}</p>
                  {invoiceData.patientAge && (
                    <p><strong>Age/Gender:</strong> {invoiceData.patientAge} / {invoiceData.patientGender}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="bg-blue-50 p-4 rounded-lg inline-block">
                  <h3 className="font-bold text-2xl text-blue-600 mb-2">{selectedInvoice.invoice_number}</h3>
                  <p className="text-sm">
                    <strong>Date:</strong> {new Date(invoiceData.invoiceDate || selectedInvoice.invoice_date).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-sm">
                    <strong>Doctor:</strong> {invoiceData.doctorName || selectedInvoice.doctor_name}
                  </p>
                  {invoiceData.followupDate && (
                    <p className="text-sm text-emerald-600">
                      <strong>Next Visit:</strong> {new Date(invoiceData.followupDate).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Consultation */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-3 pb-2 border-b-2">Consultation</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-3">Description</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">
                      Consultation Fee - Dr. {invoiceData.doctorName || selectedInvoice.doctor_name}
                    </td>
                    <td className="text-right p-3">
                      ₹{parseFloat(invoiceData.consultationFee || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Treatments */}
            {invoiceData.treatments && invoiceData.treatments.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 pb-2 border-b-2">Treatments & Procedures</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3">Treatment</th>
                      <th className="text-right p-3">Charges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.treatments.map((treatment, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3">{treatment.name}</td>
                        <td className="text-right p-3">₹{parseFloat(treatment.charges || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Medicines */}
            {invoiceData.medicines && invoiceData.medicines.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 pb-2 border-b-2">Medicines & Pharmacy</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3">Medicine</th>
                      <th className="text-center p-3">HSN</th>
                      <th className="text-center p-3">Batch</th>
                      <th className="text-center p-3">Qty</th>
                      <th className="text-right p-3">Rate</th>
                      <th className="text-right p-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.medicines.map((med, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-3">{med.name}</td>
                        <td className="text-center p-3 text-xs">{med.hsnCode || '-'}</td>
                        <td className="text-center p-3 text-xs">{med.batchNo || '-'}</td>
                        <td className="text-center p-3">{med.quantity}</td>
                        <td className="text-right p-3">₹{parseFloat(med.unitPrice || 0).toFixed(2)}</td>
                        <td className="text-right p-3">
                          ₹{(parseFloat(med.quantity || 0) * parseFloat(med.unitPrice || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div className="border-t-2 border-slate-300 pt-6">
              <div className="flex justify-end">
                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount:</span>
                      <span className="font-semibold">- ₹{totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>GST (18%):</span>
                    <span className="font-semibold">₹{totals.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t-2 border-blue-600 pt-3">
                    <span>Total Amount:</span>
                    <span className="text-blue-600">₹{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm"><strong>Notes:</strong> {invoiceData.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t-2 text-center text-sm text-slate-600">
              <p className="font-semibold mb-2">Thank you for choosing {hospitalDetails.name}</p>
              <p>This is a computer-generated invoice and does not require signature</p>
              {invoiceData.followupDate && (
                <p className="mt-2 text-emerald-600 font-semibold">
                  Please visit us on {new Date(invoiceData.followupDate).toLocaleDateString('en-IN')} for follow-up
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InvoiceModule;
