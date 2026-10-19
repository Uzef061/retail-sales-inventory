import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/customer.dart';
import '../../models/product.dart';
import '../../models/sale.dart';
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

  // POS State
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

  // History State
  List<Sale> _sales = [];
  bool _isLoadingHistory = true;
  String? _historyError;
  final TextEditingController _historySearchController = TextEditingController();
  String _historyFilter = 'ALL'; // ALL, COMPLETED, CANCELLED

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _loadPosData();
    _loadSalesHistory();
  }

  @override
  void didUpdateWidget(covariant SalesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSelected && !oldWidget.isSelected) {
      _loadPosData();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
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
    } catch (e) {
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

  Future<void> _handleCheckout() async {
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
          builder: (_) => SaleReceiptDialog(sale: createdSale),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to complete sale.'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isCheckingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales & POS'),
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
                  const Text('New Sale / POS'),
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
          _buildPosView(),
          _buildHistoryView(),
        ],
      ),
    );
  }

  Widget _buildPosView() {
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
              // Customer Dropdown
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
                        height: 240,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.inventory_2_outlined, size: 44, color: AppTheme.textMuted),
                              const SizedBox(height: 12),
                              Text(
                                _productSearchController.text.trim().isNotEmpty
                                    ? 'No products matching "${_productSearchController.text.trim()}"'
                                    : 'No products available',
                                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
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

        // Cart Drawer Section
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
              const Divider(),

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
                const Divider(),
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
                            onPressed: _isCheckingOut ? null : _handleCheckout,
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
          s.customerName.toLowerCase().contains(q);

      final matchesFilter = _historyFilter == 'ALL' ||
          (_historyFilter == 'COMPLETED' && !s.isCancelled) ||
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
                    hintText: 'Search by Invoice # or Customer...',
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
                Row(
                  children: ['ALL', 'COMPLETED', 'CANCELLED'].map((f) {
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
                      return Card(
                        child: InkWell(
                          onTap: () {
                            showDialog(
                              context: context,
                              builder: (_) => SaleReceiptDialog(sale: s),
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
                                        color: s.isCancelled ? AppTheme.errorLight : AppTheme.successLight,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        s.status,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: s.isCancelled ? AppTheme.error : AppTheme.success,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(s.customerName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                    Text(
                                      '₹${s.grandTotal.toStringAsFixed(0)}',
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      dateFormat.format(s.saleDate),
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                    ),
                                    Text(
                                      '${s.items.length} items • ${s.paymentMethod}',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                    ),
                                  ],
                                ),
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
