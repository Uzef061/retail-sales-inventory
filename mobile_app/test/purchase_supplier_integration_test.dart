import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/models/purchase.dart';
import 'package:mobile_app/models/purchase_return.dart';
import 'package:mobile_app/models/supplier.dart';
import 'package:mobile_app/screens/parties/supplier_ledger_screen.dart';

void main() {
  group('Supplier Ledger & Balance Accounting Tests', () {
    test('Supplier model correctly flags debt vs advance status', () {
      final supOwed = Supplier(
        id: 's_owed',
        name: 'Steel Suppliers Ltd',
        phone: '9876543210',
        balance: 2400.0,
        balanceStatus: 'OWED_TO_SUPPLIER',
        balanceLabel: 'You owe ₹2400',
        totalPurchases: 5000,
        totalPayments: 2600,
      );

      expect(supOwed.isOwed, isTrue);
      expect(supOwed.isAdvance, isFalse);
      expect(supOwed.isSettled, isFalse);

      final supAdv = Supplier(
        id: 's_adv',
        name: 'Advance Vendor',
        phone: '9123456789',
        balance: -600.0,
        balanceStatus: 'SUPPLIER_ADVANCE',
        balanceLabel: 'Advance ₹600',
        totalPurchases: 2000,
        totalPayments: 2600,
      );

      expect(supAdv.isAdvance, isTrue);
      expect(supAdv.isOwed, isFalse);

      final supSettled = Supplier(
        id: 's_settled',
        name: 'Settled Vendor',
        phone: '9988776655',
        balance: 0.0,
        balanceStatus: 'SETTLED',
        balanceLabel: 'Settled (₹0)',
      );

      expect(supSettled.isSettled, isTrue);
      expect(supSettled.isOwed, isFalse);
    });

    test('Purchase model multi-item line items and returnability computation', () {
      final items = [
        PurchaseItem(
          productId: 'prod_1',
          productName: 'Cement 50kg',
          quantity: 20,
          costPrice: 350.0,
          totalCost: 7000.0,
        ),
        PurchaseItem(
          productId: 'prod_2',
          productName: 'Sand 1 Ton',
          quantity: 2,
          costPrice: 1200.0,
          totalCost: 2400.0,
        ),
      ];

      final pu = Purchase(
        id: 'po_101',
        supplierId: 's_owed',
        supplierName: 'Steel Suppliers Ltd',
        productId: 'prod_1',
        productName: 'Cement 50kg',
        quantity: 22,
        costPrice: 350.0,
        subtotal: 9400.0,
        totalCost: 9400.0,
        amountPaid: 4000.0,
        paymentStatus: 'PARTIALLY_PAID',
        returnedAmount: 1400.0,
        purchaseDate: DateTime(2026, 10, 20),
        referenceNumber: 'PO-9400',
        items: items,
      );

      expect(pu.items.length, 2);
      expect(pu.isPartiallyPaid, isTrue);
      expect(pu.unpaidBalance, 5400.0);
      expect(pu.remainingReturnable, 8000.0); // 9400 - 1400 = 8000
      expect(pu.canReturn, isTrue);
    });

    test('PurchaseReturn model serialization and refund mode verification', () {
      final pr = PurchaseReturn(
        id: 'pr_55',
        purchaseId: 'po_101',
        referenceNumber: 'PR-8812',
        originalReferenceNumber: 'PO-9400',
        supplierId: 's_owed',
        supplierName: 'Steel Suppliers Ltd',
        returnDate: DateTime(2026, 10, 21),
        amount: 1400.0,
        refundMode: 'REDUCE_PAYABLE',
        refundAmount: 0.0,
        reason: 'Damaged bags',
      );

      expect(pr.amount, 1400.0);
      expect(pr.refundMode, 'REDUCE_PAYABLE');
      expect(pr.refundAmount, 0.0);
      expect(pr.originalReferenceNumber, 'PO-9400');
    });

    testWidgets('SupplierLedgerScreen renders header, banner and Make Payment button', (WidgetTester tester) async {
      final testSup = Supplier(
        id: 's_test_1',
        name: 'Acme Traders',
        phone: '9876500000',
        contactPerson: 'Vikram',
        balance: 1800.0,
        balanceStatus: 'OWED_TO_SUPPLIER',
        balanceLabel: 'You owe ₹1800',
        totalPurchases: 5000.0,
        totalPayments: 3200.0,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: SupplierLedgerScreen(supplier: testSup),
        ),
      );

      // Verify app bar title
      expect(find.text('Acme Traders'), findsWidgets);
      // Verify make payment button in bottom sheet
      expect(find.text('Make Payment'), findsOneWidget);
    });
  });
}
