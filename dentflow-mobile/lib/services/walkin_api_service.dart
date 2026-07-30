import '../models/walkin_response.dart';
import 'dio_client.dart';

class WalkInApiService {
  final DioClient _dioClient = DioClient();

  Future<WalkInResponse> createWalkIn({
    required String name,
    required String phone,
    required String branchId,
    String? doctorId,
    String? service,
  }) async {
    try {
      final response = await _dioClient.post('/bookings/walk-in', data: {
        'name': name,
        'phone': phone,
        'branchId': branchId,
        'doctorId': doctorId,
        'service': service,
      });
      final data = response.data['data'] ?? response.data;
      return WalkInResponse.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  Future<WalkInResponse> getWalkInStatus(String tempPatientId) async {
    try {
      final response = await _dioClient.get('/bookings/walk-in/$tempPatientId/status');
      final data = response.data['data'] ?? response.data;
      return WalkInResponse.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  // Alternative: check by queue number
  Future<WalkInResponse> getWalkInStatusByQueue(int queueNumber) async {
    try {
      final response = await _dioClient.get('/queue/status', queryParams: {
        'queueNumber': queueNumber,
      });
      final data = response.data['data'] ?? response.data;
      return WalkInResponse.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }
}
