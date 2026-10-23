const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const InventoryTransaction = require('../models/InventoryTransaction');

const purchaseController = require('../controllers/purchaseController');
const supplierController = require('../controllers/supplierController');
const paymentController = require('../controllers/paymentController');
const ledgerController = require('../controllers/ledgerController');

// Mock req and res helper
const createMockReqRes = (body = {}, params = {}, query = {}, user = null) => {
  const req = { body, params, query, user };
  let statusCode = 200;
  let responseData = null;

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

  const getStatus = () => statusCode;
  const getData = () => responseData;

  return { req, res, getStatus, getData };
};

async function runTests() {
  console.log('=== STARTING PURCHASE, SUPPLIER LEDGER & INVENTORY INTEGRATION TEST SUITE ===\n');

  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const testUser = { _id: new mongoose.Types.ObjectId(), username: 'test_supplier_admin' };
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedCount++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Scenario 1: Create a purchase with an existing supplier (Credit purchase)
    // -------------------------------------------------------------
    console.log('\n[Scenario 1] Purchase with existing supplier on credit (unpaid):');

    const testSupplier1 = await Supplier.create({
      userId: testUser._id,
      name: 'Alpha Wholesale Traders',
      phone: `98765${Date.now().toString().slice(-5)}`,
      isActive: true
    });

    const testProd1 = await Product.create({
      userId: testUser._id,
      name: `Wholesale Item 1 ${Date.now()}`,
      category: 'Provisions',
      costPrice: 80,
      sellingPrice: 120,
      stock: 10,
      isActive: true
    });

    const { req: pReq1, res: pRes1, getStatus: pStat1, getData: pData1 } = createMockReqRes(
      {
        supplierId: testSupplier1._id.toString(),
        product: testProd1._id.toString(),
        quantity: 10,
        costPrice: 80,
        amountPaid: 0 // Unpaid credit purchase
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(pReq1, pRes1);
    assert(pStat1() === 201, 'Credit purchase created successfully (201)');
    const pur1 = pData1();
    assert(pur1.paymentStatus === 'UNPAID', 'Payment status is UNPAID');

    // Check stock was incremented
    const p1After = await Product.findById(testProd1._id);
    assert(p1After.stock === 20, `Inventory stock increased from 10 to 20 (was ${p1After.stock})`);

    // Check no cash payment transaction was created
    const pt1Count = await PaymentTransaction.countDocuments({ referenceNumber: pur1.referenceNumber });
    assert(pt1Count === 0, 'No payment transaction created for unpaid credit purchase');

    // Check supplier ledger statement
    const { req: sReq1, res: sRes1, getData: sData1 } = createMockReqRes({}, { id: testSupplier1._id.toString() }, {}, testUser);
    await supplierController.getSupplierLedger(sReq1, sRes1);
    const sLedger1 = sData1();
    assert(sLedger1.summary.balance === 800 && sLedger1.summary.balanceStatus === 'OWED_TO_SUPPLIER', `Supplier balance shows ₹800 payable (OWED_TO_SUPPLIER)`);

    // -------------------------------------------------------------
    // Scenario 2: Create a new supplier during purchase entry
    // -------------------------------------------------------------
    console.log('\n[Scenario 2] Auto-create new supplier during purchase entry:');
    const newPhone = `91234${Date.now().toString().slice(-5)}`;
    const { req: pReq2, res: pRes2, getStatus: pStat2, getData: pData2 } = createMockReqRes(
      {
        supplierName: 'New Direct Vendor',
        supplierPhone: newPhone,
        product: testProd1._id.toString(),
        quantity: 5,
        costPrice: 80,
        amountPaid: 0
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(pReq2, pRes2);
    assert(pStat2() === 201, 'Purchase created with auto-created supplier');
    const pur2 = pData2();
    assert(pur2.supplier && pur2.supplier.name === 'New Direct Vendor', `Purchase linked to new supplier "${pur2.supplier?.name}"`);

    const autoSupplier = await Supplier.findOne({ phone: newPhone });
    assert(autoSupplier && autoSupplier.name === 'New Direct Vendor', 'Supplier record automatically persisted in database');

    // -------------------------------------------------------------
    // Scenario 3: Save a fully paid purchase
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Fully paid purchase (paid in full at purchase time):');
    const testSupplier3 = await Supplier.create({
      userId: testUser._id,
      name: 'Cash Distributor',
      phone: `93333${Date.now().toString().slice(-5)}`,
      isActive: true
    });

    const { req: pReq3, res: pRes3, getStatus: pStat3, getData: pData3 } = createMockReqRes(
      {
        supplierId: testSupplier3._id.toString(),
        product: testProd1._id.toString(),
        quantity: 15,
        costPrice: 80,
        amountPaid: 1200, // Fully paid: 15 * 80 = 1200
        paymentMethod: 'UPI'
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(pReq3, pRes3);
    assert(pStat3() === 201, 'Fully paid purchase created (201)');
    const pur3 = pData3();
    assert(pur3.paymentStatus === 'PAID', 'Payment status is PAID');

    // Check payment transaction was recorded
    const pt3 = await PaymentTransaction.findOne({ referenceNumber: pur3.referenceNumber });
    assert(pt3 && pt3.amount === 1200 && pt3.type === 'GIVE', 'PaymentTransaction recorded for full payment ₹1200');

    // Check supplier balance is 0 (Settled)
    const { req: sReq3, res: sRes3, getData: sData3 } = createMockReqRes({}, { id: testSupplier3._id.toString() }, {}, testUser);
    await supplierController.getSupplierLedger(sReq3, sRes3);
    assert(sData3().summary.balance === 0 && sData3().summary.balanceStatus === 'SETTLED', 'Fully paid purchase leaves ₹0 balance (SETTLED)');

    // -------------------------------------------------------------
    // Scenario 4: Partially paid purchase
    // -------------------------------------------------------------
    console.log('\n[Scenario 4] Partially paid purchase:');
    const testSupplier4 = await Supplier.create({
      userId: testUser._id,
      name: 'Delta Importers',
      phone: `94444${Date.now().toString().slice(-5)}`,
      isActive: true
    });

    const { req: pReq4, res: pRes4, getStatus: pStat4, getData: pData4 } = createMockReqRes(
      {
        supplierId: testSupplier4._id.toString(),
        product: testProd1._id.toString(),
        quantity: 20,
        costPrice: 100, // Total = 2000
        amountPaid: 800, // Partially paid 800, remaining 1200
        paymentMethod: 'BANK_TRANSFER'
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(pReq4, pRes4);
    assert(pStat4() === 201, 'Partially paid purchase created');
    const pur4 = pData4();
    assert(pur4.paymentStatus === 'PARTIALLY_PAID', 'Payment status is PARTIALLY_PAID');

    // Supplier balance should be exactly 1200
    const { req: sReq4, res: sRes4, getData: sData4 } = createMockReqRes({}, { id: testSupplier4._id.toString() }, {}, testUser);
    await supplierController.getSupplierLedger(sReq4, sRes4);
    assert(sData4().summary.balance === 1200, `Supplier balance shows exactly remaining ₹1200 payable (was ${sData4().summary.balance})`);

    // -------------------------------------------------------------
    // Scenario 5: Additional payment later
    // -------------------------------------------------------------
    console.log('\n[Scenario 5] Make additional payment later to reduce payable:');
    const { req: payReq, res: payRes, getStatus: payStat } = createMockReqRes(
      {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: testSupplier4._id.toString(),
        partyName: testSupplier4.name,
        amount: 700,
        paymentMethod: 'CASH',
        notes: 'Later partial payment'
      },
      {},
      {},
      testUser
    );
    await paymentController.createPayment(payReq, payRes);
    assert(payStat() === 201, 'Additional payment of ₹700 recorded');

    // Supplier balance should now drop from 1200 to 500
    const { req: sReq5, res: sRes5, getData: sData5 } = createMockReqRes({}, { id: testSupplier4._id.toString() }, {}, testUser);
    await supplierController.getSupplierLedger(sReq5, sRes5);
    assert(sData5().summary.balance === 500, `Supplier balance accurately reduced to ₹500 (was ${sData5().summary.balance})`);

    // -------------------------------------------------------------
    // Scenario 6: Multi-item purchase lines and inventory update
    // -------------------------------------------------------------
    console.log('\n[Scenario 6] Multi-item purchase lines with atomic stock updates:');
    const prodA = await Product.create({ userId: testUser._id, name: `Line Prod A ${Date.now()}`, category: 'Stationery', costPrice: 10, stock: 5 });
    const prodB = await Product.create({ userId: testUser._id, name: `Line Prod B ${Date.now()}`, category: 'Stationery', costPrice: 25, stock: 8 });

    const { req: pMultiReq, res: pMultiRes, getStatus: pmStat, getData: pmData } = createMockReqRes(
      {
        supplierId: testSupplier1._id.toString(),
        items: [
          { product: prodA._id.toString(), quantity: 15, costPrice: 12 }, // 15 * 12 = 180
          { product: prodB._id.toString(), quantity: 10, costPrice: 30 }  // 10 * 30 = 300
        ],
        discount: 20, // Total = (180 + 300) - 20 = 460
        amountPaid: 0
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(pMultiReq, pMultiRes);
    assert(pmStat() === 201, 'Multi-item purchase created successfully');
    const multiPur = pmData();
    assert(multiPur.totalCost === 460, `Multi-item total cost calculated reliably as ₹460 (was ${multiPur.totalCost})`);

    // Check stocks
    const prodAAfter = await Product.findById(prodA._id);
    const prodBAfter = await Product.findById(prodB._id);
    assert(prodAAfter.stock === 20, `Product A stock increased from 5 to 20 (+15)`);
    assert(prodBAfter.stock === 18, `Product B stock increased from 8 to 18 (+10)`);
    assert(prodAAfter.costPrice === 12, `Product A costPrice updated to ₹12`);
    assert(prodBAfter.costPrice === 30, `Product B costPrice updated to ₹30`);

    // -------------------------------------------------------------
    // Scenario 7: Supplier Advance / Overpayment
    // -------------------------------------------------------------
    console.log('\n[Scenario 7] Supplier Advance (Overpayment):');
    // Delta supplier currently has balance 500. Let's pay 800:
    const { req: advPayReq, res: advPayRes, getStatus: advStat } = createMockReqRes(
      {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: testSupplier4._id.toString(),
        partyName: testSupplier4.name,
        amount: 800, // 500 - 800 = -300 advance
        paymentMethod: 'CASH',
        notes: 'Advance deposit'
      },
      {},
      {},
      testUser
    );
    await paymentController.createPayment(advPayReq, advPayRes);
    assert(advStat() === 201, 'Advance payment of ₹800 created');

    const { req: sReq7, res: sRes7, getData: sData7 } = createMockReqRes({}, { id: testSupplier4._id.toString() }, {}, testUser);
    await supplierController.getSupplierLedger(sReq7, sRes7);
    assert(sData7().summary.balance === -300 && sData7().summary.balanceStatus === 'SUPPLIER_ADVANCE', `Supplier balance correctly shows advance ₹300 (SUPPLIER_ADVANCE)`);

    // -------------------------------------------------------------
    // Scenario 8: Purchase Return to Supplier & Inventory Deduction
    // -------------------------------------------------------------
    console.log('\n[Scenario 8] Purchase Return reduces inventory and supplier payable:');
    // Return 5 units of prodA from multiPur
    const { req: retReq, res: retRes, getStatus: rStat, getData: rData } = createMockReqRes(
      {
        returnAmount: 60, // 5 * 12 = 60
        returnedItems: [
          { product: prodA._id.toString(), quantity: 5, costPrice: 12 }
        ],
        reason: 'Damaged packaging from supplier',
        refundMode: 'REDUCE_PAYABLE'
      },
      { id: multiPur._id.toString() },
      {},
      testUser
    );
    await purchaseController.returnPurchase(retReq, retRes);
    assert(rStat() === 200, 'Purchase return processed successfully');

    // Product A stock should decrease by 5
    const prodARet = await Product.findById(prodA._id);
    assert(prodARet.stock === 15, `Product A stock deducted by returned quantity: 20 -> 15`);

    // -------------------------------------------------------------
    // Scenario 9: Idempotency Protection
    // -------------------------------------------------------------
    console.log('\n[Scenario 9] Idempotency Protection against duplicate taps:');
    const idemKey = `idem_pur_${Date.now()}`;
    const { req: idReq1, res: idRes1, getData: idData1 } = createMockReqRes(
      {
        supplierId: testSupplier1._id.toString(),
        product: prodA._id.toString(),
        quantity: 4,
        costPrice: 12,
        idempotencyKey: idemKey
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(idReq1, idRes1);

    const stockBeforeDuplicate = (await Product.findById(prodA._id)).stock;

    // Repeat identical request with same idempotencyKey
    const { req: idReq2, res: idRes2, getData: idData2 } = createMockReqRes(
      {
        supplierId: testSupplier1._id.toString(),
        product: prodA._id.toString(),
        quantity: 4,
        costPrice: 12,
        idempotencyKey: idemKey
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(idReq2, idRes2);
    assert(idData1()._id.toString() === idData2()._id.toString(), 'Duplicate request returned identical purchase');

    const stockAfterDuplicate = (await Product.findById(prodA._id)).stock;
    assert(stockAfterDuplicate === stockBeforeDuplicate, `Stock was NOT incremented twice (remained ${stockAfterDuplicate})`);

    // -------------------------------------------------------------
    // Scenario 10: Unsafe Deletion Guard (Active Returns & Sold Items)
    // -------------------------------------------------------------
    console.log('\n[Scenario 10] Deletion guards for active returns and consumed inventory:');
    // multiPur has active returns -> deleting it must fail
    const { req: delFailReq, res: delFailRes, getStatus: dfStat, getData: dfData } = createMockReqRes(
      {},
      { id: multiPur._id.toString() },
      {},
      testUser
    );
    await purchaseController.deletePurchase(delFailReq, delFailRes);
    assert(dfStat() === 400 && dfData().errorCode === 'HAS_RETURNS', 'Purchase deletion blocked when active returns exist (400 HAS_RETURNS)');

    // -------------------------------------------------------------
    // Scenario 11: Supplier Chronological Ledger Statement
    // -------------------------------------------------------------
    console.log('\n[Scenario 11] Chronological Supplier Ledger Verification:');
    const { req: sLedReq, res: sLedRes, getData: sLedData } = createMockReqRes({}, { id: testSupplier1._id.toString() }, {}, testUser);
    await supplierController.getSupplierLedger(sLedReq, sLedRes);
    const fullLedger = sLedData();
    assert(fullLedger.success === true, 'Supplier ledger fetched successfully');
    assert(Array.isArray(fullLedger.transactions) && fullLedger.transactions.length > 0, `Transactions list populated with ${fullLedger.transactions.length} entries`);
    assert(fullLedger.transactions.every(tx => tx.runningBalance !== undefined), 'All transaction entries contain running balance');

    // -------------------------------------------------------------
    // Scenario 12: General Business Ledger Consistency
    // -------------------------------------------------------------
    console.log('\n[Scenario 12] Master Ledger Consistency:');
    const { req: mReq, res: mRes, getData: mData } = createMockReqRes({}, {}, { period: 'all' }, testUser);
    await ledgerController.getLedger(mReq, mRes);
    const masterLedger = mData();
    assert(masterLedger.success === true, 'Master ledger computed successfully');
    assert(typeof masterLedger.summary.toPay === 'number' && masterLedger.summary.toPay >= 0, `Master TO PAY is valid: ₹${masterLedger.summary.toPay}`);

    console.log(`\n============================================================`);
    console.log(`PURCHASE & SUPPLIER INTEGRATION SUMMARY: ${passedCount} passed, ${failedCount} failed`);
    console.log(`============================================================\n`);

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error in test suite:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
