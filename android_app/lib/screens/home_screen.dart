import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/session_provider.dart';
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
              Text(
                '${user.nama} (${_resolveRole(role)})',
                style: Theme.of(context).textTheme.bodySmall,
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
