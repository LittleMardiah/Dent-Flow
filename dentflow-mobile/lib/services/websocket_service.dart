import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:async';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;

  IO.Socket? _socket;
  bool _isConnected = false;
  String? _currentToken;
  String? _currentUserId;
  String? _currentRole;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;

  final _queueStreamController = StreamController<Map<String, dynamic>>.broadcast();
  final _slotStreamController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get onQueueUpdate => _queueStreamController.stream;
  Stream<Map<String, dynamic>> get onSlotUpdate => _slotStreamController.stream;
  bool get isConnected => _isConnected;

  WebSocketService._internal();

  void connect(String token, String userId, String role) {
    if (_socket != null && _isConnected) {
      // print('WebSocket already connected');
      return;
    }

    _currentToken = token;
    _currentUserId = userId;
    _currentRole = role;

    final baseUrl = 'wss://sari-inartificial-dwain.ngrok-free.dev'; // Ganti dengan IP backend lo
    final uri = baseUrl.replaceFirst('http', 'ws');

    try {
      _socket = IO.io(uri, {
        'transports': ['websocket'],
        'autoConnect': true,
        'extraHeaders': {
          'Authorization': 'Bearer $token',
        },
      });

      _socket!.onConnect((_) {
        // print('🔌 WebSocket connected');
        _isConnected = true;
        _reconnectAttempts = 0;
        _reconnectTimer?.cancel();
        _subscribeToChannels();
      });

      _socket!.onDisconnect((_) {
        // print('🔌 WebSocket disconnected');
        _isConnected = false;
        _scheduleReconnect();
      });

      _socket!.on('queue:updated', (data) {
        _queueStreamController.add(data);
      });

      _socket!.on('slot:available', (data) {
        _slotStreamController.add(data);
      });

      _socket!.onError((error) {
        // print('WebSocket error: $error');
      });

      _socket!.connect();
    } catch (e) {
      // print('WebSocket connection error: $e');
      _scheduleReconnect();
    }
  }

  void _subscribeToChannels() {
    if (_socket == null || !_isConnected) return;

    if (_currentRole == 'DOCTOR' && _currentUserId != null) {
      _socket!.emit('subscribe', 'queue:doctor:$_currentUserId');
      // print('✅ Subscribed to queue:doctor:$_currentUserId');
    }

    // Subscribe to branch slots if patient (optional)
    if (_currentRole == 'PATIENT') {
      // Will subscribe dynamically when viewing slots
    }
  }

  void subscribeSlot(String branchId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('subscribe', 'slot:available:$branchId');
      // print('✅ Subscribed to slot:available:$branchId');
    }
  }

  void unsubscribeSlot(String branchId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('unsubscribe', 'slot:available:$branchId');
    }
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    final delay = Duration(seconds: _reconnectAttempts < 5 ? 2 : 10);
    _reconnectAttempts++;
    _reconnectTimer = Timer(delay, () {
      if (!_isConnected && _currentToken != null) {
        // print('🔄 Reconnecting WebSocket... (attempt $_reconnectAttempts)');
        connect(_currentToken!, _currentUserId!, _currentRole!);
      }
    });
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    _currentToken = null;
    _currentUserId = null;
    _currentRole = null;
  }

  void dispose() {
    disconnect();
    _queueStreamController.close();
    _slotStreamController.close();
  }
}
