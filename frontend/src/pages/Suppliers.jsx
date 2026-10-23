import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, User, PackageCheck, History, Package } from 'lucide-react';
import Modal from '../components/Modal';
import { useApp } from '../context/AppContext';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Supplier Purchase History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { t } = useApp();

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/suppliers', { params: { search: searchTerm } });
      setSuppliers(res.data);
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [searchTerm]);

  const handleOpenModal = (supplier = null) => {
    setFormError('');
    if (supplier) {
      setEditingSupplier(supplier);
      setName(supplier.name || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setContactPerson(supplier.contactPerson || '');
    } else {
      setEditingSupplier(null);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setContactPerson('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleViewPurchases = async (supplier) => {
    setSelectedSupplier(supplier);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get('/api/purchases');
      const filtered = (res.data || []).filter(
        (p) => (p.supplier?._id || p.supplier) === supplier._id
      );
      setSupplierPurchases(filtered);
    } catch (err) {
      console.error('Error fetching supplier purchases:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !phone.trim()) {
      setFormError('Supplier Name and Phone Number are required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        contactPerson: contactPerson.trim()
      };

      if (editingSupplier) {
        await axios.put(`/api/suppliers/${editingSupplier._id}`, payload);
      } else {
        await axios.post('/api/suppliers', payload);
      }

      handleCloseModal();
      fetchSuppliers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save supplier profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, supplierName) => {
    if (window.confirm(`Are you sure you want to remove or deactivate ${supplierName}?`)) {
      try {
        await axios.delete(`/api/suppliers/${id}`);
        fetchSuppliers();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete supplier.');
      }
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Truck color="var(--primary)" size={28} />
            Supplier Directory
          </h1>
          <p className="page-subtitle">Manage wholesale vendor profiles & restock supply contacts</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={16} />
          Add Supplier
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-container">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              className="search-input"
              placeholder="Search supplier by name, phone, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {suppliers.length} suppliers
          </span>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card">
        {loading ? (
          <p className="empty-state">Loading suppliers directory...</p>
        ) : suppliers.length === 0 ? (
          <p className="empty-state">No suppliers registered yet. Click "Add Supplier" to add one.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Contact Person</th>
                  <th>Phone Number</th>
                  <th>Email Address</th>
                  <th>Balance / Ledger</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((sup) => (
                  <tr key={sup._id} style={{ opacity: sup.isActive === false ? 0.6 : 1 }}>
                    <td className="font-bold">{sup.name}</td>
                    <td>
                      {sup.contactPerson ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User size={13} color="var(--primary)" />
                          {sup.contactPerson}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Phone size={13} color="var(--text-muted)" />
                        {sup.phone}
                      </span>
                    </td>
                    <td>
                      {sup.email ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Mail size={13} color="var(--text-muted)" />
                          {sup.email}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          sup.balanceStatus === 'OWED_TO_SUPPLIER' || sup.balance > 0
                            ? 'badge-out-of-stock'
                            : (sup.balanceStatus === 'SUPPLIER_ADVANCE' || sup.balance < 0
                            ? 'badge-in-stock'
                            : 'badge-low-stock')
                        }`}
                        style={{ fontSize: '0.8rem' }}
                      >
                        {sup.balanceLabel ||
                          (sup.balance > 0
                            ? `You owe ₹${sup.balance.toLocaleString()}`
                            : (sup.balance < 0
                            ? `Advance ₹${(-sup.balance).toLocaleString()}`
                            : 'Settled (₹0)'))}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${sup.isActive === false ? 'badge-out-of-stock' : 'badge-in-stock'}`}>
                        {sup.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewPurchases(sup)}
                          title="View Past Purchases"
                        >
                          <History size={13} /> Orders
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenModal(sup)}
                          title="Edit Supplier"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(sup._id, sup.name)}
                          title="Delete / Deactivate"
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

      {/* Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier Vendor'}
      >
        {formError && (
          <div style={{ color: 'var(--badge-out-of-stock-color)', backgroundColor: 'var(--badge-out-of-stock-bg)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Vendor / Company Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Himalayan Organics Wholesale Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Suresh Verma (Manager)"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Office / Warehouse Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="City, State / Industrial Area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Purchase Orders History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Restock Orders - ${selectedSupplier?.name || 'Supplier'}`}
      >
        {historyLoading ? (
          <p className="empty-state">Loading purchase records for this vendor...</p>
        ) : supplierPurchases.length === 0 ? (
          <p className="empty-state">No restock purchase orders recorded for this vendor yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                  <th>Ref #</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {supplierPurchases.map((po) => (
                  <tr key={po._id}>
                    <td className="font-bold">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Package size={14} color="var(--primary)" />
                        {po.product?.name || 'Product'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-in-stock">+{po.quantity}</span>
                    </td>
                    <td>₹{po.costPrice?.toLocaleString()}</td>
                    <td className="font-bold">₹{po.totalCost?.toLocaleString()}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>{po.referenceNumber || '-'}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(po.purchaseDate || po.createdAt).toLocaleDateString('en-IN', {
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
          <button className="btn btn-secondary" onClick={() => setHistoryModalOpen(false)}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
