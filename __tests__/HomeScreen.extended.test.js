import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert, View, Text, Button } from 'react-native';
import { renderWithRedux } from './testUtils';
import HomeScreen from '../src/screens/HomeScreen';

// Mock the HomeScreen component
jest.mock('../src/screens/HomeScreen', () => {
  return function MockHomeScreen() {
    return null;
  };
});

// Mock dependencies first - this is critical
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

// Mock Picker with a testable implementation
jest.mock('@react-native-picker/picker', () => {
  const mockOnValueChange = jest.fn();
  
  return {
    Picker: ({ children, selectedValue, onValueChange, testID, enabled }) => {
      // Store the onValueChange callback so tests can call it
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
    // Expose the mock function for tests to use
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
  id: 'mock-socket-id'
};

// Mock the network module with more complete implementation
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
    startSearch: jest.fn((data, callback) => {
      if (callback) callback({ success: true });
    }),
    leaveMatch: jest.fn((matchId, userId) => Promise.resolve({ success: true })),
    getSocketInstance: jest.fn(() => mockSocket),
    navigatingBack: jest.fn(),
    resetNavigationState: jest.fn()
  };
});

// Mock uuid to return predictable values
const mockUuid = 'test-uuid-123';
jest.mock('uuid', () => ({
  v4: () => mockUuid
}));

jest.mock('@env', () => ({
  REACT_APP_SERVER_URL: 'http://localhost:3000'
}));

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn((title, message, buttons) => {
    // If buttons are provided and there's a "Yes" button with an onPress handler, call it
    if (buttons && Array.isArray(buttons)) {
      const yesButton = buttons.find(button => button.text === 'Yes' || button.text === 'Leave');
      if (yesButton && yesButton.onPress) {
        yesButton.onPress();
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

// Make sure we're using the actual component
jest.unmock('../src/screens/HomeScreen');
jest.dontMock('../src/screens/HomeScreen');

describe('HomeScreen Extended Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // 1. Generate unique user ID
  it('generates a unique user ID on component mount', () => {
    const initialState = {
      city: 'choose',
      time: 'choose',
      game: 'choose',
      loading: false,
      isSearching: false,
      currentMatch: null,
      connectionStatus: 'connected'
    };

    const { getByText } = renderWithRedux(<HomeScreen navigation={{ navigate: jest.fn() }} />, { initialState });

    // Check if the user ID is displayed
    expect(getByText(`User ID: ${mockUuid}`)).toBeTruthy();
  });

  // 2. Establish server connection on mount
  it('establishes server connection on component mount', async () => {
    const initialState = {
      city: 'choose',
      time: 'choose',
      game: 'choose',
      loading: false,
      isSearching: false,
      currentMatch: null,
      connectionStatus: 'connected'
    };

    renderWithRedux(<HomeScreen navigation={{ navigate: jest.fn() }} />, { initialState });

    // Verify socket initialization was called
    expect(require('../src/utils/network').initializeSocket).toHaveBeenCalled();

    // Verify socket emits checkActiveMatches
    expect(mockSocket.emit).toHaveBeenCalledWith('checkActiveMatches');
  });

  // 3. Match with player having same parameters
  it('matches with player having same parameters', async () => {
    const initialState = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      loading: false,
      isSearching: false,
      currentMatch: null,
      connectionStatus: 'connected'
    };

    const mockNavigate = jest.fn();
    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: mockNavigate }} />,
      { initialState }
    );

    // Start search
    fireEvent.press(getByText('Search'));

    // Verify search parameters
    expect(require('../src/utils/network').startSearch).toHaveBeenCalledWith(
      { city: 'newyork', time: 'morning', game: 'game1', userId: mockUuid },
      expect.any(Function)
    );

    // Simulate match found
    const matchFoundHandler = mockSocket.on.mock.calls.find(call => call[0] === 'matchFound')[1];
    const matchData = {
      matchId: 'match123',
      players: [
        { userId: mockUuid, city: 'newyork', time: 'morning', game: 'game1' },
        { userId: 'other-user', city: 'newyork', time: 'morning', game: 'game1' }
      ]
    };

    // Call the handler directly
    matchFoundHandler(matchData);

    // Verify navigation to chat screen with match data
    expect(mockNavigate).toHaveBeenCalledWith('Chat', { ...matchData, userId: mockUuid });

    // Verify match data is stored
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_CURRENT_MATCH',
      payload: matchData
    });
  });

  // 4. Persist match when app backgrounded
  it('persists match data when app is backgrounded', async () => {
    // Mock existing match
    const matchData = { matchId: 'match123' };
    const initialState = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      loading: false,
      isSearching: false,
      currentMatch: matchData,
      connectionStatus: 'connected'
    };

    const { unmount } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />,
      { initialState }
    );

    // Simulate app backgrounding by unmounting and remounting
    unmount();

    // Remount component
    renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />,
      { initialState }
    );

    // Verify match data is still available after remounting
    // This is implicitly tested by checking if checkActiveMatches is called
    expect(mockSocket.emit).toHaveBeenCalledWith('checkActiveMatches');

    // Simulate server response with active matches
    const activeMatchesHandler = mockSocket.on.mock.calls.find(call => call[0] === 'activeMatches')[1];
    activeMatchesHandler({ matches: [matchData] });

    // Verify match data is restored
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_CURRENT_MATCH',
      payload: matchData
    });
  });

  // 5. Handle temporary chat leave
  it('handles temporary chat leave and return', async () => {
    // Mock existing match
    const matchData = { matchId: 'match123' };
    const initialState = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      loading: false,
      isSearching: false,
      currentMatch: matchData,
      connectionStatus: 'connected'
    };

    const mockNavigate = jest.fn();
    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: mockNavigate }} />,
      { initialState }
    );

    // Find and click the "Go to Match" button to return to chat
    fireEvent.press(getByText('Go to Match'));

    // Verify navigatingBack is called to inform server
    expect(require('../src/utils/network').navigatingBack).toHaveBeenCalledWith('match123');

    // Verify navigation to chat screen with match data
    expect(mockNavigate).toHaveBeenCalledWith('Chat', { ...matchData, userId: mockUuid });
  });

  // 6. Close match on explicit leave
  it('closes match when user explicitly leaves', async () => {
    // Mock existing match
    const matchData = { matchId: 'match123' };
    const initialState = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      loading: false,
      isSearching: false,
      currentMatch: matchData,
      connectionStatus: 'connected'
    };

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />,
      { initialState }
    );

    // Find and click the "Leave Match" button
    fireEvent.press(getByText('Leave Match'));

    // Verify confirmation dialog is shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Leave Match',
      'Are you sure you want to permanently leave this match?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Leave', style: 'destructive', onPress: expect.any(Function) })
      ])
    );

    // Since our mock Alert automatically calls the Leave button's onPress handler,
    // verify that leaveMatch was called
    expect(require('../src/utils/network').leaveMatch).toHaveBeenCalledWith('match123', mockUuid);

    // Verify navigation state is reset
    expect(require('../src/utils/network').resetNavigationState).toHaveBeenCalled();

    // Verify match data is cleared
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_CURRENT_MATCH', payload: null });

    // Verify success message
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'You have left the match.');
  });

  // 7. Handle search with existing match
  it('handles search request with existing match', async () => {
    // Mock existing match
    const matchData = { matchId: 'match123' };
    const initialState = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      loading: false,
      isSearching: false,
      currentMatch: matchData,
      connectionStatus: 'connected'
    };

    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: jest.fn() }} />,
      { initialState }
    );

    // Find and click the Search button
    fireEvent.press(getByText('Search'));

    // Verify confirmation dialog is shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Active Match',
      'You are currently matched with someone. Are you sure you want to search for a new match?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'No', style: 'cancel' }),
        expect.objectContaining({ text: 'Yes', onPress: expect.any(Function) })
      ])
    );

    // Since our mock Alert automatically calls the Yes button's onPress handler,
    // verify that leaveMatch was called
    expect(require('../src/utils/network').leaveMatch).toHaveBeenCalledWith('match123', mockUuid);

    // Verify navigation state is reset
    expect(require('../src/utils/network').resetNavigationState).toHaveBeenCalled();

    // Verify match data is cleared
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_CURRENT_MATCH', payload: null });

    // Verify new search is started
    expect(require('../src/utils/network').startSearch).toHaveBeenCalledWith(
      { city: 'newyork', time: 'morning', game: 'game1', userId: mockUuid },
      expect.any(Function)
    );
  });

  // 8. Verify match data navigation
  it('passes correct match data when navigating to chat', async () => {
    // Mock valid selections
    const initialState = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      loading: false,
      isSearching: false,
      currentMatch: null,
      connectionStatus: 'connected'
    };

    const mockNavigate = jest.fn();
    const { getByText } = renderWithRedux(
      <HomeScreen navigation={{ navigate: mockNavigate }} />,
      { initialState }
    );

    // Start search
    fireEvent.press(getByText('Search'));

    // Simulate match found with detailed match data
    const matchFoundHandler = mockSocket.on.mock.calls.find(call => call[0] === 'matchFound')[1];
    const matchData = {
      matchId: 'match123',
      players: [
        { userId: mockUuid, city: 'newyork', time: 'morning', game: 'game1' },
        { userId: 'other-user', city: 'newyork', time: 'morning', game: 'game1' }
      ],
      createdAt: new Date().toISOString(),
      gameDetails: {
        type: 'game1',
        maxDuration: 3600
      }
    };

    // Call the handler directly
    matchFoundHandler(matchData);

    // Verify navigation to chat screen with complete match data
    expect(mockNavigate).toHaveBeenCalledWith('Chat', {
      ...matchData,
      userId: mockUuid
    });

    // Verify match data is stored with all details
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_CURRENT_MATCH',
      payload: matchData
    });
  });
});