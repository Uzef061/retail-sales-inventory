class PurchaseItem {
  final String productId;
  final String productName;
  final int quantity;
  final double costPrice;
  final double discount;
  final double tax;
  final double totalCost;

  PurchaseItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.costPrice,
    this.discount = 0.0,
    this.tax = 0.0,
    required this.totalCost,
  });

  factory PurchaseItem.fromJson(Map<String, dynamic> json) {
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
    final double cp = (json['costPrice'] as num?)?.toDouble() ??
        (json['unitCostPrice'] as num?)?.toDouble() ??
        0.0;
    final double disc = (json['discount'] as num?)?.toDouble() ?? 0.0;
    final double tx = (json['tax'] as num?)?.toDouble() ?? 0.0;
    final double total = (json['totalCost'] as num?)?.toDouble() ?? ((qty * cp) - disc + tx);

    return PurchaseItem(
      productId: pId,
      productName: pName,
      quantity: qty,
      costPrice: cp,
      discount: disc,
      tax: tx,
      totalCost: total,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product': productId,
      'quantity': quantity,
      'costPrice': costPrice,
      'discount': discount,
      'tax': tax,
      'totalCost': totalCost,
    };
  }
}

class Purchase {
  final String id;
  final String? supplierId;
  final String supplierName;
  final String productId;
  final String productName;
  final int quantity;
  final double costPrice;
  final double subtotal;
  final double discount;
  final double tax;
  final double totalCost;
  final double amountPaid;
  final String paymentStatus; // 'PAID', 'PARTIALLY_PAID', 'UNPAID'
  final String paymentMethod;
  final double returnedAmount;
  final String status; // 'COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED'
  final DateTime purchaseDate;
  final String? referenceNumber;
  final String? notes;
  final List<PurchaseItem> items;

  Purchase({
    required this.id,
    this.supplierId,
    required this.supplierName,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.costPrice,
    this.subtotal = 0.0,
    this.discount = 0.0,
    this.tax = 0.0,
    required this.totalCost,
    this.amountPaid = 0.0,
    this.paymentStatus = 'UNPAID',
    this.paymentMethod = 'CASH',
    this.returnedAmount = 0.0,
    this.status = 'COMPLETED',
    required this.purchaseDate,
    this.referenceNumber,
    this.notes,
    this.items = const [],
  });

  double get remainingReturnable => (totalCost - returnedAmount).clamp(0.0, totalCost);
  bool get canReturn => remainingReturnable > 0 && status != 'CANCELLED';
  bool get isPaid => paymentStatus == 'PAID';
  bool get isPartiallyPaid => paymentStatus == 'PARTIALLY_PAID';
  bool get isCredit => paymentStatus == 'UNPAID';
  double get unpaidBalance => (totalCost - amountPaid).clamp(0.0, totalCost);

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

    // Parse items array if available
    List<PurchaseItem> parsedItems = [];
    if (json['items'] is List && (json['items'] as List).isNotEmpty) {
      parsedItems = (json['items'] as List)
          .map((i) => PurchaseItem.fromJson(i as Map<String, dynamic>))
          .toList();
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

    if (pId.isEmpty && parsedItems.isNotEmpty) {
      pId = parsedItems.first.productId;
      pName = parsedItems.first.productName;
    }

    final int qty = (json['quantity'] as num?)?.toInt() ??
        (parsedItems.isNotEmpty ? parsedItems.fold<int>(0, (s, i) => s + i.quantity) : 1);
    final double cp = (json['costPrice'] as num?)?.toDouble() ??
        (parsedItems.isNotEmpty ? parsedItems.first.costPrice : 0.0);
    final double subtotal = (json['subtotal'] as num?)?.toDouble() ?? (qty * cp);
    final double disc = (json['discount'] as num?)?.toDouble() ?? 0.0;
    final double tx = (json['tax'] as num?)?.toDouble() ?? 0.0;
    final double total = (json['totalCost'] as num?)?.toDouble() ??
        (json['grandTotal'] as num?)?.toDouble() ??
        (subtotal - disc + tx);
    final double paid = (json['amountPaid'] as num?)?.toDouble() ?? 0.0;

    String pStatus = json['paymentStatus']?.toString() ?? '';
    if (pStatus.isEmpty) {
      if (paid >= total && total > 0) {
        pStatus = 'PAID';
      } else if (paid > 0) {
        pStatus = 'PARTIALLY_PAID';
      } else {
        pStatus = 'UNPAID';
      }
    }

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
      subtotal: subtotal,
      discount: disc,
      tax: tx,
      totalCost: total,
      amountPaid: paid,
      paymentStatus: pStatus,
      paymentMethod: json['paymentMethod']?.toString() ?? 'CASH',
      returnedAmount: (json['returnedAmount'] as num?)?.toDouble() ?? 0.0,
      status: json['status']?.toString() ?? 'COMPLETED',
      purchaseDate: date,
      referenceNumber: json['referenceNumber']?.toString(),
      notes: json['notes']?.toString(),
      items: parsedItems,
    );
  }
}
