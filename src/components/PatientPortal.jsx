import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Trash2, RefreshCw, Edit, AlertCircle } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import PatientEditModal from './PatientEditModal';

const PatientPortal = () => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = patients.filter(patient =>
      (patient.patient_number || '').toLowerCase().includes(term) ||
      (patient.first_name || '').toLowerCase().includes(term) ||
      (patient.last_name || '').toLowerCase().includes(term) ||
      (patient.phone || '').toLowerCase().includes(term)
    );
    setFilteredPatients(filtered);
  }, [searchTerm, patients]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      // Load from Firebase only
      const patientsRef = collection(db, 'patients');
      const q = query(patientsRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      
      const patientsData = snapshot.docs.map(doc => ({
        firebaseId: doc.id,
        ...doc.data()
      }));

      setPatients(patientsData);
      setFilteredPatients(patientsData);
      console.log(`✅ Loaded ${patientsData.length} patients from Firebase`);
      
    } catch (error) {
      console.error('❌ Error loading patients:', error);
      alert('Failed to load patients: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllPatients = async () => {
    if (patients.length === 0) {
      alert('No patients to delete');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete all ${patients.length} patients from Firebase.\n\nThis action CANNOT be undone!\n\nAre you sure you want to continue?`
    );

    if (!confirmed) return;

    const finalConfirm = window.confirm(
      `🚨 FINAL CONFIRMATION\n\nYou are about to delete ${patients.length} patients permanently.\n\nType anything and click OK to proceed, or Cancel to abort.`
    );

    if (!finalConfirm) return;

    try {
      setLoading(true);
      
      // Delete in batches of 500
      const batchSize = 500;
      for (let i = 0; i < patients.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchPatients = patients.slice(i, i + batchSize);

        batchPatients.forEach(patient => {
          if (patient.firebaseId) {
            const patientRef = doc(db, 'patients', patient.firebaseId);
            batch.delete(patientRef);
          }
        });

        await batch.commit();
        console.log(`Deleted ${Math.min(i + batchSize, patients.length)}/${patients.length} patients`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      alert(`✅ Successfully deleted all ${patients.length} patients!`);
      
      // Reload
      await loadPatients();
      
    } catch (error) {
      console.error('❌ Error deleting patients:', error);
      alert('Failed to delete patients: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPatient = (patient) => {
    setSelectedPatient(patient);
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedPatient(null);
  };

  const handlePatientUpdated = () => {
    loadPatients();
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-teal-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Patient Portal</h1>
              <p className="text-gray-600 text-sm">
                {patients.length} patient{patients.length !== 1 ? 's' : ''} loaded from Firebase
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadPatients}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => window.location.href = '#/patient-registration'}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Patient
            </button>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, patient number, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Delete All Button */}
          <button
            onClick={handleDeleteAllPatients}
            disabled={loading || patients.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5" />
            Delete All Patients
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t flex gap-6 text-sm">
          <div>
            <span className="text-gray-600">Total Patients:</span>
            <span className="ml-2 font-semibold text-gray-900">{patients.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Showing:</span>
            <span className="ml-2 font-semibold text-gray-900">{filteredPatients.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Storage:</span>
            <span className="ml-2 font-semibold text-teal-600">Firebase Cloud</span>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Firebase Cloud Storage Active</p>
            <p>
              This portal shows only patients stored in Firebase. Old localStorage patients are not displayed. 
              Register new patients using the "New Patient" button above.
            </p>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading patients from Firebase...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">
              {searchTerm ? 'No patients match your search' : 'No patients registered yet'}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? 'Try a different search term' : 'Register your first patient to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => window.location.href = '#/patient-registration'}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Register First Patient
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age/Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.firebaseId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {patient.patient_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {patient.first_name} {patient.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {calculateAge(patient.date_of_birth)} / {patient.gender || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {patient.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {patient.city || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleEditPatient(patient)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600 text-white text-sm rounded hover:bg-teal-700"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedPatient && (
        <PatientEditModal
          patient={selectedPatient}
          onClose={handleCloseModal}
          onUpdate={handlePatientUpdated}
        />
      )}
    </div>
  );
};

export default PatientPortal;
