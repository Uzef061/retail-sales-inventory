const connectDB = require('../backend/database/db');
const Product = require('../backend/models/Product');
const Customer = require('../backend/models/Customer');
const Sale = require('../backend/models/Sale');
const { getDashboardData } = require('../backend/controllers/dashboardController');

async function runVerification() {
  console.log('=== STARTING SALES PRICE & HISTORICAL DATA VERIFICATION ===\n');
  await connectDB();

  // 1. Fetch sample product and customer
  const product = await Product.findOne({ name: 'Organic Coffee Beans 500g' });
  const customer = await Customer.findOne();

  if (!product || !customer) {
    console.error('❌ Missing sample product or customer for test.');
    process.exit(1);
  }

  const initialProductPrice = product.sellingPrice || product.price;
  console.log(`Original Product: "${product.name}" | Default Selling Price: ₹${initialProductPrice} | Cost Price: ₹${product.costPrice} | Stock: ${product.stock}`);

  // 2. Test Sale #1: Using default product selling price (450)
  const defaultSaleData = {
    customer: customer._id,
    product: product._id,
    quantity: 1,
    sellingPrice: initialProductPrice,
    costPrice: product.costPrice,
    totalAmount: initialProductPrice * 1,
    totalCostAmount: product.costPrice * 1,
    profit: (initialProductPrice - product.costPrice) * 1,
    saleDate: new Date()
  };
  const sale1 = await Sale.create(defaultSaleData);
  console.log(`\n✅ Created Sale #1 (Default Price): ID=${sale1._id}`);
  console.log(`   Stored Selling Price: ₹${sale1.sellingPrice} | Total Amount: ₹${sale1.totalAmount} | Profit: ₹${sale1.profit}`);

  // 3. Test Sale #2: Using custom manually changed selling price (500)
  const customPrice = 500;
  const customSaleData = {
    customer: customer._id,
    product: product._id,
    quantity: 1,
    sellingPrice: customPrice,
    costPrice: product.costPrice,
    totalAmount: customPrice * 1,
    totalCostAmount: product.costPrice * 1,
    profit: (customPrice - product.costPrice) * 1,
    saleDate: new Date()
  };
  const sale2 = await Sale.create(customSaleData);
  console.log(`\n✅ Created Sale #2 (Custom Price ₹500): ID=${sale2._id}`);
  console.log(`   Stored Selling Price: ₹${sale2.sellingPrice} | Total Amount: ₹${sale2.totalAmount} | Profit: ₹${sale2.profit}`);

  // 4. Verify Product default price remains UNCHANGED in Database
  const reloadedProduct = await Product.findById(product._id);
  const reloadedPrice = reloadedProduct.sellingPrice || reloadedProduct.price;
  console.log(`\n🔍 Verifying Product Collection:`);
  console.log(`   Product Default Selling Price is now: ₹${reloadedPrice} (Expected: ₹${initialProductPrice})`);
  
  if (reloadedPrice === initialProductPrice) {
    console.log(`✅ SUCCESS: Product default price remained UNCHANGED in the database!`);
  } else {
    console.error(`❌ FAIL: Product default price changed to ₹${reloadedPrice}!`);
  }

  // 5. Verify Historical Records in Database
  const countAll = await Sale.countDocuments();
  console.log(`\n📊 Historical Demo Sales Status: Total Sales in DB = ${countAll}`);

  const { buildPeriodMatch } = require('../backend/utils/periodUtils');
  const thisWeekCount = await Sale.countDocuments(buildPeriodMatch('thisWeek'));
  const prevWeekCount = await Sale.countDocuments(buildPeriodMatch('prevWeek'));
  const days30Count = await Sale.countDocuments(buildPeriodMatch('30days'));
  const days90Count = await Sale.countDocuments(buildPeriodMatch('90days'));

  console.log(`   - This Week Sales Count: ${thisWeekCount}`);
  console.log(`   - Previous Week Sales Count: ${prevWeekCount}`);
  console.log(`   - Last 30 Days Sales Count: ${days30Count}`);
  console.log(`   - Last 90 Days Sales Count: ${days90Count}`);

  if (thisWeekCount > 0 && prevWeekCount > 0 && days30Count > 0 && days90Count > 0) {
    console.log(`✅ SUCCESS: Historical demo sales present across ALL period windows!`);
  } else {
    console.error(`❌ FAIL: Some historical periods are missing sales records.`);
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
