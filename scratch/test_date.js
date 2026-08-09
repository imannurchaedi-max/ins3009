/**
 * TEST: Verifikasi parseAnyDate() menangani semua format input
 * Jalankan di Node.js: node scratch/test_date.js
 */

// Simulasi fungsi GAS
function createStrictDateTime_(year, monthIndex, day, hour, minute, second) {
  const d = new Date(year, monthIndex, day, hour || 0, minute || 0, second || 0);
  if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) return null;
  return d;
}

function parseAnyDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return null;

  // ISO: yyyy-MM-dd
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return createStrictDateTime_(+m[1], +m[2]-1, +m[3], +m[4]||0, +m[5]||0, +m[6]||0);

  // Localized: d1/d2/yyyy
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const a = +m[1], b = +m[2], yyyy = +m[3], hh = +m[4]||0, mm = +m[5]||0, ss = +m[6]||0;
    if (a > 12) return createStrictDateTime_(yyyy, b-1, a, hh, mm, ss); // DD/MM/YYYY
    if (b > 12) return createStrictDateTime_(yyyy, a-1, b, hh, mm, ss); // MM/DD/YYYY
    return createStrictDateTime_(yyyy, b-1, a, hh, mm, ss); // Ambiguous → DD/MM (Indonesia)
  }

  // Dash: d1-d2-yyyy
  m = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) {
    const a = +m[1], b = +m[2], yyyy = +m[3];
    if (a > 12) return createStrictDateTime_(yyyy, b-1, a, 0, 0, 0);
    if (b > 12) return createStrictDateTime_(yyyy, a-1, b, 0, 0, 0);
    return createStrictDateTime_(yyyy, b-1, a, 0, 0, 0);
  }
  return null;
}

function toISO(d) {
  if (!d) return 'null';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// ─── TEST CASES ───────────────────────────────────────────────
const tests = [
  // [input, expectedISO, description]
  ['2026-08-07',       '2026-08-07', 'ISO: August 7'],
  ['2026-08-07T09:30', '2026-08-07', 'ISO datetime: August 7'],
  ['07/08/2026',       '2026-08-07', 'DD/MM → August 7 ✅ (bukan July 8)'],
  ['08/07/2026',       '2026-07-08', 'MM/DD ambiguous → default DD/MM → July 8'],
  ['15/08/2026',       '2026-08-15', 'First >12 → PASTI DD/MM → Aug 15 ✅'],
  ['08/15/2026',       '2026-08-15', 'Second >12 → PASTI MM/DD → Aug 15 ✅'],
  ['01/02/2026',       '2026-02-01', 'Ambiguous both ≤12 → default DD/MM → Feb 1'],
  ['07-08-2026',       '2026-08-07', 'Dash DD-MM → August 7'],
  [new Date(2026,7,8), '2026-08-08', 'Date object langsung → August 8'],
];

let passed = 0, failed = 0;
console.log('=== parseAnyDate() Test Suite ===\n');
tests.forEach(([input, expected, desc]) => {
  const result = parseAnyDate(input);
  const got = toISO(result);
  const ok = got === expected;
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? '✅' : '❌'} ${desc}`);
  if (!ok) console.log(`   input: ${input} | expected: ${expected} | got: ${got}`);
});
console.log(`\n${passed}/${passed+failed} tests passed`);
if (failed > 0) process.exit(1);
