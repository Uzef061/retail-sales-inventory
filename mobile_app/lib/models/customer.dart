import '../core/utils/currency_helper.dart';

class Customer {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String address;
  final bool isActive;
  final double balance;
  final String balanceStatus; // 'OWED_BY_CUSTOMER', 'CUSTOMER_CREDIT', 'SETTLED'
  final String balanceLabel;
  final double totalSales;
  final double totalPaid;
  final double totalReturns;

  Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.address = '',
    this.isActive = true,
    this.balance = 0.0,
    this.balanceStatus = 'SETTLED',
    this.balanceLabel = '',
    this.totalSales = 0.0,
    this.totalPaid = 0.0,
    this.totalReturns = 0.0,
  });

  bool get isOwes => balanceStatus == 'OWED_BY_CUSTOMER' || balance > 0;
  bool get isCredit => balanceStatus == 'CUSTOMER_CREDIT' || balance < 0;
  bool get isSettled => balanceStatus == 'SETTLED' || balance == 0;

  factory Customer.fromJson(Map<String, dynamic> json) {
    final double bal = (json['balance'] as num?)?.toDouble() ?? 0.0;
    String status = json['balanceStatus']?.toString() ?? '';
    if (status.isEmpty) {
      if (bal > 0) {
        status = 'OWED_BY_CUSTOMER';
      } else if (bal < 0) {
        status = 'CUSTOMER_CREDIT';
      } else {
        status = 'SETTLED';
      }
    }

    String label = json['balanceLabel']?.toString() ?? '';
    if (label.isEmpty) {
      if (bal > 0) {
        label = 'Owes ${CurrencyHelper.symbol}${bal.toStringAsFixed(0)}';
      } else if (bal < 0) {
        label = 'Credit ${CurrencyHelper.symbol}${(-bal).toStringAsFixed(0)}';
      } else {
        label = 'Settled (${CurrencyHelper.symbol}0)';
      }
    }

    return Customer(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      isActive: json['isActive'] ?? true,
      balance: bal,
      balanceStatus: status,
      balanceLabel: label,
      totalSales: (json['totalSales'] as num?)?.toDouble() ?? 0.0,
      totalPaid: (json['totalPaid'] as num?)?.toDouble() ?? 0.0,
      totalReturns: (json['totalReturns'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'isActive': isActive,
    };
  }
}
