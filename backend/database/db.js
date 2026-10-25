const mongoose = require('mongoose');
const seedData = require('./seed');
const Product = require('../models/Product');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI ? process.env.MONGODB_URI.trim() : '';

  if (mongoURI) {
    try {
      console.log('Connecting to MongoDB Atlas using configured MONGODB_URI...');
      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 10000
      });
      console.log('Connected to MongoDB Atlas successfully.');
    } catch (err) {
      console.error('❌ Failed to connect to MongoDB Atlas:');
      console.error(err.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️ MONGODB_URI completely absent. Starting embedded MongoDB Memory Server as development fallback...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const inMemoryUri = mongod.getUri();
      await mongoose.connect(inMemoryUri);
      console.log(`✅ Embedded MongoDB Memory Server started successfully at ${inMemoryUri}`);
    } catch (memErr) {
      console.error('❌ Failed to start embedded MongoDB Memory Server:', memErr.message);
      process.exit(1);
    }
  }

  // Note: Automatic demo seeding on DB connection is disabled to prevent
  // unassigned dummy records from appearing in tenant and Google-linked accounts.
  // Demo seeding is available only via explicit /api/seed in authorized dev environments.
  console.log('Database ready.');
};

module.exports = connectDB;
