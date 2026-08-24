import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, Platform, Animated } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TodayScreen from './src/screens/TodayScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GeneratorScreen from './src/screens/GeneratorScreen';
import MoreScreen from './src/screens/MoreScreen';
import TicketsScreen from './src/screens/TicketsScreen';
import Header from './src/components/Header';
import LaunchScreen from './src/components/LaunchScreen';
import * as SplashScreen from 'expo-splash-screen';
import { formatLongDate } from './src/data/seedData';

// Prevent native splash screen from auto-hiding immediately
SplashScreen.preventAutoHideAsync().catch(() => {});
import { registerForNotificationsAsync } from './src/utils/notifications';
import { registerBackgroundFetchAsync } from './src/utils/background';
import { getLocalResults } from './src/utils/storage';

type TabType = 'Today' | 'History' | 'Generator' | 'Tickets' | 'More';

export function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('Today');
  const insets = useSafeAreaInsets();

  // Countdown timer state
  const [countdownText, setCountdownText] = useState('');
  const [nextDrawLabel, setNextDrawLabel] = useState('');

  // Format today's long date for the banner using local time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const formattedLongDate = formatLongDate(todayStr);

  // Next Draw Countdown Timer
  useEffect(() => {
    const getNextDraw = () => {
      const now = new Date();
      
      const draw2pm = new Date(now);
      draw2pm.setHours(14, 0, 0, 0);
      
      const draw5pm = new Date(now);
      draw5pm.setHours(17, 0, 0, 0);
      
      const draw9pm = new Date(now);
      draw9pm.setHours(21, 0, 0, 0);
      
      if (now < draw2pm) {
        return { timeLabel: '2:00 PM', targetDate: draw2pm };
      } else if (now < draw5pm) {
        return { timeLabel: '5:00 PM', targetDate: draw5pm };
      } else if (now < draw9pm) {
        return { timeLabel: '9:00 PM', targetDate: draw9pm };
      } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(14, 0, 0, 0);
        return { timeLabel: '2:00 PM (Tomorrow)', targetDate: tomorrow };
      }
    };

    const formatCountdown = (diffMs: number): string => {
      if (diffMs <= 0) return '00:00:00';
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;
      
      const pad = (num: number) => String(num).padStart(2, '0');
      
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const updateCountdown = () => {
      const { timeLabel, targetDate } = getNextDraw();
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      setNextDrawLabel(timeLabel);
      setCountdownText(formatCountdown(diff));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  // Request notifications permission on mount
  useEffect(() => {
    registerForNotificationsAsync().catch(console.error);
    registerBackgroundFetchAsync().catch(console.error);
  }, []);

  const handleTabPress = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  // Determine current banner contents
  const getBannerContent = () => {
    switch (activeTab) {
      case 'Today':
        return {
          title: "Today's Results",
          subtitle: formattedLongDate,
          showCountdown: true,
        };
      case 'History':
        return {
          title: "History",
          subtitle: "View all past 3D Lotto draw results.",
          showCountdown: false,
        };
      case 'Generator':
        return {
          title: "Generator",
          subtitle: "Generate lucky picks and statistical numbers.",
          showCountdown: false,
        };
      case 'Tickets':
        return {
          title: "My Tickets",
          subtitle: "Track your bets and auto-check wins.",
          showCountdown: false,
        };
      case 'More':
        return {
          title: "More Info",
          subtitle: "Game rules, draw schedules, and prizes.",
          showCountdown: false,
        };
    }
  };

  const banner = getBannerContent();

  return (
    <View style={styles.container}>
        {/* Status Bar style */}
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Immersive Wavy Banner Header (Original Curved Header) */}
        <View style={styles.bannerHeader}>
          <LinearGradient
            colors={['#040F26', '#0A2D73']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            {/* Background Waves */}
            <LinearGradient
              colors={['rgba(29, 78, 216, 0.65)', 'rgba(4, 15, 38, 0)']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.wave1}
            />
            <LinearGradient
              colors={['rgba(59, 130, 246, 0.4)', 'rgba(4, 15, 38, 0)']}
              start={{ x: 0.9, y: 0.1 }}
              end={{ x: 0.1, y: 0.9 }}
              style={styles.wave2}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.wave3}
            />
          </LinearGradient>

          <Header />

          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
            <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>
            {banner.showCountdown && countdownText ? (
              <View style={styles.countdownContainer}>
                <Ionicons name="time-outline" size={16} color="#93C5FD" style={{ marginRight: 6 }} />
                <Text style={styles.countdownLabel} numberOfLines={1}>Next Draw ({nextDrawLabel}):</Text>
                <Text style={styles.countdownTime}>{countdownText}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Active Screen Container (Cached View Stacking for Instant 0ms Tab Switching) */}
        <View style={styles.screenContainer}>
          <View style={{ flex: 1, display: activeTab === 'Today' ? 'flex' : 'none' }}>
            <TodayScreen isActive={activeTab === 'Today'} />
          </View>
          <View style={{ flex: 1, display: activeTab === 'History' ? 'flex' : 'none' }}>
            <HistoryScreen />
          </View>
          <View style={{ flex: 1, display: activeTab === 'Generator' ? 'flex' : 'none' }}>
            <GeneratorScreen />
          </View>
          <View style={{ flex: 1, display: activeTab === 'Tickets' ? 'flex' : 'none' }}>
            <TicketsScreen />
          </View>
          <View style={{ flex: 1, display: activeTab === 'More' ? 'flex' : 'none' }}>
            <MoreScreen />
          </View>
        </View>

        {/* Custom Tab Navigator Bottom Bar */}
        <View style={[styles.tabBar, { paddingBottom: insets.bottom, height: 60 + insets.bottom }]}>
          {/* Today Tab */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('Today')}
          >
            {activeTab === 'Today' && <View style={styles.activeTabIndicator} />}
            <Ionicons
              name={activeTab === 'Today' ? 'calendar' : 'calendar-outline'}
              size={22}
              color={activeTab === 'Today' ? '#0F449E' : '#94A3B8'}
            />
            <Text
              style={[styles.tabLabel, activeTab === 'Today' && styles.activeTabLabel]}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Today
            </Text>
          </TouchableOpacity>

          {/* History Tab */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('History')}
          >
            {activeTab === 'History' && <View style={styles.activeTabIndicator} />}
            <Ionicons
              name={activeTab === 'History' ? 'time' : 'time-outline'}
              size={21}
              color={activeTab === 'History' ? '#0F449E' : '#94A3B8'}
            />
            <Text
              style={[styles.tabLabel, activeTab === 'History' && styles.activeTabLabel]}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              History
            </Text>
          </TouchableOpacity>

          {/* Generator Tab */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('Generator')}
          >
            {activeTab === 'Generator' && <View style={styles.activeTabIndicator} />}
            <Ionicons
              name={activeTab === 'Generator' ? 'shuffle' : 'shuffle-outline'}
              size={21}
              color={activeTab === 'Generator' ? '#0F449E' : '#94A3B8'}
            />
            <Text
              style={[styles.tabLabel, activeTab === 'Generator' && styles.activeTabLabel]}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Generator
            </Text>
          </TouchableOpacity>

          {/* Tickets Tab */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('Tickets')}
          >
            {activeTab === 'Tickets' && <View style={styles.activeTabIndicator} />}
            <Ionicons
              name={activeTab === 'Tickets' ? 'ticket' : 'ticket-outline'}
              size={21}
              color={activeTab === 'Tickets' ? '#0F449E' : '#94A3B8'}
            />
            <Text
              style={[styles.tabLabel, activeTab === 'Tickets' && styles.activeTabLabel]}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Tickets
            </Text>
          </TouchableOpacity>

          {/* More Tab */}
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => handleTabPress('More')}
          >
            {activeTab === 'More' && <View style={styles.activeTabIndicator} />}
            <Ionicons
              name={
                activeTab === 'More'
                  ? 'ellipsis-horizontal-circle'
                  : 'ellipsis-horizontal-circle-outline'
              }
              size={21}
              color={activeTab === 'More' ? '#0F449E' : '#94A3B8'}
            />
            <Text
              style={[styles.tabLabel, activeTab === 'More' && styles.activeTabLabel]}
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              More
            </Text>
          </TouchableOpacity>
        </View>
      </View>
  );
}

export default function App() {
  const [showLaunch, setShowLaunch] = useState(true);

  useEffect(() => {
    // Warm up the local cache as soon as the app boots to guarantee 0ms instant loads
    getLocalResults().catch(console.error);

    // Hide native splash screen once the custom LaunchScreen overlay is mounted
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const mainContent = (
    <SafeAreaProvider>
      <MainApp />
      {showLaunch && <LaunchScreen onFinish={() => setShowLaunch(false)} />}
    </SafeAreaProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webOuterWrapper}>
        <View style={styles.webPhoneFrame}>
          {mainContent}
        </View>
      </View>
    );
  }

  return mainContent;
}

const styles = StyleSheet.create({
  webOuterWrapper: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    backgroundColor: '#050B17',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Platform.OS === 'web' ? 12 : 0,
  },
  webPhoneFrame: {
    width: '100%',
    maxWidth: 390,
    height: '100%',
    maxHeight: 844,
    backgroundColor: '#F7FAFC',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 20,
    ...(Platform.OS === 'web'
      ? ({
          borderRadius: 28,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.14)',
        } as any)
      : {}),
  },
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  screenContainer: {
    flex: 1,
  },
  bannerHeader: {
    height: Platform.OS === 'ios' ? 222 : 202,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    // Banner Shadow
    shadowColor: '#040F26',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10,
  },
  wave1: {
    position: 'absolute',
    top: -150,
    left: -100,
    width: 440,
    height: 440,
    borderRadius: 220,
  },
  wave2: {
    position: 'absolute',
    bottom: -180,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  wave3: {
    position: 'absolute',
    top: -40,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  bannerContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  countdownLabel: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  countdownTime: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2EAF1',
    // Bottom Bar Shadow
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 6,
    paddingHorizontal: 0,
  },
  activeTabIndicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 3,
    backgroundColor: '#0F449E',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.2,
  },
  activeTabLabel: {
    color: '#0F449E',
  },
});
