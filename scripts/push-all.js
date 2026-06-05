#!/usr/bin/env node
/**
 * push-all.js — Push semua modul DAM ke Google Apps Script via clasp
 * Usage: node scripts/push-all.js [--force]
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MODULES = [
  { name: 'HOME_PORTAL',       dir: path.join(ROOT, 'active', 'HOME_PORTAL') },
  { name: 'MODUL_GATE_PABRIK', dir: path.join(ROOT, 'active', 'MODUL_GATE_PABRIK') },
  { name: 'MODUL_AREA_KERJA',  dir: path.join(ROOT, 'active', 'MODUL_AREA_KERJA') },
  { name: 'MODUL_REPORT',      dir: path.join(ROOT, 'active', 'MODUL_REPORT') },
];

const force = process.argv.includes('--force');
const claspCmd = `clasp push${force ? ' --force' : ''}`;

console.log(`\n🚀 DAM Push-All${force ? ' (--force)' : ''}\n${'─'.repeat(40)}`);

let passed = 0;
let failed = 0;

for (const mod of MODULES) {
  process.stdout.write(`⏳ ${mod.name.padEnd(22)}`);
  try {
    execSync(claspCmd, { cwd: mod.dir, stdio: 'pipe' });
    console.log('✅ OK');
    passed++;
  } catch (err) {
    console.log('❌ FAILED');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    if (msg) console.error(`   ${msg.split('\n').join('\n   ')}`);
    failed++;
  }
}

console.log(`${'─'.repeat(40)}`);
console.log(`✅ ${passed} sukses  ❌ ${failed} gagal\n`);
process.exit(failed > 0 ? 1 : 0);
