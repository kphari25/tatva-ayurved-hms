import React, { useState } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const InventoryMigration = () => {
  const [status, setStatus] = useState('ready'); // ready, migrating, success, error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState('');

  const migrateInventory = async () => {
    try {
      setStatus('migrating');
      setMessage('Reading inventory from localStorage...');

      // Get inventory from localStorage
      const localInventory = localStorage.getItem('inventory');
      
      if (!localInventory) {
        setStatus('error');
        setMessage('No inventory found in localStorage!');
        return;
      }

      const items = JSON.parse(localInventory);
      const total = items.length;

      setProgress({ current: 0, total });
      setMessage(`Found ${total} items. Starting migration...`);

      // Firebase has a limit of 500 writes per batch
      const batchSize = 500;
      let migratedCount = 0;

      // Process in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchItems = items.slice(i, i + batchSize);

        batchItems.forEach((item) => {
          // Create a document reference with auto-generated ID
          const docRef = doc(collection(db, 'inventory'));
          
          // Clean up the item data
          const cleanItem = {
            id: item.id || Date.now() + Math.random(),
            item_code: item.item_code || item.code || '',
            item_name: item.item_name || item.name || 'Unknown',
            stock_quantity: parseInt(item.stock_quantity || item.quantity || 0),
            purchase_rate: parseFloat(item.purchase_rate || 0),
            mrp: parseFloat(item.mrp || 0),
            stock_value: parseFloat(item.stock_value || 0),
            month: item.month || null,
            created_at: new Date().toISOString(),
            migrated: true
          };

          batch.set(docRef, cleanItem);
        });

        // Commit the batch
        await batch.commit();
        migratedCount += batchItems.length;

        setProgress({ current: migratedCount, total });
        setMessage(`Migrated ${migratedCount} of ${total} items...`);

        // Small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setStatus('success');
      setMessage(`✅ Successfully migrated all ${total} items to Firebase!`);

    } catch (error) {
      console.error('Migration error:', error);
      setStatus('error');
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  const verifyMigration = async () => {
    try {
      setMessage('Verifying migration...');
      
      const inventoryRef = collection(db, 'inventory');
      const snapshot = await getDocs(inventoryRef);
      
      setMessage(`✅ Verified: ${snapshot.size} items in Firebase`);
    } catch (error) {
      setMessage(`❌ Verification error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Inventory Migration Tool
            </h1>
            <p className="text-gray-600">
              Migrate your inventory from localStorage to Firebase
            </p>
          </div>

          {/* Status Display */}
          <div className="mb-8">
            {status === 'ready' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">Ready to migrate</p>
                    <p>This will copy all inventory items from localStorage to Firebase.</p>
                    <p className="mt-2">⚠️ This is a one-time operation. Click "Start Migration" to begin.</p>
                  </div>
                </div>
              </div>
            )}

            {status === 'migrating' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <Loader className="w-5 h-5 text-yellow-600 animate-spin" />
                  <span className="font-medium text-yellow-800">Migrating...</span>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{progress.current} / {progress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mt-3">{message}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-2">{message}</p>
                    <p className="mt-2">Your inventory is now in Firebase and will sync across all devices!</p>
                  </div>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">{message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={migrateInventory}
              disabled={status === 'migrating' || status === 'success'}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {status === 'migrating' ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Migrating...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>{status === 'success' ? 'Migration Complete' : 'Start Migration'}</span>
                </>
              )}
            </button>

            {status === 'success' && (
              <button
                onClick={() => window.location.href = '#/inventory'}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Go to Inventory Management
              </button>
            )}
          </div>

          {/* Info */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">What happens during migration?</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Reads all items from browser localStorage</li>
              <li>• Uploads to Firebase in batches of 500</li>
              <li>• Preserves all item data (codes, quantities, prices)</li>
              <li>• Takes 1-2 minutes for 4746 items</li>
              <li>• Your localStorage data remains unchanged</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryMigration;
