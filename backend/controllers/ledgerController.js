const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const { getTenantQuery } = require('../utils/tenantHelper');

// GET /api/ledger
exports.getLedger = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate, search, type, limit = 200 } = req.query;
    const now = new Date();

    let pStart;
    let pEnd;

    if (startDate || endDate) {
      pStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      if (endDate) {
        pEnd = new Date(endDate);
        pEnd.setHours(23, 59, 59, 999);
      } else {
        pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      }
    } else {
      switch (period.toLowerCase()) {
        case 'today':
          pStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'last7days':
          pStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          pStart.setHours(0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          break;
        case 'year':
          pStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        case 'month':
        default:
          pStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
      }
    }

    const tenantFilter = getTenantQuery(req);
    const asOfDate = pEnd;

    // 1. Fetch all Customers & Suppliers for tenant to calculate authoritative balances
    const [customers, suppliers] = await Promise.all([
      Customer.find(tenantFilter).lean(),
      Supplier.find(tenantFilter).lean()
    ]);

    const customerMap = new Map();
    for (const c of customers) {
      customerMap.set(c._id.toString(), {
        id: c._id.toString(),
        name: c.name,
        phone: c.phone || '',
        totalSales: 0,
        totalPaidAtSale: 0,
        totalPayments: 0,
        totalReturns: 0
      });
    }

    const supplierMap = new Map();
    for (const s of suppliers) {
      supplierMap.set(s._id.toString(), {
        id: s._id.toString(),
        name: s.name,
        phone: s.phone || '',
        totalPurchases: 0,
        totalPayments: 0,
        totalReturns: 0
      });
    }

    // 2. Fetch Cumulative Data up to asOfDate for Outstanding Balances
    const [allSalesUpToDate, allPaymentsUpToDate, allPurchasesUpToDate, allReturnsUpToDate, allPurchaseReturnsUpToDate] = await Promise.all([
      Sale.find({
        ...tenantFilter,
        status: { $ne: 'CANCELLED' },
        saleDate: { $lte: asOfDate }
      }).lean(),
      PaymentTransaction.find({
        ...tenantFilter,
        transactionDate: { $lte: asOfDate }
      }).lean(),
      Purchase.find({
        ...tenantFilter,
        status: { $ne: 'CANCELLED' },
        purchaseDate: { $lte: asOfDate }
      }).lean(),
      SaleReturn.find({
        ...tenantFilter,
        returnDate: { $lte: asOfDate }
      }).lean(),
      PurchaseReturn.find({
        ...tenantFilter,
        returnDate: { $lte: asOfDate }
      }).lean()
    ]);

    // Aggregate Customer sales & payments
    for (const s of allSalesUpToDate) {
      const cId = s.customer ? s.customer.toString() : null;
      if (cId && customerMap.has(cId)) {
        const c = customerMap.get(cId);
        c.totalSales += Number(s.grandTotal || s.totalAmount) || 0;
        c.totalPaidAtSale += Number(s.amountReceived) || 0;
      }
    }

    for (const r of allReturnsUpToDate) {
      const cId = r.customer ? r.customer.toString() : null;
      if (cId && customerMap.has(cId)) {
        const c = customerMap.get(cId);
        c.totalReturns += Number(r.amount) || 0;
      }
    }

    for (const p of allPaymentsUpToDate) {
      const pId = p.partyId ? p.partyId.toString() : null;
      const amt = Number(p.amount) || 0;
      if (p.type === 'RECEIVE') {
        if (pId && customerMap.has(pId)) {
          customerMap.get(pId).totalPayments += amt;
        }
      } else if (p.type === 'GIVE') {
        if (pId && supplierMap.has(pId)) {
          supplierMap.get(pId).totalPayments += amt;
        }
      }
    }

    for (const pur of allPurchasesUpToDate) {
      const sId = pur.supplier ? pur.supplier.toString() : null;
      if (sId && supplierMap.has(sId)) {
        supplierMap.get(sId).totalPurchases += Number(pur.totalCost || pur.grandTotal) || 0;
      }
    }

    for (const pr of allPurchaseReturnsUpToDate) {
      const sId = pr.supplier ? pr.supplier.toString() : null;
      if (sId && supplierMap.has(sId)) {
        supplierMap.get(sId).totalReturns += Number(pr.amount) || 0;
      }
    }

    // 3. Compute Outstanding Balances as of asOfDate
    let toReceiveTotal = 0;
    const customerBalances = {};
    for (const [cId, c] of customerMap.entries()) {
      // Customer balance = (Total Sales - Total Returns) - (Total Paid at Sale + Additional Payments Received)
      // If sale was paid in full at sale time, totalSales == totalPaidAtSale, balance is 0.
      const netReceivable = Math.max(0, (c.totalSales - c.totalReturns) - (c.totalPaidAtSale + c.totalPayments));
      customerBalances[cId] = netReceivable;
      toReceiveTotal += netReceivable;
    }

    let toPayTotal = 0;
    const supplierBalances = {};
    for (const [sId, s] of supplierMap.entries()) {
      // Supplier balance = (Total Purchases - Total Returns) - Total Payments Given
      const netPayable = Math.max(0, (s.totalPurchases - s.totalReturns) - s.totalPayments);
      supplierBalances[sId] = netPayable;
      toPayTotal += netPayable;
    }

    // 4. Period Activity Metrics (Inside [pStart, pEnd])
    let periodSalesTotal = 0;
    let periodReceivedTotal = 0;
    let periodPurchasesTotal = 0;
    let periodPaidTotal = 0;
    let periodReturnsTotal = 0;

    const rawEntries = [];

    // Sales in period
    for (const s of allSalesUpToDate) {
      const d = new Date(s.saleDate);
      if (d >= pStart && d <= pEnd) {
        const saleAmt = Number(s.grandTotal || s.totalAmount) || 0;
        const paidAtSale = Number(s.amountReceived) || 0;
        periodSalesTotal += saleAmt;
        periodReceivedTotal += Math.min(paidAtSale, saleAmt);

        const cId = s.customer ? s.customer.toString() : null;
        const cInfo = cId && customerMap.has(cId) ? customerMap.get(cId) : null;

        rawEntries.push({
          id: s._id.toString(),
          type: 'SALE',
          date: s.saleDate,
          partyName: cInfo ? cInfo.name : 'Customer',
          partyPhone: cInfo ? cInfo.phone : '',
          partyType: 'CUSTOMER',
          partyId: cId,
          amount: saleAmt,
          amountReceived: paidAtSale,
          status: s.status,
          reference: s.invoiceNumber || `INV-${s._id.toString().slice(-8)}`,
          paymentMethod: s.paymentMethod || 'CASH',
          direction: 'DEBIT',
          directionLabel: 'Sale (Receivable)',
          balanceImpact: `+₹${saleAmt.toFixed(0)}`,
          resultingBalance: cId ? (customerBalances[cId] || 0) : 0,
          notes: s.notes || ''
        });
      }
    }

    // Returns in period
    for (const r of allReturnsUpToDate) {
      const d = new Date(r.returnDate);
      if (d >= pStart && d <= pEnd) {
        const retAmt = Number(r.amount) || 0;
        periodReturnsTotal += retAmt;

        const cId = r.customer ? r.customer.toString() : null;
        const cInfo = cId && customerMap.has(cId) ? customerMap.get(cId) : null;

        rawEntries.push({
          id: r._id.toString(),
          type: 'SALE_RETURN',
          date: r.returnDate,
          partyName: cInfo ? cInfo.name : 'Customer',
          partyPhone: cInfo ? cInfo.phone : '',
          partyType: 'CUSTOMER',
          partyId: cId,
          amount: retAmt,
          status: 'RETURNED',
          reference: r.invoiceNumber || `RET-${r._id.toString().slice(-8)}`,
          linkedReference: r.originalInvoiceNumber || '',
          direction: 'CREDIT',
          directionLabel: 'Sale Return (Credit)',
          balanceImpact: `-₹${retAmt.toFixed(0)}`,
          resultingBalance: cId ? (customerBalances[cId] || 0) : 0,
          notes: r.reason || 'Customer return'
        });
      }
    }

    // Payments in period
    for (const p of allPaymentsUpToDate) {
      const d = new Date(p.transactionDate);
      if (d >= pStart && d <= pEnd) {
        const amt = Number(p.amount) || 0;
        const pId = p.partyId ? p.partyId.toString() : null;
        let pPhone = '';
        let currentBal = 0;

        if (p.type === 'RECEIVE') {
          periodReceivedTotal += amt;
          if (pId && customerMap.has(pId)) {
            pPhone = customerMap.get(pId).phone;
            currentBal = customerBalances[pId] || 0;
          }
          rawEntries.push({
            id: p._id.toString(),
            type: 'PAYMENT_RECEIVED',
            date: p.transactionDate,
            partyName: p.partyName,
            partyPhone: pPhone,
            partyType: p.partyType || 'CUSTOMER',
            partyId: pId,
            amount: amt,
            paymentMethod: p.paymentMethod || 'CASH',
            reference: p.referenceNumber || '',
            direction: 'CREDIT',
            directionLabel: 'Payment Received (In)',
            balanceImpact: `-₹${amt.toFixed(0)}`,
            resultingBalance: currentBal,
            notes: p.notes || ''
          });
        } else {
          periodPaidTotal += amt;
          if (pId && supplierMap.has(pId)) {
            pPhone = supplierMap.get(pId).phone;
            currentBal = supplierBalances[pId] || 0;
          }
          rawEntries.push({
            id: p._id.toString(),
            type: 'PAYMENT_MADE',
            date: p.transactionDate,
            partyName: p.partyName,
            partyPhone: pPhone,
            partyType: p.partyType || 'SUPPLIER',
            partyId: pId,
            amount: amt,
            paymentMethod: p.paymentMethod || 'CASH',
            reference: p.referenceNumber || '',
            direction: 'DEBIT',
            directionLabel: 'Payment Paid (Out)',
            balanceImpact: `-₹${amt.toFixed(0)}`,
            resultingBalance: currentBal,
            notes: p.notes || ''
          });
        }
      }
    }

    // Purchases in period
    for (const pur of allPurchasesUpToDate) {
      const d = new Date(pur.purchaseDate);
      if (d >= pStart && d <= pEnd) {
        const purAmt = Number(pur.totalCost || pur.grandTotal) || 0;
        periodPurchasesTotal += purAmt;

        const sId = pur.supplier ? pur.supplier.toString() : null;
        const sInfo = sId && supplierMap.has(sId) ? supplierMap.get(sId) : null;

        rawEntries.push({
          id: pur._id.toString(),
          type: 'PURCHASE',
          date: pur.purchaseDate,
          partyName: sInfo ? sInfo.name : 'Supplier',
          partyPhone: sInfo ? sInfo.phone : '',
          partyType: 'SUPPLIER',
          partyId: sId,
          amount: purAmt,
          reference: pur.referenceNumber || `PUR-${pur._id.toString().slice(-8)}`,
          direction: 'CREDIT',
          directionLabel: 'Purchase (Payable)',
          balanceImpact: `+₹${purAmt.toFixed(0)}`,
          resultingBalance: sId ? (supplierBalances[sId] || 0) : 0,
          notes: pur.notes || ''
        });
      }
    }

    // Purchase Returns in period
    for (const pr of allPurchaseReturnsUpToDate) {
      const d = new Date(pr.returnDate);
      if (d >= pStart && d <= pEnd) {
        const retAmt = Number(pr.amount) || 0;
        periodReturnsTotal += retAmt;

        const sId = pr.supplier ? pr.supplier.toString() : null;
        const sInfo = sId && supplierMap.has(sId) ? supplierMap.get(sId) : null;

        rawEntries.push({
          id: pr._id.toString(),
          type: 'PURCHASE_RETURN',
          date: pr.returnDate,
          partyName: sInfo ? sInfo.name : 'Supplier',
          partyPhone: sInfo ? sInfo.phone : '',
          partyType: 'SUPPLIER',
          partyId: sId,
          amount: retAmt,
          status: 'RETURNED',
          reference: pr.referenceNumber || `PR-${pr._id.toString().slice(-8)}`,
          linkedReference: pr.originalReferenceNumber || '',
          direction: 'DEBIT',
          directionLabel: 'Purchase Return (Debit)',
          balanceImpact: `-₹${retAmt.toFixed(0)}`,
          resultingBalance: sId ? (supplierBalances[sId] || 0) : 0,
          notes: pr.reason || 'Goods returned to supplier'
        });
      }
    }

    // 5. Apply Search & Type Filters
    let filteredEntries = rawEntries;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredEntries = filteredEntries.filter(e => {
        return (
          e.partyName.toLowerCase().includes(q) ||
          e.partyPhone.toLowerCase().includes(q) ||
          e.reference.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
        );
      });
    }

    if (type && type !== 'ALL') {
      const t = type.toUpperCase();
      if (t === 'RECEIVABLE' || t === 'IN') {
        filteredEntries = filteredEntries.filter(e => e.type === 'SALE' || e.type === 'PAYMENT_RECEIVED');
      } else if (t === 'PAYABLE' || t === 'OUT') {
        filteredEntries = filteredEntries.filter(e => e.type === 'PURCHASE' || e.type === 'PAYMENT_MADE' || e.type === 'PURCHASE_RETURN');
      } else if (t === 'RETURN') {
        filteredEntries = filteredEntries.filter(e => e.type === 'SALE_RETURN' || e.type === 'PURCHASE_RETURN');
      }
    }

    // Sort descending by date
    filteredEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limit returned entries to avoid massive payloads
    const limitedEntries = filteredEntries.slice(0, Number(limit) || 200);

    res.status(200).json({
      success: true,
      period: {
        mode: period,
        startDate: pStart.toISOString(),
        endDate: pEnd.toISOString()
      },
      summary: {
        toReceive: Math.round(toReceiveTotal * 100) / 100,
        toPay: Math.round(toPayTotal * 100) / 100,
        periodTotalIn: Math.round(periodReceivedTotal * 100) / 100,
        periodTotalOut: Math.round(periodPaidTotal * 100) / 100,
        periodSales: Math.round(periodSalesTotal * 100) / 100,
        periodPurchases: Math.round(periodPurchasesTotal * 100) / 100,
        periodReturns: Math.round(periodReturnsTotal * 100) / 100,
        netCashFlow: Math.round((periodReceivedTotal - periodPaidTotal) * 100) / 100,
        entryCount: filteredEntries.length
      },
      entries: limitedEntries
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching ledger data', error: error.message });
  }
};
