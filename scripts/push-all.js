#!/usr/bin/env node
/**
 * push-all.js — Push + deploy semua modul DAM ke Google Apps Script
 *
 * Usage:
 *   npm run push           → push code saja (semua modul)
 *   npm run deploy         → push + undeploy lama + buat deployment baru (URL baru)
 *   npm run deploy:force   → push --force + undeploy lama + buat deployment baru
 *
 * HOME_PORTAL bersifat frozen:
 *   - Selalu push
 *   - TIDAK pernah undeploy/redeploy — URL-nya permanen sebagai shell utama
 *
 * Setiap deploy: undeploy ID lama → create new → update module-config.json otomatis
 */

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT       = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'module-config.json');
const CONFIG     = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const MODULES    = CONFIG.modules;

const doDeploy = process.argv.includes('--deploy');
const force    = process.argv.includes('--force');
const pushCmd  = `clasp push${force ? ' --force' : ''}`;

const BASE_URL = 'https://script.google.com/macros/s';

console.log(`\n🚀 DAM ${doDeploy ? 'Deploy' : 'Push'}-All${force ? ' (--force)' : ''}`);
console.log('─'.repeat(52));

let passed = 0, failed = 0;
const newIds = {};  // track new deployment IDs

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

  // ── DEPLOY (skip frozen atau mode push-only) ─────────────
  if (!doDeploy || mod.frozen) {
    if (mod.frozen) process.stdout.write('🔒 frozen\n');
    else process.stdout.write('\n');
    passed++;
    newIds[mod.name] = mod.deploymentId;
    continue;
  }

  // ── UNDEPLOY LAMA ────────────────────────────────────────
  process.stdout.write('undeploy... ');
  try {
    execSync(`clasp undeploy ${mod.deploymentId}`, { cwd: dir, stdio: 'pipe' });
    process.stdout.write('✅  ');
  } catch (err) {
    // Tidak fatal — mungkin sudah terhapus sebelumnya
    process.stdout.write('⚠️   ');
  }

  // ── CREATE DEPLOYMENT BARU ───────────────────────────────
  process.stdout.write('deploy... ');
  try {
    const out = execSync(`clasp deploy -d "v${Date.now()}"`, { cwd: dir, stdio: 'pipe' }).toString();
    // Parse: "Deployed AKfycb... @N"
    const match = out.match(/Deployed\s+(AKfycb\S+)/);
    if (!match) throw new Error('Tidak bisa parse deployment ID: ' + out);
    const newId = match[1];
    newIds[mod.name] = newId;
    console.log(`✅ ${newId.slice(0, 30)}...`);
    passed++;
  } catch (err) {
    console.log('❌');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    failed++;
    continue;
  }
}

// ── UPDATE module-config.json dengan ID baru ────────────────
if (doDeploy && Object.keys(newIds).length > 0) {
  let changed = false;
  for (const mod of CONFIG.modules) {
    if (newIds[mod.name] && newIds[mod.name] !== mod.deploymentId) {
      mod.deploymentId = newIds[mod.name];
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2) + '\n', 'utf8');
    console.log('\n📝 module-config.json diperbarui dengan deployment ID baru.');
  }
}

console.log('\n' + '─'.repeat(52));
console.log(`✅ ${passed} sukses  ❌ ${failed} gagal\n`);

if (doDeploy) {
  console.log('🌐 URL Aktif (CONFIG_MODUL):');
  for (const mod of CONFIG.modules) {
    const lock = mod.frozen ? ' 🔒' : '';
    console.log(`   ${mod.name.padEnd(24)} ${BASE_URL}/${mod.deploymentId}/exec${lock}`);
  }
  console.log('\n💡 Jalankan setupModuleUrls() di GAS Editor HOME_PORTAL\n   untuk update CONFIG_MODUL di spreadsheet.\n');
}

process.exit(failed > 0 ? 1 : 0);
