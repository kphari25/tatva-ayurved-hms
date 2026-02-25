import React, { useState, useEffect } from 'react';
import {
  Bell, AlertTriangle, Package, X, Check, Clock, TrendingDown,
  Archive, ShoppingCart, Calendar, AlertCircle, CheckCircle, Zap
} from 'lucide-react';

const NotificationSystem = ({ inventory = [], onDismiss, onReorder }) => {
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);

  // Generate notifications based on inventory
  useEffect(() => {
    const alerts = [];

    inventory.forEach(medicine => {
      const daysToExpiry = Math.floor((new Date(medicine.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      
      // Critical: Out of stock
      if (medicine.quantity === 0) {
        alerts.push({
          id: `out-${medicine.id}`,
          type: 'critical',
          category: 'out-of-stock',
          medicine: medicine.name,
          message: `${medicine.name} is OUT OF STOCK`,
          details: `Batch: ${medicine.batchNumber}`,
          timestamp: new Date().toISOString(),
          actionRequired: true,
          medicineId: medicine.id
        });
      }
      // High: Low stock
      else if (medicine.quantity <= medicine.reorderLevel) {
        alerts.push({
          id: `low-${medicine.id}`,
          type: 'high',
          category: 'low-stock',
          medicine: medicine.name,
          message: `${medicine.name} is running low`,
          details: `Current: ${medicine.quantity} ${medicine.unit} | Reorder at: ${medicine.reorderLevel}`,
          timestamp: new Date().toISOString(),
          actionRequired: true,
          medicineId: medicine.id
        });
      }

      // High: Expiring soon (< 30 days)
      if (daysToExpiry > 0 && daysToExpiry <= 30) {
        alerts.push({
          id: `exp-${medicine.id}`,
          type: 'high',
          category: 'expiring-soon',
          medicine: medicine.name,
          message: `${medicine.name} expiring in ${daysToExpiry} days`,
          details: `Expiry: ${new Date(medicine.expiryDate).toLocaleDateString()} | Stock: ${medicine.quantity}`,
          timestamp: new Date().toISOString(),
          actionRequired: true,
          medicineId: medicine.id
        });
      }
      // Medium: Expiring soon (30-60 days)
      else if (daysToExpiry > 30 && daysToExpiry <= 60) {
        alerts.push({
          id: `exp60-${medicine.id}`,
          type: 'medium',
          category: 'expiring-soon',
          medicine: medicine.name,
          message: `${medicine.name} expires in ${daysToExpiry} days`,
          details: `Plan for clearance sale | Stock: ${medicine.quantity}`,
          timestamp: new Date().toISOString(),
          actionRequired: false,
          medicineId: medicine.id
        });
      }

      // Low: Expiring (60-90 days)
      if (daysToExpiry > 60 && daysToExpiry <= 90 && medicine.quantity > 50) {
        alerts.push({
          id: `exp90-${medicine.id}`,
          type: 'low',
          category: 'expiring',
          medicine: medicine.name,
          message: `${medicine.name} approaching expiry`,
          details: `${daysToExpiry} days remaining | High stock: ${medicine.quantity}`,
          timestamp: new Date().toISOString(),
          actionRequired: false,
          medicineId: medicine.id
        });
      }
    });

    setNotifications(alerts.sort((a, b) => {
      const priority = { critical: 0, high: 1, medium: 2, low: 3 };
      return priority[a.type] - priority[b.type];
    }));
  }, [inventory]);

  const dismissNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
    if (onDismiss) onDismiss(id);
  };

  const handleReorder = (medicineId) => {
    if (onReorder) onReorder(medicineId);
    alert(`Reorder initiated for medicine ID: ${medicineId}`);
  };

  const criticalCount = notifications.filter(n => n.type === 'critical').length;
  const highCount = notifications.filter(n => n.type === 'high').length;
  const totalCount = notifications.length;

  return (
    <>
      {/* Notification Bell Icon */}
      <div className="fixed top-8 right-8 z-40">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="relative p-4 bg-white rounded-full shadow-2xl hover:shadow-3xl transition-all border-2 border-slate-200 hover:scale-110"
        >
          <Bell className={`w-7 h-7 ${totalCount > 0 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`} />
          {totalCount > 0 && (
            <span className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg animate-bounce">
              {totalCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Panel */}
      {showPanel && (
        <div className="fixed top-24 right-8 w-[480px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-7 h-7" />
                  Inventory Alerts
                </h3>
                <p className="text-red-100 text-sm mt-1">
                  {totalCount} notification{totalCount !== 1 ? 's' : ''} requiring attention
                </p>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 border-b-2 border-slate-200">
            <div className="bg-red-100 rounded-lg p-3 border border-red-300">
              <p className="text-xs text-red-700 font-semibold">Critical</p>
              <p className="text-2xl font-bold text-red-800">{criticalCount}</p>
            </div>
            <div className="bg-amber-100 rounded-lg p-3 border border-amber-300">
              <p className="text-xs text-amber-700 font-semibold">High</p>
              <p className="text-2xl font-bold text-amber-800">{highCount}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-3 border border-blue-300">
              <p className="text-xs text-blue-700 font-semibold">Total</p>
              <p className="text-2xl font-bold text-blue-800">{totalCount}</p>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[500px]">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
                <p className="font-semibold text-lg">All Clear!</p>
                <p className="text-sm mt-2">No inventory alerts at this time</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {notifications.map((notification) => {
                  const typeConfig = {
                    critical: {
                      bg: 'bg-red-50',
                      border: 'border-red-300',
                      icon: AlertCircle,
                      iconColor: 'text-red-600',
                      titleColor: 'text-red-800'
                    },
                    high: {
                      bg: 'bg-amber-50',
                      border: 'border-amber-300',
                      icon: AlertTriangle,
                      iconColor: 'text-amber-600',
                      titleColor: 'text-amber-800'
                    },
                    medium: {
                      bg: 'bg-blue-50',
                      border: 'border-blue-300',
                      icon: Clock,
                      iconColor: 'text-blue-600',
                      titleColor: 'text-blue-800'
                    },
                    low: {
                      bg: 'bg-slate-50',
                      border: 'border-slate-300',
                      icon: Archive,
                      iconColor: 'text-slate-600',
                      titleColor: 'text-slate-800'
                    }
                  };

                  const config = typeConfig[notification.type];
                  const Icon = config.icon;

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 ${config.bg} border-l-4 ${config.border} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 ${config.bg} rounded-full flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${config.iconColor}`} />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className={`font-bold ${config.titleColor}`}>
                                {notification.message}
                              </h4>
                              <p className="text-sm text-slate-600 mt-1">
                                {notification.details}
                              </p>
                            </div>
                            <button
                              onClick={() => dismissNotification(notification.id)}
                              className="p-1 hover:bg-white/50 rounded transition-colors"
                            >
                              <X className="w-4 h-4 text-slate-500" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                            {notification.actionRequired && (
                              <>
                                <span>•</span>
                                <span className="text-red-600 font-semibold">Action Required</span>
                              </>
                            )}
                          </div>

                          {notification.actionRequired && (
                            <div className="flex gap-2">
                              {notification.category === 'low-stock' || notification.category === 'out-of-stock' ? (
                                <button
                                  onClick={() => handleReorder(notification.medicineId)}
                                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold shadow-sm transition-all"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  Reorder Now
                                </button>
                              ) : null}
                              <button
                                onClick={() => dismissNotification(notification.id)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-semibold transition-all"
                              >
                                <Check className="w-4 h-4" />
                                Mark as Done
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Alert Banner (for critical alerts) */}
      {criticalCount > 0 && !showPanel && (
        <div className="fixed bottom-8 right-8 w-96 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-2xl shadow-2xl p-6 animate-pulse z-50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg mb-1">
                {criticalCount} Critical Alert{criticalCount !== 1 ? 's' : ''}!
              </h4>
              <p className="text-red-100 text-sm mb-3">
                Immediate action required for inventory issues
              </p>
              <button
                onClick={() => setShowPanel(true)}
                className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 font-semibold text-sm shadow-lg transition-all"
              >
                View Alerts
              </button>
            </div>
            <button
              onClick={() => setShowPanel(true)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationSystem;
