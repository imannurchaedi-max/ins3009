#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'module-config.json');
const BASE_URL = 'https://script.google.com/macros/s';
const PRIMARY_MODULE = 'HOME_PORTAL';

const KEY_MAP = {
  HOME_PORTAL: 'HOME_PORTAL',
  MODUL_GATE_PABRIK: 'GATE_PABRIK',
  MODUL_AREA_KERJA: 'AREA_KERJA',
  MODUL_REPORT: 'REPORT',
};

const REQUIRED_MODULES = ['HOME_PORTAL', 'MODUL_GATE_PABRIK', 'MODUL_AREA_KERJA', 'MODUL_REPORT'];

function moduleUrl(moduleConfig) {
  return `${BASE_URL}/${moduleConfig.deploymentId}/exec`;
}

console.log('\nDAM URL Verify');
console.log('='.repeat(68));

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.error(`ERROR: gagal baca module-config.json: ${err.message}`);
  process.exit(1);
}

let hasError = false;

for (const required of REQUIRED_MODULES) {
  const mod = (config.modules || []).find((item) => item.name === required);
  if (!mod) {
    console.error(`ERROR: ${required} tidak ditemukan di module-config.json`);
    hasError = true;
    continue;
  }
  if (!mod.deploymentId || !String(mod.deploymentId).trim()) {
    console.error(`ERROR: ${required} tidak punya deploymentId`);
    hasError = true;
  }
  if (!mod.dir || !String(mod.dir).trim()) {
    console.error(`ERROR: ${required} tidak punya dir`);
    hasError = true;
  }
}

if (hasError) {
  console.log('='.repeat(68));
  console.error('ERROR: module-config.json tidak valid. Perbaiki lalu jalankan lagi.\n');
  process.exit(1);
}

console.log('URL aktif yang akan dipakai CONFIG_MODUL:\n');
const orderedUrls = {};
for (const name of REQUIRED_MODULES) {
  const mod = config.modules.find((item) => item.name === name);
  const key = KEY_MAP[name];
  orderedUrls[key] = moduleUrl(mod);
  const marker = name === PRIMARY_MODULE ? '* ' : '  ';
  console.log(`  ${key.padEnd(16)} ${marker}${orderedUrls[key]}`);
}

console.log('\nValidasi runtime utama:');
const homeConfig = config.modules.find((item) => item.name === PRIMARY_MODULE);
if (!homeConfig || !homeConfig.deploymentId) {
  console.error('ERROR: HOME_PORTAL belum punya deploymentId aktif.');
  hasError = true;
} else {
  console.log(`  OK HOME_PORTAL aktif di ${moduleUrl(homeConfig)}`);
}

console.log('\nCek .clasp.json:');
for (const mod of config.modules || []) {
  const claspPath = path.join(ROOT, mod.dir, '.clasp.json');
  try {
    const clasp = JSON.parse(fs.readFileSync(claspPath, 'utf8'));
    if (clasp.deploymentId) {
      console.error(`  ERROR ${mod.name} punya deploymentId hardcoded di .clasp.json`);
      hasError = true;
      continue;
    }
    console.log(`  OK   ${mod.name.padEnd(24)} binding tersedia`);
  } catch (_) {
    if (mod.name === PRIMARY_MODULE) {
      console.error(`  ERROR ${mod.name.padEnd(24)} binding clasp tidak ditemukan`);
      hasError = true;
    } else {
      console.log(`  WARN ${mod.name.padEnd(24)} binding clasp tidak ditemukan, deploy akan memakai URL compatibility yang sudah tersimpan`);
    }
  }
}

console.log('\n' + '='.repeat(68));
if (hasError) {
  console.log('ERROR: ada masalah konfigurasi. Periksa output di atas.\n');
  process.exit(1);
}

console.log('OK: konfigurasi runtime valid.\n');
console.log('Link utama yang dibagikan ke user:');
console.log(`${orderedUrls.HOME_PORTAL}\n`);
