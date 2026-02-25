import React, { useRef } from 'react';
import { Printer, Download, X, Receipt as ReceiptIcon } from 'lucide-react';

const MedicineSalesReceipt = ({ sale, onClose, receiptType = 'A4' }) => {
  const printRef = useRef();

  // Hospital Details
  const hospitalInfo = {
    name: 'Tatva Ayurved Hospital',
    address: 'Thekkuveedu Lane, Kannur Rd., Near Christian College',
    city: 'Kozhikode, Kerala - 673001',
    phone: '+91 9895112264',
    gstin: '32XXXXX1234X1ZX',
    logo: '/tatva.jpg'
  };

  // GST Calculation
  const GST_RATE = 12;
  const subtotal = sale.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const gstAmount = (subtotal * GST_RATE) / 100;
  const total = subtotal + gstAmount;

  const handlePrint = () => {
    window.print();
  };

  // Thermal Receipt Format (for 80mm thermal printers)
  if (receiptType === 'thermal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full">
          {/* Header - No print */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between print:hidden">
            <h3 className="font-bold text-slate-800">Thermal Receipt</h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button onClick={onClose} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Thermal Receipt Content */}
          <div ref={printRef} className="p-6 font-mono text-sm" style={{ width: '300px' }}>
            {/* Logo (small) */}
            <div className="text-center mb-2">
              <img 
                src="/tatva.jpg" 
                alt="Tatva" 
                className="w-16 h-16 mx-auto object-contain mb-2"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>

            {/* Hospital Info */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
              <p className="font-bold text-base">{hospitalInfo.name}</p>
              <p className="text-xs">{hospitalInfo.address}</p>
              <p className="text-xs">{hospitalInfo.city}</p>
              <p className="text-xs">Ph: {hospitalInfo.phone}</p>
              <p className="text-xs">GSTIN: {hospitalInfo.gstin}</p>
            </div>

            {/* Receipt Details */}
            <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-xs">
              <div className="flex justify-between">
                <span>Receipt No:</span>
                <span className="font-bold">{sale.receipt_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(sale.date).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{new Date(sale.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {sale.customer_name && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{sale.customer_name}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-1">Item</th>
                    <th className="text-center py-1">Qty</th>
                    <th className="text-right py-1">Rate</th>
                    <th className="text-right py-1">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-1 text-xs">{item.name}</td>
                      <td className="text-center py-1">{item.quantity}</td>
                      <td className="text-right py-1">{item.unit_price.toFixed(2)}</td>
                      <td className="text-right py-1 font-semibold">
                        {(item.quantity * item.unit_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (6%):</span>
                <span>₹{(gstAmount / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (6%):</span>
                <span>₹{(gstAmount / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
                <span>TOTAL:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment */}
            <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-xs">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="capitalize">{sale.payment_method || 'Cash'}</span>
              </div>
              {sale.paid_amount && (
                <>
                  <div className="flex justify-between">
                    <span>Paid:</span>
                    <span>₹{sale.paid_amount.toFixed(2)}</span>
                  </div>
                  {sale.paid_amount > total && (
                    <div className="flex justify-between">
                      <span>Change:</span>
                      <span>₹{(sale.paid_amount - total).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs">
              <p className="font-bold mb-1">Thank You!</p>
              <p>Visit Again</p>
              <p className="mt-2 text-xs">Ayurveda for Health & Happiness</p>
              <p className="mt-2 text-xs">No exchange or return</p>
            </div>
          </div>
        </div>

        <style jsx>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print\\:hidden {
              display: none !important;
            }
            ${printRef.current ? `
            #printable-receipt,
            #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
            }
            ` : ''}
          }
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
        `}</style>
      </div>
    );
  }

  // A4 Format Receipt
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-auto">
        {/* Header Actions */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between print:hidden">
          <h3 className="text-xl font-bold text-slate-800">Sales Receipt</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={printRef} className="p-8">
          {/* Header with Logo */}
          <div className="border-3 border-emerald-600 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <img 
                  src="/tatva.jpg" 
                  alt="Tatva Ayurved" 
                  className="w-16 h-16 object-contain"
                  onError={(e) => e.target.style.display = 'none'}
                />
                <div>
                  <h1 className="text-2xl font-bold text-emerald-800">{hospitalInfo.name}</h1>
                  <p className="text-emerald-600 text-sm font-semibold">Ayurveda for Health & Happiness</p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-emerald-600 text-white px-4 py-1 rounded text-sm font-bold mb-1">
                  SALES RECEIPT
                </div>
                <p className="text-xs text-slate-600">GST Invoice</p>
              </div>
            </div>

            <div className="pt-3 border-t border-emerald-200 text-sm">
              <p className="text-slate-700">{hospitalInfo.address}</p>
              <p className="text-slate-700">{hospitalInfo.city}</p>
              <div className="flex justify-between mt-2">
                <p className="text-slate-600">Phone: {hospitalInfo.phone}</p>
                <p className="text-slate-600">GSTIN: {hospitalInfo.gstin}</p>
              </div>
            </div>
          </div>

          {/* Receipt Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-600 mb-2">Receipt Details</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Receipt No:</span>
                  <span className="font-bold">{sale.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Date:</span>
                  <span>{new Date(sale.date).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Time:</span>
                  <span>{new Date(sale.date).toLocaleTimeString('en-IN')}</span>
                </div>
              </div>
            </div>

            {sale.customer_name && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-600 mb-2">Customer Details</p>
                <div className="text-sm">
                  <p className="font-semibold">{sale.customer_name}</p>
                  {sale.customer_phone && <p className="text-slate-600">{sale.customer_phone}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table className="w-full border border-slate-300 mb-6">
            <thead>
              <tr className="bg-emerald-600 text-white">
                <th className="px-3 py-2 text-left text-sm">S.No</th>
                <th className="px-3 py-2 text-left text-sm">Medicine</th>
                <th className="px-3 py-2 text-center text-sm">Batch</th>
                <th className="px-3 py-2 text-center text-sm">Qty</th>
                <th className="px-3 py-2 text-right text-sm">Rate (₹)</th>
                <th className="px-3 py-2 text-right text-sm">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="px-3 py-2 text-sm">{idx + 1}</td>
                  <td className="px-3 py-2 text-sm font-semibold">{item.name}</td>
                  <td className="px-3 py-2 text-sm text-center font-mono text-xs">{item.batch}</td>
                  <td className="px-3 py-2 text-sm text-center font-semibold">{item.quantity}</td>
                  <td className="px-3 py-2 text-sm text-right">{item.unit_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-sm text-right font-bold">
                    {(item.quantity * item.unit_price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-80">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">CGST (6%):</span>
                  <span className="font-semibold">₹{(gstAmount / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">SGST (6%):</span>
                  <span className="font-semibold">₹{(gstAmount / 2).toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-slate-300 pt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">TOTAL:</span>
                    <span className="text-xl font-bold text-emerald-700">₹{total.toFixed(2)}</span>
                  </div>
                </div>
                {sale.paid_amount && (
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Payment Mode:</span>
                    <span className="font-semibold capitalize">{sale.payment_method || 'Cash'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <p className="text-sm">
              <span className="font-bold">Amount in Words: </span>
              <span className="capitalize">{numberToWords(total)} Rupees Only</span>
            </p>
          </div>

          {/* Terms */}
          <div className="text-xs text-slate-600 mb-6">
            <p className="font-semibold mb-1">Terms & Conditions:</p>
            <p>• Medicines once sold cannot be returned • Keep away from direct sunlight</p>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-emerald-600 pt-4 flex justify-between items-end">
            <div>
              <p className="text-xs font-semibold mb-2">For {hospitalInfo.name}</p>
              <div className="h-12 border-b border-slate-400 mb-1" style={{ width: '150px' }}></div>
              <p className="text-xs">Authorized Signatory</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-700 mb-1">Thank You!</p>
              <p className="text-xs text-slate-600">For queries: {hospitalInfo.phone}</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      `}</style>
    </div>
  );
};

// Helper function (same as in PatientInvoice)
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  const numStr = Math.floor(num).toString();
  let words = '';

  if (numStr.length > 7) {
    const crores = parseInt(numStr.slice(0, -7));
    words += numberToWords(crores) + ' Crore ';
  }

  if (numStr.length > 5) {
    const lakhs = parseInt(numStr.slice(-7, -5) || '0');
    if (lakhs > 0) {
      words += numberToWords(lakhs) + ' Lakh ';
    }
  }

  if (numStr.length > 3) {
    const thousands = parseInt(numStr.slice(-5, -3) || '0');
    if (thousands > 0) {
      words += numberToWords(thousands) + ' Thousand ';
    }
  }

  const hundreds = parseInt(numStr.slice(-3, -2) || '0');
  if (hundreds > 0) {
    words += ones[hundreds] + ' Hundred ';
  }

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

  return words.trim();
}

export default MedicineSalesReceipt;
