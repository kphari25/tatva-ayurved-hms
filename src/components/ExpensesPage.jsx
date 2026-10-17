import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, List, ShieldCheck, Pencil, Lock, X, RefreshCw } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ExpenseForm from './ExpenseForm';
import { categoryLabel, paymentModeLabel, isSystemExpense, getCurrentUser, localDateString } from '../lib/expenses';

const firstOfMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};
const todayStr = () => localDateString();

const fmtMoney = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).split('T')[0] + 'T00:00:00');
  return isNaN(d) ? String(s) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── All Expenses (admin) ────────────────────────────────────────────────────
const AllExpensesTab = ({ refreshKey, onChanged, focusDate }) => {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());

  // An expense just added with a date outside the visible range would look like
  // it vanished — widen the range to include it.
  useEffect(() => {
    if (!focusDate) return;
    setFrom(prev => (focusDate < prev ? focusDate : prev));
    setTo(prev => (focusDate > prev ? focusDate : prev));
  }, [focusDate]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Dates are stored as YYYY-MM-DD strings; the high-codepoint suffix keeps
      // any row whose date carries a time portion inside the end day.
      const q = query(collection(db, 'expenses'), where('date', '>=', from), where('date', '<=', to + ''));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
      setRows(list);
    } catch (e) {
      setError('Failed to load expenses: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <div className="ml-auto text-sm text-gray-600">
          {rows.length} expense{rows.length === 1 ? '' : 's'} · Total <strong className="text-gray-900">{fmtMoney(total)}</strong>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Vendor / Invoice</th>
              <th className="py-2 pr-3">Mode</th>
              <th className="py-2 pr-3 text-right">Amount</th>
              <th className="py-2 pr-3">Added by</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const locked = isSystemExpense(r);
              return (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="py-2 pr-3">{categoryLabel(r.category)}</td>
                  <td className="py-2 pr-3 max-w-xs whitespace-pre-line break-words">{r.description || '—'}</td>
                  <td className="py-2 pr-3">{[r.vendor, r.invoice].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-2 pr-3">{paymentModeLabel(r.payment_mode)}</td>
                  <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">{fmtMoney(r.amount)}</td>
                  <td className="py-2 pr-3">
                    <div>{r.created_by_name || r.created_by || '—'}</div>
                    {r.updated_at && <span className="text-xs text-amber-700">edited</span>}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {locked ? (
                      <span title="Created automatically from a purchase receipt (GRN) — read-only" className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Lock className="w-3.5 h-3.5" /> Auto
                      </span>
                    ) : (
                      <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-500">No expenses in this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-orange-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-xl font-bold">Edit Expense</h2>
              <button onClick={() => setEditing(null)} className="hover:bg-orange-700 p-2 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <ExpenseForm
                expense={editing}
                onCancel={() => setEditing(null)}
                onSaved={(_, changed) => {
                  setEditing(null);
                  if (changed) { load(); onChanged?.(); }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Expense Log (admin) ─────────────────────────────────────────────────────
const LogTab = ({ refreshKey }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(query(collection(db, 'expense_audit_log'), orderBy('at', 'desc'), limit(500)));
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError('Failed to load the expense log: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const visible = entries.filter(e =>
    (actionFilter === 'all' || e.action === actionFilter) &&
    (!userFilter.trim() || `${e.by_name} ${e.by_email}`.toLowerCase().includes(userFilter.trim().toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="all">All</option>
            <option value="created">Added</option>
            <option value="edited">Edited</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
          <input type="text" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Name or email" className="px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <div className="ml-auto text-xs text-gray-500">Latest 500 entries · only admins can see this log</div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Who</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Expense</th>
              <th className="py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(e => (
              <tr key={e.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(e.at)}</td>
                <td className="py-2 pr-3">
                  <div className="font-medium">{e.by_name || e.by_email || '—'}</div>
                  {e.by_name && <div className="text-xs text-gray-500">{e.by_email}</div>}
                </td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${e.action === 'created' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {e.action === 'created' ? 'Added' : 'Edited'}
                  </span>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <div>{fmtDate(e.snapshot?.date)} · {categoryLabel(e.snapshot?.category)}</div>
                  <div className="text-xs text-gray-500">{fmtMoney(e.snapshot?.amount)}</div>
                </td>
                <td className="py-2">
                  {e.action === 'edited' ? (
                    <ul className="space-y-0.5">
                      {(e.changes || []).map(c => (
                        <li key={c.field}>
                          <span className="text-gray-600">{c.label}:</span>{' '}
                          <span className="line-through text-red-600">{c.from || '(empty)'}</span>{' → '}
                          <span className="text-green-700">{c.to || '(empty)'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-600 whitespace-pre-line">{e.snapshot?.description || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">No log entries yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// ── Your recent expenses (everyone else) ───────────────────────────────────
const MyRecentTab = ({ refreshKey }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const email = getCurrentUser().email || '';
        const snap = await getDocs(query(collection(db, 'expenses'), where('created_by', '==', email)));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        if (!cancelled) setRows(list.slice(0, 20));
      } catch (e) {
        console.error('Error loading your expenses:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="font-bold text-gray-800 mb-3">Expenses you added recently</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-2 pr-3">{categoryLabel(r.category)}</td>
                <td className="py-2 pr-3 max-w-xs whitespace-pre-line break-words">{r.description || '—'}</td>
                <td className="py-2 text-right font-semibold whitespace-nowrap">{fmtMoney(r.amount)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">You haven't added any expenses yet — click "Add Expense" to record one</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
const ExpensesPage = ({ isAdmin }) => {
  const [tab, setTab] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastSavedDate, setLastSavedDate] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey(k => k + 1);

  const tabs = [
    { id: 'all', label: 'All Expenses', icon: List },
    { id: 'log', label: 'Expense Log', icon: ShieldCheck },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-gray-900">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Expenses</h1>
          <p className="text-gray-600 text-sm">Expenses added here are counted in the Profit &amp; Loss statement automatically</p>
        </div>
        <button
          onClick={() => { setNotice(''); setShowAdd(true); }}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {notice && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="p-1 hover:bg-green-100 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 -mb-px flex items-center gap-2 font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && tab === 'all' && <AllExpensesTab refreshKey={refreshKey} onChanged={bump} focusDate={lastSavedDate} />}
      {isAdmin && tab === 'log' && <LogTab refreshKey={refreshKey} />}
      {!isAdmin && <MyRecentTab refreshKey={refreshKey} />}

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-orange-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h2 className="text-xl font-bold">Add Expense</h2>
              <button onClick={() => setShowAdd(false)} className="hover:bg-orange-700 p-2 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <ExpenseForm
                onCancel={() => setShowAdd(false)}
                onSaved={(saved) => {
                  setShowAdd(false);
                  setNotice('Expense added successfully.');
                  setLastSavedDate(saved?.date ? String(saved.date).split('T')[0] : '');
                  bump();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
