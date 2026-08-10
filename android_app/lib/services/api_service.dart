import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../config/api_config.dart';

class ApiService {
  static const Duration _requestTimeout = Duration(seconds: 45);
  static const List<int> _retryDelaysMs = <int>[350, 900, 1800];

  /// Sends a POST request to the Google Apps Script doPost endpoint.
  ///
  /// Apps Script `/exec` endpoints accept the initial POST, then redirect to a
  /// `script.googleusercontent.com` URL that must be fetched with GET. Reposting
  /// the JSON body to that redirect target causes HTTP 405.
  static Future<Map<String, dynamic>> post(String action, Map<String, dynamic> payload) async {
    Map<String, dynamic>? lastFailure;

    for (int attempt = 0; attempt < _retryDelaysMs.length; attempt++) {
      try {
        final result =
            await _postInternal(action, payload).timeout(_requestTimeout);
        if (result['ok'] == true) {
          return result;
        }

        lastFailure = result;
        if (!_shouldRetryResult(result) || attempt == _retryDelaysMs.length - 1) {
          return _massageFailure(result);
        }
      } on TimeoutException {
        lastFailure = {
          'ok': false,
          'msg':
              'Koneksi ke server timeout setelah ${_requestTimeout.inSeconds} detik.'
        };
        if (attempt == _retryDelaysMs.length - 1) {
          return _massageFailure(lastFailure);
        }
      } on SocketException catch (e) {
        lastFailure = {
          'ok': false,
          'msg': 'Koneksi jaringan terputus: ${e.message}'
        };
        if (attempt == _retryDelaysMs.length - 1) {
          return _massageFailure(lastFailure);
        }
      } on HandshakeException catch (_) {
        lastFailure = {
          'ok': false,
          'msg': 'Handshake HTTPS gagal. Koneksi internet sedang tidak stabil.'
        };
        if (attempt == _retryDelaysMs.length - 1) {
          return _massageFailure(lastFailure);
        }
      } on HttpException catch (e) {
        lastFailure = {
          'ok': false,
          'msg': 'HTTP Exception: ${e.message}'
        };
        if (attempt == _retryDelaysMs.length - 1) {
          return _massageFailure(lastFailure);
        }
      } catch (e) {
        lastFailure = {
          'ok': false,
          'msg': 'Network Exception: $e'
        };
        if (attempt == _retryDelaysMs.length - 1) {
          return _massageFailure(lastFailure);
        }
      }

      await Future<void>.delayed(Duration(milliseconds: _retryDelaysMs[attempt]));
    }

    return _massageFailure(lastFailure);
  }

  static Future<Map<String, dynamic>> _postInternal(
      String action, Map<String, dynamic> payload) async {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 30);
    client.idleTimeout = const Duration(seconds: 30);

    try {
      // Flatten payload into top-level body (GAS doPost reads from root level)
      final Map<String, dynamic> requestBody = {
        'apiKey': ApiConfig.apiKey,
        'action': action,
        ...payload,  // spread all fields at root level
      };

      final bodyBytes = utf8.encode(jsonEncode(requestBody));

      HttpClientRequest request = await client.postUrl(Uri.parse(ApiConfig.baseUrl));
      request.headers.set('Content-Type', 'application/json');
      request.headers.set('Accept', 'application/json');
      request.headers.set(HttpHeaders.connectionHeader, 'close');
      request.persistentConnection = false;
      request.followRedirects = false;  // We handle redirects manually
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
        request.headers.set(HttpHeaders.connectionHeader, 'close');
        request.persistentConnection = false;

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
    } finally {
      client.close(force: true);
    }
  }

  static bool _shouldRetryResult(Map<String, dynamic> result) {
    final message = (result['msg'] ?? '').toString().toLowerCase();
    return message.contains('timeout') ||
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

  static Map<String, dynamic> _massageFailure(Map<String, dynamic>? result) {
    final message = (result?['msg'] ?? 'Koneksi ke server gagal.')
        .toString()
        .replaceAll('\n', ' ')
        .trim();
    final lower = message.toLowerCase();

    if (lower.contains('software caused connection abort') ||
        lower.contains('connection abort') ||
        lower.contains('connection reset')) {
      return {
        'ok': false,
        'msg':
            'Koneksi ke server terputus di tengah jalan. Coba lagi beberapa detik lagi.'
      };
    }

    if (lower.contains('handshake')) {
      return {
        'ok': false,
        'msg': 'Koneksi HTTPS gagal. Pastikan sinyal internet stabil lalu coba lagi.'
      };
    }

    if (lower.contains('timeout')) {
      return {
        'ok': false,
        'msg': 'Server terlalu lama merespons. Coba ulangi beberapa saat lagi.'
      };
    }

    return {
      'ok': false,
      'msg': message,
    };
  }
}
