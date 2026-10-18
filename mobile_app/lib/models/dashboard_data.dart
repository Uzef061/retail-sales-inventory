import 'product.dart';
import 'sale.dart';
import 'purchase.dart';

class DashboardInsight {
  final String type;
  final String icon;
  final String message;

  DashboardInsight({
    required this.type,
    required this.icon,
    required this.message,
  });

  factory DashboardInsight.fromJson(Map<String, dynamic> json) {
    return DashboardInsight(
      type: json['type']?.toString() ?? 'INFO',
      icon: json['icon']?.toString() ?? '💡',
      message: json['message']?.toString() ?? '',
    );
  }
}

class DashboardData {
  final double todaysSales;
  final int todaysSalesCount;
  final int totalProducts;
  final int totalStock;
  final int lowStockCount;
  final double totalSalesAmount;
  final double totalCostAmount;
  final double netProfit;
  final List<Sale> recentSales;
  final List<Purchase> recentPurchases;
  final List<Product> lowStockProducts;
  final List<DashboardInsight> insights;

  DashboardData({
    required this.todaysSales,
    required this.todaysSalesCount,
    required this.totalProducts,
    required this.totalStock,
    required this.lowStockCount,
    required this.totalSalesAmount,
    required this.totalCostAmount,
    required this.netProfit,
    required this.recentSales,
    required this.recentPurchases,
    required this.lowStockProducts,
    required this.insights,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    List<Sale> rSales = [];
    if (json['recentSales'] is List) {
      rSales = (json['recentSales'] as List)
          .map((s) => Sale.fromJson(s as Map<String, dynamic>))
          .toList();
    }

    List<Purchase> rPurchases = [];
    if (json['recentPurchases'] is List) {
      rPurchases = (json['recentPurchases'] as List)
          .map((p) => Purchase.fromJson(p as Map<String, dynamic>))
          .toList();
    }

    List<Product> lProducts = [];
    if (json['lowStockProducts'] is List) {
      lProducts = (json['lowStockProducts'] as List)
          .map((p) => Product.fromJson(p as Map<String, dynamic>))
          .toList();
    }

    List<DashboardInsight> ins = [];
    if (json['insights'] is List) {
      ins = (json['insights'] as List)
          .map((i) => DashboardInsight.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    return DashboardData(
      todaysSales: (json['todaysSales'] as num?)?.toDouble() ?? 0.0,
      todaysSalesCount: (json['todaysSalesCount'] as num?)?.toInt() ?? 0,
      totalProducts: (json['totalProducts'] as num?)?.toInt() ?? 0,
      totalStock: (json['totalStock'] as num?)?.toInt() ?? 0,
      lowStockCount: (json['lowStockCount'] as num?)?.toInt() ?? lProducts.length,
      totalSalesAmount: (json['totalSalesAmount'] as num?)?.toDouble() ?? 0.0,
      totalCostAmount: (json['totalCostAmount'] as num?)?.toDouble() ?? 0.0,
      netProfit: (json['netProfit'] as num?)?.toDouble() ?? 0.0,
      recentSales: rSales,
      recentPurchases: rPurchases,
      lowStockProducts: lProducts,
      insights: ins,
    );
  }
}
