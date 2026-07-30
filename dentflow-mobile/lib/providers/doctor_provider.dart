import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import '../models/queue_patient.dart';
import '../services/doctor_api_service.dart';
import 'websocket_provider.dart';

class DoctorProvider extends ChangeNotifier {
  final DoctorApiService _apiService = DoctorApiService();
  WebSocketProvider? _wsProvider;

  List<QueuePatient> _queue = [];
  QueuePatient? _currentPatient;
  bool _isLoading = false;
  String? _errorMessage;
  Timer? _pollingTimer;
  String? _doctorId;

  List<QueuePatient> get queue => _queue;
  QueuePatient? get currentPatient => _currentPatient;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<QueuePatient> get waitingPatients {
    return _queue.where((p) => p.isWaiting || p.isBeingCalled).toList();
  }

  List<QueuePatient> get nextPatients {
    return waitingPatients.take(3).toList();
  }

  void init({required String doctorId, required BuildContext context}) {
    _doctorId = doctorId;
    _wsProvider = Provider.of<WebSocketProvider>(context, listen: false);

    // Listen to WebSocket updates
    _wsProvider?.onQueueUpdate.listen((data) {
      if (_doctorId != null) {
        loadQueue(_doctorId!);
        _wsProvider?.resetNewArrivals();
      }
    });

    // Initial load
    loadQueue(doctorId);

    // Start polling fallback (10s, but only if WebSocket is not connected)
    _startPolling(doctorId);
  }

  Future<void> loadQueue(String doctorId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final patients = await _apiService.getQueueToday(doctorId);
      _queue = patients;
      _currentPatient = _queue.firstWhere(
        (p) => p.isBeingCalled || p.isInService,
        orElse: () {
          final waiting = _queue.firstWhere(
            (p) => p.isWaiting,
            orElse: () => QueuePatient(
              id: '',
              patientId: '',
              patientName: '',
              queueNumber: 0,
              status: 'COMPLETED',
              checkInTime: DateTime.now(),
            ),
          );
          return waiting;
        },
      );
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<QueuePatient?> readyNext(String doctorId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final nextPatient = await _apiService.readyNext(doctorId);
      _currentPatient = nextPatient;
      _isLoading = false;
      notifyListeners();
      return nextPatient;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  Future<Map<String, dynamic>> getPatientQuickView(String patientId) async {
    try {
      return await _apiService.getPatientQuickView(patientId);
    } catch (e) {
      rethrow;
    }
  }

  void _startPolling(String doctorId) {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (timer) async {
      if (_wsProvider == null || !_wsProvider!.isConnected) {
        await loadQueue(doctorId);
      }
    });
  }

  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  void reset() {
    _queue = [];
    _currentPatient = null;
    _isLoading = false;
    _errorMessage = null;
    stopPolling();
    notifyListeners();
  }
}
