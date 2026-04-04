import React, { useState, useEffect } from 'react';
import { Search, Users, UserPlus, RefreshCw, Eye, MessageSquare, AlertCircle } from 'lucide-react';
import PatientEditModal from './PatientEditModal';
import MessageModal from './MessageModal';

const PatientPortal = ({ onNewPatient }) => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messagePatient, setMessagePatient] = useState(null);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  // Filter patients when search term changes
  useEffect(() => {
    filterPatients();
  }, [searchTerm, patients]);

  const loadPatients = () => {
    try {
      const patientsData = localStorage.getItem('patients');
      const loadedPatients = patientsData ? JSON.parse(patientsData) : [];
      setPatients(loadedPatients);
      setFilteredPatients(loadedPatients);
      console.log('✅ Patients loaded:', loadedPatients.length);
    } catch (err) {
      console.error('❌ Error loading patients:', err);
    }
  };

  const filterPatients = () => {
    if (!searchTerm.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = patients.filter(patient => {
      const fullName = `${patient.first_name} ${patient.middle_name || ''} ${patient.last_name}`.toLowerCase();
      const patientNumber = patient.patient_number?.toLowerCase() || '';
      const phone = patient.phone?.toLowerCase() || '';
      
      return fullName.includes(term) || 
             patientNumber.includes(term) || 
             phone.includes(term);
    });

    setFilteredPatients(filtered);
  };

  const handleViewPatient = (patient) => {
    setSelectedPatient(patient);
    setShowEditModal(true);
  };

  const handleSendMessage = (patient) => {
    setMessagePatient(patient);
    setShowMessageModal(true);
  };

  const handlePatientUpdated = () => {
    loadPatients();
    setShowEditModal(false);
    setSelectedPatient(null);
  };

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Patient Portal</h1>
            <p className="text-sm text-gray-600">
              {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'} found
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadPatients}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          {onNewPatient && (
            <button
              onClick={onNewPatient}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <UserPlus className="w-4 h-4" />
              <span>New Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, patient number, or phone..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredPatients.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {searchTerm ? 'No patients found' : 'No patients registered yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Click "New Patient" to register your first patient'}
          </p>
        </div>
      )}

      {/* Patients Table */}
      {filteredPatients.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age/Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-teal-600">
                        {patient.patient_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {patient.first_name} {patient.middle_name} {patient.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {patient.age || getAge(patient.date_of_birth)} / {patient.gender}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.city || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {patient.registration_date || new Date(patient.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleViewPatient(patient)}
                          className="flex items-center space-x-1 text-teal-600 hover:text-teal-900"
                          title="View/Edit Patient"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleSendMessage(patient)}
                          className="flex items-center space-x-1 text-green-600 hover:text-green-900"
                          title="Send Message"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Message</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPatient && (
        <PatientEditModal
          patient={selectedPatient}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPatient(null);
          }}
          onUpdate={handlePatientUpdated}
        />
      )}

      {/* Message Modal */}
      {showMessageModal && messagePatient && (
        <MessageModal
          patient={messagePatient}
          onClose={() => {
            setShowMessageModal(false);
            setMessagePatient(null);
          }}
        />
      )}
    </div>
  );
};

export default PatientPortal;
