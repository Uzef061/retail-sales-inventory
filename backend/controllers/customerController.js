const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const BusinessProfile = require('../models/BusinessProfile');
const { getCurrencyByCodeOrSymbol } = require('../utils/currencyHelper');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

async function getCurrencySymbolForUser(userId) {
  if (!userId) return '₹';
  const profile = await BusinessProfile.findOne({ userId }).select('currency').lean();
  return profile ? getCurrencyByCodeOrSymbol(profile.currency).symbol : '₹';
}

// Email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/customers (With Authoritative Balances & Metrics)
exports.getCustomers = async (req, res) => {
  try {
    const { activeOnly, search } = req.query;
    let query = getTenantQuery(req);

    if (activeOnly === 'true') {
      query.isActive = true;
    }
    if (search) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }
    const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();

    // Compute live balances for each customer across sales, payments, and returns
    const tenantFilter = getTenantQuery(req);
    const [allSales, allPayments, allReturns] = await Promise.all([
      Sale.find({ ...tenantFilter, status: { $ne: 'CANCELLED' } }).select('customer grandTotal totalAmount amountReceived invoiceNumber').lean(),
      PaymentTransaction.find({ ...tenantFilter, partyType: 'CUSTOMER' }).select('partyId amount type referenceNumber').lean(),
      SaleReturn.find(tenantFilter).select('customer amount').lean()
    ]);

    const saleInvoicesWithPaymentTx = new Set();
    for (const p of allPayments) {
      if (p.type === 'RECEIVE' && p.referenceNumber) {
        saleInvoicesWithPaymentTx.add(p.referenceNumber);
      }
    }

    const salesMap = new Map();
    for (const s of allSales) {
      if (s.customer) {
        const cId = s.customer.toString();
        const saleAmt = Number(s.grandTotal || s.totalAmount) || 0;
        const current = salesMap.get(cId) || { totalSales: 0, totalPaidAtSale: 0 };
        current.totalSales += saleAmt;
        if (!saleInvoicesWithPaymentTx.has(s.invoiceNumber)) {
          current.totalPaidAtSale += Number(s.amountReceived) || 0;
        }
        salesMap.set(cId, current);
      }
    }

    const paymentMap = new Map();
    for (const p of allPayments) {
      if (p.partyId) {
        const cId = p.partyId.toString();
        const amt = Number(p.amount) || 0;
        const current = paymentMap.get(cId) || 0;
        if (p.type === 'RECEIVE') {
          paymentMap.set(cId, current + amt);
        } else if (p.type === 'GIVE') {
          // Refund paid back to customer offsets payments received
          paymentMap.set(cId, current - amt);
        }
      }
    }

    const returnMap = new Map();
    for (const r of allReturns) {
      if (r.customer) {
        const cId = r.customer.toString();
        const amt = Number(r.amount) || 0;
        returnMap.set(cId, (returnMap.get(cId) || 0) + amt);
      }
    }

    const currencySymbol = await getCurrencySymbolForUser(req.user?._id);

    const enrichedCustomers = customers.map(c => {
      const cId = c._id.toString();
      const sData = salesMap.get(cId) || { totalSales: 0, totalPaidAtSale: 0 };
      const totalSales = sData.totalSales;
      const totalPaid = sData.totalPaidAtSale + (paymentMap.get(cId) || 0);
      const totalReturns = returnMap.get(cId) || 0;

      // Net Receivable = (Total Sales - Total Returns) - Total Payments
      // Positive: Customer owes business (Receivable)
      // Negative: Customer has credit advance (Store Credit)
      // Zero: Settled
      const netBalance = Math.round(((totalSales - totalReturns) - totalPaid) * 100) / 100;
      let balanceStatus = 'SETTLED';
      let balanceLabel = 'Settled';

      if (netBalance > 0) {
        balanceStatus = 'OWED_BY_CUSTOMER';
        balanceLabel = `Owes ${currencySymbol}${netBalance.toFixed(0)}`;
      } else if (netBalance < 0) {
        balanceStatus = 'CUSTOMER_CREDIT';
        balanceLabel = `Credit ${currencySymbol}${Math.abs(netBalance).toFixed(0)}`;
      }

      return {
        ...c,
        totalSales,
        totalPaid,
        totalReturns,
        balance: netBalance,
        balanceStatus,
        balanceLabel
      };
    });

    res.status(200).json(enrichedCustomers);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching customers', error: error.message });
  }
};

// POST /api/customers
exports.createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.', errorCode: 'MISSING_NAME' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.', errorCode: 'MISSING_PHONE' });
    }
    if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.', errorCode: 'INVALID_EMAIL' });
    }

    // Check for existing customer by phone within tenant to prevent duplicates
    const existing = await Customer.findOne({
      userId: req.user?._id,
      phone: phone.trim()
    });
    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        await existing.save();
      }
      return res.status(200).json(existing);
    }

    const customer = new Customer({
      userId: req.user?._id,
      businessId: req.user?.businessId,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      address: address ? address.trim() : '',
      isActive: true
    });

    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating customer', error: error.message });
  }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const { name, phone, email, address, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    customer.name = name.trim();
    customer.phone = phone.trim();
    customer.email = email ? email.trim() : '';
    customer.address = address ? address.trim() : '';
    if (isActive !== undefined) customer.isActive = Boolean(isActive);

    const updatedCustomer = await customer.save();
    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating customer', error: error.message });
  }
};

// DELETE /api/customers/:id (Soft Delete for Historical Data Protection)
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Check if customer is referenced in Sales, Payments, or Returns
    const hasSales = await Sale.exists({ customer: id });
    const hasPayments = await PaymentTransaction.exists({ partyId: id });
    const hasReturns = await SaleReturn.exists({ customer: id });

    if (hasSales || hasPayments || hasReturns) {
      customer.isActive = false;
      await customer.save();
      return res.status(200).json({
        success: true,
        message: 'Customer deactivated (soft-deleted) to protect historical transaction history.',
        id,
        isSoftDeleted: true
      });
    }

    await Customer.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Customer deleted successfully', id, isSoftDeleted: false });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting customer', error: error.message });
  }
};

// GET /api/customers/:id/sales (Purchase Order History)
exports.getCustomerHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const sales = await Sale.find({ customer: id })
      .populate('product', 'name price sellingPrice category')
      .populate('items.product', 'name price sellingPrice category')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching customer sales history', error: error.message });
  }
};

// GET /api/customers/:id/ledger (Chronological Statement with Running Balance & Dates)
exports.getCustomerLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const customer = await Customer.findById(id);
    if (!customer || !hasTenantAccess(customer, req)) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const tenantFilter = getTenantQuery(req);

    // Fetch customer's sales, payments, and returns
    const [sales, payments, returns] = await Promise.all([
      Sale.find({ ...tenantFilter, customer: id, status: { $ne: 'CANCELLED' } })
        .populate('product', 'name category')
        .populate('items.product', 'name category')
        .lean(),
      PaymentTransaction.find({ ...tenantFilter, partyId: id, partyType: 'CUSTOMER' }).lean(),
      SaleReturn.find({ ...tenantFilter, customer: id }).lean()
    ]);

    const transactions = [];

    // Track which sale invoice payments are already in payments list
    const saleInvoicesWithPaymentTx = new Set();
    for (const p of payments) {
      if (p.type === 'RECEIVE' && p.referenceNumber) {
        saleInvoicesWithPaymentTx.add(p.referenceNumber);
      }
    }

    // 1. Sales increase customer receivable (Debit from business viewpoint)
    for (const s of sales) {
      const saleAmt = Number(s.grandTotal || s.totalAmount) || 0;
      const paidAtSale = Number(s.amountReceived) || 0;
      let itemsSummary = '';
      if (Array.isArray(s.items) && s.items.length > 0) {
        itemsSummary = `${s.items.length} item(s)`;
      } else if (s.product) {
        itemsSummary = `${s.product.name || 'Product'} (${s.quantity} units)`;
      }

      transactions.push({
        id: s._id.toString(),
        type: 'SALE',
        date: s.saleDate || s.createdAt,
        reference: s.invoiceNumber || `INV-${s._id.toString().slice(-8)}`,
        description: `Sale ${s.invoiceNumber || ''}${itemsSummary ? ` • ${itemsSummary}` : ''}`,
        amount: saleAmt,
        amountReceived: paidAtSale,
        direction: 'DEBIT', // Increases receivable
        directionLabel: 'Sale (Receivable)',
        notes: s.notes || '',
        itemsCount: s.items?.length || 1,
        paymentStatus: paidAtSale >= saleAmt ? 'PAID' : (paidAtSale > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
        paymentMethod: s.paymentMethod || 'CASH'
      });

      // If an older sale had amountReceived > 0 but no separate PaymentTransaction, add payment event
      if (paidAtSale > 0 && !saleInvoicesWithPaymentTx.has(s.invoiceNumber)) {
        transactions.push({
          id: `pay_${s._id.toString()}`,
          type: 'PAYMENT_RECEIVED',
          date: s.saleDate || s.createdAt,
          reference: s.invoiceNumber || '',
          description: `Payment received for sale ${s.invoiceNumber || ''} (${s.paymentMethod || 'CASH'})`,
          amount: Math.min(paidAtSale, saleAmt),
          direction: 'CREDIT', // Payment reduces receivable
          directionLabel: 'Payment Received (In)',
          paymentMethod: s.paymentMethod || 'CASH',
          notes: 'Received at checkout'
        });
      }
    }

    // 2. Payments reduce receivable (Credit from business viewpoint)
    for (const p of payments) {
      const amt = Number(p.amount) || 0;
      const isReceive = p.type === 'RECEIVE';

      transactions.push({
        id: p._id.toString(),
        type: isReceive ? 'PAYMENT_RECEIVED' : 'CUSTOMER_REFUND',
        date: p.transactionDate || p.createdAt,
        reference: p.referenceNumber || '',
        description: isReceive
          ? `Payment received from customer (${p.paymentMethod || 'CASH'})${p.referenceNumber ? ` • Ref: ${p.referenceNumber}` : ''}`
          : `Refund paid to customer (${p.paymentMethod || 'CASH'})${p.referenceNumber ? ` • Ref: ${p.referenceNumber}` : ''}`,
        amount: amt,
        direction: isReceive ? 'CREDIT' : 'DEBIT', // Payment reduces receivable; refund increases it
        directionLabel: isReceive ? 'Payment Received (In)' : 'Customer Refund (Out)',
        paymentMethod: p.paymentMethod || 'CASH',
        notes: p.notes || ''
      });
    }

    // 3. Sale returns reduce receivable (Credit from business viewpoint)
    for (const r of returns) {
      const retAmt = Number(r.amount) || 0;
      transactions.push({
        id: r._id.toString(),
        type: 'SALE_RETURN',
        date: r.returnDate || r.createdAt,
        reference: r.invoiceNumber || `RET-${r._id.toString().slice(-8)}`,
        description: `Customer Return ${r.invoiceNumber || ''}${r.originalInvoiceNumber ? ` (Original: ${r.originalInvoiceNumber})` : ''}`,
        amount: retAmt,
        direction: 'CREDIT', // Returns reduce receivable
        directionLabel: 'Sale Return (Credit)',
        notes: r.reason || '',
        refundMethod: r.refundMethod || 'CREDIT'
      });
    }

    // Sort chronologically ascending to compute accurate running balance
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    for (const tx of transactions) {
      if (tx.direction === 'DEBIT') {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }
      tx.runningBalance = Math.round(runningBalance * 100) / 100;
    }

    // Filter by date range if provided
    let filteredTransactions = transactions;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date(8640000000000000);
      if (endDate) end.setHours(23, 59, 59, 999);
      filteredTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    }

    // Sort descending for display (most recent first)
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const currencySymbol = await getCurrencySymbolForUser(req.user?._id);
    const finalBalance = Math.round(runningBalance * 100) / 100;
    let balanceLabel = 'Settled';
    let balanceStatus = 'SETTLED';
    if (finalBalance > 0) {
      balanceStatus = 'OWED_BY_CUSTOMER';
      balanceLabel = `Customer owes ${currencySymbol}${finalBalance.toFixed(0)}`;
    } else if (finalBalance < 0) {
      balanceStatus = 'CUSTOMER_CREDIT';
      balanceLabel = `Customer credit ${currencySymbol}${Math.abs(finalBalance).toFixed(0)}`;
    }

    const totalSales = sales.reduce((sum, s) => sum + (Number(s.grandTotal || s.totalAmount) || 0), 0);
    const totalPaymentsReceived = payments.filter(p => p.type === 'RECEIVE').reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
      sales.filter(s => !saleInvoicesWithPaymentTx.has(s.invoiceNumber)).reduce((sum, s) => sum + (Number(s.amountReceived) || 0), 0);
    const totalReturns = returns.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    res.status(200).json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        balance: finalBalance,
        balanceStatus,
        balanceLabel,
        totalSales,
        totalPaymentsReceived,
        totalReturns
      },
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalReceived: Math.round(totalPaymentsReceived * 100) / 100,
        totalReturns: Math.round(totalReturns * 100) / 100,
        netReceivable: finalBalance,
        currentBalance: finalBalance,
        balanceStatus,
        balanceLabel,
        transactionCount: filteredTransactions.length
      },
      transactions: filteredTransactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating customer ledger statement', error: error.message });
  }
};
