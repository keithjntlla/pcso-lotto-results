import { DrawResult } from '../data/seedData';

export interface ComboDrawDetail {
  date: string;
  drawTime: '2PM' | '5PM' | '9PM';
}

export interface DigitDetail {
  digit: number;
  freq: number;
  lastDrawn: string | null;
}

export interface ComboStat {
  combination: string;
  count: number;
  score?: number;
  daysOverdue?: number;
  rambolitoDaysOverdue?: number;
  rambolitoCount?: number;
  lastDrawnDate: string | null;
  drawDetails: ComboDrawDetail[];
  digitBreakdown?: DigitDetail[];
}

export type RepeatingSortOption = 'freq_desc' | 'rambolito_freq' | 'score_desc' | 'date_desc';
export type OverdueSortOption = 'overdue_desc' | 'rambolito_overdue' | 'score_desc' | 'combo_asc';
export type PatternFilterOption = 'all' | 'single' | 'double' | 'triple';

/**
 * Calculates the frequencies of each digit (0 to 9) across all historical draws.
 */
export function getDigitFrequencies(results: DrawResult[]): number[] {
  const frequencies = new Array(10).fill(0);

  results.forEach((item) => {
    const processDraw = (drawStr: string) => {
      if (drawStr && drawStr !== '--' && drawStr !== '-') {
        const parts = drawStr.split('-');
        parts.forEach((part) => {
          const num = Number(part.trim());
          if (!isNaN(num) && num >= 0 && num <= 9) {
            frequencies[num]++;
          }
        });
      }
    };

    processDraw(item.draw2pm);
    processDraw(item.draw5pm);
    processDraw(item.draw9pm);
  });

  return frequencies;
}

/**
 * Finds the date when each digit (0-9) was last drawn in history.
 */
export function getDigitLastDrawnDates(results: DrawResult[]): (string | null)[] {
  const lastDrawn = new Array<string | null>(10).fill(null);

  for (const item of results) {
    const processDraw = (drawStr: string) => {
      if (drawStr && drawStr !== '--' && drawStr !== '-') {
        const parts = drawStr.split('-');
        parts.forEach((part) => {
          const num = Number(part.trim());
          if (!isNaN(num) && num >= 0 && num <= 9) {
            if (lastDrawn[num] === null) {
              lastDrawn[num] = item.date;
            }
          }
        });
      }
    };

    processDraw(item.draw2pm);
    processDraw(item.draw5pm);
    processDraw(item.draw9pm);
  }

  return lastDrawn;
}

/**
 * Maps all valid combinations drawn in history with their occurrence counts,
 * last drawn dates, and full draw details.
 */
export function getAllReleasedCombinationsWithDetails(results: DrawResult[]): Map<string, ComboStat> {
  const statsMap = new Map<string, ComboStat>();

  // Iterating through results (expected ordered date descending)
  results.forEach((item) => {
    const processDraw = (drawStr: string, time: '2PM' | '5PM' | '9PM') => {
      if (drawStr && drawStr !== '--' && drawStr !== '-') {
        const parts = drawStr.split('-').map((p) => p.trim());
        if (parts.length === 3) {
          const comboKey = parts.join('-');
          let existing = statsMap.get(comboKey);

          if (!existing) {
            existing = {
              combination: comboKey,
              count: 0,
              lastDrawnDate: item.date,
              drawDetails: [],
            };
            statsMap.set(comboKey, existing);
          }

          existing.count += 1;
          existing.drawDetails.push({ date: item.date, drawTime: time });
        }
      }
    };

    processDraw(item.draw2pm, '2PM');
    processDraw(item.draw5pm, '5PM');
    processDraw(item.draw9pm, '9PM');
  });

  return statsMap;
}

/**
 * Returns repeating combinations in draw history with custom sorting (Exact Order, Rambolito Any Order, Digit Score)
 * and pattern filtering (All Types, Singles Only, Doubles Only).
 */
export function getRepeatingCombinations(
  results: DrawResult[],
  sortBy: RepeatingSortOption = 'freq_desc',
  patternFilter: PatternFilterOption = 'all'
): ComboStat[] {
  const statsMap = getAllReleasedCombinationsWithDetails(results);
  const digitFreqs = getDigitFrequencies(results);
  const items: ComboStat[] = Array.from(statsMap.values());

  // Compute Rambolito total count for each number set
  const rambolitoCountMap = new Map<string, number>();
  items.forEach((item) => {
    const parts = item.combination.split('-').map((p) => parseInt(p.trim(), 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      const rKey = [...parts].sort((a, b) => a - b).join('-');
      rambolitoCountMap.set(rKey, (rambolitoCountMap.get(rKey) || 0) + item.count);
    }
  });

  items.forEach((item) => {
    const parts = item.combination.split('-').map((p) => parseInt(p.trim(), 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      item.score = digitFreqs[parts[0]] + digitFreqs[parts[1]] + digitFreqs[parts[2]];
      const rKey = [...parts].sort((a, b) => a - b).join('-');
      item.rambolitoCount = rambolitoCountMap.get(rKey) || item.count;
    }
  });

  // Filter by Pattern Type
  let filtered = items;
  if (patternFilter === 'single') {
    filtered = items.filter((item) => {
      const p = item.combination.split('-');
      return p[0] !== p[1] && p[1] !== p[2] && p[0] !== p[2];
    });
  } else if (patternFilter === 'double') {
    filtered = items.filter((item) => {
      const p = item.combination.split('-');
      return (p[0] === p[1] && p[1] !== p[2]) || (p[1] === p[2] && p[0] !== p[1]) || (p[0] === p[2] && p[0] !== p[1]);
    });
  } else if (patternFilter === 'triple') {
    filtered = items.filter((item) => {
      const p = item.combination.split('-');
      return p[0] === p[1] && p[1] === p[2];
    });
  }

  // Sort
  if (sortBy === 'rambolito_freq') {
    filtered.sort((a, b) => {
      if ((b.rambolitoCount || 0) !== (a.rambolitoCount || 0)) {
        return (b.rambolitoCount || 0) - (a.rambolitoCount || 0);
      }
      return (b.lastDrawnDate || '').localeCompare(a.lastDrawnDate || '');
    });
  } else if (sortBy === 'score_desc') {
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
  } else if (sortBy === 'date_desc') {
    filtered.sort((a, b) => (b.lastDrawnDate || '').localeCompare(a.lastDrawnDate || ''));
  } else {
    // Default 'freq_desc': Exact order frequency descending
    filtered.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.lastDrawnDate || '').localeCompare(a.lastDrawnDate || '');
    });
  }

  return filtered;
}

/**
 * Calculates days overdue for all combinations and returns combinations sorted by longest waiting time,
 * Rambolito any-order overdue, or digit score, filtered by pattern type (All, Single, Double, Triple).
 */
export function getOverdueCombinations(
  results: DrawResult[],
  sortBy: OverdueSortOption = 'overdue_desc',
  patternFilter: PatternFilterOption = 'all'
): ComboStat[] {
  const statsMap = getAllReleasedCombinationsWithDetails(results);
  const digitFreqs = getDigitFrequencies(results);
  const digitLastDrawn = getDigitLastDrawnDates(results);

  // Map Rambolito Digit Set -> Most Recent Draw Date across ALL permutations
  const rambolitoLastDrawnMap = new Map<string, string>();

  results.forEach((item) => {
    [item.draw2pm, item.draw5pm, item.draw9pm].forEach((drawStr) => {
      if (drawStr && drawStr !== '--' && drawStr !== '-') {
        const parts = drawStr.split('-').map((p) => parseInt(p.trim(), 10));
        if (parts.length === 3 && !parts.some(isNaN)) {
          const rKey = [...parts].sort((a, b) => a - b).join('-');
          if (!rambolitoLastDrawnMap.has(rKey)) {
            rambolitoLastDrawnMap.set(rKey, item.date);
          }
        }
      }
    });
  });

  const now = new Date();
  const allCombos: ComboStat[] = [];

  for (let d1 = 0; d1 <= 9; d1++) {
    for (let d2 = 0; d2 <= 9; d2++) {
      for (let d3 = 0; d3 <= 9; d3++) {
        const comboKey = `${d1}-${d2}-${d3}`;
        const historyInfo = statsMap.get(comboKey);

        let daysOverdue = 99999;
        let lastDrawnDate: string | null = null;
        let drawDetails: ComboDrawDetail[] = [];
        let count = 0;

        if (historyInfo) {
          count = historyInfo.count;
          lastDrawnDate = historyInfo.lastDrawnDate;
          drawDetails = historyInfo.drawDetails;

          if (lastDrawnDate) {
            const [y, m, d] = lastDrawnDate.split('-').map(Number);
            const lastDate = new Date(y, m - 1, d);
            const diffTime = Math.abs(now.getTime() - lastDate.getTime());
            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }

        // Rambolito (Any Order) Overdue Calculation
        const rKey = [d1, d2, d3].sort((a, b) => a - b).join('-');
        const rLastDateStr = rambolitoLastDrawnMap.get(rKey);
        let rambolitoDaysOverdue = 99999;
        if (rLastDateStr) {
          const [ry, rm, rd] = rLastDateStr.split('-').map(Number);
          const rLastDate = new Date(ry, rm - 1, rd);
          const diffTime = Math.abs(now.getTime() - rLastDate.getTime());
          rambolitoDaysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const score = digitFreqs[d1] + digitFreqs[d2] + digitFreqs[d3];
        const digitBreakdown: DigitDetail[] = [
          { digit: d1, freq: digitFreqs[d1], lastDrawn: digitLastDrawn[d1] },
          { digit: d2, freq: digitFreqs[d2], lastDrawn: digitLastDrawn[d2] },
          { digit: d3, freq: digitFreqs[d3], lastDrawn: digitLastDrawn[d3] },
        ];

        allCombos.push({
          combination: comboKey,
          count,
          score,
          daysOverdue,
          rambolitoDaysOverdue,
          lastDrawnDate,
          drawDetails,
          digitBreakdown,
        });
      }
    }
  }

  // Filter by Pattern Type (All, Single, Double, Triple)
  let filtered = allCombos;
  if (patternFilter === 'single') {
    filtered = allCombos.filter((item) => {
      const p = item.combination.split('-');
      return p[0] !== p[1] && p[1] !== p[2] && p[0] !== p[2];
    });
  } else if (patternFilter === 'double') {
    filtered = allCombos.filter((item) => {
      const p = item.combination.split('-');
      return (p[0] === p[1] && p[1] !== p[2]) || (p[1] === p[2] && p[0] !== p[1]) || (p[0] === p[2] && p[0] !== p[1]);
    });
  } else if (patternFilter === 'triple') {
    filtered = allCombos.filter((item) => {
      const p = item.combination.split('-');
      return p[0] === p[1] && p[1] === p[2];
    });
  }

  // Sort based on Option
  if (sortBy === 'rambolito_overdue') {
    // Sort by longest Rambolito (any order) overdue days first
    filtered.sort((a, b) => (b.rambolitoDaysOverdue || 0) - (a.rambolitoDaysOverdue || 0));
  } else if (sortBy === 'score_desc') {
    // Sort by digit popularity score
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
  } else if (sortBy === 'combo_asc') {
    // Combination 0-9 sort
    filtered.sort((a, b) => a.combination.localeCompare(b.combination));
  } else {
    // Default 'overdue_desc': Sort by exact combination overdue days first
    filtered.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  }

  return filtered;
}

export interface ComboAnalytics {
  sum: number;
  oddCount: number;
  evenCount: number;
  lowCount: number;
  highCount: number;
  patternType: 'Single' | 'Double' | 'Triple';
}

export function getComboAnalytics(combination: string): ComboAnalytics {
  const parts = combination.split('-').map((p) => parseInt(p.trim(), 10) || 0);
  const sum = parts.reduce((a, b) => a + b, 0);

  const oddCount = parts.filter((n) => n % 2 !== 0).length;
  const evenCount = 3 - oddCount;

  const lowCount = parts.filter((n) => n <= 4).length;
  const highCount = 3 - lowCount;

  let patternType: 'Single' | 'Double' | 'Triple' = 'Single';
  if (parts[0] === parts[1] && parts[1] === parts[2]) {
    patternType = 'Triple';
  } else if (parts[0] === parts[1] || parts[1] === parts[2] || parts[0] === parts[2]) {
    patternType = 'Double';
  }

  return {
    sum,
    oddCount,
    evenCount,
    lowCount,
    highCount,
    patternType,
  };
}
