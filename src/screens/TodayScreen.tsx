import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  ToastAndroid,
  Platform,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DrawCard from '../components/DrawCard';
import { DrawResult, seedResults, formatLongDate } from '../data/seedData';
import { getLocalResults, syncLottoResults, getTodayISO } from '../utils/storage';

export default function TodayScreen({ isActive = true }: { isActive?: boolean }) {
  const [results, setResults] = useState<DrawResult[]>(seedResults);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const lastSyncRef = useRef<number>(0);

  // Get today's date string formatted as YYYY-MM-DD in Philippine Standard Time
  const todayStr = getTodayISO();

  // Find result matching today's date. If no result exists for today yet, display empty '-' placeholders for today.
  const todayResult = results.find((r) => r.date === todayStr) || {
    date: todayStr,
    draw2pm: '--',
    draw5pm: '--',
    draw9pm: '--',
  };
  const formattedLongDate = formatLongDate(todayStr);

  // Reusable background sync handler with 5-minute throttling
  const runBackgroundSync = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 300000) {
      console.log('TodayScreen: Sync throttled (last sync was < 5 mins ago)');
      return;
    }
    console.log('TodayScreen: Running background sync...');
    try {
      const { results: synced } = await syncLottoResults();
      if (synced && synced.length > 0) {
        setResults(synced);
        lastSyncRef.current = Date.now();
      }
    } catch (err) {
      console.log('TodayScreen: Background sync failed', err);
    }
  }, []);

  // Manual pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { results: updatedResults, updatedCount } = await syncLottoResults();
      setResults(updatedResults);
      lastSyncRef.current = Date.now(); // Update sync timestamp on manual refresh

      if (Platform.OS === 'android') {
        if (updatedCount > 0) {
          ToastAndroid.show(`Fetched ${updatedCount} new draw results!`, ToastAndroid.SHORT);
        } else {
          ToastAndroid.show('Results are up to date.', ToastAndroid.SHORT);
        }
      }
    } catch (e) {
      console.error(e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Failed to connect to PCSO service.', ToastAndroid.SHORT);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // 1. Instant 0ms Load: Read from in-memory RAM cache
      try {
        const local = await getLocalResults();
        if (isMounted) {
          setResults(local);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load local results:', e);
        if (isMounted) setLoading(false);
      }

      // 2. Non-blocking Background Sync (Fired asynchronously after 300ms so tab switching is 0ms instant)
      setTimeout(() => {
        if (isMounted) {
          runBackgroundSync();
        }
      }, 300);
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [runBackgroundSync]);

  // AppState foreground detection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('TodayScreen: App foregrounded. Syncing...');
        runBackgroundSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [runBackgroundSync]);

  // Tab focus detection
  useEffect(() => {
    if (isActive) {
      console.log('TodayScreen: Tab active/focused. Syncing...');
      runBackgroundSync();
    }
  }, [isActive, runBackgroundSync]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#0A358C" style={{ transform: [{ scale: 1.2 }] }} />
          <Text style={styles.loadingText}>Loading today's results...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#0F449E']}
                tintColor="#0F449E"
              />
            }
          >
            {/* Draw Cards Section (Matching Generator ball card header overlap: zIndex 20, elevation 12) */}
            <View style={styles.cardsSection}>
              <DrawCard time="2PM" result={todayResult?.draw2pm || '--'} />
              <DrawCard time="5PM" result={todayResult?.draw5pm || '--'} />
              <DrawCard time="9PM" result={todayResult?.draw9pm || '--'} />
            </View>
          </ScrollView>

          {/* Bottom Info Note - Fixed above the bottom tab bar */}
          <View style={styles.infoBoxFixedBottom}>
            <Ionicons name="information-circle-outline" size={16} color="#5F738E" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Official PCSO 3D Lotto results update daily.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    position: 'relative',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  scrollView: {
    flex: 1,
    marginTop: 0,
  },
  cardsSection: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  infoBoxFixedBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF3F8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2EAF1',
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F738E',
  },
});
