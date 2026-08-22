import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';

const NOTIF_SETTINGS_KEY = '@pcso_draw_notifications_enabled';

// Dynamically require expo-notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.log('Notifications: expo-notifications package running in fallback mode.');
}

// Setup foreground notification handler if available
if (Notifications && Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions and configure OS draw alarms.
 */
export async function registerForNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Notifications) {
    console.log('Notifications: Notifications API is not supported in this client environment.');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notifications: Permission not granted');
      return false;
    }

    // Android channel configuration
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('draw_results', {
        name: 'Draw Results',
        description: 'Get notified when new 3D Lotto results are out',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0F449E',
        sound: 'default',
        enableVibrate: true,
      });
    }

    // Schedule native OS daily draw notifications (fires even when app is completely closed)
    await scheduleDailyDrawNotifications();

    return true;
  } catch (error) {
    console.error('Notifications: Failed to register', error);
    return false;
  }
}

/**
 * Pre-schedules native OS alarms for 2:05 PM, 5:05 PM, and 9:05 PM draws.
 * Fires natively from the OS alarm manager even when the app is completely closed or killed.
 */
export async function scheduleDailyDrawNotifications(): Promise<void> {
  if (!Notifications) return;

  try {
    const enabled = await areNotificationsEnabled();
    if (!enabled) return;

    // Cancel existing scheduled items to prevent duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    const drawTimes = [
      { timeLabel: '2:00 PM', hour: 14, minute: 5 },
      { timeLabel: '5:00 PM', hour: 17, minute: 5 },
      { timeLabel: '9:00 PM', hour: 21, minute: 5 },
    ];

    for (const draw of drawTimes) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎰 PCSO 3D Lotto ${draw.timeLabel} Draw!`,
          body: `The ${draw.timeLabel} 3D Lotto winning numbers are ready. Tap to view today's result!`,
          sound: true,
          color: '#0F449E',
          channelId: 'draw_results',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          hour: draw.hour,
          minute: draw.minute,
          repeats: true,
        },
      });
    }
    console.log('Notifications: Pre-scheduled daily draw notifications for 2:05 PM, 5:05 PM, and 9:05 PM');
  } catch (error) {
    console.error('Notifications: Error scheduling daily draw notifications:', error);
  }
}

/**
 * Check if the user has enabled draw notifications. Defaults to true.
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    return value !== 'false';
  } catch {
    return true;
  }
}

/**
 * Toggle draw notifications setting.
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, String(enabled));
    if (enabled) {
      await scheduleDailyDrawNotifications();
    } else if (Notifications) {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  } catch (error) {
    console.error('Notifications: Error toggling setting', error);
  }
}

/**
 * Triggers a local device notification for a new draw result.
 */
export async function triggerDrawNotification(
  time: '2PM' | '5PM' | '9PM',
  result: string,
  dateString: string
): Promise<void> {
  try {
    const enabled = await areNotificationsEnabled();
    if (!enabled) return;

    let displayDate = dateString;
    try {
      const dateParts = dateString.split('-');
      if (dateParts.length === 3) {
        const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
        displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      // fallback
    }

    const formattedBalls = result.split('-').join(' - ');

    if (!Notifications) {
      Alert.alert(
        '🔔 New 3D Lotto Result!',
        `${time} Draw result for ${displayDate} is out: [ ${formattedBalls} ]`,
        [{ text: 'OK' }]
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 New 3D Lotto Result!',
        body: `${time} Draw result for ${displayDate} is out: [ ${formattedBalls} ]`,
        sound: true,
        color: '#0F449E',
        channelId: 'draw_results',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.error('Notifications: Error triggering notification', error);
  }
}

/**
 * Triggers a test notification immediately to confirm functionality.
 */
export async function triggerTestNotification(): Promise<void> {
  try {
    const enabled = await areNotificationsEnabled();
    if (!enabled) {
      Alert.alert(
        'Notifications Disabled',
        'Please turn on Draw Alerts first in the settings panel.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!Notifications) {
      Alert.alert(
        '🔔 Test Alert (Fallback)',
        'Hello from PCSO 3D Lotto! Notifications are active.',
        [{ text: 'OK' }]
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Test Notification',
        body: 'Hello! Draw result notifications are active and scheduled on your device.',
        sound: true,
        color: '#0F449E',
        channelId: 'draw_results',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.error('Notifications: Error triggering test notification', error);
  }
}
