import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, BackHandler, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatScreen from '../src/screens/ChatScreen';
import { renderWithRedux } from './testUtils';
import * as networkUtils from '../src/utils/network';
import { selectMessages } from '../src/store/selectors';
import { addMessage, updateMessageStatus, setMessages } from '../src/store/actions';

// Mock dependencies
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(),
}));

jest.mock('../src/store/selectors', () => ({
  selectMessages: jest.fn(),
}));

jest.mock('../src/store/actions', () => ({
  addMessage: jest.fn((matchId, message) => ({ 
    type: 'ADD_MESSAGE', 
    payload: { matchId, message } 
  })),
  updateMessageStatus: jest.fn((matchId, messageId, status) => ({ 
    type: 'UPDATE_MESSAGE_STATUS', 
    payload: { matchId, messageId, status } 
  })),
  setMessages: jest.fn((matchId, messages) => ({ 
    type: 'SET_MESSAGES', 
    payload: { matchId, messages } 
  })),
}));

// Mock socket instance
const mockSocketInstance = {
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  connected: true,
};

// Mock network utility functions
jest.mock('../src/utils/network', () => ({
  initializeSocket: jest.fn(() => Promise.resolve()),
  getSocketInstance: jest.fn(() => mockSocketInstance),
  sendMessage: jest.fn(),
  onReceiveMessage: jest.fn(() => jest.fn()),
  onOpponentLeftMatch: jest.fn(() => jest.fn()),
  onConnectionError: jest.fn(() => jest.fn()),
  onDisconnect: jest.fn(() => jest.fn()),
  onMessageDelivered: jest.fn(() => jest.fn()),
  onMessageRead: jest.fn(() => jest.fn()),
  joinMatch: jest.fn(),
  navigatingAway: jest.fn(),
}));

// Mock FlatList component
jest.mock('react-native/Libraries/Lists/FlatList', () => 'FlatList');

// Mock ErrorBoundary component
jest.mock('../src/components/ErrorBoundary', () => 'ErrorBoundary');

// Mock useFocusEffect
const mockCallback = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    mockCallback.mockImplementation(callback);
    mockCallback();
    return null;
  },
}));

describe('ChatScreen Enhanced Tests', () => {
  const mockRoute = {
    params: {
      userId: 'user123',
      matchId: 'match123',
    },
  };
  
  const mockNavigation = {
    goBack: jest.fn(),
  };

  const mockDispatch = jest.fn();
  const mockMessages = [
    { id: '1', sender: 'user123', text: 'Hello', timestamp: Date.now(), status: 'sent' },
    { id: '2', sender: 'other123', text: 'Hi there', timestamp: Date.now(), status: 'read' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    require('react-redux').useSelector.mockImplementation((selector) => {
      if (selector === selectMessages) {
        return mockMessages;
      }
      return selector();
    });
    
    require('react-redux').useDispatch.mockReturnValue(mockDispatch);
    selectMessages.mockReturnValue(mockMessages);
  });

  // Test Scenario 1: Render with active match
  it('renders correctly with active match', async () => {
    const { getByText, queryByText } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
      expect(networkUtils.joinMatch).toHaveBeenCalledWith('match123', 'user123');
    });

    // Verify match ID is displayed
    expect(getByText('Match ID: match123')).toBeTruthy();
    
    // Verify no "match ended" message is shown
    expect(queryByText('This match has ended')).toBeNull();
  });

  // Test Scenario 2: Send message successfully
  it('sends message successfully', async () => {
    const { getByPlaceholderText, getByText } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
    });

    // Type a message
    const messageInput = getByPlaceholderText('Type your message...');
    fireEvent.changeText(messageInput, 'Hello world');
    
    // Send the message
    const sendButton = getByText('Send');
    fireEvent.press(sendButton);
    
    // Verify sendMessage was called with correct parameters
    expect(networkUtils.sendMessage).toHaveBeenCalled();
    const sendMessageArgs = networkUtils.sendMessage.mock.calls[0];
    expect(sendMessageArgs[0].text).toBe('Hello world');
    expect(sendMessageArgs[0].sender).toBe('user123');
    expect(sendMessageArgs[1]).toBe('match123');
    
    // Verify input is cleared after sending
    expect(messageInput.props.value).toBe('');
  });

  // Test Scenario 3: Handle opponent leaving match
  it('handles opponent leaving match', async () => {
    const { getByText } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
      expect(networkUtils.onOpponentLeftMatch).toHaveBeenCalled();
    });

    // Get the callback function registered for opponent left event
    const opponentLeftCallback = networkUtils.onOpponentLeftMatch.mock.calls[0][0];
    
    // Simulate opponent leaving
    act(() => {
      opponentLeftCallback();
    });
    
    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Opponent Left',
      'Your opponent has left the match.',
      expect.any(Array)
    );
    
    // Verify match is marked as inactive
    const alertAction = Alert.alert.mock.calls[0][2][0];
    alertAction.onPress();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  // Test Scenario 4: Handle match ended event
  it('handles match ended event', async () => {
    const { getByText } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
      expect(mockSocketInstance.once).toHaveBeenCalledWith('matchEnded', expect.any(Function));
    });

    // Get the callback function registered for matchEnded event
    const matchEndedCallback = mockSocketInstance.once.mock.calls.find(
      call => call[0] === 'matchEnded'
    )[1];
    
    // Simulate match ended event
    act(() => {
      matchEndedCallback({ message: 'The match has ended' });
    });
    
    // Verify socket listeners are removed
    expect(mockSocketInstance.off).toHaveBeenCalledWith('receiveMessage');
    expect(mockSocketInstance.off).toHaveBeenCalledWith('messageDelivered');
    expect(mockSocketInstance.off).toHaveBeenCalledWith('messageRead');
    
    // Verify Alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Match Ended',
      'The match has ended',
      expect.any(Array)
    );
    
    // Verify navigation happens when alert is dismissed
    const alertAction = Alert.alert.mock.calls[0][2][0];
    alertAction.onPress();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  // Test Scenario 5: Handle empty message input
  it('does not send empty messages', async () => {
    const { getByPlaceholderText, getByText } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
    });

    // Type an empty message (just spaces)
    const messageInput = getByPlaceholderText('Type your message...');
    fireEvent.changeText(messageInput, '   ');
    
    // Try to send the message
    const sendButton = getByText('Send');
    fireEvent.press(sendButton);
    
    // Verify sendMessage was not called
    expect(networkUtils.sendMessage).not.toHaveBeenCalled();
  });

  // Test Scenario 6: Handle socket connection error
  it('handles socket connection error', async () => {
    // Mock initializeSocket to reject with an error
    networkUtils.initializeSocket.mockImplementationOnce(() => 
      Promise.reject(new Error('Connection failed'))
    );

    render(<ChatScreen route={mockRoute} navigation={mockNavigation} />);

    // Wait for error handling
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to connect to the server. Please check your internet connection.'
      );
    });
  });

  // Test Scenario 7: Handle AsyncStorage load failure
  it('handles AsyncStorage load failure', async () => {
    // Mock AsyncStorage.getItem to reject with an error
    AsyncStorage.getItem.mockImplementationOnce(() => 
      Promise.reject(new Error('Storage error'))
    );

    render(<ChatScreen route={mockRoute} navigation={mockNavigation} />);

    // Wait for error handling
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('messages_match123');
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to load messages.');
    });
  });

  // Test Scenario 8: Cleanup on component unmount
  it('cleans up event listeners and notifies server on unmount', async () => {
    const { unmount } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
      expect(networkUtils.onReceiveMessage).toHaveBeenCalled();
      expect(networkUtils.onMessageDelivered).toHaveBeenCalled();
      expect(networkUtils.onMessageRead).toHaveBeenCalled();
      expect(networkUtils.onOpponentLeftMatch).toHaveBeenCalled();
      expect(networkUtils.onConnectionError).toHaveBeenCalled();
      expect(networkUtils.onDisconnect).toHaveBeenCalled();
    });

    // Unmount the component
    unmount();

    // Verify navigatingAway was called
    expect(networkUtils.navigatingAway).toHaveBeenCalledWith('match123');
  });

  // Test Scenario 9: Back button navigation
  it('handles back button press correctly', async () => {
    const { getByText } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
    });

    // Get the back handler callback
    const backHandlerCallback = BackHandler.addEventListener.mock.calls[0][1];
    
    // Simulate back button press
    act(() => {
      backHandlerCallback();
    });

    // Verify navigatingAway was called
    expect(networkUtils.navigatingAway).toHaveBeenCalledWith('match123');
    
    // Verify navigation.goBack was called
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  // Test Scenario 10: Screen focus/blur transitions
  it('handles screen focus and blur events correctly', async () => {
    const { unmount } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Verify focus effect triggered joinMatch
    await waitFor(() => {
      expect(networkUtils.joinMatch).toHaveBeenCalledWith('match123', 'user123');
    });

    // Simulate blur event (returned from focus effect)
    const cleanupFocusEffect = mockCallback.mock.results[0].value;
    act(() => {
      cleanupFocusEffect();
    });

    // Verify navigatingAway was called
    expect(networkUtils.navigatingAway).toHaveBeenCalledWith('match123');

    unmount();
  });

  // Test Scenario 11: Navigation with active socket connection
  it('maintains socket connection during navigation', async () => {
    const { unmount } = render(
      <ChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Verify socket initialized
    await waitFor(() => {
      expect(networkUtils.initializeSocket).toHaveBeenCalled();
    });

    // Get socket instance
    const socket = networkUtils.getSocketInstance();
    
    // Simulate navigation away and back
    const cleanupFocusEffect = mockCallback.mock.results[0].value;
    act(() => {
      cleanupFocusEffect(); // navigation away
    });

    // Verify socket cleanup
    expect(socket.off).toHaveBeenCalledWith('receiveMessage');
    expect(socket.off).toHaveBeenCalledWith('messageDelivered');
    expect(socket.off).toHaveBeenCalledWith('messageRead');

    // Simulate navigation back
    act(() => {
      mockCallback(); // navigation back
    });

    // Verify socket reinitialized
    expect(networkUtils.joinMatch).toHaveBeenCalledTimes(2);

    unmount();
  });
});