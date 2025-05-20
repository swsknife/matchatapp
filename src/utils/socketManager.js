/**
 * Socket Manager
 * 
 * Handles socket.io connections and provides a consistent interface
 * for socket operations throughout the app.
 */

import { io } from 'socket.io-client';
import { REACT_APP_SERVER_URL } from '@env';
import remoteLogger from './remoteLogger';

// Socket instance
let socket = null;

/**
 * Initialize the socket connection
 * @param {string} userId - The user ID to include in connection headers
 * @returns {object} The socket instance
 */
export const initializeSocket = (userId) => {
  if (socket && socket.connected) {
    remoteLogger.log('Socket already connected, reusing existing connection');
    return socket;
  }

  // Create socket with connection options
  socket = io(REACT_APP_SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    extraHeaders: {
      'user-id': userId || 'anonymous'
    }
  });

  // Log connection events
  socket.on('connect', () => {
    remoteLogger.log('Socket connected', { socketId: socket.id });
  });

  socket.on('connect_error', (error) => {
    remoteLogger.logError(error, 'socketManager.connect_error');
  });

  socket.on('disconnect', (reason) => {
    remoteLogger.log('Socket disconnected', { reason });
  });

  socket.on('error', (error) => {
    remoteLogger.logError(error, 'socketManager.error');
  });

  remoteLogger.log('Socket initialized', { 
    url: REACT_APP_SERVER_URL,
    userId: userId || 'anonymous'
  });

  return socket;
};

/**
 * Get the current socket instance
 * @returns {object|null} The socket instance or null if not initialized
 */
export const getSocketInstance = () => socket;

/**
 * Disconnect and clean up the socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    remoteLogger.log('Socket disconnected', { manual: true });
    socket = null;
  }
};

/**
 * Emit an event to the server
 * @param {string} eventName - The name of the event
 * @param {object} data - The data to send
 * @param {function} callback - Optional callback function
 */
export const emitEvent = (eventName, data, callback) => {
  if (!socket) {
    remoteLogger.logError(
      new Error('Socket not initialized'),
      'socketManager.emitEvent'
    );
    return;
  }

  socket.emit(eventName, data, callback);
};

/**
 * Register an event handler
 * @param {string} eventName - The name of the event
 * @param {function} handler - The event handler function
 */
export const onEvent = (eventName, handler) => {
  if (!socket) {
    remoteLogger.logError(
      new Error('Socket not initialized'),
      'socketManager.onEvent'
    );
    return;
  }

  socket.on(eventName, handler);
};

/**
 * Remove an event handler
 * @param {string} eventName - The name of the event
 * @param {function} handler - The event handler function to remove
 */
export const offEvent = (eventName, handler) => {
  if (!socket) {
    return;
  }

  socket.off(eventName, handler);
};

/**
 * Check if the socket is connected
 * @returns {boolean} True if connected, false otherwise
 */
export const isConnected = () => {
  return socket && socket.connected;
};

/**
 * Reconnect the socket if disconnected
 */
export const reconnectSocket = () => {
  if (socket && !socket.connected) {
    socket.connect();
    remoteLogger.log('Socket reconnection attempted');
  }
};

export default {
  initializeSocket,
  getSocketInstance,
  disconnectSocket,
  emitEvent,
  onEvent,
  offEvent,
  isConnected,
  reconnectSocket
};