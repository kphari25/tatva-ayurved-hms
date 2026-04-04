import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Calendar, FileText, Activity, User, Pill, AlertCircle } from 'lucide-react';

const PatientEditModal = ({ patient, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({ ...patient });
  const [prescriptions, setPrescriptions] = useState([]);
  const [newPrescription, setNewPrescription] = useState({
    medicine: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });
  const [inventory, setInventory] = useState([]);
  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInventory();
    loadPrescriptions();
  }, []);

  const loadInventory = () => {
    try {
      const inventoryData = localStorage.getItem('inventory');
      const items = inventoryData ? JSON.parse(inventoryData) : [];
      setInventory(items);
      console.log('📦 Inventory loaded:', items.length, 'items');
    } catch (err) {
      console.error('Error loading inventory:', err);
    }
  };

  const loadPrescriptions = () => {
    try {
      const recordsKey = `patient_records_${patient.id}`;
      const recordsData = localStorage.getItem(recordsKey);
      const records = recordsData ? JSON.parse(recordsData) : { prescriptions: [] };
      setPrescriptions(records.prescriptions || []);
    } catch (err) {
      console.error('Error loading prescriptions:', err);
    }
  };

  const handleMedicineInput = (value) => {
    setNewPrescription({ ...newPrescription, medicine: value });

    if (value.length >= 2) {
      // Filter inventory - search in item_code (where the actual medicine name is!)
      const matches = inventory.filter(item => {
        const itemCode = (item.item_code || '').toLowerCase();
        const itemName = (item.item_name || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const searchTerm = value.toLowerCase();
        
        return itemCode.includes(searchTerm) ||
               itemName.includes(searchTerm) ||
               name.includes(searchTerm);
      });
      
      console.log(`🔍 Found ${matches.length} matches for "${value}"`);
      setMedicineSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectMedicine = (item) => {
    // Use item_code as the medicine name (that's where your actual name is!)
    const medicineName = item.item_code || item.item_name || item.name;
    const availableQty = item.stock_quantity || item.quantity || 0;
    
    console.log('✅ Selected:', medicineName, 'Stock:', availableQty);
    
    setNewPrescription({
      ...newPrescription,
      medicine: medicineName,
      availableStock: availableQty,
      itemId: item.id
    });
    setShowSuggestions(false);
  };

  const deductInventory = (medicineName, quantity) => {
    try {
      const inventoryData = localStorage.getItem('inventory');
      let items = inventoryData ? JSON.parse(inventoryData) : [];

      // Find the medicine - check item_code (where your names are!)
      const itemIndex = items.findIndex(item => {
        const itemCode = (item.item_code || '').toLowerCase();
        const itemName = (item.item_name || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const searchName = medicineName.toLowerCase();
        
        return itemCode === searchName || itemName === searchName || name === searchName;
      });

      if (itemIndex !== -1) {
        const currentQty = items[itemIndex].stock_quantity || items[itemIndex].quantity || 0;
        const deductQty = parseInt(quantity) || 0;

        console.log(`📦 Medicine: ${medicineName}, Current: ${currentQty}, Deducting: ${deductQty}`);

        if (currentQty >= deductQty) {
          // Deduct quantity
          if (items[itemIndex].stock_quantity !== undefined) {
            items[itemIndex].stock_quantity -= deductQty;
          }
          if (items[itemIndex].quantity !== undefined) {
            items[itemIndex].quantity -= deductQty;
          }

          // Update stock value if exists
          if (items[itemIndex].stock_value && items[itemIndex].purchase_rate) {
            const newQty = items[itemIndex].stock_quantity || items[itemIndex].quantity;
            items[itemIndex].stock_value = newQty * items[itemIndex].purchase_rate;
          }

          // Save updated inventory
          localStorage.setItem('inventory', JSON.stringify(items));
          console.log(`✅ Deducted ${deductQty} units. New quantity: ${items[itemIndex].stock_quantity || items[itemIndex].quantity}`);
          return true;
        } else {
          console.warn(`⚠️ Insufficient stock. Available: ${currentQty}, Required: ${deductQty}`);
          return false;
        }
      } else {
        console.log(`ℹ️ Medicine "${medicineName}" not found in inventory - allowing prescription anyway`);
        return true; // Medicine not in inventory, allow prescription anyway
      }
    } catch (err) {
      console.error('Error deducting inventory:', err);
      return true; // Don't block prescription if inventory update fails
    }
  };

  const handleAddPrescription = () => {
    if (!newPrescription.medicine || !newPrescription.dosage) {
      setError('Please enter medicine name and dosage');
      return;
    }

    // Parse quantity from dosage (e.g., "2 tablets" -> 2)
    const quantityMatch = newPrescription.dosage.match(/\d+/);
    const quantity = quantityMatch ? parseInt(quantityMatch[0]) : 1;

    // Parse duration to calculate total quantity needed
    const durationMatch = newPrescription.duration?.match(/\d+/);
    const days = durationMatch ? parseInt(durationMatch[0]) : 1;
    
    // Calculate total tablets needed (quantity per day × days)
    const totalNeeded = quantity * days;

    // Check stock and deduct
    const stockDeducted = deductInventory(newPrescription.medicine, totalNeeded);

    if (!stockDeducted) {
      setError(`Insufficient stock for ${newPrescription.medicine}`);
      return;
    }

    const prescription = {
      id: Date.now().toString(),
      ...newPrescription,
      date: new Date().toISOString().split('T')[0],
      addedBy: JSON.parse(localStorage.getItem('currentUser') || '{}').name || 'System'
    };

    const updatedPrescriptions = [...prescriptions, prescription];
    setPrescriptions(updatedPrescriptions);
    savePrescriptions(updatedPrescriptions);

    // Reload inventory to show updated quantities
    loadInventory();

    // Reset form
    setNewPrescription({
      medicine: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: ''
    });
    setError('');
  };

  const handleDeletePrescription = (id) => {
    const updatedPrescriptions = prescriptions.filter(p => p.id !== id);
    setPrescriptions(updatedPrescriptions);
    savePrescriptions(updatedPrescriptions);
  };

  const savePrescriptions = (prescriptionsToSave) => {
    try {
      const recordsKey = `patient_records_${patient.id}`;
      const existingRecords = JSON.parse(localStorage.getItem(recordsKey) || '{}');
      existingRecords.prescriptions = prescriptionsToSave;
      localStorage.setItem(recordsKey, JSON.stringify(existingRecords));
    } catch (err) {
      console.error('Error saving prescriptions:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setLoading(true);
    try {
      // Update patient data
      const patients = JSON.parse(localStorage.getItem('patients') || '[]');
      const index = patients.findIndex(p => p.id === patient.id);
      
      if (index !== -1) {
        patients[index] = {
          ...patients[index],
          ...formData,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('patients', JSON.stringify(patients));
        
        if (onUpdate) onUpdate();
        alert('Patient updated successfully!');
      }
    } catch (err) {
      console.error('Error saving patient:', err);
      alert('Failed to save patient');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'vitals', label: 'Vitals', icon: Activity },
    { id: 'history', label: 'History', icon: Calendar },
    { id: 'notes', label: 'Notes', icon: FileText }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h2 className="text-xl font-bold">
              {formData.first_name} {formData.last_name}
            </h2>
            <p className="text-sm text-teal-100">
              {formData.patient_number} • {formData.age} yrs • {formData.gender}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-teal-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50">
          <div className="flex space-x-1 px-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Middle Name</label>
                  <input
                    type="text"
                    name="middle_name"
                    value={formData.middle_name || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Blood Group</label>
                  <select
                    name="blood_group"
                    value={formData.blood_group || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
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
          )}

          {/* Prescriptions Tab */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-6">
              {/* Add New Prescription */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-4 flex items-center">
                  <Plus className="w-5 h-5 mr-2 text-teal-600" />
                  Add New Prescription
                </h3>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1">
                      Medicine Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPrescription.medicine}
                      onChange={(e) => handleMedicineInput(e.target.value)}
                      onFocus={() => newPrescription.medicine.length >= 2 && setShowSuggestions(true)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Start typing medicine name..."
                    />
                    
                    {/* Autocomplete Suggestions */}
                    {showSuggestions && medicineSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {medicineSuggestions.map((item, index) => {
                          // Use item_code as the display name (that's where your medicine names are!)
                          const name = item.item_code || item.item_name || item.name;
                          const qty = item.stock_quantity || item.quantity || 0;
                          const inStock = qty > 0;
                          
                          return (
                            <div
                              key={index}
                              onClick={() => selectMedicine(item)}
                              className={`px-4 py-2 cursor-pointer hover:bg-teal-50 border-b last:border-b-0 ${
                                !inStock ? 'bg-red-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{name}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  inStock 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {qty > 0 ? `${qty} in stock` : 'Out of stock'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {newPrescription.availableStock !== undefined && (
                      <div className="mt-1 text-sm text-gray-600">
                        Available: {newPrescription.availableStock} units
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Dosage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newPrescription.dosage}
                      onChange={(e) => setNewPrescription({...newPrescription, dosage: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., 2 tablets"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Frequency</label>
                    <select
                      value={newPrescription.frequency}
                      onChange={(e) => setNewPrescription({...newPrescription, frequency: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select</option>
                      <option>Once daily</option>
                      <option>Twice daily</option>
                      <option>Thrice daily</option>
                      <option>Before meals</option>
                      <option>After meals</option>
                      <option>At bedtime</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Duration</label>
                    <input
                      type="text"
                      value={newPrescription.duration}
                      onChange={(e) => setNewPrescription({...newPrescription, duration: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., 7 days"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Instructions</label>
                    <textarea
                      value={newPrescription.instructions}
                      onChange={(e) => setNewPrescription({...newPrescription, instructions: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows="2"
                      placeholder="Special instructions..."
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddPrescription}
                  className="mt-4 flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Medicine</span>
                </button>
              </div>

              {/* Prescription List */}
              <div>
                <h3 className="font-semibold mb-4">Current Prescriptions ({prescriptions.length})</h3>
                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No prescriptions yet. Add one above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.map(prescription => (
                      <div key={prescription.id} className="bg-white border rounded-lg p-4 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-lg">{prescription.medicine}</h4>
                              <div className="text-sm text-gray-600 mt-1 space-y-1">
                                <p><strong>Dosage:</strong> {prescription.dosage}</p>
                                {prescription.frequency && <p><strong>Frequency:</strong> {prescription.frequency}</p>}
                                {prescription.duration && <p><strong>Duration:</strong> {prescription.duration}</p>}
                                {prescription.instructions && <p><strong>Instructions:</strong> {prescription.instructions}</p>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeletePrescription(prescription.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Added on {prescription.date} by {prescription.addedBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other tabs can be added here */}
          {activeTab === 'vitals' && (
            <div className="text-center py-12 text-gray-500">
              Vitals tracking coming soon...
            </div>
          )}
          {activeTab === 'history' && (
            <div className="text-center py-12 text-gray-500">
              Medical history coming soon...
            </div>
          )}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows="10"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Add notes about the patient..."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
          <button
            onClick={handleSave}
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
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientEditModal;
