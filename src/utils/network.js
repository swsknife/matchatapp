/**
 * network.js
 * 
 * This module handles all socket.io communication between the client and server.
 * It implements a singleton pattern for the socket connection to ensure only one
 * connection is maintained throughout the app lifecycle.
 */

import { io } from "socket.io-client";
import store from '../store/store';
import { setConnectionStatus } from '../store/actions';
import { REACT_APP_SERVER_URL } from '@env';

// Track the last events to prevent duplicates
let lastJoinedMatch = null; // Tracks the last match joined to prevent duplicate join events
let lastNavigationEvent = { type: null, matchId: null, timestamp: 0 }; // Tracks navigation events to prevent duplicates
let socketInstance = null; // Singleton socket instance

/**
 * Creates and initializes a singleton Socket.IO connection.
 * Sets up event listeners for connection status changes.
 * 
 * @returns {Object} The socket.io instance
 */
const initializeSocketSingleton = () => {
  if (!socketInstance) {
    console.log("Initializing singleton socket...");
    console.log(`Connecting to server at: ${REACT_APP_SERVER_URL}`);
    
    // First, try to check if the server is reachable with a simple fetch
    // Add timeout and retry logic for the initial ping
    const pingServer = (retryCount = 0, maxRetries = 3) => {
      if (retryCount > maxRetries) {
        console.warn(`Server ping failed after ${maxRetries} attempts. Proceeding with socket connection anyway.`);
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      fetch(`${REACT_APP_SERVER_URL}/ping`, { 
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      })
        .then(response => {
          clearTimeout(timeoutId);
          console.log('Server ping successful:', response.status);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          console.error(`Server ping attempt ${retryCount + 1} failed:`, error);
          
          // Retry after a delay
          if (retryCount < maxRetries) {
            console.log(`Retrying server ping in ${(retryCount + 1) * 1000}ms...`);
            setTimeout(() => pingServer(retryCount + 1, maxRetries), (retryCount + 1) * 1000);
          }
        });
    };
    
    pingServer();
      
    socketInstance = io(REACT_APP_SERVER_URL, {
      reconnection: true,           // Enable automatic reconnection
      reconnectionAttempts: 10,     // Increased: Try to reconnect 10 times
      reconnectionDelay: 2000,      // Increased: Wait 2 seconds between reconnection attempts
      reconnectionDelayMax: 10000,  // Added: Maximum reconnection delay of 10 seconds
      randomizationFactor: 0.5,     // Added: Randomization factor to prevent all clients reconnecting simultaneously
      timeout: 30000,               // Increased: Connection timeout to 30 seconds
      pingInterval: 25000,          // Decreased: Send a ping more frequently (every 25 seconds)
      pingTimeout: 20000,           // Decreased: Consider connection dead if no pong within 20 seconds
      transports: ['websocket', 'polling'], // Try websocket first, then fall back to polling
      forceNew: false,              // Reuse existing connection if available
      upgrade: true,                // Allow transport upgrade
      rememberUpgrade: true,        // Remember the transport upgrade
      autoConnect: true,            // Added: Connect automatically
      rejectUnauthorized: false     // Added: Ignore SSL certificate issues (for development only)
    });

    // Set up connection status event handlers
    socketInstance.on('connect', () => {
      console.log("Socket connected:", socketInstance.id);
      store.dispatch(setConnectionStatus('connected'));
    });

    socketInstance.on('connect_error', (error) => {
      console.error("Connection error:", error);
      console.error("Error details:", JSON.stringify(error));
      store.dispatch(setConnectionStatus('disconnected'));
      
      // Try to reconnect after a delay if we've exceeded reconnection attempts
      // Fix: Check if current attempts exceed or equal the max attempts
      if (socketInstance.io && 
          socketInstance.io._reconnectionAttempts >= socketInstance.io._opts.reconnectionAttempts) {
        console.log("Maximum reconnection attempts reached. Will try again in 10 seconds.");
        setTimeout(() => {
          console.log("Attempting to reconnect after timeout...");
          socketInstance.connect();
        }, 10000);
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log("Socket disconnected. Reason:", reason);
      store.dispatch(setConnectionStatus('disconnected'));
      
      // If the server closed the connection, try to reconnect manually
      if (reason === 'io server disconnect') {
        console.log("Server disconnected the client. Attempting to reconnect...");
        socketInstance.connect();
      }
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}...`);
      store.dispatch(setConnectionStatus('reconnecting'));
    });
    
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      store.dispatch(setConnectionStatus('connected'));
    });
    
    socketInstance.on('reconnect_error', (error) => {
      console.error("Reconnection error:", error);
    });
    
    socketInstance.on('reconnect_failed', () => {
      console.error("Failed to reconnect after all attempts");
      store.dispatch(setConnectionStatus('failed'));
    });
  }
  return socketInstance;
};

/**
 * Initializes the socket connection and returns a promise that resolves
 * when the connection is established or rejects if connection fails.
 * 
 * @returns {Promise} Resolves with socket instance when connected
 */
export const initializeSocket = (timeoutMs = 15000) => {
  return new Promise((resolve, reject) => {
    try {
      const socket = initializeSocketSingleton();
      
      if (!socket) {
        reject(new Error('Failed to initialize socket instance'));
        return;
      }
      
      // If already connected, resolve immediately
      if (socket.connected) {
        console.log("Socket already connected, resolving immediately");
        resolve(socket);
        return;
      }
      
      // Set up a timeout to reject the promise if connection takes too long
      const timeoutId = setTimeout(() => {
        // Remove the event listeners to prevent memory leaks
        socket.off('connect', connectHandler);
        socket.off('connect_error', errorHandler);
        socket.off('disconnect', disconnectHandler);
        
        const timeoutError = new Error(`Socket connection timed out after ${timeoutMs}ms`);
        console.error(timeoutError);
        reject(timeoutError);
      }, timeoutMs);
      
      // Define handlers
      const connectHandler = () => {
        clearTimeout(timeoutId);
        console.log("Socket connected in initializeSocket promise");
        resolve(socket);
      };
      
      const errorHandler = (error) => {
        clearTimeout(timeoutId);
        console.error("Socket connection error in initializeSocket promise:", error);
        reject(error);
      };
      
      const disconnectHandler = (reason) => {
        clearTimeout(timeoutId);
        console.error("Socket disconnected during initialization:", reason);
        reject(new Error(`Socket disconnected during initialization: ${reason}`));
      };
      
      // Set up event listeners
      socket.once('connect', connectHandler);
      socket.once('connect_error', errorHandler);
      socket.once('disconnect', disconnectHandler);
      
      // If socket is already connecting, log it
      if (socket.connecting) {
        console.log("Socket is in connecting state, waiting...");
      } else {
        // If not connected and not connecting, try to connect
        console.log("Socket is not connecting, attempting to connect...");
        socket.connect();
      }
    } catch (error) {
      console.error("Error in initializeSocket:", error);
      reject(error);
    }
  });
};

/**
 * Returns the current socket instance or initializes one if it doesn't exist.
 * 
 * @returns {Object} The socket.io instance
 */
export const getSocketInstance = () => initializeSocketSingleton();

/**
 * Disconnects the socket and cleans up the instance.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    console.log("Disconnecting socket...");
    socketInstance.disconnect();
    socketInstance = null;
  }
};

/**
 * Notifies the server that the user is navigating away from a match.
 * Implements debouncing to prevent duplicate events.
 * 
 * @param {string} matchId - The ID of the match being navigated away from
 */
export const navigatingAway = (matchId) => {
  const socket = getSocketInstance();
  if (!socket) {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return;
  }
  
  if (!socket.connected) {
    console.warn("Socket is not connected. Navigation event will not be sent.");
    return;
  }
  
  // Prevent duplicate navigation events within a short time window (500ms)
  const now = Date.now();
  if (
    lastNavigationEvent.type === 'away' && 
    lastNavigationEvent.matchId === matchId && 
    now - lastNavigationEvent.timestamp < 500
  ) {
    console.log(`Skipping duplicate navigatingAway for match: ${matchId}`);
    return;
  }
  
  console.log(`Navigating away from match: ${matchId}`);
  lastNavigationEvent = { type: 'away', matchId, timestamp: now };
  
  try {
    socket.emit("navigatingAway", { matchId });
  } catch (error) {
    console.error("Error sending navigatingAway event:", error);
  }
};

/**
 * Notifies the server that the user is navigating back to a match.
 * Implements debouncing to prevent duplicate events.
 * 
 * @param {string} matchId - The ID of the match being navigated back to
 */
export const navigatingBack = (matchId) => {
  const socket = getSocketInstance();
  if (!socket) {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return;
  }
  
  if (!socket.connected) {
    console.warn("Socket is not connected. Navigation event will not be sent.");
    return;
  }
  
  // Prevent duplicate navigation events within a short time window (500ms)
  const now = Date.now();
  if (
    lastNavigationEvent.type === 'back' && 
    lastNavigationEvent.matchId === matchId && 
    now - lastNavigationEvent.timestamp < 500
  ) {
    console.log(`Skipping duplicate navigatingBack for match: ${matchId}`);
    return;
  }
  
  console.log(`Navigating back to match: ${matchId}`);
  lastNavigationEvent = { type: 'back', matchId, timestamp: now };
  
  try {
    socket.emit("navigatingBack", { matchId });
  } catch (error) {
    console.error("Error sending navigatingBack event:", error);
  }
};

/**
 * Resets the navigation state tracking variables.
 * Should be called when permanently leaving a match.
 */
export const resetNavigationState = () => {
  lastJoinedMatch = null;
  lastNavigationEvent = { type: null, matchId: null, timestamp: 0 };
};

/**
 * Sends a message to a specific match.
 * 
 * @param {Object} message - The message object to send
 * @param {string} matchId - The ID of the match to send the message to
 * @param {Function} callback - Optional callback function to handle the response
 */
export const sendMessage = (message, matchId, callback, retryCount = 0) => {
  const socket = getSocketInstance();
  if (!socket) {
    console.error("Socket is not initialized. Call initializeSocket first.");
    if (callback) callback({ 
      error: "Socket not initialized", 
      recoverable: true,
      message: "Connection not established. Please try again."
    });
    return;
  }
  
  if (!socket.connected) {
    console.error("Failed to send message: Socket disconnected");
    if (callback) callback({ 
      error: "Socket disconnected", 
      recoverable: true,
      message: "Connection lost. Message will be sent when reconnected."
    });
    
    // Set up a one-time reconnect handler to try sending again when reconnected
    const reconnectHandler = () => {
      console.log("Socket reconnected, attempting to resend message");
      socket.off('connect', reconnectHandler); // Remove this handler
      // Try sending again with a fresh retry count
      sendMessage(message, matchId, callback, 0);
    };
    
    socket.once('connect', reconnectHandler);
    return;
  }
  
  console.log("Sending message:", message);
  
  // Add a timeout to detect if the message wasn't acknowledged
  const timeoutId = setTimeout(() => {
    // Check if socket is still connected before retrying
    if (socket.connected && retryCount < 3) {
      console.log(`Message send timeout, retrying (${retryCount + 1}/3)...`);
      sendMessage(message, matchId, callback, retryCount + 1);
    } else if (!socket.connected) {
      console.error("Failed to send message: Socket disconnected during send");
      if (callback) callback({ 
        error: "Socket disconnected", 
        recoverable: true,
        message: "Connection lost. Message will be sent when reconnected."
      });
      
      // Set up a one-time reconnect handler to try sending again when reconnected
      const reconnectHandler = () => {
        console.log("Socket reconnected, attempting to resend message");
        socket.off('connect', reconnectHandler); // Remove this handler
        // Try sending again with a fresh retry count
        sendMessage(message, matchId, callback, 0);
      };
      
      socket.once('connect', reconnectHandler);
    } else {
      console.error("Failed to send message after 3 attempts");
      if (callback) callback({ error: "Message delivery timeout" });
    }
  }, 2000);
  
  socket.emit("sendMessage", { message, matchId }, (response) => {
    clearTimeout(timeoutId);
    if (callback) callback(response);
  });
};

/**
 * Joins a match with deduplication to prevent multiple join events.
 * 
 * @param {string} matchId - The ID of the match to join
 * @param {string} userId - The ID of the user joining the match
 * @param {Function} callback - Optional callback function to handle the response
 */
export const joinMatch = (matchId, userId, callback) => {
  const socket = getSocketInstance();
  if (socket) {
    // Prevent duplicate join events for the same match
    if (lastJoinedMatch === matchId) {
      console.log(`Skipping duplicate join for match: ${matchId}`);
      if (callback) callback({ success: true });
      return;
    }
    
    console.log(`Joining match: ${matchId} for user: ${userId}`);
    lastJoinedMatch = matchId;
    socket.emit("joinMatch", { matchId, userId }, callback);
  } else {
    const errorMsg = "Socket is not initialized. Call initializeSocket first.";
    console.error(errorMsg);
    if (callback) callback({ error: errorMsg });
  }
};

/**
 * Sets up a listener for receiving messages.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when a message is received
 * @returns {Function} Cleanup function to remove the listener
 */
export const onReceiveMessage = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = (message) => {
      console.log("Message received:", message);
      callback(message);
    };
    socket.on("receiveMessage", handler);
    return () => socket.off("receiveMessage", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

/**
 * Sets up a listener for when an opponent leaves the match.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when the opponent leaves
 * @returns {Function} Cleanup function to remove the listener
 */
export const onOpponentLeftMatch = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    // Handler for the opponentLeftMatch event
    const opponentLeftHandler = (data) => {
      console.log("Opponent left the match (opponentLeftMatch):", data);
      callback(data);
    };
    
    // Handler for the playerLeft event (alternative event name)
    const playerLeftHandler = (data) => {
      console.log("Opponent left the match (playerLeft):", data);
      callback(data);
    };
    
    // Listen for both event types for compatibility
    socket.on("opponentLeftMatch", opponentLeftHandler);
    socket.on("playerLeft", playerLeftHandler);
    
    // Return cleanup function that removes both listeners
    return () => {
      socket.off("opponentLeftMatch", opponentLeftHandler);
      socket.off("playerLeft", playerLeftHandler);
    };
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

/**
 * Sets up a listener for connection errors.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when a connection error occurs
 * @returns {Function} Cleanup function to remove the listener
 */
export const onConnectionError = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = (error) => {
      console.error("Connection error:", error);
      callback(error);
    };
    socket.on("connect_error", handler);
    return () => socket.off("connect_error", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

/**
 * Sets up a listener for when a match is found.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when a match is found
 * @returns {Function} Cleanup function to remove the listener
 */
export const onMatchFound = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = (match) => {
      console.log("Match found:", match);
      callback(match);
    };
    socket.on("matchFound", handler);
    return () => socket.off("matchFound", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

/**
 * Sets up a listener for socket disconnection events.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when the socket disconnects
 * @returns {Function} Cleanup function to remove the listener
 */
export const onDisconnect = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = () => {
      console.log("Socket disconnected.");
      callback();
    };
    socket.on("disconnect", handler);
    return () => socket.off("disconnect", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

/**
 * Sets up a listener for search timeout events.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when a search times out
 * @returns {Function} Cleanup function to remove the listener
 */
export const onSearchTimeout = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = (data) => {
      console.log("Search timeout received:", data);
      callback(data);
    };
    socket.on("searchTimeout", handler);
    return () => socket.off("searchTimeout", handler);
  } else {
    console.error("Socket is not initialized. Call initializeSocket first.");
    return () => {};
  }
};

/**
 * Permanently leaves a match and notifies the server.
 * Returns a promise that resolves when the server confirms or rejects on error.
 * 
 * @param {string} matchId - The ID of the match to leave
 * @param {string} userId - The ID of the user leaving the match
 * @returns {Promise} Resolves when the server confirms the user has left
 */
export const leaveMatch = (matchId, userId) => {
  return new Promise((resolve, reject) => {
    const socket = getSocketInstance();
    if (socket) {
      console.log(`Leaving match: ${matchId} for user: ${userId}`);
      // Reset navigation state when leaving permanently
      resetNavigationState();
      socket.emit("leaveMatch", { matchId, userId, isNavigatingAway: false }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    } else {
      reject(new Error("Socket is not initialized. Call initializeSocket first."));
    }
  });
};

/**
 * Starts searching for a match with the given criteria.
 * 
 * @param {Object} data - The search criteria (city, time, game, userId)
 * @param {Function} callback - Optional callback function to handle the response
 */
export const startSearch = (data, callback) => {
  const socket = getSocketInstance();
  if (socket) {
    console.log("Starting search with data:", data);
    socket.emit("startSearch", data, callback);
  } else {
    const errorMsg = "Socket is not initialized. Call initializeSocket first.";
    console.error(errorMsg);
    if (callback) callback({ error: errorMsg });
  }
};

/**
 * Sets up a listener for message delivery confirmations.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when a message is delivered
 * @returns {Function} Cleanup function to remove the listener
 */
export const onMessageDelivered = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = (messageId) => {
      console.log("Message delivered:", messageId);
      callback(messageId);
    };
    socket.on('messageDelivered', handler);
    return () => socket.off('messageDelivered', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
    return () => {};
  }
};

/**
 * Sets up a listener for message read confirmations.
 * Returns a cleanup function to remove the listener.
 * 
 * @param {Function} callback - Function to call when a message is read
 * @returns {Function} Cleanup function to remove the listener
 */
export const onMessageRead = (callback) => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = (data) => {
      console.log("Message read:", data);
      callback(data);
    };
    socket.on('messageRead', handler);
    return () => socket.off('messageRead', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
    return () => {};
  }
};

// Queue for read status messages that couldn't be sent due to connection issues
const pendingReadStatuses = [];

/**
 * Marks a message as read and notifies the server.
 * Implements a robust queuing mechanism to handle connection issues.
 * 
 * @param {string} messageId - The ID of the message to mark as read
 * @param {string} matchId - The ID of the match the message belongs to
 */
export const markMessageAsRead = (messageId, matchId) => {
  // Validate required parameters
  if (!messageId || !matchId) {
    console.error("markMessageAsRead requires both messageId and matchId");
    return;
  }

  const socket = getSocketInstance();
  if (!socket) {
    console.error("Socket is not initialized. Call initializeSocket first.");
    // Queue the read status for later
    queueReadStatus(messageId, matchId);
    return;
  }
  
  if (!socket.connected) {
    console.warn("Socket is not connected. Message read status will be queued.");
    // Queue the read status for later
    queueReadStatus(messageId, matchId);
    return;
  }
  
  console.log("Marking message as read:", messageId, "in match:", matchId);
  try {
    socket.emit("messageRead", { messageId, matchId }, (response) => {
      if (response && response.error) {
        console.warn("Error marking message as read:", response.error);
        // Queue for retry if it's a recoverable error
        if (response.recoverable) {
          queueReadStatus(messageId, matchId);
        }
      } else {
        console.log("Message marked as read successfully:", messageId);
      }
    });
  } catch (error) {
    console.error("Error sending messageRead event:", error);
    // Queue for retry
    queueReadStatus(messageId, matchId);
  }
};

/**
 * Queues a read status to be sent when the connection is restored.
 * Avoids duplicate entries in the queue.
 * 
 * @param {string} messageId - The ID of the message to mark as read
 * @param {string} matchId - The ID of the match the message belongs to
 */
const queueReadStatus = (messageId, matchId) => {
  // Check if this message is already in the queue
  const isAlreadyQueued = pendingReadStatuses.some(
    item => item.messageId === messageId && item.matchId === matchId
  );
  
  if (!isAlreadyQueued) {
    // Add to queue with timestamp for debugging
    pendingReadStatuses.push({
      messageId,
      matchId,
      timestamp: Date.now()
    });
    
    console.log(`Queued read status for message ${messageId}. Queue size: ${pendingReadStatuses.length}`);
    
    // Set up a reconnect handler if not already set
    setupReadStatusReconnectHandler();
  }
};

/**
 * Sets up a one-time reconnect handler to process queued read statuses.
 * Only sets up the handler if it's not already set.
 */
let isReconnectHandlerSet = false;
const setupReadStatusReconnectHandler = () => {
  if (isReconnectHandlerSet) return;
  
  const socket = getSocketInstance();
  if (!socket) return;
  
  isReconnectHandlerSet = true;
  
  socket.once('connect', () => {
    console.log("Socket reconnected, processing queued read statuses");
    isReconnectHandlerSet = false;
    
    // Process all queued read statuses
    while (pendingReadStatuses.length > 0) {
      const { messageId, matchId } = pendingReadStatuses.shift();
      console.log(`Processing queued read status for message ${messageId}`);
      
      try {
        socket.emit("messageRead", { messageId, matchId });
      } catch (error) {
        console.error("Error sending queued messageRead event:", error);
        // Re-queue at the end if there's an error
        queueReadStatus(messageId, matchId);
      }
    }
  });
};