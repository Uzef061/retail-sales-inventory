import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Check,
  Plus,
  Minus,
  Ban,
  Receipt,
  Search,
  Filter,
  Layers,
  History,
  RotateCcw,
  Edit
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import InvoiceModal from '../components/InvoiceModal';
import EditSaleModal from '../components/EditSaleModal';

/**
 * CustomSelect - Replicates the visual design and interaction style of CustomLanguageSelector
 */
function CustomSelect({ value, onChange, options = [], icon: Icon, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setFilterText('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    if (!filterText) return true;
    const term = filterText.toLowerCase();
    const l = (opt.label || '').toLowerCase();
    const s = (opt.subLabel || '').toLowerCase();
    return l.includes(term) || s.includes(term);
  });

  return (
    <div className="custom-select-container" ref={dropdownRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'active-trigger' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setFilterText('');
        }}
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
          {options.length > 4 && (
            <div style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 3 }}>
              <input
                type="text"
                autoFocus
                placeholder="Type to filter..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.82rem',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No matching options found
            </div>
          ) : (
            filteredOptions.map((item) => {
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
                      setFilterText('');
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
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CustomDatePicker - Polished custom date picker matching DD/MM/YYYY format
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

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const isDateDisabled = (dayNum) => {
    if (!maxDate) return false;
    const currentFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return currentFormatted > maxDate;
  };

  const handleSelectDay = (dayNum) => {
    const selectedIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    onChange(selectedIso);
    setIsOpen(false);
  };

  return (
    <div className="custom-datepicker-container" ref={dropdownRef}>
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
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav-btn" onClick={handlePrevMonth}>
              <ChevronLeft size={16} />
            </button>
            <div className="datepicker-month-year">
              {monthNames[month]} {year}
            </div>
            <button type="button" className="datepicker-nav-btn" onClick={handleNextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="datepicker-days-header">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          <div className="datepicker-days-grid">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="datepicker-day empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const disabled = isDateDisabled(dayNum);
              const isSelected =
                value ===
                `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

              return (
                <button
                  key={dayNum}
                  type="button"
                  disabled={disabled}
                  className={`datepicker-day ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
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

export default function Sales({ defaultTab = 'new' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useApp();

  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Active view tab state ('new' or 'history')
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('/history')) return 'history';
    return defaultTab;
  });

  useEffect(() => {
    if (location.pathname.includes('/history')) {
      if (activeTab !== 'history') setActiveTab('history');
    } else if (location.pathname.includes('/sales')) {
      if (activeTab !== 'new') setActiveTab('new');
    }
  }, [location.pathname]);

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    if (tabKey === 'history') {
      navigate('/sales/history');
    } else {
      navigate('/sales');
    }
  };

  // Data state
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Cart & POS Order State
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [addItemQty, setAddItemQty] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [saleDate, setSaleDate] = useState(getTodayDateStr());

  // History Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'
  const [customFilterStart, setCustomFilterStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customFilterEnd, setCustomFilterEnd] = useState(() => getTodayDateStr());


  // UI state
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [editingSale, setEditingSale] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [salesRes, custRes, prodRes] = await Promise.all([
        axios.get('/api/sales', { timeout: 15000 }),
        axios.get('/api/customers', { timeout: 15000 }),
        axios.get('/api/products', { timeout: 15000 })
      ]);

      setSales(salesRes.data || []);
      setCustomers(custRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Error fetching sales data', err);
      setLoadError(err.response?.data?.message || err.message || 'Failed to load POS data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddToCart = () => {
    if (!selectedProduct) {
      setFormError('Please select a product to add');
      return;
    }
    const prod = products.find((p) => p._id === selectedProduct);
    if (!prod) return;

    if (prod.stock <= 0) {
      setFormError(`Product ${prod.name} is out of stock!`);
      return;
    }

    const qtyToAdd = Number(addItemQty) || 1;
    const existingIndex = cart.findIndex((item) => item.product === prod._id);

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].quantity + qtyToAdd;
      if (newQty > prod.stock) {
        setFormError(`Cannot add. Only ${prod.stock} units available in stock.`);
        return;
      }
      updatedCart[existingIndex].quantity = newQty;
      updatedCart[existingIndex].totalPrice = newQty * updatedCart[existingIndex].unitPrice;
      setCart(updatedCart);
    } else {
      if (qtyToAdd > prod.stock) {
        setFormError(`Cannot add. Only ${prod.stock} units available in stock.`);
        return;
      }
      const unitPrice = prod.sellingPrice || prod.price;
      setCart([
        ...cart,
        {
          product: prod._id,
          productName: prod.name,
          unitPrice: unitPrice,
          quantity: qtyToAdd,
          totalPrice: qtyToAdd * unitPrice
        }
      ]);
    }

    setFormError('');
    setSelectedProduct('');
    setAddItemQty(1);
  };

  const addProductDirectly = (prod) => {
    if (!prod) return;
    if (prod.stock <= 0) {
      setFormError(`Product ${prod.name} is out of stock!`);
      return;
    }
    const existingIndex = cart.findIndex((item) => item.product === prod._id);
    const unitPrice = prod.sellingPrice || prod.price;

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].quantity + 1;
      if (newQty > prod.stock) {
        setFormError(`Cannot add. Only ${prod.stock} units available in stock.`);
        return;
      }
      updatedCart[existingIndex].quantity = newQty;
      updatedCart[existingIndex].totalPrice = newQty * updatedCart[existingIndex].unitPrice;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          product: prod._id,
          productName: prod.name,
          unitPrice: unitPrice,
          quantity: 1,
          totalPrice: unitPrice
        }
      ]);
    }
    setFormError('');
  };

  const handleUpdateCartQty = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const prod = products.find((p) => p._id === item.product);

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      if (prod && newQty > prod.stock) {
        alert(`Stock limit reached! Only ${prod.stock} available.`);
        return;
      }
      item.quantity = newQty;
      item.totalPrice = newQty * item.unitPrice;
    }
    setCart(updated);
  };

  const handleRemoveFromCart = (index) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const handleClearCart = () => {
    if (cart.length > 0 && window.confirm('Clear all items from current cart?')) {
      setCart([]);
      setFormError('');
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountVal = Number(discountAmount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountVal);
  const taxVal = (taxableAmount * (Number(taxPercent) || 0)) / 100;
  const grandTotal = Math.round(taxableAmount + taxVal);

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setFormError('Please add at least one product to the cart before completing checkout.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post('/api/sales', {
        customerId: selectedCustomer || undefined,
        customer: selectedCustomer || undefined,
        items: cart,
        paymentMethod,
        discount: discountVal,
        tax: taxVal,
        subtotal: subtotal,
        grandTotal: grandTotal,
        saleDate: saleDate
      });

      setSuccessMsg(t('saleSuccess'));
      setCart([]);
      setSelectedCustomer('');
      setDiscountAmount(0);
      setTaxPercent(0);

      // Open Invoice Modal directly!
      if (res.data?.sale || res.data) {
        setActiveInvoice(res.data.sale || res.data);
      }

      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit sale.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSale = async (saleId) => {
    if (
      window.confirm(
        'Cancel this sale? Stock will be restored to inventory and a cancellation entry recorded in the stock ledger.'
      )
    ) {
      try {
        await axios.put(`/api/sales/${saleId}/cancel`);
        alert('Sale successfully cancelled! Stock restored.');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to cancel sale.');
      }
    }
  };

  const customerOptions = [
    { value: '', label: 'Walk-in Customer', subLabel: '(No Profile)' },
    ...customers.map((c) => ({
      value: c._id,
      label: c.name,
      subLabel: c.phone ? `(${c.phone})` : ''
    }))
  ];

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

  // Calculate Today's Sales & Orders
  const todayStr = getTodayDateStr();
  const todayCompletedSales = sales.filter((s) => {
    if (s.status === 'CANCELLED') return false;
    const d = new Date(s.saleDate || s.createdAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}` === todayStr;
  });
  const todaySalesTotal = todayCompletedSales.reduce(
    (sum, s) => sum + (Number(s.grandTotal) || Number(s.totalAmount) || 0),
    0
  );
  const todayOrdersCount = todayCompletedSales.length;

  // Filtering for Sales History
  const filteredSales = sales.filter((s) => {
    const invNum = (s.invoiceNumber || s._id || '').toLowerCase();
    const custName = (s.customer?.name || 'walk-in').toLowerCase();
    const custPhone = (s.customer?.phone || '').toLowerCase();
    const prodNames = s.items
      ? s.items.map((i) => (i.productName || '').toLowerCase()).join(' ')
      : (s.product?.name || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      invNum.includes(term) ||
      custName.includes(term) ||
      custPhone.includes(term) ||
      prodNames.includes(term);

    const matchesPayment = paymentFilter === 'ALL' || (s.paymentMethod || 'Cash') === paymentFilter;
    const matchesStatus = statusFilter === 'ALL' || (s.status || 'COMPLETED') === statusFilter;

    // Date filtering
    let matchesDate = true;
    if (dateFilter !== 'ALL') {
      const saleD = new Date(s.saleDate || s.createdAt);
      const now = new Date();

      if (dateFilter === 'TODAY') {
        const yyyy = saleD.getFullYear();
        const mm = String(saleD.getMonth() + 1).padStart(2, '0');
        const dd = String(saleD.getDate()).padStart(2, '0');
        matchesDate = `${yyyy}-${mm}-${dd}` === todayStr;
      } else if (dateFilter === 'THIS_WEEK') {
        const day = now.getDay();
        const diffToMon = day === 0 ? 6 : day - 1;
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMon, 0, 0, 0);
        const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
        matchesDate = saleD >= weekStart && saleD <= weekEnd;
      } else if (dateFilter === 'THIS_MONTH') {
        matchesDate = saleD.getFullYear() === now.getFullYear() && saleD.getMonth() === now.getMonth();
      } else if (dateFilter === 'CUSTOM') {
        if (customFilterStart) {
          const cStart = new Date(`${customFilterStart}T00:00:00`);
          if (saleD < cStart) matchesDate = false;
        }
        if (customFilterEnd) {
          const cEnd = new Date(`${customFilterEnd}T23:59:59.999`);
          if (saleD > cEnd) matchesDate = false;
        }
      }
    }

    return matchesSearch && matchesPayment && matchesStatus && matchesDate;
  });

  return (
    <div className="page-wrapper">
      <div className="page-header space-between flex-wrap">
        <div>
          <h1 className="page-title">
            {activeTab === 'new' ? 'New Sale' : 'Sales History & Records'}
          </h1>
          <p className="page-subtitle">
            {activeTab === 'new'
              ? 'Record a sales transaction with item details, custom pricing, and instant invoice generation'
              : 'View, filter, print receipts, and manage historical sales transactions'}
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="module-subnav-tabs">
          <button
            className={`subnav-tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => switchTab('new')}
          >
            <ShoppingCart size={16} /> New Sale
          </button>
          <button
            className={`subnav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => switchTab('history')}
          >
            <History size={16} /> Sales History ({sales.length})
          </button>
        </div>
      </div>

      {/* Quick Business Overview Banner: Today's Sales & Orders */}
      <div
        className="card mb-4"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--card-bg)',
          borderLeft: '4px solid var(--primary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TODAY'S TOTAL SALES
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.1rem' }}>
              ₹{todaySalesTotal.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              COMPLETED ORDERS TODAY
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.1rem' }}>
              {todayOrdersCount} {todayOrdersCount === 1 ? 'Order' : 'Orders'}
            </div>
          </div>

          {activeTab === 'history' && (
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                FILTERED SALES TOTAL
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.1rem' }}>
                ₹{filteredSales.filter(s => s.status !== 'CANCELLED').reduce((sum, s) => sum + (Number(s.grandTotal) || Number(s.totalAmount) || 0), 0).toLocaleString('en-IN')}{' '}
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                  ({filteredSales.length} {filteredSales.length === 1 ? 'record' : 'records'})
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          {activeTab === 'history' ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => switchTab('new')}
            >
              <ShoppingCart size={15} /> + New Sale
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => switchTab('history')}
            >
              <History size={15} /> View Sales History
            </button>
          )}
        </div>
      </div>

      {/* VIEW A: NEW SALE / POS BILLING WORKSPACE */}
      {activeTab === 'new' && (
        <div className="pos-workspace-grid">

          {/* LEFT COLUMN: Product Selection & Cart Workspace */}
          <div className="pos-left-card card">
            <h3 className="card-title flex-title">
              <ShoppingCart size={18} color="var(--primary)" /> Cart & Product Workspace
            </h3>

            {formError && <div className="alert-box alert-error">{formError}</div>}
            {successMsg && (
              <div className="alert-box alert-success">
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}

            {/* Product Add Bar */}
            <div className="cart-add-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <CustomSelect
                  value={selectedProduct}
                  onChange={(val) => setSelectedProduct(val)}
                  options={productOptions}
                  icon={Package}
                  placeholder="🔍 Search or select product..."
                />
              </div>
              <div className="qty-stepper">
                <button
                  type="button"
                  className="qty-stepper-btn"
                  onClick={() => setAddItemQty(Math.max(1, addItemQty - 1))}
                  title="Decrease Quantity"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  className="qty-stepper-input no-spinner"
                  value={addItemQty}
                  onChange={(e) => setAddItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button
                  type="button"
                  className="qty-stepper-btn"
                  onClick={() => setAddItemQty(addItemQty + 1)}
                  title="Increase Quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddToCart}>
                <Plus size={16} /> Add to Cart
              </button>
            </div>

            {/* Quick Add Bar for In-Stock Products */}
            {products.filter((p) => p.stock > 0).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.65rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Quick Add:
                </span>
                {products
                  .filter((p) => p.stock > 0)
                  .slice(0, 6)
                  .map((prod) => (
                    <button
                      key={prod._id}
                      type="button"
                      className="quick-item-chip"
                      onClick={() => addProductDirectly(prod)}
                      title={`Add 1 unit of ${prod.name} (Stock: ${prod.stock})`}
                    >
                      <Plus size={11} />
                      <span>{prod.name}</span>
                      <strong style={{ marginLeft: '0.2rem' }}>₹{prod.sellingPrice || prod.price}</strong>
                    </button>
                  ))}
              </div>
            )}

            {/* Cart Table */}
            <div className="cart-table-container">
              <table className="data-table cart-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th style={{ width: '110px' }}>Qty</th>
                    <th>Subtotal</th>
                    <th style={{ textAlign: 'right', width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-5 muted-text">
                        <div style={{ padding: '2rem 1rem' }}>
                          <ShoppingCart size={36} style={{ margin: '0 auto 0.5rem auto', color: 'var(--text-muted)', opacity: 0.4, display: 'block' }} />
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Cart is empty</div>
                          <div style={{ fontSize: '0.825rem', marginTop: '0.2rem' }}>Select a product above to start the sale</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={idx}>
                        <td className="fw-600" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.productName}>
                          {item.productName}
                        </td>
                        <td>₹{item.unitPrice.toLocaleString('en-IN')}</td>
                        <td>
                          <div className="qty-stepper" style={{ height: '32px' }}>
                            <button
                              type="button"
                              className="qty-stepper-btn"
                              style={{ width: '28px' }}
                              onClick={() => handleUpdateCartQty(idx, -1)}
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
                              onClick={() => handleUpdateCartQty(idx, 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="fw-700">₹{item.totalPrice.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm icon-only-btn"
                            onClick={() => handleRemoveFromCart(idx)}
                            title="Remove Item"
                            style={{ padding: '0.3rem 0.5rem', minHeight: '32px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Cart Footer Actions */}
            {cart.length > 0 && (
              <div className="cart-actions-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearCart}
                >
                  <RotateCcw size={14} /> Clear Cart
                </button>
                <span className="muted-text text-sm fw-600">
                  {cart.length} product{cart.length > 1 ? 's' : ''} • Total Units: {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Checkout & Order Summary */}
          <div className="pos-right-card card">
            <h3 className="card-title flex-title">
              <User size={18} color="var(--primary)" /> Checkout Details
            </h3>

            <form onSubmit={handleSaleSubmit} className="checkout-form">
              <div className="form-group">
                <label className="form-label">{t('selectCustomer')}</label>
                <CustomSelect
                  value={selectedCustomer}
                  onChange={(val) => setSelectedCustomer(val)}
                  options={customerOptions}
                  icon={User}
                  placeholder="Walk-in Customer"
                />
              </div>

              <div className="form-group">
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

              <div className="form-row">
                <div className="form-group">
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
                <div className="form-group">
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

              <div className="form-group">
                <label className="form-label">{t('saleDate')}</label>
                <CustomDatePicker
                  value={saleDate}
                  maxDate={getTodayDateStr()}
                  onChange={(val) => setSaleDate(val)}
                />
              </div>

              {/* Order Summary Calculation Box */}
              <div className="checkout-summary-box">
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
                  <span>TOTAL</span>
                  <span className="total-amount-display">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary submit-checkout-btn"
                disabled={submitting || cart.length === 0}
              >
                <ShoppingBag size={18} />
                {submitting ? 'Processing Transaction...' : '✓ Complete Sale & Print Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW B: DEDICATED FULL-WIDTH SALES HISTORY */}
      {activeTab === 'history' && (
        <div className="card full-width-card">
          {/* History Controls & Date Filters */}
          <div className="history-filter-bar" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Top Row: Search & Method / Status Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
              <div className="search-box" style={{ flex: 1, minWidth: '240px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="form-control search-input"
                  placeholder="Search by Invoice #, Customer name, Phone, Product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-selectors" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="select-filter-item">
                  <select
                    className="form-control form-control-sm"
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                  >
                    <option value="ALL">All Payment Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div className="select-filter-item">
                  <select
                    className="form-control form-control-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom Row: Simple Date Filters (Today, This Week, This Month, Custom) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.65rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                Period:
              </span>
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'THIS_WEEK', label: 'This Week' },
                { id: 'THIS_MONTH', label: 'This Month' },
                { id: 'CUSTOM', label: 'Custom Range' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  className={`btn btn-sm ${dateFilter === btn.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    borderRadius: '16px',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.8rem',
                    minHeight: '28px'
                  }}
                  onClick={() => setDateFilter(btn.id)}
                >
                  {btn.label}
                </button>
              ))}

              {dateFilter === 'CUSTOM' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>From:</span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ width: '135px', height: '30px', fontSize: '0.8rem' }}
                    value={customFilterStart}
                    onChange={(e) => setCustomFilterStart(e.target.value)}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>To:</span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ width: '135px', height: '30px', fontSize: '0.8rem' }}
                    value={customFilterEnd}
                    onChange={(e) => setCustomFilterEnd(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Full-width History Table */}
          {loading ? (
            <p className="empty-state">Loading sales history...</p>
          ) : filteredSales.length === 0 ? (
            <p className="empty-state">No sales records matching your current filter.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table full-width-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Grand Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const isCancelled = sale.status === 'CANCELLED';
                    const itemsSummary = sale.items && sale.items.length > 0
                      ? sale.items.map((i) => `${i.productName || 'Item'} (${i.quantity})`).join(', ')
                      : `${sale.product?.name || 'Item'} (${sale.quantity || 1})`;

                    return (
                      <tr key={sale._id} className={isCancelled ? 'cancelled-row' : ''}>
                        <td className="fw-700 font-mono text-primary">
                          #{sale.invoiceNumber || sale._id?.slice(-8).toUpperCase()}
                        </td>
                        <td className="text-muted text-sm">
                          {new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="fw-600">
                          {sale.customer?.name || 'Walk-in Customer'}
                          {sale.customer?.phone && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {sale.customer.phone}
                            </div>
                          )}
                        </td>
                        <td className="text-sm max-w-item-cell" title={itemsSummary}>
                          {itemsSummary}
                        </td>
                        <td className="fw-700 text-main">
                          ₹{(sale.grandTotal || sale.totalAmount)?.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className="payment-badge">{sale.paymentMethod || 'Cash'}</span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              isCancelled ? 'status-cancelled' : 'status-completed'
                            }`}
                          >
                            {isCancelled ? 'CANCELLED' : 'COMPLETED'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-button-group justify-end">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setActiveInvoice(sale)}
                              title="View & Print Tax Invoice"
                            >
                              <Receipt size={14} /> Receipt
                            </button>
                            {!isCancelled && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingSale(sale)}
                                  title="Edit Sale & Adjust Inventory"
                                >
                                  <Edit size={14} /> Edit
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancelSale(sale._id)}
                                  title="Cancel Sale & Restore Inventory Stock"
                                >
                                  <Ban size={14} /> Cancel
                                </button>
                              </>
                            )}
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
      )}

      {/* Invoice Modal Component */}
      {activeInvoice && (
        <InvoiceModal sale={activeInvoice} onClose={() => setActiveInvoice(null)} />
      )}

      {/* Edit Sale Modal Component */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          customers={customers}
          products={products}
          onClose={() => setEditingSale(null)}
          onSaleUpdated={() => {
            fetchData();
            setEditingSale(null);
          }}
        />
      )}

      <style>{`
        .module-subnav-tabs {
          display: flex;
          gap: 0.5rem;
          background: var(--input-bg);
          padding: 0.25rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }

        .subnav-tab-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          background: none;
          border: none;
          padding: 0.45rem 0.9rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .subnav-tab-btn.active {
          background: var(--card-bg);
          color: var(--primary);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .pos-workspace-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
          gap: 1.25rem;
          align-items: start;
        }

        .cart-add-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .cart-table-container {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          min-height: 200px;
          max-height: 360px;
          overflow-y: auto;
          margin-bottom: 0.85rem;
        }

        .cart-actions-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 0.65rem;
          border-top: 1px solid var(--border-color);
        }

        .checkout-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .checkout-summary-box {
          background: rgba(201, 106, 61, 0.07);
          border: 1px solid rgba(201, 106, 61, 0.22);
          border-radius: 8px;
          padding: 0.85rem 1rem;
          margin: 0.25rem 0 0.5rem 0;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          margin-bottom: 0.3rem;
        }

        .summary-divider {
          height: 1px;
          background-color: rgba(201, 106, 61, 0.2);
          margin: 0.5rem 0;
        }

        .grand-total {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-main);
          letter-spacing: 0.5px;
          margin-bottom: 0;
        }

        .total-amount-display {
          font-size: 1.45rem;
          font-weight: 800;
          color: var(--primary);
        }

        .submit-checkout-btn {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.95rem;
          font-weight: 700;
          min-height: 44px;
        }

        .summary-line {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          margin-bottom: 0.35rem;
        }

        .grand-total {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--primary);
          border-top: 1px solid var(--border-color);
          padding-top: 0.5rem;
          margin-top: 0.4rem;
        }

        .submit-checkout-btn {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 1rem;
        }

        .history-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .search-input {
          padding-left: 2.3rem;
        }

        .filter-selectors {
          display: flex;
          gap: 0.5rem;
        }

        .full-width-table {
          width: 100%;
        }

        .max-w-item-cell {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .payment-badge {
          background: var(--input-bg);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
        }

        .action-button-group {
          display: flex;
          gap: 0.35rem;
        }

        .justify-end {
          justify-content: flex-end;
        }

        .cancelled-row {
          opacity: 0.65;
        }

        .quick-item-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          background-color: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 0.25rem 0.65rem;
          border-radius: 16px;
          font-size: 0.78rem;
          color: var(--text-main);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quick-item-chip:hover {
          background-color: var(--kpi-icon-bg);
          border-color: var(--primary);
          color: var(--primary);
        }

        @media (max-width: 1024px) {
          .pos-workspace-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
