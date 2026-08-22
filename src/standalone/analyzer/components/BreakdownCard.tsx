import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnalysisBreakdown } from '../types';

interface BreakdownCardProps {
  breakdown: AnalysisBreakdown;
  onApplyTweak?: (suggestedCombo: string) => void;
}

export default function BreakdownCard({ breakdown, onApplyTweak }: BreakdownCardProps) {
  const { digitHeat, sumInfo, parityInfo, pairSynergies, recencyInfo, reasoning, tweakSuggestions } = breakdown;

  return (
    <View style={styles.container}>
      {/* 1. DIGIT HEAT BREAKDOWN */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="flame" size={18} color="#F59E0B" />
          <Text style={styles.cardTitle}>1. DIGIT HEAT BREAKDOWN</Text>
        </View>
        <View style={styles.digitRow}>
          {digitHeat.map((item, index) => {
            let badgeBg = '#FEF3C7';
            let badgeColor = '#D97706';
            if (item.status === 'HOT') {
              badgeBg = '#FEE2E2';
              badgeColor = '#DC2626';
            } else if (item.status === 'OVERDUE') {
              badgeBg = '#F3E8FF';
              badgeColor = '#7C3AED';
            } else if (item.status === 'COLD') {
              badgeBg = '#F1F5F9';
              badgeColor = '#64748B';
            }

            return (
              <View key={index} style={styles.digitBox}>
                <View style={styles.digitBall}>
                  <Text style={styles.digitNumber}>{item.digit}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.statusText, { color: badgeColor }]}>{item.status}</Text>
                </View>
                <Text style={styles.digitSubtext}>{item.freq14d} hits in 14d</Text>
                <Text style={styles.digitSubtext}>
                  {item.lastDrawnDaysAgo === null ? 'Never' : `${item.lastDrawnDaysAgo}d ago`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 2. SUM & PARITY */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="calculator" size={18} color="#10B981" />
          <Text style={styles.cardTitle}>2. SUM & PATTERN BALANCE</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Sum Total</Text>
            <Text style={styles.infoVal}>{sumInfo.sum}</Text>
            <View style={[styles.pill, { backgroundColor: sumInfo.status === 'OPTIMAL' ? '#D1FAE5' : '#FEF3C7' }]}>
              <Text style={[styles.pillText, { color: sumInfo.status === 'OPTIMAL' ? '#059669' : '#D97706' }]}>
                {sumInfo.status}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Odd/Even & High/Low</Text>
            <Text style={styles.infoVal}>{parityInfo.ratioLabel}</Text>
            <View style={[styles.pill, { backgroundColor: parityInfo.status === 'BALANCED' ? '#DBEAFE' : '#F1F5F9' }]}>
              <Text style={[styles.pillText, { color: parityInfo.status === 'BALANCED' ? '#1D4ED8' : '#64748B' }]}>
                {parityInfo.status}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.explanationText}>{sumInfo.description}</Text>
      </View>

      {/* 3. PAIR SYNERGY */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="git-network" size={18} color="#1A5EC2" />
          <Text style={styles.cardTitle}>3. PAIR SYNERGY (30-DAY CO-OCCURRENCE)</Text>
        </View>
        <View style={styles.pairRow}>
          {pairSynergies.map((p, idx) => (
            <View key={idx} style={styles.pairItem}>
              <Text style={styles.pairName}>Pair `{p.pair}`</Text>
              <Text style={styles.pairCount}>{p.count30d} hits</Text>
              <Text
                style={[
                  styles.pairRating,
                  { color: p.coOccurrenceRating === 'HIGH' ? '#059669' : p.coOccurrenceRating === 'MEDIUM' ? '#D97706' : '#64748B' },
                ]}
              >
                {p.coOccurrenceRating} SYNERGY
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 4. HISTORICAL RECENCY */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="time" size={18} color="#7C3AED" />
          <Text style={styles.cardTitle}>4. HISTORICAL RECENCY & ARCHIVE HITS</Text>
        </View>
        <View style={styles.recencyRow}>
          <View style={styles.recencyBox}>
            <Text style={styles.recencyTitle}>Target (Exact Order)</Text>
            <Text style={styles.recencyVal}>
              {recencyInfo.exactMatchDaysAgo === null ? 'Never Drawn' : `${recencyInfo.exactMatchDaysAgo} days ago`}
            </Text>
            <Text style={styles.recencySub}>Total Hits: {recencyInfo.exactMatchCount}</Text>
          </View>
          <View style={styles.recencyBox}>
            <Text style={styles.recencyTitle}>Rambol (Any Order)</Text>
            <Text style={styles.recencyVal}>
              {recencyInfo.rambolMatchDaysAgo === null ? 'Never Drawn' : `${recencyInfo.rambolMatchDaysAgo} days ago`}
            </Text>
            <Text style={styles.recencySub}>Total Hits: {recencyInfo.rambolMatchCount}</Text>
          </View>
        </View>
      </View>

      {/* 5. EXPLANATION & REASONING SUMMARY */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="bulb" size={18} color="#0F449E" />
          <Text style={styles.cardTitle}>5. RATIONALE & ANALYSIS FINDINGS</Text>
        </View>
        {reasoning.map((r, i) => (
          <View key={i} style={styles.reasonItem}>
            <Ionicons name="checkmark-circle" size={16} color="#1A5EC2" style={{ marginTop: 2, marginRight: 8 }} />
            <Text style={styles.reasonText}>{r}</Text>
          </View>
        ))}
      </View>

      {/* 6. SMART TWEAK SUGGESTIONS */}
      {tweakSuggestions.length > 0 && (
        <View style={[styles.card, styles.tweakCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="sparkles" size={18} color="#D97706" />
            <Text style={[styles.cardTitle, { color: '#B45309' }]}>SMART OPTIMIZATION SUGGESTION</Text>
          </View>
          {tweakSuggestions.map((t, idx) => (
            <View key={idx} style={styles.tweakBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tweakTitle}>
                  Try `{t.suggestedCombo}` <Text style={{ color: '#059669', fontWeight: '800' }}>(+{t.scoreImprovement}% score)</Text>
                </Text>
                <Text style={styles.tweakReason}>{t.reason}</Text>
              </View>
              {onApplyTweak && (
                <TouchableOpacity style={styles.tweakBtn} onPress={() => onApplyTweak(t.suggestedCombo)}>
                  <Text style={styles.tweakBtnText}>Apply</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    elevation: 2,
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  tweakCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  digitBox: {
    alignItems: 'center',
    width: '30%',
  },
  digitBall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  digitNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  digitSubtext: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoCol: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '500',
  },
  infoVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  explanationText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginTop: 4,
  },
  pairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pairItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pairName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  pairCount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 2,
  },
  pairRating: {
    fontSize: 9,
    fontWeight: '800',
  },
  recencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recencyBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recencyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  recencyVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  recencySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  tweakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tweakTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  tweakReason: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  tweakBtn: {
    backgroundColor: '#1A5EC2',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 8,
  },
  tweakBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
