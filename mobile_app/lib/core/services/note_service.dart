import '../config/api_config.dart';
import '../../models/note.dart';
import 'api_client.dart';

class NoteService {
  final ApiClient _apiClient = ApiClient();

  Future<List<Note>> getNotes({String? search, String? query}) async {
    final term = search ?? query;
    String endpoint = ApiConfig.notes;
    if (term != null && term.isNotEmpty) {
      endpoint = '$endpoint?search=${Uri.encodeComponent(term)}';
    }

    final response = await _apiClient.get(endpoint);
    if (response is List) {
      return response
          .map((item) => Note.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<Note> createNote({
    required String title,
    required String content,
    String color = '#FFF8F0',
    bool isPinned = false,
  }) async {
    final payload = <String, dynamic>{
      'title': title,
      'content': content,
      'color': color,
      'isPinned': isPinned,
    };

    final response = await _apiClient.post(ApiConfig.notes, payload);
    return Note.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<Note> updateNote({
    String? id,
    String? title,
    String? content,
    String? color,
    bool? isPinned,
    Note? note,
  }) async {
    final noteId = note?.id ?? id ?? '';
    final payload = note != null
        ? note.toJson()
        : {
            if (title != null) 'title': title,
            if (content != null) 'content': content,
            if (color != null) 'color': color,
            if (isPinned != null) 'isPinned': isPinned,
          };

    final response = await _apiClient.put(
      '${ApiConfig.notes}/$noteId',
      payload,
    );
    return Note.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<void> deleteNote(String id) async {
    await _apiClient.delete('${ApiConfig.notes}/$id');
  }
}
