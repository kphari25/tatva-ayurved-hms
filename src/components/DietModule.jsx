import React, { useState, useEffect } from 'react';
import { Utensils, Plus, Search, Edit, Trash2, Save, X } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DietModule = () => {
  const [patients, setPatients] = useState([]);
  const [dietPlans, setDietPlans] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    diet_type: 'Regular',
    allergies: '',
    restrictions: '',
    breakfast: '',
    mid_morning: '',
    lunch: '',
    evening_snack: '',
    dinner: '',
    notes: '',
    calories_target: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patients
      const patientsRef = collection(db, 'patients');
      const patientsSnapshot = await getDocs(patientsRef);
      const patientsData = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPatients(patientsData);

      // Load diet plans
      const dietRef = collection(db, 'diet_plans');
      const dietSnapshot = await getDocs(dietRef);
      const dietData = dietSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDietPlans(dietData);

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setFormData({
      ...formData,
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name}`
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patient_id) {
      alert('Please select a patient');
      return;
    }

    try {
      const dietData = {
        ...formData,
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      };

      if (editingPlan) {
        // Update existing
        await updateDoc(doc(db, 'diet_plans', editingPlan.id), dietData);
        alert('Diet plan updated successfully!');
      } else {
        // Create new
        await addDoc(collection(db, 'diet_plans'), dietData);
        alert('Diet plan created successfully!');
      }

      resetForm();
      loadData();

    } catch (error) {
      console.error('Error saving diet plan:', error);
      alert('Failed to save diet plan: ' + error.message);
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setSelectedPatient(patients.find(p => p.id === plan.patient_id));
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this diet plan?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'diet_plans', id));
      alert('Diet plan deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting diet plan:', error);
      alert('Failed to delete diet plan: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      patient_id: '',
      patient_name: '',
      diet_type: 'Regular',
      allergies: '',
      restrictions: '',
      breakfast: '',
      mid_morning: '',
      lunch: '',
      evening_snack: '',
      dinner: '',
      notes: '',
      calories_target: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: ''
    });
    setSelectedPatient(null);
    setEditingPlan(null);
    setShowAddForm(false);
  };

  const getFilteredPlans = () => {
    if (!searchTerm.trim()) return dietPlans;
    
    const term = searchTerm.toLowerCase();
    return dietPlans.filter(plan =>
      plan.patient_name?.toLowerCase().includes(term) ||
      plan.diet_type?.toLowerCase().includes(term)
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Utensils className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Diet Module</h1>
              <p className="text-gray-600 text-sm">Manage patient meal plans and dietary requirements</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'New Diet Plan'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            {editingPlan ? 'Edit Diet Plan' : 'Create New Diet Plan'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            {/* Patient Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patient..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  onChange={(e) => {
                    const term = e.target.value.toLowerCase();
                    // Simple patient search display
                  }}
                />
              </div>
              
              {selectedPatient && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedPatient.patient_number} • {selectedPatient.age || 'N/A'} yrs • {selectedPatient.gender}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {!selectedPatient && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {patients.slice(0, 5).map(patient => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handlePatientSelect(patient)}
                      className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <p className="font-medium text-gray-900">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{patient.patient_number}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Diet Details */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diet Type</label>
                <select
                  value={formData.diet_type}
                  onChange={(e) => setFormData({ ...formData, diet_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Regular">Regular</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Low Carb">Low Carb</option>
                  <option value="High Protein">High Protein</option>
                  <option value="Diabetic">Diabetic</option>
                  <option value="Low Sodium">Low Sodium</option>
                  <option value="Gluten Free">Gluten Free</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Calories Target (kcal)</label>
                <input
                  type="number"
                  value={formData.calories_target}
                  onChange={(e) => setFormData({ ...formData, calories_target: e.target.value })}
                  placeholder="e.g., 2000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="e.g., Nuts, Dairy"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Restrictions</label>
                <input
                  type="text"
                  value={formData.restrictions}
                  onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
                  placeholder="e.g., No sugar, Low salt"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Meal Plan */}
            <div className="mb-4">
              <h3 className="font-medium text-gray-800 mb-3">Daily Meal Plan</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breakfast</label>
                  <textarea
                    value={formData.breakfast}
                    onChange={(e) => setFormData({ ...formData, breakfast: e.target.value })}
                    rows="2"
                    placeholder="e.g., Oats with fruits, Green tea"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mid-Morning Snack</label>
                  <textarea
                    value={formData.mid_morning}
                    onChange={(e) => setFormData({ ...formData, mid_morning: e.target.value })}
                    rows="2"
                    placeholder="e.g., Fresh fruits, Nuts"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lunch</label>
                  <textarea
                    value={formData.lunch}
                    onChange={(e) => setFormData({ ...formData, lunch: e.target.value })}
                    rows="2"
                    placeholder="e.g., Rice, Dal, Vegetables, Salad"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evening Snack</label>
                  <textarea
                    value={formData.evening_snack}
                    onChange={(e) => setFormData({ ...formData, evening_snack: e.target.value })}
                    rows="2"
                    placeholder="e.g., Tea with biscuits"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dinner</label>
                  <textarea
                    value={formData.dinner}
                    onChange={(e) => setFormData({ ...formData, dinner: e.target.value })}
                    rows="2"
                    placeholder="e.g., Roti, Sabzi, Soup"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="2"
                placeholder="Special instructions or notes"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name or diet type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Diet Plans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading diet plans...</p>
          </div>
        ) : getFilteredPlans().length === 0 ? (
          <div className="col-span-2 bg-white rounded-xl shadow-md p-12 text-center">
            <Utensils className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No diet plans created yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          getFilteredPlans().map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{plan.patient_name}</h3>
                  <p className="text-sm text-gray-600">
                    {plan.diet_type} • {plan.calories_target ? `${plan.calories_target} kcal` : 'No target'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(plan.allergies || plan.restrictions) && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  {plan.allergies && (
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">Allergies:</span> {plan.allergies}
                    </p>
                  )}
                  {plan.restrictions && (
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">Restrictions:</span> {plan.restrictions}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 text-sm">
                {plan.breakfast && (
                  <div>
                    <span className="font-medium text-gray-700">Breakfast:</span>
                    <span className="text-gray-600 ml-2">{plan.breakfast}</span>
                  </div>
                )}
                {plan.lunch && (
                  <div>
                    <span className="font-medium text-gray-700">Lunch:</span>
                    <span className="text-gray-600 ml-2">{plan.lunch}</span>
                  </div>
                )}
                {plan.dinner && (
                  <div>
                    <span className="font-medium text-gray-700">Dinner:</span>
                    <span className="text-gray-600 ml-2">{plan.dinner}</span>
                  </div>
                )}
              </div>

              {plan.notes && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                  <span className="font-medium">Notes:</span> {plan.notes}
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                Start Date: {new Date(plan.start_date).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DietModule;
