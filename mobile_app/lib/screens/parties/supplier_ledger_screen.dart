import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/supplier.dart';

class SupplierLedgerScreen extends StatefulWidget {
  final Supplier supplier;

  const SupplierLedgerScreen({super.key, required this.supplier});

  @override
  State<SupplierLedgerScreen> createState() => _SupplierLedgerScreenState();
}

class _SupplierLedgerScreenState extends State<SupplierLedgerScreen> {
  final ApiClient _apiClient = ApiClient();
  final DateFormat _dateFormat = DateFormat('dd MMM yyyy, hh:mm a');

  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _ledgerData;

  String _selectedPeriod = 'ALL'; // 'ALL', 'TODAY', 'WEEK', 'MONTH'

  @override
  void initState() {
    super.initState();
    _loadLedger();
  }

  Future<void> _loadLedger() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.get('${ApiConfig.suppliers}/${widget.supplier.id}/ledger');
      if (res is Map<String, dynamic>) {
        setState(() {
          _ledgerData = res;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Unexpected response format';
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load supplier statement.';
        _isLoading = false;
      });
    }
  }

  Future<void> _showMakePaymentDialog() async {
    final amountController = TextEditingController();
    final notesController = TextEditingController();
    String selectedMethod = 'CASH';
    bool isSaving = false;
    String? dialogError;

    await showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.payment, color: AppTheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Pay ${widget.supplier.name}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (dialogError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(8),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.errorLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(dialogError!, style: const TextStyle(color: AppTheme.error, fontSize: 12)),
                  ),
                ],
                Text(
                  'Record a payment made to this supplier to decrease the outstanding balance.',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Amount (₹) *',
                    prefixText: '₹ ',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedMethod,
                  decoration: const InputDecoration(
                    labelText: 'Payment Method',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'CASH', child: Text('Cash')),
                    DropdownMenuItem(value: 'UPI', child: Text('UPI / Google Pay')),
                    DropdownMenuItem(value: 'BANK', child: Text('Bank Transfer (NEFT/IMPS)')),
                    DropdownMenuItem(value: 'CHEQUE', child: Text('Cheque')),
                  ],
                  onChanged: (val) {
                    if (val != null) setDialogState(() => selectedMethod = val);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(
                    labelText: 'Notes / Reference (Optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isSaving
                  ? null
                  : () async {
                      final amt = double.tryParse(amountController.text.trim()) ?? 0;
                      if (amt <= 0) {
                        setDialogState(() => dialogError = 'Enter a valid payment amount greater than 0');
                        return;
                      }

                      setDialogState(() {
                        isSaving = true;
                        dialogError = null;
                      });

                      try {
                        await _apiClient.post(ApiConfig.payments, {
                          'type': 'GIVE',
                          'partyType': 'SUPPLIER',
                          'partyId': widget.supplier.id,
                          'partyModel': 'Supplier',
                          'partyName': widget.supplier.name,
                          'amount': amt,
                          'paymentMethod': selectedMethod,
                          'transactionDate': DateTime.now().toIso8601String(),
                          'referenceNumber': 'PMT-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
                          'notes': notesController.text.trim(),
                          'idempotencyKey': 'pmt_${DateTime.now().millisecondsSinceEpoch}_${widget.supplier.id}',
                        });

                        if (dialogCtx.mounted) {
                          Navigator.of(dialogCtx).pop();
                        }
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Payment of ₹${amt.toStringAsFixed(0)} recorded successfully.'),
                              backgroundColor: AppTheme.success,
                            ),
                          );
                          _loadLedger();
                        }
                      } on ApiException catch (e) {
                        setDialogState(() {
                          isSaving = false;
                          dialogError = e.message;
                        });
                      } catch (e) {
                        setDialogState(() {
                          isSaving = false;
                          dialogError = 'Failed to record payment.';
                        });
                      }
                    },
              child: isSaving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Confirm Payment'),
            ),
          ],
        ),
      ),
    );
  }

  List<dynamic> _filterTransactions(List<dynamic> transactions) {
    if (_selectedPeriod == 'ALL') return transactions;

    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final weekStart = todayStart.subtract(const Duration(days: 7));
    final monthStart = DateTime(now.year, now.month, 1);

    return transactions.where((t) {
      final dateStr = t['date']?.toString();
      if (dateStr == null) return false;
      final d = DateTime.tryParse(dateStr);
      if (d == null) return false;

      if (_selectedPeriod == 'TODAY') {
        return d.isAfter(todayStart);
      } else if (_selectedPeriod == 'WEEK') {
        return d.isAfter(weekStart);
      } else if (_selectedPeriod == 'MONTH') {
        return d.isAfter(monthStart);
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final summary = _ledgerData?['summary'] as Map<String, dynamic>?;
    final transactions = (_ledgerData?['transactions'] as List<dynamic>?) ?? [];
    final filteredTx = _filterTransactions(transactions);

    final netPayable = (summary?['netPayable'] as num?)?.toDouble() ?? widget.supplier.balance;
    final balanceStatus = summary?['balanceStatus']?.toString() ?? widget.supplier.balanceStatus;
    final balanceLabel = summary?['balanceLabel']?.toString() ?? widget.supplier.balanceLabel;

    final totalPurchases = (summary?['totalPurchases'] as num?)?.toDouble() ?? 0.0;
    final totalPayments = (summary?['totalPayments'] as num?)?.toDouble() ?? 0.0;
    final totalReturns = (summary?['totalReturns'] as num?)?.toDouble() ?? 0.0;

    Color bannerColor;
    Color bannerTextColor;
    IconData bannerIcon;

    if (balanceStatus == 'OWED_TO_SUPPLIER' || netPayable > 0) {
      bannerColor = AppTheme.errorLight;
      bannerTextColor = AppTheme.error;
      bannerIcon = Icons.arrow_outward;
    } else if (balanceStatus == 'SUPPLIER_ADVANCE' || netPayable < 0) {
      bannerColor = AppTheme.success.withValues(alpha: 0.15);
      bannerTextColor = AppTheme.success;
      bannerIcon = Icons.arrow_downward;
    } else {
      bannerColor = Colors.grey.shade100;
      bannerTextColor = AppTheme.textSecondary;
      bannerIcon = Icons.check_circle_outline;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.supplier.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadLedger,
            tooltip: 'Refresh Statement',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              onRefresh: _loadLedger,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: AppTheme.errorLight,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.error)),
                    ),
                  ],

                  // Supplier Info & Balance Header Card
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: AppTheme.secondary.withValues(alpha: 0.1),
                                child: Text(
                                  widget.supplier.name.isNotEmpty ? widget.supplier.name[0].toUpperCase() : 'S',
                                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.secondary),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      widget.supplier.name,
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        const Icon(Icons.phone, size: 14, color: AppTheme.textMuted),
                                        const SizedBox(width: 4),
                                        Text(
                                          widget.supplier.phone.isNotEmpty ? widget.supplier.phone : 'No Phone',
                                          style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                                        ),
                                      ],
                                    ),
                                    if (widget.supplier.contactPerson.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        'Contact: ${widget.supplier.contactPerson}',
                                        style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Prominent Net Balance Banner
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: bannerColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: bannerTextColor.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              children: [
                                Icon(bannerIcon, color: bannerTextColor, size: 28),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        balanceStatus == 'OWED_TO_SUPPLIER'
                                            ? 'YOU OWE SUPPLIER'
                                            : (balanceStatus == 'SUPPLIER_ADVANCE' ? 'SUPPLIER ADVANCE' : 'ACCOUNT STATUS'),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: bannerTextColor,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        balanceLabel,
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w800,
                                          color: bannerTextColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // 3 Metric Counters
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Purchases', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${totalPurchases.toStringAsFixed(0)}',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Payments', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${totalPayments.toStringAsFixed(0)}',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.success),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Returns', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${totalReturns.toStringAsFixed(0)}',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.orange),
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

                  // Period Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All Time', 'ALL'),
                        const SizedBox(width: 6),
                        _buildFilterChip('Today', 'TODAY'),
                        const SizedBox(width: 6),
                        _buildFilterChip('Last 7 Days', 'WEEK'),
                        const SizedBox(width: 6),
                        _buildFilterChip('This Month', 'MONTH'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Statement Section Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Chronological Statement',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                      ),
                      Text(
                        '${filteredTx.length} entries',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Transactions List
                  if (filteredTx.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Center(
                          child: Column(
                            children: const [
                              Icon(Icons.receipt_long_outlined, size: 40, color: AppTheme.textMuted),
                              SizedBox(height: 8),
                              Text('No transaction entries in this period', style: TextStyle(color: AppTheme.textSecondary)),
                            ],
                          ),
                        ),
                      ),
                    )
                  else
                    ...filteredTx.map((tx) {
                      final type = tx['type']?.toString() ?? 'PURCHASE';
                      final amount = (tx['amount'] as num?)?.toDouble() ?? 0.0;
                      final runningBal = (tx['runningBalance'] as num?)?.toDouble() ?? 0.0;
                      final ref = tx['referenceNumber']?.toString() ?? '';
                      final notes = tx['notes']?.toString() ?? '';
                      final dateStr = tx['date']?.toString();
                      final date = dateStr != null ? (DateTime.tryParse(dateStr) ?? DateTime.now()) : DateTime.now();

                      Color typeColor;
                      String typeLabel;
                      String sign;

                      if (type == 'PURCHASE') {
                        typeColor = AppTheme.error;
                        typeLabel = 'Purchase (Bill)';
                        sign = '+';
                      } else if (type == 'PAYMENT') {
                        typeColor = AppTheme.success;
                        typeLabel = 'Payment Made';
                        sign = '-';
                      } else if (type == 'RETURN') {
                        typeColor = Colors.orange;
                        typeLabel = 'Goods Return';
                        sign = '-';
                      } else {
                        typeColor = Colors.blue;
                        typeLabel = 'Supplier Refund';
                        sign = '-';
                      }

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: typeColor.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          typeLabel,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: typeColor,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _dateFormat.format(date),
                                        style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                      ),
                                    ],
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        '$sign ₹${amount.toStringAsFixed(0)}',
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: typeColor,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: Colors.grey.shade100,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          runningBal > 0
                                              ? 'Bal: You owe ₹${runningBal.toStringAsFixed(0)}'
                                              : (runningBal < 0 ? 'Bal: Advance ₹${(-runningBal).toStringAsFixed(0)}' : 'Bal: ₹0'),
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: runningBal > 0 ? AppTheme.error : (runningBal < 0 ? AppTheme.success : AppTheme.textSecondary),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              if (ref.isNotEmpty || notes.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                const Divider(height: 1),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    if (ref.isNotEmpty)
                                      Text(
                                        'Ref: $ref',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppTheme.textSecondary),
                                      ),
                                    if (ref.isNotEmpty && notes.isNotEmpty)
                                      const Text(' • ', style: TextStyle(color: AppTheme.textMuted)),
                                    if (notes.isNotEmpty)
                                      Expanded(
                                        child: Text(
                                          notes,
                                          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    }),
                  const SizedBox(height: 80),
                ],
              ),
            ),
      bottomSheet: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              offset: const Offset(0, -2),
              blurRadius: 6,
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _showMakePaymentDialog,
                  icon: const Icon(Icons.payment, size: 18),
                  label: const Text('Make Payment'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, size: 18),
                  label: const Text('Close'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String period) {
    final isSelected = _selectedPeriod == period;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => setState(() => _selectedPeriod = period),
      selectedColor: AppTheme.primary,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: isSelected ? Colors.white : AppTheme.textPrimary,
      ),
      showCheckmark: false,
    );
  }
}
