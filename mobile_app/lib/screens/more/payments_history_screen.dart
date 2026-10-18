import 'package:flutter/material.dart';
import '../../core/services/payment_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/payment_transaction.dart';
import '../home/receive_give_dialog.dart';

class PaymentsHistoryScreen extends StatefulWidget {
  const PaymentsHistoryScreen({super.key});

  @override
  State<PaymentsHistoryScreen> createState() => _PaymentsHistoryScreenState();
}

class _PaymentsHistoryScreenState extends State<PaymentsHistoryScreen> {
  final _paymentService = PaymentService();

  List<PaymentTransaction> _transactions = [];
  PaymentSummary _summary = const PaymentSummary(totalReceived: 0, totalGiven: 0, netCashFlow: 0, count: 0);
  bool _isLoading = true;
  String? _errorMessage;
  String _filter = 'ALL'; // 'ALL', 'RECEIVE', 'GIVE'

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        _paymentService.getTransactions(type: _filter == 'ALL' ? null : _filter),
        _paymentService.getSummary(),
      ]);

      setState(() {
        _transactions = results[0] as List<PaymentTransaction>;
        _summary = results[1] as PaymentSummary;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load cash transactions: $e';
        _isLoading = false;
      });
    }
  }

  void _openReceiveGive(String type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReceiveGiveDialog(
        type: type,
        onSuccess: () => _loadData(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cash In & Out Ledger'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppTheme.error),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Summary Card
                      Card(
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'NET CASH POSITION',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${_summary.netCashFlow >= 0 ? '+' : ''}Rs ${_summary.netCashFlow.toStringAsFixed(0)}',
                                    style: TextStyle(
                                      fontSize: 26,
                                      fontWeight: FontWeight.w900,
                                      color: _summary.netCashFlow >= 0 ? AppTheme.success : AppTheme.error,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: (_summary.netCashFlow >= 0 ? AppTheme.success : AppTheme.error).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '${_summary.count} entries',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: _summary.netCashFlow >= 0 ? AppTheme.success : AppTheme.error,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF0FDF4),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: AppTheme.success.withValues(alpha: 0.3)),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Row(
                                            children: [
                                              Icon(Icons.arrow_downward, size: 14, color: AppTheme.success),
                                              SizedBox(width: 4),
                                              Text('Received', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Rs ${_summary.totalReceived.toStringAsFixed(0)}',
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.success),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF2F2),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: AppTheme.error.withValues(alpha: 0.3)),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Row(
                                            children: [
                                              Icon(Icons.arrow_upward, size: 14, color: AppTheme.error),
                                              SizedBox(width: 4),
                                              Text('Given', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Rs ${_summary.totalGiven.toStringAsFixed(0)}',
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.error),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Quick Action Buttons
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.success,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              onPressed: () => _openReceiveGive('RECEIVE'),
                              icon: const Icon(Icons.arrow_downward, color: Colors.white, size: 18),
                              label: const Text('+ Receive Cash', style: TextStyle(color: Colors.white)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEA580C),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              onPressed: () => _openReceiveGive('GIVE'),
                              icon: const Icon(Icons.arrow_upward, color: Colors.white, size: 18),
                              label: const Text('- Give Cash', style: TextStyle(color: Colors.white)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Filter Chips
                      Row(
                        children: [
                          _buildFilterChip('ALL', 'All Entries'),
                          const SizedBox(width: 8),
                          _buildFilterChip('RECEIVE', 'Received In'),
                          const SizedBox(width: 8),
                          _buildFilterChip('GIVE', 'Given Out'),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Transaction List
                      if (_transactions.isEmpty)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              children: const [
                                Icon(Icons.receipt_long_outlined, size: 48, color: AppTheme.textMuted),
                                SizedBox(height: 12),
                                Text(
                                  'No transactions found',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Use the Receive and Give buttons above to log cash flow.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        ..._transactions.map((tx) {
                          final isReceive = tx.type == 'RECEIVE';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: isReceive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                child: Icon(
                                  isReceive ? Icons.arrow_downward : Icons.arrow_upward,
                                  color: isReceive ? AppTheme.success : AppTheme.error,
                                  size: 20,
                                ),
                              ),
                              title: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      tx.partyName.isNotEmpty ? tx.partyName : (isReceive ? 'Direct Cash In' : 'Direct Expense'),
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    '${isReceive ? '+' : '-'}Rs ${tx.amount.toStringAsFixed(0)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: isReceive ? AppTheme.success : AppTheme.error,
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppTheme.surface,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          tx.paymentMethod,
                                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        '${tx.createdAt.year}-${tx.createdAt.month.toString().padLeft(2, '0')}-${tx.createdAt.day.toString().padLeft(2, '0')} ${tx.createdAt.hour.toString().padLeft(2, '0')}:${tx.createdAt.minute.toString().padLeft(2, '0')}',
                                        style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                                      ),
                                    ],
                                  ),
                                  if (tx.notes.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Note: ${tx.notes}',
                                      style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSel = _filter == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSel,
      onSelected: (val) {
        if (val) {
          setState(() => _filter = key);
          _loadData();
        }
      },
      selectedColor: AppTheme.primary,
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
        color: isSel ? Colors.white : AppTheme.textPrimary,
      ),
      showCheckmark: false,
    );
  }
}
