import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PurchaseRequestModal = ({ onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicines, setSelectedMedicines] = useState([
    { 
      medicine_id: '', 
      medicine_name: '', 
      item_code: '',
      current_stock: 0, 
      reorder_level: 0,
      quantity: 0, 
      estimated_cost: 0,
      category: '',
      unit: 'Nos'
    }
  ]);
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      const medicinesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMedicines(medicinesData);
    } catch (error) {
      console.error('Error loading medicines:', error);
    }
  };

  const handleMedicineSelect = (index, medicineId) => {
    const medicine = medicines.find(m => m.id === medicineId);
    if (medicine) {
      const currentStock = medicine.stock_quantity || 0;
      const reorderLevel = medicine.reorder_level || 20;
      
      // Calculate suggested order quantity
      // If stock is below reorder level, suggest bringing it up to reorder level + 50%
      let suggestedQty = 0;
      if (currentStock < reorderLevel) {
        suggestedQty = Math.ceil(reorderLevel * 1.5 - currentStock);
      } else {
        suggestedQty = Math.ceil(reorderLevel * 0.5); // Suggest half of reorder level for buffer stock
      }
      
      const updated = [...selectedMedicines];
      updated[index] = {
        medicine_id: medicine.id,
        medicine_name: medicine.item_name,
        item_code: medicine.item_code || '',
        current_stock: currentStock,
        reorder_level: reorderLevel,
        quantity: suggestedQty,
        estimated_cost: medicine.purchase_price || 0,
        category: medicine.category || '',
        unit: medicine.unit_of_measurement || 'Nos'
      };
      setSelectedMedicines(updated);
    }
  };

  const handleQuantityChange = (index, quantity) => {
    const updated = [...selectedMedicines];
    updated[index].quantity = parseInt(quantity) || 0;
    setSelectedMedicines(updated);
  };

  const addMedicineRow = () => {
    setSelectedMedicines([
      ...selectedMedicines,
      { 
        medicine_id: '', 
        medicine_name: '', 
        item_code: '',
        current_stock: 0, 
        reorder_level: 0,
        quantity: 0, 
        estimated_cost: 0,
        category: '',
        unit: 'Nos'
      }
    ]);
  };

  const removeMedicineRow = (index) => {
    setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return selectedMedicines.reduce((sum, item) => 
      sum + (item.quantity * item.estimated_cost), 0
    );
  };

  const handleSave = async () => {
    const validMedicines = selectedMedicines.filter(m => m.medicine_id && m.quantity > 0);
    
    if (validMedicines.length === 0) {
      alert('Please add at least one medicine with quantity');
      return;
    }

    try {
      setSaving(true);

      const requestData = {
        request_id: `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        medicines: validMedicines,
        total_estimated: calculateTotal(),
        requested_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email,
        priority: priority,
        status: 'pending_approval',
        created_at: new Date().toISOString()
      };

      await addDoc(collection(db, 'purchase_requests'), requestData);

      alert('✅ Purchase request created successfully!');
      if (onSave) onSave();

    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to create request: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-xl font-bold">New Purchase Request</h2>
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Priority */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="high">High - Urgent</option>
              <option value="medium">Medium - Normal</option>
              <option value="low">Low - Can Wait</option>
            </select>
          </div>

          {/* Stock Summary Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Smart Purchase Suggestions</p>
                <p>When you select a medicine, the system will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Show current stock levels with color-coded status</li>
                  <li>Display reorder levels for each item</li>
                  <li>Suggest optimal order quantity based on stock status</li>
                  <li>Highlight items that are out of stock or running low</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Medicines Table */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">Medicines Required</h3>
              <button
                onClick={addMedicineRow}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Medicine
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Medicine</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Current Stock</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reorder Level</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qty Needed</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Est. Cost/Unit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedMedicines.map((item, index) => {
                    const stockStatus = item.current_stock <= 0 ? 'out' : 
                                      item.current_stock < item.reorder_level ? 'low' : 
                                      'good';
                    const stockColor = stockStatus === 'out' ? 'text-red-600' : 
                                      stockStatus === 'low' ? 'text-orange-600' : 
                                      'text-green-600';
                    const stockBg = stockStatus === 'out' ? 'bg-red-50' : 
                                   stockStatus === 'low' ? 'bg-orange-50' : 
                                   'bg-green-50';
                    
                    return (
                      <tr key={index} className={item.medicine_id && stockStatus !== 'good' ? stockBg : ''}>
                        <td className="px-4 py-2">
                          <select
                            value={item.medicine_id}
                            onChange={(e) => handleMedicineSelect(index, e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="">Select Medicine</option>
                            {medicines.map(med => (
                              <option key={med.id} value={med.id}>
                                {med.item_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{item.item_code}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`font-semibold ${stockColor}`}>
                            {item.current_stock} {item.unit}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{item.reorder_level}</td>
                        <td className="px-4 py-2">
                          {item.medicine_id && (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              stockStatus === 'out' ? 'bg-red-100 text-red-800' :
                              stockStatus === 'low' ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {stockStatus === 'out' ? '⚠️ Out of Stock' :
                               stockStatus === 'low' ? '⚡ Low Stock' :
                               '✓ In Stock'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            min="0"
                            placeholder="Qty"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm">₹{item.estimated_cost}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold">
                          ₹{(item.quantity * item.estimated_cost).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          {selectedMedicines.length > 1 && (
                            <button
                              onClick={() => removeMedicineRow(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="7" className="px-4 py-2 text-right font-bold">Total Estimated Cost:</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-600">
                      ₹{calculateTotal().toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actions */}
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequestModal;
