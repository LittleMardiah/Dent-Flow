import '../models/branch_model.dart';
import '../models/doctor_model.dart';
import '../models/slot_model.dart';
import 'dio_client.dart';

class BookingApiService {
  final DioClient _dioClient = DioClient();

  Future<List<Branch>> getBranches() async {
    final res = await _dioClient.get('/branches');
    final data = res.data['data'] ?? res.data;
    final List<dynamic> list = data['branches'] ?? data ?? [];
    return list.map((j) => Branch.fromJson(j)).toList();
  }

  Future<List<Doctor>> getDoctors(String branchId) async {
    final res = await _dioClient.get('/doctors', queryParams: {'branchId': branchId});
    final data = res.data['data'] ?? res.data;
    final List<dynamic> list = data['doctors'] ?? data ?? [];
    return list.map((j) => Doctor.fromJson(j)).toList();
  }

  Future<List<Slot>> getDoctorSlots(String doctorId, String date) async {
    final res = await _dioClient.get('/doctors/$doctorId/slots', queryParams: {'date': date});
    final data = res.data['data'] ?? res.data;
    final List<dynamic> list = data['slots'] ?? data ?? [];
    return list.map((j) => Slot.fromJson(j)).toList();
  }

  Future<Map<String, dynamic>> createBooking({
    required String branchId,
    required String doctorId,
    required String slotId,
    required String date,
  }) async {
    final res = await _dioClient.post('/bookings', data: {
      'branchId': branchId,
      'doctorId': doctorId,
      'slotId': slotId,
      'date': date,
    });
    return res.data['data'] ?? res.data;
  }

  Future<Map<String, dynamic>> getPaymentUrl(String bookingId) async {
    final res = await _dioClient.post('/bookings/$bookingId/payment');
    return res.data['data'] ?? res.data;
  }

  Future<Map<String, dynamic>> getBookingStatus(String bookingId) async {
    final res = await _dioClient.get('/bookings/$bookingId');
    return res.data['data'] ?? res.data;
  }
}
