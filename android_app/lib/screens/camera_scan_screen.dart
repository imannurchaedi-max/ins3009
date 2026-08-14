import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class CameraScanScreen extends StatefulWidget {
  final String title;
  final String subtitle;

  const CameraScanScreen({
    super.key,
    required this.title,
    required this.subtitle,
  });

  @override
  State<CameraScanScreen> createState() => _CameraScanScreenState();
}

class _CameraScanScreenState extends State<CameraScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    // unrestricted, bukan noDuplicates — kita butuh onDetect terus terpanggil
    // untuk value yang SAMA supaya debounce _handleDetection bisa mengonfirmasi
    // kestabilan bacaan selama _stableReadDuration. noDuplicates menahan
    // callback berulang untuk value sama sehingga konfirmasi tidak pernah
    // tercapai (macet permanen di "Mengunci kode...").
    detectionSpeed: DetectionSpeed.unrestricted,
    facing: CameraFacing.back,
    formats: const <BarcodeFormat>[
      BarcodeFormat.qrCode,
      BarcodeFormat.code128,
      BarcodeFormat.code39,
      BarcodeFormat.code93,
      BarcodeFormat.ean13,
      BarcodeFormat.ean8,
      BarcodeFormat.upcA,
      BarcodeFormat.upcE,
      BarcodeFormat.dataMatrix,
      BarcodeFormat.pdf417,
      BarcodeFormat.aztec,
      BarcodeFormat.codabar,
      BarcodeFormat.itf14,
    ],
  );

  // Kartu/QR harus terbaca dengan nilai yang SAMA selama minimal ini sebelum
  // diterima — 1 frame blur/pantulan cahaya tidak lagi cukup untuk misread.
  static const Duration _stableReadDuration = Duration(milliseconds: 400);

  bool _handled = false;
  bool _torchEnabled = false;
  String? _pendingValue;
  DateTime? _pendingSince;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _pickBestValue(BarcodeCapture capture) {
    final values = <String>[];

    for (final Barcode barcode in capture.barcodes) {
      final rawValue = barcode.rawValue?.trim();
      final displayValue = barcode.displayValue?.trim();

      if (rawValue != null && rawValue.isNotEmpty && !values.contains(rawValue)) {
        values.add(rawValue);
      }
      if (displayValue != null &&
          displayValue.isNotEmpty &&
          !values.contains(displayValue)) {
        values.add(displayValue);
      }
    }

    if (values.isEmpty) return null;

    values.sort((String a, String b) {
      final scoreA = _scoreDetectedValue(a);
      final scoreB = _scoreDetectedValue(b);
      if (scoreA != scoreB) return scoreB.compareTo(scoreA);
      return b.length.compareTo(a.length);
    });

    return values.first;
  }

  int _scoreDetectedValue(String value) {
    final normalized = value.trim().toUpperCase();
    if (RegExp(r'^MK[\s:_-]*\d{3,}$').hasMatch(normalized)) return 4;
    if (RegExp(r'^\d{6}$').hasMatch(normalized) && normalized.startsWith('1')) {
      return 3;
    }
    if (RegExp(r'^\d{3,12}$').hasMatch(normalized)) return 2;
    if (RegExp(r'^[A-Z0-9:_-]{3,32}$').hasMatch(normalized)) return 1;
    return 0;
  }

  Future<void> _handleDetection(BarcodeCapture capture) async {
    if (_handled) return;

    final detectedValue = _pickBestValue(capture);
    if (detectedValue == null || detectedValue.isEmpty) return;

    final now = DateTime.now();
    if (_pendingValue != detectedValue) {
      // Nilai berubah (atau baru pertama kali terlihat) — mulai hitung ulang
      // window kestabilan, jangan langsung terima.
      setState(() {
        _pendingValue = detectedValue;
        _pendingSince = now;
      });
      return;
    }

    final since = _pendingSince;
    if (since == null || now.difference(since) < _stableReadDuration) {
      return;
    }

    _handled = true;
    await _controller.stop();
    if (!mounted) return;
    Navigator.of(context).pop(detectedValue);
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    if (!mounted) return;
    setState(() => _torchEnabled = !_torchEnabled);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.title),
        actions: <Widget>[
          IconButton(
            onPressed: _toggleTorch,
            icon: Icon(_torchEnabled ? Icons.flash_on : Icons.flash_off),
            tooltip: 'Flash',
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          MobileScanner(
            controller: _controller,
            onDetect: _handleDetection,
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white, width: 3),
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 32,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    _pendingValue != null
                        ? Icons.hourglass_top
                        : Icons.qr_code_scanner,
                    color: Colors.white,
                    size: 32,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _pendingValue != null
                        ? 'Mengunci kode: $_pendingValue ...'
                        : widget.subtitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
