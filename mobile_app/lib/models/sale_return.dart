class SaleReturn {
  final String id;
  final String saleId;
  final String invoiceNumber;
  final String originalInvoiceNumber;
  final String customer;
  final DateTime returnDate;
  final double amount;
  final String refundMode;
  final double refundAmount;
  final String reason;

  SaleReturn({
    required this.id,
    required this.saleId,
    required this.invoiceNumber,
    required this.originalInvoiceNumber,
    required this.customer,
    required this.returnDate,
    required this.amount,
    required this.refundMode,
    required this.refundAmount,
    required this.reason,
  });

  factory SaleReturn.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate;
    try {
      parsedDate = json['returnDate'] != null ? DateTime.parse(json['returnDate']) : DateTime.now();
    } catch (_) {
      parsedDate = DateTime.now();
    }

    return SaleReturn(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      saleId: json['saleId']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? '',
      originalInvoiceNumber: json['originalInvoiceNumber']?.toString() ?? '',
      customer: json['customer']?.toString() ?? '',
      returnDate: parsedDate,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      refundMode: json['refundMode']?.toString() ?? 'REDUCE_RECEIVABLE',
      refundAmount: (json['refundAmount'] as num?)?.toDouble() ?? 0.0,
      reason: json['reason']?.toString() ?? 'Customer return',
    );
  }
}
