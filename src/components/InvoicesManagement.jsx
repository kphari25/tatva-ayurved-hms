import React, { useState, useEffect, useRef } from 'react';
import { Receipt, Search, Download, Printer, Eye, Filter, Calendar, IndianRupee, TrendingUp, Plus, UserRound, ShoppingBag, X } from 'lucide-react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import InvoiceModal from './InvoiceModal';
import MedicineSaleModal from './MedicineSaleModal';
import { previewIframeStyle } from '../lib/printPreviewSize';
import { formatDateOnly } from '../lib/formatDate';
import { buildInvoicePrintHTML } from '../lib/invoicePrint';

const InvoicesManagement = ({ initialPatientId, onInitialPatientHandled }) => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, OP, IP
  const [filterDate, setFilterDate] = useState('all'); // all, today, week, month
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  // True only when this invoice was opened via Patient Portal/Dashboard's
  // "Discharge" shortcut below — gates the post-print "Checkout patient?"
  // prompt so it doesn't show up for an ordinary mid-stay invoice.
  const [isDischargeInvoice, setIsDischargeInvoice] = useState(false);
  const [showNewInvoiceChooser, setShowNewInvoiceChooser] = useState(false);
  const [showMedicineSale, setShowMedicineSale] = useState(false);
  const [patientPickerSearch, setPatientPickerSearch] = useState('');
  const [printPreviewInvoice, setPrintPreviewInvoice] = useState(null);
  const [useLetterheadPrint, setUseLetterheadPrint] = useState(false);
  const [printPreviewPageSize, setPrintPreviewPageSize] = useState('A4');
  const [printPreviewOrientation, setPrintPreviewOrientation] = useState('portrait');
  const printIframeRef = useRef(null);
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

  // Jump straight to a pre-filled invoice for a specific patient when
  // navigated here from Patient Portal's "Discharge" button or Dashboard's
  // "Start Discharge" action, skipping the Select Patient grid.
  useEffect(() => {
    if (!initialPatientId || patients.length === 0) return;
    const patient = patients.find(p => p.id === initialPatientId);
    if (patient) {
      setSelectedPatient(patient);
      setShowInvoiceModal(true);
      setIsDischargeInvoice(true);
    }
    onInitialPatientHandled && onInitialPatientHandled();
  }, [initialPatientId, patients]);

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

  const getPatientPickerResults = () => {
    const term = patientPickerSearch.trim().toLowerCase();
    return patients
      .filter(p => {
        if (!term) return true;
        const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
        return name.includes(term)
          || (p.mrd_number || '').toLowerCase().includes(term)
          || (p.patient_number || '').toLowerCase().includes(term)
          || (p.phone || '').includes(term);
      })
      .sort((a, b) => `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`));
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
        (inv.mrd_number || '').toLowerCase().includes(term) ||
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
    setPrintPreviewPageSize('A4');
    setPrintPreviewOrientation('portrait');
    setPrintPreviewInvoice(invoice);
  };

  const handlePrintFromPreview = () => {
    const win = printIframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const handleExport = () => {
    const exportData = filteredInvoices.map(inv => ({
      'Invoice Date': formatDateOnly(inv.invoice_date),
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
              onClick={() => setShowNewInvoiceChooser(true)}
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
          icon={IndianRupee}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRD No.</th>
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
                      {formatDateOnly(invoice.invoice_date)}
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
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.mrd_number || invoice.patient_number}</td>
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
                onClick={() => { setShowInvoiceModal(false); setPatientPickerSearch(''); }}
                className="hover:bg-teal-700 p-2 rounded"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <input
                  type="text"
                  value={patientPickerSearch}
                  onChange={(e) => setPatientPickerSearch(e.target.value)}
                  placeholder="Search by name, MRD number, or phone..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  autoFocus
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getPatientPickerResults().map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {patient.mrd_number || patient.patient_number} • {patient.phone || 'No phone'}
                    </div>
                  </button>
                ))}
              </div>
              {getPatientPickerResults().length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {patientPickerSearch.trim()
                    ? `No patients match "${patientPickerSearch}"`
                    : 'No patients found. Register patients first.'}
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
          offerCheckout={isDischargeInvoice}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedPatient(null);
            setPatientPickerSearch('');
            setIsDischargeInvoice(false);
          }}
          onSave={() => {
            // Closing happens via onClose, once InvoiceModal's own print
            // preview is dismissed — closing here would unmount it (and the
            // preview) before it can render, same bug the medicine-sale
            // print flow had.
            loadInvoices();
            loadPatients();
          }}
        />
      )}

      {/* New Invoice Type Chooser */}
      {showNewInvoiceChooser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">New Invoice</h2>
              <button onClick={() => setShowNewInvoiceChooser(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">Choose the type of invoice to generate:</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowNewInvoiceChooser(false);
                  setShowInvoiceModal(true);
                  setIsDischargeInvoice(false);
                }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group"
              >
                <div className="w-14 h-14 bg-teal-100 group-hover:bg-teal-200 rounded-full flex items-center justify-center transition-colors">
                  <UserRound className="w-7 h-7 text-teal-600" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-800">Patient Invoice</div>
                  <div className="text-xs text-gray-500 mt-1">Treatment, nursing, room & medicine charges for a registered patient</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowNewInvoiceChooser(false);
                  setShowMedicineSale(true);
                }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <div className="w-14 h-14 bg-green-100 group-hover:bg-green-200 rounded-full flex items-center justify-center transition-colors">
                  <ShoppingBag className="w-7 h-7 text-green-600" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-800">Medicine Sale</div>
                  <div className="text-xs text-gray-500 mt-1">Direct medicine billing for walk-in customers or patients</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printPreviewInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
            <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold">Print Preview</h2>
                <p className="text-teal-100 text-sm">{printPreviewInvoice.patient_name}</p>
              </div>
              <button onClick={() => setPrintPreviewInvoice(null)} className="hover:bg-teal-700 p-2 rounded">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useLetterheadPrint}
                    onChange={e => setUseLetterheadPrint(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  Print on letterhead <span className="text-gray-400">(skips logo/contact header, page 1 only)</span>
                </label>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium" title="Paper size for printing">
                  {['A4', 'A5'].map(size => (
                    <button
                      key={size}
                      onClick={() => setPrintPreviewPageSize(size)}
                      className={`px-2.5 py-1.5 rounded-md transition-colors ${printPreviewPageSize === size ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-medium" title="Paper orientation for printing">
                  {['portrait', 'landscape'].map(orientation => (
                    <button
                      key={orientation}
                      onClick={() => setPrintPreviewOrientation(orientation)}
                      className={`px-2.5 py-1.5 rounded-md capitalize transition-colors ${printPreviewOrientation === orientation ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {orientation}
                    </button>
                  ))}
                </div>
              </div>
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
                srcDoc={buildInvoicePrintHTML(printPreviewInvoice, printPreviewPageSize, printPreviewOrientation, useLetterheadPrint)}
                className="bg-white shadow-lg"
                style={previewIframeStyle(printPreviewPageSize, printPreviewOrientation)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Medicine Sale Modal */}
      {showMedicineSale && (
        <MedicineSaleModal
          // MedicineSaleModal shows its own print preview after saving and
          // calls onClose only once that's dismissed — closing here too
          // would unmount it (and the still-unprinted preview) immediately.
          onClose={() => setShowMedicineSale(false)}
          onSave={() => loadInvoices()}
        />
      )}
    </div>
  );
};

export default InvoicesManagement;
