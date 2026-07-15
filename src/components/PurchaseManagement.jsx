import React, { useState, useEffect } from 'react';
import { ShoppingCart, CheckCircle, XCircle, Clock, FileText, Package, AlertTriangle, Plus, Search, Filter, Download, Send, Eye } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';
import PurchaseRequestModal from './PurchaseRequestModal';
import PurchaseOrderModal from './PurchaseOrderModal';
import GoodsReceiptModal from './GoodsReceiptModal';
import ViewPurchaseRequestModal from './ViewPurchaseRequestModal';

const PurchaseManagement = () => {
  const [activeTab, setActiveTab] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const tabs = [
    { id: 'requests', label: 'Purchase Requests', icon: FileText },
    { id: 'orders', label: 'Purchase Orders', icon: ShoppingCart },
    { id: 'receipts', label: 'Goods Receipt', icon: Package }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Requests and orders both feed the stats cards, which are visible regardless
      // of which tab is active, so keep them loaded together rather than per-tab.
      const requestsRef = collection(db, 'purchase_requests');
      const requestsQ = query(requestsRef, orderBy('created_at', 'desc'));
      const ordersRef = collection(db, 'purchase_orders');
      const ordersQ = query(ordersRef, orderBy('po_date', 'desc'));
      const [requestsSnap, ordersSnap] = await Promise.all([getDocs(requestsQ), getDocs(ordersQ)]);
      setPurchaseRequests(requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPurchaseOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      if (activeTab === 'receipts') {
        const receiptsRef = collection(db, 'goods_receipt_notes');
        const q = query(receiptsRef, orderBy('received_date', 'desc'));
        const snapshot = await getDocs(q);
        setGoodsReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      sent_to_vendor: 'bg-blue-100 text-blue-800',
      received: 'bg-green-100 text-green-800',
      partially_received: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Purchase Management</h1>
              <p className="text-gray-600 text-sm">Medicine procurement and inventory tracking</p>
            </div>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Request
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Pending Requests"
          value={purchaseRequests.filter(r => r.status === 'pending_approval').length}
          icon={Clock}
          color="#f59e0b"
          subtitle="Awaiting approval"
        />
        <StatCard
          title="Active POs"
          value={purchaseOrders.filter(po => po.status === 'sent_to_vendor').length}
          icon={FileText}
          color="#3b82f6"
          subtitle="With vendors"
        />
        <StatCard
          title="Pending GRN"
          value={purchaseOrders.filter(po => po.status === 'sent_to_vendor').length}
          icon={Package}
          color="#8b5cf6"
          subtitle="To be received"
        />
        <StatCard
          title="This Month"
          value={`₹${purchaseOrders.filter(po => {
            const poDate = new Date(po.po_date);
            const now = new Date();
            return poDate.getMonth() === now.getMonth() && poDate.getFullYear() === now.getFullYear();
          }).reduce((sum, po) => sum + (po.grand_total || 0), 0).toLocaleString()}`}
          icon={ShoppingCart}
          color="#10b981"
          subtitle="Purchase value"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md mb-6">
        <div className="flex border-b">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'requests' && (
        <PurchaseRequestsTab
          requests={purchaseRequests}
          loading={loading}
          onApprove={(request) => {
            setSelectedRequest(request);
            setShowPOModal(true);
          }}
          onReload={loadData}
        />
      )}

      {activeTab === 'orders' && (
        <PurchaseOrdersTab
          orders={purchaseOrders}
          loading={loading}
          onReceive={(po) => {
            setSelectedPO(po);
            setShowGRNModal(true);
          }}
        />
      )}

      {activeTab === 'receipts' && (
        <GoodsReceiptsTab
          receipts={goodsReceipts}
          loading={loading}
        />
      )}

      {/* Modals */}
      {showRequestModal && (
        <PurchaseRequestModal
          onClose={() => setShowRequestModal(false)}
          onSave={() => {
            setShowRequestModal(false);
            loadData();
          }}
        />
      )}

      {showPOModal && selectedRequest && (
        <PurchaseOrderModal
          request={selectedRequest}
          onClose={() => {
            setShowPOModal(false);
            setSelectedRequest(null);
          }}
          onSave={() => {
            setShowPOModal(false);
            setSelectedRequest(null);
            loadData();
          }}
        />
      )}

      {showGRNModal && selectedPO && (
        <GoodsReceiptModal
          po={selectedPO}
          onClose={() => {
            setShowGRNModal(false);
            setSelectedPO(null);
          }}
          onSave={() => {
            setShowGRNModal(false);
            setSelectedPO(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// Purchase Requests Tab
const PurchaseRequestsTab = ({ requests, loading, onApprove, onReload }) => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isApprover = currentUser.permissions?.includes('all') || currentUser.email?.includes('admin');
  const [viewingRequest, setViewingRequest] = useState(null);

  const handleApprove = async (request) => {
    if (!isApprover) {
      alert('You do not have permission to approve requests');
      return;
    }

    if (!confirm(`Approve purchase request ${request.request_id}?`)) return;

    try {
      await updateDoc(doc(db, 'purchase_requests', request.id), {
        status: 'approved',
        approval_by: currentUser.email,
        approval_date: new Date().toISOString()
      });

      alert('✅ Request approved! You can now create a Purchase Order.');
      onReload();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request: ' + error.message);
    }
  };

  const handleReject = async (request) => {
    if (!isApprover) {
      alert('You do not have permission to reject requests');
      return;
    }

    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      await updateDoc(doc(db, 'purchase_requests', request.id), {
        status: 'rejected',
        rejection_by: currentUser.email,
        rejection_date: new Date().toISOString(),
        rejection_reason: reason
      });

      alert('Request rejected');
      onReload();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">No purchase requests yet</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Estimated Cost</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map(request => (
              <tr key={request.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{request.request_id}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {new Date(request.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{request.requested_by}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{request.medicines?.length || 0} items</td>
                <td className="px-6 py-4 text-sm text-gray-700 text-right">
                  ₹{request.total_estimated?.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                    {request.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setViewingRequest(request)}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {request.status === 'pending_approval' && isApprover && (
                      <>
                        <button
                          onClick={() => handleApprove(request)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <button
                        onClick={() => onApprove(request)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Create PO
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {viewingRequest && (
      <ViewPurchaseRequestModal
        request={viewingRequest}
        onClose={() => setViewingRequest(null)}
      />
    )}
    </>
  );
};

// Purchase Orders Tab
const PurchaseOrdersTab = ({ orders, loading, onReceive }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading purchase orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">No purchase orders yet</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      sent_to_vendor: 'bg-blue-100 text-blue-800',
      partially_received: 'bg-orange-100 text-orange-800',
      received: 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map(po => (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {new Date(po.po_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{po.vendor?.name}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{po.items?.length || 0} items</td>
                <td className="px-6 py-4 text-sm text-gray-700 text-right">
                  ₹{po.grand_total?.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(po.status)}`}>
                    {po.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {po.status === 'sent_to_vendor' && (
                      <button
                        onClick={() => onReceive(po)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Receive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Goods Receipts Tab
const GoodsReceiptsTab = ({ receipts, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading goods receipts...</p>
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">No goods receipts yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GRN Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {receipts.map(grn => (
              <tr key={grn.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{grn.grn_number}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {new Date(grn.received_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{grn.po_number}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{grn.vendor_name}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{grn.items_received?.length || 0} items</td>
                <td className="px-6 py-4 text-sm text-gray-700">{grn.received_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseManagement;
