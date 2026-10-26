const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const InventoryTransaction = require('../models/InventoryTransaction');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

const normalizePaymentMethod = (pm) => {
  if (!pm) return 'CASH';
  const upper = pm.toString().toUpperCase().trim();
  if (['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CREDIT', 'OTHER'].includes(upper)) {
    return upper;
  }
  return 'CASH';
};

/**
 * Executes a callback within a MongoDB session/transaction when replica sets are available.
 * If transactions are not supported by the deployed MongoDB instance (e.g. standalone test mode),
 * it safely executes the callback with null session.
 */
const withOptionalTransaction = async (operation) => {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (txErr) {
      if (
        txErr.message &&
        (txErr.message.includes('Transaction numbers are only allowed') ||
         txErr.message.includes('replica set member') ||
         txErr.message.includes('standalone'))
      ) {
        return await operation(null);
      }
      throw txErr;
    }
  } finally {
    session.endSession();
  }
};

// GET /api/purchases
exports.getPurchases = async (req, res) => {
  try {
    const query = getTenantQuery(req);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username')
      .sort({ purchaseDate: -1, createdAt: -1 });
    res.status(200).json(purchases || []);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ success: false, message: 'Error fetching purchases', error: error.message });
  }
};

// GET /api/purchases/:id
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username');

    if (!purchase || !hasTenantAccess(purchase, req)) {
      return res.status(404).json({ success: false, message: 'Purchase record not found.' });
    }

    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching purchase', error: error.message });
  }
};

// POST /api/purchases (Create Purchase Order, Increment Stock, Link Supplier & Payment Atomically)
exports.createPurchase = async (req, res) => {
  try {
    const {
      clientUuid,
      supplier,
      supplierId,
      supplierName,
      supplierPhone,
      supplierEmail,
      supplierAddress,
      product,
      productId,
      quantity,
      costPrice,
      unitCostPrice,
      items,
      subtotal,
      discount = 0,
      tax = 0,
      amountPaid = 0,
      paymentMethod = 'CASH',
      purchaseDate,
      referenceNumber,
      notes,
      updateProductCost = true,
      idempotencyKey
    } = req.body;

    // 0. Idempotency check to prevent duplicate restock on rapid Save taps
    if (clientUuid || idempotencyKey) {
      const orConditions = [];
      if (clientUuid) orConditions.push({ clientUuid });
      if (idempotencyKey) orConditions.push({ idempotencyKey });
      const existingPurchase = await Purchase.findOne({
        ...getTenantQuery(req),
        $or: orConditions
      })
        .populate('supplier', 'name phone email contactPerson companyName address')
        .populate('product', 'name category costPrice sellingPrice stock')
        .populate('items.product', 'name category costPrice sellingPrice stock')
        .populate('createdById', 'name username');
      if (existingPurchase) {
        return res.status(200).json(existingPurchase);
      }
    }

    // Validate amountPaid is non-negative
    if (amountPaid !== undefined && (isNaN(Number(amountPaid)) || Number(amountPaid) < 0)) {
      return res.status(400).json({ success: false, message: 'Amount paid cannot be negative.' });
    }

    // 1. Supplier resolution & strict tenant ownership verification
    let targetSupplier;
    let targetSupplierId = supplierId || supplier;
    if (typeof targetSupplierId === 'object' && targetSupplierId !== null) {
      targetSupplierId = targetSupplierId._id || targetSupplierId.id;
    }

    if (targetSupplierId) {
      if (mongoose.Types.ObjectId.isValid(targetSupplierId)) {
        targetSupplier = await Supplier.findById(targetSupplierId);
      }
      if (!targetSupplier) {
        targetSupplier = await Supplier.findOne({
          ...getTenantQuery(req),
          clientUuid: targetSupplierId
        });
      }
      if (targetSupplier && !hasTenantAccess(targetSupplier, req)) {
        return res.status(403).json({
          success: false,
          message: 'Supplier belongs to another store or business.',
          errorCode: 'FORBIDDEN_SUPPLIER'
        });
      }
    }

    if (!targetSupplier && supplierPhone && String(supplierPhone).trim()) {
      targetSupplier = await Supplier.findOne({
        ...getTenantQuery(req),
        phone: String(supplierPhone).trim()
      });
    }

    // 2. Parse Line Items (Support both multi-item and legacy single-item)
    const hasItemsArray = Array.isArray(items) && items.length > 0;
    const normalizedItems = [];

    if (hasItemsArray) {
      for (const item of items) {
        let prodId = item.product || item.productId;
        if (typeof prodId === 'object' && prodId !== null) {
          prodId = prodId._id || prodId.id;
        }
        prodId = prodId ? String(prodId).trim() : '';

        const qty = Number(item.quantity);
        const cost = Number(item.costPrice !== undefined ? item.costPrice : (item.unitCostPrice !== undefined ? item.unitCostPrice : 0));

        if (!prodId || isNaN(qty) || qty <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Each purchase item requires a valid product and positive quantity.'
          });
        }
        if (isNaN(cost) || cost < 0) {
          return res.status(400).json({
            success: false,
            message: 'Item cost price cannot be negative.'
          });
        }

        let prodDoc = null;
        if (mongoose.Types.ObjectId.isValid(prodId)) {
          prodDoc = await Product.findById(prodId);
        }
        if (!prodDoc) {
          prodDoc = await Product.findOne(
            getTenantQuery(req, { $or: [{ clientUuid: prodId }, { sku: prodId }, { name: prodId }] })
          );
        }

        if (!prodDoc || prodDoc.isActive === false || !hasTenantAccess(prodDoc, req)) {
          return res.status(404).json({
            success: false,
            message: `Product ${prodId} not found, inactive or unauthorized.`
          });
        }

        const itemDisc = Number(item.discount) || 0;
        const itemTax = Number(item.tax) || 0;
        const lineTotal = Math.max(0, (qty * cost) - itemDisc + itemTax);

        normalizedItems.push({
          productDoc: prodDoc,
          product: prodDoc._id,
          quantity: qty,
          costPrice: cost,
          unitCostPrice: cost,
          discount: itemDisc,
          tax: itemTax,
          totalCost: lineTotal
        });
      }
    } else {
      // Legacy single-item format
      let targetProductId = productId || product;
      if (typeof targetProductId === 'object' && targetProductId !== null) {
        targetProductId = targetProductId._id || targetProductId.id;
      }
      targetProductId = targetProductId ? String(targetProductId).trim() : '';

      if (!targetProductId || !quantity) {
        return res.status(400).json({ success: false, message: 'At least one product item and quantity are required.' });
      }

      const qty = Number(quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive number greater than 0.' });
      }

      let targetProduct = null;
      if (mongoose.Types.ObjectId.isValid(targetProductId)) {
        targetProduct = await Product.findById(targetProductId);
      } else {
        targetProduct = await Product.findOne(
          getTenantQuery(req, { $or: [{ sku: targetProductId }, { name: targetProductId }] })
        );
      }

      if (!targetProduct || targetProduct.isActive === false || !hasTenantAccess(targetProduct, req)) {
        return res.status(404).json({ success: false, message: 'Active product not found or unauthorized.' });
      }

      const cost = Number(costPrice !== undefined ? costPrice : (unitCostPrice !== undefined ? unitCostPrice : targetProduct.costPrice)) || 0;
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ success: false, message: 'Unit cost price must be 0 or greater.' });
      }

      normalizedItems.push({
        productDoc: targetProduct,
        product: targetProduct._id,
        quantity: qty,
        costPrice: cost,
        unitCostPrice: cost,
        discount: 0,
        tax: 0,
        totalCost: qty * cost
      });
    }

    // 3. Compute Totals
    let subtotalCalc = 0;
    for (const item of normalizedItems) {
      subtotalCalc += (item.quantity * item.costPrice);
    }

    const discountVal = Number(discount) || 0;
    const taxVal = Number(tax) || 0;
    const grandTotalCalc = Math.max(0, subtotalCalc - discountVal + taxVal);
    const paidAmount = Number(amountPaid) || 0;
    const effectivePaymentMethod = normalizePaymentMethod(paymentMethod);
    const refNum = referenceNumber && referenceNumber.trim() ? referenceNumber.trim() : `PO-${Date.now().toString().slice(-8)}`;

    let paymentStatus = 'UNPAID';
    if (paidAmount >= grandTotalCalc && grandTotalCalc > 0) {
      paymentStatus = 'PAID';
    } else if (paidAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    } else if (grandTotalCalc === 0 && paidAmount === 0) {
      paymentStatus = 'PAID';
    }

    // 4. Atomic Execution via Transaction
    const createdPurchase = await withOptionalTransaction(async (session) => {
      // 4a. If supplier does not exist yet, auto-create inside session
      if (!targetSupplier) {
        const sPhone = (supplierPhone || (typeof supplier === 'string' && !mongoose.Types.ObjectId.isValid(supplier) ? supplier : '')).trim();
        const sName = (supplierName || (typeof supplier === 'string' && !mongoose.Types.ObjectId.isValid(supplier) ? 'Supplier' : '')).trim();

        if (sName || sPhone) {
          const newSup = new Supplier({
            userId: req.user?._id,
            businessId: req.user?.businessId,
            name: sName || (sPhone ? `Supplier (${sPhone})` : 'General Supplier'),
            phone: sPhone || 'N/A',
            email: supplierEmail ? supplierEmail.trim() : '',
            address: supplierAddress ? supplierAddress.trim() : '',
            isActive: true
          });
          targetSupplier = await newSup.save(session ? { session } : undefined);
        }
      } else if (targetSupplier && targetSupplier.isActive === false) {
        targetSupplier.isActive = true;
        await targetSupplier.save(session ? { session } : undefined);
      }

      // 4b. Atomically Increment Inventory Stock & Record Movement Ledger
      // Product accepted by validation MUST be the exact product successfully updated!
      for (const item of normalizedItems) {
        const updateOpts = { new: false };
        if (session) updateOpts.session = session;

        const prevDoc = await Product.findOneAndUpdate(
          { _id: item.product },
          {
            $inc: { stock: item.quantity },
            ...(updateProductCost ? { costPrice: item.costPrice } : {})
          },
          updateOpts
        );

        if (!prevDoc) {
          throw new Error(`Failed to update stock for product "${item.productDoc.name}": record not found or inaccessible.`);
        }

        const prevStock = prevDoc.stock;
        const invTx = new InventoryTransaction({
          userId: req.user?._id,
          businessId: req.user?.businessId,
          product: item.product,
          type: 'PURCHASE',
          quantity: item.quantity,
          previousStock: prevStock,
          newStock: prevStock + item.quantity,
          referenceId: refNum,
          notes: `Restock purchase order ${refNum} (${item.quantity} units @ ₹${item.costPrice})`,
          createdById: req.user?._id
        });
        await invTx.save(session ? { session } : undefined);
      }

      // 4c. Record PaymentTransaction if payment was made at purchase time
      if (paidAmount > 0 && targetSupplier) {
        const pTx = new PaymentTransaction({
          userId: req.user?._id,
          businessId: req.user?.businessId,
          type: 'GIVE',
          partyType: 'SUPPLIER',
          partyId: targetSupplier._id,
          partyModel: 'Supplier',
          partyName: targetSupplier.name,
          amount: paidAmount,
          paymentMethod: effectivePaymentMethod,
          transactionDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          referenceNumber: refNum,
          notes: `Payment for purchase order ${refNum}`,
          createdById: req.user?._id
        });
        await pTx.save(session ? { session } : undefined);
      }

      // 4d. Create Purchase Record
      const firstItem = normalizedItems[0];
      const purchase = new Purchase({
        userId: req.user?._id,
        clientUuid: clientUuid || undefined,
        businessId: req.user?.businessId,
        supplier: targetSupplier ? targetSupplier._id : undefined,
        product: firstItem.product,
        items: normalizedItems.map(({ product, quantity, costPrice, unitCostPrice, discount, tax, totalCost }) => ({
          product, quantity, costPrice, unitCostPrice, discount, tax, totalCost
        })),
        quantity: normalizedItems.reduce((sum, i) => sum + i.quantity, 0),
        costPrice: firstItem.costPrice,
        subtotal: subtotalCalc,
        discount: discountVal,
        tax: taxVal,
        totalCost: grandTotalCalc,
        grandTotal: grandTotalCalc,
        amountPaid: paidAmount,
        paymentStatus,
        paymentMethod: effectivePaymentMethod,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        referenceNumber: refNum,
        notes: notes ? String(notes).trim() : '',
        idempotencyKey: idempotencyKey || undefined,
        createdById: req.user?._id
      });

      return await purchase.save(session ? { session } : undefined);
    });

    const populatedPurchase = await Purchase.findById(createdPurchase._id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username');

    res.status(201).json(populatedPurchase);
  } catch (error) {
    if (error.code === 11000) {
      if (req.body.clientUuid) {
        const existing = await Purchase.findOne({
          clientUuid: req.body.clientUuid,
          ...getTenantQuery(req)
        })
          .populate('supplier', 'name phone email contactPerson companyName address')
          .populate('product', 'name category costPrice sellingPrice stock')
          .populate('items.product', 'name category costPrice sellingPrice stock')
          .populate('createdById', 'name username');
        if (existing) {
          return res.status(200).json(existing);
        }
      }
      if (req.body.idempotencyKey) {
        const existing = await Purchase.findOne({
          idempotencyKey: req.body.idempotencyKey,
          ...getTenantQuery(req)
        })
          .populate('supplier', 'name phone email contactPerson companyName address')
          .populate('product', 'name category costPrice sellingPrice stock')
          .populate('items.product', 'name category costPrice sellingPrice stock')
          .populate('createdById', 'name username');
        if (existing) {
          return res.status(200).json(existing);
        }
      }
    }
    console.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, message: 'Error creating purchase order', error: error.message });
  }
};

// POST /api/purchases/:id/return — Purchase Return to Supplier (Reduces Inventory & Corrects Payable)
exports.returnPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clientUuid,
      returnAmount,
      returnedItems,
      reason,
      refundMode = 'REDUCE_PAYABLE',
      idempotencyKey
    } = req.body;

    // 0. Idempotency check
    if (clientUuid || idempotencyKey) {
      const orConditions = [];
      if (clientUuid) orConditions.push({ clientUuid });
      if (idempotencyKey) orConditions.push({ idempotencyKey });
      const existingReturn = await PurchaseReturn.findOne({
        ...getTenantQuery(req),
        $or: orConditions
      });
      if (existingReturn) {
        const existingPurchase = await Purchase.findById(existingReturn.purchaseId)
          .populate('supplier', 'name phone email contactPerson companyName')
          .populate('product', 'name category costPrice sellingPrice stock')
          .populate('items.product', 'name category costPrice sellingPrice stock');
        return res.status(200).json({
          success: true,
          message: 'Purchase return already processed (idempotent)',
          return: existingReturn,
          purchase: existingPurchase
        });
      }
    }

    let purchase = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      purchase = await Purchase.findById(id).populate('supplier');
    }
    if (!purchase) {
      purchase = await Purchase.findOne({
        ...getTenantQuery(req),
        $or: [{ clientUuid: id }, { referenceNumber: id }]
      }).populate('supplier');
    }
    if (!purchase || !hasTenantAccess(purchase, req)) {
      return res.status(404).json({ success: false, message: 'Purchase record not found.' });
    }

    if (purchase.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot return a cancelled purchase order.',
        errorCode: 'PURCHASE_CANCELLED'
      });
    }

    const previousReturned = Number(purchase.returnedAmount) || 0;
    const purchaseTotal = Number(purchase.totalCost || purchase.grandTotal) || 0;
    const maxReturnable = Math.max(0, purchaseTotal - previousReturned);

    if (maxReturnable <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This purchase order has already been fully returned.',
        errorCode: 'ALREADY_FULLY_RETURNED'
      });
    }

    // 1. Process items to deduct from stock
    const itemsToDeduct = [];
    let calculatedReturnAmount = 0;

    if (Array.isArray(returnedItems) && returnedItems.length > 0) {
      for (const item of returnedItems) {
        const prodId = item.product || item.productId;
        const qty = Number(item.quantity);
        const cost = Number(item.costPrice !== undefined ? item.costPrice : (item.unitCostPrice || 0));

        if (prodId && qty > 0) {
          const prod = await Product.findById(prodId);
          if (!prod || !hasTenantAccess(prod, req)) {
            return res.status(404).json({ success: false, message: `Product ${prodId} not found or unauthorized.` });
          }

          // Safety check: Stock must be available to return
          if (prod.stock < qty) {
            return res.status(400).json({
              success: false,
              message: `Cannot return items: Current stock for "${prod.name}" (${prod.stock}) is less than returned quantity (${qty}). Items may have already been sold.`,
              errorCode: 'INSUFFICIENT_STOCK_FOR_RETURN'
            });
          }

          const lineTotal = qty * cost;
          calculatedReturnAmount += lineTotal;
          itemsToDeduct.push({
            product: prod._id,
            productDoc: prod,
            quantity: qty,
            costPrice: cost,
            unitCostPrice: cost,
            totalCost: lineTotal
          });
        }
      }
    } else if (purchase.items && purchase.items.length > 0) {
      // Return all purchase items if not explicitly itemized
      for (const pItem of purchase.items) {
        const prod = await Product.findById(pItem.product);
        if (prod && hasTenantAccess(prod, req)) {
          if (prod.stock < pItem.quantity) {
            return res.status(400).json({
              success: false,
              message: `Cannot return purchase: Current stock for "${prod.name}" (${prod.stock}) is less than returned quantity (${pItem.quantity}).`,
              errorCode: 'INSUFFICIENT_STOCK_FOR_RETURN'
            });
          }
          itemsToDeduct.push({
            product: prod._id,
            productDoc: prod,
            quantity: pItem.quantity,
            costPrice: pItem.costPrice,
            unitCostPrice: pItem.unitCostPrice || pItem.costPrice,
            totalCost: pItem.totalCost
          });
          calculatedReturnAmount += pItem.totalCost;
        }
      }
    } else if (purchase.product) {
      const prod = await Product.findById(purchase.product);
      if (prod && hasTenantAccess(prod, req)) {
        if (prod.stock < purchase.quantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot return purchase: Current stock for "${prod.name}" (${prod.stock}) is less than returned quantity (${purchase.quantity}).`,
            errorCode: 'INSUFFICIENT_STOCK_FOR_RETURN'
          });
        }
        itemsToDeduct.push({
          product: prod._id,
          productDoc: prod,
          quantity: purchase.quantity,
          costPrice: purchase.costPrice,
          unitCostPrice: purchase.costPrice,
          totalCost: purchase.totalCost
        });
        calculatedReturnAmount = purchase.totalCost;
      }
    }

    const requestedAmount = returnAmount !== undefined ? Number(returnAmount) : (calculatedReturnAmount || maxReturnable);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Return amount must be greater than 0.',
        errorCode: 'INVALID_RETURN_AMOUNT'
      });
    }

    if (requestedAmount > maxReturnable) {
      return res.status(400).json({
        success: false,
        message: `Return amount (₹${requestedAmount}) cannot exceed remaining returnable amount (₹${maxReturnable}).`,
        errorCode: 'EXCEEDS_RETURNABLE'
      });
    }

    const returnRef = `PR-${Date.now().toString().slice(-8)}`;
    const refundCashAmount = refundMode === 'REFUND_RECEIVED' ? requestedAmount : 0;

    // 2. Atomic Return Execution
    const resultReturn = await withOptionalTransaction(async (session) => {
      // 2a. Deduct Returned Goods from Inventory Stock
      for (const item of itemsToDeduct) {
        const updateOpts = { new: false };
        if (session) updateOpts.session = session;

        const prevDoc = await Product.findOneAndUpdate(
          { _id: item.product },
          { $inc: { stock: -item.quantity } },
          updateOpts
        );

        if (!prevDoc) {
          throw new Error(`Failed to deduct stock for product "${item.productDoc.name}": record not found.`);
        }

        const prevStock = prevDoc.stock;
        const invTx = new InventoryTransaction({
          userId: req.user?._id,
          businessId: req.user?.businessId,
          product: item.product,
          type: 'ADJUSTMENT',
          quantity: -item.quantity,
          previousStock: prevStock,
          newStock: prevStock - item.quantity,
          referenceId: returnRef,
          notes: `Returned to supplier for PO ${purchase.referenceNumber || purchase._id} (${item.quantity} units)`,
          createdById: req.user?._id
        });
        await invTx.save(session ? { session } : undefined);
      }

      // 2b. Create PurchaseReturn Document
      const purchaseReturn = new PurchaseReturn({
        userId: req.user?._id,
        clientUuid: clientUuid || undefined,
        purchaseClientUuid: purchase.clientUuid || undefined,
        businessId: req.user?.businessId,
        purchaseId: purchase._id,
        referenceNumber: returnRef,
        originalReferenceNumber: purchase.referenceNumber || '',
        supplier: purchase.supplier?._id || purchase.supplier,
        returnDate: new Date(),
        amount: requestedAmount,
        refundMode,
        refundAmount: refundCashAmount,
        items: itemsToDeduct.map(({ product, quantity, costPrice, unitCostPrice, totalCost }) => ({
          product, quantity, costPrice, unitCostPrice, totalCost, deductedFromStock: true
        })),
        reason: reason ? String(reason).trim() : 'Return to supplier',
        deductStock: true,
        idempotencyKey: idempotencyKey || undefined,
        createdById: req.user?._id
      });
      await purchaseReturn.save(session ? { session } : undefined);

      // 2c. Update Purchase Record returnedAmount and status
      purchase.returnedAmount = previousReturned + requestedAmount;
      if (purchase.returnedAmount >= purchaseTotal) {
        purchase.status = 'RETURNED';
      } else {
        purchase.status = 'PARTIALLY_RETURNED';
      }
      await purchase.save(session ? { session } : undefined);

      // 2d. If Cash Refund was received from Supplier, record PaymentTransaction
      if (refundCashAmount > 0 && purchase.supplier) {
        const sName = purchase.supplier.name || 'Supplier';
        const pTx = new PaymentTransaction({
          userId: req.user?._id,
          businessId: req.user?.businessId,
          type: 'RECEIVE',
          partyType: 'SUPPLIER',
          partyId: purchase.supplier._id || purchase.supplier,
          partyModel: 'Supplier',
          partyName: sName,
          amount: refundCashAmount,
          paymentMethod: purchase.paymentMethod || 'CASH',
          transactionDate: new Date(),
          referenceNumber: returnRef,
          notes: `Refund from supplier for purchase return ${returnRef} (PO: ${purchase.referenceNumber || purchase._id})`,
          createdById: req.user?._id
        });
        await pTx.save(session ? { session } : undefined);
      }

      return purchaseReturn;
    });

    const updatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock');

    res.status(200).json({
      success: true,
      message: 'Purchase return processed successfully and inventory adjusted.',
      return: resultReturn,
      purchase: updatedPurchase
    });
  } catch (error) {
    if (error.code === 11000 && req.body.clientUuid) {
      const existing = await PurchaseReturn.findOne({
        clientUuid: req.body.clientUuid,
        ...getTenantQuery(req)
      });
      if (existing) {
        const existingPurchase = await Purchase.findById(existing.purchaseId);
        return res.status(200).json({
          success: true,
          message: 'Purchase return already processed (idempotent)',
          return: existing,
          purchase: existingPurchase
        });
      }
    }
    console.error('Error processing purchase return:', error);
    res.status(500).json({ success: false, message: 'Error processing purchase return', error: error.message });
  }
};

// GET /api/purchases/:id/returns — Fetch returns for a specific purchase
exports.getPurchaseReturns = async (req, res) => {
  try {
    const { id } = req.params;
    const returns = await PurchaseReturn.find({
      purchaseId: id,
      ...getTenantQuery(req)
    }).sort({ returnDate: -1 });

    res.status(200).json(returns);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching purchase returns', error: error.message });
  }
};

// DELETE /api/purchases/returns/:returnId — Reverse / Delete a Purchase Return
exports.deletePurchaseReturn = async (req, res) => {
  try {
    const returnId = req.params.returnId || req.params.id;
    const purchaseReturn = await PurchaseReturn.findById(returnId);
    if (!purchaseReturn || !hasTenantAccess(purchaseReturn, req)) {
      return res.status(404).json({ success: false, message: 'Purchase return record not found.' });
    }

    const purchase = await Purchase.findById(purchaseReturn.purchaseId);
    if (!purchase || !hasTenantAccess(purchase, req)) {
      return res.status(404).json({ success: false, message: 'Associated purchase order record not found.' });
    }

    await withOptionalTransaction(async (session) => {
      // 1. Restore deducted inventory stock back to products
      if (Array.isArray(purchaseReturn.items) && purchaseReturn.items.length > 0) {
        for (const item of purchaseReturn.items) {
          if (item.product && Number(item.quantity) > 0) {
            const updateOpts = { new: false };
            if (session) updateOpts.session = session;

            const prevDoc = await Product.findOneAndUpdate(
              { _id: item.product },
              { $inc: { stock: Number(item.quantity) } },
              updateOpts
            );
            const prevStock = prevDoc ? prevDoc.stock : 0;

            const invTx = new InventoryTransaction({
              userId: req.user?._id,
              businessId: req.user?.businessId,
              product: item.product,
              type: 'PURCHASE',
              quantity: Number(item.quantity),
              previousStock: prevStock,
              newStock: prevStock + Number(item.quantity),
              referenceId: purchaseReturn.referenceNumber,
              notes: `Restored stock due to deleted purchase return ${purchaseReturn.referenceNumber}`,
              createdById: req.user?._id
            });
            await invTx.save(session ? { session } : undefined);
          }
        }
      }

      // 2. Remove refund PaymentTransaction if one was generated
      if (purchaseReturn.refundAmount > 0) {
        const deleteQuery = {
          referenceNumber: purchaseReturn.referenceNumber,
          ...getTenantQuery(req)
        };
        if (session) {
          await PaymentTransaction.deleteMany(deleteQuery).session(session);
        } else {
          await PaymentTransaction.deleteMany(deleteQuery);
        }
      }

      // 3. Reverse returnedAmount on Purchase
      const previousReturned = Number(purchase.returnedAmount) || 0;
      const newReturned = Math.max(0, previousReturned - (Number(purchaseReturn.amount) || 0));
      purchase.returnedAmount = newReturned;

      const purchaseTotal = Number(purchase.totalCost || purchase.grandTotal) || 0;
      if (newReturned <= 0) {
        purchase.status = 'COMPLETED';
      } else if (newReturned < purchaseTotal) {
        purchase.status = 'PARTIALLY_RETURNED';
      } else {
        purchase.status = 'RETURNED';
      }
      await purchase.save(session ? { session } : undefined);

      // 4. Delete the PurchaseReturn document
      if (session) {
        await PurchaseReturn.findByIdAndDelete(purchaseReturn._id).session(session);
      } else {
        await PurchaseReturn.findByIdAndDelete(purchaseReturn._id);
      }
    });

    const updatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock');

    res.status(200).json({
      success: true,
      message: 'Purchase return deleted and inventory/balances reversed successfully.',
      purchase: updatedPurchase,
      deletedReturnId: returnId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting purchase return', error: error.message });
  }
};

// PUT /api/purchases/:id — Edit Purchase Order with Inventory Adjustments
exports.updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplier,
      quantity,
      costPrice,
      amountPaid,
      purchaseDate,
      referenceNumber,
      notes
    } = req.body;

    const purchase = await Purchase.findById(id);
    if (!purchase || !hasTenantAccess(purchase, req)) {
      return res.status(404).json({ success: false, message: 'Purchase record not found.', errorCode: 'NOT_FOUND' });
    }

    if (purchase.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot edit a cancelled purchase order.' });
    }

    const targetProduct = await Product.findById(purchase.product);
    if (!targetProduct || !hasTenantAccess(targetProduct, req)) {
      return res.status(404).json({ success: false, message: 'Associated product not found or unauthorized.' });
    }

    // 1. Handle Quantity Delta and Stock Sufficiency Check
    const oldQty = Number(purchase.quantity) || 0;
    const newQty = quantity !== undefined ? Number(quantity) : oldQty;

    if (isNaN(newQty) || newQty <= 0) {
      return res.status(400).json({ success: false, message: 'Purchase quantity must be greater than 0.' });
    }

    const deltaQty = newQty - oldQty;
    if (deltaQty !== 0) {
      if (deltaQty < 0) {
        const neededDeduction = Math.abs(deltaQty);
        if (targetProduct.stock < neededDeduction) {
          return res.status(400).json({
            success: false,
            message: `Cannot reduce purchase quantity by ${neededDeduction} because available stock is only ${targetProduct.stock}. Items may have already been sold or consumed.`,
            errorCode: 'INSUFFICIENT_STOCK_FOR_REDUCTION'
          });
        }
      }

      // Apply inventory delta
      const prevStock = targetProduct.stock;
      targetProduct.stock += deltaQty;
      await targetProduct.save();

      await InventoryTransaction.create({
        userId: req.user?._id,
        businessId: req.user?.businessId,
        product: targetProduct._id,
        type: deltaQty > 0 ? 'PURCHASE' : 'ADJUSTMENT',
        quantity: deltaQty,
        previousStock: prevStock,
        newStock: targetProduct.stock,
        referenceId: purchase.referenceNumber || purchase._id.toString(),
        notes: `Edited purchase order ${purchase.referenceNumber || purchase._id} (Qty: ${oldQty} -> ${newQty})`,
        createdById: req.user?._id
      });

      purchase.quantity = newQty;
      if (Array.isArray(purchase.items) && purchase.items.length === 1) {
        purchase.items[0].quantity = newQty;
        purchase.items[0].totalCost = newQty * (purchase.items[0].costPrice || purchase.costPrice);
      }
    }

    // 2. Handle Price and Total Cost Update
    if (costPrice !== undefined) {
      const newCost = Number(costPrice);
      if (isNaN(newCost) || newCost < 0) {
        return res.status(400).json({ success: false, message: 'Cost price must be 0 or greater.' });
      }
      purchase.costPrice = newCost;
      if (Array.isArray(purchase.items) && purchase.items.length === 1) {
        purchase.items[0].costPrice = newCost;
        purchase.items[0].unitCostPrice = newCost;
        purchase.items[0].totalCost = purchase.quantity * newCost;
      }
    }

    const newTotal = purchase.quantity * purchase.costPrice;
    if (purchase.returnedAmount > 0 && newTotal < purchase.returnedAmount) {
      return res.status(400).json({
        success: false,
        message: `New purchase total (₹${newTotal}) cannot be less than already returned amount (₹${purchase.returnedAmount}).`,
        errorCode: 'CANNOT_REDUCE_BELOW_RETURNED'
      });
    }

    purchase.subtotal = newTotal;
    purchase.totalCost = newTotal;
    purchase.grandTotal = newTotal;

    // 3. Handle Supplier Update
    if (supplier !== undefined) {
      if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
        const supDoc = await Supplier.findById(supplier);
        if (supDoc && hasTenantAccess(supDoc, req)) {
          purchase.supplier = supDoc._id;
        } else {
          return res.status(404).json({ success: false, message: 'Supplier not found or unauthorized.' });
        }
      } else if (!supplier) {
        purchase.supplier = undefined;
      }
    }

    if (amountPaid !== undefined) {
      purchase.amountPaid = Number(amountPaid) || 0;
      purchase.paymentStatus = purchase.amountPaid >= newTotal ? 'PAID' : (purchase.amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    }

    if (purchaseDate) {
      const d = new Date(purchaseDate);
      if (!isNaN(d.getTime())) {
        purchase.purchaseDate = d;
      }
    }

    if (referenceNumber !== undefined) {
      purchase.referenceNumber = String(referenceNumber).trim();
    }

    if (notes !== undefined) {
      purchase.notes = String(notes).trim();
    }

    await purchase.save();

    const populated = await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username');

    res.status(200).json({
      success: true,
      message: 'Purchase updated successfully and stock adjusted.',
      purchase: populated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating purchase', error: error.message });
  }
};

// DELETE /api/purchases/:id — Delete Purchase with Return Guard & Stock Reversal
exports.deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id);
    if (!purchase || !hasTenantAccess(purchase, req)) {
      return res.status(404).json({ success: false, message: 'Purchase record not found.' });
    }

    // 1. Guard against deleting purchases with active returns
    const hasReturns = (purchase.returnedAmount > 0) || (await PurchaseReturn.exists({ purchaseId: id }));
    if (hasReturns) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a purchase with active purchase returns. Please delete or reverse the purchase returns first.',
        errorCode: 'HAS_RETURNS'
      });
    }

    // 2. Identify items to reverse from stock
    let itemsToReverse = [];
    if (Array.isArray(purchase.items) && purchase.items.length > 0) {
      itemsToReverse = purchase.items;
    } else if (purchase.product) {
      itemsToReverse = [{ product: purchase.product, quantity: purchase.quantity }];
    }

    // 3. Verify stock availability: Deleting a purchase reverses the restock.
    // If received items were already sold, stock cannot be deducted below zero.
    for (const item of itemsToReverse) {
      if (item.product && Number(item.quantity) > 0) {
        const prod = await Product.findById(item.product);
        if (prod) {
          const qty = Number(item.quantity);
          if (prod.stock < qty) {
            return res.status(400).json({
              success: false,
              message: `Cannot delete purchase because received items for "${prod.name}" have already been sold or consumed. Current stock is ${prod.stock}, but purchase was for ${qty} units.`,
              errorCode: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
            });
          }
        }
      }
    }

    // 4. Atomically decrement stock and remove records
    await withOptionalTransaction(async (session) => {
      for (const item of itemsToReverse) {
        if (item.product && Number(item.quantity) > 0) {
          const updateOpts = { new: false };
          if (session) updateOpts.session = session;

          const prevDoc = await Product.findOneAndUpdate(
            { _id: item.product },
            { $inc: { stock: -Number(item.quantity) } },
            updateOpts
          );

          if (prevDoc) {
            const invTx = new InventoryTransaction({
              userId: req.user?._id,
              businessId: req.user?.businessId,
              product: item.product,
              type: 'ADJUSTMENT',
              quantity: -Number(item.quantity),
              previousStock: prevDoc.stock,
              newStock: prevDoc.stock - Number(item.quantity),
              referenceId: purchase.referenceNumber || purchase._id.toString(),
              notes: `Reversal of deleted purchase order ${purchase.referenceNumber || purchase._id}`,
              createdById: req.user?._id
            });
            await invTx.save(session ? { session } : undefined);
          }
        }
      }

      // 5. Clean up any PaymentTransaction linked to this purchase reference
      if (purchase.referenceNumber) {
        const delQuery = {
          referenceNumber: purchase.referenceNumber,
          ...getTenantQuery(req)
        };
        if (session) {
          await PaymentTransaction.deleteMany(delQuery).session(session);
        } else {
          await PaymentTransaction.deleteMany(delQuery);
        }
      }

      if (session) {
        await Purchase.findByIdAndDelete(id).session(session);
      } else {
        await Purchase.findByIdAndDelete(id);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Purchase deleted and stock adjusted successfully.',
      id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting purchase', error: error.message });
  }
};
