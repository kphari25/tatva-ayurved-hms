import React, { useState } from 'react';
import { 
  UserPlus, Save, X, Upload, FileText, AlertCircle,
  Calendar, Phone, Mail, MapPin, Heart, Activity,
  Pill, ClipboardList, User, Home, Check
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ⚠️ REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://svpfcfgrnonxukcsqnly.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cGZjZmdybm9ueHVrY3Nxbmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjYyMTAsImV4cCI6MjA4Njg0MjIxMH0.kixATD6p5mDhchdUBgKUFU4Qyei4AXNDPVmcXfzzBwo';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PatientRegistrationNew = ({ onClose }) => {
  const [formData, setFormData] = useState({
    // Basic Information
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    phone: '',
    alternate_phone: '',
    email: '',
    
    // Address
    address: '',
    city: '',
    state: '',
    pincode: '',
    
    // Medical Information
    blood_group: '',
    occupation: '',
    
    // Emergency Contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    
    // Medical History
    allergies: '',
    chronic_conditions: '',
    current_medications: '',
    past_surgeries: '',
    family_medical_history: '',
    
    // Current Symptoms
    chief_complaint: '',
    symptoms_description: '',
    symptom_duration: '',
    symptom_severity: '',
    
    // Lifestyle
    smoking: 'no',
    alcohol: 'no',
    exercise: '',
    diet_type: '',
    sleep_hours: '',
    
    // File uploads
    blood_test_reports: [],
    other_reports: [],
    prescription_history: []
  });

  const [uploadedFiles, setUploadedFiles] = useState({
    blood_tests: [],
    other_reports: [],
    prescriptions: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = async (e, category) => {
    const files = Array.from(e.target.files);
    
    const filePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type,
            data: event.target.result,
            uploadDate: new Date().toISOString()
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const uploadedFileData = await Promise.all(filePromises);
    
    setUploadedFiles(prev => ({
      ...prev,
      [category]: [...prev[category], ...uploadedFileData]
    }));
  };

  const removeFile = (category, index) => {
    setUploadedFiles(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!formData.first_name || !formData.last_name) {
      setError('First name and last name are required');
      return false;
    }
    if (!formData.phone) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.gender) {
      setError('Gender is required');
      return false;
    }
    if (!formData.date_of_birth) {
      setError('Date of birth is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Calculate age from date of birth
      const birthDate = new Date(formData.date_of_birth);
      const age = Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));

      // Generate patient number
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      const patient_number = `PAT-${year}-${randomNum}`;

      // Prepare data for database
      const patientData = {
        patient_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth,
        age,
        phone: formData.phone,
        alternate_phone: formData.alternate_phone || null,
        email: formData.email || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        blood_group: formData.blood_group || null,
        occupation: formData.occupation || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        emergency_contact_relation: formData.emergency_contact_relation || null,
        
        // Arrays for PostgreSQL
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : [],
        chronic_conditions: formData.chronic_conditions ? formData.chronic_conditions.split(',').map(c => c.trim()) : [],
        
        // Additional medical info as JSON
        medical_history: {
          current_medications: formData.current_medications,
          past_surgeries: formData.past_surgeries,
          family_medical_history: formData.family_medical_history,
          chief_complaint: formData.chief_complaint,
          symptoms_description: formData.symptoms_description,
          symptom_duration: formData.symptom_duration,
          symptom_severity: formData.symptom_severity,
          lifestyle: {
            smoking: formData.smoking,
            alcohol: formData.alcohol,
            exercise: formData.exercise,
            diet_type: formData.diet_type,
            sleep_hours: formData.sleep_hours
          }
        },
        
        // File uploads
        uploaded_files: {
          blood_tests: uploadedFiles.blood_tests,
          other_reports: uploadedFiles.other_reports,
          prescriptions: uploadedFiles.prescriptions
        },
        
        is_active: true,
        created_at: new Date().toISOString()
      };

      // Insert into Supabase
      const { data, error: dbError } = await supabase
        .from('patients')
        .insert([patientData])
        .select();

      if (dbError) throw dbError;

      setSuccess(true);
      setTimeout(() => {
        alert(`✅ Patient registered successfully!\n\nPatient Number: ${patient_number}\nName: ${formData.first_name} ${formData.last_name}`);
        
        if (onClose) {
          onClose(data[0]);
        }
      }, 1000);

    } catch (err) {
      console.error('Error registering patient:', err);
      setError(err.message || 'Failed to register patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Registration Successful!</h2>
          <p className="text-gray-600 mb-8">Patient has been registered successfully.</p>
          <button
            onClick={() => {
              if (onClose) onClose();
            }}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-colors shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">New Patient Registration</h1>
                <p className="text-sm text-gray-500">Complete medical registration form</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-emerald-600" />
              Basic Information
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  name="alternate_phone"
                  value={formData.alternate_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Blood Group
                </label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
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
              <div className="col-span-3">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Occupation
                </label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Home className="w-5 h-5 mr-2 text-emerald-600" />
              Address Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-emerald-600" />
              Emergency Contact
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Relation
                </label>
                <input
                  type="text"
                  name="emergency_contact_relation"
                  value={formData.emergency_contact_relation}
                  onChange={handleChange}
                  placeholder="e.g., Spouse, Parent, Sibling"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Medical History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-emerald-600" />
              Medical History
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Allergies (comma-separated)
                </label>
                <input
                  type="text"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  placeholder="e.g., Penicillin, Peanuts, Dust"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chronic Conditions (comma-separated)
                </label>
                <input
                  type="text"
                  name="chronic_conditions"
                  value={formData.chronic_conditions}
                  onChange={handleChange}
                  placeholder="e.g., Diabetes, Hypertension, Asthma"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Current Medications
                </label>
                <textarea
                  name="current_medications"
                  value={formData.current_medications}
                  onChange={handleChange}
                  rows="2"
                  placeholder="List any medications currently taking..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Past Surgeries
                </label>
                <textarea
                  name="past_surgeries"
                  value={formData.past_surgeries}
                  onChange={handleChange}
                  rows="2"
                  placeholder="List any previous surgeries and dates..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Family Medical History
                </label>
                <textarea
                  name="family_medical_history"
                  value={formData.family_medical_history}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Any hereditary conditions or family illnesses..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Current Symptoms */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-emerald-600" />
              Current Symptoms
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chief Complaint
                </label>
                <input
                  type="text"
                  name="chief_complaint"
                  value={formData.chief_complaint}
                  onChange={handleChange}
                  placeholder="Main reason for visit"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Symptoms Description
                </label>
                <textarea
                  name="symptoms_description"
                  value={formData.symptoms_description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Describe symptoms in detail..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  name="symptom_duration"
                  value={formData.symptom_duration}
                  onChange={handleChange}
                  placeholder="e.g., 3 days, 2 weeks"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Severity
                </label>
                <select
                  name="symptom_severity"
                  value={formData.symptom_severity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lifestyle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <ClipboardList className="w-5 h-5 mr-2 text-emerald-600" />
              Lifestyle Information
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Smoking
                </label>
                <select
                  name="smoking"
                  value={formData.smoking}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="former">Former</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Alcohol
                </label>
                <select
                  name="alcohol"
                  value={formData.alcohol}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="no">No</option>
                  <option value="occasionally">Occasionally</option>
                  <option value="regularly">Regularly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Exercise
                </label>
                <input
                  type="text"
                  name="exercise"
                  value={formData.exercise}
                  onChange={handleChange}
                  placeholder="e.g., Daily yoga, None"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Diet Type
                </label>
                <select
                  name="diet_type"
                  value={formData.diet_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non-vegetarian">Non-Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Average Sleep Hours
                </label>
                <input
                  type="text"
                  name="sleep_hours"
                  value={formData.sleep_hours}
                  onChange={handleChange}
                  placeholder="e.g., 6-7 hours"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* File Uploads */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-emerald-600" />
              Upload Medical Reports
            </h2>
            
            {/* Blood Test Reports */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Blood Test Reports
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => handleFileUpload(e, 'blood_tests')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {uploadedFiles.blood_tests.length > 0 && (
                <div className="mt-2 space-y-2">
                  {uploadedFiles.blood_tests.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile('blood_tests', index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other Reports */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Other Medical Reports
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => handleFileUpload(e, 'other_reports')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {uploadedFiles.other_reports.length > 0 && (
                <div className="mt-2 space-y-2">
                  {uploadedFiles.other_reports.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile('other_reports', index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previous Prescriptions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Previous Prescriptions
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => handleFileUpload(e, 'prescriptions')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {uploadedFiles.prescriptions.length > 0 && (
                <div className="mt-2 space-y-2">
                  {uploadedFiles.prescriptions.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(2)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile('prescriptions', index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4 pb-8">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Registering Patient...' : 'Register Patient'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientRegistrationNew;
