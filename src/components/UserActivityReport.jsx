import React, { useState, useEffect, useMemo } from 'react';
import { History, Printer, RefreshCw, Calendar, Users } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const sessionEnd = (session) => new Date(session.logged_out_at || session.last_seen || session.login_at);

const durationMs = (session) => {
  const start = new Date(session.login_at);
  const end = sessionEnd(session);
  return Math.max(0, end - start);
};

const fmtDuration = (ms) => {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0 && m === 0) return '< 1m';
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const isRecentlyActive = (session) => {
  if (session.logged_out_at) return false;
  const lastSeen = new Date(session.last_seen || session.login_at);
  return (Date.now() - lastSeen.getTime()) < 5 * 60 * 1000;
};

const lastNDays = (n) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (n - 1));
  return [start, end];
};

const quickRanges = {
  '7': () => lastNDays(7),
  '10': () => lastNDays(10),
  '30': () => lastNDays(30),
};

const UserActivityReport = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [rangeMode, setRangeMode] = useState('10');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const selectedRange = useMemo(() => {
    if (rangeMode === 'custom') {
      const now = new Date();
      const start = customStart ? new Date(customStart + 'T00:00:00') : lastNDays(10)[0];
      const end = customEnd ? new Date(customEnd + 'T00:00:00') : now;
      return [start, end];
    }
    return quickRanges[rangeMode]();
  }, [rangeMode, customStart, customEnd]);

  useEffect(() => {
    loadSessions();
  }, [selectedRange]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const startStr = toDateStr(selectedRange[0]);
      const endStr = toDateStr(selectedRange[1]);
      const q = query(
        collection(db, 'user_sessions'),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => new Date(b.login_at) - new Date(a.login_at));
      setSessions(rows);
    } catch (error) {
      console.error('Error loading user sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedByDate = useMemo(() => {
    const groups = {};
    sessions.forEach((s) => {
      const key = s.date || toDateStr(new Date(s.login_at));
      (groups[key] = groups[key] || []).push(s);
    });
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sessions]);

  const summary = useMemo(() => {
    const uniqueUsers = new Set(sessions.map((s) => s.user_email)).size;
    const totalMs = sessions.reduce((sum, s) => sum + durationMs(s), 0);
    return {
      totalSessions: sessions.length,
      uniqueUsers,
      totalTime: fmtDuration(totalMs),
    };
  }, [sessions]);

  const handlePrint = () => {
    const rangeLabel = `${selectedRange[0].toLocaleDateString('en-IN')} - ${selectedRange[1].toLocaleDateString('en-IN')}`;

    const rows = groupedByDate.map(([dateKey, entries]) => `
      <tr style="background:#f0f0f0;"><td colspan="5"><strong>${fmtDate(dateKey)}</strong></td></tr>
      ${entries.map((s) => `
        <tr>
          <td>${s.user_name || ''}</td>
          <td>${s.role || ''}</td>
          <td>${fmtTime(s.login_at)}</td>
          <td>${s.logged_out_at ? fmtTime(s.logged_out_at) : (isRecentlyActive(s) ? 'Active now' : `Last seen ${fmtTime(s.last_seen)}`)}</td>
          <td>${fmtDuration(durationMs(s))}</td>
        </tr>`).join('')}
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>User Activity Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #14b8a6; padding-bottom: 10px; }
          .header img { height: 80px; margin-bottom: 10px; }
          .header h1 { color: #14b8a6; margin: 10px 0; }
          .header .tagline { color: #666; font-size: 14px; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
          th { background: #14b8a6; color: white; }
          .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'">
          <h1>Tatva Ayurved</h1>
          <p class="tagline">Ayurveda for Health &amp; Happiness</p>
          <p style="margin: 5px 0; font-size: 12px;">User Activity Report</p>
        </div>

        <p><strong>Period:</strong> ${rangeLabel}</p>
        <p><strong>Generated on:</strong> ${new Date().toLocaleString('en-IN')}</p>
        <p><strong>Total Sessions:</strong> ${summary.totalSessions} &nbsp; | &nbsp; <strong>Unique Users:</strong> ${summary.uniqueUsers} &nbsp; | &nbsp; <strong>Total Time Logged:</strong> ${summary.totalTime}</p>

        <table>
          <thead>
            <tr><th>User</th><th>Role</th><th>Login Time</th><th>Logout Time</th><th>Duration</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#888;">No sessions found</td></tr>'}</tbody>
        </table>

        <div class="footer">
          <p>This is a computer-generated report</p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 30px; background: #14b8a6; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
            Print
          </button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <History className="w-7 h-7 text-teal-600" />
          <h1 className="text-2xl font-bold text-gray-800">User Activity</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: '7', label: 'Last 7 Days' },
            { id: '10', label: 'Last 10 Days' },
            { id: '30', label: 'Last 30 Days' },
            { id: 'custom', label: 'Custom' }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRangeMode(opt.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                rangeMode === opt.id ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {rangeMode === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-sm outline-none"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-sm outline-none"
              />
            </div>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {selectedRange[0].toLocaleDateString('en-IN')} - {selectedRange[1].toLocaleDateString('en-IN')}
      </p>

      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        Tracking started when this feature was added — logins from before that date won't appear here.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Sessions</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">{summary.totalSessions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Unique Users</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">{summary.uniqueUsers}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Time Logged</p>
          <p className="text-2xl font-bold mt-1 text-teal-600">{summary.totalTime}</p>
        </div>
      </div>

      {/* Sessions grouped by date */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Login Sessions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Login Time</th>
                <th className="px-4 py-3 font-medium">Logout Time</th>
                <th className="px-4 py-3 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {groupedByDate.map(([dateKey, entries]) => (
                <React.Fragment key={dateKey}>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      {fmtDate(dateKey)} · {entries.length} session{entries.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                  {entries.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.user_name || s.user_email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{s.role || '—'}</td>
                      <td className="px-4 py-3">{fmtTime(s.login_at)}</td>
                      <td className="px-4 py-3">
                        {s.logged_out_at
                          ? fmtTime(s.logged_out_at)
                          : isRecentlyActive(s)
                            ? <span className="text-green-600 font-medium">Active now</span>
                            : <span className="text-gray-400">Last seen {fmtTime(s.last_seen)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtDuration(durationMs(s))}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {groupedByDate.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No login activity found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserActivityReport;
