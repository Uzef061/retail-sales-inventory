class ReportData {
  final String mode;
  final String label;
  final DateTime? startDate;
  final DateTime? endDate;
  final double totalSalesAmount;
  final int totalSalesCount;
  final double totalCostAmount;
  final double netProfit;
  final double profitMargin;
  final List<SalesTrendItem> salesByDate;
  final List<BestSellerItem> bestSellingProducts;
  final List<CategorySalesItem> salesByCategory;
  final int totalProducts;
  final int totalStock;
  final double inventoryValuation;
  final int lowStockCount;
  final double totalPurchasesAmount;
  final int purchasesCount;
  final int customerCount;
  final int supplierCount;
  final double totalReceived;
  final double totalGiven;
  final double netCashFlow;
  final List<Map<String, dynamic>> lowStockProducts;

  ReportData({
    required this.mode,
    required this.label,
    this.startDate,
    this.endDate,
    required this.totalSalesAmount,
    required this.totalSalesCount,
    required this.totalCostAmount,
    required this.netProfit,
    required this.profitMargin,
    required this.salesByDate,
    required this.bestSellingProducts,
    required this.salesByCategory,
    required this.totalProducts,
    required this.totalStock,
    required this.inventoryValuation,
    required this.lowStockCount,
    required this.totalPurchasesAmount,
    required this.purchasesCount,
    required this.customerCount,
    required this.supplierCount,
    required this.totalReceived,
    required this.totalGiven,
    required this.netCashFlow,
    this.lowStockProducts = const [],
  });

  double get totalSales => totalSalesAmount;
  int get totalOrders => totalSalesCount;
  double get inventoryValue => inventoryValuation;
  double get avgOrderValue => totalSalesCount > 0 ? totalSalesAmount / totalSalesCount : 0.0;
  double get cashCollected => totalReceived;
  double get totalPurchases => totalPurchasesAmount;
  int get purchaseOrdersCount => purchasesCount;
  int get suppliersCount => supplierCount;
  double get receivables => totalReceived;
  double get payables => totalGiven;
  List<BestSellerItem> get bestSellers => bestSellingProducts;
  int get outOfStockCount => lowStockCount > 2 ? 1 : 0;

  factory ReportData.fromJson(Map<String, dynamic> json) {
    final salesDateRaw = json['salesByDate'] as List<dynamic>? ?? [];
    final bestSellersRaw = json['bestSellingProducts'] as List<dynamic>? ?? [];
    final categoryRaw = json['salesByCategory'] as List<dynamic>? ?? [];
    final lowStockRaw = json['lowStockProducts'] as List<dynamic>? ?? [];

    return ReportData(
      mode: json['mode']?.toString() ?? 'week',
      label: json['label']?.toString() ?? 'This Week',
      startDate: json['startDate'] != null ? DateTime.tryParse(json['startDate'].toString()) : null,
      endDate: json['endDate'] != null ? DateTime.tryParse(json['endDate'].toString()) : null,
      totalSalesAmount: (json['totalSalesAmount'] as num?)?.toDouble() ?? 0.0,
      totalSalesCount: (json['totalSalesCount'] as num?)?.toInt() ?? 0,
      totalCostAmount: (json['totalCostAmount'] as num?)?.toDouble() ?? 0.0,
      netProfit: (json['netProfit'] as num?)?.toDouble() ?? 0.0,
      profitMargin: (json['profitMargin'] as num?)?.toDouble() ?? 0.0,
      salesByDate: salesDateRaw.map((i) => SalesTrendItem.fromJson(i as Map<String, dynamic>)).toList(),
      bestSellingProducts: bestSellersRaw.map((i) => BestSellerItem.fromJson(i as Map<String, dynamic>)).toList(),
      salesByCategory: categoryRaw.map((i) => CategorySalesItem.fromJson(i as Map<String, dynamic>)).toList(),
      totalProducts: (json['totalProducts'] as num?)?.toInt() ?? 0,
      totalStock: (json['totalStock'] as num?)?.toInt() ?? 0,
      inventoryValuation: (json['inventoryValuation'] as num?)?.toDouble() ?? 0.0,
      lowStockCount: (json['lowStockCount'] as num?)?.toInt() ?? 0,
      totalPurchasesAmount: (json['totalPurchasesAmount'] as num?)?.toDouble() ?? 0.0,
      purchasesCount: (json['purchasesCount'] as num?)?.toInt() ?? 0,
      customerCount: (json['customerCount'] as num?)?.toInt() ?? 0,
      supplierCount: (json['supplierCount'] as num?)?.toInt() ?? 0,
      totalReceived: (json['totalReceived'] as num?)?.toDouble() ?? 0.0,
      totalGiven: (json['totalGiven'] as num?)?.toDouble() ?? 0.0,
      netCashFlow: (json['netCashFlow'] as num?)?.toDouble() ?? 0.0,
      lowStockProducts: lowStockRaw.map((item) => Map<String, dynamic>.from(item as Map)).toList(),
    );
  }
}

class SalesTrendItem {
  final String date;
  final double sales;
  final int count;

  SalesTrendItem({required this.date, required this.sales, required this.count});

  factory SalesTrendItem.fromJson(Map<String, dynamic> json) {
    return SalesTrendItem(
      date: json['date']?.toString() ?? json['_id']?.toString() ?? '',
      sales: (json['sales'] as num?)?.toDouble() ?? (json['totalSales'] as num?)?.toDouble() ?? 0.0,
      count: (json['count'] as num?)?.toInt() ?? (json['salesCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class BestSellerItem {
  final String id;
  final String name;
  final String category;
  final int quantitySold;
  final double totalRevenue;
  final double totalProfit;

  BestSellerItem({
    required this.id,
    required this.name,
    required this.category,
    required this.quantitySold,
    required this.totalRevenue,
    required this.totalProfit,
  });

  int get unitsSold => quantitySold;
  double get sales => totalRevenue;
  double get profit => totalProfit;

  factory BestSellerItem.fromJson(Map<String, dynamic> json) {
    return BestSellerItem(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Product',
      category: json['category']?.toString() ?? 'General',
      quantitySold: (json['totalQuantitySold'] as num?)?.toInt() ?? 0,
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0.0,
      totalProfit: (json['totalProfit'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class CategorySalesItem {
  final String category;
  final double totalRevenue;
  final int totalQuantity;

  CategorySalesItem({
    required this.category,
    required this.totalRevenue,
    required this.totalQuantity,
  });

  factory CategorySalesItem.fromJson(Map<String, dynamic> json) {
    return CategorySalesItem(
      category: json['_id']?.toString() ?? json['category']?.toString() ?? 'General',
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0.0,
      totalQuantity: (json['totalQuantity'] as num?)?.toInt() ?? 0,
    );
  }
}
