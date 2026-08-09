function test() {
  const SHIFT_CONFIG = {
    'Shift 1': { startTotal: 6 * 60 + 0,  endTotal: 13 * 60 + 59, preStartMinutes: 60, postEndMinutes: 120, crossMidnight: false },
    'Shift 2': { startTotal: 14 * 60 + 0, endTotal: 21 * 60 + 59, preStartMinutes: 60, postEndMinutes: 120, crossMidnight: false },
    'Shift 3': { startTotal: 22 * 60 + 0, endTotal: 5 * 60 + 59,  preStartMinutes: 60, postEndMinutes: 120, crossMidnight: true }
  };

  function getShiftRange(cfg) {
    const startAbs = cfg.startTotal;
    const endAbs = cfg.crossMidnight || cfg.endTotal < cfg.startTotal
      ? cfg.endTotal + 24 * 60
      : cfg.endTotal;
    return {
      startAbs: startAbs,
      endAbs: endAbs,
      preStartMinutes: cfg.preStartMinutes || 0,
      postEndMinutes: cfg.postEndMinutes || 0
    };
  }

  function getShiftEventMatch(range, minute, type) {
    const windowStart = type === 'masuk'
      ? range.startAbs - range.preStartMinutes
      : range.startAbs;
    
    // BUG IS LIKELY HERE:
    const windowEnd = type === 'keluar'
      ? range.endAbs + range.postEndMinutes
      : range.endAbs;
      
    // Let's trace for type == 'masuk', Shift 2:
    // windowStart = 840 - 60 = 780
    // windowEnd = range.endAbs = 1319  (21:59)
    // 21:40 = 1300. 1300 <= 1319. So it's valid.
    
    // For Shift 3:
    // range.startAbs = 1320
    // windowStart = 1320 - 60 = 1260
    // windowEnd = range.endAbs = 359 + 1440 = 1799
    // 21:40 = 1300. 1300 <= 1799. So it's valid.
    
    const refPoint = type === 'masuk' ? range.startAbs : range.endAbs;
    const candidates = [minute, minute + 24 * 60];
    let bestActualAbs = null;
    let bestDistance = Infinity;
    
    for (let i = 0; i < candidates.length; i++) {
      const actualAbs = candidates[i];
      if (actualAbs < windowStart || actualAbs > windowEnd) continue;
      const distance = Math.abs(actualAbs - refPoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestActualAbs = actualAbs;
      }
    }
    
    return { matches: bestActualAbs !== null, distance: bestDistance };
  }

  const min = 21 * 60 + 40; // 1300
  console.log("Shift 2 match:", getShiftEventMatch(getShiftRange(SHIFT_CONFIG['Shift 2']), min, 'masuk'));
  console.log("Shift 3 match:", getShiftEventMatch(getShiftRange(SHIFT_CONFIG['Shift 3']), min, 'masuk'));
}

test();
