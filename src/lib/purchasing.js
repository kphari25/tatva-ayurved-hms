// Hands a reorder list from Analytics over to Purchase Management by writing a
// purchase_requests document in exactly the shape the Purchase Request screen
// writes, so it shows up in Purchase Management and goes through its normal
// approval -> Purchase Order -> Goods Receipt flow.

import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUser } from './expenses';

// Same rule Purchase Management itself uses to decide who may approve a request
// (kept identical on purpose — this must never be looser than that screen).
export const canApprovePurchases = (user = getCurrentUser()) =>
  Boolean(user.permissions?.includes('all') || user.email?.includes('admin'));

// rows: reorder rows with { name, code, recordId, stock, reorderLevel, unitCost, order, priority }
export const createRequestFromReorder = async (rows, { preApproved = false } = {}) => {
  const user = getCurrentUser();
  const now = new Date().toISOString();

  const medicines = rows
    .map(r => ({
      medicine_id: r.recordId || '',
      medicine_name: r.name,
      item_code: r.code || '',
      current_stock: r.stock,
      reorder_level: r.reorderLevel || 0,
      quantity: Number(r.order) || 0,
      estimated_cost: r.unitCost || 0,
      category: '',
      unit: 'Nos',
    }))
    .filter(m => m.quantity > 0);

  if (medicines.length === 0) throw new Error('Enter an order quantity for at least one medicine.');

  const data = {
    request_id: `PR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    medicines,
    total_estimated: medicines.reduce((n, m) => n + m.quantity * m.estimated_cost, 0),
    requested_by: user.email || '',
    priority: rows.some(r => r.priority === 'urgent') ? 'high' : 'medium',
    status: preApproved ? 'approved' : 'pending_approval',
    source: 'analytics_reorder_list',
    notes: 'Created from Analytics → Reorder & Expiry',
    created_at: now,
    ...(preApproved ? { approval_by: user.email || '', approval_date: now } : {}),
  };

  const ref = await addDoc(collection(db, 'purchase_requests'), data);
  return { id: ref.id, ...data };
};
