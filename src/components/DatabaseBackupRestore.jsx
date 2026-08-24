import React, { useState, useRef } from 'react';
import {
  Database, Download, Upload, CheckCircle, AlertTriangle, Loader2, FileJson, ShieldAlert,
} from 'lucide-react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Every Firestore collection this app writes to, gathered by grepping the
// codebase for collection()/doc() call sites — there's no Admin SDK here
// (see api/_lib/firebaseAdmin.js) so there's no way to list collections at
// runtime; this list has to be kept in sync by hand as new ones are added.
const COLLECTIONS = [
  'appointments', 'daily_progress', 'diet_plans', 'discharge_summaries', 'discharges',
  'expenses', 'goods_receipt_notes', 'hr_employees', 'hr_leaves', 'hr_payroll',
  'inventory', 'invoices', 'ip_case_sheets', 'leads', 'meal_assignments', 'meal_prices',
  'medicine_sales', 'mess_expenses', 'op_case_sheets', 'op_visit_notes', 'packages',
  'patients', 'purchase_entries', 'purchase_orders', 'purchase_requests', 'sms_logs',
  'user_sessions', 'users', 'vendors',
];

const BACKUP_VERSION = 1;
const BATCH_SIZE = 400; // Firestore's write-batch limit is 500; leave headroom.

const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

const DatabaseBackupRestore = () => {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [lastExport, setLastExport] = useState(null);
  const [exportError, setExportError] = useState('');

  const [restorePreview, setRestorePreview] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    setLastExport(null);
    try {
      const backup = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        exportedBy: JSON.parse(localStorage.getItem('currentUser') || '{}').email || '',
        collections: {},
      };
      let totalDocs = 0;

      for (let i = 0; i < COLLECTIONS.length; i++) {
        const name = COLLECTIONS[i];
        setExportProgress({ current: i + 1, total: COLLECTIONS.length, name });
        const snap = await getDocs(collection(db, name));
        backup.collections[name] = snap.docs.map(d => {
          const data = d.data();
          // Never let password hashes (or un-migrated legacy plaintext) leave
          // the server in a downloadable file.
          if (name === 'users' && 'password' in data) {
            const rest = { ...data };
            delete rest.password;
            return { id: d.id, ...rest };
          }
          return { id: d.id, ...data };
        });
        totalDocs += snap.size;
      }

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tatva-backup-${backup.exportedAt.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExport({ collections: COLLECTIONS.length, documents: totalDocs, at: backup.exportedAt });
    } catch (e) {
      console.error('Backup export failed:', e);
      setExportError(e.message || 'Export failed.');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const resetRestoreState = () => {
    setRestorePreview(null);
    setRestoreResult(null);
    setConfirmChecked(false);
    setFileError('');
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    resetRestoreState();
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.collections || parsed.version !== BACKUP_VERSION) {
        setFileError('This doesn’t look like a Tatva Ayurved backup file (unrecognized format or version).');
        return;
      }
      const summary = Object.entries(parsed.collections)
        .map(([name, docs]) => ({ name, count: Array.isArray(docs) ? docs.length : 0 }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count);
      const totalDocs = summary.reduce((s, c) => s + c.count, 0);
      setRestorePreview({ raw: parsed, summary, totalDocs, exportedAt: parsed.exportedAt, exportedBy: parsed.exportedBy });
    } catch (err) {
      setFileError('Could not read that file: ' + err.message);
    }
  };

  const handleRestore = async () => {
    if (!restorePreview || !confirmChecked || restoring) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      let written = 0;
      const totalDocs = restorePreview.totalDocs;

      for (const { name } of restorePreview.summary) {
        const docs = restorePreview.raw.collections[name] || [];
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(docData => {
            const { id, ...rest } = docData || {};
            if (!id) return;
            // Backups never contain passwords (stripped on export) — never
            // let a restore create/blank one out from under an account.
            if (name === 'users') delete rest.password;
            // merge:true is an upsert, not a wipe-and-replace — restoring an
            // old backup can't delete documents or fields created since it
            // was taken, only add/overwrite what the backup itself contains.
            batch.set(doc(db, name, id), rest, { merge: true });
          });
          await batch.commit();
          written += chunk.length;
          setRestoreProgress({ current: written, total: totalDocs, name });
        }
      }
      setRestoreResult({ success: true, written });
      setConfirmChecked(false);
    } catch (e) {
      console.error('Restore failed:', e);
      setRestoreResult({ success: false, error: e.message });
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Database className="w-6 h-6 text-teal-600" /> Database Backup
        </h1>
        <p className="text-gray-500 text-sm mt-1">Export a full snapshot of all data, or restore from a previously exported file.</p>
      </div>

      {/* ── Export ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
          <Download className="w-5 h-5 text-teal-600" /> Export Backup
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Downloads every collection ({COLLECTIONS.length} in total) as a single JSON file. User account passwords are never included.
        </p>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Download Backup Now'}
        </button>

        {exporting && exportProgress && (
          <p className="text-xs text-gray-500 mt-2">
            Reading {exportProgress.name}… ({exportProgress.current}/{exportProgress.total} collections)
          </p>
        )}

        {exportError && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {exportError}
          </div>
        )}

        {lastExport && (
          <div className="mt-3 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Downloaded {fmt(lastExport.documents)} documents across {lastExport.collections} collections.
          </div>
        )}
      </div>

      {/* ── Restore ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
          <Upload className="w-5 h-5 text-orange-600" /> Restore from Backup
        </h2>
        <div className="flex items-start gap-2 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Restoring writes real data into the live database. Existing records with a matching ID are overwritten
            field-by-field; nothing is ever deleted. Review the summary below carefully before confirming.
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={restoring}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
        >
          <FileJson className="w-4 h-4" /> Choose Backup File…
        </button>

        {fileError && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {fileError}
          </div>
        )}

        {restorePreview && !restoreResult && (
          <div className="mt-4 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-1">
              Backup taken <strong>{restorePreview.exportedAt ? new Date(restorePreview.exportedAt).toLocaleString('en-IN') : 'unknown time'}</strong>
              {restorePreview.exportedBy ? <> by <strong>{restorePreview.exportedBy}</strong></> : null}.
            </p>
            <p className="text-sm text-gray-700 mb-3">
              Will restore <strong>{fmt(restorePreview.totalDocs)}</strong> documents across{' '}
              <strong>{restorePreview.summary.length}</strong> non-empty collections:
            </p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 border-t border-gray-100 pt-2">
              {restorePreview.summary.map(c => (
                <div key={c.name} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="font-medium">{fmt(c.count)}</span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={e => setConfirmChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-orange-600"
              />
              <span className="text-sm text-gray-700">
                I understand this will overwrite existing records in the live database and want to proceed.
              </span>
            </label>

            <button
              onClick={handleRestore}
              disabled={!confirmChecked || restoring}
              className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {restoring ? 'Restoring…' : 'Restore Now'}
            </button>

            {restoring && restoreProgress && (
              <p className="text-xs text-gray-500 mt-2">
                Writing {restoreProgress.name}… ({fmt(restoreProgress.current)}/{fmt(restoreProgress.total)} documents)
              </p>
            )}
          </div>
        )}

        {restoreResult?.success && (
          <div className="mt-4 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> Restored {fmt(restoreResult.written)} documents successfully.
          </div>
        )}
        {restoreResult && !restoreResult.success && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Restore failed partway through: {restoreResult.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseBackupRestore;
