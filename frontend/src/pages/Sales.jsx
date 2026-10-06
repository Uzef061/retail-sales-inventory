import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ShoppingBag,
  ShoppingCart,
  CheckCircle2,
  Trash2,
  User,
  Package,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * CustomSelect - Replicates the visual design, animation, and interaction style of CustomLanguageSelector
 */
function CustomSelect({ value, onChange, options = [], icon: Icon, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="custom-select-container" ref={dropdownRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'active-trigger' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {Icon && <Icon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
            <span style={{ fontWeight: 600 }}>{selectedOption ? selectedOption.label : placeholder}</span>
            {selectedOption?.subLabel && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {selectedOption.subLabel}
              </span>
            )}
          </div>
        </div>
        <ChevronDown size={15} className={`custom-select-chevron ${isOpen ? 'chevron-rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((item) => {
            const isSelected = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                disabled={item.disabled}
                className={`custom-select-item ${isSelected ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (!item.disabled) {
                    onChange(item.value);
                    setIsOpen(false);
                  }
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', overflow: 'hidden' }}>
                  <span style={{ fontWeight: isSelected ? 700 : 600 }}>{item.label}</span>
                  {item.subLabel && (
                    <span style={{ fontSize: '0.75rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {item.subLabel}
                    </span>
                  )}
                </div>
                {isSelected && <Check size={15} className="custom-select-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * CustomDatePicker - Polished custom date picker matching Language Selector UI language and DD/MM/YYYY format
 */
function CustomDatePicker({ value, onChange, maxDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const parseIsoDate = (dateStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState(() => parseIsoDate(value));

  useEffect(() => {
    if (value) {
      setViewDate(parseIsoDate(value));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];
  const maxLimitDate = maxDate ? parseIsoDate(maxDate) : new Date();
  maxLimitDate.setHours(23, 59, 59, 999);

  const daysGrid = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  const handleSelectDay = (d) => {
    if (!d) return;
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const selectedDateStr = `${year}-${mStr}-${dStr}`;

    const cellDate = new Date(year, month, d, 12, 0, 0);
    if (cellDate > maxLimitDate) {
      return;
    }

    onChange(selectedDateStr);
    setIsOpen(false);
  };

  return (
    <div className="custom-select-container" ref={dropdownRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'active-trigger' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <Calendar size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{formatDDMMYYYY(value)}</span>
        </div>
        <ChevronDown size={15} className={`custom-select-chevron ${isOpen ? 'chevron-rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-datepicker-dropdown">
          <div className="custom-datepicker-header">
            <button type="button" className="datepicker-nav-btn" onClick={handlePrevMonth}>
              <ChevronLeft size={15} />
            </button>
            <span className="datepicker-month-title">
              {monthNames[month]} {year}
            </span>
            <button type="button" className="datepicker-nav-btn" onClick={handleNextMonth}>
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="custom-datepicker-weekdays">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => (
              <span key={w} className="datepicker-weekday">{w}</span>
            ))}
          </div>

          <div className="custom-datepicker-grid">
            {daysGrid.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} className="datepicker-day empty" />;
              }

              const mStr = String(month + 1).padStart(2, '0');
              const dStr = String(dayNum).padStart(2, '0');
              const dateIsoStr = `${year}-${mStr}-${dStr}`;
              const cellDate = new Date(year, month, dayNum, 12, 0, 0);

              const isSelected = value === dateIsoStr;
              const isToday = todayStr === dateIsoStr;
              const isDisabled = cellDate > maxLimitDate;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={isDisabled}
                  className={`datepicker-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => handleSelectDay(dayNum)}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useApp();

  // Selection State for Bulk Deletion
  const [selectedSaleIds, setSelectedSaleIds] = useState([]);

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];

  // Sales Form State
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [saleDate, setSaleDate] = useState(getTodayDateStr());
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

  // Update total amount when selling price changes
  const handleUnitPriceChange = (valStr) => {
    setUnitPrice(valStr);
    const priceVal = Number(valStr) || 0;
    setTotalAmount(priceVal * Number(quantity));
  };

  // Update total amount when quantity changes
  const handleQuantityChange = (qtyStr) => {
    const qty = Math.max(1, Number(qtyStr) || 1);
    setQuantity(qty);
    setTotalAmount((Number(unitPrice) || 0) * qty);
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!selectedCustomer || !selectedProduct || !quantity) {
      setFormError('Please fill in all sales details.');
      return;
    }

    const priceNum = Number(unitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Selling price must be a valid non-negative number.');
      return;
    }

    if (!saleDate) {
      setFormError('Please select a valid sale date.');
      return;
    }

    const selectedD = new Date(`${saleDate}T12:00:00`);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (selectedD > endOfToday) {
      setFormError('Future sale dates are not allowed.');
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
        price: priceNum,
        sellingPrice: priceNum,
        totalAmount: Number(totalAmount),
        saleDate: saleDate
      });

      setSuccessMsg(t('saleSuccess'));
      setQuantity(1);
      setSaleDate(getTodayDateStr());

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

  const customerOptions = customers.map((c) => ({
    value: c._id,
    label: c.name,
    subLabel: c.phone ? `(${c.phone})` : ''
  }));

  const productOptions = products.map((p) => {
    const priceVal = p.sellingPrice || p.price;
    const isOutOfStock = p.stock === 0;
    return {
      value: p._id,
      label: p.name,
      subLabel: `₹${priceVal} • ${t('stock')}: ${p.stock}${isOutOfStock ? ` [${t('outOfStock')}]` : ''}`,
      disabled: isOutOfStock
    };
  });

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('salesTitle')}</h1>
          <p className="page-subtitle">{t('salesSubtitle')}</p>
        </div>
      </div>

      <div className="sales-page-grid">
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
                <CustomSelect
                  value={selectedCustomer}
                  onChange={(val) => setSelectedCustomer(val)}
                  options={customerOptions}
                  icon={User}
                  placeholder="Select Customer..."
                />
              </div>

              {/* Select Product */}
              <div className="form-group">
                <label className="form-label">{t('selectProduct')}</label>
                <CustomSelect
                  value={selectedProduct}
                  onChange={(val) => handleProductChange(val)}
                  options={productOptions}
                  icon={Package}
                  placeholder="Select Product..."
                />
                {currentProduct && (
                  <span style={{ fontSize: '0.78rem', color: currentProduct.stock <= 5 ? 'var(--badge-out-of-stock-color)' : 'var(--text-muted)', marginTop: '0.25rem' }}>
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
                    min="0"
                    step="any"
                    className="form-input"
                    value={unitPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Sale Date */}
              <div className="form-group">
                <label className="form-label">{t('saleDate')}</label>
                <CustomDatePicker
                  value={saleDate}
                  maxDate={getTodayDateStr()}
                  onChange={(val) => setSaleDate(val)}
                />
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
                <table className="data-table sales-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlign: 'center' }}>
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
                        <td className="text-muted" style={{ fontSize: '0.825rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {sale.saleDate ? (() => {
                            const d = new Date(sale.saleDate);
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          })() : '-'}
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
