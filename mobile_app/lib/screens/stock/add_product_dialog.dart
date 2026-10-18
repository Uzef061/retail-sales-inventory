import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/product.dart';

class AddProductDialog extends StatefulWidget {
  final Product? existingProduct;
  final VoidCallback onSaved;

  const AddProductDialog({
    super.key,
    this.existingProduct,
    required this.onSaved,
  });

  @override
  State<AddProductDialog> createState() => _AddProductDialogState();
}

class _AddProductDialogState extends State<AddProductDialog> {
  final _formKey = GlobalKey<FormState>();
  final ApiClient _apiClient = ApiClient();

  late TextEditingController _nameController;
  late TextEditingController _categoryController;
  late TextEditingController _costPriceController;
  late TextEditingController _sellingPriceController;
  late TextEditingController _stockController;
  late TextEditingController _reorderController;
  late TextEditingController _skuController;

  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final p = widget.existingProduct;
    _nameController = TextEditingController(text: p?.name ?? '');
    _categoryController = TextEditingController(text: p?.category ?? 'Grocery');
    _costPriceController = TextEditingController(text: p != null ? p.costPrice.toStringAsFixed(0) : '50');
    _sellingPriceController = TextEditingController(text: p != null ? p.sellingPrice.toStringAsFixed(0) : '75');
    _stockController = TextEditingController(text: p != null ? p.stock.toString() : '20');
    _reorderController = TextEditingController(text: p != null ? p.reorderLevel.toString() : '10');
    _skuController = TextEditingController(text: p?.sku ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _categoryController.dispose();
    _costPriceController.dispose();
    _sellingPriceController.dispose();
    _stockController.dispose();
    _reorderController.dispose();
    _skuController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final payload = {
      'name': _nameController.text.trim(),
      'category': _categoryController.text.trim(),
      'costPrice': double.tryParse(_costPriceController.text) ?? 0.0,
      'sellingPrice': double.tryParse(_sellingPriceController.text) ?? 0.0,
      'price': double.tryParse(_sellingPriceController.text) ?? 0.0,
      'stock': int.tryParse(_stockController.text) ?? 0,
      'reorderLevel': int.tryParse(_reorderController.text) ?? 10,
      if (_skuController.text.trim().isNotEmpty) 'sku': _skuController.text.trim(),
    };

    try {
      if (widget.existingProduct != null) {
        await _apiClient.put('${ApiConfig.products}/${widget.existingProduct!.id}', payload);
      } else {
        await _apiClient.post(ApiConfig.products, payload);
      }

      widget.onSaved();
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.existingProduct != null ? 'Product updated' : 'Product created successfully'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to save product: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.existingProduct != null;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480),
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      isEditing ? 'Edit Product' : 'Add New Product',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
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
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: AppTheme.error, fontSize: 13),
                    ),
                  ),
                ],

                // Product Name
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Product Name *',
                    hintText: 'e.g. Basmati Rice 1kg',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                ),
                const SizedBox(height: 12),

                // Category
                TextFormField(
                  controller: _categoryController,
                  decoration: const InputDecoration(
                    labelText: 'Category *',
                    hintText: 'e.g. Grocery, Beverages, Snacks',
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Category is required' : null,
                ),
                const SizedBox(height: 12),

                // Cost & Selling Prices
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _costPriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Cost Price (₹)',
                          prefixText: '₹ ',
                        ),
                        validator: (v) => (v == null || double.tryParse(v) == null) ? 'Enter valid cost' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _sellingPriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Selling Price (₹) *',
                          prefixText: '₹ ',
                        ),
                        validator: (v) => (v == null || double.tryParse(v) == null) ? 'Enter valid price' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Stock & Reorder Level
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _stockController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Initial Stock *',
                          hintText: 'e.g. 25',
                        ),
                        validator: (v) => (v == null || int.tryParse(v) == null) ? 'Enter quantity' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _reorderController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Low Stock Alert At',
                          hintText: '10',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // SKU (optional)
                TextFormField(
                  controller: _skuController,
                  decoration: const InputDecoration(
                    labelText: 'SKU / Barcode (Optional)',
                    hintText: 'e.g. SKU-98213',
                  ),
                ),
                const SizedBox(height: 24),

                // Actions
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        child: _isLoading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(isEditing ? 'Update' : 'Save Product'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
