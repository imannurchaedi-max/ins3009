import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
import '../services/api_service.dart';
import 'gate_screen.dart';
import 'area_screen.dart';
import 'dashboard_screen.dart';
import 'absen_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  bool _gatewayHealthy = false;
  String _gatewayStatus = 'Menyambungkan gateway...';
  Timer? _gatewayWarmupTimer;

  @override
  void initState() {
    super.initState();
    _warmupGateway();
    _gatewayWarmupTimer = Timer.periodic(
      const Duration(seconds: 90),
      (_) => _warmupGateway(silent: true),
    );
  }

  @override
  void dispose() {
    _gatewayWarmupTimer?.cancel();
    super.dispose();
  }

  String _resolveRole(String role) {
    switch (role.toUpperCase().trim()) {
      case 'ADMINISTRATOR':
      case 'PENGAWAS':
      case 'SECURITY':
      case 'KARYAWAN':
        return role.toUpperCase().trim();
      default:
        return 'KARYAWAN';
    }
  }

  List<_NavTab> _getTabs(String role) {
    final roleKey = _resolveRole(role);
    final tabs = <_NavTab>[];

    if (roleKey != 'PENGAWAS') {
      tabs.add(const _NavTab(
        page: GateScreen(),
        item: BottomNavigationBarItem(
          icon: Icon(Icons.sensor_door),
          label: 'Gate',
        ),
      ));
    }

    if (roleKey != 'KARYAWAN') {
      tabs.add(const _NavTab(
        page: AreaScreen(),
        item: BottomNavigationBarItem(
          icon: Icon(Icons.qr_code_scanner),
          label: 'Area',
        ),
      ));
    }

    if (roleKey == 'ADMINISTRATOR' || roleKey == 'PENGAWAS') {
      tabs.add(const _NavTab(
        page: DashboardScreen(),
        item: BottomNavigationBarItem(
          icon: Icon(Icons.dashboard),
          label: 'Dashboard',
        ),
      ));
    }

    tabs.add(const _NavTab(
      page: AbsenScreen(),
      item: BottomNavigationBarItem(
        icon: Icon(Icons.calendar_month),
        label: 'Absen',
      ),
    ));

    return tabs;
  }

  void _handleLogout() async {
    final sessionProvider =
        Provider.of<SessionProvider>(context, listen: false);
    await sessionProvider.logout();
  }

  Future<void> _warmupGateway({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _gatewayStatus = 'Menyambungkan gateway...';
      });
    }

    final result = await ApiService.prewarmGateway();
    if (!mounted) return;

    setState(() {
      _gatewayHealthy = result['ok'] == true;
      _gatewayStatus = result['ok'] == true
          ? 'Gateway online'
          : (result['msg']?.toString() ?? 'Gateway belum tersambung');
    });
  }

  @override
  Widget build(BuildContext context) {
    final sessionProvider = Provider.of<SessionProvider>(context);
    final user = sessionProvider.session;
    final role = user?.role ?? '';
    final tabs = _getTabs(role);
    final safeIndex = _currentIndex >= tabs.length ? 0 : _currentIndex;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('DAM Access Control'),
            if (user != null)
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${user.nama} (${_resolveRole(role)})',
                      style: Theme.of(context).textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.circle,
                    size: 10,
                    color: _gatewayHealthy ? Colors.green : Colors.orange,
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      _gatewayStatus,
                      style: Theme.of(context).textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
            tooltip: 'Logout',
          )
        ],
      ),
      body: IndexedStack(
        index: safeIndex,
        children: tabs.map((tab) => tab.page).toList(),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: safeIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF1F5F97),
        items: tabs.map((tab) => tab.item).toList(),
      ),
    );
  }
}

class _NavTab {
  final Widget page;
  final BottomNavigationBarItem item;

  const _NavTab({
    required this.page,
    required this.item,
  });
}
