import React from 'react';
import { Printer, X, Store, CheckCircle, Ban } from 'lucide-react';

export default function InvoiceModal({ sale, onClose }) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCancelled = sale.status === 'CANCELLED';

  return (
    <div className="invoice-modal-overlay">
      <div className="invoice-modal-card">
        <div className="invoice-modal-header no-print">
          <h3>Transaction Invoice</h3>
          <div className="header-actions">
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Print Invoice
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="printable-invoice" id="printable-area">
          <div className="invoice-brand-header">
            <div className="brand-logo-area">
              <Store size={32} className="brand-icon" />
              <div>
                <h2>Retail Manager</h2>
                <p>Retail Sales & Inventory Management System</p>
              </div>
            </div>
            <div className="invoice-meta-right">
              <div className="invoice-num">INVOICE: #{sale.invoiceNumber || sale._id?.slice(-8).toUpperCase()}</div>
              <div className="invoice-date">
                Date: {new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-GB')}
              </div>
              {isCancelled && (
                <div className="cancelled-watermark">
                  <Ban size={14} /> CANCELLED
                </div>
              )}
            </div>
          </div>

          <div className="invoice-details-grid">
            <div>
              <span className="details-label">Billed To:</span>
              <div className="details-value">{sale.customer?.name || 'Walk-in Customer'}</div>
              {sale.customer?.phone && (
                <div className="details-sub">Phone: {sale.customer.phone}</div>
              )}
            </div>
            <div>
              <span className="details-label">Payment Method:</span>
              <div className="details-value">{sale.paymentMethod || 'Cash'}</div>
              <span className="details-label" style={{ marginTop: '0.4rem', display: 'block' }}>
                Status:
              </span>
              <div className={`status-badge ${isCancelled ? 'status-cancelled' : 'status-completed'}`}>
                {isCancelled ? 'CANCELLED' : 'COMPLETED'}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="invoice-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items && sale.items.length > 0 ? (
                sale.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td className="fw-600">{item.productName || item.product?.name || 'Product'}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.unitPrice?.toLocaleString('en-IN')}</td>
                    <td className="fw-600">₹{(item.totalPrice || item.quantity * item.unitPrice)?.toLocaleString('en-IN')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>1</td>
                  <td className="fw-600">{sale.product?.name || 'Product'}</td>
                  <td>{sale.quantity || 1}</td>
                  <td>₹{(sale.totalPrice / (sale.quantity || 1))?.toLocaleString('en-IN')}</td>
                  <td className="fw-600">₹{sale.totalPrice?.toLocaleString('en-IN')}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Financial Totals */}
          <div className="invoice-totals-wrapper">
            <div className="invoice-totals-table">
              <div className="totals-row">
                <span>Subtotal:</span>
                <span>₹{(sale.subtotal || sale.totalPrice)?.toLocaleString('en-IN')}</span>
              </div>
              {sale.discount > 0 && (
                <div className="totals-row text-success">
                  <span>Discount:</span>
                  <span>-₹{sale.discount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              {sale.tax > 0 && (
                <div className="totals-row">
                  <span>Tax / GST:</span>
                  <span>+₹{sale.tax?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="totals-row grand-total-row">
                <span>Grand Total:</span>
                <span>₹{(sale.grandTotal || sale.totalPrice)?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="invoice-footer">
            <p>Thank you for shopping with us!</p>
            <p className="footer-sub">This is a computer-generated tax invoice.</p>
          </div>
        </div>
      </div>

      <style>{`
        .invoice-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 1rem;
        }

        .invoice-modal-card {
          background: var(--card-bg, #ffffff);
          color: var(--text-main, #333333);
          border-radius: var(--radius-md, 8px);
          width: 650px;
          max-width: 95vw;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .invoice-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color, #e5e5e5);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .printable-invoice {
          padding: 1.75rem;
        }

        .invoice-brand-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid var(--primary, #c96a3d);
          padding-bottom: 1rem;
          margin-bottom: 1.25rem;
        }

        .brand-logo-area {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-logo-area h2 {
          margin: 0;
          font-size: 1.35rem;
          color: var(--primary, #c96a3d);
        }

        .brand-logo-area p {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-muted, #777);
        }

        .invoice-meta-right {
          text-align: right;
        }

        .invoice-num {
          font-weight: 700;
          font-size: 1.1rem;
        }

        .invoice-date {
          font-size: 0.85rem;
          color: var(--text-muted, #777);
        }

        .cancelled-watermark {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(220, 53, 69, 0.15);
          color: #dc3545;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.75rem;
          margin-top: 0.3rem;
        }

        .invoice-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.02);
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1.25rem;
        }

        .details-label {
          font-size: 0.75rem;
          color: var(--text-muted, #777);
          text-transform: uppercase;
          font-weight: 600;
        }

        .details-value {
          font-weight: 700;
          font-size: 1rem;
        }

        .details-sub {
          font-size: 0.85rem;
          color: var(--text-muted, #777);
        }

        .status-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .status-completed {
          background-color: rgba(40, 167, 69, 0.15);
          color: #28a745;
        }

        .status-cancelled {
          background-color: rgba(220, 53, 69, 0.15);
          color: #dc3545;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.25rem;
        }

        .invoice-table th, .invoice-table td {
          padding: 0.65rem 0.75rem;
          border-bottom: 1px solid var(--border-color, #e5e5e5);
          text-align: left;
        }

        .invoice-table th {
          background: rgba(0, 0, 0, 0.03);
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .invoice-totals-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1.5rem;
        }

        .invoice-totals-table {
          width: 250px;
        }

        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 0.35rem 0;
          font-size: 0.9rem;
        }

        .grand-total-row {
          border-top: 2px solid var(--border-color, #e5e5e5);
          font-weight: 800;
          font-size: 1.15rem;
          color: var(--primary, #c96a3d);
          padding-top: 0.5rem;
          margin-top: 0.3rem;
        }

        .invoice-footer {
          text-align: center;
          border-top: 1px dashed var(--border-color, #ccc);
          padding-top: 1rem;
          font-weight: 600;
        }

        .footer-sub {
          font-size: 0.75rem;
          color: var(--text-muted, #888);
          font-weight: 400;
          margin-top: 0.2rem;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .invoice-modal-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: none;
            padding: 0;
          }
          .invoice-modal-card {
            box-shadow: none;
            width: 100%;
            max-width: 100%;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
