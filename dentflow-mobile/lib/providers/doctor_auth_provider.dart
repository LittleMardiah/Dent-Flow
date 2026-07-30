import 'package:flutter/material.dart';
import '../models/doctor.dart';
import '../services/doctor_api_service.dart';
import '../services/token_storage_service.dart';

class DoctorAuthProvider extends ChangeNotifier {
  final DoctorApiService _apiService = DoctorApiService();
  final TokenStorageService _tokenStorage = TokenStorageService();

  Doctor? _doctor;
  bool _isLoading = false;
  String? _errorMessage;

  Doctor? get doctor => _doctor;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isLoggedIn => _tokenStorage.getAccessToken() != null;

  DoctorAuthProvider() {
    _loadDoctorFromStorage();
  }

  void _loadDoctorFromStorage() {
    // Doctor data is stored as User in token storage
    // We'll store doctor separately or use the existing user storage
    final user = _tokenStorage.getUser();
    if (user != null) {
      _doctor = Doctor(
        id: user.id,
        fullName: user.fullName,
        specialization: '', // Not in user model
        branchId: '', // Not in user model
      );
      notifyListeners();
    }
  }

  Future<void> login(String username, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _apiService.login(username, password);
      final accessToken = result['access_token'] ?? result['token'];
      final refreshToken = result['refresh_token'] ?? result['refreshToken'];
      final userData = result['user'] ?? result['userData'];

      if (accessToken == null || userData == null) {
        throw Exception('Invalid login response');
      }

      // Save tokens (reuse patient storage structure)
      // We'll adapt - store doctor as user
      final user = userData;
      _tokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken ?? '',
        user: user,
      );

      _doctor = Doctor(
        id: user['id'] ?? '',
        fullName: user['fullName'] ?? user['full_name'] ?? '',
        specialization: user['specialization'] ?? user['spesialisasi'] ?? '',
        branchId: user['branchId'] ?? user['branch_id'] ?? '',
        licenseNumber: user['licenseNumber'] ?? user['license_number'],
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

  Future<void> logout() async {
    _tokenStorage.clearAll();
    _doctor = null;
    notifyListeners();
  }

  void reset() {
    _isLoading = false;
    _errorMessage = null;
    notifyListeners();
  }
}
