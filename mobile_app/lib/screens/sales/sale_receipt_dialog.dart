import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sale.dart';

class SaleReceiptDialog extends StatelessWidget {
  final Sale sale;

  const SaleReceiptDialog({super.key, required this.sale});

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
              const SizedBox(height: 16),

              // Status Tag
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: sale.isCancelled ? AppTheme.errorLight : AppTheme.successLight,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    sale.status,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: sale.isCancelled ? AppTheme.error : AppTheme.success,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

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
