import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/nfc_service.dart';
import '../services/scan_payload_service.dart';
import 'camera_scan_screen.dart';

class AreaScreen extends StatefulWidget {
  const AreaScreen({super.key});

  @override
  State<AreaScreen> createState() => _AreaScreenState();
}

class _AreaScreenState extends State<AreaScreen> {
  bool _isScanning = false;
  bool _isLoadingLogs = false;
  bool _logLoadedOnce = false;
  bool _logsNeedRefresh = false;
  String _viewMode = 'scan';
  String _statusMessage =
      'Scan barcode/QR kartu MK dengan kamera. NFC tetap tersedia bila kartu mendukung.';
  String? _logError;
  Color _statusColor = Colors.grey;
  int _logLimit = 30;
  List<dynamic> _recentLogs = <dynamic>[];

  String _selectedTujuan = 'GUDANG MATERIAL';
  final List<String> _listTujuan = <String>[
    'GUDANG MATERIAL',
    'PRODUKSI',
    'PACKING',
    'OFFICE',
    'GUDANG FINISH GOOD',
    'AREA CACAH',
    'UTILITY',
  ];

  String? _selectedReason;
  final List<String> _listReason = <String>[
    'Istirahat',
    'Toilet',
    'Sholat',
    'Klinik',
    'Pekerjaan',
    'Lainnya',
  ];

  Future<String?> _openCameraScanner({
    required String title,
    required String subtitle,
  }) {
    return Navigator.of(context).push<String>(
      MaterialPageRoute<String>(
        builder: (BuildContext context) => CameraScanScreen(
          title: title,
          subtitle: subtitle,
        ),
      ),
    );
  }

  Future<void> _processAreaScan(
    String cardCode, {
    required String sourceLabel,
  }) async {
    setState(() {
      _isScanning = true;
      _statusMessage = 'Memproses scan area dari $sourceLabel...';
      _statusColor = Colors.blue;
    });

    final sourceNote = 'Scan dari Android App ($sourceLabel)';
    final catatan = (_selectedReason != null && _selectedReason!.isNotEmpty)
        ? '$_selectedReason - $sourceNote'
        : sourceNote;

    final result = await ApiService.post('scanAreaKerja', {
      'noKartuMK': cardCode,
      'tujuan': _selectedTujuan,
      'catatan': catatan,
      'forceMode': false,
    });

    if (!mounted) return;

    setState(() {
      _isScanning = false;
      if (result['ok'] == true) {
        final inout = result['inout'] ?? '-';
        final nama = result['karyawan']?['nama'] ?? '';
        _statusMessage = nama.toString().isNotEmpty
            ? 'Berhasil: $nama -> $inout di $_selectedTujuan lewat $sourceLabel'
            : 'Berhasil: $inout di $_selectedTujuan lewat $sourceLabel';
        _statusColor = Colors.green;
      } else {
        _statusMessage = result['msg'] ?? 'Gagal scan area';
        _statusColor = Colors.red;
      }
    });

    if (result['ok'] == true) {
      _logsNeedRefresh = true;
      if (_viewMode == 'log') {
        await _loadRecentLogs();
      }
    }
  }

  Future<void> _scanAreaWithCamera() async {
    final rawValue = await _openCameraScanner(
      title: 'Scan Kartu Area',
      subtitle:
          'Arahkan kamera ke barcode atau QR pada kartu MK untuk proses area kerja.',
    );
    if (!mounted || rawValue == null) return;

    final cardCode = ScanPayloadService.extractCardCode(rawValue);
    if (cardCode == null) {
      setState(() {
        _statusMessage =
            'Scan terbaca, tetapi kodenya ambigu atau bukan format kartu MK. Tahan kamera sedikit lebih lama lalu scan ulang.';
        _statusColor = Colors.red;
      });
      return;
    }

    await _processAreaScan(cardCode, sourceLabel: 'kamera');
  }

  Future<void> _scanAreaWithNfc() async {
    setState(() {
      _isScanning = true;
      _statusMessage = 'Mendekatkan kartu ke HP...';
      _statusColor = Colors.blue;
    });

    final uid = await NfcService.readNfcTag();
    if (!mounted) return;

    if (uid == null) {
      setState(() {
        _isScanning = false;
        _statusMessage = 'Gagal membaca kartu NFC atau timeout';
        _statusColor = Colors.red;
      });
      return;
    }

    await _processAreaScan(uid, sourceLabel: 'NFC');
  }

  Future<void> _loadRecentLogs() async {
    setState(() {
      _isLoadingLogs = true;
      _logError = null;
    });

    final result = await ApiService.post('getRecentAreaLogs', {
      'limit': _logLimit,
    });

    if (!mounted) return;

    setState(() {
      _isLoadingLogs = false;
      _logLoadedOnce = true;
      if (result['ok'] == true) {
        _recentLogs = (result['data'] as List?) ?? <dynamic>[];
        _logsNeedRefresh = false;
      } else {
        _logError = result['msg'] ?? 'Gagal memuat log area';
      }
    });
  }

  void _switchView(String value) {
    setState(() => _viewMode = value);
    if (value == 'log' && (!_logLoadedOnce || _logsNeedRefresh)) {
      _loadRecentLogs();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SegmentedButton<String>(
            segments: const <ButtonSegment<String>>[
              ButtonSegment<String>(
                value: 'scan',
                icon: Icon(Icons.qr_code_scanner),
                label: Text('Scan'),
              ),
              ButtonSegment<String>(
                value: 'log',
                icon: Icon(Icons.history),
                label: Text('Log Area'),
              ),
            ],
            selected: <String>{_viewMode},
            onSelectionChanged: (Set<String> selection) {
              _switchView(selection.first);
            },
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _viewMode == 'scan' ? _buildScanView() : _buildLogView(),
          ),
        ],
      ),
    );
  }

  Widget _buildScanView() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          DropdownButtonFormField<String>(
            initialValue: _selectedTujuan,
            decoration:
                const InputDecoration(labelText: 'Tujuan / Area Pengawasan'),
            items: _listTujuan.map((String value) {
              return DropdownMenuItem<String>(
                value: value,
                child: Text(value),
              );
            }).toList(),
            onChanged: (String? newValue) {
              setState(() {
                _selectedTujuan = newValue!;
              });
            },
          ),
          const SizedBox(height: 16),
          const Text(
            'Keperluan / Catatan (opsional, terutama saat keluar)',
            style: TextStyle(fontSize: 13, color: Colors.black54),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _listReason.map((String reason) {
              final selected = _selectedReason == reason;
              return ChoiceChip(
                label: Text(reason),
                selected: selected,
                onSelected: (bool value) {
                  setState(() {
                    _selectedReason = value ? reason : null;
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F7FA),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFD7DEE7)),
            ),
            child: Column(
              children: <Widget>[
                Icon(
                  Icons.qr_code_scanner,
                  size: 100,
                  color: _isScanning ? Colors.blue : Colors.grey,
                ),
                const SizedBox(height: 20),
                Text(
                  _statusMessage,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: _statusColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _isScanning ? null : _scanAreaWithCamera,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.all(16),
                    backgroundColor: const Color(0xFF1F5F97),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.photo_camera),
                  label: const Text(
                    'SCAN KARTU (KAMERA)',
                    style: TextStyle(fontSize: 18),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _isScanning ? null : _scanAreaWithNfc,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.all(16),
                  ),
                  icon: const Icon(Icons.nfc),
                  label: const Text(
                    'TAP KARTU (NFC CADANGAN)',
                    style: TextStyle(fontSize: 16),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogView() {
    return Column(
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: DropdownButtonFormField<int>(
                initialValue: _logLimit,
                decoration: const InputDecoration(
                  labelText: 'Jumlah log',
                ),
                items: const <int>[20, 30, 50, 100]
                    .map((int value) => DropdownMenuItem<int>(
                          value: value,
                          child: Text('$value log'),
                        ))
                    .toList(),
                onChanged: (int? value) {
                  if (value == null) return;
                  setState(() => _logLimit = value);
                  _loadRecentLogs();
                },
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton.icon(
              onPressed: _isLoadingLogs ? null : _loadRecentLogs,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: _buildLogList(),
        ),
      ],
    );
  }

  Widget _buildLogList() {
    if (_isLoadingLogs) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_logError != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              _logError!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red),
            ),
          ],
        ),
      );
    }

    if (_recentLogs.isEmpty) {
      return const Center(
        child: Text(
          'Belum ada log area terbaru.',
          style: TextStyle(color: Colors.grey),
        ),
      );
    }

    return ListView.separated(
      itemCount: _recentLogs.length,
      separatorBuilder: (BuildContext context, int index) =>
          const SizedBox(height: 8),
      itemBuilder: (BuildContext context, int index) {
        final row = _recentLogs[index] as Map;
        final isIn = '${row['inout'] ?? ''}'.toUpperCase() == 'IN';
        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isIn ? Colors.green : Colors.orange,
              child: Icon(
                isIn ? Icons.login : Icons.logout,
                color: Colors.white,
              ),
            ),
            title: Text('${row['nama'] ?? row['nik'] ?? '-'}'),
            subtitle: Text(
              'NIK: ${row['nik'] ?? '-'}\n${row['tanggal'] ?? '-'} ${row['jam'] ?? '-'}\nTujuan: ${row['tujuan'] ?? '-'}',
            ),
            isThreeLine: true,
            trailing: Text(
              '${row['inout'] ?? '-'}',
              style: TextStyle(
                color: isIn ? Colors.green : Colors.orange,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        );
      },
    );
  }
}
