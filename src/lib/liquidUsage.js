// Internal-only tracking of partial use of liquid stock (oils/thailam etc.)
// from the daily logs — never billed and never printed on any patient document.
//
// Inventory model for an item with pack_size > 0 (e.g. 100 ml bottles):
//   stock_quantity = SEALED bottles          (what Medicine Sale / purchases already use)
//   open_balance   = ml left in the opened bottle (may go negative = short)
//   open_batch     = batch the opened bottle came from
//   batches[]      = per-batch sealed-bottle counts, used for first-expiry-first-out
// Total ml on hand = stock_quantity * pack_size + open_balance.
//
// Every use is one document in `inventory_usage`, with a deterministic id
// (`<log entry id>_<row id>`), so re-saving or deleting a log entry first
// reverses what it previously used and then applies the new amount — it can
// never double count.
import { collection, doc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

export const hasPack = (item) => Number(item?.pack_size) > 0;

export const totalMl = (item) =>
  (Number(item?.stock_quantity) || 0) * (Number(item?.pack_size) || 0) + (Number(item?.open_balance) || 0);

// "3 sealed + 25 ml open"
export const liquidStockLabel = (item) => {
  const unit = item.pack_unit || 'ml';
  const open = Math.round((Number(item.open_balance) || 0) * 100) / 100;
  return `${Number(item.stock_quantity) || 0} sealed + ${open} ${unit} open`;
};

const today = () => new Date().toISOString().split('T')[0];

// First-expiry-first-out: earliest expiry first, batches without an expiry last.
const pickBatchIndex = (batches) => {
  let best = -1;
  batches.forEach((b, i) => {
    if (!(Number(b.quantity) > 0)) return;
    if (best === -1) { best = i; return; }
    const a = b.expiry_date || '9999-12-31', c = batches[best].expiry_date || '9999-12-31';
    if (String(a) < String(c)) best = i;
  });
  return best;
};

const consume = (inv, ml) => {
  const pack = Number(inv.pack_size);
  let sealed = Number(inv.stock_quantity) || 0;
  let open = Number(inv.open_balance) || 0;
  let openBatch = inv.open_batch || '';
  const batches = (inv.batches || []).map(b => ({ ...b }));
  const used = {};
  const add = (batch, amt) => { used[batch] = (used[batch] || 0) + amt; };
  let need = ml;
  const takeFromOpen = () => {
    const t = Math.min(Math.max(open, 0), need);
    if (t > 0) { open -= t; need -= t; add(openBatch, t); }
  };
  takeFromOpen();
  while (need > 0 && sealed > 0) {
    const bi = pickBatchIndex(batches);
    if (bi >= 0) { batches[bi].quantity = Number(batches[bi].quantity) - 1; openBatch = batches[bi].batch_number || ''; }
    else openBatch = '';
    sealed -= 1;
    open += pack;
    takeFromOpen();
  }
  const shortage = need > 0 ? need : 0;
  if (shortage > 0) { open -= shortage; add(openBatch, shortage); }
  return {
    patch: { stock_quantity: sealed, open_balance: Math.round(open * 100) / 100, open_batch: openBatch, batches },
    batchesUsed: Object.entries(used).map(([batch_number, amt]) => ({ batch_number, ml: Math.round(amt * 100) / 100 })),
    shortage,
  };
};

const restore = (inv, ml, batchesUsed) => {
  const pack = Number(inv.pack_size);
  let sealed = Number(inv.stock_quantity) || 0;
  let open = (Number(inv.open_balance) || 0) + ml;
  const batches = (inv.batches || []).map(b => ({ ...b }));
  const lastBatch = (batchesUsed && batchesUsed.length ? batchesUsed[batchesUsed.length - 1].batch_number : inv.open_batch) || '';
  // A full bottle's worth (or more) back in the open balance is just a sealed bottle again.
  while (open >= pack) {
    open -= pack;
    sealed += 1;
    const b = batches.find(x => (x.batch_number || '') === lastBatch);
    if (b) b.quantity = (Number(b.quantity) || 0) + 1;
  }
  return { stock_quantity: sealed, open_balance: Math.round(open * 100) / 100, batches };
};

const reverseUsage = async (usageId) => {
  await runTransaction(db, async (tx) => {
    const uRef = doc(db, 'inventory_usage', usageId);
    const uSnap = await tx.get(uRef);
    if (!uSnap.exists()) return;
    const u = uSnap.data();
    const iRef = doc(db, 'inventory', u.inventory_id);
    const iSnap = await tx.get(iRef);
    if (iSnap.exists()) {
      tx.update(iRef, { ...restore(iSnap.data(), Number(u.ml) || 0, u.batches_used), last_updated: new Date().toISOString() });
    }
    tx.delete(uRef);
  });
};

const applyUsage = async (usageId, row, meta) => {
  await runTransaction(db, async (tx) => {
    const iRef = doc(db, 'inventory', row.inventory_id);
    const iSnap = await tx.get(iRef);
    if (!iSnap.exists()) throw new Error(`"${row.item_name}" no longer exists in inventory.`);
    const inv = iSnap.data();
    if (!hasPack(inv)) throw new Error(`"${row.item_name}" has no pack size set in Inventory.`);
    const { patch, batchesUsed, shortage } = consume(inv, Number(row.ml_used));
    tx.update(iRef, { ...patch, last_updated: new Date().toISOString() });
    tx.set(doc(db, 'inventory_usage', usageId), {
      inventory_id: row.inventory_id,
      item_name: inv.item_name || row.item_name,
      item_code: inv.item_code || row.item_code || '',
      pack_size: Number(inv.pack_size),
      unit: inv.pack_unit || 'ml',
      ml: Number(row.ml_used),
      batches_used: batchesUsed,
      shortage,
      ...meta,
      created_at: new Date().toISOString(),
    });
  });
};

// Brings inventory in line with one log entry's current medicine rows.
// entry = { id, source: 'ip_daily_progress' | 'op_visit_log', date, patient_id, patient_name, mrd_number, ip_number }
// Only entries dated today or earlier count — a future-dated, pre-scheduled
// day (Treatment Days) is applied when the doctor edits and saves it on its own day.
export const syncEntryUsage = async (entry, items = []) => {
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}').email || '';
  const live = entry.date && entry.date <= today();
  const desired = {};
  if (live) {
    items.forEach(r => {
      if (r.inventory_id && Number(r.ml_used) > 0) desired[`${entry.id}_${String(r.id).replace(/[^A-Za-z0-9]/g, '')}`] = r;
    });
  }
  const existing = await getDocs(query(collection(db, 'inventory_usage'), where('source_entry_id', '==', entry.id)));
  const existingById = Object.fromEntries(existing.docs.map(d => [d.id, d.data()]));

  for (const [id, u] of Object.entries(existingById)) {
    const want = desired[id];
    if (!want || want.inventory_id !== u.inventory_id || Number(want.ml_used) !== Number(u.ml)) await reverseUsage(id);
  }
  const meta = {
    source: entry.source,
    source_entry_id: entry.id,
    date: entry.date,
    patient_id: entry.patient_id || '',
    patient_name: entry.patient_name || '',
    mrd_number: entry.mrd_number || '',
    ip_number: entry.ip_number || '',
    created_by: user,
  };
  for (const [id, row] of Object.entries(desired)) {
    const u = existingById[id];
    if (u && u.inventory_id === row.inventory_id && Number(u.ml) === Number(row.ml_used)) continue;
    await applyUsage(id, row, meta);
  }
};

// Deleting a log entry gives back everything it had used.
export const removeEntryUsage = async (entryId) => {
  const existing = await getDocs(query(collection(db, 'inventory_usage'), where('source_entry_id', '==', entryId)));
  for (const d of existing.docs) await reverseUsage(d.id);
};
