import 'package:dio/dio.dart';
import 'package:dio_smart_retry/dio_smart_retry.dart';
import '../constants/api.dart';
import 'token_storage_service.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;

  late Dio dio;
  final TokenStorageService _tokenStorage = TokenStorageService();

  DioClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Interceptor: Tambahkan token ke setiap request
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = _tokenStorage.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          // Jika 401 Unauthorized, logout
          if (error.response?.statusCode == 401) {
            _tokenStorage.clearAll();
            // Akan di-handle oleh AuthProvider (rethrow)
          }
          return handler.next(error);
        },
      ),
    );

    // Retry interceptor (coba ulang request gagal max 3x)
    dio.interceptors.add(
      RetryInterceptor(
        dio: dio,
        logPrint: (msg) => print(msg),
        retries: 3,
        retryDelays: const [
          Duration(seconds: 1),
          Duration(seconds: 2),
          Duration(seconds: 3),
        ],
        retryableExtraStatuses: {500, 502, 503},
      ),
    );
  }

  // Helper untuk request GET
  Future<Response> get(String path, {Map<String, dynamic>? queryParams}) async {
    try {
      return await dio.get(path, queryParameters: queryParams);
    } catch (e) {
      rethrow;
    }
  }

  // Helper untuk request POST
  Future<Response> post(String path, {dynamic data}) async {
    try {
      return await dio.post(path, data: data);
    } catch (e) {
      rethrow;
    }
  }

  // Helper untuk request PUT
  Future<Response> put(String path, {dynamic data}) async {
    try {
      return await dio.put(path, data: data);
    } catch (e) {
      rethrow;
    }
  }

  // Helper untuk request DELETE
  Future<Response> delete(String path) async {
    try {
      return await dio.delete(path);
    } catch (e) {
      rethrow;
    }
  }
}
