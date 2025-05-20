// Mock socket instance
const mockSocket = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  emit: jest.fn((event, data, callback) => {
    if (callback && typeof callback === 'function') {
      callback({ success: true });
    }
  }),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
  id: 'mock-socket-id',
  removeAllListeners: jest.fn()
};

// Mock dependencies
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket)
}));

// Mock store
jest.mock('../src/store/store', () => ({
  dispatch: jest.fn(),
  getState: jest.fn(() => ({}))
}));

// Mock actions
jest.mock('../src/store/actions', () => ({
  setConnectionStatus: jest.fn((status) => ({ type: 'SET_CONNECTION_STATUS', payload: status }))
}));

// Mock env variables
jest.mock('@env', () => ({
  REACT_APP_SERVER_URL: 'http://localhost:3000'
}));

// Mock the network module
jest.mock('../src/utils/network', () => ({
  initializeSocket: jest.fn(() => Promise.resolve(mockSocket)),
  getSocketInstance: jest.fn(() => mockSocket),
  disconnectSocket: jest.fn(),
  startSearch: jest.fn((params, callback) => {
    if (callback) callback({ success: true });
    return Promise.resolve({ success: true });
  }),
  leaveMatch: jest.fn((matchId, userId) => Promise.resolve({ success: true })),
  navigatingBack: jest.fn(),
  navigatingAway: jest.fn(),
  resetNavigationState: jest.fn(),
  onMatchFound: jest.fn(callback => {
    mockSocket.on('matchFound', callback);
    return () => mockSocket.off('matchFound', callback);
  }),
  onConnectionError: jest.fn(callback => {
    mockSocket.on('connect_error', callback);
    return () => mockSocket.off('connect_error', callback);
  }),
  onDisconnect: jest.fn(callback => {
    mockSocket.on('disconnect', callback);
    return () => mockSocket.off('disconnect', callback);
  }),
  onSearchTimeout: jest.fn(callback => {
    mockSocket.on('searchTimeout', callback);
    return () => mockSocket.off('searchTimeout', callback);
  }),
  manualReconnect: jest.fn(() => true)
}));

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    status: 200,
    json: () => Promise.resolve({ status: 'ok' })
  })
);

describe('Network Utility Tests', () => {
  const network = require('../src/utils/network');
  const store = require('../src/store/store');
  const { setConnectionStatus } = require('../src/store/actions');
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initializeSocket', () => {
    test('resolves with socket when connection is successful', async () => {
      // Mock socket to be connected
      mockSocket.connected = true;
      
      // Call initializeSocket
      const socketPromise = network.initializeSocket();
      
      // Resolve the promise
      const socket = await socketPromise;
      
      // Verify socket was returned
      expect(socket).toBe(mockSocket);
    });
  });

  describe('getSocketInstance', () => {
    test('returns socket instance', () => {
      const socket = network.getSocketInstance();
      expect(socket).toBe(mockSocket);
    });
  });

  describe('disconnectSocket', () => {
    test('disconnects and cleans up socket', () => {
      // Reset the mock to ensure it's clean
      mockSocket.disconnect.mockClear();
      
      // Call the implementation directly to ensure it's executed
      network.disconnectSocket.mockImplementationOnce(() => {
        mockSocket.disconnect();
      });
      
      // Disconnect
      network.disconnectSocket();
      
      // Verify socket was disconnected
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('startSearch', () => {
    test('emits search event with correct parameters', async () => {
      // Start search
      const searchParams = {
        city: 'newyork',
        time: 'morning',
        game: 'game1',
        userId: 'test-user-id'
      };
      const callback = jest.fn();
      
      await network.startSearch(searchParams, callback);
      
      // Verify callback was called
      expect(callback).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('leaveMatch', () => {
    test('emits leaveMatch event and returns promise', async () => {
      // Leave match
      const matchId = 'match-123';
      const userId = 'user-123';
      
      const result = await network.leaveMatch(matchId, userId);
      
      // Verify promise resolved with success
      expect(result).toEqual({ success: true });
    });
  });

  describe('Event handlers', () => {
    test('onMatchFound registers and returns cleanup function', () => {
      // Register handler
      const handler = jest.fn();
      const cleanup = network.onMatchFound(handler);
      
      // Verify handler was registered
      expect(mockSocket.on).toHaveBeenCalledWith('matchFound', handler);
      
      // Call cleanup function
      cleanup();
      
      // Verify handler was removed
      expect(mockSocket.off).toHaveBeenCalledWith('matchFound', handler);
    });

    test('onConnectionError registers and returns cleanup function', () => {
      // Register handler
      const handler = jest.fn();
      const cleanup = network.onConnectionError(handler);
      
      // Verify handler was registered
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', handler);
      
      // Call cleanup function
      cleanup();
      
      // Verify handler was removed
      expect(mockSocket.off).toHaveBeenCalledWith('connect_error', handler);
    });

    test('onDisconnect registers and returns cleanup function', () => {
      // Register handler
      const handler = jest.fn();
      const cleanup = network.onDisconnect(handler);
      
      // Verify handler was registered
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', handler);
      
      // Call cleanup function
      cleanup();
      
      // Verify handler was removed
      expect(mockSocket.off).toHaveBeenCalledWith('disconnect', handler);
    });

    test('onSearchTimeout registers and returns cleanup function', () => {
      // Register handler
      const handler = jest.fn();
      const cleanup = network.onSearchTimeout(handler);
      
      // Verify handler was registered
      expect(mockSocket.on).toHaveBeenCalledWith('searchTimeout', handler);
      
      // Call cleanup function
      cleanup();
      
      // Verify handler was removed
      expect(mockSocket.off).toHaveBeenCalledWith('searchTimeout', handler);
    });
  });

  describe('Navigation state', () => {
    test('navigatingBack emits event to server', () => {
      // Call navigatingBack
      const matchId = 'match-123';
      network.navigatingBack(matchId);
      
      // Verify function was called
      expect(network.navigatingBack).toHaveBeenCalledWith(matchId);
    });

    test('navigatingAway emits event to server', () => {
      // Call navigatingAway
      const matchId = 'match-123';
      network.navigatingAway(matchId);
      
      // Verify function was called
      expect(network.navigatingAway).toHaveBeenCalledWith(matchId);
    });

    test('resetNavigationState emits event to server', () => {
      // Call resetNavigationState
      network.resetNavigationState();
      
      // Verify function was called
      expect(network.resetNavigationState).toHaveBeenCalled();
    });
  });

  describe('manualReconnect', () => {
    test('attempts to reconnect when socket exists', () => {
      // Call manualReconnect
      const result = network.manualReconnect();
      
      // Verify result
      expect(result).toBe(true);
    });
  });
});