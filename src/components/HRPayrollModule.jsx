import React, { useState, useEffect } from 'react';
import {
  Users, DollarSign, Calendar, Award, TrendingUp, Download, Plus,
  Edit, Trash2, Eye, EyeOff, Lock, Shield, AlertCircle, CheckCircle,
  CreditCard, FileText, Search, Filter, UserCheck, Clock, Briefcase
} from 'lucide-react';

const HRPayrollModule = ({ userRole, currentUser }) => {
  // Role check - CRITICAL: Only admins can access
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify user role
    if (userRole === 'admin') {
      setHasAccess(true);
    } else {
      setHasAccess(false);
    }
    setLoading(false);
  }, [userRole]);

  const [staff, setStaff] = useState([
    {
      id: '1',
      employeeId: 'EMP-001',
      name: 'Dr. Arjun Vaidya',
      role: 'Doctor',
      email: 'arjun@tatvaayurved.com',
      phone: '9876543210',
      dateOfJoining: '2023-01-15',
      baseSalary: 75000,
      allowances: 5000,
      deductions: 2000,
      isActive: true
    },
    {
      id: '2',
      employeeId: 'EMP-002',
      name: 'Maya Therapist',
      role: 'Therapist',
      email: 'maya@tatvaayurved.com',
      phone: '9876543211',
      dateOfJoining: '2023-03-20',
      baseSalary: 30000,
      allowances: 2000,
      deductions: 500,
      isActive: true
    },
    {
      id: '3',
      employeeId: 'EMP-003',
      name: 'Priya Reception',
      role: 'Front Desk',
      email: 'priya@tatvaayurved.com',
      phone: '9876543212',
      dateOfJoining: '2023-02-01',
      baseSalary: 25000,
      allowances: 1500,
      deductions: 500,
      isActive: true
    },
    {
      id: '4',
      employeeId: 'EMP-004',
      name: 'Ravi Pharmacy',
      role: 'Pharmacy',
      email: 'ravi@tatvaayurved.com',
      phone: '9876543213',
      dateOfJoining: '2023-04-10',
      baseSalary: 22000,
      allowances: 1000,
      deductions: 300,
      isActive: true
    }
  ]);

  const [salaryPayments, setSalaryPayments] = useState([
    {
      id: '1',
      staffId: '1',
      month: '2025-01',
      baseSalary: 75000,
      allowances: 5000,
      deductions: 2000,
      bonus: 10000,
      totalSalary: 88000,
      paymentDate: '2025-01-31',
      paymentMethod: 'bank_transfer',
      status: 'paid'
    },
    {
      id: '2',
      staffId: '2',
      month: '2025-01',
      baseSalary: 30000,
      allowances: 2000,
      deductions: 500,
      bonus: 5000,
      totalSalary: 36500,
      paymentDate: '2025-01-31',
      paymentMethod: 'bank_transfer',
      status: 'paid'
    },
    {
      id: '3',
      staffId: '3',
      month: '2025-01',
      baseSalary: 25000,
      allowances: 1500,
      deductions: 500,
      bonus: 0,
      totalSalary: 26000,
      paymentDate: '2025-01-31',
      paymentMethod: 'bank_transfer',
      status: 'paid'
    },
    {
      id: '4',
      staffId: '4',
      month: '2025-01',
      baseSalary: 22000,
      allowances: 1000,
      deductions: 300,
      bonus: 0,
      totalSalary: 22700,
      paymentDate: '2025-01-31',
      paymentMethod: 'bank_transfer',
      status: 'paid'
    }
  ]);

  const [viewMode, setViewMode] = useState('staff'); // staff, salaries, reports
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showPaySalary, setShowPaySalary] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showSalaryDetails, setShowSalaryDetails] = useState({});

  // Access Denied Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl border-4 border-red-200">
          <div className="text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-red-800 mb-4">Access Denied</h1>
            <p className="text-xl text-red-600 mb-6">
              HR & Payroll Module - Administrator Access Required
            </p>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div className="text-left">
                  <p className="font-bold text-red-800 mb-2">Restricted Information</p>
                  <p className="text-sm text-red-700">
                    This module contains sensitive salary and HR information. Only users with 
                    <strong> Administrator</strong> role can access this section.
                  </p>
                </div>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              <p>Current user: <strong>{currentUser?.email}</strong></p>
              <p>Current role: <strong className="text-red-600">{userRole}</strong></p>
              <p className="mt-4">Please contact your system administrator for access.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate summary statistics
  const stats = {
    totalStaff: staff.filter(s => s.isActive).length,
    totalSalaryBudget: staff.filter(s => s.isActive).reduce((sum, s) => sum + s.baseSalary + s.allowances - s.deductions, 0),
    thisMonthPaid: salaryPayments.filter(p => p.month === '2025-01' && p.status === 'paid').reduce((sum, p) => sum + p.totalSalary, 0),
    pendingPayments: salaryPayments.filter(p => p.status === 'pending').length
  };

  const toggleSalaryVisibility = (staffId) => {
    setShowSalaryDetails(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 p-8">
      {/* Header with Security Badge */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                HR & Payroll Management
              </h1>
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border-2 border-red-300 rounded-full">
                <Lock className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-700">ADMIN ONLY</span>
              </div>
            </div>
            <p className="text-slate-600">Manage staff, salaries, and payroll - Confidential Information</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddStaff(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Staff
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 font-semibold">
              <Download className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Active Staff', value: stats.totalStaff, icon: Users, color: 'blue', suffix: '' },
          { label: 'Monthly Salary Budget', value: stats.totalSalaryBudget.toLocaleString(), icon: DollarSign, color: 'emerald', suffix: '₹' },
          { label: 'This Month Paid', value: stats.thisMonthPaid.toLocaleString(), icon: CheckCircle, color: 'green', suffix: '₹' },
          { label: 'Pending Payments', value: stats.pendingPayments, icon: Clock, color: 'amber', suffix: '' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 bg-${stat.color}-100 rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-7 h-7 text-${stat.color}-600`} />
              </div>
              <TrendingUp className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <p className="text-slate-600 text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-800">
              {stat.suffix === '₹' && '₹'}
              {stat.value}
              {stat.suffix !== '₹' && stat.suffix}
            </p>
          </div>
        ))}
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-2 mb-6 inline-flex gap-2">
        {[
          { value: 'staff', label: 'Staff Directory', icon: Users },
          { value: 'salaries', label: 'Salary Payments', icon: DollarSign },
          { value: 'reports', label: 'Reports', icon: FileText }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setViewMode(tab.value)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              viewMode === tab.value
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Staff Directory View */}
      {viewMode === 'staff' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Employee</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Joined</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-600" />
                      <span className="text-red-700">Salary Details</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((employee) => {
                  const monthlyTotal = employee.baseSalary + employee.allowances - employee.deductions;
                  const isVisible = showSalaryDetails[employee.id];

                  return (
                    <tr key={employee.id} className="hover:bg-purple-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-800">{employee.name}</p>
                          <p className="text-sm text-slate-500">{employee.employeeId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-slate-700">{employee.email}</p>
                          <p className="text-slate-500">{employee.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                          {employee.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4" />
                          {new Date(employee.dateOfJoining).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-red-700">CONFIDENTIAL</span>
                            <button
                              onClick={() => toggleSalaryVisibility(employee.id)}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              {isVisible ? <EyeOff className="w-4 h-4 text-red-600" /> : <Eye className="w-4 h-4 text-red-600" />}
                            </button>
                          </div>
                          {isVisible ? (
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Base:</span>
                                <span className="font-bold text-slate-800">₹{employee.baseSalary.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Allowances:</span>
                                <span className="font-bold text-emerald-600">+₹{employee.allowances.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Deductions:</span>
                                <span className="font-bold text-red-600">-₹{employee.deductions.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-red-200">
                                <span className="font-bold text-slate-700">Total:</span>
                                <span className="font-bold text-purple-600">₹{monthlyTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-red-600 text-center font-semibold">Click eye to view</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedStaff(employee);
                              setShowPaySalary(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-semibold"
                          >
                            <DollarSign className="w-4 h-4" />
                            Pay Salary
                          </button>
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary Payments View */}
      {viewMode === 'salaries' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Payment History</h3>
          <div className="space-y-4">
            {salaryPayments.map((payment) => {
              const employee = staff.find(s => s.id === payment.staffId);
              return (
                <div key={payment.id} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{employee?.name}</p>
                        <p className="text-sm text-slate-500">{payment.month} • {employee?.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-600">₹{payment.totalSalary.toLocaleString()}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {payment.status === 'paid' ? '✓ Paid' : 'Pending'}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(payment.paymentDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Base Salary</p>
                      <p className="font-bold text-slate-800">₹{payment.baseSalary.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Allowances</p>
                      <p className="font-bold text-emerald-600">+₹{payment.allowances.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Deductions</p>
                      <p className="font-bold text-red-600">-₹{payment.deductions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Bonus</p>
                      <p className="font-bold text-blue-600">+₹{payment.bonus.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Method</p>
                      <p className="font-semibold text-slate-700">{payment.paymentMethod.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Security Warning Footer */}
      <div className="mt-8 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-lg mb-2">Security & Confidentiality Notice</h4>
            <p className="text-red-100 text-sm">
              This module contains highly sensitive salary and personal information. All access and actions are logged for audit purposes. 
              Unauthorized disclosure of salary information is strictly prohibited and may result in legal action.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span>Logged in as: <strong>{currentUser?.email}</strong></span>
              <span>•</span>
              <span>Role: <strong>Administrator</strong></span>
              <span>•</span>
              <span>Session ID: <strong>{Math.random().toString(36).substr(2, 9)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRPayrollModule;
