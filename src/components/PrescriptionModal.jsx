import React, { useState, useEffect } from 'react';
import { X, Printer, Pill } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Thekkuveedu Lane, Kannur Road, Kozhikode',
  phone: '9895112264, 0495 2766717',
  email: 'info@tatvaayurved.com',
  website: 'www.tatvaayurved.com',
  regNo: 'BFHP03-C110100-00061-2025',
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Read-only rollup of every Medication Details entry recorded for this patient across
// the OP case sheet, OP visit log, IP case sheet, and IP daily progress — so the
// prescription never needs to be typed out separately from the clinical notes.
const PrescriptionModal = ({ patient, onClose }) => {
  const patientId = patient?.firebaseId || patient?.id;
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrescription();
  }, []);

  const loadPrescription = async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const items = [];

      const opCaseSnap = await getDoc(doc(db, 'op_case_sheets', patientId));
      if (opCaseSnap.exists()) {
        const d = opCaseSnap.data();
        if (d.medication_details) items.push({ source: 'OP Case Sheet', date: d.case_date, text: d.medication_details });
      }

      const opVisitsSnap = await getDocs(query(collection(db, 'op_visit_notes'), where('patient_id', '==', patientId)));
      opVisitsSnap.docs.forEach(docSnap => {
        const v = docSnap.data();
        if (v.medication_notes) items.push({ source: 'OP Visit Log', date: v.date, text: v.medication_notes });
      });

      const ipCaseSnap = await getDoc(doc(db, 'ip_case_sheets', patientId));
      if (ipCaseSnap.exists()) {
        const d = ipCaseSnap.data();
        if (d.medication_details) items.push({ source: 'IP Case Sheet', date: d.case_sheet_date, text: d.medication_details });
      }

      const dailySnap = await getDocs(query(collection(db, 'daily_progress'), where('patient_id', '==', patientId)));
      dailySnap.docs.forEach(docSnap => {
        const v = docSnap.data();
        if (v.medicines_given) items.push({ source: 'IP Daily Progress', date: v.date, text: v.medicines_given });
      });

      items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setEntries(items);
    } catch (e) {
      console.error('Error loading prescription:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const rows = entries.map(e => `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td>${e.source}</td>
        <td style="white-space:pre-line;">${e.text}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Prescription – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
    @page { size: A4; margin: 15mm 12mm; }
    @media print { body { -webkit-print-color-adjust: exact; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5f4e; padding-bottom: 10px; margin-bottom: 10px; }
    .logo-block { background: #1a5f4e; color: #fff; padding: 10px 16px; border-radius: 4px; min-width: 160px; }
    .logo-block .brand { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
    .logo-block .tagline { font-size: 9px; color: #a8d8c8; }
    .contact-block { text-align: right; font-size: 10px; line-height: 1.6; }
    .contact-block .reg { font-size: 9px; color: #555; }
    .title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin: 10px 0 14px; letter-spacing: 1px; }
    .info-row { display: flex; gap: 4px; margin-bottom: 4px; font-size: 12px; }
    .info-label { font-weight: bold; min-width: 100px; }
    table.grid { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12px; }
    table.grid th, table.grid td { border: 1px solid #aaa; padding: 6px 8px; text-align: left; vertical-align: top; }
    table.grid th { background: #f0f0f0; font-weight: bold; }
    .footer { margin-top: 40px; display: flex; justify-content: flex-end; }
    .sig-block { text-align: right; }
    .sig-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; margin-left: auto; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-block">
      <div class="brand">TATVA AYURVED</div>
      <div class="tagline">Ayurveda for Health &amp; Happiness</div>
    </div>
    <div class="contact-block">
      📍 ${HOSPITAL.address}<br>
      📞 ${HOSPITAL.phone}<br>
      ✉ ${HOSPITAL.email}<br>
      🌐 ${HOSPITAL.website}<br>
      <span class="reg">Reg No: ${HOSPITAL.regNo}</span>
    </div>
  </div>

  <div class="title">PRESCRIPTION</div>

  <div class="info-row"><span class="info-label">Name of Patient:</span> ${patientName}</div>
  <div class="info-row"><span class="info-label">MRD No:</span> ${patient?.mrd_number || ''}</div>
  ${patient?.ip_number ? `<div class="info-row"><span class="info-label">IP No:</span> ${patient.ip_number}</div>` : ''}
  <div class="info-row"><span class="info-label">Date:</span> ${fmtDate(new Date().toISOString())}</div>

  <table class="grid">
    <thead><tr><th style="width:100px;">Date</th><th style="width:130px;">Source</th><th>Medication</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#888;">No medications recorded</td></tr>'}</tbody>
  </table>

  <div class="footer">
    <div class="sig-block">
      <div class="sig-line"></div>
      <p style="font-size:10px;margin-top:4px;">Signature of Physician</p>
    </div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <Pill className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Prescription</h2>
              <p className="text-teal-100 text-sm">
                {patientName}
                {patient?.mrd_number && <span className="ml-2 font-mono">{patient.mrd_number}</span>}
                {patient?.ip_number && <span className="ml-2 font-mono">{patient.ip_number}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-xs text-gray-500 mb-4">
            Automatically compiled from Medication Details entered in the OP case sheet, OP visit log, IP case sheet, and IP daily progress — nothing to enter here.
          </p>

          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading prescription…</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              No medications recorded yet. Add Medication Details in the OP/IP case sheet, visit log, or daily progress.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((e, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{e.source}</span>
                    {e.date && <span className="text-xs text-gray-500">{fmtDate(e.date)}</span>}
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{e.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;
