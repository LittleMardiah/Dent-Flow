import 'package:get_storage/get_storage.dart';
import '../models/user_model.dart';

class TokenStorageService {
  final GetStorage _storage = GetStorage();

  static const String _accessTokenKey = '_access_tk';
  static const String _refreshTokenKey = '_refresh_tk';
  static const String _userDataKey = '_user_data';

  // Simpan semua token & user data
  void saveTokens({
    required String accessToken,
    required String refreshToken,
    required User user,
  }) {
    _storage.write(_accessTokenKey, accessToken);
    _storage.write(_refreshTokenKey, refreshToken);
    _storage.write(_userDataKey, user.toJson());
  }

  // Ambil access token
  String? getAccessToken() {
    return _storage.read<String>(_accessTokenKey);
  }

  // Ambil refresh token
  String? getRefreshToken() {
    return _storage.read<String>(_refreshTokenKey);
  }

  // Ambil user data
  User? getUser() {
    final data = _storage.read<Map<String, dynamic>>(_userDataKey);
    if (data == null) return null;
    try {
      return User.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  // Cek apakah user sudah login (ada access token)
  bool isLoggedIn() {
    return getAccessToken() != null;
  }

  // Hapus semua token & user data (logout)
  void clearAll() {
    _storage.remove(_accessTokenKey);
    _storage.remove(_refreshTokenKey);
    _storage.remove(_userDataKey);
  }
}
