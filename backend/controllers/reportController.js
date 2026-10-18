const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const PaymentTransaction = require('../models/PaymentTransaction');
const { getPeriodDetails, buildChartBreakdown } = require('../utils/periodUtils');
const { getTenantQuery } = require('../utils/tenantHelper');

// GET /api/reports?mode=today|week|month|year|custom&startDate=...&endDate=...&refDate=...
exports.getReports = async (req, res) => {
  try {
    const mode = req.query.mode || req.query.period || 'week';
    const refDate = req.query.refDate || req.query.date;
    const { startDate: customStart, endDate: customEnd } = req.query;

    const periodInfo = getPeriodDetails(mode, refDate, customStart, customEnd);
    const { matchQuery, label, startDate, endDate } = periodInfo;

    // 1. SALES REPORT
    const tenantSaleMatch = getTenantQuery(req, matchQuery);
    const salesInPeriod = await Sale.find(tenantSaleMatch)
      .populate('items.product', 'name category price costPrice sellingPrice')
      .populate('product', 'name category price costPrice sellingPrice');

    const totalSalesAmount = salesInPeriod.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
    const totalCostAmount = salesInPeriod.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
    const netProfit = totalSalesAmount - totalCostAmount;
    const profitMargin = totalSalesAmount > 0 ? parseFloat(((netProfit / totalSalesAmount) * 100).toFixed(2)) : 0;

    const salesByDate = buildChartBreakdown(periodInfo.mode, startDate, endDate, salesInPeriod);

    // 2. PRODUCT REPORT
    const topProdMatch = getTenantQuery(req, matchQuery);
    const bestSellingAggregation = await Sale.aggregate([
      { $match: topProdMatch },
      {
        $group: {
          _id: '$product',
          totalQuantitySold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $project: {
          _id: 1,
          name: '$productDetails.name',
          category: '$productDetails.category',
          price: '$productDetails.sellingPrice',
          totalQuantitySold: 1,
          totalRevenue: 1,
          totalProfit: 1
        }
      }
    ]);

    const salesByCategory = await Sale.aggregate([
      { $match: topProdMatch },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.category',
          totalRevenue: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // 3. INVENTORY REPORT
    const prodQuery = getTenantQuery(req, { isActive: { $ne: false } });
    const allProducts = await Product.find(prodQuery);
    const totalProducts = allProducts.length;
    const totalStock = allProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const inventoryValuation = allProducts.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.costPrice) || 0)), 0);
    const lowStockProducts = allProducts.filter(p => p.stock <= (p.reorderLevel || 10));

    // 4. PURCHASE REPORT
    const purchaseDateMatch = {};
    if (startDate) purchaseDateMatch.$gte = startDate;
    if (endDate) purchaseDateMatch.$lte = endDate;
    const purchaseQuery = getTenantQuery(req, Object.keys(purchaseDateMatch).length ? { purchaseDate: purchaseDateMatch } : {});
    const purchasesInPeriod = await Purchase.find(purchaseQuery).populate('supplier', 'name');

    const totalPurchasesAmount = purchasesInPeriod.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
    const purchasesCount = purchasesInPeriod.length;

    // 5. PARTY & CASH FLOW REPORT (RECEIVE / GIVE)
    const paymentDateMatch = {};
    if (startDate) paymentDateMatch.$gte = startDate;
    if (endDate) paymentDateMatch.$lte = endDate;
    const paymentQuery = getTenantQuery(req, Object.keys(paymentDateMatch).length ? { transactionDate: paymentDateMatch } : {});
    const paymentsInPeriod = await PaymentTransaction.find(paymentQuery);

    const totalReceived = paymentsInPeriod.filter(p => p.type === 'RECEIVE').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalGiven = paymentsInPeriod.filter(p => p.type === 'GIVE').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const customerCount = await Customer.countDocuments(getTenantQuery(req, { isActive: true }));
    const supplierCount = await Supplier.countDocuments(getTenantQuery(req, { isActive: true }));

    res.status(200).json({
      mode: periodInfo.mode,
      refDate: periodInfo.refDate.toISOString(),
      label,
      startDate: startDate.toISOString ? startDate.toISOString() : startDate,
      endDate: endDate.toISOString ? endDate.toISOString() : endDate,

      // Sales Overview
      totalSalesAmount,
      totalSalesCount: salesInPeriod.length,
      totalCostAmount,
      netProfit,
      profit: netProfit > 0 ? netProfit : 0,
      loss: netProfit < 0 ? Math.abs(netProfit) : 0,
      profitMargin,
      salesByDate,

      // Product Analytics
      bestSellingProducts: bestSellingAggregation,
      salesByCategory,

      // Inventory Metrics
      totalProducts,
      totalStock,
      inventoryValuation,
      lowStockProducts,
      lowStockCount: lowStockProducts.length,

      // Purchases
      totalPurchasesAmount,
      purchasesCount,

      // Parties & Cashflow
      customerCount,
      supplierCount,
      totalReceived,
      totalGiven,
      netCashFlow: totalReceived - totalGiven
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating reports', error: error.message });
  }
};
