import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingBag, ShoppingCart, CheckCircle2, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useApp();

  // Selection State for Bulk Deletion
  const [selectedSaleIds, setSelectedSaleIds] = useState([]);

  // Sales Form State
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [salesRes, productsRes, customersRes] = await Promise.all([
        axios.get('/api/sales'),
        axios.get('/api/products'),
        axios.get('/api/customers')
      ]);

      setSales(salesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
      setSelectedSaleIds([]); // reset selection

      // Auto select first product & customer if available
      if (customersRes.data.length > 0 && !selectedCustomer) {
        setSelectedCustomer(customersRes.data[0]._id);
      }
      if (productsRes.data.length > 0 && !selectedProduct) {
        setSelectedProduct(productsRes.data[0]._id);
        setUnitPrice(productsRes.data[0].price);
        setTotalAmount(productsRes.data[0].price * 1);
      }
    } catch (err) {
      console.error('Error fetching sales data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update unit price and total when selected product changes
  const handleProductChange = (productId) => {
    setSelectedProduct(productId);
    const prod = products.find((p) => p._id === productId);
    if (prod) {
      const priceVal = prod.sellingPrice || prod.price;
      setUnitPrice(priceVal);
      setTotalAmount(priceVal * Number(quantity));
    }
  };

  // Update total amount when quantity changes
  const handleQuantityChange = (qtyStr) => {
    const qty = Math.max(1, Number(qtyStr));
    setQuantity(qty);
    setTotalAmount(unitPrice * qty);
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!selectedCustomer || !selectedProduct || !quantity) {
      setFormError('Please fill in all sales details.');
      return;
    }

    const prod = products.find((p) => p._id === selectedProduct);
    if (prod && prod.stock < quantity) {
      setFormError(t('insufficientStock', { name: prod.name, stock: prod.stock }));
      return;
    }

    try {
      setSubmitting(true);
      await axios.post('/api/sales', {
        customer: selectedCustomer,
        product: selectedProduct,
        quantity: Number(quantity),
        price: Number(unitPrice),
        totalAmount: Number(totalAmount)
      });

      setSuccessMsg(t('saleSuccess'));
      setQuantity(1);

      // Refresh sales and updated products list
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit sale.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletion Handlers
  const handleDeleteSale = async (id) => {
    if (window.confirm(t('confirmDeleteSale'))) {
      try {
        await axios.delete(`/api/sales/${id}`);
        fetchData();
      } catch (err) {
        alert('Failed to delete sale.');
      }
    }
  };

  const handleBulkDeleteSales = async () => {
    if (selectedSaleIds.length === 0) return;
    if (window.confirm(t('confirmBulkDeleteSales', { count: selectedSaleIds.length }))) {
      try {
        await axios.post('/api/sales/bulk-delete', { ids: selectedSaleIds });
        fetchData();
      } catch (err) {
        alert('Failed to delete selected sales.');
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedSaleIds(sales.map(s => s._id));
    } else {
      setSelectedSaleIds([]);
    }
  };

  const handleToggleSelectSale = (id) => {
    if (selectedSaleIds.includes(id)) {
      setSelectedSaleIds(selectedSaleIds.filter(item => item !== id));
    } else {
      setSelectedSaleIds([...selectedSaleIds, id]);
    }
  };

  const currentProduct = products.find((p) => p._id === selectedProduct);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('salesTitle')}</h1>
          <p className="page-subtitle">{t('salesSubtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '1.5rem' }}>
        {/* Left Column: Create Sales Form */}
        <div>
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={18} color="var(--primary)" />
              {t('newSaleEntry')}
            </h3>

            {formError && (
              <div style={{ color: 'var(--badge-out-of-stock-color)', backgroundColor: 'var(--badge-out-of-stock-bg)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                {formError}
              </div>
            )}

            {successMsg && (
              <div style={{ color: 'var(--badge-in-stock-color)', backgroundColor: 'var(--badge-in-stock-bg)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSaleSubmit}>
              {/* Select Customer */}
              <div className="form-group">
                <label className="form-label">{t('selectCustomer')}</label>
                <select
                  className="form-select"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  required
                >
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Product */}
              <div className="form-group">
                <label className="form-label">{t('selectProduct')}</label>
                <select
                  className="form-select"
                  value={selectedProduct}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                >
                  {products.map((p) => {
                    const priceVal = p.sellingPrice || p.price;
                    return (
                      <option key={p._id} value={p._id} disabled={p.stock === 0}>
                        {p.name} - ₹{priceVal} ({t('stock')}: {p.stock}) {p.stock === 0 ? `[${t('outOfStock')}]` : ''}
                      </option>
                    );
                  })}
                </select>
                {currentProduct && (
                  <span style={{ fontSize: '0.78rem', color: currentProduct.stock <= 5 ? 'var(--badge-out-of-stock-color)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Available stock: <strong>{currentProduct.stock} {t('units')}</strong>
                  </span>
                )}
              </div>

              {/* Quantity and Price */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('quantity')}</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('unitPriceLabel')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={unitPrice}
                    readOnly
                    style={{ backgroundColor: 'var(--table-header-bg)' }}
                  />
                </div>
              </div>

              {/* Total Amount Box */}
              <div style={{
                backgroundColor: 'rgba(201, 106, 61, 0.1)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                margin: '1rem 0 1.25rem 0'
              }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('totalAmount')}</span>
                <span style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary)' }}>₹{totalAmount.toLocaleString()}</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={submitting || !currentProduct || currentProduct.stock === 0}
              >
                <ShoppingBag size={16} />
                {submitting ? t('processingSale') : t('submitSale')}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Sales History Table */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('salesHistory')}</h3>

              {selectedSaleIds.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBulkDeleteSales}
                >
                  <Trash2 size={14} />
                  {t('deleteSelected', { count: selectedSaleIds.length })}
                </button>
              )}
            </div>

            {loading ? (
              <p className="empty-state">Loading sales history...</p>
            ) : sales.length === 0 ? (
              <p className="empty-state">No sales transactions recorded yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlignment: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedSaleIds.length === sales.length && sales.length > 0}
                          onChange={handleSelectAll}
                          title={t('selectAll')}
                        />
                      </th>
                      <th>{t('date')}</th>
                      <th>{t('customer')}</th>
                      <th>{t('product')}</th>
                      <th>{t('qty')}</th>
                      <th>{t('amount')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedSaleIds.includes(sale._id)}
                            onChange={() => handleToggleSelectSale(sale._id)}
                          />
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {new Date(sale.saleDate).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="font-bold">{sale.customer?.name || 'Walk-in'}</td>
                        <td>{sale.product?.name || 'Item'}</td>
                        <td>{sale.quantity}</td>
                        <td className="font-bold">₹{sale.totalAmount?.toLocaleString()}</td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteSale(sale._id)}
                            title={t('delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
