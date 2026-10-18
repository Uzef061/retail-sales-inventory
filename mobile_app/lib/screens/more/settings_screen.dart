import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/services/api_client.dart';
import '../../core/services/auth_service.dart';
import '../../core/theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiClient _apiClient = ApiClient();
  final _customUrlController = TextEditingController();
  late String _selectedUrl;
  bool _isTesting = false;
  bool? _testResult;
  String? _testMessage;

  @override
  void initState() {
    super.initState();
    _selectedUrl = _apiClient.baseUrl;
    _customUrlController.text = _selectedUrl;
  }

  @override
  void dispose() {
    _customUrlController.dispose();
    super.dispose();
  }

  Future<void> _runConnectionTest() async {
    setState(() {
      _isTesting = true;
      _testResult = null;
      _testMessage = null;
    });

    final targetUrl = _selectedUrl.trim();
    // Temporarily apply for test
    final original = _apiClient.baseUrl;
    await _apiClient.setBaseUrl(targetUrl);

    final success = await _apiClient.testConnection();

    if (!success) {
      await _apiClient.setBaseUrl(original);
    }

    if (mounted) {
      setState(() {
        _isTesting = false;
        _testResult = success;
        _testMessage = success
            ? 'Connected successfully to backend!'
            : 'Unable to reach backend. Check host address and internet access.';
      });
    }
  }

  Future<void> _applySettings() async {
    final targetUrl = _selectedUrl.trim();
    await _apiClient.setBaseUrl(targetUrl);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Server URL set to $targetUrl'),
          backgroundColor: AppTheme.success,
        ),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = AuthService();
    final isCustom = _selectedUrl != ApiConfig.defaultLiveUrl &&
        _selectedUrl != ApiConfig.defaultLocalUrl &&
        _selectedUrl != ApiConfig.defaultLanUrl;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Backend Server Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, color: AppTheme.primary, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Select the backend server that this app will connect to for real-time sales, inventory, and analytics.',
                    style: TextStyle(fontSize: 13, color: AppTheme.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Server Options Card
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: Icon(
                    _selectedUrl == ApiConfig.defaultLiveUrl ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: _selectedUrl == ApiConfig.defaultLiveUrl ? AppTheme.primary : AppTheme.textSecondary,
                  ),
                  title: const Text('Render Cloud (Live)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text(ApiConfig.defaultLiveUrl, style: TextStyle(fontSize: 12)),
                  onTap: () {
                    setState(() {
                      _selectedUrl = ApiConfig.defaultLiveUrl;
                      _customUrlController.text = ApiConfig.defaultLiveUrl;
                      _testResult = null;
                    });
                  },
                ),
                const Divider(),
                ListTile(
                  leading: Icon(
                    _selectedUrl == ApiConfig.defaultLocalUrl ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: _selectedUrl == ApiConfig.defaultLocalUrl ? AppTheme.primary : AppTheme.textSecondary,
                  ),
                  title: const Text('Android Emulator Host', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('http://10.0.2.2:5000 (Local Node server)', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    setState(() {
                      _selectedUrl = ApiConfig.defaultLocalUrl;
                      _customUrlController.text = ApiConfig.defaultLocalUrl;
                      _testResult = null;
                    });
                  },
                ),
                const Divider(),
                ListTile(
                  leading: Icon(
                    isCustom ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: isCustom ? AppTheme.primary : AppTheme.textSecondary,
                  ),
                  title: const Text('Custom Backend Host', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('Enter custom IP or domain', style: TextStyle(fontSize: 12)),
                  onTap: () {
                    setState(() {
                      _selectedUrl = _customUrlController.text.trim();
                      _testResult = null;
                    });
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Custom URL Input
          TextField(
            controller: _customUrlController,
            decoration: const InputDecoration(
              labelText: 'Active Server URL',
              hintText: 'https://...',
              prefixIcon: Icon(Icons.link, size: 20),
            ),
            onChanged: (val) {
              setState(() {
                _selectedUrl = val.trim();
                _testResult = null;
              });
            },
          ),
          const SizedBox(height: 16),

          // Test Result Banner
          if (_testResult != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _testResult! ? AppTheme.successLight : AppTheme.errorLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _testResult! ? AppTheme.success : AppTheme.error,
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _testResult! ? Icons.check_circle : Icons.error,
                    color: _testResult! ? AppTheme.success : AppTheme.error,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _testMessage ?? '',
                      style: TextStyle(
                        color: _testResult! ? AppTheme.success : AppTheme.error,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isTesting ? null : _runConnectionTest,
                  icon: _isTesting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.network_ping, size: 18),
                  label: const Text('Test Ping'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _applySettings,
                  icon: const Icon(Icons.save, size: 18),
                  label: const Text('Save & Apply'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Session Status Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Active Session Info', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 8),
                  Text(
                    'Logged In: ${authService.isLoggedIn ? authService.currentUser?.name : "No active session"}',
                    style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Role: ${authService.currentUser?.role ?? "N/A"}',
                    style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Token: ${_apiClient.authToken != null ? "Active (Bearer JWT)" : "Public / Cookie mode"}',
                    style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
