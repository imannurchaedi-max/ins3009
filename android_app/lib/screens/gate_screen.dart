import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../services/api_service.dart';
import '../services/gps_service.dart';
import '../services/nfc_service.dart';
import '../services/scan_payload_service.dart';
import 'camera_scan_screen.dart';

class GateScreen extends StatefulWidget {
  const GateScreen({super.key});

  @override
  State<GateScreen> createState() => _GateScreenState();
}

class _GateScreenState extends State<GateScreen> {
  bool _isScanning = false;
  Map<String, dynamic>? _scannedData;
  String _statusMessage =
      'Gunakan kamera untuk scan barcode/QR kartu MK. NFC tetap tersedia sebagai cadangan.';
  Color _statusColor = Colors.grey;
  final TextEditingController _targetNikController = TextEditingController();
  final TextEditingController _lokerController = TextEditingController();

  @override
  void dispose() {
    _targetNikController.dispose();
    _lokerController.dispose();
    super.dispose();
  }

  String _resolveRole(String? role) {
    switch ((role ?? '').toUpperCase().trim()) {
      case 'ADMINISTRATOR':
      case 'SECURITY':
        return (role ?? '').toUpperCase().trim();
      default:
        return 'KARYAWAN';
    }
  }

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

  Future<void> _scanTargetNikWithCamera() async {
    final rawValue = await _openCameraScanner(
      title: 'Scan NIK',
      subtitle: 'Arahkan kamera ke barcode atau QR yang memuat NIK karyawan.',
    );
    if (!mounted || rawValue == null) return;

    final nik = ScanPayloadService.extractNik(rawValue);
    if (nik == null) {
      setState(() {
        _statusMessage =
            'Scan berhasil dibaca, tetapi formatnya tidak dikenali sebagai NIK.';
        _statusColor = Colors.red;
      });
      return;
    }

    setState(() {
      _targetNikController.text = nik;
      _statusMessage = 'NIK target terisi dari scan kamera: $nik';
      _statusColor = Colors.green;
    });
  }

  Future<void> _lookupCardStatus(
    String cardCode, {
    required String sourceLabel,
  }) async {
    setState(() {
      _isScanning = true;
      _scannedData = null;
      _statusMessage = 'Memeriksa kartu dari $sourceLabel: $cardCode';
      _statusColor = Colors.blue;
    });

    final result = await ApiService.post('getBindingStatus', {
      'noKartuMK': cardCode,
    });

    if (!mounted) return;

    setState(() {
      _isScanning = false;
      if (result['ok'] == true) {
        _scannedData = <String, dynamic>{
          ...result,
          'noKartuMK': result['noKartuMK'] ?? result['card'] ?? cardCode,
          'scanSource': sourceLabel,
        };
        _statusMessage = 'Kartu ditemukan lewat $sourceLabel';
        _statusColor = Colors.green;
      } else {
        _statusMessage = result['msg'] ?? 'Kartu tidak terdaftar';
        _statusColor = Colors.red;
      }
    });
  }

  Future<void> _scanCardWithCamera() async {
    final rawValue = await _openCameraScanner(
      title: 'Scan Kartu MK',
      subtitle:
          'Arahkan kamera ke barcode atau QR pada kartu MK untuk memeriksa status kartu.',
    );
    if (!mounted || rawValue == null) return;

    final cardCode = ScanPayloadService.extractCardCode(rawValue);
    if (cardCode == null) {
      setState(() {
        _statusMessage =
            'Scan berhasil dibaca, tetapi format barcode/QR tidak dikenali sebagai kartu MK.';
        _statusColor = Colors.red;
      });
      return;
    }

    await _lookupCardStatus(cardCode, sourceLabel: 'kamera');
  }

  Future<void> _scanCardWithNfc() async {
    setState(() {
      _isScanning = true;
      _scannedData = null;
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

    await _lookupCardStatus(uid, sourceLabel: 'NFC');
  }

  Future<void> _prosesMasuk() async {
    if (_scannedData == null) return;

    final sessionProvider =
        Provider.of<SessionProvider>(context, listen: false);
    final currentUser = sessionProvider.session;
    final uid = _scannedData!['noKartuMK'] ?? _scannedData!['card'];
    final targetNik = (_targetNikController.text.trim().isNotEmpty
            ? _targetNikController.text.trim()
            : currentUser?.nik) ??
        '';
    final currentStatus =
        (_scannedData!['status'] ?? '').toString().toUpperCase();

    if (targetNik.isEmpty) {
      setState(() {
        _statusMessage = 'NIK target wajib diisi untuk proses masuk.';
        _statusColor = Colors.red;
      });
      return;
    }

    if (currentStatus == 'BOUND') {
      setState(() {
        _statusMessage =
            'Kartu ini masih terikat. Lakukan proses keluar atau release lebih dulu.';
        _statusColor = Colors.red;
      });
      return;
    }

    setState(() {
      _isScanning = true;
      _statusMessage = 'Memverifikasi GPS untuk masuk...';
      _statusColor = Colors.blue;
    });

    try {
      final position = await GpsService.getCurrentPosition();
      final result = await ApiService.post('bindKartu', {
        'noKartuMK': uid,
        'nik': targetNik,
        'loker': _lokerController.text.trim(),
        'lat': position?.latitude,
        'lng': position?.longitude,
      });

      if (!mounted) return;

      setState(() {
        _isScanning = false;
        if (result['ok'] == true) {
          _statusMessage =
              result['msg']?.toString() ?? 'Berhasil masuk pabrik';
          _statusColor = Colors.green;
          _scannedData = null;
        } else {
          _statusMessage =
              result['msg']?.toString() ?? 'Gagal masuk pabrik';
          _statusColor = Colors.red;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isScanning = false;
        _statusMessage = 'GPS Error: $e';
        _statusColor = Colors.red;
      });
    }
  }

  Future<void> _prosesKeluar() async {
    if (_scannedData == null) return;

    final uid = _scannedData!['noKartuMK'];
    final loker = _scannedData!['loker'] ?? '';

    setState(() {
      _isScanning = true;
      _statusMessage = 'Mendapatkan GPS...';
      _statusColor = Colors.blue;
    });

    try {
      final position = await GpsService.getCurrentPosition();
      final result = await ApiService.post('releaseKartu', {
        'noKartuMK': uid,
        'loker': loker,
        'lat': position?.latitude,
        'lng': position?.longitude,
      });

      if (!mounted) return;

      setState(() {
        _isScanning = false;
        if (result['ok'] == true) {
          _statusMessage = 'Berhasil keluar pabrik';
          _statusColor = Colors.green;
          _scannedData = null;
        } else {
          _statusMessage = result['msg'] ?? 'Gagal keluar';
          _statusColor = Colors.red;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isScanning = false;
        _statusMessage = 'GPS Error: $e';
        _statusColor = Colors.red;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionProvider = Provider.of<SessionProvider>(context);
    final currentUser = sessionProvider.session;
    final role = _resolveRole(currentUser?.role);
    final isAssistRole = role == 'ADMINISTRATOR' || role == 'SECURITY';
    if (!isAssistRole &&
        currentUser != null &&
        _targetNikController.text != currentUser.nik) {
      _targetNikController.text = currentUser.nik;
    }

    final scannedStatus =
        (_scannedData?['status'] ?? '').toString().toUpperCase();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (currentUser != null) ...<Widget>[
            Text(
              isAssistRole
                  ? 'Mode bantuan: isi atau scan NIK karyawan yang akan diproses.'
                  : 'Login aktif: ${currentUser.nama} (${currentUser.nik})',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
          ],
          TextField(
            controller: _targetNikController,
            readOnly: !isAssistRole,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: isAssistRole ? 'NIK Karyawan Target' : 'NIK Login',
              helperText: isAssistRole
                  ? 'Bisa diketik manual atau diisi dari scan barcode/QR NIK.'
                  : null,
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.badge),
              suffixIcon: isAssistRole
                  ? IconButton(
                      onPressed: _isScanning ? null : _scanTargetNikWithCamera,
                      icon: const Icon(Icons.qr_code_scanner),
                      tooltip: 'Scan NIK',
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lokerController,
            decoration: const InputDecoration(
              labelText: 'No Loker (opsional)',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.lock_outline),
            ),
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
                  Icons.qr_code_2,
                  size: 88,
                  color: _isScanning ? Colors.blue : Colors.grey,
                ),
                const SizedBox(height: 16),
                Text(
                  _statusMessage,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: _statusColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: _isScanning ? null : _scanCardWithCamera,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: const Color(0xFF1F5F97),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.photo_camera),
                  label: const Text(
                    'SCAN KARTU (KAMERA)',
                    style: TextStyle(fontSize: 16),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _isScanning ? null : _scanCardWithNfc,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  icon: const Icon(Icons.nfc),
                  label: const Text(
                    'TAP KARTU (NFC CADANGAN)',
                    style: TextStyle(fontSize: 15),
                  ),
                ),
              ],
            ),
          ),
          if (_scannedData != null) ...<Widget>[
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Sumber scan: ${_scannedData!['scanSource'] ?? '-'}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Kode kartu: ${_scannedData!['noKartuMK'] ?? '-'}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Nama: ${_scannedData!['nama'] ?? '-'}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text('Dept: ${_scannedData!['dept'] ?? '-'}'),
                    Text('Status: ${_scannedData!['status'] ?? '-'}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: <Widget>[
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: (_isScanning || scannedStatus == 'BOUND')
                        ? null
                        : _prosesMasuk,
                    icon: const Icon(Icons.login),
                    label: const Text('MASUK'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: (_isScanning || scannedStatus != 'BOUND')
                        ? null
                        : _prosesKeluar,
                    icon: const Icon(Icons.logout),
                    label: const Text('KELUAR'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
