import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/walkin_provider.dart';
import 'walkin_confirmation_screen.dart';

class WalkInFormScreen extends StatefulWidget {
  const WalkInFormScreen({super.key});

  @override
  State<WalkInFormScreen> createState() => _WalkInFormScreenState();
}

class _WalkInFormScreenState extends State<WalkInFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _selectedService;
  String? _selectedDoctor;
  bool _acceptedTerms = false;

  final List<String> _services = [
    'Konsultasi Umum',
    'Scaling Gigi',
    'Filling Gigi',
    'Cabut Gigi',
    'Pembersihan Karang Gigi',
  ];

  final List<String> _doctors = [
    'drg. Siti Nurhaliza, Sp.BM',
    'drg. Ahmad Riyadi, Sp.KG',
    'drg. Rina Wijaya, Sp.KGA',
    'drg. Budi Santoso, Sp.Ort',
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final walkinProvider = Provider.of<WalkInProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Walk-in Check-in'),
      ),
      body: Form(
        key: _formKey,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              const Text(
                'Daftar Walk-in',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Isi data di bawah untuk mendapatkan nomor antrian',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 24),

              // Nama
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Nama Lengkap',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Nama wajib diisi';
                  }
                  if (value.length < 3) {
                    return 'Nama minimal 3 karakter';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Nomor HP
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(
                  labelText: 'Nomor HP',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Nomor HP wajib diisi';
                  }
                  if (value.length < 10) {
                    return 'Nomor HP minimal 10 digit';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Service dropdown
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Layanan (opsional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.medical_services),
                ),
                value: _selectedService,
                items: _services.map((service) {
                  return DropdownMenuItem(
                    value: service,
                    child: Text(service),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedService = value;
                  });
                },
              ),
              const SizedBox(height: 16),

              // Doctor dropdown (optional)
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Dokter (opsional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.health_and_safety),
                ),
                value: _selectedDoctor,
                items: _doctors.map((doctor) {
                  return DropdownMenuItem(
                    value: doctor,
                    child: Text(doctor),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedDoctor = value;
                  });
                },
              ),
              const SizedBox(height: 16),

              // Terms & Conditions
              CheckboxListTile(
                title: const Text('Saya setuju dengan syarat & ketentuan'),
                value: _acceptedTerms,
                onChanged: (value) {
                  setState(() {
                    _acceptedTerms = value ?? false;
                  });
                },
                controlAffinity: ListTileControlAffinity.leading,
              ),
              const SizedBox(height: 24),

              if (walkinProvider.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Text(
                    walkinProvider.errorMessage!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: walkinProvider.isLoading
                      ? null
                      : _submitForm,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: walkinProvider.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Daftar Walk-in',
                          style: TextStyle(fontSize: 16),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _submitForm() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Harap setujui syarat & ketentuan')),
      );
      return;
    }

    final walkinProvider = Provider.of<WalkInProvider>(context, listen: false);

    try {
      await walkinProvider.createWalkIn(
        name: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
        branchId: 'A', // Default atau bisa pilih
        doctorId: _selectedDoctor != null ? _selectedDoctor : null,
        service: _selectedService,
      );

      if (context.mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const WalkInConfirmationScreen(),
          ),
        );
      }
    } catch (e) {
      // Error already handled by provider
    }
  }
}
