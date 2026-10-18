import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/dashboard_data.dart';
import '../more/purchases_screen.dart';
import '../sales/sale_receipt_dialog.dart';
import '../stock/add_product_dialog.dart';

class HomeScreen extends StatefulWidget {
  final Function(int tabIndex) onNavigateTab;

  const HomeScreen({super.key, required this.onNavigateTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiClient _apiClient = ApiClient();
  DashboardData? _dashboardData;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.get(ApiConfig.dashboard);
      if (res is Map<String, dynamic>) {
        setState(() {
          _dashboardData = DashboardData.fromJson(res);
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Invalid dashboard response';
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (_) {
      setState(() {
        _errorMessage = 'Could not connect to server.';
        _isLoading = false;
      });
    }
  }

  void _openAddProduct() {
    showDialog(
      context: context,
      builder: (_) => AddProductDialog(
        onSaved: _loadDashboard,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthService();
    final user = auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Retail Sales & Inventory',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
            ),
            Text(
              'Welcome, ${user?.name ?? "Operator"}',
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboard,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppTheme.textMuted),
              const SizedBox(height: 12),
              Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadDashboard,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    if (_dashboardData == null) {
      return const Center(child: Text('No data'));
    }

    final d = _dashboardData!;
    final dateFormat = DateFormat('hh:mm a');

    return RefreshIndicator(
      onRefresh: _loadDashboard,
      color: AppTheme.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Karobar-inspired Today's Performance Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFC96A3D), Color(0xFFA64F25)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'TODAY\'S TOTAL SALES',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Colors.white70,
                        letterSpacing: 1,
                      ),
                    ),
                    Icon(Icons.point_of_sale, color: Colors.white70, size: 20),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '₹${d.todaysSales.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${d.todaysSalesCount} orders completed today',
                  style: const TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 16),
                const Divider(color: Colors.white24, height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildMetricCol('Products', '${d.totalProducts} items'),
                    _buildMetricCol('Total Stock', '${d.totalStock} units'),
                    _buildMetricCol(
                      'Low Stock',
                      '${d.lowStockCount} items',
                      isAlert: d.lowStockCount > 0,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 2. Karobar-inspired Quick Action Buttons
          const Text(
            'QUICK ACTIONS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppTheme.textMuted,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  icon: Icons.add_shopping_cart,
                  label: 'New Sale',
                  color: AppTheme.primary,
                  onTap: () => widget.onNavigateTab(1), // Sales tab
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionTile(
                  icon: Icons.local_shipping_outlined,
                  label: 'Restock',
                  color: const Color(0xFF2563EB),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PurchasesScreen()),
                    );
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionTile(
                  icon: Icons.add_box_outlined,
                  label: 'Add Product',
                  color: const Color(0xFF059669),
                  onTap: _openAddProduct,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildActionTile(
                  icon: Icons.inventory_2_outlined,
                  label: 'View Stock',
                  color: AppTheme.secondary,
                  onTap: () => widget.onNavigateTab(2), // Stock tab
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // 3. Automated Insight Banner (if any)
          if (d.insights.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.dividerColor),
              ),
              child: Row(
                children: [
                  Text(d.insights.first.icon, style: const TextStyle(fontSize: 22)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      d.insights.first.message,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppTheme.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          // 4. Low Stock Alerts (if lowStockProducts > 0)
          if (d.lowStockProducts.isNotEmpty) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, size: 18, color: AppTheme.warning),
                    SizedBox(width: 6),
                    Text(
                      'Low Stock Alert',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () => widget.onNavigateTab(2),
                  child: const Text('View All Stock'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 100,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: d.lowStockProducts.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, idx) {
                  final p = d.lowStockProducts[idx];
                  return Container(
                    width: 170,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.warningLight,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.warning.withValues(alpha: 0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Only ${p.stock} units left',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.warning),
                        ),
                        Text(
                          '₹${p.sellingPrice.toStringAsFixed(0)} selling',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
          ],

          // 5. Recent Sales Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recent Sales',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
              ),
              TextButton(
                onPressed: () => widget.onNavigateTab(1), // Switch to Sales tab
                child: const Text('View All Sales'),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (d.recentSales.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text('No sales recorded today yet', style: TextStyle(color: AppTheme.textSecondary)),
                ),
              ),
            )
          else
            ...d.recentSales.map((s) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  dense: true,
                  onTap: () {
                    showDialog(
                      context: context,
                      builder: (_) => SaleReceiptDialog(sale: s),
                    );
                  },
                  leading: CircleAvatar(
                    radius: 18,
                    backgroundColor: AppTheme.primaryLight,
                    child: const Icon(Icons.receipt, size: 18, color: AppTheme.primary),
                  ),
                  title: Text(
                    s.customerName,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  subtitle: Text(
                    '${s.invoiceNumber} • ${dateFormat.format(s.saleDate)} • ${s.paymentMethod}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  ),
                  trailing: Text(
                    '₹${s.grandTotal.toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppTheme.textPrimary),
                  ),
                ),
              );
            }),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildMetricCol(String label, String value, {bool isAlert = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.white70)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: isAlert ? const Color(0xFFFDE047) : Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.dividerColor),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
