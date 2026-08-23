import React, { useState, useEffect } from 'react';
import {
  Users, IndianRupee, Calendar, Award, TrendingUp, Download, Plus,
  Edit, Trash2, Eye, EyeOff, Lock, Shield, AlertCircle, CheckCircle,
  CreditCard, FileText, Search, Filter, UserCheck, Clock, Briefcase,
  Phone, Mail, MapPin, ChevronDown, ChevronUp, X, Save,
  Palmtree, HeartPulse, Receipt, BarChart3, BookOpen
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from 'firebase/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'payroll',   label: 'Payroll',   icon: IndianRupee },
  { id: 'leave',     label: 'Leave & PTO', icon: Palmtree },
  { id: 'attendance',label: 'Attendance', icon: Clock },
  { id: 'documents', label: 'Documents',  icon: FileText },
  { id: 'reports',   label: 'Reports',    icon: BarChart3 },
];

const DEPARTMENTS = ['Front Office', 'Therapy', 'Medical', 'Pharmacy', 'Kitchen', 'Administration', 'Housekeeping', 'Accounts'];
const ROLES       = ['Doctor', 'Therapist', 'Front Desk', 'Pharmacist', 'Kitchen Staff', 'Administrator', 'Housekeeper', 'Accountant', 'Nurse'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Compensatory Off', 'Loss of Pay'];
const LEAVE_STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const todayStr = () => new Date().toISOString().split('T')[0];
const currentMonth = () => new Date().toISOString().slice(0, 7);

// India statutory: PF = 12% of basic (employee), ESI = 0.75% of gross if gross ≤ 21000
const calcPayroll = (emp) => {
  const basic      = parseFloat(emp.basicSalary) || 0;
  const hra        = parseFloat(emp.hra) || 0;
  const ta         = parseFloat(emp.travelAllowance) || 0;
  const medical    = parseFloat(emp.medicalAllowance) || 0;
  const special    = parseFloat(emp.specialAllowance) || 0;
  const gross      = basic + hra + ta + medical + special;
  const pfEmployee = Math.round(basic * 0.12);
  const pfEmployer = Math.round(basic * 0.12);
  const esi        = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const esiEmployer= gross <= 21000 ? Math.round(gross * 0.0325) : 0;
  const tds        = parseFloat(emp.tds) || 0;
  const otherDeductions = parseFloat(emp.otherDeductions) || 0;
  const totalDeductions = pfEmployee + esi + tds + otherDeductions;
  const netSalary  = gross - totalDeductions;
  const ctc        = gross + pfEmployer + esiEmployer;
  return { basic, hra, ta, medical, special, gross, pfEmployee, pfEmployer, esi, esiEmployer, tds, otherDeductions, totalDeductions, netSalary, ctc };
};

// ─── Empty Employee Template ──────────────────────────────────────────────────
const emptyEmployee = () => ({
  employeeId: '',
  name: '',
  email: '',
  phone: '',
  altPhone: '',
  dateOfBirth: '',
  gender: '',
  bloodGroup: '',
  maritalStatus: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  department: '',
  role: '',
  designation: '',
  dateOfJoining: todayStr(),
  employmentType: 'Full-time',
  reportingManager: '',
  qualification: '',
  isDoctor: false,
  registrationNumber: '',
  experience: '',
  pan: '',
  aadhaar: '',
  uan: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  basicSalary: '',
  hra: '',
  travelAllowance: '',
  medicalAllowance: '',
  specialAllowance: '',
  tds: '',
  otherDeductions: '',
  ptoBalance: { casual: 12, sick: 12, earned: 15 },
  isActive: true,
  notes: '',
});

// ─── Employee Modal ───────────────────────────────────────────────────────────
const EmployeeModal = ({ employee, onClose, onSave }) => {
  const [form, setForm] = useState(employee ? { ...employee } : emptyEmployee());
  const [section, setSection] = useState('personal');
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.employeeId.trim()) {
      alert('Employee name and ID are required.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      alert('Error saving: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'personal',   label: 'Personal' },
    { id: 'employment', label: 'Employment' },
    { id: 'salary',     label: 'Salary & CTC' },
    { id: 'statutory',  label: 'Statutory & Bank' },
    { id: 'emergency',  label: 'Emergency' },
  ];

  const p = calcPayroll(form);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">{employee ? 'Edit Employee' : 'Add Employee'}</h2>
            <p className="text-purple-100 text-xs mt-0.5">Complete all sections for accurate HR records</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b shrink-0 overflow-x-auto">
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${section === s.id ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">

          {section === 'personal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name *" value={form.name} onChange={v => set('name', v)} />
                <Field label="Employee ID *" value={form.employeeId} onChange={v => set('employeeId', v)} placeholder="EMP-001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
                <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} type="tel" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Date of Birth" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} type="date" />
                <SelectField label="Gender" value={form.gender} onChange={v => set('gender', v)}
                  options={['Male', 'Female', 'Other']} />
                <SelectField label="Blood Group" value={form.bloodGroup} onChange={v => set('bloodGroup', v)}
                  options={BLOOD_GROUPS} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Marital Status" value={form.maritalStatus} onChange={v => set('maritalStatus', v)}
                  options={['Single', 'Married', 'Widowed', 'Divorced']} />
                <Field label="Alternate Phone" value={form.altPhone} onChange={v => set('altPhone', v)} type="tel" />
              </div>
              <Field label="Address" value={form.address} onChange={v => set('address', v)} />
              <div className="grid grid-cols-3 gap-4">
                <Field label="City" value={form.city} onChange={v => set('city', v)} />
                <Field label="State" value={form.state} onChange={v => set('state', v)} />
                <Field label="PIN Code" value={form.pincode} onChange={v => set('pincode', v)} />
              </div>
              <Field label="Qualification" value={form.qualification} onChange={v => set('qualification', v)} placeholder="BAMS, B.Sc Nursing…" />

              <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="isDoctor" checked={!!form.isDoctor}
                    onChange={e => set('isDoctor', e.target.checked)} className="w-4 h-4 accent-teal-600" />
                  <label htmlFor="isDoctor" className="text-sm font-medium text-gray-700">This employee is a Doctor</label>
                </div>
                {form.isDoctor && (
                  <div className="mt-3">
                    <Field label="Registration Number *" value={form.registrationNumber} onChange={v => set('registrationNumber', v)}
                      placeholder="Medical council registration no." />
                    <p className="text-xs text-gray-500 mt-1">Printed on prescriptions alongside the doctor's name and qualification.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'employment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Department" value={form.department} onChange={v => set('department', v)} options={DEPARTMENTS} />
                <SelectField label="Role" value={form.role} onChange={v => set('role', v)} options={ROLES} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Designation" value={form.designation} onChange={v => set('designation', v)} placeholder="Senior Therapist…" />
                <Field label="Reporting Manager" value={form.reportingManager} onChange={v => set('reportingManager', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date of Joining *" value={form.dateOfJoining} onChange={v => set('dateOfJoining', v)} type="date" />
                <SelectField label="Employment Type" value={form.employmentType} onChange={v => set('employmentType', v)}
                  options={['Full-time', 'Part-time', 'Contract', 'Internship', 'Consultant']} />
              </div>
              <Field label="Prior Experience" value={form.experience} onChange={v => set('experience', v)} placeholder="3 years at XYZ Clinic…" />

              {/* PTO Balance */}
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm font-bold text-green-800 mb-3">Leave Balance (days/year)</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: 'casual', label: 'Casual Leave' },
                    { key: 'sick',   label: 'Sick Leave' },
                    { key: 'earned', label: 'Earned Leave' },
                  ].map(lt => (
                    <div key={lt.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{lt.label}</label>
                      <input type="number" value={form.ptoBalance?.[lt.key] ?? 0}
                        onChange={e => set('ptoBalance', { ...form.ptoBalance, [lt.key]: parseInt(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={form.isActive}
                  onChange={e => set('isActive', e.target.checked)} className="w-4 h-4 accent-purple-600" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Employee is active</label>
              </div>
              <Field label="Notes" value={form.notes} onChange={v => set('notes', v)} placeholder="Additional HR notes…" />
            </div>
          )}

          {section === 'salary' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                Enter monthly amounts in ₹. PF (12% of Basic) and ESI (0.75% of Gross if ≤ ₹21,000) are auto-calculated per Indian statutory rules.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Basic Salary (₹)" value={form.basicSalary} onChange={v => set('basicSalary', v)} type="number" placeholder="0" />
                <Field label="HRA (₹)" value={form.hra} onChange={v => set('hra', v)} type="number" placeholder="0" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Travel Allowance (₹)" value={form.travelAllowance} onChange={v => set('travelAllowance', v)} type="number" placeholder="0" />
                <Field label="Medical Allowance (₹)" value={form.medicalAllowance} onChange={v => set('medicalAllowance', v)} type="number" placeholder="0" />
                <Field label="Special Allowance (₹)" value={form.specialAllowance} onChange={v => set('specialAllowance', v)} type="number" placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="TDS / Income Tax (₹)" value={form.tds} onChange={v => set('tds', v)} type="number" placeholder="0" />
                <Field label="Other Deductions (₹)" value={form.otherDeductions} onChange={v => set('otherDeductions', v)} type="number" placeholder="Loan EMI, advance…" />
              </div>

              {/* Live CTC breakdown */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-bold text-purple-800 mb-3">Live CTC Breakdown</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Row label="Basic Salary" val={p.basic} />
                  <Row label="HRA" val={p.hra} />
                  <Row label="Travel Allowance" val={p.ta} />
                  <Row label="Medical Allowance" val={p.medical} />
                  <Row label="Special Allowance" val={p.special} />
                  <Row label="Gross Salary" val={p.gross} bold />
                </div>
                <div className="border-t border-purple-200 my-2"></div>
                <p className="font-semibold text-red-700 text-xs">Deductions</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Row label="PF (Employee 12%)" val={p.pfEmployee} neg />
                  <Row label="ESI (Employee 0.75%)" val={p.esi} neg note={p.gross > 21000 ? 'Not applicable' : ''} />
                  <Row label="TDS" val={p.tds} neg />
                  <Row label="Other Deductions" val={p.otherDeductions} neg />
                </div>
                <div className="border-t border-purple-200 my-2"></div>
                <div className="flex justify-between font-bold text-base text-purple-800">
                  <span>Net Take-Home</span><span>₹{p.netSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t border-purple-200 my-2"></div>
                <p className="font-semibold text-blue-700 text-xs">Employer Contributions (CTC)</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Row label="PF Employer (12%)" val={p.pfEmployer} />
                  <Row label="ESI Employer (3.25%)" val={p.esiEmployer} note={p.gross > 21000 ? 'N/A' : ''} />
                </div>
                <div className="flex justify-between font-bold text-blue-700 mt-1">
                  <span>Total CTC / Month</span><span>₹{p.ctc.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-blue-800 text-sm">
                  <span>Annual CTC</span><span>₹{(p.ctc * 12).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {section === 'statutory' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                Statutory IDs and bank details are confidential. Ensure accuracy for compliance.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="PAN Number" value={form.pan} onChange={v => set('pan', v.toUpperCase())} placeholder="ABCDE1234F" />
                <Field label="Aadhaar Number" value={form.aadhaar} onChange={v => set('aadhaar', v)} placeholder="XXXX XXXX XXXX" />
              </div>
              <Field label="UAN (Universal Account Number)" value={form.uan} onChange={v => set('uan', v)} placeholder="For PF tracking" />
              <div className="border-t pt-4">
                <p className="text-sm font-bold text-gray-700 mb-3">Bank Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name" value={form.bankName} onChange={v => set('bankName', v)} />
                  <Field label="Account Number" value={form.accountNumber} onChange={v => set('accountNumber', v)} />
                </div>
                <Field label="IFSC Code" value={form.ifsc} onChange={v => set('ifsc', v.toUpperCase())} placeholder="SBIN0001234" />
              </div>
            </div>
          )}

          {section === 'emergency' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact Name" value={form.emergencyContactName} onChange={v => set('emergencyContactName', v)} />
                <Field label="Relation" value={form.emergencyContactRelation} onChange={v => set('emergencyContactRelation', v)} placeholder="Spouse, Parent…" />
              </div>
              <Field label="Contact Phone" value={form.emergencyContactPhone} onChange={v => set('emergencyContactPhone', v)} type="tel" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex gap-2">
            {sections.map((s, i) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-2 h-2 rounded-full transition-colors ${section === s.id ? 'bg-purple-600' : 'bg-gray-300'}`} />
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Small helpers ─────────────────────────────────────────────────────────────
const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const Row = ({ label, val, neg, bold, note }) => (
  <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
    <span className="text-gray-600">{label}{note ? <span className="text-[10px] text-gray-400 ml-1">({note})</span> : ''}</span>
    <span className={neg ? 'text-red-600' : 'text-gray-800'}>
      {neg ? '-' : ''}₹{(val || 0).toLocaleString('en-IN')}
    </span>
  </div>
);

// ─── Leave Request Modal ───────────────────────────────────────────────────────
const LeaveModal = ({ employees, onClose, onSave, existing }) => {
  const [form, setForm] = useState(existing || {
    employeeId: '',
    leaveType: '',
    fromDate: todayStr(),
    toDate: todayStr(),
    reason: '',
    status: 'pending',
  });
  const [saving, setSaving] = useState(false);

  const days = form.fromDate && form.toDate
    ? Math.max(1, Math.round((new Date(form.toDate) - new Date(form.fromDate)) / 86400000) + 1)
    : 0;

  const handleSave = async () => {
    if (!form.employeeId || !form.leaveType || !form.fromDate || !form.toDate) {
      alert('All fields are required.'); return;
    }
    setSaving(true);
    try { await onSave({ ...form, days }); onClose(); }
    catch (e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="font-bold">{existing ? 'Edit Leave' : 'Apply / Record Leave'}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Employee</label>
            <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>)}
            </select>
          </div>
          <SelectField label="Leave Type" value={form.leaveType} onChange={v => setForm({ ...form, leaveType: v })} options={LEAVE_TYPES} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="From Date" value={form.fromDate} onChange={v => setForm({ ...form, fromDate: v })} type="date" />
            <Field label="To Date" value={form.toDate} onChange={v => setForm({ ...form, toDate: v })} type="date" />
          </div>
          {days > 0 && <p className="text-sm text-green-700 font-semibold">{days} day{days > 1 ? 's' : ''} of leave</p>}
          <Field label="Reason" value={form.reason} onChange={v => setForm({ ...form, reason: v })} />
          <SelectField label="Status" value={form.status} onChange={v => setForm({ ...form, status: v })}
            options={['pending', 'approved', 'rejected']} />
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const HRPayrollModule = ({ userRole, currentUser }) => {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editLeave, setEditLeave] = useState(null);
  const [showSalary, setShowSalary] = useState({});

  // Payroll run state
  const [payrollMonth, setPayrollMonth] = useState(currentMonth());

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [empSnap, leaveSnap, paySnap] = await Promise.all([
        getDocs(collection(db, 'hr_employees')),
        getDocs(collection(db, 'hr_leaves')),
        getDocs(collection(db, 'hr_payroll')),
      ]);
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLeaves(leaveSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPayrollHistory(paySnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('HR load error', e);
      // Use sample data if Firebase fails
      setEmployees(SAMPLE_EMPLOYEES);
    } finally {
      setLoading(false);
    }
  };

  const saveEmployee = async (form) => {
    const data = { ...form, updatedAt: new Date().toISOString() };
    if (editEmp?.id) {
      await updateDoc(doc(db, 'hr_employees', editEmp.id), data);
      setEmployees(prev => prev.map(e => e.id === editEmp.id ? { ...data, id: editEmp.id } : e));
    } else {
      data.createdAt = new Date().toISOString();
      const ref = await addDoc(collection(db, 'hr_employees'), data);
      setEmployees(prev => [...prev, { ...data, id: ref.id }]);
    }
  };

  const deleteEmployee = async (id) => {
    if (!window.confirm('Remove this employee record?')) return;
    await deleteDoc(doc(db, 'hr_employees', id));
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const saveLeave = async (form) => {
    const data = { ...form, updatedAt: new Date().toISOString() };
    if (editLeave?.id) {
      await updateDoc(doc(db, 'hr_leaves', editLeave.id), data);
      setLeaves(prev => prev.map(l => l.id === editLeave.id ? { ...data, id: editLeave.id } : l));
    } else {
      data.createdAt = new Date().toISOString();
      const ref = await addDoc(collection(db, 'hr_leaves'), data);
      setLeaves(prev => [...prev, { ...data, id: ref.id }]);
    }
  };

  const runPayroll = async () => {
    if (!window.confirm(`Run payroll for ${payrollMonth}? This will create payslips for all active employees.`)) return;
    const existing = payrollHistory.filter(p => p.month === payrollMonth);
    const activeEmps = employees.filter(e => e.isActive);
    const newEntries = [];
    for (const emp of activeEmps) {
      if (existing.find(p => p.employeeId === emp.id)) continue;
      const p = calcPayroll(emp);
      const entry = {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeId,
        month: payrollMonth,
        ...p,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      try {
        const ref = await addDoc(collection(db, 'hr_payroll'), entry);
        newEntries.push({ ...entry, id: ref.id });
      } catch { newEntries.push({ ...entry, id: Date.now() + Math.random() }); }
    }
    setPayrollHistory(prev => [...prev, ...newEntries]);
    alert(`Payroll run complete! ${newEntries.length} payslips generated for ${payrollMonth}.`);
  };

  const markPaid = async (payId) => {
    const data = { status: 'paid', paidOn: todayStr() };
    try { await updateDoc(doc(db, 'hr_payroll', payId), data); } catch {}
    setPayrollHistory(prev => prev.map(p => p.id === payId ? { ...p, ...data } : p));
  };

  const filteredEmployees = employees.filter(e =>
    `${e.name} ${e.employeeId} ${e.role} ${e.department}`.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const active = employees.filter(e => e.isActive);
  const totalGross = active.reduce((s, e) => s + (calcPayroll(e).gross), 0);
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const thisMonthPayroll = payrollHistory.filter(p => p.month === currentMonth() && p.status === 'paid')
    .reduce((s, p) => s + (p.netSalary || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">HR & Payroll</h1>
            <p className="text-gray-500 text-sm">Manage employees, salary, leave, and compliance</p>
          </div>
          <div className="flex gap-3">
            {tab === 'employees' && (
              <button onClick={() => { setEditEmp(null); setShowEmpModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-sm shadow">
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            )}
            {tab === 'leave' && (
              <button onClick={() => { setEditLeave(null); setShowLeaveModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm shadow">
                <Plus className="w-4 h-4" /> Record Leave
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[
          { label: 'Active Employees', val: active.length, icon: Users, color: 'blue' },
          { label: 'Monthly Gross Payroll', val: `₹${totalGross.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'purple' },
          { label: 'Paid This Month', val: `₹${thisMonthPayroll.toLocaleString('en-IN')}`, icon: CheckCircle, color: 'green' },
          { label: 'Pending Leave Requests', val: pendingLeaves, icon: Palmtree, color: 'amber' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 bg-${s.color}-100 rounded-xl flex items-center justify-center`}>
              <s.icon className={`w-6 h-6 text-${s.color}-600`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-gray-800">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-6">
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4">

        {/* ── Employees Tab ── */}
        {tab === 'employees' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, ID, role, department…"
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <span className="text-sm text-gray-500">{filteredEmployees.length} employees</span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading…</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Employee', 'Role / Dept', 'Contact', 'Joined', 'CTC / Month', 'PTO Balance', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEmployees.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-400">No employees found. Click "Add Employee" to get started.</td></tr>
                    ) : filteredEmployees.map(emp => {
                      const p = calcPayroll(emp);
                      return (
                        <tr key={emp.id} className="hover:bg-purple-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                                {emp.name?.[0] || '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{emp.name}</p>
                                <p className="text-xs text-gray-400">{emp.employeeId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{emp.role || '—'}</p>
                            <p className="text-xs text-gray-500">{emp.department || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700">{emp.email || '—'}</p>
                            <p className="text-xs text-gray-500">{emp.phone || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setShowSalary(s => ({ ...s, [emp.id]: !s[emp.id] }))}>
                                {showSalary[emp.id] ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                              </button>
                              {showSalary[emp.id]
                                ? <span className="font-bold text-purple-700">₹{p.ctc.toLocaleString('en-IN')}</span>
                                : <span className="text-gray-400 text-xs">••••••</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs space-y-0.5">
                              <span className="inline-block bg-green-100 text-green-700 px-1.5 py-0.5 rounded mr-1">CL:{emp.ptoBalance?.casual ?? 12}</span>
                              <span className="inline-block bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1">SL:{emp.ptoBalance?.sick ?? 12}</span>
                              <span className="inline-block bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">EL:{emp.ptoBalance?.earned ?? 15}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {emp.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditEmp(emp); setShowEmpModal(true); }}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => deleteEmployee(emp.id)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Payroll Tab ── */}
        {tab === 'payroll' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Payroll Month</label>
                <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <button onClick={runPayroll}
                className="mt-5 flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-sm shadow">
                <IndianRupee className="w-4 h-4" /> Run Payroll for {payrollMonth}
              </button>
            </div>

            {/* Payroll for selected month */}
            {(() => {
              const monthEntries = payrollHistory.filter(p => p.month === payrollMonth);
              if (monthEntries.length === 0) {
                return (
                  <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
                    No payroll run for {payrollMonth}. Click "Run Payroll" above.
                  </div>
                );
              }
              const totalNet = monthEntries.reduce((s, p) => s + (p.netSalary || 0), 0);
              const paid = monthEntries.filter(p => p.status === 'paid').length;
              return (
                <div>
                  <div className="flex gap-4 mb-4 text-sm">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">{monthEntries.length} employees</span>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">{paid} paid</span>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">Total Net: ₹{totalNet.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {['Employee', 'Gross', 'PF (Emp)', 'ESI', 'TDS', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {monthEntries.map(entry => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800">{entry.employeeName}</p>
                              <p className="text-xs text-gray-400">{entry.employeeCode}</p>
                            </td>
                            <td className="px-4 py-3 font-medium">₹{(entry.gross||0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-red-600">₹{(entry.pfEmployee||0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-red-600">₹{(entry.esi||0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-red-600">₹{(entry.tds||0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-red-600">₹{(entry.totalDeductions||0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 font-bold text-purple-700">₹{(entry.netSalary||0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${entry.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {entry.status === 'paid' ? '✓ Paid' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {entry.status !== 'paid' && (
                                <button onClick={() => markPaid(entry.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold">
                                  Mark Paid
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Leave Tab ── */}
        {tab === 'leave' && (
          <div>
            {/* Leave summary per employee */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {active.map(emp => {
                const empLeaves = leaves.filter(l => l.employeeId === emp.id && l.status === 'approved');
                const used = { casual: 0, sick: 0, earned: 0 };
                empLeaves.forEach(l => {
                  if (l.leaveType === 'Casual Leave') used.casual += l.days || 1;
                  else if (l.leaveType === 'Sick Leave') used.sick += l.days || 1;
                  else if (l.leaveType === 'Earned Leave') used.earned += l.days || 1;
                });
                const bal = emp.ptoBalance || { casual: 12, sick: 12, earned: 15 };
                return (
                  <div key={emp.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                          {emp.name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.role}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        { label: 'Casual', total: bal.casual, used: used.casual, color: 'green' },
                        { label: 'Sick', total: bal.sick, used: used.sick, color: 'blue' },
                        { label: 'Earned', total: bal.earned, used: used.earned, color: 'orange' },
                      ].map(lt => (
                        <div key={lt.label} className={`bg-${lt.color}-50 rounded-lg p-2`}>
                          <p className={`text-${lt.color}-700 font-semibold`}>{lt.label}</p>
                          <p className="text-gray-600">{lt.total - lt.used}/{lt.total} left</p>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div className={`bg-${lt.color}-500 h-1 rounded-full`}
                              style={{ width: `${Math.min(100, (lt.used / lt.total) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leave requests table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="font-semibold text-gray-800">Leave Requests</p>
                <button onClick={() => { setEditLeave(null); setShowLeaveModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {leaves.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No leave records yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaves.map(l => {
                      const emp = employees.find(e => e.id === l.employeeId);
                      return (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{emp?.name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{l.leaveType}</td>
                          <td className="px-4 py-3 text-gray-600">{l.fromDate}</td>
                          <td className="px-4 py-3 text-gray-600">{l.toDate}</td>
                          <td className="px-4 py-3 text-center font-semibold">{l.days || 1}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{l.reason || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${LEAVE_STATUS_STYLES[l.status] || 'bg-gray-100 text-gray-600'}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditLeave(l); setShowLeaveModal(true); }}
                                className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={async () => { if(window.confirm('Delete?')) { try { await deleteDoc(doc(db, 'hr_leaves', l.id)); } catch {} setLeaves(prev => prev.filter(x => x.id !== l.id)); }}}
                                className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Attendance Tab ── */}
        {tab === 'attendance' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 shadow-sm">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-lg">Attendance Tracking</p>
            <p className="text-sm mt-1">Coming soon — integrate with biometric/RFID system or log attendance manually.</p>
          </div>
        )}

        {/* ── Documents Tab ── */}
        {tab === 'documents' && (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="font-semibold text-gray-800">Employee Documents Checklist</p>
                <p className="text-xs text-gray-500 mt-0.5">Track which documents have been collected per employee</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                      {['Aadhaar', 'PAN', 'Photo', 'Offer Letter', 'Agreement', 'Certificates', 'Bank Proof'].map(doc => (
                        <th key={doc} className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">{doc}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map(emp => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.employeeId}</p>
                        </td>
                        {[
                          !!emp.aadhaar, !!emp.pan, false, true, false, !!emp.qualification, !!emp.accountNumber
                        ].map((has, i) => (
                          <td key={i} className="px-3 py-3 text-center">
                            <span className={`text-lg ${has ? 'text-green-500' : 'text-gray-300'}`}>{has ? '✓' : '○'}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Reports Tab ── */}
        {tab === 'reports' && (
          <div className="space-y-6">
            {/* Headcount by dept */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="font-bold text-gray-800 mb-4">Headcount by Department</p>
              <div className="space-y-3">
                {DEPARTMENTS.map(dept => {
                  const count = employees.filter(e => e.department === dept && e.isActive).length;
                  if (count === 0) return null;
                  return (
                    <div key={dept} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-36">{dept}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full"
                          style={{ width: `${Math.min(100, (count / Math.max(1, active.length)) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-6">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Salary summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="font-bold text-gray-800 mb-4">Salary Summary (Monthly)</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Gross Payroll', val: totalGross, color: 'purple' },
                  { label: 'Total PF (Employee)', val: active.reduce((s,e) => s + calcPayroll(e).pfEmployee, 0), color: 'blue' },
                  { label: 'Total PF (Employer)', val: active.reduce((s,e) => s + calcPayroll(e).pfEmployer, 0), color: 'indigo' },
                  { label: 'Total ESI (Employee)', val: active.reduce((s,e) => s + calcPayroll(e).esi, 0), color: 'pink' },
                  { label: 'Total ESI (Employer)', val: active.reduce((s,e) => s + calcPayroll(e).esiEmployer, 0), color: 'rose' },
                  { label: 'Total Net Pay', val: active.reduce((s,e) => s + calcPayroll(e).netSalary, 0), color: 'green' },
                ].map((s, i) => (
                  <div key={i} className={`bg-${s.color}-50 rounded-xl p-4 border border-${s.color}-100`}>
                    <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                    <p className={`text-xl font-bold text-${s.color}-700`}>₹{s.val.toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Leave summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="font-bold text-gray-800 mb-3">Leave Summary (All Time)</p>
              <div className="flex gap-4 text-sm">
                {['pending', 'approved', 'rejected'].map(s => (
                  <div key={s} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${LEAVE_STATUS_STYLES[s]}`}>
                    <span className="font-bold">{leaves.filter(l => l.status === s).length}</span>
                    <span className="capitalize">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      {showEmpModal && (
        <EmployeeModal
          employee={editEmp}
          onClose={() => { setShowEmpModal(false); setEditEmp(null); }}
          onSave={saveEmployee}
        />
      )}
      {showLeaveModal && (
        <LeaveModal
          employees={employees}
          existing={editLeave}
          onClose={() => { setShowLeaveModal(false); setEditLeave(null); }}
          onSave={saveLeave}
        />
      )}
    </div>
  );
};

// Sample employees for fallback if Firebase is empty
const SAMPLE_EMPLOYEES = [
  {
    id: 's1', employeeId: 'EMP-101', name: 'Gautham', role: 'Therapist', department: 'Therapy',
    email: 'gautham@tatvaayurved.com', phone: '9876500101', dateOfJoining: '2023-06-01',
    basicSalary: 20000, hra: 8000, travelAllowance: 1600, medicalAllowance: 1250, specialAllowance: 2000,
    tds: 0, otherDeductions: 0, ptoBalance: { casual: 12, sick: 12, earned: 15 }, isActive: true,
  },
  {
    id: 's2', employeeId: 'EMP-104', name: 'Neethu', role: 'Therapist', department: 'Therapy',
    email: 'neethu@tatvaayurved.com', phone: '9876500104', dateOfJoining: '2023-09-15',
    basicSalary: 18000, hra: 7200, travelAllowance: 1600, medicalAllowance: 1250, specialAllowance: 1500,
    tds: 0, otherDeductions: 0, ptoBalance: { casual: 12, sick: 12, earned: 15 }, isActive: true,
  },
];

export default HRPayrollModule;
