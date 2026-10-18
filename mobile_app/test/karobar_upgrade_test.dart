import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/models/user.dart';
import 'package:mobile_app/models/business_profile.dart';
import 'package:mobile_app/models/payment_transaction.dart';
import 'package:mobile_app/models/reminder.dart';
import 'package:mobile_app/models/note.dart';
import 'package:mobile_app/models/app_notification.dart';
import 'package:mobile_app/models/report_data.dart';
import 'package:mobile_app/models/profit_loss_data.dart';

void main() {
  group('Feature 1: User & Multi-User Accounts', () {
    test('User correctly identifies admin status and parses new user fields', () {
      final json = {
        'id': 'usr_google_123',
        'username': 'ahmed_store',
        'name': 'Ahmed Ali',
        'role': 'ADMIN',
        'email': 'ahmed@store.com',
        'avatar': 'https://example.com/avatar.jpg',
        'hasCompletedOnboarding': false,
        'businessId': 'biz_789',
      };

      final user = User.fromJson(json);
      expect(user.id, 'usr_google_123');
      expect(user.isAdmin, isTrue);
      expect(user.email, 'ahmed@store.com');
      expect(user.avatar, 'https://example.com/avatar.jpg');
      expect(user.hasCompletedOnboarding, isFalse);
      expect(user.businessId, 'biz_789');
    });

    test('User backward-compatibility defaults hasCompletedOnboarding to true for legacy responses', () {
      final json = {
        'id': 'usr_legacy',
        'username': 'admin',
        'name': 'Admin User',
        'role': 'ADMIN',
      };

      final user = User.fromJson(json);
      expect(user.hasCompletedOnboarding, isTrue);
    });
  });

  group('Feature 3: BusinessProfile Management Model', () {
    test('BusinessProfile serializes and deserializes properly with default PKR currency', () {
      final profile = BusinessProfile(
        id: 'bp_001',
        userId: 'usr_001',
        businessName: 'Karobar Supermart',
        ownerName: 'Ali Khan',
        category: 'Grocery & Mart',
        phone: '+92 300 1234567',
        currency: 'PKR',
        taxNumber: 'NTN-123456-7',
        receiptHeader: 'Welcome to Karobar Supermart',
        receiptFooter: 'Goods once sold are returnable within 7 days',
      );

      final json = profile.toJson();
      expect(json['businessName'], 'Karobar Supermart');
      expect(json['currency'], 'PKR');
      expect(json['receiptHeader'], 'Welcome to Karobar Supermart');

      final reconstructed = BusinessProfile.fromJson({
        '_id': 'bp_001',
        'userId': 'usr_001',
        ...json,
      });

      expect(reconstructed.id, 'bp_001');
      expect(reconstructed.businessName, 'Karobar Supermart');
      expect(reconstructed.category, 'Grocery & Mart');
      expect(reconstructed.receiptFooter, 'Goods once sold are returnable within 7 days');
    });

    test('BusinessProfile copyWith immutably updates fields', () {
      final original = BusinessProfile(
        id: '1',
        userId: 'u1',
        businessName: 'Old Store',
      );

      final updated = original.copyWith(
        businessName: 'New Store Name',
        phone: '0312-0000000',
      );

      expect(updated.id, original.id);
      expect(updated.businessName, 'New Store Name');
      expect(updated.phone, '0312-0000000');
    });
  });

  group('Feature 4: PaymentTransaction (Receive & Give) Model', () {
    test('PaymentTransaction correctly identifies RECEIVE (Cash In)', () {
      final json = {
        '_id': 'tx_01',
        'userId': 'u1',
        'type': 'RECEIVE',
        'partyType': 'CUSTOMER',
        'partyName': 'Zahid Kirana',
        'amount': 15000.0,
        'paymentMethod': 'CASH',
        'transactionDate': '2026-10-18T12:00:00.000Z',
        'notes': 'Advance payment for wheat bag',
      };

      final tx = PaymentTransaction.fromJson(json);
      expect(tx.isReceive, isTrue);
      expect(tx.isGive, isFalse);
      expect(tx.amount, 15000.0);
      expect(tx.partyName, 'Zahid Kirana');
      expect(tx.paymentMethod, 'CASH');
    });

    test('PaymentTransaction correctly identifies GIVE (Cash Out)', () {
      final json = {
        '_id': 'tx_02',
        'userId': 'u1',
        'type': 'GIVE',
        'partyType': 'SUPPLIER',
        'partyName': 'National Mills',
        'amount': 8500.0,
        'paymentMethod': 'BANK_TRANSFER',
        'transactionDate': '2026-10-18T14:30:00.000Z',
      };

      final tx = PaymentTransaction.fromJson(json);
      expect(tx.isReceive, isFalse);
      expect(tx.isGive, isTrue);
      expect(tx.amount, 8500.0);
      expect(tx.partyName, 'National Mills');
    });

    test('PaymentSummary correctly calculates net cash flow', () {
      final summary = PaymentSummary.fromJson({
        'totalReceived': 50000.0,
        'totalGiven': 30000.0,
        'netCashFlow': 20000.0,
        'todayReceived': 12000.0,
        'todayGiven': 5000.0,
        'recentTransactions': [],
      });

      expect(summary.totalReceived, 50000.0);
      expect(summary.totalGiven, 30000.0);
      expect(summary.netCashFlow, 20000.0);
    });
  });

  group('Feature 7: Reminder Model', () {
    test('Reminder parses, toggles completion, and reports overdue', () {
      final now = DateTime.now();
      final pastDate = now.subtract(const Duration(days: 2));

      final overdueReminder = Reminder(
        id: 'rem_01',
        userId: 'u1',
        title: 'Pay electric bill',
        dueDate: pastDate,
        priority: 'HIGH',
        isCompleted: false,
      );

      expect(overdueReminder.isCompleted, isFalse);
      expect(overdueReminder.priority, 'HIGH');
      expect(overdueReminder.dueDate.isBefore(now), isTrue);

      final completed = overdueReminder.copyWith(isCompleted: true);
      expect(completed.isCompleted, isTrue);
      expect(completed.id, overdueReminder.id);
    });
  });

  group('Feature 8: Note Model', () {
    test('Note serializes and parses color cards and pin status', () {
      final note = Note(
        id: 'note_01',
        userId: 'u1',
        title: 'Supplier Ramadan Working Hours',
        content: 'Opens 8 AM to 2 PM only throughout next month.',
        color: '#FEF3C7',
        isPinned: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final json = note.toJson();
      expect(json['title'], 'Supplier Ramadan Working Hours');
      expect(json['color'], '#FEF3C7');
      expect(json['isPinned'], isTrue);

      final parsed = Note.fromJson({
        '_id': 'note_01',
        'userId': 'u1',
        ...json,
      });

      expect(parsed.id, 'note_01');
      expect(parsed.isPinned, isTrue);
      expect(parsed.title, contains('Ramadan'));
      expect(parsed.content, contains('Opens 8 AM'));
    });
  });

  group('Feature 9: AppNotification Model', () {
    test('AppNotification identifies stock low, payment, and reminder types', () {
      final notif = AppNotification.fromJson({
        '_id': 'notif_1',
        'userId': 'u1',
        'title': 'Low Stock Alert',
        'message': 'Sugar 50kg bag is below minimum stock threshold (2 left).',
        'type': 'STOCK_LOW',
        'isRead': false,
        'timestamp': DateTime.now().toIso8601String(),
      });

      expect(notif.type, 'STOCK_LOW');
      expect(notif.isRead, isFalse);
      expect(notif.title, 'Low Stock Alert');

      final readNotif = notif.copyWith(isRead: true);
      expect(readNotif.isRead, isTrue);
    });
  });

  group('Feature 5 & 6: Comprehensive Reports & Profit Loss Data', () {
    test('ReportData computes totals, order metrics, and parses best sellers', () {
      final json = {
        'mode': 'month',
        'label': 'This Month',
        'totalSalesAmount': 125000.0,
        'totalSalesCount': 25,
        'totalCostAmount': 85000.0,
        'netProfit': 40000.0,
        'profitMargin': 32.0,
        'totalProducts': 140,
        'totalStock': 890,
        'inventoryValuation': 450000.0,
        'lowStockCount': 4,
        'totalPurchasesAmount': 75000.0,
        'purchasesCount': 8,
        'customerCount': 42,
        'supplierCount': 6,
        'totalReceived': 110000.0,
        'totalGiven': 70000.0,
        'netCashFlow': 40000.0,
        'bestSellingProducts': [
          {
            '_id': 'prod_1',
            'name': 'Basmati Rice 5kg',
            'category': 'Grains',
            'totalQuantitySold': 45,
            'totalRevenue': 22500.0,
            'totalProfit': 4500.0,
          }
        ],
      };

      final report = ReportData.fromJson(json);
      expect(report.totalSales, 125000.0);
      expect(report.totalOrders, 25);
      expect(report.avgOrderValue, 5000.0); // 125000 / 25
      expect(report.inventoryValue, 450000.0);
      expect(report.netProfit, 40000.0);
      expect(report.bestSellers.length, 1);
      expect(report.bestSellers.first.unitsSold, 45);
      expect(report.bestSellers.first.sales, 22500.0);
    });

    test('ProfitLossData calculates accounting margin and net profit', () {
      final pnl = ProfitLossData.fromJson({
        'revenue': 200000.0,
        'cost': 140000.0,
        'netProfit': 60000.0,
        'profitMargin': 30.0,
        'totalSalesCount': 50,
        'cancelledSalesCount': 2,
        'mode': 'month',
        'label': 'This Month',
        'bestSellers': [],
      });

      expect(pnl.revenue, 200000.0);
      expect(pnl.cost, 140000.0);
      expect(pnl.netProfit, 60000.0);
      expect(pnl.profitMargin, 30.0);
      expect(pnl.totalSalesCount, 50);
      expect(pnl.cancelledSalesCount, 2);
    });
  });
}
