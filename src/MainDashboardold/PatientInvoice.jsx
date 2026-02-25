import React, { useRef } from 'react';
import { Printer, Download, X, FileText, Phone, MapPin, Calendar, User } from 'lucide-react';

const PatientInvoice = ({ invoice, patient, prescriptionItems, onClose }) => {
  const printRef = useRef();

  // Hospital Details
  const hospitalInfo = {
    name: 'Tatva Ayurved Hospital',
    address: 'Thekkuveedu Lane, Kannur Rd.',
    addressLine2: 'Near Christian College',
    city: 'Kozhikode, Kerala - 673001',
    phone: '+91 9895112264',
    email: 'info@tatvaayurved.com',
    gstin: '32XXXXX1234X1ZX', // Replace with actual GSTIN
    logo: '/tatva-logo.jpg' // Path to logo
  };

  // GST Rates
  const GST_RATE = 12; // 12% GST on medicines (CGST 6% + SGST 6%)
  
  // Calculate totals
  const subtotal = prescriptionItems.reduce((sum, item) => sum + item.total_price, 0);
  const cgst = (subtotal * (GST_RATE / 2)) / 100;
  const sgst = (subtotal * (GST_RATE / 2)) / 100;
  const totalGst = cgst + sgst;
  const grandTotal = subtotal + totalGst;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // In production, use a library like jsPDF or html2pdf
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-auto">
        {/* Header Actions - Only visible on screen, not in print */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between print:hidden">
          <h3 className="text-xl font-bold text-slate-800">Patient Invoice</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Content - This will be printed */}
        <div ref={printRef} className="p-8 print:p-12">
          {/* Hospital Header */}
          <div className="border-4 border-emerald-600 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <img 
                  src="/tatva.jpg" 
                  alt="Tatva Ayurved" 
                  className="w-20 h-20 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <h1 className="text-3xl font-bold text-emerald-800">{hospitalInfo.name}</h1>
                  <p className="text-emerald-600 font-semibold">Ayurveda for Health & Happiness</p>
                </div>
              </div>

              {/* Invoice Type */}
              <div className="text-right">
                <div className="bg-emerald-600 text-white px-6 py-2 rounded-lg inline-block mb-2">
                  <p className="text-sm font-semibold">TAX INVOICE</p>
                </div>
                <p className="text-sm text-slate-600">GSTIN: {hospitalInfo.gstin}</p>
              </div>
            </div>

            {/* Hospital Address & Contact */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t-2 border-emerald-200">
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                  <div className="text-sm text-slate-700">
                    <p className="font-semibold">{hospitalInfo.address}</p>
                    <p>{hospitalInfo.addressLine2}</p>
                    <p>{hospitalInfo.city}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-700">{hospitalInfo.phone}</p>
                </div>
                <p className="text-sm text-slate-600">{hospitalInfo.email}</p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Patient Details */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                PATIENT DETAILS
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Name:</span>
                  <span className="font-semibold text-slate-800">
                    {patient.first_name} {patient.last_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Patient ID:</span>
                  <span className="font-semibold text-slate-800">{patient.patient_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Phone:</span>
                  <span className="font-semibold text-slate-800">{patient.phone}</span>
                </div>
                {patient.address && (
                  <div className="pt-2 border-t border-slate-200 mt-2">
                    <span className="text-slate-600">Address:</span>
                    <p className="font-semibold text-slate-800 text-xs mt-1">{patient.address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Details */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                INVOICE DETAILS
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice No:</span>
                  <span className="font-bold text-blue-800">{invoice.bill_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(invoice.bill_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Time:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date().toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment Mode:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {invoice.payment_method || 'Cash'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full border-2 border-slate-300">
              <thead>
                <tr className="bg-emerald-600 text-white">
                  <th className="px-4 py-3 text-left text-sm font-bold border-r border-emerald-500">S.No</th>
                  <th className="px-4 py-3 text-left text-sm font-bold border-r border-emerald-500">Medicine Name</th>
                  <th className="px-4 py-3 text-center text-sm font-bold border-r border-emerald-500">Batch No.</th>
                  <th className="px-4 py-3 text-center text-sm font-bold border-r border-emerald-500">Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-bold border-r border-emerald-500">Rate (₹)</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {prescriptionItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm border-r border-slate-200">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold border-r border-slate-200">
                      {item.medicine_name}
                      {item.dosage && (
                        <p className="text-xs text-slate-500 mt-1">
                          {item.dosage} • {item.frequency} • {item.duration}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-mono border-r border-slate-200">
                      {item.batch_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-semibold border-r border-slate-200">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold border-r border-slate-200">
                      {item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      {item.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* GST Breakdown (Left) */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h4 className="text-sm font-bold text-slate-700 mb-3">GST BREAKDOWN</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Taxable Amount:</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">CGST @ 6%:</span>
                  <span className="font-semibold">₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">SGST @ 6%:</span>
                  <span className="font-semibold">₹{sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-amber-300">
                  <span className="font-bold text-slate-700">Total GST:</span>
                  <span className="font-bold text-amber-800">₹{totalGst.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Amount Totals (Right) */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-800">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total GST (12%):</span>
                  <span className="font-semibold text-slate-800">₹{totalGst.toFixed(2)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Discount:</span>
                    <span className="font-semibold text-emerald-600">- ₹{invoice.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t-2 border-slate-300 pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-slate-800">GRAND TOTAL:</span>
                    <span className="text-2xl font-bold text-emerald-700">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
                {invoice.paid_amount > 0 && (
                  <>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                      <span className="text-slate-600">Paid Amount:</span>
                      <span className="font-semibold text-blue-600">₹{invoice.paid_amount.toFixed(2)}</span>
                    </div>
                    {invoice.balance_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Balance Due:</span>
                        <span className="font-bold text-red-600">₹{invoice.balance_amount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm">
              <span className="font-bold text-slate-700">Amount in Words: </span>
              <span className="text-slate-800 font-semibold capitalize">
                {numberToWords(grandTotal)} Rupees Only
              </span>
            </p>
          </div>

          {/* Terms & Conditions */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-slate-700 mb-2">TERMS & CONDITIONS:</h4>
            <ul className="text-xs text-slate-600 space-y-1 ml-4">
              <li>• Medicines once sold cannot be returned or exchanged</li>
              <li>• Please check the medicines before leaving the counter</li>
              <li>• Keep medicines away from direct sunlight and moisture</li>
              <li>• Follow dosage instructions as prescribed by the doctor</li>
              <li>• This is a computer-generated invoice and does not require signature</li>
            </ul>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-emerald-600 pt-4">
            <div className="flex justify-between items-end">
              <div className="text-xs text-slate-600">
                <p className="font-semibold mb-1">For {hospitalInfo.name}</p>
                <div className="h-16 flex items-end">
                  <p className="border-t border-slate-400 pt-1">Authorized Signatory</p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p className="font-semibold text-emerald-700">Thank you for choosing Tatva Ayurved!</p>
                <p className="mt-1">For queries: {hospitalInfo.phone}</p>
                <p className="text-slate-500 mt-2">Page 1 of 1</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          ${printRef.current && printRef.current.parentElement ? `
          #printable-content,
          #printable-content * {
            visibility: visible;
          }
          #printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          ` : ''}
        }
        @page {
          size: A4;
          margin: 10mm;
        }
      `}</style>
    </div>
  );
};

// Helper function to convert number to words (Indian numbering system)
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  const numStr = Math.floor(num).toString();
  let words = '';

  // Handle crores (10,000,000)
  if (numStr.length > 7) {
    const crores = parseInt(numStr.slice(0, -7));
    words += numberToWords(crores) + ' Crore ';
  }

  // Handle lakhs (100,000)
  if (numStr.length > 5) {
    const lakhs = parseInt(numStr.slice(-7, -5) || '0');
    if (lakhs > 0) {
      words += numberToWords(lakhs) + ' Lakh ';
    }
  }

  // Handle thousands
  if (numStr.length > 3) {
    const thousands = parseInt(numStr.slice(-5, -3) || '0');
    if (thousands > 0) {
      words += numberToWords(thousands) + ' Thousand ';
    }
  }

  // Handle hundreds
  const hundreds = parseInt(numStr.slice(-3, -2) || '0');
  if (hundreds > 0) {
    words += ones[hundreds] + ' Hundred ';
  }

  // Handle tens and ones
  const lastTwo = parseInt(numStr.slice(-2));
  if (lastTwo >= 20) {
    const tensDigit = Math.floor(lastTwo / 10);
    const onesDigit = lastTwo % 10;
    words += tens[tensDigit] + ' ' + ones[onesDigit];
  } else if (lastTwo >= 10) {
    words += teens[lastTwo - 10];
  } else if (lastTwo > 0) {
    words += ones[lastTwo];
  }

  // Handle decimals (paise)
  const decimal = Math.round((num - Math.floor(num)) * 100);
  if (decimal > 0) {
    words += ' and ' + numberToWords(decimal) + ' Paise';
  }

  return words.trim();
}

export default PatientInvoice;
