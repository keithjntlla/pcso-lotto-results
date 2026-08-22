import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import SearchResultCard from '../components/SearchResultCard';
import { DrawResult, seedResults, formatShortDate } from '../data/seedData';
import { getLocalResults, getOrFetchDateResult, syncLottoResults, getTodayISO } from '../utils/storage';

type FilterType = 'All' | '2PM' | '5PM' | '9PM';

interface SearchMatch {
  date: string;
  drawTime: '2PM' | '5PM' | '9PM';
  result: string;
}

function formatDateToLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HistoryScreen() {
  const [allResults, setAllResults] = useState<DrawResult[]>(seedResults);
  const [filteredResults, setFilteredResults] = useState<DrawResult[]>(seedResults);
  const [loading, setLoading] = useState(false);
  const [fetchingDate, setFetchingDate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search, Filters & Date Picker states
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchMode, setSearchMode] = useState<'exact' | 'any'>('exact');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Pagination states
  const [visibleCount, setVisibleCount] = useState(8);

  // Load results from storage
  const loadData = async () => {
    try {
      const local = await getLocalResults();
      setAllResults(local);
      setFilteredResults(local);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { results: updatedResults } = await syncLottoResults();
      setAllResults(updatedResults);
      setFilteredResults(updatedResults);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadData();

    // Auto-sync / reload from local storage periodically to reflect background updates
    const interval = setInterval(() => {
      getLocalResults()
        .then((latest) => {
          if (isMounted) {
            setAllResults(latest);
          }
        })
        .catch(console.error);
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Filter & Search Logic + On-Demand Historical Date Fetching
  useEffect(() => {
    let isMounted = true;
    let temp = [...allResults];

    if (selectedDate) {
      // Guard: Dates before 2016 are out of coverage
      if (selectedDate.getFullYear() < 2016) {
        setFetchingDate(false);
        setFilteredResults([]);
        return;
      }

      const selectedISO = formatDateToLocalISO(selectedDate);
      const match = temp.find((item) => item.date === selectedISO);
      const todayISO = getTodayISO();

      const isComplete = match && match.draw2pm !== '--' && match.draw5pm !== '--' && match.draw9pm !== '--';
      const isToday = selectedISO === todayISO;

      if (!match || !isComplete || isToday) {
        setFetchingDate(true);
        const fetchFn = typeof getOrFetchDateResult === 'function' ? getOrFetchDateResult : getLocalResults;

        Promise.resolve(fetchFn(selectedISO))
          .then((res: any) => {
            if (isMounted && res && res.date) {
              setAllResults((prev) => {
                const rest = prev.filter((r) => r.date !== res.date);
                return [...rest, res].sort((a, b) => b.date.localeCompare(a.date));
              });
            }
          })
          .catch(console.error)
          .finally(() => {
            if (isMounted) setFetchingDate(false);
          });
      } else {
        setFetchingDate(false);
      }

      temp = temp.filter((item) => item.date === selectedISO);
    } else {
      setFetchingDate(false);
    }

    setFilteredResults(temp);
    setVisibleCount(8);

    return () => {
      isMounted = false;
    };
  }, [allResults, selectedDate]);

  // Compute Search Matches
  const searchMatches: SearchMatch[] = [];
  if (searchQuery.trim().length > 0) {
    const queryClean = searchQuery.trim().replace(/-/g, '');
    const querySorted = queryClean.split('').sort().join('');

    allResults.forEach((item) => {
      const matchCheck = (val: string, time: '2PM' | '5PM' | '9PM') => {
        if (!val || val === '--') return;
        const valClean = val.replace(/-/g, '');
        if (searchMode === 'exact') {
          if (valClean === queryClean) {
            searchMatches.push({ date: item.date, drawTime: time, result: val });
          }
        } else {
          const valSorted = valClean.split('').sort().join('');
          if (valSorted === querySorted) {
            searchMatches.push({ date: item.date, drawTime: time, result: val });
          }
        }
      };

      matchCheck(item.draw2pm, '2PM');
      matchCheck(item.draw5pm, '5PM');
      matchCheck(item.draw9pm, '9PM');
    });
  }

  // Filter search results based on active time and date filters
  let filteredSearchMatches = searchMatches;
  if (selectedDate) {
    const selectedISO = formatDateToLocalISO(selectedDate);
    filteredSearchMatches = filteredSearchMatches.filter((match) => match.date === selectedISO);
  }
  if (activeFilter !== 'All') {
    filteredSearchMatches = filteredSearchMatches.filter((match) => match.drawTime === activeFilter);
  }

  // Date picker handlers
  const handleDateValueChange = (event: any, date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleDatePickerDismiss = () => {
    setShowDatePicker(false);
  };

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate || new Date(),
        onValueChange: (event: any, date?: Date) => {
          if (date) {
            setSelectedDate(date);
          }
        },
        onDismiss: () => {},
        mode: 'date',
        maximumDate: new Date(),
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  // Helper to render tiny lotto balls for the list row
  const renderTinyBalls = (result: string, time: '2PM' | '5PM' | '9PM') => {
    if (activeFilter !== 'All' && activeFilter !== time) {
      return null;
    }

    if (!result || result === '--') {
      return (
        <View style={styles.emptyBallsContainer}>
          <Text style={styles.emptyBallsText}>--</Text>
        </View>
      );
    }

    const digits = result.split('-');

    let ballStart = '#A9B9C9';
    let ballEnd = '#627A90';
    let textColor = '#0B1B3D';
    let borderColor = '#9FB3C8';

    if (time === '5PM') {
      ballStart = '#E6D39E';
      ballEnd = '#C0A045';
      textColor = '#4D3A0A';
      borderColor = '#DFCA90';
    } else if (time === '9PM') {
      ballStart = '#E1ACAC';
      ballEnd = '#AE5E5E';
      textColor = '#4A1515';
      borderColor = '#DCA2A2';
    }

    return (
      <View style={styles.tinyBallsContainer}>
        {digits.map((d, idx) => (
          <LinearGradient
            key={idx}
            colors={['#FFFFFF', ballStart, ballEnd] as [string, string, string]}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
            style={[styles.tinyBall, { borderColor: borderColor }]}
          >
            <View style={styles.tinyBallReflection} />
            <Text style={[styles.tinyBallText, { color: textColor }]}>{d}</Text>
          </LinearGradient>
        ))}
      </View>
    );
  };

  // Render a row in the history list
  const renderHistoryRow = ({ item }: { item: DrawResult }) => {
    const { date, day } = formatShortDate(item.date);

    return (
      <View style={styles.tableRow}>
        {/* Date Column */}
        <View style={styles.dateCol}>
          <Text style={styles.rowDateText}>{date}</Text>
          <Text style={styles.rowDayText}>{day}</Text>
        </View>

        {/* 2PM Column */}
        <View style={styles.drawCol}>{renderTinyBalls(item.draw2pm, '2PM')}</View>

        {/* 5PM Column */}
        <View style={styles.drawCol}>{renderTinyBalls(item.draw5pm, '5PM')}</View>

        {/* 9PM Column */}
        <View style={styles.drawCol}>{renderTinyBalls(item.draw9pm, '9PM')}</View>
      </View>
    );
  };

  // Get data to show based on visibleCount pagination
  const dataToShow = filteredResults.slice(0, visibleCount);
  const hasMore = filteredResults.length > visibleCount;

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#0A358C" style={{ transform: [{ scale: 1.2 }] }} />
          <Text style={styles.loadingText}>Loading draw history...</Text>
        </View>
      ) : (
        <FlatList
          data={searchQuery.trim().length > 0 ? [] : dataToShow}
          renderItem={renderHistoryRow}
          keyExtractor={(item) => item.date}
          keyboardShouldPersistTaps="handled"
          style={styles.flatList}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0F449E']}
              tintColor="#0F449E"
            />
          }
          ListHeaderComponent={
            <>
              {/* Floating Search & Filters Card */}
              <View style={styles.searchCardContainer}>
                <View style={styles.searchCard}>
                  {/* Search Box */}
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search number (e.g. 426, 123)"
                      placeholderTextColor="#94A3B8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    )}

                    {/* Filter Icon Button inside Search Box */}
                    <TouchableOpacity
                      onPress={() => setShowFilters((prev) => !prev)}
                      style={[styles.filterIconBtn, showFilters && styles.activeFilterIconBtn]}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showFilters ? 'funnel' : 'funnel-outline'}
                        size={18}
                        color={showFilters ? '#0F449E' : '#64748B'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Collapsible Filter Section (Toggled by Filter Icon Button) */}
                  {showFilters && (
                    <View style={styles.collapsibleFiltersSection}>
                      {/* Search Mode Options */}
                      <View style={styles.searchModeContainer}>
                        <Text style={styles.searchModeLabel}>Match Type:</Text>
                        <View style={styles.searchModeOptions}>
                          <TouchableOpacity
                            onPress={() => setSearchMode('exact')}
                            style={[styles.modePill, searchMode === 'exact' && styles.activeModePill]}
                          >
                            <Text style={[styles.modePillText, searchMode === 'exact' && styles.activeModePillText]}>
                              Exact Order
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setSearchMode('any')}
                            style={[styles.modePill, searchMode === 'any' && styles.activeModePill]}
                          >
                            <Text style={[styles.modePillText, searchMode === 'any' && styles.activeModePillText]}>
                              Any Order
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Filter Pills */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterScrollView}
                        contentContainerStyle={styles.filterPillsRow}
                      >
                        {(['All', '2PM', '5PM', '9PM'] as FilterType[]).map((filter) => {
                          const isActive = activeFilter === filter;
                          return (
                            <TouchableOpacity
                              key={filter}
                              onPress={() => setActiveFilter(filter)}
                              style={[styles.pill, isActive && styles.activePill]}
                            >
                              {filter === 'All' && (
                                <Ionicons
                                  name="calendar-outline"
                                  size={14}
                                  color={isActive ? '#FFFFFF' : '#475569'}
                                  style={{ marginRight: 4 }}
                                />
                              )}
                              <Text style={[styles.pillText, isActive && styles.activePillText]}>
                                {filter === 'All' ? 'All Draws' : filter}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Table Header Row (Hidden when a search is active) */}
              {searchQuery.trim().length === 0 && (
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderSection}>
                    <Text style={styles.sectionTitle}>Recent Results</Text>

                    {/* Select Date / Calendar Button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {selectedDate && (
                        <TouchableOpacity onPress={clearDateFilter} style={styles.clearDateBtn}>
                          <Ionicons name="close-circle" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={handleOpenDatePicker}
                        style={[styles.selectDateBtn, selectedDate && styles.selectDateBtnActive]}
                      >
                        <Ionicons
                          name="calendar"
                          size={14}
                          color={selectedDate ? '#1A5EC2' : '#475569'}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.selectDateText, selectedDate && styles.selectDateTextActive]}>
                          {selectedDate
                            ? selectedDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Select Date'}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={12}
                          color={selectedDate ? '#1A5EC2' : '#475569'}
                          style={{ marginLeft: 2 }}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* On-demand fetching status indicator */}
                  {fetchingDate && (
                    <View style={styles.fetchingBadge}>
                      <ActivityIndicator size="small" color="#1A5EC2" style={{ marginRight: 6 }} />
                      <Text style={styles.fetchingText}>
                        Fetching official PCSO results for selected date...
                      </Text>
                    </View>
                  )}

                  {/* Out of Coverage Message (for dates before 2016) */}
                  {selectedDate && selectedDate.getFullYear() < 2016 && (
                    <View style={styles.outOfCoverageCard}>
                      <Ionicons name="information-circle-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.outOfCoverageText}>
                        No results available before 2016.
                      </Text>
                    </View>
                  )}

                  {/* Column labels */}
                  <View style={styles.columnLabelsRow}>
                    <View style={styles.dateCol}>
                      <Text style={[styles.colLabel, { textAlign: 'left' }]}>DATE</Text>
                    </View>
                    <View style={styles.drawCol}>
                      <Text
                        style={[
                          styles.colLabel,
                          activeFilter !== 'All' && activeFilter !== '2PM' && styles.dimmedLabel,
                        ]}
                      >
                        2PM DRAW
                      </Text>
                    </View>
                    <View style={styles.drawCol}>
                      <Text
                        style={[
                          styles.colLabel,
                          activeFilter !== 'All' && activeFilter !== '5PM' && styles.dimmedLabel,
                        ]}
                      >
                        5PM DRAW
                      </Text>
                    </View>
                    <View style={styles.drawCol}>
                      <Text
                        style={[
                          styles.colLabel,
                          activeFilter !== 'All' && activeFilter !== '9PM' && styles.dimmedLabel,
                        ]}
                      >
                        9PM DRAW
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          }
          ListFooterComponent={
            <View style={{ paddingBottom: 16 }}>
              {searchQuery.trim().length > 0 ? (
                <View style={styles.searchResultsContainer}>
                  <View style={styles.searchResultHeader}>
                    <Text style={styles.searchResultTitle}>Search Results for "{searchQuery}"</Text>
                    <View style={styles.matchCountBadge}>
                      <Text style={styles.matchCountText}>{filteredSearchMatches.length} Found</Text>
                    </View>
                  </View>

                  {filteredSearchMatches.length === 0 ? (
                    <View style={styles.noMatchCard}>
                      <Ionicons name="search-outline" size={32} color="#94A3B8" />
                      <Text style={styles.noMatchText}>No matches found for "{searchQuery}".</Text>
                    </View>
                  ) : (
                    filteredSearchMatches.map((match, index) => (
                      <SearchResultCard
                        key={`${match.date}-${match.drawTime}-${index}`}
                        date={match.date}
                        drawTime={match.drawTime}
                        result={match.result}
                      />
                    ))
                  )}

                  <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchLinkBtn}>
                    <Text style={styles.clearSearchLinkText}>Clear Search & Show History</Text>
                  </TouchableOpacity>
                </View>
              ) : hasMore ? (
                <TouchableOpacity
                  onPress={() => setVisibleCount((prev) => prev + 10)}
                  style={styles.loadMoreBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadMoreText}>Show More Draws (+10)</Text>
                  <Ionicons name="chevron-down" size={16} color="#1A5EC2" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ) : null}

              {/* Database Info Note Card */}
              <View style={styles.infoBoxBottom}>
                <Ionicons name="information-circle-outline" size={16} color="#5F738E" style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>
                  Official PCSO draw results recorded from 2016 to 2026.
                </Text>
              </View>
            </View>
          }
        />
      )}

      {/* iOS Modal Date Picker */}
      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.iosPickerContainer}>
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={handleDateValueChange}
          />
          <TouchableOpacity onPress={handleDatePickerDismiss} style={styles.iosPickerCloseBtn}>
            <Text style={styles.iosPickerCloseText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5F738E',
    marginTop: 12,
  },
  flatList: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  searchCardContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    // Shadow
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '600',
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterIconBtn: {
    padding: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    marginLeft: 6,
    borderRadius: 6,
  },
  activeFilterIconBtn: {
    backgroundColor: '#EFF6FF',
  },
  collapsibleFiltersSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterScrollView: {
    marginTop: 8,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flexShrink: 0,
  },
  activePill: {
    backgroundColor: '#0F449E',
    borderColor: '#0F449E',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activePillText: {
    color: '#FFFFFF',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  tableHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  clearDateBtn: {
    marginRight: 4,
    padding: 4,
  },
  selectDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectDateBtnActive: {
    backgroundColor: '#E8F2FF',
    borderColor: '#B9D5FF',
  },
  selectDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  selectDateTextActive: {
    color: '#1A5EC2',
  },
  outOfCoverageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  outOfCoverageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  fetchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fetchingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A5EC2',
  },
  columnLabelsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  colLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  dimmedLabel: {
    opacity: 0.35,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateCol: {
    width: 76,
    justifyContent: 'center',
  },
  rowDateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  rowDayText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  drawCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBallsContainer: {
    paddingVertical: 4,
  },
  emptyBallsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
  },
  tinyBallsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  tinyBall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  tinyBallReflection: {
    position: 'absolute',
    top: 2,
    left: 4,
    width: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.5,
    transform: [{ rotate: '-15deg' }],
  },
  tinyBallText: {
    fontSize: 11,
    fontWeight: '900',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#F1F5F9',
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A5EC2',
  },
  searchResultsContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  matchCountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  noMatchCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECEFF2',
    gap: 8,
  },
  noMatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  clearSearchLinkBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
    padding: 6,
  },
  clearSearchLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A5EC2',
  },
  searchModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  searchModeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 10,
  },
  searchModeOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modePill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeModePill: {
    backgroundColor: '#0F449E',
    borderColor: '#0F449E',
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  activeModePillText: {
    color: '#FFFFFF',
  },
  iosPickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#CBD5E1',
  },
  iosPickerCloseBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    padding: 8,
  },
  iosPickerCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F449E',
  },
  infoBoxBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF3F8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2EAF1',
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F738E',
  },
});
