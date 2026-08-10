import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/session_model.dart';
import '../providers/session_provider.dart';
import '../services/api_service.dart';

class AbsenScreen extends StatefulWidget {
  const AbsenScreen({super.key});

  @override
  State<AbsenScreen> createState() => _AbsenScreenState();
}

class _AbsenScreenState extends State<AbsenScreen> {
  bool _isLoading = true;
  List<dynamic> _absenData = <dynamic>[];
  String? _errorMessage;
  String _periodType = 'week';
  String _sort = 'tanggal_desc';
  DateTime _selectedDate = DateTime.now();
  int _currentPage = 1;
  int _totalPages = 1;
  int _totalRows = 0;
  String _periodLabel = '';

  final TextEditingController _nikController = TextEditingController();
  final TextEditingController _deptController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session =
          Provider.of<SessionProvider>(context, listen: false).session;
      _hydrateDefaultFilters(session);
      _fetchAbsenData();
    });
  }

  @override
  void dispose() {
    _nikController.dispose();
    _deptController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _hydrateDefaultFilters(SessionModel? user) {
    final role = (user?.role ?? '').toUpperCase();
    if (role == 'KARYAWAN') {
      _nikController.text = user?.nik ?? '';
    }
    if (role == 'PENGAWAS') {
      _deptController.text = (user?.departemen ?? '').toUpperCase();
    }
  }

  String _getIsoWeekCode(DateTime date) {
    final utcDate = DateTime.utc(date.year, date.month, date.day);
    final day = utcDate.weekday == 7 ? 7 : utcDate.weekday;
    final thursday = utcDate.add(Duration(days: 4 - day));
    final yearStart = DateTime.utc(thursday.year, 1, 1);
    final week = (((thursday.difference(yearStart).inDays) + 1) / 7).ceil();
    return '${thursday.year}-W${week.toString().padLeft(2, '0')}';
  }

  String _buildPeriodValue() {
    if (_periodType == 'date') {
      return _selectedDate.toIso8601String().split('T').first;
    }
    if (_periodType == 'month') {
      return '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}';
    }
    return _getIsoWeekCode(_selectedDate);
  }

  Future<void> _pickPeriodDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024, 1, 1),
      lastDate: DateTime(2030, 12, 31),
    );
    if (picked == null) return;
    setState(() => _selectedDate = picked);
  }

  Future<void> _fetchAbsenData({int? page}) async {
    final sessionProvider =
        Provider.of<SessionProvider>(context, listen: false);
    final user = sessionProvider.session;
    final role = (user?.role ?? '').toUpperCase();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      if (page != null) _currentPage = page;
    });

    final result = await ApiService.post('getAbsenReport', {
      'nik': role == 'KARYAWAN'
          ? (user?.nik ?? '')
          : _nikController.text.trim(),
      'deptFilter': role == 'PENGAWAS'
          ? (user?.departemen ?? '')
          : _deptController.text.trim().toUpperCase(),
      'periodType': _periodType,
      'periodValue': _buildPeriodValue(),
      'page': _currentPage,
      'pageSize': 25,
      'search': _searchController.text.trim(),
      'sort': _sort,
    });

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      if (result['ok'] == true) {
        _absenData = (result['data'] as List?) ?? <dynamic>[];
        _totalRows = result['total'] ?? 0;
        _currentPage = result['page'] ?? 1;
        _totalPages = result['totalPages'] ?? 1;
        _periodLabel = result['period']?.toString() ?? '';
      } else {
        _errorMessage = result['msg'] ?? 'Gagal memuat rekap absen';
      }
    });
  }

  String _formatSelectedPeriod() {
    if (_periodType == 'date') {
      return _selectedDate.toIso8601String().split('T').first;
    }
    if (_periodType == 'month') {
      return '${_selectedDate.month.toString().padLeft(2, '0')}/${_selectedDate.year}';
    }
    return _getIsoWeekCode(_selectedDate);
  }

  @override
  Widget build(BuildContext context) {
    final sessionProvider = Provider.of<SessionProvider>(context);
    final user = sessionProvider.session;
    final role = (user?.role ?? '').toUpperCase();

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: <Widget>[
          _buildFilterCard(role, user),
          const SizedBox(height: 16),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildFilterCard(String role, SessionModel? user) {
    final isKaryawan = role == 'KARYAWAN';
    final isPengawas = role == 'PENGAWAS';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Filter Absen',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _fetchAbsenData(page: 1),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Refresh'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nikController,
              readOnly: isKaryawan,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: isKaryawan ? 'NIK Saya' : 'Filter NIK',
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.badge),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _deptController,
              readOnly: isPengawas,
              decoration: InputDecoration(
                labelText: isPengawas
                    ? 'Departemen Pengawas'
                    : 'Filter Departemen',
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.apartment),
                helperText: isPengawas && user != null
                    ? 'Terkunci ke dept ${user.departemen}'
                    : null,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                labelText: 'Cari nama / NIK / departemen',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.search),
              ),
              onSubmitted: (_) => _fetchAbsenData(page: 1),
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _periodType,
                    decoration: const InputDecoration(
                      labelText: 'Periode',
                      border: OutlineInputBorder(),
                    ),
                    items: const <DropdownMenuItem<String>>[
                      DropdownMenuItem<String>(
                        value: 'date',
                        child: Text('Harian'),
                      ),
                      DropdownMenuItem<String>(
                        value: 'week',
                        child: Text('Mingguan'),
                      ),
                      DropdownMenuItem<String>(
                        value: 'month',
                        child: Text('Bulanan'),
                      ),
                    ],
                    onChanged: (String? value) {
                      if (value == null) return;
                      setState(() => _periodType = value);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: _pickPeriodDate,
                    borderRadius: BorderRadius.circular(12),
                    child: InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Nilai periode',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.event),
                      ),
                      child: Text(_formatSelectedPeriod()),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _sort,
              decoration: const InputDecoration(
                labelText: 'Urutan data',
                border: OutlineInputBorder(),
              ),
              items: const <DropdownMenuItem<String>>[
                DropdownMenuItem<String>(
                  value: 'tanggal_desc',
                  child: Text('Tanggal terbaru'),
                ),
                DropdownMenuItem<String>(
                  value: 'tanggal_asc',
                  child: Text('Tanggal terlama'),
                ),
                DropdownMenuItem<String>(
                  value: 'nama_asc',
                  child: Text('Nama A-Z'),
                ),
                DropdownMenuItem<String>(
                  value: 'nama_desc',
                  child: Text('Nama Z-A'),
                ),
                DropdownMenuItem<String>(
                  value: 'jam_masuk_asc',
                  child: Text('Jam masuk tercepat'),
                ),
                DropdownMenuItem<String>(
                  value: 'jam_masuk_desc',
                  child: Text('Jam masuk terlambat'),
                ),
              ],
              onChanged: (String? value) {
                if (value == null) return;
                setState(() => _sort = value);
              },
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isLoading ? null : () => _fetchAbsenData(page: 1),
                icon: const Icon(Icons.filter_alt),
                label: const Text('Terapkan Filter'),
              ),
            ),
            if (_periodLabel.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Periode aktif: $_periodLabel',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: Colors.grey[700]),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red),
            ),
          ],
        ),
      );
    }

    if (_absenData.isEmpty) {
      return const Center(child: Text('Tidak ada data absen untuk filter ini'));
    }

    return Column(
      children: <Widget>[
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F7FA),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFD7DEE7)),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  'Total $_totalRows data · Halaman $_currentPage / $_totalPages',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              IconButton(
                onPressed: _currentPage > 1
                    ? () => _fetchAbsenData(page: _currentPage - 1)
                    : null,
                icon: const Icon(Icons.chevron_left),
              ),
              IconButton(
                onPressed: _currentPage < _totalPages
                    ? () => _fetchAbsenData(page: _currentPage + 1)
                    : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ListView.builder(
            itemCount: _absenData.length,
            itemBuilder: (BuildContext context, int index) {
              final item = _absenData[index] as Map;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFF1F5F97),
                    child:
                        Icon(Icons.calendar_today, color: Colors.white, size: 20),
                  ),
                  title: Text('${item['nama'] ?? '-'}'),
                  subtitle: Text(
                    'Tanggal: ${item['tanggal'] ?? '-'}\n'
                    'NIK: ${item['nik'] ?? '-'} · Dept: ${item['dept'] ?? '-'}\n'
                    'Masuk: ${item['jamMasuk'] ?? '-'} | Keluar: ${item['jamKeluar'] ?? '-'}',
                  ),
                  isThreeLine: true,
                  trailing: _buildStatusBadge('${item['status'] ?? 'UNKNOWN'}'),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color = Colors.grey;
    if (status.toUpperCase() == 'HADIR' ||
        status.toUpperCase() == 'ON SITE' ||
        status.toUpperCase() == 'DI DALAM' ||
        status.toUpperCase() == 'SELESAI') {
      color = Colors.green;
    }
    if (status.toUpperCase() == 'ALPHA') {
      color = Colors.red;
    }
    if (status.toUpperCase() == 'IZIN') {
      color = Colors.orange;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color),
      ),
      child: Text(
        status,
        style:
            TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
      ),
    );
  }
}
