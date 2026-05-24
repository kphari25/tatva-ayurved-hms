import React, { useState } from 'react';
import { Plus, Save, X, Package, DollarSign, Calendar, Barcode, Tag, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const AddMedicine = ({ onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    // Basic Information
    item_name: '',
    item_code: '',
    category: '',
    manufacturer: '',
    hsn_code: '',
    
    // Pricing
    purchase_price: '',
    MRP: '',
    discount_percentage: '',
    gst_percentage: '12', // Total GST
    cgst_percentage: '6',  // Central GST (half of total)
    sgst_percentage: '6',  // State GST (half of total)
    
    // Stock Information
    stock_quantity: '',
    reorder_level: '',
    unit_of_measurement: 'Nos',
    
    // Batch Information
    batch_number: '',
    manufacturing_date: '',
    expiry_date: '',
    
    // Storage
    storage_location: '',
    rack_number: '',
    
    // Medicine Details
    composition: '',
    dosage_form: '',
    strength: '',
    
    // Supplier Information
    supplier_name: '',
    supplier_contact: '',
    
    // Additional Information
    description: '',
    usage_instructions: '',
    side_effects: '',
    contraindications: '',
    
    // Status
    is_active: true,
    prescription_required: false
  });

  const categories = [
    'Ayurvedic Powders',
    'Ayurvedic Tablets',
    'Ayurvedic Capsules',
    'Ayurvedic Syrups',
    'Ayurvedic Oils',
    'Ayurvedic Creams/Ointments',
    'Ayurvedic Churna',
    'Ayurvedic Kwath',
    'Ayurvedic Ark/Asava',
    'Ayurvedic Ghrita',
    'Herbal Extracts',
    'General Medicines',
    'Surgical Items',
    'Consumables',
    'Other'
  ];

  const dosageForms = [
    'Tablet',
    'Capsule',
    'Syrup',
    'Powder (Churna)',
    'Oil',
    'Cream',
    'Ointment',
    'Drops',
    'Injection',
    'Kwath',
    'Asava/Arishta',
    'Ghrita',
    'Other'
  ];

  const units = [
    'Nos',
    'Box',
    'Strip',
    'Bottle',
    'Tube',
    'Jar',
    'Packet',
    'Kg',
    'Grams',
    'Liters',
    'ML'
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const calculateSellingPrice = () => {
    if (formData.purchase_price && formData.MRP) {
      const margin = ((parseFloat(formData.MRP) - parseFloat(formData.purchase_price)) / parseFloat(formData.purchase_price) * 100).toFixed(2);
      return margin;
    }
    return '0';
  };

  const validateForm = () => {
    if (!formData.item_name.trim()) {
      setError('Medicine name is required');
      return false;
    }
    if (!formData.item_code.trim()) {
      setError('Item code is required');
      return false;
    }
    if (!formData.category) {
      setError('Category is required');
      return false;
    }
    if (!formData.purchase_price || parseFloat(formData.purchase_price) <= 0) {
      setError('Valid purchase price is required');
      return false;
    }
    if (!formData.MRP || parseFloat(formData.MRP) <= 0) {
      setError('Valid MRP is required');
      return false;
    }
    if (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0) {
      setError('Valid stock quantity is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      const medicineData = {
        // Basic Information
        item_name: formData.item_name.trim(),
        item_code: formData.item_code.trim().toUpperCase(),
        category: formData.category,
        manufacturer: formData.manufacturer || '',
        hsn_code: formData.hsn_code || '',
        
        // Pricing
        purchase_price: parseFloat(formData.purchase_price),
        MRP: parseFloat(formData.MRP),
        discount_percentage: parseFloat(formData.discount_percentage) || 0,
        gst_percentage: parseFloat(formData.gst_percentage) || 12,
        cgst_percentage: parseFloat(formData.cgst_percentage) || 6,
        sgst_percentage: parseFloat(formData.sgst_percentage) || 6,
        margin: calculateSellingPrice(),
        
        // Stock Information
        stock_quantity: parseInt(formData.stock_quantity),
        reorder_level: parseInt(formData.reorder_level) || 10,
        unit_of_measurement: formData.unit_of_measurement,
        
        // Batch Information
        batches: formData.batch_number ? [{
          batch_number: formData.batch_number,
          quantity: parseInt(formData.stock_quantity),
          manufacturing_date: formData.manufacturing_date || null,
          expiry_date: formData.expiry_date || null,
          purchase_price: parseFloat(formData.purchase_price),
          mrp: parseFloat(formData.MRP)
        }] : [],
        
        // Storage
        storage_location: formData.storage_location || '',
        rack_number: formData.rack_number || '',
        
        // Medicine Details
        composition: formData.composition || '',
        dosage_form: formData.dosage_form || '',
        strength: formData.strength || '',
        
        // Supplier Information
        supplier_name: formData.supplier_name || '',
        supplier_contact: formData.supplier_contact || '',
        
        // Additional Information
        description: formData.description || '',
        usage_instructions: formData.usage_instructions || '',
        side_effects: formData.side_effects || '',
        contraindications: formData.contraindications || '',
        
        // Status
        is_active: formData.is_active,
        prescription_required: formData.prescription_required,
        
        // Timestamps
        created_at: new Date().toISOString(),
        created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email,
        last_updated: new Date().toISOString()
      };

      await addDoc(collection(db, 'inventory'), medicineData);

      alert(`✅ Medicine added successfully!\n\nItem: ${medicineData.item_name}\nCode: ${medicineData.item_code}\nStock: ${medicineData.stock_quantity} ${medicineData.unit_of_measurement}`);
      
      if (onSuccess) onSuccess();
      if (onClose) onClose();

    } catch (err) {
      console.error('Error adding medicine:', err);
      setError('Failed to add medicine: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Add New Medicine</h2>
              <p className="text-sm text-blue-100">Complete medicine entry form</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medicine Name *
                </label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => handleChange('item_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ashwagandha Churna"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Code *
                </label>
                <input
                  type="text"
                  value={formData.item_code}
                  onChange={(e) => handleChange('item_code', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="ASH-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => handleChange('manufacturer', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Company Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HSN Code
                </label>
                <input
                  type="text"
                  value={formData.hsn_code}
                  onChange={(e) => handleChange('hsn_code', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="30049099"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dosage Form
                </label>
                <select
                  value={formData.dosage_form}
                  onChange={(e) => handleChange('dosage_form', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Form</option>
                  {dosageForms.map(form => (
                    <option key={form} value={form}>{form}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Pricing Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => handleChange('purchase_price', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="250.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRP *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.MRP}
                  onChange={(e) => handleChange('MRP', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="500.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_percentage}
                  onChange={(e) => handleChange('discount_percentage', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total GST %
                </label>
                <select
                  value={formData.gst_percentage}
                  onChange={(e) => {
                    const totalGST = parseFloat(e.target.value);
                    const halfGST = totalGST / 2;
                    handleChange('gst_percentage', e.target.value);
                    handleChange('cgst_percentage', halfGST.toString());
                    handleChange('sgst_percentage', halfGST.toString());
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  CGST: {formData.cgst_percentage}% + SGST: {formData.sgst_percentage}%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CGST % (Central)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cgst_percentage}
                  onChange={(e) => {
                    const cgst = parseFloat(e.target.value) || 0;
                    const sgst = parseFloat(formData.sgst_percentage) || 0;
                    handleChange('cgst_percentage', e.target.value);
                    handleChange('gst_percentage', (cgst + sgst).toString());
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="6"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SGST % (State)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sgst_percentage}
                  onChange={(e) => {
                    const sgst = parseFloat(e.target.value) || 0;
                    const cgst = parseFloat(formData.cgst_percentage) || 0;
                    handleChange('sgst_percentage', e.target.value);
                    handleChange('gst_percentage', (cgst + sgst).toString());
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="6"
                />
              </div>
            </div>

            {formData.purchase_price && formData.MRP && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Margin:</strong> {calculateSellingPrice()}%
                  {' | '}
                  <strong>Profit per unit:</strong> ₹{(parseFloat(formData.MRP) - parseFloat(formData.purchase_price)).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Stock Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Stock Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => handleChange('stock_quantity', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit of Measurement
                </label>
                <select
                  value={formData.unit_of_measurement}
                  onChange={(e) => handleChange('unit_of_measurement', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reorder Level
                </label>
                <input
                  type="number"
                  value={formData.reorder_level}
                  onChange={(e) => handleChange('reorder_level', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>
            </div>
          </div>

          {/* Batch Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Barcode className="w-5 h-5 text-orange-600" />
              Batch Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Number
                </label>
                <input
                  type="text"
                  value={formData.batch_number}
                  onChange={(e) => handleChange('batch_number', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="BATCH-2026-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manufacturing Date
                </label>
                <input
                  type="date"
                  value={formData.manufacturing_date}
                  onChange={(e) => handleChange('manufacturing_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => handleChange('expiry_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Storage Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-600" />
              Storage & Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={formData.storage_location}
                  onChange={(e) => handleChange('storage_location', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Shelf A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rack Number
                </label>
                <input
                  type="text"
                  value={formData.rack_number}
                  onChange={(e) => handleChange('rack_number', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="R-12"
                />
              </div>
            </div>
          </div>

          {/* Medicine Details */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Medicine Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Composition
                </label>
                <textarea
                  value={formData.composition}
                  onChange={(e) => handleChange('composition', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Active ingredients and composition..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strength
                </label>
                <input
                  type="text"
                  value={formData.strength}
                  onChange={(e) => handleChange('strength', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="500mg, 10ml, etc."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Brief description of the medicine..."
                />
              </div>
            </div>
          </div>

          {/* Supplier Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Supplier Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => handleChange('supplier_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="ABC Pharma Distributors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Contact
                </label>
                <input
                  type="text"
                  value={formData.supplier_contact}
                  onChange={(e) => handleChange('supplier_contact', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Additional Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usage Instructions
                </label>
                <textarea
                  value={formData.usage_instructions}
                  onChange={(e) => handleChange('usage_instructions', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="How to use this medicine..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Side Effects
                </label>
                <textarea
                  value={formData.side_effects}
                  onChange={(e) => handleChange('side_effects', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Possible side effects..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraindications
                </label>
                <textarea
                  value={formData.contraindications}
                  onChange={(e) => handleChange('contraindications', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="When not to use..."
                />
              </div>
            </div>
          </div>

          {/* Status Toggles */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Status</h3>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Active Item</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.prescription_required}
                  onChange={(e) => handleChange('prescription_required', e.target.checked)}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Prescription Required</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white border-t pb-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMedicine;
