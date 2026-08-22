import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent, DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyTickets, addMyTicket, deleteMyTicket, clearAllTickets, Ticket } from '../utils/tickets';
import { getLocalResults } from '../utils/storage';

export default function TicketsScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form State
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [drawTime, setDrawTime] = useState<'2PM' | '5PM' | '9PM'>('2PM');
  const [playType, setPlayType] = useState<'Standard' | 'Rambolito'>('Standard');
  const [num1, setNum1] = useState('');
  const [num2, setNum2] = useState('');
  const [num3, setNum3] = useState('');

  // Input refs for auto-focusing
  const inputRef2 = useRef<TextInput>(null);
  const inputRef3 = useRef<TextInput>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const stored = await getMyTickets();
      // Double check checkTickets just in case new results synced
      const results = await getLocalResults();
      const { checkTicketsAgainstResults } = require('../utils/tickets');
      const { updatedTickets } = checkTicketsAgainstResults(stored, results);
      setTickets(updatedTickets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDateValueChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setFormDate(selectedDate);
    }
  };

  const handleDatePickerDismiss = () => {
    setShowDatePicker(false);
  };

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: formDate,
        onValueChange: (event: any, selectedDate?: Date) => {
          if (selectedDate) {
            setFormDate(selectedDate);
          }
        },
        onDismiss: () => {},
        mode: 'date',
        maximumDate: new Date(Date.now() + 86400000 * 30),
      });
    } else {
      setShowDatePicker(true);
    }
  };

  const resetForm = () => {
    setFormDate(new Date());
    setDrawTime('2PM');
    setPlayType('Standard');
    setNum1('');
    setNum2('');
    setNum3('');
  };

  const handleAddTicket = async () => {
    if (!num1 || !num2 || !num3) {
      Alert.alert('Invalid Entry', 'Please enter all three numbers.', [{ text: 'OK' }]);
      return;
    }

    // Rambolito guard for three identical digits (must be Standard play)
    if (playType === 'Rambolito' && num1 === num2 && num2 === num3) {
      Alert.alert(
        'Invalid Play Type',
        'Rambolito play requires at least two different numbers. Please select Standard play for identical digits (e.g. 5-5-5).',
        [{ text: 'OK' }]
      );
      return;
    }

    const combination = `${num1}-${num2}-${num3}`;
    const dateStr = formDate.toISOString().split('T')[0];

    setLoading(true);
    const results = await getLocalResults();
    const updated = await addMyTicket({
      date: dateStr,
      drawTime,
      combination,
      playType,
    }, results);

    setTickets(updated);
    setLoading(false);
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Ticket', 'Are you sure you want to delete this ticket?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const updated = await deleteMyTicket(id);
          setTickets(updated);
          setLoading(false);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (tickets.length === 0) return;
    Alert.alert('Clear Tracker', 'Delete all tickets from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await clearAllTickets();
          setTickets([]);
          setLoading(false);
        },
      },
    ]);
  };

  // Calculations for summary card
  const totalBets = tickets.length;
  const wonTickets = tickets.filter((t) => t.winStatus === 'Won');
  const totalWinsCount = wonTickets.length;
  const totalWinnings = wonTickets.reduce((sum, t) => sum + t.wonAmount, 0);

  // Ball themes mapping
  const getBallColors = (time: '2PM' | '5PM' | '9PM') => {
    if (time === '2PM') return ['#FFFFFF', '#A9B9C9', '#627A90'] as const;
    if (time === '5PM') return ['#FFFFFF', '#E6D39E', '#C0A045'] as const;
    return ['#FFFFFF', '#E1ACAC', '#AE5E5E'] as const;
  };

  const getBallTextColor = (time: '2PM' | '5PM' | '9PM') => {
    if (time === '2PM') return '#0B1B3D';
    if (time === '5PM') return '#4D3A0A';
    return '#4A1515';
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#0A358C" style={{ transform: [{ scale: 1.2 }] }} />
          <Text style={styles.loadingText}>Loading tickets...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >


          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Saved Tickets</Text>
            {tickets.length > 0 && (
              <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tickets List */}
          {tickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="ticket-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No tickets tracked yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your lotto tickets here to check if they match the official results automatically.
              </Text>
            </View>
          ) : (
            tickets.map((ticket) => {
              const ballColors = getBallColors(ticket.drawTime);
              const ballTextColor = getBallTextColor(ticket.drawTime);
              const digits = ticket.combination.split('-');

              return (
                <View key={ticket.id} style={styles.ticketCard}>
                  {/* Left Column: Details */}
                  <View style={styles.ticketInfoCol}>
                    <Text style={styles.ticketDate}>
                      {new Date(ticket.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <View style={styles.ticketMetaRow}>
                      <View style={styles.drawTimeBadge}>
                        <Text style={styles.drawTimeBadgeText}>{ticket.drawTime}</Text>
                      </View>
                      <Text style={styles.playTypeText}>{ticket.playType}</Text>
                    </View>
                  </View>

                  {/* Center Column: 3D Lotto Balls */}
                  <View style={styles.ballsCol}>
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

                  {/* Right Column: Status & Delete */}
                  <View style={styles.statusCol}>
                    {ticket.winStatus === 'Pending' && (
                      <View style={[styles.statusBadge, styles.statusPending]}>
                        <Text style={[styles.statusBadgeText, styles.statusPendingText]}>PENDING</Text>
                      </View>
                    )}
                    {ticket.winStatus === 'Won' && (
                      <View style={[styles.statusBadge, styles.statusWon]}>
                        <Text style={[styles.statusBadgeText, styles.statusWonText]}>
                          WON ₱{ticket.wonAmount}
                        </Text>
                      </View>
                    )}
                    {ticket.winStatus === 'Lost' && (
                      <View style={[styles.statusBadge, styles.statusLost]}>
                        <Text style={[styles.statusBadgeText, styles.statusLostText]}>LOST</Text>
                      </View>
                    )}

                    <TouchableOpacity onPress={() => handleDelete(ticket.id)} style={styles.deleteIconBtn}>
                      <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.fabBtn} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Ticket Modal Form */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContentCard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Lotto Ticket</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormScroll}>
              {/* Date Selector */}
              <Text style={styles.fieldLabel}>Draw Date</Text>
              <TouchableOpacity onPress={handleOpenDatePicker} style={styles.datePickerBtn}>
                <Ionicons name="calendar-outline" size={18} color="#475569" style={{ marginRight: 8 }} />
                <Text style={styles.datePickerText}>
                  {formDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    weekday: 'long',
                  })}
                </Text>
              </TouchableOpacity>

              {/* Draw Time Selector */}
              <Text style={styles.fieldLabel}>Draw Time</Text>
              <View style={styles.pillsRow}>
                {(['2PM', '5PM', '9PM'] as const).map((time) => {
                  const isActive = drawTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => setDrawTime(time)}
                      style={[styles.formPill, isActive && styles.activeFormPill]}
                    >
                      <Text style={[styles.formPillText, isActive && styles.activeFormPillText]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Play Type Selector */}
              <Text style={styles.fieldLabel}>Play Type</Text>
              <View style={styles.pillsRow}>
                {(['Standard', 'Rambolito'] as const).map((type) => {
                  const isActive = playType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setPlayType(type)}
                      style={[styles.formPill, isActive && styles.activeFormPill]}
                    >
                      <Text style={[styles.formPillText, isActive && styles.activeFormPillText]}>
                        {type === 'Standard' ? 'Standard (Exact)' : 'Rambolito (Any Order)'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>               {/* Combination Input */}
              <Text style={styles.fieldLabel}>Your Combination</Text>
              <View style={styles.inputsRow}>
                <TextInput
                  style={styles.digitInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={num1}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9]/g, '');
                    setNum1(clean);
                    if (clean.length === 1) inputRef2.current?.focus();
                  }}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  selectTextOnFocus
                />
                <TextInput
                  ref={inputRef2}
                  style={styles.digitInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={num2}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9]/g, '');
                    setNum2(clean);
                    if (clean.length === 1) inputRef3.current?.focus();
                  }}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  selectTextOnFocus
                />
                <TextInput
                  ref={inputRef3}
                  style={styles.digitInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={num3}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9]/g, '');
                    setNum3(clean);
                  }}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  selectTextOnFocus
                />
              </View>

              {/* Add Ticket Button */}
              <TouchableOpacity onPress={handleAddTicket} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Track Ticket</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Date Picker Native Modal */}
      {Platform.OS === 'ios' && showDatePicker && (
        <DateTimePicker
          value={formDate}
          mode="date"
          display="default"
          onValueChange={handleDateValueChange}
          onDismiss={handleDatePickerDismiss}
          maximumDate={new Date(Date.now() + 86400000 * 30)} // Allow future bets up to 30 days ahead
        />
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
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollView: {
    flex: 1,
    marginTop: -25,
  },
  scrollContent: {
    paddingBottom: 80, // buffer for floating action button
    paddingTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 34,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    paddingVertical: 40,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2EAF1',
    // Card Shadow
    shadowColor: '#1A335E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  ticketInfoCol: {
    flex: 1.2,
  },
  ticketDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawTimeBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  drawTimeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  playTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  ballsCol: {
    flex: 1.8,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballShadowWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  ball: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ballHighlightSoft: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 28,
    height: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ rotate: '-30deg' }],
  },
  ballHighlightHotspot: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: 6,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  ballText: {
    fontSize: 13,
    fontWeight: '900',
    zIndex: 1,
    marginTop: -1,
  },
  statusCol: {
    flex: 1.2,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPendingText: {
    color: '#D97706',
  },
  statusWon: {
    backgroundColor: '#D1FAE5',
  },
  statusWonText: {
    color: '#059669',
  },
  statusLost: {
    backgroundColor: '#FEE2E2',
  },
  statusLostText: {
    color: '#DC2626',
  },
  deleteIconBtn: {
    padding: 2,
  },
  fabBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F449E',
    alignItems: 'center',
    justifyContent: 'center',
    // Fab Shadow
    shadowColor: '#0F449E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 15, 38, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2EAF1',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalCloseBtn: {
    padding: 2,
  },
  modalFormScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  formPill: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFormPill: {
    borderColor: '#0F449E',
    backgroundColor: '#EFF6FF',
  },
  formPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  activeFormPillText: {
    color: '#0F449E',
  },
  inputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 28,
  },
  digitInput: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
  },
  submitBtn: {
    backgroundColor: '#0F449E',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2EAF1',
    marginVertical: 12,
  },
});
