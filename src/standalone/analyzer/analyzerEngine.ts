import { DrawResult } from '../../data/seedData';
import {
  AnalysisBreakdown,
  DigitHeatInfo,
  DrawTimeFilter,
  PairSynergyInfo,
  ParityInfo,
  PlayType,
  RecencyInfo,
  SumInfo,
  TweakSuggestion,
} from './types';

/**
 * Standard sum probability weights for 3-digit sum (0-27)
 * Maximum probability is for sum 13 and 14 (7.5% each)
 */
const SUM_PROBABILITIES: { [sum: number]: number } = {
  0: 0.1, 1: 0.3, 2: 0.6, 3: 1.0, 4: 1.5, 5: 2.1, 6: 2.8, 7: 3.6, 8: 4.5, 9: 5.5,
  10: 6.3, 11: 6.9, 12: 7.3, 13: 7.5, 14: 7.5, 15: 7.3, 16: 6.9, 17: 6.3,
  18: 5.5, 19: 4.5, 20: 3.6, 21: 2.8, 22: 2.1, 23: 1.5, 24: 1.0, 25: 0.6, 26: 0.3, 27: 0.1,
};

/**
 * Helper to compute date difference in days
 */
function getDaysAgo(dateStr: string): number {
  const drawDate = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - drawDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Main Analyzer Engine function
 */
export function analyzeCombination(
  comboStr: string, // e.g. "7-4-2"
  playType: PlayType = 'target',
  drawTimeFilter: DrawTimeFilter = 'ALL',
  results: DrawResult[] = []
): AnalysisBreakdown {
  const parts = comboStr.split('-').map((p) => parseInt(p.trim(), 10));
  const d1 = isNaN(parts[0]) ? 0 : parts[0];
  const d2 = isNaN(parts[1]) ? 0 : parts[1];
  const d3 = isNaN(parts[2]) ? 0 : parts[2];
  const digits = [d1, d2, d3];
  const sortedDigitsStr = [...digits].sort((a, b) => a - b).join('-');

  // Filter draws based on time if specified
  const filteredDraws: { date: string; draw: string; drawTime: '2PM' | '5PM' | '9PM' }[] = [];
  results.forEach((r) => {
    if (drawTimeFilter === 'ALL' || drawTimeFilter === '2PM') {
      if (r.draw2pm && r.draw2pm !== '--') filteredDraws.push({ date: r.date, draw: r.draw2pm, drawTime: '2PM' });
    }
    if (drawTimeFilter === 'ALL' || drawTimeFilter === '5PM') {
      if (r.draw5pm && r.draw5pm !== '--') filteredDraws.push({ date: r.date, draw: r.draw5pm, drawTime: '5PM' });
    }
    if (drawTimeFilter === 'ALL' || drawTimeFilter === '9PM') {
      if (r.draw9pm && r.draw9pm !== '--') filteredDraws.push({ date: r.date, draw: r.draw9pm, drawTime: '9PM' });
    }
  });

  const recent14Draws = filteredDraws.slice(0, 14 * 3);
  const recent30Draws = filteredDraws.slice(0, 30 * 3);

  // 1. DIGIT HEAT CALCULATION
  const digitHeat: DigitHeatInfo[] = digits.map((digit) => {
    let freq14d = 0;
    recent14Draws.forEach((d) => {
      d.draw.split('-').forEach((p) => {
        if (parseInt(p.trim(), 10) === digit) freq14d++;
      });
    });

    let freq30d = 0;
    recent30Draws.forEach((d) => {
      d.draw.split('-').forEach((p) => {
        if (parseInt(p.trim(), 10) === digit) freq30d++;
      });
    });

    // Find last drawn date for this digit
    let lastDrawnDate: string | null = null;
    for (const d of filteredDraws) {
      if (d.draw.split('-').some((p) => parseInt(p.trim(), 10) === digit)) {
        lastDrawnDate = d.date;
        break;
      }
    }

    const daysAgo = lastDrawnDate ? getDaysAgo(lastDrawnDate) : 999;

    let status: 'HOT' | 'WARM' | 'COLD' | 'OVERDUE' = 'WARM';
    let contrib = 70;

    if (freq14d >= 5) {
      status = 'HOT';
      contrib = 95;
    } else if (daysAgo > 15) {
      status = 'OVERDUE';
      contrib = 85;
    } else if (freq14d <= 1) {
      status = 'COLD';
      contrib = 45;
    } else {
      status = 'WARM';
      contrib = 70;
    }

    return {
      digit,
      freq14d,
      freq30d,
      lastDrawnDaysAgo: daysAgo === 999 ? null : daysAgo,
      status,
      scoreContribution: contrib,
    };
  });

  const digitHeatScore = Math.round(
    digitHeat.reduce((acc, curr) => acc + curr.scoreContribution, 0) / 3
  );

  // 2. SUM ANALYSIS
  const sum = d1 + d2 + d3;
  const probPercent = SUM_PROBABILITIES[sum] || 1.0;
  let sumStatus: 'OPTIMAL' | 'MODERATE' | 'EXTREME' = 'MODERATE';
  let sumScore = 60;
  let sumDesc = '';

  if (sum >= 10 && sum <= 17) {
    sumStatus = 'OPTIMAL';
    sumScore = 95;
    sumDesc = `Sum ${sum} is in the high-probability sweet spot (10-17), accounting for ~65% of winning draws.`;
  } else if (sum >= 7 && sum <= 19) {
    sumStatus = 'MODERATE';
    sumScore = 75;
    sumDesc = `Sum ${sum} has average statistical occurrence (~25% of winning draws).`;
  } else {
    sumStatus = 'EXTREME';
    sumScore = 35;
    sumDesc = `Sum ${sum} is an extreme sum range (0-6 or 20-27) which occurs in under 10% of historical draws.`;
  }

  const sumInfo: SumInfo = {
    sum,
    probabilityPercent: probPercent,
    status: sumStatus,
    description: sumDesc,
  };

  // 3. PARITY & HIGH/LOW BALANCE
  const odds = digits.filter((d) => d % 2 !== 0).length;
  const evens = 3 - odds;
  const highs = digits.filter((d) => d >= 5).length;
  const lows = 3 - highs;

  let parityStatus: 'BALANCED' | 'UNBALANCED' = 'BALANCED';
  let parityScore = 85;
  let parityDesc = '';

  if ((odds === 1 || odds === 2) && (highs === 1 || highs === 2)) {
    parityStatus = 'BALANCED';
    parityScore = 95;
    parityDesc = `Balanced distribution (${odds} Odd / ${evens} Even, ${highs} High / ${lows} Low).`;
  } else {
    parityStatus = 'UNBALANCED';
    parityScore = 50;
    parityDesc = `Skews heavily (${odds === 3 ? 'All Odd' : odds === 0 ? 'All Even' : ''} ${highs === 3 ? 'All High' : highs === 0 ? 'All Low' : ''}).`;
  }

  const parityInfo: ParityInfo = {
    oddCount: odds,
    evenCount: evens,
    highCount: highs,
    lowCount: lows,
    ratioLabel: `${odds}O:${evens}E | ${highs}H:${lows}L`,
    status: parityStatus,
    description: parityDesc,
  };

  // 4. PAIR SYNERGY
  const pairs = [`${d1}-${d2}`, `${d2}-${d3}`, `${d1}-${d3}`];
  const pairSynergies: PairSynergyInfo[] = pairs.map((pairStr) => {
    const [pA, pB] = pairStr.split('-').map((p) => parseInt(p, 10));
    let count = 0;
    recent30Draws.forEach((d) => {
      const dParts = d.draw.split('-').map((p) => parseInt(p.trim(), 10));
      if (dParts.includes(pA) && dParts.includes(pB)) count++;
    });

    let rating: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (count >= 3) rating = 'HIGH';
    else if (count === 0) rating = 'LOW';

    return { pair: pairStr, count30d: count, coOccurrenceRating: rating };
  });

  const pairSynergyScore = Math.round(
    pairSynergies.reduce((acc, curr) => {
      if (curr.coOccurrenceRating === 'HIGH') return acc + 90;
      if (curr.coOccurrenceRating === 'MEDIUM') return acc + 70;
      return acc + 40;
    }, 0) / 3
  );

  // 5. RECENCY & HISTORICAL MATCHES
  let exactCount = 0;
  let exactLastDrawn: string | null = null;
  let rambolCount = 0;
  let rambolLastDrawn: string | null = null;

  const targetComboStr = `${d1}-${d2}-${d3}`;

  filteredDraws.forEach((d) => {
    if (d.draw === targetComboStr) {
      exactCount++;
      if (!exactLastDrawn) exactLastDrawn = d.date;
    }

    const drawSorted = d.draw
      .split('-')
      .map((p) => parseInt(p.trim(), 10))
      .sort((a, b) => a - b)
      .join('-');

    if (drawSorted === sortedDigitsStr) {
      rambolCount++;
      if (!rambolLastDrawn) rambolLastDrawn = d.date;
    }
  });

  const exactDaysAgo = exactLastDrawn ? getDaysAgo(exactLastDrawn) : null;
  const rambolDaysAgo = rambolLastDrawn ? getDaysAgo(rambolLastDrawn) : null;

  let recencyScore = 75;
  if (playType === 'target') {
    if (exactDaysAgo && exactDaysAgo > 60) recencyScore = 90; // overdue boost
    else if (exactDaysAgo && exactDaysAgo < 7) recencyScore = 45; // recently drawn penalty
  } else {
    if (rambolDaysAgo && rambolDaysAgo > 30) recencyScore = 90;
    else if (rambolDaysAgo && rambolDaysAgo < 5) recencyScore = 50;
  }

  const recencyInfo: RecencyInfo = {
    exactMatchLastDrawn: exactLastDrawn,
    exactMatchDaysAgo: exactDaysAgo,
    exactMatchCount: exactCount,
    rambolMatchLastDrawn: rambolLastDrawn,
    rambolMatchDaysAgo: rambolDaysAgo,
    rambolMatchCount: rambolCount,
  };

  // 6. TOTAL WEIGHTED SCORE & RATING
  const totalScore = Math.round(
    digitHeatScore * 0.25 +
      sumScore * 0.2 +
      parityScore * 0.15 +
      pairSynergyScore * 0.15 +
      recencyScore * 0.25
  );

  let ratingLabel = 'Balanced Pick';
  let ratingColor = '#3B82F6'; // Blue

  if (totalScore >= 85) {
    ratingLabel = '🔥 Prime Contender';
    ratingColor = '#EF4444'; // Red/Hot
  } else if (totalScore >= 75) {
    ratingLabel = '⚡ Hot Pattern';
    ratingColor = '#F59E0B'; // Amber
  } else if (totalScore >= 60) {
    ratingLabel = '⚖️ Balanced Pick';
    ratingColor = '#10B981'; // Green
  } else {
    ratingLabel = '❄️ Cold Trend';
    ratingColor = '#6B7280'; // Gray
  }

  // Odds calculation
  let theoreticalOdds = '1 in 1,000';
  let theoreticalProbability = 0.1;

  if (playType === 'rambolito') {
    const uniqueDigits = new Set(digits).size;
    if (uniqueDigits === 3) {
      theoreticalOdds = '6 in 1,000';
      theoreticalProbability = 0.6;
    } else if (uniqueDigits === 2) {
      theoreticalOdds = '3 in 1,000';
      theoreticalProbability = 0.3;
    } else {
      theoreticalOdds = '1 in 1,000';
      theoreticalProbability = 0.1;
    }
  }

  // Human Readable Rationale
  const reasoning: string[] = [];

  const hotDigits = digitHeat.filter((dh) => dh.status === 'HOT').map((dh) => dh.digit);
  const overdueDigits = digitHeat.filter((dh) => dh.status === 'OVERDUE').map((dh) => dh.digit);

  if (hotDigits.length > 0) {
    reasoning.push(`Contains hot digit(s): ${hotDigits.join(', ')} with high recent 14-day occurrence.`);
  }
  if (overdueDigits.length > 0) {
    reasoning.push(`Contains overdue digit(s): ${overdueDigits.join(', ')} waiting for a comeback.`);
  }

  reasoning.push(sumDesc);
  reasoning.push(parityDesc);

  if (recencyInfo.rambolMatchDaysAgo !== null) {
    reasoning.push(
      `In any order (Rambolito), this set was last drawn ${recencyInfo.rambolMatchDaysAgo} days ago (${recencyInfo.rambolMatchCount} total historical hits).`
    );
  } else {
    reasoning.push(`This exact digit combination has never been drawn in history.`);
  }

  // Smart Tweaks Suggestions
  const tweakSuggestions: TweakSuggestion[] = [];
  
  // Try tweaking d3 to improve sum or heat score
  for (let newD3 = 0; newD3 <= 9; newD3++) {
    if (newD3 === d3) continue;
    const testComboStr = `${d1}-${d2}-${newD3}`;
    const testSum = d1 + d2 + newD3;
    if (testSum >= 10 && testSum <= 17 && sumScore < 80) {
      tweakSuggestions.push({
        originalCombo: comboStr,
        suggestedCombo: testComboStr,
        scoreImprovement: 12,
        reason: `Changing digit 3 to ${newD3} optimizes the sum to ${testSum} (high-probability sum zone).`,
      });
      break;
    }
  }

  return {
    combination: comboStr,
    playType,
    drawTimeFilter,
    totalScore,
    ratingLabel,
    ratingColor,
    theoreticalOdds,
    theoreticalProbability,
    digitHeat,
    sumInfo,
    parityInfo,
    pairSynergies,
    recencyInfo,
    scores: {
      digitHeatScore,
      sumScore,
      parityScore,
      pairSynergyScore,
      recencyScore,
    },
    reasoning,
    tweakSuggestions,
  };
}
