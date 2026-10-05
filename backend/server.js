const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./database/db');
const seedData = require('./database/seed');

const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const saleRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const profitLossRoutes = require('./routes/profitLoss');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// 1. REST API Routes
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profit-loss', profitLossRoutes);

// Simple Admin Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    res.status(200).json({ message: 'Login successful', username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Login error', error: error.message });
  }
});

// Seed / Reset Database Endpoint for Viva Demo
app.post('/api/seed', async (req, res) => {
  try {
    const result = await seedData();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error re-seeding database', error: error.message });
  }
});

// 2. Serve Built Frontend Static Files (Single Host Architecture)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// 3. Catch-all fallback route for React Router SPA routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Retail Manager API is running. Run `npm run build` in root folder to serve the full React UI.');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Retail Manager Application listening on http://localhost:${PORT}`);
});
