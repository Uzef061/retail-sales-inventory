const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const Purchase = require('../models/Purchase');
const PaymentTransaction = require('../models/PaymentTransaction');
const InventoryTransaction = require('../models/InventoryTransaction');

const saleController = require('../controllers/saleController');
const purchaseController = require('../controllers/purchaseController');
const customerController = require('../controllers/customerController');
const supplierController = require('../controllers/supplierController');
const productController = require('../controllers/productController');
const paymentController = require('../controllers/paymentController');

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
  console.log('--- Starting Deletion & Correction Verification Tests ---');

  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const testUser = { _id: new mongoose.Types.ObjectId(), username: 'test_admin' };
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
    // Test 1: Sale Deletion Protected Against Active Returns & Stock Restored on Delete
    // -------------------------------------------------------------
    console.log('\n[Test 1] Sale Deletion Guard Against Returns & Stock Restoration:');

    const testProd1 = await Product.create({
      userId: testUser._id,
      name: `Test Prod Del ${Date.now()}`,
      category: 'Electronics',
      costPrice: 50,
      sellingPrice: 100,
      stock: 20,
      isActive: true
    });

    const testCust1 = await Customer.create({
      userId: testUser._id,
      name: 'Test Customer Del 1',
      phone: `9999${Date.now().toString().slice(-6)}`,
      isActive: true
    });

    // 1.1 Create Sale of 5 units
    const { req: saleReq, res: saleRes, getStatus: sStat, getData: sData } = createMockReqRes(
      {
        customer: testCust1._id.toString(),
        items: [{ product: testProd1._id.toString(), quantity: 5 }],
        paymentMethod: 'CASH'
      },
      {},
      {},
      testUser
    );
    await saleController.createSale(saleReq, saleRes);
    assert(sStat() === 201, 'Sale created successfully (201)');
    const createdSale = sData();

    const pAfterSale = await Product.findById(testProd1._id);
    assert(pAfterSale.stock === 15, `Product stock deducted to 15 (was ${pAfterSale.stock})`);

    // 1.2 Process a return for 2 units
    const { req: retReq, res: retRes, getStatus: rStat, getData: rData } = createMockReqRes(
      {
        returnAmount: 200,
        returnedItems: [{ product: testProd1._id.toString(), quantity: 2, condition: 'SELLABLE', isSellable: true }],
        restoreStock: true,
        reason: 'Customer exchange'
      },
      { id: createdSale._id.toString() },
      {},
      testUser
    );
    await saleController.returnSale(retReq, retRes);
    assert(rStat() === 200, 'Sale return processed successfully');
    const createdReturn = rData().return;

    const pAfterReturn = await Product.findById(testProd1._id);
    assert(pAfterReturn.stock === 17, `Stock restored to 17 after return (was ${pAfterReturn.stock})`);

    // 1.3 Try to delete sale with active returns — MUST BE BLOCKED
    const { req: delSaleReq1, res: delSaleRes1, getStatus: dsStat1, getData: dsData1 } = createMockReqRes(
      {},
      { id: createdSale._id.toString() },
      {},
      testUser
    );
    await saleController.deleteSale(delSaleReq1, delSaleRes1);
    assert(dsStat1() === 400 && dsData1().errorCode === 'HAS_RETURNS', 'Sale deletion blocked when returns exist (400 HAS_RETURNS)');

    // 1.4 Delete the Return first
    const { req: delRetReq, res: delRetRes, getStatus: drStat } = createMockReqRes(
      {},
      { returnId: createdReturn._id.toString() },
      {},
      testUser
    );
    await saleController.deleteSaleReturn(delRetReq, delRetRes);
    assert(drStat() === 200, 'Return deleted successfully');

    const pAfterDelReturn = await Product.findById(testProd1._id);
    assert(pAfterDelReturn.stock === 15, `Stock deducted back to 15 upon return deletion (was ${pAfterDelReturn.stock})`);

    const saleAfterDelReturn = await Sale.findById(createdSale._id);
    assert(saleAfterDelReturn.returnedAmount === 0 && saleAfterDelReturn.status === 'COMPLETED', 'Sale returnedAmount reset to 0 and status back to COMPLETED');

    // 1.5 Now delete the Sale — MUST RESTORE 5 UNITS STOCK
    const { req: delSaleReq2, res: delSaleRes2, getStatus: dsStat2 } = createMockReqRes(
      {},
      { id: createdSale._id.toString() },
      {},
      testUser
    );
    await saleController.deleteSale(delSaleReq2, delSaleRes2);
    assert(dsStat2() === 200, 'Sale deleted successfully');

    const pAfterDelSale = await Product.findById(testProd1._id);
    assert(pAfterDelSale.stock === 20, `Stock restored back to original 20 upon sale deletion (was ${pAfterDelSale.stock})`);

    const saleExists = await Sale.findById(createdSale._id);
    assert(!saleExists, 'Sale document permanently deleted from database');

    // -------------------------------------------------------------
    // Test 2: Amount-Only Quick Sale Editing & Validation
    // -------------------------------------------------------------
    console.log('\n[Test 2] Amount-Only Sale Editing & Validation:');

    // 2.1 Create amount-only sale
    const { req: amtSaleReq, res: amtSaleRes, getStatus: asStat, getData: asData } = createMockReqRes(
      {
        customerName: 'Quick Customer',
        customerPhone: `8888${Date.now().toString().slice(-6)}`,
        amount: 500,
        notes: 'Initial amount quick sale'
      },
      {},
      {},
      testUser
    );
    await saleController.createSale(amtSaleReq, amtSaleRes);
    assert(asStat() === 201, 'Amount-only sale created');
    const amtSale = asData();

    // 2.2 Update amount-only sale to 750
    const { req: editSaleReq, res: editSaleRes, getStatus: esStat, getData: esData } = createMockReqRes(
      {
        amount: 750,
        notes: 'Updated quick sale note'
      },
      { id: amtSale._id.toString() },
      {},
      testUser
    );
    await saleController.updateSale(editSaleReq, editSaleRes);
    assert(esStat() === 200 && esData().sale.grandTotal === 750, `Amount-only sale successfully updated to 750 (was ${esData().sale.grandTotal})`);

    // 2.3 Process a partial return of 300
    const { req: retReq2, res: retRes2, getStatus: rStat2 } = createMockReqRes(
      {
        returnAmount: 300,
        reason: 'Refund cash'
      },
      { id: amtSale._id.toString() },
      {},
      testUser
    );
    await saleController.returnSale(retReq2, retRes2);
    assert(rStat2() === 200, 'Partial return of 300 processed on amount-only sale');

    // 2.4 Attempt to edit sale total below 300 — MUST FAIL
    const { req: editFailReq, res: editFailRes, getStatus: efStat, getData: efData } = createMockReqRes(
      {
        amount: 250
      },
      { id: amtSale._id.toString() },
      {},
      testUser
    );
    await saleController.updateSale(editFailReq, editFailRes);
    assert(efStat() === 400 && efData().errorCode === 'CANNOT_REDUCE_BELOW_RETURNED', 'Cannot edit sale amount below already returned amount (400)');

    // -------------------------------------------------------------
    // Test 3: Purchase Deletion & Stock Safety Guard
    // -------------------------------------------------------------
    console.log('\n[Test 3] Purchase Deletion & Stock Safety Guard:');

    const testProd2 = await Product.create({
      userId: testUser._id,
      name: `Test Prod Pur ${Date.now()}`,
      category: 'Hardware',
      costPrice: 100,
      sellingPrice: 150,
      stock: 10,
      isActive: true
    });

    // 3.1 Create Purchase of 15 units -> Stock becomes 25
    const { req: purReq, res: purRes, getStatus: purStat, getData: purData } = createMockReqRes(
      {
        product: testProd2._id.toString(),
        quantity: 15,
        costPrice: 90
      },
      {},
      {},
      testUser
    );
    await purchaseController.createPurchase(purReq, purRes);
    assert(purStat() === 201, 'Purchase order created for 15 units');
    const createdPur = purData();

    const pAfterPur = await Product.findById(testProd2._id);
    assert(pAfterPur.stock === 25, `Stock incremented to 25 after purchase (was ${pAfterPur.stock})`);

    // 3.2 Update Purchase quantity from 15 to 20 -> Stock becomes 30
    const { req: editPurReq, res: editPurRes, getStatus: epStat } = createMockReqRes(
      {
        quantity: 20
      },
      { id: createdPur._id.toString() },
      {},
      testUser
    );
    await purchaseController.updatePurchase(editPurReq, editPurRes);
    assert(epStat() === 200, 'Purchase quantity updated from 15 to 20');

    const pAfterEditPur = await Product.findById(testProd2._id);
    assert(pAfterEditPur.stock === 30, `Stock adjusted to 30 after purchase edit (was ${pAfterEditPur.stock})`);

    // 3.3 Sell 25 items so remaining stock becomes 5
    await Product.findByIdAndUpdate(testProd2._id, { stock: 5 });

    // 3.4 Attempt to delete purchase of 20 units when only 5 units exist — MUST BE BLOCKED
    const { req: delPurReqFail, res: delPurResFail, getStatus: dpfStat, getData: dpfData } = createMockReqRes(
      {},
      { id: createdPur._id.toString() },
      {},
      testUser
    );
    await purchaseController.deletePurchase(delPurReqFail, delPurResFail);
    assert(dpfStat() === 400 && dpfData().errorCode === 'INSUFFICIENT_STOCK_FOR_REVERSAL', 'Purchase deletion blocked when received items were already sold (400 INSUFFICIENT_STOCK_FOR_REVERSAL)');

    // 3.5 Replenish stock to 25 and delete purchase — MUST SUCCEED
    await Product.findByIdAndUpdate(testProd2._id, { stock: 25 });
    const { req: delPurReqOk, res: delPurResOk, getStatus: dpoStat } = createMockReqRes(
      {},
      { id: createdPur._id.toString() },
      {},
      testUser
    );
    await purchaseController.deletePurchase(delPurReqOk, delPurResOk);
    assert(dpoStat() === 200, 'Purchase deletion succeeded once stock was sufficient');

    const pFinalPur = await Product.findById(testProd2._id);
    assert(pFinalPur.stock === 5, `Stock reversed by 20 units (25 - 20 = 5, was ${pFinalPur.stock})`);

    const purExists = await Purchase.findById(createdPur._id);
    assert(!purExists, 'Purchase document permanently deleted');

    // -------------------------------------------------------------
    // Test 4: Soft-Delete vs Hard-Delete for Parties & Products
    // -------------------------------------------------------------
    console.log('\n[Test 4] Soft-Delete vs Hard-Delete Verification:');

    // 4.1 Clean customer without sales -> Hard delete
    const cleanCust = await Customer.create({
      userId: testUser._id,
      name: 'Clean Customer',
      phone: `7777${Date.now().toString().slice(-6)}`
    });
    const { req: dcReq1, res: dcRes1, getStatus: dcStat1, getData: dcData1 } = createMockReqRes(
      {},
      { id: cleanCust._id.toString() },
      {},
      testUser
    );
    await customerController.deleteCustomer(dcReq1, dcRes1);
    assert(dcStat1() === 200 && dcData1().isSoftDeleted === false, 'Clean customer hard-deleted');
    const custExists = await Customer.findById(cleanCust._id);
    assert(!custExists, 'Clean customer removed from database');

    // 4.2 Customer with transactions -> Soft delete (isActive = false)
    const activeCust = await Customer.create({
      userId: testUser._id,
      name: 'Active Customer with Sales',
      phone: `6666${Date.now().toString().slice(-6)}`
    });
    await Sale.create({
      userId: testUser._id,
      customer: activeCust._id,
      totalAmount: 100,
      grandTotal: 100,
      paymentMethod: 'CASH',
      status: 'COMPLETED'
    });
    const { req: dcReq2, res: dcRes2, getStatus: dcStat2, getData: dcData2 } = createMockReqRes(
      {},
      { id: activeCust._id.toString() },
      {},
      testUser
    );
    await customerController.deleteCustomer(dcReq2, dcRes2);
    assert(dcStat2() === 200 && dcData2().isSoftDeleted === true, 'Customer with sales soft-deleted (deactivated)');
    const softCust = await Customer.findById(activeCust._id);
    assert(softCust && softCust.isActive === false, 'Customer preserved with isActive: false');

    // 4.3 Clean supplier -> Hard delete
    const cleanSup = await Supplier.create({
      userId: testUser._id,
      name: 'Clean Supplier',
      email: `clean${Date.now()}@test.com`,
      phone: `5555${Date.now().toString().slice(-6)}`
    });
    const { req: dsupReq1, res: dsupRes1, getStatus: dsupStat1, getData: dsupData1 } = createMockReqRes(
      {},
      { id: cleanSup._id.toString() },
      {},
      testUser
    );
    await supplierController.deleteSupplier(dsupReq1, dsupRes1);
    assert(dsupStat1() === 200 && dsupData1().isSoftDeleted === false, 'Clean supplier hard-deleted');

    // 4.4 Supplier with purchase -> Soft delete
    const activeSup = await Supplier.create({
      userId: testUser._id,
      name: 'Active Supplier with PO',
      email: `active${Date.now()}@test.com`,
      phone: `4444${Date.now().toString().slice(-6)}`
    });
    await Purchase.create({
      userId: testUser._id,
      supplier: activeSup._id,
      product: testProd2._id,
      quantity: 1,
      costPrice: 50,
      totalCost: 50
    });
    const { req: dsupReq2, res: dsupRes2, getStatus: dsupStat2, getData: dsupData2 } = createMockReqRes(
      {},
      { id: activeSup._id.toString() },
      {},
      testUser
    );
    await supplierController.deleteSupplier(dsupReq2, dsupRes2);
    assert(dsupStat2() === 200 && dsupData2().isSoftDeleted === true, 'Supplier with purchases soft-deleted');
    const softSup = await Supplier.findById(activeSup._id);
    assert(softSup && softSup.isActive === false, 'Supplier preserved with isActive: false');

    // 4.5 Product stock edit logs ADJUSTMENT
    const prodForAdj = await Product.create({
      userId: testUser._id,
      name: `Prod Adj ${Date.now()}`,
      category: 'General',
      costPrice: 10,
      sellingPrice: 20,
      stock: 10
    });
    const { req: pEditReq, res: pEditRes, getStatus: peStat } = createMockReqRes(
      {
        name: prodForAdj.name,
        category: prodForAdj.category,
        stock: 15
      },
      { id: prodForAdj._id.toString() },
      {},
      testUser
    );
    await productController.updateProduct(pEditReq, pEditRes);
    assert(peStat() === 200, 'Product stock updated to 15');

    const adjTx = await InventoryTransaction.findOne({
      product: prodForAdj._id,
      type: 'ADJUSTMENT'
    });
    assert(adjTx && adjTx.quantity === 5 && adjTx.previousStock === 10 && adjTx.newStock === 15, 'InventoryTransaction ADJUSTMENT recorded correctly');

    // -------------------------------------------------------------
    // Test 5: Payment Transaction Deletion
    // -------------------------------------------------------------
    console.log('\n[Test 5] Payment Transaction Deletion:');
    const payment = await PaymentTransaction.create({
      userId: testUser._id,
      type: 'RECEIVE',
      partyType: 'CUSTOMER',
      partyName: 'Payment Customer',
      amount: 450,
      paymentMethod: 'CASH',
      transactionDate: new Date()
    });
    const { req: pDelReq, res: pDelRes, getStatus: pDelStat } = createMockReqRes(
      {},
      { id: payment._id.toString() },
      {},
      testUser
    );
    await paymentController.deletePayment(pDelReq, pDelRes);
    assert(pDelStat() === 200, 'Payment transaction deleted');
    const pDeleted = await PaymentTransaction.findById(payment._id);
    assert(!pDeleted, 'Payment transaction removed from database');

    console.log(`\n========================================`);
    console.log(`SUMMARY: ${passedCount} passed, ${failedCount} failed`);
    console.log(`========================================\n`);

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error in tests:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
