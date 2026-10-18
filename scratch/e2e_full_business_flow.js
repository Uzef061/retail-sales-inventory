const http = require('http');

function request({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (err) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function logStep(stepNum, title) {
  console.log(`\n==================================================`);
  console.log(`STEP ${stepNum}: ${title.toUpperCase()}`);
  console.log(`==================================================`);
}

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runFullE2ETest() {
  console.log('🚀 STARTING FULL E2E BUSINESS FLOW VERIFICATION');
  console.log('Date/Time:', new Date().toISOString());

  let authToken = null;
  let testProductId = null;
  let testProductName = 'E2E Test Coffee Beans';
  let initialStock = 50;
  let testCustomerId = null;
  let createdSaleId = null;
  let createdSupplierId = null;

  try {
    // =========================================================================
    // SEQUENCE 1: Login → Product → Customer → Sale → Stock deduction → Invoice → Dashboard → Sale cancellation → Stock restoration → Reports
    // =========================================================================

    // 1. LOGIN
    logStep(1, 'Login to authentication service');
    const loginRes = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'admin', password: 'password123' }
    });
    assert(loginRes.statusCode === 200, `Login status code is 200 (Got ${loginRes.statusCode})`);
    assert(loginRes.data.token, 'JWT Token received successfully');
    assert(loginRes.data.user?.role === 'ADMIN', `User role is ADMIN (Got "${loginRes.data.user?.role}")`);
    authToken = loginRes.data.token;
    const authHeader = { Authorization: `Bearer ${authToken}` };

    // 2. PRODUCT MANAGEMENT
    logStep(2, 'Product creation & initial stock check');
    const createProdRes = await request({
      method: 'POST',
      path: '/api/products',
      headers: authHeader,
      body: {
        name: testProductName + ' ' + Date.now().toString().slice(-4),
        category: 'Beverages',
        costPrice: 150,
        sellingPrice: 250,
        stock: initialStock
      }
    });
    assert(createProdRes.statusCode === 201 || createProdRes.statusCode === 200, `Product created (Status ${createProdRes.statusCode})`);
    const createdProd = createProdRes.data;
    testProductId = createdProd._id;
    assert(testProductId, `Product ID created: ${testProductId}`);
    assert(createdProd.stock === initialStock, `Initial stock recorded as ${initialStock}`);

    // 3. CUSTOMER MANAGEMENT
    logStep(3, 'Customer creation');
    const createCustRes = await request({
      method: 'POST',
      path: '/api/customers',
      headers: authHeader,
      body: {
        name: 'E2E Test Customer Alice',
        phone: '984' + Date.now().toString().slice(-7),
        email: 'alice.test@example.com',
        address: 'Kathmandu, Nepal'
      }
    });
    assert(createCustRes.statusCode === 201 || createCustRes.statusCode === 200, `Customer created (Status ${createCustRes.statusCode})`);
    testCustomerId = createCustRes.data._id;
    assert(testCustomerId, `Customer ID created: ${testCustomerId}`);

    // 4. SALE CREATION
    logStep(4, 'Sale Creation (POS Billing with multi-item array)');
    const saleQty = 3;
    const unitPrice = 250;
    const discount = 50;
    const tax = 20;
    const subtotal = saleQty * unitPrice; // 750
    const grandTotal = subtotal - discount + tax; // 720

    const createSaleRes = await request({
      method: 'POST',
      path: '/api/sales',
      headers: authHeader,
      body: {
        customer: testCustomerId,
        items: [
          {
            product: testProductId,
            productName: createdProd.name,
            unitPrice: unitPrice,
            quantity: saleQty,
            totalPrice: subtotal
          }
        ],
        paymentMethod: 'UPI',
        discount: discount,
        tax: tax,
        subtotal: subtotal,
        grandTotal: grandTotal,
        saleDate: new Date().toISOString().split('T')[0]
      }
    });
    assert(createSaleRes.statusCode === 201 || createSaleRes.statusCode === 200, `Sale created (Status ${createSaleRes.statusCode})`);
    const saleData = createSaleRes.data.sale || createSaleRes.data;
    createdSaleId = saleData._id;
    assert(createdSaleId, `Sale ID created: ${createdSaleId}`);
    assert(saleData.status === 'COMPLETED', `Sale status is COMPLETED`);

    // 5. STOCK DEDUCTION VERIFICATION
    logStep(5, 'Stock deduction verification');
    const getProdsRes1 = await request({ method: 'GET', path: '/api/products' });
    const targetProd1 = getProdsRes1.data.find(p => p._id === testProductId);
    const expectedStockAfterSale = initialStock - saleQty; // 50 - 3 = 47
    assert(targetProd1 && targetProd1.stock === expectedStockAfterSale, `Stock correctly deducted from ${initialStock} to ${targetProd1?.stock} (Expected: ${expectedStockAfterSale})`);

    // 6. INVOICE VERIFICATION
    logStep(6, 'Invoice format verification');
    assert(saleData.invoiceNumber, `Invoice number generated: #${saleData.invoiceNumber}`);
    assert(saleData.grandTotal === grandTotal, `Grand total in invoice matches ₹${grandTotal}`);
    assert(saleData.items && saleData.items.length === 1, 'Invoice contains itemized details');

    // 7. DASHBOARD METRICS VERIFICATION
    logStep(7, 'Dashboard overview verification');
    const dashRes = await request({ method: 'GET', path: '/api/dashboard', headers: authHeader });
    assert(dashRes.statusCode === 200, `Dashboard endpoint responded (Status ${dashRes.statusCode})`);
    assert(dashRes.data.totalProducts > 0, `Dashboard shows ${dashRes.data.totalProducts} total products`);
    assert(dashRes.data.recentSales && dashRes.data.recentSales.length > 0, 'Dashboard recentSales array populated');
    assert(dashRes.data.recentSales.some(s => s._id === createdSaleId), 'New sale appears in Dashboard recent sales');

    // 8. SALE CANCELLATION
    logStep(8, 'Sale cancellation execution');
    const cancelRes = await request({
      method: 'PUT',
      path: `/api/sales/${createdSaleId}/cancel`,
      headers: authHeader
    });
    assert(cancelRes.statusCode === 200, `Sale cancellation response 200: ${cancelRes.data.message}`);

    // 9. STOCK RESTORATION VERIFICATION
    logStep(9, 'Stock restoration verification after cancellation');
    const getProdsRes2 = await request({ method: 'GET', path: '/api/products' });
    const targetProd2 = getProdsRes2.data.find(p => p._id === testProductId);
    assert(targetProd2 && targetProd2.stock === initialStock, `Stock successfully restored back to ${targetProd2?.stock} (Expected: ${initialStock})`);

    // 10. REPORTS & PROFIT/LOSS EXCLUSION VERIFICATION
    logStep(10, 'Reports & Profit/Loss statement verification');
    const reportsRes = await request({ method: 'GET', path: '/api/reports', headers: authHeader });
    const profitLossRes = await request({ method: 'GET', path: '/api/profit-loss', headers: authHeader });
    assert(reportsRes.statusCode === 200, 'Reports API loaded successfully');
    assert(profitLossRes.statusCode === 200, 'Profit & Loss API loaded successfully');
    console.log(`  Report Revenue: ₹${reportsRes.data.totalRevenue}, Net Profit: ₹${reportsRes.data.netProfit}`);
    console.log(`  Profit/Loss Margin: ${profitLossRes.data.profitMargin}%`);

    // =========================================================================
    // SEQUENCE 2: Supplier → Purchase → Stock increase → Inventory ledger → Smart Inventory
    // =========================================================================

    // 11. SUPPLIER CREATION
    logStep(11, 'Supplier management');
    const createSuppRes = await request({
      method: 'POST',
      path: '/api/suppliers',
      headers: authHeader,
      body: {
        name: 'Himalayan Coffee Traders',
        companyName: 'Himalayan Coffee Pvt Ltd',
        phone: '98510' + Date.now().toString().slice(-5),
        email: 'supplier.himalayan@example.com',
        address: 'Pokhara, Nepal',
        gstin: 'GSTIN998877'
      }
    });
    assert(createSuppRes.statusCode === 201 || createSuppRes.statusCode === 200, `Supplier created (Status ${createSuppRes.statusCode})`);
    createdSupplierId = createSuppRes.data._id;
    assert(createdSupplierId, `Supplier ID created: ${createdSupplierId}`);

    // 12. RESTOCK PURCHASE ORDER CREATION
    logStep(12, 'Purchase order / Restock entry');
    const restockQty = 15;
    const restockCost = 140;
    const createPurchaseRes = await request({
      method: 'POST',
      path: '/api/purchases',
      headers: authHeader,
      body: {
        supplier: createdSupplierId,
        product: testProductId,
        quantity: restockQty,
        costPrice: restockCost,
        purchaseDate: new Date().toISOString().split('T')[0],
        referenceNumber: `PO-TEST-${Date.now().toString().slice(-4)}`,
        notes: 'E2E test suite automated restock batch'
      }
    });
    assert(createPurchaseRes.statusCode === 201 || createPurchaseRes.statusCode === 200, `Purchase order recorded (Status ${createPurchaseRes.statusCode})`);
    const purchaseData = createPurchaseRes.data;
    assert(purchaseData._id, `Purchase ID created: ${purchaseData._id}`);

    // 13. STOCK INCREASE VERIFICATION
    logStep(13, 'Stock increase verification after restock purchase');
    const getProdsRes3 = await request({ method: 'GET', path: '/api/products' });
    const targetProd3 = getProdsRes3.data.find(p => p._id === testProductId);
    const expectedStockAfterPurchase = initialStock + restockQty; // 50 + 15 = 65
    assert(targetProd3 && targetProd3.stock === expectedStockAfterPurchase, `Stock increased to ${targetProd3?.stock} (Expected: ${expectedStockAfterPurchase})`);

    // 14. INVENTORY LEDGER AUDIT TRAIL VERIFICATION
    logStep(14, 'Inventory ledger audit log verification');
    const ledgerRes = await request({ method: 'GET', path: '/api/inventory/ledger', headers: authHeader });
    assert(ledgerRes.statusCode === 200, `Ledger endpoint responded (Status ${ledgerRes.statusCode})`);
    assert(Array.isArray(ledgerRes.data), `Ledger data is an array (Length: ${ledgerRes.data.length})`);
    const hasPurchaseLedger = ledgerRes.data.some(
      (entry) => (entry.product?._id === testProductId || entry.product === testProductId) && entry.type === 'PURCHASE'
    );
    assert(hasPurchaseLedger, 'Inventory ledger contains PURCHASE transaction entry for test product');
    const hasCancelLedger = ledgerRes.data.some(
      (entry) => (entry.product?._id === testProductId || entry.product === testProductId) && entry.type === 'SALE_CANCELLED'
    );
    assert(hasCancelLedger, 'Inventory ledger contains SALE_CANCELLED transaction entry for test product');

    // 15. SMART INVENTORY ANALYTICS VERIFICATION
    logStep(15, 'Smart Inventory analytics & forecast verification');
    const smartRes = await request({ method: 'GET', path: '/api/smart-inventory', headers: authHeader });
    assert(smartRes.statusCode === 200, `Smart inventory endpoint responded (Status ${smartRes.statusCode})`);
    assert(smartRes.data.analytics && Array.isArray(smartRes.data.analytics), 'Analytics array present in response');
    assert(smartRes.data.summary, 'Summary status count object present');
    console.log(`  Smart Inventory Summary:`, smartRes.data.summary);

    const testProdAnalytics = smartRes.data.analytics.find(
      (a) => a._id === testProductId || a.name === createdProd.name
    );
    if (testProdAnalytics) {
      console.log(`  Product Analytics for "${createdProd.name}":`, {
        stock: testProdAnalytics.stock,
        avgDailySales: testProdAnalytics.avgDailySales,
        daysRemaining: testProdAnalytics.daysRemaining,
        status: testProdAnalytics.status,
        suggestedReorderQty: testProdAnalytics.suggestedReorderQty
      });
      assert(testProdAnalytics.status, `Product status calculated: ${testProdAnalytics.status}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 15 E2E BUSINESS FLOW VERIFICATION STEPS PASSED 100%! 🎉');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ E2E TEST FAILED:', err.message);
    process.exit(1);
  }
}

runFullE2ETest();
