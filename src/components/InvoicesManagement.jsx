import React, { useState, useEffect } from 'react';
import { Receipt, Search, Download, Printer, Eye, Filter, Calendar, DollarSign, TrendingUp, Plus } from 'lucide-react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import InvoiceModal from './InvoiceModal';

const InvoicesManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, OP, IP
  const [filterDate, setFilterDate] = useState('all'); // all, today, week, month
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    opRevenue: 0,
    ipRevenue: 0,
    totalInvoices: 0,
    opCount: 0,
    ipCount: 0
  });

  useEffect(() => {
    loadInvoices();
    loadPatients();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterType, filterDate, invoices]);

  useEffect(() => {
    calculateStats();
  }, [filteredInvoices]);

  const loadPatients = async () => {
    try {
      const patientsRef = collection(db, 'patients');
      const snapshot = await getDocs(patientsRef);
      
      const patientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        firebaseId: doc.id,
        ...doc.data()
      }));

      setPatients(patientsData);
      console.log(`✅ Loaded ${patientsData.length} patients`);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      
      const invoicesRef = collection(db, 'invoices');
      const q = query(invoicesRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      
      const invoicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setInvoices(invoicesData);
      console.log(`✅ Loaded ${invoicesData.length} invoices`);

    } catch (error) {
      console.error('Error loading invoices:', error);
      alert('Failed to load invoices: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...invoices];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(inv => inv.invoice_type === filterType);
    }

    // Filter by date
    if (filterDate !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.invoice_date);
        if (filterDate === 'today') return invDate >= today;
        if (filterDate === 'week') return invDate >= weekAgo;
        if (filterDate === 'month') return invDate >= monthStart;
        return true;
      });
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        (inv.patient_name || '').toLowerCase().includes(term) ||
        (inv.patient_number || '').toLowerCase().includes(term) ||
        (inv.invoice_type || '').toLowerCase().includes(term)
      );
    }

    setFilteredInvoices(filtered);
  };

  const calculateStats = () => {
    const stats = {
      totalRevenue: 0,
      opRevenue: 0,
      ipRevenue: 0,
      totalInvoices: filteredInvoices.length,
      opCount: 0,
      ipCount: 0
    };

    filteredInvoices.forEach(inv => {
      const amount = parseFloat(inv.total_amount) || 0;
      stats.totalRevenue += amount;

      if (inv.invoice_type === 'OP') {
        stats.opRevenue += amount;
        stats.opCount++;
      } else if (inv.invoice_type === 'IP') {
        stats.ipRevenue += amount;
        stats.ipCount++;
      }
    });

    setStats(stats);
  };

  const getChartData = () => {
    // Bar chart data
    const barData = [
      {
        name: 'Out Patient',
        Revenue: stats.opRevenue,
        Count: stats.opCount
      },
      {
        name: 'In Patient',
        Revenue: stats.ipRevenue,
        Count: stats.ipCount
      }
    ];

    // Pie chart data
    const pieData = [
      { name: 'Out Patient (O/P)', value: stats.opRevenue, count: stats.opCount },
      { name: 'In Patient (I/P)', value: stats.ipRevenue, count: stats.ipCount }
    ];

    return { barData, pieData };
  };

  const COLORS = ['#3b82f6', '#8b5cf6']; // Blue for OP, Purple for IP

  const handlePrintInvoice = (invoice) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoice.patient_number}</title>
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
          <span class="badge">${invoice.invoice_type === 'OP' ? 'OUT PATIENT (O/P)' : 'IN PATIENT (I/P)'}</span>
        </div>

        <div class="info">
          <div class="info-box">
            <h3>Patient Details:</h3>
            <p><strong>Name:</strong> ${invoice.patient_name}</p>
            <p><strong>Patient ID:</strong> ${invoice.patient_number}</p>
            <p><strong>Phone:</strong> ${invoice.patient_phone || 'N/A'}</p>
            <p><strong>Address:</strong> ${invoice.patient_address || 'N/A'}</p>
          </div>
          <div class="info-box" style="text-align: right;">
            <h3>Invoice Details:</h3>
            <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
            <p><strong>Invoice Type:</strong> ${invoice.invoice_type}</p>
            <p><strong>Payment Mode:</strong> ${invoice.payment_mode}</p>
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
            ${invoice.treatment_charges > 0 ? `
              <tr>
                <td>Treatment Charges</td>
                <td>-</td>
                <td>-</td>
                <td>₹${invoice.treatment_charges.toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${invoice.invoice_type === 'IP' && invoice.room_rent > 0 ? `
              <tr>
                <td>Room Rent (${invoice.room_type})</td>
                <td>${invoice.days} days</td>
                <td>₹${invoice.room_rent.toFixed(2)}</td>
                <td>₹${(invoice.room_rent * invoice.days).toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${invoice.invoice_type === 'IP' && invoice.mess_charges > 0 ? `
              <tr>
                <td>Mess Charges</td>
                <td>${invoice.mess_days} days</td>
                <td>₹${invoice.mess_charges.toFixed(2)}</td>
                <td>₹${(invoice.mess_charges * invoice.mess_days).toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${invoice.medicines && invoice.medicines.map(med => `
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
              <td style="text-align: right;">₹${invoice.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>GST (${invoice.gst_percentage}%):</td>
              <td style="text-align: right;">₹${invoice.gst_amount.toFixed(2)}</td>
            </tr>
            ${invoice.discount > 0 ? `
              <tr>
                <td>Discount:</td>
                <td style="text-align: right; color: red;">-₹${invoice.discount.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="grand-total">
              <td>TOTAL:</td>
              <td style="text-align: right;">₹${invoice.total_amount.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="clear: both;"></div>

        ${invoice.notes ? `
          <div style="margin-top: 30px;">
            <strong>Notes:</strong>
            <p>${invoice.notes}</p>
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

  const handleExport = () => {
    const exportData = filteredInvoices.map(inv => ({
      'Invoice Date': new Date(inv.invoice_date).toLocaleDateString(),
      'Type': inv.invoice_type,
      'Patient Number': inv.patient_number,
      'Patient Name': inv.patient_name,
      'Treatment Charges': inv.treatment_charges || 0,
      'Room Rent': inv.room_rent || 0,
      'Days': inv.days || 0,
      'Mess Charges': inv.mess_charges || 0,
      'Subtotal': inv.subtotal,
      'GST': inv.gst_amount,
      'Discount': inv.discount,
      'Total Amount': inv.total_amount,
      'Payment Mode': inv.payment_mode,
      'Status': inv.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Invoices Management</h1>
              <p className="text-gray-600 text-sm">Track and manage patient invoices</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Invoice
            </button>
            <button
              onClick={loadInvoices}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="#10b981"
          subtitle={`${stats.totalInvoices} total invoices`}
        />
        <StatCard
          title="Out Patient (O/P)"
          value={`₹${stats.opRevenue.toLocaleString()}`}
          icon={Receipt}
          color="#3b82f6"
          subtitle={`${stats.opCount} OP invoices`}
        />
        <StatCard
          title="In Patient (I/P)"
          value={`₹${stats.ipRevenue.toLocaleString()}`}
          icon={TrendingUp}
          color="#8b5cf6"
          subtitle={`${stats.ipCount} IP invoices`}
        />
      </div>

      {/* Charts */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Comparison Bar Chart */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData().barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Revenue') return [`₹${value.toLocaleString()}`, name];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Revenue" fill="#3b82f6" name="Revenue (₹)" />
                <Bar yAxisId="right" dataKey="Count" fill="#10b981" name="Invoice Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Distribution Pie Chart */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getChartData().pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, count }) => `${name}: ₹${value.toLocaleString()} (${count})`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getChartData().pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [
                    `₹${value.toLocaleString()} (${props.payload.count} invoices)`,
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Types</option>
              <option value="OP">Out Patient (O/P)</option>
              <option value="IP">In Patient (I/P)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredInvoices.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{invoices.length}</span> invoices
          </span>
          {(filterType !== 'all' || filterDate !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterDate('all');
                setSearchTerm('');
              }}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm || filterType !== 'all' || filterDate !== 'all'
                ? 'No invoices match your filters'
                : 'No invoices found'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient No.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          invoice.invoice_type === 'OP'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {invoice.invoice_type === 'OP' ? 'O/P' : 'I/P'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{invoice.patient_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.patient_number}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      ₹{invoice.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.payment_mode}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        {invoice.status || 'Paid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handlePrintInvoice(invoice)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600 text-white text-sm rounded hover:bg-teal-700"
                        title="Print Invoice"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Selection Modal for New Invoice */}
      {showInvoiceModal && !selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-2xl font-bold">Select Patient</h2>
              <button 
                onClick={() => setShowInvoiceModal(false)} 
                className="hover:bg-teal-700 p-2 rounded"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  onChange={(e) => {
                    const term = e.target.value.toLowerCase();
                    // Simple inline filter for demo
                  }}
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {patients.map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {patient.patient_number} • {patient.phone || 'No phone'}
                    </div>
                  </button>
                ))}
              </div>
              {patients.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No patients found. Register patients first.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Generation Modal */}
      {showInvoiceModal && selectedPatient && (
        <InvoiceModal
          patient={selectedPatient}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedPatient(null);
          }}
          onSave={() => {
            setShowInvoiceModal(false);
            setSelectedPatient(null);
            loadInvoices(); // Refresh invoice list
          }}
        />
      )}
    </div>
  );
};

export default InvoicesManagement;
