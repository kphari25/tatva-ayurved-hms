import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, Users, TrendingUp, Calendar, Plus, Search, Filter, CheckCircle, Clock, X, AlertCircle, Send } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

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

  const getStats = () => {
    const today = new Date().toDateString();
    
    return {
      totalLeads: leads.length,
      newToday: leads.filter(l => new Date(l.created_at).toDateString() === today).length,
      hot: leads.filter(l => l.priority === 'hot').length,
      converted: leads.filter(l => l.status === 'converted').length,
      conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(1) : 0,
      pendingFollowup: leads.filter(l => l.next_followup && new Date(l.next_followup) <= new Date() && l.status !== 'converted').length
    };
  };

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

  const handleConvertToPatient = async (lead) => {
    if (!confirm(`Convert ${lead.name} to patient?`)) return;

    try {
      // Create patient record
      const patientData = {
        first_name: lead.name.split(' ')[0],
        last_name: lead.name.split(' ').slice(1).join(' ') || '',
        phone: lead.phone,
        email: lead.email || '',
        address: lead.address || '',
        patient_number: `PAT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        created_at: new Date().toISOString(),
        source: 'lead_conversion',
        lead_id: lead.id
      };

      await addDoc(collection(db, 'patients'), patientData);

      // Update lead status
      await updateDoc(doc(db, 'leads', lead.id), {
        status: 'converted',
        converted_at: new Date().toISOString(),
        patient_number: patientData.patient_number
      });

      alert(`✅ Lead converted to patient!\nPatient Number: ${patientData.patient_number}`);
      loadLeads();

    } catch (error) {
      console.error('Error converting lead:', error);
      alert('Failed to convert lead: ' + error.message);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          icon={Users}
          color="#8b5cf6"
          subtitle="All time"
        />
        <StatCard
          title="New Today"
          value={stats.newToday}
          icon={Plus}
          color="#10b981"
          subtitle="Fresh inquiries"
        />
        <StatCard
          title="Hot Leads"
          value={stats.hot}
          icon={AlertCircle}
          color="#f59e0b"
          subtitle="High priority"
        />
        <StatCard
          title="Converted"
          value={stats.converted}
          icon={CheckCircle}
          color="#3b82f6"
          subtitle={`${stats.conversionRate}% rate`}
        />
        <StatCard
          title="Follow-ups Due"
          value={stats.pendingFollowup}
          icon={Clock}
          color="#ef4444"
          subtitle="Action needed"
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
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowFollowUpModal(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          title="Follow-up"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        {lead.status !== 'converted' && (
                          <button
                            onClick={() => handleConvertToPatient(lead)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            title="Convert to Patient"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <AddLeadModal
          onClose={() => setShowAddLeadModal(false)}
          onSave={() => {
            setShowAddLeadModal(false);
            loadLeads();
          }}
        />
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && selectedLead && (
        <FollowUpModal
          lead={selectedLead}
          onClose={() => {
            setShowFollowUpModal(false);
            setSelectedLead(null);
          }}
          onSave={() => {
            setShowFollowUpModal(false);
            setSelectedLead(null);
            loadLeads();
          }}
        />
      )}
    </div>
  );
};

// Add Lead Modal
const AddLeadModal = ({ onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'phone',
    interest: '',
    priority: 'warm',
    notes: '',
    next_followup: ''
  });

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      alert('Please enter name and phone number');
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, 'leads'), {
        ...formData,
        status: 'new',
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      });

      alert('✅ Lead added successfully!');
      if (onSave) onSave();

    } catch (error) {
      console.error('Error adding lead:', error);
      alert('Failed to add lead: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-purple-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold">Add New Lead</h2>
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
              {saving ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Follow-up Modal
const FollowUpModal = ({ lead, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    notes: '',
    next_followup: lead.next_followup || '',
    status: lead.status || 'followup'
  });

  const handleSave = async () => {
    try {
      setSaving(true);

      await updateDoc(doc(db, 'leads', lead.id), {
        ...formData,
        last_followup: new Date().toISOString(),
        updated_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email
      });

      alert('✅ Follow-up updated!');
      if (onSave) onSave();

    } catch (error) {
      console.error('Error updating follow-up:', error);
      alert('Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold">Follow-up: {lead.name}</h2>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="What was discussed..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Next Follow-up Date</label>
              <input
                type="date"
                value={formData.next_followup}
                onChange={(e) => setFormData({ ...formData, next_followup: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="followup">Follow-up</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
