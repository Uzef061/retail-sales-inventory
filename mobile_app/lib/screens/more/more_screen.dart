import 'package:flutter/material.dart';
import '../../core/services/api_client.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_theme.dart';
import '../auth/login_screen.dart';
import 'business_profile_screen.dart';
import 'reports_screen.dart';
import 'profit_loss_screen.dart';
import 'payments_history_screen.dart';
import 'purchases_screen.dart';
import 'reminders_screen.dart';
import 'notes_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of this store session?'),
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
            Text('Karobar-Style Small Business Management App', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            SizedBox(height: 12),
            Text('Connected Backend:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('Node.js + Express + Cloud MongoDB Atlas', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
            SizedBox(height: 12),
            Text('Architecture:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('Multi-Tenant User Accounts • Google Sign-In • Offline-Resilient • Pinched Shared Preferences', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
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
                    backgroundImage: (user?.avatar != null && user!.avatar!.isNotEmpty)
                        ? NetworkImage(user.avatar!)
                        : null,
                    child: (user?.avatar == null || user!.avatar!.isEmpty)
                        ? Text(
                            user != null && user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppTheme.primary),
                          )
                        : null,
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
                                (user?.email != null && user!.email!.isNotEmpty)
                                    ? user.email!
                                    : '@${user?.username ?? "user"}',
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

          // Section 1: Business Management & Analytics
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'BUSINESS & ANALYTICS',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.8),
            ),
          ),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.storefront_outlined, color: AppTheme.primary),
                  title: const Text('Business Profile & Branding', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Store name, phone, currency, tax & receipts', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const BusinessProfileScreen()),
                    );
                  },
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.assessment_outlined, color: AppTheme.primary),
                  title: const Text('Comprehensive Reports', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Sales, inventory valuation, purchases & ledger', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ReportsScreen()),
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

          // Section 2: Daily Operations & Records
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'OPERATIONS & RECORDS',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textMuted, letterSpacing: 0.8),
            ),
          ),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.account_balance_wallet_outlined, color: AppTheme.success),
                  title: const Text('Cash Flow Ledger (Receive & Give)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('All cash entries, party transactions & net position', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PaymentsHistoryScreen()),
                    );
                  },
                ),
                const Divider(),
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
                  leading: const Icon(Icons.alarm_outlined, color: Color(0xFF7C3AED)),
                  title: const Text('Tasks & Reminders', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Follow-ups, restock alerts & payment deadlines', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const RemindersScreen()),
                    );
                  },
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.note_alt_outlined, color: Color(0xFFD97706)),
                  title: const Text('Store Notes & Memos', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Color-coded notes, pinned memos & agreements', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const NotesScreen()),
                    );
                  },
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.notifications_active_outlined, color: AppTheme.primary),
                  title: const Text('Store Notifications Center', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('In-app alerts for low stock, orders & transactions', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textSecondary),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Section 3: App Settings & System
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
                  subtitle: const Text('Architecture, versions & cloud connectivity', style: TextStyle(fontSize: 12)),
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
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
