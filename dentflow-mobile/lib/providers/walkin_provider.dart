import 'package:flutter/material.dart';
import 'dart:async';
import '../models/walkin_response.dart';
import '../services/walkin_api_service.dart';

class WalkInProvider extends ChangeNotifier {
  final WalkInApiService _apiService = WalkInApiService();

  WalkInResponse? _response;
  bool _isLoading = false;
  String? _errorMessage;
  Timer? _pollingTimer;

  WalkInResponse? get response => _response;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // Create walk-in booking
  Future<void> createWalkIn({
    required String name,
    required String phone,
    required String branchId,
    String? doctorId,
    String? service,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _response = await _apiService.createWalkIn(
        name: name,
        phone: phone,
        branchId: branchId,
        doctorId: doctorId,
        service: service,
      );
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  // Start polling queue status
  void startPolling(String tempPatientId) {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (timer) async {
      try {
        final status = await _apiService.getWalkInStatus(tempPatientId);
        if (_response != null) {
          _response = status;
          notifyListeners();
        }
        // Stop polling if completed
        if (status.isCompleted) {
          stopPolling();
        }
      } catch (e) {
        // Silent fail on polling (network error)
        debugPrint('Polling error: $e');
      }
    });
  }

  // Stop polling
  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
    notifyListeners();
  }

  // Reset state
  void reset() {
    stopPolling();
    _response = null;
    _isLoading = false;
    _errorMessage = null;
    notifyListeners();
  }
}
