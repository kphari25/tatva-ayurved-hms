import React, { useState } from 'react';
import { Pill, Package, ShoppingCart } from 'lucide-react';
import MedicinesSoldDashboard from './MedicinesSoldDashboard';
import InventoryHealthDashboard from './InventoryHealthDashboard';
import ReorderExpiryDashboard from './ReorderExpiryDashboard';

// Analytics hub: what was sold, and the health of the stock.
const TABS = [
  { id: 'sold', label: 'Medicines Sold', icon: Pill },
  { id: 'inventory', label: 'Inventory Health', icon: Package },
  { id: 'planning', label: 'Reorder & Expiry', icon: ShoppingCart },
];

const AnalyticsPage = () => {
  const [tab, setTab] = useState('sold');

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <div className="px-6 pt-6">
        <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>
        <p className="text-gray-600 text-sm mb-4">What was sold, and the state of your stock</p>
        <div className="flex gap-2 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 -mb-px flex items-center gap-2 font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'sold' && <MedicinesSoldDashboard />}
      {tab === 'inventory' && <InventoryHealthDashboard />}
      {tab === 'planning' && <ReorderExpiryDashboard />}
    </div>
  );
};

export default AnalyticsPage;
