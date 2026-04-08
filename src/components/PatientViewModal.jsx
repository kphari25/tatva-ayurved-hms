import React, { useState } from 'react';
import { X, User, Phone, Mail, MapPin, Calendar, Heart, AlertCircle, Send, MessageSquare, Edit } from 'lucide-react';

const PatientViewModal = ({ patient, onClose, onEdit, onSendSMS }) => {
  const [showSMSForm, setShowSMSForm] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);

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

  const handleSendSMS = async () => {
    if (!smsMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    if (!patient.phone) {
      alert('Patient does not have a phone number');
      return;
    }

    try {
      setSendingSMS(true);

      // Here you would integrate with SMS API (e.g., Twilio, MSG91, etc.)
      // For now, we'll simulate the API call
      
      console.log('Sending SMS to:', patient.phone);
      console.log('Message:', smsMessage);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Save SMS log to Firebase (optional)
      // await addDoc(collection(db, 'sms_logs'), {
      //   patient_id: patient.id,
      //   patient_name: `${patient.first_name} ${patient.last_name}`,
      //   phone: patient.phone,
      //   message: smsMessage,
      //   sent_at: new Date().toISOString(),
      //   status: 'sent'
      // });

      alert('✅ SMS sent successfully!');
      setSmsMessage('');
      setShowSMSForm(false);

    } catch (error) {
      console.error('Error sending SMS:', error);
      alert('❌ Failed to send SMS: ' + error.message);
    } finally {
      setSendingSMS(false);
    }
  };

  const quickMessages = [
    'Your appointment is confirmed for tomorrow at 10 AM.',
    'Please collect your prescription from the pharmacy.',
    'Reminder: Take your medicines as prescribed.',
    'Your lab reports are ready for collection.',
    'Please visit for follow-up consultation.'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-teal-700 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {patient.first_name} {patient.last_name}
              </h2>
              <p className="text-teal-100 text-sm">{patient.patient_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSMSForm(!showSMSForm)}
              className="px-4 py-2 bg-white text-teal-600 rounded-lg hover:bg-teal-50 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              SMS
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(patient)}
                className="px-4 py-2 bg-white text-teal-600 rounded-lg hover:bg-teal-50 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* SMS Form */}
          {showSMSForm && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-800">Send SMS</h3>
              </div>

              {/* Quick Messages */}
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-2">Quick Messages:</p>
                <div className="flex flex-wrap gap-2">
                  {quickMessages.map((msg, index) => (
                    <button
                      key={index}
                      onClick={() => setSmsMessage(msg)}
                      className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-xs hover:bg-blue-100 text-gray-700"
                    >
                      {msg.substring(0, 30)}...
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Type your message here..."
                rows="4"
                maxLength="160"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {smsMessage.length}/160 characters
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowSMSForm(false);
                      setSmsMessage('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendSMS}
                    disabled={sendingSMS || !smsMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {sendingSMS ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send SMS
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Calendar} label="Date of Birth" value={patient.date_of_birth || 'N/A'} />
              <InfoItem icon={User} label="Age" value={`${calculateAge(patient.date_of_birth)} years`} />
              <InfoItem icon={User} label="Gender" value={patient.gender || 'N/A'} />
              <InfoItem icon={Heart} label="Blood Group" value={patient.blood_group || 'N/A'} />
            </div>
          </div>

          {/* Contact Information */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
              <Phone className="w-5 h-5 text-teal-600" />
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={Phone} label="Phone" value={patient.phone || 'N/A'} />
              <InfoItem icon={Mail} label="Email" value={patient.email || 'N/A'} />
              <InfoItem icon={MapPin} label="Address" value={patient.address || 'N/A'} fullWidth />
              <InfoItem icon={MapPin} label="City" value={patient.city || 'N/A'} />
              <InfoItem icon={MapPin} label="State" value={patient.state || 'N/A'} />
              <InfoItem icon={MapPin} label="Pincode" value={patient.pincode || 'N/A'} />
            </div>
          </div>

          {/* Emergency Contact */}
          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem icon={User} label="Name" value={patient.emergency_contact_name || 'N/A'} />
                <InfoItem icon={Phone} label="Phone" value={patient.emergency_contact_phone || 'N/A'} />
              </div>
            </div>
          )}

          {/* Medical Information */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-600" />
              Medical Information
            </h3>
            <div className="space-y-3">
              {patient.allergies && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Allergies</p>
                  <p className="text-gray-700">{patient.allergies}</p>
                </div>
              )}
              {patient.chronic_conditions && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm font-medium text-orange-800 mb-1">Chronic Conditions</p>
                  <p className="text-gray-700">{patient.chronic_conditions}</p>
                </div>
              )}
              {patient.current_medications && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">Current Medications</p>
                  <p className="text-gray-700">{patient.current_medications}</p>
                </div>
              )}
              {patient.medical_history && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-medium text-purple-800 mb-1">Medical History</p>
                  <p className="text-gray-700">{patient.medical_history}</p>
                </div>
              )}
            </div>
          </div>

          {/* Prescriptions */}
          {patient.prescriptions && patient.prescriptions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Current Prescriptions</h3>
              <div className="space-y-2">
                {patient.prescriptions.map((prescription, index) => (
                  <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{prescription.medicine}</span>
                        {prescription.medicineName && (
                          <p className="text-xs text-gray-500">{prescription.medicineName}</p>
                        )}
                      </div>
                      <div className="text-gray-700">{prescription.dosage}</div>
                      <div className="text-gray-700">{prescription.frequency}</div>
                      <div className="text-gray-700">{prescription.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Notes */}
          {patient.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Additional Notes</h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-700">{patient.notes}</p>
              </div>
            </div>
          )}

          {/* Registration Info */}
          <div className="text-sm text-gray-500 border-t pt-4">
            <p>Registered: {patient.created_at ? new Date(patient.created_at).toLocaleString() : 'N/A'}</p>
            {patient.updated_at && (
              <p>Last Updated: {new Date(patient.updated_at).toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value, fullWidth }) => (
  <div className={fullWidth ? 'col-span-2' : ''}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
    <p className="text-gray-900 ml-6">{value}</p>
  </div>
);

export default PatientViewModal;
