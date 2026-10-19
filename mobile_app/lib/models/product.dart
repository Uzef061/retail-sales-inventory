class Product {
  final String id;
  final String name;
  final String category;
  final double costPrice;
  final double sellingPrice;
  final int stock;
  final int reorderLevel;
  final int reorderQuantity;
  final String? sku;
  final bool isActive;

  Product({
    required this.id,
    required this.name,
    required this.category,
    required this.costPrice,
    required this.sellingPrice,
    required this.stock,
    this.reorderLevel = 10,
    this.reorderQuantity = 20,
    this.sku,
    this.isActive = true,
  });

  bool get isLowStock => stock <= reorderLevel;
  bool get isOutOfStock => stock <= 0;
  String? get barcode => sku;
  double get profitPerUnit => sellingPrice - costPrice;
  double get marginPercent =>
      sellingPrice > 0 ? ((profitPerUnit / sellingPrice) * 100) : 0.0;

  factory Product.fromJson(Map<String, dynamic> json) {
    final double selling = (json['sellingPrice'] != null)
        ? (json['sellingPrice'] as num).toDouble()
        : (json['price'] != null ? (json['price'] as num).toDouble() : 0.0);

    final double cost = (json['costPrice'] != null)
        ? (json['costPrice'] as num).toDouble()
        : 0.0;

    return Product(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General',
      costPrice: cost,
      sellingPrice: selling,
      stock: (json['stock'] as num?)?.toInt() ?? 0,
      reorderLevel: (json['reorderLevel'] as num?)?.toInt() ?? 10,
      reorderQuantity: (json['reorderQuantity'] as num?)?.toInt() ?? 20,
      sku: json['sku']?.toString() ?? json['barcode']?.toString(),
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'category': category,
      'costPrice': costPrice,
      'sellingPrice': sellingPrice,
      'price': sellingPrice,
      'stock': stock,
      'reorderLevel': reorderLevel,
      'reorderQuantity': reorderQuantity,
      if (sku != null && sku!.isNotEmpty) 'sku': sku,
      'isActive': isActive,
    };
  }
}
