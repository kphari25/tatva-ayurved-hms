import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Search, DollarSign, Clock, CheckCircle, X } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PackageManagement = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  // Predefined package templates
  const packageTemplates = [
    {
      name: 'Weight Loss Program',
      category: 'Weight Management',
      duration: 30,
      duration_unit: 'days',
      cost: 15000,
      description: 'Comprehensive Ayurvedic weight loss treatment',
      inclusions: [
        'Initial consultation with Ayurvedic physician',
        'Personalized diet plan',
        'Herbal medicines (30 days supply)',
        'Udvartana (powder massage) - 15 sessions',
        'Abhyanga (oil massage) - 15 sessions',
        'Steam therapy - 15 sessions',
        'Weekly progress monitoring',
        'Final consultation and diet maintenance plan'
      ],
      expected_results: 'Expected weight loss: 5-8 kg in 30 days'
    },
    {
      name: 'Arthritis Relief Package',
      category: 'Joint Care',
      duration: 21,
      duration_unit: 'days',
      cost: 25000,
      description: 'Traditional Panchakarma-based arthritis treatment',
      inclusions: [
        'Comprehensive joint assessment',
        'Abhyanga (oil massage) - 21 sessions',
        'Kati Basti / Janu Basti - 14 sessions',
        'Pinda Sweda (herbal bolus therapy) - 14 sessions',
        'Internal medicines - 30 days',
        'Physiotherapy exercises guidance',
        'Diet counseling for joint health',
        'Follow-up consultation'
      ],
      expected_results: 'Significant pain reduction and improved mobility'
    },
    {
      name: 'PCOS Management Program',
      category: 'Women\'s Health',
      duration: 90,
      duration_unit: 'days',
      cost: 20000,
      description: 'Holistic Ayurvedic treatment for PCOS',
      inclusions: [
        'Detailed hormonal assessment',
        'Customized Ayurvedic medicines - 90 days',
        'Monthly consultations (3 sessions)',
        'Yoga and lifestyle counseling',
        'Specialized diet chart',
        'Udvartana therapy - 12 sessions',
        'Stress management techniques',
        'Ovulation tracking guidance'
      ],
      expected_results: 'Hormonal balance, regular cycles, weight management'
    },
    {
      name: 'Detox & Rejuvenation',
      category: 'Panchakarma',
      duration: 14,
      duration_unit: 'days',
      cost: 35000,
      description: 'Complete Panchakarma detoxification',
      inclusions: [
        'Pre-panchakarma consultation',
        'Snehana (oleation) - 3 days',
        'Swedana (steam therapy) - 7 days',
        'Virechana (purgation therapy)',
        'Basti (medicated enema) - 8 sessions',
        'Nasya (nasal therapy) - 7 sessions',
        'Shirodhara - 7 sessions',
        'Post-panchakarma diet plan',
        'Rejuvenating medicines - 15 days'
      ],
      expected_results: 'Complete body detoxification and renewed energy'
    },
    {
      name: 'Diabetes Care Program',
      category: 'Metabolic Health',
      duration: 60,
      duration_unit: 'days',
      cost: 18000,
      description: 'Ayurvedic diabetes management',
      inclusions: [
        'Blood sugar assessment and monitoring',
        'Herbal medicines - 60 days',
        'Bi-weekly consultations (4 sessions)',
        'Diabetic-friendly diet chart',
        'Panchakarma therapies - 10 sessions',
        'Exercise and yoga guidance',
        'Lifestyle modification plan',
        'Blood sugar tracking sheets'
      ],
      expected_results: 'Better sugar control, reduced medication dependency'
    }
  ];

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const packagesRef = collection(db, 'packages');
      const snapshot = await getDocs(packagesRef);
      
      const packagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPackages(packagesData);
      console.log(`✅ Loaded ${packagesData.length} packages`);

    } catch (error) {
      console.error('Error loading packages:', error);
      alert('Failed to load packages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (template) => {
    setSelectedPackage({ ...template, isNew: true });
    setShowPackageModal(true);
  };

  const handleDeletePackage = async (packageId) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      await deleteDoc(doc(db, 'packages', packageId));
      alert('✅ Package deleted successfully!');
      loadPackages();
    } catch (error) {
      console.error('Error deleting package:', error);
      alert('Failed to delete package: ' + error.message);
    }
  };

  const getFilteredPackages = () => {
    return packages.filter(pkg =>
      (pkg.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pkg.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Treatment Packages</h1>
              <p className="text-gray-600 text-sm">Manage Ayurveda treatment plans</p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedPackage(null);
              setShowPackageModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Package
          </button>
        </div>
      </div>

      {/* Package Templates */}
      {packages.length === 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Start Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packageTemplates.map((template, index) => (
              <div key={index} className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-green-500 transition-colors">
                <h3 className="font-bold text-gray-900 mb-2">{template.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{template.duration} {template.duration_unit}</p>
                    <p className="text-lg font-bold text-green-600">₹{template.cost.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => loadTemplate(template)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading packages...</p>
          </div>
        ) : getFilteredPackages().length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No packages found</p>
          </div>
        ) : (
          getFilteredPackages().map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
                <h3 className="text-lg font-bold">{pkg.name}</h3>
                <p className="text-sm text-green-100">{pkg.category}</p>
              </div>

              <div className="p-6">
                <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="font-semibold text-gray-900">{pkg.duration} {pkg.duration_unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Cost</p>
                      <p className="font-semibold text-green-600">₹{pkg.cost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">Inclusions:</p>
                  <ul className="space-y-1">
                    {(pkg.inclusions || []).slice(0, 3).map((item, index) => (
                      <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {pkg.inclusions?.length > 3 && (
                      <li className="text-xs text-gray-500 italic">
                        +{pkg.inclusions.length - 3} more inclusions
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setShowPackageModal(true);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Package Modal */}
      {showPackageModal && (
        <PackageModal
          package={selectedPackage}
          onClose={() => {
            setShowPackageModal(false);
            setSelectedPackage(null);
          }}
          onSave={() => {
            setShowPackageModal(false);
            setSelectedPackage(null);
            loadPackages();
          }}
        />
      )}
    </div>
  );
};

// Package Modal Component
const PackageModal = ({ package: pkg, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(pkg || {
    name: '',
    category: '',
    duration: 30,
    duration_unit: 'days',
    cost: 0,
    description: '',
    inclusions: [''],
    expected_results: ''
  });

  const handleAddInclusion = () => {
    setFormData({
      ...formData,
      inclusions: [...formData.inclusions, '']
    });
  };

  const handleUpdateInclusion = (index, value) => {
    const newInclusions = [...formData.inclusions];
    newInclusions[index] = value;
    setFormData({ ...formData, inclusions: newInclusions });
  };

  const handleRemoveInclusion = (index) => {
    setFormData({
      ...formData,
      inclusions: formData.inclusions.filter((_, i) => i !== index)
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cost) {
      alert('Please enter package name and cost');
      return;
    }

    try {
      setSaving(true);

      const packageData = {
        ...formData,
        inclusions: formData.inclusions.filter(i => i.trim()),
        updated_at: new Date().toISOString()
      };

      if (pkg?.id && !pkg?.isNew) {
        await updateDoc(doc(db, 'packages', pkg.id), packageData);
        alert('✅ Package updated successfully!');
      } else {
        await addDoc(collection(db, 'packages'), {
          ...packageData,
          created_at: new Date().toISOString()
        });
        alert('✅ Package created successfully!');
      }

      if (onSave) onSave();

    } catch (error) {
      console.error('Error saving package:', error);
      alert('Failed to save package: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold">{pkg?.id && !pkg?.isNew ? 'Edit Package' : 'Create Package'}</h2>
          <button onClick={onClose} className="hover:bg-green-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Package Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Weight Loss Program"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Weight Management"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cost (₹) *</label>
              <input
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="15000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration Unit</label>
              <select
                value={formData.duration_unit}
                onChange={(e) => setFormData({ ...formData, duration_unit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Brief description of the package"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Inclusions</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formData.inclusions.map((inclusion, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={inclusion}
                      onChange={(e) => handleUpdateInclusion(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Initial consultation with physician"
                    />
                    <button
                      onClick={() => handleRemoveInclusion(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddInclusion}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Inclusion
              </button>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Expected Results</label>
              <textarea
                value={formData.expected_results}
                onChange={(e) => setFormData({ ...formData, expected_results: e.target.value })}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Expected weight loss: 5-8 kg in 30 days"
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
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Package'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageManagement;
