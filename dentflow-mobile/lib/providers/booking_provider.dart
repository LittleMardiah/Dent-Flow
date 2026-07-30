import 'package:flutter/material.dart';
import 'package:get_storage/get_storage.dart';
import '../models/branch_model.dart';
import '../models/doctor_model.dart';
import '../models/slot_model.dart';
import '../services/booking_api_service.dart';

class BookingProvider extends ChangeNotifier {
  final BookingApiService _api = BookingApiService();
  final GetStorage _storage = GetStorage();

  int _currentStep = 0;
  Branch? _selectedBranch;
  Doctor? _selectedDoctor;
  DateTime? _selectedDate;
  Slot? _selectedSlot;
  String? _bookingId;
  String? _paymentUrl;
  bool _isLoading = false;
  String? _errorMessage;

  List<Branch> _branches = [];
  List<Doctor> _doctors = [];
  List<Slot> _slots = [];

  int get currentStep => _currentStep;
  Branch? get selectedBranch => _selectedBranch;
  Doctor? get selectedDoctor => _selectedDoctor;
  DateTime? get selectedDate => _selectedDate;
  Slot? get selectedSlot => _selectedSlot;
  String? get bookingId => _bookingId;
  String? get paymentUrl => _paymentUrl;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<Branch> get branches => _branches;
  List<Doctor> get doctors => _doctors;
  List<Slot> get slots => _slots;
  bool get hasNextStep => _currentStep < 5;
  bool get hasPrevStep => _currentStep > 0;

  String get stepTitle =>
      ['Pilih Cabang', 'Pilih Dokter', 'Pilih Waktu', 'Review', 'Bayar', 'Selesai'][_currentStep];

  Future<void> loadBranches() async {
    _isLoading = true; notifyListeners();
    try {
      _branches = await _api.getBranches();
      final lastId = _storage.read<String>('last_branch_id');
      if (lastId != null) {
        _selectedBranch = _branches.firstWhere((b) => b.id == lastId, orElse: () => _branches.first);
      } else if (_branches.isNotEmpty) _selectedBranch = _branches.first;
      _isLoading = false; notifyListeners();
    } catch (e) { _errorMessage = e.toString(); _isLoading = false; notifyListeners(); }
  }

  void setBranch(Branch branch) { _selectedBranch = branch; _storage.write('last_branch_id', branch.id); notifyListeners(); }
  Future<void> loadDoctors() async {
    if (_selectedBranch == null) return;
    _isLoading = true; notifyListeners();
    try { _doctors = await _api.getDoctors(_selectedBranch!.id); _isLoading = false; notifyListeners(); }
    catch (e) { _errorMessage = e.toString(); _isLoading = false; notifyListeners(); }
  }
  void setDoctor(Doctor doctor) { _selectedDoctor = doctor; notifyListeners(); }

  Future<void> loadSlots(DateTime date) async {
    if (_selectedDoctor == null) return;
    _selectedDate = date;
    _isLoading = true; notifyListeners();
    try {
      final dateStr = date.toIso8601String().split('T').first;
      _slots = await _api.getDoctorSlots(_selectedDoctor!.id, dateStr);
      _isLoading = false; notifyListeners();
    } catch (e) { _errorMessage = e.toString(); _isLoading = false; notifyListeners(); }
  }
  void setSlot(Slot slot) { _selectedSlot = slot; notifyListeners(); }

  void nextStep() { if (_currentStep < 5) { _currentStep++; notifyListeners(); } }
  void prevStep() { if (_currentStep > 0) { _currentStep--; _errorMessage = null; notifyListeners(); } }

  Future<void> submitBooking() async {
    if (_selectedBranch == null || _selectedDoctor == null || _selectedSlot == null || _selectedDate == null) {
      _errorMessage = 'Data booking tidak lengkap'; notifyListeners(); return;
    }
    _isLoading = true; _errorMessage = null; notifyListeners();
    try {
      final result = await _api.createBooking(
        branchId: _selectedBranch!.id,
        doctorId: _selectedDoctor!.id,
        slotId: _selectedSlot!.id,
        date: _selectedDate!.toIso8601String().split('T').first,
      );
      _bookingId = result['id'] ?? result['bookingId'];
      _paymentUrl = result['paymentUrl'] ?? result['payment_url'];
      if (_bookingId == null || _paymentUrl == null) throw Exception('Invalid booking response');
      _isLoading = false; notifyListeners();
    } catch (e) { _errorMessage = e.toString(); _isLoading = false; notifyListeners(); rethrow; }
  }

  void reset() {
    _currentStep = 0; _selectedBranch = null; _selectedDoctor = null;
    _selectedDate = null; _selectedSlot = null; _bookingId = null; _paymentUrl = null;
    _isLoading = false; _errorMessage = null; _branches = []; _doctors = []; _slots = [];
    notifyListeners();
  }
  void clearError() { _errorMessage = null; notifyListeners(); }
}
