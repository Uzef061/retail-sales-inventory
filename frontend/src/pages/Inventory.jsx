import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Boxes, RefreshCw, Plus, CheckCircle2, Calculator, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useApp();

  // Selection State for Bulk Deletion
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // Add Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  useEffect(() => {
    fetchInventory();
  }, []);

  const getStockStatus = (stock) => {
    if (stock === 0) {
      return { label: t('outOfStock'), class: 'badge-out-of-stock' };
    }
    if (stock <= 10) {
      return { label: t('lowStock'), class: 'badge-low-stock' };
    }
    return { label: t('inStock'), class: 'badge-in-stock' };
  };

  const handleOpenAddModal = () => {
    setFormData({ name: '', category: '', costPrice: '', sellingPrice: '', stock: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleAddProductSubmit = async (e) => {
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
      await axios.post('/api/products', {
        name,
        category,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock)
      });

      setIsModalOpen(false);
      setSuccessMsg(t('productAddedSuccess'));
      fetchInventory();

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletion Handlers
  const handleDeleteProduct = async (id) => {
    if (window.confirm(t('confirmDeleteInventory'))) {
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
    if (window.confirm(t('confirmBulkDeleteInventory', { count: selectedProductIds.length }))) {
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
      setSelectedProductIds(products.map(p => p._id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleToggleSelectProduct = (id) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(item => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const cp = Number(formData.costPrice || 0);
  const sp = Number(formData.sellingPrice || 0);
  const expectedProfitPerUnit = sp - cp;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('inventoryTitle')}</h1>
          <p className="page-subtitle">{t('inventorySubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {selectedProductIds.length > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDeleteProducts}>
              <Trash2 size={16} />
              {t('deleteSelected', { count: selectedProductIds.length })}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} />
            {t('addProduct')}
          </button>
          <button className="btn btn-secondary" onClick={fetchInventory}>
            <RefreshCw size={15} />
            {t('refreshStock')}
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{
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
        }}>
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="empty-state">Loading stock levels...</p>
        ) : products.length === 0 ? (
          <p className="empty-state">No products found in inventory.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.length === products.length && products.length > 0}
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
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
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
                      <td className="text-muted">₹{(product.costPrice !== undefined ? product.costPrice : Math.round(product.price * 0.7)).toLocaleString()}</td>
                      <td className="font-bold">₹{(product.sellingPrice || product.price)?.toLocaleString()}</td>
                      <td className="font-bold">{product.stock} {t('units')}</td>
                      <td>
                        <span className={`badge ${status.class}`}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteProduct(product._id)}
                          title={t('delete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('addProduct')}
      >
        <form onSubmit={handleAddProductSubmit}>
          {formError && (
            <div style={{ color: 'var(--badge-out-of-stock-color)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('productName')}</label>
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
            <label className="form-label">{t('category')}</label>
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
              <label className="form-label">{t('costPrice')}</label>
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
              <label className="form-label">{t('sellingPrice')}</label>
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
            <label className="form-label">{t('stock')}</label>
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
          <div style={{
            backgroundColor: 'var(--kpi-icon-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calculator size={15} />
              {t('preview')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
              <span>{t('expectedProfit')}:</span>
              <strong style={{ color: expectedProfitPerUnit >= 0 ? 'var(--badge-in-stock-color)' : 'var(--badge-out-of-stock-color)' }}>
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
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : t('saveProduct')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
