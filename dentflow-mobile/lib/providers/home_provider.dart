import 'package:flutter/material.dart';
import 'package:get_storage/get_storage.dart';
import '../models/booking_model.dart';
import '../models/prescription_model.dart';
import '../services/patient_api_service.dart';
import 'auth_provider.dart';

class HomeProvider extends ChangeNotifier {
  final PatientApiService _apiService = PatientApiService();
  final GetStorage _storage = GetStorage();

  List<Booking> _upcomingBookings = [];
  List<Booking> _recentBookings = [];
  List<Prescription> _activePrescriptions = [];
  Map<String, dynamic>? _userProfile;

  bool _isLoading = false;
  String? _errorMessage;

  List<Booking> get upcomingBookings => _upcomingBookings;
  List<Booking> get recentBookings => _recentBookings;
  List<Prescription> get activePrescriptions => _activePrescriptions;
  Map<String, dynamic>? get userProfile => _userProfile;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Booking? get nextAppointment {
    if (_upcomingBookings.isEmpty) return null;
    return _upcomingBookings.first;
  }

  Future<void> loadHomeData(String patientId, {bool forceRefresh = false}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _apiService.getPatientProfile(patientId),
        _apiService.getPatientBookings(patientId, limit: 5),
        _apiService.getPatientPrescriptions(patientId),
      ]);

      _userProfile = results[0] as Map<String, dynamic>?;
      final allBookings = results[1] as List<Booking>;
      _activePrescriptions = results[2] as List<Prescription>;

      _upcomingBookings = allBookings
          .where((b) => b.isUpcoming)
          .toList()
          ..sort((a, b) => a.date.compareTo(b.date));

      _recentBookings = allBookings
          .where((b) => !b.isUpcoming)
          .toList()
          ..sort((a, b) => b.date.compareTo(a.date));

      // Save to cache
      _storage.write('home_cache_upcoming', _upcomingBookings.map((b) => b.toJson()).toList());
      _storage.write('home_cache_recent', _recentBookings.map((b) => b.toJson()).toList());
      _storage.write('home_cache_prescriptions', _activePrescriptions.map((p) => p.toJson()).toList());
      _storage.write('home_cache_profile', _userProfile);

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      _loadFromCache();
    }
  }

  void _loadFromCache() {
    final cachedUpcoming = _storage.read<List<dynamic>>('home_cache_upcoming');
    final cachedRecent = _storage.read<List<dynamic>>('home_cache_recent');
    final cachedPrescriptions = _storage.read<List<dynamic>>('home_cache_prescriptions');
    final cachedProfile = _storage.read<Map<String, dynamic>>('home_cache_profile');

    if (cachedProfile != null) _userProfile = cachedProfile;
    if (cachedUpcoming != null) {
      _upcomingBookings = cachedUpcoming.map((json) => Booking.fromJson(json as Map<String, dynamic>)).toList();
    }
    if (cachedRecent != null) {
      _recentBookings = cachedRecent.map((json) => Booking.fromJson(json as Map<String, dynamic>)).toList();
    }
    if (cachedPrescriptions != null) {
      _activePrescriptions = cachedPrescriptions.map((json) => Prescription.fromJson(json as Map<String, dynamic>)).toList();
    }

    if (_userProfile != null || _upcomingBookings.isNotEmpty) {
      notifyListeners();
    }
  }

  Future<void> refresh(AuthProvider authProvider) async {
    final patientId = authProvider.user?.id;
    if (patientId == null) return;
    await loadHomeData(patientId, forceRefresh: true);
  }

  void reset() {
    _upcomingBookings = [];
    _recentBookings = [];
    _activePrescriptions = [];
    _userProfile = null;
    _isLoading = false;
    _errorMessage = null;
    notifyListeners();
  }
}
