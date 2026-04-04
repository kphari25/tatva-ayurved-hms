import React, { useState } from 'react';
import { UserPlus, Save, X, AlertCircle, CheckCircle } from 'lucide-react';

const PatientRegistrationNew = ({ onClose, onPatientAdded }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'Male',
    date_of_birth: '',
    age: '',
    phone: '',
    alternate_phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    blood_group: '',
    allergies: '',
    chronic_conditions: '',
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-calculate age from date of birth
    if (name === 'date_of_birth' && value) {
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, age: age.toString() }));
    }
  };

  const generatePatientNumber = () => {
    const year = new Date().getFullYear();
    const patients = JSON.parse(localStorage.getItem('patients') || '[]');
    
    // Get all patient numbers for current year
    const yearPatients = patients.filter(p => p.patient_number?.startsWith(`PAT-${year}`));
    
    // Find highest number
    let maxNum = 0;
    yearPatients.forEach(p => {
      const num = parseInt(p.patient_number.split('-')[2]);
      if (num > maxNum) maxNum = num;
    });
    
    const nextNum = (maxNum + 1).toString().padStart(4, '0');
    return `PAT-${year}-${nextNum}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!formData.first_name || !formData.last_name || !formData.phone) {
        setError('Please fill in required fields: First Name, Last Name, and Phone');
        setLoading(false);
        return;
      }

      // Get current user
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      // Get existing patients
      const patients = JSON.parse(localStorage.getItem('patients') || '[]');

      // Generate patient number
      const patientNumber = generatePatientNumber();

      // Prepare patient data
      const patientData = {
        id: Date.now().toString(),
        patient_number: patientNumber,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || '',
        last_name: formData.last_name.trim(),
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || '',
        age: formData.age ? parseInt(formData.age) : null,
        phone: formData.phone.trim(),
        alternate_phone: formData.alternate_phone?.trim() || '',
        email: formData.email?.trim() || '',
        address: formData.address?.trim() || '',
        city: formData.city?.trim() || '',
        state: formData.state?.trim() || '',
        pincode: formData.pincode?.trim() || '',
        blood_group: formData.blood_group || '',
        allergies: formData.allergies?.trim() || '',
        chronic_conditions: formData.chronic_conditions?.trim() || '',
        notes: formData.notes?.trim() || '',
        is_active: true,
        created_by: currentUser.name || 'System',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_visits: 0,
        registration_date: new Date().toISOString().split('T')[0]
      };

      console.log('💾 Saving patient to localStorage:', patientData);

      // Add to patients array
      patients.push(patientData);

      // Save to localStorage
      localStorage.setItem('patients', JSON.stringify(patients));

      console.log('✅ Patient saved successfully:', patientData);

      // Show success
      setSuccess(true);
      alert(`✅ Patient registered successfully!\n\nPatient Number: ${patientData.patient_number}\nName: ${patientData.first_name} ${patientData.last_name}`);

      // Call callback if provided
      if (onPatientAdded) {
        onPatientAdded(patientData);
      }

      // Reset form
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'Male',
        date_of_birth: '',
        age: '',
        phone: '',
        alternate_phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        blood_group: '',
        allergies: '',
        chronic_conditions: '',
        notes: ''
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);

    } catch (err) {
      console.error('❌ Error saving patient:', err);
      setError(err.message || 'Failed to save patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <UserPlus className="w-6 h-6 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-800">New Patient Registration</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-700">
              Patient registered successfully! Closing in 2 seconds...
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Personal Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label>
                <input
                  type="tel"
                  name="alternate_phone"
                  value={formData.alternate_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="">Select</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                  <option>O+</option>
                  <option>O-</option>
                </select>
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Medical Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                <textarea
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="List any known allergies..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chronic Conditions</label>
                <textarea
                  name="chronic_conditions"
                  value={formData.chronic_conditions}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="List any chronic conditions..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-white border-t pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Register Patient</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientRegistrationNew;
