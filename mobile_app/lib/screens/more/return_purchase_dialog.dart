import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_helper.dart';
import '../../models/purchase.dart';

class ReturnPurchaseDialog extends StatefulWidget {
  final Purchase purchase;
  final VoidCallback onReturnProcessed;

  const ReturnPurchaseDialog({
    super.key,
    required this.purchase,
    required this.onReturnProcessed,
  });

  @override
  State<ReturnPurchaseDialog> createState() => _ReturnPurchaseDialogState();
}

class _ReturnPurchaseDialogState extends State<ReturnPurchaseDialog> {
  final ApiClient _apiClient = ApiClient();
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();

  String _refundMode = 'REDUCE_PAYABLE'; // 'REDUCE_PAYABLE' or 'REFUND_RECEIVED'
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Default to remaining returnable
    _amountController.text = widget.purchase.remainingReturnable.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submitReturn() async {
    final amt = double.tryParse(_amountController.text.trim()) ?? 0.0;
    if (amt <= 0) {
      setState(() => _errorMessage = 'Enter a valid return amount greater than 0.');
      return;
    }

    if (amt > widget.purchase.remainingReturnable) {
      setState(() => _errorMessage =
          'Return amount (${CurrencyHelper.symbol}${amt.toStringAsFixed(0)}) cannot exceed remaining returnable (${CurrencyHelper.symbol}${widget.purchase.remainingReturnable.toStringAsFixed(0)}).');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final payload = {
      'returnAmount': amt,
      'refundMode': _refundMode,
      'reason': _reasonController.text.trim(),
      'idempotencyKey': 'pr_${DateTime.now().millisecondsSinceEpoch}_${widget.purchase.id}',
    };

    try {
      await _apiClient.post('${ApiConfig.purchases}/${widget.purchase.id}/return', payload);

      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onReturnProcessed();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _refundMode == 'REDUCE_PAYABLE'
                ? 'Purchase return recorded! Supplier payable reduced by ${CurrencyHelper.symbol}${amt.toStringAsFixed(0)}.'
                : 'Purchase return recorded! Cash refund of ${CurrencyHelper.symbol}${amt.toStringAsFixed(0)} recorded.',
          ),
          backgroundColor: AppTheme.success,
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Failed to process purchase return.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxReturnable = widget.purchase.remainingReturnable;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 450),
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Return Goods to Supplier',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // PO Info Banner
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Supplier: ${widget.purchase.supplierName}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'PO Ref: ${widget.purchase.referenceNumber ?? widget.purchase.id}',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Original Total: ${CurrencyHelper.symbol}${widget.purchase.totalCost.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                        Text('Returnable: ${CurrencyHelper.symbol}${maxReturnable.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.orange)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppTheme.errorLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_errorMessage!, style: const TextStyle(color: AppTheme.error, fontSize: 13)),
                ),
              ],

              // Return Amount Field
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'Return Value (${CurrencyHelper.symbol}) *',
                  prefixText: '${CurrencyHelper.symbol} ',
                  helperText: 'Maximum returnable: ${CurrencyHelper.symbol}${maxReturnable.toStringAsFixed(0)}',
                ),
              ),
              const SizedBox(height: 16),

              // Refund Mode Selector
              const Text(
                'Adjustment Mode:',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
              ),
              const SizedBox(height: 6),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'REDUCE_PAYABLE',
                    label: Text('Reduce Payable', style: TextStyle(fontSize: 11)),
                    icon: Icon(Icons.money_off, size: 14),
                  ),
                  ButtonSegment(
                    value: 'REFUND_RECEIVED',
                    label: Text('Cash Refund', style: TextStyle(fontSize: 11)),
                    icon: Icon(Icons.currency_rupee, size: 14),
                  ),
                ],
                selected: {_refundMode},
                onSelectionChanged: (val) {
                  setState(() => _refundMode = val.first);
                },
              ),
              const SizedBox(height: 6),
              Text(
                _refundMode == 'REDUCE_PAYABLE'
                    ? 'Deducts the return amount from what you owe the supplier.'
                    : 'Records incoming cash refund received from supplier.',
                style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 16),

              // Reason Field
              TextFormField(
                controller: _reasonController,
                decoration: const InputDecoration(
                  labelText: 'Reason for Return (Optional)',
                  hintText: 'e.g. Defective items, expired batch, wrong shipment',
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submitReturn,
                icon: _isSubmitting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.rotate_left, size: 18),
                label: const Text('Confirm Purchase Return'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange.shade700,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
