class BestSellerItem {
  final String name;
  final String category;
  final int unitsSold;
  final double sales;
  final double profit;
  final double marginPercent;

  BestSellerItem({
    required this.name,
    required this.category,
    required this.unitsSold,
    required this.sales,
    required this.profit,
    required this.marginPercent,
  });

  factory BestSellerItem.fromJson(Map<String, dynamic> json) {
    return BestSellerItem(
      name: json['name']?.toString() ?? 'Product',
      category: json['category']?.toString() ?? 'General',
      unitsSold: (json['unitsSold'] as num?)?.toInt() ?? 0,
      sales: (json['sales'] as num?)?.toDouble() ?? 0.0,
      profit: (json['profit'] as num?)?.toDouble() ?? 0.0,
      marginPercent: (json['marginPercent'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class ProfitLossData {
  final String mode;
  final String label;
  final double revenue;
  final double cost;
  final double grossProfit;
  final double netProfit;
  final double profitMargin;
  final int totalSalesCount;
  final int cancelledSalesCount;
  final List<BestSellerItem> bestSellers;

  ProfitLossData({
    required this.mode,
    required this.label,
    required this.revenue,
    required this.cost,
    required this.grossProfit,
    required this.netProfit,
    required this.profitMargin,
    required this.totalSalesCount,
    required this.cancelledSalesCount,
    required this.bestSellers,
  });

  factory ProfitLossData.fromJson(Map<String, dynamic> json) {
    List<BestSellerItem> bSellers = [];
    if (json['bestSellers'] is List) {
      bSellers = (json['bestSellers'] as List)
          .map((b) => BestSellerItem.fromJson(b as Map<String, dynamic>))
          .toList();
    }

    final double rev = (json['revenue'] as num?)?.toDouble() ??
        (json['sales'] as num?)?.toDouble() ??
        0.0;
    final double cst = (json['cost'] as num?)?.toDouble() ??
        (json['costOfItemsSold'] as num?)?.toDouble() ??
        0.0;
    final double gProfit = (json['grossProfit'] as num?)?.toDouble() ?? (rev - cst);
    final double nProfit = (json['netProfit'] as num?)?.toDouble() ?? gProfit;
    final double margin = (json['profitMargin'] as num?)?.toDouble() ??
        (rev > 0 ? (gProfit / rev) * 100 : 0.0);

    return ProfitLossData(
      mode: json['mode']?.toString() ?? 'week',
      label: json['label']?.toString() ?? 'This Period',
      revenue: rev,
      cost: cst,
      grossProfit: gProfit,
      netProfit: nProfit,
      profitMargin: margin,
      totalSalesCount: (json['totalSalesCount'] as num?)?.toInt() ?? 0,
      cancelledSalesCount: (json['cancelledSalesCount'] as num?)?.toInt() ?? 0,
      bestSellers: bSellers,
    );
  }
}
