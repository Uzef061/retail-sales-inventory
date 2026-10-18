import 'package:flutter/material.dart';
import '../../core/services/reminder_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/reminder.dart';

class RemindersScreen extends StatefulWidget {
  const RemindersScreen({super.key});

  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> {
  final _reminderService = ReminderService();

  List<Reminder> _reminders = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _filter = 'all'; // 'all', 'pending', 'completed'

  @override
  void initState() {
    super.initState();
    _loadReminders();
  }

  Future<void> _loadReminders() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _reminderService.getReminders();
      setState(() {
        _reminders = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load reminders: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleStatus(Reminder reminder) async {
    final newStatus = !reminder.isCompleted;
    // Optimistic UI update
    setState(() {
      final index = _reminders.indexWhere((r) => r.id == reminder.id);
      if (index != -1) {
        _reminders[index] = _reminders[index].copyWith(isCompleted: newStatus);
      }
    });

    try {
      await _reminderService.toggleReminder(reminder.id, newStatus);
    } catch (e) {
      // Revert if failed
      _loadReminders();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update status: $e'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  Future<void> _deleteReminder(Reminder reminder) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Reminder'),
        content: Text('Are you sure you want to delete "${reminder.title}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _reminderService.deleteReminder(reminder.id);
      setState(() {
        _reminders.removeWhere((r) => r.id == reminder.id);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reminder deleted'), backgroundColor: AppTheme.textPrimary),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete: $e'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  void _showAddDialog() {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final partyController = TextEditingController();
    DateTime selectedDate = DateTime.now().add(const Duration(hours: 4));
    String selectedPriority = 'MEDIUM';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('New Reminder', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(ctx).pop()),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(
                    labelText: 'Reminder Title *',
                    hintText: 'e.g. Call supplier for stock arrival',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Details / Description (Optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: partyController,
                  decoration: const InputDecoration(
                    labelText: 'Related Party / Customer (Optional)',
                    prefixIcon: Icon(Icons.person_outline),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.calendar_today, size: 16),
                        label: Text(
                          '${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}',
                          style: const TextStyle(fontSize: 13),
                        ),
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: ctx,
                            initialDate: selectedDate,
                            firstDate: DateTime.now().subtract(const Duration(days: 1)),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setModalState(() {
                              selectedDate = DateTime(
                                picked.year,
                                picked.month,
                                picked.day,
                                selectedDate.hour,
                                selectedDate.minute,
                              );
                            });
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.access_time, size: 16),
                        label: Text(
                          '${selectedDate.hour.toString().padLeft(2, '0')}:${selectedDate.minute.toString().padLeft(2, '0')}',
                          style: const TextStyle(fontSize: 13),
                        ),
                        onPressed: () async {
                          final picked = await showTimePicker(
                            context: ctx,
                            initialTime: TimeOfDay.fromDateTime(selectedDate),
                          );
                          if (picked != null) {
                            setModalState(() {
                              selectedDate = DateTime(
                                selectedDate.year,
                                selectedDate.month,
                                selectedDate.day,
                                picked.hour,
                                picked.minute,
                              );
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text('Priority:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(width: 12),
                    ...['LOW', 'MEDIUM', 'HIGH'].map((p) {
                      final isSel = selectedPriority == p;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(p, style: TextStyle(fontSize: 11, color: isSel ? Colors.white : AppTheme.textPrimary)),
                          selected: isSel,
                          selectedColor: p == 'HIGH'
                              ? AppTheme.error
                              : p == 'MEDIUM'
                                  ? AppTheme.warning
                                  : AppTheme.secondary,
                          onSelected: (val) {
                            if (val) setModalState(() => selectedPriority = p);
                          },
                          showCheckmark: false,
                        ),
                      );
                    }),
                  ],
                ),
                const SizedBox(height: 18),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                  onPressed: () async {
                    if (titleController.text.trim().isEmpty) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Please enter a reminder title'), backgroundColor: AppTheme.error),
                      );
                      return;
                    }

                    Navigator.of(ctx).pop();
                    try {
                      final created = await _reminderService.createReminder(
                        title: titleController.text.trim(),
                        description: descController.text.trim(),
                        dueDate: selectedDate,
                        priority: selectedPriority,
                        partyName: partyController.text.trim(),
                      );
                      setState(() {
                        _reminders.insert(0, created);
                      });
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Reminder created!'), backgroundColor: AppTheme.success),
                        );
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error creating reminder: $e'), backgroundColor: AppTheme.error),
                        );
                      }
                    }
                  },
                  child: const Text('Add Reminder'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _reminders.where((r) {
      if (_filter == 'pending') return !r.isCompleted;
      if (_filter == 'completed') return r.isCompleted;
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasks & Reminders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadReminders,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: AppTheme.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildFilterTab('all', 'All (${_reminders.length})'),
                _buildFilterTab('pending', 'Pending (${_reminders.where((r) => !r.isCompleted).length})'),
                _buildFilterTab('completed', 'Done (${_reminders.where((r) => r.isCompleted).length})'),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddDialog,
        icon: const Icon(Icons.add_alarm),
        label: const Text('Add Reminder'),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppTheme.error),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadReminders, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : filtered.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.notifications_none, size: 48, color: AppTheme.primary),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'No reminders found',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Stay on top of supplier restocks, customer follow-ups, and payment deadlines.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton.icon(
                              onPressed: _showAddDialog,
                              icon: const Icon(Icons.add),
                              label: const Text('Create First Reminder'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadReminders,
                      child: ListView.builder(
                        padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 80),
                        itemCount: filtered.length,
                        itemBuilder: (ctx, i) {
                          final item = filtered[i];
                          final isOverdue = !item.isCompleted && item.dueDate.isBefore(DateTime.now());

                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: isOverdue
                                    ? AppTheme.error.withValues(alpha: 0.5)
                                    : item.isCompleted
                                        ? Colors.black12
                                        : AppTheme.primary.withValues(alpha: 0.2),
                              ),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              leading: Checkbox(
                                value: item.isCompleted,
                                activeColor: AppTheme.success,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                onChanged: (_) => _toggleStatus(item),
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.title,
                                      style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 15,
                                        decoration: item.isCompleted ? TextDecoration.lineThrough : null,
                                        color: item.isCompleted ? AppTheme.textMuted : AppTheme.textPrimary,
                                      ),
                                    ),
                                  ),
                                  _buildPriorityBadge(item.priority),
                                ],
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (item.description.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      item.description,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: item.isCompleted ? AppTheme.textMuted : AppTheme.textSecondary,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.calendar_today,
                                        size: 13,
                                        color: isOverdue ? AppTheme.error : AppTheme.textMuted,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '${item.dueDate.year}-${item.dueDate.month.toString().padLeft(2, '0')}-${item.dueDate.day.toString().padLeft(2, '0')} ${item.dueDate.hour.toString().padLeft(2, '0')}:${item.dueDate.minute.toString().padLeft(2, '0')}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: isOverdue ? FontWeight.bold : FontWeight.normal,
                                          color: isOverdue ? AppTheme.error : AppTheme.textMuted,
                                        ),
                                      ),
                                      if (isOverdue) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFEE2E2),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'OVERDUE',
                                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppTheme.error),
                                          ),
                                        ),
                                      ],
                                      if (item.partyName.isNotEmpty) ...[
                                        const Spacer(),
                                        Text(
                                          item.partyName,
                                          style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline, size: 20, color: AppTheme.textMuted),
                                onPressed: () => _deleteReminder(item),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _buildFilterTab(String filter, String label) {
    final isSel = _filter == filter;
    return InkWell(
      onTap: () => setState(() => _filter = filter),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSel ? AppTheme.primaryLight : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? AppTheme.primary : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildPriorityBadge(String priority) {
    Color bg;
    Color fg;
    switch (priority.toUpperCase()) {
      case 'HIGH':
        bg = const Color(0xFFFEE2E2);
        fg = AppTheme.error;
        break;
      case 'MEDIUM':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        break;
      default:
        bg = const Color(0xFFE0F2FE);
        fg = const Color(0xFF0369A1);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        priority,
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }
}
