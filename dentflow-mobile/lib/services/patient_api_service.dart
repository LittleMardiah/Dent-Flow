import '../models/booking_model.dart';
import '../models/prescription_model.dart';
import 'dio_client.dart';

class PatientApiService {
  final DioClient _dioClient = DioClient();

  Future<Map<String, dynamic>> getPatientProfile(String patientId) async {
    try {
      final response = await _dioClient.get('/api/patients/$patientId');
      return response.data['data'] ?? response.data;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Booking>> getPatientBookings(String patientId, {int limit = 5}) async {
    try {
      final response = await _dioClient.get(
        '/api/patients/$patientId/bookings',
        queryParams: {'limit': limit},
      );

      final data = response.data['data'] ?? response.data;
      final List<dynamic> bookings = data['bookings'] ?? data ?? [];

      return bookings.map((json) => Booking.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Prescription>> getPatientPrescriptions(String patientId) async {
    try {
      final response = await _dioClient.get(
        '/api/patients/$patientId/prescriptions',
      );

      final data = response.data['data'] ?? response.data;
      final List<dynamic> prescriptions = data['prescriptions'] ?? data ?? [];

      return prescriptions.map((json) => Prescription.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }
}
