import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/profit_loss_data.dart';

class ProfitLossScreen extends StatefulWidget {
  const ProfitLossScreen({super.key});

  @override
  State<ProfitLossScreen> createState() => _ProfitLossScreenState();
}

class _ProfitLossScreenState extends State<ProfitLossScreen> {
  final ApiClient _apiClient = ApiClient();

  String _selectedMode = 'week';
  ProfitLossData? _data;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.get(
        ApiConfig.profitLoss,
        queryParams: {'mode': _selectedMode},
      );

      if (res is Map<String, dynamic>) {
        setState(() {
          _data = ProfitLossData.fromJson(res);
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Invalid data returned from server.';
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
        _errorMessage = 'Unable to fetch report.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profit & Loss Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadReport,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          // Period Selector Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppTheme.surface,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildPeriodChip('today', 'Today'),
                _buildPeriodChip('week', 'This Week'),
                _buildPeriodChip('month', 'This Month'),
                _buildPeriodChip('year', 'This Year'),
              ],
            ),
          ),

          // Main Content
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodChip(String mode, String label) {
    final isSel = _selectedMode == mode;
    return ChoiceChip(
      label: Text(label),
      selected: isSel,
      onSelected: (selected) {
        if (selected) {
          setState(() => _selectedMode = mode);
          _loadReport();
        }
      },
      selectedColor: AppTheme.primary,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
        color: isSel ? Colors.white : AppTheme.textPrimary,
      ),
      showCheckmark: false,
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
              const Icon(Icons.error_outline, size: 40, color: AppTheme.error),
              const SizedBox(height: 8),
              Text(_errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _loadReport, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    if (_data == null) {
      return const Center(child: Text('No data'));
    }

    final d = _data!;
    final isProfitable = d.netProfit >= 0;

    return RefreshIndicator(
      onRefresh: _loadReport,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Reporting Label
          Text(
            d.label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 12),

          // Primary Net Profit Hero Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isProfitable
                    ? [const Color(0xFF16A34A), const Color(0xFF15803D)]
                    : [const Color(0xFFDC2626), const Color(0xFFB91C1C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: (isProfitable ? Colors.green : Colors.red).withValues(alpha: 0.25),
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
                      'NET PROFIT',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white70, letterSpacing: 1),
                    ),
                    Icon(Icons.trending_up, color: Colors.white70, size: 20),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '₹${d.netProfit.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white),
                ),
                const SizedBox(height: 6),
                Text(
                  'Profit Margin: ${d.profitMargin.toStringAsFixed(1)}%',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Financial Breakdown Grid
          Row(
            children: [
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Revenue', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                        const SizedBox(height: 6),
                        Text(
                          '₹${d.revenue.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${d.totalSalesCount} completed sales',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Cost of Goods', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                        const SizedBox(height: 6),
                        Text(
                          '₹${d.cost.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${d.cancelledSalesCount} cancelled orders',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Top Selling Products Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Top-Selling Products',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
              ),
              Text(
                'Top ${d.bestSellers.length}',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (d.bestSellers.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Center(
                  child: Text('No product sales data in this period', style: TextStyle(color: AppTheme.textSecondary)),
                ),
              ),
            )
          else
            ...d.bestSellers.map((item) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.star, color: AppTheme.primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                            Text(
                              '${item.category} • ${item.unitsSold} sold',
                              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('₹${item.sales.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                          Text(
                            '+₹${item.profit.toStringAsFixed(0)} profit',
                            style: const TextStyle(fontSize: 11, color: AppTheme.success, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
