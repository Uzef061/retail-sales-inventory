import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Edit2, Trash2, Package, Calculator } from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useApp();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    costPrice: '',
    sellingPrice: '',
    stock: ''
  });
  const [formError, setFormError] = useState('');

  const fetchProducts = async (query = '') => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/products${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(searchTerm);
  }, [searchTerm]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({ name: '', category: '', costPrice: '', sellingPrice: '', stock: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      costPrice: product.costPrice !== undefined ? product.costPrice : Math.round(product.price * 0.7),
      sellingPrice: product.sellingPrice || product.price,
      stock: product.stock
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`/api/products/${id}`);
        fetchProducts(searchTerm);
      } catch (err) {
        alert('Failed to delete product.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { name, category, costPrice, sellingPrice, stock } = formData;
    if (!name || !category || costPrice === '' || sellingPrice === '' || stock === '') {
      setFormError('Please fill in all fields.');
      return;
    }

    try {
      if (editingProduct) {
        await axios.put(`/api/products/${editingProduct._id}`, {
          name,
          category,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stock: Number(stock)
        });
      } else {
        await axios.post('/api/products', {
          name,
          category,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          stock: Number(stock)
        });
      }
      setIsModalOpen(false);
      fetchProducts(searchTerm);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save product');
    }
  };

  const cp = Number(formData.costPrice || 0);
  const sp = Number(formData.sellingPrice || 0);
  const expectedProfitPerUnit = sp - cp;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('productsTitle')}</h1>
          <p className="page-subtitle">{t('productsSubtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} />
          {t('addProduct')}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card mb-4" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-container">
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              className="search-input"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('showingProducts', { count: products.length })}
          </span>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        {loading ? (
          <p className="empty-state">Loading product catalog...</p>
        ) : products.length === 0 ? (
          <p className="empty-state">{t('noProductsFound', { term: searchTerm })}</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('productName')}</th>
                  <th>{t('category')}</th>
                  <th>{t('costPrice')}</th>
                  <th>{t('sellingPrice')}</th>
                  <th>{t('stock')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => (
                  <tr key={prod._id}>
                    <td className="font-bold">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Package size={16} color="var(--primary)" />
                        {prod.name}
                      </div>
                    </td>
                    <td>{prod.category}</td>
                    <td className="text-muted">₹{(prod.costPrice !== undefined ? prod.costPrice : Math.round(prod.price * 0.7)).toLocaleString()}</td>
                    <td className="font-bold">₹{(prod.sellingPrice || prod.price)?.toLocaleString()}</td>
                    <td>{prod.stock} {t('units')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(prod)}
                          title="Edit product"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(prod._id)}
                          title="Delete product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? t('editProduct') : t('newProduct')}
      >
        <form onSubmit={handleSubmit}>
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
              placeholder="e.g. Organic Green Tea 250g"
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
            <button type="submit" className="btn btn-primary">
              {editingProduct ? t('updateProduct') : t('saveProduct')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
