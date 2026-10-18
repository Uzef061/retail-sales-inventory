import 'package:flutter/material.dart';
import '../../core/services/api_client.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../auth/login_screen.dart';
import 'purchases_screen.dart';
import 'profit_loss_screen.dart';
import 'settings_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of the store session?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            onPressed: () async {
              Navigator.of(ctx).pop();
              await AuthService().logout();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.storefront, color: AppTheme.primary),
            SizedBox(width: 8),
            Text('About App'),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Retail Sales & Inventory', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            Text('Mobile Android App (Flutter 3.47 + Dart 3.13)', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            SizedBox(height: 12),
            Text('Connected Backend:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('Node.js + Express + Cloud MongoDB', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            SizedBox(height: 12),
            Text('Package ID: com.retailsalesinventory.app', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthService();
    final user = auth.currentUser;
    final serverHost = ApiClient().baseUrl;

    return Scaffold(
      appBar: AppBar(
        title: const Text('More Options'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppTheme.primaryLight,
                    child: Text(
                      user != null && user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppTheme.primary),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? 'Store Operator',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                user?.role ?? 'ADMIN',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.primary),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                '@${user?.username ?? "user"}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Business Management Section
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'BUSINESS WORKFLOWS',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.8),
            ),
          ),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.shopping_bag_outlined, color: AppTheme.primary),
                  title: const Text('Purchases & Restock', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Receive inventory, log suppliers & cost', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PurchasesScreen()),
                    );
                  },
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.analytics_outlined, color: AppTheme.primary),
                  title: const Text('Profit & Loss Analytics', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Revenue, COGS, margins & best sellers', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ProfitLossScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // App Settings Section
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'SYSTEM & SERVER',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.8),
            ),
          ),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.dns_outlined, color: AppTheme.secondary),
                  title: const Text('Backend Server Settings', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text(
                    serverHost.replaceAll('https://', '').replaceAll('http://', ''),
                    style: const TextStyle(fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    );
                  },
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.info_outline, color: AppTheme.secondary),
                  title: const Text('About & System Details', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Version, stack & integration info', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () => _showAboutDialog(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Logout Button
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.error,
              side: const BorderSide(color: AppTheme.error),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: () => _showLogoutDialog(context),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}
