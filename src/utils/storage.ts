import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawResult, seedResults } from '../data/seedData';
import { fetchLottoResults, fetchSpecificDateFromPCSO, fetchTodayLiveResults } from './scraper';
import { triggerDrawNotification } from './notifications';
import { getMyTickets, saveMyTickets, checkTicketsAgainstResults } from './tickets';
import { getTodayISO, getManilaHour } from './date';
export { getTodayISO, getManilaHour };

const CACHE_KEY = '@pcso_3d_draw_results';

// In-Memory Singleton Cache (Instant 0ms access across all screens)
let memoryCache: DrawResult[] | null = null;

/**
 * Ensures today's result entry never contains invalid/leaked draw results from previous days.
 * If today's draw time has not passed yet, or if today's numbers are identical to previous day's numbers,
 * reset those specific draws to '--'.
 */
export function sanitizeTodayResult(results: DrawResult[]): DrawResult[] {
  const todayStr = getTodayISO();
  const currentHour = getManilaHour();

  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date));
  let todayIdx = sorted.findIndex((r) => r.date === todayStr);

  if (todayIdx === -1) {
    sorted.unshift({
      date: todayStr,
      draw2pm: '--',
      draw5pm: '--',
      draw9pm: '--',
    });
    todayIdx = 0;
  }

  const todayItem = { ...sorted[todayIdx] };
  const prevItem = sorted.find((r) => r.date !== todayStr);

  // Time guard: draws that have not occurred yet today must be '--'
  if (currentHour < 14) todayItem.draw2pm = '--';
  if (currentHour < 17) todayItem.draw5pm = '--';
  if (currentHour < 21) todayItem.draw9pm = '--';

  // Leak guard: if today's numbers duplicate previous day's numbers, reset to '--'
  if (prevItem) {
    if (todayItem.draw2pm !== '--' && todayItem.draw2pm === prevItem.draw2pm) {
      todayItem.draw2pm = '--';
    }
    if (todayItem.draw5pm !== '--' && todayItem.draw5pm === prevItem.draw5pm) {
      todayItem.draw5pm = '--';
    }
    if (todayItem.draw9pm !== '--' && todayItem.draw9pm === prevItem.draw9pm) {
      todayItem.draw9pm = '--';
    }
  }

  sorted[todayIdx] = todayItem;
  return sorted;
}

export async function getLocalResults(): Promise<DrawResult[]> {
  // 1. Fast Path: Return from in-memory cache instantly
  if (memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }

  try {
    // 2. Initial Cold Load: Read from disk storage or fallback to seedResults
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    let parsed: DrawResult[] = cached ? JSON.parse(cached) : [];

    // Always merge seedResults so all 2016-2026 history is included
    let merged = mergeDrawResults(seedResults, parsed);

    const sanitized = sanitizeTodayResult(merged);
    memoryCache = sanitized; // Cache in RAM for instant 0ms access

    // Save updated cache asynchronously in background (non-blocking)
    if (!cached || sanitized.length > parsed.length) {
      saveLocalResults(sanitized).catch(console.error);
    }

    return sanitized;
  } catch (error) {
    console.error('Storage: Error reading local results cache:', error);
    const sanitized = sanitizeTodayResult([...seedResults]);
    memoryCache = sanitized;
    return memoryCache;
  }
}

export async function saveLocalResults(results: DrawResult[]): Promise<void> {
  try {
    const sanitized = sanitizeTodayResult(results);
    memoryCache = sanitized; // Update RAM cache immediately
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.error('Storage: Error saving results cache:', error);
  }
}

/**
 * Gets result for a specific date from RAM/disk cache, or fetches on-demand from official PCSO if missing (e.g. pre-2020 dates).
 */
export async function getOrFetchDateResult(targetDateStr: string): Promise<DrawResult | null> {
  const local = await getLocalResults();
  const existing = local.find((r) => r.date === targetDateStr);
  const todayStr = getTodayISO();

  // A record is complete if it exists and has no '--' values.
  // For historical dates (not today), if it's complete in cache, return it directly.
  const isComplete = existing && existing.draw2pm !== '--' && existing.draw5pm !== '--' && existing.draw9pm !== '--';
  if (existing && isComplete && targetDateStr !== todayStr) {
    return existing;
  }

  // Not in local RAM/disk cache or incomplete, fetch on-demand
  let fetched: DrawResult | null = null;
  if (targetDateStr === todayStr) {
    fetched = await fetchTodayLiveResults(targetDateStr);
  } else {
    fetched = await fetchSpecificDateFromPCSO(targetDateStr);
  }

  if (fetched) {
    const updated = mergeDrawResults(local, [fetched]);
    saveLocalResults(updated).catch(console.error);
    return fetched;
  }

  return existing || null;
}

/**
 * Merges newly scraped results into existing cached results efficiently.
 */
export function mergeDrawResults(existing: DrawResult[], scraped: DrawResult[]): DrawResult[] {
  const mergedMap = new Map<string, DrawResult>();

  existing.forEach((item) => {
    mergedMap.set(item.date, { ...item });
  });

  scraped.forEach((newItem) => {
    const existingItem = mergedMap.get(newItem.date);
    if (existingItem) {
      mergedMap.set(newItem.date, {
        date: newItem.date,
        draw2pm: newItem.draw2pm !== '--' ? newItem.draw2pm : existingItem.draw2pm,
        draw5pm: newItem.draw5pm !== '--' ? newItem.draw5pm : existingItem.draw5pm,
        draw9pm: newItem.draw9pm !== '--' ? newItem.draw9pm : existingItem.draw9pm,
      });
    } else {
      mergedMap.set(newItem.date, { ...newItem });
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Main synchronizer function. Scrapes today's live results (LottoBalita primary, PhilNews backup)
 * as well as general web updates, merges, saves, and triggers notifications.
 */
export async function syncLottoResults(): Promise<{ results: DrawResult[]; updatedCount: number }> {
  try {
    const local = await getLocalResults();
    const scraped = await fetchLottoResults();

    // Fetch Today's live results using targeted LottoBalita (primary) and PhilNews (backup)
    const todayStr = getTodayISO();

    const todayLive = await fetchTodayLiveResults(todayStr);
    if (todayLive) {
      scraped.unshift(todayLive);
    }

    if (scraped.length === 0) {
      return { results: local, updatedCount: 0 };
    }

    const merged = mergeDrawResults(local, scraped);
    const sanitized = sanitizeTodayResult(merged);
    memoryCache = sanitized; // Instant RAM update

    const newNotifications: { time: '2PM' | '5PM' | '9PM'; result: string; date: string }[] = [];

    if (local.length > 0) {
      scraped.forEach((scrapedItem) => {
        if (scrapedItem.date !== todayStr) return;

        const localItem = local.find((l) => l.date === scrapedItem.date);

        const checkDraw = (time: '2PM' | '5PM' | '9PM', val: string, localVal?: string) => {
          if (val !== '--' && (!localVal || localVal === '--')) {
            newNotifications.push({ time, result: val, date: scrapedItem.date });
          }
        };

        checkDraw('2PM', scrapedItem.draw2pm, localItem?.draw2pm);
        checkDraw('5PM', scrapedItem.draw5pm, localItem?.draw5pm);
        checkDraw('9PM', scrapedItem.draw9pm, localItem?.draw9pm);
      });
    }

    // Save cache asynchronously
    saveLocalResults(sanitized).catch(console.error);

    const updatedCount = sanitized.length - local.length;

    newNotifications.forEach(({ time, result, date }) => {
      triggerDrawNotification(time, result, date).catch(console.error);
    });

    try {
      const tickets = await getMyTickets();
      const { updatedTickets } = checkTicketsAgainstResults(tickets, sanitized);
      await saveMyTickets(updatedTickets);
    } catch (e) {
      console.error('Storage: Error updating user tickets on sync', e);
    }

    return { results: sanitized, updatedCount };
  } catch (error) {
    console.error('Storage: Sync failed:', error);
    const local = await getLocalResults();
    return { results: local, updatedCount: 0 };
  }
}
