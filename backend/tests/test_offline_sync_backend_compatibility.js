/**
 * KAROBIZ — Backend Sync Adaptation & Stock Conflict Verification Suite
 *
 * Verifies all 15 scenarios:
 * 1. Legacy API compatibility (no clientUuid, auto-generated invoiceNumber, stock deduction).
 * 2. Online sale rejection on insufficient stock (Safeguard 1: returns 400 INSUFFICIENT_STOCK, rollback, no partial records).
 * 3. Client-supplied invoiceNumber & clientUuid persistence (201 Created).
 * 4. Idempotency & duplicate retry for sales (200 OK, same ID, zero duplicate deductions/movements/payments).
 * 5. Offline sync with partial stock -> Stock Deficit (Safeguards 2 & 3: 201 Created, fulfillmentStatus: 'STOCK_DEFICIT', reconciliationRequired: true, partial stock deduction, deficit audit log).
 * 6. Offline sync with zero stock -> Full Stock Deficit (201 Created, stock stays 0, deficit audit log).
 * 7. Deficit sale retry idempotency (200 OK, zero duplicate effects).
 * 8. Manager reconciliation blocked when restock is insufficient (400 INSUFFICIENT_STOCK_FOR_RECONCILIATION).
 * 9. Manager reconciliation: Restock and Fulfill (Safeguard 5: 200 OK, deducts deficit, fulfillmentStatus: 'FULFILLED', reconciliationRequired: false).
 * 10. Manager reconciliation: Acknowledge / Write-off (200 OK, reconciliationRequired: false, audit trail intact).
 * 11. Cancellation of deficit sale -> No phantom stock creation (only fulfilled units restored, deficit voided).
 * 12. Sales return with clientUuid & idempotent return retries.
 * 13. Purchase order creation with clientUuid & idempotent retries.
 * 14. Payment transaction creation with clientUuid & idempotent retries.
 * 15. Cross-tenant isolation with identical clientUuid (User A & User B records do not collide or leak).
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

const authMiddleware = require('../middleware/authMiddleware');
const { getJwtSecret } = authMiddleware;
const saleController = require('../controllers/saleController');
const purchaseController = require('../controllers/purchaseController');
const paymentController = require('../controllers/paymentController');
const customerController = require('../controllers/customerController');
const supplierController = require('../controllers/supplierController');

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

async function runSuite() {
  console.log('\n============================================================');
  console.log('KAROBIZ — OFFLINE SYNC BACKEND ADAPTATION VERIFICATION');
  console.log('============================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set in environment or backend/.env');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  const testSuffix = `sync_${Date.now()}`;
  const userA = await User.create({
    name: 'Store Manager A',
    username: `manager_a_${testSuffix}`,
    email: `store_a_${testSuffix}@example.com`,
    password: 'Password123!',
    role: 'ADMIN',
    businessId: new mongoose.Types.ObjectId()
  });

  const userB = await User.create({
    name: 'Store Manager B',
    username: `manager_b_${testSuffix}`,
    email: `store_b_${testSuffix}@example.com`,
    password: 'Password123!',
    role: 'ADMIN',
    businessId: new mongoose.Types.ObjectId()
  });

  try {
    // -------------------------------------------------------------
    // Scenario 1: Legacy Online Sale (Backward Compatibility)
    // -------------------------------------------------------------
    console.log('[Scenario 1] Legacy Online Sale (No clientUuid, auto-generated invoice):');
    const legacyProd = await Product.create({
      userId: userA._id,
      name: `Legacy Widget ${testSuffix}`,
      category: 'Electronics',
      costPrice: 50,
      sellingPrice: 100,
      stock: 20
    });

    const custA = await Customer.create({
      userId: userA._id,
      name: `Customer Alpha ${testSuffix}`,
      phone: `9800000001_${Date.now().toString().slice(-4)}`
    });

    const legacySaleMock = mockReqRes(userA, {
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 2, sellingPrice: 100, costPrice: 50 }
      ],
      amountReceived: 200,
      paymentMethod: 'CASH'
    });
    await saleController.createSale(legacySaleMock.req, legacySaleMock.res);
    const legacyRes = legacySaleMock.get();

    assert(legacyRes.status === 201, 'Legacy sale created with HTTP 201');
    assert(Boolean(legacyRes.data.invoiceNumber), 'Invoice number was automatically generated');
    assert(legacyRes.data.invoiceNumber.startsWith('INV-'), 'Auto-generated invoice follows INV- pattern');
    assert(legacyRes.data.fulfillmentStatus === 'FULFILLED', 'Fulfillment status is FULFILLED');
    assert(legacyRes.data.reconciliationRequired === false, 'reconciliationRequired is false');

    const updatedLegacyProd = await Product.findById(legacyProd._id);
    assert(updatedLegacyProd.stock === 18, 'Stock was deducted from 20 to 18');

    // -------------------------------------------------------------
    // Scenario 2: Online Insufficient Stock Rejection (Safeguard 1)
    // -------------------------------------------------------------
    console.log('\n[Scenario 2] Online Sale Rejection on Insufficient Stock (Safeguard 1):');
    const onlineRejectMock = mockReqRes(userA, {
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 50, sellingPrice: 100 }
      ],
      isOfflineSync: false
    });
    await saleController.createSale(onlineRejectMock.req, onlineRejectMock.res);
    const onlineRejectRes = onlineRejectMock.get();

    assert(onlineRejectRes.status === 400, 'Online sale with insufficient stock rejected with HTTP 400');
    assert(onlineRejectRes.data.errorCode === 'INSUFFICIENT_STOCK', 'Error code is INSUFFICIENT_STOCK');

    const prodAfterReject = await Product.findById(legacyProd._id);
    assert(prodAfterReject.stock === 18, 'Stock remains strictly unchanged after rejected online sale');

    // -------------------------------------------------------------
    // Scenario 3: Client-supplied invoiceNumber & clientUuid
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Client-supplied invoiceNumber & clientUuid Persistence:');
    const clientSaleUuid = `uuid-sale-${Date.now()}`;
    const clientInvoice = `INV-STORE-001-${Date.now().toString().slice(-4)}`;

    const customSaleMock = mockReqRes(userA, {
      clientUuid: clientSaleUuid,
      invoiceNumber: clientInvoice,
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 3, sellingPrice: 100, costPrice: 50 }
      ],
      amountReceived: 300,
      paymentMethod: 'CASH',
      paymentClientUuid: `uuid-pay-${clientSaleUuid}`
    });
    await saleController.createSale(customSaleMock.req, customSaleMock.res);
    const customRes = customSaleMock.get();

    assert(customRes.status === 201, 'Custom clientUuid sale created with HTTP 201');
    assert(customRes.data.clientUuid === clientSaleUuid, 'clientUuid preserved exactly');
    assert(customRes.data.invoiceNumber === clientInvoice, 'Client-supplied invoiceNumber preserved exactly');

    const prodAfterCustom = await Product.findById(legacyProd._id);
    assert(prodAfterCustom.stock === 15, 'Stock deducted from 18 to 15');

    // -------------------------------------------------------------
    // Scenario 4: Idempotency & Duplicate Retries for Sales
    // -------------------------------------------------------------
    console.log('\n[Scenario 4] Idempotency & Duplicate Retries (Zero Duplicate Deductions):');
    const retrySaleMock = mockReqRes(userA, {
      clientUuid: clientSaleUuid,
      invoiceNumber: clientInvoice,
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 3, sellingPrice: 100, costPrice: 50 }
      ]
    });
    await saleController.createSale(retrySaleMock.req, retrySaleMock.res);
    const retryRes = retrySaleMock.get();

    assert(retryRes.status === 200, 'Duplicate sale retry returned HTTP 200 (Idempotent)');
    assert(retryRes.data._id.toString() === customRes.data._id.toString(), 'Exact same sale document returned');

    const prodAfterRetry = await Product.findById(legacyProd._id);
    assert(prodAfterRetry.stock === 15, 'Stock was NOT deducted a second time on retry');

    const paymentCount = await PaymentTransaction.countDocuments({
      referenceNumber: clientInvoice,
      userId: userA._id
    });
    assert(paymentCount === 1, 'Only exactly 1 linked PaymentTransaction exists (no duplicate payment)');

    // -------------------------------------------------------------
    // Scenario 5: Offline Sync with Partial Stock Deficit (Safeguards 2 & 3)
    // -------------------------------------------------------------
    console.log('\n[Scenario 5] Offline Sync Partial Stock Deficit (Safeguards 2 & 3):');
    // Product has stock = 15. Offline device syncs a sale of 20 units.
    const offlineDeficitUuid = `uuid-deficit-${Date.now()}`;
    const offlineDeficitInvoice = `INV-OFFLINE-${Date.now().toString().slice(-4)}`;

    const deficitSaleMock = mockReqRes(userA, {
      clientUuid: offlineDeficitUuid,
      invoiceNumber: offlineDeficitInvoice,
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 20, sellingPrice: 100, costPrice: 50 }
      ],
      amountReceived: 2000,
      paymentMethod: 'CASH',
      isOfflineSync: true
    });
    await saleController.createSale(deficitSaleMock.req, deficitSaleMock.res);
    const deficitRes = deficitSaleMock.get();

    assert(deficitRes.status === 201, 'Offline sync sale accepted with HTTP 201 despite deficit');
    assert(deficitRes.data.fulfillmentStatus === 'STOCK_DEFICIT', 'Sale fulfillmentStatus is STOCK_DEFICIT');
    assert(deficitRes.data.reconciliationRequired === true, 'reconciliationRequired is true');

    const deficitItem = deficitRes.data.items[0];
    assert(deficitItem.fulfilledQuantity === 15, 'fulfilledQuantity is 15 (all available stock)');
    assert(deficitItem.deficitQuantity === 5, 'deficitQuantity is 5 (unfulfilled portion)');
    assert(deficitItem.fulfillmentStatus === 'STOCK_DEFICIT', 'Item fulfillmentStatus is STOCK_DEFICIT');

    const prodAfterDeficit = await Product.findById(legacyProd._id);
    assert(prodAfterDeficit.stock === 0, 'Product stock was reduced to exactly 0 (never negative!)');

    const deficitInvTx = await InventoryTransaction.findOne({
      referenceId: offlineDeficitInvoice,
      type: 'STOCK_DEFICIT'
    });
    assert(Boolean(deficitInvTx), 'Auditable STOCK_DEFICIT InventoryTransaction was recorded');
    assert(deficitInvTx.deficitQuantity === 5, 'Inventory movement records deficitQuantity: 5');

    // -------------------------------------------------------------
    // Scenario 6: Offline Sync with Zero Stock (Full Deficit)
    // -------------------------------------------------------------
    console.log('\n[Scenario 6] Offline Sync with Zero Stock (Full Deficit):');
    const zeroStockUuid = `uuid-zero-${Date.now()}`;
    const zeroStockInvoice = `INV-ZERO-${Date.now().toString().slice(-4)}`;

    const zeroStockMock = mockReqRes(userA, {
      clientUuid: zeroStockUuid,
      invoiceNumber: zeroStockInvoice,
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 4, sellingPrice: 100, costPrice: 50 }
      ],
      isOfflineSync: true
    });
    await saleController.createSale(zeroStockMock.req, zeroStockMock.res);
    const zeroStockRes = zeroStockMock.get();

    assert(zeroStockRes.status === 201, 'Offline sale with 0 stock accepted with HTTP 201');
    assert(zeroStockRes.data.fulfillmentStatus === 'STOCK_DEFICIT', 'Status is STOCK_DEFICIT');
    assert(zeroStockRes.data.reconciliationRequired === true, 'reconciliationRequired is true');
    assert(zeroStockRes.data.items[0].fulfilledQuantity === 0, 'fulfilledQuantity is 0');
    assert(zeroStockRes.data.items[0].deficitQuantity === 4, 'deficitQuantity is 4');

    const prodAfterZero = await Product.findById(legacyProd._id);
    assert(prodAfterZero.stock === 0, 'Product stock remains 0 (not negative)');

    // -------------------------------------------------------------
    // Scenario 7: Deficit Sale Retry Idempotency
    // -------------------------------------------------------------
    console.log('\n[Scenario 7] Deficit Sale Retry Idempotency:');
    const deficitRetryMock = mockReqRes(userA, {
      clientUuid: offlineDeficitUuid,
      isOfflineSync: true
    });
    await saleController.createSale(deficitRetryMock.req, deficitRetryMock.res);
    const deficitRetryRes = deficitRetryMock.get();

    assert(deficitRetryRes.status === 200, 'Deficit sale retry returned HTTP 200 (Idempotent)');
    assert(deficitRetryRes.data._id.toString() === deficitRes.data._id.toString(), 'Returned exact same deficit sale');

    const prodStillZero = await Product.findById(legacyProd._id);
    assert(prodStillZero.stock === 0, 'Stock remains 0 after retry');

    // -------------------------------------------------------------
    // Scenario 8: Manager Reconciliation Blocked on Insufficient Restock
    // -------------------------------------------------------------
    console.log('\n[Scenario 8] Manager Reconciliation Blocked on Insufficient Restock:');
    // Product stock is currently 0. Deficit on offlineDeficitSale is 5.
    const prematureReconcileMock = mockReqRes(userA, {
      action: 'RESTOCK_AND_FULFILL'
    }, { id: deficitRes.data._id.toString() });
    await saleController.reconcileStockDeficit(prematureReconcileMock.req, prematureReconcileMock.res);
    const prematureRes = prematureReconcileMock.get();

    assert(prematureRes.status === 400, 'Reconciliation rejected with HTTP 400 when stock is insufficient');
    assert(prematureRes.data.errorCode === 'INSUFFICIENT_STOCK_FOR_RECONCILIATION', 'Error code is INSUFFICIENT_STOCK_FOR_RECONCILIATION');

    // -------------------------------------------------------------
    // Scenario 9: Manager Reconciliation — Restock and Fulfill (Safeguard 5)
    // -------------------------------------------------------------
    console.log('\n[Scenario 9] Manager Reconciliation: Restock and Fulfill (Safeguard 5):');
    // Manager receives stock: restocks 12 units
    legacyProd.stock = 12;
    await legacyProd.save();

    const reconcileMock = mockReqRes(userA, {
      action: 'RESTOCK_AND_FULFILL',
      notes: 'New supplier shipment arrived. Physical stock verified.'
    }, { id: deficitRes.data._id.toString() });
    await saleController.reconcileStockDeficit(reconcileMock.req, reconcileMock.res);
    const reconcileRes = reconcileMock.get();

    assert(reconcileRes.status === 200, 'Reconciliation succeeded with HTTP 200');
    assert(reconcileRes.data.sale.fulfillmentStatus === 'FULFILLED', 'Sale fulfillmentStatus updated to FULFILLED');
    assert(reconcileRes.data.sale.reconciliationRequired === false, 'reconciliationRequired updated to false');
    assert(Boolean(reconcileRes.data.sale.reconciledAt), 'reconciledAt timestamp recorded');
    assert(reconcileRes.data.sale.reconciliationNotes.includes('New supplier shipment'), 'Reconciliation notes preserved');

    const reconciledItem = reconcileRes.data.sale.items[0];
    assert(reconciledItem.fulfilledQuantity === 20, 'Item fulfilledQuantity now equals total quantity 20');
    assert(reconciledItem.deficitQuantity === 0, 'Item deficitQuantity cleared to 0');
    assert(reconciledItem.fulfillmentStatus === 'FULFILLED', 'Item status updated to FULFILLED');

    const prodAfterReconcile = await Product.findById(legacyProd._id);
    assert(prodAfterReconcile.stock === 7, 'Stock deducted from 12 to 7 (5 deficit units deducted)');

    const reconInvTx = await InventoryTransaction.findOne({
      referenceId: offlineDeficitInvoice,
      type: 'DEFICIT_RECONCILED'
    });
    assert(Boolean(reconInvTx), 'DEFICIT_RECONCILED InventoryTransaction recorded');
    assert(reconInvTx.quantity === -5, 'Inventory movement shows deduction of 5 deficit units');

    // -------------------------------------------------------------
    // Scenario 10: Manager Reconciliation — Acknowledge / Write-off
    // -------------------------------------------------------------
    console.log('\n[Scenario 10] Manager Reconciliation: Acknowledge / Write-Off:');
    const ackReconcileMock = mockReqRes(userA, {
      action: 'WRITE_OFF_DEFICIT',
      notes: 'Customer accepted partial alternative goods. No physical restock required.'
    }, { id: zeroStockRes.data._id.toString() });
    await saleController.reconcileStockDeficit(ackReconcileMock.req, ackReconcileMock.res);
    const ackRes = ackReconcileMock.get();

    assert(ackRes.status === 200, 'Write-off reconciliation succeeded with HTTP 200');
    assert(ackRes.data.sale.reconciliationRequired === false, 'reconciliationRequired cleared');
    assert(ackRes.data.sale.fulfillmentStatus === 'STOCK_DEFICIT', 'fulfillmentStatus remains STOCK_DEFICIT for audit');
    assert(Boolean(ackRes.data.sale.reconciledAt), 'reconciledAt recorded');

    // -------------------------------------------------------------
    // Scenario 11: Cancellation of Deficit Sale — No Phantom Stock
    // -------------------------------------------------------------
    console.log('\n[Scenario 11] Cancellation of Deficit Sale (No Phantom Stock):');
    // Create an offline sale: stock is 5, requested 8 -> fulfilled 5, deficit 3. Stock becomes 0.
    legacyProd.stock = 5;
    await legacyProd.save();

    const cancelTestUuid = `uuid-cancel-${Date.now()}`;
    const cancelSaleMock = mockReqRes(userA, {
      clientUuid: cancelTestUuid,
      customer: custA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 8, sellingPrice: 100 }
      ],
      isOfflineSync: true
    });
    await saleController.createSale(cancelSaleMock.req, cancelSaleMock.res);
    const createdForCancel = cancelSaleMock.get().data;

    const prodBeforeCancel = await Product.findById(legacyProd._id);
    assert(prodBeforeCancel.stock === 0, 'Stock is 0 after partial fulfillment');

    // Cancel this sale
    const cancelMock = mockReqRes(userA, {
      reason: 'Customer cancelled transaction'
    }, { id: createdForCancel._id.toString() });
    await saleController.cancelSale(cancelMock.req, cancelMock.res);
    const cancelRes = cancelMock.get();

    assert(cancelRes.status === 200, 'Sale cancelled with HTTP 200');
    const prodAfterCancel = await Product.findById(legacyProd._id);
    // CRITICAL: Must restore ONLY the 5 fulfilled units, NOT 8 (which would fabricate 3 phantom units)!
    assert(prodAfterCancel.stock === 5, 'Only 5 physically fulfilled units restored (No phantom stock created)');

    // -------------------------------------------------------------
    // Scenario 12: Sales Return by clientUuid & Idempotent Retries
    // -------------------------------------------------------------
    console.log('\n[Scenario 12] Sales Return with clientUuid & Idempotency:');
    // Using customRes.data (which sold 3 units, fulfilled 3 units)
    const returnClientUuid = `uuid-return-${Date.now()}`;
    const returnMock = mockReqRes(userA, {
      clientUuid: returnClientUuid,
      returnAmount: 100,
      returnedItems: [
        { product: legacyProd._id.toString(), quantity: 1, sellingPrice: 100, isSellable: true }
      ],
      reason: 'Customer returned 1 item',
      restoreStock: true
    }, { id: customRes.data.clientUuid }); // lookup by clientUuid!
    await saleController.returnSale(returnMock.req, returnMock.res);
    const retRes = returnMock.get();

    assert(retRes.status === 200, 'Sale return processed using sale clientUuid with HTTP 200');
    assert(retRes.data.return.clientUuid === returnClientUuid, 'return clientUuid preserved');

    const prodAfterReturn = await Product.findById(legacyProd._id);
    const stockAfterFirstReturn = prodAfterReturn.stock;

    // Retry return with exact same clientUuid
    const retryReturnMock = mockReqRes(userA, {
      clientUuid: returnClientUuid
    }, { id: customRes.data.clientUuid });
    await saleController.returnSale(retryReturnMock.req, retryReturnMock.res);
    const retryRetRes = retryReturnMock.get();

    assert(retryRetRes.status === 200, 'Duplicate return retry returned HTTP 200 (Idempotent)');
    const prodAfterRetryReturn = await Product.findById(legacyProd._id);
    assert(prodAfterRetryReturn.stock === stockAfterFirstReturn, 'Stock was NOT double-restored on retry');

    // -------------------------------------------------------------
    // Scenario 13: Purchase Order with clientUuid & Idempotency
    // -------------------------------------------------------------
    console.log('\n[Scenario 13] Purchase Order with clientUuid & Idempotency:');
    const supA = await Supplier.create({
      userId: userA._id,
      name: `Supplier Alpha ${testSuffix}`,
      phone: `9811111111_${Date.now().toString().slice(-4)}`
    });

    const poClientUuid = `uuid-po-${Date.now()}`;
    const poMock = mockReqRes(userA, {
      clientUuid: poClientUuid,
      supplier: supA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 10, costPrice: 60 }
      ],
      amountPaid: 600
    });
    await purchaseController.createPurchase(poMock.req, poMock.res);
    const poRes = poMock.get();

    assert(poRes.status === 201, 'Purchase created with HTTP 201');
    assert(poRes.data.clientUuid === poClientUuid, 'PO clientUuid preserved');

    const prodAfterPO = await Product.findById(legacyProd._id);
    const stockAfterPO = prodAfterPO.stock;

    // Retry purchase with same clientUuid
    const poRetryMock = mockReqRes(userA, {
      clientUuid: poClientUuid,
      supplier: supA._id.toString(),
      items: [
        { product: legacyProd._id.toString(), quantity: 10, costPrice: 60 }
      ]
    });
    await purchaseController.createPurchase(poRetryMock.req, poRetryMock.res);
    const poRetryRes = poRetryMock.get();

    assert(poRetryRes.status === 200, 'Duplicate purchase retry returned HTTP 200');
    assert(poRetryRes.data._id.toString() === poRes.data._id.toString(), 'Exact same purchase returned');

    const prodAfterRetryPO = await Product.findById(legacyProd._id);
    assert(prodAfterRetryPO.stock === stockAfterPO, 'Stock was NOT double-incremented on retry');

    // -------------------------------------------------------------
    // Scenario 14: Payment Transaction with clientUuid & Idempotency
    // -------------------------------------------------------------
    console.log('\n[Scenario 14] Payment Transaction with clientUuid & Idempotency:');
    const payClientUuid = `uuid-payment-${Date.now()}`;
    const payMock = mockReqRes(userA, {
      clientUuid: payClientUuid,
      type: 'RECEIVE',
      partyType: 'CUSTOMER',
      partyId: custA._id.toString(),
      partyName: custA.name,
      amount: 250,
      paymentMethod: 'UPI',
      notes: 'Offline sync payment'
    });
    await paymentController.createPayment(payMock.req, payMock.res);
    const payRes = payMock.get();

    assert(payRes.status === 201, 'Payment created with HTTP 201');
    assert(payRes.data.clientUuid === payClientUuid, 'Payment clientUuid preserved');

    // Retry payment with same clientUuid
    const payRetryMock = mockReqRes(userA, {
      clientUuid: payClientUuid,
      type: 'RECEIVE',
      partyType: 'CUSTOMER',
      partyId: custA._id.toString(),
      partyName: custA.name,
      amount: 250
    });
    await paymentController.createPayment(payRetryMock.req, payRetryMock.res);
    const payRetryRes = payRetryMock.get();

    assert(payRetryRes.status === 200, 'Duplicate payment retry returned HTTP 200');
    assert(payRetryRes.data._id.toString() === payRes.data._id.toString(), 'Same payment document returned');

    const totalPayDocs = await PaymentTransaction.countDocuments({
      clientUuid: payClientUuid,
      userId: userA._id
    });
    assert(totalPayDocs === 1, 'Only exactly 1 payment record exists in database');

    // -------------------------------------------------------------
    // Scenario 15: Cross-Tenant Isolation with Identical clientUuid
    // -------------------------------------------------------------
    console.log('\n[Scenario 15] Cross-Tenant Isolation with Identical clientUuid:');
    const sharedUuid = `shared-client-uuid-${Date.now()}`;

    // User A creates customer with sharedUuid
    const custAMock = mockReqRes(userA, {
      clientUuid: sharedUuid,
      name: 'User A Customer',
      phone: `9822222221_${Date.now().toString().slice(-4)}`
    });
    await customerController.createCustomer(custAMock.req, custAMock.res);
    const custARes = custAMock.get();
    assert(custARes.status === 201, 'User A created customer with sharedUuid');

    // User B creates customer with same sharedUuid (should succeed independently!)
    const custBMock = mockReqRes(userB, {
      clientUuid: sharedUuid,
      name: 'User B Customer',
      phone: `9822222222_${Date.now().toString().slice(-4)}`
    });
    await customerController.createCustomer(custBMock.req, custBMock.res);
    const custBRes = custBMock.get();
    assert(custBRes.status === 201, 'User B created customer with identical sharedUuid without clash');

    assert(custARes.data._id.toString() !== custBRes.data._id.toString(), 'User A and User B customer IDs are distinct');
    assert(custARes.data.userId.toString() === userA._id.toString(), 'User A customer belongs to User A');
    assert(custBRes.data.userId.toString() === userB._id.toString(), 'User B customer belongs to User B');

    // Verify User A query only returns User A customer
    const queryAMock = mockReqRes(userA, {}, {}, { search: 'User A Customer' });
    await customerController.getCustomers(queryAMock.req, queryAMock.res);
    const queryARes = queryAMock.get();
    assert(queryARes.data.length === 1, 'User A only sees their own customer');
    assert(queryARes.data[0].clientUuid === sharedUuid, 'User A customer has correct clientUuid');

    // -------------------------------------------------------------
    // Scenario 16: Untrusted Client Flag Rejection (Server-Side Authorization)
    // -------------------------------------------------------------
    console.log('\n[Scenario 16] Untrusted Client Flag Rejection (Server-Side Authorization):');
    const unauthProduct = await Product.create({
      userId: userA._id,
      name: `Unauth Prod ${Date.now()}`,
      category: 'General',
      costPrice: 50,
      sellingPrice: 100,
      stock: 5,
      isActive: true
    });

    // 16.1: Untrusted client flag without clientUuid rejected
    const unauthSyncMock1 = mockReqRes(userA, {
      product: unauthProduct._id,
      quantity: 50, // exceeds available stock
      isOfflineSync: true
      // missing clientUuid
    });
    await saleController.createSale(unauthSyncMock1.req, unauthSyncMock1.res);
    const unauthSyncRes1 = unauthSyncMock1.get();
    assert(unauthSyncRes1.status === 400, 'Untrusted isOfflineSync flag without clientUuid rejected with HTTP 400');
    assert(unauthSyncRes1.data.errorCode === 'INVALID_OFFLINE_SYNC_FLAG', 'Error code is INVALID_OFFLINE_SYNC_FLAG');

    // 16.2: Untrusted client flag with invalid/short clientUuid rejected
    const unauthSyncMock2 = mockReqRes(userA, {
      product: unauthProduct._id,
      quantity: 50,
      clientUuid: 'abc', // too short (< 8 chars)
      isOfflineSync: true
    });
    await saleController.createSale(unauthSyncMock2.req, unauthSyncMock2.res);
    const unauthSyncRes2 = unauthSyncMock2.get();
    assert(unauthSyncRes2.status === 400, 'Invalid clientUuid format rejected with HTTP 400');

    // 16.3: Online sale without isOfflineSync flag rejected with INSUFFICIENT_STOCK
    const onlineSaleMock = mockReqRes(userA, {
      customerName: 'Test Online Customer',
      customerPhone: '9811111111',
      product: unauthProduct._id,
      quantity: 50
    });
    await saleController.createSale(onlineSaleMock.req, onlineSaleMock.res);
    const onlineSaleRes = onlineSaleMock.get();
    assert(onlineSaleRes.status === 400, 'Online sale with insufficient stock rejected with HTTP 400');
    assert(onlineSaleRes.data.errorCode === 'INSUFFICIENT_STOCK', 'Error code is INSUFFICIENT_STOCK');

    // -------------------------------------------------------------
    // Scenario 17: Crash Recovery & Payment Self-Healing on Retry
    // -------------------------------------------------------------
    console.log('\n[Scenario 17] Crash Recovery & Payment Self-Healing on Retry:');
    const crashRecoverySaleUuid = `sale-crash-recov-${Date.now()}`;
    const crashProduct = await Product.create({
      userId: userA._id,
      name: `Crash Recovery Item ${Date.now()}`,
      category: 'Electronics',
      costPrice: 500,
      sellingPrice: 1000,
      stock: 10,
      isActive: true
    });

    // 17.1: Create valid sale with payment
    const crashSaleMock1 = mockReqRes(userA, {
      customerName: 'Crash Recovery Customer',
      customerPhone: '9833333333',
      clientUuid: crashRecoverySaleUuid,
      product: crashProduct._id,
      quantity: 2,
      amountReceived: 2000,
      isOfflineSync: true
    });
    await saleController.createSale(crashSaleMock1.req, crashSaleMock1.res);
    const crashSaleRes1 = crashSaleMock1.get();
    assert(crashSaleRes1.status === 201, 'Initial sale created with HTTP 201');

    // Simulate crash where payment record was deleted/lost before acknowledge
    const payKey = `pay_sale_${crashRecoverySaleUuid}`;
    await PaymentTransaction.deleteOne({ idempotencyKey: payKey });
    const payCountBefore = await PaymentTransaction.countDocuments({ idempotencyKey: payKey });
    assert(payCountBefore === 0, 'Simulated crash: payment transaction absent before retry');

    // 17.2: Client retries with same clientUuid
    const crashSaleMock2 = mockReqRes(userA, {
      customerName: 'Crash Recovery Customer',
      customerPhone: '9833333333',
      clientUuid: crashRecoverySaleUuid,
      product: crashProduct._id,
      quantity: 2,
      amountReceived: 2000,
      isOfflineSync: true
    });
    await saleController.createSale(crashSaleMock2.req, crashSaleMock2.res);
    const crashSaleRes2 = crashSaleMock2.get();
    assert(crashSaleRes2.status === 200, 'Client retry returned HTTP 200 (Idempotent)');
    assert(crashSaleRes2.data._id.toString() === crashSaleRes1.data._id.toString(), 'Exact same sale returned');

    // Verify self-healing recreated the missing payment idempotently
    const payAfter = await PaymentTransaction.findOne({ idempotencyKey: payKey });
    assert(Boolean(payAfter), 'Payment transaction self-healed on retry');
    assert(payAfter.amount === 2000, 'Self-healed payment amount is correct');

    // Check stock was not double-deducted
    const refreshedCrashProd = await Product.findById(crashProduct._id);
    assert(refreshedCrashProd.stock === 8, 'Stock was not double-deducted during retry recovery');

    // -------------------------------------------------------------
    // Scenario 18: Live Database Index Health & Observability
    // -------------------------------------------------------------
    console.log('\n[Scenario 18] Live Database Index Health & Observability:');
    const { verifyDatabaseIndexes } = require('../database/indexVerification');
    const indexReport = await verifyDatabaseIndexes();
    const verifiedModels = Object.keys(indexReport).filter(m => indexReport[m].status === 'VERIFIED');
    assert(verifiedModels.length === 9, 'All 9 models have VERIFIED partial unique indexes on Atlas');
    assert(indexReport.Sale.hasPartialFilter === true, 'Sale model partialFilterExpression active');
    assert(indexReport.Product.hasPartialFilter === true, 'Product model partialFilterExpression active');
    assert(indexReport.PaymentTransaction.hasPartialFilter === true, 'PaymentTransaction partialFilterExpression active');

    // -------------------------------------------------------------
    console.log('\n============================================================');
    console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
    console.log('============================================================\n');

  } finally {
    // Cleanup temporary test records
    console.log('Cleaning up temporary test records...');
    await Promise.all([
      Sale.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      SaleReturn.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      Purchase.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      PurchaseReturn.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      PaymentTransaction.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      InventoryTransaction.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      Customer.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      Supplier.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      Product.deleteMany({ userId: { $in: [userA._id, userB._id] } }),
      User.deleteMany({ _id: { $in: [userA._id, userB._id] } })
    ]);
    console.log('Clean up complete.\n');
    await mongoose.disconnect();
  }
}

runSuite().catch((err) => {
  console.error('\nSuite encountered an unhandled exception:', err);
  process.exit(1);
});
