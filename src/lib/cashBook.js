// Ledger logic for the Cash & Bank Book: turns receipts typed into the book plus
// payments pulled from Expenses (and the Mess Expense tracker) into one dated
// list with running Cash and Bank balances — the same maths as the original
// Cash_Bank_Book spreadsheet, without its fixed 500-row limit.

import { categoryLabel } from './expenses';

const dayOf = (v) => (typeof v === 'string' ? v.split('T')[0] : '');
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Which book column an expense's payment mode belongs to.
//   cash                                  -> Cash
//   card / UPI / bank / cheque / online   -> Bank
//   credit (bought now, paid later)       -> not a payment yet: left out
export const paymentColumn = (mode) => {
  const m = String(mode || '').trim().toLowerCase();
  if (m === 'credit') return 'unpaid';
  if (['card', 'upi', 'bank', 'bank transfer', 'cheque', 'check', 'online', 'neft', 'rtgs', 'imps'].includes(m)) return 'bank';
  return 'cash'; // 'cash', or no mode recorded
};

const firstLine = (s) => String(s || '').split('\n')[0].trim();

// receipts:     docs from cash_book_receipts
// expenses:     docs from expenses
// messExpenses: docs from mess_expenses
// openingDate:  entries dated before this are left out (the book "starts" here)
export const buildLedger = ({ openingCash = 0, openingBank = 0, openingDate = '', receipts = [], expenses = [], messExpenses = [] }) => {
  const entries = [];
  const unpaid = { count: 0, total: 0 };
  const included = (date) => date && (!openingDate || date >= openingDate);

  receipts.forEach(r => {
    const date = dayOf(r.date);
    if (!included(date)) return;
    entries.push({
      key: `r-${r.id}`, kind: 'receipt', id: r.id, date, created: r.created_at || '',
      description: r.description || '', party: r.party || '',
      cashIn: num(r.cash_amount), bankIn: num(r.bank_amount), cashOut: 0, bankOut: 0,
      raw: r,
    });
  });

  const addPayment = (kind, id, date, created, description, party, mode, amount) => {
    if (!included(date) || !(amount > 0)) return;
    const col = paymentColumn(mode);
    if (col === 'unpaid') {
      unpaid.count += 1;
      unpaid.total += amount;
      return;
    }
    entries.push({
      key: `${kind}-${id}`, kind, id, date, created: created || '',
      description, party,
      cashIn: 0, bankIn: 0,
      cashOut: col === 'cash' ? amount : 0,
      bankOut: col === 'bank' ? amount : 0,
    });
  };

  expenses.forEach(e => {
    const desc = firstLine(e.description);
    addPayment('expense', e.id, dayOf(e.date), e.created_at,
      desc ? `${categoryLabel(e.category)} — ${desc}` : categoryLabel(e.category),
      e.vendor || '', e.payment_mode, num(e.amount));
  });

  messExpenses.forEach(e => {
    const items = (e.items || []).map(it => it.name).filter(Boolean).join(', ');
    addPayment('mess', e.id, dayOf(e.date), e.created_at,
      items ? `Mess — ${items}` : 'Mess', e.vendor || '', e.payment_method, num(e.total_amount));
  });

  entries.sort((a, b) =>
    a.date.localeCompare(b.date) || a.created.localeCompare(b.created) || a.key.localeCompare(b.key));

  let cash = num(openingCash);
  let bank = num(openingBank);
  const rows = entries.map(e => {
    cash += e.cashIn - e.cashOut;
    bank += e.bankIn - e.bankOut;
    return { ...e, cashBalance: cash, bankBalance: bank };
  });

  return { rows, unpaid };
};

// Summary for rows between from..to (YYYY-MM-DD, either may be ''): the balance
// carried in, totals for the period, and the closing balance — the sheet's
// Opening / Total Sales / Total Expenses / Closing block.
export const summarize = (rows, openingCash, openingBank, from, to) => {
  let cash = num(openingCash);
  let bank = num(openingBank);
  const s = {
    openingCash: cash, openingBank: bank,
    cashIn: 0, bankIn: 0, cashOut: 0, bankOut: 0,
    closingCash: cash, closingBank: bank,
  };
  let carried = false;
  rows.forEach(r => {
    if (from && r.date < from) {
      cash = r.cashBalance;
      bank = r.bankBalance;
      return;
    }
    if (!carried) {
      s.openingCash = cash;
      s.openingBank = bank;
      s.closingCash = cash;
      s.closingBank = bank;
      carried = true;
    }
    if (to && r.date > to) return;
    s.cashIn += r.cashIn;
    s.bankIn += r.bankIn;
    s.cashOut += r.cashOut;
    s.bankOut += r.bankOut;
    s.closingCash = r.cashBalance;
    s.closingBank = r.bankBalance;
  });
  if (!carried) {
    s.openingCash = cash;
    s.openingBank = bank;
    s.closingCash = cash;
    s.closingBank = bank;
  }
  return s;
};
