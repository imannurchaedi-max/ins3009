class SessionModel {
  final String sessionToken;
  final String nik;
  final String nama;
  final String departemen;
  final String jabatan;
  final String role;
  final String type;

  SessionModel({
    required this.sessionToken,
    required this.nik,
    required this.nama,
    required this.departemen,
    required this.jabatan,
    required this.role,
    this.type = '',
  });

  /// PENGAWAS dengan type 'VENDOR' = admin vendor: lihat absen SEMUA mitra
  /// kerja lintas dept (bukan cuma dept sendiri), dibatasi ke tipe outsource.
  bool get isVendorAdmin =>
      role.toUpperCase() == 'PENGAWAS' && type.toUpperCase() == 'VENDOR';

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    return SessionModel(
      sessionToken: json['sessionToken'] ?? '',
      nik: json['nik'] ?? '',
      nama: json['nama'] ?? '',
      departemen: json['departemen'] ?? json['dept'] ?? '',
      jabatan: json['jabatan'] ?? '',
      role: json['role'] ?? '',
      type: json['type'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionToken': sessionToken,
      'nik': nik,
      'nama': nama,
      'departemen': departemen,
      'jabatan': jabatan,
      'role': role,
      'type': type,
    };
  }
}
