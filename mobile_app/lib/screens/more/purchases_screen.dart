import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/product.dart';
import '../../models/purchase.dart';
import '../../models/supplier.dart';
import '../parties/supplier_ledger_screen.dart';
import 'return_purchase_dialog.dart';
import 'settings_screen.dart';

class _PurchaseLineItem {
  final Product product;
  int quantity;
  double costPrice;

  _PurchaseLineItem({
    required this.product,
    required this.quantity,
    required this.costPrice,
  });

  double get total => quantity * costPrice;
}

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiClient _apiClient = ApiClient();
  final DateFormat _dateFormat = DateFormat('dd MMM yyyy, hh:mm a');

  List<Product> _products = [];
  List<Supplier> _suppliers = [];
  List<Purchase> _purchases = [];

  // Form State
  Supplier? _selectedSupplier;
  final List<_PurchaseLineItem> _lineItems = [];

  Product? _itemSelectedProduct;
  final TextEditingController _itemQtyController = TextEditingController(text: '10');
  final TextEditingController _itemCostController = TextEditingController();

  String _paymentMode = 'UNPAID'; // 'UNPAID', 'PAID', 'PARTIALLY_PAID'
  final TextEditingController _amountPaidController = TextEditingController(text: '0');
  String _paymentMethod = 'CASH';
  final TextEditingController _refNumberController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  // Search in History
  final TextEditingController _historySearchController = TextEditingController();

  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isPurchases404 = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _initReferenceNumber();
    _loadInitialData();
  }

  void _initReferenceNumber() {
    _refNumberController.text = 'PO-${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}';
  }

  @override
  void dispose() {
    _tabController.dispose();
    _itemQtyController.dispose();
    _itemCostController.dispose();
    _amountPaidController.dispose();
    _refNumberController.dispose();
    _notesController.dispose();
    _historySearchController.dispose();
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
        if (_products.isNotEmpty && _itemSelectedProduct == null) {
          _itemSelectedProduct = _products.first;
          _itemCostController.text = _itemSelectedProduct!.costPrice.toStringAsFixed(0);
        }
      }

      // 2. Fetch suppliers
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
        _errorMessage = 'Could not load purchases data.';
        _isLoading = false;
      });
    }
  }

  void _addItemToCart() {
    if (_itemSelectedProduct == null) return;
    final qty = int.tryParse(_itemQtyController.text.trim()) ?? 0;
    final cost = double.tryParse(_itemCostController.text.trim()) ?? _itemSelectedProduct!.costPrice;

    if (qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid quantity greater than 0')),
      );
      return;
    }

    setState(() {
      final existingIdx = _lineItems.indexWhere((i) => i.product.id == _itemSelectedProduct!.id);
      if (existingIdx >= 0) {
        _lineItems[existingIdx].quantity += qty;
        _lineItems[existingIdx].costPrice = cost;
      } else {
        _lineItems.add(_PurchaseLineItem(
          product: _itemSelectedProduct!,
          quantity: qty,
          costPrice: cost,
        ));
      }
      _syncAmountPaid();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added $qty x ${_itemSelectedProduct!.name} to order'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  double get _subtotal => _lineItems.fold<double>(0.0, (sum, i) => sum + i.total);

  void _syncAmountPaid() {
    if (_paymentMode == 'PAID') {
      _amountPaidController.text = _subtotal.toStringAsFixed(0);
    } else if (_paymentMode == 'UNPAID') {
      _amountPaidController.text = '0';
    }
  }

  Future<void> _showSupplierPicker() async {
    final searchController = TextEditingController();
    List<Supplier> filtered = List.from(_suppliers);

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (modalCtx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Select or Create Supplier',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Search bar
                  TextField(
                    controller: searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by supplier name or phone...',
                      prefixIcon: const Icon(Icons.search),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onChanged: (val) {
                      final q = val.toLowerCase().trim();
                      setModalState(() {
                        filtered = _suppliers.where((s) {
                          return s.name.toLowerCase().contains(q) || s.phone.toLowerCase().contains(q);
                        }).toList();
                      });
                    },
                  ),
                  const SizedBox(height: 10),

                  // Fast Create Supplier Button
                  OutlinedButton.icon(
                    onPressed: () async {
                      await _showQuickCreateSupplierDialog(modalCtx, searchController.text.trim());
                      setModalState(() {
                        filtered = List.from(_suppliers);
                      });
                    },
                    icon: const Icon(Icons.person_add_alt_1, size: 18),
                    label: const Text('+ Add New Supplier Without Leaving'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Suppliers list
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No matching suppliers found.', style: TextStyle(color: AppTheme.textSecondary)),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (_, idx) {
                              final s = filtered[idx];
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: AppTheme.secondary.withValues(alpha: 0.1),
                                  child: Text(
                                    s.name.isNotEmpty ? s.name[0].toUpperCase() : 'S',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.secondary),
                                  ),
                                ),
                                title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: Text(s.phone.isNotEmpty ? s.phone : 'No Phone', style: const TextStyle(fontSize: 12)),
                                trailing: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: s.isOwed
                                        ? AppTheme.errorLight
                                        : (s.isAdvance ? AppTheme.success.withValues(alpha: 0.15) : Colors.grey.shade100),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    s.balanceLabel,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: s.isOwed
                                        ? AppTheme.error
                                        : (s.isAdvance ? AppTheme.success : AppTheme.textSecondary),
                                    ),
                                  ),
                                ),
                                onTap: () {
                                  setState(() => _selectedSupplier = s);
                                  Navigator.of(ctx).pop();
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showQuickCreateSupplierDialog(BuildContext parentCtx, String prefilledText) async {
    final nameCtrl = TextEditingController(text: prefilledText.isNotEmpty && int.tryParse(prefilledText) == null ? prefilledText : '');
    final phoneCtrl = TextEditingController(text: prefilledText.isNotEmpty && int.tryParse(prefilledText) != null ? prefilledText : '');
    final contactCtrl = TextEditingController();
    bool isSaving = false;
    String? dialogErr;

    await showDialog(
      context: context,
      builder: (dCtx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Add New Supplier', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (dialogErr != null) ...[
                  Text(dialogErr!, style: const TextStyle(color: AppTheme.error, fontSize: 12)),
                  const SizedBox(height: 8),
                ],
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Supplier / Business Name *',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number *',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: contactCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Contact Person (Optional)',
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
                      final n = nameCtrl.text.trim();
                      final p = phoneCtrl.text.trim();
                      if (n.isEmpty || p.isEmpty) {
                        setDState(() => dialogErr = 'Supplier Name and Phone are required.');
                        return;
                      }

                      setDState(() {
                        isSaving = true;
                        dialogErr = null;
                      });

                      try {
                        final res = await _apiClient.post(ApiConfig.suppliers, {
                          'name': n,
                          'phone': p,
                          'contactPerson': contactCtrl.text.trim(),
                        });

                        final createdSup = Supplier.fromJson(res as Map<String, dynamic>);
                        setState(() {
                          _suppliers.insert(0, createdSup);
                          _selectedSupplier = createdSup;
                        });

                        if (dCtx.mounted) Navigator.of(dCtx).pop();
                        if (parentCtx.mounted) Navigator.of(parentCtx).pop();

                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Supplier "$n" created & linked!'),
                              backgroundColor: AppTheme.success,
                            ),
                          );
                        }
                      } on ApiException catch (e) {
                        setDState(() {
                          isSaving = false;
                          dialogErr = e.message;
                        });
                      } catch (_) {
                        setDState(() {
                          isSaving = false;
                          dialogErr = 'Failed to create supplier.';
                        });
                      }
                    },
              child: isSaving
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save & Select'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitPurchaseOrder() async {
    if (_lineItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one product item to the order.')),
      );
      return;
    }

    final total = _subtotal;
    double paid = double.tryParse(_amountPaidController.text.trim()) ?? 0.0;
    if (_paymentMode == 'PAID') {
      paid = total;
    } else if (_paymentMode == 'UNPAID') {
      paid = 0.0;
    }

    setState(() => _isSubmitting = true);

    final itemsPayload = _lineItems.map((item) => {
      'product': item.product.id,
      'quantity': item.quantity,
      'costPrice': item.costPrice,
      'unitCostPrice': item.costPrice,
      'totalCost': item.total,
    }).toList();

    final payload = {
      if (_selectedSupplier != null) 'supplier': _selectedSupplier!.id,
      if (_selectedSupplier != null) 'supplierName': _selectedSupplier!.name,
      if (_selectedSupplier != null) 'supplierPhone': _selectedSupplier!.phone,
      'items': itemsPayload,
      'quantity': _lineItems.fold<int>(0, (sum, i) => sum + i.quantity),
      'costPrice': _lineItems.first.costPrice,
      'subtotal': total,
      'grandTotal': total,
      'totalCost': total,
      'amountPaid': paid,
      'paymentMethod': _paymentMethod,
      'referenceNumber': _refNumberController.text.trim(),
      'notes': _notesController.text.trim(),
      'idempotencyKey': 'po_${DateTime.now().millisecondsSinceEpoch}_${_refNumberController.text.trim()}',
    };

    try {
      await _apiClient.post(ApiConfig.purchases, payload);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Purchase Order ${_refNumberController.text.trim()} recorded! Inventory restocked & supplier ledger updated.',
          ),
          backgroundColor: AppTheme.success,
        ),
      );

      setState(() {
        _lineItems.clear();
        _selectedSupplier = null;
        _notesController.clear();
        _paymentMode = 'UNPAID';
        _amountPaidController.text = '0';
        _initReferenceNumber();
      });

      _loadInitialData();
      _tabController.animateTo(1); // Switch to history tab to view recorded PO
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

  Future<void> _confirmAndDeletePurchase(Purchase pu) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Purchase Order?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to delete purchase "${pu.referenceNumber ?? pu.id}"?',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Text('• Deducts ${pu.quantity} unit(s) from current product stock.'),
            Text('• Reverses ₹${pu.totalCost.toStringAsFixed(0)} from supplier balance and ledger.'),
            const SizedBox(height: 6),
            const Text(
              '• Note: If received items were already sold, deletion is safely blocked by the server to prevent negative inventory.',
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
            child: const Text('Delete Purchase'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _apiClient.delete('${ApiConfig.purchases}/${pu.id}');
      _loadInitialData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Purchase deleted and inventory reversed successfully.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppTheme.error,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete purchase order.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  void _openReturnDialog(Purchase pu) {
    showDialog(
      context: context,
      builder: (_) => ReturnPurchaseDialog(
        purchase: pu,
        onReturnProcessed: _loadInitialData,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchases & Restock'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadInitialData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.add_shopping_cart, size: 16),
                  const SizedBox(width: 8),
                  const Text('New Purchase'),
                  if (_lineItems.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    CircleAvatar(
                      radius: 10,
                      backgroundColor: AppTheme.primary,
                      child: Text(
                        '${_lineItems.length}',
                        style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.history, size: 16),
                  const SizedBox(width: 8),
                  Text('History (${_purchases.length})'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildNewPurchaseView(),
                _buildHistoryView(),
              ],
            ),
    );
  }

  Widget _buildNewPurchaseView() {
    final total = _subtotal;
    double paid = double.tryParse(_amountPaidController.text.trim()) ?? 0.0;
    if (_paymentMode == 'PAID') {
      paid = total;
    } else if (_paymentMode == 'UNPAID') {
      paid = 0.0;
    }
    final remainingPayable = (total - paid).clamp(0.0, total);

    return RefreshIndicator(
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
                  const Text('Purchases API Pending Cloud Deployment', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text('The backend is ready locally (http://10.0.2.2:5000). Switch to local host in Settings.', style: TextStyle(fontSize: 12)),
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
                    child: const Text('Open Settings'),
                  ),
                ],
              ),
            ),
          ],

          // 1. Supplier Selector Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        '1. Supplier Vendor *',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary),
                      ),
                      TextButton.icon(
                        onPressed: _showSupplierPicker,
                        icon: const Icon(Icons.search, size: 16),
                        label: Text(_selectedSupplier == null ? 'Select Supplier' : 'Change'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  if (_selectedSupplier != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppTheme.secondary.withValues(alpha: 0.1),
                            child: Text(
                              _selectedSupplier!.name[0].toUpperCase(),
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.secondary),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_selectedSupplier!.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                Text(
                                  'Phone: ${_selectedSupplier!.phone.isNotEmpty ? _selectedSupplier!.phone : 'N/A'}',
                                  style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: _selectedSupplier!.isOwed
                                  ? AppTheme.errorLight
                                  : (_selectedSupplier!.isAdvance ? AppTheme.success.withValues(alpha: 0.15) : Colors.grey.shade100),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              _selectedSupplier!.balanceLabel,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _selectedSupplier!.isOwed
                                    ? AppTheme.error
                                    : (_selectedSupplier!.isAdvance ? AppTheme.success : AppTheme.textSecondary),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    InkWell(
                      onTap: _showSupplierPicker,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.business_outlined, color: AppTheme.textSecondary, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Tap to search & select or create supplier vendor...',
                                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                              ),
                            ),
                            Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.textMuted),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 2. Add Product Line Items Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '2. Add Purchased Products *',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 12),

                  if (_products.isNotEmpty) ...[
                    DropdownButtonFormField<Product>(
                      value: _itemSelectedProduct,
                      decoration: const InputDecoration(
                        labelText: 'Select Product Item',
                        prefixIcon: Icon(Icons.inventory_2_outlined, size: 20),
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: _products.map((p) {
                        return DropdownMenuItem<Product>(
                          value: p,
                          child: Text('${p.name} (Stock: ${p.stock})', style: const TextStyle(fontSize: 13)),
                        );
                      }).toList(),
                      onChanged: (p) {
                        setState(() {
                          _itemSelectedProduct = p;
                          if (p != null) {
                            _itemCostController.text = p.costPrice.toStringAsFixed(0);
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _itemQtyController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Quantity',
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _itemCostController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(
                              labelText: 'Unit Cost',
                              prefixText: '₹ ',
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _addItemToCart,
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Add Item to Order'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ],

                  if (_lineItems.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    const Divider(height: 1),
                    const SizedBox(height: 10),
                    const Text(
                      'Order Line Items:',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    ..._lineItems.map((item) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                  Text(
                                    '${item.quantity} units @ ₹${item.costPrice.toStringAsFixed(0)}',
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '₹${item.total.toStringAsFixed(0)}',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                            ),
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, size: 18, color: AppTheme.error),
                              onPressed: () {
                                setState(() {
                                  _lineItems.remove(item);
                                  _syncAmountPaid();
                                });
                              },
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 3. Payment & Settlement Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '3. Payment & Settlement *',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 10),

                  // Mode Chips: UNPAID (Credit), PAID (Full), PARTIALLY_PAID
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'UNPAID',
                        label: Text('Credit (Unpaid)', style: TextStyle(fontSize: 11)),
                      ),
                      ButtonSegment(
                        value: 'PAID',
                        label: Text('Paid in Full', style: TextStyle(fontSize: 11)),
                      ),
                      ButtonSegment(
                        value: 'PARTIALLY_PAID',
                        label: Text('Partial', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                    selected: {_paymentMode},
                    onSelectionChanged: (val) {
                      setState(() {
                        _paymentMode = val.first;
                        _syncAmountPaid();
                      });
                    },
                  ),
                  const SizedBox(height: 12),

                  if (_paymentMode == 'PARTIALLY_PAID') ...[
                    TextFormField(
                      controller: _amountPaidController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Amount Paid Now (₹) *',
                        prefixText: '₹ ',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 12),
                  ],

                  if (_paymentMode != 'UNPAID') ...[
                    DropdownButtonFormField<String>(
                      value: _paymentMethod,
                      decoration: const InputDecoration(
                        labelText: 'Payment Mode',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'CASH', child: Text('Cash')),
                        DropdownMenuItem(value: 'UPI', child: Text('UPI / Google Pay')),
                        DropdownMenuItem(value: 'BANK', child: Text('Bank Transfer (NEFT/IMPS)')),
                        DropdownMenuItem(value: 'CHEQUE', child: Text('Cheque')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _paymentMethod = val);
                      },
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Notes / PO Ref
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _refNumberController,
                          decoration: const InputDecoration(
                            labelText: 'PO Reference #',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _notesController,
                          decoration: const InputDecoration(
                            labelText: 'Notes (Optional)',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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

          // 4. Financial Summary Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Purchase Order:', style: TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
                    Text('₹${total.toStringAsFixed(0)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Amount Paid Now:', style: TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
                    Text(
                      '₹${paid.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.success),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Divider(height: 1),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Added to Supplier Payable (TO PAY):',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                    Text(
                      '₹${remainingPayable.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: remainingPayable > 0 ? AppTheme.error : AppTheme.success,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Complete Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _submitPurchaseOrder,
              icon: _isSubmitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_circle_outline, size: 20),
              label: Text(
                _isSubmitting ? 'Recording Purchase...' : 'Confirm Restock & Update Stock • ₹${total.toStringAsFixed(0)}',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildHistoryView() {
    final q = _historySearchController.text.toLowerCase().trim();
    final filtered = _purchases.where((pu) {
      if (q.isEmpty) return true;
      final prodMatch = pu.productName.toLowerCase().contains(q);
      final suppMatch = pu.supplierName.toLowerCase().contains(q);
      final refMatch = (pu.referenceNumber ?? '').toLowerCase().contains(q);
      return prodMatch || suppMatch || refMatch;
    }).toList();

    return RefreshIndicator(
      onRefresh: _loadInitialData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Search box
          TextField(
            controller: _historySearchController,
            decoration: InputDecoration(
              hintText: 'Search purchase orders by supplier, product or PO#...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              suffixIcon: _historySearchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () => setState(() => _historySearchController.clear()),
                    )
                  : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),

          if (filtered.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.inventory_2_outlined, size: 40, color: AppTheme.textMuted),
                      const SizedBox(height: 10),
                      Text(
                        _purchases.isEmpty ? 'No purchase orders recorded yet' : 'No matching purchase orders found',
                        style: const TextStyle(color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            ...filtered.map((pu) {
              Color payBadgeColor;
              Color payTextColor;
              String payText = pu.paymentStatus;

              if (pu.isPaid) {
                payBadgeColor = AppTheme.success.withValues(alpha: 0.15);
                payTextColor = AppTheme.success;
                payText = 'PAID IN FULL';
              } else if (pu.isPartiallyPaid) {
                payBadgeColor = Colors.orange.shade50;
                payTextColor = Colors.orange.shade800;
                payText = 'PARTIAL (PAID ₹${pu.amountPaid.toStringAsFixed(0)})';
              } else {
                payBadgeColor = AppTheme.errorLight;
                payTextColor = AppTheme.error;
                payText = 'CREDIT (UNPAID)';
              }

              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            pu.referenceNumber ?? 'PO-${pu.id.substring(0, 6)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                          ),
                          Text(
                            _dateFormat.format(pu.purchaseDate),
                            style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),

                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  pu.productName,
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    const Icon(Icons.business, size: 13, color: AppTheme.textMuted),
                                    const SizedBox(width: 4),
                                    Text(
                                      pu.supplierName,
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Restocked: +${pu.quantity} units @ ₹${pu.costPrice.toStringAsFixed(0)}',
                                  style: const TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹${pu.totalCost.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                              ),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: payBadgeColor,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  payText,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: payTextColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                      if (pu.returnedAmount > 0) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.amber.shade200),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.rotate_left, size: 14, color: Colors.orange),
                              const SizedBox(width: 6),
                              Text(
                                'Goods Returned: ₹${pu.returnedAmount.toStringAsFixed(0)} • Remaining: ₹${pu.remainingReturnable.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.orange),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 10),
                      const Divider(height: 1),
                      const SizedBox(height: 6),

                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (pu.supplierId != null) ...[
                            TextButton.icon(
                              onPressed: () {
                                final sup = _suppliers.firstWhere(
                                  (s) => s.id == pu.supplierId,
                                  orElse: () => Supplier(id: pu.supplierId!, name: pu.supplierName, phone: ''),
                                );
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => SupplierLedgerScreen(supplier: sup)),
                                );
                              },
                              icon: const Icon(Icons.receipt_long, size: 15),
                              label: const Text('View Ledger', style: TextStyle(fontSize: 12)),
                              style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                            ),
                          ] else
                            const SizedBox.shrink(),

                          Row(
                            children: [
                              if (pu.canReturn) ...[
                                TextButton.icon(
                                  onPressed: () => _openReturnDialog(pu),
                                  icon: const Icon(Icons.rotate_left, size: 15, color: Colors.orange),
                                  label: const Text('Return', style: TextStyle(fontSize: 12, color: Colors.orange)),
                                  style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                ),
                                const SizedBox(width: 6),
                              ],
                              TextButton.icon(
                                onPressed: () => _confirmAndDeletePurchase(pu),
                                icon: const Icon(Icons.delete_outline, size: 15, color: AppTheme.error),
                                label: const Text('Delete', style: TextStyle(fontSize: 12, color: AppTheme.error)),
                                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
