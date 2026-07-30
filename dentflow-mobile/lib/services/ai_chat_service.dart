import '../services/dio_client.dart';

class AIChatService {
  final DioClient _dioClient = DioClient();

  Future<String> sendMessage(String message, {String? conversationId}) async {
    try {
      final response = await _dioClient.post('/api/ai/chat', data: {
        'message': message,
        'conversationId': conversationId,
      });

      final data = response.data['data'] ?? response.data;
      return data['reply'] ?? data['response'] ?? 'Maaf, saya tidak bisa menjawab pertanyaan Anda.';
    } catch (e) {
      return 'Maaf, layanan AI sedang sibuk. Silakan coba lagi nanti atau hubungi admin.';
    }
  }
}
