import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
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

    final statusColor = _getStatusColor(response.status);
    final statusBg = statusColor.withValues(alpha: 0.08);

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
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 20),
              decoration: BoxDecoration(
                color: statusBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: statusColor,
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: statusColor.withValues(alpha: 0.12),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Text(
                    'Nomor Antrian',
                    style: TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '#${response.queueNumber}',
                    style: TextStyle(
                      fontSize: 64,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Status badge
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: statusColor.withValues(alpha: 0.4)),
              ),
              child: Text(
                _getStatusLabel(response.status),
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: statusColor,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Estimated wait time
            if (response.isWaiting) ...[
              const SizedBox(height: 8),
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
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.notifications_active, color: AppTheme.primary),
                    SizedBox(width: 8),
                    Text(
                      'Sedang dipanggil',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (response.isCompleted) ...[
              const SizedBox(height: 16),
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle, color: Colors.green),
                    SizedBox(width: 8),
                    Text(
                      'Selesai',
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
        return Colors.amber.shade700;
      case 'BEING_CALLED':
        return AppTheme.primary;
      case 'COMPLETED':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}
