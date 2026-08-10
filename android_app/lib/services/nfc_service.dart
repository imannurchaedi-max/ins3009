import 'package:flutter_nfc_kit/flutter_nfc_kit.dart';

class NfcService {
  /// Starts polling for an NFC tag.
  /// Returns the UID of the tag (which maps to noKartuMK), or null if timeout/error.
  static Future<String?> readNfcTag() async {
    try {
      // Check availability
      var availability = await FlutterNfcKit.nfcAvailability;
      if (availability != NFCAvailability.available) {
        return null;
      }

      // Poll for 10 seconds
      final NFCTag tag = await FlutterNfcKit.poll(
        timeout: const Duration(seconds: 10),
        iosMultipleTagMessage: 'Multiple tags found!',
        iosAlertMessage: 'Scan your card',
      );
      
      final uid = tag.id;
      
      // Stop polling
      await FlutterNfcKit.finish();
      
      return uid;
    } catch (e) {
      await FlutterNfcKit.finish(iosErrorMessage: 'Failed to read tag');
      return null;
    }
  }
}
