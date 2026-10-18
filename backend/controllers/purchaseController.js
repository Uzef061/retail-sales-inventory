const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const InventoryTransaction = require('../models/InventoryTransaction');
const { getTenantQuery, hasTenantAccess } = require('../utils/tenantHelper');

// GET /api/purchases
exports.getPurchases = async (req, res) => {
  try {
    const query = getTenantQuery(req);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name phone email contactPerson companyName')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username')
      .sort({ purchaseDate: -1, createdAt: -1 });
    res.status(200).json(purchases || []);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ success: false, message: 'Error fetching purchases', error: error.message });
  }
};

// POST /api/purchases (Create Purchase Order & Increment Inventory Stock)
exports.createPurchase = async (req, res) => {
  let session = null;
  let useSession = true;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (sErr) {
    useSession = false;
    session = null;
  }

  try {
    const {
      supplier,
      supplierId,
      product,
      productId,
      quantity,
      costPrice,
      unitCostPrice,
      purchaseDate,
      referenceNumber,
      notes,
      updateProductCost
    } = req.body;

    const targetProductId = productId || product;
    const targetSupplierId = supplierId || supplier;

    if (!targetProductId || !quantity) {
      if (useSession && session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ success: false, message: 'Product and quantity are required.' });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      if (useSession && session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number greater than 0.' });
    }

    const sessionOption = useSession && session ? { session } : {};

    const targetProduct = await Product.findById(targetProductId, null, sessionOption);
    if (!targetProduct || targetProduct.isActive === false || !hasTenantAccess(targetProduct, req)) {
      if (useSession && session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ success: false, message: 'Active product not found or unauthorized.' });
    }

    if (targetSupplierId) {
      const targetSupplier = await Supplier.findById(targetSupplierId, null, sessionOption);
      if (!targetSupplier || !hasTenantAccess(targetSupplier, req)) {
        if (useSession && session) {
          await session.abortTransaction();
          session.endSession();
        }
        return res.status(404).json({ success: false, message: 'Supplier not found or unauthorized.' });
      }
    }

    const cost = (costPrice !== undefined ? Number(costPrice) : (unitCostPrice !== undefined ? Number(unitCostPrice) : targetProduct.costPrice)) || 0;
    if (isNaN(cost) || cost < 0) {
      if (useSession && session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ success: false, message: 'Unit cost price must be 0 or greater.' });
    }

    const totalCost = qty * cost;
    const prevStock = targetProduct.stock;

    // 1. Increment product inventory stock
    targetProduct.stock += qty;
    if (updateProductCost) {
      targetProduct.costPrice = cost;
    }
    await targetProduct.save(sessionOption);

    const refNum = referenceNumber && referenceNumber.trim() ? referenceNumber.trim() : `PO-${Date.now().toString().slice(-8)}`;

    // 2. Create Purchase Record
    const purchase = new Purchase({
      userId: req.user?._id,
      supplier: targetSupplierId || undefined,
      product: targetProductId,
      quantity: qty,
      costPrice: cost,
      totalCost,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      referenceNumber: refNum,
      notes: notes || '',
      createdById: req.user?._id
    });

    await purchase.save(sessionOption);

    // 3. Record Inventory Audit Transaction Entry
    await InventoryTransaction.create(
      [
        {
          userId: req.user?._id,
          product: targetProduct._id,
          type: 'PURCHASE',
          quantity: qty,
          previousStock: prevStock,
          newStock: targetProduct.stock,
          referenceId: refNum,
          notes: `Restock purchase order ${refNum}`,
          createdById: req.user?._id
        }
      ],
      sessionOption
    );

    if (useSession && session) {
      await session.commitTransaction();
      session.endSession();
    }

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone email companyName')
      .populate('product', 'name category costPrice sellingPrice stock')
      .populate('createdById', 'name username');

    res.status(201).json(populatedPurchase);
  } catch (error) {
    if (useSession && session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (e) {}
    }
    console.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, message: 'Error creating purchase order', error: error.message });
  }
};
