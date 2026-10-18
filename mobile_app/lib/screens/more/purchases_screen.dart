import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/product.dart';
import '../../models/purchase.dart';
import '../../models/supplier.dart';
import 'settings_screen.dart';

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  final ApiClient _apiClient = ApiClient();
  final _formKey = GlobalKey<FormState>();

  List<Product> _products = [];
  List<Supplier> _suppliers = [];
  List<Purchase> _purchases = [];

  Product? _selectedProduct;
  Supplier? _selectedSupplier;
  final TextEditingController _qtyController = TextEditingController(text: '10');
  final TextEditingController _costPriceController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isPurchases404 = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _qtyController.dispose();
    _costPriceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _isPurchases404 = false;
    });

    try {
      // 1. Fetch products
      final pRes = await _apiClient.get(ApiConfig.products);
      if (pRes is List) {
        _products = pRes.map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
        if (_products.isNotEmpty && _selectedProduct == null) {
          _selectedProduct = _products.first;
          _costPriceController.text = _selectedProduct!.costPrice.toStringAsFixed(0);
        }
      }

      // 2. Fetch suppliers (may 404 on older deployed Render commit)
      try {
        final sRes = await _apiClient.get(ApiConfig.suppliers);
        if (sRes is List) {
          _suppliers = sRes.map((s) => Supplier.fromJson(s as Map<String, dynamic>)).toList();
        }
      } catch (_) {
        _suppliers = [];
      }

      // 3. Fetch purchases
      try {
        final purRes = await _apiClient.get(ApiConfig.purchases);
        if (purRes is List) {
          _purchases = purRes.map((pu) => Purchase.fromJson(pu as Map<String, dynamic>)).toList();
        }
      } on ApiException catch (e) {
        if (e.isNotFound) {
          _isPurchases404 = true;
        } else {
          _errorMessage = e.message;
        }
      }

      setState(() => _isLoading = false);
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load data.';
        _isLoading = false;
      });
    }
  }

  Future<void> _submitPurchase() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a product to restock.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final qty = int.tryParse(_qtyController.text) ?? 1;
    final cost = double.tryParse(_costPriceController.text) ?? _selectedProduct!.costPrice;

    final payload = {
      'product': _selectedProduct!.id,
      'quantity': qty,
      'costPrice': cost,
      if (_selectedSupplier != null) 'supplier': _selectedSupplier!.id,
      if (_notesController.text.trim().isNotEmpty) 'notes': _notesController.text.trim(),
    };

    try {
      await _apiClient.post(ApiConfig.purchases, payload);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Restocked $qty units of ${_selectedProduct!.name}! Inventory updated.'),
          backgroundColor: AppTheme.success,
        ),
      );

      _notesController.clear();
      _loadInitialData();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit purchase order.'), backgroundColor: AppTheme.error),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchases & Restock'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadInitialData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              onRefresh: _loadInitialData,
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
                  if (_isPurchases404) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: AppTheme.warningLight,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.warning.withValues(alpha: 0.5)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.warning_amber_rounded, color: AppTheme.warning, size: 22),
                              SizedBox(width: 8),
                              Text(
                                'Restock API Awaiting Render Deployment',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'The Purchases & Restock API (/api/purchases) is fully functional on your local backend (http://10.0.2.2:5000) and updates MongoDB stock immediately. When connecting to the deployed cloud server, this route is waiting to be deployed.',
                            style: TextStyle(fontSize: 12, color: AppTheme.textSecondary, height: 1.4),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const SettingsScreen()),
                              );
                            },
                            icon: const Icon(Icons.settings, size: 16),
                            label: const Text('Switch to Local Host in Settings'),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Record Restock Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Record New Purchase / Restock',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                            ),
                            const SizedBox(height: 14),

                            // Product selection
                            if (_products.isNotEmpty)
                              DropdownButtonFormField<Product>(
                                initialValue: _selectedProduct,
                                decoration: const InputDecoration(
                                  labelText: 'Select Product *',
                                  prefixIcon: Icon(Icons.inventory_2_outlined, size: 20),
                                ),
                                items: _products.map((p) {
                                  return DropdownMenuItem<Product>(
                                    value: p,
                                    child: Text('${p.name} (Stock: ${p.stock})', style: const TextStyle(fontSize: 13)),
                                  );
                                }).toList(),
                                onChanged: (p) {
                                  setState(() {
                                    _selectedProduct = p;
                                    if (p != null) {
                                      _costPriceController.text = p.costPrice.toStringAsFixed(0);
                                    }
                                  });
                                },
                              ),
                            const SizedBox(height: 12),

                            // Supplier selection
                            DropdownButtonFormField<Supplier?>(
                              initialValue: _selectedSupplier,
                              decoration: const InputDecoration(
                                labelText: 'Supplier (Optional)',
                                prefixIcon: Icon(Icons.business_outlined, size: 20),
                              ),
                              items: [
                                const DropdownMenuItem<Supplier?>(
                                  value: null,
                                  child: Text('Direct / General Supplier', style: TextStyle(fontSize: 13)),
                                ),
                                ..._suppliers.map((s) {
                                  return DropdownMenuItem<Supplier?>(
                                    value: s,
                                    child: Text(s.name, style: const TextStyle(fontSize: 13)),
                                  );
                                }),
                              ],
                              onChanged: (s) => setState(() => _selectedSupplier = s),
                            ),
                            const SizedBox(height: 12),

                            // Quantity & Cost Price
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: _qtyController,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                      labelText: 'Quantity *',
                                      hintText: 'e.g. 10',
                                    ),
                                    validator: (v) => (v == null || int.tryParse(v) == null || int.parse(v) <= 0)
                                        ? 'Enter valid qty'
                                        : null,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextFormField(
                                    controller: _costPriceController,
                                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                    decoration: const InputDecoration(
                                      labelText: 'Unit Cost (₹) *',
                                      prefixText: '₹ ',
                                    ),
                                    validator: (v) => (v == null || double.tryParse(v) == null)
                                        ? 'Enter valid cost'
                                        : null,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // Notes
                            TextFormField(
                              controller: _notesController,
                              decoration: const InputDecoration(
                                labelText: 'Notes / Invoice Ref (Optional)',
                                hintText: 'e.g. PO-8821 batch',
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Submit Button
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: _isSubmitting ? null : _submitPurchase,
                                icon: _isSubmitting
                                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : const Icon(Icons.add_shopping_cart, size: 18),
                                label: const Text('Record Restock & Increase Stock'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // History Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Past Purchase Orders',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                      ),
                      Text(
                        '${_purchases.length} recorded',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // History List
                  if (_purchases.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Text(
                            _isPurchases404 ? 'Purchase history not available on this server' : 'No purchase records found',
                            style: const TextStyle(color: AppTheme.textSecondary),
                          ),
                        ),
                      ),
                    )
                  else
                    ..._purchases.map((pu) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(pu.productName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          subtitle: Text(
                            'Supplier: ${pu.supplierName} • ${dateFormat.format(pu.purchaseDate)}',
                            style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                          ),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '+${pu.quantity} units',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.success),
                              ),
                              Text(
                                '₹${pu.totalCost.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                              ),
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
}
