import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';

const REPORT_TYPES = ['Blood Report', 'MRI Scan', 'Ultrasound Scan', 'Current Prescription', 'Other'];
const MAX_SIZE = 15 * 1024 * 1024;

// Upload + list scanned investigation reports (blood work, MRI, ultrasound,
// current prescription) against a patient's case sheet, backed by Firebase
// Storage. `attachments` / `onChange` follow the same controlled-array
// pattern as MedicineTable, so the case sheet's Save button persists them
// as part of the normal form state.
const InvestigationAttachments = ({ patientId, attachments = [], onChange }) => {
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const isAllowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isAllowed) { setError('Only images and PDF files are allowed.'); return; }
    if (file.size > MAX_SIZE) { setError('File is too large (max 15MB).'); return; }

    setError('');
    setUploading(true);
    try {
      const path = `case_sheets/${patientId}/investigations/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      onChange([...attachments, {
        id: `${Date.now()}_${Math.random()}`,
        report_type: reportType,
        name: file.name,
        url,
        path,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        uploaded_by: currentUser.email || '',
      }]);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (att) => {
    if (!window.confirm(`Remove "${att.name}"?`)) return;
    onChange(attachments.filter(a => a.id !== att.id));
    if (att.path) {
      try {
        await deleteObject(ref(storage, att.path));
      } catch (err) {
        console.error('Error deleting file from storage:', err);
      }
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">Scanned Reports</label>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select
          value={reportType}
          onChange={e => setReportType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
        >
          {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className={`flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-medium hover:bg-teal-100 ${uploading ? 'opacity-60' : 'cursor-pointer'}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload File'}
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} disabled={uploading} />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-teal-700 hover:underline truncate min-w-0"
              >
                {att.name?.toLowerCase().endsWith('.pdf')
                  ? <FileText className="w-4 h-4 flex-shrink-0" />
                  : <ImageIcon className="w-4 h-4 flex-shrink-0" />}
                <span className="font-medium flex-shrink-0">{att.report_type}</span>
                <span className="text-gray-400 truncate">— {att.name}</span>
              </a>
              <button type="button" onClick={() => handleRemove(att)} className="text-gray-400 hover:text-red-600 flex-shrink-0 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvestigationAttachments;
