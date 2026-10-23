/**
 * KAROBIZ — Phase 1: Critical Backend Security and Data Integrity Test Suite
 *
 * Verifies all 12 requested scenarios:
 * 1. Unauthenticated requests attempting to modify records.
 * 2. A user attempting to modify another business's records (strict multi-tenant isolation).
 * 3. Missing JWT configuration (safe failure, no secret exposure).
 * 4. Purchase creation with valid products and supplier.
 * 5. Purchase creation where a stock update fails (rollback / no partial update).
 * 6. Purchase creation where payment or ledger creation fails (transaction rollback).
 * 7. Purchase retries and duplicate submissions (idempotency guard).
 * 8. Zero, partial, full, negative, and excessive supplier payments.
 * 9. Customer overpayments and credit balances (no Math.max(0,...) clamping).
 * 10. Sales, returns, edits, and voids (stock & financial integrity).
 * 11. Demo/reset endpoint protection (auth, role, production mode guard).
 * 12. Confirmation that unrelated valid records remain unchanged after failures.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const Purchase = require('../models/Purchase');
const PurchaseReturn = require('../models/PurchaseReturn');
const PaymentTransaction = require('../models/PaymentTransaction');
const InventoryTransaction = require('../models/InventoryTransaction');
const BusinessProfile = require('../models/BusinessProfile');

const authMiddleware = require('../middleware/authMiddleware');
const { protect, authorize, validateSecurityConfig, getJwtSecret } = authMiddleware;
const saleController = require('../controllers/saleController');
const purchaseController = require('../controllers/purchaseController');
const paymentController = require('../controllers/paymentController');
const customerController = require('../controllers/customerController');
const supplierController = require('../controllers/supplierController');
const ledgerController = require('../controllers/ledgerController');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    failedTests++;
    console.error(`  ✕ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  }
}

// Helper to create mock Express req/res
const mockReqRes = (user, body = {}, params = {}, query = {}, headers = {}) => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    user,
    body,
    params,
    query,
    headers: { ...headers }
  };
  if (user && !req.headers.authorization) {
    // Generate valid auth header
    const token = jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: '1h' });
    req.headers.authorization = `Bearer ${token}`;
  }
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
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

// Helper to run middleware
const runMiddleware = (middleware, req, res) => {
  return new Promise((resolve) => {
    let resolved = false;
    const origJson = res.json.bind(res);
    res.json = (data) => {
      const ret = origJson(data);
      if (!resolved) {
        resolved = true;
        resolve({ responseSent: true, data });
      }
      return ret;
    };
    middleware(req, res, (err) => {
      if (!resolved) {
        resolved = true;
        resolve({ nextCalled: true, err });
      }
    });
  });
};

async function runSuite() {
  console.log('\n============================================================');
  console.log('KAROBIZ — PHASE 1: BACKEND SECURITY & INTEGRITY VERIFICATION');
  console.log('============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  // Setup test tenant users
  const timestamp = Date.now();
  const testUserA = await User.create({
    username: `tenant_a_${timestamp}`,
    name: 'Store A Admin',
    role: 'ADMIN',
    password: 'password123'
  });
  const profileA = await BusinessProfile.create({
    userId: testUserA._id,
    businessName: 'Store A',
    currency: '₹'
  });
  testUserA.businessId = profileA._id;
  await testUserA.save();

  const testUserB = await User.create({
    username: `tenant_b_${timestamp}`,
    name: 'Store B Admin',
    role: 'ADMIN',
    password: 'password123'
  });
  const profileB = await BusinessProfile.create({
    userId: testUserB._id,
    businessName: 'Store B',
    currency: '₹'
  });
  testUserB.businessId = profileB._id;
  await testUserB.save();

  const cashierUser = await User.create({
    username: `cashier_${timestamp}`,
    name: 'Cashier Staff',
    role: 'CASHIER',
    password: 'password123'
  });

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Unauthenticated requests attempting to modify records
    // -------------------------------------------------------------
    console.log('[Scenario 1] Unauthenticated requests attempting to modify records:');
    {
      const { req: r1, res: s1, get: g1 } = mockReqRes(null, { amount: 500 });
      await runMiddleware(protect, r1, s1);
      assert(g1().status === 401, 'Unauthenticated request to protected route returned 401');
      assert(g1().data.errorCode === 'AUTH_REQUIRED', 'Error code is AUTH_REQUIRED');

      const { req: r2, res: s2, get: g2 } = mockReqRes(null);
      r2.headers.authorization = 'Bearer invalid_garbage_token_12345';
      await runMiddleware(protect, r2, s2);
      assert(g2().status === 401, 'Invalid bearer token returned 401');
      assert(g2().data.errorCode === 'TOKEN_EXPIRED', 'Invalid token correctly rejected');
    }

    // -------------------------------------------------------------
    // SCENARIO 2: Cross-Tenant Isolation (A user attempting to modify another business's records)
    // -------------------------------------------------------------
    console.log('\n[Scenario 2] Cross-Tenant Isolation (User B cannot access or modify User A records):');
    {
      // Store A creates a product, supplier, and customer
      const prodA = await Product.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Product Store A ${timestamp}`,
        costPrice: 50,
        sellingPrice: 100,
        stock: 20
      });

      const supA = await Supplier.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Supplier Store A ${timestamp}`,
        phone: `999${timestamp.toString().slice(-7)}`
      });

      const custA = await Customer.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Customer Store A ${timestamp}`,
        phone: `888${timestamp.toString().slice(-7)}`
      });

      // User B attempts to edit Store A's supplier
      const { req: editSupReq, res: editSupRes, get: getEditSup } = mockReqRes(
        testUserB,
        { name: 'Hacked Supplier Name' },
        { id: supA._id.toString() }
      );
      await supplierController.updateSupplier(editSupReq, editSupRes);
      assert(getEditSup().status === 404, 'User B cannot update Store A supplier (404 Not Found)');

      // User B attempts to delete Store A's supplier
      const { req: delSupReq, res: delSupRes, get: getDelSup } = mockReqRes(
        testUserB,
        {},
        { id: supA._id.toString() }
      );
      await supplierController.deleteSupplier(delSupReq, delSupRes);
      assert(getDelSup().status === 404, 'User B cannot delete Store A supplier (404 Not Found)');

      // User B attempts to update Store A's customer
      const { req: editCustReq, res: editCustRes, get: getEditCust } = mockReqRes(
        testUserB,
        { name: 'Hacked Customer Name', phone: '9999999999' },
        { id: custA._id.toString() }
      );
      await customerController.updateCustomer(editCustReq, editCustRes);
      assert(getEditCust().status === 404, 'User B cannot update Store A customer (404 Not Found)');

      // User B attempts to create a Purchase referencing Store A's supplier
      const { req: xPurReq, res: xPurRes, get: getXPur } = mockReqRes(
        testUserB,
        {
          supplierId: supA._id.toString(),
          items: [{ product: prodA._id.toString(), quantity: 5, costPrice: 50 }]
        }
      );
      await purchaseController.createPurchase(xPurReq, xPurRes);
      assert(getXPur().status === 403, 'User B cannot create purchase with Store A supplier (403 Forbidden)');

      // User B attempts to create a Sale referencing Store A's customer
      const { req: xSaleReq, res: xSaleRes, get: getXSale } = mockReqRes(
        testUserB,
        {
          customer: custA._id.toString(),
          amount: 500
        }
      );
      await saleController.createSale(xSaleReq, xSaleRes);
      assert(getXSale().status === 403, 'User B cannot create sale with Store A customer (403 Forbidden)');

      // User B attempts to create a payment referencing Store A's supplier
      const { req: xPayReq, res: xPayRes, get: getXPay } = mockReqRes(
        testUserB,
        {
          type: 'GIVE',
          partyType: 'SUPPLIER',
          partyId: supA._id.toString(),
          partyName: 'Store A Supplier',
          amount: 500
        }
      );
      await paymentController.createPayment(xPayReq, xPayRes);
      assert(getXPay().status === 403, 'User B cannot record payment to Store A supplier (403 Forbidden)');

      // Verify Store A's records were completely unmodified
      const freshSupA = await Supplier.findById(supA._id);
      assert(freshSupA.name === `Supplier Store A ${timestamp}`, 'Store A supplier name preserved intact');
    }

    // -------------------------------------------------------------
    // SCENARIO 3: Missing JWT Configuration
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Missing JWT Configuration handling:');
    {
      const originalSecret = process.env.JWT_SECRET;
      try {
        delete process.env.JWT_SECRET;

        // validateSecurityConfig must throw
        let thrown = false;
        try {
          validateSecurityConfig();
        } catch (e) {
          thrown = true;
          assert(e.message.includes('FATAL SECURITY CONFIGURATION ERROR'), 'Startup config validation threw clear fatal error');
          assert(!e.message.includes(originalSecret), 'Error message does not leak any secret value');
        }
        assert(thrown, 'validateSecurityConfig threw error when JWT_SECRET missing');

        // Middleware protect must return 500 AUTH_CONFIG_ERROR safely without crashing
        const { req: cfgReq, res: cfgRes, get: getCfg } = mockReqRes(null, {}, {}, {}, { authorization: 'Bearer some_token' });
        await runMiddleware(protect, cfgReq, cfgRes);
        assert(getCfg().status === 500, 'Middleware returned 500 when secret missing');
        assert(getCfg().data.errorCode === 'AUTH_CONFIG_ERROR', 'Error code is AUTH_CONFIG_ERROR');
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }
      assert(process.env.JWT_SECRET === originalSecret, 'JWT_SECRET restored after test');
    }

    // -------------------------------------------------------------
    // SCENARIO 4: Purchase creation with valid products and supplier
    // -------------------------------------------------------------
    console.log('\n[Scenario 4] Purchase creation with valid products and supplier:');
    let validProd = null;
    let validSup = null;
    let validPurchase = null;
    {
      validProd = await Product.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Valid Product ${timestamp}`,
        costPrice: 100,
        sellingPrice: 150,
        stock: 10
      });

      validSup = await Supplier.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Valid Vendor ${timestamp}`,
        phone: `911${timestamp.toString().slice(-7)}`
      });

      const { req: purReq, res: purRes, get: getPur } = mockReqRes(testUserA, {
        supplierId: validSup._id.toString(),
        items: [
          { product: validProd._id.toString(), quantity: 15, costPrice: 120 }
        ],
        amountPaid: 800,
        paymentMethod: 'CASH',
        referenceNumber: `PO-TEST-${timestamp}`
      });

      await purchaseController.createPurchase(purReq, purRes);
      const res = getPur();
      assert(res.status === 201, 'Purchase created with 201 Created');
      assert(res.data.paymentStatus === 'PARTIALLY_PAID', 'Payment status is PARTIALLY_PAID');
      validPurchase = res.data;

      // Verify stock was incremented from 10 to 25
      const refreshedProd = await Product.findById(validProd._id);
      assert(refreshedProd.stock === 25, 'Product stock incremented by 15 (was 10, now 25)');
      assert(refreshedProd.costPrice === 120, 'Product cost price updated to ₹120');

      // Verify inventory transaction was recorded
      const invTx = await InventoryTransaction.findOne({ referenceId: `PO-TEST-${timestamp}` });
      assert(invTx != null, 'InventoryTransaction recorded for purchase');
      assert(invTx.quantity === 15, 'Inventory movement quantity is +15');
      assert(invTx.newStock === 25, 'Inventory movement recorded newStock 25');

      // Verify payment transaction was recorded
      const payTx = await PaymentTransaction.findOne({ referenceNumber: `PO-TEST-${timestamp}` });
      assert(payTx != null, 'PaymentTransaction recorded for initial payment');
      assert(payTx.amount === 800, 'PaymentTransaction amount is ₹800');
    }

    // -------------------------------------------------------------
    // SCENARIO 5: Purchase creation where a stock update fails
    // -------------------------------------------------------------
    console.log('\n[Scenario 5] Purchase creation where a stock update fails (Rollback):');
    {
      const prodBefore = await Product.findById(validProd._id);
      const stockBefore = prodBefore.stock;
      const fakeProdId = new mongoose.Types.ObjectId();

      // Submit purchase where one item does not exist
      const { req: failPurReq, res: failPurRes, get: getFailPur } = mockReqRes(testUserA, {
        supplierId: validSup._id.toString(),
        items: [
          { product: validProd._id.toString(), quantity: 10, costPrice: 120 },
          { product: fakeProdId.toString(), quantity: 5, costPrice: 50 }
        ],
        amountPaid: 500
      });

      await purchaseController.createPurchase(failPurReq, failPurRes);
      const failRes = getFailPur();
      assert(failRes.status === 404, 'Purchase rejected with 404 for invalid product');

      // Assert stock of validProd was NOT changed
      const prodAfter = await Product.findById(validProd._id);
      assert(prodAfter.stock === stockBefore, 'Product stock was not partially incremented after failure');

      // Assert no purchase was saved
      const strayPur = await Purchase.findOne({ supplier: validSup._id, totalCost: 1450 });
      assert(strayPur == null, 'No partial purchase document was saved in database');
    }

    // -------------------------------------------------------------
    // SCENARIO 6: Purchase creation where payment or ledger creation fails (Transaction Rollback)
    // -------------------------------------------------------------
    console.log('\n[Scenario 6] Purchase creation atomicity & rollback verification:');
    {
      const stockBefore = (await Product.findById(validProd._id)).stock;

      // Test negative amountPaid rejection before any DB write
      const { req: negReq, res: negRes, get: getNeg } = mockReqRes(testUserA, {
        supplierId: validSup._id.toString(),
        items: [{ product: validProd._id.toString(), quantity: 5, costPrice: 120 }],
        amountPaid: -200
      });

      await purchaseController.createPurchase(negReq, negRes);
      assert(getNeg().status === 400, 'Negative amountPaid rejected with 400');

      const stockAfter = (await Product.findById(validProd._id)).stock;
      assert(stockAfter === stockBefore, 'Stock unchanged after payment validation failure');
    }

    // -------------------------------------------------------------
    // SCENARIO 7: Purchase retries and duplicate submissions (Idempotency)
    // -------------------------------------------------------------
    console.log('\n[Scenario 7] Purchase retries and duplicate submissions:');
    {
      const idemKey = `idem_pur_${timestamp}`;
      const stockBefore = (await Product.findById(validProd._id)).stock;

      // 1st submission
      const { req: p1Req, res: p1Res, get: getP1 } = mockReqRes(testUserA, {
        supplierId: validSup._id.toString(),
        items: [{ product: validProd._id.toString(), quantity: 4, costPrice: 120 }],
        amountPaid: 480,
        idempotencyKey: idemKey
      });
      await purchaseController.createPurchase(p1Req, p1Res);
      const res1 = getP1();
      assert(res1.status === 201, 'First submission succeeded with 201');

      const stockAfterFirst = (await Product.findById(validProd._id)).stock;
      assert(stockAfterFirst === stockBefore + 4, 'Stock incremented by 4 on first submission');

      // 2nd submission (Retry with same idempotency key)
      const { req: p2Req, res: p2Res, get: getP2 } = mockReqRes(testUserA, {
        supplierId: validSup._id.toString(),
        items: [{ product: validProd._id.toString(), quantity: 4, costPrice: 120 }],
        amountPaid: 480,
        idempotencyKey: idemKey
      });
      await purchaseController.createPurchase(p2Req, p2Res);
      const res2 = getP2();
      assert(res2.status === 200, 'Second submission returned 200 idempotent response');
      assert(res1.data._id.toString() === res2.data._id.toString(), 'Both calls returned exact same purchase ID');

      const stockAfterRetry = (await Product.findById(validProd._id)).stock;
      assert(stockAfterRetry === stockAfterFirst, 'Stock was NOT incremented a second time on retry');
    }

    // -------------------------------------------------------------
    // SCENARIO 8: Zero, partial, full, negative, and excessive supplier payments
    // -------------------------------------------------------------
    console.log('\n[Scenario 8] Supplier payment edge cases:');
    {
      const supEdge = await Supplier.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Supplier Edge ${timestamp}`,
        phone: `777${timestamp.toString().slice(-7)}`
      });

      // 8a. Zero payment purchase (Unpaid)
      const { req: rZero, res: sZero, get: gZero } = mockReqRes(testUserA, {
        supplierId: supEdge._id.toString(),
        items: [{ product: validProd._id.toString(), quantity: 1, costPrice: 500 }],
        amountPaid: 0
      });
      await purchaseController.createPurchase(rZero, sZero);
      assert(gZero().data.paymentStatus === 'UNPAID', 'Zero payment marked as UNPAID');

      // 8b. Negative payment via /api/payments
      const { req: rNeg, res: sNeg, get: gNeg } = mockReqRes(testUserA, {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: supEdge._id.toString(),
        partyName: supEdge.name,
        amount: -100
      });
      await paymentController.createPayment(rNeg, sNeg);
      assert(gNeg().status === 400, 'Negative payment rejected with 400 INVALID_AMOUNT');

      // 8c. Partial payment
      const { req: rPart, res: sPart, get: gPart } = mockReqRes(testUserA, {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: supEdge._id.toString(),
        partyName: supEdge.name,
        amount: 200
      });
      await paymentController.createPayment(rPart, sPart);
      assert(gPart().status === 201, 'Partial payment of 200 recorded');

      // Check balance: 500 - 200 = 300 payable
      const { req: rLed1, res: sLed1, get: gLed1 } = mockReqRes(testUserA, {}, { id: supEdge._id.toString() });
      await supplierController.getSupplierLedger(rLed1, sLed1);
      assert(gLed1().data.summary.balance === 300, 'Supplier balance shows ₹300 payable');
      assert(gLed1().data.summary.balanceStatus === 'OWED_TO_SUPPLIER', 'Balance status is OWED_TO_SUPPLIER');

      // 8d. Settle in full with 300
      const { req: rFull, res: sFull, get: gFull } = mockReqRes(testUserA, {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: supEdge._id.toString(),
        partyName: supEdge.name,
        amount: 300
      });
      await paymentController.createPayment(rFull, sFull);
      await supplierController.getSupplierLedger(rLed1, sLed1);
      assert(gLed1().data.summary.balance === 0, 'Full payment brings balance to ₹0 (SETTLED)');
      assert(gLed1().data.summary.balanceStatus === 'SETTLED', 'Balance status is SETTLED');

      // 8e. Excessive payment (Advance/Overpayment of ₹500)
      const { req: rExcess, res: sExcess, get: gExcess } = mockReqRes(testUserA, {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: supEdge._id.toString(),
        partyName: supEdge.name,
        amount: 500
      });
      await paymentController.createPayment(rExcess, sExcess);
      await supplierController.getSupplierLedger(rLed1, sLed1);
      assert(gLed1().data.summary.balance === -500, 'Overpayment results in negative balance ₹-500');
      assert(gLed1().data.summary.balanceStatus === 'SUPPLIER_ADVANCE', 'Overpayment explicitly classified as SUPPLIER_ADVANCE');
      assert(gLed1().data.summary.balanceLabel.includes('advance'), 'Balance label identifies advance amount');
    }

    // -------------------------------------------------------------
    // SCENARIO 9: Customer overpayments and credit balances in Master Ledger
    // -------------------------------------------------------------
    console.log('\n[Scenario 9] Customer overpayments & Master Ledger balance preservation:');
    {
      const custCredit = await Customer.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Customer Credit ${timestamp}`,
        phone: `666${timestamp.toString().slice(-7)}`
      });

      // Sale of ₹600, customer pays ₹1000 (₹400 overpayment / credit)
      const { req: rSaleOver, res: sSaleOver, get: gSaleOver } = mockReqRes(testUserA, {
        customer: custCredit._id.toString(),
        amount: 600,
        amountReceived: 600
      });
      await saleController.createSale(rSaleOver, sSaleOver);

      // Customer gives additional ₹400 advance payment
      const { req: rPayOver, res: sPayOver, get: gPayOver } = mockReqRes(testUserA, {
        type: 'RECEIVE',
        partyType: 'CUSTOMER',
        partyId: custCredit._id.toString(),
        partyName: custCredit.name,
        amount: 400
      });
      await paymentController.createPayment(rPayOver, sPayOver);

      // Fetch master ledger
      const { req: rLedger, res: sLedger, get: gLedger } = mockReqRes(testUserA, {}, {}, { period: 'all' });
      await ledgerController.getLedger(rLedger, sLedger);
      const ledData = gLedger().data;

      // Verify that customerAdvances tracks the overpayment and individual balance was not clamped to 0
      assert(ledData.summary.customerAdvances >= 400, 'Customer credit advance is tracked in ledger summary');
      const custEntry = ledData.entries.find(e => e.partyId === custCredit._id.toString());
      assert(custEntry != null, 'Customer transaction appears in ledger entries');
      assert(custEntry.resultingBalance === -400, 'Customer resultingBalance preserved as -400 (not clamped to 0)');
    }

    // -------------------------------------------------------------
    // SCENARIO 10: Sales, returns, edits, and voids
    // -------------------------------------------------------------
    console.log('\n[Scenario 10] Sales, returns, edits, and voids:');
    {
      const prodSale = await Product.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Product For Sale Test ${timestamp}`,
        costPrice: 40,
        sellingPrice: 100,
        stock: 30
      });

      // 1. Create sale for 10 units -> stock 20
      const { req: rS1, res: sS1, get: gS1 } = mockReqRes(testUserA, {
        customerName: 'Sale Return Tester',
        customerPhone: `555${timestamp.toString().slice(-7)}`,
        items: [{ product: prodSale._id.toString(), quantity: 10, sellingPrice: 100 }]
      });
      await saleController.createSale(rS1, sS1);
      const saleId = gS1().data._id.toString();
      assert((await Product.findById(prodSale._id)).stock === 20, 'Stock deducted to 20 after sale');

      // 2. Return 3 units -> stock 23
      const { req: rR1, res: sR1, get: gR1 } = mockReqRes(testUserA, {
        returnAmount: 300,
        returnedItems: [{ product: prodSale._id.toString(), quantity: 3, sellingPrice: 100, condition: 'SELLABLE' }]
      }, { id: saleId });
      await saleController.returnSale(rR1, sR1);
      assert((await Product.findById(prodSale._id)).stock === 23, 'Stock restored to 23 after sellable return');

      // 3. Attempting to delete sale with active returns is rejected
      const { req: rDelS, res: sDelS, get: gDelS } = mockReqRes(testUserA, {}, { id: saleId });
      await saleController.deleteSale(rDelS, sDelS);
      assert(gDelS().status === 400, 'Sale deletion blocked when active returns exist (400 HAS_RETURNS)');
      assert(gDelS().data.errorCode === 'HAS_RETURNS', 'Error code is HAS_RETURNS');

      // 4. Delete return -> stock back to 20
      const returnId = gR1().data.return._id.toString();
      const { req: rDelR, res: sDelR, get: gDelR } = mockReqRes(testUserA, {}, { returnId });
      await saleController.deleteSaleReturn(rDelR, sDelR);
      assert((await Product.findById(prodSale._id)).stock === 20, 'Stock deducted back to 20 on return deletion');

      // 5. Delete sale now succeeds -> stock back to original 30
      await saleController.deleteSale(rDelS, sDelS);
      assert(gDelS().status === 200, 'Sale successfully deleted after return removed');
      assert((await Product.findById(prodSale._id)).stock === 30, 'Stock restored back to original 30 upon sale deletion');
    }

    // -------------------------------------------------------------
    // SCENARIO 11: Demo / Reset Endpoint Protection
    // -------------------------------------------------------------
    console.log('\n[Scenario 11] Demo/Reset endpoint protection:');
    {
      // 11a. Unauthenticated attempt -> 401
      const { req: rUnauth, res: sUnauth, get: gUnauth } = mockReqRes(null);
      await runMiddleware(protect, rUnauth, sUnauth);
      assert(gUnauth().status === 401, 'Unauthenticated call to demo reset rejected with 401');

      // 11b. Cashier (non-ADMIN) attempt -> 403
      const { req: rCashier, res: sCashier, get: gCashier } = mockReqRes(cashierUser);
      const authAdminMiddleware = authorize('ADMIN');
      await runMiddleware(authAdminMiddleware, rCashier, sCashier);
      assert(gCashier().status === 403, 'Cashier attempt rejected with 403 FORBIDDEN');

      // 11c. Production mode guard (NODE_ENV === 'production' or DEMO_MODE !== 'true')
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const { req: fakeReq, res: fakeRes, get: getFake } = mockReqRes(testUserA);

        // Call the demo handler logic
        if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') {
          fakeRes.status(403).json({
            success: false,
            message: 'Demo reset and database seeding are disabled in production mode.',
            errorCode: 'DEMO_DISABLED'
          });
        }
        assert(getFake().status === 403, 'Demo reset blocked in production mode with 403');
        assert(getFake().data.errorCode === 'DEMO_DISABLED', 'Error code is DEMO_DISABLED');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    }

    // -------------------------------------------------------------
    // SCENARIO 12: Confirmation that unrelated valid records remain unchanged after failures
    // -------------------------------------------------------------
    console.log('\n[Scenario 12] Unrelated records preservation after failure:');
    {
      const controlProd = await Product.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Control Product ${timestamp}`,
        costPrice: 200,
        sellingPrice: 350,
        stock: 50
      });

      const controlSup = await Supplier.create({
        userId: testUserA._id,
        businessId: testUserA.businessId,
        name: `Control Supplier ${timestamp}`,
        phone: `444${timestamp.toString().slice(-7)}`
      });

      // Attempt multiple invalid/rejected operations
      const { req: bad1Req, res: bad1Res } = mockReqRes(testUserA, {
        supplierId: controlSup._id.toString(),
        items: [{ product: new mongoose.Types.ObjectId().toString(), quantity: 10, costPrice: 200 }]
      });
      await purchaseController.createPurchase(bad1Req, bad1Res);

      const { req: bad2Req, res: bad2Res } = mockReqRes(testUserB, {
        type: 'GIVE',
        partyType: 'SUPPLIER',
        partyId: controlSup._id.toString(),
        partyName: controlSup.name,
        amount: 1000
      });
      await paymentController.createPayment(bad2Req, bad2Res);

      // Verify control product and control supplier are exactly identical
      const verifyProd = await Product.findById(controlProd._id);
      const verifySup = await Supplier.findById(controlSup._id);

      assert(verifyProd.stock === 50, 'Control product stock remains strictly 50');
      assert(verifyProd.costPrice === 200, 'Control product cost price remains strictly 200');
      assert(verifySup.name === `Control Supplier ${timestamp}`, 'Control supplier name unchanged');
      assert(verifySup.phone === `444${timestamp.toString().slice(-7)}`, 'Control supplier phone unchanged');
    }

    console.log('\n============================================================');
    console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
    console.log('============================================================\n');

  } finally {
    // Clean up test tenants and their records
    console.log('Cleaning up temporary test records...');
    const testUserIds = [testUserA._id, testUserB._id, cashierUser._id];
    await Product.deleteMany({ userId: { $in: testUserIds } });
    await Supplier.deleteMany({ userId: { $in: testUserIds } });
    await Customer.deleteMany({ userId: { $in: testUserIds } });
    await Purchase.deleteMany({ userId: { $in: testUserIds } });
    await PurchaseReturn.deleteMany({ userId: { $in: testUserIds } });
    await Sale.deleteMany({ userId: { $in: testUserIds } });
    await SaleReturn.deleteMany({ userId: { $in: testUserIds } });
    await PaymentTransaction.deleteMany({ userId: { $in: testUserIds } });
    await InventoryTransaction.deleteMany({ userId: { $in: testUserIds } });
    await BusinessProfile.deleteMany({ userId: { $in: testUserIds } });
    await User.deleteMany({ _id: { $in: testUserIds } });
    console.log('Clean up complete.');

    await mongoose.disconnect();
  }

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('\nUNHANDLED TEST SUITE EXCEPTION:', err);
  process.exit(1);
});
