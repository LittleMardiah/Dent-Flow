import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../models/invoice_model.dart';
import '../../providers/invoice_provider.dart';
import '../../providers/auth_provider.dart';
import 'invoice_detail_screen.dart';

class InvoiceListScreen extends StatefulWidget {
  const InvoiceListScreen({super.key});

  @override
  State<InvoiceListScreen> createState() => _InvoiceListScreenState();
}

class _InvoiceListScreenState extends State<InvoiceListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedFilter = 'Semua';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final patientId = authProvider.user?.id;
    if (patientId != null) {
      await Provider.of<InvoiceProvider>(context, listen: false)
          .loadInvoices(patientId);
    }
  }

  Future<void> _refresh() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final patientId = authProvider.user?.id;
    if (patientId != null) {
      await Provider.of<InvoiceProvider>(context, listen: false)
          .refreshInvoices(patientId);
    }
  }

  List<Invoice> _getFilteredInvoices(InvoiceProvider provider) {
    switch (_selectedFilter) {
      case 'Belum Bayar':
        return provider.unpaidInvoices;
      case 'Sudah Bayar':
        return provider.paidInvoices;
      default:
        return provider.invoices;
    }
  }

  @override
  Widget build(BuildContext context) {
    final invoiceProvider = Provider.of<InvoiceProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoice'),
        bottom: TabBar(
          controller: _tabController,
          onTap: (index) {
            setState(() {
              _selectedFilter = ['Semua', 'Belum Bayar', 'Sudah Bayar'][index];
            });
          },
          tabs: const [
            Tab(text: 'Semua'),
            Tab(text: 'Belum Bayar'),
            Tab(text: 'Sudah Bayar'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: _buildBody(invoiceProvider),
      ),
    );
  }

  Widget _buildBody(InvoiceProvider provider) {
    if (provider.isLoading && provider.invoices.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.errorMessage != null && provider.invoices.isEmpty) {
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
              onPressed: _loadData,
              child: const Text('Coba Lagi'),
            ),
          ],
        ),
      );
    }

    final filtered = _getFilteredInvoices(provider);

    if (filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.receipt_long, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              'Tidak ada invoice',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
            if (_selectedFilter == 'Belum Bayar')
              const Text(
                'Semua invoice sudah lunas ✅',
                style: TextStyle(fontSize: 14, color: Colors.green),
              ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        final invoice = filtered[index];
        final isLast = index == filtered.length - 1;
        final statusColor = invoice.isPaid ? Colors.green : Colors.red;

        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withValues(alpha: 0.25),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 2,
                        color: AppTheme.primary.withValues(alpha: 0.2),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                  child: Hero(
                    tag: 'invoice_${invoice.id}',
                    child: Material(
                      color: Colors.transparent,
                      child: Card(
                        elevation: 2,
                        margin: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () {
                            Navigator.push(
                              context,
                              PageRouteBuilder(
                                transitionDuration: const Duration(milliseconds: 350),
                                pageBuilder: (context, animation, secondaryAnimation) =>
                                    InvoiceDetailScreen(invoiceId: invoice.id),
                                transitionsBuilder:
                                    (context, animation, secondaryAnimation, child) {
                                  final curvedAnimation = CurvedAnimation(
                                    parent: animation,
                                    curve: Curves.easeOutCubic,
                                  );
                                  return FadeTransition(
                                    opacity: curvedAnimation,
                                    child: SlideTransition(
                                      position: Tween<Offset>(
                                        begin: const Offset(0.0, 0.02),
                                        end: Offset.zero,
                                      ).animate(curvedAnimation),
                                      child: child,
                                    ),
                                  );
                                },
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        invoice.invoiceNumber,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: statusColor.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        invoice.statusLabel,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: statusColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${invoice.doctorName} - ${invoice.branchName}',
                                  style: const TextStyle(color: Colors.black87),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Total: Rp ${invoice.amountDue.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _formatDate(invoice.createdAt),
                                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
