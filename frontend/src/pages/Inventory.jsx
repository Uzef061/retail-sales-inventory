import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Boxes,
  RefreshCw,
  Plus,
  CheckCircle2,
  Calculator,
  Trash2,
  History,
  Layers,
  Search,
  Edit2,
  AlertTriangle,
  PackageX,
  PackageCheck
} from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'ledger'
  const [products, setProducts] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const { t } = useApp();

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'IN' | 'LOW' | 'OUT'

  // Selection State for Bulk Deletion
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // Add/Edit Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    costPrice: '',
    sellingPrice: '',
    stock: ''
  });
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/products');
      setProducts(res.data);
      setSelectedProductIds([]); // reset selection
    } catch (err) {
      console.error('Failed to fetch inventory', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    try {
      setLedgerLoading(true);
      const res = await axios.get('/api/inventory/ledger');
      setLedgerEntries(res.data || []);
    } catch (err) {
      console.error('Failed to fetch inventory ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger();
    }
  }, [activeTab]);

  const getStockStatus = (stock) => {
    if (stock === 0) {
      return { label: t('outOfStock') || 'Out of Stock', class: 'badge-out-of-stock' };
    }
    if (stock <= 10) {
      return { label: t('lowStock') || 'Low Stock', class: 'badge-low-stock' };
    }
    return { label: t('inStock') || 'In Stock', class: 'badge-in-stock' };
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', category: '', costPrice: '', sellingPrice: '', stock: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      costPrice: product.costPrice !== undefined ? product.costPrice : Math.round((product.sellingPrice || product.price || 0) * 0.7),
      sellingPrice: product.sellingPrice || product.price || 0,
      stock: product.stock
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleProductFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    const { name, category, costPrice, sellingPrice, stock } = formData;
    if (!name || !category || costPrice === '' || sellingPrice === '' || stock === '') {
      setFormError('Please fill in all product details.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingProduct) {
        await axios.put(`/api/products/${editingProduct._id}`, {
          name,
          category,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stock: Number(stock)
        });
        setSuccessMsg(`Product "${name}" updated successfully!`);
      } else {
        await axios.post('/api/products', {
          name,
          category,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stock: Number(stock)
        });
        setSuccessMsg(t('productAddedSuccess') || `Product "${name}" added successfully!`);
      }

      setIsModalOpen(false);
      fetchInventory();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletion Handlers
  const handleDeleteProduct = async (id, prodName) => {
    if (window.confirm(`Are you sure you want to remove ${prodName || 'this product'} from inventory?`)) {
      try {
        await axios.delete(`/api/products/${id}`);
        fetchInventory();
      } catch (err) {
        alert('Failed to delete product.');
      }
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    if (window.confirm(t('confirmBulkDeleteInventory', { count: selectedProductIds.length }) || `Delete ${selectedProductIds.length} selected products?`)) {
      try {
        await axios.post('/api/products/bulk-delete', { ids: selectedProductIds });
        fetchInventory();
      } catch (err) {
        alert('Failed to delete selected products.');
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedProductIds(filteredProducts.map((p) => p._id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleToggleSelectProduct = (id) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter((item) => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'PURCHASE':
      case 'OPENING':
        return 'type-badge-add';
      case 'SALE':
        return 'type-badge-subtract';
      case 'SALE_CANCELLED':
      case 'RETURN':
        return 'type-badge-restore';
      default:
        return 'type-badge-neutral';
    }
  };

  // Calculations for filter pills
  const inStockCount = products.filter((p) => p.stock > 10).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      p.name?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (stockFilter === 'LOW') return p.stock > 0 && p.stock <= 10;
    if (stockFilter === 'OUT') return p.stock === 0;
    if (stockFilter === 'IN') return p.stock > 10;
    return true;
  });

  const cp = Number(formData.costPrice || 0);
  const sp = Number(formData.sellingPrice || 0);
  const expectedProfitPerUnit = sp - cp;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('inventoryTitle') || 'Stock & Inventory'}</h1>
          <p className="page-subtitle">Track real-time stock levels, cost & selling prices, and movement audits</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {selectedProductIds.length > 0 && activeTab === 'stock' && (
            <button className="btn btn-danger" onClick={handleBulkDeleteProducts}>
              <Trash2 size={16} />
              {t('deleteSelected', { count: selectedProductIds.length }) || `Delete Selected (${selectedProductIds.length})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} />
            {t('addProduct') || '+ Add Product'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={activeTab === 'stock' ? fetchInventory : fetchLedger}
          >
            <RefreshCw size={15} />
            {t('refreshStock') || 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inventory-nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <Layers size={16} /> Current Stock Status ({products.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <History size={16} /> Stock Movement Audit Ledger
        </button>
      </div>

      {successMsg && (
        <div
          style={{
            color: 'var(--badge-in-stock-color)',
            backgroundColor: 'var(--badge-in-stock-bg)',
            border: '1px solid var(--border-color)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            marginBottom: '1.25rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {/* TAB 1: STOCK STATUS */}
      {activeTab === 'stock' && (
        <>
          {/* Search Bar & Status Filter Pills */}
          <div className="card mb-4" style={{ padding: '0.85rem 1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
              <div className="search-container" style={{ minWidth: '260px', flex: 1 }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search product by name or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Quick Status Filter Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`filter-pill ${stockFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setStockFilter('ALL')}
                >
                  All ({products.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${stockFilter === 'IN' ? 'active' : ''}`}
                  onClick={() => setStockFilter('IN')}
                >
                  In Stock ({inStockCount})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${stockFilter === 'LOW' ? 'active' : ''}`}
                  onClick={() => setStockFilter('LOW')}
                  style={{ color: stockFilter === 'LOW' ? '#fff' : '#b25e00' }}
                >
                  Low Stock ({lowStockCount})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${stockFilter === 'OUT' ? 'active' : ''}`}
                  onClick={() => setStockFilter('OUT')}
                  style={{ color: stockFilter === 'OUT' ? '#fff' : '#c62828' }}
                >
                  Out of Stock ({outOfStockCount})
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            {loading ? (
              <p className="empty-state">Loading stock levels...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="empty-state">
                {searchTerm || stockFilter !== 'ALL'
                  ? 'No products matched your search or status filter.'
                  : 'No products found in inventory.'}
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0
                          }
                          onChange={handleSelectAll}
                          title={t('selectAll')}
                        />
                      </th>
                      <th>{t('product')}</th>
                      <th>{t('category')}</th>
                      <th>{t('costPrice')}</th>
                      <th>{t('sellingPrice')}</th>
                      <th>{t('currentStock')}</th>
                      <th>{t('stockStatus')}</th>
                      <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const status = getStockStatus(product.stock);
                      return (
                        <tr key={product._id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product._id)}
                              onChange={() => handleToggleSelectProduct(product._id)}
                            />
                          </td>
                          <td className="font-bold">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <Boxes size={16} color="var(--primary)" />
                              {product.name}
                            </div>
                          </td>
                          <td>{product.category}</td>
                          <td className="text-muted">
                            ₹
                            {(product.costPrice !== undefined
                              ? product.costPrice
                              : Math.round((product.sellingPrice || product.price || 0) * 0.7)
                            ).toLocaleString()}
                          </td>
                          <td className="font-bold">
                            ₹{(product.sellingPrice || product.price)?.toLocaleString()}
                          </td>
                          <td className="font-bold">
                            {product.stock} {t('units')}
                          </td>
                          <td>
                            <span className={`badge ${status.class}`}>{status.label}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEditModal(product)}
                                title="Edit Product Details"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteProduct(product._id, product.name)}
                                title={t('delete')}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: AUDIT LEDGER */}
      {activeTab === 'ledger' && (
        <div className="card">
          {ledgerLoading ? (
            <p className="empty-state">Loading inventory movement transaction log...</p>
          ) : ledgerEntries.length === 0 ? (
            <p className="empty-state">No inventory ledger transactions recorded yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Quantity Change</th>
                    <th>Previous Stock</th>
                    <th>New Stock</th>
                    <th>Reference / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td className="text-muted">
                        {new Date(entry.createdAt || entry.createdAt).toLocaleString('en-GB')}
                      </td>
                      <td>
                        <span className={`ledger-badge ${getTypeBadgeClass(entry.type)}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="fw-600">{entry.product?.name || 'Unknown Product'}</td>
                      <td>
                        <span
                          className={`qty-change ${
                            entry.quantityChange > 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {entry.quantityChange > 0 ? `+${entry.quantityChange}` : entry.quantityChange}
                        </span>
                      </td>
                      <td>{entry.previousStock}</td>
                      <td className="fw-600">{entry.newStock}</td>
                      <td className="muted-text">{entry.notes || entry.referenceId || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Product Details' : (t('addProduct') || 'Add New Product')}
      >
        <form onSubmit={handleProductFormSubmit}>
          {formError && (
            <div
              style={{
                color: 'var(--badge-out-of-stock-color)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                fontWeight: 600
              }}
            >
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('productName') || 'Product Name'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dark Roast Coffee 250g"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('category') || 'Category'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Beverages, Snacks, Pantry"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('costPrice') || 'Cost Price (₹)'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('sellingPrice') || 'Selling Price (₹)'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('stock') || 'Current Stock Quantity'}</label>
            <input
              type="number"
              min="0"
              className="form-input"
              placeholder="0"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
            />
          </div>

          {/* Calculated Preview Box */}
          <div
            style={{
              backgroundColor: 'var(--kpi-icon-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: 'var(--primary)',
                marginBottom: '0.3rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Calculator size={15} />
              {t('preview') || 'Margin Preview'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
              <span>{t('expectedProfit') || 'Gross Margin per unit'}:</span>
              <strong
                style={{
                  color:
                    expectedProfitPerUnit >= 0
                      ? 'var(--badge-in-stock-color)'
                      : 'var(--badge-out-of-stock-color)'
                }}
              >
                ₹{expectedProfitPerUnit.toLocaleString()} / unit
              </strong>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : (editingProduct ? 'Update Product' : (t('saveProduct') || 'Save Product'))}
            </button>
          </div>
        </form>
      </Modal>

      <style>{`
        .inventory-nav-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.5rem;
        }

        .inventory-nav-tabs .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: 1px solid var(--border-color);
          padding: 0.55rem 1rem;
          border-radius: var(--radius-sm);
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
        }

        .inventory-nav-tabs .tab-btn.active {
          background-color: var(--primary);
          color: #ffffff;
          border-color: var(--primary);
        }

        .filter-pill {
          background: none;
          border: 1px solid var(--border-color);
          padding: 0.4rem 0.85rem;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-pill.active {
          background-color: var(--primary);
          color: #ffffff;
          border-color: var(--primary);
        }

        .ledger-badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .type-badge-add {
          background-color: rgba(40, 167, 69, 0.15);
          color: #28a745;
        }

        .type-badge-subtract {
          background-color: rgba(220, 53, 69, 0.15);
          color: #dc3545;
        }

        .type-badge-restore {
          background-color: rgba(13, 202, 240, 0.15);
          color: #0dcaf0;
        }

        .type-badge-neutral {
          background-color: var(--border-color);
          color: var(--text-main);
        }

        .qty-change {
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
