import 'package:flutter/material.dart';
import 'dart:async';
import '../models/queue_patient.dart';
import '../services/doctor_api_service.dart';

class DoctorProvider extends ChangeNotifier {
  final DoctorApiService _apiService = DoctorApiService();

  List<QueuePatient> _queue = [];
  QueuePatient? _currentPatient;
  bool _isLoading = false;
  String? _errorMessage;
  Timer? _pollingTimer;

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

  void startPolling(String doctorId) {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      await loadQueue(doctorId);
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
