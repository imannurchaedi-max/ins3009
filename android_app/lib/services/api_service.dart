import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../config/api_config.dart';
import 'android_diagnostics_service.dart';

class ApiService {
  static const Duration _requestTimeout = Duration(seconds: 25);
  static const List<int> _retryDelaysMs = <int>[350, 900, 1800];
  static const int _diagnosticBatchLimit = 20;
  static const Set<String> _nonIdempotentActions = <String>{
    'bindKartu',
    'releaseKartu',
    'scanAreaKerja',
    'saveJadwalShift',
    'deleteJadwalShift',
    'bulkSaveJadwalShift',
  };
  static const Set<String> _telemetryInternalActions = <String>{
    'logAndroidDiagnostics',
  };
  static final Uri _baseUri = Uri.parse(ApiConfig.baseUrl);
  static HttpClient? _sharedClient;
  static bool _diagnosticsFlushInFlight = false;

  /// Sends a POST request to the Google Apps Script doPost endpoint.
  ///
  /// Apps Script `/exec` endpoints accept the initial POST, then redirect to a
  /// `script.googleusercontent.com` URL that must be fetched with GET. Reposting
  /// the JSON body to that redirect target causes HTTP 405.
  static Future<Map<String, dynamic>> post(
    String action,
    Map<String, dynamic> payload, {
    bool trackDiagnostics = true,
    bool allowFlush = true,
    Duration? customTimeout,
  }) async {
    Map<String, dynamic>? lastFailure;
    final allowAutomaticRetry = !_nonIdempotentActions.contains(action);
    final startedAt = DateTime.now();
    final effectiveTimeout = customTimeout ?? _requestTimeout;

    for (int attempt = 0; attempt < _retryDelaysMs.length; attempt++) {
      try {
        final result =
            await _postInternal(action, payload).timeout(effectiveTimeout);
        if (result['ok'] == true) {
          _afterRequest(
            action: action,
            payload: payload,
            result: result,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return result;
        }

        lastFailure = result;
        if (!allowAutomaticRetry ||
            !_shouldRetryResult(result) ||
            attempt == _retryDelaysMs.length - 1) {
          final failure = _massageFailure(result);
          _afterRequest(
            action: action,
            payload: payload,
            result: failure,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return failure;
        }
      } on TimeoutException {
        lastFailure = {
          'ok': false,
          'msg':
              'Koneksi ke server timeout setelah ${_requestTimeout.inSeconds} detik.',
          'failureKind': 'timeout',
        };
        if (!allowAutomaticRetry || attempt == _retryDelaysMs.length - 1) {
          final failure = _massageFailure(lastFailure);
          _afterRequest(
            action: action,
            payload: payload,
            result: failure,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return failure;
        }
      } on SocketException catch (e) {
        lastFailure = {
          'ok': false,
          'msg': 'Koneksi jaringan terputus: ${e.message}',
          'failureKind': _detectSocketFailureKind(e.message),
        };
        if (!allowAutomaticRetry || attempt == _retryDelaysMs.length - 1) {
          final failure = _massageFailure(lastFailure);
          _afterRequest(
            action: action,
            payload: payload,
            result: failure,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return failure;
        }
      } on HandshakeException catch (_) {
        lastFailure = {
          'ok': false,
          'msg': 'Handshake HTTPS gagal. Koneksi internet sedang tidak stabil.',
          'failureKind': 'handshake',
        };
        if (!allowAutomaticRetry || attempt == _retryDelaysMs.length - 1) {
          final failure = _massageFailure(lastFailure);
          _afterRequest(
            action: action,
            payload: payload,
            result: failure,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return failure;
        }
      } on HttpException catch (e) {
        lastFailure = {
          'ok': false,
          'msg': 'HTTP Exception: ${e.message}',
          'failureKind': 'http',
        };
        if (!allowAutomaticRetry || attempt == _retryDelaysMs.length - 1) {
          final failure = _massageFailure(lastFailure);
          _afterRequest(
            action: action,
            payload: payload,
            result: failure,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return failure;
        }
      } catch (e) {
        lastFailure = {
          'ok': false,
          'msg': 'Network Exception: $e',
          'failureKind': 'network',
        };
        if (!allowAutomaticRetry || attempt == _retryDelaysMs.length - 1) {
          final failure = _massageFailure(lastFailure);
          _afterRequest(
            action: action,
            payload: payload,
            result: failure,
            startedAt: startedAt,
            trackDiagnostics: trackDiagnostics,
            allowFlush: allowFlush,
          );
          return failure;
        }
      }

      await Future<void>.delayed(
          Duration(milliseconds: _retryDelaysMs[attempt]));
    }

    final failure = _massageFailure(lastFailure);
    _afterRequest(
      action: action,
      payload: payload,
      result: failure,
      startedAt: startedAt,
      trackDiagnostics: trackDiagnostics,
      allowFlush: allowFlush,
    );
    return failure;
  }

  static Future<Map<String, dynamic>> _postInternal(
      String action, Map<String, dynamic> payload) async {
    final client = _getClient();

    try {
      // Flatten payload into top-level body (GAS doPost reads from root level)
      final Map<String, dynamic> requestBody = {
        'apiKey': ApiConfig.apiKey,
        'action': action,
        ...payload, // spread all fields at root level
      };

      final bodyBytes = utf8.encode(jsonEncode(requestBody));

      HttpClientRequest request = await client.postUrl(_baseUri);
      request.headers.set('Content-Type', 'application/json');
      request.headers.set('Accept', 'application/json');
      request.followRedirects = false; // We handle redirects manually
      request.add(bodyBytes);

      HttpClientResponse response = await request.close();

      // Follow redirects manually using HTTP semantics:
      // 301/302/303 => switch to GET
      // 307/308 => preserve POST + body
      int redirectCount = 0;
      while ((response.statusCode == 301 ||
              response.statusCode == 302 ||
              response.statusCode == 303 ||
              response.statusCode == 307 ||
              response.statusCode == 308) &&
          redirectCount < 5) {
        final location = response.headers.value('location');
        if (location == null) break;

        await response.drain();

        final redirectUri = Uri.parse(location);
        final shouldRepeatPost =
            response.statusCode == 307 || response.statusCode == 308;

        request = shouldRepeatPost
            ? await client.postUrl(redirectUri)
            : await client.getUrl(redirectUri);
        request.followRedirects = false;
        request.headers.set('Accept', 'application/json');

        if (shouldRepeatPost) {
          request.headers.set('Content-Type', 'application/json');
          request.add(bodyBytes);
        }

        response = await request.close();
        redirectCount++;
      }

      // Read response body
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200) {
        final responseData = jsonDecode(responseBody);
        return responseData as Map<String, dynamic>;
      } else {
        return {
          'ok': false,
          'msg': 'HTTP Error: ${response.statusCode} — body: $responseBody'
        };
      }
    } on SocketException {
      _resetClient();
      rethrow;
    } on HandshakeException {
      _resetClient();
      rethrow;
    } on HttpException {
      _resetClient();
      rethrow;
    }
  }

  static HttpClient _getClient() {
    final existing = _sharedClient;
    if (existing != null) return existing;

    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 30);
    client.idleTimeout = const Duration(seconds: 45);
    client.maxConnectionsPerHost = 6;
    client.userAgent = 'DAM-Access-Control-Android/1.0';
    _sharedClient = client;
    return client;
  }

  static void _resetClient() {
    final client = _sharedClient;
    _sharedClient = null;
    client?.close(force: true);
  }

  static bool _shouldRetryResult(Map<String, dynamic> result) {
    final message = (result['msg'] ?? '').toString().toLowerCase();
    return message.contains('timeout') ||
        message.contains('failed host lookup') ||
        message.contains('software caused connection abort') ||
        message.contains('connection abort') ||
        message.contains('connection reset') ||
        message.contains('connection closed') ||
        message.contains('handshake') ||
        message.contains('socketexception') ||
        message.contains('http error: 429') ||
        message.contains('http error: 500') ||
        message.contains('http error: 502') ||
        message.contains('http error: 503') ||
        message.contains('http error: 504');
  }

  static String _detectSocketFailureKind(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('failed host lookup')) return 'dns';
    if (lower.contains('connection reset') ||
        lower.contains('connection abort') ||
        lower.contains('connection closed')) {
      return 'connection';
    }
    return 'network';
  }

  static Map<String, dynamic> _massageFailure(Map<String, dynamic>? result) {
    final message = (result?['msg'] ?? 'Koneksi ke server gagal.')
        .toString()
        .replaceAll('\n', ' ')
        .trim();
    final lower = message.toLowerCase();

    if (lower.contains('failed host lookup')) {
      return {
        'ok': false,
        'failureKind': 'dns',
        'msg':
            'DNS jaringan gagal menjangkau server Google Apps Script. Coba pindah sinyal atau ulangi beberapa detik lagi.',
      };
    }

    if (lower.contains('software caused connection abort') ||
        lower.contains('connection abort') ||
        lower.contains('connection reset')) {
      return {
        'ok': false,
        'failureKind': 'connection',
        'msg':
            'Koneksi ke server terputus di tengah jalan. Coba lagi beberapa detik lagi.'
      };
    }

    if (lower.contains('handshake')) {
      return {
        'ok': false,
        'failureKind': 'handshake',
        'msg':
            'Koneksi HTTPS gagal. Pastikan sinyal internet stabil lalu coba lagi.'
      };
    }

    if (lower.contains('timeout')) {
      return {
        'ok': false,
        'failureKind': 'timeout',
        'msg': 'Server terlalu lama merespons. Coba ulangi beberapa saat lagi.'
      };
    }

    if (lower.contains('http error: 404') && lower.contains('<!doctype html')) {
      return {
        'ok': false,
        'failureKind': 'http',
        'msg':
            'Server Google Apps Script mengembalikan halaman error sementara. Coba ulangi beberapa detik lagi.',
      };
    }

    return {
      'ok': false,
      'failureKind': result?['failureKind'] ?? 'unknown',
      'msg': message,
    };
  }

  static bool isConnectivityFailureResult(Map<String, dynamic>? result) {
    if (result == null) return false;
    final kind = (result['failureKind'] ?? '').toString().toLowerCase();
    if (kind == 'dns' ||
        kind == 'network' ||
        kind == 'connection' ||
        kind == 'timeout' ||
        kind == 'handshake') {
      return true;
    }

    final message = (result['msg'] ?? '').toString().toLowerCase();
    return message.contains('timeout') ||
        message.contains('failed host lookup') ||
        message.contains('handshake') ||
        message.contains('koneksi jaringan terputus') ||
        message.contains('koneksi ke server terputus') ||
        message.contains('server terlalu lama merespons') ||
        message.contains('http exception');
  }

  static Future<Map<String, dynamic>> prewarmGateway() {
    return post(
      'pingAndroidGateway',
      <String, dynamic>{
        'clientRequestId':
            'warmup-${DateTime.now().toUtc().microsecondsSinceEpoch}',
      },
    );
  }

  static void _afterRequest({
    required String action,
    required Map<String, dynamic> payload,
    required Map<String, dynamic> result,
    required DateTime startedAt,
    required bool trackDiagnostics,
    required bool allowFlush,
  }) {
    final latencyMs = DateTime.now().difference(startedAt).inMilliseconds;

    if (trackDiagnostics && !_telemetryInternalActions.contains(action)) {
      unawaited(_recordDiagnostics(
        action: action,
        payload: payload,
        result: result,
        latencyMs: latencyMs,
      ));
    }

    if (allowFlush &&
        !_telemetryInternalActions.contains(action) &&
        result['ok'] == true) {
      unawaited(_flushQueuedDiagnostics());
    }
  }

  static Future<void> _recordDiagnostics({
    required String action,
    required Map<String, dynamic> payload,
    required Map<String, dynamic> result,
    required int latencyMs,
  }) async {
    final requestId = (payload['requestId'] ?? '').toString().trim();
    final payloadSummary = _buildPayloadSummary(action, payload);
    final failureKind = (result['failureKind'] ?? '').toString().trim();
    final httpStatus = _extractHttpStatus(result['msg']?.toString() ?? '');
    final outcome = result['ok'] == true
        ? 'success'
        : isConnectivityFailureResult(result)
            ? 'connectivity_failure'
            : 'failure';

    await AndroidDiagnosticsService.recordEvent(<String, dynamic>{
      'source': 'android_api',
      'action': action,
      'phase': result['ok'] == true ? 'response' : 'error',
      'outcome': outcome,
      'failureKind': failureKind,
      'requestId': requestId,
      'httpStatus': httpStatus,
      'latencyMs': latencyMs,
      'message': (result['msg'] ?? '').toString(),
      'nik': (payload['nik'] ?? '').toString(),
      'role': (payload['role'] ?? '').toString(),
      'payloadSummary': payloadSummary,
    });
  }

  static Map<String, dynamic> _buildPayloadSummary(
    String action,
    Map<String, dynamic> payload,
  ) {
    return <String, dynamic>{
      'action': action,
      if (payload.containsKey('requestId')) 'requestId': payload['requestId'],
      if (payload.containsKey('nik')) 'nik': payload['nik'],
      if (payload.containsKey('noKartuMK')) 'noKartuMK': payload['noKartuMK'],
      if (payload.containsKey('tujuan')) 'tujuan': payload['tujuan'],
      if (payload.containsKey('forceMode')) 'forceMode': payload['forceMode'],
      if (payload.containsKey('periodType'))
        'periodType': payload['periodType'],
      if (payload.containsKey('periodValue'))
        'periodValue': payload['periodValue'],
    };
  }

  static String _extractHttpStatus(String message) {
    final match = RegExp(r'http error:\s*(\d+)', caseSensitive: false)
        .firstMatch(message);
    return match == null ? '' : (match.group(1) ?? '');
  }

  static Future<void> _flushQueuedDiagnostics() async {
    if (_diagnosticsFlushInFlight) return;
    _diagnosticsFlushInFlight = true;

    try {
      final batch = await AndroidDiagnosticsService.peekBatch(
        limit: _diagnosticBatchLimit,
      );
      if (batch.isEmpty) return;

      final result = await post(
        'logAndroidDiagnostics',
        <String, dynamic>{'events': batch},
        trackDiagnostics: false,
        allowFlush: false,
      );
      if (result['ok'] == true) {
        final ids = batch
            .map((item) => (item['eventId'] ?? '').toString())
            .where((id) => id.isNotEmpty)
            .toList();
        await AndroidDiagnosticsService.ackBatch(ids);
      }
    } finally {
      _diagnosticsFlushInFlight = false;
    }
  }
}
