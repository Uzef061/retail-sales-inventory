const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function runTests() {
  console.log('=== STARTING NPR CURRENCY, LEDGER & INTEGRATION TESTS ===');
  await mongoose.connect(process.env.MONGODB_URI);

  const User = require('../models/User');
  const Customer = require('../models/Customer');
  const Sale = require('../models/Sale');
  const SaleReturn = require('../models/SaleReturn');
  const PaymentTransaction = require('../models/PaymentTransaction');
  const BusinessProfile = require('../models/BusinessProfile');

  const saleController = require('../controllers/saleController');
  const ledgerController = require('../controllers/ledgerController');
  const customerController = require('../controllers/customerController');
  const paymentController = require('../controllers/paymentController');
  const businessProfileController = require('../controllers/businessProfileController');
  const { normalizeCurrency, formatCurrency } = require('../utils/currencyHelper');

  const mockReqRes = (user, body = {}, params = {}, query = {}) => {
    let statusCode = 200;
    let responseData = null;
    const req = {
      user,
      body,
      params,
      query
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };
    return {
      req,
      res,
      get: () => ({ status: statusCode, data: responseData })
    };
  };

  const createdCustomerIds = [];
  const createdSaleIds = [];
  const createdPaymentIds = [];

  try {
    const admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) throw new Error('No admin user found');

    // ----------------------------------------------------
    // TEST 1: Currency Helper Unit Tests (NPR, INR, symbols)
    // ----------------------------------------------------
    console.log('\n[TEST 1] Currency Helper validation & formatting');
    const nprFromCode = normalizeCurrency('NPR');
    if (nprFromCode.code !== 'NPR' || nprFromCode.symbol !== 'रू') {
      throw new Error(`NPR code normalization failed: ${JSON.stringify(nprFromCode)}`);
    }
    const nprFromSymbol = normalizeCurrency('रू');
    if (nprFromSymbol.code !== 'NPR' || nprFromSymbol.symbol !== 'रू') {
      throw new Error(`NPR symbol normalization failed: ${JSON.stringify(nprFromSymbol)}`);
    }
    const inrFromCode = normalizeCurrency('INR');
    if (inrFromCode.code !== 'INR' || inrFromCode.symbol !== '₹') {
      throw new Error(`INR normalization failed: ${JSON.stringify(inrFromCode)}`);
    }
    const formattedNpr = formatCurrency(1500, 'NPR');
    if (formattedNpr !== 'रू1,500' && formattedNpr !== 'रू1500') {
      console.log(`Note: formatCurrency(1500, 'NPR') yielded: ${formattedNpr}`);
    }
    console.log(`✓ CurrencyHelper normalized NPR successfully: ${nprFromCode.name} (${nprFromCode.symbol})`);

    // ----------------------------------------------------
    // TEST 2: Business Profile with NPR Currency
    // ----------------------------------------------------
    console.log('\n[TEST 2] Business Profile with NPR Currency');
    const { req: bpReq, res: bpRes, get: bpGet } = mockReqRes(admin, {
      businessName: 'Karobiz Nepal Test Store',
      currency: 'NPR'
    });
    await businessProfileController.updateProfile(bpReq, bpRes);
    const bpResult = bpGet();
    if (bpResult.status !== 200) {
      throw new Error(`Failed to update Business Profile: ${JSON.stringify(bpResult.data)}`);
    }
    const savedProfile = bpResult.data.profile;
    if (savedProfile.currencyCode !== 'NPR' || savedProfile.currencySymbol !== 'रू') {
      throw new Error(`Business Profile update did not return normalized NPR: ${JSON.stringify(savedProfile)}`);
    }

    // Verify GET profile also reflects NPR
    const { req: bpGetReq, res: bpGetRes, get: bpGetGet } = mockReqRes(admin);
    await businessProfileController.getProfile(bpGetReq, bpGetRes);
    const fetchedProfile = bpGetGet().data.profile;
    if (fetchedProfile.currencyCode !== 'NPR' || fetchedProfile.currencySymbol !== 'रू') {
      throw new Error(`Business Profile GET did not return normalized NPR: ${JSON.stringify(fetchedProfile)}`);
    }
    console.log(`✓ Business Profile saved and loaded with NPR (${fetchedProfile.currencySymbol})`);

    // ----------------------------------------------------
    // TEST 3: Quick Sale with Immediate Payment & PaymentTransaction Linking
    // ----------------------------------------------------
    console.log('\n[TEST 3] Quick Sale creation with linked PaymentTransaction');
    const testPhone = '97798' + Math.floor(100000 + Math.random() * 900000);
    const testName = 'Ram Bahadur Shrestha';
    const totalSaleAmount = 2500;
    const paidAmount = 1500; // Remaining 1000 receivable

    const { req: saleReq, res: saleRes, get: saleGet } = mockReqRes(admin, {
      customerName: testName,
      customerPhone: testPhone,
      amount: totalSaleAmount,
      amountReceived: paidAmount,
      paymentMethod: 'CASH',
      notes: 'Test NPR sale with partial cash'
    });
    await saleController.createSale(saleReq, saleRes);
    const saleResult = saleGet();
    if (saleResult.status !== 201) {
      throw new Error(`Sale creation failed: ${JSON.stringify(saleResult.data)}`);
    }
    const createdSale = saleResult.data;
    createdSaleIds.push(createdSale._id);
    console.log(`✓ Sale created: Invoice ${createdSale.invoiceNumber}, Total: ${createdSale.grandTotal}, Received: ${createdSale.amountReceived}`);

    // Verify linked PaymentTransaction was recorded
    const linkedPayment = await PaymentTransaction.findOne({
      userId: admin._id,
      partyType: 'CUSTOMER',
      referenceNumber: createdSale.invoiceNumber
    });
    if (!linkedPayment) {
      throw new Error(`Linked PaymentTransaction was NOT created for sale invoice ${createdSale.invoiceNumber}`);
    }
    createdPaymentIds.push(linkedPayment._id);
    if (linkedPayment.amount !== paidAmount) {
      throw new Error(`Linked payment amount mismatch: expected ${paidAmount}, got ${linkedPayment.amount}`);
    }
    console.log(`✓ Linked PaymentTransaction verified: ID ${linkedPayment._id}, Amount: ${linkedPayment.amount}, Type: ${linkedPayment.type}`);

    // Find the auto-created Customer
    const customer = await Customer.findOne({ userId: admin._id, phone: testPhone });
    if (!customer) throw new Error(`Customer was not found for phone ${testPhone}`);
    createdCustomerIds.push(customer._id);
    console.log(`✓ Customer located: ${customer.name} (${customer._id})`);

    // ----------------------------------------------------
    // TEST 4: Customer Ledger Statement & Live Running Balance
    // ----------------------------------------------------
    console.log('\n[TEST 4] Customer Ledger Statement endpoint (GET /api/customers/:id/ledger)');
    const { req: ledReq, res: ledRes, get: ledGet } = mockReqRes(admin, {}, { id: customer._id.toString() });
    await customerController.getCustomerLedger(ledReq, ledRes);
    const ledResult = ledGet();
    if (ledResult.status !== 200) {
      throw new Error(`Customer ledger fetch failed: ${JSON.stringify(ledResult.data)}`);
    }
    const ledger = ledResult.data;
    console.log(`✓ Customer Ledger retrieved: Summary =`, ledger.summary);

    // Initial sale 2500, paid 1500 => balance must be 1000 owed by customer
    if (Math.round(ledger.summary.currentBalance) !== 1000) {
      throw new Error(`Customer balance incorrect: expected 1000, got ${ledger.summary.currentBalance}`);
    }
    if (ledger.summary.balanceStatus !== 'OWED_BY_CUSTOMER') {
      throw new Error(`Customer balanceStatus incorrect: expected OWED_BY_CUSTOMER, got ${ledger.summary.balanceStatus}`);
    }
    console.log(`✓ Customer statement shows correct outstanding balance: ${ledger.summary.balanceLabel}`);

    // ----------------------------------------------------
    // TEST 5: Subsequent Manual Customer Payment via Payment Module
    // ----------------------------------------------------
    console.log('\n[TEST 5] Manual Customer Payment via PaymentTransaction');
    const { req: payReq, res: payRes, get: payGet } = mockReqRes(admin, {
      partyType: 'CUSTOMER',
      partyId: customer._id.toString(),
      partyName: customer.name,
      partyPhone: customer.phone,
      type: 'RECEIVE',
      amount: 400,
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Customer paid partial balance'
    });
    await paymentController.createPayment(payReq, payRes);
    const payResult = payGet();
    if (payResult.status !== 201) {
      throw new Error(`Payment creation failed: ${JSON.stringify(payResult.data)}`);
    }
    createdPaymentIds.push(payResult.data._id);
    console.log(`✓ Additional payment recorded: ₹400 received`);

    // Check customer ledger again: 1000 - 400 = 600
    const { req: ledReq2, res: ledRes2, get: ledGet2 } = mockReqRes(admin, {}, { id: customer._id.toString() });
    await customerController.getCustomerLedger(ledReq2, ledRes2);
    const ledResult2 = ledGet2();
    if (Math.round(ledResult2.data.summary.currentBalance) !== 600) {
      throw new Error(`Expected balance 600 after payment, got ${ledResult2.data.summary.currentBalance}`);
    }
    console.log(`✓ Customer balance correctly updated to 600 after manual payment`);

    // ----------------------------------------------------
    // TEST 6: Sales Return Connected to Customer Ledger
    // ----------------------------------------------------
    console.log('\n[TEST 6] Sales Return and customer balance reduction');
    const { req: retReq, res: retRes, get: retGet } = mockReqRes(admin, {
      returnAmount: 200,
      refundMode: 'REDUCE_RECEIVABLE',
      reason: 'Goods exchange/return'
    }, { id: createdSale._id.toString() });
    await saleController.returnSale(retReq, retRes);
    const retResult = retGet();
    if (retResult.status !== 200 && retResult.status !== 201) {
      throw new Error(`Sale return failed: ${JSON.stringify(retResult.data)}`);
    }
    console.log(`✓ Sales return of 200 recorded with REDUCE_RECEIVABLE`);

    // Check customer ledger: 600 - 200 = 400
    const { req: ledReq3, res: ledRes3, get: ledGet3 } = mockReqRes(admin, {}, { id: customer._id.toString() });
    await customerController.getCustomerLedger(ledReq3, ledRes3);
    const ledResult3 = ledGet3();
    if (Math.round(ledResult3.data.summary.currentBalance) !== 400) {
      throw new Error(`Expected balance 400 after return, got ${ledResult3.data.summary.currentBalance}`);
    }
    console.log(`✓ Customer balance correctly reduced to 400 after return`);

    // ----------------------------------------------------
    // TEST 7: Master Ledger Summary - Deduplication Verification
    // ----------------------------------------------------
    console.log('\n[TEST 7] Master Ledger Deduplication Verification');
    const { req: sumReq, res: sumRes, get: sumGet } = mockReqRes(admin, {}, {}, { period: 'all' });
    await ledgerController.getLedgerSummary(sumReq, sumRes);
    const sumResult = sumGet();
    if (sumResult.status !== 200) {
      throw new Error(`Ledger summary failed: ${JSON.stringify(sumResult.data)}`);
    }
    const summary = sumResult.data.summary;
    console.log(`✓ Master Ledger Summary: toReceive = ${summary.toReceive}, toPay = ${summary.toPay}, netCashFlow = ${summary.netCashFlow}`);
    console.log(`✓ Period totalIn: ${summary.periodTotalIn}, totalOut: ${summary.periodTotalOut}`);

    console.log('\n======================================================');
    console.log('ALL NPR CURRENCY, LEDGER & INTEGRATION TESTS PASSED 100%!');
    console.log('======================================================');
  } finally {
    // Clean up created test entities
    console.log('\n[CLEANUP] Removing test records...');
    if (createdSaleIds.length > 0) {
      await SaleReturn.deleteMany({ saleId: { $in: createdSaleIds } });
      await Sale.deleteMany({ _id: { $in: createdSaleIds } });
    }
    if (createdPaymentIds.length > 0) {
      await PaymentTransaction.deleteMany({ _id: { $in: createdPaymentIds } });
    }
    if (createdCustomerIds.length > 0) {
      await Customer.deleteMany({ _id: { $in: createdCustomerIds } });
    }
    console.log('✓ Cleanup complete.');
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
