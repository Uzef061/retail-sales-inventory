import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/utils/currency_helper.dart';
import 'package:mobile_app/models/business_profile.dart';
import 'package:mobile_app/models/customer.dart';
import 'package:mobile_app/models/dashboard_data.dart';
import 'package:mobile_app/models/product.dart';
import 'package:mobile_app/models/profit_loss_data.dart';
import 'package:mobile_app/models/purchase.dart';
import 'package:mobile_app/models/purchase_return.dart';
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

    test('parses Supplier model with live balance & statement metrics', () {
      final json = {
        '_id': 's1',
        'name': 'Himalayan Wholesale Corp',
        'phone': '9898989898',
        'email': 'supplier@himalaya.com',
        'contactPerson': 'Anand Verma',
        'balance': 1500,
        'balanceStatus': 'OWED_TO_SUPPLIER',
        'balanceLabel': 'You owe ₹1500',
        'totalPurchases': 5000,
        'totalPayments': 3500,
        'totalReturns': 0,
      };
      final sup = Supplier.fromJson(json);
      expect(sup.name, 'Himalayan Wholesale Corp');
      expect(sup.contactPerson, 'Anand Verma');
      expect(sup.balance, 1500.0);
      expect(sup.isOwed, isTrue);
      expect(sup.isAdvance, isFalse);
      expect(sup.isSettled, isFalse);
      expect(sup.balanceLabel, 'You owe ₹1500');
      expect(sup.totalPurchases, 5000.0);
      expect(sup.totalPayments, 3500.0);
    });

    test('parses Supplier with advance balance', () {
      final json = {
        '_id': 's2',
        'name': 'Advance Vendor',
        'phone': '9991112222',
        'balance': -300,
        'balanceStatus': 'SUPPLIER_ADVANCE',
        'balanceLabel': 'Advance ₹300',
      };
      final sup = Supplier.fromJson(json);
      expect(sup.balance, -300.0);
      expect(sup.isAdvance, isTrue);
      expect(sup.isOwed, isFalse);
      expect(sup.balanceLabel, 'Advance ₹300');
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

    test('parses multi-item Purchase with payment status & returns', () {
      final json = {
        '_id': 'pur_2',
        'supplier': {'_id': 'sup_1', 'name': 'Best Beans Co'},
        'items': [
          {
            'product': {'_id': 'p1', 'name': 'Coffee Roast'},
            'quantity': 10,
            'costPrice': 100,
            'totalCost': 1000,
          },
          {
            'product': {'_id': 'p2', 'name': 'Tea Leaves'},
            'quantity': 5,
            'costPrice': 50,
            'totalCost': 250,
          }
        ],
        'subtotal': 1250,
        'grandTotal': 1250,
        'amountPaid': 500,
        'paymentStatus': 'PARTIALLY_PAID',
        'paymentMethod': 'CASH',
        'returnedAmount': 250,
        'status': 'PARTIALLY_RETURNED',
        'purchaseDate': '2026-10-18T08:00:00.000Z',
      };
      final purchase = Purchase.fromJson(json);
      expect(purchase.supplierName, 'Best Beans Co');
      expect(purchase.supplierId, 'sup_1');
      expect(purchase.items.length, 2);
      expect(purchase.quantity, 15);
      expect(purchase.totalCost, 1250.0);
      expect(purchase.amountPaid, 500.0);
      expect(purchase.isPartiallyPaid, isTrue);
      expect(purchase.unpaidBalance, 750.0);
      expect(purchase.returnedAmount, 250.0);
      expect(purchase.remainingReturnable, 1000.0);
      expect(purchase.canReturn, isTrue);
    });

    test('parses PurchaseReturn model', () {
      final json = {
        '_id': 'ret_1',
        'purchaseId': 'pur_2',
        'referenceNumber': 'PR-12345678',
        'originalReferenceNumber': 'PO-8821',
        'supplier': {'name': 'Best Beans Co'},
        'amount': 250,
        'refundMode': 'REDUCE_PAYABLE',
        'returnDate': '2026-10-18T12:00:00.000Z',
        'reason': 'Damaged items',
      };
      final pr = PurchaseReturn.fromJson(json);
      expect(pr.id, 'ret_1');
      expect(pr.purchaseId, 'pur_2');
      expect(pr.referenceNumber, 'PR-12345678');
      expect(pr.supplierName, 'Best Beans Co');
      expect(pr.amount, 250.0);
      expect(pr.refundMode, 'REDUCE_PAYABLE');
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

  group('BusinessProfile & NPR Currency Tests', () {
    test('parses BusinessProfile with NPR currency and enriched fields', () {
      final json = {
        '_id': 'bp_npr_1',
        'userId': 'u_npr_1',
        'businessName': 'Kathmandu Mart',
        'ownerName': 'Sita Thapa',
        'currency': 'NPR',
        'currencyCode': 'NPR',
        'currencySymbol': 'रू',
        'currencyName': 'Nepalese Rupee',
      };
      final profile = BusinessProfile.fromJson(json);
      expect(profile.businessName, 'Kathmandu Mart');
      expect(profile.currency, 'NPR');
      expect(profile.currencyCode, 'NPR');
      expect(profile.currencySymbol, 'रू');
      expect(profile.currencyName, 'Nepalese Rupee');

      final map = profile.toJson();
      expect(map['currency'], 'NPR');
      expect(map['currencyCode'], 'NPR');
      expect(map['currencySymbol'], 'रू');
    });

    test('CurrencyHelper correctly recognizes NPR and formats amounts with रू', () {
      // Test code
      CurrencyHelper.setCurrency('NPR', persist: false);
      expect(CurrencyHelper.code, 'NPR');
      expect(CurrencyHelper.symbol, 'रू');

      // Test symbol alias
      CurrencyHelper.setCurrency('रू', persist: false);
      expect(CurrencyHelper.code, 'NPR');
      expect(CurrencyHelper.symbol, 'रू');

      // Test exact label string: Nepalese Rupee (NPR — रू)
      CurrencyHelper.setCurrency('Nepalese Rupee (NPR — रू)', persist: false);
      expect(CurrencyHelper.code, 'NPR');
      expect(CurrencyHelper.symbol, 'रू');

      // Test formatted string contains रू
      final formatted = CurrencyHelper.format(1250);
      expect(formatted.contains('रू'), isTrue);
      expect(formatted.contains('1,250'), isTrue);
    });
  });
}
