const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function testInventoryIntegration() {
  console.log('=== STARTING INVENTORY INTEGRATION & CONCURRENCY TEST SUITE ===');
  await mongoose.connect(process.env.MONGODB_URI);

  const User = require('../models/User');
  const Product = require('../models/Product');
  const Customer = require('../models/Customer');
  const Supplier = require('../models/Supplier');
  const Sale = require('../models/Sale');
  const SaleReturn = require('../models/SaleReturn');
  const Purchase = require('../models/Purchase');
  const InventoryTransaction = require('../models/InventoryTransaction');
  const PaymentTransaction = require('../models/PaymentTransaction');

  const saleController = require('../controllers/saleController');
  const purchaseController = require('../controllers/purchaseController');

  const mockReqRes = (user, body = {}, params = {}, query = {}) => {
    let statusCode = 200;
    let responseData = null;
    const req = { user, body, params, query };
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

  const testUser = await User.findOne() || await User.create({
    username: 'inventory_tester_' + Date.now(),
    email: `inv_tester_${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'ADMIN',
    name: 'Inventory Tester'
  });

  const createdProductIds = [];
  const createdSaleIds = [];
  const createdReturnIds = [];
  const createdPurchaseIds = [];

  try {
    // -----------------------------------------------------------------
    // TEST 1: Itemized Sale Deductions from Inventory
    // -----------------------------------------------------------------
    console.log('\n[TEST 1] Testing itemized sale deducts exact product quantity');
    const prod1 = await Product.create({
      userId: testUser._id,
      name: 'Integration Test Basmati Rice',
      category: 'Grains',
      costPrice: 60,
      sellingPrice: 100,
      stock: 20
    });
    createdProductIds.push(prod1._id);

    const salePayload1 = {
      customerName: 'Rice Buyer',
      customerPhone: '9876500001',
      items: [
        {
          product: prod1._id.toString(),
          quantity: 5,
          sellingPrice: 100,
          costPrice: 60
        }
      ],
      amountReceived: 500,
      paymentMethod: 'CASH',
      idempotencyKey: `sale_itemized_${Date.now()}`
    };

    const ctx1 = mockReqRes(testUser, salePayload1);
    await saleController.createSale(ctx1.req, ctx1.res);
    const res1 = ctx1.get();

    if (res1.status !== 201) throw new Error(`Expected 201, got ${res1.status}: ${JSON.stringify(res1.data)}`);
    createdSaleIds.push(res1.data._id);

    const refreshedProd1 = await Product.findById(prod1._id);
    if (refreshedProd1.stock !== 15) {
      throw new Error(`Expected stock 15 after selling 5 of 20, but got ${refreshedProd1.stock}`);
    }

    const invTx1 = await InventoryTransaction.findOne({
      userId: testUser._id,
      product: prod1._id,
      type: 'SALE'
    });
    if (!invTx1 || invTx1.quantity !== -5 || invTx1.previousStock !== 20 || invTx1.newStock !== 15) {
      throw new Error(`Inventory transaction mismatch: ${JSON.stringify(invTx1)}`);
    }
    console.log(`✓ Itemized sale deducted 5 units accurately: 20 -> ${refreshedProd1.stock}`);
    console.log(`✓ Inventory movement logged: ${invTx1.type} (change: ${invTx1.quantity}, stock: ${invTx1.previousStock} -> ${invTx1.newStock})`);

    // -----------------------------------------------------------------
    // TEST 2: Amount-Only Quick Sales do NOT touch Inventory
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Testing amount-only quick sales do not alter inventory');
    const initialInvTxCount = await InventoryTransaction.countDocuments({ product: prod1._id });

    const quickSalePayload = {
      customerName: 'Quick Cash Customer',
      customerPhone: '9876500002',
      amount: 750,
      paymentMethod: 'CASH',
      idempotencyKey: `sale_quick_${Date.now()}`
    };

    const ctx2 = mockReqRes(testUser, quickSalePayload);
    await saleController.createSale(ctx2.req, ctx2.res);
    const res2 = ctx2.get();

    if (res2.status !== 201) throw new Error(`Expected 201, got ${res2.status}: ${JSON.stringify(res2.data)}`);
    createdSaleIds.push(res2.data._id);

    const prod1AfterQuick = await Product.findById(prod1._id);
    if (prod1AfterQuick.stock !== 15) {
      throw new Error(`Expected stock to remain 15 for amount-only sale, but got ${prod1AfterQuick.stock}`);
    }

    const postInvTxCount = await InventoryTransaction.countDocuments({ product: prod1._id });
    if (postInvTxCount !== initialInvTxCount) {
      throw new Error(`Spurious inventory transaction was created for amount-only sale!`);
    }
    console.log(`✓ Amount-only sale created for ₹750 without touching inventory (stock remains ${prod1AfterQuick.stock})`);

    // -----------------------------------------------------------------
    // TEST 3: Purchase / Stock Replenishment
    // -----------------------------------------------------------------
    console.log('\n[TEST 3] Testing purchase order increments product stock');
    const purchasePayload = {
      product: prod1._id.toString(),
      quantity: 10,
      costPrice: 55,
      referenceNumber: `PO-TEST-${Date.now()}`,
      idempotencyKey: `po_key_${Date.now()}`
    };

    const ctx3 = mockReqRes(testUser, purchasePayload);
    await purchaseController.createPurchase(ctx3.req, ctx3.res);
    const res3 = ctx3.get();

    if (res3.status !== 201) throw new Error(`Expected 201 for purchase, got ${res3.status}: ${JSON.stringify(res3.data)}`);
    createdPurchaseIds.push(res3.data._id);

    const prod1AfterPurchase = await Product.findById(prod1._id);
    if (prod1AfterPurchase.stock !== 25) {
      throw new Error(`Expected stock 25 after restock of 10, but got ${prod1AfterPurchase.stock}`);
    }

    const purTx = await InventoryTransaction.findOne({
      userId: testUser._id,
      product: prod1._id,
      type: 'PURCHASE'
    });
    if (!purTx || purTx.quantity !== 10 || purTx.previousStock !== 15 || purTx.newStock !== 25) {
      throw new Error(`Purchase inventory transaction mismatch: ${JSON.stringify(purTx)}`);
    }
    console.log(`✓ Purchase order restocked 10 units accurately: 15 -> ${prod1AfterPurchase.stock}`);

    // -----------------------------------------------------------------
    // TEST 4: Idempotent Purchase Retry Prevention
    // -----------------------------------------------------------------
    console.log('\n[TEST 4] Testing purchase idempotency (prevent double restock)');
    const ctx4 = mockReqRes(testUser, purchasePayload);
    await purchaseController.createPurchase(ctx4.req, ctx4.res);
    const res4 = ctx4.get();

    if (res4.status !== 200) throw new Error(`Expected 200 on repeated purchase idempotency, got ${res4.status}`);
    const prod1AfterRepeat = await Product.findById(prod1._id);
    if (prod1AfterRepeat.stock !== 25) {
      throw new Error(`Stock was erroneously incremented twice! Expected 25, got ${prod1AfterRepeat.stock}`);
    }
    console.log(`✓ Idempotency verified: duplicate purchase returned existing record, stock unchanged at ${prod1AfterRepeat.stock}`);

    // -----------------------------------------------------------------
    // TEST 5: Sales Returns — Sellable vs Damaged Goods
    // -----------------------------------------------------------------
    console.log('\n[TEST 5] Testing sales returns: Sellable restocked, Damaged NOT restocked');
    // Part A: Sellable Return (2 units)
    const returnSellablePayload = {
      returnAmount: 200,
      returnedItems: [
        {
          product: prod1._id.toString(),
          quantity: 2,
          sellingPrice: 100,
          isSellable: true,
          condition: 'SELLABLE'
        }
      ],
      restoreStock: true,
      reason: 'Wrong item size ordered by customer',
      refundMode: 'REFUND_PAID',
      idempotencyKey: `ret_sellable_${Date.now()}`
    };

    const ctx5A = mockReqRes(testUser, returnSellablePayload, { id: res1.data._id });
    await saleController.returnSale(ctx5A.req, ctx5A.res);
    const res5A = ctx5A.get();

    if (res5A.status !== 200) throw new Error(`Expected 200 on return, got ${res5A.status}: ${JSON.stringify(res5A.data)}`);
    createdReturnIds.push(res5A.data.return._id);

    const prod1AfterSellableReturn = await Product.findById(prod1._id);
    if (prod1AfterSellableReturn.stock !== 27) {
      throw new Error(`Expected stock 27 after returning 2 sellable units, got ${prod1AfterSellableReturn.stock}`);
    }
    console.log(`✓ Part A (Sellable): Restocked 2 units into inventory (25 -> ${prod1AfterSellableReturn.stock})`);

    // Part B: Damaged Return (1 unit) — Must NOT increase sellable stock
    const returnDamagedPayload = {
      returnAmount: 100,
      returnedItems: [
        {
          product: prod1._id.toString(),
          quantity: 1,
          sellingPrice: 100,
          isSellable: false,
          condition: 'DAMAGED'
        }
      ],
      restoreStock: false,
      reason: 'Damaged / Defective bag opened in transit',
      refundMode: 'REFUND_PAID',
      idempotencyKey: `ret_damaged_${Date.now()}`
    };

    const ctx5B = mockReqRes(testUser, returnDamagedPayload, { id: res1.data._id });
    await saleController.returnSale(ctx5B.req, ctx5B.res);
    const res5B = ctx5B.get();

    if (res5B.status !== 200) throw new Error(`Expected 200 on damaged return, got ${res5B.status}: ${JSON.stringify(res5B.data)}`);
    createdReturnIds.push(res5B.data.return._id);

    const prod1AfterDamagedReturn = await Product.findById(prod1._id);
    if (prod1AfterDamagedReturn.stock !== 27) {
      throw new Error(`Damaged return erroneously inflated sellable stock! Expected 27, got ${prod1AfterDamagedReturn.stock}`);
    }
    console.log(`✓ Part B (Damaged): Damaged item return recorded without increasing sellable stock (stock remains ${prod1AfterDamagedReturn.stock})`);

    // -----------------------------------------------------------------
    // TEST 6: Duplicate / Idempotent Sales and Returns
    // -----------------------------------------------------------------
    console.log('\n[TEST 6] Testing duplicate request idempotency on sales and returns');
    // Sale duplicate
    const ctx6Sale = mockReqRes(testUser, salePayload1);
    await saleController.createSale(ctx6Sale.req, ctx6Sale.res);
    const res6Sale = ctx6Sale.get();
    if (res6Sale.status !== 200) throw new Error(`Expected 200 on duplicate sale idempotency`);

    const prod1AfterDupSale = await Product.findById(prod1._id);
    if (prod1AfterDupSale.stock !== 27) {
      throw new Error(`Duplicate sale deducted stock again! Expected 27, got ${prod1AfterDupSale.stock}`);
    }

    // Return duplicate
    const ctx6Return = mockReqRes(testUser, returnSellablePayload, { id: res1.data._id });
    await saleController.returnSale(ctx6Return.req, ctx6Return.res);
    const res6Return = ctx6Return.get();
    if (res6Return.status !== 200) throw new Error(`Expected 200 on duplicate return idempotency`);

    const prod1AfterDupReturn = await Product.findById(prod1._id);
    if (prod1AfterDupReturn.stock !== 27) {
      throw new Error(`Duplicate return restored stock again! Expected 27, got ${prod1AfterDupReturn.stock}`);
    }
    console.log(`✓ Idempotency verified: Neither duplicate sale nor duplicate return altered stock`);

    // -----------------------------------------------------------------
    // TEST 7: Server-Side Negative Stock Prevention
    // -----------------------------------------------------------------
    console.log('\n[TEST 7] Testing server-side negative stock prevention');
    const oversellPayload = {
      customerName: 'Big Buyer',
      customerPhone: '9876500003',
      items: [
        {
          product: prod1._id.toString(),
          quantity: 35, // Current stock is 27
          sellingPrice: 100,
          costPrice: 60
        }
      ]
    };

    const ctx7 = mockReqRes(testUser, oversellPayload);
    await saleController.createSale(ctx7.req, ctx7.res);
    const res7 = ctx7.get();

    if (res7.status !== 400 && res7.status !== 409) {
      throw new Error(`Expected 400/409 error on overselling, got ${res7.status}`);
    }

    const prod1AfterOversell = await Product.findById(prod1._id);
    if (prod1AfterOversell.stock !== 27) {
      throw new Error(`Oversell altered stock! Expected 27, got ${prod1AfterOversell.stock}`);
    }
    console.log(`✓ Server-side validation blocked overselling (requested 35 with 27 in stock). Stock remains ${prod1AfterOversell.stock}`);

    // -----------------------------------------------------------------
    // TEST 8: Multi-Device Concurrent / Offline Synchronization Conflict
    // -----------------------------------------------------------------
    console.log('\n[TEST 8] Testing concurrent multi-device sales stock conflict handling');
    const lowStockProd = await Product.create({
      userId: testUser._id,
      name: 'Limited Edition Widget',
      category: 'Electronics',
      costPrice: 200,
      sellingPrice: 500,
      stock: 5 // Only 5 in stock!
    });
    createdProductIds.push(lowStockProd._id);

    // Two devices simultaneously attempt to sell 4 units each
    const devSaleA = {
      customerName: 'Device A Customer',
      customerPhone: '9111111111',
      items: [{ product: lowStockProd._id.toString(), quantity: 4, sellingPrice: 500, costPrice: 200 }],
      idempotencyKey: `dev_a_${Date.now()}`
    };
    const devSaleB = {
      customerName: 'Device B Customer',
      customerPhone: '9222222222',
      items: [{ product: lowStockProd._id.toString(), quantity: 4, sellingPrice: 500, costPrice: 200 }],
      idempotencyKey: `dev_b_${Date.now()}`
    };

    const ctxDevA = mockReqRes(testUser, devSaleA);
    const ctxDevB = mockReqRes(testUser, devSaleB);

    // Execute concurrently
    await Promise.all([
      saleController.createSale(ctxDevA.req, ctxDevA.res),
      saleController.createSale(ctxDevB.req, ctxDevB.res)
    ]);

    const resDevA = ctxDevA.get();
    const resDevB = ctxDevB.get();

    const successCount = (resDevA.status === 201 ? 1 : 0) + (resDevB.status === 201 ? 1 : 0);
    const conflictCount = (resDevA.status === 409 || resDevA.status === 400 ? 1 : 0) +
                          (resDevB.status === 409 || resDevB.status === 400 ? 1 : 0);

    if (successCount !== 1 || conflictCount !== 1) {
      throw new Error(`Expected exactly 1 success and 1 conflict! Got successes: ${successCount}, conflicts: ${conflictCount}. Statuses: A=${resDevA.status}, B=${resDevB.status}`);
    }

    const finalLowStock = await Product.findById(lowStockProd._id);
    if (finalLowStock.stock !== 1) {
      throw new Error(`Stock corruption under concurrency! Expected stock 1 (5 - 4), got ${finalLowStock.stock}`);
    }

    const conflictRes = resDevA.status === 409 ? resDevA : resDevB;
    if (conflictRes.data.conflict !== true && conflictRes.data.errorCode !== 'INSUFFICIENT_STOCK') {
      console.log('Conflict response shape:', conflictRes.data);
    }
    console.log(`✓ Concurrency safety verified: Exactly 1 device completed sale (stock 5 -> 1)`);
    console.log(`✓ Second device received conflict flag: ${conflictRes.data.message || conflictRes.data.errorCode}`);

    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------
    console.log('\n[CLEANUP] Cleaning up test records...');
    await Product.deleteMany({ _id: { $in: createdProductIds } });
    await Sale.deleteMany({ _id: { $in: createdSaleIds } });
    await SaleReturn.deleteMany({ _id: { $in: createdReturnIds } });
    await Purchase.deleteMany({ _id: { $in: createdPurchaseIds } });
    await InventoryTransaction.deleteMany({ product: { $in: createdProductIds } });
    await PaymentTransaction.deleteMany({ userId: testUser._id, notes: { $regex: /ret_sellable|ret_damaged|Refund for return/ } });
    console.log('✓ Cleanup complete');

    console.log('\n=== ALL 8 INVENTORY INTEGRATION & CONCURRENCY TESTS PASSED ===\n');
  } catch (err) {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testInventoryIntegration();
