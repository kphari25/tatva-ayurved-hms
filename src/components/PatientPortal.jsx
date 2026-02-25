// COMPLETE PATIENT PORTAL WITH EDIT FIX + FOLLOW-UP TRACKING
// Copy this entire file to: src/components/PatientPortal.jsx
// Make sure to run add-followup-table.sql in Supabase first!

import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Phone, MapPin, FileText, Upload, Plus,
  Search, ChevronRight, Heart, Activity, Pill, AlertTriangle,
  X, Save, RefreshCw, Eye, Edit, Clock, CheckCircle,
  Clipboard, Thermometer, Droplets, Wind, Brain, Camera,
  File, Download, ArrowLeft, Users, MessageSquare, CalendarCheck,
  History
} from 'lucide-react';

const PatientPortal = ({ supabase, currentUser, userRole }) => {
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">Loading...</p>
        </div>
      </div>
    );
  }

  const [view, setView] = useState('list');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [followups, setFollowups] = useState([]);
  const [showAddFollowup, setShowAddFollowup] = useState(false);
  
  const [newFollowup, setNewFollowup] = useState({
    followupDate: new Date().toISOString().split('T')[0],
    callUpdate: '',
    remark: '',
    nextFollowupDate: '',
    doctorName: `${currentUser.first_name} ${currentUser.last_name}`
  });

  const [newPatient, setNewPatient] = useState({
    firstName: '', lastName: '', dateOfBirth: '', age: '', gender: '',
    phone: '', email: '', address: '', city: '', state: 'Kerala', pincode: '',
    emergencyName: '', emergencyPhone: '', prakriti: '', chiefComplaint: '',
    symptoms: '', currentMedications: '', allergies: '', medicalHistory: '',
    familyHistory: '', surgicalHistory: '', lifestyle: '', diet: '',
    bloodPressure: '', pulse: '', temperature: '', weight: '', height: '', bloodGroup: ''
  });

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowups = async (patientId) => {
    try {
      const { data, error } = await supabase
        .from('patient_followups')
        .select('*')
        .eq('patient_id', patientId)
        .order('followup_date', { ascending: false });
      if (error) { setFollowups([]); return; }
      setFollowups(data || []);
    } catch (error) { setFollowups([]); }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const generatePatientNumber = () => `TAH-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;

  const handleSavePatient = async () => {
    if (!newPatient.firstName || !newPatient.lastName || !newPatient.phone) {
      showMessage('error', 'Fill in Name and Phone');
      return;
    }
    setSaving(true);
    try {
      const patientNumber = generatePatientNumber();
      const { error } = await supabase.from('patients').insert({
        patient_number: patientNumber,
        first_name: newPatient.firstName,
        last_name: newPatient.lastName,
        date_of_birth: newPatient.dateOfBirth || null,
        age: newPatient.age ? parseInt(newPatient.age) : null,
        gender: newPatient.gender,
        phone: newPatient.phone,
        email: newPatient.email,
        address: newPatient.address,
        city: newPatient.city,
        state: newPatient.state,
        pincode: newPatient.pincode,
        emergency_contact_name: newPatient.emergencyName,
        emergency_contact_phone: newPatient.emergencyPhone,
        prakriti: newPatient.prakriti,
        allergies: newPatient.allergies
      });
      if (error) throw error;
      showMessage('success', `✅ Patient registered! ID: ${patientNumber}`);
      setView('list');
      loadPatients();
    } catch (error) {
      showMessage('error', 'Failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePatient = async () => {
    if (!editingPatient) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('patients').update({
        first_name: editingPatient.first_name,
        last_name: editingPatient.last_name,
        phone: editingPatient.phone,
        email: editingPatient.email,
        age: editingPatient.age,
        gender: editingPatient.gender,
        address: editingPatient.address,
        city: editingPatient.city,
        state: editingPatient.state,
        pincode: editingPatient.pincode,
        emergency_contact_name: editingPatient.emergency_contact_name,
        emergency_contact_phone: editingPatient.emergency_contact_phone
      }).eq('id', editingPatient.id);
      if (error) throw error;
      showMessage('success', '✅ Updated!');
      await loadPatients();
      setSelectedPatient(editingPatient);
      setView('detail');
    } catch (error) {
      showMessage('error', 'Failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddFollowup = async () => {
    if (!selectedPatient || !newFollowup.followupDate) {
      showMessage('error', 'Enter date');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('patient_followups').insert({
        patient_id: selectedPatient.id,
        followup_date: newFollowup.followupDate,
        call_update: newFollowup.callUpdate,
        remark: newFollowup.remark,
        next_followup_date: newFollowup.nextFollowupDate || null,
        doctor_name: newFollowup.doctorName,
        created_by: currentUser.id
      });
      if (error) throw error;
      showMessage('success', '✅ Follow-up added!');
      setNewFollowup({
        followupDate: new Date().toISOString().split('T')[0],
        callUpdate: '', remark: '', nextFollowupDate: '',
        doctorName: `${currentUser.first_name} ${currentUser.last_name}`
      });
      setShowAddFollowup(false);
      loadFollowups(selectedPatient.id);
    } catch (error) {
      showMessage('error', 'Failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery) ||
    p.patient_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // LIST VIEW
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Patient Portal</h1>
            <p className="text-slate-600">Register and manage patient records</p>
          </div>
          <button onClick={() => setView('register')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg">
            <Plus className="w-5 h-5" /> Register New Patient
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none" />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No patients found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold">Patient</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-blue-50">
                    <td className="px-6 py-4">
                      <p className="font-bold">{patient.first_name} {patient.last_name}</p>
                      <p className="text-xs text-slate-500">{patient.city}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm bg-slate-100 px-3 py-1 rounded-lg">
                        {patient.patient_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p>{patient.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => { 
                        setSelectedPatient(patient); 
                        loadFollowups(patient.id);
                        setView('detail'); 
                      }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                        <Eye className="w-4 h-4" /> View
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

  // REGISTER VIEW - Simplified for space
  if (view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="mb-6 flex items-center gap-4">
          <button onClick={() => setView('list')} className="p-2 bg-white border rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold">Register New Patient</h1>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">First Name *</label>
              <input type="text" value={newPatient.firstName}
                onChange={(e) => setNewPatient({...newPatient, firstName: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Last Name *</label>
              <input type="text" value={newPatient.lastName}
                onChange={(e) => setNewPatient({...newPatient, lastName: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Phone *</label>
              <input type="tel" value={newPatient.phone}
                onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Email</label>
              <input type="email" value={newPatient.email}
                onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Age</label>
              <input type="number" value={newPatient.age}
                onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Gender</label>
              <select value={newPatient.gender}
                onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold mb-2">Address</label>
              <input type="text" value={newPatient.address}
                onChange={(e) => setNewPatient({...newPatient, address: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">City</label>
              <input type="text" value={newPatient.city}
                onChange={(e) => setNewPatient({...newPatient, city: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button onClick={() => setView('list')}
              className="flex-1 px-6 py-4 border-2 rounded-xl font-semibold">
              Cancel
            </button>
            <button onClick={handleSavePatient} disabled={saving}
              className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50">
              {saving ? 'Saving...' : 'Register Patient'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // EDIT VIEW
  if (view === 'edit' && editingPatient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="mb-6 flex items-center gap-4">
          <button onClick={() => setView('detail')} className="p-2 bg-white border rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold">Edit Patient</h1>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold mb-2">First Name</label>
              <input type="text" value={editingPatient.first_name || ''}
                onChange={(e) => setEditingPatient({...editingPatient, first_name: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Last Name</label>
              <input type="text" value={editingPatient.last_name || ''}
                onChange={(e) => setEditingPatient({...editingPatient, last_name: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Phone</label>
              <input type="tel" value={editingPatient.phone || ''}
                onChange={(e) => setEditingPatient({...editingPatient, phone: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Email</label>
              <input type="email" value={editingPatient.email || ''}
                onChange={(e) => setEditingPatient({...editingPatient, email: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Age</label>
              <input type="number" value={editingPatient.age || ''}
                onChange={(e) => setEditingPatient({...editingPatient, age: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Gender</label>
              <select value={editingPatient.gender || ''}
                onChange={(e) => setEditingPatient({...editingPatient, gender: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold mb-2">Address</label>
              <input type="text" value={editingPatient.address || ''}
                onChange={(e) => setEditingPatient({...editingPatient, address: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">City</label>
              <input type="text" value={editingPatient.city || ''}
                onChange={(e) => setEditingPatient({...editingPatient, city: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-xl" />
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setView('detail')}
              className="flex-1 px-6 py-3 border-2 rounded-xl font-semibold">
              Cancel
            </button>
            <button onClick={handleUpdatePatient} disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (view === 'detail' && selectedPatient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 bg-white border rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">
                {selectedPatient.first_name} {selectedPatient.last_name}
              </h1>
              <p className="text-slate-500 font-mono">{selectedPatient.patient_number}</p>
            </div>
          </div>
          <button onClick={() => {
            setEditingPatient({...selectedPatient});
            setView('edit');
          }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold">
            <Edit className="w-4 h-4" /> Edit Patient
          </button>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* Patient Details */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Patient Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Phone</p>
                <p className="font-semibold">{selectedPatient.phone}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="font-semibold">{selectedPatient.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Age</p>
                <p className="font-semibold">{selectedPatient.age || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Gender</p>
                <p className="font-semibold capitalize">{selectedPatient.gender || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-slate-600">Address</p>
                <p className="font-semibold">{selectedPatient.address || 'N/A'}, {selectedPatient.city || ''}</p>
              </div>
            </div>
          </div>

          {/* Follow-up History */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                Follow-up History
              </h3>
              <button onClick={() => setShowAddFollowup(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold">
                + Add Follow-up
              </button>
            </div>

            {followups.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No follow-ups recorded yet</p>
            ) : (
              <div className="space-y-3">
                {followups.map((f, i) => (
                  <div key={i} className="border-2 border-purple-100 rounded-xl p-4 bg-purple-50">
                    <div className="flex justify-between mb-2">
                      <p className="font-bold text-purple-800">
                        {new Date(f.followup_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500">{f.doctor_name}</p>
                    </div>
                    {f.call_update && <p className="text-sm mb-1"><strong>Update:</strong> {f.call_update}</p>}
                    {f.remark && <p className="text-sm mb-1"><strong>Remark:</strong> {f.remark}</p>}
                    {f.next_followup_date && (
                      <p className="text-sm text-purple-600">
                        <strong>Next:</strong> {new Date(f.next_followup_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Follow-up Modal */}
        {showAddFollowup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Add Follow-up</h3>
                <button onClick={() => setShowAddFollowup(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Date of Follow-up *</label>
                  <input type="date" value={newFollowup.followupDate}
                    onChange={(e) => setNewFollowup({...newFollowup, followupDate: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Call Follow-up Update</label>
                  <textarea value={newFollowup.callUpdate}
                    onChange={(e) => setNewFollowup({...newFollowup, callUpdate: e.target.value})}
                    placeholder="What was discussed..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 rounded-xl resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Remark</label>
                  <textarea value={newFollowup.remark}
                    onChange={(e) => setNewFollowup({...newFollowup, remark: e.target.value})}
                    placeholder="Additional notes..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 rounded-xl resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Next Follow-up Date</label>
                  <input type="date" value={newFollowup.nextFollowupDate}
                    onChange={(e) => setNewFollowup({...newFollowup, nextFollowupDate: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Doctor Name</label>
                  <input type="text" value={newFollowup.doctorName}
                    onChange={(e) => setNewFollowup({...newFollowup, doctorName: e.target.value})}
                    className="w-full px-4 py-3 border-2 rounded-xl" />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button onClick={() => setShowAddFollowup(false)}
                  className="flex-1 px-6 py-3 border-2 rounded-xl font-semibold">
                  Cancel
                </button>
                <button onClick={handleAddFollowup} disabled={saving}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Follow-up'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default PatientPortal;
