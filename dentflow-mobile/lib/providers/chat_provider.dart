import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import '../services/ai_chat_service.dart';

class ChatProvider extends ChangeNotifier {
  final AIChatService _chatService = AIChatService();

  List<ChatMessage> _messages = [];
  bool _isLoading = false;
  bool _isTyping = false;
  bool _isOpen = false;

  List<ChatMessage> get messages => _messages;
  bool get isLoading => _isLoading;
  bool get isTyping => _isTyping;
  bool get isOpen => _isOpen;

  // Quick prompts
  static const List<String> quickPrompts = [
    'Kapan janji temu saya berikutnya?',
    'Tampilkan resep saya',
    'Berapa tagihan saya?',
    'Bagaimana cara booking?',
  ];

  Future<void> sendMessage(String message) async {
    if (message.trim().isEmpty) return;

    // Add user message
    final userMessage = ChatMessage.user(message);
    _messages.add(userMessage);
    notifyListeners();

    // Add typing indicator
    _isTyping = true;
    _messages.add(ChatMessage.typing());
    notifyListeners();

    try {
      // Call AI API
      final reply = await _chatService.sendMessage(message);

      // Remove typing indicator and add assistant reply
      _messages.removeWhere((msg) => msg.isTyping);
      _isTyping = false;

      final assistantMessage = ChatMessage.assistant(reply);
      _messages.add(assistantMessage);
      notifyListeners();
    } catch (e) {
      // Remove typing and show error
      _messages.removeWhere((msg) => msg.isTyping);
      _isTyping = false;
      _messages.add(ChatMessage.assistant('Maaf, terjadi kesalahan. Silakan coba lagi.'));
      notifyListeners();
    }
  }

  void toggleOpen() {
    _isOpen = !_isOpen;
    if (_isOpen && _messages.isEmpty) {
      // Add welcome message
      _messages.add(ChatMessage.assistant(
        'Halo! 👋 Saya asisten DentFlow. Ada yang bisa saya bantu? Coba tanyakan jadwal booking, tagihan, atau resep Anda.'
      ));
      notifyListeners();
    }
    notifyListeners();
  }

  void close() {
    _isOpen = false;
    notifyListeners();
  }

  void clearMessages() {
    _messages.clear();
    notifyListeners();
  }

  void addQuickPrompt(String prompt) {
    sendMessage(prompt);
  }
}
