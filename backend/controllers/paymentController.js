const mongoose = require('mongoose');
const PaymentTransaction = require('../models/PaymentTransaction');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// GET /api/payments
exports.getPayments = async (req, res) => {
  try {
    const { type, partyType, partyId, startDate, endDate, search } = req.query;
    let query = getTenantQuery(req);

    if (type && ['RECEIVE', 'GIVE'].includes(type.toUpperCase())) {
      query.type = type.toUpperCase();
    }
    if (partyType && ['CUSTOMER', 'SUPPLIER', 'OTHER'].includes(partyType.toUpperCase())) {
      query.partyType = partyType.toUpperCase();
    }
    if (partyId) {
      query.partyId = partyId;
    }
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.transactionDate.$lte = end;
      }
    }
    if (search) {
      query.$or = [
        { partyName: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const transactions = await PaymentTransaction.find(query).sort({ transactionDate: -1, createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching payment transactions', error: error.message });
  }
};

// GET /api/payments/summary
exports.getPaymentsSummary = async (req, res) => {
  try {
    const baseQuery = getTenantQuery(req);
    const transactions = await PaymentTransaction.find(baseQuery);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let totalReceived = 0;
    let totalGiven = 0;
    let todayReceived = 0;
    let todayGiven = 0;

    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      const tDate = new Date(t.transactionDate);
      const isToday = tDate >= startOfToday && tDate <= endOfToday;

      if (t.type === 'RECEIVE') {
        totalReceived += amt;
        if (isToday) todayReceived += amt;
      } else if (t.type === 'GIVE') {
        totalGiven += amt;
        if (isToday) todayGiven += amt;
      }
    }

    const recentTransactions = transactions
      .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
      .slice(0, 5);

    res.status(200).json({
      success: true,
      totalReceived,
      totalGiven,
      netCashFlow: totalReceived - totalGiven,
      todayReceived,
      todayGiven,
      recentTransactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error calculating payment summary', error: error.message });
  }
};

// POST /api/payments
exports.createPayment = async (req, res) => {
  try {
    const {
      clientUuid,
      type,
      partyType,
      partyId,
      partyName,
      amount,
      paymentMethod,
      transactionDate,
      referenceNumber,
      notes,
      idempotencyKey
    } = req.body;

    if (!type || !['RECEIVE', 'GIVE'].includes(type.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Type must be RECEIVE or GIVE.', errorCode: 'INVALID_TYPE' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number greater than 0.', errorCode: 'INVALID_AMOUNT' });
    }

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ success: false, message: 'Party name is required.', errorCode: 'MISSING_PARTY' });
    }

    const effectivePartyType = (partyType || (type === 'RECEIVE' ? 'CUSTOMER' : 'SUPPLIER')).toUpperCase();

    // Verify tenant ownership of linked party if partyId is provided
    let resolvedPartyId = undefined;
    if (partyId) {
      let partyDoc = null;
      if (mongoose.Types.ObjectId.isValid(partyId)) {
        if (effectivePartyType === 'SUPPLIER') {
          partyDoc = await Supplier.findById(partyId);
        } else if (effectivePartyType === 'CUSTOMER') {
          partyDoc = await Customer.findById(partyId);
        }
      }
      if (!partyDoc) {
        if (effectivePartyType === 'SUPPLIER') {
          partyDoc = await Supplier.findOne({ ...getTenantQuery(req), clientUuid: partyId });
        } else if (effectivePartyType === 'CUSTOMER') {
          partyDoc = await Customer.findOne({ ...getTenantQuery(req), clientUuid: partyId });
        }
      }
      if (partyDoc && !hasTenantAccess(partyDoc, req)) {
        return res.status(403).json({
          success: false,
          message: `${effectivePartyType === 'SUPPLIER' ? 'Supplier' : 'Customer'} belongs to another business or is unauthorized.`,
          errorCode: 'FORBIDDEN_PARTY'
        });
      }
      if (partyDoc) {
        resolvedPartyId = partyDoc._id;
      }
    }

    // Idempotency check to prevent duplicate accidental submissions
    if (clientUuid || idempotencyKey) {
      const orConditions = [];
      if (clientUuid) orConditions.push({ clientUuid });
      if (idempotencyKey) orConditions.push({ idempotencyKey });
      const existing = await PaymentTransaction.findOne({
        ...getTenantQuery(req),
        $or: orConditions
      });
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    const payment = new PaymentTransaction({
      userId: req.user?._id,
      clientUuid: clientUuid || undefined,
      businessId: req.user?.businessId,
      type: type.toUpperCase(),
      partyType: effectivePartyType,
      partyId: resolvedPartyId,
      partyModel: effectivePartyType === 'SUPPLIER' ? 'Supplier' : (effectivePartyType === 'CUSTOMER' ? 'Customer' : undefined),
      partyName: partyName.trim(),
      amount: numAmount,
      paymentMethod: (paymentMethod || 'CASH').toUpperCase(),
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      referenceNumber: referenceNumber ? referenceNumber.trim() : '',
      notes: notes ? notes.trim() : '',
      idempotencyKey: idempotencyKey || undefined,
      createdById: req.user?._id
    });

    const savedPayment = await payment.save();
    res.status(201).json(savedPayment);
  } catch (error) {
    if (error.code === 11000) {
      if (req.body.clientUuid) {
        const existing = await PaymentTransaction.findOne({
          clientUuid: req.body.clientUuid,
          ...getTenantQuery(req)
        });
        if (existing) {
          return res.status(200).json(existing);
        }
      }
      if (req.body.idempotencyKey) {
        const existing = await PaymentTransaction.findOne({
          idempotencyKey: req.body.idempotencyKey,
          ...getTenantQuery(req)
        });
        if (existing) {
          return res.status(200).json(existing);
        }
      }
    }
    res.status(500).json({ success: false, message: 'Error creating payment transaction', error: error.message });
  }
};

// GET /api/payments/:id
exports.getPaymentById = async (req, res) => {
  try {
    let payment = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      payment = await PaymentTransaction.findById(req.params.id);
    }
    if (!payment) {
      payment = await PaymentTransaction.findOne({
        ...getTenantQuery(req),
        $or: [{ clientUuid: req.params.id }, { referenceNumber: req.params.id }]
      });
    }
    if (!payment || !hasTenantAccess(payment, req)) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found.' });
    }
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching payment', error: error.message });
  }
};

// PUT /api/payments/:id
exports.updatePayment = async (req, res) => {
  try {
    const payment = await PaymentTransaction.findById(req.params.id);
    if (!payment || !hasTenantAccess(payment, req)) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found.' });
    }

    const { amount, paymentMethod, transactionDate, referenceNumber, notes, partyName } = req.body;
    if (amount !== undefined) {
      const num = Number(amount);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
      }
      payment.amount = num;
    }
    if (partyName !== undefined) payment.partyName = partyName.trim();
    if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod.toUpperCase();
    if (transactionDate !== undefined) payment.transactionDate = new Date(transactionDate);
    if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber.trim();
    if (notes !== undefined) payment.notes = notes.trim();

    const saved = await payment.save();
    res.status(200).json(saved);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating payment transaction', error: error.message });
  }
};

// DELETE /api/payments/:id
exports.deletePayment = async (req, res) => {
  try {
    const payment = await PaymentTransaction.findById(req.params.id);
    if (!payment || !hasTenantAccess(payment, req)) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found.' });
    }

    await PaymentTransaction.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Payment transaction deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting payment transaction', error: error.message });
  }
};
