const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const InventoryTransaction = require('../models/InventoryTransaction');

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
    const sales = await Sale.find()
      .populate('customer', 'name email phone')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock')
      .populate('cancelledBy', 'name username')
      .sort({ saleDate: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sales', error: error.message });
  }
};

// GET /api/sales/:id
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock')
      .populate('cancelledBy', 'name username');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale transaction not found.' });
    }
    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sale details', error: error.message });
  }
};

// POST /api/sales (Supports POS multi-item & legacy single-item billing)
exports.createSale = async (req, res) => {
  try {
    const {
      customer,
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
      amountReceived = 0
    } = req.body;

    if (!customer) {
      return res.status(400).json({ success: false, message: 'Customer is required.', errorCode: 'MISSING_CUSTOMER' });
    }

    const targetCustomer = await Customer.findById(customer);
    if (!targetCustomer || targetCustomer.isActive === false) {
      return res.status(404).json({ success: false, message: 'Active customer profile not found.', errorCode: 'CUSTOMER_NOT_FOUND' });
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

    let normalizedItems = [];

    // Handle POS multi-item array payload
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.product || !item.quantity || Number(item.quantity) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product and positive quantity required for each item.', errorCode: 'INVALID_ITEM' });
        }
        const prod = await Product.findById(item.product);
        if (!prod || prod.isActive === false) {
          return res.status(404).json({ success: false, message: 'One or more products are inactive or no longer exist.', errorCode: 'PRODUCT_NOT_FOUND' });
        }
        const qty = Number(item.quantity);
        if (prod.stock < qty) {
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
      const prod = await Product.findById(product);
      if (!prod || prod.isActive === false) {
        return res.status(404).json({ success: false, message: 'Target product not found or inactive.', errorCode: 'PRODUCT_NOT_FOUND' });
      }
      if (prod.stock < qty) {
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
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    let subtotalCalc = 0;
    let totalCostCalc = 0;
    let totalProfitCalc = 0;

    for (const item of normalizedItems) {
      const prod = item.productDoc;
      const prevStock = prod.stock;
      prod.stock -= item.quantity;
      await prod.save();

      // Record Inventory Transaction
      await InventoryTransaction.create({
        product: prod._id,
        type: 'SALE',
        quantity: -item.quantity,
        previousStock: prevStock,
        newStock: prod.stock,
        referenceId: invoiceNumber,
        notes: `Sale order ${invoiceNumber}`,
        createdById: req.user?._id
      });

      subtotalCalc += item.totalAmount;
      totalCostCalc += item.totalCostAmount;
      totalProfitCalc += item.profit;
    }

    const discountVal = Number(discount) || 0;
    const taxVal = Number(tax) || 0;
    const grandTotalCalc = Math.max(0, subtotalCalc - discountVal + taxVal);
    const amtReceived = Number(amountReceived) || grandTotalCalc;
    const changeDueCalc = Math.max(0, amtReceived - grandTotalCalc);

    // Primary item for legacy single-item backward compatibility
    const firstItem = normalizedItems[0];

    const newSale = new Sale({
      invoiceNumber,
      customer,
      product: firstItem.product,
      items: normalizedItems.map(({ product, quantity, sellingPrice, costPrice, totalAmount, totalCostAmount, profit }) => ({
        product, quantity, sellingPrice, costPrice, totalAmount, totalCostAmount, profit
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
      saleDate: parsedSaleDate
    });

    const savedSale = await newSale.save();
    const populatedSale = await Sale.findById(savedSale._id)
      .populate('customer', 'name email phone address')
      .populate('product', 'name price sellingPrice costPrice category stock')
      .populate('items.product', 'name price sellingPrice costPrice category stock');

    res.status(201).json(populatedSale);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating sale transaction', error: error.message });
  }
};

// PUT /api/sales/:id/cancel — Sale Cancellation & Inventory Restoration Workflow
exports.cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale record not found.', errorCode: 'NOT_FOUND' });
    }

    if (sale.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'This sale has already been cancelled. Cannot cancel twice.',
        errorCode: 'ALREADY_CANCELLED'
      });
    }

    // Determine items to restore
    let itemsToRestore = [];
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      itemsToRestore = sale.items;
    } else if (sale.product) {
      itemsToRestore = [{ product: sale.product, quantity: sale.quantity }];
    }

    // Restore Inventory Stock & Record Inventory Transactions
    for (const item of itemsToRestore) {
      const prod = await Product.findById(item.product);
      if (prod) {
        const prevStock = prod.stock;
        prod.stock += Number(item.quantity);
        await prod.save();

        await InventoryTransaction.create({
          product: prod._id,
          type: 'SALE_CANCELLED',
          quantity: Number(item.quantity),
          previousStock: prevStock,
          newStock: prod.stock,
          referenceId: sale.invoiceNumber || sale._id.toString(),
          notes: `Cancelled sale ${sale.invoiceNumber || sale._id}${reason ? `: ${reason}` : ''}`,
          createdById: req.user?._id
        });
      }
    }

    sale.status = 'CANCELLED';
    sale.cancelledAt = new Date();
    sale.cancelledBy = req.user?._id;
    if (reason) sale.cancellationReason = reason;

    await sale.save();

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

// DELETE /api/sales/:id — Admin Permanent Delete (With Stock Restoration)
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale record not found.' });
    }

    // If sale was COMPLETED, restore stock upon deletion
    if (sale.status === 'COMPLETED') {
      let itemsToRestore = [];
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        itemsToRestore = sale.items;
      } else if (sale.product) {
        itemsToRestore = [{ product: sale.product, quantity: sale.quantity }];
      }

      for (const item of itemsToRestore) {
        const prod = await Product.findById(item.product);
        if (prod) {
          prod.stock += Number(item.quantity);
          await prod.save();
        }
      }
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

    const sales = await Sale.find({ _id: { $in: ids } });
    for (const sale of sales) {
      if (sale.status === 'COMPLETED') {
        let itemsToRestore = [];
        if (Array.isArray(sale.items) && sale.items.length > 0) {
          itemsToRestore = sale.items;
        } else if (sale.product) {
          itemsToRestore = [{ product: sale.product, quantity: sale.quantity }];
        }
        for (const item of itemsToRestore) {
          const prod = await Product.findById(item.product);
          if (prod) {
            prod.stock += Number(item.quantity);
            await prod.save();
          }
        }
      }
    }

    const result = await Sale.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ success: true, message: 'Sales deleted successfully', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error performing bulk sale deletion', error: error.message });
  }
};

// PUT /api/sales/:id — Edit Completed Sale with Inventory Adjustments
exports.updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer,
      items,
      paymentMethod,
      discount = 0,
      tax = 0,
      saleDate
    } = req.body;

    const existingSale = await Sale.findById(id);
    if (!existingSale) {
      return res.status(404).json({ success: false, message: 'Sale record not found.', errorCode: 'NOT_FOUND' });
    }

    if (existingSale.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled sale.',
        errorCode: 'SALE_CANCELLED'
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

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.product || !item.quantity || Number(item.quantity) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product and positive quantity required for each item.' });
        }
        const pId = item.product.toString();
        const qty = Number(item.quantity);
        newProductQtyMap.set(pId, (newProductQtyMap.get(pId) || 0) + qty);

        const prodDoc = await Product.findById(item.product);
        if (!prodDoc || prodDoc.isActive === false) {
          return res.status(404).json({ success: false, message: 'Product not found or inactive.' });
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
    } else {
      return res.status(400).json({ success: false, message: 'At least one item is required to edit the sale.' });
    }

    // 3. Compute Net Quantity Deltas for all involved products
    const allProductIds = new Set([...oldProductQtyMap.keys(), ...newProductQtyMap.keys()]);
    const inventoryAdjustments = [];

    for (const pId of allProductIds) {
      const oldQty = oldProductQtyMap.get(pId) || 0;
      const newQty = newProductQtyMap.get(pId) || 0;
      const deltaNeeded = newQty - oldQty; // e.g. 7 - 5 = +2 needed from inventory

      const prod = await Product.findById(pId);
      if (!prod) {
        return res.status(404).json({ success: false, message: `Product ${pId} not found.` });
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

    // 4. Apply Stock Adjustments & Record Ledger Transactions
    for (const adj of inventoryAdjustments) {
      if (adj.deltaNeeded !== 0) {
        const prod = adj.productDoc;
        const prevStock = prod.stock;
        prod.stock -= adj.deltaNeeded;
        await prod.save();

        await InventoryTransaction.create({
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

    // 5. Calculate New Totals & Update Sale Document
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

    if (customer) {
      const targetCustomer = await Customer.findById(customer);
      if (targetCustomer) {
        existingSale.customer = targetCustomer._id;
      }
    }

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
    if (paymentMethod) existingSale.paymentMethod = normalizePaymentMethod(paymentMethod);

    await existingSale.save();

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
