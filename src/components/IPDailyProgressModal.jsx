import React, { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, Activity, Thermometer, Utensils,
  Stethoscope, Pill, ChevronDown, ChevronUp, Save, Calendar
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import TreatmentPickerButton from './TreatmentPickerButton';
import TreatmentItemsList from './TreatmentItemsList';
import MedicinePickerButton from './MedicinePickerButton';

const today = () => new Date().toISOString().split('T')[0];

const appendTreatment = (currentText, treatment) => {
  const entry = `${treatment.name} (₹${Number(treatment.price || 0).toLocaleString('en-IN')})`;
  return currentText ? `${currentText}, ${entry}` : entry;
};

const appendMedicine = (currentText, medicine) =>
  currentText ? `${currentText}, ${medicine.item_name}` : medicine.item_name;

const emptyEntry = () => ({
  date: today(),
  bp_morning: '',
  bp_evening: '',
  temperature: '',
  pulse: '',
  spo2: '',
  weight: '',
  diet: '',
  treatment_performed: '',
  treatment_items: [],
  medicines_given: '',
  doctors_notes: '',
});

const Field = ({ label, value, onChange, placeholder, icon: Icon }) => (
  <div>
    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
    />
  </div>
);

const TextArea = ({ label, value, onChange, placeholder, icon: Icon, actions }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </label>
      {actions}
    </div>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
    />
  </div>
);

const IPDailyProgressModal = ({ patient, onClose }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyEntry());
  const [expandedId, setExpandedId] = useState(null);

  const patientId = patient?.firebaseId || patient?.id;
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'daily_progress'),
        where('patient_id', '==', patientId),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error loading daily progress:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.date) { alert('Please select a date.'); return; }
    try {
      setSaving(true);
      const data = {
        ...form,
        patient_id: patientId,
        patient_name: patientName,
        mrd_number: patient?.mrd_number || patient?.patient_number || '',
        ip_number: patient?.ip_number || '',
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email || '',
      };
      await addDoc(collection(db, 'daily_progress'), data);
      setForm(emptyEntry());
      await loadEntries();
    } catch (e) {
      console.error('Error saving daily progress:', e);
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this daily record?')) return;
    try {
      await deleteDoc(doc(db, 'daily_progress', entryId));
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">IP Daily Progress</h2>
              <p className="text-teal-100 text-sm">
                {patientName}
                {patient?.mrd_number && <span className="ml-2 font-mono">{patient.mrd_number}</span>}
                {patient?.ip_number && <span className="ml-2 font-mono">{patient.ip_number}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── New Entry Form ── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" /> Add Daily Record
            </h3>

            {/* Date */}
            <div className="mb-4">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                <Calendar className="w-3.5 h-3.5" /> Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            {/* Vitals */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Vitals</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="BP Morning" value={form.bp_morning} onChange={v => setForm(f => ({ ...f, bp_morning: v }))} placeholder="e.g. 120/80" icon={Activity} />
                <Field label="BP Evening" value={form.bp_evening} onChange={v => setForm(f => ({ ...f, bp_evening: v }))} placeholder="e.g. 118/76" icon={Activity} />
                <Field label="Temperature" value={form.temperature} onChange={v => setForm(f => ({ ...f, temperature: v }))} placeholder="e.g. 98.6°F" icon={Thermometer} />
                <Field label="Pulse" value={form.pulse} onChange={v => setForm(f => ({ ...f, pulse: v }))} placeholder="e.g. 72/min" />
                <Field label="SPO2" value={form.spo2} onChange={v => setForm(f => ({ ...f, spo2: v }))} placeholder="e.g. 98%" />
                <Field label="Weight" value={form.weight} onChange={v => setForm(f => ({ ...f, weight: v }))} placeholder="e.g. 65 kg" />
              </div>
            </div>

            {/* Clinical */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <TextArea
                  label="Treatment Performed Today"
                  value={form.treatment_performed}
                  onChange={v => setForm(f => ({ ...f, treatment_performed: v }))}
                  placeholder="e.g. Abhyanga, Shirodhara, Panchakarma…"
                  icon={Stethoscope}
                  actions={
                    <TreatmentPickerButton
                      onSelect={(t) => setForm(f => ({
                        ...f,
                        treatment_performed: appendTreatment(f.treatment_performed, t),
                        treatment_items: [...(f.treatment_items || []), { name: t.name, price: Number(t.price) || 0 }],
                      }))}
                    />
                  }
                />
                <TreatmentItemsList
                  items={form.treatment_items}
                  onRemove={(idx) => setForm(f => ({ ...f, treatment_items: f.treatment_items.filter((_, i) => i !== idx) }))}
                />
              </div>
              <TextArea
                label="Medicines Given"
                value={form.medicines_given}
                onChange={v => setForm(f => ({ ...f, medicines_given: v }))}
                placeholder="e.g. Ashwagandha 2 tabs BD, Triphala 1 tab HS…"
                icon={Pill}
                actions={
                  <MedicinePickerButton
                    onSelect={(m) => setForm(f => ({ ...f, medicines_given: appendMedicine(f.medicines_given, m) }))}
                  />
                }
              />
              <TextArea label="Diet / Food" value={form.diet} onChange={v => setForm(f => ({ ...f, diet: v }))} placeholder="e.g. Light Ayurvedic diet — khichdi, warm water…" icon={Utensils} />
              <TextArea label="Doctor's Notes / Observations" value={form.doctors_notes} onChange={v => setForm(f => ({ ...f, doctors_notes: v }))} placeholder="Patient response, observations, plan changes…" icon={Stethoscope} />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Record</>
              }
            </button>
          </div>

          {/* ── Past Records ── */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3">
              Progress History
              <span className="ml-2 text-sm font-normal text-gray-500">({entries.length} records)</span>
            </h3>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading records…</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                No daily progress records yet. Add the first one above.
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map(entry => (
                  <div key={entry.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Row header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-gray-800">
                          {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {entry.bp_morning && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full">BP: {entry.bp_morning}</span>}
                          {entry.temperature && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">Temp: {entry.temperature}</span>}
                          {entry.treatment_performed && <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Tx recorded</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {expandedId === entry.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expandedId === entry.id && (
                      <div className="px-4 py-4 grid grid-cols-2 gap-4 text-sm">
                        {/* Vitals */}
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Vitals</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              ['BP Morning', entry.bp_morning],
                              ['BP Evening', entry.bp_evening],
                              ['Temperature', entry.temperature],
                              ['Pulse', entry.pulse],
                              ['SPO2', entry.spo2],
                              ['Weight', entry.weight],
                            ].map(([label, val]) => val ? (
                              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                                <div className="text-xs text-gray-500">{label}</div>
                                <div className="font-semibold text-gray-800">{val}</div>
                              </div>
                            ) : null)}
                          </div>
                        </div>
                        {entry.treatment_performed && (
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Treatment Performed</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{entry.treatment_performed}</p>
                          </div>
                        )}
                        {entry.medicines_given && (
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Medicines Given</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{entry.medicines_given}</p>
                          </div>
                        )}
                        {entry.diet && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Diet</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{entry.diet}</p>
                          </div>
                        )}
                        {entry.doctors_notes && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Doctor's Notes</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{entry.doctors_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IPDailyProgressModal;
