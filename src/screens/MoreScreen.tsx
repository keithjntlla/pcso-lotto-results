import React from 'react';
import { StyleSheet, View, Text, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MoreScreen() {
  const handleOpenPCSO = () => {
    Linking.openURL('https://www.pcso.gov.ph/').catch(err =>
      console.error("Couldn't load page", err)
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info Cards */}
        <View style={styles.sectionContainer}>
          {/* Draw Schedule Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={20} color="#0F449E" />
              <Text style={styles.cardTitle}>Draw Schedule</Text>
            </View>
            <Text style={styles.cardText}>
              The PCSO 3D Lotto (Swertres) draws are held daily at the following times:
            </Text>
            <View style={styles.scheduleRow}>
              <View style={styles.schedulePill}><Text style={styles.scheduleText}>2:00 PM</Text></View>
              <View style={styles.schedulePill}><Text style={styles.scheduleText}>5:00 PM</Text></View>
              <View style={styles.schedulePill}><Text style={styles.scheduleText}>9:00 PM</Text></View>
            </View>
          </View>

          {/* Prize Structure Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="trophy" size={20} color="#0F449E" />
              <Text style={styles.cardTitle}>Prize Structure</Text>
            </View>
            <View style={styles.prizeItem}>
              <Text style={styles.prizeLabel}>Standard Play (Exact Order)</Text>
              <Text style={styles.prizeValue}>₱4,500.00</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.prizeItem}>
              <Text style={styles.prizeLabel}>Rambolito 3 (2 matching digits)</Text>
              <Text style={styles.prizeValue}>₱1,500.00</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.prizeItem}>
              <Text style={styles.prizeLabel}>Rambolito 6 (3 unique digits)</Text>
              <Text style={styles.prizeValue}>₱750.00</Text>
            </View>
            <Text style={styles.ticketPriceNote}>* Each ticket costs ₱10.00 inclusive of DST.</Text>
          </View>

          {/* About App Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="phone-portrait-outline" size={20} color="#0F449E" />
              <Text style={styles.cardTitle}>About App</Text>
            </View>
            <Text style={styles.cardText}>
              This app is designed to provide quick and offline-first access to PCSO 3D Lotto results.
            </Text>
            <Text style={styles.cardTextBullet}>
              • <Text style={{ fontWeight: '700' }}>Offline Cache:</Text> Search and view history without internet.
            </Text>
            <Text style={styles.cardTextBullet}>
              • <Text style={{ fontWeight: '700' }}>Live Updates:</Text> Pull-to-refresh to fetch the latest draw results.
            </Text>
          </View>

          {/* Official Website Button */}
          <TouchableOpacity onPress={handleOpenPCSO} style={styles.webBtn}>
            <Text style={styles.webBtnText}>Visit Official PCSO Website</Text>
            <Ionicons name="open-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.disclaimerText}>
            Disclaimer: This is an unofficial companion app. All results should be verified on official PCSO channels.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 10,
  },
  scrollView: {
    flex: 1,
    marginTop: -25,
    zIndex: 20,
    elevation: 12,
  },

  sectionContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ECEFF2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  cardText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
    fontWeight: '500',
  },
  cardTextBullet: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginLeft: 6,
    marginTop: 2,
    fontWeight: '500',
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  schedulePill: {
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scheduleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F449E',
  },
  prizeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  prizeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  prizeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F449E',
  },
  ticketPriceNote: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  webBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#0F449E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
    shadowColor: '#0F449E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  webBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
