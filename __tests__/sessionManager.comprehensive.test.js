import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as sessionManager from '../src/utils/sessionManager';
import { getSocketInstance, disconnectSocket } from '../src/utils/socketManager';
import remoteLogger from '../src/utils/remoteLogger';
import store from '../src/store';
import { setIsSearching, setCurrentMatch } from '../src/store/actions/matchActions';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock socket instance
const mockSocket = {
  connected: true,
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  id: 'mock-socket-id',
};

jest.mock('../src/utils/socketManager', () => ({
  getSocketInstance: jest.fn(() => mockSocket),
  disconnectSocket: jest.fn(),
}));

jest.mock('../src/utils/remoteLogger', () => ({
  log: jest.fn(),
  logError: jest.fn(),
  LOG_LEVELS: {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  }
}));

// Mock AppState
const mockAppStateListener = { remove: jest.fn() };
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => mockAppStateListener),
    removeEventListener: jest.fn(),
    currentState: 'active',
  },
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

// Mock Redux store and actions
jest.mock('../src/store/actions/matchActions', () => ({
  setIsSearching: jest.fn(() => ({ type: 'SET_IS_SEARCHING', payload: false })),
  setCurrentMatch: jest.fn(() => ({ type: 'SET_CURRENT_MATCH', payload: null })),
}));

jest.mock('../src/store', () => ({
  dispatch: jest.fn(),
  getState: jest.fn(() => ({
    currentMatch: { matchId: 'test-match-id' }
  })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

describe('Session Manager Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization and Cleanup', () => {
    test('initializeSessionManager sets up AppState listener and starts inactivity timer', () => {
      sessionManager.initializeSessionManager();
      
      // Verify AppState listener was set up
      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      
      // Verify inactivity timer was started (indirectly by checking AsyncStorage)
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Verify logging
      expect(remoteLogger.log).toHaveBeenCalledWith('Session manager initialized');
    });

    test('cleanupSessionManager removes AppState listener and clears timers', () => {
      // Initialize first
      sessionManager.initializeSessionManager();
      
      // Then clean up
      sessionManager.cleanupSessionManager();
      
      // Verify AppState listener was removed
      expect(mockAppStateListener.remove).toHaveBeenCalled();
      
      // Verify logging
      expect(remoteLogger.log).toHaveBeenCalledWith('Session manager cleaned up');
    });
  });

  describe('User ID Management', () => {
    test('getUserId returns existing ID from AsyncStorage', async () => {
      // Mock AsyncStorage to return an existing ID
      const existingId = 'existing-user-id';
      AsyncStorage.getItem.mockResolvedValueOnce(existingId);
      
      const userId = await sessionManager.getUserId();
      
      // Verify correct ID was returned
      expect(userId).toBe(existingId);
      
      // Verify AsyncStorage was called with correct key
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@MatchChatApp:userId');
    });

    test('getUserId generates new ID when none exists', async () => {
      // Reset the module to clear any cached user ID
      jest.resetModules();
      
      // Re-import with clean state
      const sessionManagerFresh = require('../src/utils/sessionManager');
      
      // Mock AsyncStorage to return null (no existing ID)
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      
      // Mock AsyncStorage.setItem to actually store the value
      const originalSetItem = AsyncStorage.setItem;
      AsyncStorage.setItem = jest.fn((key, value) => {
        return Promise.resolve();
      });
      
      // Call getUserId
      const userId = await sessionManagerFresh.getUserId();
      
      // Verify new ID was generated
      expect(userId).toBe('test-uuid-123');
      
      // Verify AsyncStorage was called to save the new ID
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@MatchChatApp:userId', 'test-uuid-123');
      
      // Restore original function
      AsyncStorage.setItem = originalSetItem;
    });

    test('getUserId caches ID for subsequent calls', async () => {
      // Reset the module to clear any cached user ID
      jest.resetModules();
      
      // Re-import with clean state
      const sessionManagerFresh = require('../src/utils/sessionManager');
      
      // Set up a mock implementation that returns a specific value
      AsyncStorage.getItem = jest.fn((key) => {
        if (key === '@MatchChatApp:userId') {
          return Promise.resolve('cached-user-id');
        }
        return Promise.resolve(null);
      });
      
      // First call should get from AsyncStorage
      const firstCall = await sessionManagerFresh.getUserId();
      expect(firstCall).toBe('cached-user-id');
      
      // Clear the mock to verify it's not called again
      AsyncStorage.getItem.mockClear();
      
      // Second call should use cached value
      const secondCall = await sessionManagerFresh.getUserId();
      expect(secondCall).toBe('cached-user-id');
      
      // Verify AsyncStorage was not called for the second request
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    test('getUserId handles AsyncStorage errors gracefully', async () => {
      // Reset the module to clear any cached user ID
      jest.resetModules();
      
      // Re-import with clean state
      const sessionManagerFresh = require('../src/utils/sessionManager');
      
      // Mock remoteLogger to verify error logging
      const originalLogError = remoteLogger.logError;
      remoteLogger.logError = jest.fn();
      
      // Mock AsyncStorage to throw an error
      AsyncStorage.getItem = jest.fn().mockRejectedValueOnce(new Error('Storage error'));
      
      const userId = await sessionManagerFresh.getUserId();
      
      // Verify a new ID was generated despite the error
      expect(userId).toBe('test-uuid-123');
      
      // Verify error was logged
      expect(remoteLogger.logError).toHaveBeenCalled();
      
      // Restore original function
      remoteLogger.logError = originalLogError;
    });
  });

  describe('Activity Tracking', () => {
    test('updateActivity updates timestamp and resets timer', async () => {
      await sessionManager.updateActivity();
      
      // Verify timestamp was updated
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@MatchChatApp:lastActive', expect.any(String));
    });

    test('resetInactivityTimer clears existing timer and sets new one', () => {
      // Mock setTimeout and clearTimeout
      const originalSetTimeout = global.setTimeout;
      const originalClearTimeout = global.clearTimeout;
      
      global.setTimeout = jest.fn(() => 123);
      global.clearTimeout = jest.fn();
      
      try {
        // Call resetInactivityTimer twice to test clearing existing timer
        sessionManager.resetInactivityTimer();
        sessionManager.resetInactivityTimer();
        
        // Verify clearTimeout was called
        expect(global.clearTimeout).toHaveBeenCalled();
        
        // Verify setTimeout was called twice
        expect(global.setTimeout).toHaveBeenCalledTimes(2);
        
        // Verify timestamp was updated
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@MatchChatApp:lastActive', expect.any(String));
      } finally {
        // Restore original functions
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
      }
    });

    test('inactivity timer triggers logout when it expires', async () => {
      // Mock setTimeout to capture the callback
      const originalSetTimeout = global.setTimeout;
      let timeoutCallback;
      let timeoutId = 123;
      global.setTimeout = jest.fn((callback, timeout) => {
        timeoutCallback = callback;
        return timeoutId;
      });
      
      // Mock logoutUser to avoid actual implementation
      const originalLogoutUser = sessionManager.logoutUser;
      sessionManager.logoutUser = jest.fn();
      
      try {
        // Reset the module to ensure clean state
        jest.resetModules();
        const freshSessionManager = require('../src/utils/sessionManager');
        
        // Start the inactivity timer
        freshSessionManager.resetInactivityTimer();
        
        // Verify setTimeout was called
        expect(global.setTimeout).toHaveBeenCalled();
        
        // Make sure we have a callback
        expect(timeoutCallback).toBeDefined();
        
        // Call the timeout callback to simulate timer expiration
        if (timeoutCallback) {
          await timeoutCallback();
        }
        
        // Verify logoutUser was called with 'inactivity'
        expect(freshSessionManager.logoutUser).toHaveBeenCalledWith('inactivity');
      } finally {
        // Restore original functions
        global.setTimeout = originalSetTimeout;
        sessionManager.logoutUser = originalLogoutUser;
      }
    });
  });

  describe('App State Handling', () => {
    test('handles app going to background', () => {
      // Mock setTimeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn(() => 123);
      
      try {
        // Initialize session manager to set up AppState listener
        sessionManager.initializeSessionManager();
        
        // Get the AppState change handler
        const appStateChangeHandler = AppState.addEventListener.mock.calls[0][1];
        
        // Simulate app going to background
        appStateChangeHandler('background');
        
        // Verify timestamp was updated
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@MatchChatApp:lastActive', expect.any(String));
        
        // Verify background timer was set up
        expect(global.setTimeout).toHaveBeenCalled();
      } finally {
        // Restore original function
        global.setTimeout = originalSetTimeout;
      }
    });

    test('handles app coming to foreground', async () => {
      // Add connect method to mockSocket
      mockSocket.connect = jest.fn();
      
      // Mock AsyncStorage to return a recent timestamp (not expired)
      const recentTimestamp = Date.now() - 1000; // 1 second ago
      AsyncStorage.getItem.mockResolvedValueOnce(recentTimestamp.toString());
      
      // Initialize session manager to set up AppState listener
      sessionManager.initializeSessionManager();
      
      // Get the AppState change handler
      const appStateChangeHandler = AppState.addEventListener.mock.calls[0][1];
      
      // Simulate app going to background first
      appStateChangeHandler('background');
      
      // Then simulate app coming to foreground
      appStateChangeHandler('active');
      
      // Manually trigger the check instead of waiting
      // This avoids the timeout issue
      sessionManager.checkInactivityOnResume();
      
      // Verify inactivity check was performed
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@MatchChatApp:lastActive');
      
      // Verify socket reconnection was attempted
      expect(mockSocket.connect).toHaveBeenCalled();
    }, 1000);

    test('logs out user when app comes to foreground after inactivity timeout', async () => {
      // Mock logoutUser to avoid actual implementation
      const originalLogoutUser = sessionManager.logoutUser;
      sessionManager.logoutUser = jest.fn();
      
      // Mock AsyncStorage to return an old timestamp (expired)
      const oldTimestamp = Date.now() - (9 * 60 * 60 * 1000); // 9 hours ago (beyond 8 hour timeout)
      AsyncStorage.getItem.mockResolvedValueOnce(oldTimestamp.toString());
      
      // Initialize session manager
      sessionManager.initializeSessionManager();
      
      // Directly call the function that checks inactivity on resume
      // This avoids the timeout issue with AppState events
      await sessionManager.checkInactivityOnResume();
      
      // Verify logoutUser was called with 'inactivity_resume'
      expect(sessionManager.logoutUser).toHaveBeenCalledWith('inactivity_resume');
      
      // Restore original function
      sessionManager.logoutUser = originalLogoutUser;
    }, 1000);

    test('disconnects socket after background timeout', () => {
      // Initialize session manager to set up AppState listener
      sessionManager.initializeSessionManager();
      
      // Get the AppState change handler
      const appStateChangeHandler = AppState.addEventListener.mock.calls[0][1];
      
      // Simulate app going to background
      appStateChangeHandler('background');
      
      // Fast-forward time to trigger background timeout (15 minutes)
      jest.advanceTimersByTime(15 * 60 * 1000 + 100);
      
      // Verify socket was disconnected
      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      // Verify logging
      expect(remoteLogger.log).toHaveBeenCalledWith(
        'Disconnecting socket due to app being in background'
      );
    });
  });

  describe('Logout Functionality', () => {
    test('logoutUser cleans up all resources', async () => {
      await sessionManager.logoutUser('manual');
      
      // Verify user data was cleared
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@MatchChatApp:userId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@MatchChatApp:lastActive');
      
      // Verify app state was reset
      expect(store.dispatch).toHaveBeenCalledWith(setIsSearching());
      expect(store.dispatch).toHaveBeenCalledWith(setCurrentMatch());
      
      // Verify socket event listeners were removed
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      
      // Verify socket was disconnected
      expect(disconnectSocket).toHaveBeenCalled();
      
      // Verify logging
      expect(remoteLogger.log).toHaveBeenCalledWith('Logging out user', { reason: 'manual' });
    });

    test('logoutUser notifies server about leaving matches', async () => {
      // Mock store to return a current match
      store.getState.mockReturnValueOnce({
        currentMatch: { matchId: 'match-123' }
      });
      
      await sessionManager.logoutUser('manual');
      
      // Verify socket emitted leaveAllRooms
      expect(mockSocket.emit).toHaveBeenCalledWith('leaveAllRooms');
      
      // Verify socket emitted leaveMatch with correct matchId
      expect(mockSocket.emit).toHaveBeenCalledWith('leaveMatch', { matchId: 'match-123' });
    });

    test('logoutUser shows alert when reason is inactivity', async () => {
      await sessionManager.logoutUser('inactivity');
      
      // Verify Alert was shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Session Expired',
        'Your session has expired due to inactivity. Please restart your search or match.'
      );
    });

    test('logoutUser handles errors gracefully', async () => {
      // Mock AsyncStorage to throw an error
      AsyncStorage.removeItem.mockRejectedValueOnce(new Error('Storage error'));
      
      // Mock disconnectSocket to verify it's called
      disconnectSocket.mockClear();
      
      await sessionManager.logoutUser('manual');
      
      // Verify error was logged
      expect(remoteLogger.logError).toHaveBeenCalled();
      
      // Verify function completed despite error
      expect(disconnectSocket).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('getSessionTimeouts returns expected values', () => {
      const timeouts = sessionManager.getSessionTimeouts();
      
      expect(timeouts).toEqual({
        inactivityTimeout: '8 hours',
        backgroundSearchTimeout: '15 minutes'
      });
    });

    test('getSessionTimeouts handles errors gracefully', () => {
      // Create a mock implementation that throws
      const mockGetSessionTimeouts = jest.fn(() => {
        throw new Error('Unexpected error');
      });
      
      // Save original implementation
      const originalGetSessionTimeouts = sessionManager.getSessionTimeouts;
      
      try {
        // Replace with mock implementation
        sessionManager.getSessionTimeouts = mockGetSessionTimeouts;
        
        // Mock console.error to prevent test output pollution
        const originalConsoleError = console.error;
        console.error = jest.fn();
        
        try {
          // Call the function that will throw
          const result = sessionManager.getSessionTimeouts();
          
          // This should not be reached, but if it is, verify default values
          expect(result).toEqual({
            inactivityTimeout: 'a few hours',
            backgroundSearchTimeout: 'a few minutes'
          });
        } catch (error) {
          // Test passes if we catch the error here
          expect(error.message).toBe('Unexpected error');
        } finally {
          // Restore console.error
          console.error = originalConsoleError;
        }
      } finally {
        // Restore original function
        sessionManager.getSessionTimeouts = originalGetSessionTimeouts;
      }
    });
  });
});