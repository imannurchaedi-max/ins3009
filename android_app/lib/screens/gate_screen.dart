import 'dart:async';

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
  Map<String, dynamic>? _targetEmployee;
  bool _isLookingUpTarget = false;
  Timer? _targetLookupDebounce;
  int _cardLookupRequestId = 0;
  int _gateMutationRequestId = 0;

  @override
  void dispose() {
    _targetLookupDebounce?.cancel();
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

  Map<String, dynamic> _buildEmployeeFromSession(dynamic user) {
    return <String, dynamic>{
      'nik': user?.nik ?? '',
      'nama': user?.nama ?? '',
      'dept': user?.departemen ?? '',
      'jabatan': user?.jabatan ?? '',
      'role': user?.role ?? '',
    };
  }

  void _scheduleTargetNikLookup(
    String rawNik, {
    bool immediate = false,
    bool announce = false,
  }) {
    _targetLookupDebounce?.cancel();

    final nik = rawNik.trim();
    if (nik.isEmpty || nik.length < 8) {
      setState(() {
        _targetEmployee = null;
        _isLookingUpTarget = false;
      });
      return;
    }

    if (immediate) {
      _lookupTargetEmployee(nik, announce: announce);
      return;
    }

    _targetLookupDebounce = Timer(const Duration(milliseconds: 350), () {
      _lookupTargetEmployee(nik, announce: announce);
    });
  }

  Future<void> _lookupTargetEmployee(
    String nik, {
    bool announce = false,
  }) async {
    final targetNik = nik.trim();
    if (targetNik.isEmpty) return;

    setState(() {
      _isLookingUpTarget = true;
    });

    final result = await ApiService.post('getKaryawanByNIK', {
      'nik': targetNik,
    });

    if (!mounted) return;
    if (_targetNikController.text.trim() != targetNik) return;

    setState(() {
      _isLookingUpTarget = false;
      if (result['ok'] == true && result['karyawan'] is Map) {
        _targetEmployee = Map<String, dynamic>.from(
            result['karyawan'] as Map<dynamic, dynamic>);
        if (announce) {
          _statusMessage =
              'Target karyawan ditemukan: ${_targetEmployee!['nama'] ?? targetNik}';
          _statusColor = Colors.green;
        }
      } else {
        _targetEmployee = null;
        if (announce) {
          _statusMessage =
              result['msg']?.toString() ?? 'NIK target tidak ditemukan.';
          _statusColor = Colors.red;
        }
      }
    });
  }

  Future<bool> _ensureTargetEmployeeReady(String nik) async {
    final targetNik = nik.trim();
    if (targetNik.isEmpty) return false;

    if ((_targetEmployee?['nik'] ?? '').toString().trim() == targetNik) {
      return true;
    }

    await _lookupTargetEmployee(targetNik, announce: true);
    if (!mounted) return false;
    return (_targetEmployee?['nik'] ?? '').toString().trim() == targetNik;
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
      _statusMessage = 'Memuat data target untuk NIK: $nik';
      _statusColor = Colors.blue;
    });
    await _lookupTargetEmployee(nik, announce: true);
  }

  Future<void> _lookupCardStatus(
    String cardCode, {
    required String sourceLabel,
  }) async {
    if (_isScanning) return;
    final requestId = ++_cardLookupRequestId;

    setState(() {
      _isScanning = true;
      _scannedData = null;
      _statusMessage = 'Memeriksa kartu dari $sourceLabel: $cardCode';
      _statusColor = Colors.blue;
    });

    final result = await _fetchCardStatus(cardCode);

    if (!mounted || requestId != _cardLookupRequestId) return;

    setState(() {
      _isScanning = false;
      if (result['ok'] == true) {
        final status = (result['status'] ?? '').toString().toUpperCase();
        _scannedData = <String, dynamic>{
          ...result,
          'noKartuMK': result['noKartuMK'] ?? result['card'] ?? cardCode,
          'scanSource': sourceLabel,
        };
        if (status == 'BOUND') {
          _statusMessage =
              'Kartu masih terikat. Untuk proses masuk, gunakan kartu lain.';
          _statusColor = Colors.orange;
        } else {
          final targetName = (_targetEmployee?['nama'] ?? '').toString().trim();
          _statusMessage = targetName.isNotEmpty
              ? 'Kartu tersedia untuk $targetName.'
              : 'Kartu tersedia dan siap dipakai.';
          _statusColor = Colors.green;
        }
      } else {
        _statusMessage = result['msg'] ?? 'Kartu tidak terdaftar';
        _statusColor = Colors.red;
      }
    });
  }

  Future<Map<String, dynamic>> _fetchCardStatus(String cardCode) {
    return ApiService.post('getBindingStatus', {
      'noKartuMK': cardCode,
    });
  }

  String _sanitizeGateRequestToken(String value) {
    return value.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '').toUpperCase();
  }

  String _buildGateRequestId(
    String requestAction,
    String cardCode,
    int requestNonce,
  ) {
    final actionToken = _sanitizeGateRequestToken(requestAction);
    final cardToken = _sanitizeGateRequestToken(cardCode);
    final timestamp = DateTime.now().toUtc().microsecondsSinceEpoch;
    return 'gate.${actionToken.isEmpty ? 'ACTION' : actionToken}.'
        '${cardToken.isEmpty ? 'CARD' : cardToken}.$timestamp.$requestNonce';
  }

  bool _isPendingGateResponse(Map<String, dynamic>? result) {
    if (result == null) return false;
    final status = (result['requestStatus'] ?? '').toString().toUpperCase();
    return result['pending'] == true ||
        status == 'PENDING' ||
        status == 'PROCESSING';
  }

  bool _isUnknownGateResponse(Map<String, dynamic>? result) {
    if (result == null) return false;
    final status = (result['requestStatus'] ?? '').toString().toUpperCase();
    final message = (result['msg'] ?? '').toString().toLowerCase();
    return status == 'UNKNOWN' || message.contains('tidak ditemukan');
  }

  Future<Map<String, dynamic>> _recoverGateMutationStatus({
    required int requestNonce,
    required String requestId,
    required String requestAction,
    required Map<String, dynamic> submitPayload,
  }) async {
    final delaysMs = <int>[700, 1100, 1600, 2200, 3000];
    Map<String, dynamic> lastResult = <String, dynamic>{
      'ok': false,
      'pending': true,
      'requestId': requestId,
      'requestAction': requestAction,
      'requestStatus': 'PENDING',
      'msg': 'Request gate sedang diproses.',
    };
    var hasResubmitted = false;

    for (final delayMs in delaysMs) {
      await Future<void>.delayed(Duration(milliseconds: delayMs));
      if (!mounted || requestNonce != _gateMutationRequestId) {
        return <String, dynamic>{
          'ok': false,
          'msg': 'Request gate dibatalkan karena ada aksi baru.',
        };
      }

      final statusResult = await ApiService.post(
        'getGateRequestStatus',
        {
          'requestId': requestId,
        },
        customTimeout: const Duration(seconds: 6),
      );
      lastResult = statusResult;

      if (statusResult['ok'] == true && !_isPendingGateResponse(statusResult)) {
        return statusResult;
      }

      if (_isPendingGateResponse(statusResult)) {
        continue;
      }

      if (!hasResubmitted &&
          (_isUnknownGateResponse(statusResult) ||
              ApiService.isConnectivityFailureResult(statusResult))) {
        hasResubmitted = true;
        final replayResult = await ApiService.post(
          'submitGateRequest',
          submitPayload,
          customTimeout: const Duration(seconds: 10),
        );
        lastResult = replayResult;

        if (replayResult['ok'] == true &&
            !_isPendingGateResponse(replayResult)) {
          return replayResult;
        }
      }
    }

    if (_isPendingGateResponse(lastResult)) {
      return <String, dynamic>{
        'ok': false,
        'pending': true,
        'requestId': requestId,
        'requestAction': requestAction,
        'requestStatus': (lastResult['requestStatus'] ?? 'PROCESSING')
            .toString()
            .toUpperCase(),
        'msg':
            'Request sudah diterima server tetapi belum selesai dikonfirmasi. Tunggu beberapa detik lalu cek lagi.',
      };
    }

    return lastResult;
  }

  Future<Map<String, dynamic>> _submitGateMutation({
    required int requestNonce,
    required String requestAction,
    required Map<String, dynamic> mutationPayload,
  }) async {
    final requestId = _buildGateRequestId(
      requestAction,
      (mutationPayload['noKartuMK'] ?? '').toString(),
      requestNonce,
    );
    final submitPayload = <String, dynamic>{
      'requestId': requestId,
      'requestAction': requestAction,
      ...mutationPayload,
    };

    final submitResult =
        await ApiService.post('submitGateRequest', submitPayload);
    if (submitResult['ok'] == true && !_isPendingGateResponse(submitResult)) {
      return submitResult;
    }

    if (mounted && requestNonce == _gateMutationRequestId) {
      setState(() {
        _statusMessage = _isPendingGateResponse(submitResult)
            ? (submitResult['msg']?.toString() ??
                'Request diterima server. Menunggu konfirmasi hasil...')
            : 'Koneksi sempat terputus. Sedang cek status request ke server...';
        _statusColor = Colors.blue;
      });
    }

    if (_isPendingGateResponse(submitResult) ||
        ApiService.isConnectivityFailureResult(submitResult) ||
        _isUnknownGateResponse(submitResult)) {
      return _recoverGateMutationStatus(
        requestNonce: requestNonce,
        requestId: requestId,
        requestAction: requestAction,
        submitPayload: submitPayload,
      );
    }

    return submitResult;
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
            'Scan terbaca, tetapi kodenya ambigu atau bukan format kartu MK. Tahan kamera sedikit lebih lama lalu scan ulang.';
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
    if (_scannedData == null || _isScanning) return;
    final requestId = ++_gateMutationRequestId;

    final sessionProvider =
        Provider.of<SessionProvider>(context, listen: false);
    final currentUser = sessionProvider.session;
    final role = _resolveRole(currentUser?.role);
    final isAssistRole = role == 'ADMINISTRATOR' || role == 'SECURITY';
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

    if (isAssistRole) {
      final targetReady = await _ensureTargetEmployeeReady(targetNik);
      if (!mounted || requestId != _gateMutationRequestId) return;
      if (!targetReady) {
        setState(() {
          _statusMessage =
              'NIK target belum valid. Pilih karyawan yang benar sebelum proses masuk.';
          _statusColor = Colors.red;
        });
        return;
      }
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
      _statusMessage = 'Memverifikasi lokasi untuk proses masuk...';
      _statusColor = Colors.blue;
    });

    try {
      final position = await GpsService.getCurrentPosition();
      final result = await _submitGateMutation(
        requestNonce: requestId,
        requestAction: 'bindKartu',
        mutationPayload: <String, dynamic>{
          'noKartuMK': uid,
          'nik': targetNik,
          'loker': _lokerController.text.trim(),
          'lat': position?.latitude,
          'lng': position?.longitude,
        },
      );

      if (!mounted || requestId != _gateMutationRequestId) return;

      setState(() {
        _isScanning = false;
        if (result['ok'] == true) {
          _statusMessage = result['msg']?.toString() ?? 'Berhasil masuk pabrik';
          _statusColor = Colors.green;
          _scannedData = null;
          _lokerController.clear();
          if (isAssistRole) {
            _targetNikController.clear();
            _targetEmployee = null;
          }
        } else {
          _statusMessage = result['msg']?.toString() ?? 'Gagal masuk pabrik';
          _statusColor =
              _isPendingGateResponse(result) ? Colors.orange : Colors.red;
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
    if (_scannedData == null || _isScanning) return;
    final requestId = ++_gateMutationRequestId;

    final uid = _scannedData!['noKartuMK'];
    final loker = _scannedData!['loker'] ?? '';

    setState(() {
      _isScanning = true;
      _statusMessage = 'Memverifikasi lokasi untuk proses keluar...';
      _statusColor = Colors.blue;
    });

    try {
      final position = await GpsService.getCurrentPosition();
      final result = await _submitGateMutation(
        requestNonce: requestId,
        requestAction: 'releaseKartu',
        mutationPayload: <String, dynamic>{
          'noKartuMK': uid,
          'loker': loker,
          'lat': position?.latitude,
          'lng': position?.longitude,
        },
      );

      if (!mounted || requestId != _gateMutationRequestId) return;

      setState(() {
        _isScanning = false;
        if (result['ok'] == true) {
          _statusMessage =
              result['msg']?.toString() ?? 'Berhasil keluar pabrik';
          _statusColor = Colors.green;
          _scannedData = null;
          _lokerController.clear();
        } else {
          _statusMessage = result['msg']?.toString() ?? 'Gagal keluar';
          _statusColor =
              _isPendingGateResponse(result) ? Colors.orange : Colors.red;
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
      _targetEmployee = _buildEmployeeFromSession(currentUser);
    }
    if (!isAssistRole && currentUser != null) {
      _targetEmployee = _buildEmployeeFromSession(currentUser);
    }

    final scannedStatus =
        (_scannedData?['status'] ?? '').toString().toUpperCase();
    final hasResolvedTarget = _targetNikController.text.trim().isNotEmpty &&
        (_targetEmployee?['nik'] ?? '').toString().trim() ==
            _targetNikController.text.trim();

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
            onChanged: isAssistRole
                ? (String value) => _scheduleTargetNikLookup(value)
                : null,
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
          if (_isLookingUpTarget) ...<Widget>[
            const SizedBox(height: 8),
            const LinearProgressIndicator(minHeight: 3),
          ],
          if (_targetEmployee != null) ...<Widget>[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Text(
                      'Target karyawan',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${_targetEmployee!['nama'] ?? '-'}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text('NIK: ${_targetEmployee!['nik'] ?? '-'}'),
                    Text('Dept: ${_targetEmployee!['dept'] ?? '-'}'),
                    Text('Jabatan: ${_targetEmployee!['jabatan'] ?? '-'}'),
                  ],
                ),
              ),
            ),
          ],
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
                      'Nama: ${scannedStatus == 'BOUND' ? (_scannedData!['nama'] ?? '-') : '-'}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Dept: ${scannedStatus == 'BOUND' ? (_scannedData!['dept'] ?? '-') : '-'}',
                    ),
                    Text('Status: ${_scannedData!['status'] ?? '-'}'),
                    if (scannedStatus == 'FREE' &&
                        (_scannedData!['waktuRelease'] ?? '')
                            .toString()
                            .trim()
                            .isNotEmpty)
                      Text(
                          'Terakhir release: ${_scannedData!['waktuRelease']}'),
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
                    onPressed: (_isScanning ||
                            _isLookingUpTarget ||
                            scannedStatus == 'BOUND' ||
                            !hasResolvedTarget)
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
