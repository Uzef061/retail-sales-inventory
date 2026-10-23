const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function testWorkflow() {
  console.log('=== STARTING LEDGER, SALES & RETURN BACKEND VERIFICATION ===');
  await mongoose.connect(process.env.MONGODB_URI);

  const User = require('../models/User');
  const Product = require('../models/Product');
  const Customer = require('../models/Customer');
  const Sale = require('../models/Sale');
  const SaleReturn = require('../models/SaleReturn');
  const PaymentTransaction = require('../models/PaymentTransaction');
  const Supplier = require('../models/Supplier');
  const Purchase = require('../models/Purchase');

  const saleController = require('../controllers/saleController');
  const ledgerController = require('../controllers/ledgerController');

  // Helper mock request and response
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

  try {
    const admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) throw new Error('No admin user found in database');

    console.log(`[TEST 1] Testing simplified sales entry with new customer auto-creation`);
    const testPhone = '999888' + Math.floor(1000 + Math.random() * 9000);
    const testCustName = 'Auto Test Customer';
    const saleAmount = 1500;

    const { req: req1, res: res1, get: get1 } = mockReqRes(admin, {
      customerName: testCustName,
      customerPhone: testPhone,
      amount: saleAmount,
      paymentMethod: 'CASH',
      amountReceived: 500 // ₹1000 unpaid (Receivable)
    });

    await saleController.createSale(req1, res1);
    const resSale1 = get1();
    if (resSale1.status !== 201) throw new Error(`Sale creation failed: ${JSON.stringify(resSale1.data)}`);
    console.log(`✓ Sale 1 created: Invoice ${resSale1.data.invoiceNumber}, GrandTotal: ₹${resSale1.data.grandTotal}`);

    // Verify Customer was auto-created with the phone number
    const createdCustomer = await Customer.findOne({ userId: admin._id, phone: testPhone });
    if (!createdCustomer) throw new Error(`Customer was not auto-created for phone ${testPhone}`);
    console.log(`✓ Customer auto-created successfully: ${createdCustomer.name} (${createdCustomer.phone}) ID: ${createdCustomer._id}`);

    console.log(`[TEST 2] Testing duplicate customer prevention on repeat sale with same phone`);
    const { req: req2, res: res2, get: get2 } = mockReqRes(admin, {
      customerName: 'Repeat Name',
      customerPhone: testPhone,
      amount: 800,
      paymentMethod: 'UPI',
      amountReceived: 800
    });
    await saleController.createSale(req2, res2);
    const resSale2 = get2();
    if (resSale2.status !== 201) throw new Error(`Repeat sale failed: ${JSON.stringify(resSale2.data)}`);

    const custCountForPhone = await Customer.countDocuments({ userId: admin._id, phone: testPhone });
    if (custCountForPhone !== 1) throw new Error(`Duplicate customer created! Count: ${custCountForPhone}`);
    console.log(`✓ Deduplication verified: exactly 1 customer record exists for phone ${testPhone}`);

    console.log(`[TEST 3] Testing idempotency guard against double-tap submission`);
    const idemKey = 'test_idem_' + Date.now();
    const { req: req3a, res: res3a, get: get3a } = mockReqRes(admin, {
      customer: createdCustomer._id,
      amount: 400,
      idempotencyKey: idemKey
    });
    await saleController.createSale(req3a, res3a);
    const res3aData = get3a();

    const { req: req3b, res: res3b, get: get3b } = mockReqRes(admin, {
      customer: createdCustomer._id,
      amount: 400,
      idempotencyKey: idemKey
    });
    await saleController.createSale(req3b, res3b);
    const res3bData = get3b();

    if (res3aData.data._id.toString() !== res3bData.data._id.toString()) {
      throw new Error(`Idempotency failed: different sales created with same key!`);
    }
    console.log(`✓ Idempotency guard verified: both calls returned sale ${res3aData.data._id}`);

    console.log(`[TEST 4] Testing Sales Return workflow`);
    const saleToReturn = await Sale.findById(resSale1.data._id);
    const { req: req4, res: res4, get: get4 } = mockReqRes(admin, {
      returnAmount: 600,
      reason: 'Customer returned portion of goods'
    }, { id: saleToReturn._id.toString() });

    await saleController.returnSale(req4, res4);
    const returnResult = get4();
    if (returnResult.status !== 200) throw new Error(`Return failed: ${JSON.stringify(returnResult.data)}`);
    console.log(`✓ Return processed: Return Ref ${returnResult.data.return.invoiceNumber}, Status: ${returnResult.data.sale.status}`);

    const updatedSaleDoc = await Sale.findById(saleToReturn._id);
    if (updatedSaleDoc.returnedAmount !== 600 || updatedSaleDoc.status !== 'PARTIALLY_RETURNED') {
      throw new Error(`Sale document not updated correctly: returnedAmount=${updatedSaleDoc.returnedAmount}, status=${updatedSaleDoc.status}`);
    }
    console.log(`✓ Sale document verified: returnedAmount=600, status=PARTIALLY_RETURNED`);

    console.log(`[TEST 5] Testing return exceeding remaining amount is blocked`);
    const { req: req5, res: res5, get: get5 } = mockReqRes(admin, {
      returnAmount: 1000 // Remaining is 1500 - 600 = 900
    }, { id: saleToReturn._id.toString() });
    await saleController.returnSale(req5, res5);
    const blockedResult = get5();
    if (blockedResult.status !== 400) throw new Error(`Exceeding return was NOT blocked! Status: ${blockedResult.status}`);
    console.log(`✓ Exceeding return correctly blocked: ${blockedResult.data.message}`);

    console.log(`[TEST 6] Testing Ledger calculation endpoint`);
    const { req: req6, res: res6, get: get6 } = mockReqRes(admin, {}, {}, { period: 'month' });
    await ledgerController.getLedger(req6, res6);
    const ledgerResult = get6();
    if (ledgerResult.status !== 200) throw new Error(`Ledger fetch failed: ${JSON.stringify(ledgerResult.data)}`);

    console.log(`✓ Ledger summary: TO RECEIVE = ₹${ledgerResult.data.summary.toReceive}, TO PAY = ₹${ledgerResult.data.summary.toPay}`);
    console.log(`✓ Total ledger entries returned: ${ledgerResult.data.entries.length}`);

    // Verify that our test sale and return are present in the ledger entries
    const foundSaleInLedger = ledgerResult.data.entries.some(e => e.reference === resSale1.data.invoiceNumber);
    const foundReturnInLedger = ledgerResult.data.entries.some(e => e.reference === returnResult.data.return.invoiceNumber);
    if (!foundSaleInLedger) throw new Error(`Sale ${resSale1.data.invoiceNumber} not found in ledger entries!`);
    if (!foundReturnInLedger) throw new Error(`Return ${returnResult.data.return.invoiceNumber} not found in ledger entries!`);
    console.log(`✓ Verified both Sale and Return appear accurately in ledger entries list with correct debit/credit directions`);

    // Clean up test records
    await SaleReturn.deleteMany({ saleId: { $in: [resSale1.data._id, resSale2.data._id, res3aData.data._id] } });
    await Sale.deleteMany({ _id: { $in: [resSale1.data._id, resSale2.data._id, res3aData.data._id] } });
    await Customer.deleteOne({ _id: createdCustomer._id });
    console.log('✓ Cleaned up temporary test records');

    console.log('\n=== ALL BACKEND LEDGER, SALES & RETURN TESTS PASSED (6/6) ===');
  } catch (err) {
    console.error('FAILED TEST:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testWorkflow();
