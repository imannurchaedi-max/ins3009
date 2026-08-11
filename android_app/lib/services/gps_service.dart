import 'package:geolocator/geolocator.dart';

class GpsService {
  static const Duration _primaryTimeout = Duration(seconds: 8);
  static const Duration _fallbackTimeout = Duration(seconds: 6);
  static const Duration _maxLastKnownAge = Duration(minutes: 5);

  /// Ensures permissions and returns the freshest possible position.
  static Future<Position?> getCurrentPosition() async {
    await _ensurePermission();
    final lastKnown = await Geolocator.getLastKnownPosition();

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: _primaryTimeout,
      );
    } catch (_) {
      final cached = _pickRecentLastKnown(lastKnown);
      if (cached != null) {
        return cached;
      }
    }

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
        timeLimit: _fallbackTimeout,
      );
    } catch (_) {
      final cached = _pickRecentLastKnown(lastKnown);
      if (cached != null) {
        return cached;
      }
      return Future.error(
        'Lokasi GPS belum berhasil didapatkan. Aktifkan GPS, tunggu sinyal membaik, lalu coba lagi.',
      );
    }
  }

  static Future<void> _ensurePermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return Future.error('GPS di perangkat masih nonaktif.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return Future.error('Izin lokasi ditolak. Mohon izinkan akses lokasi.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return Future.error(
        'Izin lokasi ditolak permanen. Aktifkan kembali dari pengaturan aplikasi.',
      );
    }
  }

  static Position? _pickRecentLastKnown(Position? lastKnown) {
    if (lastKnown == null) return null;
    final timestamp = lastKnown.timestamp;
    if (DateTime.now().difference(timestamp) <= _maxLastKnownAge) {
      return lastKnown;
    }
    return null;
  }
}
