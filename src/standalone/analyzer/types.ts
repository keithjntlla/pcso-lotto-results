export type PlayType = 'target' | 'rambolito';
export type DrawTimeFilter = 'ALL' | '2PM' | '5PM' | '9PM';

export interface DigitHeatInfo {
  digit: number;
  freq14d: number;
  freq30d: number;
  lastDrawnDaysAgo: number | null;
  status: 'HOT' | 'WARM' | 'COLD' | 'OVERDUE';
  scoreContribution: number;
}

export interface SumInfo {
  sum: number;
  probabilityPercent: number; // e.g. Bell curve percentage
  status: 'OPTIMAL' | 'MODERATE' | 'EXTREME';
  description: string;
}

export interface ParityInfo {
  oddCount: number;
  evenCount: number;
  highCount: number; // 5-9
  lowCount: number;  // 0-4
  ratioLabel: string;
  status: 'BALANCED' | 'UNBALANCED';
  description: string;
}

export interface PairSynergyInfo {
  pair: string; // e.g. "7-4"
  count30d: number;
  coOccurrenceRating: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RecencyInfo {
  exactMatchLastDrawn: string | null;
  exactMatchDaysAgo: number | null;
  exactMatchCount: number;
  rambolMatchLastDrawn: string | null;
  rambolMatchDaysAgo: number | null;
  rambolMatchCount: number;
}

export interface TweakSuggestion {
  originalCombo: string;
  suggestedCombo: string;
  scoreImprovement: number;
  reason: string;
}

export interface AnalysisBreakdown {
  combination: string;
  playType: PlayType;
  drawTimeFilter: DrawTimeFilter;
  totalScore: number; // 0 to 100
  ratingLabel: string; // e.g., "Prime Contender", "Hot Pattern", "Balanced Pick", "Cold Trend"
  ratingColor: string;
  
  // Odds math
  theoreticalOdds: string; // "1 in 1,000" or "6 in 1,000"
  theoreticalProbability: number; // 0.1% or 0.6%
  
  // Detail breakdowns
  digitHeat: DigitHeatInfo[];
  sumInfo: SumInfo;
  parityInfo: ParityInfo;
  pairSynergies: PairSynergyInfo[];
  recencyInfo: RecencyInfo;
  
  // Category scores (0 to 100 each)
  scores: {
    digitHeatScore: number;
    sumScore: number;
    parityScore: number;
    pairSynergyScore: number;
    recencyScore: number;
  };
  
  // Human readable reasoning bullet points
  reasoning: string[];
  
  // Smart tweaks
  tweakSuggestions: TweakSuggestion[];
}
