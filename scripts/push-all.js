#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'module-config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const MODULES = CONFIG.modules;
const PRIMARY_MODULE = 'HOME_PORTAL';

const doDeploy = process.argv.includes('--deploy');
const force = process.argv.includes('--force');
const pushCmd = `clasp push${force ? ' --force' : ''}`;
const BASE_URL = 'https://script.google.com/macros/s';

function moduleUrl(moduleConfig) {
  return `${BASE_URL}/${moduleConfig.deploymentId}/exec`;
}

function hasClaspBinding(moduleConfig) {
  return fs.existsSync(path.join(ROOT, moduleConfig.dir, '.clasp.json'));
}

// ── Pre-deploy guard ──────────────────────────────────────────────────────────
// Pastikan semua modul punya deploymentId yang valid sebelum deploy dimulai.
// Ini mencegah deploy tanpa -i yang akan membuat URL baru.
if (doDeploy) {
  const missing = MODULES.filter((m) => !m.deploymentId || m.deploymentId.trim() === '');
  if (missing.length > 0) {
    console.error('\n❌ DEPLOY DIBATALKAN: module-config.json ada modul tanpa deploymentId:');
    missing.forEach((m) => console.error(`   - ${m.name}`));
    console.error('Isi deploymentId yang benar di scripts/module-config.json lalu coba lagi.\n');
    process.exit(1);
  }
}

console.log(`\nDAM ${doDeploy ? 'Deploy' : 'Push'}-All${force ? ' (--force)' : ''}`);
console.log('-'.repeat(52));

let passed = 0;
let failed = 0;
let skipped = 0;

for (const mod of MODULES) {
  const dir = path.join(ROOT, mod.dir);
  const isPrimary = mod.name === PRIMARY_MODULE;
  if (!hasClaspBinding(mod)) {
    process.stdout.write(`... ${mod.name.padEnd(24)} skip...   `);
    console.log(isPrimary ? 'FAIL' : 'WARN');
    console.log(
      isPrimary
        ? '   .clasp.json tidak ditemukan pada runtime utama. Deploy tidak bisa dilanjutkan.\n'
        : '   Modul compatibility tidak punya binding clasp lokal. URL lama dipertahankan dari module-config.json.\n'
    );
    if (isPrimary) failed++;
    else skipped++;
    continue;
  }

  process.stdout.write(`... ${mod.name.padEnd(24)} push...   `);
  try {
    execSync(pushCmd, { cwd: dir, stdio: 'pipe' });
    process.stdout.write('OK  ');
  } catch (err) {
    const status = isPrimary ? 'FAIL' : 'WARN';
    process.stdout.write(`${status}\n`);
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    if (isPrimary) failed++;
    else skipped++;
    continue;
  }

  if (!doDeploy) {
    process.stdout.write('\n');
    passed++;
    continue;
  }

  process.stdout.write('deploy...  ');
  try {
    execSync(`clasp deploy -i ${mod.deploymentId}`, { cwd: dir, stdio: 'pipe' });
    console.log('OK');
    passed++;
  } catch (err) {
    const status = isPrimary ? 'FAIL' : 'WARN';
    console.log(status);
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    if (isPrimary) failed++;
    else skipped++;
  }
}

console.log('-'.repeat(52));
console.log(`OK ${passed} sukses  WARN ${skipped} dilewati  FAIL ${failed} kritis\n`);

if (doDeploy) {
  console.log('URL Aktif:');
  for (const mod of MODULES) {
    console.log(`   ${mod.name.padEnd(24)} ${moduleUrl(mod)}`);
  }

  const home = MODULES.find((m) => m.name === 'HOME_PORTAL');
  const gate = MODULES.find((m) => m.name === 'MODUL_GATE_PABRIK');
  const area = MODULES.find((m) => m.name === 'MODUL_AREA_KERJA');
  const report = MODULES.find((m) => m.name === 'MODUL_REPORT');

  if (home && gate && area && report) {
    console.log('\nUpdate CONFIG_MODUL di spreadsheet...');
    try {
      const out = execSync(
        `python scripts/update_config_sheet.py` +
          ` --home-url "${moduleUrl(home)}"` +
          ` --gate-url "${moduleUrl(gate)}"` +
          ` --area-url "${moduleUrl(area)}"` +
          ` --report-url "${moduleUrl(report)}"`,
        { cwd: ROOT, stdio: 'pipe' }
      ).toString().trim();

      try {
        const match = out.match(/"inject_url":\s*"[^"]+\/([^/]+)\/exec"/);
        if (match) {
          execSync(`clasp undeploy ${match[1]}`, {
            cwd: path.join(ROOT, 'active', 'MODUL_GATE_PABRIK'),
            stdio: 'pipe',
          });
        }
      } catch (_) {}

      if (out.includes('CONFIG_MODUL updated')) {
        console.log('   OK CONFIG_MODUL berhasil diupdate.\n');
      } else {
        console.log('   WARN ' + out.split('\n')[0] + '\n');
      }
    } catch (err) {
      const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
      console.log('   FAIL Gagal update CONFIG_MODUL: ' + msg.split('\n')[0] + '\n');
    }
  }
}

// ── Post-deploy URL verification ─────────────────────────────────────────────
if (doDeploy && failed === 0) {
  console.log('Verifikasi CONFIG_MODUL...');
  try {
    execSync('node scripts/verify-config.js', { cwd: ROOT, stdio: 'inherit' });
  } catch (_) {
    console.log('   WARN Verifikasi gagal — cek manual: npm run verify\n');
  }
}

process.exit(failed > 0 ? 1 : 0);
