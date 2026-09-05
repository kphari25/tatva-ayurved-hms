import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Pill } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import PrintSectionModal from './PrintSectionModal';
import { formatDateOnly } from '../lib/formatDate';
import { fetchLatestDischargeSummary } from '../lib/dischargeSummary';
import { loadDoctorsList, findDoctorInfo } from '../lib/doctors';

const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Thekkuveedu Lane, Kannur Road, Kozhikode',
  phone: '9895112264, 0495 2766717',
  email: 'info@tatvaayurved.com',
  website: 'www.tatvaayurved.com',
  regNo: 'BFHP03-C110100-00061-2025',
};

const fmtDate = (d) => formatDateOnly(d);

const pad = (n) => String(n).padStart(2, '0');
const todayLabel = () => {
  const d = new Date();
  return formatDateOnly(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
};

// Read-only rollup of the structured medicine tables recorded for this
// patient — OP Visit Log entries for OP patients, IP Daily Progress entries
// for IP patients — printed as a proper Sl/Medicine/Dose/Frequency/
// Instructions/Days prescription instead of a flattened text summary.
const PrescriptionModal = ({ patient, onClose }) => {
  const patientId = patient?.firebaseId || patient?.id;
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
  const isIP = patient?.patient_type === 'IP';
  const [opEntries, setOpEntries] = useState([]); // op_visit_notes with medicine_items
  const [ipEntries, setIpEntries] = useState([]); // daily_progress with medicine_items
  // Advise on Discharge — Internal Medicines from the patient's latest
  // Discharge Summary — kept in sync here so the printed prescription
  // reflects whatever's currently in that table, not a separate,
  // hand-retyped list. Shown on every print regardless of which day is
  // picked below, since it isn't tied to a particular day.
  const [dischargeMedicines, setDischargeMedicines] = useState([]);
  const [dischargeDate, setDischargeDate] = useState('');
  const [complaints, setComplaints] = useState('');
  const [doctorDesignation, setDoctorDesignation] = useState('');
  const [doctorRegistrationNumber, setDoctorRegistrationNumber] = useState('');
  const [printPageSize, setPrintPageSize] = useState('A4');
  const [loading, setLoading] = useState(true);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  // Print preview — in-page iframe printed via its own contentWindow, same
  // pattern as MedicineSaleModal/InvoiceModal/DischargeSummaryModal (see
  // medicineSalePrint.js for why: window.open()+document.write() silently
  // crashes whenever the popup is blocked, since it calls .document on the
  // null it returns — this component was the one place in the app still
  // using that old pattern).
  const [printPreviewHtml, setPrintPreviewHtml] = useState(null);
  const printIframeRef = useRef(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (!patientId) return;
    try {
      setLoading(true);

      const opSnap = await getDocs(query(collection(db, 'op_visit_notes'), where('patient_id', '==', patientId)));
      const opList = opSnap.docs.map(d => d.data()).filter(v => (v.medicine_items || []).some(i => i.item_name));
      opList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setOpEntries(opList);

      const ipSnap = await getDocs(query(collection(db, 'daily_progress'), where('patient_id', '==', patientId)));
      const ipList = ipSnap.docs.map(d => d.data()).filter(v => (v.medicine_items || []).some(i => i.item_name));
      ipList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setIpEntries(ipList);

      const caseSheetSnap = await getDoc(doc(db, isIP ? 'ip_case_sheets' : 'op_case_sheets', patientId));
      if (caseSheetSnap.exists()) {
        const d = caseSheetSnap.data();
        setComplaints(isIP ? (d.history_presenting_complaints || '') : (d.presenting_complaints || ''));
      }

      const latestSummary = await fetchLatestDischargeSummary(patientId);
      if (latestSummary) {
        setDischargeMedicines((latestSummary.discharge_internal_medicines || []).filter(m => m.item_name));
        setDischargeDate(latestSummary.discharge_date || '');
      }

      if (patient?.assigned_doctor) {
        // Tolerant of assigned_doctor carrying a shorter name than the
        // doctor's own record (e.g. "Dr. Satheesh" vs the HR/User
        // Management record's full "Dr. Satheesh Kumar").
        const doctorsList = await loadDoctorsList();
        const match = findDoctorInfo(doctorsList, patient.assigned_doctor);
        if (match) {
          setDoctorDesignation(match.designation || '');
          setDoctorRegistrationNumber(match.registrationNumber || '');
        }
      }
    } catch (e) {
      console.error('Error loading prescription:', e);
    } finally {
      setLoading(false);
    }
  };

  // Every entry (day for IP, visit for OP) shown at a glance here, then a
  // specific one (or all of them) picked when actually printing — OP used
  // to always show/print only the latest visit, silently dropping earlier
  // visits' medicines from the prescription.
  const allEntries = isIP ? ipEntries : opEntries;
  const previewEntries = allEntries;

  const buildPrintHTML = (entries, pageSize = 'A4') => {
    // A5 is roughly half of A4 (148 x 210mm vs 210 x 297mm) — most
    // prescriptions here are short enough to fit on it, so margins shrink
    // to match rather than eating into the smaller page. .print-footer's
    // fixed bottom/left/right must track the same numbers so it still lines
    // up with the page's own margins once pinned to the bottom for print.
    const pageMargin = pageSize === 'A5' ? { v: '10mm', h: '8mm' } : { v: '15mm', h: '12mm' };
    // "Signed By" on the most recent entry that has one is who actually saw
    // the patient for this prescription — a closer match than the patient's
    // general assigned_doctor, which may be unset or belong to someone else.
    // Whichever source it comes from may or may not already include a "Dr."
    // prefix (assigned_doctor is typically stored with one, signed_by is
    // free text and usually isn't), so strip it before we add our own below.
    const attendingDoctor = (entries.find(e => e.signed_by)?.signed_by || patient?.assigned_doctor || '')
      .replace(/^dr\.?\s*/i, '')
      .trim();

    const showDateColumn = entries.length > 1;
    const rows = [];
    entries.forEach(entry => {
      (entry.medicine_items || []).forEach(item => {
        if (!item.item_name) return;
        rows.push({ ...item, date: entry.date });
      });
    });

    const dates = entries.map(e => e.date).filter(Boolean).sort();
    const dateLabel = dates.length === 0 ? ''
      : dates.length === 1 || dates[0] === dates[dates.length - 1] ? fmtDate(dates[dates.length - 1])
      : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;

    const rowsHTML = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        ${showDateColumn ? `<td>${fmtDate(r.date)}</td>` : ''}
        <td>${r.item_name}</td>
        <td>${r.dose || ''}</td>
        <td>${r.frequency || ''}</td>
        <td>${r.instructions || ''}</td>
        <td>${r.days || ''}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Prescription – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding-bottom: 160px; }
    @page { size: ${pageSize}; margin: ${pageMargin.v} ${pageMargin.h}; }
    @media print { body { -webkit-print-color-adjust: exact; } }
    /* Doctor's signature + hospital address stay pinned to the bottom of the
       page as one unit — with only a couple of medicine rows the rest of
       this content is short, and without this it used to land wherever the
       flow happened to end, leaving a big gap below it instead of above it. */
    .print-footer { margin-top: 50px; }
    @media print {
      .print-footer { position: fixed; left: ${pageMargin.h}; right: ${pageMargin.h}; bottom: ${pageMargin.v}; margin-top: 0; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5f4e; padding-bottom: 10px; margin-bottom: 12px; }
    .logo-block { min-width: 160px; }
    .logo-block img { height: 56px; margin-bottom: 4px; }
    .logo-block .brand { font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #1a5f4e; }
    .logo-block .tagline { font-size: 9px; color: #666; }
    .patient-block { font-size: 12px; border-collapse: collapse; margin-left: auto; }
    .patient-block td { padding: 0 0 3px; white-space: nowrap; }
    .patient-block .info-label { font-weight: bold; text-align: left; padding-right: 6px; }
    .patient-block .info-value { text-align: left; }
    .title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin: 4px 0 14px; letter-spacing: 1px; }
    table.grid { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 12px; }
    table.grid th, table.grid td { border: 1px solid #aaa; padding: 6px 8px; text-align: left; vertical-align: top; }
    table.grid th { background: #f0f0f0; font-weight: bold; }
    .section-title { font-weight: bold; font-size: 12px; margin-top: 14px; margin-bottom: 3px; }
    .section-body { font-size: 12px; white-space: pre-line; }
    .sig-block { text-align: right; margin-bottom: 20px; }
    .sig-block .doctor-name { font-weight: bold; }
    .sig-block .reg { font-size: 10px; color: #555; }
    .sig-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; margin-left: auto; }
    .page-footer { text-align: center; font-size: 10px; color: #555; border-top: 1px solid #ddd; padding-top: 8px; }
    .footer-bar { height: 6px; background: #1a5f4e; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-block">
      <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'">
      <div class="brand">TATVA AYURVED</div>
      <div class="tagline">Ayurveda for Health &amp; Happiness</div>
    </div>
    <table class="patient-block">
      <tr><td class="info-label">Name</td><td class="info-value">: ${patientName}</td></tr>
      <tr><td class="info-label">Age &amp; Sex</td><td class="info-value">: ${patient?.age || '—'} yrs, ${patient?.gender || '—'}</td></tr>
      <tr><td class="info-label">MRD No</td><td class="info-value">: ${patient?.mrd_number || patient?.patient_number || '—'}</td></tr>
      ${patient?.ip_number ? `<tr><td class="info-label">IP No</td><td class="info-value">: ${patient.ip_number}</td></tr>` : ''}
      <tr><td class="info-label">Date</td><td class="info-value">: ${dateLabel || todayLabel()}</td></tr>
    </table>
  </div>

  <div class="title">PRESCRIPTION</div>

  <table class="grid">
    <thead>
      <tr>
        <th style="width:36px;">Sl</th>
        ${showDateColumn ? '<th style="width:90px;">Date</th>' : ''}
        <th>Medicine</th>
        <th style="width:110px;">Dose</th>
        <th style="width:110px;">Frequency</th>
        <th>Instructions</th>
        <th style="width:56px;">Days</th>
      </tr>
    </thead>
    <tbody>${rowsHTML || `<tr><td colspan="${showDateColumn ? 7 : 6}" style="text-align:center;color:#888;">No medications recorded</td></tr>`}</tbody>
  </table>

  ${dischargeMedicines.length > 0 ? `
    <div class="section-title">Advised on Discharge${dischargeDate ? ` (${fmtDate(dischargeDate)})` : ''}</div>
    <table class="grid">
      <thead>
        <tr>
          <th style="width:36px;">Sl</th>
          <th>Medicine</th>
          <th style="width:110px;">Dose</th>
          <th style="width:110px;">Frequency</th>
          <th>Instructions</th>
          <th style="width:56px;">Days</th>
        </tr>
      </thead>
      <tbody>
        ${dischargeMedicines.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.item_name}</td>
            <td>${item.dose || ''}</td>
            <td>${item.frequency || ''}</td>
            <td>${item.instructions || ''}</td>
            <td>${item.days || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  ${complaints ? `
    <div class="section-title">Presenting Complaints</div>
    <p class="section-body">${complaints}</p>
  ` : ''}

  <div class="print-footer">
    <div class="sig-block">
      <div class="sig-line"></div>
      ${attendingDoctor ? `<p class="doctor-name" style="margin-top:4px;">Dr. ${attendingDoctor}</p>` : ''}
      ${doctorDesignation ? `<p class="reg">${doctorDesignation}</p>` : ''}
      ${doctorRegistrationNumber ? `<p class="reg">Reg No: ${doctorRegistrationNumber}</p>` : ''}
      <p style="font-size:10px;">Signature of Physician</p>
    </div>
    <div class="page-footer">
      ${HOSPITAL.address} &nbsp;|&nbsp; ${HOSPITAL.phone} &nbsp;|&nbsp; ${HOSPITAL.website}<br>
      Reg No: ${HOSPITAL.regNo}
    </div>
    <div class="footer-bar"></div>
  </div>
</body>
</html>`;
  };

  const printEntries = (entries) => {
    setPrintPreviewHtml(buildPrintHTML(entries, printPageSize));
  };

  const handlePrintFromPreview = () => {
    const win = printIframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  // With more than one entry recorded (day for IP, visit for OP), offer
  // "All Pages" (everything combined) or a specific one, reusing the same
  // picker used by the OP/IP case sheets.
  const handlePrintClick = () => {
    if (allEntries.length > 1) {
      setShowPrintOptions(true);
    } else {
      printEntries(allEntries);
    }
  };

  const handlePickSection = (sectionId) => {
    if (sectionId === 'all') {
      printEntries(allEntries);
    } else {
      printEntries(allEntries.filter(e => e.date === sectionId));
    }
  };

  // A day/visit can have more than one entry (e.g. a morning and an evening
  // IP note) — collapse to one picker option per distinct date, since
  // "print this one" already combines every entry recorded on it.
  const daySections = [...new Set(allEntries.map(e => e.date))].map(date => ({ id: date, label: fmtDate(date) }));

  return (
    <>
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
            <div className="flex items-center bg-teal-700 rounded-lg p-0.5 text-xs font-medium" title="Paper size for printing">
              {['A4', 'A5'].map(size => (
                <button
                  key={size}
                  onClick={() => setPrintPageSize(size)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${printPageSize === size ? 'bg-white text-teal-700' : 'text-teal-100 hover:bg-teal-600'}`}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              onClick={handlePrintClick}
              disabled={loading}
              title={loading ? 'Still loading the doctor\'s details…' : undefined}
              className="flex items-center gap-1 px-3 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="hover:bg-teal-700 p-2 rounded"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-xs text-gray-500 mb-4">
            {isIP
              ? 'Automatically compiled from the Medication table entered in IP Daily Progress. Choose which day (or all days) to print above.'
              : 'Automatically compiled from the Medication table entered in every OP Visit Log entry. Choose which visit (or all visits) to print above.'}
          </p>

          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading prescription…</div>
          ) : previewEntries.length === 0 && dischargeMedicines.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              No medications recorded yet. Add a Medication table entry in {isIP ? 'IP Daily Progress' : "the OP case sheet's Visit Log"}.
            </div>
          ) : (
            <div className="space-y-4">
              {previewEntries.map((entry, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-700">{isIP ? 'IP Daily Progress' : 'OP Visit Log'}</span>
                    {entry.date && <span className="text-xs text-gray-500">{fmtDate(entry.date)}</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Dose</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Instructions</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase w-16">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(entry.medicine_items || []).filter(i => i.item_name).map((item, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-1.5 text-gray-800 font-medium">{item.item_name}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.dose}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.frequency}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.instructions}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {dischargeMedicines.length > 0 && (
                <div className="border border-teal-200 rounded-xl overflow-hidden">
                  <div className="bg-teal-50 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-700">Advised on Discharge</span>
                    {dischargeDate && <span className="text-xs text-gray-500">{fmtDate(dischargeDate)}</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Dose</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase">Instructions</th>
                          <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase w-16">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dischargeMedicines.map((item, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-1.5 text-gray-800 font-medium">{item.item_name}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.dose}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.frequency}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.instructions}</td>
                            <td className="px-3 py-1.5 text-gray-700">{item.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPrintOptions && (
        <PrintSectionModal
          title="Print Prescription"
          sections={daySections}
          onPrint={handlePickSection}
          onClose={() => setShowPrintOptions(false)}
        />
      )}
    </div>

    {printPreviewHtml && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
          <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
            <div>
              <h2 className="text-xl font-bold">Print Preview</h2>
              <p className="text-teal-100 text-sm">{patientName} · {printPageSize} paper</p>
            </div>
            <button onClick={() => setPrintPreviewHtml(null)} className="hover:bg-teal-700 p-2 rounded">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-end bg-gray-50">
            <button
              onClick={handlePrintFromPreview}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center">
            <iframe
              ref={printIframeRef}
              title="Prescription print preview"
              srcDoc={printPreviewHtml}
              // Matches the old auto-print-on-open behavior — fires once the
              // preview has finished rendering, with the header button above
              // still there for a manual re-print.
              onLoad={handlePrintFromPreview}
              className="bg-white shadow-lg"
              style={printPageSize === 'A5'
                ? { width: '559px', minHeight: '794px', border: 'none' }
                : { width: '794px', minHeight: '1123px', border: 'none' }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PrescriptionModal;
