import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class AndroidDiagnosticsService {
  static const String _queueKey = 'android_diagnostics_queue_v1';
  static const String _deviceSessionKey =
      'android_diagnostics_device_session_v1';
  static const int _queueLimit = 200;
  static final Random _random = Random();

  static Future<String> getDeviceSessionId() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_deviceSessionKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final generated = _buildId('device');
    await prefs.setString(_deviceSessionKey, generated);
    return generated;
  }

  static Future<void> recordEvent(Map<String, dynamic> event) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = _readQueue(prefs);
    final sanitized = <String, dynamic>{
      ...event,
      'eventId': (event['eventId'] ?? '').toString().trim().isNotEmpty
          ? event['eventId'].toString().trim()
          : _buildId('evt'),
      'eventAt': (event['eventAt'] ?? '').toString().trim().isNotEmpty
          ? event['eventAt'].toString().trim()
          : DateTime.now().toUtc().toIso8601String(),
      'deviceSessionId':
          (event['deviceSessionId'] ?? '').toString().trim().isNotEmpty
              ? event['deviceSessionId'].toString().trim()
              : await getDeviceSessionId(),
    };

    queue.add(sanitized);
    if (queue.length > _queueLimit) {
      queue.removeRange(0, queue.length - _queueLimit);
    }
    await prefs.setString(_queueKey, jsonEncode(queue));
  }

  static Future<List<Map<String, dynamic>>> peekBatch({int limit = 20}) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = _readQueue(prefs);
    return queue
        .take(limit)
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static Future<void> ackBatch(List<String> eventIds) async {
    if (eventIds.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final queue = _readQueue(prefs);
    final eventIdSet = eventIds.toSet();
    final filtered = queue.where((item) {
      final id = (item['eventId'] ?? '').toString();
      return !eventIdSet.contains(id);
    }).toList();
    await prefs.setString(_queueKey, jsonEncode(filtered));
  }

  static List<Map<String, dynamic>> _readQueue(SharedPreferences prefs) {
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return <Map<String, dynamic>>[];

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return <Map<String, dynamic>>[];
      return decoded
          .whereType<Map>()
          .map((item) =>
              item.map((key, value) => MapEntry(key.toString(), value)))
          .toList();
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  static String _buildId(String prefix) {
    final now = DateTime.now().toUtc().microsecondsSinceEpoch;
    final rand = _random.nextInt(1 << 32);
    return '$prefix-$now-$rand';
  }
}
