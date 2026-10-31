import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, CalendarClock, Download, Search, Save, CheckCircle, AlertTriangle, Info, Ban, IndianRupee, Hourglass, FileText,
} from 'lucide-react';
import { collection, doc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { localDateString, getCurrentUser, isAdminUser } from '../lib/expenses';
import { flattenLines } from '../lib/salesAnalytics';
import { buildMedicines, suggestReorder, stockRecords, EXPIRY_BUCKETS } from '../lib/inventoryHealth';
import { canApprovePurchases, createRequestFromReorder } from '../lib/purchasing';
import PurchaseOrderModal from './PurchaseOrderModal';

const n0 = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const n2 = (v) => (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const rupees = (v) => `₹${n0(v)}`;
const fmtDay = (s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', opts) : '—';

const PRIORITY = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-800' },
  high: { label: 'High', cls: 'bg-orange-100 text-orange-800' },
  normal: { label: 'Normal', cls: 'bg-gray-100 text-gray-700' },
};

const BUCKET_STYLE = {
  expired: { color: '#dc2626', bg: 'bg-red-100 text-red-800' },
  d30: { color: '#ea580c', bg: 'bg-orange-100 text-orange-800' },
  d60: { color: '#d97706', bg: 'bg-amber-100 text-amber-800' },
  d90: { color: '#ca8a04', bg: 'bg-yellow-100 text-yellow-800' },
  d180: { color: '#0d9488', bg: 'bg-teal-100 text-teal-800' },
  later: { color: '#16a34a', bg: 'bg-green-100 text-green-800' },
  none: { color: '#9ca3af', bg: 'bg-gray-100 text-gray-600' },
};

const Tile = ({ icon: Icon, color, label, value, sub, onClick, active }) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border shadow-sm p-4 transition ${active ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200'} ${onClick ? 'hover:shadow-md hover:border-teal-300 cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500 leading-tight">{label}</span>
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1f` }}>
          {React.createElement(Icon, { className: 'w-4 h-4', style: { color } })}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="mt-1.5 text-xs text-gray-500 min-h-[1rem]">{sub}</div>
    </Wrapper>
  );
};

// ── Reorder list ────────────────────────────────────────────────────────────
const ReorderView = ({ medicines, coverDays, setCoverDays, targetDays, setTargetDays }) => {
  const suggestions = useMemo(() => suggestReorder(medicines, Number(targetDays) || 30), [medicines, targetDays]);
  const [unchecked, setUnchecked] = useState(() => new Set());
  const [qty, setQty] = useState({}); // key -> edited quantity

  const rows = suggestions.map(s => ({ ...s, order: qty[s.key] ?? s.suggested }));
  const chosen = rows.filter(r => !unchecked.has(r.key));
  const estTotal = chosen.reduce((n, r) => n + (Number(r.order) || 0) * r.unitCost, 0);
  const urgent = rows.filter(r => r.priority === 'urgent').length;

  const toggle = (key) => setUnchecked(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // ── Hand-off to Purchase Management ──
  const approver = canApprovePurchases();
  const [creating, setCreating] = useState(false);
  const [poRequest, setPoRequest] = useState(null); // request being turned into a PO
  const [result, setResult] = useState(null); // { kind: 'request' | 'po', ... }
  const [createError, setCreateError] = useState('');
  const hasQty = chosen.some(r => Number(r.order) > 0);

  const markDone = (usedRows) => setUnchecked(prev => {
    const next = new Set(prev);
    usedRows.forEach(r => next.add(r.key)); // untick what was just ordered so it isn't sent twice
    return next;
  });

  const sendRequest = async () => {
    setCreateError('');
    setResult(null);
    setCreating(true);
    try {
      const used = chosen.filter(r => Number(r.order) > 0);
      const req = await createRequestFromReorder(used, { preApproved: false });
      markDone(used);
      setResult({ kind: 'request', id: req.request_id, count: req.medicines.length, total: req.total_estimated });
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Approvers go straight on to a Purchase Order: the request is recorded as
  // approved by them, then Purchase Management's own PO screen opens (vendor,
  // GST, delivery). If they back out of that screen, the request is removed.
  const startPO = async () => {
    setCreateError('');
    setResult(null);
    setCreating(true);
    try {
      const used = chosen.filter(r => Number(r.order) > 0);
      const req = await createRequestFromReorder(used, { preApproved: true });
      setPoRequest({ request: req, used });
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const closePO = async () => {
    const pending = poRequest;
    setPoRequest(null);
    if (!pending) return;
    try { await deleteDoc(doc(db, 'purchase_requests', pending.request.id)); } catch (e) { console.error('Could not remove the unused request:', e); }
  };

  const poCreated = async () => {
    const pending = poRequest;
    setPoRequest(null);
    markDone(pending.used);
    setResult({ kind: 'po', id: pending.request.request_id, count: pending.request.medicines.length, total: pending.request.total_estimated });
  };

  const exportList = () => {
    const sheet = XLSX.utils.json_to_sheet(chosen.map(r => ({
      Priority: PRIORITY[r.priority].label, Medicine: r.name, Code: r.code, 'In stock': r.stock,
      'Sold 30 days': r.sold30, 'Days of stock left': r.daysLeft ?? '', 'Order qty': Number(r.order) || 0,
      'Unit cost': r.unitCost, 'Estimated cost': Math.round((Number(r.order) || 0) * r.unitCost * 100) / 100,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Reorder list');
    XLSX.writeFile(wb, `Reorder_List_${localDateString()}.xlsx`);
  };

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Tile icon={ShoppingCart} color="#f97316" label="Medicines to reorder" value={n0(rows.length)} sub={`${n0(chosen.length)} selected`} />
        <Tile icon={Ban} color="#ef4444" label="Urgent: out of stock, still selling" value={n0(urgent)} sub="sold in the last 90 days" />
        <Tile icon={Hourglass} color="#d97706" label="Running short" value={n0(rows.filter(r => r.priority !== 'urgent').length)} sub={`under ${coverDays} days of stock, or at its reorder level`} />
        <Tile icon={IndianRupee} color="#0d9488" label="Estimated cost of selected" value={rupees(estTotal)} sub={`at your last purchase prices`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <label className="inline-flex items-center gap-2">List a medicine when it has under
            <input type="number" min="1" value={coverDays} onChange={e => setCoverDays(e.target.value)} className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-gray-900" /> days of stock
          </label>
          <label className="inline-flex items-center gap-2">Order enough for
            <input type="number" min="1" value={targetDays} onChange={e => setTargetDays(e.target.value)} className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-gray-900" /> days
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportList} disabled={chosen.length === 0} className="px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={sendRequest} disabled={creating || !hasQty} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2" title="Sends the selected medicines to Purchase Management for approval">
            <FileText className="w-4 h-4" /> {creating ? 'Working...' : 'Create purchase request'}
          </button>
          {approver && (
            <button onClick={startPO} disabled={creating || !hasQty} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2" title="Approves the request and opens the Purchase Order screen">
              <ShoppingCart className="w-4 h-4" /> Create purchase order
            </button>
          )}
        </div>
      </div>

      {createError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>
      )}
      {result && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-sm text-green-900">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            {result.kind === 'po'
              ? <>Purchase order created from request <strong>{result.id}</strong> ({result.count} medicine{result.count === 1 ? '' : 's'}, about {rupees(result.total)}). It is in Purchase Management → Purchase Orders.</>
              : <>Purchase request <strong>{result.id}</strong> created ({result.count} medicine{result.count === 1 ? '' : 's'}, about {rupees(result.total)}). It is waiting for approval in Purchase Management → Purchase Requests.</>}
          </span>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase' }))}
            className="px-3 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-800"
          >
            Open Purchase Management
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3 w-8">
                  <input
                    type="checkbox"
                    checked={chosen.length === rows.length && rows.length > 0}
                    onChange={() => setUnchecked(chosen.length === rows.length ? new Set(rows.map(r => r.key)) : new Set())}
                    title="Select all"
                  />
                </th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Medicine</th>
                <th className="py-2 pr-3 text-right">In stock</th>
                <th className="py-2 pr-3 text-right">Sold 30d</th>
                <th className="py-2 pr-3 text-right">Days left</th>
                <th className="py-2 pr-3">Last sold</th>
                <th className="py-2 pr-3 text-right">Order qty</th>
                <th className="py-2 pr-3 text-right">Unit cost</th>
                <th className="py-2 text-right">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className={`border-b last:border-0 ${unchecked.has(r.key) ? 'opacity-50' : ''}`}>
                  <td className="py-2 pr-3"><input type="checkbox" checked={!unchecked.has(r.key)} onChange={() => toggle(r.key)} /></td>
                  <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY[r.priority].cls}`}>{PRIORITY[r.priority].label}</span></td>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.code}</div>
                  </td>
                  <td className={`py-2 pr-3 text-right font-semibold ${r.stock < 0 ? 'text-red-600' : ''}`}>
                    {n2(r.stock)}
                    {r.stock < 0 && <div className="text-[10px] font-normal text-red-600">stock error — fix first</div>}
                  </td>
                  <td className="py-2 pr-3 text-right">{r.sold30 ? n2(r.sold30) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{r.daysLeft === null ? '—' : n0(r.daysLeft)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.lastSold ? fmtDay(r.lastSold, { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="py-2 pr-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={r.order}
                      onChange={e => setQty(q => ({ ...q, [r.key]: e.target.value }))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-right text-gray-900"
                    />
                  </td>
                  <td className="py-2 pr-3 text-right">{r.unitCost ? rupees(r.unitCost) : '—'}</td>
                  <td className="py-2 text-right font-medium">{r.unitCost ? rupees((Number(r.order) || 0) * r.unitCost) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="py-10 text-center text-gray-500">Nothing needs reordering right now</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          The suggested quantity covers {targetDays} days of sales at the recent selling rate, less what is already in stock — change any quantity before you export or send it to purchasing.
          Based on medicine bills only; medicines used for IP patients are not counted, so check those before ordering.
        </p>
      </div>

      {poRequest && (
        <PurchaseOrderModal request={poRequest.request} onClose={closePO} onSave={poCreated} />
      )}
    </div>
  );
};

// ── Expiry ──────────────────────────────────────────────────────────────────
const ExpiryView = ({ inventory, today, canEdit }) => {
  const records = useMemo(() => stockRecords(inventory, today), [inventory, today]);
  const [bucket, setBucket] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const [dirty, setDirty] = useState({}); // record id -> 'YYYY-MM-DD' or ''
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const withDate = records.filter(r => r.expiry).length;
  const coveragePct = records.length ? Math.round((withDate / records.length) * 100) : 0;
  const bucketStats = (id) => {
    const list = records.filter(r => r.bucket === id);
    return { count: list.length, value: list.reduce((n, r) => n + r.costValue, 0) };
  };

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = records.filter(r =>
      (bucket === 'all' || r.bucket === bucket) &&
      (!t || `${r.name} ${r.code} ${r.batch}`.toLowerCase().includes(t))
    );
    list.sort((a, b) => {
      if (bucket === 'none' || (!a.expiry && !b.expiry)) return b.costValue - a.costValue;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
    return list;
  }, [records, bucket, search]);

  const dirtyIds = Object.keys(dirty);
  const setDate = (id, value, original) => setDirty(prev => {
    const next = { ...prev };
    if (value === (original || '')) delete next[id]; else next[id] = value;
    return next;
  });

  const save = async () => {
    const ids = dirtyIds.filter(id => {
      const v = dirty[id];
      return v === '' || /^(20\d{2})-\d{2}-\d{2}$/.test(v);
    });
    if (ids.length === 0) return;
    if (!window.confirm(`Save expiry dates for ${ids.length} stock record${ids.length === 1 ? '' : 's'}?`)) return;
    const user = getCurrentUser();
    const now = new Date().toISOString();
    setSaving(true);
    setNotice('');
    try {
      const byId = new Map(inventory.map(r => [r.id, r]));
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach(id => {
          const rec = byId.get(id);
          const date = dirty[id] || null;
          const update = {
            expiry_date: date,
            expiry_entered_by: user.email || '',
            expiry_entered_at: now,
            last_updated: now,
          };
          // Single-batch records keep the date on the batch too, as the Excel
          // import does, so every part of the app that reads either one agrees.
          if (Array.isArray(rec?.batches) && rec.batches.length === 1) {
            update.batches = [{ ...rec.batches[0], expiry_date: date }];
          }
          batch.update(doc(db, 'inventory', id), update);
        });
        await batch.commit();
      }
      setDirty({});
      setNotice(`Saved expiry dates for ${ids.length} stock record${ids.length === 1 ? '' : 's'}.`);
    } catch (e) {
      alert('Failed to save expiry dates: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Coverage */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="font-semibold">Expiry dates entered: {n0(withDate)} of {n0(records.length)} stock records in stock</div>
          <div className="text-sm text-gray-500">{coveragePct}%</div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${coveragePct}%` }} />
        </div>
        {withDate === 0 && (
          <p className="text-sm text-gray-600 mt-3 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
            <span>
              Expiry alerts need dates. {canEdit ? 'Use “No date” below to type them in straight from the packs — highest-value stock first.' : 'Ask an administrator to enter them here.'}
            </span>
          </p>
        )}
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
        {EXPIRY_BUCKETS.map(b => {
          const s = bucketStats(b.id);
          return (
            <Tile
              key={b.id}
              icon={b.id === 'expired' ? AlertTriangle : CalendarClock}
              color={BUCKET_STYLE[b.id].color}
              label={b.label}
              value={n0(s.count)}
              sub={s.count ? `${rupees(s.value)} at cost` : ''}
              onClick={() => { setBucket(bucket === b.id ? 'all' : b.id); setLimit(100); }}
              active={bucket === b.id}
            />
          );
        })}
        <Tile
          icon={CalendarClock}
          color={BUCKET_STYLE.none.color}
          label="No date"
          value={n0(bucketStats('none').count)}
          sub={`${rupees(bucketStats('none').value)} at cost`}
          onClick={() => { setBucket(bucket === 'none' ? 'all' : 'none'); setLimit(100); }}
          active={bucket === 'none'}
        />
      </div>

      {notice && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
          <CheckCircle className="w-4 h-4" /> {notice}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Stock by expiry</h2>
            <p className="text-sm text-gray-500">{n0(rows.length)} stock record{rows.length === 1 ? '' : 's'}{canEdit ? ' · type a date to set or correct it, then Save' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => { setSearch(e.target.value); setLimit(100); }} placeholder="Search medicine, code or batch" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
            </div>
            {canEdit && (
              <button onClick={save} disabled={saving || dirtyIds.length === 0} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : `Save${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Medicine</th>
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3 text-right">In stock</th>
                <th className="py-2 pr-3 text-right">Value (cost)</th>
                <th className="py-2 pr-3">Expiry date</th>
                <th className="py-2 pr-3 text-right">Days left</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(r => {
                const edited = dirty[r.id];
                const shown = edited !== undefined ? edited : (r.expiry || '');
                return (
                  <tr key={r.id} className={`border-b last:border-0 ${edited !== undefined ? 'bg-teal-50' : ''}`}>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.code}</div>
                    </td>
                    <td className="py-2 pr-3 text-gray-600">{r.batch || '—'}</td>
                    <td className="py-2 pr-3 text-right">{n2(r.stock)}</td>
                    <td className="py-2 pr-3 text-right">{r.costValue ? rupees(r.costValue) : '—'}</td>
                    <td className="py-2 pr-3">
                      {canEdit ? (
                        <input
                          type="date"
                          value={shown}
                          onChange={e => setDate(r.id, e.target.value, r.expiry)}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-gray-900"
                        />
                      ) : (r.expiry ? fmtDay(r.expiry) : <span className="text-gray-400">not entered</span>)}
                    </td>
                    <td className="py-2 pr-3 text-right">{r.days === null ? '—' : n0(r.days)}</td>
                    <td className="py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BUCKET_STYLE[r.bucket].bg}`}>
                        {r.bucket === 'none' ? 'No date' : r.bucket === 'expired' ? 'Expired' : r.bucket === 'later' ? 'OK' : EXPIRY_BUCKETS.find(b => b.id === r.bucket).label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-500">Nothing in this group</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="text-center mt-4">
            <button onClick={() => setLimit(l => l + 200)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              Show more ({n0(rows.length - limit)} more)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
const ReorderExpiryDashboard = () => {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [loaded, setLoaded] = useState({ inventory: false, sales: false });
  const [error, setError] = useState('');
  const [view, setView] = useState('reorder');
  const [coverDays, setCoverDays] = useState(30);
  const [targetDays, setTargetDays] = useState(30);
  const canEdit = isAdminUser(getCurrentUser());

  useEffect(() => {
    const done = (name) => setLoaded(p => ({ ...p, [name]: true }));
    const watch = (name, collectionName, setter, mapper) => onSnapshot(
      collection(db, collectionName),
      (snap) => { setter(snap.docs.map(mapper)); done(name); },
      (e) => { setError(`Could not load ${name}: ${e.message}`); done(name); }
    );
    const unsubs = [
      watch('inventory', 'inventory', setInventory, d => ({ ...d.data(), id: d.id })),
      watch('sales', 'medicine_sales', setSales, d => ({ id: d.id, ...d.data() })),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const today = localDateString();
  const lines = useMemo(() => flattenLines(sales), [sales]);
  const { medicines } = useMemo(
    () => buildMedicines({ inventory, lines, today, coverDays: Number(coverDays) || 0 }),
    [inventory, lines, today, coverDays]
  );

  if (!(loaded.inventory && loaded.sales)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const VIEWS = [
    { id: 'reorder', label: 'Reorder list', icon: ShoppingCart },
    { id: 'expiry', label: 'Expiry', icon: CalendarClock },
  ];

  return (
    <div className="p-6 text-gray-900">
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div className="inline-flex rounded-xl border border-gray-300 bg-white overflow-hidden mb-5">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-5 py-2 text-sm font-medium flex items-center gap-2 transition ${view === v.id ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {React.createElement(v.icon, { className: 'w-4 h-4' })}{v.label}
          </button>
        ))}
      </div>
      {view === 'reorder'
        ? <ReorderView medicines={medicines} coverDays={coverDays} setCoverDays={setCoverDays} targetDays={targetDays} setTargetDays={setTargetDays} />
        : <ExpiryView inventory={inventory} today={today} canEdit={canEdit} />}
    </div>
  );
};

export default ReorderExpiryDashboard;
