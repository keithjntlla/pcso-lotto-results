import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnalysisBreakdown } from '../types';

interface ScoreGaugeProps {
  breakdown: AnalysisBreakdown;
}

export default function ScoreGauge({ breakdown }: ScoreGaugeProps) {
  const { totalScore, ratingLabel, ratingColor, theoreticalOdds, playType } = breakdown;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F449E', '#1A5EC2']}
        style={styles.gaugeCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <Text style={styles.cardTitle}>COMBINATION STRENGTH</Text>
          <View style={styles.oddsBadge}>
            <Ionicons name="stats-chart" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.oddsText}>{playType.toUpperCase()} ({theoreticalOdds})</Text>
          </View>
        </View>

        {/* Center Score Display */}
        <View style={styles.scoreRow}>
          <View style={[styles.scoreCircle, { borderColor: ratingColor }]}>
            <Text style={[styles.scoreNumber, { color: ratingColor }]}>{totalScore}</Text>
            <Text style={styles.scorePercent}>%</Text>
          </View>
          
          <View style={styles.scoreDetails}>
            <View style={[styles.ratingPill, { backgroundColor: ratingColor + '25', borderColor: ratingColor }]}>
              <Text style={[styles.ratingText, { color: ratingColor }]}>{ratingLabel}</Text>
            </View>
            <Text style={styles.subtext}>
              Evaluated against historical frequency, recency, sum curve, and pair synergy.
            </Text>
          </View>
        </View>

        {/* Category Micro Bars */}
        <View style={styles.microBarsRow}>
          <View style={styles.microBarItem}>
            <Text style={styles.microBarLabel}>Digit Heat</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${breakdown.scores.digitHeatScore}%`, backgroundColor: '#F59E0B' }]} />
            </View>
            <Text style={styles.microBarVal}>{breakdown.scores.digitHeatScore}%</Text>
          </View>

          <View style={styles.microBarItem}>
            <Text style={styles.microBarLabel}>Sum Curve</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${breakdown.scores.sumScore}%`, backgroundColor: '#10B981' }]} />
            </View>
            <Text style={styles.microBarVal}>{breakdown.scores.sumScore}%</Text>
          </View>

          <View style={styles.microBarItem}>
            <Text style={styles.microBarLabel}>Recency</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${breakdown.scores.recencyScore}%`, backgroundColor: '#60A5FA' }]} />
            </View>
            <Text style={styles.microBarVal}>{breakdown.scores.recencyScore}%</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  gaugeCard: {
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    shadowColor: '#0F449E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  oddsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  oddsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreNumber: {
    fontSize: 30,
    fontWeight: '900',
  },
  scorePercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  scoreDetails: {
    flex: 1,
  },
  ratingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
  },
  subtext: {
    color: '#E0F2FE',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  microBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  microBarItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  microBarLabel: {
    color: '#DBEAFE',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  barTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  microBarVal: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
});
