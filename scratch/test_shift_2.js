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
    const windowEnd = type === 'keluar'
      ? range.endAbs + range.postEndMinutes
      : range.endAbs;
    
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

  const min = 22 * 60 + 1; // 1321
  console.log("Shift 2 match:", getShiftEventMatch(getShiftRange(SHIFT_CONFIG['Shift 2']), min, 'keluar'));
  console.log("Shift 3 match:", getShiftEventMatch(getShiftRange(SHIFT_CONFIG['Shift 3']), min, 'keluar'));
}

test();
