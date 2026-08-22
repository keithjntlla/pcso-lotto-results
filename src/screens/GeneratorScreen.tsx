import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getLocalResults } from '../utils/storage';
import {
  getRepeatingCombinations,
  getOverdueCombinations,
  getComboAnalytics,
  ComboStat,
  RepeatingSortOption,
  OverdueSortOption,
  PatternFilterOption,
} from '../utils/stats';
import { addMyTicket } from '../utils/tickets';
import { formatShortDate } from '../data/seedData';

export default function GeneratorScreen() {
  const [digits, setDigits] = useState<string[]>(['?', '?', '?']);
  const [isRolling, setIsRolling] = useState(false);
  const [generatedCombo, setGeneratedCombo] = useState<string | null>(null);

  // Filter & Stats states
  const [comboType, setComboType] = useState<'unreleased' | 'repeating' | null>(null);
  const [fullComboList, setFullComboList] = useState<ComboStat[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [statsSummary, setStatsSummary] = useState<string>('');
  const [lastMode, setLastMode] = useState<'quick' | 'unreleased' | 'repeating'>('quick');

  // Filter toggle collapse state
  const [showFilters, setShowFilters] = useState(false);

  // Sorting pill states
  const [repeatingSort, setRepeatingSort] = useState<RepeatingSortOption>('freq_desc');
  const [overdueSort, setOverdueSort] = useState<OverdueSortOption>('overdue_desc');
  const [patternFilter, setPatternFilter] = useState<PatternFilterOption>('all');

  // Accordion Expand state
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);

  // Ticket Integration states
  const [drawTime, setDrawTime] = useState<'2PM' | '5PM' | '9PM'>('2PM');
  const [playType, setPlayType] = useState<'Standard' | 'Rambolito'>('Standard');

  const rollBalls = (
    finalDigits: string[],
    mode: 'quick' | 'unreleased' | 'repeating',
    summaryText: string
  ) => {
    if (isRolling) return;
    setLastMode(mode);
    setStatsSummary('');
    setGeneratedCombo(null);

    // Display immediately without shuffling for Overdue and Repeating modes
    if (mode !== 'quick') {
      setDigits(finalDigits);
      setGeneratedCombo(finalDigits.join('-'));
      setStatsSummary(summaryText);
      setIsRolling(false);
      return;
    }

    // Shuffling animation (Quick Pick only)
    setIsRolling(true);
    let rollsCount = 0;
    const maxRolls = 20; // 20 updates * 60ms = ~1.2 seconds of animation

    const interval = setInterval(() => {
      setDigits([
        Math.floor(Math.random() * 10).toString(),
        Math.floor(Math.random() * 10).toString(),
        Math.floor(Math.random() * 10).toString(),
      ]);

      rollsCount++;
      if (rollsCount >= maxRolls) {
        clearInterval(interval);
        setDigits(finalDigits);
        setGeneratedCombo(finalDigits.join('-'));
        setStatsSummary(summaryText);
        setIsRolling(false);
      }
    }, 60);
  };

  const handleQuickPick = () => {
    setFullComboList([]);
    setComboType(null);
    setExpandedCombo(null);
    setShowFilters(false);
    const final = [
      Math.floor(Math.random() * 10).toString(),
      Math.floor(Math.random() * 10).toString(),
      Math.floor(Math.random() * 10).toString(),
    ];
    rollBalls(final, 'quick', 'Combination generated using absolute random selection.');
  };

  const handleTopPick = async (
    type: 'unreleased' | 'repeating',
    repSort = repeatingSort,
    ovrSort = overdueSort,
    patFilter = patternFilter
  ) => {
    try {
      const results = await getLocalResults();
      const list =
        type === 'unreleased'
          ? getOverdueCombinations(results, ovrSort, patFilter)
          : getRepeatingCombinations(results, repSort, patFilter);

      setFullComboList(list);
      setComboType(type);
      setVisibleLimit(10);
      setExpandedCombo(null);

      if (list.length === 0) {
        Alert.alert('No Data', 'No combinations available in history for this filter.');
        return;
      }

      // Pick top #1 item by default when clicking generator button
      const topItem = list[0];
      const final = topItem.combination.split('-');

      const lastDrawnText = topItem.lastDrawnDate
        ? formatShortDate(topItem.lastDrawnDate).date
        : 'Never';

      let daysText = 'Never';
      if (type === 'unreleased') {
        if (ovrSort === 'rambolito_overdue' && topItem.rambolitoDaysOverdue && topItem.rambolitoDaysOverdue < 90000) {
          daysText = `${topItem.rambolitoDaysOverdue.toLocaleString()}d ago (Any Order)`;
        } else if (topItem.daysOverdue && topItem.daysOverdue < 90000) {
          daysText = `${topItem.daysOverdue.toLocaleString()}d ago`;
        }
      }

      const summary =
        type === 'unreleased'
          ? `Overdue #1: ${topItem.combination} • Last: ${lastDrawnText} (${daysText})`
          : `Repeating #1: ${topItem.combination} • Last: ${lastDrawnText} (${repSort === 'rambolito_freq' ? `${topItem.rambolitoCount}x Any Order` : `${topItem.count}x`})`;

      rollBalls(final, type, summary);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to generate combinations from draw history.');
    }
  };

  const handleSortChange = (
    type: 'unreleased' | 'repeating',
    newRepSort?: RepeatingSortOption,
    newOvrSort?: OverdueSortOption
  ) => {
    if (newRepSort) setRepeatingSort(newRepSort);
    if (newOvrSort) setOverdueSort(newOvrSort);
    handleTopPick(type, newRepSort || repeatingSort, newOvrSort || overdueSort, patternFilter);
  };

  const handlePatternFilterChange = (filter: PatternFilterOption) => {
    setPatternFilter(filter);
    if (comboType) {
      handleTopPick(comboType, repeatingSort, overdueSort, filter);
    }
  };

  const handleSelectFromList = (item: ComboStat, rank: number) => {
    if (isRolling) return;
    const final = item.combination.split('-');
    const lastDrawnText = item.lastDrawnDate
      ? formatShortDate(item.lastDrawnDate).date
      : 'Never';

    let daysText = 'Never';
    if (comboType === 'unreleased') {
      if (overdueSort === 'rambolito_overdue' && item.rambolitoDaysOverdue && item.rambolitoDaysOverdue < 90000) {
        daysText = `${item.rambolitoDaysOverdue.toLocaleString()}d ago (Any Order)`;
      } else if (item.daysOverdue && item.daysOverdue < 90000) {
        daysText = `${item.daysOverdue.toLocaleString()}d ago`;
      }
    }

    const summary =
      comboType === 'unreleased'
        ? `Overdue #${rank}: ${item.combination} • Last: ${lastDrawnText} (${daysText})`
        : `Repeating #${rank}: ${item.combination} • Last: ${lastDrawnText} (${repeatingSort === 'rambolito_freq' ? `${item.rambolitoCount}x Any Order` : `${item.count}x`})`;

    rollBalls(final, comboType || 'quick', summary);
  };

  const toggleExpand = (combo: string) => {
    setExpandedCombo((prev) => (prev === combo ? null : combo));
  };

  const handleAddToTracker = async () => {
    if (!generatedCombo) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const results = await getLocalResults();

      const digitsArr = generatedCombo.split('-');
      const isAllIdentical = digitsArr[0] === digitsArr[1] && digitsArr[1] === digitsArr[2];
      const finalPlayType = isAllIdentical ? 'Standard' : playType;

      await addMyTicket(
        {
          date: todayStr,
          drawTime,
          combination: generatedCombo,
          playType: finalPlayType,
        },
        results
      );

      if (Platform.OS === 'android') {
        if (isAllIdentical && playType === 'Rambolito') {
          ToastAndroid.show('Added as Standard play (identical digits)!', ToastAndroid.LONG);
        } else {
          ToastAndroid.show('Added to My Tickets tracker!', ToastAndroid.SHORT);
        }
      } else {
        if (isAllIdentical && playType === 'Rambolito') {
          Alert.alert('Success', 'Combination added as Standard play (identical numbers cannot be Rambolito).');
        } else {
          Alert.alert('Success', 'Combination added to My Tickets tracker.');
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add ticket to tracker.');
    }
  };

  // Ball themes mapping based on last mode for aesthetics
  const getBallColors = () => {
    if (isRolling) return ['#FFFFFF', '#D9E2EC', '#9FB3C8'] as const;
    if (lastMode === 'unreleased') return ['#FFFFFF', '#A9B9C9', '#1A5EC2'] as const;
    if (lastMode === 'repeating') return ['#FFFFFF', '#E1ACAC', '#AE5E5E'] as const;
    return ['#FFFFFF', '#E6D39E', '#C0A045'] as const;
  };

  const getBallTextColor = () => {
    if (isRolling) return '#102A43';
    if (lastMode === 'unreleased') return '#0B1B3D';
    if (lastMode === 'repeating') return '#4A1515';
    return '#4D3A0A';
  };

  const ballColors = getBallColors();
  const ballTextColor = getBallTextColor();

  // Slice visible items
  const visibleCombos = fullComboList.slice(0, visibleLimit);
  const hasMoreCombos = fullComboList.length > visibleLimit;

  return (
    <View style={styles.container}>
      {/* Pinned Ball Card (Top Layer 3: zIndex 20, elevation 12) */}
      <View style={styles.pinnedBallsWrapper} pointerEvents="box-none">
        <View style={styles.ballsPanel}>
          <View style={styles.ballsRow}>
            {digits.map((digit, idx) => (
              <View key={idx} style={styles.ballShadowWrapper}>
                <LinearGradient
                  colors={ballColors}
                  start={{ x: 0.15, y: 0.15 }}
                  end={{ x: 0.85, y: 0.85 }}
                  style={styles.ball}
                >
                  <View style={styles.ballHighlightSoft} />
                  <View style={styles.ballHighlightHotspot} />
                  <Text style={[styles.ballText, { color: ballTextColor }]}>{digit}</Text>
                </LinearGradient>
              </View>
            ))}
          </View>

          {statsSummary ? (
            <View style={styles.summaryContainer}>
              <Ionicons
                name={
                  lastMode === 'unreleased'
                    ? 'hourglass-outline'
                    : lastMode === 'repeating'
                    ? 'repeat'
                    : 'information-circle'
                }
                size={16}
                color={
                  lastMode === 'unreleased'
                    ? '#1A5EC2'
                    : lastMode === 'repeating'
                    ? '#BA3C3C'
                    : '#5F738E'
                }
                style={{ marginRight: 6 }}
              />
              <Text style={styles.summaryText}>{statsSummary}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Scrollable Content (Bottom Layer 1: zIndex 1, elevation 2) */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Action Panel */}
        <View style={styles.actionsCard}>
          <Text style={styles.panelTitle}>Choose Generator Mode</Text>

          {/* Quick Pick (Large primary button) */}
          <TouchableOpacity
            onPress={handleQuickPick}
            style={[styles.primaryBtn, isRolling && styles.disabledBtn]}
            disabled={isRolling}
            activeOpacity={0.85}
          >
            <Ionicons name="shuffle" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Quick Pick (Random)</Text>
          </TouchableOpacity>

          {/* Stat-Based Buttons (Overdue = Blue, Repeating = Red #BA3C3C) */}
          <View style={styles.statsRow}>
            {/* Overdue Button (Blue) */}
            <TouchableOpacity
              onPress={() => handleTopPick('unreleased')}
              style={[
                styles.statBtn,
                styles.unreleasedBtn,
                comboType === 'unreleased' && styles.activeUnreleasedBtn,
                isRolling && styles.disabledBtn,
              ]}
              disabled={isRolling}
              activeOpacity={0.8}
            >
              <Text style={styles.unreleasedBtnText}>Overdue</Text>
            </TouchableOpacity>

            {/* Repeating Button (Red #BA3C3C from Today Screen) */}
            <TouchableOpacity
              onPress={() => handleTopPick('repeating')}
              style={[
                styles.statBtn,
                styles.repeatingBtn,
                comboType === 'repeating' && styles.activeRepeatingBtn,
                isRolling && styles.disabledBtn,
              ]}
              disabled={isRolling}
              activeOpacity={0.8}
            >
              <Text style={styles.repeatingBtnText}>Repeating</Text>
            </TouchableOpacity>
          </View>

          {/* Database Notice */}
          <View style={styles.dbNoticeBox}>
            <Ionicons name="information-circle-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.dbNoticeText}>
              Calculated using official PCSO draw results from 2016 to 2026.
            </Text>
          </View>
        </View>

        {/* Interactive Combinations List Card */}
        {fullComboList.length > 0 && comboType && (
          <View style={styles.top10Card}>
            <View style={styles.top10HeaderSection}>
              {/* Card Header with Title and Filter Button */}
              <View style={styles.top10TitleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={comboType === 'unreleased' ? 'hourglass-outline' : 'repeat'}
                    size={18}
                    color={comboType === 'unreleased' ? '#1A5EC2' : '#BA3C3C'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.top10Title}>
                    {comboType === 'unreleased'
                      ? 'Longest Overdue Combinations'
                      : 'Commonly Repeating Results'}
                  </Text>
                </View>

                {/* Filter Toggle Button */}
                <TouchableOpacity
                  onPress={() => setShowFilters((prev) => !prev)}
                  style={[
                    styles.filterToggleBtn,
                    showFilters &&
                      (comboType === 'unreleased'
                        ? styles.filterToggleBtnActiveUnreleased
                        : styles.filterToggleBtnActiveRepeating),
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="funnel"
                    size={12}
                    color={showFilters ? '#FFFFFF' : '#475569'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>
                    Filter
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Filter & Sort Pills Container (Toggled via Filter Button) */}
              {showFilters && (
                <View style={styles.filterPillsContainer}>
                  {/* Row 1: Sort Options */}
                  <View style={styles.filterPillsRow}>
                    <Text style={styles.filterLabel}>Sort:</Text>
                    {comboType === 'repeating' ? (
                      <>
                        <TouchableOpacity
                          onPress={() => handleSortChange('repeating', 'freq_desc')}
                          style={[
                            styles.filterPill,
                            repeatingSort === 'freq_desc' && styles.activeFilterPillRepeating,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              repeatingSort === 'freq_desc' && styles.activeFilterPillText,
                            ]}
                          >
                            Exact Order
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleSortChange('repeating', 'rambolito_freq')}
                          style={[
                            styles.filterPill,
                            repeatingSort === 'rambolito_freq' && styles.activeFilterPillRepeating,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              repeatingSort === 'rambolito_freq' && styles.activeFilterPillText,
                            ]}
                          >
                            Rambolito (Any Order)
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleSortChange('repeating', 'score_desc')}
                          style={[
                            styles.filterPill,
                            repeatingSort === 'score_desc' && styles.activeFilterPillRepeating,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              repeatingSort === 'score_desc' && styles.activeFilterPillText,
                            ]}
                          >
                            Digit Score
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => handleSortChange('unreleased', undefined, 'overdue_desc')}
                          style={[
                            styles.filterPill,
                            overdueSort === 'overdue_desc' && styles.activeFilterPillUnreleased,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              overdueSort === 'overdue_desc' && styles.activeFilterPillText,
                            ]}
                          >
                            Exact Order
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleSortChange('unreleased', undefined, 'rambolito_overdue')}
                          style={[
                            styles.filterPill,
                            overdueSort === 'rambolito_overdue' && styles.activeFilterPillUnreleased,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              overdueSort === 'rambolito_overdue' && styles.activeFilterPillText,
                            ]}
                          >
                            Rambolito (Any Order)
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleSortChange('unreleased', undefined, 'score_desc')}
                          style={[
                            styles.filterPill,
                            overdueSort === 'score_desc' && styles.activeFilterPillUnreleased,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterPillText,
                              overdueSort === 'score_desc' && styles.activeFilterPillText,
                            ]}
                          >
                            Digit Score
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  {/* Row 2: Pattern Filter Toggle (Applicable for both Overdue & Repeating) */}
                  <View style={[styles.filterPillsRow, { marginTop: 6 }]}>
                    <Text style={styles.filterLabel}>Type:</Text>
                    {(['all', 'single', 'double'] as PatternFilterOption[]).map((filter) => {
                      const isActive = patternFilter === filter;
                      const labelMap: Record<PatternFilterOption, string> = {
                        all: 'All Types',
                        single: 'Singles Only',
                        double: 'Doubles Only',
                        triple: 'Triples Only',
                      };
                      return (
                        <TouchableOpacity
                          key={filter}
                          onPress={() => handlePatternFilterChange(filter)}
                          style={[
                            styles.filterPill,
                            isActive &&
                              (comboType === 'unreleased'
                                ? styles.activeTypeFilterPillUnreleased
                                : styles.activeTypeFilterPillRepeating),
                          ]}
                        >
                          <Text style={[styles.filterPillText, isActive && styles.activeFilterPillText]}>
                            {labelMap[filter]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* List Items */}
            <View style={styles.comboListContainer}>
              {visibleCombos.map((item, index) => {
                const isSelected = generatedCombo === item.combination;
                const isExpanded = expandedCombo === item.combination;
                const rank = index + 1;
                const analytics = getComboAnalytics(item.combination);

                const lastDrawnText = item.lastDrawnDate
                  ? formatShortDate(item.lastDrawnDate).date
                  : 'Never';

                let daysText = 'Never';
                if (comboType === 'unreleased') {
                  if (overdueSort === 'rambolito_overdue' && item.rambolitoDaysOverdue && item.rambolitoDaysOverdue < 90000) {
                    daysText = `${item.rambolitoDaysOverdue.toLocaleString()}d ago`;
                  } else if (item.daysOverdue && item.daysOverdue < 90000) {
                    daysText = `${item.daysOverdue.toLocaleString()}d ago`;
                  }
                }

                // Compute 2PM, 5PM, 9PM breakdown
                const count2pm = item.drawDetails.filter((d) => d.drawTime === '2PM').length;
                const count5pm = item.drawDetails.filter((d) => d.drawTime === '5PM').length;
                const count9pm = item.drawDetails.filter((d) => d.drawTime === '9PM').length;
                const totalDrawHits = count2pm + count5pm + count9pm;

                const pct2pm = totalDrawHits > 0 ? Math.round((count2pm / totalDrawHits) * 100) : 0;
                const pct5pm = totalDrawHits > 0 ? Math.round((count5pm / totalDrawHits) * 100) : 0;
                const pct9pm = totalDrawHits > 0 ? Math.round((count9pm / totalDrawHits) * 100) : 0;

                return (
                  <View
                    key={item.combination}
                    style={[
                      styles.comboItemCard,
                      isSelected &&
                        (comboType === 'unreleased'
                          ? styles.comboItemSelectedUnreleased
                          : styles.comboItemSelectedRepeating),
                    ]}
                  >
                    {/* Main Row */}
                    <View style={styles.comboItemMainRow}>
                      <TouchableOpacity
                        onPress={() => handleSelectFromList(item, rank)}
                        disabled={isRolling}
                        style={styles.comboItemLeftContent}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.rankBadge,
                            isSelected &&
                              (comboType === 'unreleased'
                                ? styles.rankBadgeActiveUnreleased
                                : styles.rankBadgeActiveRepeating),
                          ]}
                        >
                          <Text style={[styles.rankText, isSelected && styles.rankTextActive]}>
                            #{rank}
                          </Text>
                        </View>

                        <Text style={[styles.comboText, isSelected && styles.comboTextSelected]}>
                          {item.combination}
                        </Text>

                        {/* Display Date Last Drawn + Days Overdue / Repeat Counts */}
                        <View style={styles.lastDrawnBadge}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={item.lastDrawnDate ? '#1A5EC2' : '#94A3B8'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.lastDrawnText,
                              !item.lastDrawnDate && styles.neverDrawnText,
                            ]}
                          >
                            {comboType === 'unreleased'
                              ? overdueSort === 'rambolito_overdue'
                                ? `Any Order: ${daysText}`
                                : `Last: ${lastDrawnText} • ${daysText}`
                              : repeatingSort === 'rambolito_freq'
                              ? `Any Order: ${item.rambolitoCount}x`
                              : `Last: ${lastDrawnText} (${item.count}x)`}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expand Button */}
                      <TouchableOpacity
                        onPress={() => toggleExpand(item.combination)}
                        style={styles.expandBtn}
                        activeOpacity={0.6}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Expandable Detailed Breakdown Section (Combined Option 1 & Option 2) */}
                    {isExpanded && (
                      <View style={styles.breakdownSection}>
                        {/* Section 1: Draw Time Distribution Heatmap */}
                        <Text style={styles.breakdownTitle}>
                          Draw Time Distribution ({item.count} Total Hits)
                        </Text>
                        <View style={styles.timeDistributionRow}>
                          <View style={[styles.timeChip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                            <Text style={[styles.timeChipTitle, { color: '#1A5EC2' }]}>2PM DRAW</Text>
                            <Text style={[styles.timeChipValue, { color: '#1E3A8A' }]}>
                              {count2pm}x <Text style={styles.pctText}>({pct2pm}%)</Text>
                            </Text>
                          </View>

                          <View style={[styles.timeChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                            <Text style={[styles.timeChipTitle, { color: '#B45309' }]}>5PM DRAW</Text>
                            <Text style={[styles.timeChipValue, { color: '#78350F' }]}>
                              {count5pm}x <Text style={styles.pctText}>({pct5pm}%)</Text>
                            </Text>
                          </View>

                          <View style={[styles.timeChip, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                            <Text style={[styles.timeChipTitle, { color: '#B91C1C' }]}>9PM DRAW</Text>
                            <Text style={[styles.timeChipValue, { color: '#7F1D1D' }]}>
                              {count9pm}x <Text style={styles.pctText}>({pct9pm}%)</Text>
                            </Text>
                          </View>
                        </View>

                        {/* Section 2: Combination Pattern Analytics */}
                        <Text style={[styles.breakdownTitle, { marginTop: 10 }]}>
                          Pattern & Math Analytics
                        </Text>
                        <View style={styles.analyticsGrid}>
                          <View style={styles.analyticBadge}>
                            <Text style={styles.analyticLabel}>PATTERN</Text>
                            <Text style={styles.analyticVal}>{analytics.patternType}</Text>
                          </View>
                          <View style={styles.analyticBadge}>
                            <Text style={styles.analyticLabel}>DIGIT SUM</Text>
                            <Text style={styles.analyticVal}>{analytics.sum}</Text>
                          </View>
                          <View style={styles.analyticBadge}>
                            <Text style={styles.analyticLabel}>ODD / EVEN</Text>
                            <Text style={styles.analyticVal}>{analytics.oddCount}O / {analytics.evenCount}E</Text>
                          </View>
                          <View style={styles.analyticBadge}>
                            <Text style={styles.analyticLabel}>HIGH / LOW</Text>
                            <Text style={styles.analyticVal}>{analytics.highCount}H / {analytics.lowCount}L</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Load More Button */}
            {hasMoreCombos && (
              <TouchableOpacity
                onPress={() => setVisibleLimit((prev) => prev + 10)}
                style={styles.loadMoreBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.loadMoreText}>Show More Combinations (+10)</Text>
                <Ionicons name="chevron-down" size={16} color="#0F449E" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tickets Integration Option */}
        {generatedCombo && (
          <View style={styles.integrationCard}>
            <Text style={styles.panelTitle}>Save to My Tickets</Text>
            <Text style={styles.cardSubtitle}>
              Instantly track this combination ({generatedCombo}) for today's draws in your ticket list.
            </Text>

            {/* Select settings row */}
            <View style={styles.optionsGrid}>
              <View style={styles.optionCol}>
                <Text style={styles.optionLabel}>Draw Time</Text>
                <View style={styles.pillsRow}>
                  {(['2PM', '5PM', '9PM'] as const).map((time) => (
                    <TouchableOpacity
                      key={time}
                      onPress={() => setDrawTime(time)}
                      style={[styles.optionPill, drawTime === time && styles.activeOptionPill]}
                    >
                      <Text style={[styles.optionPillText, drawTime === time && styles.activeOptionPillText]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionCol}>
                <Text style={styles.optionLabel}>Play Type</Text>
                <View style={styles.pillsRow}>
                  {(['Standard', 'Rambolito'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setPlayType(type)}
                      style={[styles.optionPill, playType === type && styles.activeOptionPill]}
                    >
                      <Text style={[styles.optionPillText, playType === type && styles.activeOptionPillText]}>
                        {type === 'Standard' ? 'Exact' : 'Any'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={handleAddToTracker} style={styles.trackerBtn} activeOpacity={0.85}>
              <Ionicons name="ticket-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.trackerBtnText}>Add to My Tickets Tracker</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    position: 'relative',
  },
  pinnedBallsWrapper: {
    position: 'absolute',
    top: -25,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 12,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingTop: 168,
    paddingBottom: 40,
  },
  ballsPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2EAF1',
    // Shadow
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  ballsRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballShadowWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  ball: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ballHighlightSoft: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 56,
    height: 28,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ rotate: '-30deg' }],
  },
  ballHighlightHotspot: {
    position: 'absolute',
    top: 8,
    left: 12,
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  ballText: {
    fontSize: 26,
    fontWeight: '900',
    zIndex: 1,
    marginTop: -2,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2EAF1',
  },
  summaryText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    // Shadow
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  primaryBtn: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#0F449E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F449E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  statBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  unreleasedBtn: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  activeUnreleasedBtn: {
    borderColor: '#1A5EC2',
    backgroundColor: '#E8F2FF',
    borderWidth: 2,
  },
  unreleasedBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  repeatingBtn: {
    borderColor: '#F9E2E2',
    backgroundColor: '#FDF2F2',
  },
  activeRepeatingBtn: {
    borderColor: '#BA3C3C',
    backgroundColor: '#FDF2F2',
    borderWidth: 2,
  },
  repeatingBtnText: {
    color: '#BA3C3C',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  dbNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dbNoticeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  top10Card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  top10HeaderSection: {
    marginBottom: 12,
  },
  top10TitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  top10Title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  filterToggleBtnActiveUnreleased: {
    backgroundColor: '#1A5EC2',
    borderColor: '#1A5EC2',
  },
  filterToggleBtnActiveRepeating: {
    backgroundColor: '#BA3C3C',
    borderColor: '#BA3C3C',
  },
  filterToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterToggleTextActive: {
    color: '#FFFFFF',
  },
  filterPillsContainer: {
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 4,
  },
  filterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterPillRepeating: {
    backgroundColor: '#BA3C3C',
    borderColor: '#BA3C3C',
  },
  activeFilterPillUnreleased: {
    backgroundColor: '#1A5EC2',
    borderColor: '#1A5EC2',
  },
  activeTypeFilterPillUnreleased: {
    backgroundColor: '#1A5EC2',
    borderColor: '#1A5EC2',
  },
  activeTypeFilterPillRepeating: {
    backgroundColor: '#BA3C3C',
    borderColor: '#BA3C3C',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  activeFilterPillText: {
    color: '#FFFFFF',
  },
  comboListContainer: {
    gap: 8,
  },
  comboItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  comboItemSelectedUnreleased: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1A5EC2',
    borderWidth: 2,
  },
  comboItemSelectedRepeating: {
    backgroundColor: '#FDF2F2',
    borderColor: '#BA3C3C',
    borderWidth: 2,
  },
  comboItemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  comboItemLeftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    backgroundColor: '#CBD5E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  rankBadgeActiveUnreleased: {
    backgroundColor: '#1A5EC2',
  },
  rankBadgeActiveRepeating: {
    backgroundColor: '#BA3C3C',
  },
  rankText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  rankTextActive: {
    color: '#FFFFFF',
  },
  comboText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
    marginRight: 10,
    letterSpacing: 0.5,
  },
  comboTextSelected: {
    color: '#0F172A',
  },
  lastDrawnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lastDrawnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  neverDrawnText: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  expandBtn: {
    padding: 6,
    marginLeft: 4,
  },
  breakdownSection: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 12,
  },
  breakdownTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  timeDistributionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeChipTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  timeChipValue: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
  pctText: {
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.8,
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  analyticBadge: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  analyticLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.2,
  },
  analyticVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 2,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F449E',
  },
  integrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14,
    fontWeight: '500',
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  optionCol: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  optionPill: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOptionPill: {
    borderColor: '#0F449E',
    backgroundColor: '#EFF6FF',
  },
  optionPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  activeOptionPillText: {
    color: '#0F449E',
  },
  trackerBtn: {
    flexDirection: 'row',
    height: 46,
    backgroundColor: '#10B981',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  trackerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
