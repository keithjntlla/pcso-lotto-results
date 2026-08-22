import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { seedResults, DrawResult } from '../../data/seedData';
import { analyzeCombination } from './analyzerEngine';
import { DrawTimeFilter, PlayType } from './types';
import ScoreGauge from './components/ScoreGauge';
import BreakdownCard from './components/BreakdownCard';
import { addMyTicket } from '../../utils/tickets';

export default function AnalyzerScreen() {
  const [d1, setD1] = useState<number>(7);
  const [d2, setD2] = useState<number>(4);
  const [d3, setD3] = useState<number>(2);
  const [playType, setPlayType] = useState<PlayType>('target');
  const [drawTimeFilter, setDrawTimeFilter] = useState<DrawTimeFilter>('ALL');
  const [results] = useState<DrawResult[]>(seedResults);

  const comboStr = `${d1}-${d2}-${d3}`;

  // Analyze combination whenever inputs change
  const breakdown = useMemo(() => {
    return analyzeCombination(comboStr, playType, drawTimeFilter, results);
  }, [comboStr, playType, drawTimeFilter, results]);

  // Digit increment / decrement helper
  const adjustDigit = (digitIndex: 1 | 2 | 3, delta: number) => {
    const update = (prev: number) => (prev + delta + 10) % 10;
    if (digitIndex === 1) setD1(update);
    if (digitIndex === 2) setD2(update);
    if (digitIndex === 3) setD3(update);
  };

  // Preset Generators
  const handleRandomize = () => {
    setD1(Math.floor(Math.random() * 10));
    setD2(Math.floor(Math.random() * 10));
    setD3(Math.floor(Math.random() * 10));
  };

  const handleApplyTweak = (suggestedCombo: string) => {
    const parts = suggestedCombo.split('-').map((p) => parseInt(p, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      setD1(parts[0]);
      setD2(parts[1]);
      setD3(parts[2]);
    }
  };

  // Add analyzed combination directly to My Tickets
  const handleSaveTicket = async () => {
    try {
      const timeForTicket: '2PM' | '5PM' | '9PM' = drawTimeFilter === 'ALL' ? '2PM' : drawTimeFilter;
      const typeForTicket: 'Standard' | 'Rambolito' = playType === 'target' ? 'Standard' : 'Rambolito';
      const todayStr = new Date().toISOString().split('T')[0];

      await addMyTicket(
        {
          date: todayStr,
          drawTime: timeForTicket,
          combination: comboStr,
          playType: typeForTicket,
        },
        results
      );
      Alert.alert('Saved to My Tickets! 🎟️', `Combination ${comboStr} (${typeForTicket}) added to your tracker.`);
    } catch (e) {
      Alert.alert('Save Failed', 'Could not save ticket to local storage.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F449E" />
      
      {/* Header Banner - PCSO App Blue Gradient */}
      <LinearGradient colors={['#0F449E', '#1A5EC2']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.standaloneTag}>
              <Text style={styles.standaloneTagText}>PCSO 3D ANALYZER</Text>
            </View>
            <Text style={styles.headerTitle}>Combination Chance Analyzer</Text>
            <Text style={styles.headerSub}>Evaluate heat, pattern synergy & historical odds</Text>
          </View>
          <TouchableOpacity style={styles.randomBtn} onPress={handleRandomize}>
            <Ionicons name="dice-outline" size={18} color="#0F449E" />
            <Text style={styles.randomBtnText}>Random</Text>
          </TouchableOpacity>
        </View>

        {/* Draw Time Filter Selector */}
        <View style={styles.filterRow}>
          {(['ALL', '2PM', '5PM', '9PM'] as DrawTimeFilter[]).map((time) => {
            const isActive = drawTimeFilter === time;
            return (
              <TouchableOpacity
                key={time}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setDrawTimeFilter(time)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {time === 'ALL' ? 'All Draws' : `${time} Draw`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Play Type Toggle */}
        <View style={styles.playTypeCard}>
          <Text style={styles.sectionLabel}>SELECT PLAY TYPE</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, playType === 'target' && styles.toggleBtnActive]}
              onPress={() => setPlayType('target')}
            >
              <Ionicons name="location" size={16} color={playType === 'target' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.toggleBtnText, playType === 'target' && styles.toggleBtnTextActive]}>
                Target (Exact Order)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, playType === 'rambolito' && styles.toggleBtnActive]}
              onPress={() => setPlayType('rambolito')}
            >
              <Ionicons name="shuffle" size={16} color={playType === 'rambolito' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.toggleBtnText, playType === 'rambolito' && styles.toggleBtnTextActive]}>
                Rambolito (Any Order)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive 3D Digit Combination Selector */}
        <View style={styles.pickerCard}>
          <Text style={styles.sectionLabel}>ENTER YOUR 3D COMBINATION</Text>
          
          <View style={styles.digitsRow}>
            {/* Digit 1 */}
            <View style={styles.digitColumn}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDigit(1, 1)}>
                <Ionicons name="chevron-up" size={22} color="#1A5EC2" />
              </TouchableOpacity>
              <View style={styles.digitBall}>
                <Text style={styles.digitText}>{d1}</Text>
              </View>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDigit(1, -1)}>
                <Ionicons name="chevron-down" size={22} color="#1A5EC2" />
              </TouchableOpacity>
            </View>

            <Text style={styles.digitSeparator}>-</Text>

            {/* Digit 2 */}
            <View style={styles.digitColumn}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDigit(2, 1)}>
                <Ionicons name="chevron-up" size={22} color="#1A5EC2" />
              </TouchableOpacity>
              <View style={styles.digitBall}>
                <Text style={styles.digitText}>{d2}</Text>
              </View>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDigit(2, -1)}>
                <Ionicons name="chevron-down" size={22} color="#1A5EC2" />
              </TouchableOpacity>
            </View>

            <Text style={styles.digitSeparator}>-</Text>

            {/* Digit 3 */}
            <View style={styles.digitColumn}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDigit(3, 1)}>
                <Ionicons name="chevron-up" size={22} color="#1A5EC2" />
              </TouchableOpacity>
              <View style={styles.digitBall}>
                <Text style={styles.digitText}>{d3}</Text>
              </View>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustDigit(3, -1)}>
                <Ionicons name="chevron-down" size={22} color="#1A5EC2" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Digit Presets */}
          <View style={styles.presetsRow}>
            <TouchableOpacity style={styles.presetBtn} onPress={() => { setD1(7); setD2(4); setD3(2); }}>
              <Text style={styles.presetText}>7-4-2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => { setD1(9); setD2(1); setD3(5); }}>
              <Text style={styles.presetText}>9-1-5</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => { setD1(0); setD2(0); setD3(0); }}>
              <Text style={styles.presetText}>0-0-0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetBtn} onPress={() => { setD1(3); setD2(8); setD3(8); }}>
              <Text style={styles.presetText}>3-8-8</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Combination Score Gauge */}
        <ScoreGauge breakdown={breakdown} />

        {/* Detailed Breakdown Cards */}
        <BreakdownCard breakdown={breakdown} onApplyTweak={handleApplyTweak} />

        {/* Add to My Tickets Tracker Action */}
        <TouchableOpacity style={styles.trackerBtn} onPress={handleSaveTicket}>
          <Ionicons name="ticket" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.trackerBtnText}>Track Combination `{comboStr}`</Text>
        </TouchableOpacity>

        {/* Entertainment Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.disclaimerText}>
            Disclaimer: Draw winning numbers are generated randomly by PCSO. Ratings are calculated based on historical draw statistics for strategy insights.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  standaloneTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  standaloneTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: '#DBEAFE',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  randomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  randomBtnText: {
    color: '#0F449E',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
  },
  filterChipText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#0F449E',
    fontWeight: '900',
  },
  container: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  playTypeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#0F449E',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 6,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2EAF1',
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  digitColumn: {
    alignItems: 'center',
  },
  stepBtn: {
    padding: 6,
  },
  digitBall: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1A5EC2',
    shadowColor: '#1A5EC2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  digitText: {
    color: '#0F172A',
    fontSize: 32,
    fontWeight: '900',
  },
  digitSeparator: {
    fontSize: 28,
    fontWeight: '800',
    color: '#CBD5E1',
    marginHorizontal: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
  },
  presetBtn: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  trackerBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    marginVertical: 8,
  },
  trackerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 15,
  },
});
