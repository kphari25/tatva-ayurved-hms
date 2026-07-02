import React, { useState } from 'react';
import { UserPlus, Save, X, Receipt, CheckCircle, FileText, UserCheck } from 'lucide-react';
import { collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendWelcomeSMS } from '../lib/sms';
import InvoiceModal from './InvoiceModal';

const PatientRegistrationNew = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [sendWelcomeSMS, setSendWelcomeSMS] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [savedPatient, setSavedPatient] = useState(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    age: '',
    gender: '',
    patient_type: 'OP',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    blood_group: '',
    allergies: '',
    chronic_conditions: '',
    current_medications: '',
    medical_history: '',
    notes: '',
    registration_fee: ''
  });

  // Generate next MRD number (MRD-1001, MRD-1002, …)
  const generateMRDNumber = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'patients'), orderBy('mrd_number', 'desc'), limit(1)));
      if (snap.empty) return 'MRD-1001';
      const last = snap.docs[0].data().mrd_number || 'MRD-1000';
      const match = last.match(/MRD-(\d+)/);
      const next = match ? parseInt(match[1]) + 1 : 1001;
      return `MRD-${next}`;
    } catch {
      // Fallback: count all patients and start from 1001
      try {
        const snap = await getDocs(collection(db, 'patients'));
        return `MRD-${1001 + snap.size}`;
      } catch {
        return `MRD-${Date.now().toString().slice(-4)}`;
      }
    }
  };

  // Generate next IP number (IP-3000, IP-3001, …)
  const generateIPNumber = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'patients'), orderBy('ip_number', 'desc'), limit(1)));
      if (snap.empty) return 'IP-3000';
      const last = snap.docs[0].data().ip_number;
      if (!last) return 'IP-3000';
      const match = last.match(/IP-(\d+)/);
      const next = match ? parseInt(match[1]) + 1 : 3000;
      return `IP-${next}`;
    } catch {
      try {
        const snap = await getDocs(query(collection(db, 'patients'), where('patient_type', '==', 'IP')));
        return `IP-${3000 + snap.size}`;
      } catch {
        return `IP-${Date.now().toString().slice(-4)}`;
      }
    }
  };

  // Keep old PAT number for backward compat
  const generatePatientNumber = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'patients'), orderBy('created_at', 'desc'), limit(1)));
      if (snap.empty) return 'PAT-2026-0001';
      const last = snap.docs[0].data().patient_number || 'PAT-2026-0000';
      const match = last.match(/PAT-(\d{4})-(\d{4})/);
      if (match) {
        const year = new Date().getFullYear();
        return `PAT-${year}-${(parseInt(match[2]) + 1).toString().padStart(4, '0')}`;
      }
      return `PAT-2026-${Date.now().toString().slice(-4)}`;
    } catch {
      return `PAT-2026-${Date.now().toString().slice(-4)}`;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.age || !formData.gender) {
      alert('Please fill in all required fields (Name, Age, Gender)');
      return;
    }

    try {
      setLoading(true);

      // Generate numbers
      const patientNumber = await generatePatientNumber();
      const mrdNumber = await generateMRDNumber();
      const ipNumber = formData.patient_type === 'IP' ? await generateIPNumber() : null;

      // Prepare patient data
      const patientData = {
        ...formData,
        patient_number: patientNumber,
        mrd_number: mrdNumber,
        ...(ipNumber ? { ip_number: ipNumber } : {}),
        prescriptions: [],
        visits: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email || 'admin'
      };

      // Save to Firebase
      const patientsRef = collection(db, 'patients');
      const docRef = await addDoc(patientsRef, patientData);

      console.log('✅ Patient created successfully:', docRef.id);

      // Send Welcome SMS if enabled
      let smsSent = false;
      if (sendWelcomeSMS && formData.phone) {
        try {
          const patientName = `${formData.first_name} ${formData.last_name}`;
          const result = await sendWelcomeSMS(formData.phone, patientName, patientNumber);
          smsSent = result.success;
          if (!result.success) console.warn('SMS not sent:', result.error);
        } catch (smsError) {
          console.error('⚠️ Failed to send welcome SMS:', smsError);
        }
      }

      // Store saved patient for invoice generation
      setSavedPatient({
        id: docRef.id,
        firebaseId: docRef.id,
        ...patientData,
      });

      // Show success screen with invoice option
      setRegistrationSuccess(true);

    } catch (error) {
      console.error('❌ Error registering patient:', error);
      alert('Failed to register patient: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Success screen shown after registration
  if (registrationSuccess && savedPatient) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Patient Registered!</h2>
            <p className="text-gray-500 mb-6">The patient has been successfully registered in the system.</p>

            <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-semibold text-gray-800">{savedPatient.first_name} {savedPatient.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">MRD Number</span>
                <span className="font-semibold text-teal-700">{savedPatient.mrd_number}</span>
              </div>
              {savedPatient.ip_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">IP Number</span>
                  <span className="font-semibold text-blue-700">{savedPatient.ip_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium text-gray-700">{savedPatient.phone || '—'}</span>
              </div>
              {savedPatient.registration_fee > 0 && (
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-500">Registration Fee</span>
                  <span className="font-bold text-gray-800">₹{parseFloat(savedPatient.registration_fee).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowInvoice(true)}
                className="w-full py-3 px-6 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Receipt className="w-5 h-5" />
                Generate Registration Invoice
              </button>
              <button
                onClick={() => {
                  setRegistrationSuccess(false);
                  setSavedPatient(null);
                  if (onClose) onClose();
                }}
                className="w-full py-3 px-6 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors"
              >
                <UserCheck className="w-5 h-5" />
                Done — Back to Patient Portal
              </button>
            </div>
          </div>
        </div>

        {showInvoice && (
          <InvoiceModal
            patient={savedPatient}
            registrationFee={parseFloat(savedPatient.registration_fee) || 0}
            onClose={() => {
              setShowInvoice(false);
            }}
            onSave={() => {
              setShowInvoice(false);
              if (onClose) onClose();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">New Patient Registration</h1>
                <p className="text-gray-600 text-sm">Complete medical history and information</p>
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6">
          {/* Personal Information */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  required
                  min="0"
                  max="150"
                  placeholder="Enter age in years"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="patient_type"
                  value={formData.patient_type}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="OP">OP (Out-Patient)</option>
                  <option value="IP">IP (In-Patient)</option>
                </select>
              </div>

              {/* Registration Fee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Fee (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="registration_fee"
                  value={formData.registration_fee}
                  onChange={handleChange}
                  min="0"
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* MRD Number - auto-generated, read-only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRD Number <span className="text-xs text-gray-400 font-normal">(auto-generated)</span>
                </label>
                <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-teal-50 text-teal-700 font-semibold text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
                  Will be assigned on save (MRD-1001+)
                </div>
              </div>

              {/* IP Number - only for IP patients */}
              {formData.patient_type === 'IP' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Number <span className="text-xs text-gray-400 font-normal">(auto-generated)</span>
                  </label>
                  <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-purple-50 text-purple-700 font-semibold text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                    Will be assigned on save (IP-3000+)
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Emergency Contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                <input
                  type="tel"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">Medical Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
                <textarea
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  rows="2"
                  placeholder="List any known allergies..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chronic Conditions</label>
                <textarea
                  name="chronic_conditions"
                  value={formData.chronic_conditions}
                  onChange={handleChange}
                  rows="2"
                  placeholder="List any chronic conditions..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
                <textarea
                  name="current_medications"
                  value={formData.current_medications}
                  onChange={handleChange}
                  rows="2"
                  placeholder="List current medications..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Medical History</label>
                <textarea
                  name="medical_history"
                  value={formData.medical_history}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Previous surgeries, major illnesses, etc..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Any additional information..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            {/* SMS Option */}
            <div className="flex items-center gap-2 mr-auto">
              <input
                type="checkbox"
                id="sendWelcomeSMS"
                checked={sendWelcomeSMS}
                onChange={(e) => setSendWelcomeSMS(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="sendWelcomeSMS" className="text-sm text-gray-700 flex items-center gap-2">
                <span>📱 Send Welcome SMS</span>
                {formData.phone && (
                  <span className="text-xs text-gray-500">to {formData.phone}</span>
                )}
              </label>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Registering...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Register Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* Registration Invoice Modal */}
    {showInvoice && savedPatient && (
      <InvoiceModal
        patient={savedPatient}
        registrationFee={parseFloat(savedPatient.registration_fee) || 0}
        onClose={() => {
          setShowInvoice(false);
          if (onClose) onClose();
        }}
        onSave={() => {
          setShowInvoice(false);
          if (onClose) onClose();
        }}
      />
    )}
    </>
  );
};

export default PatientRegistrationNew;
