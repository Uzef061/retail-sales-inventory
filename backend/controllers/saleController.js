const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const InventoryTransaction = require('../models/InventoryTransaction');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');
const mongoose = require('mongoose');

const normalizePaymentMethod = (pm) => {
  if (!pm) return 'CASH';
  const upper = String(pm).toUpperCase().trim();
  if (['CASH', 'CARD', 'UPI', 'OTHER'].includes(upper)) return upper;
  if (upper === 'CREDIT') return 'OTHER';
  return 'CASH';
};

// GET /api/sales
exports.getSales = async (req, res) => {
  try {
    const query = getTenantQuery(req);
    if (req.query.fulfillmentStatus) {
      query.fulfillmentStatus = req.query.fulfillmentStatus;
    }
    if (req.query.reconciliationRequired !== undefined) {
      query.reconciliationRequired = req.query.reconciliationRequired === 'true';
    }
    const sales = await Sale.find(query)
      .populate('customer', 'name email phone')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock')
      .populate('cancelledBy', 'name username')
      .populate('reconciledBy', 'name username')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sales', error: error.message });
  }
};

// GET /api/sales/:id
exports.getSaleById = async (req, res) => {
  try {
    let sale = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      sale = await Sale.findById(req.params.id)
        .populate('customer', 'name email phone address')
        .populate('product', 'name price sellingPrice costPrice category stock')
        .populate('items.product', 'name price sellingPrice costPrice category stock')
        .populate('cancelledBy', 'name username')
        .populate('reconciledBy', 'name username');
    }
    if (!sale) {
      sale = await Sale.findOne({
        ...getTenantQuery(req),
        $or: [{ clientUuid: req.params.id }, { invoiceNumber: req.params.id }]
      })
        .populate('customer', 'name email phone address')
        .populate('product', 'name price sellingPrice costPrice category stock')
        .populate('items.product', 'name price sellingPrice costPrice category stock')
        .populate('cancelledBy', 'name username')
        .populate('reconciledBy', 'name username');
    }
    if (!sale || !hasTenantAccess(sale, req)) {
      return res.status(404).json({ success: false, message: 'Sale transaction not found.' });
    }
    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sale details', error: error.message });
  }
};

// POST /api/sales (Supports simplified fast sales, POS multi-item & legacy single-item billing)
exports.createSale = async (req, res) => {
  try {
    const {
      clientUuid,
      customer,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      amount,
      product,
      quantity,
      price,
      sellingPrice,
      costPrice,
      saleDate,
      items,
      discount = 0,
      tax = 0,
      paymentMethod = 'CASH',
      amountReceived,
      notes,
      idempotencyKey,
      isOfflineSync = false,
      invoiceNumber: clientInvoiceNumber,
      paymentClientUuid
    } = req.body;

    // 0. Server-side authorization check for offline synchronization
    let effectiveOfflineSync = false;
    if (isOfflineSync === true || req.headers['x-offline-sync'] === 'true') {
      if (!clientUuid || typeof clientUuid !== 'string' || clientUuid.trim().length < 8) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_OFFLINE_SYNC_FLAG',
          message: 'Offline sync cannot be activated without a valid clientUuid.'
        });
      }
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(clientUuid.trim())) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_CLIENT_UUID_FORMAT',
          message: 'clientUuid must be a valid UUID or authorized client identifier.'
        });
      }
      if (!req.user || req.user.isActive === false) {
        return res.status(403).json({
          success: false,
          errorCode: 'USER_INACTIVE',
          message: 'User account is inactive. Offline synchronization rejected.'
        });
      }
      effectiveOfflineSync = true;
    }

    // 0.1 Idempotency check by clientUuid or idempotencyKey to prevent duplicate submission
    if (clientUuid || idempotencyKey) {
      const orConditions = [];
      if (clientUuid) orConditions.push({ clientUuid });
      if (idempotencyKey) orConditions.push({ idempotencyKey });
      const existing = await Sale.findOne({
        ...getTenantQuery(req),
        $or: orConditions
      })
        .populate('customer', 'name email phone address')
        .populate('product', 'name price sellingPrice costPrice category stock')
        .populate('items.product', 'name price sellingPrice costPrice category stock')
        .populate('reconciledBy', 'name username');
      if (existing) {
        // Crash Recovery & Consistency: Verify linked payment exists if payment was received
        const grandTotal = Number(existing.grandTotal || existing.totalAmount) || 0;
        const amtReceived = Number(existing.amountReceived !== undefined ? existing.amountReceived : grandTotal);
        const effectiveReceived = Math.min(amtReceived, grandTotal);
        if (effectiveReceived > 0 && existing.customer) {
          const paymentIdemKey = existing.clientUuid ? `pay_sale_${existing.clientUuid}` : `pay_sale_${existing._id}`;
          const existingPayment = await PaymentTransaction.findOne({
            ...getTenantQuery(req),
            idempotencyKey: paymentIdemKey
          });
          if (!existingPayment) {
            await PaymentTransaction.create({
              userId: req.user?._id,
              clientUuid: paymentClientUuid || undefined,
              businessId: req.user?.businessId,
              type: 'RECEIVE',
              partyType: 'CUSTOMER',
              partyId: existing.customer._id || existing.customer,
              partyModel: 'Customer',
              partyName: existing.customer.name || 'Customer',
              amount: effectiveReceived,
              paymentMethod: existing.paymentMethod || 'CASH',
              transactionDate: existing.saleDate,
              referenceNumber: existing.invoiceNumber,
              notes: `Payment for sale ${existing.invoiceNumber} (recovered)`,
              idempotencyKey: paymentIdemKey,
              createdById: req.user?._id
            });
          }
        }
        return res.status(200).json(existing);
      }
    }

    // 1. Customer resolution (Find by ID or clientUuid or find/create by phone)
    let targetCustomer;
    if (customer) {
      if (mongoose.Types.ObjectId.isValid(customer)) {
        targetCustomer = await Customer.findById(customer);
      }
      if (!targetCustomer) {
        targetCustomer = await Customer.findOne({
          ...getTenantQuery(req),
          clientUuid: customer
        });
      }
      if (targetCustomer && !hasTenantAccess(targetCustomer, req)) {
        return res.status(403).json({
          success: false,
          message: 'Customer belongs to another store or business.',
          errorCode: 'FORBIDDEN_CUSTOMER'
        });
      }
    }

    if (!targetCustomer && customerPhone && String(customerPhone).trim()) {
      targetCustomer = await Customer.findOne({
        ...getTenantQuery(req),
        phone: String(customerPhone).trim()
      });
    }

    if (!targetCustomer) {
      const cPhone = (customerPhone || (typeof customer === 'string' && !mongoose.Types.ObjectId.isValid(customer) ? customer : '')).trim();
      const cName = (customerName || (typeof customer === 'string' && !mongoose.Types.ObjectId.isValid(customer) ? 'Customer' : '')).trim();

      if (!cName && !cPhone) {
        return res.status(400).json({ success: false, message: 'Customer name or phone is required.', errorCode: 'MISSING_CUSTOMER' });
      }

      targetCustomer = await Customer.create({
        userId: req.user?._id,
        businessId: req.user?.businessId,
        name: cName || (cPhone ? `Customer (${cPhone})` : 'Walk-in Customer'),
        phone: cPhone || 'N/A',
        email: customerEmail ? customerEmail.trim() : '',
        address: customerAddress ? customerAddress.trim() : '',
        isActive: true
      });
    }

    if (targetCustomer.isActive === false) {
      targetCustomer.isActive = true;
      await targetCustomer.save();
    }

    // Validate saleDate if provided
    let parsedSaleDate = new Date();
    if (saleDate) {
      let dateToParse = saleDate;
      if (typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
        dateToParse = `${saleDate}T12:00:00`;
      }
      const d = new Date(dateToParse);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Sale Date must be a valid date.', errorCode: 'INVALID_DATE' });
      }
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (d > endOfToday) {
        return res.status(400).json({ success: false, message: 'Future sale dates are not allowed.', errorCode: 'FUTURE_DATE' });
      }
      parsedSaleDate = d;
    }

    const effectiveInvoiceNumber = (clientInvoiceNumber && String(clientInvoiceNumber).trim())
      ? String(clientInvoiceNumber).trim()
      : `INV-${Date.now().toString().slice(-8)}`;

    const hasItems = Array.isArray(items) && items.length > 0;
    const hasProduct = Boolean(product);
    const saleAmount = Number(amount !== undefined ? amount : (req.body.grandTotal || req.body.totalAmount));

    // Simplified amount-only sales entry (No catalog product/cart required)
    if (!hasItems && !hasProduct) {
      if (isNaN(saleAmount) || saleAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Sale amount must be greater than 0.',
          errorCode: 'INVALID_AMOUNT'
        });
      }

      const invoiceNumber = effectiveInvoiceNumber;
      const discountVal = Number(discount) || 0;
      const taxVal = Number(tax) || 0;
      const grandTotalCalc = Math.max(0, saleAmount - discountVal + taxVal);
      const amtReceived = amountReceived !== undefined ? Number(amountReceived) : grandTotalCalc;
      const changeDueCalc = Math.max(0, amtReceived - grandTotalCalc);

      const newSale = new Sale({
        userId: req.user?._id,
        clientUuid: clientUuid || undefined,
        invoiceNumber,
        customer: targetCustomer._id,
        items: [],
        quantity: 1,
        sellingPrice: saleAmount,
        costPrice: 0,
        totalAmount: saleAmount,
        totalCostAmount: 0,
        profit: saleAmount,
        subtotal: saleAmount,
        discount: discountVal,
        tax: taxVal,
        grandTotal: grandTotalCalc,
        paymentMethod: normalizePaymentMethod(paymentMethod),
        amountReceived: amtReceived,
        changeDue: changeDueCalc,
        status: 'COMPLETED',
        fulfillmentStatus: 'FULFILLED',
        reconciliationRequired: false,
        saleDate: parsedSaleDate,
        notes: notes ? String(notes).trim() : '',
        idempotencyKey: idempotencyKey || undefined
      });

      const savedSale = await newSale.save();

      // Record linked PaymentTransaction for payments received at sale time
      const effectiveReceived = Math.min(amtReceived, grandTotalCalc);
      if (effectiveReceived > 0 && targetCustomer) {
        const paymentIdemKey = clientUuid ? `pay_sale_${clientUuid}` : `pay_sale_${savedSale._id}`;
        const pTx = new PaymentTransaction({
          userId: req.user?._id,
          clientUuid: paymentClientUuid || undefined,
          businessId: req.user?.businessId,
          type: 'RECEIVE',
          partyType: 'CUSTOMER',
          partyId: targetCustomer._id,
          partyModel: 'Customer',
          partyName: targetCustomer.name,
          amount: effectiveReceived,
          paymentMethod: normalizePaymentMethod(paymentMethod),
          transactionDate: parsedSaleDate,
          referenceNumber: invoiceNumber,
          notes: `Payment for sale ${invoiceNumber}`,
          idempotencyKey: paymentIdemKey,
          createdById: req.user?._id
        });
        await pTx.save();
      }

      const populatedSale = await Sale.findById(savedSale._id)
        .populate('customer', 'name email phone address')
        .populate('reconciledBy', 'name username');

      return res.status(201).json(populatedSale);
    }

    let normalizedItems = [];

    // Handle POS multi-item array payload
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.product || !item.quantity || Number(item.quantity) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product and positive quantity required for each item.', errorCode: 'INVALID_ITEM' });
        }
        let prod = null;
        if (mongoose.Types.ObjectId.isValid(item.product)) {
          prod = await Product.findById(item.product);
        }
        if (!prod) {
          prod = await Product.findOne({
            ...getTenantQuery(req),
            clientUuid: item.product
          });
        }
        if (!prod || prod.isActive === false || !hasTenantAccess(prod, req)) {
          return res.status(404).json({ success: false, message: 'One or more products are inactive, not found or unauthorized.', errorCode: 'PRODUCT_NOT_FOUND' });
        }
        const qty = Number(item.quantity);
        // Only reject online sales if stock is insufficient; offline sync sales accept with deficit
        if (!effectiveOfflineSync && prod.stock < qty) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${prod.name}". Available stock: ${prod.stock}, requested: ${qty}`,
            errorCode: 'INSUFFICIENT_STOCK'
          });
        }
        const itemSellingPrice = item.sellingPrice !== undefined ? Number(item.sellingPrice) : (prod.sellingPrice || prod.price);
        const itemCostPrice = item.costPrice !== undefined ? Number(item.costPrice) : (prod.costPrice || Math.round(itemSellingPrice * 0.7));
        const itemTotalAmount = itemSellingPrice * qty;
        const itemTotalCost = itemCostPrice * qty;
        const itemProfit = itemTotalAmount - itemTotalCost;

        normalizedItems.push({
          productDoc: prod,
          product: prod._id,
          quantity: qty,
          sellingPrice: itemSellingPrice,
          costPrice: itemCostPrice,
          totalAmount: itemTotalAmount,
          totalCostAmount: itemTotalCost,
          profit: itemProfit
        });
      }
    } else {
      // Legacy / Single-item sale
      if (!product || !quantity) {
        return res.status(400).json({ success: false, message: 'Product and quantity are required.', errorCode: 'MISSING_FIELDS' });
      }
      const qty = Number(quantity);
      if (qty <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be greater than 0.', errorCode: 'INVALID_QUANTITY' });
      }
      let prod = null;
      if (mongoose.Types.ObjectId.isValid(product)) {
        prod = await Product.findById(product);
      }
      if (!prod) {
        prod = await Product.findOne({
          ...getTenantQuery(req),
          clientUuid: product
        });
      }
      if (!prod || prod.isActive === false || !hasTenantAccess(prod, req)) {
        return res.status(404).json({ success: false, message: 'Target product not found, inactive or unauthorized.', errorCode: 'PRODUCT_NOT_FOUND' });
      }
      // Only reject online sales if stock is insufficient
      if (!effectiveOfflineSync && prod.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${prod.name}". Available stock: ${prod.stock}`,
          errorCode: 'INSUFFICIENT_STOCK'
        });
      }
      const unitSellingPrice = sellingPrice !== undefined
        ? Number(sellingPrice)
        : (price !== undefined ? Number(price) : (prod.sellingPrice || prod.price));
      const unitCostPrice = costPrice !== undefined
        ? Number(costPrice)
        : (prod.costPrice || Math.round(unitSellingPrice * 0.7));
      const itemTotalAmount = unitSellingPrice * qty;
      const itemTotalCost = unitCostPrice * qty;
      const itemProfit = itemTotalAmount - itemTotalCost;

      normalizedItems.push({
        productDoc: prod,
        product: prod._id,
        quantity: qty,
        sellingPrice: unitSellingPrice,
        costPrice: unitCostPrice,
        totalAmount: itemTotalAmount,
        totalCostAmount: itemTotalCost,
        profit: itemProfit
      });
    }

    // Process Stock Deductions & Inventory Transactions
    const invoiceNumber = effectiveInvoiceNumber;
    let subtotalCalc = 0;
    let totalCostCalc = 0;
    let totalProfitCalc = 0;
    let hasStockDeficit = false;
    const successfullyDeducted = [];

    try {
      for (const item of normalizedItems) {
        if (!effectiveOfflineSync) {
          // Atomic conditional deduction preventing negative stock & race conditions across concurrent devices
          const prevDoc = await Product.findOneAndUpdate(
            {
              _id: item.product,
              ...getTenantQuery(req),
              stock: { $gte: item.quantity }
            },
            {
              $inc: { stock: -item.quantity }
            },
            {
              new: false
            }
          );

          if (!prevDoc) {
            // Stock conflict detected! Could be due to concurrent sale on another device or insufficient stock
            const currentProd = await Product.findById(item.product);
            const currentAvail = currentProd ? currentProd.stock : 0;
            const prodName = currentProd ? currentProd.name : 'Selected product';

            // Roll back any previously deducted items in this transaction
            for (const deducted of successfullyDeducted) {
              await Product.updateOne(
                { _id: deducted.productId },
                { $inc: { stock: deducted.quantity } }
              );
            }

            return res.status(409).json({
              success: false,
              conflict: true,
              errorCode: 'INSUFFICIENT_STOCK_CONFLICT',
              message: `Stock conflict: "${prodName}" only has ${currentAvail} unit(s) available, requested ${item.quantity}.`,
              availableStock: currentAvail,
              requestedQuantity: item.quantity,
              productId: item.product
            });
          }

          const prevStock = prevDoc.stock;
          const newStock = prevStock - item.quantity;
          successfullyDeducted.push({
            productId: item.product,
            quantity: item.quantity,
            previousStock: prevStock,
            newStock: newStock
          });

          // Record Inventory Audit Movement Entry
          await InventoryTransaction.create({
            userId: req.user?._id,
            product: item.product,
            type: 'SALE',
            quantity: -item.quantity,
            previousStock: prevStock,
            newStock: newStock,
            referenceId: invoiceNumber,
            notes: `Itemized sale ${invoiceNumber}`,
            createdById: req.user?._id
          });

          item.fulfillmentStatus = 'FULFILLED';
          item.fulfilledQuantity = item.quantity;
          item.deficitQuantity = 0;
        } else {
          // Offline sync stock deduction and deficit tracking
          const prodDoc = await Product.findById(item.product);
          const currentAvail = prodDoc ? Math.max(0, prodDoc.stock) : 0;
          const prevStock = prodDoc ? prodDoc.stock : 0;

          if (currentAvail >= item.quantity) {
            // Sufficient stock available -> deduct fully
            const updatedDoc = await Product.findOneAndUpdate(
              {
                _id: item.product,
                ...getTenantQuery(req),
                stock: { $gte: item.quantity }
              },
              {
                $inc: { stock: -item.quantity }
              },
              {
                new: false
              }
            );

            const actualPrev = updatedDoc ? updatedDoc.stock : prevStock;
            const actualNew = actualPrev - item.quantity;

            successfullyDeducted.push({
              productId: item.product,
              quantity: item.quantity,
              previousStock: actualPrev,
              newStock: actualNew
            });

            await InventoryTransaction.create({
              userId: req.user?._id,
              product: item.product,
              type: 'SALE',
              quantity: -item.quantity,
              previousStock: actualPrev,
              newStock: actualNew,
              referenceId: invoiceNumber,
              notes: `Offline sync sale ${invoiceNumber}`,
              createdById: req.user?._id
            });

            item.fulfillmentStatus = 'FULFILLED';
            item.fulfilledQuantity = item.quantity;
            item.deficitQuantity = 0;
          } else {
            // Deficit! Available stock is less than requested quantity
            hasStockDeficit = true;
            const toDeduct = currentAvail;
            const deficitQty = item.quantity - toDeduct;

            if (toDeduct > 0) {
              await Product.updateOne(
                { _id: item.product, ...getTenantQuery(req) },
                { $inc: { stock: -toDeduct } }
              );

              successfullyDeducted.push({
                productId: item.product,
                quantity: toDeduct,
                previousStock: prevStock,
                newStock: prevStock - toDeduct
              });

              await InventoryTransaction.create({
                userId: req.user?._id,
                product: item.product,
                type: 'SALE',
                quantity: -toDeduct,
                previousStock: prevStock,
                newStock: prevStock - toDeduct,
                referenceId: invoiceNumber,
                notes: `Offline sync partial fulfillment (${toDeduct}/${item.quantity}) for sale ${invoiceNumber}`,
                createdById: req.user?._id
              });
            }

            // Record audit movement for the stock deficit
            await InventoryTransaction.create({
              userId: req.user?._id,
              product: item.product,
              type: 'STOCK_DEFICIT',
              quantity: 0,
              deficitQuantity: deficitQty,
              previousStock: Math.max(0, prevStock - toDeduct),
              newStock: Math.max(0, prevStock - toDeduct),
              referenceId: invoiceNumber,
              notes: `Stock deficit of ${deficitQty} unit(s) during offline sync ${invoiceNumber}`,
              createdById: req.user?._id
            });

            item.fulfillmentStatus = 'STOCK_DEFICIT';
            item.fulfilledQuantity = toDeduct;
            item.deficitQuantity = deficitQty;
          }
        }

        subtotalCalc += item.totalAmount;
        totalCostCalc += item.totalCostAmount;
        totalProfitCalc += item.profit;
      }
    } catch (deductErr) {
      for (const deducted of successfullyDeducted) {
        await Product.updateOne(
          { _id: deducted.productId },
          { $inc: { stock: deducted.quantity } }
        );
      }
      throw deductErr;
    }

    const discountVal = Number(discount) || 0;
    const taxVal = Number(tax) || 0;
    const grandTotalCalc = Math.max(0, subtotalCalc - discountVal + taxVal);
    const amtReceived = amountReceived !== undefined ? Number(amountReceived) : grandTotalCalc;
    const changeDueCalc = Math.max(0, amtReceived - grandTotalCalc);

    // Primary item for legacy single-item backward compatibility
    const firstItem = normalizedItems[0];
    const overallFulfillmentStatus = hasStockDeficit ? 'STOCK_DEFICIT' : 'FULFILLED';
    const isReconciliationRequired = Boolean(hasStockDeficit);

    const newSale = new Sale({
      userId: req.user?._id,
      clientUuid: clientUuid || undefined,
      invoiceNumber,
      customer: targetCustomer._id,
      product: firstItem.product,
      items: normalizedItems.map(({ product, quantity, sellingPrice, costPrice, totalAmount, totalCostAmount, profit, fulfillmentStatus, fulfilledQuantity, deficitQuantity }) => ({
        product,
        quantity,
        sellingPrice,
        costPrice,
        totalAmount,
        totalCostAmount,
        profit,
        fulfillmentStatus: fulfillmentStatus || 'FULFILLED',
        fulfilledQuantity: fulfilledQuantity !== undefined ? fulfilledQuantity : quantity,
        deficitQuantity: deficitQuantity || 0
      })),
      quantity: normalizedItems.reduce((sum, i) => sum + i.quantity, 0),
      sellingPrice: firstItem.sellingPrice,
      costPrice: firstItem.costPrice,
      totalAmount: subtotalCalc,
      totalCostAmount: totalCostCalc,
      profit: totalProfitCalc,
      subtotal: subtotalCalc,
      discount: discountVal,
      tax: taxVal,
      grandTotal: grandTotalCalc,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      amountReceived: amtReceived,
      changeDue: changeDueCalc,
      status: 'COMPLETED',
      fulfillmentStatus: overallFulfillmentStatus,
      reconciliationRequired: isReconciliationRequired,
      saleDate: parsedSaleDate,
      notes: notes ? String(notes).trim() : '',
      idempotencyKey: idempotencyKey || undefined
    });

    const savedSale = await newSale.save();

    // Record linked PaymentTransaction for payments received at sale time
    const effectiveReceived = Math.min(amtReceived, grandTotalCalc);
    if (effectiveReceived > 0 && targetCustomer) {
      const paymentIdemKey = clientUuid ? `pay_sale_${clientUuid}` : `pay_sale_${savedSale._id}`;
      const pTx = new PaymentTransaction({
        userId: req.user?._id,
        clientUuid: paymentClientUuid || undefined,
        businessId: req.user?.businessId,
        type: 'RECEIVE',
        partyType: 'CUSTOMER',
        partyId: targetCustomer._id,
        partyModel: 'Customer',
        partyName: targetCustomer.name,
        amount: effectiveReceived,
        paymentMethod: normalizePaymentMethod(paymentMethod),
        transactionDate: parsedSaleDate,
        referenceNumber: invoiceNumber,
        notes: `Payment for sale ${invoiceNumber}`,
        idempotencyKey: paymentIdemKey,
        createdById: req.user?._id
      });
      await pTx.save();
    }

    const populatedSale = await Sale.findById(savedSale._id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock')
      .populate('reconciledBy', 'name username');

    res.status(201).json(populatedSale);
  } catch (error) {
    // Crash Recovery: Roll back any stock deductions and intermediate audit movements if saving failed
    if (successfullyDeducted && successfullyDeducted.length > 0) {
      for (const deducted of successfullyDeducted) {
        await Product.updateOne(
          { _id: deducted.productId },
          { $inc: { stock: deducted.quantity } }
        ).catch(() => {});
      }
      if (invoiceNumber) {
        await InventoryTransaction.deleteMany({ referenceId: invoiceNumber }).catch(() => {});
      }
    }

    if (error.code === 11000) {
      if (req.body.clientUuid) {
        const existing = await Sale.findOne({
          clientUuid: req.body.clientUuid,
          ...getTenantQuery(req)
        })
          .populate('customer', 'name email phone address')
          .populate('product', 'name price sellingPrice costPrice category stock')
          .populate('items.product', 'name price sellingPrice costPrice category stock')
          .populate('reconciledBy', 'name username');
        if (existing) {
          return res.status(200).json(existing);
        }
      }
      if (req.body.idempotencyKey) {
        const existing = await Sale.findOne({
          idempotencyKey: req.body.idempotencyKey,
          ...getTenantQuery(req)
        })
          .populate('customer', 'name email phone address')
          .populate('product', 'name price sellingPrice costPrice category stock')
          .populate('items.product', 'name price sellingPrice costPrice category stock')
          .populate('reconciledBy', 'name username');
        if (existing) {
          return res.status(200).json(existing);
        }
      }
    }
    res.status(500).json({ success: false, message: 'Error creating sale transaction', error: error.message });
  }
};

// PUT /api/sales/:id/cancel — Sale Cancellation & Inventory Restoration Workflow
exports.cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    let sale = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      sale = await Sale.findById(id);
    }
    if (!sale) {
      sale = await Sale.findOne({
        ...getTenantQuery(req),
        $or: [{ clientUuid: id }, { invoiceNumber: id }]
      });
    }

    if (!sale || !hasTenantAccess(sale, req)) {
      return res.status(404).json({ success: false, message: 'Sale record not found.', errorCode: 'NOT_FOUND' });
    }

    if (sale.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'This sale has already been cancelled. Cannot cancel twice.',
        errorCode: 'ALREADY_CANCELLED'
      });
    }

    if (sale.returnedAmount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a sale with active sales returns. Please delete or reverse the sales returns first.',
        errorCode: 'HAS_RETURNS'
      });
    }

    // Determine items to restore
    let itemsToRestore = [];
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      itemsToRestore = sale.items;
    } else if (sale.product) {
      itemsToRestore = [{ product: sale.product, quantity: sale.quantity, fulfilledQuantity: sale.quantity }];
    }

    // Restore Inventory Stock & Record Inventory Transactions
    for (const item of itemsToRestore) {
      const prod = await Product.findById(item.product);
      if (prod && hasTenantAccess(prod, req)) {
        // Only restore what was actually fulfilled and deducted!
        const qtyToRestore = item.fulfilledQuantity !== undefined
          ? Number(item.fulfilledQuantity)
          : Number(item.quantity);

        if (qtyToRestore > 0) {
          const prevStock = prod.stock;
          prod.stock += qtyToRestore;
          await prod.save();

          await InventoryTransaction.create({
            userId: req.user?._id,
            product: prod._id,
            type: 'SALE_CANCELLED',
            quantity: qtyToRestore,
            previousStock: prevStock,
            newStock: prod.stock,
            referenceId: sale.invoiceNumber || sale._id.toString(),
            notes: `Cancelled sale ${sale.invoiceNumber || sale._id}${reason ? `: ${reason}` : ''}`,
            createdById: req.user?._id
          });
        }
      }
    }

    sale.status = 'CANCELLED';
    sale.cancelledAt = new Date();
    sale.cancelledBy = req.user?._id;
    if (reason) sale.cancellationReason = reason;
    if (sale.reconciliationRequired) {
      sale.reconciliationRequired = false;
      sale.reconciliationNotes = (sale.reconciliationNotes ? sale.reconciliationNotes + '; ' : '') + 'Sale cancelled; deficit voided';
    }

    await sale.save();

    // Clean up linked PaymentTransactions for this cancelled sale
    if (sale.invoiceNumber) {
      await PaymentTransaction.deleteMany({
        referenceNumber: sale.invoiceNumber,
        ...getTenantQuery(req)
      });
    }

    const updatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name email phone')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock')
      .populate('cancelledBy', 'name username');

    res.status(200).json({
      success: true,
      message: 'Sale cancelled successfully and stock restored to inventory.',
      sale: updatedSale
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cancelling sale', error: error.message });
  }
};

// POST /api/sales/:id/return — Sales Return Workflow (Full & Partial, Damaged vs Sellable Stock)
exports.returnSale = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clientUuid,
      returnAmount,
      returnedItems,
      reason,
      refundMode,
      restoreStock,
      idempotencyKey
    } = req.body;

    // 0. Idempotency check to prevent duplicate returns or double-restoring stock
    if (clientUuid || idempotencyKey) {
      const orConditions = [];
      if (clientUuid) orConditions.push({ clientUuid });
      if (idempotencyKey) orConditions.push({ idempotencyKey });
      const existingReturn = await SaleReturn.findOne({
        ...getTenantQuery(req),
        $or: orConditions
      });
      if (existingReturn) {
        const existingSale = await Sale.findById(existingReturn.saleId)
          .populate('customer', 'name email phone address')
          .populate('product', 'name price sellingPrice costPrice category stock')
          .populate('items.product', 'name price sellingPrice costPrice category stock')
          .populate('reconciledBy', 'name username');
        return res.status(200).json({
          success: true,
          message: 'Return already processed (idempotent)',
          return: existingReturn,
          sale: existingSale
        });
      }
    }

    let sale = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      sale = await Sale.findById(id).populate('customer');
    }
    if (!sale) {
      sale = await Sale.findOne({
        ...getTenantQuery(req),
        $or: [{ clientUuid: id }, { invoiceNumber: id }]
      }).populate('customer');
    }
    if (!sale || !hasTenantAccess(sale, req)) {
      return res.status(404).json({ success: false, message: 'Sale record not found.', errorCode: 'NOT_FOUND' });
    }

    if (sale.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot return a cancelled sale.',
        errorCode: 'SALE_CANCELLED'
      });
    }

    const previousReturned = Number(sale.returnedAmount) || 0;
    const saleTotal = Number(sale.grandTotal || sale.totalAmount) || 0;
    const maxReturnable = Math.max(0, saleTotal - previousReturned);

    if (maxReturnable <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This sale has already been fully returned.',
        errorCode: 'ALREADY_FULLY_RETURNED'
      });
    }

    const requestedAmount = returnAmount !== undefined ? Number(returnAmount) : maxReturnable;
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

    const reasonText = reason ? String(reason).trim() : 'Customer return';
    const isDamagedReason = /damaged|defective|broken|spoiled|reject/i.test(reasonText);
    const shouldRestoreSellableStock = restoreStock !== undefined
      ? Boolean(restoreStock)
      : !isDamagedReason;

    // 1. Inventory stock restoration (only for items actually returned and accepted into sellable inventory)
    const returnInvoice = `RET-${Date.now().toString().slice(-8)}`;
    const restoredItemsForRecord = [];

    if (Array.isArray(returnedItems) && returnedItems.length > 0) {
      for (const retItem of returnedItems) {
        const prodId = retItem.product || retItem.productId;
        const qty = Number(retItem.quantity);
        if (prodId && qty > 0) {
          let prod = null;
          if (mongoose.Types.ObjectId.isValid(prodId)) {
            prod = await Product.findById(prodId);
          }
          if (!prod) {
            prod = await Product.findOne({ ...getTenantQuery(req), clientUuid: prodId });
          }
          if (prod && hasTenantAccess(prod, req)) {
            const isItemDamaged = retItem.isSellable === false ||
              String(retItem.condition).toUpperCase() === 'DAMAGED' ||
              String(retItem.condition).toUpperCase() === 'REJECTED' ||
              !shouldRestoreSellableStock;

            if (!isItemDamaged) {
              // Item is sellable -> atomically restore stock
              const prevDoc = await Product.findOneAndUpdate(
                { _id: prod._id, ...getTenantQuery(req) },
                { $inc: { stock: qty } },
                { new: false }
              );
              const prevStock = prevDoc ? prevDoc.stock : prod.stock;
              const newStock = prevStock + qty;

              await InventoryTransaction.create({
                userId: req.user?._id,
                product: prod._id,
                type: 'RETURN',
                quantity: qty,
                previousStock: prevStock,
                newStock: newStock,
                referenceId: returnInvoice,
                notes: `Restored to sellable stock from return ${returnInvoice} (Sale: ${sale.invoiceNumber || sale._id})`,
                createdById: req.user?._id
              });

              restoredItemsForRecord.push({
                product: prod._id,
                quantity: qty,
                sellingPrice: Number(retItem.sellingPrice) || prod.sellingPrice || 0,
                costPrice: prod.costPrice || 0,
                totalAmount: (Number(retItem.sellingPrice) || prod.sellingPrice || 0) * qty,
                restoredToStock: true,
                condition: 'SELLABLE'
              });
            } else {
              // Item is damaged/defective -> do NOT increase sellable stock
              await InventoryTransaction.create({
                userId: req.user?._id,
                product: prod._id,
                type: 'RETURN',
                quantity: 0,
                previousStock: prod.stock,
                newStock: prod.stock,
                referenceId: returnInvoice,
                notes: `Return ${returnInvoice}: Damaged/defective item (${qty} units) received - NOT restored to sellable stock`,
                createdById: req.user?._id
              });

              restoredItemsForRecord.push({
                product: prod._id,
                quantity: qty,
                sellingPrice: Number(retItem.sellingPrice) || prod.sellingPrice || 0,
                costPrice: prod.costPrice || 0,
                totalAmount: (Number(retItem.sellingPrice) || prod.sellingPrice || 0) * qty,
                restoredToStock: false,
                condition: 'DAMAGED'
              });
            }
          }
        }
      }
    } else if (sale.items && sale.items.length > 0 && requestedAmount >= maxReturnable) {
      // Full return of a multi-item sale where items were not individually itemized
      for (const item of sale.items) {
        if (item.product && item.quantity > 0) {
          const prod = await Product.findById(item.product);
          if (prod && hasTenantAccess(prod, req)) {
            if (shouldRestoreSellableStock) {
              const prevDoc = await Product.findOneAndUpdate(
                { _id: prod._id, ...getTenantQuery(req) },
                { $inc: { stock: item.quantity } },
                { new: false }
              );
              const prevStock = prevDoc ? prevDoc.stock : prod.stock;
              const newStock = prevStock + item.quantity;

              await InventoryTransaction.create({
                userId: req.user?._id,
                product: prod._id,
                type: 'RETURN',
                quantity: item.quantity,
                previousStock: prevStock,
                newStock: newStock,
                referenceId: returnInvoice,
                notes: `Full return: Restored stock for ${sale.invoiceNumber || sale._id}`,
                createdById: req.user?._id
              });

              restoredItemsForRecord.push({
                product: prod._id,
                quantity: item.quantity,
                sellingPrice: item.sellingPrice,
                costPrice: item.costPrice,
                totalAmount: item.totalAmount,
                restoredToStock: true,
                condition: 'SELLABLE'
              });
            } else {
              // Damaged return -> do not increment stock
              await InventoryTransaction.create({
                userId: req.user?._id,
                product: prod._id,
                type: 'RETURN',
                quantity: 0,
                previousStock: prod.stock,
                newStock: prod.stock,
                referenceId: returnInvoice,
                notes: `Full return: Damaged/rejected items (${item.quantity} units) - NOT restored to sellable stock`,
                createdById: req.user?._id
              });

              restoredItemsForRecord.push({
                product: prod._id,
                quantity: item.quantity,
                sellingPrice: item.sellingPrice,
                costPrice: item.costPrice,
                totalAmount: item.totalAmount,
                restoredToStock: false,
                condition: 'DAMAGED'
              });
            }
          }
        }
      }
    }
    // Note: If simple amount-only sale, inventory is never touched.

    // 2. Create SaleReturn record
    const effectiveRefundMode = refundMode || (sale.amountReceived >= requestedAmount ? 'REFUND_PAID' : 'REDUCE_RECEIVABLE');
    const refundCashAmount = effectiveRefundMode === 'REFUND_PAID' ? requestedAmount : 0;

    const saleReturn = new SaleReturn({
      userId: req.user?._id,
      clientUuid: clientUuid || undefined,
      saleClientUuid: sale.clientUuid || undefined,
      saleId: sale._id,
      invoiceNumber: returnInvoice,
      originalInvoiceNumber: sale.invoiceNumber || '',
      customer: sale.customer?._id || sale.customer,
      returnDate: new Date(),
      amount: requestedAmount,
      refundMode: effectiveRefundMode,
      refundAmount: refundCashAmount,
      items: restoredItemsForRecord,
      reason: reasonText,
      restoreStock: shouldRestoreSellableStock,
      idempotencyKey: idempotencyKey || undefined,
      createdById: req.user?._id
    });

    await saleReturn.save();

    // 3. Update Sale status & returned amount
    sale.returnedAmount = previousReturned + requestedAmount;
    if (sale.returnedAmount >= saleTotal) {
      sale.status = 'RETURNED';
    } else {
      sale.status = 'PARTIALLY_RETURNED';
    }
    await sale.save();

    // 4. Record Cash Refund payment transaction if money was refunded to customer
    if (refundCashAmount > 0) {
      const custName = sale.customer?.name || 'Customer';
      await PaymentTransaction.create({
        userId: req.user?._id,
        type: 'GIVE',
        partyType: 'CUSTOMER',
        partyId: sale.customer?._id || sale.customer,
        partyModel: 'Customer',
        partyName: custName,
        amount: refundCashAmount,
        paymentMethod: sale.paymentMethod || 'CASH',
        transactionDate: new Date(),
        referenceNumber: returnInvoice,
        notes: `Refund for return ${returnInvoice} (Sale: ${sale.invoiceNumber || sale._id})`,
        createdById: req.user?._id
      });
    }

    const updatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock');

    res.status(200).json({
      success: true,
      message: 'Sale return processed successfully.',
      return: saleReturn,
      sale: updatedSale
    });
  } catch (error) {
    if (error.code === 11000 && req.body.clientUuid) {
      const existing = await SaleReturn.findOne({
        clientUuid: req.body.clientUuid,
        ...getTenantQuery(req)
      });
      if (existing) {
        const existingSale = await Sale.findById(existing.saleId);
        return res.status(200).json({
          success: true,
          message: 'Return already processed (idempotent)',
          return: existing,
          sale: existingSale
        });
      }
    }
    res.status(500).json({ success: false, message: 'Error processing sale return', error: error.message });
  }
};

// POST /api/sales/:id/reconcile-stock — Store Manager Stock Deficit Reconciliation
exports.reconcileStockDeficit = async (req, res) => {
  try {
    const { id } = req.params;
    const { action = 'RESTOCK_AND_FULFILL', notes } = req.body;

    let sale = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      sale = await Sale.findById(id);
    }
    if (!sale) {
      sale = await Sale.findOne({
        ...getTenantQuery(req),
        $or: [{ clientUuid: id }, { invoiceNumber: id }]
      });
    }

    if (!sale || !hasTenantAccess(sale, req)) {
      return res.status(404).json({ success: false, message: 'Sale record not found.', errorCode: 'NOT_FOUND' });
    }

    if (!sale.reconciliationRequired && sale.fulfillmentStatus !== 'STOCK_DEFICIT') {
      return res.status(400).json({
        success: false,
        message: 'This sale has no unresolved stock deficits.',
        errorCode: 'NO_DEFICIT'
      });
    }

    if (action === 'RESTOCK_AND_FULFILL') {
      // Manager verifies stock has arrived and fulfills deficit
      for (const item of sale.items) {
        if (item.deficitQuantity > 0) {
          const prod = await Product.findById(item.product);
          if (prod && hasTenantAccess(prod, req)) {
            if (prod.stock < item.deficitQuantity) {
              return res.status(400).json({
                success: false,
                message: `Cannot fulfill deficit for "${prod.name}". Available stock (${prod.stock}) is less than deficit (${item.deficitQuantity}). Please restock product first.`,
                errorCode: 'INSUFFICIENT_STOCK_FOR_RECONCILIATION'
              });
            }

            const prevStock = prod.stock;
            prod.stock -= item.deficitQuantity;
            await prod.save();

            await InventoryTransaction.create({
              userId: req.user?._id,
              product: prod._id,
              type: 'DEFICIT_RECONCILED',
              quantity: -item.deficitQuantity,
              previousStock: prevStock,
              newStock: prod.stock,
              referenceId: sale.invoiceNumber || sale._id.toString(),
              notes: `Deficit reconciled for sale ${sale.invoiceNumber}: deducted ${item.deficitQuantity} units`,
              createdById: req.user?._id
            });

            item.fulfilledQuantity = (item.fulfilledQuantity || 0) + item.deficitQuantity;
            item.deficitQuantity = 0;
            item.fulfillmentStatus = 'FULFILLED';
          }
        }
      }
      sale.fulfillmentStatus = 'FULFILLED';
    } else {
      // WRITE_OFF_DEFICIT or ACKNOWLEDGE
      sale.fulfillmentStatus = 'STOCK_DEFICIT';
    }

    sale.reconciliationRequired = false;
    sale.reconciledAt = new Date();
    sale.reconciledBy = req.user?._id;
    sale.reconciliationNotes = notes ? String(notes).trim() : (action === 'RESTOCK_AND_FULFILL' ? 'Restocked and fulfilled by manager' : 'Deficit acknowledged/written off by manager');
    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock')
      .populate('reconciledBy', 'name username');

    res.status(200).json({
      success: true,
      message: 'Stock deficit reconciled successfully.',
      sale: updatedSale
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error reconciling stock deficit', error: error.message });
  }
};

// GET /api/sales/:id/returns — Fetch returns for a specific sale
exports.getSaleReturns = async (req, res) => {
  try {
    const { id } = req.params;
    const returns = await SaleReturn.find({
      saleId: id,
      ...getTenantQuery(req)
    }).sort({ returnDate: -1 });

    res.status(200).json(returns);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sale returns', error: error.message });
  }
};

// DELETE /api/sales/:id/returns/:returnId OR DELETE /api/sales/returns/:returnId — Delete/Reverse Sale Return
exports.deleteSaleReturn = async (req, res) => {
  try {
    const returnId = req.params.returnId || req.params.id;
    const saleReturn = await SaleReturn.findById(returnId);
    if (!saleReturn || !hasTenantAccess(saleReturn, req)) {
      return res.status(404).json({ success: false, message: 'Sale return record not found.' });
    }

    const sale = await Sale.findById(saleReturn.saleId);
    if (!sale || !hasTenantAccess(sale, req)) {
      return res.status(404).json({ success: false, message: 'Associated sale record not found.' });
    }

    // 1. If return had restored stock to sellable inventory, check if that stock is still available to deduct
    const itemsToDeduct = [];
    if (Array.isArray(saleReturn.items) && saleReturn.items.length > 0) {
      for (const item of saleReturn.items) {
        if (item.restoredToStock && item.product && Number(item.quantity) > 0) {
          itemsToDeduct.push({ product: item.product, quantity: Number(item.quantity) });
        }
      }
    }

    // Validate all products have sufficient stock before reversing
    for (const item of itemsToDeduct) {
      const prod = await Product.findById(item.product);
      if (prod && prod.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete return: Returned stock for "${prod.name}" has already been sold or consumed. Available stock: ${prod.stock}, required to deduct: ${item.quantity}.`,
          errorCode: 'INSUFFICIENT_STOCK_FOR_REVERSAL'
        });
      }
    }

    // Deduct restored stock atomically and log adjustment
    for (const item of itemsToDeduct) {
      const prevDoc = await Product.findOneAndUpdate(
        { _id: item.product, ...getTenantQuery(req) },
        { $inc: { stock: -item.quantity } },
        { new: false }
      );
      const prevStock = prevDoc ? prevDoc.stock : 0;
      await InventoryTransaction.create({
        userId: req.user?._id,
        product: item.product,
        type: 'ADJUSTMENT',
        quantity: -item.quantity,
        previousStock: prevStock,
        newStock: prevStock - item.quantity,
        referenceId: saleReturn.invoiceNumber,
        notes: `Reversal of deleted return ${saleReturn.invoiceNumber} (Sale: ${sale.invoiceNumber || sale._id})`,
        createdById: req.user?._id
      });
    }

    // 2. Remove refund PaymentTransaction if one was generated
    if (saleReturn.refundAmount > 0) {
      await PaymentTransaction.deleteMany({
        referenceNumber: saleReturn.invoiceNumber,
        ...getTenantQuery(req)
      });
    }

    // 3. Reverse returnedAmount on Sale and recalculate status
    const previousReturned = Number(sale.returnedAmount) || 0;
    const newReturned = Math.max(0, previousReturned - (Number(saleReturn.amount) || 0));
    sale.returnedAmount = newReturned;

    const saleTotal = Number(sale.grandTotal || sale.totalAmount) || 0;
    if (newReturned <= 0) {
      sale.status = 'COMPLETED';
    } else if (newReturned < saleTotal) {
      sale.status = 'PARTIALLY_RETURNED';
    } else {
      sale.status = 'RETURNED';
    }
    await sale.save();

    // 4. Delete the SaleReturn document
    await SaleReturn.findByIdAndDelete(saleReturn._id);

    const updatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock');

    res.status(200).json({
      success: true,
      message: 'Sale return deleted and inventory/balances reversed successfully.',
      sale: updatedSale,
      deletedReturnId: returnId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting sale return', error: error.message });
  }
};

// DELETE /api/sales/:id — Admin Permanent Delete (With Stock Restoration & Return Protection)
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale || !hasTenantAccess(sale, req)) {
      return res.status(404).json({ success: false, message: 'Sale record not found.' });
    }

    // Guard: Prevent deleting sales that have active returns
    const hasReturns = (sale.returnedAmount > 0) || (await SaleReturn.exists({ saleId: id }));
    if (hasReturns) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a sale with active sales returns. Please delete or reverse the sales returns first.',
        errorCode: 'HAS_RETURNS'
      });
    }

    // If sale was COMPLETED (or active non-cancelled), restore stock upon deletion
    if (sale.status !== 'CANCELLED') {
      let itemsToRestore = [];
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        itemsToRestore = sale.items;
      } else if (sale.product) {
        itemsToRestore = [{ product: sale.product, quantity: sale.quantity }];
      }

      for (const item of itemsToRestore) {
        if (item.product && Number(item.quantity) > 0) {
          const prevDoc = await Product.findOneAndUpdate(
            { _id: item.product, ...getTenantQuery(req) },
            { $inc: { stock: Number(item.quantity) } },
            { new: false }
          );
          if (prevDoc) {
            await InventoryTransaction.create({
              userId: req.user?._id,
              product: item.product,
              type: 'SALE_CANCELLED',
              quantity: Number(item.quantity),
              previousStock: prevDoc.stock,
              newStock: prevDoc.stock + Number(item.quantity),
              referenceId: sale.invoiceNumber || sale._id.toString(),
              notes: `Stock restored due to deleted sale ${sale.invoiceNumber || sale._id}`,
              createdById: req.user?._id
            });
          }
        }
      }
    }

    // Clean up any refund payment transactions associated with this sale
    if (sale.invoiceNumber) {
      await PaymentTransaction.deleteMany({
        referenceNumber: sale.invoiceNumber,
        ...getTenantQuery(req)
      });
    }

    await Sale.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Sale deleted successfully', id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting sale', error: error.message });
  }
};

// POST /api/sales/bulk-delete
exports.bulkDeleteSales = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of sale IDs to delete.' });
    }

    let deletedCount = 0;
    const skippedWithReturns = [];

    for (const id of ids) {
      const sale = await Sale.findById(id);
      if (sale && hasTenantAccess(sale, req)) {
        // Guard against deleting sales with returns
        const hasReturns = (sale.returnedAmount > 0) || (await SaleReturn.exists({ saleId: id }));
        if (hasReturns) {
          skippedWithReturns.push(id);
          continue;
        }

        if (sale.status !== 'CANCELLED') {
          let itemsToRestore = [];
          if (Array.isArray(sale.items) && sale.items.length > 0) {
            itemsToRestore = sale.items;
          } else if (sale.product) {
            itemsToRestore = [{ product: sale.product, quantity: sale.quantity }];
          }

          for (const item of itemsToRestore) {
            if (item.product && Number(item.quantity) > 0) {
              const prevDoc = await Product.findOneAndUpdate(
                { _id: item.product, ...getTenantQuery(req) },
                { $inc: { stock: Number(item.quantity) } },
                { new: false }
              );
              if (prevDoc) {
                await InventoryTransaction.create({
                  userId: req.user?._id,
                  product: item.product,
                  type: 'SALE_CANCELLED',
                  quantity: Number(item.quantity),
                  previousStock: prevDoc.stock,
                  newStock: prevDoc.stock + Number(item.quantity),
                  referenceId: sale.invoiceNumber || sale._id.toString(),
                  notes: `Stock restored due to bulk deleted sale ${sale.invoiceNumber || sale._id}`,
                  createdById: req.user?._id
                });
              }
            }
          }
        }

        if (sale.invoiceNumber) {
          await PaymentTransaction.deleteMany({
            referenceNumber: sale.invoiceNumber,
            ...getTenantQuery(req)
          });
        }

        await Sale.findByIdAndDelete(id);
        deletedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Sales processed for deletion successfully.',
      count: deletedCount,
      skippedWithReturns
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error performing bulk sale deletion', error: error.message });
  }
};

// PUT /api/sales/:id — Edit Sale (Supports both Itemized & Amount-Only Sales)
exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer,
      items,
      amount,
      notes,
      paymentMethod,
      amountReceived,
      discount = 0,
      tax = 0,
      saleDate
    } = req.body;

    const existingSale = await Sale.findById(id);
    if (!existingSale || !hasTenantAccess(existingSale, req)) {
      return res.status(404).json({ success: false, message: 'Sale record not found.', errorCode: 'NOT_FOUND' });
    }

    if (existingSale.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled sale.',
        errorCode: 'SALE_CANCELLED'
      });
    }

    const hasNewItems = Array.isArray(items) && items.length > 0;
    const isExistingAmountOnly = (!existingSale.items || existingSale.items.length === 0) && !existingSale.product;

    // Handle customer update if provided
    if (customer) {
      let targetCustomer;
      if (mongoose.Types.ObjectId.isValid(customer)) {
        targetCustomer = await Customer.findById(customer);
      }
      if (targetCustomer && hasTenantAccess(targetCustomer, req)) {
        existingSale.customer = targetCustomer._id;
      }
    }

    // Handle date update if provided
    if (saleDate) {
      let dateToParse = saleDate;
      if (typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
        dateToParse = `${saleDate}T12:00:00`;
      }
      const d = new Date(dateToParse);
      if (!isNaN(d.getTime())) {
        existingSale.saleDate = d;
      }
    }

    if (notes !== undefined) {
      existingSale.notes = String(notes).trim();
    }

    if (paymentMethod) {
      existingSale.paymentMethod = normalizePaymentMethod(paymentMethod);
    }

    // Branch A: Amount-only sale update (no item inventory tracking)
    if (!hasNewItems && (isExistingAmountOnly || amount !== undefined || req.body.grandTotal !== undefined)) {
      const rawAmount = amount !== undefined ? amount : (req.body.grandTotal || existingSale.grandTotal);
      const newAmount = Number(rawAmount);

      if (isNaN(newAmount) || newAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Sale amount must be greater than 0.',
          errorCode: 'INVALID_AMOUNT'
        });
      }

      const discountVal = Number(discount !== undefined ? discount : existingSale.discount) || 0;
      const taxVal = Number(tax !== undefined ? tax : existingSale.tax) || 0;
      const grandTotalCalc = Math.max(0, newAmount - discountVal + taxVal);

      // Guard: Cannot edit sale total to less than what was already returned
      if (existingSale.returnedAmount > 0 && grandTotalCalc < existingSale.returnedAmount) {
        return res.status(400).json({
          success: false,
          message: `New sale total (₹${grandTotalCalc}) cannot be less than already returned amount (₹${existingSale.returnedAmount}).`,
          errorCode: 'CANNOT_REDUCE_BELOW_RETURNED'
        });
      }

      existingSale.totalAmount = newAmount;
      existingSale.subtotal = newAmount;
      existingSale.discount = discountVal;
      existingSale.tax = taxVal;
      existingSale.grandTotal = grandTotalCalc;
      if (amountReceived !== undefined) {
        existingSale.amountReceived = Number(amountReceived) || 0;
        existingSale.changeDue = Math.max(0, existingSale.amountReceived - grandTotalCalc);
      }

      await existingSale.save();

    // Synchronize PaymentTransaction for updated sale
    if (existingSale.invoiceNumber) {
      const effectiveReceived = Math.min(Number(existingSale.amountReceived) || 0, existingSale.grandTotal);
      if (effectiveReceived > 0 && existingSale.customer) {
        const custDoc = await Customer.findById(existingSale.customer);
        await PaymentTransaction.findOneAndUpdate(
          { referenceNumber: existingSale.invoiceNumber, type: 'RECEIVE', ...getTenantQuery(req) },
          {
            userId: req.user?._id,
            businessId: req.user?.businessId,
            type: 'RECEIVE',
            partyType: 'CUSTOMER',
            partyId: existingSale.customer,
            partyModel: 'Customer',
            partyName: custDoc?.name || 'Customer',
            amount: effectiveReceived,
            paymentMethod: existingSale.paymentMethod || 'CASH',
            transactionDate: existingSale.saleDate || new Date(),
            referenceNumber: existingSale.invoiceNumber,
            notes: `Payment for sale ${existingSale.invoiceNumber}`
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        await PaymentTransaction.deleteMany({
          referenceNumber: existingSale.invoiceNumber,
          type: 'RECEIVE',
          ...getTenantQuery(req)
        });
      }
    }

      // Synchronize PaymentTransaction for updated sale
      if (existingSale.invoiceNumber) {
        const effectiveReceived = Math.min(Number(existingSale.amountReceived) || 0, existingSale.grandTotal);
        if (effectiveReceived > 0 && existingSale.customer) {
          const custDoc = await Customer.findById(existingSale.customer);
          await PaymentTransaction.findOneAndUpdate(
            { referenceNumber: existingSale.invoiceNumber, type: 'RECEIVE', ...getTenantQuery(req) },
            {
              userId: req.user?._id,
              businessId: req.user?.businessId,
              type: 'RECEIVE',
              partyType: 'CUSTOMER',
              partyId: existingSale.customer,
              partyModel: 'Customer',
              partyName: custDoc?.name || 'Customer',
              amount: effectiveReceived,
              paymentMethod: existingSale.paymentMethod || 'CASH',
              transactionDate: existingSale.saleDate || new Date(),
              referenceNumber: existingSale.invoiceNumber,
              notes: `Payment for sale ${existingSale.invoiceNumber}`
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } else {
          await PaymentTransaction.deleteMany({
            referenceNumber: existingSale.invoiceNumber,
            type: 'RECEIVE',
            ...getTenantQuery(req)
          });
        }
      }

      const updatedSale = await Sale.findById(existingSale._id)
        .populate('customer', 'name email phone address')
        .populate('product', 'name price sellingPrice costPrice category stock')
        .populate('items.product', 'name price sellingPrice costPrice category stock');

      return res.status(200).json({
        success: true,
        message: 'Sale updated successfully.',
        sale: updatedSale
      });
    }

    // Branch B: Itemized sale update with Inventory Adjustments
    if (!hasNewItems) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required to edit the sale.',
        errorCode: 'MISSING_ITEMS'
      });
    }

    // 1. Map existing items to a map of productId -> quantity
    const oldProductQtyMap = new Map();
    if (Array.isArray(existingSale.items) && existingSale.items.length > 0) {
      for (const item of existingSale.items) {
        const pId = item.product ? item.product.toString() : null;
        if (pId) {
          oldProductQtyMap.set(pId, (oldProductQtyMap.get(pId) || 0) + Number(item.quantity));
        }
      }
    } else if (existingSale.product) {
      const pId = existingSale.product.toString();
      oldProductQtyMap.set(pId, Number(existingSale.quantity));
    }

    // 2. Map new items to a map of productId -> quantity
    const newProductQtyMap = new Map();
    let normalizedNewItems = [];

    for (const item of items) {
      if (!item.product || !item.quantity || Number(item.quantity) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid product and positive quantity required for each item.' });
      }
      const pId = item.product.toString();
      const qty = Number(item.quantity);
      newProductQtyMap.set(pId, (newProductQtyMap.get(pId) || 0) + qty);

      const prodDoc = await Product.findById(item.product);
      if (!prodDoc || prodDoc.isActive === false || !hasTenantAccess(prodDoc, req)) {
        return res.status(404).json({ success: false, message: 'Product not found, inactive or unauthorized.' });
      }

      const itemSellingPrice = item.sellingPrice !== undefined ? Number(item.sellingPrice) : (prodDoc.sellingPrice || prodDoc.price);
      const itemCostPrice = item.costPrice !== undefined ? Number(item.costPrice) : (prodDoc.costPrice || Math.round(itemSellingPrice * 0.7));
      const itemTotalAmount = itemSellingPrice * qty;
      const itemTotalCost = itemCostPrice * qty;
      const itemProfit = itemTotalAmount - itemTotalCost;

      normalizedNewItems.push({
        productDoc: prodDoc,
        product: prodDoc._id,
        quantity: qty,
        sellingPrice: itemSellingPrice,
        costPrice: itemCostPrice,
        totalAmount: itemTotalAmount,
        totalCostAmount: itemTotalCost,
        profit: itemProfit
      });
    }

    // 3. Compute Net Quantity Deltas for all involved products
    const allProductIds = new Set([...oldProductQtyMap.keys(), ...newProductQtyMap.keys()]);
    const inventoryAdjustments = [];

    for (const pId of allProductIds) {
      const oldQty = oldProductQtyMap.get(pId) || 0;
      const newQty = newProductQtyMap.get(pId) || 0;
      const deltaNeeded = newQty - oldQty;

      const prod = await Product.findById(pId);
      if (!prod || !hasTenantAccess(prod, req)) {
        return res.status(404).json({ success: false, message: `Product ${pId} not found or unauthorized.` });
      }

      if (deltaNeeded > 0) {
        if (prod.stock < deltaNeeded) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${prod.name}". Available stock: ${prod.stock}, additional requested: ${deltaNeeded}`,
            errorCode: 'INSUFFICIENT_STOCK'
          });
        }
      }

      inventoryAdjustments.push({
        productDoc: prod,
        oldQty,
        newQty,
        deltaNeeded
      });
    }

    // 4. Calculate New Totals
    let subtotalCalc = 0;
    let totalCostCalc = 0;
    let totalProfitCalc = 0;

    for (const item of normalizedNewItems) {
      subtotalCalc += item.totalAmount;
      totalCostCalc += item.totalCostAmount;
      totalProfitCalc += item.profit;
    }

    const discountVal = Number(discount) || 0;
    const taxVal = Number(tax) || 0;
    const grandTotalCalc = Math.max(0, subtotalCalc - discountVal + taxVal);

    if (existingSale.returnedAmount > 0 && grandTotalCalc < existingSale.returnedAmount) {
      return res.status(400).json({
        success: false,
        message: `New sale total (₹${grandTotalCalc}) cannot be less than already returned amount (₹${existingSale.returnedAmount}).`,
        errorCode: 'CANNOT_REDUCE_BELOW_RETURNED'
      });
    }

    // 5. Apply Stock Adjustments & Record Ledger Transactions
    for (const adj of inventoryAdjustments) {
      if (adj.deltaNeeded !== 0) {
        const prod = adj.productDoc;
        const prevStock = prod.stock;
        prod.stock -= adj.deltaNeeded;
        await prod.save();

        await InventoryTransaction.create({
          userId: req.user?._id,
          product: prod._id,
          type: adj.deltaNeeded > 0 ? 'SALE' : 'ADJUSTMENT',
          quantity: -adj.deltaNeeded,
          previousStock: prevStock,
          newStock: prod.stock,
          referenceId: existingSale.invoiceNumber || existingSale._id.toString(),
          notes: `Edited sale ${existingSale.invoiceNumber || existingSale._id} (Qty: ${adj.oldQty} -> ${adj.newQty})`,
          createdById: req.user?._id
        });
      }
    }

    // 6. Update Sale Document
    const firstItem = normalizedNewItems[0];
    existingSale.product = firstItem.product;
    existingSale.items = normalizedNewItems.map(({ product, quantity, sellingPrice, costPrice, totalAmount, totalCostAmount, profit }) => ({
      product, quantity, sellingPrice, costPrice, totalAmount, totalCostAmount, profit
    }));
    existingSale.quantity = normalizedNewItems.reduce((sum, i) => sum + i.quantity, 0);
    existingSale.sellingPrice = firstItem.sellingPrice;
    existingSale.costPrice = firstItem.costPrice;
    existingSale.totalAmount = subtotalCalc;
    existingSale.totalCostAmount = totalCostCalc;
    existingSale.profit = totalProfitCalc;
    existingSale.subtotal = subtotalCalc;
    existingSale.discount = discountVal;
    existingSale.tax = taxVal;
    existingSale.grandTotal = grandTotalCalc;
    if (amountReceived !== undefined) {
      existingSale.amountReceived = Number(amountReceived) || 0;
      existingSale.changeDue = Math.max(0, existingSale.amountReceived - grandTotalCalc);
    }

    await existingSale.save();

    // Synchronize PaymentTransaction for updated sale
    if (existingSale.invoiceNumber) {
      const effectiveReceived = Math.min(Number(existingSale.amountReceived) || 0, existingSale.grandTotal);
      if (effectiveReceived > 0 && existingSale.customer) {
        const custDoc = await Customer.findById(existingSale.customer);
        await PaymentTransaction.findOneAndUpdate(
          { referenceNumber: existingSale.invoiceNumber, type: 'RECEIVE', ...getTenantQuery(req) },
          {
            userId: req.user?._id,
            businessId: req.user?.businessId,
            type: 'RECEIVE',
            partyType: 'CUSTOMER',
            partyId: existingSale.customer,
            partyModel: 'Customer',
            partyName: custDoc?.name || 'Customer',
            amount: effectiveReceived,
            paymentMethod: existingSale.paymentMethod || 'CASH',
            transactionDate: existingSale.saleDate || new Date(),
            referenceNumber: existingSale.invoiceNumber,
            notes: `Payment for sale ${existingSale.invoiceNumber}`
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        await PaymentTransaction.deleteMany({
          referenceNumber: existingSale.invoiceNumber,
          type: 'RECEIVE',
          ...getTenantQuery(req)
        });
      }
    }

    const updatedSale = await Sale.findById(existingSale._id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock');

    res.status(200).json({
      success: true,
      message: 'Sale updated successfully and inventory adjusted.',
      sale: updatedSale
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating sale transaction', error: error.message });
  }
};
