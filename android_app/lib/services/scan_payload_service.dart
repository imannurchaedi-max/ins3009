import 'dart:convert';

class ScanPayloadService {
  static final RegExp _serialPattern = RegExp(r'^[A-Z0-9_-]{3,32}$');

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
    final candidates = extractCardCandidates(raw);
    return candidates.isEmpty ? null : candidates.first;
  }

  static List<String> extractCardCandidates(String raw) {
    final normalized = raw.trim();
    if (normalized.isEmpty) return <String>[];

    final candidates = <String>[];
    void addCandidate(String? value) {
      for (final candidate in _expandCardCandidates(value)) {
        if (!candidates.contains(candidate)) {
          candidates.add(candidate);
        }
      }
    }

    final structured = _extractFromStructuredPayload(normalized, _cardKeys);
    addCandidate(structured);

    final uriValue = _extractFromUri(normalized, _cardKeys);
    addCandidate(uriValue);

    final mkMatch = RegExp(r'(MK[\s:_-]*\d{1,10})', caseSensitive: false)
        .firstMatch(normalized);
    if (mkMatch != null) {
      addCandidate(mkMatch.group(1));
    }

    final prefixedMatch = RegExp(
      r'(?:card|kartu|uid|tag|mk)[^A-Za-z0-9]*([A-Za-z0-9:_-]{3,32})',
      caseSensitive: false,
    ).firstMatch(normalized);
    if (prefixedMatch != null) {
      addCandidate(prefixedMatch.group(1));
    }

    if (!_isUriLike(normalized)) {
      addCandidate(normalized);

      final compactTokens = RegExp(r'([A-Za-z0-9:_-]{3,32})')
          .allMatches(normalized)
          .map((Match match) => match.group(1))
          .whereType<String>();
      for (final token in compactTokens) {
        addCandidate(token);
      }

      final digitTokens = RegExp(r'(\d{3,12})')
          .allMatches(normalized)
          .map((Match match) => match.group(1))
          .whereType<String>();
      for (final token in digitTokens) {
        addCandidate(token);
      }
    }

    return candidates;
  }

  static String _digitsOnly(String value) =>
      value.replaceAll(RegExp(r'[^0-9]'), '');

  static bool _isKnownDigitCardToken(String digitsOnly) {
    if (digitsOnly.length >= 3 && digitsOnly.length <= 5) return true;
    if (digitsOnly.length == 6 && digitsOnly.startsWith('1')) return true;
    return false;
  }

  static String _normalizeCardToken(String value) => value
      .trim()
      .toUpperCase()
      .replaceAll(RegExp(r'\s+'), '')
      .replaceAll(RegExp(r'[^A-Z0-9_-]'), '');

  static bool _looksLikeNik(String? value) {
    if (value == null || value.trim().isEmpty) return false;
    final digits = _digitsOnly(value);
    return digits.length >= 8 && digits.length <= 12;
  }

  static bool _looksLikeCard(String? value) {
    if (value == null) return false;
    return _serialPattern.hasMatch(_normalizeCardToken(value));
  }

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

  static List<String> _expandCardCandidates(String? value) {
    if (value == null || value.trim().isEmpty) return <String>[];

    final normalized = _normalizeCardToken(value);
    if (!_looksLikeCard(normalized)) return <String>[];

    final candidates = <String>[];

    void add(String candidate) {
      if (_looksLikeCard(candidate) && !candidates.contains(candidate)) {
        candidates.add(_normalizeCardToken(candidate));
      }
    }

    final mkMatch = RegExp(r'^MK(\d{1,10})$').firstMatch(normalized);
    if (mkMatch != null) {
      final digits = mkMatch.group(1)!;
      add('MK${digits.padLeft(digits.length < 5 ? 5 : digits.length, '0')}');
      add(normalized);
      add(digits);
      if (digits.length <= 5) {
        add('1${digits.padLeft(5, '0')}');
      }
      return candidates;
    }

    final digitsOnly = _digitsOnly(normalized);
    if (digitsOnly == normalized) {
      if (!_isKnownDigitCardToken(digitsOnly)) {
        return <String>[];
      }
      if (digitsOnly.length >= 3 && digitsOnly.length <= 5) {
        add('MK${digitsOnly.padLeft(5, '0')}');
      }
      if (digitsOnly.length == 6 && digitsOnly.startsWith('1')) {
        add('MK${digitsOnly.substring(1).padLeft(5, '0')}');
      }
      add(normalized);
      return candidates;
    }

    add(normalized);
    return candidates;
  }
}
