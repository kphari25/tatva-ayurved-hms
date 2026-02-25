import React, { useState, useEffect } from 'react';
import {
  Pill, Plus, Save, X, AlertCircle, CheckCircle, Search,
  TrendingDown, Package, Calendar, User, FileText, ShoppingCart,
  AlertTriangle, MinusCircle, Info, Printer, Download
} from 'lucide-react';

const PrescriptionWithInventory = ({
  inventory = [],
  updateInventory,
  userRole,
  currentUser,
  supabase
}) => {
  // Safety check - show loading if currentUser not ready
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">Loading prescription module...</p>
        </div>
      </div>
    );
  }

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockWarnings, setLowStockWarnings] = useState([]);
  const [outOfStockErrors, setOutOfStockErrors] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load patients
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  // Filter available medicines
  const availableMedicines = inventory.filter(med =>
    med.quantity > 0 &&
    (med.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     med.category?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Check stock levels when items are added
  useEffect(() => {
    const warnings = [];
    const errors = [];

    prescriptionItems.forEach(item => {
      const medicine = inventory.find(m => m.id === item.medicineId);
      if (medicine) {
        if (item.quantity > medicine.quantity) {
          errors.push({
            medicine: item.medicineName,
            requested: item.quantity,
            available: medicine.quantity
          });
        } else if (medicine.quantity - item.quantity <= medicine.reorder_level) {
          warnings.push({
            medicine: item.medicineName,
            remaining: medicine.quantity - item.quantity,
            reorderLevel: medicine.reorder_level
          });
        }
      }
    });

    setLowStockWarnings(warnings);
    setOutOfStockErrors(errors);
  }, [prescriptionItems, inventory]);

  const addPrescriptionItem = () => {
    if (!selectedMedicine) return;

    const medicine = inventory.find(m => m.id === selectedMedicine);
    if (!medicine) return;

    // Check if already added
    const existingItem = prescriptionItems.find(item => item.medicineId === selectedMedicine);
    if (existingItem) {
      alert(`${medicine.name} is already in the prescription. Update quantity instead.`);
      return;
    }

    const newItem = {
      id: Date.now(),
      medicineId: medicine.id,
      medicineName: medicine.name,
      quantity: 1,
      dosage: '',
      frequency: '',
      duration: '',
      instructions: '',
      unitPrice: medicine.sale_price,
      totalPrice: medicine.sale_price
    };

    setPrescriptionItems([...prescriptionItems, newItem]);
    setSelectedMedicine('');
    setSearchQuery('');
  };

  const updatePrescriptionItem = (itemId, field, value) => {
    setPrescriptionItems(prescriptionItems.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity') {
          updated.totalPrice = parseFloat(value) * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const removePrescriptionItem = (itemId) => {
    setPrescriptionItems(prescriptionItems.filter(item => item.id !== itemId));
  };

  const handleSavePrescription = async () => {
    if (!selectedPatient) {
      setMessage({ type: 'error', text: 'Please select a patient' });
      return;
    }
    if (prescriptionItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one medicine' });
      return;
    }
    if (outOfStockErrors.length > 0) {
      setMessage({ type: 'error', text: 'Cannot save: Insufficient stock for some items' });
      return;
    }

    setSaving(true);
    try {
      // Save prescription
      const { data: prescription, error: prescError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: selectedPatient.id,
          doctor_id: currentUser.id,
          doctor_name: `${currentUser.first_name} ${currentUser.last_name}`,
          prescription_date: new Date().toISOString(),
          notes: notes,
          status: 'active'
        })
        .select()
        .single();

      if (prescError) throw prescError;

      // Save prescription items
      const itemsToInsert = prescriptionItems.map(item => ({
        prescription_id: prescription.id,
        medicine_id: item.medicineId,
        medicine_name: item.medicineName,
        quantity: item.quantity,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        instructions: item.instructions,
        unit_price: item.unitPrice,
        total_price: item.totalPrice
      }));

      const { error: itemsError } = await supabase
        .from('prescription_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update inventory
      for (const item of prescriptionItems) {
        if (updateInventory) {
          await updateInventory(item.medicineId, -item.quantity, {
            type: 'dispensed',
            reference_id: prescription.id,
            reference_type: 'prescription',
            notes: `Prescribed to ${selectedPatient.first_name} ${selectedPatient.last_name}`
          });
        }
      }

      setMessage({ type: 'success', text: 'Prescription saved successfully!' });
      
      // Reset form
      setTimeout(() => {
        setSelectedPatient(null);
        setPrescriptionItems([]);
        setNotes('');
        setMessage({ type: '', text: '' });
      }, 2000);

    } catch (error) {
      console.error('Error saving prescription:', error);
      setMessage({ type: 'error', text: 'Failed to save prescription: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = prescriptionItems.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">New Prescription</h1>
            <p className="text-slate-600">
              Dr. {currentUser.first_name} {currentUser.last_name} · {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
            : 'bg-red-100 border border-red-300 text-red-800'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-5 h-5" />
            : <AlertCircle className="w-5 h-5" />}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Patient Selection */}
        <div className="col-span-1">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              Select Patient
            </h3>
            
            {selectedPatient ? (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-800 text-lg">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-sm text-slate-600">{selectedPatient.patient_number}</p>
                  </div>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-600"><strong>Age:</strong> {selectedPatient.age || 'N/A'}</p>
                  <p className="text-slate-600"><strong>Phone:</strong> {selectedPatient.phone}</p>
                  {selectedPatient.allergies && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-red-700 text-xs font-bold">⚠️ Allergies:</p>
                      <p className="text-red-600 text-xs">{selectedPatient.allergies}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {patients.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No patients registered</p>
                ) : (
                  patients.map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className="w-full text-left p-3 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                    >
                      <p className="font-semibold text-slate-800">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-xs text-slate-500">{patient.patient_number}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Prescription Details */}
        <div className="col-span-2 space-y-6">
          {/* Warnings */}
          {(lowStockWarnings.length > 0 || outOfStockErrors.length > 0) && (
            <div className="space-y-3">
              {outOfStockErrors.map((error, i) => (
                <div key={i} className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-800">Insufficient Stock: {error.medicine}</p>
                    <p className="text-sm text-red-700">
                      Requested: {error.requested} | Available: {error.available}
                    </p>
                  </div>
                </div>
              ))}
              {lowStockWarnings.map((warning, i) => (
                <div key={i} className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800">Low Stock Warning: {warning.medicine}</p>
                    <p className="text-sm text-amber-700">
                      Remaining: {warning.remaining} (Reorder at: {warning.reorderLevel})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Medicine */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add Medicine</h3>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search medicines..."
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
              />
            </div>
            {searchQuery && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {availableMedicines.length === 0 ? (
                  <p className="text-slate-500 text-sm p-4 text-center">No medicines found</p>
                ) : (
                  availableMedicines.map(med => (
                    <button
                      key={med.id}
                      onClick={() => {
                        setSelectedMedicine(med.id);
                        addPrescriptionItem();
                      }}
                      className="w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-500 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-800">{med.name}</p>
                          <p className="text-xs text-slate-500">{med.category} · Stock: {med.quantity}</p>
                        </div>
                        <p className="text-emerald-600 font-bold">₹{med.sale_price}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Prescription Items */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Prescription Items</h3>
            {prescriptionItems.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No medicines added yet</p>
            ) : (
              <div className="space-y-4">
                {prescriptionItems.map((item, index) => (
                  <div key={item.id} className="border-2 border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-slate-800">{index + 1}. {item.medicineName}</p>
                        <p className="text-sm text-slate-600">₹{item.unitPrice} × {item.quantity} = ₹{item.totalPrice}</p>
                      </div>
                      <button
                        onClick={() => removePrescriptionItem(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 font-semibold">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updatePrescriptionItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 font-semibold">Dosage</label>
                        <input
                          type="text"
                          value={item.dosage}
                          onChange={(e) => updatePrescriptionItem(item.id, 'dosage', e.target.value)}
                          placeholder="e.g., 1 tablet"
                          className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 font-semibold">Frequency</label>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => updatePrescriptionItem(item.id, 'frequency', e.target.value)}
                          placeholder="e.g., 3 times daily"
                          className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 font-semibold">Duration</label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => updatePrescriptionItem(item.id, 'duration', e.target.value)}
                          placeholder="e.g., 7 days"
                          className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-600 font-semibold">Instructions</label>
                        <input
                          type="text"
                          value={item.instructions}
                          onChange={(e) => updatePrescriptionItem(item.id, 'instructions', e.target.value)}
                          placeholder="e.g., Take after meals"
                          className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes & Total */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="mb-4">
              <label className="block text-sm font-bold text-slate-700 mb-2">Additional Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or notes..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl">
              <p className="text-lg font-bold text-slate-800">Total Amount:</p>
              <p className="text-2xl font-bold text-emerald-600">₹{totalAmount.toFixed(2)}</p>
            </div>
            <button
              onClick={handleSavePrescription}
              disabled={saving || !selectedPatient || prescriptionItems.length === 0 || outOfStockErrors.length > 0}
              className="w-full mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Prescription
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionWithInventory;
