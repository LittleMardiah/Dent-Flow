import '../models/queue_patient.dart';
import 'dio_client.dart';

class DoctorApiService {
  final DioClient _dioClient = DioClient();

  // Login doctor (auth)
  Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final response = await _dioClient.post('/auth/doctor/login', data: {
        'username': username,
        'password': password,
      });
      return response.data['data'] ?? response.data;
    } catch (e) {
      rethrow;
    }
  }

  // Get today's queue
  Future<List<QueuePatient>> getQueueToday(String doctorId) async {
    try {
      final response = await _dioClient.get('/doctors/$doctorId/queue-today');
      final data = response.data['data'] ?? response.data;
      final List<dynamic> patients = data['queue'] ?? data['patients'] ?? data ?? [];
      return patients.map((json) => QueuePatient.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  // Call next patient
  Future<QueuePatient> readyNext(String doctorId) async {
    try {
      final response = await _dioClient.post('/doctors/$doctorId/ready-next');
      final data = response.data['data'] ?? response.data;
      return QueuePatient.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  // Get patient quick view
  Future<Map<String, dynamic>> getPatientQuickView(String patientId) async {
    try {
      final response = await _dioClient.get('/patients/$patientId/quick-view');
      return response.data['data'] ?? response.data;
    } catch (e) {
      rethrow;
    }
  }

  // Create encounter (EMR)
  Future<Map<String, dynamic>> createEncounter({
    required String patientId,
    required String doctorId,
    required String bookingId,
    required Map<String, dynamic> vitalSigns,
    required String diagnosis,
    required String notes,
    List<String>? images,
  }) async {
    try {
      final response = await _dioClient.post('/encounters', data: {
        'patientId': patientId,
        'doctorId': doctorId,
        'bookingId': bookingId,
        'vitalSigns': vitalSigns,
        'diagnosis': diagnosis,
        'notes': notes,
        'images': images,
      });
      return response.data['data'] ?? response.data;
    } catch (e) {
      rethrow;
    }
  }
}
