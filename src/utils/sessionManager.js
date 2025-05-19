/**
 * sessionManager.js
 * 
 * This module handles user session management including:
 * - Automatic logout after periods of inactivity
 * - Session persistence between app launches
 * - Cleanup of abandoned searches and matches
 */

import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { disconnectSocket, getSocketInstance } from './network';
import store from '../store/store';
import { setIsSearching, setCurrentMatch } from '../store/actions';
import remoteLogger from './remoteLogger';

// Session timeout constants (in milliseconds)
const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours - single rule for all inactivity
const BACKGROUND_SOCKET_TIMEOUT = 15 * 60 * 1000; // 15 minutes - disconnect socket when in background

// Storage keys
const USER_ID_KEY = '@MatchChatApp:userId';
const LAST_ACTIVE_KEY = '@MatchChatApp:lastActive';

// Timers
let inactivityTimer = null;
let backgroundTimer = null;
let appState = 'active';

/**
 * Initialize the session manager
 * Sets up event listeners and timers
 */
export const initializeSessionManager = () => {
  // Set up app state change listener - using the newer API
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Start inactivity timer
  resetInactivityTimer();
  
  // Log initialization
  remoteLogger.log('Session manager initialized');
};

/**
 * Handle app state changes (foreground/background)
 * @param {string} nextAppState - The new app state
 */
const handleAppStateChange = (nextAppState) => {
  remoteLogger.log('App state changed', { 
    previousState: appState, 
    nextState: nextAppState 
  });
  
  // App is going to background
  if (appState === 'active' && nextAppState.match(/inactive|background/)) {
    // Record last active timestamp
    updateLastActiveTimestamp();
    
    // Clear any existing background timer before setting a new one
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
    
    // Set up background timer to disconnect socket (but not cancel search)
    backgroundTimer = setTimeout(() => {
      const socket = getSocketInstance();
      if (socket && socket.connected) {
        remoteLogger.log('Disconnecting socket due to app being in background');
        // Note: We're using socket.disconnect() directly, not disconnectSocket()
        // This keeps the socket instance but disconnects from the server
        socket.disconnect();
      }
      // Clear the timer reference after it's executed
      backgroundTimer = null;
    }, BACKGROUND_SOCKET_TIMEOUT);
  }
  
  // App is coming to foreground
  if (appState.match(/inactive|background/) && nextAppState === 'active') {
    // Clear background timer
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
    
    // Check if we need to log out due to inactivity
    checkInactivityLogout();
    
    // Reset inactivity timer
    resetInactivityTimer();
    
    // Reconnect socket if it was disconnected
    const socket = getSocketInstance();
    if (socket && !socket.connected) {
      remoteLogger.log('Reconnecting socket after app came to foreground');
      socket.connect();
    }
  }
  
  // Update app state
  appState = nextAppState;
};

/**
 * Reset the inactivity timer
 * Called when user interacts with the app
 */
export const resetInactivityTimer = () => {
  // Clear existing timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  // Set new timer
  inactivityTimer = setTimeout(() => {
    logoutUser('inactivity');
  }, INACTIVITY_TIMEOUT);
  
  // Update last active timestamp
  updateLastActiveTimestamp();
};

/**
 * Update the timestamp of the user's last activity
 */
const updateLastActiveTimestamp = async () => {
  try {
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  } catch (error) {
    remoteLogger.logError(error, 'sessionManager.updateLastActiveTimestamp');
  }
};

/**
 * Update the last active timestamp whenever the user interacts with the app
 * This includes sending messages, searching, or navigating
 */
export const updateActivity = async () => {
  try {
    // Simply update the last active timestamp
    await updateLastActiveTimestamp();
    
    // Reset the inactivity timer
    resetInactivityTimer();
  } catch (error) {
    remoteLogger.logError(error, 'sessionManager.updateActivity');
  }
};

/**
 * Check if the user should be logged out due to inactivity
 * Called when the app comes to the foreground
 */
const checkInactivityLogout = async () => {
  try {
    const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActiveStr) return;
    
    const lastActive = parseInt(lastActiveStr, 10);
    const currentTime = Date.now();
    
    if (currentTime - lastActive > INACTIVITY_TIMEOUT) {
      logoutUser('inactivity_resume');
    }
  } catch (error) {
    remoteLogger.logError(error, 'sessionManager.checkInactivityLogout');
  }
};

/**
 * Get the user ID from storage or generate a new one
 * @returns {Promise<string>} The user ID
 */
// Cache the user ID in memory to avoid generating new ones on storage failures
let cachedUserId = null;

export const getUserId = async () => {
  // If we already have a cached ID, return it
  if (cachedUserId) {
    return cachedUserId;
  }
  
  try {
    // Try to get the ID from storage
    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (userId) {
      cachedUserId = userId;
      return userId;
    }
    
    // Generate new user ID
    const newUserId = uuidv4();
    
    // Try to save it to storage
    try {
      await AsyncStorage.setItem(USER_ID_KEY, newUserId);
    } catch (storageError) {
      // Log the storage error but continue with the new ID
      remoteLogger.logError(storageError, 'sessionManager.getUserId.storageError');
    }
    
    // Cache the new ID
    cachedUserId = newUserId;
    return newUserId;
  } catch (error) {
    remoteLogger.logError(error, 'sessionManager.getUserId');
    
    // If we have a catastrophic error, generate a new ID
    // but try to be consistent within the session
    if (!cachedUserId) {
      cachedUserId = uuidv4();
    }
    
    return cachedUserId;
  }
};

/**
 * Log out the user and clean up resources
 * @param {string} reason - The reason for logout
 */
export const logoutUser = async (reason = 'manual') => {
  remoteLogger.log('Logging out user', { reason });
  
  try {
    // Clear user data
    await AsyncStorage.removeItem(USER_ID_KEY);
    await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
    
    // Reset app state
    store.dispatch(setIsSearching(false));
    store.dispatch(setCurrentMatch(null));
    
    // Get socket instance before disconnecting
    const socket = getSocketInstance();
    
    // Clean up socket event listeners if socket exists
    if (socket) {
      // Remove all custom event listeners to prevent memory leaks
      socket.removeAllListeners('playerJoined');
      socket.removeAllListeners('playerLeft');
      socket.removeAllListeners('playerStatus');
      socket.removeAllListeners('matchEnded');
      socket.removeAllListeners('message');
      socket.removeAllListeners('messageStatus');
      socket.removeAllListeners('error');
      socket.removeAllListeners('client_reconnected');
      
      // Leave any rooms the socket might be in
      if (socket.rooms) {
        for (const room of Array.from(socket.rooms)) {
          if (room !== socket.id) {
            socket.leave(room);
          }
        }
      }
    }
    
    // Disconnect socket
    disconnectSocket();
    
    // Clear timers
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
    
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
    
    // Reset cached user ID
    cachedUserId = null;
    
    // Alert the user if this was due to inactivity
    if (reason.includes('inactivity')) {
      Alert.alert(
        'Session Expired',
        'Your session has expired due to inactivity. Please restart your search or match.'
      );
    }
  } catch (error) {
    remoteLogger.logError(error, 'sessionManager.logoutUser');
  }
};

/**
 * Clean up resources when the app is closed
 */
// Store the AppState subscription
let appStateSubscription = null;

export const cleanupSessionManager = () => {
  // Remove app state listener using the subscription
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  
  // Clear timers
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  
  if (backgroundTimer) {
    clearTimeout(backgroundTimer);
    backgroundTimer = null;
  }
  
  // Log cleanup
  remoteLogger.log('Session manager cleaned up');
};

/**
 * Get session timeout information for display to users
 * @returns {Object} Timeout information in human-readable format
 */
export const getSessionTimeouts = () => {
  return {
    inactivityTimeout: '8 hours',
    backgroundSearchTimeout: '15 minutes'
  };
};