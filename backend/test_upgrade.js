require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const BusinessProfile = require('./models/BusinessProfile');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Sale = require('./models/Sale');
const Supplier = require('./models/Supplier');
const Purchase = require('./models/Purchase');
const PaymentTransaction = require('./models/PaymentTransaction');
const Reminder = require('./models/Reminder');
const Note = require('./models/Note');
const Notification = require('./models/Notification');

const authController = require('./controllers/authController');
const paymentController = require('./controllers/paymentController');
const reminderController = require('./controllers/reminderController');
const noteController = require('./controllers/noteController');
const notificationController = require('./controllers/notificationController');
const { getTenantQuery, hasTenantAccess } = require('./utils/tenantHelper');

const runTests = async () => {
  console.log('=== STARTING MULTI-TENANCY & BACKEND UPGRADE VERIFICATION ===');
  
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  // Connect to Atlas
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
  });
  console.log('Connected to MongoDB Atlas');

  try {
    // 1. Verify Tenant Scoping Logic for Admin
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      console.log('Creating demo admin user for test...');
      await User.create({ username: 'admin', password: 'password123', name: 'Store Admin', role: 'ADMIN' });
    }
    const admin = await User.findOne({ username: 'admin' });
    console.log('✅ Admin user confirmed:', admin.username);

    // 2. Test Google Auth Endpoint & New User Account Creation
    const testEmail = `test_owner_${Date.now()}@example.com`;
    const mockReq = {
      body: {
        idToken: `mock_test_token_google_user_${Date.now()}_${testEmail.split('@')[0]}_Ramesh Stores`
      }
    };

    let googleAuthRes = {};
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          googleAuthRes = { code, ...data };
          return googleAuthRes;
        }
      })
    };

    await authController.googleLogin(mockReq, mockRes);
    console.log('✅ Google Auth Response status:', googleAuthRes.code, '| Success:', googleAuthRes.success);
    console.log('✅ New User ID:', googleAuthRes.user?.id, '| Email:', googleAuthRes.user?.email);

    const newUser = await User.findById(googleAuthRes.user.id);
    if (!newUser) throw new Error('New user could not be found in DB!');

    // 3. Verify Account Isolation:
    // New user MUST see 0 products (clean workspace), NOT demo products!
    const newUserProductQuery = getTenantQuery({ user: newUser });
    const newUserProducts = await Product.find(newUserProductQuery);
    console.log('✅ New User Products Count (must be 0):', newUserProducts.length);
    if (newUserProducts.length !== 0) {
      throw new Error(`Isolation failed: New user sees ${newUserProducts.length} records!`);
    }

    // Admin MUST see demo products
    const adminProductQuery = getTenantQuery({ user: admin });
    const adminProducts = await Product.find(adminProductQuery);
    console.log('✅ Admin Products Count (sees demo products):', adminProducts.length);

    // 4. Test New User Adding a Product
    const newProd = await Product.create({
      userId: newUser._id,
      name: `Special Item ${Date.now()}`,
      category: 'Groceries',
      costPrice: 40,
      sellingPrice: 80,
      stock: 50
    });
    console.log('✅ New User Created Product:', newProd.name);

    // Verify New User sees their product
    const updatedNewUserProducts = await Product.find(newUserProductQuery);
    console.log('✅ New User Products Count Now (must be 1):', updatedNewUserProducts.length);
    if (updatedNewUserProducts.length !== 1) {
      throw new Error(`Expected 1 product for new user, got ${updatedNewUserProducts.length}`);
    }

    // 5. Test Customer & Sale Creation for New User
    const customer = await Customer.create({
      userId: newUser._id,
      name: 'Mohan Kumar',
      phone: '9876543210',
      email: 'mohan@example.com'
    });

    const sale = await Sale.create({
      userId: newUser._id,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      customer: customer._id,
      product: newProd._id,
      quantity: 2,
      sellingPrice: 80,
      costPrice: 40,
      totalAmount: 160,
      totalCostAmount: 80,
      profit: 80,
      grandTotal: 160,
      status: 'COMPLETED'
    });
    console.log('✅ Created Sale for New User. Invoice:', sale.invoiceNumber, '| Profit:', sale.profit);

    // 6. Test Receive & Give Payment Transactions
    const receivePayment = await PaymentTransaction.create({
      userId: newUser._id,
      type: 'RECEIVE',
      partyType: 'CUSTOMER',
      partyId: customer._id,
      partyName: customer.name,
      amount: 100,
      paymentMethod: 'UPI',
      notes: 'Partial payment received'
    });
    console.log('✅ Created RECEIVE payment:', receivePayment.amount, 'from', receivePayment.partyName);

    const supplier = await Supplier.create({
      userId: newUser._id,
      name: 'Tea Wholesale Agency',
      phone: '9811122233',
      email: 'agency@tea.com'
    });

    const givePayment = await PaymentTransaction.create({
      userId: newUser._id,
      type: 'GIVE',
      partyType: 'SUPPLIER',
      partyId: supplier._id,
      partyName: supplier.name,
      amount: 40,
      paymentMethod: 'CASH',
      notes: 'Advance tea stock payment'
    });
    console.log('✅ Created GIVE payment:', givePayment.amount, 'to', givePayment.partyName);

    // Verify Payment Summary
    let paymentSummaryRes = {};
    await paymentController.getPaymentsSummary({ user: newUser, query: {} }, {
      status: (code) => ({
        json: (data) => {
          paymentSummaryRes = data;
          return data;
        }
      })
    });
    console.log('✅ Payment Summary: Total Received:', paymentSummaryRes.totalReceived, '| Total Given:', paymentSummaryRes.totalGiven, '| Net Cash Flow:', paymentSummaryRes.netCashFlow);
    if (paymentSummaryRes.totalReceived !== 100 || paymentSummaryRes.totalGiven !== 40 || paymentSummaryRes.netCashFlow !== 60) {
      throw new Error('Payment summary calculation mismatch!');
    }

    // 7. Test Reminders CRUD & Completion
    const reminder = await Reminder.create({
      userId: newUser._id,
      title: 'Collect balance ₹60 from Mohan',
      dueDate: new Date(Date.now() + 86400000), // tomorrow
      priority: 'HIGH',
      partyName: customer.name
    });
    console.log('✅ Created Reminder:', reminder.title);

    // Toggle reminder
    let toggleRes = {};
    await reminderController.toggleReminder({ user: newUser, params: { id: reminder._id } }, {
      status: (code) => ({
        json: (data) => {
          toggleRes = data;
          return data;
        }
      })
    });
    console.log('✅ Toggled Reminder isCompleted:', toggleRes.isCompleted);
    if (!toggleRes.isCompleted) {
      throw new Error('Reminder toggle failed!');
    }

    // 8. Test Notes CRUD
    const note = await Note.create({
      userId: newUser._id,
      title: 'Supplier terms',
      content: 'Chai wholesale gives 5% discount on orders > 50 units.'
    });
    console.log('✅ Created Note:', note.title);

    // 9. Test In-App Notification Center
    let notifRes = {};
    await notificationController.getNotifications({ user: newUser }, {
      status: (code) => ({
        json: (data) => {
          notifRes = data;
          return data;
        }
      })
    });
    console.log('✅ Notifications fetched for user. Success:', notifRes.success);

    // Clean up created test entities for test user
    await Product.deleteMany({ userId: newUser._id });
    await Customer.deleteMany({ userId: newUser._id });
    await Sale.deleteMany({ userId: newUser._id });
    await Supplier.deleteMany({ userId: newUser._id });
    await PaymentTransaction.deleteMany({ userId: newUser._id });
    await Reminder.deleteMany({ userId: newUser._id });
    await Note.deleteMany({ userId: newUser._id });
    await Notification.deleteMany({ userId: newUser._id });
    await BusinessProfile.deleteMany({ userId: newUser._id });
    await User.findByIdAndDelete(newUser._id);
    console.log('✅ Cleaned up temporary test data.');

    console.log('\n======================================================');
    console.log('🎉 ALL BACKEND MULTI-TENANCY & FEATURE TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
  }
};

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
