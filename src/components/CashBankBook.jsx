import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Pencil, Trash2, X, BookOpen, Settings } from 'lucide-react';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { buildLedger, summarize } from '../lib/cashBook';
import { getCurrentUser, isAdminUser, localDateString } from '../lib/expenses';

const SETTINGS_REF = () => doc(db, 'settings', 'cash_bank_book');

const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const blankIfZero = (n) => (n ? money(n) : '');
const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 dark:text-white';

// ── Opening balance (admin) ─────────────────────────────────────────────────
const OpeningModal = ({ settings, onClose }) => {
  const [cash, setCash] = useState(settings?.opening_cash ?? '');
  const [bank, setBank] = useState(settings?.opening_bank ?? '');
  const [date, setDate] = useState(settings?.opening_date || localDateString());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date) { alert('Please choose the date the book starts from'); return; }
    const user = getCurrentUser();
    setSaving(true);
    try {
      await setDoc(SETTINGS_REF(), {
        opening_cash: parseFloat(cash) || 0,
        opening_bank: parseFloat(bank) || 0,
        opening_date: date,
        updated_at: new Date().toISOString(),
        updated_by: user.email || '',
      }, { merge: true });
      onClose();
    } catch (e) {
      alert('Failed to save opening balance: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white text-gray-900 rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-teal-700 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-bold">Opening Balance</h2>
          <button onClick={onClose} className="hover:bg-teal-800 p-2 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            The balances you start the book with, and the date it starts. Receipts and payments dated before this date are not counted.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book starts on</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening cash (₹)</label>
              <input type="number" step="0.01" value={cash} onChange={e => setCash(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening bank (₹)</label>
              <input type="number" step="0.01" value={bank} onChange={e => setBank(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Receipt add / edit ──────────────────────────────────────────────────────
const ReceiptModal = ({ receipt, onClose }) => {
  const isEdit = Boolean(receipt);
  const [form, setForm] = useState({
    date: receipt?.date ? String(receipt.date).split('T')[0] : localDateString(),
    description: receipt?.description || '',
    party: receipt?.party || '',
    cash_amount: receipt?.cash_amount || '',
    bank_amount: receipt?.bank_amount || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    const cash = parseFloat(form.cash_amount) || 0;
    const bank = parseFloat(form.bank_amount) || 0;
    if (!form.date) { alert('Please choose a date'); return; }
    if (cash <= 0 && bank <= 0) { alert('Enter an amount in Cash, Bank or both'); return; }
    const user = getCurrentUser();
    const now = new Date().toISOString();
    const data = {
      date: form.date,
      description: form.description.trim(),
      party: form.party.trim(),
      cash_amount: cash,
      bank_amount: bank,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'cash_book_receipts', receipt.id), {
          ...data, updated_at: now, updated_by: user.email || '', updated_by_name: user.name || '',
        });
      } else {
        await addDoc(collection(db, 'cash_book_receipts'), {
          ...data, created_at: now, created_by: user.email || '', created_by_name: user.name || '',
        });
      }
      onClose();
    } catch (e) {
      alert('Failed to save receipt: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white text-gray-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Receipt' : 'Add Receipt'}</h2>
          <button onClick={onClose} className="hover:bg-green-700 p-2 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} className={inputCls} placeholder="e.g. treatment charge, sales, cash received" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
            <input type="text" value={form.party} onChange={e => set('party', e.target.value)} className={inputCls} placeholder="Patient / customer name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash received (₹)</label>
              <input type="number" min="0" step="0.01" value={form.cash_amount} onChange={e => set('cash_amount', e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank / UPI received (₹)</label>
              <input type="number" min="0" step="0.01" value={form.bank_amount} onChange={e => set('bank_amount', e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Receipt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
const CashBankBook = () => {
  const isAdmin = isAdminUser(getCurrentUser());
  const [settings, setSettings] = useState(undefined); // undefined = loading, null = not set up yet
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [messExpenses, setMessExpenses] = useState([]);
  const [error, setError] = useState('');
  const [fromPick, setFromPick] = useState(null);
  const [toPick, setToPick] = useState(null);
  const [showOpening, setShowOpening] = useState(false);
  const [receiptModal, setReceiptModal] = useState(null); // null | {} (new) | receipt (edit)

  // Live: every change to Expenses, Mess Expenses, receipts or the opening
  // balance is pushed here the moment it's saved — no refresh needed.
  useEffect(() => {
    const onErr = (e) => setError('Live updates failed: ' + e.message);
    const list = (setter) => (snap) => setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    const unsubs = [
      onSnapshot(SETTINGS_REF(), (snap) => setSettings(snap.exists() ? snap.data() : null), onErr),
      onSnapshot(collection(db, 'cash_book_receipts'), list(setReceipts), onErr),
      onSnapshot(collection(db, 'expenses'), list(setExpenses), onErr),
      onSnapshot(collection(db, 'mess_expenses'), list(setMessExpenses), onErr),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const openingCash = settings?.opening_cash || 0;
  const openingBank = settings?.opening_bank || 0;
  const openingDate = settings?.opening_date || '';
  const from = fromPick ?? openingDate;
  const to = toPick ?? localDateString();

  const { rows, unpaid } = useMemo(
    () => buildLedger({ openingCash, openingBank, openingDate, receipts, expenses, messExpenses }),
    [openingCash, openingBank, openingDate, receipts, expenses, messExpenses]
  );
  const visible = useMemo(() => rows.filter(r => (!from || r.date >= from) && (!to || r.date <= to)), [rows, from, to]);
  const sum = useMemo(() => summarize(rows, openingCash, openingBank, from, to), [rows, openingCash, openingBank, from, to]);

  const deleteReceipt = async (r) => {
    if (!window.confirm(`Delete this receipt?\n\n${fmtDate(r.date)} · ${r.description || '(no description)'} · ${r.party || ''}`)) return;
    try {
      await deleteDoc(doc(db, 'cash_book_receipts', r.id));
    } catch (e) {
      alert('Failed to delete receipt: ' + e.message);
    }
  };

  // Payments live in Expenses / Mess Expense, so editing one jumps there.
  const openPaymentSource = (r) => {
    if (r.kind === 'expense') {
      try { sessionStorage.setItem('expenses_open', JSON.stringify({ id: r.id, date: r.date })); } catch { /* storage unavailable */ }
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'expenses' }));
    } else {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'mess-expense' }));
    }
  };

  const exportExcel = () => {
    const aoa = [
      ['Cash & Bank Book'],
      [`${fmtDate(from)} to ${fmtDate(to)}`],
      ['Summary', 'Cash', 'Bank', 'Total'],
      ['Opening Balance', sum.openingCash, sum.openingBank, sum.openingCash + sum.openingBank],
      ['Total Receipts (+)', sum.cashIn, sum.bankIn, sum.cashIn + sum.bankIn],
      ['Total Payments (–)', sum.cashOut, sum.bankOut, sum.cashOut + sum.bankOut],
      ['Closing Balance', sum.closingCash, sum.closingBank, sum.closingCash + sum.closingBank],
      [],
      ['', '', '', 'Receipts', '', 'Payments'],
      ['Date', 'Description', 'Party', 'Cash Sale Dr', 'Bank Sale Dr', 'Cash Expense Cr', 'Bank Expense Cr', 'Cash Balance', 'Bank Balance'],
      ...visible.map(r => [r.date, r.description, r.party, r.cashIn || '', r.bankIn || '', r.cashOut || '', r.bankOut || '', r.cashBalance, r.bankBalance]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 14 }, { wch: 44 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash & Bank');
    XLSX.writeFile(wb, `Cash_Bank_Book_${to || localDateString()}.xlsx`);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-gray-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Cash &amp; Bank Book</h1>
            <p className="text-gray-600 text-sm">Payments fill in live from Expenses · receipts are entered here</p>
          </div>
        </div>
        {settings && (
          <div className="flex gap-3">
            <button onClick={() => setReceiptModal({})} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Add Receipt
            </button>
            <button onClick={exportExcel} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Download className="w-5 h-5" /> Export
            </button>
            {isAdmin && (
              <button onClick={() => setShowOpening(true)} className="px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Settings className="w-5 h-5" /> Opening Balance
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {settings === undefined && <p className="text-gray-500">Loading…</p>}

      {settings === null && (
        <div className="bg-white rounded-xl shadow-md p-8 text-center max-w-xl">
          <h2 className="text-xl font-bold mb-2">Set up the book</h2>
          <p className="text-gray-600 mb-4">
            Enter the cash and bank balances you are starting with, and the date the book starts from.
            Payments from Expenses dated on or after that date will then appear automatically.
          </p>
          {isAdmin ? (
            <button onClick={() => setShowOpening(true)} className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              Set opening balance
            </button>
          ) : (
            <p className="text-sm text-gray-500">Ask an administrator to set the opening balance.</p>
          )}
        </div>
      )}

      {settings && (
        <>
          {/* Summary — the sheet's Opening / Sales / Expenses / Closing block */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={from} onChange={e => setFromPick(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="date" value={to} onChange={e => setToPick(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 dark:text-white" />
              </div>
              <span className="text-xs text-gray-500 pb-2">Book starts {fmtDate(openingDate)}</span>
            </div>
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-3">Summary</th>
                  <th className="py-2 pr-3 text-right">Cash</th>
                  <th className="py-2 pr-3 text-right">Bank</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b"><td className="py-2 pr-3">Opening Balance</td><td className="py-2 pr-3 text-right">₹{money(sum.openingCash)}</td><td className="py-2 pr-3 text-right">₹{money(sum.openingBank)}</td><td className="py-2 text-right">₹{money(sum.openingCash + sum.openingBank)}</td></tr>
                <tr className="border-b"><td className="py-2 pr-3 text-green-700">Total Receipts (+)</td><td className="py-2 pr-3 text-right">₹{money(sum.cashIn)}</td><td className="py-2 pr-3 text-right">₹{money(sum.bankIn)}</td><td className="py-2 text-right">₹{money(sum.cashIn + sum.bankIn)}</td></tr>
                <tr className="border-b"><td className="py-2 pr-3 text-red-700">Total Payments (–)</td><td className="py-2 pr-3 text-right">₹{money(sum.cashOut)}</td><td className="py-2 pr-3 text-right">₹{money(sum.bankOut)}</td><td className="py-2 text-right">₹{money(sum.cashOut + sum.bankOut)}</td></tr>
                <tr className="font-bold"><td className="py-2 pr-3">Closing Balance</td><td className="py-2 pr-3 text-right">₹{money(sum.closingCash)}</td><td className="py-2 pr-3 text-right">₹{money(sum.closingBank)}</td><td className="py-2 text-right">₹{money(sum.closingCash + sum.closingBank)}</td></tr>
              </tbody>
            </table>
            {unpaid.count > 0 && (
              <p className="mt-3 text-xs text-amber-700">
                {unpaid.count} credit purchase{unpaid.count === 1 ? '' : 's'} (₹{money(unpaid.total)}) not shown — they have not been paid yet.
              </p>
            )}
          </div>

          {/* Ledger */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase">
                    <th colSpan={3}></th>
                    <th colSpan={2} className="py-1 text-center border-b border-green-200 text-green-700">Receipts</th>
                    <th colSpan={2} className="py-1 text-center border-b border-red-200 text-red-700">Payments</th>
                    <th colSpan={3}></th>
                  </tr>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Party</th>
                    <th className="py-2 pr-3 text-right">Cash</th>
                    <th className="py-2 pr-3 text-right">Bank</th>
                    <th className="py-2 pr-3 text-right">Cash</th>
                    <th className="py-2 pr-3 text-right">Bank</th>
                    <th className="py-2 pr-3 text-right">Cash Balance</th>
                    <th className="py-2 pr-3 text-right">Bank Balance</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(from)}</td>
                    <td className="py-2 pr-3 italic" colSpan={6}>Opening balance</td>
                    <td className="py-2 pr-3 text-right">{money(sum.openingCash)}</td>
                    <td className="py-2 pr-3 text-right">{money(sum.openingBank)}</td>
                    <td></td>
                  </tr>
                  {visible.map(r => (
                    <tr key={r.key} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-2 pr-3 max-w-xs break-words">
                        {r.description || '—'}
                        {r.kind !== 'receipt' && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 align-middle">{r.kind === 'mess' ? 'Mess Expense' : 'Expenses'}</span>}
                      </td>
                      <td className="py-2 pr-3">{r.party}</td>
                      <td className="py-2 pr-3 text-right text-green-700">{blankIfZero(r.cashIn)}</td>
                      <td className="py-2 pr-3 text-right text-green-700">{blankIfZero(r.bankIn)}</td>
                      <td className="py-2 pr-3 text-right text-red-700">{blankIfZero(r.cashOut)}</td>
                      <td className="py-2 pr-3 text-right text-red-700">{blankIfZero(r.bankOut)}</td>
                      <td className="py-2 pr-3 text-right font-medium">{money(r.cashBalance)}</td>
                      <td className="py-2 pr-3 text-right font-medium">{money(r.bankBalance)}</td>
                      <td className="py-2 whitespace-nowrap">
                        {r.kind === 'receipt' && (
                          <span className="inline-flex gap-1">
                            <button onClick={() => setReceiptModal(r.raw)} title="Edit" className="p-1.5 rounded hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteReceipt(r.raw)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </span>
                        )}
                        {r.kind !== 'receipt' && isAdmin && (
                          <button
                            onClick={() => openPaymentSource(r)}
                            title={r.kind === 'mess' ? 'Open in Mess Expense' : 'Edit this expense in Expenses'}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                          >
                            <Pencil className="w-3.5 h-3.5" /> {r.kind === 'mess' ? 'Open' : 'Edit'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan={10} className="py-8 text-center text-gray-500">No receipts or payments in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showOpening && <OpeningModal settings={settings} onClose={() => setShowOpening(false)} />}
      {receiptModal && <ReceiptModal receipt={receiptModal.id ? receiptModal : null} onClose={() => setReceiptModal(null)} />}
    </div>
  );
};

export default CashBankBook;
