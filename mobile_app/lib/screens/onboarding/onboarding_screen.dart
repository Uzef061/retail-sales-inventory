import 'package:flutter/material.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../main_navigation_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  final AuthService _authService = AuthService();
  int _currentPage = 0;
  bool _isSubmitting = false;

  final TextEditingController _storeNameController = TextEditingController();
  String _selectedCategory = 'General Retail';
  String _selectedCurrency = '₹';

  final List<String> _categories = [
    'General Retail',
    'Grocery & Kirana',
    'Clothing & Footwear',
    'Electronics & Mobile',
    'Pharmacy & Health',
    'Cafe & Restaurant',
    'Other'
  ];

  final List<String> _currencies = ['₹', '\$', '€', '£', '₨', 'AED'];

  @override
  void initState() {
    super.initState();
    final user = _authService.currentUser;
    _storeNameController.text = user?.name != null ? "${user!.name}'s Store" : 'My Retail Store';
  }

  @override
  void dispose() {
    _pageController.dispose();
    _storeNameController.dispose();
    super.dispose();
  }

  Future<void> _finishOnboarding() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);

    try {
      await _authService.completeOnboarding(
        businessName: _storeNameController.text.trim().isNotEmpty
            ? _storeNameController.text.trim()
            : 'My Retail Store',
        category: _selectedCategory,
        currency: _selectedCurrency,
        ownerName: _authService.currentUser?.name,
      );
    } catch (e) {
      debugPrint('[ONBOARDING] Complete error: $e');
    }

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (_currentPage < 3)
            TextButton(
              onPressed: _finishOnboarding,
              child: const Text(
                'Skip',
                style: TextStyle(
                  color: AppTheme.textSecondary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (page) => setState(() => _currentPage = page),
                children: [
                  _buildStoreSetupStep(),
                  _buildFeatureStep(
                    icon: Icons.inventory_2_rounded,
                    iconColor: AppTheme.primary,
                    title: 'Stock & Inventory Control',
                    description:
                        'Keep track of items, stock quantities, and cost prices. Receive automated alerts whenever items run low.',
                    tips: [
                      'Add products with cost & selling prices',
                      'Track current stock levels in real time',
                      'Prevent selling out with low-stock warnings',
                    ],
                  ),
                  _buildFeatureStep(
                    icon: Icons.swap_horiz_rounded,
                    iconColor: AppTheme.success,
                    title: 'Fast Receive & Give (Khata)',
                    description:
                        'Record money received from customers and payments given to suppliers with one tap right from the home screen.',
                    tips: [
                      'Receive: Record cash and UPI received from customers',
                      'Give: Record supplier payments and purchase payables',
                      'Automatic customer and supplier balance tracking',
                    ],
                  ),
                  _buildFeatureStep(
                    icon: Icons.analytics_rounded,
                    iconColor: AppTheme.accent,
                    title: 'Real Profit & Loss Accounting',
                    description:
                        'Know your exact store margins. Profit calculations follow strict accounting rules (Revenue − Cost of Goods Sold).',
                    tips: [
                      'True Gross Profit based on units sold',
                      'Daily, weekly, and monthly trend breakdowns',
                      'Easy reminders and follow-up notes',
                    ],
                  ),
                ],
              ),
            ),
            _buildBottomControls(),
          ],
        ),
      ),
    );
  }

  Widget _buildStoreSetupStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.storefront_rounded,
              size: 48,
              color: AppTheme.primary,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Welcome to Your Business!',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            "Let's set up your store details so your receipts and ledgers are ready.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 28),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTheme.cardBorder),
            ),
            color: AppTheme.cardBackground,
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Store / Business Name',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _storeNameController,
                    decoration: InputDecoration(
                      hintText: 'e.g. Ramesh Kirana Store',
                      filled: true,
                      fillColor: AppTheme.background,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.cardBorder),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.cardBorder),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Business Category',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _selectedCategory,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppTheme.background,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.cardBorder),
                      ),
                    ),
                    items: _categories.map((cat) {
                      return DropdownMenuItem(value: cat, child: Text(cat, style: const TextStyle(fontSize: 14)));
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedCategory = val ?? _selectedCategory),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Currency Symbol',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _selectedCurrency,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppTheme.background,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppTheme.cardBorder),
                      ),
                    ),
                    items: _currencies.map((curr) {
                      return DropdownMenuItem(value: curr, child: Text(curr, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)));
                    }).toList(),
                    onChanged: (val) => setState(() => _selectedCurrency = val ?? _selectedCurrency),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureStep({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String description,
    required List<String> tips,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 54, color: iconColor),
          ),
          const SizedBox(height: 28),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: AppTheme.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 28),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTheme.cardBorder),
            ),
            color: AppTheme.cardBackground,
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Column(
                children: tips.map((tip) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.check_circle_rounded, size: 18, color: AppTheme.success),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            tip,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTheme.textPrimary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: const BoxDecoration(
        color: AppTheme.cardBackground,
        border: Border(top: BorderSide(color: AppTheme.cardBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Dots indicator
          Row(
            children: List.generate(4, (index) {
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.only(right: 6),
                width: _currentPage == index ? 22 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: _currentPage == index ? AppTheme.primary : AppTheme.cardBorder,
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            }),
          ),

          // Next / Get Started button
          ElevatedButton(
            onPressed: _isSubmitting
                ? null
                : () {
                    if (_currentPage < 3) {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    } else {
                      _finishOnboarding();
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
            ),
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Text(
                    _currentPage == 3 ? 'Get Started' : 'Continue',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
          ),
        ],
      ),
    );
  }
}
