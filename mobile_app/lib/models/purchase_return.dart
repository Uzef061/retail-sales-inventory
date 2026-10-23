class PurchaseReturn {
  final String id;
  final String purchaseId;
  final String referenceNumber;
  final String? originalReferenceNumber;
  final String? supplierId;
  final String supplierName;
  final DateTime returnDate;
  final double amount;
  final String refundMode; // 'REDUCE_PAYABLE', 'REFUND_RECEIVED', 'SUPPLIER_CREDIT'
  final double refundAmount;
  final String? reason;

  PurchaseReturn({
    required this.id,
    required this.purchaseId,
    required this.referenceNumber,
    this.originalReferenceNumber,
    this.supplierId,
    required this.supplierName,
    required this.returnDate,
    required this.amount,
    required this.refundMode,
    this.refundAmount = 0.0,
    this.reason,
  });

  factory PurchaseReturn.fromJson(Map<String, dynamic> json) {
    String sId = '';
    String sName = 'Supplier';
    if (json['supplier'] is Map) {
      final sMap = json['supplier'] as Map<String, dynamic>;
      sId = sMap['_id']?.toString() ?? sMap['id']?.toString() ?? '';
      sName = sMap['name']?.toString() ?? 'Supplier';
    } else if (json['supplier'] != null) {
      sId = json['supplier'].toString();
    }

    DateTime d = DateTime.now();
    if (json['returnDate'] != null) {
      d = DateTime.tryParse(json['returnDate'].toString()) ?? d;
    } else if (json['createdAt'] != null) {
      d = DateTime.tryParse(json['createdAt'].toString()) ?? d;
    }

    return PurchaseReturn(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      purchaseId: json['purchaseId']?.toString() ?? '',
      referenceNumber: json['referenceNumber']?.toString() ?? '',
      originalReferenceNumber: json['originalReferenceNumber']?.toString(),
      supplierId: sId.isNotEmpty ? sId : null,
      supplierName: sName,
      returnDate: d,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      refundMode: json['refundMode']?.toString() ?? 'REDUCE_PAYABLE',
      refundAmount: (json['refundAmount'] as num?)?.toDouble() ?? 0.0,
      reason: json['reason']?.toString(),
    );
  }
}
