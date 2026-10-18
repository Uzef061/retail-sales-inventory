const Sale = require('../models/Sale');
const { getPeriodDetails, buildChartBreakdown } = require('../utils/periodUtils');

// GET /api/profit-loss?mode=today|week|month|year|custom&refDate=...&startDate=...&endDate=...
exports.getProfitLoss = async (req, res) => {
  try {
    const mode = req.query.mode || req.query.period || 'week';
    const refDate = req.query.refDate || req.query.date;
    const { startDate: customStart, endDate: customEnd } = req.query;

    const periodInfo = getPeriodDetails(mode, refDate, customStart, customEnd);
    const { matchQuery, label, startDate, endDate } = periodInfo;

    const allSales = await Sale.find(matchQuery)
      .populate('items.product', 'name category price costPrice')
      .populate('product', 'name category price costPrice');

    const completedSales = allSales.filter((s) => s.status !== 'CANCELLED');
    const cancelledSales = allSales.filter((s) => s.status === 'CANCELLED');

    const revenue = completedSales.reduce((sum, s) => sum + (Number(s.totalAmount) || Number(s.grandTotal) || 0), 0);
    const cost = completedSales.reduce((sum, s) => sum + (Number(s.totalCostAmount) || 0), 0);
    const grossProfit = revenue - cost;
    const recordedExpenses = 0; // Transparent: No store expenses tracked yet
    const profitAfterExpenses = grossProfit - recordedExpenses;

    const profit = grossProfit > 0 ? grossProfit : 0;
    const loss = grossProfit < 0 ? Math.abs(grossProfit) : 0;
    const profitMargin = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(2)) : 0;

    // Small best-selling products list (top 5 by units sold)
    const productMap = {};
    for (const s of completedSales) {
      if (Array.isArray(s.items) && s.items.length > 0) {
        for (const item of s.items) {
          const pId = item.product ? (item.product._id || item.product).toString() : (item.productName || 'unknown');
          const pName = item.productName || item.product?.name || 'Product';
          const pCat = item.product?.category || 'General';
          const qty = Number(item.quantity) || 0;
          const sp = Number(item.sellingPrice || item.unitPrice) || 0;
          const cp = item.costPrice !== undefined ? Number(item.costPrice) : Math.round(sp * 0.7);
          const itemRev = Number(item.totalAmount) || (qty * sp);
          const itemCost = Number(item.totalCostAmount) || (qty * cp);

          if (!productMap[pId]) {
            productMap[pId] = { name: pName, category: pCat, unitsSold: 0, sales: 0, cost: 0, profit: 0 };
          }
          productMap[pId].unitsSold += qty;
          productMap[pId].sales += itemRev;
          productMap[pId].cost += itemCost;
          productMap[pId].profit += (itemRev - itemCost);
        }
      } else if (s.product) {
        const pId = (s.product._id || s.product).toString();
        const pName = s.productName || s.product?.name || 'Product';
        const pCat = s.product?.category || 'General';
        const qty = Number(s.quantity) || 1;
        const sp = Number(s.sellingPrice || s.price) || 0;
        const cp = s.costPrice !== undefined ? Number(s.costPrice) : Math.round(sp * 0.7);
        const itemRev = Number(s.totalAmount) || (qty * sp);
        const itemCost = Number(s.totalCostAmount) || (qty * cp);

        if (!productMap[pId]) {
          productMap[pId] = { name: pName, category: pCat, unitsSold: 0, sales: 0, cost: 0, profit: 0 };
        }
        productMap[pId].unitsSold += qty;
        productMap[pId].sales += itemRev;
        productMap[pId].cost += itemCost;
        productMap[pId].profit += (itemRev - itemCost);
      }
    }

    const bestSellers = Object.values(productMap)
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5)
      .map((p) => ({
        ...p,
        marginPercent: p.sales > 0 ? parseFloat(((p.profit / p.sales) * 100).toFixed(1)) : 0
      }));

    const trendData = buildChartBreakdown(periodInfo.mode, startDate, endDate, completedSales);

    res.status(200).json({
      mode: periodInfo.mode,
      refDate: periodInfo.refDate.toISOString(),
      label,
      startDate: startDate.toISOString ? startDate.toISOString() : startDate,
      endDate: endDate.toISOString ? endDate.toISOString() : endDate,
      sales: revenue,
      revenue,
      costOfItemsSold: cost,
      cost,
      grossProfit,
      recordedExpenses,
      profitAfterExpenses,
      netProfit: profitAfterExpenses,
      profit,
      loss,
      profitMargin,
      totalSalesCount: completedSales.length,
      cancelledSalesCount: cancelledSales.length,
      trendData,
      bestSellers
    });
  } catch (error) {
    console.error('Error fetching Profit & Loss data:', error);
    res.status(500).json({ message: 'Error fetching Profit & Loss data', error: error.message });
  }
};
