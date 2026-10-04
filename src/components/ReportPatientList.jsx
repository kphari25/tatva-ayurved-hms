import React, { useMemo, useState } from 'react';
import { X, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtVisit = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Drill-down list behind a report count. Clicking a patient opens their
// details in Patient Portal (the same 'viewPatient' jump the Dashboard uses).
const ReportPatientList = ({ title, subtitle, rows, onClose }) => {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => [r.name, r.mrd, r.ip, r.phone, r.doctor].some(v => String(v || '').toLowerCase().includes(s)));
  }, [rows, q]);

  const openPatient = (id) => {
    onClose();
    window.dispatchEvent(new CustomEvent('viewPatient', { detail: id }));
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(shown.map(r => ({
      Patient: r.name, MRD: r.mrd, 'IP No': r.ip, Phone: r.phone, Type: r.type, 'New / Return': r.kind,
      Category: r.category, PNC: r.pnc ? 'Yes' : '', Doctor: r.doctor,
      Registered: r.registered ? new Date(r.registered).toLocaleDateString('en-IN') : '', 'Last Visit': r.lastVisit,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    XLSX.writeFile(wb, `${title.replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500">{subtitle} · {rows.length} patient{rows.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name, MRD, phone, doctor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['Patient', 'MRD / IP', 'Type', 'New / Return', 'Category', 'Doctor', 'Registered', 'Last Visit', 'Phone'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No patients.</td></tr>
              ) : shown.map(r => (
                <tr key={r.id} onClick={() => openPatient(r.id)} className="hover:bg-teal-50 cursor-pointer" title="Open patient details">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.mrd || '—'}{r.ip && <span className="text-gray-400"> · {r.ip}</span>}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'IP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{r.type}</span></td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.kind === 'New' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.kind}</span></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {r.pnc ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700" title={r.pncSource === 'category' ? 'Marked PNC' : 'PNC found in diagnosis'}>PNC</span> : <span className="text-gray-500">{r.category}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{r.doctor}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(r.registered)}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtVisit(r.lastVisit)}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-6 py-2 text-xs text-gray-400 border-t border-gray-100">Click a patient to open their details.</p>
      </div>
    </div>
  );
};

export default ReportPatientList;
