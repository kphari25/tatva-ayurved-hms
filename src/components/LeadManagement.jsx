import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, Users, TrendingUp, Plus, Search, Filter, CheckCircle, Clock, X, Send, XCircle, Trash2, Pencil, Calendar } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APPOINTMENT_TYPE_OPTIONS } from '../lib/appointmentBuckets';
import { createPendingIPPatient } from '../lib/pendingIPPatient';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'followup', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppLead, setWhatsAppLead] = useState(null);
  const [bookingLead, setBookingLead] = useState(null);
  const [bookingSaving, setBookingSaving] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const leadsRef = collection(db, 'leads');
      const q = query(leadsRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLeads(leadsData);
      console.log(`✅ Loaded ${leadsData.length} leads`);

    } catch (error) {
      console.error('Error loading leads:', error);
      alert('Failed to load leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStats = () => ({
    new: leads.filter(l => (l.status || 'new') === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    followup: leads.filter(l => l.status === 'followup').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
  });

  const getFilteredLeads = () => {
    return leads.filter(lead => {
      const matchesSearch = 
        (lead.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone || '').includes(searchTerm) ||
        (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
      const matchesSource = filterSource === 'all' || lead.source === filterSource;

      return matchesSearch && matchesStatus && matchesSource;
    });
  };

  // Single entry point for every status transition, driven by the inline
  // per-row dropdown. "Converted" doesn't write a patient record directly —
  // it hands off to the real Register New Patient flow (pre-filled), so the
  // patient gets a proper MRD number and the rest of the intake fields.
  const handleStatusChange = async (lead, newStatus) => {
    if (newStatus === lead.status) return;
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (newStatus === 'converted') {
      if (!confirm(`Convert ${lead.name} to a patient? This opens New Patient Registration pre-filled with their details.`)) return;
      try {
        await updateDoc(doc(db, 'leads', lead.id), {
          status: 'converted',
          converted_at: new Date().toISOString(),
          updated_by: currentUser.email,
        });
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'converted' } : l));
        window.dispatchEvent(new CustomEvent('convertLeadToPatient', {
          detail: { leadId: lead.id, name: lead.name, phone: lead.phone, email: lead.email, interest: lead.interest, notes: lead.notes },
        }));
      } catch (error) {
        console.error('Error converting lead:', error);
        alert('Failed to update lead: ' + error.message);
      }
      return;
    }

    if (newStatus === 'lost') {
      if (!confirm(`Mark ${lead.name} as lost? This means they made contact but did not take any treatment.`)) return;
      const reason = prompt('Reason (optional) — e.g. unreachable, chose another clinic, price…') || '';
      try {
        await updateDoc(doc(db, 'leads', lead.id), {
          status: 'lost',
          lost_at: new Date().toISOString(),
          lost_reason: reason,
          updated_by: currentUser.email,
        });
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'lost', lost_reason: reason } : l));
      } catch (error) {
        console.error('Error marking lead as lost:', error);
        alert('Failed to update: ' + error.message);
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'leads', lead.id), { status: newStatus, updated_by: currentUser.email });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    } catch (error) {
      console.error('Error updating lead status:', error);
      alert('Failed to update: ' + error.message);
    }
  };

  const handleDeleteLead = async (lead) => {
    if (!confirm(`Delete the lead for ${lead.name}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'leads', lead.id));
      setLeads(prev => prev.filter(l => l.id !== lead.id));
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete: ' + error.message);
    }
  };

  // Books a real appointment straight from a lead — the reverse of what
  // Dashboard's Add Appointment already does (create appointment -> auto
  // lead). Kept separate from the "Converted" status handoff, which is for
  // completing the patient's full registration once they actually show up;
  // this just needs to get the call itself onto the Appointments board. If
  // it's an IP-type booking, mirrors Dashboard/Scheduling's own behavior:
  // auto-create a pending-admission patient and link it via patient_id so
  // the appointment is treated as "for a known patient" everywhere else.
  const bookAppointmentForLead = async (lead, fields) => {
    try {
      setBookingSaving(true);
      const apptRef = await addDoc(collection(db, 'appointments'), {
        patient: lead.name,
        phone: lead.phone || '',
        date: fields.date,
        time: fields.time,
        type: fields.type,
        status: 'scheduled',
        contact_status: 'called_in',
        lead_id: lead.id,
        createdAt: new Date().toISOString(),
      });

      if (fields.type === 'IP') {
        try {
          const newPatientId = await createPendingIPPatient(lead.name, lead.phone);
          await updateDoc(doc(db, 'appointments', apptRef.id), { patient_id: newPatientId });
        } catch (patientError) {
          console.error('⚠️ Failed to create pending-admission patient record:', patientError);
        }
      }

      setBookingLead(null);
      alert(`✅ Appointment booked for ${lead.name} — it'll show up in Appointments.`);
    } catch (error) {
      console.error('Error booking appointment from lead:', error);
      alert('Failed to book appointment: ' + error.message);
    } finally {
      setBookingSaving(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick }) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      style={{ borderColor: color }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );

  const stats = getStats();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Lead Management</h1>
              <p className="text-gray-600 text-sm">Track inquiries and convert to patients</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-6">
        <StatCard
          title="New"
          value={stats.new}
          icon={Plus}
          color="#3b82f6"
          onClick={() => setFilterStatus('new')}
        />
        <StatCard
          title="Contacted"
          value={stats.contacted}
          icon={Phone}
          color="#f59e0b"
          onClick={() => setFilterStatus('contacted')}
        />
        <StatCard
          title="Follow Up"
          value={stats.followup}
          icon={Clock}
          color="#8b5cf6"
          onClick={() => setFilterStatus('followup')}
        />
        <StatCard
          title="Converted"
          value={stats.converted}
          icon={CheckCircle}
          color="#10b981"
          onClick={() => setFilterStatus('converted')}
        />
        <StatCard
          title="Lost"
          value={stats.lost}
          icon={XCircle}
          color="#ef4444"
          onClick={() => setFilterStatus('lost')}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="followup">Follow-up</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Sources</option>
              <option value="phone">Phone Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="walkin">Walk-in</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading leads...</p>
          </div>
        ) : getFilteredLeads().length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No leads found</p>
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Add First Lead
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Follow-up</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredLeads().map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                      <div className="text-xs text-gray-400">{lead.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        lead.source === 'phone' ? 'bg-blue-100 text-blue-800' :
                        lead.source === 'whatsapp' ? 'bg-green-100 text-green-800' :
                        lead.source === 'walkin' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {lead.source || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {lead.interest || 'General'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        lead.priority === 'hot' ? 'bg-red-100 text-red-800' :
                        lead.priority === 'warm' ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {lead.priority || 'Cold'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {lead.next_followup ? (
                        <div className={
                          new Date(lead.next_followup) < new Date() 
                            ? 'text-red-600 font-semibold' 
                            : 'text-gray-700'
                        }>
                          {new Date(lead.next_followup).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        lead.status === 'converted' ? 'bg-green-100 text-green-800' :
                        lead.status === 'lost' ? 'bg-red-100 text-red-800' :
                        lead.status === 'followup' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {lead.status || 'New'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={lead.status || 'new'}
                          onChange={(e) => handleStatusChange(lead, e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          title="Change status"
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setBookingLead(lead)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Book Appointment"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setWhatsAppLead(lead);
                            setShowWhatsAppModal(true);
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="WhatsApp Follow-up"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingLead(lead); setShowAddLeadModal(true); }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit Lead"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Lead"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Lead Modal */}
      {showAddLeadModal && (
        <AddLeadModal
          lead={editingLead}
          onClose={() => { setShowAddLeadModal(false); setEditingLead(null); }}
          onSave={() => {
            setShowAddLeadModal(false);
            setEditingLead(null);
            loadLeads();
          }}
        />
      )}

      {/* Book Appointment Modal */}
      {bookingLead && (
        <BookAppointmentModal
          lead={bookingLead}
          onClose={() => setBookingLead(null)}
          onSave={(fields) => bookAppointmentForLead(bookingLead, fields)}
          saving={bookingSaving}
        />
      )}

      {/* WhatsApp Follow-up Modal */}
      {showWhatsAppModal && whatsAppLead && (
        <LeadWhatsAppModal
          lead={whatsAppLead}
          onClose={() => {
            setShowWhatsAppModal(false);
            setWhatsAppLead(null);
          }}
        />
      )}
    </div>
  );
};

const pad2 = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Books a real appointment for a lead — same Type options as Dashboard/
// Scheduling's Add Appointment, kept intentionally small (just date/time/
// type) since the lead already carries name/phone.
const BookAppointmentModal = ({ lead, onClose, onSave, saving }) => {
  const [fields, setFields] = useState({ date: todayStr(), time: '', type: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fields.date || !fields.time || !fields.type) {
      setError('Date, time and appointment type are required.');
      return;
    }
    onSave(fields);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Book Appointment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            For <span className="font-medium text-gray-700">{lead.name}</span>
            {lead.phone && <span className="text-gray-400"> · {lead.phone}</span>}
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={fields.date}
                onChange={(e) => setFields({ ...fields, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={fields.time}
                onChange={(e) => setFields({ ...fields, time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
            <select
              value={fields.type}
              onChange={(e) => setFields({ ...fields, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">— Select Type —</option>
              {APPOINTMENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {fields.type === 'IP' && (
              <p className="text-xs text-amber-700 mt-1">This will also add {lead.name} to Pending Admissions.</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add / Edit Lead Modal — also covers what the old separate Follow-up modal
// used to do (notes, next follow-up date, priority), since those are just
// regular fields on the lead now that status has its own inline dropdown.
const AddLeadModal = ({ lead, onClose, onSave }) => {
  const isEditMode = !!lead;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: lead?.name || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    source: lead?.source || 'phone',
    interest: lead?.interest || '',
    priority: lead?.priority || 'warm',
    notes: lead?.notes || '',
    next_followup: lead?.next_followup || ''
  });

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      alert('Please enter name and phone number');
      return;
    }

    try {
      setSaving(true);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      if (isEditMode) {
        await updateDoc(doc(db, 'leads', lead.id), { ...formData, updated_by: currentUser.email });
      } else {
        await addDoc(collection(db, 'leads'), {
          ...formData,
          status: 'new',
          created_at: new Date().toISOString(),
          created_by: currentUser.email
        });
        alert('✅ Lead added successfully!');
      }
      if (onSave) onSave();

    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-purple-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold">{isEditMode ? 'Edit Lead' : 'Add New Lead'}</h2>
          <button onClick={onClose} className="hover:bg-purple-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="phone">Phone Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="walkin">Walk-in</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Interest/Concern</label>
              <input
                type="text"
                value={formData.interest}
                onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Weight loss, Arthritis, General consultation"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Next Follow-up Date</label>
              <input
                type="date"
                value={formData.next_followup}
                onChange={(e) => setFormData({ ...formData, next_followup: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// WhatsApp Follow-up Modal
const LeadWhatsAppModal = ({ lead, onClose }) => {
  const defaultMessage = `Hi ${lead.name}, this is Tatva Ayurved following up on your inquiry${lead.interest ? ` about ${lead.interest}` : ''}. Would you like to schedule a visit?`;
  const [message, setMessage] = useState(defaultMessage);

  const hasPhone = !!(lead.phone || '').replace(/[^0-9]/g, '');

  const handleSend = () => {
    if (!message.trim()) { alert('Please enter a message'); return; }

    let phone = (lead.phone || '').replace(/[^0-9]/g, '');
    if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold">WhatsApp: {lead.name}</h2>
          <button onClick={onClose} className="hover:bg-emerald-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {!hasPhone ? (
            <p className="text-sm text-red-600">No phone number on file for this lead.</p>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows="5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-2">Opens WhatsApp with this message pre-filled to {lead.phone} — you'll still need to hit send there.</p>
            </>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            {hasPhone && (
              <button
                onClick={handleSend}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Open WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
