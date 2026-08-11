import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/session_model.dart';
import '../services/api_service.dart';

class SessionProvider with ChangeNotifier {
  SessionModel? _session;
  bool _isLoading = true;
  int _sessionVersion = 0;

  SessionModel? get session => _session;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _session != null;

  SessionProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final sessionJson = prefs.getString('user_session');

    if (sessionJson != null) {
      try {
        final restoredSession = SessionModel.fromJson(jsonDecode(sessionJson));
        final restoreVersion = ++_sessionVersion;
        _session = restoredSession;
        _isLoading = false;
        notifyListeners();

        unawaited(_refreshSessionFromBackend(
          expectedNik: restoredSession.nik,
          version: restoreVersion,
        ));
        return;
      } catch (e) {
        await _clearSession(prefs: prefs, notify: false);
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  SessionModel _buildSessionFromKaryawan(
    Map<String, dynamic> karyawanJson, {
    required String fallbackNik,
  }) {
    final nik = (karyawanJson['nik'] ?? fallbackNik).toString();
    return SessionModel(
      sessionToken: nik,
      nik: nik,
      nama: (karyawanJson['nama'] ?? '').toString(),
      departemen:
          (karyawanJson['dept'] ?? karyawanJson['departemen'] ?? '').toString(),
      jabatan: (karyawanJson['jabatan'] ?? '').toString(),
      role: (karyawanJson['role'] ?? 'KARYAWAN').toString(),
    );
  }

  Future<void> _persistSession() async {
    if (_session == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_session', jsonEncode(_session!.toJson()));
  }

  Future<void> _clearSession({
    SharedPreferences? prefs,
    bool notify = true,
  }) async {
    _session = null;
    _isLoading = false;
    final targetPrefs = prefs ?? await SharedPreferences.getInstance();
    await targetPrefs.remove('user_session');
    if (notify) {
      notifyListeners();
    }
  }

  bool _isActiveSessionVersion(int version, String expectedNik) {
    return version == _sessionVersion &&
        _session != null &&
        _session!.nik == expectedNik;
  }

  bool _isConnectivityFailure(String message) {
    final lower = message.toLowerCase();
    return lower.contains('timeout') ||
        lower.contains('koneksi') ||
        lower.contains('network') ||
        lower.contains('handshake') ||
        lower.contains('socket') ||
        lower.contains('connection');
  }

  Future<void> _refreshSessionFromBackend({
    required String expectedNik,
    required int version,
  }) async {
    final existing = _session;
    if (existing == null || !_isActiveSessionVersion(version, expectedNik)) {
      return;
    }

    final result = await ApiService.post('verifySession', {
      'sessionToken': existing.sessionToken,
      'nik': existing.nik,
    });

    if (!_isActiveSessionVersion(version, expectedNik)) {
      return;
    }

    if (result['ok'] == true && result['karyawan'] is Map<String, dynamic>) {
      _session = _buildSessionFromKaryawan(
        result['karyawan'] as Map<String, dynamic>,
        fallbackNik: existing.nik,
      );
      await _persistSession();
      notifyListeners();
      return;
    }

    final message = (result['msg'] ?? '').toString();
    if (_isConnectivityFailure(message)) {
      return;
    }

    if (_isActiveSessionVersion(version, expectedNik)) {
      await _clearSession(notify: false);
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> login(String nik, String password) async {
    // Action harus 'verifyLogin' — sesuai switch-case di GAS doPost
    final result = await ApiService.post('verifyLogin', {
      'nik': nik,
      'password': password,
    });

    if (result['ok'] == true) {
      // GAS verifyLogin mengembalikan { ok: true, karyawan: { nik, nama, dept, jabatan, role, ... } }
      // BUKAN 'user' dan BUKAN 'sessionToken'
      final karyawanJson = result['karyawan'] as Map<String, dynamic>;
      _sessionVersion++;
      _session = _buildSessionFromKaryawan(
        karyawanJson,
        fallbackNik: nik,
      );
      _isLoading = false;
      await _persistSession();
    }

    notifyListeners();
    return result;
  }

  Future<void> logout() async {
    _sessionVersion++;
    await _clearSession();
  }
}
