import 'package:flutter/material.dart';
import '../../core/services/note_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/note.dart';

class NotesScreen extends StatefulWidget {
  const NotesScreen({super.key});

  @override
  State<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends State<NotesScreen> {
  final _noteService = NoteService();

  List<Note> _notes = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  final List<Map<String, dynamic>> _colorPalette = [
    {'name': 'Amber', 'hex': '#FEF3C7', 'color': Color(0xFFFEF3C7)},
    {'name': 'Blue', 'hex': '#E0F2FE', 'color': Color(0xFFE0F2FE)},
    {'name': 'Green', 'hex': '#DCFCE7', 'color': Color(0xFFDCFCE7)},
    {'name': 'Purple', 'hex': '#F3E8FF', 'color': Color(0xFFF3E8FF)},
    {'name': 'Pink', 'hex': '#FCE7F3', 'color': Color(0xFFFCE7F3)},
    {'name': 'Gray', 'hex': '#F1F5F9', 'color': Color(0xFFF1F5F9)},
  ];

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadNotes() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _noteService.getNotes(query: _searchQuery);
      setState(() {
        _notes = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Could not load notes: $e';
        _isLoading = false;
      });
    }
  }

  Color _parseColor(String hex) {
    try {
      final clean = hex.replaceAll('#', '');
      return Color(int.parse('FF$clean', radix: 16));
    } catch (_) {
      return const Color(0xFFFEF3C7);
    }
  }

  void _showNoteDialog({Note? existing}) {
    final titleController = TextEditingController(text: existing?.title ?? '');
    final contentController = TextEditingController(text: existing?.content ?? '');
    String selectedHex = existing?.color ?? '#FEF3C7';
    bool isPinned = existing?.isPinned ?? false;

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
                    Text(
                      existing != null ? 'Edit Note' : 'New Quick Note',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: Icon(
                            isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                            color: isPinned ? AppTheme.primary : AppTheme.textMuted,
                          ),
                          tooltip: isPinned ? 'Unpin' : 'Pin to top',
                          onPressed: () {
                            setModalState(() => isPinned = !isPinned);
                          },
                        ),
                        IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(ctx).pop()),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(
                    labelText: 'Title *',
                    hintText: 'e.g. Supplier payment terms or daily task',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: contentController,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Note Content',
                    alignLabelWithHint: true,
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),

                // Color picker
                Row(
                  children: [
                    const Text('Color:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(width: 12),
                    ..._colorPalette.map((cp) {
                      final isSelected = selectedHex.toUpperCase() == cp['hex'].toString().toUpperCase();
                      return GestureDetector(
                        onTap: () => setModalState(() => selectedHex = cp['hex']),
                        child: Container(
                          margin: const EdgeInsets.only(right: 8),
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: cp['color'] as Color,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected ? AppTheme.primary : Colors.black26,
                              width: isSelected ? 2.5 : 1,
                            ),
                          ),
                          child: isSelected ? const Icon(Icons.check, size: 16, color: AppTheme.primary) : null,
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
                        const SnackBar(content: Text('Please enter a note title'), backgroundColor: AppTheme.error),
                      );
                      return;
                    }

                    Navigator.of(ctx).pop();

                    try {
                      if (existing != null) {
                        final updated = await _noteService.updateNote(
                          id: existing.id,
                          title: titleController.text.trim(),
                          content: contentController.text.trim(),
                          color: selectedHex,
                          isPinned: isPinned,
                        );
                        setState(() {
                          final idx = _notes.indexWhere((n) => n.id == existing.id);
                          if (idx != -1) _notes[idx] = updated;
                          _sortNotes();
                        });
                      } else {
                        final created = await _noteService.createNote(
                          title: titleController.text.trim(),
                          content: contentController.text.trim(),
                          color: selectedHex,
                          isPinned: isPinned,
                        );
                        setState(() {
                          _notes.insert(0, created);
                          _sortNotes();
                        });
                      }
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Note saved!'), backgroundColor: AppTheme.success),
                        );
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error saving note: $e'), backgroundColor: AppTheme.error),
                        );
                      }
                    }
                  },
                  child: Text(existing != null ? 'Save Changes' : 'Create Note'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _sortNotes() {
    _notes.sort((a, b) {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt.compareTo(a.updatedAt);
    });
  }

  Future<void> _deleteNote(Note note) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Note'),
        content: Text('Are you sure you want to delete "${note.title}"?'),
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
      await _noteService.deleteNote(note.id);
      setState(() => _notes.removeWhere((n) => n.id == note.id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Note deleted'), backgroundColor: AppTheme.textPrimary),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error deleting note: $e'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Store Notes & Memos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loadNotes,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showNoteDialog(),
        icon: const Icon(Icons.note_add_outlined),
        label: const Text('New Note'),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search notes by keyword...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                          _loadNotes();
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: (val) {
                setState(() => _searchQuery = val.trim());
                _loadNotes();
              },
            ),
          ),

          // Main List
          Expanded(
            child: _isLoading
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
                              ElevatedButton(onPressed: _loadNotes, child: const Text('Retry')),
                            ],
                          ),
                        ),
                      )
                    : _notes.isEmpty
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
                                    child: const Icon(Icons.edit_note, size: 48, color: AppTheme.primary),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    _searchQuery.isNotEmpty ? 'No notes match "$_searchQuery"' : 'No store notes yet',
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Keep track of supplier agreements, customer special requests, or daily memos.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                                  ),
                                  const SizedBox(height: 20),
                                  ElevatedButton.icon(
                                    onPressed: () => _showNoteDialog(),
                                    icon: const Icon(Icons.add),
                                    label: const Text('Create First Note'),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadNotes,
                            child: ListView.builder(
                              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 80),
                              itemCount: _notes.length,
                              itemBuilder: (ctx, i) {
                                final note = _notes[i];
                                final cardColor = _parseColor(note.color);

                                return Card(
                                  color: cardColor,
                                  elevation: 1,
                                  margin: const EdgeInsets.only(bottom: 12),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    side: BorderSide(
                                      color: note.isPinned ? AppTheme.primary : Colors.black12,
                                      width: note.isPinned ? 1.5 : 1,
                                    ),
                                  ),
                                  child: InkWell(
                                    onTap: () => _showNoteDialog(existing: note),
                                    borderRadius: BorderRadius.circular(14),
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              if (note.isPinned) ...[
                                                const Icon(Icons.push_pin, size: 16, color: AppTheme.primary),
                                                const SizedBox(width: 6),
                                              ],
                                              Expanded(
                                                child: Text(
                                                  note.title,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 15,
                                                    color: AppTheme.textPrimary,
                                                  ),
                                                ),
                                              ),
                                              IconButton(
                                                icon: const Icon(Icons.delete_outline, size: 18, color: Colors.black45),
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(),
                                                onPressed: () => _deleteNote(note),
                                              ),
                                            ],
                                          ),
                                          if (note.content.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            Text(
                                              note.content,
                                              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
                                              maxLines: 4,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                          const SizedBox(height: 10),
                                          Text(
                                            '${note.updatedAt.year}-${note.updatedAt.month.toString().padLeft(2, '0')}-${note.updatedAt.day.toString().padLeft(2, '0')} ${note.updatedAt.hour.toString().padLeft(2, '0')}:${note.updatedAt.minute.toString().padLeft(2, '0')}',
                                            style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
