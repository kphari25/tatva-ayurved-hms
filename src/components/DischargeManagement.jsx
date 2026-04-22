import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Printer, Send, AlertCircle, DollarSign, CheckCircle, Clock, User, Star, Link as LinkIcon } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DischargeManagement = () => {
  const [patients, setPatients] = useState([]);
  const [ipPatients, setIpPatients] = useState([]);
  const [discharges, setDischarges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // pending, completed
  const [showReviewLinkModal, setShowReviewLinkModal] = useState(false);
  const [reviewPatient, setReviewPatient] = useState(null);

  // Google Review Link - Update this with your actual Google Business link
  const GOOGLE_REVIEW_LINK = "https://g.page/r/YOUR_PLACE_ID/review"; // TODO: Update with actual link

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all patients
      const patientsRef = collection(db, 'patients');
      const patientsSnapshot = await getDocs(patientsRef);
      const patientsData = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        firebaseId: doc.id,
        ...doc.data()
      }));
      setPatients(patientsData);

      // Filter IP patients (you might have an IP status field)
      // For now, we'll show all patients - you can add IP status filtering
      setIpPatients(patientsData);

      // Load discharge records
      const dischargeRef = collection(db, 'discharges');
      const q = query(dischargeRef, orderBy('created_at', 'desc'));
      const dischargeSnapshot = await getDocs(q);
      const dischargeData = dischargeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDischarges(dischargeData);

      console.log(`✅ Loaded ${patientsData.length} patients, ${dischargeData.length} discharges`);

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDischarge = (patient) => {
    setSelectedPatient(patient);
    setShowDischargeModal(true);
  };

  const handleShareReviewLink = (patient) => {
    setReviewPatient(patient);
    setShowReviewLinkModal(true);
  };

  const copyReviewLink = () => {
    navigator.clipboard.writeText(GOOGLE_REVIEW_LINK);
    alert('✅ Google Review link copied to clipboard!');
  };

  const shareReviewViaSMS = () => {
    if (!reviewPatient?.phone) {
      alert('No phone number available for this patient');
      return;
    }

    const message = `Dear ${reviewPatient.first_name || 'Patient'},

Thank you for choosing Tatva Ayurved! 

We hope you had a positive experience. We'd love to hear your feedback!

Please share your review here:
${GOOGLE_REVIEW_LINK}

- Tatva Ayurved Team`;

    // Simulate SMS (in production, integrate with SMS API)
    console.log('📱 SMS to:', reviewPatient.phone);
    console.log(message);
    
    alert(`✅ Review link SMS sent to ${reviewPatient.phone}\n\n(In production, this will use SMS API)`);
    setShowReviewLinkModal(false);
  };

  const shareReviewViaWhatsApp = () => {
    if (!reviewPatient?.phone) {
      alert('No phone number available for this patient');
      return;
    }

    const message = encodeURIComponent(
      `Dear ${reviewPatient.first_name || 'Patient'},\n\n` +
      `Thank you for choosing Tatva Ayurved! We hope you had a positive experience.\n\n` +
      `Please share your review here:\n${GOOGLE_REVIEW_LINK}\n\n` +
      `- Tatva Ayurved Team`
    );

    // Remove country code formatting for WhatsApp
    const phoneNumber = reviewPatient.phone.replace(/[^\d]/g, '');
    
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
    setShowReviewLinkModal(false);
  };

  const getPendingDischarges = () => {
    return discharges.filter(d => d.status === 'pending' || d.status === 'in-progress');
  };

  const getCompletedDischarges = () => {
    return discharges.filter(d => d.status === 'completed');
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
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Discharge Management</h1>
              <p className="text-gray-600 text-sm">Fast discharge workflow & final billing</p>
            </div>
          </div>
          <button
            onClick={() => setShowDischargeModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Discharge
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Pending Discharges"
          value={getPendingDischarges().length}
          icon={Clock}
          color="#f59e0b"
          subtitle="Awaiting completion"
        />
        <StatCard
          title="Completed Today"
          value={getCompletedDischarges().filter(d => {
            const today = new Date().toDateString();
            return new Date(d.discharge_date).toDateString() === today;
          }).length}
          icon={CheckCircle}
          color="#10b981"
          subtitle="Discharged today"
        />
        <StatCard
          title="In-Patients"
          value={ipPatients.length}
          icon={User}
          color="#3b82f6"
          subtitle="Currently admitted"
        />
        <StatCard
          title="Pending Dues"
          value={`₹${getPendingDischarges().reduce((sum, d) => sum + (d.pending_amount || 0), 0).toLocaleString()}`}
          icon={DollarSign}
          color="#ef4444"
          subtitle="Outstanding payments"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'pending'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending Discharges ({getPendingDischarges().length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'completed'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Completed Discharges ({getCompletedDischarges().length})
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient name or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Discharge List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading discharges...</p>
          </div>
        ) : activeTab === 'pending' && getPendingDischarges().length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No pending discharges</p>
            <button
              onClick={() => setShowDischargeModal(true)}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start New Discharge
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discharge Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Bill</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Advance</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(activeTab === 'pending' ? getPendingDischarges() : getCompletedDischarges()).map((discharge) => (
                  <tr key={discharge.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{discharge.patient_name}</div>
                      <div className="text-sm text-gray-500">{discharge.patient_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {discharge.admission_date ? new Date(discharge.admission_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {discharge.discharge_date ? new Date(discharge.discharge_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      ₹{(discharge.total_bill || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-green-600">
                      ₹{(discharge.advance_paid || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className={`font-semibold ${
                        (discharge.pending_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        ₹{(discharge.pending_amount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        discharge.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : discharge.status === 'in-progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {discharge.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            // Handle view/edit discharge
                            const patient = patients.find(p => p.patient_number === discharge.patient_number);
                            if (patient) {
                              setSelectedPatient({ ...patient, dischargeData: discharge });
                              setShowDischargeModal(true);
                            }
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          View
                        </button>
                        {discharge.status === 'completed' && (
                          <>
                            <button
                              onClick={() => {
                                const patient = patients.find(p => p.patient_number === discharge.patient_number);
                                if (patient) {
                                  handleShareReviewLink(patient);
                                }
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                              title="Share Google Review Link"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                            <button
                              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discharge Modal */}
      {showDischargeModal && (
        <DischargeModal
          patient={selectedPatient}
          patients={ipPatients}
          onClose={() => {
            setShowDischargeModal(false);
            setSelectedPatient(null);
          }}
          onSave={() => {
            setShowDischargeModal(false);
            setSelectedPatient(null);
            loadData();
          }}
        />
      )}

      {/* Google Review Link Modal */}
      {showReviewLinkModal && reviewPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6" />
                <h2 className="text-xl font-bold">Share Google Review</h2>
              </div>
              <button 
                onClick={() => setShowReviewLinkModal(false)} 
                className="hover:bg-green-700 p-2 rounded"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-semibold text-gray-900">
                  {reviewPatient.first_name} {reviewPatient.last_name}
                </p>
                <p className="text-sm text-gray-600">{reviewPatient.patient_number}</p>
                <p className="text-sm text-gray-600">{reviewPatient.phone || 'No phone'}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Review Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={GOOGLE_REVIEW_LINK}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={copyReviewLink}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                    title="Copy Link"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click copy to share manually or use the buttons below
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={shareReviewViaWhatsApp}
                  disabled={!reviewPatient.phone}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Share via WhatsApp
                </button>

                <button
                  onClick={shareReviewViaSMS}
                  disabled={!reviewPatient.phone}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  Send via SMS
                </button>

                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-600 text-center">
                    💡 Tip: Update the Google Review link in DischargeManagement.jsx
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Discharge Modal Component
const DischargeModal = ({ patient, patients, onClose, onSave }) => {
  const [step, setStep] = useState(1); // 1: Select Patient, 2: Bill Details, 3: Summary
  const [selectedPatient, setSelectedPatient] = useState(patient || null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    admission_date: patient?.dischargeData?.admission_date || new Date().toISOString().split('T')[0],
    discharge_date: patient?.dischargeData?.discharge_date || new Date().toISOString().split('T')[0],
    room_charges: patient?.dischargeData?.room_charges || 0,
    room_days: patient?.dischargeData?.room_days || 0,
    room_rate: patient?.dischargeData?.room_rate || 0,
    therapy_charges: patient?.dischargeData?.therapy_charges || 0,
    medicine_charges: patient?.dischargeData?.medicine_charges || 0,
    doctor_fees: patient?.dischargeData?.doctor_fees || 0,
    other_charges: patient?.dischargeData?.other_charges || 0,
    other_charges_description: patient?.dischargeData?.other_charges_description || '',
    advance_paid: patient?.dischargeData?.advance_paid || 0,
    discount: patient?.dischargeData?.discount || 0,
    discharge_summary: patient?.dischargeData?.discharge_summary || '',
    discharge_instructions: patient?.dischargeData?.discharge_instructions || '',
    follow_up_date: patient?.dischargeData?.follow_up_date || '',
    status: patient?.dischargeData?.status || 'pending'
  });

  const calculateSubtotal = () => {
    return (
      parseFloat(formData.room_charges) +
      parseFloat(formData.therapy_charges) +
      parseFloat(formData.medicine_charges) +
      parseFloat(formData.doctor_fees) +
      parseFloat(formData.other_charges)
    );
  };

  const calculateTotal = () => {
    return calculateSubtotal() - parseFloat(formData.discount);
  };

  const calculatePending = () => {
    return calculateTotal() - parseFloat(formData.advance_paid);
  };

  const handleSaveDischarge = async () => {
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }

    try {
      setSaving(true);

      const dischargeData = {
        patient_id: selectedPatient.firebaseId || selectedPatient.id,
        patient_number: selectedPatient.patient_number,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        ...formData,
        total_bill: calculateTotal(),
        pending_amount: calculatePending(),
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email,
        status: calculatePending() <= 0 ? 'completed' : formData.status
      };

      if (patient?.dischargeData?.id) {
        // Update existing
        await updateDoc(doc(db, 'discharges', patient.dischargeData.id), dischargeData);
        alert('✅ Discharge updated successfully!');
      } else {
        // Create new
        await addDoc(collection(db, 'discharges'), dischargeData);
        alert('✅ Discharge record created successfully!');
      }

      if (onSave) onSave();

    } catch (error) {
      console.error('Error saving discharge:', error);
      alert('Failed to save discharge: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold">
            {patient?.dischargeData ? 'View/Edit Discharge' : 'Fast Discharge Process'}
          </h2>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Patient Selection */}
          {!selectedPatient && step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Select Patient</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {patients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setStep(2);
                    }}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">
                      {p.first_name} {p.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {p.patient_number} • {p.phone || 'No phone'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Bill Details */}
          {selectedPatient && step === 2 && (
            <div>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold text-gray-900">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </p>
                <p className="text-sm text-gray-600">{selectedPatient.patient_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admission Date</label>
                  <input
                    type="date"
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Date</label>
                  <input
                    type="date"
                    value={formData.discharge_date}
                    onChange={(e) => setFormData({ ...formData, discharge_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <h3 className="font-bold text-gray-800 mb-3">Bill Consolidation</h3>

              {/* Room Charges */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Room Charges</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Days</label>
                    <input
                      type="number"
                      value={formData.room_days}
                      onChange={(e) => {
                        const days = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          room_days: days,
                          room_charges: days * formData.room_rate
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Rate/Day (₹)</label>
                    <input
                      type="number"
                      value={formData.room_rate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          room_rate: rate,
                          room_charges: formData.room_days * rate
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Total (₹)</label>
                    <input
                      type="number"
                      value={formData.room_charges}
                      onChange={(e) => setFormData({ ...formData, room_charges: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Other Charges */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Therapy Charges (₹)</label>
                  <input
                    type="number"
                    value={formData.therapy_charges}
                    onChange={(e) => setFormData({ ...formData, therapy_charges: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Medicine Charges (₹)</label>
                  <input
                    type="number"
                    value={formData.medicine_charges}
                    onChange={(e) => setFormData({ ...formData, medicine_charges: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Doctor Fees (₹)</label>
                  <input
                    type="number"
                    value={formData.doctor_fees}
                    onChange={(e) => setFormData({ ...formData, doctor_fees: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Other Charges (₹)</label>
                  <input
                    type="number"
                    value={formData.other_charges}
                    onChange={(e) => setFormData({ ...formData, other_charges: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Other Charges Description</label>
                <input
                  type="text"
                  value={formData.other_charges_description}
                  onChange={(e) => setFormData({ ...formData, other_charges_description: e.target.value })}
                  placeholder="e.g., Lab tests, X-ray, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Payment Adjustment */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Advance Paid (₹)</label>
                  <input
                    type="number"
                    value={formData.advance_paid}
                    onChange={(e) => setFormData({ ...formData, advance_paid: e.target.value })}
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
                  />
                </div>
              </div>

              {/* Bill Summary */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-lg mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{parseFloat(formData.discount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t border-blue-500">
                    <span>Total Bill:</span>
                    <span>₹{calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-200">
                    <span>Advance Paid:</span>
                    <span>-₹{parseFloat(formData.advance_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold pt-2 border-t border-blue-500">
                    <span>Pending Amount:</span>
                    <span className={calculatePending() > 0 ? 'text-yellow-300' : 'text-green-300'}>
                      ₹{calculatePending().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {calculatePending() > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Pending Dues Alert:</strong> Patient has outstanding payment of ₹{calculatePending().toFixed(2)}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedPatient(null);
                    setStep(1);
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next: Summary
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Discharge Summary */}
          {selectedPatient && step === 3 && (
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Discharge Summary & Instructions</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Summary</label>
                <textarea
                  value={formData.discharge_summary}
                  onChange={(e) => setFormData({ ...formData, discharge_summary: e.target.value })}
                  rows="4"
                  placeholder="Brief summary of treatment, diagnosis, and outcome..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Instructions</label>
                <textarea
                  value={formData.discharge_instructions}
                  onChange={(e) => setFormData({ ...formData, discharge_instructions: e.target.value })}
                  rows="4"
                  placeholder="Medications, dietary restrictions, follow-up care..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
                <input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveDischarge}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Complete Discharge
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DischargeManagement;
