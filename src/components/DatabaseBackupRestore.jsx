import React, { useState } from 'react';
import {
  Database, Download, Upload, Calendar, Clock, CheckCircle,
  AlertTriangle, HardDrive, RefreshCw, Shield, Archive,
  FileText, Settings, Zap, Activity, Save, RotateCcw, X
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const DatabaseBackupRestore = ({ supabase, userRole }) => {
  const [backups, setBackups] = useState([
    {
      id: '1',
      filename: 'tatva-backup-2025-02-15-10-30.sql',
      size: '45.2 MB',
      timestamp: '2025-02-15T10:30:00',
      type: 'auto',
      status: 'completed',
      tables: 156,
      rows: 12450
    },
    {
      id: '2',
      filename: 'tatva-backup-2025-02-14-10-30.sql',
      size: '44.8 MB',
      timestamp: '2025-02-14T10:30:00',
      type: 'auto',
      status: 'completed',
      tables: 156,
      rows: 12280
    },
    {
      id: '3',
      filename: 'tatva-backup-manual-2025-02-13.sql',
      size: '44.1 MB',
      timestamp: '2025-02-13T15:45:00',
      type: 'manual',
      status: 'completed',
      tables: 156,
      rows: 12150
    }
  ]);

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    frequency: 'daily', // daily, weekly, monthly
    retentionDays: 30,
    includeFiles: true,
    compression: true,
    encryption: true
  });

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  // Check admin access
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl text-center">
          <Shield className="w-20 h-20 text-red-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-red-800 mb-4">Access Restricted</h2>
          <p className="text-red-600">Only administrators can access database backup and restore functions.</p>
        </div>
      </div>
    );
  }

  // Create manual backup
  const createBackup = async () => {
    setIsBackingUp(true);
    
    try {
      // In real implementation, call Supabase CLI or API
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `tatva-backup-manual-${timestamp}.sql`;
      
      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newBackup = {
        id: Date.now().toString(),
        filename,
        size: '45.5 MB',
        timestamp: new Date().toISOString(),
        type: 'manual',
        status: 'completed',
        tables: 156,
        rows: 12500
      };
      
      setBackups([newBackup, ...backups]);
      alert('✅ Backup created successfully!');
      
    } catch (error) {
      console.error('Backup error:', error);
      alert('❌ Backup failed: ' + error.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Download backup file
  const downloadBackup = async (backup) => {
    try {
      // In real implementation:
      // 1. Generate backup from Supabase
      // 2. Download file
      
      alert(`Downloading backup: ${backup.filename}\n\nIn production, this would download the actual SQL backup file.`);
      
      // Example code for actual implementation:
      /*
      const { data, error } = await supabase
        .from('_backups')
        .download(backup.filename);
      
      if (error) throw error;
      
      const blob = new Blob([data], { type: 'application/sql' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      a.click();
      */
      
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    }
  };

  // Restore from backup
  const restoreBackup = async (backup) => {
    setIsRestoring(true);
    setShowConfirmRestore(false);
    
    try {
      // CRITICAL: This will overwrite current database!
      // In real implementation:
      // 1. Create a backup of current state first
      // 2. Stop all connections
      // 3. Restore from backup file
      // 4. Verify integrity
      // 5. Restart connections
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      alert(`✅ Database restored from backup: ${backup.filename}\n\nAll data has been restored to the state at ${new Date(backup.timestamp).toLocaleString()}`);
      
      // Refresh page to reload data
      window.location.reload();
      
    } catch (error) {
      console.error('Restore error:', error);
      alert('❌ Restore failed: ' + error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Upload backup file
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.sql')) {
      alert('Please upload a .sql file');
      return;
    }
    
    alert(`Uploading backup file: ${file.name}\n\nThis will be added to your backups list and can be used for restoration.`);
    
    // In real implementation, upload to storage and add to backups list
  };

  const stats = {
    totalBackups: backups.length,
    totalSize: backups.reduce((sum, b) => sum + parseFloat(b.size), 0).toFixed(1),
    lastBackup: backups[0]?.timestamp,
    oldestBackup: backups[backups.length - 1]?.timestamp
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Database Backup & Restore
            </h1>
            <p className="text-slate-600">Protect your data with automated backups and instant recovery</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
            <label className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 font-semibold cursor-pointer">
              <Upload className="w-5 h-5" />
              Upload Backup
              <input
                type="file"
                accept=".sql"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={createBackup}
              disabled={isBackingUp}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg disabled:opacity-50"
            >
              {isBackingUp ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Create Backup Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Backups', value: stats.totalBackups, icon: Database, color: 'blue' },
          { label: 'Total Size', value: `${stats.totalSize} MB`, icon: HardDrive, color: 'purple' },
          { label: 'Last Backup', value: new Date(stats.lastBackup).toLocaleDateString(), icon: Clock, color: 'emerald' },
          { label: 'Auto Backup', value: backupSettings.autoBackup ? 'Enabled' : 'Disabled', icon: Zap, color: 'amber' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 bg-${stat.color}-100 rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-7 h-7 text-${stat.color}-600`} />
              </div>
            </div>
            <p className="text-slate-600 text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Backup Status Banner */}
      {backupSettings.autoBackup && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Automated Backup Active</h3>
              <p className="text-emerald-100">
                Your database is backed up {backupSettings.frequency} at 10:30 AM. 
                Backups are retained for {backupSettings.retentionDays} days.
              </p>
            </div>
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      )}

      {/* Backups List */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b-2 border-slate-200 bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Archive className="w-6 h-6 text-blue-600" />
            Available Backups
          </h3>
        </div>

        <div className="divide-y divide-slate-200">
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="p-6 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    backup.type === 'auto' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    <Database className={`w-7 h-7 ${
                      backup.type === 'auto' ? 'text-blue-600' : 'text-purple-600'
                    }`} />
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-bold text-slate-800">{backup.filename}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        backup.type === 'auto' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {backup.type === 'auto' ? '🤖 Auto' : '👤 Manual'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        backup.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {backup.status === 'completed' ? '✓ Completed' : '⏳ In Progress'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(backup.timestamp).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-4 h-4" />
                        {backup.size}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {backup.tables} tables
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-4 h-4" />
                        {backup.rows.toLocaleString()} rows
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadBackup(backup)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBackup(backup);
                      setShowConfirmRestore(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-semibold"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showConfirmRestore && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Confirm Database Restore</h2>
              </div>
            </div>

            <div className="p-8">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
                <p className="font-bold text-red-800 mb-4 text-lg">⚠️ WARNING: This action cannot be undone!</p>
                <ul className="space-y-2 text-red-700">
                  <li>✗ All current data will be replaced</li>
                  <li>✗ Any changes made after the backup will be lost</li>
                  <li>✗ This process may take several minutes</li>
                  <li>✗ All users will be temporarily disconnected</li>
                </ul>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <p className="font-semibold text-blue-800 mb-2">Restoring from:</p>
                <p className="text-sm text-blue-700">{selectedBackup.filename}</p>
                <p className="text-sm text-blue-600">Created: {new Date(selectedBackup.timestamp).toLocaleString()}</p>
              </div>

              <p className="text-slate-600 mb-6">
                Before proceeding, we recommend creating a backup of the current database state.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    createBackup();
                    setShowConfirmRestore(false);
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
                >
                  Backup Current State First
                </button>
                <button
                  onClick={() => restoreBackup(selectedBackup)}
                  disabled={isRestoring}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold disabled:opacity-50"
                >
                  {isRestoring ? 'Restoring...' : 'Restore Now'}
                </button>
                <button
                  onClick={() => setShowConfirmRestore(false)}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Important Notes */}
      <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-lg mb-2">Backup Best Practices</h4>
            <ul className="space-y-1 text-blue-100 text-sm">
              <li>• Automated backups run daily at 10:30 AM</li>
              <li>• Download important backups to external storage</li>
              <li>• Test restore process regularly to ensure backup integrity</li>
              <li>• Keep at least 3 recent backups before deleting older ones</li>
              <li>• Always backup before major system updates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseBackupRestore;
