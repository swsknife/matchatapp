/**
 * network.js
 *
 * This module handles all socket.io communication between the client and server.
 * It implements a singleton pattern for the socket connection to ensure only one
 * connection is maintained throughout the app lifecycle.
 */

import {io} from 'socket.io-client';
import store from '../store/store';
import {setConnectionStatus} from '../store/actions';
import {REACT_APP_SERVER_URL} from '@env';

// Track the last events to prevent duplicates
let lastJoinedMatch = null; // Tracks the last match joined to prevent duplicate join events
let lastNavigationEvent = {type: null, matchId: null, timestamp: 0}; // Tracks navigation events to prevent duplicates
let socketInstance = null; // Singleton socket instance

/**
 * Creates and initializes a singleton Socket.IO connection.
 * Sets up event listeners for connection status changes.
 *
 * @returns {Object} The socket.io instance
 */
// Mutex lock for socket initialization to prevent race conditions
let isInitializing = false;
// Promise for tracking initialization
let initializationPromise = null;

const initializeSocketSingleton = async () => {
  // If we already have a socket instance, return it
  if (socketInstance) {
    return socketInstance;
  }

  // If another initialization is in progress, return the existing promise
  if (isInitializing && initializationPromise) {
    console.log('Socket initialization already in progress, waiting for existing promise...');
    return initializationPromise;
  }

  // Set the initialization flag
  isInitializing = true;

  // Create a new promise for this initialization attempt
  initializationPromise = (async () => {
    try {
      console.log('Initializing singleton socket...');
      console.log(`Connecting to server at: ${REACT_APP_SERVER_URL}`);

      // First, try to check if the server is reachable with a simple fetch
      // Add timeout and retry logic for the initial ping
      const pingServer = async (retryCount = 0, maxRetries = 3) => new Promise((resolve, reject) => {
          if (retryCount > maxRetries) {
            console.warn(`Server ping failed after ${maxRetries} attempts. Proceeding with socket connection anyway.`);
            resolve(false); // Resolve with false to indicate ping failed
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
              resolve(true); // Resolve with true to indicate ping succeeded
            })
            .catch(error => {
              clearTimeout(timeoutId);
              console.error(`Server ping attempt ${retryCount + 1} failed:`, error);
              
              // Retry after a delay
              if (retryCount < maxRetries) {
                console.log(`Retrying server ping in ${(retryCount + 1) * 1000}ms...`);
                setTimeout(() => {
                  pingServer(retryCount + 1, maxRetries).then(resolve).catch(reject);
                }, (retryCount + 1) * 1000);
              } else {
                resolve(false); // Resolve with false after all retries failed
              }
            });
        });

      // Wait for ping result before creating socket
      const pingSuccessful = await pingServer();
      console.log(`Ping result: ${pingSuccessful ? 'successful' : 'failed'}`);

      // If ping failed, add a small delay before attempting socket connection
      if (!pingSuccessful) {
        console.log('Server ping failed, will attempt socket connection anyway after delay');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Create socket instance with improved configuration
      socketInstance = io(REACT_APP_SERVER_URL, {
        reconnection: true, // Enable automatic reconnection
        reconnectionAttempts: 5, // Maximum number of reconnection attempts
        reconnectionDelay: 1000, // Start with 1 second delay
        reconnectionDelayMax: 30000, // Maximum delay of 30 seconds (for exponential backoff)
        randomizationFactor: 0.5, // Randomization factor to prevent all clients reconnecting simultaneously
        timeout: 30000, // Connection timeout to 30 seconds
        pingInterval: 25000, // Send a ping every 25 seconds
        pingTimeout: 20000, // Consider connection dead if no pong within 20 seconds
        transports: ['websocket', 'polling'], // Try websocket first, then fall back to polling
        forceNew: true, // Force a new connection to ensure clean state
        upgrade: true, // Allow transport upgrade
        rememberUpgrade: true, // Remember the transport upgrade
        autoConnect: true, // Connect automatically
        rejectUnauthorized: false,     // Ignore SSL certificate issues (for development only)
      });

      // Log socket instance details
      console.log('Socket instance created:', socketInstance.id);
      console.log('Socket connection state:', socketInstance.connected ? 'connected' : 'disconnected');

      // Set up connection status event handlers
      socketInstance.on('connect', () => {
        console.log('Socket connected:', socketInstance.id);
        store.dispatch(setConnectionStatus('connected'));
      });

      // Track reconnection attempts for manual reconnection
      let manualReconnectAttempts = 0;
      const MAX_MANUAL_RECONNECT_ATTEMPTS = 3;

      socketInstance.on('connect_error', error => {
        console.error('Connection error:', error);
        console.error('Error details:', JSON.stringify(error));
        store.dispatch(setConnectionStatus('disconnected'));

        // Try manual reconnection after a delay
        // We'll use our own counter instead of relying on internal Socket.IO properties
        // Only try manual reconnection up to MAX_MANUAL_RECONNECT_ATTEMPTS times
        if (manualReconnectAttempts < MAX_MANUAL_RECONNECT_ATTEMPTS) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            30000, // Max 30 seconds
            1000 * Math.pow(2, manualReconnectAttempts), // Exponential backoff
          );

          console.log(
            `Maximum automatic reconnection attempts reached. Will try manual reconnection in ${
              delay / 1000
            } seconds. (Attempt ${
              manualReconnectAttempts + 1
            }/${MAX_MANUAL_RECONNECT_ATTEMPTS})`
          );

          setTimeout(() => {
            console.log(
              `Attempting manual reconnection (${
                manualReconnectAttempts + 1
              }/${MAX_MANUAL_RECONNECT_ATTEMPTS})...`,
            );
            socketInstance.connect();
            manualReconnectAttempts++;
          }, delay);
        } else {
          console.error(
            `Failed to reconnect after ${MAX_MANUAL_RECONNECT_ATTEMPTS} manual attempts. User intervention required.`,
          );
          // Dispatch a special action to show a reconnect button in the UI
          store.dispatch(setConnectionStatus('reconnect_failed'));
        }
      });

      socketInstance.on('disconnect', reason => {
        console.log('Socket disconnected. Reason:', reason);
        store.dispatch(setConnectionStatus('disconnected'));

        // If the server closed the connection, try to reconnect manually
        if (reason === 'io server disconnect') {
          console.log('Server disconnected the client. Attempting to reconnect...');
          socketInstance.connect();
        }
      });

      socketInstance.on('reconnect_attempt', attemptNumber => {
        console.log(`Reconnection attempt ${attemptNumber}...`);
        store.dispatch(setConnectionStatus('reconnecting'));

        // Reset manual reconnect attempts when automatic reconnection starts
        manualReconnectAttempts = 0;
      });

      socketInstance.on('reconnect', attemptNumber => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        store.dispatch(setConnectionStatus('connected'));

        // Reset manual reconnect attempts on successful reconnection
        manualReconnectAttempts = 0;

        // Emit a custom event to notify components that we've reconnected
        // This allows components to refresh their data
        socketInstance.emit('client_reconnected');
      });

      socketInstance.on('reconnect_error', error => {
        console.error('Reconnection error:', error);
        // Log detailed error information
        console.error('Error details:', JSON.stringify(error));
      });

      socketInstance.on('reconnect_failed', () => {
        console.error('Failed to reconnect after all automatic attempts');
        store.dispatch(setConnectionStatus('reconnect_failed'));

        // Start manual reconnection process only if we haven't already started it
        // from the connect_error handler to avoid duplicate reconnection attempts
        if (manualReconnectAttempts < MAX_MANUAL_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            30000, // Max 30 seconds
            1000 * Math.pow(2, manualReconnectAttempts), // Exponential backoff
          );

          console.log(
            `Starting manual reconnection in ${
              delay / 1000
            } seconds. (Attempt ${
              manualReconnectAttempts + 1
            }/${MAX_MANUAL_RECONNECT_ATTEMPTS})`
          );

          setTimeout(() => {
            console.log(
              `Attempting manual reconnection (${
                manualReconnectAttempts + 1
              }/${MAX_MANUAL_RECONNECT_ATTEMPTS})...`,
            );
            socketInstance.connect();
            manualReconnectAttempts++;
          }, delay);
        }
      });

      return socketInstance;
    } catch (error) {
      console.error('Error initializing socket:', error);
      // Reset the socket instance if initialization failed
      socketInstance = null;
      throw error;
    } finally {
      // Always release the initialization lock, even if there was an error
      isInitializing = false;
    }
  })();

  // Return the promise
  return initializationPromise;
};

/**
 * Initializes the socket connection and returns a promise that resolves
 * when the connection is established or rejects if connection fails.
 *
 * @returns {Promise} Resolves with socket instance when connected
 */
export const initializeSocket = (timeoutMs = 15000) => new Promise(async (resolve, reject) => {
    try {
      // Force a clean socket instance by disconnecting any existing one
      if (socketInstance) {
        console.log("Disconnecting existing socket before initialization");
        // Remove any existing listeners to prevent memory leaks
        socketInstance.removeAllListeners('connect');
        socketInstance.removeAllListeners('connect_error');
        socketInstance.removeAllListeners('disconnect');
        socketInstance.disconnect();
        socketInstance = null;
      }
      
      // Get a fresh socket instance - now awaiting the async function
      const socket = await initializeSocketSingleton();
      
      if (!socket) {
        store.dispatch(setConnectionStatus('disconnected'));
        reject(new Error('Failed to initialize socket instance'));
        return;
      }
      
      // If already connected, resolve immediately
      if (socket.connected) {
        console.log("Socket already connected, resolving immediately");
        store.dispatch(setConnectionStatus('connected'));
        resolve(socket);
        return;
      }
      
      // Set status to reconnecting while we wait
      store.dispatch(setConnectionStatus('reconnecting'));
      
      // Define handlers
      const connectHandler = () => {
        clearTimeout(timeoutId);
        // Remove all temporary event listeners to prevent memory leaks
        socket.off('connect', connectHandler);
        socket.off('connect_error', errorHandler);
        socket.off('disconnect', disconnectHandler);
        
        console.log("Socket connected in initializeSocket promise");
        store.dispatch(setConnectionStatus('connected'));
        resolve(socket);
      };
      
      const errorHandler = (error) => {
        clearTimeout(timeoutId);
        // Remove all temporary event listeners to prevent memory leaks
        socket.off('connect', connectHandler);
        socket.off('connect_error', errorHandler);
        socket.off('disconnect', disconnectHandler);
        
        console.error("Socket connection error in initializeSocket promise:", error);
        store.dispatch(setConnectionStatus('disconnected'));
        reject(error);
      };
      
      const disconnectHandler = (reason) => {
        clearTimeout(timeoutId);
        // Remove all temporary event listeners to prevent memory leaks
        socket.off('connect', connectHandler);
        socket.off('connect_error', errorHandler);
        socket.off('disconnect', disconnectHandler);
        
        console.error("Socket disconnected during initialization:", reason);
        store.dispatch(setConnectionStatus('disconnected'));
        reject(new Error(`Socket disconnected during initialization: ${reason}`));
      };
      
      // Set up event listeners - using once() to ensure they're automatically removed after firing
      socket.once('connect', connectHandler);
      socket.once('connect_error', errorHandler);
      socket.once('disconnect', disconnectHandler);
      
      // Set up a timeout to reject the promise if connection takes too long
      const timeoutId = setTimeout(() => {
        // Remove the event listeners to prevent memory leaks
        socket.off('connect', connectHandler);
        socket.off('connect_error', errorHandler);
        socket.off('disconnect', disconnectHandler);
        
        store.dispatch(setConnectionStatus('disconnected'));
        const timeoutError = new Error(`Socket connection timed out after ${timeoutMs}ms`);
        console.error(timeoutError);
        reject(timeoutError);
      }, timeoutMs);
      
      // Always try to connect explicitly
      console.log("Explicitly connecting socket...");
      socket.connect();
    } catch (error) {
      console.error("Error in initializeSocket:", error);
      store.dispatch(setConnectionStatus('disconnected'));
      reject(error);
    }
  });

/**
 * Returns the current socket instance or initializes one if it doesn't exist.
 * Includes error handling to prevent crashes.
 *
 * @returns {Object|null} The socket.io instance or null if initialization fails
 */
// Cache the promise to prevent multiple initializations
let socketInitPromise = null;

/**
 * Returns the current socket instance or initializes one if it doesn't exist.
 * This is a synchronous function that returns the current socket instance.
 * If the socket is still initializing, it returns the existing instance (which might be null).
 *
 * @returns {Object|null} The socket.io instance or null if not initialized yet
 */
export const getSocketInstance = () => {
  try {
    // If we don't have a socket instance yet, start initialization
    if (!socketInstance && !socketInitPromise) {
      // Store the promise for future calls
      socketInitPromise = initializeSocketSingleton()
        .catch((error) => {
          console.error('Error initializing socket instance:', error);
          // Clear the promise so we can try again
          socketInitPromise = null;
          return null;
        })
        .finally(() => {
          // Clear the promise when done (success or failure)
          socketInitPromise = null;
        });
    }

    // Return the current instance (may be null if not initialized yet)
    return socketInstance;
  } catch (error) {
    console.error('Error getting socket instance:', error);
    return null;
  }
};

/**
 * Manually reconnect the socket
 * This can be called from the UI when automatic reconnection fails
 * @returns {boolean} True if reconnection was attempted, false if no socket exists
 */
export const manualReconnect = () => {
  if (socketInstance) {
    console.log('Manually reconnecting socket...');
    store.dispatch(setConnectionStatus('reconnecting'));

    // Disconnect first to ensure a clean connection
    socketInstance.disconnect();

    // Wait a moment before reconnecting
    setTimeout(() => {
      socketInstance.connect();

      // Set up a one-time connect handler to update status
      socketInstance.once('connect', () => {
        console.log('Manual reconnection successful');
        store.dispatch(setConnectionStatus('connected'));
      });

      // Set up a one-time error handler
      socketInstance.once('connect_error', error => {
        console.error('Manual reconnection failed:', error);
        store.dispatch(setConnectionStatus('reconnect_failed'));
      });
    }, 1000);

    return true;
  }
  return false;
};

/**
 * Disconnects the socket and cleans up the instance.
 * Properly removes all event listeners to prevent memory leaks.
 */
/**
 * Disconnects the socket and cleans up the instance.
 * This should only be called when the app is being fully closed or logged out,
 * not during normal navigation between screens.
 */
export const disconnectSocket = () => {
  try {
    if (socketInstance) {
      console.log('Disconnecting socket...');

      try {
        // Disconnect the socket
        socketInstance.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting socket:', disconnectError);
      }

      // Clear the instance
      socketInstance = null;
    }
  } catch (error) {
    console.error('Error in disconnectSocket:', error);
    // Ensure the instance is nullified even if there's an error
    socketInstance = null;
  }
};

/**
 * Removes specific event listeners for a component.
 * Use this when a component unmounts to clean up its specific listeners
 * without affecting the global socket connection.
 *
 * @param {Array} events - Array of event names to remove listeners for
 */
export const removeComponentListeners = (events = []) => {
  try {
    if (!socketInstance) {return;}

    events.forEach((event) => {
      try {
        socketInstance.off(event);
      } catch (error) {
        console.error(`Error removing listener for ${event}:`, error);
      }
    });
  } catch (error) {
    console.error('Error in removeComponentListeners:', error);
  }
};

/**
 * Notifies the server that the user is navigating away from a match.
 * Implements debouncing to prevent duplicate events.
 *
 * @param {string} matchId - The ID of the match being navigated away from
 */
export const navigatingAway = matchId => {
  const socket = getSocketInstance();
  if (!socket) {
    console.error('Socket is not initialized. Call initializeSocket first.');
    return;
  }

  if (!socket.connected) {
    console.warn('Socket is not connected. Navigation event will not be sent.');
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
  lastNavigationEvent = {type: 'away', matchId, timestamp: now};

  try {
    socket.emit('navigatingAway', { matchId });
  } catch (error) {
    console.error('Error sending navigatingAway event:', error);
  }
};

/**
 * Notifies the server that the user is navigating back to a match.
 * Implements debouncing to prevent duplicate events.
 *
 * @param {string} matchId - The ID of the match being navigated back to
 */
export const navigatingBack = matchId => {
  const socket = getSocketInstance();
  if (!socket) {
    console.error('Socket is not initialized. Call initializeSocket first.');
    return;
  }

  if (!socket.connected) {
    console.warn('Socket is not connected. Navigation event will not be sent.');
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
  lastNavigationEvent = {type: 'back', matchId, timestamp: now};

  try {
    socket.emit('navigatingBack', { matchId });
  } catch (error) {
    console.error('Error sending navigatingBack event:', error);
  }
};

/**
 * Resets the navigation state tracking variables.
 * Should be called when permanently leaving a match.
 */
export const resetNavigationState = () => {
  lastJoinedMatch = null;
  lastNavigationEvent = {type: null, matchId: null, timestamp: 0};
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
    console.error('Socket is not initialized. Call initializeSocket first.');
    if (callback)
      callback({
        error: 'Socket not initialized',
        recoverable: true,
        message: 'Connection not established. Please try again.',
      });
    return;
  }

  if (!socket.connected) {
    console.error('Failed to send message: Socket disconnected');
    if (callback)
      callback({
        error: 'Socket disconnected',
        recoverable: true,
        message: 'Connection lost. Message will be sent when reconnected.',
      });

    // Clean up any existing reconnect handler first to prevent memory leaks
    if (message._reconnectHandler) {
      socket.off('connect', message._reconnectHandler);
      delete message._reconnectHandler;
    }

    // Store the reconnect handler on the message object to be able to remove it later
    message._reconnectHandler = () => {
      console.log('Socket reconnected, attempting to resend message');
      socket.off('connect', message._reconnectHandler); // Remove this handler
      delete message._reconnectHandler; // Clean up reference
      // Try sending again with a fresh retry count
      sendMessage(message, matchId, callback, 0);
    };

    socket.once('connect', message._reconnectHandler);
    return;
  }

  console.log('Sending message:', message);

  // Create a unique identifier for this send attempt to track timeouts
  const sendAttemptId =
    Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  // Add a timeout to detect if the message wasn't acknowledged
  const timeoutId = setTimeout(() => {
    // Check if socket is still connected before retrying
    if (socket.connected && retryCount < 3) {
      console.log(`Message send timeout, retrying (${retryCount + 1}/3)...`);
      // Cancel any previous reconnect handlers for this message
      if (message._reconnectHandler) {
        socket.off('connect', message._reconnectHandler);
        delete message._reconnectHandler;
      }
      sendMessage(message, matchId, callback, retryCount + 1);
    } else if (!socket.connected) {
      console.error('Failed to send message: Socket disconnected during send');
      if (callback)
        callback({
          error: 'Socket disconnected',
          recoverable: true,
          message: 'Connection lost. Message will be sent when reconnected.',
        });

      // Clean up any existing reconnect handler first to prevent memory leaks
      if (message._reconnectHandler) {
        socket.off('connect', message._reconnectHandler);
        delete message._reconnectHandler;
      }

      // Store the reconnect handler on the message object to be able to remove it later
      message._reconnectHandler = () => {
        console.log('Socket reconnected, attempting to resend message');
        socket.off('connect', message._reconnectHandler); // Remove this handler
        delete message._reconnectHandler; // Clean up reference
        // Try sending again with a fresh retry count
        sendMessage(message, matchId, callback, 0);
      };

      socket.once('connect', message._reconnectHandler);
    } else {
      console.error('Failed to send message after 3 attempts');
      if (callback) {callback({ error: "Message delivery timeout" });}
    }
  }, 2000);

  socket.emit('sendMessage', { message, matchId }, (response) => {
    clearTimeout(timeoutId);
    // If we got a response, remove any reconnect handler
    if (message._reconnectHandler) {
      socket.off('connect', message._reconnectHandler);
      delete message._reconnectHandler;
    }
    if (callback) {callback(response);}
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
      if (callback) {callback({ success: true });}
      return;
    }

    console.log(`Joining match: ${matchId} for user: ${userId}`);
    lastJoinedMatch = matchId;
    socket.emit('joinMatch', { matchId, userId }, callback);
  } else {
    const errorMsg = 'Socket is not initialized. Call initializeSocket first.';
    console.error(errorMsg);
    if (callback) {callback({ error: errorMsg });}
  }
};

/**
 * Sets up a listener for receiving messages.
 * Returns a cleanup function to remove the listener.
 *
 * @param {Function} callback - Function to call when a message is received
 * @returns {Function} Cleanup function to remove the listener
 */
export const onReceiveMessage = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = message => {
      console.log('Message received:', message);
      callback(message);
    };
    socket.on('receiveMessage', handler);
    return () => socket.off('receiveMessage', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
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
export const onOpponentLeftMatch = callback => {
  const socket = getSocketInstance();
  if (socket) {
    // Handler for the opponentLeftMatch event
    const opponentLeftHandler = data => {
      console.log('Opponent left the match (opponentLeftMatch):', data);
      callback(data);
    };

    // Handler for the playerLeft event (alternative event name)
    const playerLeftHandler = data => {
      console.log('Opponent left the match (playerLeft):', data);
      callback(data);
    };

    // Listen for both event types for compatibility
    socket.on('opponentLeftMatch', opponentLeftHandler);
    socket.on('playerLeft', playerLeftHandler);

    // Return cleanup function that removes both listeners
    return () => {
      socket.off('opponentLeftMatch', opponentLeftHandler);
      socket.off('playerLeft', playerLeftHandler);
    };
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
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
export const onConnectionError = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = error => {
      console.error('Connection error:', error);
      callback(error);
    };
    socket.on('connect_error', handler);
    return () => socket.off('connect_error', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
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
export const onMatchFound = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = match => {
      console.log('Match found:', match);
      callback(match);
    };
    socket.on('matchFound', handler);
    return () => socket.off('matchFound', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
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
export const onDisconnect = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = () => {
      console.log('Socket disconnected.');
      callback();
    };
    socket.on('disconnect', handler);
    return () => socket.off('disconnect', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
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
export const onSearchTimeout = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = data => {
      console.log('Search timeout received:', data);
      callback(data);
    };
    socket.on('searchTimeout', handler);
    return () => socket.off('searchTimeout', handler);
  } else {
    console.error('Socket is not initialized. Call initializeSocket first.');
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
export const leaveMatch = (matchId, userId) => new Promise((resolve, reject) => {
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

/**
 * Starts searching for a match with the given criteria.
 *
 * @param {Object} data - The search criteria (city, time, game, userId)
 * @param {Function} callback - Optional callback function to handle the response
 */
export const startSearch = (data, callback) => {
  const socket = getSocketInstance();
  if (socket) {
    console.log('Starting search with data:', data);
    socket.emit('startSearch', data, callback);
  } else {
    const errorMsg = 'Socket is not initialized. Call initializeSocket first.';
    console.error(errorMsg);
    if (callback) {callback({ error: errorMsg });}
  }
};

/**
 * Sets up a listener for message delivery confirmations.
 * Returns a cleanup function to remove the listener.
 *
 * @param {Function} callback - Function to call when a message is delivered
 * @returns {Function} Cleanup function to remove the listener
 */
export const onMessageDelivered = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = data => {
      // Handle both formats: object with messageId or just messageId string
      console.log('Message delivered:', data);
      callback(data);
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
export const onMessageRead = callback => {
  const socket = getSocketInstance();
  if (socket) {
    const handler = data => {
      console.log('Message read:', data);
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
const MAX_QUEUED_READ_STATUSES = 50; // Reasonable limit for a new app

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
    console.error('markMessageAsRead requires both messageId and matchId');
    return;
  }

  const socket = getSocketInstance();
  if (!socket) {
    console.error('Socket is not initialized. Call initializeSocket first.');
    // Queue the read status for later
    queueReadStatus(messageId, matchId);
    return;
  }

  if (!socket.connected) {
    console.warn('Socket is not connected. Message read status will be queued.');
    // Queue the read status for later
    queueReadStatus(messageId, matchId);
    return;
  }

  console.log('Marking message as read:', messageId, 'in match:', matchId);
  try {
    socket.emit('messageRead', { messageId, matchId }, (response) => {
      if (response && response.error) {
        console.warn('Error marking message as read:', response.error);
        // Queue for retry if it's a recoverable error
        if (response.recoverable) {
          queueReadStatus(messageId, matchId);
        }
      } else {
        console.log('Message marked as read successfully:', messageId);
      }
    });
  } catch (error) {
    console.error('Error sending messageRead event:', error);
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
    (item) => item.messageId === messageId && item.matchId === matchId,
  );

  if (!isAlreadyQueued) {
    // If queue is at capacity, remove oldest item
    if (pendingReadStatuses.length >= MAX_QUEUED_READ_STATUSES) {
      pendingReadStatuses.shift(); // Remove oldest item
      console.log(
        `Read status queue at capacity, removed oldest item. Queue size: ${pendingReadStatuses.length}`,
      );

    // Add to queue with timestamp for debugging
    pendingReadStatuses.push({
      messageId,
      matchId,
      timestamp: Date.now(),
    });

    console.log(
      `Queued read status for message ${messageId}. Queue size: ${pendingReadStatuses.length}`,

    // Set up a reconnect handler if not already set
    setupReadStatusReconnectHandler();
  }
};

/**
 * Sets up a one-time reconnect handler to process queued read statuses.
 * Only sets up the handler if it's not already set.
 */
let isReconnectHandlerSet = false;
let readStatusReconnectHandler = null;

const setupReadStatusReconnectHandler = () => {
  if (isReconnectHandlerSet) {return;}

  const socket = getSocketInstance();
  if (!socket) {return;}

  // Clean up any existing handler to prevent memory leaks
  if (readStatusReconnectHandler) {
    socket.off('connect', readStatusReconnectHandler);
    readStatusReconnectHandler = null;
  }

  isReconnectHandlerSet = true;

  // Create and store the handler function
  readStatusReconnectHandler = () => {
    console.log('Socket reconnected, processing queued read statuses');
    isReconnectHandlerSet = false;
    readStatusReconnectHandler = null;

    // Process all queued read statuses
    while (pendingReadStatuses.length > 0) {
      const {messageId, matchId} = pendingReadStatuses.shift();
      console.log(`Processing queued read status for message ${messageId}`);

      try {
        socket.emit('messageRead', { messageId, matchId });
      } catch (error) {
        console.error('Error sending queued messageRead event:', error);
        // Re-queue at the end if there's an error
        queueReadStatus(messageId, matchId);
      }
    }
  };

  // Attach the handler to the socket
  socket.once('connect', readStatusReconnectHandler);
};
