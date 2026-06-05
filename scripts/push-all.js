#!/usr/bin/env node
/**
 * push-all.js — Push + deploy semua modul DAM ke Google Apps Script
 *
 * Usage:
 *   npm run push           → push code saja (semua modul)
 *   npm run deploy         → push + deploy (update versi aktif, URL tetap)
 *   npm run deploy:force   → push --force + deploy
 *
 * HOME_PORTAL bersifat frozen: selalu push, TIDAK pernah redeploy
 * sehingga URL-nya tidak pernah berubah (dia adalah shell utama).
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const CONFIG  = require('./module-config.json');
const MODULES = CONFIG.modules;

const doDeploy = process.argv.includes('--deploy');
const force    = process.argv.includes('--force');
const pushCmd  = `clasp push${force ? ' --force' : ''}`;

const BASE_URL = 'https://script.google.com/macros/s';

console.log(`\n🚀 DAM ${doDeploy ? 'Deploy' : 'Push'}-All${force ? ' (--force)' : ''}`);
console.log('─'.repeat(48));

let passed = 0, failed = 0;
const results = [];

for (const mod of MODULES) {
  const dir = path.join(ROOT, mod.dir);

  // ── PUSH ────────────────────────────────────────────────
  process.stdout.write(`⏳ ${mod.name.padEnd(24)} push...  `);
  try {
    execSync(pushCmd, { cwd: dir, stdio: 'pipe' });
    process.stdout.write('✅  ');
  } catch (err) {
    process.stdout.write('❌  ');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    console.log('');
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    failed++;
    results.push({ name: mod.name, ok: false, step: 'push' });
    continue;
  }

  // ── DEPLOY (skip jika frozen atau mode push-only) ────────
  if (!doDeploy || mod.frozen) {
    if (mod.frozen) process.stdout.write('🔒 frozen\n');
    else process.stdout.write('\n');
    passed++;
    results.push({
      name: mod.name,
      ok: true,
      deployed: false,
      url: `${BASE_URL}/${mod.deploymentId}/exec`
    });
    continue;
  }

  process.stdout.write('deploy... ');
  try {
    execSync(`clasp deploy -i ${mod.deploymentId}`, { cwd: dir, stdio: 'pipe' });
    console.log('✅');
    passed++;
    results.push({
      name: mod.name,
      ok: true,
      deployed: true,
      url: `${BASE_URL}/${mod.deploymentId}/exec`
    });
  } catch (err) {
    console.log('❌');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    failed++;
    results.push({ name: mod.name, ok: false, step: 'deploy' });
  }
}

console.log('─'.repeat(48));
console.log(`✅ ${passed} sukses  ❌ ${failed} gagal\n`);

if (doDeploy) {
  console.log('🌐 URL Aktif (CONFIG_MODUL):');
  for (const r of results) {
    if (r.ok) {
      const lock = MODULES.find(m => m.name === r.name)?.frozen ? ' 🔒' : '';
      console.log(`   ${r.name.padEnd(24)} ${r.url}${lock}`);
    }
  }
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);
