import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  PackageCheck,
  Plus,
  Minus,
  Search,
  Calendar,
  Building2,
  Package,
  RefreshCw,
  History,
  RotateCcw,
  Truck,
  DollarSign,
  Boxes
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Purchases({ defaultTab = 'new' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useApp();

  // Active view tab state ('new' or 'history')
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('/history')) return 'history';
    return defaultTab;
  });

  useEffect(() => {
    if (location.pathname.includes('/history')) {
      if (activeTab !== 'history') setActiveTab('history');
    } else if (location.pathname.includes('/purchases')) {
      if (activeTab !== 'new') setActiveTab('new');
    }
  }, [location.pathname]);

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    if (tabKey === 'history') {
      navigate('/purchases/history');
    } else {
      navigate('/purchases');
    }
  };

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // New Purchase Form State
  const [formData, setFormData] = useState({
    supplierId: '',
    productId: '',
    quantity: 1,
    unitCostPrice: 0,
    amountPaid: 0,
    paymentMode: 'UNPAID', // 'UNPAID', 'PAID', 'PARTIALLY_PAID'
    paymentMethod: 'CASH',
    purchaseDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pRes, sRes, prodRes] = await Promise.all([
        axios.get('/api/purchases', { timeout: 15000 }),
        axios.get('/api/suppliers', { timeout: 15000 }),
        axios.get('/api/products', { timeout: 15000 })
      ]);
      setPurchases(pRes.data || []);
      setSuppliers(sRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Failed to fetch restock purchases data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load restock data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProductChange = (productId) => {
    const prod = products.find((p) => p._id === productId);
    const newUnitCost = prod ? (prod.costPrice || Math.round((prod.sellingPrice || prod.price || 0) * 0.7)) : formData.unitCostPrice;
    const newTotal = (Number(formData.quantity) || 1) * newUnitCost;
    setFormData((prev) => ({
      ...prev,
      productId,
      unitCostPrice: newUnitCost,
      amountPaid: prev.paymentMode === 'PAID' ? newTotal : (prev.paymentMode === 'UNPAID' ? 0 : prev.amountPaid)
    }));
  };

  const handleClearForm = () => {
    setFormData({
      supplierId: '',
      productId: '',
      quantity: 1,
      unitCostPrice: 0,
      amountPaid: 0,
      paymentMode: 'UNPAID',
      paymentMethod: 'CASH',
      purchaseDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      notes: ''
    });
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;

    setSuccessMsg('');
    setError(null);

    if (!formData.productId) {
      setError('Please select a product to restock.');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      setError('Restock quantity must be at least 1 unit.');
      return;
    }
    if (formData.unitCostPrice < 0) {
      setError('Unit cost price cannot be negative.');
      return;
    }

    try {
      setSubmitting(true);
      const paidAmount = Number(formData.amountPaid) || 0;
      const payload = {
        supplier: formData.supplierId || undefined,
        product: formData.productId,
        quantity: Number(formData.quantity),
        costPrice: Number(formData.unitCostPrice),
        amountPaid: paidAmount,
        paymentMethod: formData.paymentMethod || 'CASH',
        purchaseDate: formData.purchaseDate,
        referenceNumber: formData.referenceNumber,
        notes: formData.notes
      };
      const res = await axios.post('/api/purchases', payload);
      setSuccessMsg(`Restock purchase order recorded successfully! Ref: ${res.data?.referenceNumber || 'PO'}. Product stock updated in inventory.`);
      handleClearForm();
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to record purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProd = products.find((p) => p._id === formData.productId);
  const totalCost = (Number(formData.quantity) || 0) * (Number(formData.unitCostPrice) || 0);
  const paidAmount = Number(formData.amountPaid) || 0;
  const remainingPayable = Math.max(0, totalCost - paidAmount);

  // Filtering for Purchase History
  const filteredPurchases = purchases.filter((p) => {
    if (!p) return false;
    const prodName = (p.product?.name || '').toLowerCase();
    const suppName = (p.supplier?.name || p.supplier?.companyName || 'direct').toLowerCase();
    const ref = (p.referenceNumber || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();

    const matchesSearch = prodName.includes(term) || suppName.includes(term) || ref.includes(term);
    const matchesSupplier =
      supplierFilter === 'ALL' ||
      p.supplier?._id === supplierFilter ||
      p.supplier === supplierFilter;

    return matchesSearch && matchesSupplier;
  });

  const totalSpent = purchases.reduce(
    (sum, item) =>
      sum +
      (Number(item.totalCost) ||
        Number(item.quantity || 0) * Number(item.unitCostPrice || item.costPrice || 0) ||
        0),
    0
  );
  const totalUnitsRestocked = purchases.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div className="page-wrapper">
      <div className="page-header space-between flex-wrap">
        <div>
          <h1 className="page-title">
            {activeTab === 'new' ? 'New Purchase Order' : 'Purchase Order History'}
          </h1>
          <p className="page-subtitle">
            {activeTab === 'new'
              ? 'Record incoming stock shipments from suppliers and update product inventory'
              : 'View and track all historical inventory restocking purchase orders'}
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="module-subnav-tabs">
          <button
            className={`subnav-tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => switchTab('new')}
          >
            <PackageCheck size={16} /> New Purchase Order
          </button>
          <button
            className={`subnav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => switchTab('history')}
          >
            <History size={16} /> Purchase History ({purchases.length})
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.1rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#16a34a' }}>
          <span>✅ {successMsg}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setSuccessMsg('')} style={{ padding: '0.2rem 0.5rem', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {error && (
        <div className="alert alert-error mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-sm btn-secondary" onClick={fetchData} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* VIEW A: NEW PURCHASE ENTRY SCREEN */}
      {activeTab === 'new' && (
        <div className="purchase-entry-grid">
          {/* Left Side: Entry Form */}
          <div className="card">
            <h3 className="card-title flex-title mb-3">
              <PackageCheck size={18} color="var(--primary)" /> Restock Order Details
            </h3>

            <form onSubmit={handleSubmit} className="purchase-form">
              <div className="form-group">
                <label className="form-label">Supplier (Optional)</label>
                <select
                  className="form-control"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                >
                  <option value="">-- Direct Restock / Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.companyName || s.phone || 'Supplier'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Product to Restock *</label>
                <select
                  className="form-control"
                  value={formData.productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Current Stock: {p.stock} units)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Restock Quantity *</label>
                  <div className="qty-stepper" style={{ width: '100%' }}>
                    <button
                      type="button"
                      className="qty-stepper-btn"
                      onClick={() => setFormData({ ...formData, quantity: Math.max(1, formData.quantity - 1) })}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      className="qty-stepper-input no-spinner"
                      style={{ flex: 1, width: '100%' }}
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                      }
                      required
                    />
                    <button
                      type="button"
                      className="qty-stepper-btn"
                      onClick={() => setFormData({ ...formData, quantity: formData.quantity + 1 })}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Cost Price *</label>
                  <div className="input-group">
                    <span className="input-group-addon addon-left">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control has-addon-left no-spinner"
                      value={formData.unitCostPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, unitCostPrice: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Purchase Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.purchaseDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Invoice / Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g. PO-SUPP-892"
                  className="form-control"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                />
              </div>

              {/* Payment Section */}
              <div className="form-group" style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label className="form-label fw-700" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Amount Paid to Supplier Now (₹) *
                </label>
                <div className="input-group">
                  <span className="input-group-addon addon-left">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control has-addon-left no-spinner"
                    value={formData.amountPaid}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      let mode = 'PARTIALLY_PAID';
                      if (val <= 0) mode = 'UNPAID';
                      else if (val >= totalCost && totalCost > 0) mode = 'PAID';
                      setFormData({ ...formData, amountPaid: val, paymentMode: mode });
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Helper chips */}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', background: formData.amountPaid === 0 ? 'var(--primary)' : 'white', color: formData.amountPaid === 0 ? 'white' : 'var(--text-color)' }}
                    onClick={() => setFormData({ ...formData, amountPaid: 0, paymentMode: 'UNPAID' })}
                  >
                    ₹0 Credit (Unpaid)
                  </button>
                  {totalCost > 0 && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', background: 'white' }}
                        onClick={() => setFormData({ ...formData, amountPaid: Math.round(totalCost * 0.5), paymentMode: 'PARTIALLY_PAID' })}
                      >
                        50% (₹{Math.round(totalCost * 0.5).toLocaleString('en-IN')})
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border-color)', background: formData.amountPaid >= totalCost ? 'var(--primary)' : 'white', color: formData.amountPaid >= totalCost ? 'white' : 'var(--text-color)' }}
                        onClick={() => setFormData({ ...formData, amountPaid: totalCost, paymentMode: 'PAID' })}
                      >
                        Full ₹{totalCost.toLocaleString('en-IN')} Paid
                      </button>
                    </>
                  )}
                </div>

                {paidAmount > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Payment Method / Source</label>
                    <select
                      className="form-control"
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / Google Pay</option>
                      <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Batch Memo</label>
                <textarea
                  placeholder="Delivery details, payment status notes..."
                  className="form-control"
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="form-actions-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClearForm}
                >
                  <RotateCcw size={15} /> Clear Form
                </button>
              </div>
            </form>
          </div>

          {/* Right Side: Total Summary & Order Trigger */}
          <div className="card purchase-summary-card">
            <h3 className="card-title flex-title mb-3">
              <DollarSign size={18} color="var(--primary)" /> Purchase Summary
            </h3>

            <div className="summary-display-box">
              <div className="display-label">Calculated Total Cost</div>
              <div className="display-value">₹{totalCost.toLocaleString('en-IN')}</div>
              <div className="display-sub">
                {formData.quantity || 0} units × ₹{formData.unitCostPrice || 0} / unit
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
              <span className="muted-text">Amount Paid Now:</span>
              <strong style={{ color: 'var(--success, #10b981)' }}>₹{paidAmount.toLocaleString('en-IN')}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', marginBottom: '1rem', fontSize: '0.95rem' }}>
              <span className="fw-700">Added to Supplier Payable (TO PAY):</span>
              <strong style={{ color: remainingPayable > 0 ? 'var(--error, #ef4444)' : 'var(--success, #10b981)', fontSize: '1.05rem' }}>
                ₹{remainingPayable.toLocaleString('en-IN')}
              </strong>
            </div>

            {selectedProd ? (
              <div className="prod-stock-preview">
                <div className="preview-line">
                  <span className="muted-text">Target Product:</span>
                  <strong className="text-primary">{selectedProd.name}</strong>
                </div>
                <div className="preview-line">
                  <span className="muted-text">Current Stock:</span>
                  <span>{selectedProd.stock} units</span>
                </div>
                <div className="preview-line" style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-color)' }}>
                  <span className="muted-text">Stock After Restock:</span>
                  <strong className="text-success fw-700">
                    {selectedProd.stock + (Number(formData.quantity) || 0)} units (+{formData.quantity})
                  </strong>
                </div>
              </div>
            ) : (
              <div className="prod-stock-preview text-center muted-text" style={{ padding: '1rem' }}>
                Select a product on the left to preview inventory update
              </div>
            )}

            <div className="info-notice-box mb-4">
              <p>
                <strong>Automatic Stock Increment:</strong> Submitting this restock order will automatically update product stock in inventory and record a <code>PURCHASE</code> audit entry.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary submit-purchase-btn"
              onClick={handleSubmit}
              disabled={submitting || !formData.productId}
            >
              <PackageCheck size={18} />
              {submitting ? 'Recording Order...' : 'Record Purchase Order'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW B: DEDICATED FULL-WIDTH PURCHASE HISTORY */}
      {activeTab === 'history' && (
        <div className="card full-width-card">
          {/* History KPI Cards */}
          <div className="purchase-kpi-summary">
            <div className="purchase-kpi-pill">
              <DollarSign size={20} className="kpi-icon text-primary" />
              <div>
                <div className="kpi-num">₹{totalSpent.toLocaleString('en-IN')}</div>
                <div className="kpi-lbl">Total Spent</div>
              </div>
            </div>

            <div className="purchase-kpi-pill">
              <Boxes size={20} className="kpi-icon text-success" />
              <div>
                <div className="kpi-num">+{totalUnitsRestocked} units</div>
                <div className="kpi-lbl">Total Units Restocked</div>
              </div>
            </div>

            <div className="purchase-kpi-pill">
              <PackageCheck size={20} className="kpi-icon text-info" />
              <div>
                <div className="kpi-num">{purchases.length}</div>
                <div className="kpi-lbl">Total Purchase Orders</div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="history-filter-bar">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="form-control search-input"
                placeholder="Search by product, supplier, or reference #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-selectors">
              <select
                className="form-control form-control-sm"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Full-width History Table */}
          {loading ? (
            <p className="empty-state">Loading restock orders...</p>
          ) : filteredPurchases.length === 0 ? (
            <p className="empty-state">No restock purchase orders found matching your filter.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table full-width-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref #</th>
                    <th>Product</th>
                    <th>Supplier</th>
                    <th>Qty Restocked</th>
                    <th>Cost/Unit</th>
                    <th>Total Cost</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((item) => (
                    <tr key={item._id}>
                      <td className="text-muted text-sm">
                        {new Date(item.purchaseDate || item.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="fw-700 font-mono text-primary">
                        {item.referenceNumber || `PO-${item._id ? item._id.slice(-6).toUpperCase() : 'N/A'}`}
                      </td>
                      <td className="fw-600">{item.product?.name || 'Unknown Product'}</td>
                      <td>
                        {item.supplier?.name || item.supplier?.companyName || (
                          <span className="muted-text">Direct Restock</span>
                        )}
                      </td>
                      <td>
                        <span className="stock-badge in-stock">+{item.quantity} units</span>
                      </td>
                      <td>₹{item.unitCostPrice?.toLocaleString('en-IN') || item.costPrice?.toLocaleString('en-IN')}</td>
                      <td className="fw-700">₹{item.totalCost?.toLocaleString('en-IN')}</td>
                      <td className="muted-text text-sm max-w-notes">
                        {item.notes || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        .purchase-entry-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
          gap: 1.25rem;
          align-items: start;
        }

        .purchase-form {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .form-actions-row {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .summary-display-box {
          background: rgba(201, 106, 61, 0.08);
          border: 1px solid rgba(201, 106, 61, 0.25);
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
          margin-bottom: 1rem;
        }

        .display-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 0.2rem;
        }

        .display-value {
          font-size: 1.7rem;
          font-weight: 800;
          color: var(--primary);
        }

        .display-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 0.2rem;
        }

        .prod-stock-preview {
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 0.85rem 1rem;
          margin-bottom: 1rem;
        }

        .preview-line {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          margin-bottom: 0.35rem;
        }

        .info-notice-box {
          font-size: 0.8rem;
          color: var(--text-muted);
          background: rgba(0, 0, 0, 0.02);
          border-left: 3px solid var(--primary);
          padding: 0.65rem 0.85rem;
          border-radius: 0 4px 4px 0;
        }

        .submit-purchase-btn {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.95rem;
          font-weight: 700;
          min-height: 44px;
        }

        .purchase-kpi-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .purchase-kpi-pill {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 0.85rem 1rem;
          border-radius: var(--radius-sm);
        }

        .kpi-num {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-main);
        }

        .kpi-lbl {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .max-w-notes {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 992px) {
          .purchase-entry-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
