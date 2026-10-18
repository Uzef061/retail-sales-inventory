class PaymentTransaction {
  final String id;
  final String userId;
  final String type; // 'RECEIVE' or 'GIVE'
  final String partyType; // 'CUSTOMER', 'SUPPLIER', 'OTHER'
  final String? partyId;
  final String partyName;
  final double amount;
  final String paymentMethod;
  final DateTime transactionDate;
  final String referenceNumber;
  final String notes;

  PaymentTransaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.partyType,
    this.partyId,
    required this.partyName,
    required this.amount,
    this.paymentMethod = 'CASH',
    required this.transactionDate,
    this.referenceNumber = '',
    this.notes = '',
  });

  bool get isReceive => type.toUpperCase() == 'RECEIVE';
  bool get isGive => type.toUpperCase() == 'GIVE';
  DateTime get createdAt => transactionDate;

  factory PaymentTransaction.fromJson(Map<String, dynamic> json) {
    return PaymentTransaction(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      type: json['type']?.toString().toUpperCase() ?? 'RECEIVE',
      partyType: json['partyType']?.toString().toUpperCase() ?? 'CUSTOMER',
      partyId: json['partyId']?.toString(),
      partyName: json['partyName']?.toString() ?? 'Party',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: json['paymentMethod']?.toString().toUpperCase() ?? 'CASH',
      transactionDate: json['transactionDate'] != null
          ? DateTime.tryParse(json['transactionDate'].toString()) ?? DateTime.now()
          : DateTime.now(),
      referenceNumber: json['referenceNumber']?.toString() ?? '',
      notes: json['notes']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'partyType': partyType,
      'partyId': partyId,
      'partyName': partyName,
      'amount': amount,
      'paymentMethod': paymentMethod,
      'transactionDate': transactionDate.toIso8601String(),
      'referenceNumber': referenceNumber,
      'notes': notes,
    };
  }
}

class PaymentSummary {
  final double totalReceived;
  final double totalGiven;
  final double netCashFlow;
  final double todayReceived;
  final double todayGiven;
  final List<PaymentTransaction> recentTransactions;
  final int count;

  const PaymentSummary({
    this.totalReceived = 0.0,
    this.totalGiven = 0.0,
    this.netCashFlow = 0.0,
    this.todayReceived = 0.0,
    this.todayGiven = 0.0,
    this.recentTransactions = const [],
    this.count = 0,
  });

  factory PaymentSummary.fromJson(Map<String, dynamic> json) {
    final recentRaw = json['recentTransactions'] as List<dynamic>? ?? [];
    return PaymentSummary(
      totalReceived: (json['totalReceived'] as num?)?.toDouble() ?? 0.0,
      totalGiven: (json['totalGiven'] as num?)?.toDouble() ?? 0.0,
      netCashFlow: (json['netCashFlow'] as num?)?.toDouble() ?? 0.0,
      todayReceived: (json['todayReceived'] as num?)?.toDouble() ?? 0.0,
      todayGiven: (json['todayGiven'] as num?)?.toDouble() ?? 0.0,
      recentTransactions: recentRaw.map((t) => PaymentTransaction.fromJson(t as Map<String, dynamic>)).toList(),
      count: (json['count'] as num?)?.toInt() ?? recentRaw.length,
    );
  }
}
