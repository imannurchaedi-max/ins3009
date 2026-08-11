import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _nikController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMsg;

  Future<void> _handleLogin() async {
    final nik = _nikController.text.trim();
    final password =
        _passwordController.text; // Boleh kosong (MK tidak punya password)

    if (nik.isEmpty) {
      setState(() => _errorMsg = 'NIK harus diisi');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });

    final sessionProvider =
        Provider.of<SessionProvider>(context, listen: false);
    final result = await sessionProvider.login(nik, password);

    if (!mounted) return;

    setState(() => _isLoading = false);

    if (result['ok'] == true) {
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (route) => false);
    } else {
      setState(() {
        _errorMsg = result['msg'] ?? 'Gagal login';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.security,
                  size: 80,
                  color: Color(0xFF1F5F97),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Portal DAM',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1F5F97),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Access Control System',
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
                const SizedBox(height: 48),
                TextField(
                  controller: _nikController,
                  decoration: const InputDecoration(
                    labelText: 'NIK',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person),
                  ),
                  keyboardType: TextInputType.number,
                  onSubmitted: (_) => _handleLogin(),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'Password (kosongkan jika tidak ada)',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                      ),
                      tooltip: _obscurePassword
                          ? 'Tampilkan password'
                          : 'Sembunyikan password',
                    ),
                  ),
                  obscureText: _obscurePassword,
                  onSubmitted: (_) => _handleLogin(),
                ),
                const SizedBox(height: 8),
                if (_errorMsg != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      _errorMsg!,
                      style: const TextStyle(
                          color: Colors.red, fontWeight: FontWeight.bold),
                    ),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1F5F97),
                      foregroundColor: Colors.white,
                    ),
                    child: _isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Login', style: TextStyle(fontSize: 16)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
