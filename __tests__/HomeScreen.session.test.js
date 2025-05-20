import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../src/screens/HomeScreen';
import { renderWithRedux } from './testUtils';
import * as sessionManager from '../src/utils/sessionManager';
import * as network from '../src/utils/network';
import remoteLogger from '../src/utils/remoteLogger';

// Mock dependencies
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useSelector: jest.fn((selector) => {
    // Return different values based on the selector function
    const state = {
      city: 'choose',
      time: 'choose',
      game: 'choose',
      loading: false,
      isSearching: false,
      currentMatch: null,
      connectionStatus: 'connected'
    };
    return selector(state);
  }),
  useDispatch: () => mockDispatch
}));

// Mock Picker
jest.mock('@react-native-picker/picker', () => {
  const mockOnValueChange = jest.fn();
  
  return {
    Picker: ({ children, selectedValue, onValueChange, testID, enabled }) => {
      mockOnValueChange.mockImplementation(onValueChange);
      
      return (
        <select 
          data-testid={testID || "picker"} 
          value={selectedValue}
          disabled={!enabled}
        >
          {children}
        </select>
      );
    },
    Item: ({ label, value }) => <option value={value}>{label}</option>,
    __mock: {
      onValueChange: mockOnValueChange
    }
  };
});

// Mock socket instance
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn((event, data, callback) => {
    if (callback && typeof callback === 'function') {
      callback({ success: true });
    }
  }),
  connected: true,
  id: 'mock-socket-id',
  removeAllListeners: jest.fn()
};

// Mock network module
jest.mock('../src/utils/network', () => {
  return {
    initializeSocket: jest.fn(() => Promise.resolve(mockSocket)),
    onMatchFound: jest.fn((callback) => {
      mockSocket.on('matchFound', callback);
      return () => mockSocket.off('matchFound', callback);
    }),
    onConnectionError: jest.fn((callback) => {
      mockSocket.on('connect_error', callback);
      return () => mockSocket.off('connect_error', callback);
    }),
    onDisconnect: jest.fn((callback) => {
      mockSocket.on('disconnect', callback);
      return () => mockSocket.off('disconnect', callback);
    }),
    onSearchTimeout: jest.fn((callback) => {
      mockSocket.on('searchTimeout', callback);
      return () => mockSocket.off('searchTimeout', callback);
    }),
    startSearch: jest.fn((data, callback) => {
      if (callback) callback({ success: true });
    }),
    leaveMatch: jest.fn((matchId, userId) => Promise.resolve({ success: true })),
    getSocketInstance: jest.fn(() => mockSocket),
    navigatingBack: jest.fn(),
    resetNavigationState: jest.fn(),
    manualReconnect: jest.fn(() => true)
  };
});

// Mock session manager
jest.mock('../src/utils/sessionManager', () => {
  return {
    getUserId: jest.fn(() => Promise.resolve('test-user-id')),
    updateActivity: jest.fn(() => Promise.resolve()),
    resetInactivityTimer: jest.fn(),
    getSessionTimeouts: jest.fn(() => ({
      inactivityTimeout: '8 hours',
      backgroundSearchTimeout: '15 minutes'
    })),
    initializeSessionManager: jest.fn(),
    cleanupSessionManager: jest.fn(),
    logoutUser: jest.fn()
  };
});

// Mock remote logger
jest.mock('../src/utils/remoteLogger', () => ({
  log: jest.fn(),
  logError: jest.fn(),
  LOG_LEVELS: {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  }
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn((title, message, buttons) => {
    // If buttons are provided and there's a button with an onPress handler, call it
    if (buttons && Array.isArray(buttons)) {
      const actionButton = buttons.find(button => 
        button.text === 'Yes' || 
        button.text === 'Leave' || 
        button.text === 'Retry' ||
        button.text === 'OK'
      );
      if (actionButton && actionButton.onPress) {
        actionButton.onPress();
      }
    }
  })
}));

// Mock actions
jest.mock('../src/store/actions', () => ({
  setCity: (city) => ({ type: 'SET_CITY', payload: city }),
  setTime: (time) => ({ type: 'SET_TIME', payload: time }),
  setGame: (game) => ({ type: 'SET_GAME', payload: game }),
  setLoading: (loading) => ({ type: 'SET_LOADING', payload: loading }),
  setIsSearching: (isSearching) => ({ type: 'SET_IS_SEARCHING', payload: isSearching }),
  setCurrentMatch: (match) => ({ type: 'SET_CURRENT_MATCH', payload: match }),
  setConnectionStatus: (status) => ({ type: 'SET_CONNECTION_STATUS', payload: status })
}));

// Mock fetch for server connection tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    status: 200,
    json: () => Promise.resolve({ status: 'ok' })
  })
);

// Mock env variables
jest.mock('@env', () => ({
  REACT_APP_SERVER_URL: 'http://localhost:3000'
}));

describe('HomeScreen Session Management Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('loads user ID and initializes socket on mount', async () => {
    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify getUserId was called
    expect(sessionManager.getUserId).toHaveBeenCalled();
    
    // Verify updateActivity was called
    expect(sessionManager.updateActivity).toHaveBeenCalled();
    
    // Verify socket initialization was called
    expect(network.initializeSocket).toHaveBeenCalledWith(20000);
    
    // Verify remote logging
    expect(remoteLogger.log).toHaveBeenCalledWith(
      'HomeScreen initialized with user ID', 
      { userId: 'test-user-id' }
    );
  });

  test('handles socket initialization failure', async () => {
    // Mock initializeSocket to reject
    network.initializeSocket.mockRejectedValueOnce(new Error('Connection failed'));

    renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify error was logged
    expect(remoteLogger.logError).toHaveBeenCalledWith(
      expect.any(Error), 
      'HomeScreen.initializeSocket'
    );

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Connection Error',
      'Failed to connect to the server. Some features may not work properly.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Retry' }),
        expect.objectContaining({ text: 'OK' })
      ])
    );

    // Since our mock Alert automatically calls the Retry button's onPress handler,
    // verify that initializeSocket was called again
    expect(network.initializeSocket).toHaveBeenCalledTimes(2);
  });

  test('resets inactivity timer when setting up socket', async () => {
    renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify resetInactivityTimer was called
    expect(sessionManager.resetInactivityTimer).toHaveBeenCalled();
  });

  test('updates activity when user interacts with the app', async () => {
    // Mock isSearching to be true
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: true,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify updateActivity was called
    expect(sessionManager.updateActivity).toHaveBeenCalled();
  });

  test('updates activity when starting a search', async () => {
    // Mock valid selections
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: false,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Clear previous calls to updateActivity
    sessionManager.updateActivity.mockClear();

    // Click search button
    fireEvent.press(getByText('Search'));

    // Verify updateActivity was called
    expect(sessionManager.updateActivity).toHaveBeenCalled();
  });
});

describe('HomeScreen Socket Connection Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('handles socket connection error during search', async () => {
    // Mock valid selections
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: false,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    // Mock getSocketInstance to return null (no connection)
    network.getSocketInstance.mockReturnValueOnce(null);

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Click search button
    fireEvent.press(getByText('Search'));

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not Connected',
      'Cannot start search because you are not connected to the server. Please check your connection and try again.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Retry Connection' }),
        expect.objectContaining({ text: 'Cancel' })
      ])
    );

    // Since our mock Alert automatically calls the Retry Connection button's onPress handler,
    // verify that initializeSocket was called again
    expect(network.initializeSocket).toHaveBeenCalledWith(10000);
  });

  test('handles socket disconnection during search', async () => {
    // Mock isSearching to be true
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: true,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find the disconnect handler
    const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
    
    // Simulate disconnect
    disconnectHandler('transport close');

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Connection Lost',
      'Connection to server lost. Your search has been canceled.'
    );

    // Verify search was canceled
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_IS_SEARCHING', payload: false });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: false });
  });

  test('handles socket reconnection', async () => {
    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find the reconnect handler
    const reconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'reconnect')[1];
    
    // Simulate reconnect
    reconnectHandler(3);

    // Verify checkActiveMatches was called
    expect(mockSocket.emit).toHaveBeenCalledWith('checkActiveMatches');

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reconnected',
      'Connection to the server has been restored.'
    );
  });

  test('handles manual reconnection', async () => {
    // Mock connectionStatus to be reconnect_failed
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: false,
        currentMatch: null,
        connectionStatus: 'reconnect_failed'
      };
      return selector(state);
    });

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find and click the Reconnect button
    fireEvent.press(getByText('Reconnect'));

    // Verify manualReconnect was called
    expect(network.manualReconnect).toHaveBeenCalled();

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reconnecting',
      'Attempting to reconnect to the server...'
    );
  });
});

describe('HomeScreen Server Connection Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('tests server connection successfully', async () => {
    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find and click the Test Server Connection button
    fireEvent.press(getByText('Test Server Connection'));

    // Wait for fetch to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/ping',
      expect.objectContaining({
        headers: { 'Cache-Control': 'no-cache' }
      })
    );

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Server Connection',
      'Successfully connected to the server!'
    );
  });

  test('handles server connection failure', async () => {
    // Mock fetch to reject
    global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find and click the Test Server Connection button
    fireEvent.press(getByText('Test Server Connection'));

    // Wait for fetch to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify Alert was shown with error message
    expect(Alert.alert).toHaveBeenCalledWith(
      'Server Connection Error',
      expect.stringContaining('Network request failed')
    );
  });

  test('handles server connection timeout', async () => {
    // Mock AbortController
    const mockAbort = jest.fn();
    global.AbortController = jest.fn(() => ({
      signal: 'mock-signal',
      abort: mockAbort
    }));

    // Mock fetch to never resolve
    global.fetch.mockImplementationOnce(() => new Promise(() => {}));

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find and click the Test Server Connection button
    fireEvent.press(getByText('Test Server Connection'));

    // Advance timers to trigger timeout
    await act(async () => {
      jest.advanceTimersByTime(11000);
    });

    // Verify abort was called
    expect(mockAbort).toHaveBeenCalled();
  });
});

describe('HomeScreen Search and Match Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('validates user selections before search', async () => {
    // Mock invalid selections
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'choose',
        time: 'choose',
        game: 'choose',
        loading: false,
        isSearching: false,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Click search button
    fireEvent.press(getByText('Search'));

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing Information',
      'Please choose a city, time, and game type before searching.'
    );

    // Verify search was not started
    expect(network.startSearch).not.toHaveBeenCalled();
  });

  test('handles search timeout', async () => {
    // Mock isSearching to be true
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: true,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find the search timeout handler
    const searchTimeoutHandler = mockSocket.on.mock.calls.find(call => call[0] === 'searchTimeout')[1];
    
    // Simulate search timeout
    searchTimeoutHandler({ message: 'No matching players found.' });

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Timeout',
      'No matching players found.'
    );

    // Verify search was canceled
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_IS_SEARCHING', payload: false });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: false });
  });

  test('detects and resets stuck search state', async () => {
    // Mock isSearching to be true
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: false,
        isSearching: true,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Advance timers to trigger stuck state check
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Reset',
      'The search appeared to be stuck and has been reset. You can try searching again.'
    );

    // Verify search was reset
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_IS_SEARCHING', payload: false });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: false });
  });

  test('cancels search when requested by user', async () => {
    // Mock isSearching to be true and loading to be true
    jest.spyOn(require('react-redux'), 'useSelector').mockImplementation((selector) => {
      const state = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        loading: true,
        isSearching: true,
        currentMatch: null,
        connectionStatus: 'connected'
      };
      return selector(state);
    });

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />
    );

    // Wait for async operations to complete
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Find and click the Cancel button
    fireEvent.press(getByText('Cancel'));

    // Verify socket.emit was called with cancelSearch
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'cancelSearch',
      { userId: 'test-user-id' },
      expect.any(Function)
    );

    // Verify search was canceled
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_IS_SEARCHING', payload: false });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_LOADING', payload: false });

    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Canceled',
      'You have canceled the search.'
    );
  });
});