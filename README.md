# Retail Sales & Inventory Management System 🛒

A minimalistic, full-stack web application developed for **BTech Full Stack Development-II** mini project. Demonstrates core MERN concepts (MongoDB, Express, React, Node.js) with clean architecture, real-time stock updates, and a responsive warm-cream UI.

---

## 🌟 Technology Stack

- **Frontend**: React (Vite), React Router v6, Axios, Lucide React Icons, Custom CSS
- **Backend**: Node.js, Express.js, REST APIs, Mongoose
- **Database**: MongoDB (Local `mongodb://127.0.0.1:27017/retail_inventory` or in-memory fallback)

---

## 🎨 UI Design & Theme Palette

The visual design follows a warm, minimalistic, professional aesthetic suitable for an academic presentation:

- **Background**: `#FFF8F0` (Warm Cream)
- **Cards**: `#FFFCF8` (Warm White)
- **Primary**: `#C96A3D` (Terracotta)
- **Secondary**: `#D99A3D` (Warm Amber/Gold)
- **Text Main**: `#2F2925` (Dark Charcoal)
- **Text Secondary**: `#6F6259` (Soft Warm Gray)
- **Borders**: `#E8DCCF` (Beige)

---

## 📦 Core Sections & Features

1. **Dashboard**:
   - KPI Cards: Total Products, Total Stock, Today's Sales, Low Stock Count.
   - Recent Sales Table.
   - Low-Stock Products Warning Card.
   - Weekly Sales Trend Bar Chart.

2. **Products**:
   - Full CRUD: Add Product, Edit Product, Delete Product, Search by Name/Category.
   - Fields: Name, Category, Price, Stock.

3. **Inventory**:
   - Live Stock Monitor with auto-updating status badges:
     - `In Stock` (Stock > 10)
     - `Low Stock` (1 ≤ Stock ≤ 10)
     - `Out of Stock` (Stock = 0)

4. **Sales**:
   - Billing form: Customer selection, Product selection, Quantity, Auto-filled Unit Price, Calculated Total.
   - Real-time stock reduction upon sale creation.
   - Detailed Sales History table.

5. **Customers**:
   - CRUD: Add Customer, Edit Customer, Delete Customer.
   - Fields: Name, Phone, Email.
   - View Purchase History modal for any customer.

6. **Reports**:
   - Total Revenue & Order Count.
   - Top 5 Best-Selling Products.
   - Daily Sales Summary.
   - Low Stock Inventory Audit Report.

---

## 🛠️ Project Structure

```
retail-sales-inventory/
├── README.md
├── .gitignore
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── database/
│   │   ├── db.js
│   │   └── seed.js
│   ├── models/
│   │   ├── Product.js
│   │   ├── Customer.js
│   │   ├── Sale.js
│   │   └── User.js
│   ├── routes/
│   │   ├── products.js
│   │   ├── customers.js
│   │   ├── sales.js
│   │   ├── dashboard.js
│   │   └── reports.js
│   └── controllers/
│       ├── productController.js
│       ├── customerController.js
│       ├── saleController.js
│       ├── dashboardController.js
│       └── reportController.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── KPICard.jsx
        │   ├── Modal.jsx
        │   └── SalesChart.jsx
        └── pages/
            ├── Dashboard.jsx
            ├── Products.jsx
            ├── Inventory.jsx
            ├── Sales.jsx
            ├── Customers.jsx
            └── Reports.jsx
```

---

## ⚡ Quick Start Guide

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### 2. Run Backend & Frontend Servers

**Backend API Server (Port 5000):**
```bash
cd backend
npm start
```

**Frontend Vite Server (Port 3000):**
```bash
cd frontend
npm run dev
```

Open your browser at: `http://localhost:3000`

---

## 🌐 REST API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/products` | GET, POST | Get all / search products, Create product |
| `/api/products/:id` | PUT, DELETE | Update product, Delete product |
| `/api/customers` | GET, POST | Get all customers, Create customer |
| `/api/customers/:id` | PUT, DELETE | Update customer, Delete customer |
| `/api/customers/:id/sales` | GET | View purchase history of a customer |
| `/api/sales` | GET, POST | Get sales history, Submit new sale & auto-deduct stock |
| `/api/dashboard` | GET | Retrieve KPI metrics, chart data & recent sales |
| `/api/reports` | GET | Retrieve sales summary & best-sellers |
| `/api/seed` | POST | 1-Click re-seed initial demo dataset |

---

## 🎓 Viva & Demonstration Notes

1. **Automated Stock Deduction**: Submitting a sale in the Sales section validates stock sufficiency, reduces `Product.stock`, and saves `Sale` to MongoDB.
2. **Auto Database Fallback**: If MongoDB is installed locally on `27017`, it connects automatically. If not detected, an embedded `mongodb-memory-server` launches dynamically.
3. **1-Click Reset**: Click "Reset Demo Data" in the sidebar to return all products, customers, and sales to default seed state anytime.
