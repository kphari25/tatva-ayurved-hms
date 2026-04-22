import React, { useState, useEffect } from 'react';
import { X, Printer, Save, Plus, Trash2, FileText, Search } from 'lucide-react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const InvoiceModal = ({ patient, onClose, onSave }) => {
  const [invoiceType, setInvoiceType] = useState('OP'); // OP or IP
  const [saving, setSaving] = useState(false);
  const [allMedicines, setAllMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    treatment_charges: 0,
    medicines: [],
    room_rent: 0,
    room_type: '',
    days: 0,
    mess_charges: 0,
    mess_days: 0,
    gst_percentage: 18,
    discount: 0,
    payment_mode: 'Cash',
    notes: ''
  });

  const [newMedicine, setNewMedicine] = useState({
    name: '',
    quantity: 1,
    rate: 0
  });

  // Load medicines from Firebase on mount
  useEffect(() => {
    loadMedicines();
  }, []);

  // Filter medicines based on search
  useEffect(() => {
    if (!medicineSearch.trim()) {
      setFilteredMedicines([]);
      return;
    }

    const searchTerm = medicineSearch.toLowerCase();
    const filtered = allMedicines
      .filter(med => 
        (med.item_code || '').toLowerCase().includes(searchTerm) ||
        (med.item_name || '').toLowerCase().includes(searchTerm)
      )
      .slice(0, 10); // Limit to 10 suggestions

    setFilteredMedicines(filtered);
  }, [medicineSearch, allMedicines]);

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      const medicines = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAllMedicines(medicines);
      console.log(`✅ Loaded ${medicines.length} medicines for autocomplete`);
      
    } catch (error) {
      console.error('Error loading medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMedicineSelect = (medicine) => {
    setNewMedicine({
      name: medicine.item_name || medicine.item_code,
      item_code: medicine.item_code,
      quantity: 1,
      rate: parseFloat(medicine.mrp) || 0,
      availableStock: medicine.stock_quantity,
      medicineId: medicine.id
    });
    setMedicineSearch(`${medicine.item_code} - ${medicine.item_name}`);
    setShowMedicineSuggestions(false);
    setFilteredMedicines([]);
  };

  const calculateSubtotal = () => {
    let subtotal = parseFloat(formData.treatment_charges) || 0;

    // Add medicines
    formData.medicines.forEach(med => {
      subtotal += (parseFloat(med.quantity) || 0) * (parseFloat(med.rate) || 0);
    });

    // IP specific charges
    if (invoiceType === 'IP') {
      subtotal += (parseFloat(formData.room_rent) || 0) * (parseFloat(formData.days) || 0);
      subtotal += (parseFloat(formData.mess_charges) || 0) * (parseFloat(formData.mess_days) || 0);
    }

    return subtotal;
  };

  const calculateGST = () => {
    const subtotal = calculateSubtotal();
    return (subtotal * (parseFloat(formData.gst_percentage) || 0)) / 100;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const gst = calculateGST();
    const discount = parseFloat(formData.discount) || 0;
    return subtotal + gst - discount;
  };

  const handleAddMedicine = () => {
    if (!newMedicine.name || !newMedicine.rate) {
      alert('Please enter medicine name and rate');
      return;
    }

    setFormData({
      ...formData,
      medicines: [...formData.medicines, { 
        name: newMedicine.name,
        item_code: newMedicine.item_code || '',
        quantity: newMedicine.quantity,
        rate: newMedicine.rate,
        medicineId: newMedicine.medicineId || null,
        availableStock: newMedicine.availableStock || 0
      }]
    });

    setNewMedicine({ name: '', quantity: 1, rate: 0 });
    setMedicineSearch('');
  };

  const handleRemoveMedicine = (index) => {
    setFormData({
      ...formData,
      medicines: formData.medicines.filter((_, i) => i !== index)
    });
  };

  const handleSaveInvoice = async () => {
    try {
      setSaving(true);

      const invoiceData = {
        patient_id: patient.firebaseId || patient.id,
        patient_number: patient.patient_number,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        patient_phone: patient.phone,
        patient_address: patient.address,
        invoice_type: invoiceType,
        invoice_date: formData.invoice_date,
        treatment_charges: parseFloat(formData.treatment_charges) || 0,
        medicines: formData.medicines,
        room_rent: invoiceType === 'IP' ? parseFloat(formData.room_rent) || 0 : 0,
        room_type: invoiceType === 'IP' ? formData.room_type : '',
        days: invoiceType === 'IP' ? parseFloat(formData.days) || 0 : 0,
        mess_charges: invoiceType === 'IP' ? parseFloat(formData.mess_charges) || 0 : 0,
        mess_days: invoiceType === 'IP' ? parseFloat(formData.mess_days) || 0 : 0,
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

  const handlePrint = (invoiceData = null) => {
    const data = invoiceData || {
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_number: patient.patient_number,
      patient_phone: patient.phone,
      patient_address: patient.address,
      invoice_type: invoiceType,
      invoice_date: formData.invoice_date,
      treatment_charges: parseFloat(formData.treatment_charges) || 0,
      medicines: formData.medicines,
      room_rent: parseFloat(formData.room_rent) || 0,
      room_type: formData.room_type,
      days: parseFloat(formData.days) || 0,
      mess_charges: parseFloat(formData.mess_charges) || 0,
      mess_days: parseFloat(formData.mess_days) || 0,
      subtotal: calculateSubtotal(),
      gst_percentage: parseFloat(formData.gst_percentage) || 0,
      gst_amount: calculateGST(),
      discount: parseFloat(formData.discount) || 0,
      total_amount: calculateTotal(),
      payment_mode: formData.payment_mode,
      notes: formData.notes
    };

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${data.patient_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #14b8a6; padding-bottom: 10px; }
          .header img { height: 80px; margin-bottom: 10px; }
          .header h1 { color: #14b8a6; margin: 10px 0; }
          .header .tagline { color: #666; font-size: 14px; margin: 5px 0; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info-box { flex: 1; }
          .info-box h3 { margin: 0 0 10px 0; color: #14b8a6; }
          .badge { display: inline-block; padding: 5px 15px; background: #14b8a6; color: white; border-radius: 5px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #14b8a6; color: white; }
          .totals { float: right; width: 300px; margin-top: 20px; }
          .totals table { margin: 0; }
          .totals .grand-total { background: #14b8a6; color: white; font-weight: bold; font-size: 18px; }
          .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'">
          <h1>Tatva Ayurved</h1>
          <p class="tagline">Ayurveda for Health & Happiness</p>
          <p style="margin: 5px 0; font-size: 12px;">Hospital Management System</p>
          <p style="margin: 5px 0; font-size: 12px;">Phone: [Your Contact] | Email: [Your Email]</p>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <span class="badge">${data.invoice_type === 'OP' ? 'OUT PATIENT (O/P)' : 'IN PATIENT (I/P)'}</span>
        </div>

        <div class="info">
          <div class="info-box">
            <h3>Patient Details:</h3>
            <p><strong>Name:</strong> ${data.patient_name}</p>
            <p><strong>Patient ID:</strong> ${data.patient_number}</p>
            <p><strong>Phone:</strong> ${data.patient_phone || 'N/A'}</p>
            <p><strong>Address:</strong> ${data.patient_address || 'N/A'}</p>
          </div>
          <div class="info-box" style="text-align: right;">
            <h3>Invoice Details:</h3>
            <p><strong>Date:</strong> ${new Date(data.invoice_date).toLocaleDateString()}</p>
            <p><strong>Invoice Type:</strong> ${data.invoice_type}</p>
            <p><strong>Payment Mode:</strong> ${data.payment_mode}</p>
          </div>
        </div>

        <h3>Charges Breakdown:</h3>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity/Days</th>
              <th>Rate (₹)</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${data.treatment_charges > 0 ? `
              <tr>
                <td>Treatment Charges</td>
                <td>-</td>
                <td>-</td>
                <td>₹${data.treatment_charges.toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${data.invoice_type === 'IP' && data.room_rent > 0 ? `
              <tr>
                <td>Room Rent (${data.room_type})</td>
                <td>${data.days} days</td>
                <td>₹${data.room_rent.toFixed(2)}</td>
                <td>₹${(data.room_rent * data.days).toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${data.invoice_type === 'IP' && data.mess_charges > 0 ? `
              <tr>
                <td>Mess Charges</td>
                <td>${data.mess_days} days</td>
                <td>₹${data.mess_charges.toFixed(2)}</td>
                <td>₹${(data.mess_charges * data.mess_days).toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${data.medicines.map(med => `
              <tr>
                <td>Medicine: ${med.name}</td>
                <td>${med.quantity}</td>
                <td>₹${parseFloat(med.rate).toFixed(2)}</td>
                <td>₹${(med.quantity * med.rate).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">₹${data.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>GST (${data.gst_percentage}%):</td>
              <td style="text-align: right;">₹${data.gst_amount.toFixed(2)}</td>
            </tr>
            ${data.discount > 0 ? `
              <tr>
                <td>Discount:</td>
                <td style="text-align: right; color: red;">-₹${data.discount.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="grand-total">
              <td>TOTAL:</td>
              <td style="text-align: right;">₹${data.total_amount.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="clear: both;"></div>

        ${data.notes ? `
          <div style="margin-top: 30px;">
            <strong>Notes:</strong>
            <p>${data.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for choosing Tatva Ayurved Hospital</p>
          <p>This is a computer-generated invoice</p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 30px; background: #14b8a6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
            Print Invoice
          </button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-2xl font-bold">Generate Invoice</h2>
              <p className="text-teal-100 text-sm">
                {patient.first_name} {patient.last_name} - {patient.patient_number}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
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

          {/* Treatment Charges */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Treatment Charges (₹)</label>
            <input
              type="number"
              value={formData.treatment_charges}
              onChange={(e) => setFormData({ ...formData, treatment_charges: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="0.00"
            />
          </div>

          {/* IP Specific Fields */}
          {invoiceType === 'IP' && (
            <>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-4">In-Patient Charges</h3>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
                    <select
                      value={formData.room_type}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Type</option>
                      <option value="General Ward">General Ward</option>
                      <option value="Semi-Private">Semi-Private</option>
                      <option value="Private">Private</option>
                      <option value="Deluxe">Deluxe</option>
                      <option value="ICU">ICU</option>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Days</label>
                    <input
                      type="number"
                      value={formData.days}
                      onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mess Charges/Day (₹)</label>
                    <input
                      type="number"
                      value={formData.mess_charges}
                      onChange={(e) => setFormData({ ...formData, mess_charges: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mess Days</label>
                    <input
                      type="number"
                      value={formData.mess_days}
                      onChange={(e) => setFormData({ ...formData, mess_days: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Medicines */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Medicines</h3>
            
            {/* Add Medicine Form */}
            <div className="bg-gray-50 p-4 rounded-lg mb-3">
              <div className="grid grid-cols-4 gap-3 mb-3">
                {/* Medicine Search with Autocomplete */}
                <div className="col-span-2 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicine</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={medicineSearch}
                      onChange={(e) => {
                        setMedicineSearch(e.target.value);
                        setShowMedicineSuggestions(true);
                      }}
                      onFocus={() => setShowMedicineSuggestions(true)}
                      placeholder="Search medicine..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Autocomplete Suggestions */}
                  {showMedicineSuggestions && filteredMedicines.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredMedicines.map((medicine) => (
                        <div
                          key={medicine.id}
                          onClick={() => handleMedicineSelect(medicine)}
                          className="px-4 py-2 hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{medicine.item_code}</div>
                          <div className="text-sm text-gray-600">{medicine.item_name}</div>
                          <div className="text-xs text-teal-600 mt-1">
                            Stock: {medicine.stock_quantity} • MRP: ₹{medicine.mrp}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Loading indicator */}
                  {loading && (
                    <div className="absolute right-3 top-9 text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-600 rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newMedicine.quantity}
                    onChange={(e) => setNewMedicine({ ...newMedicine, quantity: parseInt(e.target.value) || 1 })}
                    placeholder="Qty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₹)</label>
                  <input
                    type="number"
                    value={newMedicine.rate}
                    onChange={(e) => setNewMedicine({ ...newMedicine, rate: parseFloat(e.target.value) || 0 })}
                    placeholder="Rate ₹"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {newMedicine.availableStock !== undefined && (
                <div className="mb-2 text-sm text-gray-600">
                  Available Stock: <span className="font-semibold text-teal-600">{newMedicine.availableStock}</span>
                </div>
              )}

              <button
                onClick={handleAddMedicine}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Medicine
              </button>
            </div>

            {/* Medicine List */}
            {formData.medicines.length > 0 && (
              <div className="space-y-2">
                {formData.medicines.map((med, index) => (
                  <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">{med.name}</div>
                      <div className="text-gray-700">Qty: {med.quantity}</div>
                      <div className="text-gray-700">₹{(med.quantity * med.rate).toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedicine(index)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                <span>Subtotal:</span>
                <span>₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST ({formData.gst_percentage}%):</span>
                <span>₹{calculateGST().toFixed(2)}</span>
              </div>
              {formData.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>-₹{parseFloat(formData.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-bold pt-2 border-t border-teal-500">
                <span>TOTAL:</span>
                <span>₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
