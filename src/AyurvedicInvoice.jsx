import React, { useState, useRef } from 'react';
import { 
  Calendar, User, MapPin, Phone, FileText, 
  Printer, Save, X, Plus, Trash2, Building2
} from 'lucide-react';

const AyurvedicInvoice = ({ onClose, invoiceType = 'OP' }) => {
  const printRef = useRef();
  
  const [invoiceData, setInvoiceData] = useState({
    // Hospital Details
    hospitalName: 'Tatva Ayurved Healthcare Center',
    hospitalAddress: 'Plot No. 123, Main Road, City - 400001',
    hospitalGSTIN: '27AAAAA0000A1Z5',
    hospitalContact: '+91 98765 43210',
    hospitalEmail: 'info@tatvaayurved.com',
    
    // Invoice Details
    invoiceNumber: `INV-${invoiceType}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    
    // Patient Details
    patientID: '',
    patientName: '',
    patientAge: '',
    patientGender: 'Male',
    patientAddress: '',
    patientContact: '',
    
    // Visit Details
    dateOfVisit: new Date().toISOString().split('T')[0],
    dateOfAdmission: '',
    dateOfDischarge: '',
    consultantDoctor: '',
    
    // IP Specific
    roomCategory: 'General',
    numberOfDays: 1,
    
    // Payment
    paymentMode: 'Cash',
    
    // Items
    items: []
  });

  // Predefined service categories
  const ipServices = [
    { category: 'Room Rent', items: ['General Ward', 'Semi-Private', 'Private', 'Deluxe'] },
    { category: 'Treatment Charges', items: ['Panchakarma', 'Abhyanga', 'Shirodhara', 'Kadi Vasti', 'Basti Therapy'] },
    { category: 'Mess/Diet Charges', items: ['Ayurvedic Diet - General', 'Ayurvedic Diet - Special', 'Therapeutic Diet'] },
    { category: 'Medicine Charges', items: ['Internal Medicines', 'External Medicines', 'Herbal Supplements'] },
    { category: 'Other Charges', items: ['Doctor Consultation', 'Investigations', 'Nursing Care'] }
  ];

  const opServices = [
    { category: 'Consultation Fee', items: ['Initial Consultation', 'Follow-up Consultation', 'Specialist Consultation'] },
    { category: 'Treatment Charges', items: ['Panchakarma Session', 'Abhyanga', 'Shirodhara', 'Kadi Vasti', 'Nasya'] },
    { category: 'Medicine Charges', items: ['Churna', 'Tailam', 'Kashayam', 'Tablets/Capsules', 'Herbal Products'] },
    { category: 'Diagnostic Charges', items: ['Nadi Pariksha', 'Prakriti Analysis', 'Other Tests'] }
  ];

  const services = invoiceType === 'IP' ? ipServices : opServices;

  const addItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, {
        id: Date.now(),
        category: '',
        description: '',
        quantity: 1,
        rate: 0,
        gstRate: 12,
        amount: 0
      }]
    }));
  };

  const updateItem = (id, field, value) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          
          // Auto-calculate amount
          if (field === 'quantity' || field === 'rate') {
            updated.amount = Number(updated.quantity) * Number(updated.rate);
          }
          
          return updated;
        }
        return item;
      })
    }));
  };

  const removeItem = (id) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalGST = 0;
    
    invoiceData.items.forEach(item => {
      const itemAmount = Number(item.amount) || 0;
      subtotal += itemAmount;
      
      // GST Calculation
      const gstAmount = (itemAmount * Number(item.gstRate || 0)) / 100;
      totalGST += gstAmount;
    });
    
    const grandTotal = subtotal + totalGST;
    
    return {
      subtotal: subtotal.toFixed(2),
      cgst: (totalGST / 2).toFixed(2),
      sgst: (totalGST / 2).toFixed(2),
      totalGST: totalGST.toFixed(2),
      grandTotal: grandTotal.toFixed(2)
    };
  };

  const totals = calculateTotals();

  // Convert number to words (Indian system)
  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    
    const [rupees, paise] = num.toFixed(2).split('.');
    let words = '';
    
    const crore = Math.floor(Number(rupees) / 10000000);
    const lakh = Math.floor((Number(rupees) % 10000000) / 100000);
    const thousand = Math.floor((Number(rupees) % 100000) / 1000);
    const hundred = Math.floor((Number(rupees) % 1000) / 100);
    const remainder = Number(rupees) % 100;
    
    if (crore > 0) words += ones[crore] + ' Crore ';
    if (lakh > 0) words += (lakh < 10 ? ones[lakh] : tens[Math.floor(lakh / 10)] + ' ' + ones[lakh % 10]) + ' Lakh ';
    if (thousand > 0) words += (thousand < 10 ? ones[thousand] : tens[Math.floor(thousand / 10)] + ' ' + ones[thousand % 10]) + ' Thousand ';
    if (hundred > 0) words += ones[hundred] + ' Hundred ';
    
    if (remainder > 0) {
      if (remainder < 10) words += ones[remainder];
      else if (remainder < 20) words += teens[remainder - 10];
      else words += tens[Math.floor(remainder / 10)] + ' ' + ones[remainder % 10];
    }
    
    words = words.trim() + ' Rupees';
    
    if (Number(paise) > 0) {
      words += ' and ' + ones[Math.floor(Number(paise) / 10)] + tens[Number(paise) % 10] + ' Paise';
    }
    
    return words + ' Only';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    console.log('Invoice Data:', invoiceData);
    alert('Invoice saved successfully!');
    // Add your save logic here (e.g., save to database)
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Action Buttons - Hidden in print */}
      <div className="max-w-5xl mx-auto mb-4 print:hidden">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {invoiceType === 'IP' ? 'In-Patient' : 'Out-Patient'} Invoice
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Container */}
      <div ref={printRef} className="max-w-5xl mx-auto bg-white shadow-lg print:shadow-none">
        {/* Header */}
        <div className="border-b-4 border-teal-600 p-8">
          <div className="flex justify-between items-start">
            {/* Logo Placeholder */}
            <div className="w-24 h-24 bg-teal-100 rounded-lg flex items-center justify-center border-2 border-teal-300">
              <Building2 className="w-12 h-12 text-teal-600" />
            </div>
            
            {/* Hospital Details */}
            <div className="text-right">
              <h1 className="text-3xl font-bold text-teal-700 mb-2">{invoiceData.hospitalName}</h1>
              <p className="text-sm text-gray-600">{invoiceData.hospitalAddress}</p>
              <p className="text-sm text-gray-600">GSTIN: {invoiceData.hospitalGSTIN}</p>
              <p className="text-sm text-gray-600">Phone: {invoiceData.hospitalContact}</p>
              <p className="text-sm text-gray-600">Email: {invoiceData.hospitalEmail}</p>
            </div>
          </div>
          
          {/* Invoice Title */}
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {invoiceType === 'IP' ? 'IN-PATIENT' : 'OUT-PATIENT'} INVOICE
            </h2>
            <div className="mt-2 flex justify-center space-x-8 text-sm">
              <div>
                <span className="font-semibold">Invoice No:</span> {invoiceData.invoiceNumber}
              </div>
              <div>
                <span className="font-semibold">Date:</span> {new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Patient & Visit Details - Editable */}
        <div className="p-8 print:p-6">
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Patient Details */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Patient Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="font-semibold w-32">Patient ID:</span>
                  <input
                    type="text"
                    value={invoiceData.patientID}
                    onChange={(e) => setInvoiceData({...invoiceData, patientID: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                    placeholder="Enter Patient ID"
                  />
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Name:</span>
                  <input
                    type="text"
                    value={invoiceData.patientName}
                    onChange={(e) => setInvoiceData({...invoiceData, patientName: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                    placeholder="Enter Patient Name"
                  />
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Age/Gender:</span>
                  <input
                    type="number"
                    value={invoiceData.patientAge}
                    onChange={(e) => setInvoiceData({...invoiceData, patientAge: e.target.value})}
                    className="w-16 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0 mr-2"
                    placeholder="Age"
                  />
                  <select
                    value={invoiceData.patientGender}
                    onChange={(e) => setInvoiceData({...invoiceData, patientGender: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Contact:</span>
                  <input
                    type="tel"
                    value={invoiceData.patientContact}
                    onChange={(e) => setInvoiceData({...invoiceData, patientContact: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                    placeholder="Phone Number"
                  />
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Address:</span>
                  <input
                    type="text"
                    value={invoiceData.patientAddress}
                    onChange={(e) => setInvoiceData({...invoiceData, patientAddress: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                    placeholder="Patient Address"
                  />
                </div>
              </div>
            </div>

            {/* Visit Details */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Visit Details
              </h3>
              <div className="space-y-2 text-sm">
                {invoiceType === 'IP' ? (
                  <>
                    <div className="flex">
                      <span className="font-semibold w-40">Date of Admission:</span>
                      <input
                        type="date"
                        value={invoiceData.dateOfAdmission}
                        onChange={(e) => setInvoiceData({...invoiceData, dateOfAdmission: e.target.value})}
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                      />
                    </div>
                    <div className="flex">
                      <span className="font-semibold w-40">Date of Discharge:</span>
                      <input
                        type="date"
                        value={invoiceData.dateOfDischarge}
                        onChange={(e) => setInvoiceData({...invoiceData, dateOfDischarge: e.target.value})}
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                      />
                    </div>
                    <div className="flex">
                      <span className="font-semibold w-40">Room Category:</span>
                      <select
                        value={invoiceData.roomCategory}
                        onChange={(e) => setInvoiceData({...invoiceData, roomCategory: e.target.value})}
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                      >
                        <option>General</option>
                        <option>Semi-Private</option>
                        <option>Private</option>
                        <option>Deluxe</option>
                      </select>
                    </div>
                    <div className="flex">
                      <span className="font-semibold w-40">Number of Days:</span>
                      <input
                        type="number"
                        value={invoiceData.numberOfDays}
                        onChange={(e) => setInvoiceData({...invoiceData, numberOfDays: e.target.value})}
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex">
                    <span className="font-semibold w-40">Date of Visit:</span>
                    <input
                      type="date"
                      value={invoiceData.dateOfVisit}
                      onChange={(e) => setInvoiceData({...invoiceData, dateOfVisit: e.target.value})}
                      className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                    />
                  </div>
                )}
                <div className="flex">
                  <span className="font-semibold w-40">Consultant Doctor:</span>
                  <input
                    type="text"
                    value={invoiceData.consultantDoctor}
                    onChange={(e) => setInvoiceData({...invoiceData, consultantDoctor: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                    placeholder="Doctor Name"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Billing Items Table */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-700">Billing Details</h3>
              <button
                onClick={addItem}
                className="flex items-center space-x-1 px-3 py-1 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 print:hidden"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead className="bg-teal-50">
                  <tr>
                    <th className="border border-gray-300 px-3 py-2 text-left">S.No</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Category</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Description</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Qty</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Rate (₹)</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">GST %</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Amount (₹)</th>
                    <th className="border border-gray-300 px-3 py-2 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="border border-gray-300 px-3 py-8 text-center text-gray-500">
                        No items added. Click "Add Item" to start billing.
                      </td>
                    </tr>
                  ) : (
                    invoiceData.items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <select
                            value={item.category}
                            onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                            className="w-full border-0 outline-none bg-transparent print:border-0"
                          >
                            <option value="">Select Category</option>
                            {services.map(service => (
                              <option key={service.category} value={service.category}>
                                {service.category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            className="w-full border-0 outline-none print:border-0"
                            placeholder="Description"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            className="w-16 text-center border-0 outline-none print:border-0"
                            min="1"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                            className="w-24 text-right border-0 outline-none print:border-0"
                            min="0"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <select
                            value={item.gstRate}
                            onChange={(e) => updateItem(item.id, 'gstRate', e.target.value)}
                            className="w-16 text-center border-0 outline-none print:border-0"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                          {item.amount.toFixed(2)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center print:hidden">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-6">
            <div className="w-96 border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
                <span className="font-bold text-gray-700">Amount Summary</span>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹ {totals.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>₹ {totals.cgst}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>₹ {totals.sgst}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-bold text-base">Grand Total:</span>
                  <span className="font-bold text-lg text-teal-700">₹ {totals.grandTotal}</span>
                </div>
                <div className="pt-2 border-t border-gray-300">
                  <span className="text-xs font-semibold">Amount in Words:</span>
                  <p className="text-xs mt-1 italic">{numberToWords(Number(totals.grandTotal))}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-gray-700 mb-3">Payment Terms & Bank Details</h3>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <div className="mb-2">
                  <span className="font-semibold">Payment Mode:</span>
                  <select
                    value={invoiceData.paymentMode}
                    onChange={(e) => setInvoiceData({...invoiceData, paymentMode: e.target.value})}
                    className="ml-2 border-b border-gray-300 focus:border-teal-500 outline-none print:border-0"
                  >
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>Net Banking</option>
                    <option>Cheque</option>
                  </select>
                </div>
                <p className="text-gray-600 text-xs mt-2">
                  Payment is due upon receipt of invoice.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">Bank Details:</p>
                <p className="text-xs text-gray-600">Bank Name: State Bank of India</p>
                <p className="text-xs text-gray-600">Account No: 1234567890</p>
                <p className="text-xs text-gray-600">IFSC Code: SBIN0001234</p>
                <p className="text-xs text-gray-600">Branch: Main Branch, City</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-4">
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="text-xs text-gray-600">
                <p className="font-semibold mb-2">Terms & Conditions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>All disputes subject to local jurisdiction only.</li>
                  <li>Refunds will be processed as per our refund policy.</li>
                  <li>Medicines once sold cannot be returned.</li>
                  <li>Please check all items before leaving the counter.</li>
                </ul>
              </div>
              <div className="text-right">
                <div className="mb-8">
                  <p className="text-xs text-gray-600 mb-12">For {invoiceData.hospitalName}</p>
                  <div className="border-t border-gray-400 w-48 ml-auto"></div>
                  <p className="text-xs text-gray-700 mt-1">Authorized Signatory</p>
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-500 italic pt-4 border-t border-gray-200">
              This is a computer-generated invoice and does not require a physical signature.
              <br />
              Thank you for choosing {invoiceData.hospitalName}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
          .print\\:p-6 {
            padding: 1.5rem !important;
          }
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
};

export default AyurvedicInvoice;
