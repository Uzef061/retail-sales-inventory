import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../models/customer.dart';
import '../../models/supplier.dart';
import '../more/settings_screen.dart';
import 'add_customer_dialog.dart';
import 'add_supplier_dialog.dart';

class PartiesScreen extends StatefulWidget {
  const PartiesScreen({super.key});

  @override
  State<PartiesScreen> createState() => _PartiesScreenState();
}

class _PartiesScreenState extends State<PartiesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiClient _apiClient = ApiClient();
  final TextEditingController _searchController = TextEditingController();

  List<Customer> _customers = [];
  bool _isLoadingCustomers = true;
  String? _customerError;

  List<Supplier> _suppliers = [];
  bool _isLoadingSuppliers = true;
  bool _isSupplier404 = false;
  String? _supplierError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      setState(() {});
    });
    _loadCustomers();
    _loadSuppliers();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    setState(() {
      _isLoadingCustomers = true;
      _customerError = null;
    });

    try {
      final res = await _apiClient.get(ApiConfig.customers);
      if (res is List) {
        final list = res.map((c) => Customer.fromJson(c as Map<String, dynamic>)).toList();
        setState(() {
          _customers = list;
          _isLoadingCustomers = false;
        });
      } else {
        setState(() {
          _customers = [];
          _isLoadingCustomers = false;
        });
      }
    } on ApiException catch (e) {
      setState(() {
        _customerError = e.message;
        _isLoadingCustomers = false;
      });
    } catch (e) {
      setState(() {
        _customerError = 'Unable to load customers.';
        _isLoadingCustomers = false;
      });
    }
  }

  Future<void> _loadSuppliers() async {
    setState(() {
      _isLoadingSuppliers = true;
      _supplierError = null;
      _isSupplier404 = false;
    });

    try {
      final res = await _apiClient.get(ApiConfig.suppliers);
      if (res is List) {
        final list = res.map((s) => Supplier.fromJson(s as Map<String, dynamic>)).toList();
        setState(() {
          _suppliers = list;
          _isLoadingSuppliers = false;
        });
      } else {
        setState(() {
          _suppliers = [];
          _isLoadingSuppliers = false;
        });
      }
    } on ApiException catch (e) {
      setState(() {
        if (e.isNotFound) {
          _isSupplier404 = true;
        } else {
          _supplierError = e.message;
        }
        _isLoadingSuppliers = false;
      });
    } catch (e) {
      setState(() {
        _supplierError = 'Unable to load suppliers.';
        _isLoadingSuppliers = false;
      });
    }
  }

  void _openAddCustomer([Customer? existing]) {
    showDialog(
      context: context,
      builder: (_) => AddCustomerDialog(
        existingCustomer: existing,
        onSaved: _loadCustomers,
      ),
    );
  }

  void _openAddSupplier([Supplier? existing]) {
    showDialog(
      context: context,
      builder: (_) => AddSupplierDialog(
        existingSupplier: existing,
        onSaved: _loadSuppliers,
      ),
    );
  }

  List<Customer> get _filteredCustomers {
    final q = _searchController.text.toLowerCase().trim();
    if (q.isEmpty) return _customers;
    return _customers.where((c) {
      return c.name.toLowerCase().contains(q) ||
          c.phone.toLowerCase().contains(q) ||
          c.email.toLowerCase().contains(q);
    }).toList();
  }

  List<Supplier> get _filteredSuppliers {
    final q = _searchController.text.toLowerCase().trim();
    if (q.isEmpty) return _suppliers;
    return _suppliers.where((s) {
      return s.name.toLowerCase().contains(q) ||
          s.phone.toLowerCase().contains(q) ||
          s.contactPerson.toLowerCase().contains(q) ||
          s.email.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isCustomerTab = _tabController.index == 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parties & Contacts'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textSecondary,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          tabs: [
            Tab(text: 'Customers (${_customers.length})'),
            Tab(text: 'Suppliers (${_isSupplier404 ? "!" : _suppliers.length})'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          if (isCustomerTab) {
            _openAddCustomer();
          } else {
            _openAddSupplier();
          }
        },
        icon: const Icon(Icons.person_add_alt_1),
        label: Text(isCustomerTab ? 'Add Customer' : 'Add Supplier'),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Search input
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: isCustomerTab ? 'Search customers...' : 'Search suppliers...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () => setState(() => _searchController.clear()),
                      )
                    : null,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),

          // Tab views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildCustomerList(),
                _buildSupplierList(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerList() {
    if (_isLoadingCustomers) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    if (_customerError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40, color: AppTheme.error),
              const SizedBox(height: 8),
              Text(_customerError!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _loadCustomers, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final list = _filteredCustomers;
    if (list.isEmpty) {
      return const Center(
        child: Text('No customers found', style: TextStyle(color: AppTheme.textSecondary)),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadCustomers,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final c = list[idx];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppTheme.primaryLight,
                child: Text(
                  c.name.isNotEmpty ? c.name[0].toUpperCase() : 'C',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary),
                ),
              ),
              title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.phone, size: 13, color: AppTheme.textMuted),
                      const SizedBox(width: 4),
                      Text(c.phone, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    ],
                  ),
                  if (c.email.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.email, size: 13, color: AppTheme.textMuted),
                        const SizedBox(width: 4),
                        Text(c.email, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      ],
                    ),
                  ],
                ],
              ),
              trailing: IconButton(
                icon: const Icon(Icons.edit_outlined, size: 20, color: AppTheme.textSecondary),
                onPressed: () => _openAddCustomer(c),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSupplierList() {
    if (_isLoadingSuppliers) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
    }

    if (_isSupplier404) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cloud_sync, size: 40, color: AppTheme.primary),
              ),
              const SizedBox(height: 16),
              const Text(
                'Supplier API Pending Deployment',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
              ),
              const SizedBox(height: 8),
              const Text(
                'The Supplier endpoints are fully implemented and verified on the local backend (http://10.0.2.2:5000). The live Render deployment currently runs an earlier commit.\n\nYou can switch to the local emulator host in Settings to manage suppliers.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
                icon: const Icon(Icons.settings, size: 18),
                label: const Text('Open Server Settings'),
              ),
            ],
          ),
        ),
      );
    }

    if (_supplierError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40, color: AppTheme.error),
              const SizedBox(height: 8),
              Text(_supplierError!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _loadSuppliers, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final list = _filteredSuppliers;
    if (list.isEmpty) {
      return const Center(
        child: Text('No suppliers found', style: TextStyle(color: AppTheme.textSecondary)),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadSuppliers,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final s = list[idx];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppTheme.secondary.withValues(alpha: 0.1),
                child: Text(
                  s.name.isNotEmpty ? s.name[0].toUpperCase() : 'S',
                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.secondary),
                ),
              ),
              title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (s.contactPerson.isNotEmpty)
                    Text('Contact: ${s.contactPerson}', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                  Row(
                    children: [
                      const Icon(Icons.phone, size: 13, color: AppTheme.textMuted),
                      const SizedBox(width: 4),
                      Text(s.phone, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    ],
                  ),
                ],
              ),
              trailing: IconButton(
                icon: const Icon(Icons.edit_outlined, size: 20, color: AppTheme.textSecondary),
                onPressed: () => _openAddSupplier(s),
              ),
            ),
          );
        },
      ),
    );
  }
}
