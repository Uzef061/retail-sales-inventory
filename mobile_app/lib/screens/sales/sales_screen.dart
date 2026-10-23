import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/services/sales_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/customer.dart';
import '../../models/product.dart';
import '../../models/sale.dart';
import 'return_sale_dialog.dart';
import 'sale_receipt_dialog.dart';

class CartEntry {
  final Product product;
  int quantity;
  double customPrice;

  CartEntry({
    required this.product,
    this.quantity = 1,
    required this.customPrice,
  });

  double get lineTotal => quantity * customPrice;
  double get lineCost => quantity * product.costPrice;
  double get lineProfit => lineTotal - lineCost;
}

class SalesScreen extends StatefulWidget {
  final bool isSelected;
  const SalesScreen({super.key, this.isSelected = false});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiClient _apiClient = ApiClient();
  final SalesService _salesService = SalesService();

  // Mode: 0 = Fast Quick Sale (3-field rapid entry), 1 = POS Itemized Cart
  int _entryMode = 1;

  // Quick Sale State
  final TextEditingController _quickPhoneController = TextEditingController();
  final TextEditingController _quickNameController = TextEditingController();
  final TextEditingController _quickAmountController = TextEditingController();
  final TextEditingController _quickNotesController = TextEditingController();
  String _quickPaymentMethod = 'CASH'; // CASH, UPI, CARD, CREDIT
  Customer? _matchedCustomer;
  bool _isSavingQuickSale = false;
  String? _quickSaleIdempotencyKey;

  // Quick Sale Product-Based State
  int _quickSaleType = 0; // 0 = Amount-Only (Fast), 1 = With Products (Deduct Stock)
  final List<CartEntry> _quickItems = [];
  Product? _quickSelectedProduct;
  final TextEditingController _quickProductQtyController = TextEditingController(text: '1');
  final TextEditingController _quickProductPriceController = TextEditingController();

  // POS Itemized Cart State
  List<Product> _products = [];
  List<Customer> _customers = [];
  Customer? _selectedCustomer;
  final List<CartEntry> _cart = [];
  String _paymentMethod = 'CASH';
  final TextEditingController _discountController = TextEditingController(text: '0');
  final TextEditingController _taxController = TextEditingController(text: '0');
  final TextEditingController _productSearchController = TextEditingController();
  bool _isLoadingPos = true;
  String? _posError;
  bool _isCheckingOut = false;

  // Sales History State
  List<Sale> _sales = [];
  bool _isLoadingHistory = true;
  String? _historyError;
  final TextEditingController _historySearchController = TextEditingController();
  String _historyFilter = 'ALL'; // ALL, COMPLETED, RETURNED, CANCELLED

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _initQuickSaleIdempotency();
    _loadPosData();
    _loadSalesHistory();
  }

  void _initQuickSaleIdempotency() {
    _quickSaleIdempotencyKey = 'qs_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(999999)}';
  }

  @override
  void didUpdateWidget(covariant SalesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSelected && !oldWidget.isSelected) {
      _loadPosData();
      _loadSalesHistory();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _quickPhoneController.dispose();
    _quickNameController.dispose();
    _quickAmountController.dispose();
    _quickNotesController.dispose();
    _quickProductQtyController.dispose();
    _quickProductPriceController.dispose();
    _discountController.dispose();
    _taxController.dispose();
    _productSearchController.dispose();
    _historySearchController.dispose();
    super.dispose();
  }

  Future<void> _loadPosData() async {
    setState(() {
      _isLoadingPos = true;
      _posError = null;
    });

    try {
      dynamic pRes;
      dynamic cRes;

      try {
        pRes = await _apiClient.get(ApiConfig.products);
      } catch (e) {
        debugPrint('[SALES] Error fetching products: $e');
        rethrow;
      }

      try {
        cRes = await _apiClient.get(ApiConfig.customers);
      } catch (e) {
        debugPrint('[SALES] Non-fatal customer load warning: $e');
        cRes = <dynamic>[];
      }

      List<Product> prods = [];
      if (pRes is List) {
        prods = pRes.map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
      } else if (pRes is Map && pRes['products'] is List) {
        prods = (pRes['products'] as List).map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
      } else if (pRes is Map && pRes['data'] is List) {
        prods = (pRes['data'] as List).map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
      }

      List<Customer> custs = [];
      if (cRes is List) {
        custs = cRes.map((c) => Customer.fromJson(c as Map<String, dynamic>)).toList();
      } else if (cRes is Map && cRes['customers'] is List) {
        custs = (cRes['customers'] as List).map((c) => Customer.fromJson(c as Map<String, dynamic>)).toList();
      } else if (cRes is Map && cRes['data'] is List) {
        custs = (cRes['data'] as List).map((c) => Customer.fromJson(c as Map<String, dynamic>)).toList();
      }

      setState(() {
        _products = prods;
        _customers = custs;
        if (custs.isNotEmpty && _selectedCustomer == null) {
          _selectedCustomer = custs.first;
        }
        _isLoadingPos = false;
        _posError = null;
      });
    } on ApiException catch (e) {
      setState(() {
        _posError = e.message;
        _isLoadingPos = false;
      });
    } catch (_) {
      setState(() {
        _posError = 'Could not load products. Please check connection.';
        _isLoadingPos = false;
      });
    }
  }

  Future<void> _loadSalesHistory() async {
    setState(() {
      _isLoadingHistory = true;
      _historyError = null;
    });

    try {
      final res = await _apiClient.get(ApiConfig.sales);
      if (res is List) {
        final list = res.map((s) => Sale.fromJson(s as Map<String, dynamic>)).toList();
        setState(() {
          _sales = list;
          _isLoadingHistory = false;
        });
      } else {
        setState(() {
          _sales = [];
          _isLoadingHistory = false;
        });
      }
    } on ApiException catch (e) {
      setState(() {
        _historyError = e.message;
        _isLoadingHistory = false;
      });
    } catch (_) {
      setState(() {
        _historyError = 'Unable to load sales history.';
        _isLoadingHistory = false;
      });
    }
  }

  Future<void> _confirmAndDeleteSale(Sale s) async {
    if (s.returnedAmount > 0) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cannot Delete Sale'),
          content: Text(
            'Sale "${s.invoiceNumber}" has active returns (₹${s.returnedAmount.toStringAsFixed(0)}).\n\n'
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
        title: Text('Delete Sale ${s.invoiceNumber}?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Are you sure you want to void / delete this sale?',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            if (s.items.isNotEmpty)
              Text('• Restores ${s.items.length} item(s) back into inventory.'),
            Text('• Deducts ₹${s.grandTotal.toStringAsFixed(0)} from customer ledger & total sales.'),
            const SizedBox(height: 6),
            const Text(
              '• This action cannot be undone.',
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
      await _salesService.deleteSale(s.id);
      _loadSalesHistory();
      _loadPosData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sale deleted and stock restored successfully.'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete sale.'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  // --- Quick Sale Phone Auto-Lookup ---
  void _onQuickPhoneChanged(String val) {
    final clean = val.replaceAll(RegExp(r'\D'), '');
    if (clean.length >= 7) {
      final match = _customers.cast<Customer?>().firstWhere(
        (c) => c != null && c.phone.replaceAll(RegExp(r'\D'), '').endsWith(clean),
        orElse: () => null,
      );
      if (match != null) {
        setState(() {
          _matchedCustomer = match;
          _quickNameController.text = match.name;
        });
      } else {
        if (_matchedCustomer != null) {
          setState(() {
            _matchedCustomer = null;
          });
        }
      }
    } else {
      if (_matchedCustomer != null) {
        setState(() {
          _matchedCustomer = null;
        });
      }
    }
  }

  void _selectCustomerForQuickSale(Customer c) {
    setState(() {
      _matchedCustomer = c;
      _quickPhoneController.text = c.phone;
      _quickNameController.text = c.name;
    });
  }

  Future<void> _handleQuickSaleSave() async {
    if (_isSavingQuickSale) return;

    final phone = _quickPhoneController.text.trim();
    final name = _quickNameController.text.trim();

    if (phone.isEmpty && name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter customer phone or name.'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    double finalAmount = 0.0;
    List<Map<String, dynamic>>? itemsPayload;

    if (_quickSaleType == 1) {
      // Product-based quick sale
      // Ergonomic auto-add: if a product is selected in inputs but not yet explicitly pushed
      if (_quickSelectedProduct != null) {
        final qty = int.tryParse(_quickProductQtyController.text.trim()) ?? 0;
        final price = double.tryParse(_quickProductPriceController.text.trim()) ??
            (_quickSelectedProduct!.sellingPrice > 0 ? _quickSelectedProduct!.sellingPrice : _quickSelectedProduct!.price);
        if (qty > 0 && price >= 0) {
          final existingIdx = _quickItems.indexWhere((e) => e.product.id == _quickSelectedProduct!.id);
          if (existingIdx >= 0) {
            _quickItems[existingIdx].quantity = qty;
            _quickItems[existingIdx].customPrice = price;
          } else {
            _quickItems.add(CartEntry(
              product: _quickSelectedProduct!,
              quantity: qty,
              customPrice: price,
            ));
          }
        }
      }

      if (_quickItems.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select at least one product, or switch to Quick Amount mode.'),
            backgroundColor: AppTheme.error,
          ),
        );
        return;
      }

      // Check stock
      for (final item in _quickItems) {
        if (item.quantity > item.product.stock) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Insufficient stock for "${item.product.name}". Available: ${item.product.stock}, requested: ${item.quantity}'),
              backgroundColor: AppTheme.error,
            ),
          );
          return;
        }
      }

      finalAmount = _quickItems.fold<double>(0.0, (sum, i) => sum + i.lineTotal);

      itemsPayload = _quickItems.map((entry) => {
        'product': entry.product.id,
        'quantity': entry.quantity,
        'sellingPrice': entry.customPrice,
        'costPrice': entry.product.costPrice,
      }).toList();
    } else {
      // Amount-only quick sale
      final amountText = _quickAmountController.text.trim();
      finalAmount = double.tryParse(amountText) ?? 0.0;
      if (finalAmount <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please enter a valid sale amount greater than 0.'),
            backgroundColor: AppTheme.error,
          ),
        );
        return;
      }
      itemsPayload = null;
    }

    setState(() => _isSavingQuickSale = true);

    try {
      final effectivePaymentMethod = _quickPaymentMethod == 'CREDIT' ? 'OTHER' : _quickPaymentMethod;
      final amountReceived = _quickPaymentMethod == 'CREDIT' ? 0.0 : finalAmount;

      final createdSale = await _salesService.createSale(
        customerId: _matchedCustomer?.id,
        customerName: name.isNotEmpty ? name : 'Customer',
        customerPhone: phone,
        amount: finalAmount,
        amountReceived: amountReceived,
        paymentMethod: effectivePaymentMethod,
        items: itemsPayload,
        notes: _quickNotesController.text.trim(),
        idempotencyKey: _quickSaleIdempotencyKey,
      );

      // Reset form and generate fresh idempotency key
      setState(() {
        _quickPhoneController.clear();
        _quickNameController.clear();
        _quickAmountController.clear();
        _quickNotesController.clear();
        _quickProductQtyController.text = '1';
        _quickProductPriceController.clear();
        _quickSelectedProduct = null;
        _quickItems.clear();
        _matchedCustomer = null;
        _quickPaymentMethod = 'CASH';
        _initQuickSaleIdempotency();
      });

      // Reload customers and history
      _loadPosData();
      _loadSalesHistory();

      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => SaleReceiptDialog(
            sale: createdSale,
            onReturnProcessed: _loadSalesHistory,
            onSaleDeleted: () {
              _loadSalesHistory();
              _loadPosData();
            },
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        _loadPosData();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.isConflict
                ? '⚠️ ${e.message}'
                : e.message),
            backgroundColor: AppTheme.error,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to record sale. Please try again.'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingQuickSale = false);
    }
  }

  // --- POS Cart Logic ---
  void _addToCart(Product product) {
    if (product.stock <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${product.name} is out of stock!'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    final existingIdx = _cart.indexWhere((e) => e.product.id == product.id);
    if (existingIdx >= 0) {
      if (_cart[existingIdx].quantity < product.stock) {
        setState(() {
          _cart[existingIdx].quantity++;
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot add more. Available stock is ${product.stock}'),
            backgroundColor: AppTheme.warning,
          ),
        );
      }
    } else {
      setState(() {
        _cart.add(CartEntry(
          product: product,
          quantity: 1,
          customPrice: product.sellingPrice,
        ));
      });
    }
  }

  void _removeFromCart(int index) {
    setState(() {
      _cart.removeAt(index);
    });
  }

  void _changeQty(int index, int delta) {
    setState(() {
      final entry = _cart[index];
      final newQty = entry.quantity + delta;
      if (newQty <= 0) {
        _cart.removeAt(index);
      } else if (newQty <= entry.product.stock) {
        entry.quantity = newQty;
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Max available stock is ${entry.product.stock}'),
            backgroundColor: AppTheme.warning,
          ),
        );
      }
    });
  }

  double get _subtotal => _cart.fold(0.0, (sum, item) => sum + item.lineTotal);
  double get _discount => double.tryParse(_discountController.text) ?? 0.0;
  double get _tax => double.tryParse(_taxController.text) ?? 0.0;
  double get _grandTotal => (_subtotal - _discount + _tax).clamp(0.0, double.infinity);

  Future<void> _handlePosCheckout() async {
    if (_isCheckingOut) return;

    if (_cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty. Add products to proceed.')),
      );
      return;
    }

    if (_selectedCustomer == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select or create a customer profile.')),
      );
      return;
    }

    setState(() => _isCheckingOut = true);

    final itemsPayload = _cart.map((entry) => {
      'product': entry.product.id,
      'quantity': entry.quantity,
      'sellingPrice': entry.customPrice,
      'costPrice': entry.product.costPrice,
    }).toList();

    final payload = {
      'customer': _selectedCustomer!.id,
      'items': itemsPayload,
      'discount': _discount,
      'tax': _tax,
      'paymentMethod': _paymentMethod,
      'amountReceived': _grandTotal,
      'idempotencyKey': 'pos_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(999999)}',
    };

    try {
      final res = await _apiClient.post(ApiConfig.sales, payload);
      final createdSale = Sale.fromJson(res as Map<String, dynamic>);

      setState(() {
        _cart.clear();
        _discountController.text = '0';
        _taxController.text = '0';
      });

      _loadPosData();
      _loadSalesHistory();

      if (mounted) {
        showDialog(
          context: context,
          builder: (_) => SaleReceiptDialog(
            sale: createdSale,
            onReturnProcessed: _loadSalesHistory,
            onSaleDeleted: () {
              _loadSalesHistory();
              _loadPosData();
            },
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        _loadPosData();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.isConflict
                ? '⚠️ ${e.message}'
                : e.message),
            backgroundColor: AppTheme.error,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to complete sale.'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isCheckingOut = false);
    }
  }

  void _openReturnDialog(Sale sale) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => ReturnSaleDialog(sale: sale),
    );

    if (result == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sale return recorded successfully.'),
          backgroundColor: AppTheme.success,
        ),
      );
      _loadSalesHistory();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales & Ledger Billing'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              _loadPosData();
              _loadSalesHistory();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textSecondary,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('New Sale'),
                  if (_cart.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    CircleAvatar(
                      radius: 10,
                      backgroundColor: AppTheme.primary,
                      child: Text(
                        '${_cart.length}',
                        style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Tab(text: 'Sales History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildNewSaleView(),
          _buildHistoryView(),
        ],
      ),
    );
  }

  Widget _buildNewSaleView() {
    if (_isLoadingPos) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    if (_posError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppTheme.textMuted),
              const SizedBox(height: 12),
              Text(
                _posError!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadPosData,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        // Mode Switcher Banner
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppTheme.surface,
          child: Row(
            children: [
              Expanded(
                child: SegmentedButton<int>(
                  segments: const [
                    ButtonSegment<int>(
                      value: 1,
                      label: Text('🛒 POS Items Cart'),
                      icon: Icon(Icons.shopping_cart_outlined, size: 16),
                    ),
                    ButtonSegment<int>(
                      value: 0,
                      label: Text('⚡ Fast Quick Sale'),
                      icon: Icon(Icons.flash_on, size: 16),
                    ),
                  ],
                  selected: {_entryMode},
                  onSelectionChanged: (Set<int> newSelection) {
                    setState(() {
                      _entryMode = newSelection.first;
                    });
                  },
                  style: const ButtonStyle(
                    visualDensity: VisualDensity.compact,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),

        // Mode content
        Expanded(
          child: _entryMode == 0 ? _buildFastQuickSaleView() : _buildPosView(),
        ),
      ],
    );
  }

  // ==========================================
  // FAST QUICK SALE VIEW (3 RAPID FIELDS)
  // ==========================================
  Widget _buildFastQuickSaleView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Info Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.bolt, color: AppTheme.primary, size: 24),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Rapid 3-Field Billing',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.primary),
                      ),
                      Text(
                        'Enter Phone, Name & Amount. Customer profile is auto-created or linked instantly.',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Field 1: Customer Phone
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
                        '1. Customer Phone Number *',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textPrimary),
                      ),
                      if (_customers.isNotEmpty)
                        TextButton.icon(
                          onPressed: () {
                            _showCustomerPickerModal();
                          },
                          icon: const Icon(Icons.contacts_outlined, size: 14),
                          label: const Text('Existing List', style: TextStyle(fontSize: 11)),
                          style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _quickPhoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      hintText: 'e.g. 9876543210',
                      prefixIcon: const Icon(Icons.phone, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    onChanged: _onQuickPhoneChanged,
                  ),
                  if (_matchedCustomer != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.check_circle, size: 14, color: AppTheme.success),
                        const SizedBox(width: 4),
                        Text(
                          'Found existing customer: ${_matchedCustomer!.name}',
                          style: const TextStyle(fontSize: 11, color: AppTheme.success, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Field 2: Customer Name
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '2. Customer Name *',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _quickNameController,
                    decoration: InputDecoration(
                      hintText: 'e.g. Ramesh Kumar',
                      prefixIcon: const Icon(Icons.person, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Field 3: Quick Sale Mode & Products / Amount
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
                        '3. Quick Sale Mode *',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textPrimary),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: _quickSaleType == 1 ? AppTheme.primaryLight : Colors.blueGrey.shade50,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _quickSaleType == 1 ? 'Deducts Stock' : 'Amount Only (No Stock)',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: _quickSaleType == 1 ? AppTheme.primary : AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<int>(
                      segments: const [
                        ButtonSegment<int>(
                          value: 0,
                          label: Text('⚡ Quick Amount', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          icon: Icon(Icons.flash_on, size: 16),
                        ),
                        ButtonSegment<int>(
                          value: 1,
                          label: Text('📦 Select Products', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          icon: Icon(Icons.inventory_2_outlined, size: 16),
                        ),
                      ],
                      selected: {_quickSaleType},
                      onSelectionChanged: (val) {
                        setState(() => _quickSaleType = val.first);
                      },
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (_quickSaleType == 0) ...[
                    // Amount-Only Rapid Sale Mode
                    const Text(
                      'Enter Sale Amount (₹) *',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppTheme.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _quickAmountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.primary),
                      decoration: InputDecoration(
                        prefixText: '₹ ',
                        prefixStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.primary),
                        hintText: '0',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 10),

                    // Quick chips
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [100, 200, 500, 1000, 2000, 5000].map((quickVal) {
                        return ActionChip(
                          label: Text('+₹$quickVal', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                          onPressed: () {
                            final current = double.tryParse(_quickAmountController.text.trim()) ?? 0.0;
                            final newVal = current + quickVal;
                            _quickAmountController.text = newVal.toStringAsFixed(0);
                            setState(() {});
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Financial transaction will be recorded without altering product inventory.',
                      style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
                    ),
                  ] else ...[
                    // Product-Based Quick Sale Mode
                    const Text(
                      'Select Product Item *',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppTheme.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: _showQuickProductPickerModal,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(10),
                          color: Colors.grey.shade50,
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.search, size: 20, color: AppTheme.textMuted),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _quickSelectedProduct != null
                                    ? '${_quickSelectedProduct!.name} (Stock: ${_quickSelectedProduct!.stock})'
                                    : 'Tap to search & select product...',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _quickSelectedProduct != null ? AppTheme.textPrimary : AppTheme.textMuted,
                                  fontWeight: _quickSelectedProduct != null ? FontWeight.w600 : FontWeight.normal,
                                ),
                              ),
                            ),
                            const Icon(Icons.arrow_drop_down, color: AppTheme.textMuted),
                          ],
                        ),
                      ),
                    ),

                    if (_quickSelectedProduct != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    _quickSelectedProduct!.name,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: _quickSelectedProduct!.stock > 0 ? AppTheme.primaryLight : AppTheme.errorLight,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    'Stock: ${_quickSelectedProduct!.stock}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: _quickSelectedProduct!.stock > 0 ? AppTheme.primary : AppTheme.error,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                // Quantity Field
                                Expanded(
                                  flex: 2,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('Qty Sold', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 4),
                                      TextField(
                                        controller: _quickProductQtyController,
                                        keyboardType: TextInputType.number,
                                        decoration: InputDecoration(
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                        ),
                                        onChanged: (_) => setState(() {}),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 10),
                                // Negotiated / Custom Selling Price
                                Expanded(
                                  flex: 3,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Price (₹) [Suggested: ₹${_quickSelectedProduct!.sellingPrice.toStringAsFixed(0)}]',
                                        style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(height: 4),
                                      TextField(
                                        controller: _quickProductPriceController,
                                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                        decoration: InputDecoration(
                                          prefixText: '₹ ',
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                        ),
                                        onChanged: (_) => setState(() {}),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Line Total: ₹${((int.tryParse(_quickProductQtyController.text.trim()) ?? 0) * (double.tryParse(_quickProductPriceController.text.trim()) ?? _quickSelectedProduct!.sellingPrice)).toStringAsFixed(0)}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.primary),
                                ),
                                ElevatedButton.icon(
                                  onPressed: () {
                                    final q = int.tryParse(_quickProductQtyController.text.trim()) ?? 1;
                                    final p = double.tryParse(_quickProductPriceController.text.trim()) ?? _quickSelectedProduct!.sellingPrice;
                                    if (q <= 0) return;
                                    setState(() {
                                      final existingIdx = _quickItems.indexWhere((e) => e.product.id == _quickSelectedProduct!.id);
                                      if (existingIdx >= 0) {
                                        _quickItems[existingIdx].quantity += q;
                                        _quickItems[existingIdx].customPrice = p;
                                      } else {
                                        _quickItems.add(CartEntry(
                                          product: _quickSelectedProduct!,
                                          quantity: q,
                                          customPrice: p,
                                        ));
                                      }
                                      _quickSelectedProduct = null;
                                      _quickProductQtyController.text = '1';
                                      _quickProductPriceController.clear();
                                    });
                                  },
                                  icon: const Icon(Icons.add, size: 16),
                                  label: const Text('Add to Sale', style: TextStyle(fontSize: 12)),
                                  style: ElevatedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],

                    if (_quickItems.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Divider(height: 1),
                      const SizedBox(height: 8),
                      const Text(
                        'Items in this Quick Sale:',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textPrimary),
                      ),
                      const SizedBox(height: 6),
                      ..._quickItems.map((entry) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(entry.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    Text(
                                      '${entry.quantity} x ₹${entry.customPrice.toStringAsFixed(0)} (Stock: ${entry.product.stock})',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '₹${entry.lineTotal.toStringAsFixed(0)}',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textPrimary),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 18, color: AppTheme.error),
                                onPressed: () {
                                  setState(() => _quickItems.remove(entry));
                                },
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Optional details
          Card(
            child: ExpansionTile(
              initiallyExpanded: false,
              title: const Text(
                'Payment Mode & Notes (Optional)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              children: [
                // Payment Mode Chips
                Row(
                  children: [
                    const Text('Mode: ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: ['CASH', 'UPI', 'CARD', 'CREDIT'].map((mode) {
                          final isSel = _quickPaymentMethod == mode;
                          return ChoiceChip(
                            label: Text(
                              mode == 'CREDIT' ? 'CREDIT (DUE)' : mode,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isSel ? Colors.white : (mode == 'CREDIT' ? AppTheme.error : AppTheme.textPrimary),
                              ),
                            ),
                            selected: isSel,
                            selectedColor: mode == 'CREDIT' ? AppTheme.error : AppTheme.primary,
                            onSelected: (_) => setState(() => _quickPaymentMethod = mode),
                            showCheckmark: false,
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
                if (_quickPaymentMethod == 'CREDIT') ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.errorLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, size: 14, color: AppTheme.error),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Full amount will be recorded as receivable debt owed by customer (TO RECEIVE).',
                            style: TextStyle(fontSize: 11, color: AppTheme.error, fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 10),

                // Notes Field
                TextField(
                  controller: _quickNotesController,
                  decoration: InputDecoration(
                    labelText: 'Notes / Bill Reference (Optional)',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Double-Tap Guard Complete Button
          Builder(
            builder: (ctx) {
              final double calculatedQuickTotal;
              if (_quickSaleType == 1) {
                final itemsSum = _quickItems.fold<double>(0.0, (sum, i) => sum + i.lineTotal);
                if (_quickSelectedProduct != null && _quickItems.isEmpty) {
                  final pendingQty = int.tryParse(_quickProductQtyController.text.trim()) ?? 0;
                  final pendingPrice = double.tryParse(_quickProductPriceController.text.trim()) ?? _quickSelectedProduct!.sellingPrice;
                  calculatedQuickTotal = itemsSum + (pendingQty * pendingPrice);
                } else {
                  calculatedQuickTotal = itemsSum;
                }
              } else {
                calculatedQuickTotal = double.tryParse(_quickAmountController.text.trim()) ?? 0.0;
              }

              return ElevatedButton.icon(
                onPressed: _isSavingQuickSale ? null : _handleQuickSaleSave,
                icon: _isSavingQuickSale
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_circle_outline, size: 20),
                label: Text(
                  _isSavingQuickSale
                      ? 'Saving Sale...'
                      : 'Complete Sale • ₹${calculatedQuickTotal.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              );
            },
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  void _showQuickProductPickerModal() {
    final searchCtrl = TextEditingController();
    List<Product> filtered = List.from(_products);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Container(
              padding: const EdgeInsets.all(16),
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.75,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Select Product for Quick Sale',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: searchCtrl,
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'Search products by name, SKU or category...',
                      prefixIcon: const Icon(Icons.search),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onChanged: (q) {
                      final clean = q.toLowerCase().trim();
                      setModalState(() {
                        filtered = _products.where((p) {
                          return p.name.toLowerCase().contains(clean) ||
                              (p.sku?.toLowerCase().contains(clean) ?? false) ||
                              p.category.toLowerCase().contains(clean);
                        }).toList();
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No matching products found.', style: TextStyle(color: AppTheme.textSecondary)),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (_, idx) {
                              final p = filtered[idx];
                              final isOutOfStock = p.stock <= 0;
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: isOutOfStock ? Colors.grey.shade200 : AppTheme.primaryLight,
                                  child: Icon(
                                    Icons.inventory_2_outlined,
                                    size: 18,
                                    color: isOutOfStock ? Colors.grey : AppTheme.primary,
                                  ),
                                ),
                                title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                subtitle: Text(
                                  'Price: ₹${p.sellingPrice.toStringAsFixed(0)} • Stock: ${p.stock}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isOutOfStock ? AppTheme.error : AppTheme.textSecondary,
                                  ),
                                ),
                                trailing: isOutOfStock
                                    ? Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppTheme.errorLight,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text('OUT OF STOCK', style: TextStyle(fontSize: 10, color: AppTheme.error, fontWeight: FontWeight.bold)),
                                      )
                                    : Text(
                                        '₹${p.sellingPrice.toStringAsFixed(0)}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primary),
                                      ),
                                onTap: () {
                                  Navigator.of(ctx).pop();
                                  setState(() {
                                    _quickSelectedProduct = p;
                                    _quickProductPriceController.text = (p.sellingPrice > 0 ? p.sellingPrice : p.price).toStringAsFixed(0);
                                    _quickProductQtyController.text = '1';
                                  });
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

  void _showCustomerPickerModal() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(16),
          constraints: const BoxConstraints(maxHeight: 450),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Select Existing Customer', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: _customers.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, idx) {
                    final c = _customers[idx];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Text(c.name.isNotEmpty ? c.name[0].toUpperCase() : 'C', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                      ),
                      title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      subtitle: Text(c.phone.isNotEmpty ? c.phone : 'No phone', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      onTap: () {
                        Navigator.of(ctx).pop();
                        _selectCustomerForQuickSale(c);
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
  }

  // ==========================================
  // POS VIEW (MULTI-ITEM CATALOG)
  // ==========================================
  Widget _buildPosView() {
    final query = _productSearchController.text.toLowerCase().trim();
    final availableProducts = _products.where((p) {
      if (!p.isActive) return false;
      if (query.isEmpty) return true;
      final nameMatches = p.name.toLowerCase().contains(query);
      final categoryMatches = p.category.toLowerCase().contains(query);
      final skuMatches = p.sku != null && p.sku!.toLowerCase().contains(query);
      return nameMatches || categoryMatches || skuMatches;
    }).toList();

    return Column(
      children: [
        // Customer Selector & Search Bar
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          color: AppTheme.surface,
          child: Column(
            children: [
              if (_customers.isNotEmpty)
                DropdownButtonFormField<Customer>(
                  initialValue: _selectedCustomer,
                  decoration: const InputDecoration(
                    labelText: 'Customer *',
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    prefixIcon: Icon(Icons.person, size: 20),
                  ),
                  items: _customers.map((c) {
                    return DropdownMenuItem<Customer>(
                      value: c,
                      child: Text('${c.name} (${c.phone})', style: const TextStyle(fontSize: 13)),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => _selectedCustomer = val),
                ),
              const SizedBox(height: 8),

              // Product Search
              TextField(
                controller: _productSearchController,
                decoration: InputDecoration(
                  hintText: 'Search items to add to cart...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  suffixIcon: _productSearchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () => setState(() => _productSearchController.clear()),
                        )
                      : null,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),

        // Products Grid / Quick Select
        Expanded(
          flex: 5,
          child: RefreshIndicator(
            onRefresh: _loadPosData,
            color: AppTheme.primary,
            child: availableProducts.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: 200,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.inventory_2_outlined, size: 40, color: AppTheme.textMuted),
                              const SizedBox(height: 10),
                              Text(
                                _productSearchController.text.trim().isNotEmpty
                                    ? 'No products matching "${_productSearchController.text.trim()}"'
                                    : 'No products available',
                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                              ),
                              if (_productSearchController.text.trim().isNotEmpty) ...[
                                const SizedBox(height: 8),
                                TextButton.icon(
                                  onPressed: () => setState(() => _productSearchController.clear()),
                                  icon: const Icon(Icons.clear, size: 16),
                                  label: const Text('Clear Search'),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(12),
                    itemCount: availableProducts.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final p = availableProducts[idx];
                      final inCart = _cart.any((c) => c.product.id == p.id);

                      return Card(
                        child: ListTile(
                          dense: true,
                          title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          subtitle: Text(
                            'Stock: ${p.stock} • ₹${p.sellingPrice.toStringAsFixed(0)}${p.sku != null && p.sku!.isNotEmpty ? " • SKU: ${p.sku}" : ""}',
                            style: TextStyle(
                              fontSize: 12,
                              color: p.isOutOfStock ? AppTheme.error : AppTheme.textSecondary,
                              fontWeight: p.isOutOfStock ? FontWeight.w600 : FontWeight.normal,
                            ),
                          ),
                          trailing: ElevatedButton.icon(
                            onPressed: p.stock <= 0 ? null : () => _addToCart(p),
                            icon: Icon(inCart ? Icons.add_circle : Icons.add_shopping_cart, size: 16),
                            label: Text(inCart ? 'Add More' : 'Add', style: const TextStyle(fontSize: 12)),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              minimumSize: Size.zero,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),

        // Cart Section
        Container(
          constraints: const BoxConstraints(maxHeight: 280),
          decoration: BoxDecoration(
            color: AppTheme.surface,
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, -3)),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Cart header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Cart Items (${_cart.length})',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    if (_cart.isNotEmpty)
                      TextButton(
                        onPressed: () => setState(() => _cart.clear()),
                        child: const Text('Clear Cart', style: TextStyle(fontSize: 12, color: AppTheme.error)),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),

              // Cart line items
              if (_cart.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: Text('Tap + on any product above to add to cart', style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _cart.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, idx) {
                      final item = _cart[idx];
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 4,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                  Text('₹${item.customPrice.toStringAsFixed(0)} each', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                ],
                              ),
                            ),
                            // Stepper
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline, size: 20),
                                  onPressed: () => _changeQty(idx, -1),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  child: Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline, size: 20, color: AppTheme.primary),
                                  onPressed: () => _changeQty(idx, 1),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                              ],
                            ),
                            const SizedBox(width: 8),
                            // Total
                            SizedBox(
                              width: 60,
                              child: Text(
                                '₹${item.lineTotal.toStringAsFixed(0)}',
                                textAlign: TextAlign.end,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, size: 16, color: AppTheme.textMuted),
                              onPressed: () => _removeFromCart(idx),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

              // Payment options & Checkout button
              if (_cart.isNotEmpty) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
                  child: Column(
                    children: [
                      // Payment Mode Chips
                      Row(
                        children: ['CASH', 'CARD', 'UPI', 'OTHER'].map((mode) {
                          final isSel = _paymentMethod == mode;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text(mode, style: TextStyle(fontSize: 11, color: isSel ? Colors.white : AppTheme.textPrimary)),
                              selected: isSel,
                              selectedColor: AppTheme.primary,
                              onSelected: (_) => setState(() => _paymentMethod = mode),
                              showCheckmark: false,
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),

                      // Grand total and checkout
                      Row(
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Total Amount', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                              Text(
                                '₹${_grandTotal.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.primary),
                              ),
                            ],
                          ),
                          const Spacer(),
                          ElevatedButton.icon(
                            onPressed: _isCheckingOut ? null : _handlePosCheckout,
                            icon: _isCheckingOut
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.check, size: 18),
                            label: const Text('Complete Sale'),
                            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  // ==========================================
  // SALES HISTORY VIEW
  // ==========================================
  Widget _buildHistoryView() {
    if (_isLoadingHistory) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    if (_historyError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40, color: AppTheme.error),
              const SizedBox(height: 8),
              Text(_historyError!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _loadSalesHistory, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final q = _historySearchController.text.toLowerCase().trim();
    final filtered = _sales.where((s) {
      final matchesSearch = q.isEmpty ||
          s.invoiceNumber.toLowerCase().contains(q) ||
          s.customerName.toLowerCase().contains(q) ||
          s.customerPhone.toLowerCase().contains(q);

      final matchesFilter = _historyFilter == 'ALL' ||
          (_historyFilter == 'COMPLETED' && !s.isCancelled && !s.isReturned) ||
          (_historyFilter == 'RETURNED' && (s.isReturned || s.isPartiallyReturned)) ||
          (_historyFilter == 'CANCELLED' && s.isCancelled);

      return matchesSearch && matchesFilter;
    }).toList();

    final dateFormat = DateFormat('dd MMM, hh:mm a');

    return RefreshIndicator(
      onRefresh: _loadSalesHistory,
      child: Column(
        children: [
          // Search & Filter
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            color: AppTheme.surface,
            child: Column(
              children: [
                TextField(
                  controller: _historySearchController,
                  decoration: InputDecoration(
                    hintText: 'Search by Invoice #, Customer or Phone...',
                    prefixIcon: const Icon(Icons.search, size: 20),
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
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: ['ALL', 'COMPLETED', 'RETURNED', 'CANCELLED'].map((f) {
                      final isSel = _historyFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(f, style: TextStyle(fontSize: 11, color: isSel ? Colors.white : AppTheme.textPrimary)),
                          selected: isSel,
                          selectedColor: AppTheme.primary,
                          onSelected: (_) => setState(() => _historyFilter = f),
                          showCheckmark: false,
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Sales List
          Expanded(
            child: filtered.isEmpty
                ? const Center(child: Text('No sales found', style: TextStyle(color: AppTheme.textSecondary)))
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, idx) {
                      final s = filtered[idx];

                      Color badgeBg = AppTheme.successLight;
                      Color badgeText = AppTheme.success;
                      if (s.isCancelled) {
                        badgeBg = AppTheme.errorLight;
                        badgeText = AppTheme.error;
                      } else if (s.isReturned || s.isPartiallyReturned) {
                        badgeBg = AppTheme.warningLight;
                        badgeText = AppTheme.warning;
                      }

                      return Card(
                        child: InkWell(
                          onTap: () {
                            showDialog(
                              context: context,
                              builder: (_) => SaleReceiptDialog(
                                sale: s,
                                onReturnProcessed: _loadSalesHistory,
                                onSaleDeleted: () {
                                  _loadSalesHistory();
                                  _loadPosData();
                                },
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      s.invoiceNumber,
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.primary),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: badgeBg,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        s.status,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: badgeText,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(s.customerName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                          if (s.customerPhone.isNotEmpty)
                                            Text(s.customerPhone, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '₹${s.grandTotal.toStringAsFixed(0)}',
                                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                                        ),
                                        if (s.returnedAmount > 0)
                                          Text(
                                            'Ret: -₹${s.returnedAmount.toStringAsFixed(0)}',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.warning),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      dateFormat.format(s.saleDate),
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                    ),
                                    Text(
                                      '${s.items.isEmpty ? "Quick Sale" : "${s.items.length} items"} • ${s.paymentMethod}',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ),

                                // Actions Row (Return & Delete)
                                if (s.canReturn || !s.isCancelled) ...[
                                  const SizedBox(height: 10),
                                  const Divider(height: 1),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      if (s.canReturn) ...[
                                        OutlinedButton.icon(
                                          onPressed: () => _openReturnDialog(s),
                                          icon: const Icon(Icons.assignment_return, size: 14, color: AppTheme.warning),
                                          label: const Text(
                                            'Return',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.warning),
                                          ),
                                          style: OutlinedButton.styleFrom(
                                            side: const BorderSide(color: AppTheme.warning),
                                            visualDensity: VisualDensity.compact,
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                      ],
                                      if (!s.isCancelled)
                                        OutlinedButton.icon(
                                          onPressed: () => _confirmAndDeleteSale(s),
                                          icon: const Icon(Icons.delete_outline, size: 14, color: AppTheme.error),
                                          label: const Text(
                                            'Delete',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.error),
                                          ),
                                          style: OutlinedButton.styleFrom(
                                            side: const BorderSide(color: AppTheme.error),
                                            visualDensity: VisualDensity.compact,
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
