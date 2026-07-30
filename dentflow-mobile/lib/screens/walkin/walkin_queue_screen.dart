import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/walkin_provider.dart';

class WalkInQueueScreen extends StatefulWidget {
  const WalkInQueueScreen({super.key});

  @override
  State<WalkInQueueScreen> createState() => _WalkInQueueScreenState();
}

class _WalkInQueueScreenState extends State<WalkInQueueScreen> {
  @override
  void initState() {
    super.initState();
    final provider = Provider.of<WalkInProvider>(context, listen: false);
    final tempPatientId = provider.response?.tempPatientId;
    if (tempPatientId != null) {
      provider.startPolling(tempPatientId);
    }
  }

  @override
  void dispose() {
    Provider.of<WalkInProvider>(context, listen: false).stopPolling();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final walkinProvider = Provider.of<WalkInProvider>(context);
    final response = walkinProvider.response;

    if (response == null) {
      return const Scaffold(
        body: Center(child: Text('Data tidak ditemukan')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Antrian Walk-in'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              final tempId = response.tempPatientId;
              if (tempId.isNotEmpty) {
                walkinProvider.startPolling(tempId);
              }
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Queue number
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              decoration: BoxDecoration(
                color: response.isBeingCalled
                    ? Colors.orange.shade50
                    : response.isCompleted
                        ? Colors.green.shade50
                        : Colors.blue.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: response.isBeingCalled
                      ? Colors.orange
                      : response.isCompleted
                          ? Colors.green
                          : Colors.blue,
                ),
              ),
              child: Column(
                children: [
                  const Text(
                    'Nomor Antrian',
                    style: TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                  Text(
                    '#${response.queueNumber}',
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      color: response.isBeingCalled
                          ? Colors.orange
                          : response.isCompleted
                              ? Colors.green
                              : Colors.blue,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              decoration: BoxDecoration(
                color: _getStatusColor(response.status).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _getStatusLabel(response.status),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: _getStatusColor(response.status),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Estimated wait time
            if (response.isWaiting) ...[
              const Text(
                'Estimasi waktu tunggu:',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 4),
              Text(
                '${response.estimatedWaitTime} menit',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],

            if (response.isBeingCalled) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.notifications_active, color: Colors.orange),
                    SizedBox(width: 8),
                    Text(
                      '📢 Sedang dipanggil!',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.orange,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (response.isCompleted) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle, color: Colors.green),
                    SizedBox(width: 8),
                    Text(
                      '✅ Selesai',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.green,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 16),

            // Info card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _infoRow('Dokter', response.doctorName),
                    _infoRow('Cabang', response.branchName),
                    _infoRow('Status', _getStatusLabel(response.status)),
                  ],
                ),
              ),
            ),

            const Spacer(),

            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  walkinProvider.reset();
                  Navigator.popUntil(context, (route) => route.isFirst);
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Selesai'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.grey,
                fontSize: 14,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'WAITING':
        return 'Menunggu';
      case 'BEING_CALLED':
        return 'Dipanggil';
      case 'COMPLETED':
        return 'Selesai';
      default:
        return status;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'WAITING':
        return Colors.blue;
      case 'BEING_CALLED':
        return Colors.orange;
      case 'COMPLETED':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}
