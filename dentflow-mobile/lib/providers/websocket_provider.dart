import 'package:flutter/material.dart';
import '../services/websocket_service.dart';

class WebSocketProvider extends ChangeNotifier {
  final WebSocketService _wsService = WebSocketService();
  bool _isConnected = false;
  int _newArrivals = 0;

  bool get isConnected => _isConnected;
  int get newArrivals => _newArrivals;

  WebSocketProvider() {
    _wsService.onQueueUpdate.listen((data) {
      _newArrivals++;
      notifyListeners();
    });
  }

  void connect(String token, String userId, String role) {
    _wsService.connect(token, userId, role);
    _isConnected = _wsService.isConnected;
    notifyListeners();
  }

  void subscribeSlot(String branchId) {
    _wsService.subscribeSlot(branchId);
  }

  void unsubscribeSlot(String branchId) {
    _wsService.unsubscribeSlot(branchId);
  }

  void resetNewArrivals() {
    _newArrivals = 0;
    notifyListeners();
  }

  void disconnect() {
    _wsService.disconnect();
    _isConnected = false;
    notifyListeners();
  }

  Stream<Map<String, dynamic>> get onQueueUpdate => _wsService.onQueueUpdate;
  Stream<Map<String, dynamic>> get onSlotUpdate => _wsService.onSlotUpdate;

  @override
  void dispose() {
    _wsService.dispose();
    super.dispose();
  }
}
