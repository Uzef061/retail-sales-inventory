const mongoose = require('mongoose');
const seedData = require('./seed');
const Product = require('../models/Product');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/retail_inventory';

  try {
    // Attempt standard MongoDB connection with 3-second timeout
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`✅ MongoDB connected successfully at ${mongoURI}`);
  } catch (err) {
    console.log('⚠️ Local MongoDB server not detected. Starting embedded MongoDB Memory Server for instant demonstration...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const inMemoryUri = mongod.getUri();
      await mongoose.connect(inMemoryUri);
      console.log(`✅ Embedded MongoDB Memory Server started successfully at ${inMemoryUri}`);
    } catch (memErr) {
      console.error('❌ Failed to connect to MongoDB:', memErr);
      process.exit(1);
    }
  }

  // Auto-seed database if empty
  try {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('Database is empty. Populating initial dummy dataset...');
      await seedData();
    }
  } catch (seedErr) {
    console.error('Error auto-seeding database:', seedErr);
  }
};

module.exports = connectDB;
