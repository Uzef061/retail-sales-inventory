class SaleItem {
  final String productId;
  final String productName;
  final int quantity;
  final double sellingPrice;
  final double costPrice;
  final double totalAmount;
  final double profit;

  SaleItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.sellingPrice,
    required this.costPrice,
    required this.totalAmount,
    required this.profit,
  });

  factory SaleItem.fromJson(Map<String, dynamic> json) {
    String pId = '';
    String pName = 'Item';
    if (json['product'] is Map) {
      final pMap = json['product'] as Map<String, dynamic>;
      pId = pMap['_id']?.toString() ?? pMap['id']?.toString() ?? '';
      pName = pMap['name']?.toString() ?? 'Item';
    } else if (json['product'] != null) {
      pId = json['product'].toString();
      pName = json['productName']?.toString() ?? 'Item';
    }

    final int qty = (json['quantity'] as num?)?.toInt() ?? 1;
    final double sp = (json['sellingPrice'] as num?)?.toDouble() ??
        (json['unitPrice'] as num?)?.toDouble() ??
        0.0;
    final double cp = (json['costPrice'] as num?)?.toDouble() ?? 0.0;
    final double total = (json['totalAmount'] as num?)?.toDouble() ?? (qty * sp);
    final double prf = (json['profit'] as num?)?.toDouble() ?? (total - (qty * cp));

    return SaleItem(
      productId: pId,
      productName: pName,
      quantity: qty,
      sellingPrice: sp,
      costPrice: cp,
      totalAmount: total,
      profit: prf,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product': productId,
      'quantity': quantity,
      'sellingPrice': sellingPrice,
      'costPrice': costPrice,
      'totalAmount': totalAmount,
      'profit': profit,
    };
  }
}

class Sale {
  final String id;
  final String invoiceNumber;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final List<SaleItem> items;
  final double totalAmount;
  final double grandTotal;
  final double discount;
  final double tax;
  final String paymentMethod;
  final double amountReceived;
  final double changeDue;
  final String status;
  final double returnedAmount;
  final String notes;
  final DateTime saleDate;

  Sale({
    required this.id,
    required this.invoiceNumber,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.items,
    required this.totalAmount,
    required this.grandTotal,
    this.discount = 0.0,
    this.tax = 0.0,
    this.paymentMethod = 'CASH',
    this.amountReceived = 0.0,
    this.changeDue = 0.0,
    this.status = 'COMPLETED',
    this.returnedAmount = 0.0,
    this.notes = '',
    required this.saleDate,
  });

  bool get isCancelled => status.toUpperCase() == 'CANCELLED';
  bool get isReturned => status.toUpperCase() == 'RETURNED';
  bool get isPartiallyReturned => status.toUpperCase() == 'PARTIALLY_RETURNED';
  double get remainingReturnable => (grandTotal - returnedAmount).clamp(0.0, double.infinity);
  bool get canReturn => !isCancelled && !isReturned && remainingReturnable > 0;

  factory Sale.fromJson(Map<String, dynamic> json) {
    String custId = '';
    String custName = 'Walk-in Customer';
    String custPhone = '';

    if (json['customer'] is Map) {
      final cMap = json['customer'] as Map<String, dynamic>;
      custId = cMap['_id']?.toString() ?? cMap['id']?.toString() ?? '';
      custName = cMap['name']?.toString() ?? 'Walk-in Customer';
      custPhone = cMap['phone']?.toString() ?? '';
    } else if (json['customer'] != null) {
      custId = json['customer'].toString();
    }

    List<SaleItem> parsedItems = [];
    if (json['items'] is List && (json['items'] as List).isNotEmpty) {
      parsedItems = (json['items'] as List)
          .map((i) => SaleItem.fromJson(i as Map<String, dynamic>))
          .toList();
    } else if (json['product'] != null) {
      // Single product legacy format
      String pName = 'Product';
      String pId = '';
      if (json['product'] is Map) {
        final pMap = json['product'] as Map<String, dynamic>;
        pId = pMap['_id']?.toString() ?? pMap['id']?.toString() ?? '';
        pName = pMap['name']?.toString() ?? 'Product';
      } else {
        pId = json['product'].toString();
      }
      final int qty = (json['quantity'] as num?)?.toInt() ?? 1;
      final double sp = (json['sellingPrice'] as num?)?.toDouble() ?? 0.0;
      final double cp = (json['costPrice'] as num?)?.toDouble() ?? 0.0;
      final double tot = (json['totalAmount'] as num?)?.toDouble() ?? (qty * sp);
      parsedItems.add(SaleItem(
        productId: pId,
        productName: pName,
        quantity: qty,
        sellingPrice: sp,
        costPrice: cp,
        totalAmount: tot,
        profit: (json['profit'] as num?)?.toDouble() ?? (tot - (qty * cp)),
      ));
    }

    final double total = (json['totalAmount'] as num?)?.toDouble() ??
        (json['grandTotal'] as num?)?.toDouble() ??
        0.0;
    final double gTotal = (json['grandTotal'] as num?)?.toDouble() ?? total;

    DateTime date = DateTime.now();
    if (json['saleDate'] != null) {
      date = DateTime.tryParse(json['saleDate'].toString()) ?? date;
    } else if (json['createdAt'] != null) {
      date = DateTime.tryParse(json['createdAt'].toString()) ?? date;
    }

    return Sale(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      invoiceNumber: json['invoiceNumber']?.toString() ?? 'INV-${(json['_id'] ?? '').toString().substring(0, 6)}',
      customerId: custId,
      customerName: custName,
      customerPhone: custPhone,
      items: parsedItems,
      totalAmount: total,
      grandTotal: gTotal,
      discount: (json['discount'] as num?)?.toDouble() ?? 0.0,
      tax: (json['tax'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: json['paymentMethod']?.toString().toUpperCase() ?? 'CASH',
      amountReceived: (json['amountReceived'] as num?)?.toDouble() ?? 0.0,
      changeDue: (json['changeDue'] as num?)?.toDouble() ?? 0.0,
      status: json['status']?.toString().toUpperCase() ?? 'COMPLETED',
      returnedAmount: (json['returnedAmount'] as num?)?.toDouble() ?? 0.0,
      notes: json['notes']?.toString() ?? '',
      saleDate: date,
    );
  }
}
