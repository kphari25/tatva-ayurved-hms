import React, { useState, useEffect } from 'react';
import { 
  Calendar, User, MapPin, Phone, FileText, 
  Printer, Save, X, Plus, Trash2, Building2, Eye
} from 'lucide-react';

// ============================================
// 🏥 HOSPITAL INFORMATION - CUSTOMIZE HERE
// ============================================
const HOSPITAL_CONFIG = {
  // Hospital Details
  name: 'Tatva Ayurved Hospital',
  address: 'PThekkuveedu Lane, Kannur Rd., Near Christian College, Kozhikode, Kerala - 673001',
  gstin: '27AAAAA0000A1Z5',
  contact: '+91 9895112264',
  email: 'info@tatvaayurved.com',
  
  // Logo Settings
  logoPath: '/logo.png', // Put your logo in public/logo.png
  showLogo: true, // Set to false to hide logo
  
  // Bank Details
  bankName: 'State Bank of India',
  accountNumber: '1234567890',
  ifscCode: 'SBIN0001234',
  branch: 'Main Branch, City'
};
// ============================================

const AyurvedicInvoice = ({ onClose, invoiceType = 'OP', supabase }) => {
  const [invoiceData, setInvoiceData] = useState({
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

  const [recentInvoices, setRecentInvoices] = useState([]);
  const [showRecentInvoices, setShowRecentInvoices] = useState(false);

  // Load recent invoices from localStorage on component mount
  useEffect(() => {
    loadRecentInvoices();
  }, [invoiceType]);

  const loadRecentInvoices = () => {
    try {
      const saved = localStorage.getItem(`invoices_${invoiceType}`);
      if (saved) {
        setRecentInvoices(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

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
    
    if (num === 0) return 'Zero Rupees Only';
    
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
      const paiseValue = Number(paise);
      if (paiseValue < 10) {
        words += ' and ' + ones[paiseValue] + ' Paise';
      } else if (paiseValue < 20) {
        words += ' and ' + teens[paiseValue - 10] + ' Paise';
      } else {
        words += ' and ' + tens[Math.floor(paiseValue / 10)] + ' ' + ones[paiseValue % 10] + ' Paise';
      }
    }
    
    return words + ' Only';
  };

  const handlePrint = () => {
    console.log('Print button clicked');
    console.log('Invoice data:', invoiceData);
    console.log('Items count:', invoiceData.items.length);
    
    try {
      const printContent = generatePrintHTML();
      console.log('HTML generated, length:', printContent.length);
      
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (!printWindow) {
        alert('Please allow popups for this site to print invoices.\n\nThen click Print again.');
        return;
      }
      
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for content to load before printing
      printWindow.onload = function() {
        console.log('Print window loaded');
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      };
      
    } catch (error) {
      console.error('Print error:', error);
      alert('Error printing invoice: ' + error.message);
    }
  };

  const generatePrintHTML = () => {
    const itemsHTML = invoiceData.items.length > 0 
      ? invoiceData.items.map((item, index) => `
        <tr>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${item.category || '-'}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${item.description || '-'}</td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${item.quantity}</td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">₹${Number(item.rate).toFixed(2)}</td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${item.gstRate}%</td>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: right; font-weight: bold;">₹${Number(item.amount).toFixed(2)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No items added</td></tr>';

    const logoHTML = HOSPITAL_CONFIG.showLogo 
      ? `<img src="${HOSPITAL_CONFIG.logoPath}" alt="Hospital Logo" style="width: 100%; height: 100%; object-fit: contain;" />`
      : `<div style="font-size: 10px; color: #0d9488; font-weight: bold;">LOGO</div>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice - ${invoiceData.invoiceNumber}</title>
        <style>
          @page { size: A4; margin: 0.5cm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { border-bottom: 4px solid #0d9488; padding-bottom: 20px; margin-bottom: 20px; overflow: hidden; }
          .logo { float: left; width: 80px; height: 80px; background: #ccfbf1; border: 2px solid #99f6e4; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 5px; }
          .logo img { width: 100%; height: 100%; object-fit: contain; }
          .hospital-details { float: right; text-align: right; max-width: 60%; }
          .hospital-name { font-size: 24px; font-weight: bold; color: #0f766e; margin-bottom: 5px; }
          .hospital-info { font-size: 12px; color: #666; line-height: 1.5; }
          .invoice-title { clear: both; text-align: center; padding-top: 20px; }
          .invoice-title h2 { font-size: 20px; font-weight: bold; margin: 10px 0; }
          .invoice-meta { text-align: center; font-size: 12px; margin-top: 10px; }
          .invoice-meta span { margin: 0 20px; }
          .details-section { display: table; width: 100%; margin: 20px 0; }
          .details-box { display: table-cell; width: 50%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; vertical-align: top; }
          .details-box:first-child { margin-right: 10px; }
          .details-box h3 { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #374151; }
          .detail-row { margin-bottom: 8px; font-size: 12px; }
          .detail-label { font-weight: bold; display: inline-block; width: 140px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          th { background: #ccfbf1; border: 1px solid #ccc; padding: 8px; text-align: left; font-weight: bold; }
          td { border: 1px solid #ccc; padding: 8px; }
          .totals-section { float: right; width: 350px; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; margin: 20px 0; }
          .totals-header { background: #f3f4f6; padding: 10px; font-weight: bold; border-bottom: 1px solid #ccc; }
          .totals-body { padding: 15px; }
          .total-row { margin-bottom: 8px; font-size: 12px; overflow: hidden; }
          .total-row span:first-child { float: left; }
          .total-row span:last-child { float: right; }
          .grand-total { padding-top: 8px; border-top: 1px solid #ccc; font-size: 14px; font-weight: bold; margin-top: 8px; }
          .grand-total .amount { color: #0f766e; font-size: 16px; }
          .amount-words { margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 11px; font-style: italic; }
          .payment-section { clear: both; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .payment-section h3 { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
          .payment-grid { display: table; width: 100%; }
          .payment-grid > div { display: table-cell; width: 50%; font-size: 11px; }
          .footer-section { border-top: 2px solid #ccc; padding-top: 15px; margin-top: 20px; }
          .footer-grid { display: table; width: 100%; }
          .footer-grid > div { display: table-cell; width: 50%; vertical-align: top; }
          .terms { font-size: 11px; }
          .terms ul { margin: 5px 0; padding-left: 20px; }
          .signature { text-align: right; }
          .signature-line { border-top: 1px solid #666; width: 200px; margin: 60px 0 5px auto; }
          .disclaimer { text-align: center; font-size: 11px; color: #666; font-style: italic; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">${logoHTML}</div>
          <div class="hospital-details">
            <div class="hospital-name">${HOSPITAL_CONFIG.name}</div>
            <div class="hospital-info">
              ${HOSPITAL_CONFIG.address}<br>
              GSTIN: ${HOSPITAL_CONFIG.gstin}<br>
              Phone: ${HOSPITAL_CONFIG.contact}<br>
              Email: ${HOSPITAL_CONFIG.email}
            </div>
          </div>
          <div class="invoice-title">
            <h2>${invoiceType === 'IP' ? 'IN-PATIENT' : 'OUT-PATIENT'} INVOICE</h2>
            <div class="invoice-meta">
              <span><strong>Invoice No:</strong> ${invoiceData.invoiceNumber}</span>
              <span><strong>Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <div class="details-box">
            <h3>Patient Details</h3>
            <div class="detail-row"><span class="detail-label">Patient ID:</span> ${invoiceData.patientID || '-'}</div>
            <div class="detail-row"><span class="detail-label">Name:</span> ${invoiceData.patientName || '-'}</div>
            <div class="detail-row"><span class="detail-label">Age/Gender:</span> ${invoiceData.patientAge || '-'} / ${invoiceData.patientGender}</div>
            <div class="detail-row"><span class="detail-label">Contact:</span> ${invoiceData.patientContact || '-'}</div>
            <div class="detail-row"><span class="detail-label">Address:</span> ${invoiceData.patientAddress || '-'}</div>
          </div>

          <div class="details-box">
            <h3>Visit Details</h3>
            ${invoiceType === 'IP' ? `
              <div class="detail-row"><span class="detail-label">Admission:</span> ${invoiceData.dateOfAdmission ? new Date(invoiceData.dateOfAdmission).toLocaleDateString('en-IN') : '-'}</div>
              <div class="detail-row"><span class="detail-label">Discharge:</span> ${invoiceData.dateOfDischarge ? new Date(invoiceData.dateOfDischarge).toLocaleDateString('en-IN') : '-'}</div>
              <div class="detail-row"><span class="detail-label">Room Category:</span> ${invoiceData.roomCategory}</div>
              <div class="detail-row"><span class="detail-label">Number of Days:</span> ${invoiceData.numberOfDays}</div>
            ` : `
              <div class="detail-row"><span class="detail-label">Date of Visit:</span> ${new Date(invoiceData.dateOfVisit).toLocaleDateString('en-IN')}</div>
            `}
            <div class="detail-row"><span class="detail-label">Consultant:</span> ${invoiceData.consultantDoctor || '-'}</div>
          </div>
        </div>

        <div>
          <h3 style="margin-bottom: 10px; font-size: 14px;">Billing Details</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 50px;">S.No</th>
                <th style="width: 120px;">Category</th>
                <th>Description</th>
                <th style="text-align: center; width: 60px;">Qty</th>
                <th style="text-align: right; width: 80px;">Rate (₹)</th>
                <th style="text-align: center; width: 70px;">GST %</th>
                <th style="text-align: right; width: 100px;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
          </table>
        </div>

        <div class="totals-section">
          <div class="totals-header">Amount Summary</div>
          <div class="totals-body">
            <div class="total-row"><span>Subtotal:</span><span>₹ ${totals.subtotal}</span></div>
            <div class="total-row"><span>CGST:</span><span>₹ ${totals.cgst}</span></div>
            <div class="total-row"><span>SGST:</span><span>₹ ${totals.sgst}</span></div>
            <div class="total-row grand-total"><span>Grand Total:</span><span class="amount">₹ ${totals.grandTotal}</span></div>
            <div class="amount-words"><strong>Amount in Words:</strong><br>${numberToWords(Number(totals.grandTotal))}</div>
          </div>
        </div>

        <div class="payment-section">
          <h3>Payment Terms & Bank Details</h3>
          <div class="payment-grid">
            <div><strong>Payment Mode:</strong> ${invoiceData.paymentMode}<br><span style="color: #666; font-size: 10px;">Payment due upon receipt.</span></div>
            <div><strong>Bank Details:</strong><br>Bank: ${HOSPITAL_CONFIG.bankName}<br>Account: ${HOSPITAL_CONFIG.accountNumber}<br>IFSC: ${HOSPITAL_CONFIG.ifscCode}<br>Branch: ${HOSPITAL_CONFIG.branch}</div>
          </div>
        </div>

        <div class="footer-section">
          <div class="footer-grid">
            <div class="terms">
              <strong>Terms & Conditions:</strong>
              <ul>
                <li>All disputes subject to local jurisdiction.</li>
                <li>Refunds as per refund policy.</li>
                <li>Medicines once sold cannot be returned.</li>
                <li>Check items before leaving.</li>
              </ul>
            </div>
            <div class="signature">
              <p style="font-size: 11px; margin-bottom: 50px;">For ${HOSPITAL_CONFIG.name}</p>
              <div class="signature-line"></div>
              <p style="font-size: 11px; margin-top: 5px;">Authorized Signatory</p>
            </div>
          </div>
          <div class="disclaimer">
            Computer-generated invoice. No signature required.<br>
            Thank you for choosing ${HOSPITAL_CONFIG.name}
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!invoiceData.patientName || invoiceData.items.length === 0) {
        alert('Please fill patient name and add at least one item before saving.');
        return;
      }

      const invoiceToSave = {
        ...invoiceData,
        totals: totals,
        savedAt: new Date().toISOString(),
        type: invoiceType
      };

      // Save to localStorage
      const existingInvoices = JSON.parse(localStorage.getItem(`invoices_${invoiceType}`) || '[]');
      const updatedInvoices = [invoiceToSave, ...existingInvoices].slice(0, 50); // Keep last 50
      localStorage.setItem(`invoices_${invoiceType}`, JSON.stringify(updatedInvoices));

      // Optionally save to Supabase if available
      if (supabase) {
        await supabase.from('invoices').insert([{
          invoice_number: invoiceData.invoiceNumber,
          invoice_type: invoiceType,
          patient_name: invoiceData.patientName,
          patient_id: invoiceData.patientID,
          invoice_date: invoiceData.invoiceDate,
          items: invoiceData.items,
          subtotal: totals.subtotal,
          gst_amount: totals.totalGST,
          grand_total: totals.grandTotal,
          payment_mode: invoiceData.paymentMode,
          invoice_data: invoiceToSave
        }]);
      }

      alert(`✅ Invoice ${invoiceData.invoiceNumber} saved successfully!`);
      loadRecentInvoices(); // Refresh the list
      
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice: ' + error.message);
    }
  };

  const viewInvoice = (invoice) => {
    setInvoiceData(invoice);
    setShowRecentInvoices(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Action Buttons */}
      <div className="max-w-5xl mx-auto mb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {invoiceType === 'IP' ? 'In-Patient' : 'Out-Patient'} Invoice
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowRecentInvoices(!showRecentInvoices)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Eye className="w-4 h-4" />
              <span>Recent ({recentInvoices.length})</span>
            </button>
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

      {/* Recent Invoices Panel */}
      {showRecentInvoices && (
        <div className="max-w-5xl mx-auto mb-4 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Invoices</h3>
          {recentInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No saved invoices yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentInvoices.map((inv, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => viewInvoice(inv)}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{inv.invoiceNumber}</div>
                    <div className="text-sm text-gray-600">
                      {inv.patientName} • {new Date(inv.savedAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-teal-700">₹ {inv.totals.grandTotal}</div>
                    <div className="text-xs text-gray-500">{inv.items.length} items</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice Container */}
      <div className="max-w-5xl mx-auto bg-white shadow-lg">
        {/* Header */}
        <div className="border-b-4 border-teal-600 p-8">
          <div className="flex justify-between items-start">
            {/* Logo */}
            {HOSPITAL_CONFIG.showLogo ? (
              <img 
                src={HOSPITAL_CONFIG.logoPath}
                alt="Hospital Logo" 
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  // Fallback if logo doesn't load
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-24 h-24 bg-teal-100 rounded-lg flex items-center justify-center border-2 border-teal-300"
              style={{ display: HOSPITAL_CONFIG.showLogo ? 'none' : 'flex' }}
            >
              <Building2 className="w-12 h-12 text-teal-600" />
            </div>
            
            {/* Hospital Details */}
            <div className="text-right">
              <h1 className="text-3xl font-bold text-teal-700 mb-2">{HOSPITAL_CONFIG.name}</h1>
              <p className="text-sm text-gray-600">{HOSPITAL_CONFIG.address}</p>
              <p className="text-sm text-gray-600">GSTIN: {HOSPITAL_CONFIG.gstin}</p>
              <p className="text-sm text-gray-600">Phone: {HOSPITAL_CONFIG.contact}</p>
              <p className="text-sm text-gray-600">Email: {HOSPITAL_CONFIG.email}</p>
            </div>
          </div>
          
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

        {/* Patient & Visit Details */}
        <div className="p-8">
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
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
                    placeholder="Enter Patient ID"
                  />
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Name:</span>
                  <input
                    type="text"
                    value={invoiceData.patientName}
                    onChange={(e) => setInvoiceData({...invoiceData, patientName: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
                    placeholder="Enter Patient Name"
                  />
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Age/Gender:</span>
                  <input
                    type="number"
                    value={invoiceData.patientAge}
                    onChange={(e) => setInvoiceData({...invoiceData, patientAge: e.target.value})}
                    className="w-16 border-b border-gray-300 focus:border-teal-500 outline-none mr-2"
                    placeholder="Age"
                  />
                  <select
                    value={invoiceData.patientGender}
                    onChange={(e) => setInvoiceData({...invoiceData, patientGender: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
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
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
                    placeholder="Phone Number"
                  />
                </div>
                <div className="flex">
                  <span className="font-semibold w-32">Address:</span>
                  <input
                    type="text"
                    value={invoiceData.patientAddress}
                    onChange={(e) => setInvoiceData({...invoiceData, patientAddress: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
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
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div className="flex">
                      <span className="font-semibold w-40">Date of Discharge:</span>
                      <input
                        type="date"
                        value={invoiceData.dateOfDischarge}
                        onChange={(e) => setInvoiceData({...invoiceData, dateOfDischarge: e.target.value})}
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div className="flex">
                      <span className="font-semibold w-40">Room Category:</span>
                      <select
                        value={invoiceData.roomCategory}
                        onChange={(e) => setInvoiceData({...invoiceData, roomCategory: e.target.value})}
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
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
                        className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
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
                      className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
                    />
                  </div>
                )}
                <div className="flex">
                  <span className="font-semibold w-40">Consultant Doctor:</span>
                  <input
                    type="text"
                    value={invoiceData.consultantDoctor}
                    onChange={(e) => setInvoiceData({...invoiceData, consultantDoctor: e.target.value})}
                    className="flex-1 border-b border-gray-300 focus:border-teal-500 outline-none"
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
                className="flex items-center space-x-1 px-3 py-1 bg-teal-600 text-white text-sm rounded hover:bg-teal-700"
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
                    <th className="border border-gray-300 px-3 py-2 text-center">Action</th>
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
                            className="w-full border-0 outline-none bg-transparent"
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
                            className="w-full border-0 outline-none"
                            placeholder="Description"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                            className="w-16 text-center border-0 outline-none"
                            min="1"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                            className="w-24 text-right border-0 outline-none"
                            min="0"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <select
                            value={item.gstRate}
                            onChange={(e) => updateItem(item.id, 'gstRate', e.target.value)}
                            className="w-16 text-center border-0 outline-none"
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
                        <td className="border border-gray-300 px-3 py-2 text-center">
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
                    className="ml-2 border-b border-gray-300 focus:border-teal-500 outline-none"
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
                <p className="text-xs text-gray-600">Bank Name: {HOSPITAL_CONFIG.bankName}</p>
                <p className="text-xs text-gray-600">Account No: {HOSPITAL_CONFIG.accountNumber}</p>
                <p className="text-xs text-gray-600">IFSC Code: {HOSPITAL_CONFIG.ifscCode}</p>
                <p className="text-xs text-gray-600">Branch: {HOSPITAL_CONFIG.branch}</p>
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
                  <p className="text-xs text-gray-600 mb-12">For {HOSPITAL_CONFIG.name}</p>
                  <div className="border-t border-gray-400 w-48 ml-auto"></div>
                  <p className="text-xs text-gray-700 mt-1">Authorized Signatory</p>
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs text-gray-500 italic pt-4 border-t border-gray-200">
              This is a computer-generated invoice and does not require a physical signature.
              <br />
              Thank you for choosing {HOSPITAL_CONFIG.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AyurvedicInvoice;
