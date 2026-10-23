import 'package:flutter/material.dart';
import '../../core/services/api_client.dart';
import '../../core/services/sales_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sale.dart';

class ReturnSaleDialog extends StatefulWidget {
  final Sale sale;

  const ReturnSaleDialog({super.key, required this.sale});

  @override
  State<ReturnSaleDialog> createState() => _ReturnSaleDialogState();
}

class _ReturnSaleDialogState extends State<ReturnSaleDialog> {
  final SalesService _salesService = SalesService();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();

  String _refundMode = 'REFUND_PAID'; // 'REFUND_PAID' or 'REDUCE_RECEIVABLE'
  String _selectedReasonTag = 'Customer Request';
  bool _restoreStock = true;
  bool _isSubmitting = false;

  // Itemized return tracking (if sale has items)
  final Map<String, int> _returnedQtyPerItem = {};

  final List<String> _commonReasons = [
    'Customer Request',
    'Damaged / Defective',
    'Wrong Item',
    'Billing Correction',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    // Default return amount to remaining returnable
    final maxReturn = widget.sale.remainingReturnable;
    _amountController.text = maxReturn > 0 ? maxReturn.toStringAsFixed(0) : '0';
    _reasonController.text = _selectedReasonTag;
    _restoreStock = _selectedReasonTag != 'Damaged / Defective';

    // Initialize item quantities to 0
    for (final item in widget.sale.items) {
      _returnedQtyPerItem[item.productId] = 0;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _onReasonTagSelected(String reason) {
    setState(() {
      _selectedReasonTag = reason;
      if (reason == 'Damaged / Defective') {
        _restoreStock = false; // Damaged items do not automatically increase sellable stock
      } else {
        _restoreStock = true;
      }
      if (reason != 'Other') {
        _reasonController.text = reason;
      } else {
        _reasonController.clear();
      }
    });
  }

  void _setFullReturn() {
    setState(() {
      _amountController.text = widget.sale.remainingReturnable.toStringAsFixed(0);
      for (final item in widget.sale.items) {
        _returnedQtyPerItem[item.productId] = item.quantity;
      }
    });
  }

  void _updateItemQty(String productId, int newQty, double unitPrice) {
    final item = widget.sale.items.firstWhere((i) => i.productId == productId);
    final clamped = newQty.clamp(0, item.quantity);
    setState(() {
      _returnedQtyPerItem[productId] = clamped;

      // Recalculate total from items
      double total = 0.0;
      for (final itm in widget.sale.items) {
        final q = _returnedQtyPerItem[itm.productId] ?? 0;
        total += q * itm.sellingPrice;
      }
      if (total > widget.sale.remainingReturnable) {
        total = widget.sale.remainingReturnable;
      }
      _amountController.text = total.toStringAsFixed(0);
    });
  }

  Future<void> _submitReturn() async {
    if (_isSubmitting) return;

    final parsedAmount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    final maxReturnable = widget.sale.remainingReturnable;

    if (parsedAmount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a return amount greater than 0'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    if (parsedAmount > maxReturnable) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Return amount cannot exceed remaining ₹${maxReturnable.toStringAsFixed(0)}'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // Build returned items payload if itemized
      List<Map<String, dynamic>>? itemsPayload;
      if (widget.sale.items.isNotEmpty) {
        final withQty = widget.sale.items.where((i) => (_returnedQtyPerItem[i.productId] ?? 0) > 0).toList();
        if (withQty.isNotEmpty) {
          itemsPayload = withQty.map((i) => {
            'product': i.productId,
            'quantity': _returnedQtyPerItem[i.productId] ?? 1,
            'sellingPrice': i.sellingPrice,
          }).toList();
        }
      }

      final reasonText = _reasonController.text.trim().isNotEmpty
          ? _reasonController.text.trim()
          : _selectedReasonTag;

      await _salesService.returnSale(
        saleId: widget.sale.id,
        returnAmount: parsedAmount,
        returnedItems: itemsPayload,
        reason: reasonText,
        refundMode: _refundMode,
        restoreStock: _restoreStock,
        idempotencyKey: 'ret_${widget.sale.id}_${DateTime.now().millisecondsSinceEpoch}',
      );

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to process return. Please check connection.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sale = widget.sale;
    final maxReturnable = sale.remainingReturnable;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 460),
        padding: const EdgeInsets.all(22),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.warningLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.assignment_return, color: AppTheme.warning, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Process Sale Return',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                        ),
                        Text(
                          'Invoice #${sale.invoiceNumber}',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Sale Summary Box
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.background,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.dividerColor),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Customer', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                        Text(
                          sale.customerName,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Original Sale Total', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                        Text(
                          '₹${sale.grandTotal.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                        ),
                      ],
                    ),
                    if (sale.returnedAmount > 0) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Already Returned', style: TextStyle(fontSize: 12, color: AppTheme.warning)),
                          Text(
                            '₹${sale.returnedAmount.toStringAsFixed(0)}',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.warning),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Remaining Returnable', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                        Text(
                          '₹${maxReturnable.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: AppTheme.primary),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Return Amount Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Return Amount (₹) *', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  TextButton.icon(
                    onPressed: _setFullReturn,
                    icon: const Icon(Icons.all_inclusive, size: 14),
                    label: const Text('Full Return', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              TextField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.primary),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  prefixStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.primary),
                  hintText: '0',
                  helperText: 'Max allowable: ₹${maxReturnable.toStringAsFixed(0)}',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 14),

              // Itemized return options (if items present)
              if (sale.items.isNotEmpty) ...[
                const Text(
                  'Returned Items (Optional Stock Restock)',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.background,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.dividerColor),
                  ),
                  child: Column(
                    children: sale.items.map((item) {
                      final currentRetQty = _returnedQtyPerItem[item.productId] ?? 0;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.productName,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                  Text(
                                    'Sold: ${item.quantity} • ₹${item.sellingPrice.toStringAsFixed(0)} ea',
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline, size: 20),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: currentRetQty > 0
                                      ? () => _updateItemQty(item.productId, currentRetQty - 1, item.sellingPrice)
                                      : null,
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  child: Text(
                                    '$currentRetQty',
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline, size: 20, color: AppTheme.primary),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: currentRetQty < item.quantity
                                      ? () => _updateItemQty(item.productId, currentRetQty + 1, item.sellingPrice)
                                      : null,
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // Refund Mode Selection
              const Text('Refund Settlement *', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _refundMode = 'REFUND_PAID'),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                        decoration: BoxDecoration(
                          color: _refundMode == 'REFUND_PAID' ? AppTheme.primaryLight : AppTheme.background,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _refundMode == 'REFUND_PAID' ? AppTheme.primary : AppTheme.dividerColor,
                            width: _refundMode == 'REFUND_PAID' ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(Icons.payments_outlined, size: 20, color: _refundMode == 'REFUND_PAID' ? AppTheme.primary : AppTheme.textMuted),
                            const SizedBox(height: 4),
                            Text(
                              'Refund Cash / UPI',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: _refundMode == 'REFUND_PAID' ? AppTheme.primary : AppTheme.textSecondary,
                              ),
                            ),
                            const Text(
                              'Pay out money',
                              style: TextStyle(fontSize: 10, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() => _refundMode = 'REDUCE_RECEIVABLE'),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                        decoration: BoxDecoration(
                          color: _refundMode == 'REDUCE_RECEIVABLE' ? AppTheme.primaryLight : AppTheme.background,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _refundMode == 'REDUCE_RECEIVABLE' ? AppTheme.primary : AppTheme.dividerColor,
                            width: _refundMode == 'REDUCE_RECEIVABLE' ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(Icons.account_balance_wallet_outlined, size: 20, color: _refundMode == 'REDUCE_RECEIVABLE' ? AppTheme.primary : AppTheme.textMuted),
                            const SizedBox(height: 4),
                            Text(
                              'Deduct Receivable',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: _refundMode == 'REDUCE_RECEIVABLE' ? AppTheme.primary : AppTheme.textSecondary,
                              ),
                            ),
                            const Text(
                              'Reduce customer balance',
                              style: TextStyle(fontSize: 10, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Sellable Restock Decision
              if (sale.items.isNotEmpty) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: _restoreStock ? AppTheme.successLight.withValues(alpha: 0.4) : AppTheme.warningLight.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _restoreStock ? AppTheme.success.withValues(alpha: 0.3) : AppTheme.warning.withValues(alpha: 0.3)),
                  ),
                  child: SwitchListTile(
                    value: _restoreStock,
                    onChanged: (val) => setState(() => _restoreStock = val),
                    title: Text(
                      _restoreStock ? 'Restock to Sellable Inventory' : 'Do NOT Restock (Damaged / Defective)',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: _restoreStock ? AppTheme.success : AppTheme.warning),
                    ),
                    subtitle: Text(
                      _restoreStock
                          ? 'Item quantities will be added back to available inventory.'
                          : 'Stock count will NOT increase. Damaged goods are excluded from sellable stock.',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                    ),
                    activeColor: AppTheme.success,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ],

              // Reason tags
              const Text('Return Reason', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: _commonReasons.map((reason) {
                  final isSel = _selectedReasonTag == reason;
                  return ChoiceChip(
                    label: Text(reason, style: TextStyle(fontSize: 11, color: isSel ? Colors.white : AppTheme.textPrimary)),
                    selected: isSel,
                    selectedColor: AppTheme.primary,
                    onSelected: (_) => _onReasonTagSelected(reason),
                    showCheckmark: false,
                  );
                }).toList(),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _reasonController,
                decoration: InputDecoration(
                  hintText: 'Notes or specific return reason...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 20),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _submitReturn,
                      icon: _isSubmitting
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.assignment_return, size: 18),
                      label: Text(_isSubmitting ? 'Processing...' : 'Confirm Return'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.warning,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
