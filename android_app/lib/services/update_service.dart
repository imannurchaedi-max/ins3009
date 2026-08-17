import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

class UpdateInfo {
  final String version;
  final String downloadUrl;
  final String releaseNotes;
  final int? sizeBytes;

  UpdateInfo({
    required this.version,
    required this.downloadUrl,
    required this.releaseNotes,
    this.sizeBytes,
  });
}

/// Cek update lewat GitHub Releases (github.com/imannurchaedi-max/ins3009).
/// Setiap rilis baru harus di-tag `vX.Y.Z` dengan asset `.apk` terlampir.
class UpdateService {
  static const String _releasesApiUrl =
      'https://api.github.com/repos/imannurchaedi-max/ins3009/releases/latest';

  /// Null kalau tidak ada update, gagal cek (mis. offline), atau rilis terbaru
  /// tidak punya asset .apk.
  static Future<UpdateInfo?> checkForUpdate() async {
    try {
      final response = await http.get(
        Uri.parse(_releasesApiUrl),
        headers: const {'Accept': 'application/vnd.github+json'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) return null;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final tagName = (data['tag_name'] ?? '').toString().trim();
      final remoteVersion =
          tagName.startsWith('v') ? tagName.substring(1) : tagName;
      if (remoteVersion.isEmpty) return null;

      final assets = (data['assets'] as List?) ?? const [];
      Map<String, dynamic>? apkAsset;
      for (final raw in assets) {
        final asset = raw as Map<String, dynamic>;
        if ((asset['name'] ?? '').toString().toLowerCase().endsWith('.apk')) {
          apkAsset = asset;
          break;
        }
      }
      if (apkAsset == null) return null;

      final packageInfo = await PackageInfo.fromPlatform();
      if (!_isNewer(remoteVersion, packageInfo.version)) return null;

      return UpdateInfo(
        version: remoteVersion,
        downloadUrl: (apkAsset['browser_download_url'] ?? '').toString(),
        releaseNotes: (data['body'] ?? '').toString(),
        sizeBytes: apkAsset['size'] is int ? apkAsset['size'] as int : null,
      );
    } catch (_) {
      // Offline / GitHub tidak terjangkau / respons tidak terduga — diamkan,
      // ini pengecekan best-effort di background, bukan alur kritikal.
      return null;
    }
  }

  static bool _isNewer(String remote, String current) {
    final r = _parseVersion(remote);
    final c = _parseVersion(current);
    for (var i = 0; i < 3; i++) {
      if (r[i] != c[i]) return r[i] > c[i];
    }
    return false;
  }

  static List<int> _parseVersion(String v) {
    final cleaned = v.split('+').first.trim();
    final parts =
        cleaned.split('.').map((p) => int.tryParse(p.trim()) ?? 0).toList();
    while (parts.length < 3) {
      parts.add(0);
    }
    return parts;
  }

  /// Download APK ke direktori sementara aplikasi. Melempar exception kalau gagal.
  static Future<String> downloadApk(
    String url, {
    void Function(int received, int? total)? onProgress,
  }) async {
    final dir = await getTemporaryDirectory();
    final filePath = '${dir.path}/dam_update.apk';
    final file = File(filePath);

    final request = http.Request('GET', Uri.parse(url));
    final response = await http.Client().send(request);
    if (response.statusCode != 200) {
      throw Exception('Gagal download update: HTTP ${response.statusCode}');
    }

    final total = response.contentLength;
    var received = 0;
    final sink = file.openWrite();
    await response.stream.listen((chunk) {
      received += chunk.length;
      sink.add(chunk);
      onProgress?.call(received, total);
    }).asFuture<void>();
    await sink.close();

    return filePath;
  }

  /// Buka installer paket sistem Android untuk APK yang sudah didownload.
  /// Tetap butuh konfirmasi user di dialog sistem — Android tidak mengizinkan
  /// instalasi APK sideload tanpa persetujuan eksplisit, walau lewat aplikasi
  /// yang sudah punya izin REQUEST_INSTALL_PACKAGES.
  static Future<void> installApk(String filePath) async {
    await OpenFilex.open(filePath);
  }
}
