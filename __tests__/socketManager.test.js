import { io } from 'socket.io-client';
import { 
  initializeSocket, 
  getSocketInstance, 
  disconnectSocket, 
  emitEvent,
  onEvent,
  offEvent
} from '../src/utils/socketManager';
import remoteLogger from '../src/utils/remoteLogger';

// Mock dependencies
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('../src/utils/remoteLogger', () => ({
  log: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('@env', () => ({
  REACT_APP_SERVER_URL: 'https://match-chat-app-server.onrender.com',
}));

describe('Socket Manager', () => {
  let mockSocket;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a mock socket
    mockSocket = {
      connected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      io: {
        opts: {
          extraHeaders: {}
        }
      }
    };
    
    // Make io return our mock socket
    io.mockReturnValue(mockSocket);
  });
  
  test('initializeSocket creates a socket with correct options', () => {
    const userId = 'test-user-123';
    initializeSocket(userId);
    
    expect(io).toHaveBeenCalledWith(
      'https://match-chat-app-server.onrender.com',
      expect.objectContaining({
        reconnection: true,
        reconnectionAttempts: expect.any(Number),
        reconnectionDelay: expect.any(Number),
        timeout: expect.any(Number),
        extraHeaders: expect.objectContaining({
          'user-id': userId
        })
      })
    );
    
    expect(remoteLogger.log).toHaveBeenCalledWith(
      'Socket initialized',
      expect.any(Object)
    );
  });
  
  test('getSocketInstance returns null if socket not initialized', () => {
    // Reset the module to clear the socket
    jest.resetModules();
    
    // Re-import with a clean state
    const { getSocketInstance } = require('../src/utils/socketManager');
    
    // Now it should be null since we haven't initialized
    const socket = getSocketInstance();
    expect(socket).toBeNull();
  });
  
  test('getSocketInstance returns initialized socket', () => {
    // Initialize socket
    initializeSocket('test-user');
    
    // Get socket instance
    const socket = getSocketInstance();
    expect(socket).toBe(mockSocket);
  });
  
  test('disconnectSocket disconnects and cleans up socket', () => {
    // Initialize socket
    initializeSocket('test-user');
    
    // Disconnect
    disconnectSocket();
    
    // Verify socket was disconnected
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(remoteLogger.log).toHaveBeenCalledWith(
      'Socket disconnected',
      expect.any(Object)
    );
    
    // Verify getSocketInstance returns null after disconnect
    expect(getSocketInstance()).toBeNull();
  });
  
  test('emitEvent sends event with data', () => {
    // Initialize socket
    initializeSocket('test-user');
    
    // Emit event
    const eventName = 'test-event';
    const eventData = { message: 'hello' };
    emitEvent(eventName, eventData);
    
    // Verify event was emitted
    expect(mockSocket.emit).toHaveBeenCalledWith(
      eventName,
      eventData,
      undefined
    );
  });
  
  test('emitEvent with callback passes callback to socket.emit', () => {
    // Initialize socket
    initializeSocket('test-user');
    
    // Create mock callback
    const mockCallback = jest.fn();
    
    // Emit event with callback
    emitEvent('test-event', { data: 'test' }, mockCallback);
    
    // Verify callback was passed to emit
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'test-event',
      { data: 'test' },
      mockCallback
    );
  });
  
  test('onEvent registers event handler', () => {
    // Initialize socket
    initializeSocket('test-user');
    
    // Create mock handler
    const mockHandler = jest.fn();
    
    // Register event handler
    onEvent('test-event', mockHandler);
    
    // Verify handler was registered
    expect(mockSocket.on).toHaveBeenCalledWith(
      'test-event',
      mockHandler
    );
  });
  
  test('offEvent removes event handler', () => {
    // Initialize socket
    initializeSocket('test-user');
    
    // Create mock handler
    const mockHandler = jest.fn();
    
    // Remove event handler
    offEvent('test-event', mockHandler);
    
    // Verify handler was removed
    expect(mockSocket.off).toHaveBeenCalledWith(
      'test-event',
      mockHandler
    );
  });
  
  test('emitEvent logs error when socket is not initialized', () => {
    // Reset the module to clear the socket
    jest.resetModules();
    
    // Re-import with mocks
    jest.mock('../src/utils/remoteLogger', () => ({
      log: jest.fn(),
      logError: jest.fn(),
    }));
    
    // Get fresh instances
    const { emitEvent } = require('../src/utils/socketManager');
    const remoteLogger = require('../src/utils/remoteLogger');
    
    // Try to emit event with no socket initialized
    emitEvent('test-event', { data: 'test' });
    
    // Verify error was logged
    expect(remoteLogger.logError).toHaveBeenCalled();
  });
});