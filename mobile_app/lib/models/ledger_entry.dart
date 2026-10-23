class LedgerSummary {
  final double toReceive;
  final double toPay;
  final double periodTotalIn;
  final double periodTotalOut;
  final double periodSales;
  final double periodPurchases;
  final double periodReturns;
  final double netCashFlow;
  final int entryCount;

  const LedgerSummary({
    this.toReceive = 0.0,
    this.toPay = 0.0,
    this.periodTotalIn = 0.0,
    this.periodTotalOut = 0.0,
    this.periodSales = 0.0,
    this.periodPurchases = 0.0,
    this.periodReturns = 0.0,
    this.netCashFlow = 0.0,
    this.entryCount = 0,
  });

  factory LedgerSummary.fromJson(Map<String, dynamic> json) {
    return LedgerSummary(
      toReceive: (json['toReceive'] as num?)?.toDouble() ?? 0.0,
      toPay: (json['toPay'] as num?)?.toDouble() ?? 0.0,
      periodTotalIn: (json['periodTotalIn'] as num?)?.toDouble() ?? 0.0,
      periodTotalOut: (json['periodTotalOut'] as num?)?.toDouble() ?? 0.0,
      periodSales: (json['periodSales'] as num?)?.toDouble() ?? 0.0,
      periodPurchases: (json['periodPurchases'] as num?)?.toDouble() ?? 0.0,
      periodReturns: (json['periodReturns'] as num?)?.toDouble() ?? 0.0,
      netCashFlow: (json['netCashFlow'] as num?)?.toDouble() ?? 0.0,
      entryCount: (json['entryCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class LedgerEntry {
  final String id;
  final String type; // 'SALE', 'PAYMENT_RECEIVED', 'PAYMENT_MADE', 'PURCHASE', 'SALE_RETURN'
  final DateTime date;
  final String partyName;
  final String partyPhone;
  final String partyType; // 'CUSTOMER', 'SUPPLIER', 'OTHER'
  final String? partyId;
  final double amount;
  final double? amountReceived;
  final String? status;
  final String reference;
  final String? linkedReference;
  final String? paymentMethod;
  final String direction; // 'DEBIT', 'CREDIT'
  final String directionLabel;
  final String balanceImpact;
  final double resultingBalance;
  final String notes;

  LedgerEntry({
    required this.id,
    required this.type,
    required this.date,
    required this.partyName,
    required this.partyPhone,
    required this.partyType,
    this.partyId,
    required this.amount,
    this.amountReceived,
    this.status,
    required this.reference,
    this.linkedReference,
    this.paymentMethod,
    required this.direction,
    required this.directionLabel,
    required this.balanceImpact,
    required this.resultingBalance,
    this.notes = '',
  });

  bool get isCustomer => partyType.toUpperCase() == 'CUSTOMER';
  bool get isSupplier => partyType.toUpperCase() == 'SUPPLIER';
  bool get isSale => type.toUpperCase() == 'SALE';
  bool get isPaymentReceived => type.toUpperCase() == 'PAYMENT_RECEIVED';
  bool get isPaymentMade => type.toUpperCase() == 'PAYMENT_MADE';
  bool get isPurchase => type.toUpperCase() == 'PURCHASE';
  bool get isReturn => type.toUpperCase() == 'SALE_RETURN';

  factory LedgerEntry.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate;
    try {
      parsedDate = json['date'] != null ? DateTime.parse(json['date']) : DateTime.now();
    } catch (_) {
      parsedDate = DateTime.now();
    }

    return LedgerEntry(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString().toUpperCase() ?? 'SALE',
      date: parsedDate,
      partyName: json['partyName']?.toString() ?? 'Party',
      partyPhone: json['partyPhone']?.toString() ?? '',
      partyType: json['partyType']?.toString().toUpperCase() ?? 'CUSTOMER',
      partyId: json['partyId']?.toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      amountReceived: (json['amountReceived'] as num?)?.toDouble(),
      status: json['status']?.toString(),
      reference: json['reference']?.toString() ?? '',
      linkedReference: json['linkedReference']?.toString(),
      paymentMethod: json['paymentMethod']?.toString(),
      direction: json['direction']?.toString().toUpperCase() ?? 'DEBIT',
      directionLabel: json['directionLabel']?.toString() ?? '',
      balanceImpact: json['balanceImpact']?.toString() ?? '',
      resultingBalance: (json['resultingBalance'] as num?)?.toDouble() ?? 0.0,
      notes: json['notes']?.toString() ?? '',
    );
  }
}
