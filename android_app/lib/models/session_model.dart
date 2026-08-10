class SessionModel {
  final String sessionToken;
  final String nik;
  final String nama;
  final String departemen;
  final String jabatan;
  final String role;

  SessionModel({
    required this.sessionToken,
    required this.nik,
    required this.nama,
    required this.departemen,
    required this.jabatan,
    required this.role,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    return SessionModel(
      sessionToken: json['sessionToken'] ?? '',
      nik: json['nik'] ?? '',
      nama: json['nama'] ?? '',
      departemen: json['departemen'] ?? json['dept'] ?? '',
      jabatan: json['jabatan'] ?? '',
      role: json['role'] ?? '',
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
    };
  }
}
