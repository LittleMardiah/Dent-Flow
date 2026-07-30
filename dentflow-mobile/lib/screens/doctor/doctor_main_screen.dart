import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/doctor_auth_provider.dart';
import '../../providers/doctor_provider.dart';
import '../../providers/websocket_provider.dart';
import 'patient_quick_view_screen.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class DoctorMainScreen extends StatefulWidget {
  const DoctorMainScreen({super.key});

  @override
  State<DoctorMainScreen> createState() => _DoctorMainScreenState();
}

class _DoctorMainScreenState extends State<DoctorMainScreen> {
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();

  @override
  void initState() {
    super.initState();
    _initNotifications();
    _initData();
  }

  void _initNotifications() async {
    const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings();
    const InitializationSettings settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _notifications.initialize(settings);
  }

  void _initData() {
    final authProvider = Provider.of<DoctorAuthProvider>(context, listen: false);
    final wsProvider = Provider.of<WebSocketProvider>(context, listen: false);
    final doctorProvider = Provider.of<DoctorProvider>(context, listen: false);

    final doctorId = authProvider.doctor?.id;
    if (doctorId != null) {
      // Connect WebSocket
      final token = wsProvider.isConnected ? null : '';
      wsProvider.connect('', doctorId, 'DOCTOR');
      // Initialize provider with WebSocket listener
      doctorProvider.init(doctorId: doctorId, context: context);
    }
  }

  @override
  void dispose() {
    Provider.of<DoctorProvider>(context, listen: false).stopPolling();
    Provider.of<WebSocketProvider>(context, listen: false).disconnect();
    super.dispose();
  }

  // _showNewPatientNotification temporarily disabled

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<DoctorAuthProvider>(context);
    final provider = Provider.of<DoctorProvider>(context);
    final wsProvider = Provider.of<WebSocketProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('${authProvider.doctor?.fullName ?? 'Dokter'}'),
        actions: [
          // Queue badge
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.people),
                onPressed: () {
                  wsProvider.resetNewArrivals();
                  provider.loadQueue(authProvider.doctor!.id);
                },
              ),
              if (wsProvider.newArrivals > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      wsProvider.newArrivals > 9 ? '9+' : '${wsProvider.newArrivals}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          // Connection status
          Icon(
            wsProvider.isConnected ? Icons.wifi : Icons.wifi_off,
            color: wsProvider.isConnected ? Colors.green : Colors.red,
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await authProvider.logout();
              if (context.mounted) {
                Navigator.popUntil(context, (route) => route.isFirst);
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          if (authProvider.doctor != null) {
            await provider.loadQueue(authProvider.doctor!.id);
          }
        },
        child: _buildBody(provider, authProvider),
      ),
    );
  }

  Widget _buildBody(DoctorProvider provider, DoctorAuthProvider authProvider) {
    if (provider.isLoading && provider.queue.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.errorMessage != null && provider.queue.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              provider.errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                if (authProvider.doctor != null) {
                  provider.loadQueue(authProvider.doctor!.id);
                }
              },
              child: const Text('Coba Lagi'),
            ),
          ],
        ),
      );
    }

    if (provider.queue.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Belum ada pasien dalam antrian',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        _buildCurrentPatient(provider),
        const SizedBox(height: 16),
        Expanded(
          child: _buildNextPatients(provider),
        ),
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: provider.isLoading || authProvider.doctor == null
                  ? null
                  : () async {
                      await provider.readyNext(authProvider.doctor!.id);
                    },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: Colors.green,
              ),
              child: provider.isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Ready for Next',
                      style: TextStyle(fontSize: 16, color: Colors.white),
                    ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCurrentPatient(DoctorProvider provider) {
    final current = provider.currentPatient;

    if (current == null) {
      return Card(
        margin: const EdgeInsets.all(16),
        color: Colors.orange.shade50,
        child: const Padding(
          padding: EdgeInsets.all(16),
          child: Center(
            child: Text('Tidak ada pasien yang dipanggil'),
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PatientQuickViewScreen(
              patientId: current.patientId,
              bookingId: current.id,
            ),
          ),
        );
      },
      child: Card(
        margin: const EdgeInsets.all(16),
        color: Colors.green.shade50,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.green, width: 2),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  const Icon(Icons.person, color: Colors.green),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      current.patientName,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '#${current.queueNumber}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.access_time, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('Check-in: ${_formatTime(current.checkInTime)}'),
                  const SizedBox(width: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green.shade200,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      current.statusLabel,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Tap untuk mulai konsultasi',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNextPatients(DoctorProvider provider) {
    final next = provider.nextPatients;

    if (next.isEmpty) {
      return const Center(
        child: Text('Tidak ada pasien berikutnya'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: next.length > 3 ? 3 : next.length,
      itemBuilder: (context, index) {
        final patient = next[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: patient.isBeingCalled
                  ? Colors.orange
                  : Colors.blue,
              child: Text(
                '#${patient.queueNumber}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            title: Text(patient.patientName),
            subtitle: Text('${patient.statusLabel} • ${_formatTime(patient.checkInTime)}'),
            trailing: patient.isBeingCalled
                ? const Icon(Icons.notifications_active, color: Colors.orange)
                : null,
          ),
        );
      },
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
