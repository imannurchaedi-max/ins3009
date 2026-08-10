import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/session_model.dart';
import '../services/api_service.dart';

class SessionProvider with ChangeNotifier {
  SessionModel? _session;
  bool _isLoading = true;

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
        _session = SessionModel.fromJson(jsonDecode(sessionJson));
      } catch (e) {
        _session = null;
      }
    }
    _isLoading = false;
    notifyListeners();
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

      // Gunakan NIK sebagai session token (GAS tidak generate token khusus)
      _session = SessionModel(
        sessionToken: karyawanJson['nik'] ?? nik,
        nik: karyawanJson['nik'] ?? nik,
        nama: karyawanJson['nama'] ?? '',
        departemen:
            karyawanJson['dept'] ?? '', // GAS field = 'dept' bukan 'departemen'
        jabatan: karyawanJson['jabatan'] ?? '',
        role: karyawanJson['role'] ?? 'KARYAWAN',
      );

      // Save to SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_session', jsonEncode(_session!.toJson()));
    }

    notifyListeners();
    return result;
  }

  Future<void> logout() async {
    _session = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_session');
    notifyListeners();
  }
}
