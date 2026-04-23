// PatientEditModal.jsx - Firebase Version with Medicine Autocomplete
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, Search } from 'lucide-react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PatientEditModal = ({ patient, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    ...patient,
    prescriptions: patient.prescriptions || [],
    enrolled_package: patient.enrolled_package || '',
    package_start_date: patient.package_start_date || '',
    package_status: patient.package_status || 'not_enrolled'
  });
  
  const [newMedicine, setNewMedicine] = useState({
    medicine: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: 1
  });

  const [medicineSearch, setMedicineSearch] = useState('');
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [allMedicines, setAllMedicines] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);

  // Load all medicines and packages from Firebase on component mount
  useEffect(() => {
    loadMedicines();
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const packagesRef = collection(db, 'packages');
      const snapshot = await getDocs(packagesRef);
      
      const packagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPackages(packagesData);
      console.log(`Loaded ${packagesData.length} packages from Firebase`);
      
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      const medicines = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAllMedicines(medicines);
      console.log(`Loaded ${medicines.length} medicines from Firebase`);
      
    } catch (error) {
      console.error('Error loading medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter medicines based on search
  useEffect(() => {
    if (!medicineSearch.trim()) {
      setFilteredMedicines([]);
      return;
    }

    const searchTerm = medicineSearch.toLowerCase();
    const filtered = allMedicines
      .filter(med => 
        (med.item_code || '').toLowerCase().includes(searchTerm) ||
        (med.item_name || '').toLowerCase().includes(searchTerm)
      )
      .slice(0, 10); // Limit to 10 suggestions

    setFilteredMedicines(filtered);
  }, [medicineSearch, allMedicines]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowMedicineSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMedicineSelect = (medicine) => {
    setNewMedicine({
      ...newMedicine,
      medicine: medicine.item_code,
      medicineName: medicine.item_name,
      availableStock: medicine.stock_quantity,
      medicineId: medicine.id
    });
    setMedicineSearch(medicine.item_code);
    setShowMedicineSuggestions(false);
    setFilteredMedicines([]);
  };

  const handleAddMedicine = () => {
    if (!newMedicine.medicine || !newMedicine.dosage || !newMedicine.frequency || !newMedicine.duration) {
      alert('Please fill all medicine fields');
      return;
    }

    const updatedPrescriptions = [...formData.prescriptions, {
      ...newMedicine,
      id: Date.now()
    }];

    setFormData({ ...formData, prescriptions: updatedPrescriptions });
    
    // Reset form
    setNewMedicine({
      medicine: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1
    });
    setMedicineSearch('');
  };

  const handleRemoveMedicine = (index) => {
    const updatedPrescriptions = formData.prescriptions.filter((_, i) => i !== index);
    setFormData({ ...formData, prescriptions: updatedPrescriptions });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Find patient document ID
      let patientDocId = patient.firebaseId || patient.id;
      
      if (!patientDocId) {
        // If no ID, try to find patient by patient_number
        const patientsRef = collection(db, 'patients');
        const q = query(patientsRef, where('patient_number', '==', patient.patient_number));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          patientDocId = snapshot.docs[0].id;
        } else {
          throw new Error('Patient not found in database');
        }
      }

      // Update patient in Firebase - only update specific fields
      const patientRef = doc(db, 'patients', patientDocId);
      const updateData = {
        first_name: formData.first_name || patient.first_name,
        last_name: formData.last_name || patient.last_name,
        prescriptions: formData.prescriptions || [],
        updated_at: new Date().toISOString()
      };

      await updateDoc(patientRef, updateData);
      console.log('✅ Patient updated in Firebase');

      // Deduct medicines from inventory
      if (formData.prescriptions && formData.prescriptions.length > 0) {
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const prescription of formData.prescriptions) {
          if (prescription.medicineId && prescription.quantity) {
            try {
              const medicineRef = doc(db, 'inventory', prescription.medicineId);
              const medicineDoc = await getDoc(medicineRef);

              if (medicineDoc.exists()) {
                const currentStock = medicineDoc.data().stock_quantity || 0;
                const deductQty = parseInt(prescription.quantity || 0);
                const newStock = Math.max(0, currentStock - deductQty);

                batch.update(medicineRef, {
                  stock_quantity: newStock,
                  last_updated: new Date().toISOString()
                });
                
                batchCount++;
              }
            } catch (err) {
              console.warn('Could not update medicine:', prescription.medicine, err);
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          console.log(`✅ Updated ${batchCount} medicine stocks`);
        }
      }

      alert('✅ Patient updated successfully!');
      
      if (onUpdate) {
        await onUpdate();
      }
      
      onClose();

    } catch (error) {
      console.error('❌ Error saving patient:', error);
      alert('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold">Edit Patient</h2>
          <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Package Enrollment Section */}
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Treatment Package</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Package</label>
                <select
                  value={formData.enrolled_package || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    enrolled_package: e.target.value,
                    package_status: e.target.value ? 'enrolled' : 'not_enrolled',
                    package_start_date: e.target.value && !formData.package_start_date ? new Date().toISOString().split('T')[0] : formData.package_start_date
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">No Package</option>
                  {packages.map(pkg => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} - ₹{pkg.cost?.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {formData.enrolled_package && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={formData.package_start_date || ''}
                      onChange={(e) => setFormData({ ...formData, package_start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Package Status</label>
                    <select
                      value={formData.package_status || 'enrolled'}
                      onChange={(e) => setFormData({ ...formData, package_status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="enrolled">Enrolled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Show package details */}
                  {(() => {
                    const selectedPkg = packages.find(p => p.name === formData.enrolled_package);
                    if (selectedPkg) {
                      return (
                        <div className="col-span-2 mt-2 p-3 bg-white rounded border border-green-300">
                          <p className="text-sm font-semibold text-gray-800">{selectedPkg.name}</p>
                          <p className="text-xs text-gray-600 mt-1">{selectedPkg.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                            <span>⏱️ Duration: {selectedPkg.duration} {selectedPkg.duration_unit}</span>
                            <span>💰 Cost: ₹{selectedPkg.cost?.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Prescriptions Section */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Prescriptions</h3>

            {/* Add New Medicine */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-5 gap-3 mb-3">
                {/* Medicine Search with Autocomplete */}
                <div className="col-span-2 relative" ref={searchRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicine</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={medicineSearch}
                      onChange={(e) => {
                        setMedicineSearch(e.target.value);
                        setShowMedicineSuggestions(true);
                      }}
                      onFocus={() => setShowMedicineSuggestions(true)}
                      placeholder="Search medicine..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Autocomplete Suggestions */}
                  {showMedicineSuggestions && filteredMedicines.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredMedicines.map((medicine) => (
                        <div
                          key={medicine.id}
                          onClick={() => handleMedicineSelect(medicine)}
                          className="px-4 py-2 hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{medicine.item_code}</div>
                          <div className="text-sm text-gray-600">{medicine.item_name}</div>
                          <div className="text-xs text-teal-600 mt-1">
                            Stock: {medicine.stock_quantity} • MRP: ₹{medicine.mrp}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Loading indicator */}
                  {loading && (
                    <div className="absolute right-3 top-9 text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-600 rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={newMedicine.dosage}
                    onChange={(e) => setNewMedicine({ ...newMedicine, dosage: e.target.value })}
                    placeholder="e.g., 1 tablet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={newMedicine.frequency}
                    onChange={(e) => setNewMedicine({ ...newMedicine, frequency: e.target.value })}
                    placeholder="e.g., 3x daily"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={newMedicine.duration}
                    onChange={(e) => setNewMedicine({ ...newMedicine, duration: e.target.value })}
                    placeholder="e.g., 7 days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newMedicine.quantity}
                    onChange={(e) => setNewMedicine({ ...newMedicine, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {newMedicine.availableStock !== undefined && (
                  <div className="text-sm text-gray-600 mt-6">
                    Available: <span className="font-semibold text-teal-600">{newMedicine.availableStock}</span>
                  </div>
                )}

                <button
                  onClick={handleAddMedicine}
                  className="mt-6 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Medicine List */}
            {formData.prescriptions.length > 0 && (
              <div className="space-y-2">
                {formData.prescriptions.map((prescription, index) => (
                  <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg">
                    <div className="flex-1 grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{prescription.medicine}</span>
                        {prescription.medicineName && (
                          <div className="text-xs text-gray-500">{prescription.medicineName}</div>
                        )}
                      </div>
                      <div className="text-gray-700">{prescription.dosage}</div>
                      <div className="text-gray-700">{prescription.frequency}</div>
                      <div className="text-gray-700">{prescription.duration}</div>
                      <div className="text-gray-700">Qty: {prescription.quantity}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedicine(index)}
                      className="ml-4 text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientEditModal;
