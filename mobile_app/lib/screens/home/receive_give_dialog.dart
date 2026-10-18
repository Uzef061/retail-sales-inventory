import 'package:flutter/material.dart';
import '../../core/services/api_client.dart';
import '../../core/services/payment_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/customer.dart';
import '../../models/supplier.dart';

class ReceiveGiveDialog extends StatefulWidget {
  final String type; // 'RECEIVE' or 'GIVE'
  final VoidCallback onSuccess;

  const ReceiveGiveDialog({
    super.key,
    required this.type,
    required this.onSuccess,
  });

  @override
  State<ReceiveGiveDialog> createState() => _ReceiveGiveDialogState();
}

class _ReceiveGiveDialogState extends State<ReceiveGiveDialog> {
  final _formKey = GlobalKey<FormState>();
  final _partyNameController = TextEditingController();
  final _amountController = TextEditingController();
  final _refNumberController = TextEditingController();
  final _notesController = TextEditingController();

  final PaymentService _paymentService = PaymentService();
  final ApiClient _apiClient = ApiClient();

  String _selectedPaymentMethod = 'CASH';
  String? _selectedPartyId;
  bool _isLoading = false;
  bool _isLoadingParties = true;
  String? _errorMessage;

  List<Customer> _customers = [];
  List<Supplier> _suppliers = [];

  final String _idempotencyKey = 'pay_${DateTime.now().millisecondsSinceEpoch}';

  bool get isReceive => widget.type.toUpperCase() == 'RECEIVE';

  @override
  void initState() {
    super.initState();
    _loadParties();
  }

  @override
  void dispose() {
    _partyNameController.dispose();
    _amountController.dispose();
    _refNumberController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadParties() async {
    try {
      if (isReceive) {
        final res = await _apiClient.get('/api/customers?activeOnly=true');
        if (res is List && mounted) {
          setState(() {
            _customers = res.map((c) => Customer.fromJson(c as Map<String, dynamic>)).toList();
          });
        }
      } else {
        final res = await _apiClient.get('/api/suppliers?activeOnly=true');
        if (res is List && mounted) {
          setState(() {
            _suppliers = res.map((s) => Supplier.fromJson(s as Map<String, dynamic>)).toList();
          });
        }
      }
    } catch (e) {
      debugPrint('[PAYMENT_DIALOG] Parties load error: $e');
    } finally {
      if (mounted) setState(() => _isLoadingParties = false);
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _errorMessage = 'Please enter a valid amount greater than 0.');
      return;
    }

    final partyName = _partyNameController.text.trim();
    if (partyName.isEmpty) {
      setState(() => _errorMessage = 'Please enter or select a party name.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _paymentService.createPayment(
        type: widget.type,
        partyName: partyName,
        partyId: _selectedPartyId,
        partyType: isReceive ? 'CUSTOMER' : 'SUPPLIER',
        amount: amount,
        paymentMethod: _selectedPaymentMethod,
        referenceNumber: _refNumberController.text.trim(),
        notes: _notesController.text.trim(),
        idempotencyKey: _idempotencyKey,
      );

      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(isReceive ? 'Payment received recorded!' : 'Payment given recorded!'),
              ],
            ),
            backgroundColor: isReceive ? AppTheme.success : AppTheme.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('ApiException: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = isReceive ? AppTheme.success : const Color(0xFFD9534F);
    final actionLabel = isReceive ? 'Receive Payment (In)' : 'Give Payment (Out)';

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.cardBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: themeColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isReceive ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                      color: themeColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          actionLabel,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: themeColor,
                          ),
                        ),
                        Text(
                          isReceive ? 'Record money received from customer' : 'Record money paid to supplier',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppTheme.textSecondary),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(height: 24),

              // Error banner if any
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.errorLight,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.error.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: AppTheme.error, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Party Quick Pick Chips
              if (!_isLoadingParties && (isReceive ? _customers.isNotEmpty : _suppliers.isNotEmpty)) ...[
                Text(
                  isReceive ? 'Select Customer:' : 'Select Supplier:',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: isReceive
                        ? _customers.map((c) => _buildPartyChip(c.id, c.name)).toList()
                        : _suppliers.map((s) => _buildPartyChip(s.id, s.name)).toList(),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Party Name Input
              TextFormField(
                controller: _partyNameController,
                decoration: InputDecoration(
                  labelText: isReceive ? 'Customer / Party Name *' : 'Supplier / Party Name *',
                  prefixIcon: const Icon(Icons.person_outline, size: 20),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter party name';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Amount Input
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  labelText: 'Amount (₹) *',
                  prefixIcon: const Icon(Icons.currency_rupee, size: 20),
                  hintText: '0.00',
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: themeColor, width: 2),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Please enter an amount';
                  final num = double.tryParse(val.trim());
                  if (num == null || num <= 0) return 'Must be a positive amount';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Payment Method Choices
              const Text(
                'Payment Mode:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD'].map((mode) {
                  final isSelected = _selectedPaymentMethod == mode;
                  return ChoiceChip(
                    label: Text(
                      mode.replaceAll('_', ' '),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected ? Colors.white : AppTheme.textPrimary,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: themeColor,
                    backgroundColor: AppTheme.surface,
                    onSelected: (val) => setState(() => _selectedPaymentMethod = mode),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),

              // Reference / Bill Number
              TextFormField(
                controller: _refNumberController,
                decoration: const InputDecoration(
                  labelText: 'Reference / Invoice / Receipt # (Optional)',
                  prefixIcon: Icon(Icons.tag, size: 20),
                ),
              ),
              const SizedBox(height: 14),

              // Notes
              TextFormField(
                controller: _notesController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Notes / Remarks (Optional)',
                  prefixIcon: Icon(Icons.notes, size: 20),
                ),
              ),
              const SizedBox(height: 20),

              // Submit Button
              ElevatedButton(
                onPressed: _isLoading ? null : _handleSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: themeColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : Text(
                        isReceive ? 'Save Received Cash (In)' : 'Save Given Cash (Out)',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPartyChip(String id, String name) {
    final isSelected = _selectedPartyId == id;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(name, style: const TextStyle(fontSize: 12)),
        selected: isSelected,
        selectedColor: (isReceive ? AppTheme.success : AppTheme.primary).withValues(alpha: 0.2),
        onSelected: (val) {
          setState(() {
            if (val) {
              _selectedPartyId = id;
              _partyNameController.text = name;
            } else {
              _selectedPartyId = null;
            }
          });
        },
      ),
    );
  }
}
