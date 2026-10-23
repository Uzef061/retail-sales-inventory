const express = require('express');
const http = require('http');
const net = require('net');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Ensure dotenv loads backend/.env before MongoDB connection code executes
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

const connectDB = require('./database/db');
const seedData = require('./database/seed');
const { ensureDemoUsers } = seedData;
const { protect, authorize, optionalProtect, validateSecurityConfig } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const saleRoutes = require('./routes/sales');
const supplierRoutes = require('./routes/suppliers');
const purchaseRoutes = require('./routes/purchases');
const inventoryLedgerRoutes = require('./routes/inventoryLedger');
const smartInventoryRoutes = require('./routes/smartInventory');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const profitLossRoutes = require('./routes/profitLoss');
const businessProfileRoutes = require('./routes/businessProfile');
const paymentRoutes = require('./routes/payments');
const reminderRoutes = require('./routes/reminders');
const noteRoutes = require('./routes/notes');
const notificationRoutes = require('./routes/notifications');
const ledgerRoutes = require('./routes/ledger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// 1. REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/inventory/ledger', inventoryLedgerRoutes);
app.use('/api/smart-inventory', smartInventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profit-loss', profitLossRoutes);
app.use('/api/business-profile', businessProfileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ledger', ledgerRoutes);

// Secure Demo Reset Endpoint
const handleDemoReset = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Demo reset and database seeding are disabled in production mode.',
        errorCode: 'DEMO_DISABLED'
      });
    }
    const result = await seedData();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error re-seeding database', error: error.message });
  }
};

app.post('/api/admin/demo/reset', protect, authorize('ADMIN'), handleDemoReset);
app.post('/api/seed', protect, authorize('ADMIN'), handleDemoReset);

// 2. Serve Built Frontend Static Files (Single Host Architecture)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// 3. Catch-all fallback route for React Router SPA routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Retail Manager API is running. Run `npm run build` in root folder to serve the full React UI.');
  }
});

// Standardized Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

const checkPortAvailable = (port) => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') resolve(false);
        else resolve(true);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '0.0.0.0');
  });
};

// Start Server only after Database connection succeeds
const startServer = async () => {
  try {
    validateSecurityConfig();
  } catch (secErr) {
    console.error(`\n===============================================================`);
    console.error(`[SECURITY ERROR] Application startup halted:`);
    console.error(secErr.message);
    console.error(`===============================================================\n`);
    process.exit(1);
  }

  const isAvailable = await checkPortAvailable(PORT);
  if (!isAvailable) {
    console.error(`\n===============================================================`);
    console.error(`[SERVER NOTICE] Port ${PORT} is already in use by an active backend process.`);
    console.error(`[SERVER NOTICE] The backend is ALREADY RUNNING and serving requests on port ${PORT}.`);
    console.error(`[SERVER NOTICE] Do NOT launch another server instance while port ${PORT} is active.`);
    console.error(`===============================================================\n`);
    process.exit(1);
  }

  await connectDB();
  await ensureDemoUsers();
  
  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n===============================================================`);
      console.error(`[SERVER NOTICE] Port ${PORT} is already in use by an active backend process.`);
      console.error(`[SERVER NOTICE] The backend is ALREADY RUNNING and serving requests on port ${PORT}.`);
      console.error(`[SERVER NOTICE] Do NOT launch another server instance while port ${PORT} is active.`);
      console.error(`===============================================================\n`);
      process.exit(1);
    } else {
      console.error('Server startup error:', err);
      process.exit(1);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Retail Manager Application listening on port ${PORT}`);
  });
};

startServer();
