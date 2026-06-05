#!/usr/bin/env node
/**
 * push-all.js — Push + deploy semua modul DAM ke Google Apps Script
 *
 * Usage:
 *   npm run push           → push code saja (semua modul)
 *   npm run deploy         → push + update deployment in-place (URL TETAP)
 *   npm run deploy:force   → push --force + update deployment in-place
 *
 * Semua modul pakai strategi yang sama:
 *   clasp push → clasp deploy -i <deploymentId>
 *
 * URL tidak pernah berubah karena kita UPDATE deployment yang sudah ada,
 * bukan buat baru. HOME_PORTAL aman, child modules juga aman.
 * CONFIG_MODUL hanya perlu diupdate kalau deploymentId benar-benar diganti.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT        = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'module-config.json');
const CONFIG      = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const MODULES     = CONFIG.modules;

const doDeploy = process.argv.includes('--deploy');
const force    = process.argv.includes('--force');
const pushCmd  = `clasp push${force ? ' --force' : ''}`;
const BASE_URL = 'https://script.google.com/macros/s';

console.log(`\n🚀 DAM ${doDeploy ? 'Deploy' : 'Push'}-All${force ? ' (--force)' : ''}`);
console.log('─'.repeat(52));

let passed = 0, failed = 0;

for (const mod of MODULES) {
  const dir = path.join(ROOT, mod.dir);

  // ── PUSH ────────────────────────────────────────────────
  process.stdout.write(`⏳ ${mod.name.padEnd(24)} push...   `);
  try {
    execSync(pushCmd, { cwd: dir, stdio: 'pipe' });
    process.stdout.write('✅  ');
  } catch (err) {
    process.stdout.write('❌\n');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    failed++;
    continue;
  }

  if (!doDeploy) { process.stdout.write('\n'); passed++; continue; }

  // ── DEPLOY IN-PLACE (URL tetap) ──────────────────────────
  process.stdout.write('deploy...  ');
  try {
    execSync(`clasp deploy -i ${mod.deploymentId}`, { cwd: dir, stdio: 'pipe' });
    console.log('✅');
    passed++;
  } catch (err) {
    console.log('❌');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    failed++;
  }
}

console.log('─'.repeat(52));
console.log(`✅ ${passed} sukses  ❌ ${failed} gagal\n`);

if (doDeploy) {
  console.log('🌐 URL Aktif:');
  for (const mod of MODULES) {
    console.log(`   ${mod.name.padEnd(24)} ${BASE_URL}/${mod.deploymentId}/exec`);
  }

  // ── AUTO-UPDATE CONFIG_MODUL di Google Sheet ─────────────
  const gate   = MODULES.find(m => m.name === 'MODUL_GATE_PABRIK');
  const area   = MODULES.find(m => m.name === 'MODUL_AREA_KERJA');
  const report = MODULES.find(m => m.name === 'MODUL_REPORT');

  if (gate && area && report) {
    console.log('\n📋 Update CONFIG_MODUL di spreadsheet...');
    try {
      const out = execSync(
        `python scripts/update_config_sheet.py` +
        ` --gate-url "${BASE_URL}/${gate.deploymentId}/exec"` +
        ` --area-url "${BASE_URL}/${area.deploymentId}/exec"` +
        ` --report-url "${BASE_URL}/${report.deploymentId}/exec"`,
        { cwd: ROOT, stdio: 'pipe' }
      ).toString().trim();

      // Bersihkan temp deployment kalau fallback dipakai
      try {
        const match = out.match(/"inject_url":\s*"[^"]+\/([^/]+)\/exec"/);
        if (match) {
          execSync(`clasp undeploy ${match[1]}`,
            { cwd: path.join(ROOT, 'active', 'MODUL_GATE_PABRIK'), stdio: 'pipe' });
        }
      } catch (_) {}

      if (out.includes('OK_CONFIG_MODUL_UPDATED') || out.includes('CONFIG_MODUL updated')) {
        console.log('   ✅ CONFIG_MODUL berhasil diupdate.\n');
      } else {
        console.log('   ⚠️  ' + out.split('\n')[0] + '\n');
      }
    } catch (err) {
      const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
      console.log('   ❌ Gagal update CONFIG_MODUL: ' + msg.split('\n')[0] + '\n');
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
