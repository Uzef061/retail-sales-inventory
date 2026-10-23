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

// POST /api/purchases (Create Purchase Order, Increment Stock, Link Supplier & Payment)
exports.createPurchase = async (req, res) => {
  try {
    const {
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
    if (idempotencyKey) {
      const existingPurchase = await Purchase.findOne({
        idempotencyKey,
        ...getTenantQuery(req)
      })
        .populate('supplier', 'name phone email contactPerson companyName')
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

    // 1. Supplier resolution (Find by ID or find/create by phone/name)
    let targetSupplier;
    let targetSupplierId = supplierId || supplier;
    if (typeof targetSupplierId === 'object' && targetSupplierId !== null) {
      targetSupplierId = targetSupplierId._id || targetSupplierId.id;
    }

    if (targetSupplierId && mongoose.Types.ObjectId.isValid(targetSupplierId)) {
      targetSupplier = await Supplier.findById(targetSupplierId);
    }

    if (!targetSupplier && supplierPhone && String(supplierPhone).trim()) {
      targetSupplier = await Supplier.findOne({
        ...getTenantQuery(req),
        phone: String(supplierPhone).trim()
      });
    }

    if (!targetSupplier) {
      const sPhone = (supplierPhone || (typeof supplier === 'string' && !mongoose.Types.ObjectId.isValid(supplier) ? supplier : '')).trim();
      const sName = (supplierName || (typeof supplier === 'string' && !mongoose.Types.ObjectId.isValid(supplier) ? 'Supplier' : '')).trim();

      if (sName || sPhone) {
        targetSupplier = await Supplier.create({
          userId: req.user?._id,
          name: sName || (sPhone ? `Supplier (${sPhone})` : 'General Supplier'),
          phone: sPhone || 'N/A',
          email: supplierEmail ? supplierEmail.trim() : '',
          address: supplierAddress ? supplierAddress.trim() : '',
          isActive: true
        });
      }
    }

    if (targetSupplier && targetSupplier.isActive === false) {
      targetSupplier.isActive = true;
      await targetSupplier.save();
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

        let prodDoc = null;
        if (mongoose.Types.ObjectId.isValid(prodId)) {
          prodDoc = await Product.findById(prodId);
        }
        if (!prodDoc) {
          prodDoc = await Product.findOne({
            $or: [{ sku: prodId }, { name: prodId }],
            ...getTenantQuery(req)
          });
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
      }
      if (!targetProduct) {
        targetProduct = await Product.findOne({
          $or: [{ sku: targetProductId }, { name: targetProductId }],
          ...getTenantQuery(req)
        });
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

    const refNum = referenceNumber && referenceNumber.trim() ? referenceNumber.trim() : `PO-${Date.now().toString().slice(-8)}`;

    // 4. Atomically Increment Inventory Stock & Record Movement Ledger
    for (const item of normalizedItems) {
      const prevDoc = await Product.findOneAndUpdate(
        { _id: item.product, ...getTenantQuery(req) },
        {
          $inc: { stock: item.quantity },
          ...(updateProductCost ? { costPrice: item.costPrice } : {})
        },
        { new: false }
      );

      const prevStock = prevDoc ? prevDoc.stock : 0;
      await InventoryTransaction.create({
        userId: req.user?._id,
        product: item.product,
        type: 'PURCHASE',
        quantity: item.quantity,
        previousStock: prevStock,
        newStock: prevStock + item.quantity,
        referenceId: refNum,
        notes: `Restock purchase order ${refNum} (${item.quantity} units @ ₹${item.costPrice})`,
        createdById: req.user?._id
      });
    }

    // 5. Payment Handling (Scenarios: Credit / Full Paid / Partial Paid)
    const paidAmount = Number(amountPaid) || 0;
    const effectivePaymentMethod = normalizePaymentMethod(paymentMethod);
    let paymentStatus = 'UNPAID';

    if (paidAmount >= grandTotalCalc) {
      paymentStatus = 'PAID';
    } else if (paidAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    // If actual payment occurred at purchase time, record PaymentTransaction
    if (paidAmount > 0 && targetSupplier) {
      await PaymentTransaction.create({
        userId: req.user?._id,
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
    }

    // 6. Create Purchase Record
    const firstItem = normalizedItems[0];
    const purchase = new Purchase({
      userId: req.user?._id,
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

    const savedPurchase = await purchase.save();

    const populatedPurchase = await Purchase.findById(savedPurchase._id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username');

    res.status(201).json(populatedPurchase);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, message: 'Error creating purchase order', error: error.message });
  }
};

// POST /api/purchases/:id/return — Purchase Return to Supplier (Reduces Inventory & Corrects Payable)
exports.returnPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      returnAmount,
      returnedItems,
      reason,
      refundMode = 'REDUCE_PAYABLE',
      idempotencyKey
    } = req.body;

    // 0. Idempotency check
    if (idempotencyKey) {
      const existingReturn = await PurchaseReturn.findOne({
        idempotencyKey,
        ...getTenantQuery(req)
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

    const purchase = await Purchase.findById(id).populate('supplier');
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
    } else {
      // Default: full return of all purchase items
      let sourceItems = [];
      if (Array.isArray(purchase.items) && purchase.items.length > 0) {
        sourceItems = purchase.items;
      } else if (purchase.product) {
        sourceItems = [{ product: purchase.product, quantity: purchase.quantity, costPrice: purchase.costPrice }];
      }

      for (const item of sourceItems) {
        const prod = await Product.findById(item.product);
        if (prod && hasTenantAccess(prod, req)) {
          const qty = Number(item.quantity);
          if (prod.stock < qty) {
            return res.status(400).json({
              success: false,
              message: `Cannot return items: Current stock for "${prod.name}" (${prod.stock}) is less than returned quantity (${qty}). Items may have already been sold.`,
              errorCode: 'INSUFFICIENT_STOCK_FOR_RETURN'
            });
          }
          const cost = Number(item.costPrice || 0);
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
    }

    const requestedAmount = returnAmount !== undefined ? Number(returnAmount) : (calculatedReturnAmount > 0 ? calculatedReturnAmount : maxReturnable);

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Return amount must be greater than 0.' });
    }

    if (requestedAmount > maxReturnable) {
      return res.status(400).json({
        success: false,
        message: `Return amount (₹${requestedAmount}) cannot exceed remaining returnable amount (₹${maxReturnable}).`,
        errorCode: 'EXCEEDS_RETURNABLE'
      });
    }

    const returnRef = `PR-${Date.now().toString().slice(-8)}`;

    // 2. Deduct Returned Goods from Inventory Stock
    for (const item of itemsToDeduct) {
      const prevDoc = await Product.findOneAndUpdate(
        { _id: item.product, ...getTenantQuery(req) },
        { $inc: { stock: -item.quantity } },
        { new: false }
      );
      const prevStock = prevDoc ? prevDoc.stock : item.productDoc.stock;

      await InventoryTransaction.create({
        userId: req.user?._id,
        product: item.product,
        type: 'ADJUSTMENT',
        quantity: -item.quantity,
        previousStock: prevStock,
        newStock: prevStock - item.quantity,
        referenceId: returnRef,
        notes: `Returned to supplier for PO ${purchase.referenceNumber || purchase._id} (${item.quantity} units)`,
        createdById: req.user?._id
      });
    }

    // 3. Create PurchaseReturn Document
    const refundCashAmount = refundMode === 'REFUND_RECEIVED' ? requestedAmount : 0;

    const purchaseReturn = new PurchaseReturn({
      userId: req.user?._id,
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

    await purchaseReturn.save();

    // 4. Update Purchase Record returnedAmount and status
    purchase.returnedAmount = previousReturned + requestedAmount;
    if (purchase.returnedAmount >= purchaseTotal) {
      purchase.status = 'RETURNED';
    } else {
      purchase.status = 'PARTIALLY_RETURNED';
    }
    await purchase.save();

    // 5. If Cash Refund was received from Supplier, record PaymentTransaction
    if (refundCashAmount > 0 && purchase.supplier) {
      const sName = purchase.supplier.name || 'Supplier';
      await PaymentTransaction.create({
        userId: req.user?._id,
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
    }

    const updatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone email contactPerson companyName address')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('items.product', 'name category costPrice sellingPrice stock');

    res.status(200).json({
      success: true,
      message: 'Purchase return processed successfully and inventory adjusted.',
      return: purchaseReturn,
      purchase: updatedPurchase
    });
  } catch (error) {
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

    // 1. Restore deducted inventory stock back to products
    if (Array.isArray(purchaseReturn.items) && purchaseReturn.items.length > 0) {
      for (const item of purchaseReturn.items) {
        if (item.product && Number(item.quantity) > 0) {
          const prevDoc = await Product.findOneAndUpdate(
            { _id: item.product, ...getTenantQuery(req) },
            { $inc: { stock: Number(item.quantity) } },
            { new: false }
          );
          const prevStock = prevDoc ? prevDoc.stock : 0;

          await InventoryTransaction.create({
            userId: req.user?._id,
            product: item.product,
            type: 'PURCHASE',
            quantity: Number(item.quantity),
            previousStock: prevStock,
            newStock: prevStock + Number(item.quantity),
            referenceId: purchaseReturn.referenceNumber,
            notes: `Restored stock due to deleted purchase return ${purchaseReturn.referenceNumber}`,
            createdById: req.user?._id
          });
        }
      }
    }

    // 2. Remove refund PaymentTransaction if one was generated
    if (purchaseReturn.refundAmount > 0) {
      await PaymentTransaction.deleteMany({
        referenceNumber: purchaseReturn.referenceNumber,
        ...getTenantQuery(req)
      });
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
    await purchase.save();

    // 4. Delete the PurchaseReturn document
    await PurchaseReturn.findByIdAndDelete(purchaseReturn._id);

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
        // Reducing purchase quantity -> need to deduct stock
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

    // 4. Atomically decrement stock and record inventory audit transaction
    for (const item of itemsToReverse) {
      if (item.product && Number(item.quantity) > 0) {
        const prevDoc = await Product.findOneAndUpdate(
          { _id: item.product, ...getTenantQuery(req) },
          { $inc: { stock: -Number(item.quantity) } },
          { new: false }
        );

        if (prevDoc) {
          await InventoryTransaction.create({
            userId: req.user?._id,
            product: item.product,
            type: 'ADJUSTMENT',
            quantity: -Number(item.quantity),
            previousStock: prevDoc.stock,
            newStock: prevDoc.stock - Number(item.quantity),
            referenceId: purchase.referenceNumber || purchase._id.toString(),
            notes: `Reversal of deleted purchase order ${purchase.referenceNumber || purchase._id}`,
            createdById: req.user?._id
          });
        }
      }
    }

    // 5. Clean up any PaymentTransaction linked to this purchase reference
    if (purchase.referenceNumber) {
      await PaymentTransaction.deleteMany({
        referenceNumber: purchase.referenceNumber,
        ...getTenantQuery(req)
      });
    }

    await Purchase.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: 'Purchase deleted and stock adjusted successfully.',
      id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting purchase', error: error.message });
  }
};
