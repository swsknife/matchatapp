/**
 * notificationService.js
 * 
 * Comprehensive push notification service for MatchChatApp
 * Handles registration, scheduling, and managing push notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import remoteLogger from '../utils/remoteLogger';

// Storage keys
const NOTIFICATION_TOKEN_KEY = '@MatchChatApp:notificationToken';
const NOTIFICATION_SETTINGS_KEY = '@MatchChatApp:notificationSettings';

// Notification categories
export const NOTIFICATION_CATEGORIES = {
  NEW_MESSAGE: 'NEW_MESSAGE',
  MATCH_FOUND: 'MATCH_FOUND',
  MATCH_ENDED: 'MATCH_ENDED',
  OPPONENT_LEFT: 'OPPONENT_LEFT',
  CONNECTION_RESTORED: 'CONNECTION_RESTORED'
};

// Default notification settings
const DEFAULT_SETTINGS = {
  enabled: true,
  newMessages: true,
  matchFound: true,
  matchEnded: true,
  opponentLeft: true,
  connectionRestored: false,
  sound: true,
  vibration: true,
  badge: true
};

/**
 * Configure notification behavior
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const settings = await getNotificationSettings();
    
    return {
      shouldShowAlert: settings.enabled,
      shouldPlaySound: settings.enabled && settings.sound,
      shouldSetBadge: settings.enabled && settings.badge,
    };
  },
});

/**
 * Initialize the notification service
 * Call this when the app starts
 */
export const initializeNotifications = async () => {
  try {
    remoteLogger.log('Initializing notification service');

    // Check if device supports notifications
    if (!Device.isDevice) {
      remoteLogger.log('Notifications not supported on simulator/emulator');
      return { success: false, reason: 'simulator' };
    }

    // Request permissions
    const permissionResult = await requestNotificationPermissions();
    if (!permissionResult.granted) {
      remoteLogger.log('Notification permissions not granted', permissionResult);
      return { success: false, reason: 'permissions', details: permissionResult };
    }

    // Get push token
    const token = await registerForPushNotifications();
    if (!token) {
      remoteLogger.logError(new Error('Failed to get push token'), 'notificationService.initializeNotifications');
      return { success: false, reason: 'token' };
    }

    // Set up notification categories with actions
    await setupNotificationCategories();

    remoteLogger.log('Notification service initialized successfully', { token: token.substring(0, 20) + '...' });
    return { success: true, token };

  } catch (error) {
    remoteLogger.logError(error, 'notificationService.initializeNotifications');
    return { success: false, reason: 'error', error: error.message };
  }
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { granted: false, status: finalStatus };
    }

    // For Android, also request additional permissions
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });

      // Create specific channels for different notification types
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'New Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        description: 'Notifications for new chat messages',
      });

      await Notifications.setNotificationChannelAsync('matches', {
        name: 'Match Updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500],
        sound: 'default',
        description: 'Notifications for match found and match ended events',
      });
    }

    return { granted: true, status: finalStatus };
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.requestNotificationPermissions');
    return { granted: false, error: error.message };
  }
};

/**
 * Register for push notifications and get token
 */
export const registerForPushNotifications = async () => {
  try {
    let token;

    if (Device.isDevice) {
      // Try to get project ID from various sources with fallback
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                        Constants.easConfig?.projectId || 
                        'unknown-project-id'; // Add fallback
      
      if (projectId === 'unknown-project-id') {
        console.warn('Project ID not found. Push notifications may not work correctly.');
        remoteLogger.log('Project ID not found for push notifications', { warning: true });
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      
      // Store token locally
      await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
      
      remoteLogger.log('Push token registered', { 
        token: token.substring(0, 20) + '...',
        projectId 
      });
    } else {
      throw new Error('Must use physical device for Push Notifications');
    }

    return token;
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.registerForPushNotifications');
    throw error;
  }
};

/**
 * Get stored push token
 */
export const getPushToken = async () => {
  try {
    return await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.getPushToken');
    return null;
  }
};

/**
 * Set up notification categories with actions
 */
const setupNotificationCategories = async () => {
  try {
    await Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark as Read',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('match', [
      {
        identifier: 'open_chat',
        buttonTitle: 'Open Chat',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    remoteLogger.log('Notification categories set up successfully');
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.setupNotificationCategories');
  }
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (title, body, data = {}, options = {}) => {
  try {
    const settings = await getNotificationSettings();
    
    if (!settings.enabled) {
      remoteLogger.log('Notifications disabled, skipping local notification');
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: settings.sound ? 'default' : false,
        badge: settings.badge ? 1 : 0,
        categoryIdentifier: options.category || 'default',
        ...options.content
      },
      trigger: options.trigger || null, // null means immediate
    });

    remoteLogger.log('Local notification scheduled', { 
      id: notificationId, 
      title, 
      category: options.category 
    });

    return notificationId;
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.scheduleLocalNotification');
    return null;
  }
};

/**
 * Send push notification for new message
 */
export const notifyNewMessage = async (senderName, messageText, matchId, messageId) => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.newMessages) {
    return null;
  }

  return await scheduleLocalNotification(
    `New message from ${senderName}`,
    messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
    {
      type: NOTIFICATION_CATEGORIES.NEW_MESSAGE,
      matchId,
      messageId,
      senderName
    },
    {
      category: 'message',
      content: {
        sound: 'default',
      }
    }
  );
};

/**
 * Send push notification for match found
 */
export const notifyMatchFound = async (matchId, preferences) => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.matchFound) {
    return null;
  }

  return await scheduleLocalNotification(
    'Match Found! 🎉',
    `Found someone who wants to play ${preferences.game} in ${preferences.city}`,
    {
      type: NOTIFICATION_CATEGORIES.MATCH_FOUND,
      matchId,
      preferences
    },
    {
      category: 'match',
      content: {
        sound: 'default',
      }
    }
  );
};

/**
 * Send push notification for match ended
 */
export const notifyMatchEnded = async (matchId, reason = 'Match has ended') => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.matchEnded) {
    return null;
  }

  return await scheduleLocalNotification(
    'Match Ended',
    reason,
    {
      type: NOTIFICATION_CATEGORIES.MATCH_ENDED,
      matchId,
      reason
    },
    {
      category: 'default'
    }
  );
};

/**
 * Send push notification for opponent left
 */
export const notifyOpponentLeft = async (matchId, opponentName = 'Your opponent') => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.opponentLeft) {
    return null;
  }

  return await scheduleLocalNotification(
    'Opponent Left',
    `${opponentName} has left the match`,
    {
      type: NOTIFICATION_CATEGORIES.OPPONENT_LEFT,
      matchId,
      opponentName
    },
    {
      category: 'default'
    }
  );
};

/**
 * Send push notification for connection restored
 */
export const notifyConnectionRestored = async () => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.connectionRestored) {
    return null;
  }

  return await scheduleLocalNotification(
    'Connection Restored',
    'You\'re back online! Your messages will now be delivered.',
    {
      type: NOTIFICATION_CATEGORIES.CONNECTION_RESTORED
    },
    {
      category: 'default'
    }
  );
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
    remoteLogger.log('All notifications cleared');
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.clearAllNotifications');
  }
};

/**
 * Clear notifications for a specific match
 */
export const clearMatchNotifications = async (matchId) => {
  try {
    const notifications = await Notifications.getPresentedNotificationsAsync();
    const matchNotifications = notifications.filter(
      notification => notification.request.content.data?.matchId === matchId
    );

    for (const notification of matchNotifications) {
      await Notifications.dismissNotificationAsync(notification.request.identifier);
    }

    remoteLogger.log('Match notifications cleared', { matchId, count: matchNotifications.length });
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.clearMatchNotifications');
  }
};

/**
 * Get notification settings
 */
export const getNotificationSettings = async () => {
  try {
    const settingsJson = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (settingsJson) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.getNotificationSettings');
    return DEFAULT_SETTINGS;
  }
};

/**
 * Update notification settings
 */
export const updateNotificationSettings = async (newSettings) => {
  try {
    const currentSettings = await getNotificationSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updatedSettings));
    
    remoteLogger.log('Notification settings updated', updatedSettings);
    return updatedSettings;
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.updateNotificationSettings');
    throw error;
  }
};

/**
 * Handle notification response (when user taps notification)
 */
export const handleNotificationResponse = (response) => {
  const { notification, actionIdentifier } = response;
  const { data } = notification.request.content;

  remoteLogger.log('Notification response received', {
    actionIdentifier,
    type: data?.type,
    matchId: data?.matchId
  });

  return {
    actionIdentifier,
    data,
    shouldNavigate: actionIdentifier !== 'mark_read' && actionIdentifier !== 'dismiss'
  };
};

/**
 * Set badge count
 */
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.setBadgeCount');
  }
};

/**
 * Get badge count
 */
export const getBadgeCount = async () => {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    remoteLogger.logError(error, 'notificationService.getBadgeCount');
    return 0;
  }
};

export default {
  initializeNotifications,
  requestNotificationPermissions,
  registerForPushNotifications,
  getPushToken,
  scheduleLocalNotification,
  notifyNewMessage,
  notifyMatchFound,
  notifyMatchEnded,
  notifyOpponentLeft,
  notifyConnectionRestored,
  clearAllNotifications,
  clearMatchNotifications,
  getNotificationSettings,
  updateNotificationSettings,
  handleNotificationResponse,
  setBadgeCount,
  getBadgeCount,
  NOTIFICATION_CATEGORIES
};