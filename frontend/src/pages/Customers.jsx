import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Edit2, Trash2, History, UserCheck } from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleDelete = async (id) => {
    if (window.confirm('Delete customer record?')) {
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
      setCustomerSales(res.data);
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
    if (!name || !phone || !email) {
      setFormError('All fields (name, phone, email) are required.');
      return;
    }

    try {
      if (editingCustomer) {
        await axios.put(`/api/customers/${editingCustomer._id}`, { name, phone, email });
      } else {
        await axios.post('/api/customers', { name, phone, email });
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save customer');
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('customersTitle')}</h1>
          <p className="page-subtitle">{t('customersSubtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} />
          {t('addCustomer')}
        </button>
      </div>

      {/* Customers List Card */}
      <div className="card">
        {loading ? (
          <p className="empty-state">Loading customer records...</p>
        ) : customers.length === 0 ? (
          <p className="empty-state">No customer records found.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('fullName')}</th>
                  <th>{t('phoneNumber')}</th>
                  <th>{t('emailAddress')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust) => (
                  <tr key={cust._id}>
                    <td className="font-bold">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <UserCheck size={16} color="var(--primary)" />
                        {cust.name}
                      </div>
                    </td>
                    <td>{cust.phone}</td>
                    <td>{cust.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewHistory(cust)}
                          title="View Purchase History"
                        >
                          <History size={14} /> {t('history')}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(cust)}
                          title="Edit Customer"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(cust._id)}
                          title="Delete Customer"
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? t('editCustomer') : t('newCustomer')}
      >
        <form onSubmit={handleSubmit}>
          {formError && (
            <div style={{ color: '#D32F2F', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('fullName')}</label>
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
            <label className="form-label">{t('phoneNumber')}</label>
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
            <label className="form-label">{t('emailAddress')}</label>
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
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCustomer ? t('updateCustomer') : t('saveCustomer')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Purchase History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`${t('purchaseHistory')} - ${selectedCustomer?.name || ''}`}
      >
        {historyLoading ? (
          <p className="empty-state">Loading purchase records...</p>
        ) : customerSales.length === 0 ? (
          <p className="empty-state">{t('noPurchases')}</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('category')}</th>
                  <th>{t('qty')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {customerSales.map((sale) => (
                  <tr key={sale._id}>
                    <td className="font-bold">{sale.product?.name || 'Item'}</td>
                    <td>{sale.product?.category || '-'}</td>
                    <td>{sale.quantity}</td>
                    <td className="font-bold">₹{sale.totalAmount?.toLocaleString()}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(sale.saleDate).toLocaleDateString('en-IN', {
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
            {t('close')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
