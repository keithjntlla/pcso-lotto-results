import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface DrawCardProps {
  time: '2PM' | '5PM' | '9PM';
  result: string; // e.g. "4-2-6" or "--"
}

export default function DrawCard({ time, result }: DrawCardProps) {
  // Parse digits
  const isDrawn = result && result !== '--';
  const digits = isDrawn ? result.split('-') : ['-', '-', '-'];

  // Select styles based on draw time (cool-toned, desaturated pastel/minimalist colors)
  let theme;
  if (time === '2PM') {
    theme = {
      leftBg: '#E9F0FC',
      leftColor: '#1A5EC2',
      badgeBg: '#E1EBF9',
      badgeText: '#1A5EC2',
      ballColors: ['#FFFFFF', '#A9B9C9', '#1A5EC2'] as const,
      ballTextColor: '#0B1B3D',
    };
  } else if (time === '5PM') {
    theme = {
      leftBg: '#FAF5E8',
      leftColor: '#9E761E',
      badgeBg: '#F6ECD6',
      badgeText: '#9E761E',
      ballColors: ['#FFFFFF', '#E6D39E', '#C0A045'] as const,
      ballTextColor: '#4D3A0A',
    };
  } else {
    // 9PM
    theme = {
      leftBg: '#FDF2F2',
      leftColor: '#BA3C3C',
      badgeBg: '#F9E2E2',
      badgeText: '#BA3C3C',
      ballColors: ['#FFFFFF', '#E1ACAC', '#AE5E5E'] as const,
      ballTextColor: '#4A1515',
    };
  }

  return (
    <View style={styles.cardContainer}>
      {/* Left Info Bar */}
      <View style={[styles.leftBar, { backgroundColor: theme.leftBg }]}>
        <Ionicons name="time-outline" size={24} color={theme.leftColor} style={styles.clockIcon} />
        <Text style={[styles.timeText, { color: theme.leftColor }]}>{time}</Text>
        <Text style={[styles.drawLabel, { color: theme.leftColor }]}>Draw</Text>
      </View>

      {/* Right Content Area */}
      <View style={styles.rightContent}>
        {/* Status Badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
            <Text style={[styles.badgeText, { color: theme.badgeText }]}>
              {isDrawn ? 'OFFICIAL' : 'PENDING'}
            </Text>
          </View>
        </View>

        {/* Lotto Balls Display (Matching 64x64 ball dimensions from Generator ball card) */}
        <View style={styles.ballsRow}>
          {digits.map((digit, idx) => (
            <View key={idx} style={styles.ballShadowWrapper}>
              {/* Glossy 3D Ball */}
              <LinearGradient
                colors={theme.ballColors}
                start={{ x: 0.15, y: 0.15 }}
                end={{ x: 0.85, y: 0.85 }}
                style={styles.ball}
              >
                {/* Large Soft Volumetric Highlight */}
                <View style={styles.ballHighlightSoft} />
                
                {/* Crisp Top-Left Hotspot */}
                <View style={styles.ballHighlightHotspot} />
                
                <Text style={[styles.ballText, { color: theme.ballTextColor }]}>
                  {digit}
                </Text>
              </LinearGradient>
            </View>
          ))}
        </View>

        {/* Exact Order Text */}
        <Text style={styles.orderText}>
          {isDrawn ? 'IN EXACT ORDER' : 'AWAITING PCSO VERIFICATION'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    overflow: 'hidden',
    // Card Shadow matching Generator ball card
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  leftBar: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
  },
  clockIcon: {
    marginBottom: 6,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  drawLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.8,
  },
  rightContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ballsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    gap: 16,
  },
  ballShadowWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A335E',
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
  orderText: {
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#8A99AD',
    textTransform: 'uppercase',
  },
});
