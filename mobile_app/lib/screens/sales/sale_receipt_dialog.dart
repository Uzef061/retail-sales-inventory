import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/services/api_client.dart';
import '../../core/services/sales_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sale.dart';
import 'return_sale_dialog.dart';

class SaleReceiptDialog extends StatelessWidget {
  final Sale sale;
  final VoidCallback? onReturnProcessed;
  final VoidCallback? onSaleDeleted;

  const SaleReceiptDialog({
    super.key,
    required this.sale,
    this.onReturnProcessed,
    this.onSaleDeleted,
  });

  Future<void> _handleDeleteSale(BuildContext context) async {
    if (sale.returnedAmount > 0) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cannot Delete Sale'),
          content: Text(
            'Sale "${sale.invoiceNumber}" has active returns (₹${sale.returnedAmount.toStringAsFixed(0)}).\n\n'
            'Please delete or reverse the sales returns first before deleting this sale.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete Sale ${sale.invoiceNumber}?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Are you sure you want to void / delete this sale?',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            if (sale.items.isNotEmpty)
              Text('• Restores ${sale.items.length} item(s) back into inventory.'),
            Text('• Deducts ₹${sale.grandTotal.toStringAsFixed(0)} from customer balance & reports.'),
            const SizedBox(height: 6),
            const Text(
              '• This action is permanent and cannot be undone.',
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
            child: const Text('Delete Sale'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final salesService = SalesService();
      await salesService.deleteSale(sale.id);
      if (context.mounted) {
        Navigator.of(context).pop();
        onSaleDeleted?.call();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sale deleted and stock restored successfully.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete sale.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy, hh:mm a');
    final formattedDate = dateFormat.format(sale.saleDate);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Store Header
              Center(
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.receipt_long, color: AppTheme.primary, size: 28),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Retail Sales & Inventory',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
              ),
              const Text(
                'TAX INVOICE / RECEIPT',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textMuted, letterSpacing: 1),
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 10),

              // Invoice Details
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Invoice No:', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                  Text(
                    sale.invoiceNumber,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Date:', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                  Text(formattedDate, style: const TextStyle(fontSize: 12, color: AppTheme.textPrimary)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Customer:', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                  Text(
                    sale.customerName,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Payment Mode:', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.background,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.dividerColor),
                    ),
                    child: Text(
                      sale.paymentMethod,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),

              // Items Header
              const Row(
                children: [
                  Expanded(
                    flex: 5,
                    child: Text('ITEM', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted)),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text('QTY', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted)),
                  ),
                  Expanded(
                    flex: 3,
                    child: Text('AMOUNT', textAlign: TextAlign.end, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted)),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Items List
              ...sale.items.map((item) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.productName,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                            ),
                            Text(
                              '₹${item.sellingPrice.toStringAsFixed(0)} each',
                              style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          '${item.quantity}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          '₹${item.totalAmount.toStringAsFixed(0)}',
                          textAlign: TextAlign.end,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                        ),
                      ),
                    ],
                  ),
                );
              }),

              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),

              // Financial Totals
              if (sale.discount > 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Discount:', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    Text('-₹${sale.discount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 13, color: AppTheme.error)),
                  ],
                ),
                const SizedBox(height: 4),
              ],
              if (sale.tax > 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tax / GST:', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    Text('+₹${sale.tax.toStringAsFixed(0)}', style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                  ],
                ),
                const SizedBox(height: 4),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Grand Total:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
                  Text(
                    '₹${sale.grandTotal.toStringAsFixed(0)}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.primary),
                  ),
                ],
              ),
              if (sale.returnedAmount > 0) ...[
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Returned Amount:', style: TextStyle(fontSize: 13, color: AppTheme.warning)),
                    Text(
                      '-₹${sale.returnedAmount.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.warning),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Net Balance:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                    Text(
                      '₹${sale.remainingReturnable.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),

              // Status Tag
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: sale.isCancelled
                        ? AppTheme.errorLight
                        : (sale.isReturned || sale.isPartiallyReturned
                            ? AppTheme.warningLight
                            : AppTheme.successLight),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    sale.status,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: sale.isCancelled
                          ? AppTheme.error
                          : (sale.isReturned || sale.isPartiallyReturned
                              ? AppTheme.warning
                              : AppTheme.success),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Return Sale Button if applicable
              if (sale.canReturn) ...[
                OutlinedButton.icon(
                  onPressed: () async {
                    final res = await showDialog<bool>(
                      context: context,
                      builder: (_) => ReturnSaleDialog(sale: sale),
                    );
                    if (res == true && context.mounted) {
                      Navigator.of(context).pop();
                      onReturnProcessed?.call();
                    }
                  },
                  icon: const Icon(Icons.assignment_return, size: 16, color: AppTheme.warning),
                  label: const Text('Return Sale', style: TextStyle(color: AppTheme.warning, fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.warning),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Delete / Void Sale Button
              if (!sale.isCancelled) ...[
                OutlinedButton.icon(
                  onPressed: () => _handleDeleteSale(context),
                  icon: const Icon(Icons.delete_outline, size: 16, color: AppTheme.error),
                  label: const Text('Delete / Void Sale', style: TextStyle(color: AppTheme.error, fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.error),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Receipt ready for print / share')),
                        );
                      },
                      icon: const Icon(Icons.share, size: 16),
                      label: const Text('Share'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Close'),
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
