import 'package:flutter/material.dart';
import '../../core/services/business_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_helper.dart';
import '../../models/business_profile.dart';

class BusinessProfileScreen extends StatefulWidget {
  const BusinessProfileScreen({super.key});

  @override
  State<BusinessProfileScreen> createState() => _BusinessProfileScreenState();
}

class _BusinessProfileScreenState extends State<BusinessProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _businessService = BusinessService();

  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  final _businessNameController = TextEditingController();
  final _ownerNameController = TextEditingController();
  final _categoryController = TextEditingController();
  final _phoneController = TextEditingController();
  final _currencyController = TextEditingController(text: CurrencyHelper.code);
  final _taxNumberController = TextEditingController();
  final _receiptHeaderController = TextEditingController();
  final _receiptFooterController = TextEditingController();

  final List<String> _categories = [
    'General Retail',
    'Grocery & Mart',
    'Electronics & Mobile',
    'Clothing & Apparel',
    'Pharmacy & Medical',
    'Hardware & Tools',
    'Wholesale Distribution',
    'Other Business',
  ];

  final List<Map<String, String>> _currencies = [
    {'code': 'NPR', 'label': 'Nepalese Rupee (NPR — रू)', 'name': 'Nepalese Rupee', 'symbol': 'रू'},
    {'code': 'INR', 'label': 'Indian Rupee (INR — ₹)', 'name': 'Indian Rupee', 'symbol': '₹'},
    {'code': 'PKR', 'label': 'Pakistani Rupee (PKR — Rs)', 'name': 'Pakistani Rupee', 'symbol': 'Rs'},
    {'code': 'USD', 'label': 'US Dollar (USD — \$)', 'name': 'US Dollar', 'symbol': '\$'},
    {'code': 'EUR', 'label': 'Euro (EUR — €)', 'name': 'Euro', 'symbol': '€'},
    {'code': 'GBP', 'label': 'British Pound (GBP — £)', 'name': 'British Pound', 'symbol': '£'},
    {'code': 'AED', 'label': 'UAE Dirham (AED)', 'name': 'UAE Dirham', 'symbol': 'AED'},
    {'code': 'SAR', 'label': 'Saudi Riyal (SAR)', 'name': 'Saudi Riyal', 'symbol': 'SAR'},
  ];

  String get _selectedCurrencyCode {
    final cur = _currencyController.text.trim();
    if (_currencies.any((c) => c['code'] == cur)) return cur;
    if (_currencies.any((c) => c['label'] == cur)) {
      return _currencies.firstWhere((c) => c['label'] == cur)['code']!;
    }
    final upper = cur.toUpperCase();
    if (_currencies.any((c) => c['code'] == upper)) return upper;
    if (cur == 'रू' || cur == 'NRs' || upper.contains('NPR') || upper.contains('NEPAL') || cur.contains('रू')) return 'NPR';
    if (cur == '₹' || upper.contains('INR') || upper.contains('INDIA') || cur.contains('₹')) return 'INR';
    if (cur == '₨' || cur == 'Rs' || cur == 'Rs.' || upper.contains('PKR') || upper.contains('PAKISTAN')) return 'PKR';
    if (cur == '\$' || upper.contains('USD') || upper.contains('DOLLAR')) return 'USD';
    if (cur == '€' || upper.contains('EUR') || upper.contains('EURO')) return 'EUR';
    if (cur == '£' || upper.contains('GBP') || upper.contains('POUND')) return 'GBP';
    if (upper.contains('AED') || upper.contains('DIRHAM')) return 'AED';
    if (upper.contains('SAR') || upper.contains('RIYAL')) return 'SAR';
    return 'INR';
  }

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _businessNameController.dispose();
    _ownerNameController.dispose();
    _categoryController.dispose();
    _phoneController.dispose();
    _currencyController.dispose();
    _taxNumberController.dispose();
    _receiptHeaderController.dispose();
    _receiptFooterController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final profile = await _businessService.getProfile();
      _populateFields(profile);
      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load business profile: $e';
        _isLoading = false;
      });
    }
  }

  void _populateFields(BusinessProfile profile) {
    _businessNameController.text = profile.businessName;
    _ownerNameController.text = profile.ownerName;
    _categoryController.text = profile.category;
    _phoneController.text = profile.phone;
    final curr = profile.currencyCode.isNotEmpty
        ? profile.currencyCode
        : (profile.currency.isNotEmpty ? profile.currency : 'INR');
    _currencyController.text = curr;
    CurrencyHelper.setCurrency(curr);
    _taxNumberController.text = profile.taxNumber;
    _receiptHeaderController.text = profile.receiptHeader;
    _receiptFooterController.text = profile.receiptFooter.isNotEmpty
        ? profile.receiptFooter
        : 'Thank you for your business! Please visit again.';
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final updated = await _businessService.updateProfile(
        businessName: _businessNameController.text.trim(),
        ownerName: _ownerNameController.text.trim(),
        category: _categoryController.text.trim(),
        phone: _phoneController.text.trim(),
        currency: _selectedCurrencyCode,
        taxNumber: _taxNumberController.text.trim(),
        receiptHeader: _receiptHeaderController.text.trim(),
        receiptFooter: _receiptFooterController.text.trim(),
      );

      _populateFields(updated);
      CurrencyHelper.setCurrency(_selectedCurrencyCode);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Business profile saved successfully!'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save profile: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Business Profile'),
        actions: [
          if (!_isLoading)
            TextButton.icon(
              onPressed: _isSaving ? null : _saveProfile,
              icon: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check, color: Colors.white),
              label: const Text('Save', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                        ElevatedButton(onPressed: _loadProfile, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Header Card
                      Card(
                        color: AppTheme.primaryLight,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.2)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: AppTheme.primary,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.storefront, color: Colors.white, size: 30),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _businessNameController.text.isNotEmpty
                                          ? _businessNameController.text
                                          : 'My Retail Store',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textPrimary),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _categoryController.text.isNotEmpty
                                          ? _categoryController.text
                                          : 'Retail Business Management',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Section 1: Business Details
                      const Text(
                        'STORE DETAILS',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _businessNameController,
                        decoration: const InputDecoration(
                          labelText: 'Business / Store Name *',
                          prefixIcon: Icon(Icons.store),
                          border: OutlineInputBorder(),
                        ),
                        validator: (val) => (val == null || val.trim().isEmpty) ? 'Store name is required' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _ownerNameController,
                        decoration: const InputDecoration(
                          labelText: 'Owner / Manager Name',
                          prefixIcon: Icon(Icons.person_outline),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<String>(
                        value: _categories.contains(_categoryController.text)
                            ? _categoryController.text
                            : _categories.first,
                        decoration: const InputDecoration(
                          labelText: 'Business Category',
                          prefixIcon: Icon(Icons.category_outlined),
                          border: OutlineInputBorder(),
                        ),
                        items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _categoryController.text = val);
                        },
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Business Phone / WhatsApp',
                          prefixIcon: Icon(Icons.phone_outlined),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Section 2: Financial & Tax Info
                      const Text(
                        'FINANCIAL & TAX SETTINGS',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        value: _selectedCurrencyCode,
                        decoration: const InputDecoration(
                          labelText: 'Default Currency',
                          prefixIcon: Icon(Icons.payments_outlined),
                          border: OutlineInputBorder(),
                        ),
                        items: _currencies
                            .map((c) => DropdownMenuItem(value: c['code'], child: Text(c['label']!)))
                            .toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _currencyController.text = val);
                            CurrencyHelper.setCurrency(val);
                          }
                        },
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _taxNumberController,
                        decoration: const InputDecoration(
                          labelText: 'Tax Number / NTN / GST',
                          prefixIcon: Icon(Icons.receipt_outlined),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Section 3: Receipt Branding
                      const Text(
                        'RECEIPT & INVOICE BRANDING',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 10),
                      TextFormField(
                        controller: _receiptHeaderController,
                        decoration: const InputDecoration(
                          labelText: 'Receipt Header Note (Optional)',
                          prefixIcon: Icon(Icons.format_quote_outlined),
                          border: OutlineInputBorder(),
                          hintText: 'e.g. Welcome to our store!',
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _receiptFooterController,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Receipt Footer / Return Policy',
                          prefixIcon: Icon(Icons.message_outlined),
                          border: OutlineInputBorder(),
                          hintText: 'e.g. Thank you for your business! Items returnable within 7 days with bill.',
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Save Button
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _isSaving ? null : _saveProfile,
                        icon: _isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.save),
                        label: Text(_isSaving ? 'Saving Changes...' : 'Save Business Profile'),
                      ),
                    ],
                  ),
                ),
    );
  }
}
