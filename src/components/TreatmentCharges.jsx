import React, { useState, useEffect } from 'react';
import { IndianRupee, Plus, Edit, Trash2, Search, Save, X, Stethoscope } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

// Seeded from the clinic's official "TREATMENT PRICE LIST" so the module opens pre-populated.
// Doctors/staff can edit or add to this list from the UI afterwards.
const DEFAULT_TREATMENTS = [
  ['ABHYANGAM 2 HANDS', 1300], ['ABHYANGAM 4HANDS', 1500], ['ABHYANGAM (HALF)', 750],
  ['ABHYANGAM+ PICHU', 1250], ['ABHYANGAM+LOCAL PIZHICHIL', 1800], ['ABHYANGAM+PODIKIZHI(2)', 1800],
  ['ABHYANGAM+UDWARTHANAM', 1800], ['AGNIKARMAM', 500], ['ALEPANAM', 500],
  ['BANDAGE(LUMBAR)', 600], ['BANDAGE(KNEE,ELBOW,ANKLE)', 300], ['BANDAGE(SHOULDER)', 600],
  ['DHANYAMLA DHARA', 1500], ['DHARA(LOCAL)', 900], ['DHARA(SINGLE)', 600],
  ['DOOMAPANAM', 300], ['DOOPANAM', 300], ['DRESSING', 450],
  ['ELAKIZHI(4)', 1600], ['ELAKIZHI(1)', 600], ['ELAKIZHI (LOCAL)', 900],
  ['GREEVA PICHU', 600], ['GREEVA PICHU-KADEE PICHU', 1300], ['GREEVA PICHU-KADEE THARPANAM', 1500],
  ['GREEVA VASTHI', 950], ['IR THERAPY', 250], ['JALOOKAVACHARANAM', 750],
  ['JANU VASTHI', 950], ['KABALAM', 300], ['KADEE THARPANAM', 950],
  ['DHANYAMLA KIZHI(4)', 1600], ['DHANYAMLA KIZHI(LOCAL)', 900], ['DHANYAMLA KIZHI(1)', 600],
  ['KASHAYA DHARA', 1400], ['KASHAYA DHARA(L)', 900], ['KASHAYA KIZHI(4)', 1500],
  ['KASHAYA VASTHI', 1600], ['KADEE PICHU', 600], ['KADEE VASTHI', 950],
  ['KSHALANAM', 400], ['KSHEERA DHARA', 1600], ['LEPANAM(1)', 250],
  ['LEPANAM(2)', 500], ['MADHU THILIKA VASTHI', 1600], ['MATHRA VASTHI', 350],
  ['MUGHABHYANGAM', 250], ['MUGHA LEPAM', 200], ['NADI SWEDAM', 350],
  ['NASYAM', 600], ['NAVARA KIZHI(4)', 1800], ['NAVARA KIZHI(LOCAL)', 1000],
  ['NAVARA THEPU', 1550], ['NETHRA KIZHI', 500], ['NETHRA DHARA', 500],
  ['PATTU', 300], ['PADABHYANGAM', 500], ['PIZHICHIL', 1550],
  ['PIZHICHIL(LOCAL)', 800], ['PODI KIZHI', 1700], ['PODIKIZHI(LOCAL)', 900],
  ['PODI KIZHI(SINGLE)', 500], ['RAKTHAMOKSHAM', 900], ['SIRA VYADHAM', 1450],
  ['SIRO DHARA', 1400], ['SITZBATH', 300], ['SNEHA PANAM', 1000],
  ['SNEHAPANAM(INFERTILITY)', 1200], ['SNEHA VASTHI', 800], ['THAKRA DHARA', 1700],
  ['THALAM', 250], ['THALAPOTHICHIL', 1100], ['THARPANAM', 800],
  ['THYLADHARA', 1450], ['UDSADANAM', 500], ['UDWARTHANAM', 1650],
  ['UPANAHAM', 600], ['UPANAHAM(2)', 1200], ['UTHARAVASTHI', 1600],
  ['VAMANAM', 1600], ['VIRECHANAM', 440], ['YONI PICHU & YONI KSHALANAM', 600],
  ['SWEDANAM', 700],
];

export const TREATMENT_CHARGES_COLLECTION = 'treatment_charges';

export const fetchTreatmentCharges = async () => {
  const snap = await getDocs(query(collection(db, TREATMENT_CHARGES_COLLECTION), orderBy('sl_no', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

const TreatmentCharges = () => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '' });
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTreatment, setNewTreatment] = useState({ name: '', price: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTreatments();
  }, []);

  const loadTreatments = async () => {
    try {
      setLoading(true);
      let data = await fetchTreatmentCharges();

      if (data.length === 0) {
        await seedDefaultTreatments();
        data = await fetchTreatmentCharges();
      }

      setTreatments(data);
    } catch (error) {
      console.error('Error loading treatment charges:', error);
      alert('Failed to load treatment charges: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultTreatments = async () => {
    try {
      setSeeding(true);
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      // Deterministic doc IDs make this idempotent: re-running the seed (e.g. two
      // concurrent loads on an empty collection) overwrites the same docs instead
      // of creating duplicates.
      DEFAULT_TREATMENTS.forEach(([name, price], index) => {
        const ref = doc(db, TREATMENT_CHARGES_COLLECTION, `seed-${index + 1}`);
        batch.set(ref, { sl_no: index + 1, name, price, created_at: now, updated_at: now });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error seeding treatment charges:', error);
      alert('Failed to import default price list: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  const nextSlNo = () => treatments.reduce((max, t) => Math.max(max, t.sl_no || 0), 0) + 1;

  const handleAddTreatment = async () => {
    const name = newTreatment.name.trim();
    const price = parseFloat(newTreatment.price);
    if (!name || isNaN(price) || price < 0) {
      alert('Please enter a valid treatment name and price.');
      return;
    }
    try {
      setAdding(true);
      const now = new Date().toISOString();
      await addDoc(collection(db, TREATMENT_CHARGES_COLLECTION), {
        sl_no: nextSlNo(),
        name,
        price,
        created_at: now,
        updated_at: now,
      });
      setNewTreatment({ name: '', price: '' });
      setShowAddForm(false);
      await loadTreatments();
    } catch (error) {
      console.error('Error adding treatment:', error);
      alert('Failed to add treatment: ' + error.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({ name: t.name, price: t.price });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', price: '' });
  };

  const handleSaveEdit = async (id) => {
    const name = editForm.name.trim();
    const price = parseFloat(editForm.price);
    if (!name || isNaN(price) || price < 0) {
      alert('Please enter a valid treatment name and price.');
      return;
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, TREATMENT_CHARGES_COLLECTION, id), {
        name,
        price,
        updated_at: new Date().toISOString(),
      });
      setTreatments(prev => prev.map(t => (t.id === id ? { ...t, name, price } : t)));
      cancelEdit();
    } catch (error) {
      console.error('Error updating treatment:', error);
      alert('Failed to update treatment: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this treatment from the price list?')) return;
    try {
      await deleteDoc(doc(db, TREATMENT_CHARGES_COLLECTION, id));
      setTreatments(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting treatment:', error);
      alert('Failed to delete treatment: ' + error.message);
    }
  };

  const filteredTreatments = treatments.filter(t =>
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <IndianRupee className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Treatment Charges</h1>
            <p className="text-gray-600 text-sm">Manage the standard price list used when recommending treatments to patients</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Treatment
        </button>
      </div>

      {/* Add Treatment Form */}
      {showAddForm && (
        <div className="mb-6 bg-white rounded-xl shadow-md p-4 border border-teal-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">New Treatment</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Name</label>
              <input
                type="text"
                value={newTreatment.name}
                onChange={(e) => setNewTreatment({ ...newTreatment, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="e.g., ABHYANGAM 2 HANDS"
              />
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹)</label>
              <input
                type="number"
                value={newTreatment.price}
                onChange={(e) => setNewTreatment({ ...newTreatment, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="0"
                min="0"
              />
            </div>
            <button
              onClick={handleAddTreatment}
              disabled={adding}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 text-sm font-medium"
            >
              {adding ? 'Saving...' : 'Save Treatment'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewTreatment({ name: '', price: '' }); }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search treatments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading || seeding ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">{seeding ? 'Importing default price list…' : 'Loading treatment charges…'}</p>
          </div>
        ) : filteredTreatments.length === 0 ? (
          <div className="text-center py-12">
            <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No treatments found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-16">Sl No</th>
                <th className="px-4 py-3">Treatment</th>
                <th className="px-4 py-3 w-40">Price (₹)</th>
                <th className="px-4 py-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTreatments.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-sm">{t.sl_no}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {editingId === t.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 border border-teal-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{t.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    {editingId === t.id ? (
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className="w-28 px-2 py-1 border border-teal-300 rounded text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        min="0"
                      />
                    ) : (
                      <span className="font-semibold text-teal-700">₹{Number(t.price || 0).toLocaleString('en-IN')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editingId === t.id ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleSaveEdit(t.id)}
                          disabled={saving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-60"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !seeding && (
        <p className="text-xs text-gray-400 mt-3">{filteredTreatments.length} of {treatments.length} treatments shown</p>
      )}
    </div>
  );
};

export default TreatmentCharges;
