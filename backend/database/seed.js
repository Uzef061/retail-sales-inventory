const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const User = require('../models/User');

const seedData = async () => {
  try {
    // Clear existing data
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Sale.deleteMany({});
    await User.deleteMany({});

    console.log('Cleared existing database entries.');

    // 1. Create Admin User
    await User.create({
      username: 'admin',
      password: 'password123'
    });
    console.log('Created admin user (admin / password123)');

    // 2. Create 10 Products with realistic Cost Price & Selling Price
    const sampleProducts = [
      { name: 'Organic Coffee Beans 500g', category: 'Beverages', costPrice: 300, sellingPrice: 450, price: 450, stock: 25 },
      { name: 'Green Tea Bags Box (50s)', category: 'Beverages', costPrice: 180, sellingPrice: 280, price: 280, stock: 15 },
      { name: 'Dark Chocolate Bar 70%', category: 'Snacks', costPrice: 90, sellingPrice: 150, price: 150, stock: 40 },
      { name: 'Oat Milk 1 Litre', category: 'Dairy Alternatives', costPrice: 150, sellingPrice: 220, price: 220, stock: 8 }, // Low Stock
      { name: 'Stainless Steel Water Bottle 750ml', category: 'Accessories', costPrice: 420, sellingPrice: 650, price: 650, stock: 12 },
      { name: 'Ceramic Coffee Mug 350ml', category: 'Accessories', costPrice: 180, sellingPrice: 300, price: 300, stock: 5 }, // Low Stock
      { name: 'Eco Canvas Tote Bag', category: 'Accessories', costPrice: 140, sellingPrice: 250, price: 250, stock: 30 },
      { name: 'Raw Artisanal Honey 500g', category: 'Pantry', costPrice: 380, sellingPrice: 550, price: 550, stock: 4 }, // Low Stock
      { name: 'Extra Virgin Olive Oil 500ml', category: 'Pantry', costPrice: 520, sellingPrice: 780, price: 780, stock: 18 },
      { name: 'Almond Crunch Granola 400g', category: 'Snacks', costPrice: 260, sellingPrice: 380, price: 380, stock: 0 }  // Out of Stock
    ];

    const insertedProducts = await Product.insertMany(sampleProducts);
    console.log(`Inserted ${insertedProducts.length} products with cost & selling prices.`);

    // 3. Create 5 Customers
    const sampleCustomers = [
      { name: 'Rahul Sharma', phone: '+91 9876543210', email: 'rahul.sharma@example.com' },
      { name: 'Priya Patel', phone: '+91 9812345678', email: 'priya.patel@example.com' },
      { name: 'Ananya Sen', phone: '+91 9765432109', email: 'ananya.sen@example.com' },
      { name: 'Vikram Malhotra', phone: '+91 9654321098', email: 'vikram.m@example.com' },
      { name: 'Sneha Gupta', phone: '+91 9543210987', email: 'sneha.gupta@example.com' }
    ];

    const insertedCustomers = await Customer.insertMany(sampleCustomers);
    console.log(`Inserted ${insertedCustomers.length} customers.`);

    // 4. Create ~8-10 Sales with snapshot financial metrics
    const now = new Date();
    const daysAgo = (days) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d;
    };

    const makeSaleData = (custIdx, prodIdx, qty, daysBack) => {
      const p = insertedProducts[prodIdx];
      const sp = p.sellingPrice;
      const cp = p.costPrice;
      const totalAmount = sp * qty;
      const totalCostAmount = cp * qty;
      const profit = totalAmount - totalCostAmount;
      return {
        customer: insertedCustomers[custIdx]._id,
        product: p._id,
        quantity: qty,
        sellingPrice: sp,
        costPrice: cp,
        totalAmount,
        totalCostAmount,
        profit,
        saleDate: daysAgo(daysBack)
      };
    };

    const sampleSales = [
      makeSaleData(0, 0, 2, 5), // Rahul buys Coffee x2 (Rev: 900, Cost: 600, Profit: 300)
      makeSaleData(1, 4, 1, 4), // Priya buys Bottle x1 (Rev: 650, Cost: 420, Profit: 230)
      makeSaleData(2, 2, 4, 3), // Ananya buys Choco x4 (Rev: 600, Cost: 360, Profit: 240)
      makeSaleData(3, 8, 1, 2), // Vikram buys Olive Oil x1 (Rev: 780, Cost: 520, Profit: 260)
      makeSaleData(4, 1, 2, 1), // Sneha buys Green Tea x2 (Rev: 560, Cost: 360, Profit: 200)
      makeSaleData(0, 6, 3, 1), // Rahul buys Tote Bag x3 (Rev: 750, Cost: 420, Profit: 330)
      makeSaleData(1, 3, 2, 0), // Priya buys Oat Milk x2 (Rev: 440, Cost: 300, Profit: 140)
      makeSaleData(2, 0, 1, 0)  // Ananya buys Coffee x1 (Rev: 450, Cost: 300, Profit: 150)
    ];

    const insertedSales = await Sale.insertMany(sampleSales);
    console.log(`Inserted ${insertedSales.length} sample sales with profit snapshot data.`);

    return {
      message: 'Database seeded successfully',
      productsCount: insertedProducts.length,
      customersCount: insertedCustomers.length,
      salesCount: insertedSales.length
    };
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

module.exports = seedData;
