const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// GET /api/suppliers (With Authoritative Balances & Metrics)
exports.getSuppliers = async (req, res) => {
  try {
    const { search, activeOnly } = req.query;
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
            { contactPerson: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }
    const suppliers = await Supplier.find(query).sort({ createdAt: -1 }).lean();

    // Compute live balances for each supplier across purchases, payments, and returns
    const tenantFilter = getTenantQuery(req);
    const [allPurchases, allPayments, allReturns] = await Promise.all([
      Purchase.find({ ...tenantFilter, status: { $ne: 'CANCELLED' } }).select('supplier totalCost grandTotal').lean(),
      PaymentTransaction.find({ ...tenantFilter, partyType: 'SUPPLIER' }).select('partyId amount type').lean(),
      PurchaseReturn.find(tenantFilter).select('supplier amount refundAmount').lean()
    ]);

    const purchaseMap = new Map();
    for (const pur of allPurchases) {
      if (pur.supplier) {
        const sId = pur.supplier.toString();
        const amt = Number(pur.totalCost || pur.grandTotal) || 0;
        purchaseMap.set(sId, (purchaseMap.get(sId) || 0) + amt);
      }
    }

    const paymentMap = new Map();
    for (const p of allPayments) {
      if (p.partyId) {
        const sId = p.partyId.toString();
        const amt = Number(p.amount) || 0;
        const current = paymentMap.get(sId) || 0;
        if (p.type === 'GIVE') {
          paymentMap.set(sId, current + amt);
        } else if (p.type === 'RECEIVE') {
          // Refund from supplier offsets payments given
          paymentMap.set(sId, current - amt);
        }
      }
    }

    const returnMap = new Map();
    for (const r of allReturns) {
      if (r.supplier) {
        const sId = r.supplier.toString();
        const amt = Number(r.amount) || 0;
        returnMap.set(sId, (returnMap.get(sId) || 0) + amt);
      }
    }

    const enrichedSuppliers = suppliers.map(s => {
      const sId = s._id.toString();
      const totalPurchases = purchaseMap.get(sId) || 0;
      const totalPayments = paymentMap.get(sId) || 0;
      const totalReturns = returnMap.get(sId) || 0;

      // Net Payable = (Total Purchases - Total Returns) - Net Payments Given
      const netBalance = Math.round(((totalPurchases - totalReturns) - totalPayments) * 100) / 100;
      let balanceStatus = 'SETTLED';
      let balanceLabel = 'Settled';

      if (netBalance > 0) {
        balanceStatus = 'OWED_TO_SUPPLIER';
        balanceLabel = `You Owe ₹${netBalance.toFixed(0)}`;
      } else if (netBalance < 0) {
        balanceStatus = 'SUPPLIER_ADVANCE';
        balanceLabel = `Advance ₹${Math.abs(netBalance).toFixed(0)}`;
      }

      return {
        ...s,
        totalPurchases,
        totalPayments,
        totalReturns,
        balance: netBalance,
        balanceStatus,
        balanceLabel
      };
    });

    res.status(200).json(enrichedSuppliers);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching suppliers', error: error.message });
  }
};

// POST /api/suppliers (With Duplicate Prevention & Auto-Reactivation)
exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, contactPerson } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    // Check for existing supplier by phone within tenant to prevent accidental duplicate creation
    const existing = await Supplier.findOne({
      ...getTenantQuery(req),
      phone: phone.trim()
    });
    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        await existing.save();
      }
      return res.status(200).json(existing);
    }

    const supplier = new Supplier({
      userId: req.user?._id,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      address: address ? address.trim() : '',
      contactPerson: contactPerson ? contactPerson.trim() : '',
      isActive: true
    });

    const savedSupplier = await supplier.save();
    res.status(201).json(savedSupplier);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating supplier', error: error.message });
  }
};

// PUT /api/suppliers/:id
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier || !hasTenantAccess(supplier, req)) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const { name, phone, email, address, contactPerson, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }

    supplier.name = name.trim();
    if (phone !== undefined) supplier.phone = phone.trim();
    if (email !== undefined) supplier.email = email.trim();
    if (address !== undefined) supplier.address = address.trim();
    if (contactPerson !== undefined) supplier.contactPerson = contactPerson.trim();
    if (isActive !== undefined) supplier.isActive = Boolean(isActive);

    const updatedSupplier = await supplier.save();
    res.status(200).json(updatedSupplier);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating supplier', error: error.message });
  }
};

// GET /api/suppliers/:id/ledger (Chronological Statement with Running Balance & Dates)
exports.getSupplierLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const supplier = await Supplier.findById(id);
    if (!supplier || !hasTenantAccess(supplier, req)) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const tenantFilter = getTenantQuery(req);

    // Fetch all supplier purchases, payments, and returns
    const [purchases, payments, returns] = await Promise.all([
      Purchase.find({ ...tenantFilter, supplier: id, status: { $ne: 'CANCELLED' } })
        .populate('product', 'name category')
        .populate('items.product', 'name category')
        .lean(),
      PaymentTransaction.find({ ...tenantFilter, partyId: id, partyType: 'SUPPLIER' }).lean(),
      PurchaseReturn.find({ ...tenantFilter, supplier: id }).lean()
    ]);

    const transactions = [];

    // 1. Purchases increase payable to supplier (Credit from business viewpoint)
    for (const pur of purchases) {
      const purAmt = Number(pur.totalCost || pur.grandTotal) || 0;
      const paidAtPur = Number(pur.amountPaid) || 0;
      let itemsSummary = '';
      if (Array.isArray(pur.items) && pur.items.length > 0) {
        itemsSummary = `${pur.items.length} item(s)`;
      } else if (pur.product) {
        itemsSummary = `${pur.product.name || 'Product'} (${pur.quantity} units)`;
      }

      transactions.push({
        id: pur._id.toString(),
        type: 'PURCHASE',
        date: pur.purchaseDate || pur.createdAt,
        reference: pur.referenceNumber || `PO-${pur._id.toString().slice(-8)}`,
        description: `Purchase Order ${pur.referenceNumber || ''}${itemsSummary ? ` • ${itemsSummary}` : ''}`,
        amount: purAmt,
        amountPaid: paidAtPur,
        direction: 'CREDIT', // Increases payable
        directionLabel: 'Purchase (Payable)',
        notes: pur.notes || '',
        itemsCount: pur.items?.length || 1,
        paymentStatus: pur.paymentStatus || (paidAtPur >= purAmt ? 'PAID' : (paidAtPur > 0 ? 'PARTIALLY_PAID' : 'UNPAID'))
      });
    }

    // 2. Payments reduce payable to supplier (Debit from business viewpoint)
    for (const p of payments) {
      const amt = Number(p.amount) || 0;
      const isGive = p.type === 'GIVE';

      transactions.push({
        id: p._id.toString(),
        type: isGive ? 'PAYMENT_MADE' : 'SUPPLIER_REFUND',
        date: p.transactionDate || p.createdAt,
        reference: p.referenceNumber || '',
        description: isGive ? `Payment to supplier (${p.paymentMethod || 'CASH'})` : `Refund received from supplier (${p.paymentMethod || 'CASH'})`,
        amount: amt,
        direction: isGive ? 'DEBIT' : 'CREDIT', // Payment reduces payable (Debit); refund offsets (Credit)
        directionLabel: isGive ? 'Payment Paid (Out)' : 'Supplier Refund (In)',
        paymentMethod: p.paymentMethod || 'CASH',
        notes: p.notes || ''
      });
    }

    // 3. Purchase Returns reduce payable or create supplier credit (Debit)
    for (const r of returns) {
      const retAmt = Number(r.amount) || 0;

      transactions.push({
        id: r._id.toString(),
        type: 'PURCHASE_RETURN',
        date: r.returnDate || r.createdAt,
        reference: r.referenceNumber || `PR-${r._id.toString().slice(-8)}`,
        description: `Purchase Return ${r.referenceNumber || ''} • ${r.refundMode}`,
        amount: retAmt,
        refundMode: r.refundMode,
        direction: 'DEBIT', // Return reduces payable
        directionLabel: 'Purchase Return (Debit)',
        notes: r.reason || 'Goods returned to supplier'
      });
    }

    // Sort chronologically ascending to compute running balance
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    for (const tx of transactions) {
      if (tx.direction === 'CREDIT') {
        runningBalance += tx.amount;
      } else if (tx.direction === 'DEBIT') {
        runningBalance -= tx.amount;
      }
      tx.runningBalance = Math.round(runningBalance * 100) / 100;
    }

    // Filter by date range if provided for display
    let filteredTransactions = transactions;
    if (startDate || endDate) {
      const sDate = startDate ? new Date(startDate) : new Date(0);
      const eDate = endDate ? new Date(endDate) : new Date();
      eDate.setHours(23, 59, 59, 999);
      filteredTransactions = transactions.filter(tx => {
        const d = new Date(tx.date);
        return d >= sDate && d <= eDate;
      });
    }

    // Reverse for UI display (newest first)
    const displayTransactions = [...filteredTransactions].reverse();

    const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.totalCost || p.grandTotal) || 0), 0);
    const totalPayments = payments.reduce((sum, p) => p.type === 'GIVE' ? sum + (Number(p.amount) || 0) : sum - (Number(p.amount) || 0), 0);
    const totalReturns = returns.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const finalBalance = Math.round(runningBalance * 100) / 100;

    let balanceLabel = 'Settled';
    let balanceStatus = 'SETTLED';
    if (finalBalance > 0) {
      balanceStatus = 'OWED_TO_SUPPLIER';
      balanceLabel = `You owe supplier ₹${finalBalance.toFixed(0)}`;
    } else if (finalBalance < 0) {
      balanceStatus = 'SUPPLIER_ADVANCE';
      balanceLabel = `Supplier advance ₹${Math.abs(finalBalance).toFixed(0)}`;
    }

    res.status(200).json({
      success: true,
      supplier,
      summary: {
        totalPurchases,
        totalPayments,
        totalReturns,
        balance: finalBalance,
        balanceStatus,
        balanceLabel,
        transactionCount: transactions.length
      },
      transactions: displayTransactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching supplier ledger', error: error.message });
  }
};

// DELETE /api/suppliers/:id (Soft Delete if purchases, returns, or payments exist)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier || !hasTenantAccess(supplier, req)) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const hasPurchases = await Purchase.exists({ supplier: id });
    const hasPayments = await PaymentTransaction.exists({ partyId: id });
    const hasReturns = await PurchaseReturn.exists({ supplier: id });

    if (hasPurchases || hasPayments || hasReturns) {
      supplier.isActive = false;
      await supplier.save();
      return res.status(200).json({
        success: true,
        message: 'Supplier deactivated (soft-deleted) to protect historical purchase order and payment history.',
        id,
        isSoftDeleted: true
      });
    }

    await Supplier.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Supplier deleted successfully', id, isSoftDeleted: false });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting supplier', error: error.message });
  }
};
