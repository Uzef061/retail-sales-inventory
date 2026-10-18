import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, AlertTriangle, AlertCircle, Clock, CheckCircle2, ShoppingBag, RefreshCw, PackagePlus } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SmartInventory() {
  const { t } = useApp();
  const [analytics, setAnalytics] = useState([]);
  const [summary, setSummary] = useState({ urgent: 0, reorder: 0, monitor: 0, healthy: 0 });
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick Restock Modal state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [restockQty, setRestockQty] = useState(10);
  const [supplierId, setSupplierId] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const fetchSmartAnalytics = async () => {
    try {
      setLoading(true);
      const [res, sRes] = await Promise.all([
        axios.get('/api/smart-inventory'),
        axios.get('/api/suppliers')
      ]);
      setAnalytics(res.data.analytics || []);
      setSummary(res.data.summary || { urgent: 0, reorder: 0, monitor: 0, healthy: 0 });
      setSuppliers(sRes.data || []);
    } catch (err) {
      console.error('Failed to fetch smart inventory analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSmartAnalytics();
  }, []);

  const openRestockModal = (item) => {
    setSelectedProduct(item);
    setRestockQty(item.suggestedReorderQty || item.reorderQuantity || 10);
    setUnitCost(item.costPrice || 0);
    setSupplierId('');
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      setRestockSubmitting(true);
      await axios.post('/api/purchases', {
        productId: selectedProduct._id,
        supplierId: supplierId || undefined,
        quantity: parseInt(restockQty) || 1,
        unitCostPrice: parseFloat(unitCost) || 0,
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: `Quick restock via Smart Inventory Recommendation`
      });
      alert(`Successfully restocked ${restockQty} units of ${selectedProduct.name}!`);
      setSelectedProduct(null);
      fetchSmartAnalytics();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to complete quick restock');
    } finally {
      setRestockSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'URGENT':
        return <span className="status-pill status-urgent"><AlertCircle size={14} /> Out of Stock</span>;
      case 'REORDER':
        return <span className="status-pill status-reorder"><AlertTriangle size={14} /> Reorder Now</span>;
      case 'MONITOR':
        return <span className="status-pill status-monitor"><Clock size={14} /> Low Supply</span>;
      case 'HEALTHY':
        return <span className="status-pill status-healthy"><CheckCircle2 size={14} /> Healthy</span>;
      default:
        return <span className="status-pill">{status}</span>;
    }
  };

  const filteredItems = analytics.filter((item) => {
    const matchesFilter = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title flex-title">
            <Sparkles className="sparkle-icon" size={26} /> {t('smartInventory') || 'Smart Inventory Analytics'}
          </h1>
          <p className="page-subtitle">
            Automated stock depletion velocity forecast & AI reorder recommendations
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchSmartAnalytics}>
          <RefreshCw size={16} /> Refresh Forecast
        </button>
      </div>

      {/* KPI Overview */}
      <div className="smart-kpi-grid">
        <div
          className={`smart-kpi-card urgent ${statusFilter === 'URGENT' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'URGENT' ? 'ALL' : 'URGENT')}
        >
          <div className="kpi-top">
            <AlertCircle size={22} className="text-danger" />
            <span className="kpi-count">{summary.urgent}</span>
          </div>
          <div className="kpi-label">Out of Stock (Urgent)</div>
        </div>

        <div
          className={`smart-kpi-card reorder ${statusFilter === 'REORDER' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'REORDER' ? 'ALL' : 'REORDER')}
        >
          <div className="kpi-top">
            <AlertTriangle size={22} className="text-warning" />
            <span className="kpi-count">{summary.reorder}</span>
          </div>
          <div className="kpi-label">Reorder Recommended</div>
        </div>

        <div
          className={`smart-kpi-card monitor ${statusFilter === 'MONITOR' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'MONITOR' ? 'ALL' : 'MONITOR')}
        >
          <div className="kpi-top">
            <Clock size={22} className="text-info" />
            <span className="kpi-count">{summary.monitor}</span>
          </div>
          <div className="kpi-label">Low Supply Warning</div>
        </div>

        <div
          className={`smart-kpi-card healthy ${statusFilter === 'HEALTHY' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'HEALTHY' ? 'ALL' : 'HEALTHY')}
        >
          <div className="kpi-top">
            <CheckCircle2 size={22} className="text-success" />
            <span className="kpi-count">{summary.healthy}</span>
          </div>
          <div className="kpi-label">Healthy Stock Levels</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card mt-4">
        <div className="card-header space-between flex-wrap">
          <div className="filter-tabs">
            {['ALL', 'URGENT', 'REORDER', 'MONITOR', 'HEALTHY'].map((filter) => (
              <button
                key={filter}
                className={`tab-btn ${statusFilter === filter ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'ALL' ? 'All Items' : filter}
              </button>
            ))}
          </div>

          <div className="search-bar-inline">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>30-Day Avg Sales</th>
                <th>Days Remaining</th>
                <th>Status</th>
                <th>Suggested Reorder</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4">Calculating smart stock forecast...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 muted-text">No inventory items match current filter.</td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id}>
                    <td className="fw-600">{item.name}</td>
                    <td>{item.category || 'General'}</td>
                    <td>
                      <span className={`stock-number ${item.stock <= 0 ? 'text-danger fw-700' : ''}`}>
                        {item.stock} units
                      </span>
                    </td>
                    <td>{item.avgDailySales} / day</td>
                    <td>
                      <span className="days-badge">
                        {item.daysRemaining === 999 ? '∞ (No Recent Sales)' : `${item.daysRemaining} days`}
                      </span>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <span className="fw-600 text-primary">+{item.suggestedReorderQty} units</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openRestockModal(item)}
                        title="Create Restock Order"
                      >
                        <PackagePlus size={14} /> Quick Restock
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Restock Modal */}
      {selectedProduct && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Quick Restock Order — {selectedProduct.name}</h3>
              <button className="close-btn" onClick={() => setSelectedProduct(null)}>×</button>
            </div>
            <form onSubmit={handleRestockSubmit} className="modal-body">
              <p className="muted-text mb-3">
                Current Stock: <strong>{selectedProduct.stock}</strong> | Status:{' '}
                <strong>{selectedProduct.status}</strong>
              </p>

              <div className="form-group">
                <label className="form-label">Supplier (Optional)</label>
                <select
                  className="form-control"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.companyName || 'Supplier'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Restock Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedProduct(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={restockSubmitting}>
                  {restockSubmitting ? 'Restocking...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .flex-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sparkle-icon {
          color: var(--primary);
        }

        .smart-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .smart-kpi-card {
          background-color: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .smart-kpi-card:hover, .smart-kpi-card.active-filter {
          transform: translateY(-2px);
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(201, 106, 61, 0.15);
        }

        .kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .kpi-count {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .kpi-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .filter-tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .tab-btn {
          background: none;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 0.4rem 0.85rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn.active {
          background-color: var(--primary);
          color: #ffffff;
          border-color: var(--primary);
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.65rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .status-urgent {
          background-color: rgba(220, 53, 69, 0.15);
          color: #dc3545;
        }

        .status-reorder {
          background-color: rgba(255, 193, 7, 0.2);
          color: #d39e00;
        }

        .status-monitor {
          background-color: rgba(13, 202, 240, 0.15);
          color: #0dcaf0;
        }

        .status-healthy {
          background-color: rgba(40, 167, 69, 0.15);
          color: #28a745;
        }

        .days-badge {
          background-color: var(--border-color);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-card {
          background: var(--card-bg);
          border-radius: var(--radius-md);
          width: 480px;
          max-width: 90vw;
          padding: 1.5rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--text-muted);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }
      `}</style>
    </div>
  );
}
