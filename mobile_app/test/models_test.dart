import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/models/customer.dart';
import 'package:mobile_app/models/dashboard_data.dart';
import 'package:mobile_app/models/product.dart';
import 'package:mobile_app/models/profit_loss_data.dart';
import 'package:mobile_app/models/purchase.dart';
import 'package:mobile_app/models/sale.dart';
import 'package:mobile_app/models/supplier.dart';
import 'package:mobile_app/models/user.dart';

void main() {
  group('User Model Tests', () {
    test('parses User from standard JSON', () {
      final json = {
        'id': 'u123',
        'username': 'admin',
        'name': 'Store Admin',
        'role': 'ADMIN',
      };
      final user = User.fromJson(json);
      expect(user.id, 'u123');
      expect(user.username, 'admin');
      expect(user.name, 'Store Admin');
      expect(user.role, 'ADMIN');
      expect(user.isAdmin, isTrue);
    });

    test('parses User from _id and lowercase role', () {
      final json = {
        '_id': 'u456',
        'username': 'cashier1',
        'role': 'cashier',
      };
      final user = User.fromJson(json);
      expect(user.id, 'u456');
      expect(user.isAdmin, isFalse);
    });
  });

  group('Product Model Tests', () {
    test('parses product and calculates margins and low stock correctly', () {
      final json = {
        '_id': 'p1',
        'name': 'Basmati Rice 5kg',
        'category': 'Grocery',
        'costPrice': 250,
        'sellingPrice': 350,
        'stock': 4,
        'reorderLevel': 10,
        'sku': 'RICE-05',
      };
      final prod = Product.fromJson(json);
      expect(prod.name, 'Basmati Rice 5kg');
      expect(prod.costPrice, 250.0);
      expect(prod.sellingPrice, 350.0);
      expect(prod.stock, 4);
      expect(prod.isLowStock, isTrue);
      expect(prod.isOutOfStock, isFalse);
      expect(prod.profitPerUnit, 100.0);
      expect(prod.marginPercent, closeTo(28.57, 0.1));
    });

    test('handles fallback to price when sellingPrice is absent', () {
      final json = {
        '_id': 'p2',
        'name': 'Salt 1kg',
        'category': 'Grocery',
        'price': 20,
        'stock': 0,
      };
      final prod = Product.fromJson(json);
      expect(prod.sellingPrice, 20.0);
      expect(prod.isOutOfStock, isTrue);
      expect(prod.isLowStock, isTrue);
    });
  });

  group('Customer & Supplier Models', () {
    test('parses Customer model', () {
      final json = {
        '_id': 'c1',
        'name': 'Rahul Sharma',
        'phone': '9876543210',
        'email': 'rahul@example.com',
        'address': 'Main Market, Delhi',
      };
      final cust = Customer.fromJson(json);
      expect(cust.id, 'c1');
      expect(cust.name, 'Rahul Sharma');
      expect(cust.phone, '9876543210');
    });

    test('parses Supplier model', () {
      final json = {
        '_id': 's1',
        'name': 'Himalayan Wholesale Corp',
        'phone': '9898989898',
        'email': 'supplier@himalaya.com',
        'contactPerson': 'Anand Verma',
      };
      final sup = Supplier.fromJson(json);
      expect(sup.name, 'Himalayan Wholesale Corp');
      expect(sup.contactPerson, 'Anand Verma');
    });
  });

  group('Sale & Purchase Models', () {
    test('parses multi-item Sale accurately', () {
      final json = {
        '_id': 's_001',
        'invoiceNumber': 'INV-1001',
        'customer': {'name': 'Priya Patel', 'phone': '9123456780'},
        'items': [
          {
            'product': {'name': 'Organic Coffee Beans'},
            'quantity': 2,
            'sellingPrice': 250,
            'costPrice': 150,
            'totalAmount': 500,
          },
          {
            'product': {'name': 'Green Tea Bag'},
            'quantity': 1,
            'sellingPrice': 120,
            'costPrice': 80,
            'totalAmount': 120,
          }
        ],
        'totalAmount': 620,
        'grandTotal': 620,
        'paymentMethod': 'UPI',
        'status': 'COMPLETED',
        'saleDate': '2026-10-18T10:00:00.000Z',
      };

      final sale = Sale.fromJson(json);
      expect(sale.invoiceNumber, 'INV-1001');
      expect(sale.customerName, 'Priya Patel');
      expect(sale.items.length, 2);
      expect(sale.items[0].productName, 'Organic Coffee Beans');
      expect(sale.grandTotal, 620.0);
      expect(sale.paymentMethod, 'UPI');
      expect(sale.isCancelled, isFalse);
    });

    test('parses Purchase model', () {
      final json = {
        '_id': 'pur_1',
        'supplier': {'name': 'Best Beans Co'},
        'product': {'name': 'Coffee Roast'},
        'quantity': 15,
        'costPrice': 140,
        'totalCost': 2100,
        'purchaseDate': '2026-10-18T08:00:00.000Z',
      };
      final purchase = Purchase.fromJson(json);
      expect(purchase.supplierName, 'Best Beans Co');
      expect(purchase.productName, 'Coffee Roast');
      expect(purchase.quantity, 15);
      expect(purchase.totalCost, 2100.0);
    });
  });

  group('DashboardData & ProfitLossData', () {
    test('parses DashboardData', () {
      final json = {
        'todaysSales': 4500,
        'todaysSalesCount': 6,
        'totalProducts': 24,
        'totalStock': 420,
        'lowStockCount': 2,
        'recentSales': [],
        'recentPurchases': [],
        'lowStockProducts': [],
        'insights': [
          {'type': 'BEST_SELLER', 'icon': '🏆', 'message': 'Coffee is top seller'}
        ],
      };
      final d = DashboardData.fromJson(json);
      expect(d.todaysSales, 4500.0);
      expect(d.todaysSalesCount, 6);
      expect(d.totalProducts, 24);
      expect(d.insights.first.message, 'Coffee is top seller');
    });

    test('parses ProfitLossData', () {
      final json = {
        'mode': 'month',
        'label': 'October 2026',
        'revenue': 85000,
        'cost': 55000,
        'grossProfit': 30000,
        'netProfit': 30000,
        'profitMargin': 35.29,
        'totalSalesCount': 42,
        'cancelledSalesCount': 1,
        'bestSellers': [],
      };
      final pl = ProfitLossData.fromJson(json);
      expect(pl.revenue, 85000.0);
      expect(pl.netProfit, 30000.0);
      expect(pl.profitMargin, closeTo(35.29, 0.01));
      expect(pl.totalSalesCount, 42);
    });
  });
}
