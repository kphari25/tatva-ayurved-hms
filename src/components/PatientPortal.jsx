import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Edit, Eye, Trash2, 
  Phone, Mail, Calendar, MapPin, Activity,
  X, FileText, Download, Filter
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const PatientPortal = ({ onAddPatient }) => {
  console.log('🔵 PatientPortal rendered, onAddPatient prop:', typeof onAddPatient);
  
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load patients on component mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      if (supabase) {
        // Load from Supabase
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPatients(data || []);
      } else {
        // Load from localStorage as fallback
        const savedPatients = localStorage.getItem('patients');
        if (savedPatients) {
          setPatients(JSON.parse(savedPatients));
        }
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      alert('Error loading patients: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (patientId) => {
    if (!confirm('Are you sure you want to delete this patient?')) return;

    try {
      if (supabase) {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', patientId);

        if (error) throw error;
      } else {
        // Delete from localStorage
        const updatedPatients = patients.filter(p => p.id !== patientId);
        localStorage.setItem('patients', JSON.stringify(updatedPatients));
      }

      // Reload patients
      loadPatients();
      alert('✅ Patient deleted successfully!');
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Error deleting patient: ' + error.message);
    }
  };

  const viewPatientDetails = (patient) => {
    setSelectedPatient(patient);
    setShowDetails(true);
  };

  // Filter patients based on search and gender
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      (patient.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (patient.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (patient.patient_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (patient.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (patient.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesGender = 
      filterGender === 'all' || 
      patient.gender?.toLowerCase() === filterGender.toLowerCase();

    return matchesSearch && matchesGender;
  });

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
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <Users className="w-8 h-8 text-teal-600 mr-3" />
              Patient Portal
            </h1>
            <p className="text-gray-600 mt-1">View and manage all registered patients</p>
          </div>
          <button
            onClick={() => {
              console.log('🟢 New Patient button clicked!');
              console.log('🟢 onAddPatient type:', typeof onAddPatient);
              console.log('🟢 onAddPatient value:', onAddPatient);
              if (onAddPatient) {
                console.log('🟢 Calling onAddPatient...');
                onAddPatient();
                console.log('🟢 onAddPatient called!');
              } else {
                console.error('❌ onAddPatient is undefined!');
              }
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Register New Patient</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Male</p>
                <p className="text-2xl font-bold text-gray-800">
                  {patients.filter(p => p.gender?.toLowerCase() === 'male').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Female</p>
                <p className="text-2xl font-bold text-gray-800">
                  {patients.filter(p => p.gender?.toLowerCase() === 'female').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-800">
                  {patients.filter(p => p.is_active !== false).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, patient number, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <button
            onClick={loadPatients}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="mt-4 text-gray-600">Loading patients...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Patients Found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || filterGender !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Start by registering your first patient'}
            </p>
            {!searchTerm && filterGender === 'all' && (
              <button
                onClick={() => {
                  console.log('🟢 Register First Patient clicked!');
                  if (onAddPatient) {
                    onAddPatient();
                  } else {
                    console.error('❌ onAddPatient is undefined!');
                  }
                }}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Register First Patient
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Patient #</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Age/Gender</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Registration Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-900">
                        {patient.patient_number || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-teal-700 font-semibold text-sm">
                            {patient.first_name?.[0]}{patient.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {patient.first_name} {patient.middle_name} {patient.last_name}
                          </p>
                          {patient.email && (
                            <p className="text-xs text-gray-500">{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-gray-900">{calculateAge(patient.date_of_birth)} years</p>
                        <p className="text-gray-500">{patient.gender || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {patient.phone && (
                          <p className="text-gray-900 flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {patient.phone}
                          </p>
                        )}
                        {patient.alternate_phone && (
                          <p className="text-gray-500 text-xs">{patient.alternate_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {patient.created_at 
                        ? new Date(patient.created_at).toLocaleDateString('en-IN')
                        : patient.registration_date
                        ? new Date(patient.registration_date).toLocaleDateString('en-IN')
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4">
                      {patient.is_active !== false ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => viewPatientDetails(patient)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => alert('Edit functionality coming soon!')}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit Patient"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(patient.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Patient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Details Modal */}
      {showDetails && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Patient Details</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedPatient.patient_number}</p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-teal-600" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Full Name</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.first_name} {selectedPatient.middle_name} {selectedPatient.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Gender</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Date of Birth</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.date_of_birth 
                        ? new Date(selectedPatient.date_of_birth).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Age</p>
                    <p className="font-semibold text-gray-900">{calculateAge(selectedPatient.date_of_birth)} years</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Blood Group</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.blood_group || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Marital Status</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.marital_status || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-teal-600" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Primary Phone</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Alternate Phone</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.alternate_phone || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.email || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Address</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.address || 'N/A'}
                      {selectedPatient.city && `, ${selectedPatient.city}`}
                      {selectedPatient.state && `, ${selectedPatient.state}`}
                      {selectedPatient.pincode && ` - ${selectedPatient.pincode}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              {(selectedPatient.allergies || selectedPatient.chronic_conditions || selectedPatient.current_medications) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-teal-600" />
                    Medical Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    {selectedPatient.allergies && (
                      <div>
                        <p className="text-gray-600">Allergies</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.allergies}</p>
                      </div>
                    )}
                    {selectedPatient.chronic_conditions && (
                      <div>
                        <p className="text-gray-600">Chronic Conditions</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.chronic_conditions}</p>
                      </div>
                    )}
                    {selectedPatient.current_medications && (
                      <div>
                        <p className="text-gray-600">Current Medications</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.current_medications}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {selectedPatient.emergency_contact_name && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Phone className="w-5 h-5 mr-2 text-red-600" />
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Name</p>
                      <p className="font-semibold text-gray-900">{selectedPatient.emergency_contact_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Relation</p>
                      <p className="font-semibold text-gray-900">{selectedPatient.emergency_contact_relation || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{selectedPatient.emergency_contact_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPatient.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-teal-600" />
                    Notes
                  </h3>
                  <p className="text-sm text-gray-900">{selectedPatient.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => alert('Print functionality coming soon!')}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPortal;
