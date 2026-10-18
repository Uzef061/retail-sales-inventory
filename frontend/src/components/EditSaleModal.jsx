import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Edit, Trash2, Plus, Minus, AlertCircle, CheckCircle2, Package, User, Calendar } from 'lucide-react';

export default function EditSaleModal({ sale, customers = [], products = [], onClose, onSaleUpdated }) {
  if (!sale) return null;

  // Initialize cart items from existing sale
  const [items, setItems] = useState(() => {
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      return sale.items.map((i) => ({
        product: i.product?._id || i.product,
        productName: i.product?.name || i.productName || 'Product',
        unitPrice: i.sellingPrice || i.unitPrice || 0,
        quantity: i.quantity || 1,
        totalPrice: (i.sellingPrice || i.unitPrice || 0) * (i.quantity || 1)
      }));
    } else if (sale.product) {
      const sp = sale.sellingPrice || sale.product.sellingPrice || sale.product.price || 0;
      const q = sale.quantity || 1;
      return [{
        product: sale.product._id || sale.product,
        productName: sale.product.name || 'Product',
        unitPrice: sp,
        quantity: q,
        totalPrice: sp * q
      }];
    }
    return [];
  });

  const [customerId, setCustomerId] = useState(sale.customer?._id || sale.customer || '');
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod || 'Cash');
  const [discountAmount, setDiscountAmount] = useState(sale.discount || 0);
  const [taxPercent, setTaxPercent] = useState(() => {
    if (sale.tax && sale.subtotal && sale.subtotal > 0) {
      return Math.round((sale.tax / sale.subtotal) * 100);
    }
    return 0;
  });

  const [saleDate, setSaleDate] = useState(() => {
    if (sale.saleDate) {
      return new Date(sale.saleDate).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });

  const [selectedAddProduct, setSelectedAddProduct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountVal = Number(discountAmount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountVal);
  const taxVal = (taxableAmount * (Number(taxPercent) || 0)) / 100;
  const grandTotal = Math.round(taxableAmount + taxVal);

  const handleUpdateItemQty = (index, delta) => {
    const updated = [...items];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      updated[index].totalPrice = newQty * updated[index].unitPrice;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleAddProduct = () => {
    if (!selectedAddProduct) return;
    const prod = products.find((p) => p._id === selectedAddProduct);
    if (!prod) return;

    const existingIndex = items.findIndex((i) => i.product === prod._id);
    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setItems(updated);
    } else {
      const price = prod.sellingPrice || prod.price;
      setItems([
        ...items,
        {
          product: prod._id,
          productName: prod.name,
          unitPrice: price,
          quantity: 1,
          totalPrice: price
        }
      ]);
    }
    setSelectedAddProduct('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (items.length === 0) {
      setError('Sale must contain at least one product.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.put(`/api/sales/${sale._id}`, {
        customer: customerId || undefined,
        items: items.map((i) => ({
          product: i.product,
          quantity: i.quantity,
          sellingPrice: i.unitPrice
        })),
        paymentMethod,
        discount: discountVal,
        tax: taxVal,
        saleDate
      });

      setSuccess('Sale updated successfully! Inventory stock adjusted.');
      if (onSaleUpdated) onSaleUpdated(res.data.sale || res.data);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update sale.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit size={20} style={{ color: 'var(--primary)' }} /> Edit Sale #{sale.invoiceNumber || sale._id?.slice(-8).toUpperCase()}
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Modify completed sale details. Inventory will adjust automatically based on quantity changes.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="alert-box alert-error mb-3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="alert-box alert-success mb-3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Customer & Payment Row */}
          <div className="form-row mb-3">
            <div className="form-group mb-0">
              <label className="form-label">Customer</label>
              <select
                className="form-control"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group mb-0">
              <label className="form-label">Payment Method</label>
              <select
                className="form-control"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card</option>
                <option value="UPI">📱 UPI / Digital</option>
                <option value="Credit">📑 Credit / Account</option>
              </select>
            </div>
          </div>

          {/* Sale Date Row */}
          <div className="form-group mb-3">
            <label className="form-label">Transaction Date</label>
            <input
              type="date"
              className="form-control"
              value={saleDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>

          {/* Items Section */}
          <div className="form-group mb-3">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Sale Items ({items.length})</span>
            </label>

            {/* Add product select bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <select
                className="form-control"
                style={{ flex: 1 }}
                value={selectedAddProduct}
                onChange={(e) => setSelectedAddProduct(e.target.value)}
              >
                <option value="">+ Add another product to sale...</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (₹{p.sellingPrice || p.price} • Stock: {p.stock})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddProduct}
                disabled={!selectedAddProduct}
              >
                <Plus size={15} /> Add
              </button>
            </div>

            {/* Items Table */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th style={{ width: '110px' }}>Quantity</th>
                    <th>Subtotal</th>
                    <th style={{ textAlign: 'right', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="fw-600" style={{ fontSize: '0.85rem' }}>{item.productName}</td>
                      <td style={{ fontSize: '0.85rem' }}>₹{item.unitPrice.toLocaleString('en-IN')}</td>
                      <td>
                        <div className="qty-stepper" style={{ height: '32px' }}>
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            style={{ width: '28px' }}
                            onClick={() => handleUpdateItemQty(idx, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            className="qty-stepper-input no-spinner"
                            style={{ width: '36px', fontSize: '0.85rem' }}
                            value={item.quantity}
                            readOnly
                          />
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            style={{ width: '28px' }}
                            onClick={() => handleUpdateItemQty(idx, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="fw-700" style={{ fontSize: '0.85rem' }}>₹{item.totalPrice.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm icon-only-btn"
                          onClick={() => handleRemoveItem(idx)}
                          style={{ padding: '0.25rem 0.45rem', minHeight: '30px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discount & Tax Row */}
          <div className="form-row mb-3">
            <div className="form-group mb-0">
              <label className="form-label">Discount</label>
              <div className="input-group">
                <span className="input-group-addon addon-left">₹</span>
                <input
                  type="number"
                  min="0"
                  className="form-control has-addon-left no-spinner"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">GST / Tax</label>
              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control has-addon-right no-spinner"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  placeholder="0"
                />
                <span className="input-group-addon addon-right">%</span>
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="checkout-summary-box mb-4">
            <div className="summary-line">
              <span className="muted-text">Subtotal</span>
              <span className="fw-600">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discountVal > 0 && (
              <div className="summary-line text-success">
                <span>Discount</span>
                <span className="fw-600">-₹{discountVal.toLocaleString('en-IN')}</span>
              </div>
            )}
            {taxVal > 0 && (
              <div className="summary-line">
                <span className="muted-text">Tax / GST ({taxPercent}%)</span>
                <span className="fw-600">+₹{taxVal.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="summary-divider" />
            <div className="summary-line grand-total">
              <span>UPDATED TOTAL</span>
              <span className="total-amount-display">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || items.length === 0}>
              {submitting ? 'Saving Changes...' : 'Save Changes & Adjust Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
