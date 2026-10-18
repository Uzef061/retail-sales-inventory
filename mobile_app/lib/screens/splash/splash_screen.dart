import 'package:flutter/material.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../auth/login_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../main_navigation_screen.dart';

class SplashScreen extends StatefulWidget {
  final AuthService authService;

  const SplashScreen({super.key, required this.authService});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _scaleAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.7, curve: Curves.easeOutBack),
      ),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.6, curve: Curves.easeIn),
      ),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.25),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.3, 0.9, curve: Curves.easeOutCubic),
      ),
    );

    _controller.forward();
    _startInitializationFlow();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _startInitializationFlow() async {
    final startTime = DateTime.now();

    // 1. Initialize auth service concurrently with splash animation
    try {
      if (!widget.authService.isInitialized) {
        await widget.authService.init().timeout(const Duration(seconds: 3));
      }
    } catch (e) {
      debugPrint('Auth initialization in splash encountered an issue: $e');
    }

    // 2. Ensure minimum display time for smooth animation (1400ms)
    final elapsed = DateTime.now().difference(startTime);
    final remaining = const Duration(milliseconds: 1400) - elapsed;
    if (remaining > Duration.zero) {
      await Future.delayed(remaining);
    }

    if (!mounted) return;

    // 3. Navigate with smooth fade transition
    final Widget targetScreen;
    if (widget.authService.isLoggedIn) {
      targetScreen = widget.authService.hasCompletedOnboarding
          ? const MainNavigationScreen()
          : const OnboardingScreen();
    } else {
      targetScreen = const LoginScreen();
    }

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => targetScreen,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return FadeTransition(
                opacity: _fadeAnimation,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Spacer(flex: 3),

                    // Animated Store Logo
                    ScaleTransition(
                      scale: _scaleAnimation,
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppTheme.primary,
                            width: 2.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withValues(alpha: 0.2),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.storefront_rounded,
                          size: 52,
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // App Name & Subtitle
                    SlideTransition(
                      position: _slideAnimation,
                      child: Column(
                        children: [
                          const Text(
                            'Retail Sales & Inventory',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.textPrimary,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Smart small-business management',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: AppTheme.textSecondary.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const Spacer(flex: 2),

                    // Subtle loading indicator
                    SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppTheme.primary.withValues(alpha: 0.8),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Starting workspace...',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.textMuted,
                        letterSpacing: 0.3,
                      ),
                    ),

                    const Spacer(flex: 1),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
