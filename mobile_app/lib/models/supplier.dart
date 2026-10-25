import '../core/utils/currency_helper.dart';

class Supplier {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String address;
  final String contactPerson;
  final bool isActive;
  final double balance;
  final String balanceStatus; // 'OWED_TO_SUPPLIER', 'SUPPLIER_ADVANCE', 'SETTLED'
  final String balanceLabel;
  final double totalPurchases;
  final double totalPayments;
  final double totalReturns;

  Supplier({
    required this.id,
    required this.name,
    required this.phone,
    this.email = '',
    this.address = '',
    this.contactPerson = '',
    this.isActive = true,
    this.balance = 0.0,
    this.balanceStatus = 'SETTLED',
    this.balanceLabel = '',
    this.totalPurchases = 0.0,
    this.totalPayments = 0.0,
    this.totalReturns = 0.0,
  });

  bool get isOwed => balanceStatus == 'OWED_TO_SUPPLIER' || balance > 0;
  bool get isAdvance => balanceStatus == 'SUPPLIER_ADVANCE' || balance < 0;
  bool get isSettled => balanceStatus == 'SETTLED' || balance == 0;

  factory Supplier.fromJson(Map<String, dynamic> json) {
    final double bal = (json['balance'] as num?)?.toDouble() ?? 0.0;
    String status = json['balanceStatus']?.toString() ?? '';
    if (status.isEmpty) {
      if (bal > 0) {
        status = 'OWED_TO_SUPPLIER';
      } else if (bal < 0) {
        status = 'SUPPLIER_ADVANCE';
      } else {
        status = 'SETTLED';
      }
    }

    String label = json['balanceLabel']?.toString() ?? '';
    if (label.isEmpty) {
      if (bal > 0) {
        label = 'You owe ${CurrencyHelper.symbol}${bal.toStringAsFixed(0)}';
      } else if (bal < 0) {
        label = 'Advance ${CurrencyHelper.symbol}${(-bal).toStringAsFixed(0)}';
      } else {
        label = 'Settled (${CurrencyHelper.symbol}0)';
      }
    }

    return Supplier(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      contactPerson: json['contactPerson']?.toString() ?? json['companyName']?.toString() ?? '',
      isActive: json['isActive'] ?? true,
      balance: bal,
      balanceStatus: status,
      balanceLabel: label,
      totalPurchases: (json['totalPurchases'] as num?)?.toDouble() ?? 0.0,
      totalPayments: (json['totalPayments'] as num?)?.toDouble() ?? 0.0,
      totalReturns: (json['totalReturns'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'contactPerson': contactPerson,
      'isActive': isActive,
    };
  }
}
