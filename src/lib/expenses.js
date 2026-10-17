// Shared bits for the Expenses page: category list, current-user lookup,
// receipt image/PDF prep + AI scan call, and the change-diff used by the
// audit log (expense_audit_log collection).

export const EXPENSE_CATEGORIES = [
  { value: 'other', label: 'Other' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'mess', label: 'Mess' },
  { value: 'medicine_purchase', label: 'Medicine_purchase' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'rent', label: 'Rent' },
  { value: 'misc', label: 'Misc' },
  { value: 'salary', label: 'Salary' },
  { value: 'marketing', label: 'Marketing' },
];

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

export const categoryLabel = (value) =>
  EXPENSE_CATEGORIES.find(c => c.value === String(value || '').toLowerCase())?.label
  || (value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : '—');

export const paymentModeLabel = (value) =>
  PAYMENT_MODES.find(p => p.value === value)?.label || (value ? String(value) : '—');

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch {
    return {};
  }
};

export const isAdminUser = (user) =>
  ['system_admin', 'admin', 'Admin'].includes(user?.role);

// Expenses created automatically by Goods Receipt / PDF invoice import carry a
// GRN number and mirror a purchase record — editing them here would let the
// two drift apart, so the Expenses page treats them as read-only.
export const isSystemExpense = (expense) => Boolean(expense?.grn);

// Fields compared when logging an edit, with the label shown in the log.
const TRACKED_FIELDS = [
  ['date', 'Date'],
  ['category', 'Category'],
  ['amount', 'Amount'],
  ['description', 'Description'],
  ['payment_mode', 'Payment mode'],
  ['vendor', 'Vendor'],
  ['invoice', 'Invoice / Bill no.'],
];

export const diffExpense = (before, after) => {
  const changes = [];
  TRACKED_FIELDS.forEach(([field, label]) => {
    const from = before?.[field] ?? '';
    const to = after?.[field] ?? '';
    if (String(from) !== String(to)) changes.push({ field, label, from: String(from), to: String(to) });
  });
  return changes;
};

export const expenseSnapshot = (e) => ({
  date: e.date || '',
  category: e.category || '',
  amount: Number(e.amount) || 0,
  description: e.description || '',
  payment_mode: e.payment_mode || '',
  vendor: e.vendor || '',
  invoice: e.invoice || '',
});

// ---- Receipt scanning ------------------------------------------------------

const MAX_PDF_BYTES = 3 * 1024 * 1024; // request bodies are capped (~4.5MB) on Vercel
const MAX_STORED_IMAGE_CHARS = 700000; // keeps the expense doc well under Firestore's 1MB limit

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image file')); };
  img.src = url;
});

// Shrinks a phone photo (often 5-10MB) to a few hundred KB so it can be sent
// to the scan endpoint and saved with the expense. Tries progressively smaller
// sizes until it fits.
const compressImage = async (file) => {
  const img = await loadImage(file);
  const attempts = [[1600, 0.8], [1300, 0.7], [1000, 0.6]];
  let last = null;
  for (const [maxSide, quality] of attempts) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    last = canvas.toDataURL('image/jpeg', quality);
    if (last.length <= MAX_STORED_IMAGE_CHARS) return last;
  }
  return last;
};

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read that file'));
  reader.readAsDataURL(file);
});

// Returns { success, data, previewImage } — previewImage is the compressed
// image data URL for photos (saved with the expense), or null for PDFs.
export const scanExpenseDocument = async (file) => {
  try {
    let dataUrl;
    let previewImage = null;
    if (file.type === 'application/pdf') {
      if (file.size > MAX_PDF_BYTES) {
        throw new Error('PDF is too large to scan (max 3MB). Upload a photo of the bill instead, or enter the details manually.');
      }
      dataUrl = await readAsDataUrl(file);
    } else {
      dataUrl = await compressImage(file);
      previewImage = dataUrl.length <= MAX_STORED_IMAGE_CHARS ? dataUrl : null;
    }

    const mediaType = dataUrl.slice(5, dataUrl.indexOf(';'));
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const token = localStorage.getItem('sessionToken') || '';
    const response = await fetch('/api/parse-expense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ base64, mediaType }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Scan service unavailable (${response.status})`);
    }
    if (!response.ok || !result.success) {
      throw new Error(result.error || `Request failed (${response.status})`);
    }
    return { success: true, data: result.data, previewImage };
  } catch (error) {
    console.error('Error scanning expense document:', error);
    return { success: false, error: error.message };
  }
};
