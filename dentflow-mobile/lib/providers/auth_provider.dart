import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../models/user_model.dart';
import '../services/token_storage_service.dart';
import '../services/dio_client.dart';

class AuthProvider extends ChangeNotifier {
  final TokenStorageService _storage = TokenStorageService();
  final DioClient _dioClient = DioClient();

  User? _user;
  bool _isLoading = false;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _storage.isLoggedIn();

  AuthProvider() {
    // Cek token saat pertama kali diinisialisasi
    _loadUserFromStorage();
  }

  // Load user dari storage (app restart)
  void _loadUserFromStorage() {
    _user = _storage.getUser();
    notifyListeners();
  }

  // LOGIN
  Future<void> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _dioClient.post(
        '/auth/patient/login',
        data: {
          'email': email,
          'password': password,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data['data'] ?? response.data;

        // Parse token & user dari response
        final accessToken = data['access_token'] ?? data['token'];
        final refreshToken = data['refresh_token'] ?? data['refreshToken'];
        final userData = data['user'] ?? data['userData'];

        if (accessToken == null || refreshToken == null || userData == null) {
          throw Exception('Invalid response structure');
        }

        final user = User.fromJson(userData);

        // Simpan token & user ke storage
        _storage.saveTokens(
          accessToken: accessToken,
          refreshToken: refreshToken,
          user: user,
        );

        _user = user;
        _isLoading = false;
        notifyListeners();
      } else {
        throw Exception(response.data['message'] ?? 'Login failed');
      }
    } on DioException catch (e) {
      _isLoading = false;
      notifyListeners();
      final message = e.response?.data['message'] ??
          e.response?.data['error'] ??
          'Network error, please try again';
      throw Exception(message);
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  // LOGOUT
  Future<void> logout() async {
    _storage.clearAll();
    _user = null;
    notifyListeners();
  }

  // REFRESH TOKEN
  Future<String?> refreshToken() async {
    final refreshToken = _storage.getRefreshToken();
    if (refreshToken == null) return null;

    try {
      final response = await _dioClient.post(
        '/auth/refresh',
        data: {
          'refresh_token': refreshToken,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] ?? response.data;
        final newAccessToken = data['access_token'] ?? data['token'];

        if (newAccessToken != null) {
          // Simpan token baru (pertahankan refresh token & user)
          final currentUser = _storage.getUser();
          if (currentUser != null) {
            _storage.saveTokens(
              accessToken: newAccessToken,
              refreshToken: refreshToken,
              user: currentUser,
            );
          }
          return newAccessToken;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Get current user (sync)
  User? getCurrentUser() {
    return _user;
  }

  // Reset loading state
  void resetLoading() {
    _isLoading = false;
    notifyListeners();
  }
}
