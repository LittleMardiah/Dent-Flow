import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/doctor_provider.dart';
import '../../providers/doctor_auth_provider.dart';
import 'emr_form_screen.dart';

class PatientQuickViewScreen extends StatefulWidget {
  final String patientId;
  final String bookingId;

  const PatientQuickViewScreen({
    super.key,
    required this.patientId,
    required this.bookingId,
  });

  @override
  State<PatientQuickViewScreen> createState() => _PatientQuickViewScreenState();
}

class _PatientQuickViewScreenState extends State<PatientQuickViewScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _patientData;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final provider = Provider.of<DoctorProvider>(context, listen: false);
    try {
      _patientData = await provider.getPatientQuickView(widget.patientId);
      _isLoading = false;
      setState(() {});
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<DoctorAuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patient Quick View'),
      ),
      body: _buildBody(authProvider),
    );
  }

  Widget _buildBody(DoctorAuthProvider authProvider) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text(_errorMessage!),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadData,
              child: const Text('Coba Lagi'),
            ),
          ],
        ),
      );
    }

    final data = _patientData ?? {};
    final patient = data['patient'] ?? data;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Patient info
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: Colors.blue.shade100,
                        child: Text(
                          patient['fullName']?.substring(0, 1) ?? '?',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 20,
                            color: Colors.blue,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              patient['fullName'] ?? 'Nama Pasien',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              '${patient['age'] ?? '?'} tahun • ${patient['gender'] ?? '-'}',
                              style: const TextStyle(
                                fontSize: 14,
                                color: Colors.grey,
                              ),
                            ),
                            Text(
                              patient['phone'] ?? 'No HP tidak tersedia',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Medical history (dummy)
          const Text(
            'Riwayat Kunjungan',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                '📋 2 kunjungan terakhir: Scaling (15/07/2026), Filling (10/07/2026)',
                style: TextStyle(fontSize: 14),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Allergies (dummy)
          const Text(
            'Alergi',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: ['Amoxicillin', 'Latex'].map((tag) {
              return Chip(
                label: Text(tag),
                backgroundColor: Colors.red.shade50,
                labelStyle: const TextStyle(color: Colors.red),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // Medical conditions (dummy)
          const Text(
            'Kondisi Medis',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: ['Hipertensi', 'Asma'].map((tag) {
              return Chip(
                label: Text(tag),
                backgroundColor: Colors.orange.shade50,
                labelStyle: const TextStyle(color: Colors.orange),
              );
            }).toList(),
          ),

          const Spacer(),

          // Start consultation button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => EMRFormScreen(
                      patientId: widget.patientId,
                      bookingId: widget.bookingId,
                      doctorId: authProvider.doctor?.id ?? '',
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: Colors.green,
              ),
              child: const Text(
                'Start Consultation',
                style: TextStyle(fontSize: 16, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
