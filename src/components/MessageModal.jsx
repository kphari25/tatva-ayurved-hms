import React, { useState } from 'react';
import { X, Send, MessageSquare, Clock, CheckCircle } from 'lucide-react';

const MessageModal = ({ patient, onClose }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [messageType, setMessageType] = useState('whatsapp'); // whatsapp or sms

  const templates = [
    {
      id: 'appointment_reminder',
      name: 'Appointment Reminder',
      message: `Dear ${patient.first_name} ${patient.last_name},\n\nThis is a reminder for your upcoming appointment at Tatva Ayurved Hospital.\n\nPlease arrive 10 minutes early.\n\nThank you!`
    },
    {
      id: 'followup_required',
      name: 'Follow-up Required',
      message: `Dear ${patient.first_name} ${patient.last_name},\n\nPlease schedule a follow-up appointment for your ongoing treatment.\n\nContact us at: [Your Hospital Phone]\n\nTatva Ayurved Hospital`
    },
    {
      id: 'lab_results_ready',
      name: 'Lab Results Ready',
      message: `Dear ${patient.first_name} ${patient.last_name},\n\nYour lab test results are ready for collection.\n\nPlease visit the hospital during working hours.\n\nTatva Ayurved Hospital`
    },
    {
      id: 'payment_reminder',
      name: 'Payment Reminder',
      message: `Dear ${patient.first_name} ${patient.last_name},\n\nThis is a friendly reminder about your pending payment.\n\nPlease clear your dues at your earliest convenience.\n\nTatva Ayurved Hospital`
    },
    {
      id: 'prescription_ready',
      name: 'Prescription Ready',
      message: `Dear ${patient.first_name} ${patient.last_name},\n\nYour prescription is ready for pickup at our pharmacy.\n\nWorking hours: 9 AM - 6 PM\n\nTatva Ayurved Hospital`
    },
    {
      id: 'wellness_checkup',
      name: 'Wellness Check-up',
      message: `Dear ${patient.first_name} ${patient.last_name},\n\nIt's time for your routine wellness check-up!\n\nSchedule your appointment today.\n\nTatva Ayurved Hospital`
    },
    {
      id: 'custom',
      name: 'Custom Message',
      message: ''
    }
  ];

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template && templateId !== 'custom') {
      setCustomMessage(template.message);
    } else {
      setCustomMessage('');
    }
  };

  const getMessage = () => {
    if (selectedTemplate === 'custom') {
      return customMessage;
    }
    return customMessage || 'Please select a template or write a custom message';
  };

  const sendWhatsAppMessage = () => {
    const message = getMessage();
    if (!message || message.trim() === '') {
      alert('Please enter a message');
      return;
    }

    // Clean phone number (remove spaces, dashes, etc.)
    let phone = patient.phone.replace(/[^0-9]/g, '');
    
    // Add country code if not present (assuming India +91)
    if (!phone.startsWith('91') && phone.length === 10) {
      phone = '91' + phone;
    }

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // WhatsApp URL
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    
    // Open WhatsApp in new window
    window.open(whatsappUrl, '_blank');

    // Save to message history in localStorage
    saveMessageHistory(message, 'whatsapp');
    
    // Show success and close
    alert('WhatsApp opened! Send the message from WhatsApp.');
    onClose();
  };

  const sendSMSMessage = () => {
    const message = getMessage();
    if (!message || message.trim() === '') {
      alert('Please enter a message');
      return;
    }

    // For SMS, open default SMS app (works on mobile)
    const phone = patient.phone.replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(message);
    
    // SMS URL (works on mobile devices)
    const smsUrl = `sms:${phone}?body=${encodedMessage}`;
    
    window.location.href = smsUrl;

    // Save to message history
    saveMessageHistory(message, 'sms');
    
    alert('SMS app opened! Send the message.');
    onClose();
  };

  const saveMessageHistory = (message, type) => {
    try {
      // Get existing message history
      const historyKey = `message_history_${patient.id}`;
      const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
      
      // Add new message
      const newMessage = {
        id: Date.now().toString(),
        message: message,
        type: type,
        template: selectedTemplate,
        sent_at: new Date().toISOString(),
        sent_by: JSON.parse(localStorage.getItem('currentUser') || '{}').name || 'System'
      };
      
      existingHistory.unshift(newMessage);
      
      // Keep only last 50 messages
      if (existingHistory.length > 50) {
        existingHistory.length = 50;
      }
      
      // Save back to localStorage
      localStorage.setItem(historyKey, JSON.stringify(existingHistory));
      
      console.log('Message saved to history:', newMessage);
    } catch (err) {
      console.error('Error saving message history:', err);
    }
  };

  const handleSend = () => {
    if (messageType === 'whatsapp') {
      sendWhatsAppMessage();
    } else {
      sendSMSMessage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-6 h-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">Send Message</h2>
              <p className="text-sm text-gray-600">
                {patient.first_name} {patient.last_name} • {patient.phone}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Message Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Send Via
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => setMessageType('whatsapp')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  messageType === 'whatsapp'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>WhatsApp</span>
                </div>
              </button>
              <button
                onClick={() => setMessageType('sms')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  messageType === 'sms'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <Send className="w-5 h-5" />
                  <span>SMS</span>
                </div>
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">Choose a template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message Preview/Editor */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message {selectedTemplate === 'custom' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows="8"
              disabled={selectedTemplate && selectedTemplate !== 'custom'}
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none ${
                selectedTemplate && selectedTemplate !== 'custom' ? 'bg-gray-50' : ''
              }`}
              placeholder={
                selectedTemplate === 'custom' 
                  ? 'Type your custom message here...' 
                  : 'Select a template to see the message preview'
              }
            />
            <div className="mt-2 text-sm text-gray-500 flex items-center justify-between">
              <span>
                {customMessage.length} characters
              </span>
              <span>
                {selectedTemplate && selectedTemplate !== 'custom' && '(Template - read only)'}
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  {messageType === 'whatsapp' ? (
                    <>
                      <li>WhatsApp will open in a new window</li>
                      <li>Message will be pre-filled</li>
                      <li>Click send in WhatsApp to deliver</li>
                      <li>Works on desktop and mobile</li>
                    </>
                  ) : (
                    <>
                      <li>SMS app will open (works best on mobile)</li>
                      <li>Message will be pre-filled</li>
                      <li>Click send in your SMS app</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!customMessage || customMessage.trim() === ''}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {messageType === 'whatsapp' ? (
                <>
                  <MessageSquare className="w-5 h-5" />
                  <span>Send via WhatsApp</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Send via SMS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;
