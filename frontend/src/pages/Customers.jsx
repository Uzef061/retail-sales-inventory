import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Edit2, Trash2, History, UserCheck, Search, Phone, Mail } from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { t } = useApp();

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [formError, setFormError] = useState('');

  // View Purchase History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSales, setCustomerSales] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust) => {
    setEditingCustomer(cust);
    setFormData({ name: cust.name, phone: cust.phone, email: cust.email });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id, custName) => {
    if (window.confirm(`Delete customer record for "${custName || 'this customer'}"?`)) {
      try {
        await axios.delete(`/api/customers/${id}`);
        fetchCustomers();
      } catch (err) {
        alert('Failed to delete customer.');
      }
    }
  };

  const handleViewHistory = async (cust) => {
    setSelectedCustomer(cust);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get(`/api/customers/${cust._id}/sales`);
      setCustomerSales(res.data || []);
    } catch (err) {
      console.error('Error fetching customer history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { name, phone, email } = formData;
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setFormError('All fields (name, phone, email) are required.');
      return;
    }

    try {
      if (editingCustomer) {
        await axios.put(`/api/customers/${editingCustomer._id}`, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim()
        });
      } else {
        await axios.post('/api/customers', {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim()
        });
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save customer');
    }
  };

  const filteredCustomers = customers.filter((cust) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      cust.name?.toLowerCase().includes(term) ||
      cust.phone?.toLowerCase().includes(term) ||
      cust.email?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('customersTitle') || 'Customer Directory'}</h1>
          <p className="page-subtitle">Manage customer profiles and past billing history</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} />
          {t('addCustomer') || '+ Add Customer'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="card mb-4" style={{ padding: '0.85rem 1.15rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-container" style={{ minWidth: '260px', flex: 1 }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              className="search-input"
              placeholder="Search customer by name, phone number, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {filteredCustomers.length} of {customers.length} customers
          </span>
        </div>
      </div>

      {/* Customers List Card */}
      <div className="card">
        {loading ? (
          <p className="empty-state">Loading customer records...</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="empty-state">
            {searchTerm ? 'No customers matched your search query.' : 'No customer records found. Click "+ Add Customer" to create one.'}
          </p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('fullName') || 'Customer Name'}</th>
                  <th>{t('phoneNumber') || 'Phone'}</th>
                  <th>{t('emailAddress') || 'Email'}</th>
                  <th style={{ textAlign: 'right' }}>{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => (
                  <tr key={cust._id}>
                    <td className="font-bold">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <UserCheck size={16} color="var(--primary)" />
                        {cust.name}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Phone size={13} color="var(--text-muted)" />
                        {cust.phone}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Mail size={13} color="var(--text-muted)" />
                        {cust.email}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewHistory(cust)}
                          title="View Past Invoices"
                        >
                          <History size={13} /> {t('history') || 'Invoices'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(cust)}
                          title="Edit Profile"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(cust._id, cust.name)}
                          title="Delete Customer"
                        >
                          <Trash2 size={13} />
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? (t('editCustomer') || 'Edit Customer Profile') : (t('newCustomer') || 'Add New Customer')}
      >
        <form onSubmit={handleSubmit}>
          {formError && (
            <div style={{ color: '#D32F2F', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('fullName') || 'Full Name'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rahul Sharma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('phoneNumber') || 'Phone Number'}</label>
            <input
              type="text"
              className="form-input"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('emailAddress') || 'Email Address'}</label>
            <input
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCustomer ? (t('updateCustomer') || 'Update Profile') : (t('saveCustomer') || 'Save Customer')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Purchase History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`${t('purchaseHistory') || 'Purchase History'} - ${selectedCustomer?.name || ''}`}
      >
        {historyLoading ? (
          <p className="empty-state">Loading purchase records...</p>
        ) : customerSales.length === 0 ? (
          <p className="empty-state">{t('noPurchases') || 'No sales history recorded for this customer yet.'}</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice / Items</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {customerSales.map((sale) => (
                  <tr key={sale._id}>
                    <td className="font-bold">
                      <div>
                        {sale.invoiceNumber && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'block' }}>
                            {sale.invoiceNumber}
                          </span>
                        )}
                        <span>
                          {sale.items && sale.items.length > 0
                            ? sale.items.map((i) => i.productName).join(', ')
                            : sale.product?.name || 'Retail Item'}
                        </span>
                      </div>
                    </td>
                    <td>{sale.quantity || (sale.items ? sale.items.reduce((s, i) => s + i.quantity, 0) : 1)}</td>
                    <td className="font-bold">₹{(sale.grandTotal || sale.totalAmount)?.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${sale.status === 'CANCELLED' ? 'badge-out-of-stock' : 'badge-in-stock'}`}>
                        {sale.status || 'COMPLETED'}
                      </span>
                    </td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => setHistoryModalOpen(false)}
          >
            {t('close') || 'Close'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
