import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  static const String _cacheKey = 'dashboard_cache_today';

  bool _isLoading = true;
  bool _isRefreshing = false;
  Map<String, dynamic>? _dashboardData;
  String? _errorMessage;
  String? _cacheInfo;

  @override
  void initState() {
    super.initState();
    _loadCachedDashboard();
    _fetchDashboardData();
  }

  Future<void> _loadCachedDashboard() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedJson = prefs.getString(_cacheKey);
    if (cachedJson == null) return;

    try {
      final cached = jsonDecode(cachedJson) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _dashboardData = cached['data'] as Map<String, dynamic>?;
        _cacheInfo = cached['savedAt']?.toString();
        _isLoading = _dashboardData == null;
      });
    } catch (_) {
      await prefs.remove(_cacheKey);
    }
  }

  Future<void> _saveDashboardCache(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _cacheKey,
      jsonEncode(<String, dynamic>{
        'savedAt': DateTime.now().toIso8601String(),
        'data': data,
      }),
    );
  }

  Future<void> _fetchDashboardData({bool forceRefresh = false}) async {
    if (_dashboardData == null) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    } else {
      setState(() {
        _isRefreshing = true;
        _errorMessage = null;
      });
    }

    final result = await ApiService.post('getKehadiranDashboard', {
      'tanggal': DateTime.now().toIso8601String().split('T').first,
      'shiftFilter': '',
      'deptFilter': '',
      'typeFilter': '',
      'detailLimit': 20,
      'anomaliLimit': 12,
      'useCache': !forceRefresh,
    });

    if (!mounted) return;

    if (result['ok'] == true) {
      final normalized = result.cast<String, dynamic>();
      await _saveDashboardCache(normalized);
      setState(() {
        _dashboardData = normalized;
        _cacheInfo = DateTime.now().toIso8601String();
        _isLoading = false;
        _isRefreshing = false;
        _errorMessage = normalized['summary'] == null
            ? 'Respons dashboard tidak lengkap. Silakan coba lagi.'
            : null;
      });
      return;
    }

    setState(() {
      _isLoading = false;
      _isRefreshing = false;
      if (_dashboardData == null) {
        _errorMessage = result['msg'] ?? 'Gagal memuat data dashboard';
      } else {
        _errorMessage =
            'Menampilkan cache terakhir. ${result['msg'] ?? 'Refresh dashboard gagal.'}';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_dashboardData == null) {
      return _buildErrorState();
    }

    final summary =
        (_dashboardData?['summary'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final kehadiranList =
        (_dashboardData?['kehadiranList'] as List?) ?? const <dynamic>[];
    final byShift = (summary['byShift'] as List?) ?? const <dynamic>[];

    return RefreshIndicator(
      onRefresh: () => _fetchDashboardData(forceRefresh: true),
      child: ListView(
        padding: const EdgeInsets.all(16.0),
        children: <Widget>[
          if (_isRefreshing) const LinearProgressIndicator(),
          if (_isRefreshing) const SizedBox(height: 12),
          if (_errorMessage != null) ...<Widget>[
            _buildInfoBanner(
              _errorMessage!,
              tone: Colors.orange,
            ),
            const SizedBox(height: 12),
          ],
          if (_cacheInfo != null) ...<Widget>[
            Text(
              'Cache lokal tersedia. Update terakhir: ${_formatSavedAt(_cacheInfo!)}',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.grey[700]),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: <Widget>[
              const Expanded(
                child: Text(
                  'Kehadiran Hari Ini',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
              TextButton.icon(
                onPressed: _isRefreshing
                    ? null
                    : () => _fetchDashboardData(forceRefresh: true),
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 1.5,
            children: <Widget>[
              _buildKpiCard(
                  'Total Hadir', '${summary['totalHadir'] ?? 0}', Colors.green),
              _buildKpiCard('Belum Masuk', '${summary['totalBelumMasuk'] ?? 0}',
                  Colors.orange),
              _buildKpiCard('Sudah Pulang',
                  '${summary['totalSudahPulang'] ?? 0}', Colors.blue),
              _buildKpiCard(
                  'Anomali', '${summary['totalAnomali'] ?? 0}', Colors.red),
            ],
          ),
          if (byShift.isNotEmpty) ...<Widget>[
            const SizedBox(height: 24),
            const Text(
              'Coverage per Shift',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...byShift.take(5).map((dynamic item) {
              final shift = item as Map;
              return Card(
                child: ListTile(
                  title: Text('${shift['label'] ?? '-'}'),
                  subtitle: Text(
                    'Hadir: ${shift['hadir'] ?? 0} | Terlambat: ${shift['terlambat'] ?? 0} | Lembur: ${shift['lembur'] ?? 0}',
                  ),
                  trailing: Text(
                    shift['coverage_pct'] == null
                        ? '-'
                        : '${shift['coverage_pct']}%',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              );
            }),
          ],
          const SizedBox(height: 32),
          Text(
            'List Karyawan Hadir (${_dashboardData?['totalKehadiranRows'] ?? kehadiranList.length} catatan)',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          if (kehadiranList.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(20.0),
                child: Text(
                  'Tarik ke bawah untuk merefresh data',
                  style: TextStyle(color: Colors.grey),
                ),
              ),
            )
          else
            ...kehadiranList.take(20).map((dynamic item) {
              final row = item as Map;
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor:
                        _presenceColor('${row['presenceStatus'] ?? ''}'),
                    child: const Icon(Icons.person, color: Colors.white),
                  ),
                  title: Text('${row['nama'] ?? '-'}'),
                  subtitle: Text(
                    'NIK: ${row['nik'] ?? '-'}\nShift: ${row['shift'] ?? '-'} | Masuk: ${row['jamMasuk'] ?? '-'} | Keluar: ${row['jamKeluar'] ?? '-'}',
                  ),
                  isThreeLine: true,
                  trailing: Text('${row['status'] ?? '-'}'),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 16),
          Text(_errorMessage ?? 'Gagal memuat data dashboard',
              style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () => _fetchDashboardData(forceRefresh: true),
            child: const Text('Coba Lagi'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoBanner(String message, {required Color tone}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tone.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.info_outline, color: tone),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: tone, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  String _formatSavedAt(String isoString) {
    final parsed = DateTime.tryParse(isoString);
    if (parsed == null) return isoString;
    final local = parsed.toLocal();
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    final ss = local.second.toString().padLeft(2, '0');
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} $hh:$mm:$ss';
  }

  Color _presenceColor(String presenceStatus) {
    switch (presenceStatus) {
      case 'di_dalam':
        return Colors.green;
      case 'sudah_pulang':
        return Colors.blue;
      case 'anomali':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  Widget _buildKpiCard(String title, String value, Color color) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border(left: BorderSide(color: color, width: 6)),
        ),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title,
                style: TextStyle(color: Colors.grey[700], fontSize: 14)),
            const SizedBox(height: 8),
            Text(value,
                style: TextStyle(
                    color: color, fontSize: 24, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
