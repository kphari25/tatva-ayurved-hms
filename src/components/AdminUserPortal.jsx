import React, { useState, useEffect } from 'react';
import { Users, Activity, Calendar, DollarSign, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

const AdminUserPortal = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    lowStockItems: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Get current user from localStorage
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    setCurrentUser(user);
    
    // Load dashboard stats
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get total patients count
      const patientsRef = collection(db, 'patients');
      const patientsSnapshot = await getDocs(patientsRef);
      const totalPatients = patientsSnapshot.size;

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get appointments count (if collection exists)
      let todayAppointments = 0;
      try {
        const appointmentsRef = collection(db, 'appointments');
        const appointmentsSnapshot = await getDocs(appointmentsRef);
        todayAppointments = appointmentsSnapshot.size;
      } catch (err) {
        console.log('No appointments yet');
      }

      // Get low stock items
      let lowStockItems = 0;
      try {
        const inventoryRef = collection(db, 'inventory');
        const lowStockQuery = query(inventoryRef, where('stock_quantity', '<', 10));
        const lowStockSnapshot = await getDocs(lowStockQuery);
        lowStockItems = lowStockSnapshot.size;
      } catch (err) {
        console.log('No inventory yet');
      }

      // Get total revenue (if invoices exist)
      let totalRevenue = 0;
      try {
        const invoicesRef = collection(db, 'invoices');
        const invoicesSnapshot = await getDocs(invoicesRef);
        invoicesSnapshot.forEach(doc => {
          const data = doc.data();
          totalRevenue += data.total_amount || 0;
        });
      } catch (err) {
        console.log('No invoices yet');
      }

      setStats({
        totalPatients,
        todayAppointments,
        lowStockItems,
        totalRevenue
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              value
            )}
          </p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="ml-4">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
        </div>
      </div>
    </div>
  );

  const QuickActionCard = ({ title, description, icon: Icon, onClick, color }) => (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow text-left w-full border border-gray-100 hover:border-teal-200"
    >
      <div className="flex items-start space-x-4">
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome back, {currentUser?.name?.split(' ')[0] || 'User'}! 
          </h1>
          <span className="text-2xl">👋</span>
        </div>
        <p className="text-gray-600">Here's what is happening in Tatva Ayurved today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Patients"
          value={stats.totalPatients}
          icon={Users}
          color="#0d9488"
          subtitle="Registered in system"
        />
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          icon={Calendar}
          color="#3b82f6"
          subtitle="Scheduled for today"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockItems}
          icon={Package}
          color="#f59e0b"
          subtitle="Need reordering"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="#10b981"
          subtitle="All time"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickActionCard
            title="Patient Portal"
            description="View, search, and manage patient records"
            icon={Users}
            onClick={() => window.location.href = '#/patients'}
            color="#0d9488"
          />
          <QuickActionCard
            title="Scheduling"
            description="Manage appointments and schedules"
            icon={Calendar}
            onClick={() => window.location.href = '#/scheduling'}
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Register New Patient Section */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Register New Patient</h2>
            <p className="text-teal-100">
              Click below to register a new patient with complete medical history
            </p>
          </div>
          <button
            onClick={() => window.location.href = '#/patient-registration'}
            className="ml-6 bg-white text-teal-700 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50 transition-colors flex items-center space-x-2 shadow-lg"
          >
            <Users className="w-5 h-5" />
            <span>New Patient</span>
          </button>
        </div>
      </div>

      {/* ONE-TIME INVENTORY MIGRATION - REMOVE AFTER USE */}
      <div className="mt-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">⚠️ One-Time Inventory Migration</h2>
            <p className="text-orange-100 mb-2">
              Migrate your 4746 inventory items from localStorage to Firebase cloud database
            </p>
            <p className="text-orange-200 text-sm">
              ⏱️ Takes 1-2 minutes • Run this ONCE only • Keep browser open during migration
            </p>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm('This will migrate all inventory items to Firebase. Continue?')) return;
              
              const btn = event.target;
              btn.disabled = true;
              btn.textContent = 'Migrating...';
              
              try {
                const { collection, writeBatch, doc } = await import('firebase/firestore');
                const { db } = await import('../lib/firebase');
                
                const inv = localStorage.getItem('inventory');
                if (!inv) {
                  alert('❌ No inventory found in localStorage!');
                  btn.disabled = false;
                  btn.textContent = 'Migrate to Firebase';
                  return;
                }
                
                const items = JSON.parse(inv);
                const total = items.length;
                
                console.log(`🚀 Starting migration of ${total} items...`);
                
                const batchSize = 500;
                let migratedCount = 0;
                
                for (let i = 0; i < items.length; i += batchSize) {
                  const batch = writeBatch(db);
                  const batchItems = items.slice(i, i + batchSize);
                  
                  batchItems.forEach(item => {
                    const docRef = doc(collection(db, 'inventory'));
                    batch.set(docRef, {
                      id: item.id || Date.now() + Math.random(),
                      item_code: item.item_code || '',
                      item_name: item.item_name || 'Unknown',
                      stock_quantity: parseInt(item.stock_quantity || 0),
                      purchase_rate: parseFloat(item.purchase_rate || 0),
                      mrp: parseFloat(item.mrp || 0),
                      stock_value: parseFloat(item.stock_value || 0),
                      migrated: true,
                      migrated_at: new Date().toISOString()
                    });
                  });
                  
                  await batch.commit();
                  migratedCount += batchItems.length;
                  
                  const percent = Math.round((migratedCount / total) * 100);
                  btn.textContent = `Migrating ${percent}%...`;
                  console.log(`✅ Migrated ${migratedCount} of ${total} items (${percent}%)`);
                  
                  await new Promise(r => setTimeout(r, 100));
                }
                
                btn.textContent = '✅ Migration Complete!';
                btn.className = 'ml-6 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold';
                
                alert(`✅ Success! Migrated all ${total} items to Firebase!\n\nYou can now remove this migration button from the code.`);
                console.log(`🎉 Migration complete! ${total} items now in Firebase.`);
                
              } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Migrate to Firebase';
                alert('❌ Migration failed: ' + err.message);
                console.error('Migration error:', err);
              }
            }}
            className="ml-6 bg-white text-orange-700 px-6 py-3 rounded-lg font-semibold hover:bg-orange-50 transition-colors flex items-center space-x-2 shadow-lg"
          >
            <Package className="w-5 h-5" />
            <span>Migrate to Firebase</span>
          </button>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">System Information</p>
            <p className="mt-1">
              Logged in as: <span className="font-semibold">{currentUser?.email}</span>
            </p>
            <p>Role: <span className="font-semibold">{currentUser?.role}</span></p>
            <p className="mt-2 text-xs text-blue-600">
              💾 Using Firebase Database • 🔒 Secured Connection • ☁️ Cloud Sync Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserPortal;
