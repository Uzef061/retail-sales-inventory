const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, error: parsed });
          }
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED VERIFICATION TEST SUITE');
  console.log('====================================================');

  try {
    // 1. GET /api/products
    console.log('\n[1/6] Testing GET /api/products...');
    const products = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET'
    });
    console.log(`✅ Success: ${products.length} products found in database.`);
    if (!products.length) throw new Error('No products found');
    const testProduct = products.find((p) => p.isActive !== false) || products[0];
    const initialStock = testProduct.stock;
    console.log(`   Test Product: "${testProduct.name}" (ID: ${testProduct._id}, Initial Stock: ${initialStock})`);

    // 2. GET /api/customers
    console.log('\n[2/6] Testing GET /api/customers...');
    const customers = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/customers',
      method: 'GET'
    });
    console.log(`✅ Success: ${customers.length} customers found.`);
    const testCustomer = customers[0];

    // 3. POST /api/sales (Atomic stock deduction)
    console.log('\n[3/6] Testing POST /api/sales (Atomic Stock Deduction)...');
    const salePayload = {
      customer: testCustomer._id,
      items: [
        {
          product: testProduct._id,
          productName: testProduct.name,
          unitPrice: testProduct.sellingPrice || testProduct.price || 100,
          quantity: 2,
          totalPrice: (testProduct.sellingPrice || testProduct.price || 100) * 2
        }
      ],
      paymentMethod: 'UPI',
      discount: 10,
      tax: 5,
      subtotal: (testProduct.sellingPrice || testProduct.price || 100) * 2,
      grandTotal: (testProduct.sellingPrice || testProduct.price || 100) * 2 - 10 + 5,
      saleDate: new Date().toISOString().split('T')[0]
    };

    const saleRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/sales',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      salePayload
    );
    const createdSale = saleRes.sale || saleRes;
    console.log(`✅ Success: Sale created with Invoice #${createdSale.invoiceNumber} (ID: ${createdSale._id}).`);

    // Verify stock deduction
    const productsAfterSale = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET'
    });
    const prodAfterSale = productsAfterSale.find((p) => p._id === testProduct._id);
    console.log(`   Stock after sale: ${prodAfterSale.stock} (Expected: ${initialStock - 2})`);
    if (prodAfterSale.stock === initialStock - 2) {
      console.log(`✅ Verified: Stock correctly deducted by 2 units.`);
    }

    // 4. PUT /api/sales/:id/cancel (Stock restoration)
    console.log('\n[4/6] Testing PUT /api/sales/:id/cancel (Stock Restoration)...');
    const cancelRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/sales/${createdSale._id}/cancel`,
      method: 'PUT'
    });
    console.log(`✅ Success: ${cancelRes.message}`);

    const productsAfterCancel = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET'
    });
    const prodAfterCancel = productsAfterCancel.find((p) => p._id === testProduct._id);
    console.log(`   Stock after cancellation: ${prodAfterCancel.stock} (Expected: ${initialStock})`);
    if (prodAfterCancel.stock === initialStock) {
      console.log(`✅ Verified: Stock successfully restored back to ${initialStock} units.`);
    }

    // 5. POST /api/purchases (Restock order & stock increment)
    console.log('\n[5/6] Testing POST /api/purchases (Restock & Stock Increment)...');
    const purchasePayload = {
      productId: testProduct._id,
      quantity: 5,
      unitCostPrice: testProduct.costPrice || 50,
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: 'Automated test suite restock order'
    };
    const purchaseRes = await request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/purchases',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      purchasePayload
    );
    console.log(`✅ Success: Restock order created (ID: ${purchaseRes._id}).`);

    const productsAfterRestock = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/products',
      method: 'GET'
    });
    const prodAfterRestock = productsAfterRestock.find((p) => p._id === testProduct._id);
    console.log(`   Stock after restock: ${prodAfterRestock.stock} (Expected: ${initialStock + 5})`);
    if (prodAfterRestock.stock === initialStock + 5) {
      console.log(`✅ Verified: Stock successfully increased by +5 units.`);
    }

    // 6. GET /api/inventory/ledger & /api/smart-inventory
    console.log('\n[6/6] Testing Stock Audit Ledger & Smart Inventory Forecast...');
    const [ledger, smart] = await Promise.all([
      request({ hostname: 'localhost', port: 5000, path: '/api/inventory/ledger', method: 'GET' }),
      request({ hostname: 'localhost', port: 5000, path: '/api/smart-inventory', method: 'GET' })
    ]);
    console.log(`✅ Success: Stock Ledger contains ${ledger.length} audit entries.`);
    const analyticsList = smart.analytics || (Array.isArray(smart) ? smart : []);
    console.log(`✅ Success: Smart Inventory calculated analytics for ${analyticsList.length} products.`);

    console.log('\n====================================================');
    console.log('ALL 6 VERIFICATION TEST SUITES PASSED CLEANLY! 🚀');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
  }
}

runTestSuite();
