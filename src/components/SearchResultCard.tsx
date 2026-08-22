import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatLongDate, parseDateString } from '../data/seedData';

interface SearchResultCardProps {
  date: string; // YYYY-MM-DD
  drawTime: '2PM' | '5PM' | '9PM';
  result: string; // e.g. "4-2-6"
}

export default function SearchResultCard({ date, drawTime, result }: SearchResultCardProps) {
  const digits = result.split('-');

  // Get full weekday name
  let dayOfWeek = '';
  try {
    const d = parseDateString(date);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
    dayOfWeek = d.toLocaleDateString('en-US', options);
  } catch (e) {
    dayOfWeek = '';
  }

  // Format month and day
  const formattedDateLong = formatLongDate(date); // e.g. "July 10, 2025 • Thursday"
  // Split to get "July 10, 2025" and "(Thursday)"
  const dateOnly = formattedDateLong.split(' • ')[0];
  const dateSubtitle = `${dateOnly} (${dayOfWeek})`;

  // Time details text
  const timeDetails = drawTime === '2PM' ? '2:00 PM' : drawTime === '5PM' ? '5:00 PM' : '9:00 PM';

  // Theme styling based on draw time (minimalist/cool-toned)
  let theme;
  if (drawTime === '2PM') {
    theme = {
      textColor: '#1A5EC2',
      ballColors: ['#FFFFFF', '#A9B9C9', '#627A90'] as const,
      ballTextColor: '#0B1B3D',
    };
  } else if (drawTime === '5PM') {
    theme = {
      textColor: '#9E761E',
      ballColors: ['#FFFFFF', '#E6D39E', '#C0A045'] as const,
      ballTextColor: '#4D3A0A',
    };
  } else {
    theme = {
      textColor: '#BA3C3C',
      ballColors: ['#FFFFFF', '#E1ACAC', '#AE5E5E'] as const,
      ballTextColor: '#4A1515',
    };
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.contentRow}>
        {/* Left Side: 3 Lotto Balls */}
        <View style={styles.ballsContainer}>
          {digits.map((digit, idx) => (
            <View key={idx} style={styles.ballShadowWrapper}>
              <LinearGradient
                colors={theme.ballColors}
                start={{ x: 0.15, y: 0.15 }}
                end={{ x: 0.85, y: 0.85 }}
                style={styles.ball}
              >
                <View style={styles.ballHighlightSoft} />
                <View style={styles.ballHighlightHotspot} />
                <Text style={[styles.ballText, { color: theme.ballTextColor }]}>{digit}</Text>
              </LinearGradient>
            </View>
          ))}
        </View>

        {/* Center: Details */}
        <View style={styles.detailsContainer}>
          <Text style={[styles.drawTimeTitle, { color: theme.textColor }]}>
            {drawTime} DRAW
          </Text>
          <Text style={styles.dateText}>{dateSubtitle}</Text>
          <Text style={styles.timeDetailText}>Draw Time: {timeDetails}</Text>
        </View>

        {/* Right Side: Exact Order Pill */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>IN EXACT ORDER</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginVertical: 6,
    // Soft shadow
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ECEFF2',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ballsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  ballShadowWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF', // Required to cast elevation shadow on Android
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  ball: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ballHighlightSoft: {
    position: 'absolute',
    top: 1,
    left: 3,
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#FFFFFF',
    opacity: 0.22,
  },
  ballHighlightHotspot: {
    position: 'absolute',
    top: 3,
    left: 6,
    width: 9,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    opacity: 0.45,
    transform: [{ rotate: '-15deg' }],
  },
  ballText: {
    fontSize: 16,
    fontWeight: '900',
  },
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  drawTimeTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  timeDetailText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  badgeContainer: {
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#1A5EC2',
    letterSpacing: 0.5,
  },
});
