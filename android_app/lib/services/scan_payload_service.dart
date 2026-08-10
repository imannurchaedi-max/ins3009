import 'dart:convert';

class ScanPayloadService {
  static const List<String> _nikKeys = <String>[
    'nik',
    'employee_nik',
    'employeeNik',
    'karyawan_nik',
    'id_pegawai',
    'employee_id',
  ];

  static const List<String> _cardKeys = <String>[
    'noKartuMK',
    'nokartumk',
    'card',
    'card_id',
    'cardId',
    'uid',
    'tag',
    'kodeKartu',
    'kartu',
  ];

  static String? extractNik(String raw) {
    final normalized = raw.trim();
    if (normalized.isEmpty) return null;

    final structured = _extractFromStructuredPayload(normalized, _nikKeys);
    if (_looksLikeNik(structured)) return _digitsOnly(structured!);

    final uriValue = _extractFromUri(normalized, _nikKeys);
    if (_looksLikeNik(uriValue)) return _digitsOnly(uriValue!);

    final prefixedMatch = RegExp(
      r'(?:nik|employee|id)[^0-9]*([0-9]{8,12})',
      caseSensitive: false,
    ).firstMatch(normalized);
    if (prefixedMatch != null) return prefixedMatch.group(1);

    final exactDigits = _digitsOnly(normalized);
    if (_looksLikeNik(exactDigits)) return exactDigits;

    final fallbackMatch = RegExp(r'([0-9]{8,12})').firstMatch(normalized);
    return fallbackMatch?.group(1);
  }

  static String? extractCardCode(String raw) {
    final normalized = raw.trim();
    if (normalized.isEmpty) return null;

    final structured = _extractFromStructuredPayload(normalized, _cardKeys);
    if (_looksLikeCard(structured)) return structured!.trim();

    final uriValue = _extractFromUri(normalized, _cardKeys);
    if (_looksLikeCard(uriValue)) return uriValue!.trim();

    final prefixedMatch = RegExp(
      r'(?:card|kartu|uid|tag|mk)[^A-Za-z0-9]*([A-Za-z0-9:_-]{6,})',
      caseSensitive: false,
    ).firstMatch(normalized);
    if (prefixedMatch != null) return prefixedMatch.group(1)?.trim();

    if (_isUriLike(normalized)) return null;
    if (!_hasWhitespace(normalized) && normalized.length >= 6) return normalized;

    final fallbackMatch = RegExp(r'([A-Za-z0-9:_-]{6,})').firstMatch(normalized);
    return fallbackMatch?.group(1)?.trim();
  }

  static String _digitsOnly(String value) =>
      value.replaceAll(RegExp(r'[^0-9]'), '');

  static bool _looksLikeNik(String? value) {
    if (value == null || value.trim().isEmpty) return false;
    final digits = _digitsOnly(value);
    return digits.length >= 8 && digits.length <= 12;
  }

  static bool _looksLikeCard(String? value) {
    if (value == null) return false;
    final trimmed = value.trim();
    return trimmed.length >= 6 && !_hasWhitespace(trimmed);
  }

  static bool _hasWhitespace(String value) => RegExp(r'\s').hasMatch(value);

  static bool _isUriLike(String value) {
    final uri = Uri.tryParse(value);
    return uri != null && uri.hasScheme && uri.host.isNotEmpty;
  }

  static String? _extractFromStructuredPayload(
      String raw, List<String> keys) {
    dynamic decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      return null;
    }

    if (decoded is Map) {
      final lookup = <String, dynamic>{};
      decoded.forEach((dynamic key, dynamic value) {
        lookup[key.toString().toLowerCase()] = value;
      });
      for (final key in keys) {
        final value = lookup[key.toLowerCase()];
        if (value != null && value.toString().trim().isNotEmpty) {
          return value.toString();
        }
      }
    }
    return null;
  }

  static String? _extractFromUri(String raw, List<String> keys) {
    final uri = Uri.tryParse(raw);
    if (uri == null || !uri.hasScheme) return null;

    final query = <String, String>{};
    uri.queryParameters.forEach((String key, String value) {
      query[key.toLowerCase()] = value;
    });

    for (final key in keys) {
      final value = query[key.toLowerCase()];
      if (value != null && value.trim().isNotEmpty) return value;
    }

    return null;
  }
}
