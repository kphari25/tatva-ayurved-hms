import React, { useState, useEffect } from 'react';
import { Utensils, Settings, Search, Users, IndianRupee, Coffee, X, Trash2 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '🍲' },
  { key: 'dinner', label: 'Dinner', emoji: '🍱' },
  { key: 'snacks', label: 'Snacks', emoji: '🍪' },
  { key: 'tea_coffee', label: 'Tea/Coffee', emoji: '☕' },
];

const DEFAULT_PRICES = { breakfast: 80, lunch: 120, dinner: 120, snacks: 50, tea_coffee: 30 };

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const currentUserEmail = () => JSON.parse(localStorage.getItem('currentUser') || '{}').email || '';

const StatCard = ({ label, value, icon: Icon, iconBg, iconColor }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
  </div>
);

const SetPricesModal = ({ prices, onClose, onSave }) => {
  const [form, setForm] = useState(prices);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Set Meal Prices</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {MEAL_TYPES.map(m => (
            <div key={m.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-gray-700 w-36 shrink-0">
                <span>{m.emoji}</span> {m.label}
              </span>
              <input
                type="number"
                value={form[m.key] ?? 0}
                onChange={(e) => setForm({ ...form, [m.key]: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="0"
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-teal-700 text-white rounded-lg font-medium hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Prices'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AssignMealModal = ({ patients, prices, defaultDate, onClose, onSave }) => {
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [meals, setMeals] = useState({ breakfast: false, lunch: false, dinner: false, snacks: false, tea_coffee: false });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalCost = MEAL_TYPES.reduce((sum, m) => sum + (meals[m.key] ? (parseFloat(prices[m.key]) || 0) : 0), 0);

  const toggleMeal = (key) => setMeals(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    const patient = patients.find(p => (p.firebaseId || p.id) === patientId);
    if (!patient) { setError('Please select a patient.'); return; }
    if (!date) { setError('Please select a date.'); return; }
    if (!Object.values(meals).some(Boolean)) { setError('Select at least one meal.'); return; }
    setSaving(true);
    try {
      await onSave({ patient, date, meals, notes });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Assign Meal to Patient</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select a patient</option>
              {patients.map(p => (
                <option key={p.firebaseId || p.id} value={p.firebaseId || p.id}>
                  {p.first_name} {p.last_name}{p.mrd_number ? ` (${p.mrd_number})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Meals</label>
            <div className="space-y-2">
              {MEAL_TYPES.map(m => (
                <label
                  key={m.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={meals[m.key]}
                      onChange={() => toggleMeal(m.key)}
                      className="w-4 h-4 accent-teal-600"
                    />
                    {m.emoji} {m.label}
                  </span>
                  <span className="text-sm text-gray-500">₹{prices[m.key] ?? 0}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-teal-800">Total Cost</span>
            <span className="text-xl font-bold text-teal-800">₹{totalCost.toFixed(0)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Special diet requirements"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2.5 bg-teal-700 text-white rounded-lg font-medium hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? 'Assigning...' : 'Assign Meal'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessManagement = () => {
  const [patients, setPatients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'prices'
  const [searchTerm, setSearchTerm] = useState('');
  const [showSetPrices, setShowSetPrices] = useState(false);
  const [showAssignMeal, setShowAssignMeal] = useState(false);

  useEffect(() => {
    loadPatients();
    loadPrices();
  }, []);

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const loadPatients = async () => {
    try {
      const snap = await getDocs(collection(db, 'patients'));
      const data = snap.docs.map(d => ({ id: d.id, firebaseId: d.id, ...d.data() }));
      // Meals are billed as part of an in-patient stay — only currently
      // admitted IP patients are eligible, matching the active-IP filter
      // used elsewhere (Dashboard, Discharge Management).
      setPatients(data.filter(p =>
        p.patient_type === 'IP' && p.admission_status !== 'pending_admission' && p.admission_status !== 'discharged'
      ));
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadPrices = async () => {
    try {
      const snap = await getDoc(doc(db, 'meal_prices', 'default'));
      if (snap.exists()) setPrices({ ...DEFAULT_PRICES, ...snap.data() });
    } catch (error) {
      console.error('Error loading meal prices:', error);
    }
  };

  const loadAssignments = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'meal_assignments'), where('date', '==', selectedDate)));
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error loading meal assignments:', error);
    }
  };

  const saveMealPrices = async (newPrices) => {
    try {
      await setDoc(doc(db, 'meal_prices', 'default'), {
        ...newPrices,
        updated_at: new Date().toISOString(),
        updated_by: currentUserEmail(),
      });
      setPrices(newPrices);
      setShowSetPrices(false);
    } catch (error) {
      console.error('Error saving meal prices:', error);
      alert('Failed to save prices: ' + error.message);
    }
  };

  const assignMeal = async ({ patient, date, meals, notes }) => {
    try {
      const totalCost = MEAL_TYPES.reduce((sum, m) => sum + (meals[m.key] ? (parseFloat(prices[m.key]) || 0) : 0), 0);
      const patientId = patient.firebaseId || patient.id;
      const payload = {
        patient_id: patientId,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        mrd_number: patient.mrd_number || patient.patient_number || '',
        date,
        meals,
        meal_prices_snapshot: prices,
        total_cost: totalCost,
        notes: notes || '',
        updated_at: new Date().toISOString(),
        updated_by: currentUserEmail(),
      };

      // One assignment per patient per date — re-assigning updates the same
      // record instead of creating a duplicate row in Today's Meals.
      const existingSnap = await getDocs(query(
        collection(db, 'meal_assignments'),
        where('patient_id', '==', patientId),
        where('date', '==', date)
      ));
      if (!existingSnap.empty) {
        await updateDoc(doc(db, 'meal_assignments', existingSnap.docs[0].id), payload);
      } else {
        await addDoc(collection(db, 'meal_assignments'), { ...payload, created_at: new Date().toISOString(), created_by: payload.updated_by });
      }

      setShowAssignMeal(false);
      if (date === selectedDate) loadAssignments();
      else alert(`Meal assigned for ${date}. Switch to that date to view it.`);
    } catch (error) {
      console.error('Error assigning meal:', error);
      alert('Failed to assign meal: ' + error.message);
    }
  };

  const deleteAssignment = async (id) => {
    if (!window.confirm('Remove this meal assignment?')) return;
    try {
      await deleteDoc(doc(db, 'meal_assignments', id));
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete: ' + error.message);
    }
  };

  const filteredAssignments = assignments.filter(a =>
    (a.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    patientsFed: assignments.length,
    dayTotal: assignments.reduce((sum, a) => sum + (a.total_cost || 0), 0),
    breakfastCount: assignments.filter(a => a.meals?.breakfast).length,
    lunchCount: assignments.filter(a => a.meals?.lunch).length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mess Management</h1>
          <p className="text-gray-600 text-sm mt-1">Manage meals and food charges for patients</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSetPrices(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            <Settings className="w-4 h-4" /> Set Prices
          </button>
          <button
            onClick={() => setShowAssignMeal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 font-medium"
          >
            <Utensils className="w-4 h-4" /> Assign Meal
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Patients Fed" value={stats.patientsFed} icon={Users} iconBg="bg-gray-100" iconColor="text-gray-600" />
        <StatCard label="Day Total" value={`₹${stats.dayTotal.toFixed(0)}`} icon={IndianRupee} iconBg="bg-green-50" iconColor="text-green-700" />
        <StatCard label="Breakfast" value={stats.breakfastCount} icon={Coffee} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <StatCard label="Lunch" value={stats.lunchCount} icon={Utensils} iconBg="bg-teal-50" iconColor="text-teal-700" />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'today' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Today's Meals
        </button>
        <button
          onClick={() => setActiveTab('prices')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'prices' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Meal Prices
        </button>
      </div>

      {activeTab === 'today' && (
        <>
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            {filteredAssignments.length === 0 ? (
              <div className="p-16 text-center text-gray-400">
                <Utensils className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No meals assigned for this date</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">{a.patient_name}</p>
                      {a.mrd_number && <p className="text-xs text-gray-500">{a.mrd_number}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {MEAL_TYPES.filter(m => a.meals?.[m.key]).map(m => (
                          <span key={m.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full text-xs font-medium">
                            {m.emoji} {m.label}
                          </span>
                        ))}
                      </div>
                      {a.notes && <p className="text-xs text-gray-400 mt-1.5 italic">{a.notes}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-gray-800">₹{(a.total_cost || 0).toFixed(2)}</span>
                      <button
                        onClick={() => deleteAssignment(a.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'prices' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Current Meal Prices</h3>
            <button onClick={() => setShowSetPrices(true)} className="text-sm font-medium text-teal-700 hover:text-teal-900">
              Edit Prices
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {MEAL_TYPES.map(m => (
              <div key={m.key} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2 text-gray-700"><span>{m.emoji}</span> {m.label}</span>
                <span className="font-semibold text-gray-900">₹{prices[m.key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSetPrices && (
        <SetPricesModal prices={prices} onClose={() => setShowSetPrices(false)} onSave={saveMealPrices} />
      )}

      {showAssignMeal && (
        <AssignMealModal
          patients={patients}
          prices={prices}
          defaultDate={selectedDate}
          onClose={() => setShowAssignMeal(false)}
          onSave={assignMeal}
        />
      )}
    </div>
  );
};

export default MessManagement;
