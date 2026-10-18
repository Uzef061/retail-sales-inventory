class Purchase {
  final String id;
  final String? supplierId;
  final String supplierName;
  final String productId;
  final String productName;
  final int quantity;
  final double costPrice;
  final double totalCost;
  final DateTime purchaseDate;
  final String? referenceNumber;
  final String? notes;

  Purchase({
    required this.id,
    this.supplierId,
    required this.supplierName,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.costPrice,
    required this.totalCost,
    required this.purchaseDate,
    this.referenceNumber,
    this.notes,
  });

  factory Purchase.fromJson(Map<String, dynamic> json) {
    String sId = '';
    String sName = 'Direct Supplier';
    if (json['supplier'] is Map) {
      final sMap = json['supplier'] as Map<String, dynamic>;
      sId = sMap['_id']?.toString() ?? sMap['id']?.toString() ?? '';
      sName = sMap['name']?.toString() ?? 'Direct Supplier';
    } else if (json['supplier'] != null) {
      sId = json['supplier'].toString();
    }

    String pId = '';
    String pName = 'Product';
    if (json['product'] is Map) {
      final pMap = json['product'] as Map<String, dynamic>;
      pId = pMap['_id']?.toString() ?? pMap['id']?.toString() ?? '';
      pName = pMap['name']?.toString() ?? 'Product';
    } else if (json['product'] != null) {
      pId = json['product'].toString();
    }

    final int qty = (json['quantity'] as num?)?.toInt() ?? 1;
    final double cp = (json['costPrice'] as num?)?.toDouble() ?? 0.0;
    final double total = (json['totalCost'] as num?)?.toDouble() ?? (qty * cp);

    DateTime date = DateTime.now();
    if (json['purchaseDate'] != null) {
      date = DateTime.tryParse(json['purchaseDate'].toString()) ?? date;
    } else if (json['createdAt'] != null) {
      date = DateTime.tryParse(json['createdAt'].toString()) ?? date;
    }

    return Purchase(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      supplierId: sId.isNotEmpty ? sId : null,
      supplierName: sName,
      productId: pId,
      productName: pName,
      quantity: qty,
      costPrice: cp,
      totalCost: total,
      purchaseDate: date,
      referenceNumber: json['referenceNumber']?.toString(),
      notes: json['notes']?.toString(),
    );
  }
}
