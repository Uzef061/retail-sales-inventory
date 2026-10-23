import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/services/api_client.dart';
import '../../core/services/ledger_service.dart';
import '../../core/services/sales_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/ledger_entry.dart';
import '../../models/sale.dart';
import '../home/receive_give_dialog.dart';
import '../sales/sale_receipt_dialog.dart';

class PaymentsHistoryScreen extends StatefulWidget {
  const PaymentsHistoryScreen({super.key});

  @override
  State<PaymentsHistoryScreen> createState() => _PaymentsHistoryScreenState();
}

class _PaymentsHistoryScreenState extends State<PaymentsHistoryScreen> {
  final LedgerService _ledgerService = LedgerService();
  final SalesService _salesService = SalesService();
  final ApiClient _apiClient = ApiClient();
  final TextEditingController _searchController = TextEditingController();

  LedgerSummary _summary = const LedgerSummary();
  List<LedgerEntry> _entries = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Period filter: 'today', 'last7days', 'month', 'year', 'custom'
  String _selectedPeriod = 'month';
  DateTime? _customStartDate;
  DateTime? _customEndDate;

  // Entry type filter: 'ALL', 'RECEIVABLE', 'PAYABLE', 'RETURN'
  String _typeFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _ledgerService.getLedger(
        period: _selectedPeriod,
        startDate: _customStartDate,
        endDate: _customEndDate,
        search: _searchController.text.trim(),
        type: _typeFilter == 'ALL' ? null : _typeFilter,
      );

      if (mounted) {
        setState(() {
          _summary = res.summary;
          _entries = res.entries;
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Could not load ledger: $e';
          _isLoading = false;
        });
      }
    }
  }

  void _openReceiveGive(String type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReceiveGiveDialog(
        type: type,
        onSuccess: _loadData,
      ),
    );
  }

  Future<void> _pickCustomDateRange() async {
    final now = DateTime.now();
    final initialDateRange = DateTimeRange(
      start: _customStartDate ?? now.subtract(const Duration(days: 30)),
      end: _customEndDate ?? now,
    );

    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: now.add(const Duration(days: 1)),
      initialDateRange: initialDateRange,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: AppTheme.primary,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: AppTheme.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedPeriod = 'custom';
        _customStartDate = picked.start;
        _customEndDate = picked.end;
      });
      _loadData();
    }
  }

  String _getPeriodLabel() {
    switch (_selectedPeriod) {
      case 'today':
        return 'Today';
      case 'last7days':
        return 'Last 7 Days';
      case 'year':
        return 'This Year';
      case 'custom':
        if (_customStartDate != null && _customEndDate != null) {
          final df = DateFormat('dd MMM');
          return '${df.format(_customStartDate!)} - ${df.format(_customEndDate!)}';
        }
        return 'Custom Range';
      case 'month':
      default:
        return 'This Month';
    }
  }

  Future<void> _openSaleDetails(String saleId) async {
    try {
      final res = await _apiClient.get('/api/sales/$saleId');
      if (res is Map<String, dynamic> && mounted) {
        final sale = Sale.fromJson(res);
        showDialog(
          context: context,
          builder: (_) => SaleReceiptDialog(
            sale: sale,
            onReturnProcessed: _loadData,
            onSaleDeleted: _loadData,
          ),
        );
      }
    } catch (_) {
      // Ignored
    }
  }

  Future<void> _confirmAndDeletePayment(LedgerEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Payment Entry?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Are you sure you want to delete this payment of ₹${entry.amount.toStringAsFixed(0)}?'),
            const SizedBox(height: 8),
            Text('• ${entry.partyName}\'s balance will be recalculated immediately.'),
            const SizedBox(height: 4),
            const Text(
              '• This action cannot be undone.',
              style: TextStyle(color: AppTheme.error, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Delete Payment'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _apiClient.delete('/api/payments/${entry.id}');
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment deleted and ledger updated.'), backgroundColor: AppTheme.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete payment.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _openEditPaymentDialog(LedgerEntry entry) async {
    final amountController = TextEditingController(text: entry.amount.toStringAsFixed(0));
    final notesController = TextEditingController(text: entry.notes);
    String selectedMethod = 'CASH';

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          title: Text('Edit Payment (${entry.partyName})'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount (₹)',
                  prefixText: '₹ ',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesController,
                decoration: const InputDecoration(
                  labelText: 'Notes / Remarks',
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: selectedMethod,
                decoration: const InputDecoration(labelText: 'Payment Mode'),
                items: ['CASH', 'ONLINE', 'UPI', 'BANK_TRANSFER', 'CHEQUE']
                    .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setDlgState(() => selectedMethod = v);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Save Changes'),
            ),
          ],
        ),
      ),
    );

    if (result != true) return;

    final newAmount = double.tryParse(amountController.text.trim());
    if (newAmount == null || newAmount <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter a valid amount greater than 0.'), backgroundColor: AppTheme.error),
        );
      }
      return;
    }

    try {
      await _apiClient.put(
        '/api/payments/${entry.id}',
        {
          'amount': newAmount,
          'notes': notesController.text.trim(),
          'paymentMethod': selectedMethod,
        },
      );
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment updated successfully.'), backgroundColor: AppTheme.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update payment.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _confirmAndDeleteReturn(LedgerEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Sales Return?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Are you sure you want to delete return "${entry.reference}"?'),
            const SizedBox(height: 8),
            const Text('• Returned amount will be restored on the original sale.'),
            const Text('• Any items restored to stock will be deducted from inventory.'),
            const SizedBox(height: 4),
            const Text(
              '• Note: If returned items were already sold, deletion will be safely blocked.',
              style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Delete Return'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _salesService.deleteSaleReturn(entry.id);
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Return deleted and balances reversed.'), backgroundColor: AppTheme.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete return.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Business Ledger'),
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range_outlined),
            tooltip: 'Custom Date Range',
            onPressed: _pickCustomDateRange,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadData,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppTheme.primary,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            // 1. Period Selector Bar
            _buildPeriodSelector(),
            const SizedBox(height: 14),

            // 2. Prominent Two Summary Amounts: TO RECEIVE & TO PAY
            _buildOutstandingBalancesCard(),
            const SizedBox(height: 14),

            // 3. Period Activity Flow Summary (clearly distinguished from balances)
            _buildPeriodActivityCard(),
            const SizedBox(height: 14),

            // 4. Quick Action Buttons
            _buildActionButtons(),
            const SizedBox(height: 16),

            // 5. Search Bar & Filter Chips
            _buildSearchAndFilters(),
            const SizedBox(height: 14),

            // 6. Entries Header with Count
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'TRANSACTIONS (${_entries.length})',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textMuted,
                    letterSpacing: 0.8,
                  ),
                ),
                Text(
                  _getPeriodLabel(),
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primary),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // 7. Transaction Entries or States
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
              )
            else if (_errorMessage != null)
              _buildErrorState()
            else if (_entries.isEmpty)
              _buildEmptyState()
            else
              ..._entries.map((entry) => _buildLedgerEntryCard(entry)),
          ],
        ),
      ),
    );
  }

  // 1. Period Filter Selector
  Widget _buildPeriodSelector() {
    final periods = [
      {'key': 'today', 'label': 'Today'},
      {'key': 'last7days', 'label': 'Last 7 Days'},
      {'key': 'month', 'label': 'This Month'},
      {'key': 'year', 'label': 'This Year'},
      {'key': 'custom', 'label': _selectedPeriod == 'custom' ? _getPeriodLabel() : 'Custom'},
    ];

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: periods.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, idx) {
          final p = periods[idx];
          final isSel = _selectedPeriod == p['key'];
          return ChoiceChip(
            label: Text(
              p['label']!,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                color: isSel ? Colors.white : AppTheme.textPrimary,
              ),
            ),
            selected: isSel,
            selectedColor: AppTheme.primary,
            backgroundColor: AppTheme.surface,
            showCheckmark: false,
            onSelected: (val) {
              if (p['key'] == 'custom') {
                _pickCustomDateRange();
              } else if (val) {
                setState(() {
                  _selectedPeriod = p['key']!;
                  _customStartDate = null;
                  _customEndDate = null;
                });
                _loadData();
              }
            },
          );
        },
      ),
    );
  }

  // 2. Prominent Outstanding Balances Card: TO RECEIVE and TO PAY
  Widget _buildOutstandingBalancesCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'OUTSTANDING BALANCES',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textMuted,
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.cardBorder),
                ),
                child: Text(
                  'As of ${_getPeriodLabel()}',
                  style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // TO RECEIVE CARD
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFC8E6C9), width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.call_received_rounded, size: 16, color: Color(0xFF2E7D32)),
                          SizedBox(width: 6),
                          Text(
                            'TO RECEIVE',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1B5E20),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '₹${_summary.toReceive.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1B5E20),
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Customers owe you',
                        style: TextStyle(fontSize: 11, color: Color(0xFF2E7D32), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // TO PAY CARD
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFBE9E7),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFFFCCBC), width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.call_made_rounded, size: 16, color: Color(0xFFD84315)),
                          SizedBox(width: 6),
                          Text(
                            'TO PAY',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFBF360C),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '₹${_summary.toPay.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFBF360C),
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'You owe suppliers',
                        style: TextStyle(fontSize: 11, color: Color(0xFFD84315), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 3. Period Activity Flow Summary Card
  Widget _buildPeriodActivityCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ACTIVITY IN ${_getPeriodLabel().toUpperCase()}',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textMuted,
                  letterSpacing: 0.8,
                ),
              ),
              Text(
                'Net: ${_summary.netCashFlow >= 0 ? "+" : ""}₹${_summary.netCashFlow.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: _summary.netCashFlow >= 0 ? const Color(0xFF2E7D32) : const Color(0xFFD84315),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Received (In)', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                    const SizedBox(height: 2),
                    Text(
                      '+₹${_summary.periodTotalIn.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Paid (Out)', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                    const SizedBox(height: 2),
                    Text(
                      '-₹${_summary.periodTotalOut.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFFD84315)),
                    ),
                  ],
                ),
              ),
              if (_summary.periodReturns > 0)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Returns Value', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                      const SizedBox(height: 2),
                      Text(
                        '₹${_summary.periodReturns.toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFFE65100)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // 4. Quick Action Buttons
  Widget _buildActionButtons() {
    return Row(
      children: [
        // Receive Cash Button
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () => _openReceiveGive('RECEIVE'),
            icon: const Icon(Icons.arrow_downward_rounded, size: 18),
            label: const Text('Receive Cash', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2E7D32),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
          ),
        ),
        const SizedBox(width: 12),

        // PAYMENT Button (Replaces Give Cash)
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () => _openReceiveGive('GIVE'),
            icon: const Icon(Icons.arrow_upward_rounded, size: 18),
            label: const Text('PAYMENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD84315),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
          ),
        ),
      ],
    );
  }

  // 5. Search Bar & Filter Chips
  Widget _buildSearchAndFilters() {
    return Column(
      children: [
        TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Search by party name, phone, or invoice...',
            prefixIcon: const Icon(Icons.search, size: 20),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: () {
                      _searchController.clear();
                      _loadData();
                    },
                  )
                : null,
          ),
          onChanged: (_) => _loadData(),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            {'key': 'ALL', 'label': 'All'},
            {'key': 'RECEIVABLE', 'label': 'Customers / In'},
            {'key': 'PAYABLE', 'label': 'Suppliers / Out'},
            {'key': 'RETURN', 'label': 'Returns'},
          ].map((f) {
            final isSel = _typeFilter == f['key'];
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Text(
                  f['label']!,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                    color: isSel ? Colors.white : AppTheme.textPrimary,
                  ),
                ),
                selected: isSel,
                selectedColor: AppTheme.primary,
                backgroundColor: AppTheme.surface,
                showCheckmark: false,
                onSelected: (val) {
                  if (val) {
                    setState(() => _typeFilter = f['key']!);
                    _loadData();
                  }
                },
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // 6. Individual Ledger Entry Card
  Widget _buildLedgerEntryCard(LedgerEntry entry) {
    final dateFormat = DateFormat('dd MMM, hh:mm a');
    final formattedDate = dateFormat.format(entry.date);

    // Direction and colors
    final isDebit = entry.direction == 'DEBIT';
    Color badgeBg;
    Color badgeColor;
    IconData typeIcon;

    if (entry.isSale) {
      badgeBg = const Color(0xFFE3F2FD);
      badgeColor = const Color(0xFF1565C0);
      typeIcon = Icons.point_of_sale_rounded;
    } else if (entry.isPaymentReceived) {
      badgeBg = const Color(0xFFE8F5E9);
      badgeColor = const Color(0xFF2E7D32);
      typeIcon = Icons.arrow_downward_rounded;
    } else if (entry.isReturn) {
      badgeBg = const Color(0xFFFFF3E0);
      badgeColor = const Color(0xFFE65100);
      typeIcon = Icons.replay_rounded;
    } else if (entry.isPurchase) {
      badgeBg = const Color(0xFFEDE7F6);
      badgeColor = const Color(0xFF512DA8);
      typeIcon = Icons.local_shipping_outlined;
    } else {
      // Payment Made
      badgeBg = const Color(0xFFFBE9E7);
      badgeColor = const Color(0xFFD84315);
      typeIcon = Icons.arrow_upward_rounded;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        onTap: entry.isSale ? () => _openSaleDetails(entry.id) : null,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Party Name & Amount
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      entry.partyName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '₹${entry.amount.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: entry.isPaymentReceived || entry.isReturn
                          ? const Color(0xFF2E7D32)
                          : (entry.isSale ? const Color(0xFF1565C0) : const Color(0xFFD84315)),
                    ),
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 18, color: AppTheme.textMuted),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onSelected: (val) {
                      if (val == 'edit_payment') {
                        _openEditPaymentDialog(entry);
                      } else if (val == 'delete_payment') {
                        _confirmAndDeletePayment(entry);
                      } else if (val == 'delete_return') {
                        _confirmAndDeleteReturn(entry);
                      } else if (val == 'view_sale') {
                        _openSaleDetails(entry.id);
                      }
                    },
                    itemBuilder: (ctx) => [
                      if (entry.isSale)
                        const PopupMenuItem(
                          value: 'view_sale',
                          child: Row(
                            children: [
                              Icon(Icons.receipt_long, size: 16),
                              SizedBox(width: 8),
                              Text('View / Void Sale'),
                            ],
                          ),
                        ),
                      if (entry.isPaymentReceived || entry.isPaymentMade) ...[
                        const PopupMenuItem(
                          value: 'edit_payment',
                          child: Row(
                            children: [
                              Icon(Icons.edit_outlined, size: 16),
                              SizedBox(width: 8),
                              Text('Edit Payment'),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'delete_payment',
                          child: Row(
                            children: [
                              Icon(Icons.delete_outline, size: 16, color: AppTheme.error),
                              SizedBox(width: 8),
                              Text('Delete Payment', style: TextStyle(color: AppTheme.error)),
                            ],
                          ),
                        ),
                      ],
                      if (entry.isReturn)
                        const PopupMenuItem(
                          value: 'delete_return',
                          child: Row(
                            children: [
                              Icon(Icons.delete_outline, size: 16, color: AppTheme.error),
                              SizedBox(width: 8),
                              Text('Delete Return', style: TextStyle(color: AppTheme.error)),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),

              // Middle Row: Phone & Direction Label
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      if (entry.partyPhone.isNotEmpty) ...[
                        const Icon(Icons.phone, size: 12, color: AppTheme.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          entry.partyPhone,
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeBg,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(typeIcon, size: 10, color: badgeColor),
                            const SizedBox(width: 4),
                            Text(
                              entry.type.replaceAll('_', ' '),
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badgeColor),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: isDebit ? const Color(0xFFFFF3E0) : const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isDebit ? const Color(0xFFFFB74D) : const Color(0xFFA5D6A7),
                        width: 0.8,
                      ),
                    ),
                    child: Text(
                      entry.directionLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: isDebit ? const Color(0xFFE65100) : const Color(0xFF2E7D32),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Divider(height: 1),
              const SizedBox(height: 6),

              // Bottom Row: Date/Time, Reference, & Resulting Balance
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '$formattedDate • ${entry.reference}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                  ),
                  if (entry.resultingBalance > 0)
                    Text(
                      'Bal: ₹${entry.resultingBalance.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textSecondary),
                    ),
                ],
              ),
              if (entry.notes.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Note: ${entry.notes}',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontStyle: FontStyle.italic),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // Error State
  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppTheme.error),
            const SizedBox(height: 10),
            Text(
              _errorMessage ?? 'Failed to load ledger',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }

  // Empty State
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppTheme.surface,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.menu_book_rounded, size: 44, color: AppTheme.textMuted),
            ),
            const SizedBox(height: 14),
            const Text(
              'No ledger entries found',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              'Transactions recorded in ${_getPeriodLabel()} will appear here with complete party balances.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _openReceiveGive('RECEIVE'),
                  icon: const Icon(Icons.arrow_downward, size: 16, color: Color(0xFF2E7D32)),
                  label: const Text('Receive Cash', style: TextStyle(color: Color(0xFF2E7D32))),
                ),
                OutlinedButton.icon(
                  onPressed: () => _openReceiveGive('GIVE'),
                  icon: const Icon(Icons.arrow_upward, size: 16, color: Color(0xFFD84315)),
                  label: const Text('Make Payment', style: TextStyle(color: Color(0xFFD84315))),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
