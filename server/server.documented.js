/**
 * MatchChatApp Server
 * 
 * This is the backend server for the MatchChatApp, handling real-time communication
 * between users, matching logic, and chat functionality.
 * 
 * The server uses Socket.IO for real-time bidirectional communication and maintains
 * in-memory data structures to track waiting rooms, active matches, and user searches.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with appropriate timeouts
const io = socketIo(server, {
  pingInterval: 60000,  // 1 minute between pings
  pingTimeout: 30000    // 30 seconds to respond to a ping
});

// Use environment variables with fallbacks for configuration
const PORT = process.env.PORT || 3000;

/**
 * In-memory data structures for state management
 * 
 * waitingRooms: Stores users waiting for matches, indexed by room ID
 * activeMatches: Stores active matches between users, indexed by match ID
 * activeSearches: Tracks users currently searching for matches, indexed by socket ID
 * waitingRoomsByKey: Indexes waiting rooms by search criteria for faster matching
 * rateLimits: Tracks rate limits by IP address to prevent abuse
 */
const waitingRooms = {};
const activeMatches = {};
const activeSearches = {};
const waitingRoomsByKey = {};
const rateLimits = {};

/**
 * Simple health check endpoint
 */
app.get('/ping', (req, res) => {
  console.log('Received ping from client');
  res.status(200).send('pong');
});

/**
 * Rate limiting implementation to prevent abuse
 * 
 * Checks if a request from a specific identifier (IP or socket ID) should be
 * rate limited based on the number of requests in a time window.
 * 
 * @param {string} identifier - The identifier to check (IP or socket ID)
 * @param {number} limit - Maximum number of requests allowed in the time window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - True if rate limited, false otherwise
 */
function isRateLimited(identifier, limit = 5, windowMs = 60000) {
  const now = Date.now();

  // Initialize rate limit entry if it doesn't exist
  if (!rateLimits[identifier]) {
    rateLimits[identifier] = {
      count: 0,
      resetAt: now + windowMs
    };
  }

  // Reset count if the window has expired
  if (now > rateLimits[identifier].resetAt) {
    rateLimits[identifier] = {
      count: 0,
      resetAt: now + windowMs
    };
  }

  // Increment count and check if rate limited
  rateLimits[identifier].count++;

  return rateLimits[identifier].count > limit;
}

/**
 * Cleanup function for expired rate limit entries
 * Runs periodically to free up memory
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const identifier in rateLimits) {
    if (now > rateLimits[identifier].resetAt) {
      delete rateLimits[identifier];
    }
  }
}

// Clean up rate limits every 5 minutes
const rateLimitCleanupInterval = setInterval(cleanupRateLimits, 5 * 60 * 1000);

/**
 * Socket.IO connection handler
 * Sets up event listeners for each client connection
 */
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Store client IP for rate limiting
  const clientIp = socket.handshake.headers['x-forwarded-for'] ||
                   socket.handshake.address ||
                   'unknown';

  /**
   * Handle joining a match
   * Adds the user to the specified match room and notifies other participants
   */
  socket.on('joinMatch', ({ matchId, userId }) => {
    try {
      if (!matchId || !userId) {
        console.log('Invalid joinMatch parameters:', { matchId, userId });
        socket.emit('error', { message: 'Invalid match parameters' });
        return;
      }

      // Check if this match exists
      if (!activeMatches[matchId]) {
        console.log(`Match ${matchId} not found when ${socket.id} tried to join.`);
        socket.emit('matchEnded', {
          matchId,
          message: 'This match has ended or does not exist.'
        });
        return;
      }

      socket.userId = userId; // Store userId in socket
      socket.join(matchId);

      // Notify other players that someone joined
      socket.to(matchId).emit('playerJoined', {
        matchId,
        userId
      });

      console.log(`User ${userId} joined match ${matchId}`);
    } catch (error) {
      console.error('Error in joinMatch handler:', error);
      socket.emit('error', { message: 'Server error while joining match' });
    }
  });

  /**
   * Check for active matches for the current user
   * Returns a list of matches the user is participating in
   */
  socket.on('checkActiveMatches', () => {
    try {
      const userMatches = Object.values(activeMatches).filter(match =>
        match.players.some(p => p.socketId === socket.id)
      );

      // Add additional match information for the client
      const matchesWithDetails = userMatches.map(match => {
        // Get opponent information
        const player = match.players.find(p => p.socketId === socket.id);
        const opponent = match.players.find(p => p.socketId !== socket.id);

        return {
          ...match,
          isActive: player?.isActive || false,
          opponent: opponent ? {
            userId: opponent.userId,
            isActive: opponent.isActive
          } : null
        };
      });

      socket.emit('activeMatches', { matches: matchesWithDetails });
      console.log(`Sent ${matchesWithDetails.length} active matches to ${socket.id}`);
    } catch (error) {
      console.error('Error in checkActiveMatches handler:', error);
      socket.emit('error', { message: 'Server error while checking active matches' });
    }
  });

  /**
   * Handle temporary navigation away from a match
   * Updates player status and notifies other participants
   */
  socket.on('navigatingAway', ({ matchId }) => {
    try {
      if (!matchId) {
        console.log('Invalid navigatingAway parameters:', { matchId });
        return;
      }

      console.log(`${socket.id} temporarily navigating away from match ${matchId}`);
      const match = activeMatches[matchId];

      if (match) {
        const player = match.players.find(p => p.socketId === socket.id);
        if (player) {
          player.isActive = false;

          // Notify other players in the match
          socket.to(matchId).emit('playerStatus', {
            matchId,
            userId: player.userId,
            isActive: false
          });
        }
      } else {
        console.log(`Cannot update status: match ${matchId} not found`);
      }
    } catch (error) {
      console.error('Error in navigatingAway handler:', error);
    }
  });

  /**
   * Handle returning to a match
   * Updates player status and notifies other participants
   */
  socket.on('navigatingBack', ({ matchId }) => {
    try {
      if (!matchId) {
        console.log('Invalid navigatingBack parameters:', { matchId });
        return;
      }

      console.log(`${socket.id} returned to match ${matchId}`);
      const match = activeMatches[matchId];

      if (match) {
        const player = match.players.find(p => p.socketId === socket.id);
        if (player) {
          player.isActive = true;

          // Notify other players in the match
          socket.to(matchId).emit('playerStatus', {
            matchId,
            userId: player.userId,
            isActive: true
          });
        }
      } else {
        console.log(`Cannot update status: match ${matchId} not found`);
      }
    } catch (error) {
      console.error('Error in navigatingBack handler:', error);
    }
  });

  /**
   * Handle starting a search for a match
   * Implements the core matching algorithm
   */
  socket.on('startSearch', (searchParams) => {
    try {
      console.log('Player searching:', searchParams);

      if (!searchParams || !searchParams.userId) {
        console.log('Invalid search parameters:', searchParams);
        socket.emit('error', { message: 'Invalid search parameters' });
        return;
      }

      // Apply rate limiting - 5 search requests per minute per IP
      if (isRateLimited(clientIp, 5, 60000)) {
        console.log(`Rate limit exceeded for IP: ${clientIp}`);
        socket.emit('error', {
          message: 'Too many search requests. Please wait a moment before trying again.',
          code: 'RATE_LIMITED'
        });
        return;
      }

      // Track this search for the socket
      activeSearches[socket.id] = {
        timestamp: Date.now(),
        params: searchParams
      };

      // Check if the player is already in a match
      const playerMatches = Object.values(activeMatches).filter(match =>
        match.players.some(p => p.socketId === socket.id)
      );

      // If in a match, leave all matches first and wait for confirmation
      if (playerMatches.length > 0) {
        const leavePromises = playerMatches.map(match => {
          return new Promise(resolve => {
            // Set up a one-time listener for matchLeft confirmation
            socket.once(`matchLeft_${match.matchId}`, () => {
              console.log(`Player ${socket.id} confirmed leaving match ${match.matchId}`);
              resolve();
            });

            // Emit leaveMatch event
            socket.emit('leaveMatch', {
              matchId: match.matchId,
              userId: socket.userId,
              isNavigatingAway: false
            });

            // Resolve after timeout in case client doesn't respond
            setTimeout(resolve, 1000);
          });
        });

        // Wait for all matches to be left before proceeding
        Promise.all(leavePromises).then(() => {
          proceedWithSearch();
        });
      } else {
        proceedWithSearch();
      }

      /**
       * Core search function that either finds a match or creates a waiting room
       * Called after ensuring the player has left any existing matches
       */
      function proceedWithSearch() {
        // Check if search was canceled while waiting
        if (!activeSearches[socket.id]) {
          console.log(`Search for player ${socket.id} was canceled`);
          return;
        }

        let matchRoomId = findMatchingRoom(searchParams);
        if (matchRoomId) {
          console.log('Match found for search:', matchRoomId);
          handleMatchFound(matchRoomId, socket.id, searchParams.userId);
        } else {
          createNewWaitingRoom(searchParams, socket.id, socket);
        }

        // Notify client that search has started
        socket.emit('searchStarted', { success: true });
      }
    } catch (error) {
      console.error('Error in startSearch handler:', error);
      socket.emit('error', { message: 'Server error while starting search' });
    }
  });

  /**
   * Handle canceling a search
   * Removes the player from waiting rooms and active searches
   */
  socket.on('cancelSearch', () => {
    try {
      console.log(`Player ${socket.id} canceling search`);

      // Remove from active searches
      if (activeSearches[socket.id]) {
        delete activeSearches[socket.id];
      }

      // Remove from waiting rooms
      for (const roomId in waitingRooms) {
        if (waitingRooms[roomId].playerSocketId === socket.id) {
          // Get the search parameters to create the key
          const room = waitingRooms[roomId];
          const searchKey = `${room.city}:${room.time}:${room.game}`;

          // Remove from the indexed structure
          if (waitingRoomsByKey[searchKey]) {
            const index = waitingRoomsByKey[searchKey].indexOf(roomId);
            if (index !== -1) {
              waitingRoomsByKey[searchKey].splice(index, 1);

              // Clean up empty arrays
              if (waitingRoomsByKey[searchKey].length === 0) {
                delete waitingRoomsByKey[searchKey];
              }
            }
          }

          // Remove from main waiting rooms object
          delete waitingRooms[roomId];
          console.log(`Player ${socket.id} removed from waiting room ${roomId}`);

          // Notify client that search was canceled
          socket.emit('searchCanceled', { success: true });
          return;
        }
      }

      // If we get here, player wasn't in a waiting room
      socket.emit('searchCanceled', { success: false, message: 'No active search found' });
    } catch (error) {
      console.error('Error in cancelSearch handler:', error);
      socket.emit('error', { message: 'Server error while canceling search' });
    }
  });

  /**
   * Handle sending messages
   * Broadcasts messages to all clients in a match and confirms delivery
   */
  socket.on('sendMessage', ({ message, matchId }) => {
    try {
      console.log('Message received:', message, 'in room', matchId);

      if (!message || !matchId) {
        console.log('Invalid message parameters:', { message, matchId });
        socket.emit('error', { message: 'Invalid message parameters' });
        return;
      }

      // CRITICAL: Check that match exists AND has both players before allowing messages
      if (activeMatches[matchId] && activeMatches[matchId].players.length >= 2) {
        // Send message to all clients in the match room
        io.to(matchId).emit('receiveMessage', message);

        // Send delivery confirmation to the sender socket (not room)
        socket.emit('messageDelivered', {
          messageId: message.id,
          timestamp: Date.now()
        });

        // Log message for debugging
        console.log(`Message ${message.id} delivered to match ${matchId}`);
      } else {
        console.log('Error: Match not found or invalid for message:', message);
        // Notify the sender that the match has ended
        socket.emit('matchEnded', {
          matchId,
          message: 'This match has ended or is no longer valid.'
        });
      }
    } catch (error) {
      console.error('Error in sendMessage handler:', error);
      socket.emit('error', { message: 'Server error while sending message' });
    }
  });

  /**
   * Handle message read status
   * Updates and broadcasts when a message has been read
   */
  socket.on('messageRead', ({ messageId, matchId }) => {
    try {
      if (!messageId || !matchId) {
        console.log('Invalid messageRead parameters:', { messageId, matchId });
        return;
      }

      if (activeMatches[matchId]) {
        console.log('Message read:', messageId, 'in match:', matchId);
        io.to(matchId).emit('messageRead', messageId);
      } else {
        console.log(`Cannot mark message as read: match ${matchId} not found`);
      }
    } catch (error) {
      console.error('Error in messageRead handler:', error);
    }
  });

  /**
   * Handle leaving a match
   * Either marks the player as inactive or ends the match for everyone
   */
  socket.on('leaveMatch', ({ matchId, userId, isNavigatingAway }) => {
    try {
      console.log(`User ${userId} is leaving match ${matchId}`);

      if (!matchId) {
        console.log('Invalid leaveMatch parameters:', { matchId, userId });
        socket.emit('error', { message: 'Invalid match parameters' });
        return;
      }

      const match = activeMatches[matchId];

      if (!match) {
        console.log(`Match ${matchId} not found when ${socket.id} tried to leave.`);
        socket.emit('matchLeft', { success: true, matchId });
        // Send confirmation for the specific match ID
        socket.emit(`matchLeft_${matchId}`, { success: true });
        return;
      }

      const playerIndex = match.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = match.players[playerIndex];

        if (isNavigatingAway) {
          // Just mark as inactive when temporarily away
          player.isActive = false;
          console.log(`Player ${socket.id} marked inactive in match ${matchId}`);
          socket.emit('matchLeft', { success: true, matchId, isTemporary: true });
          // Send confirmation for the specific match ID
          socket.emit(`matchLeft_${matchId}`, { success: true, isTemporary: true });
        } else {
          // Permanently leaving - end the match for everyone
          match.players.splice(playerIndex, 1);
          socket.leave(matchId);
          console.log(`Player ${socket.id} removed from match ${matchId}`);

          // Use the dedicated endMatch function
          endMatch(matchId, `Player ${player.userId} has left the match.`);

          socket.emit('matchLeft', { success: true, matchId });
          // Send confirmation for the specific match ID
          socket.emit(`matchLeft_${matchId}`, { success: true });
        }
      } else {
        // Player not found in match
        socket.emit('matchLeft', { success: false, matchId, message: 'Player not found in match' });
        // Still send confirmation for the specific match ID
        socket.emit(`matchLeft_${matchId}`, { success: false });
      }
    } catch (error) {
      console.error('Error in leaveMatch handler:', error);
      socket.emit('error', { message: 'Server error while leaving match' });
      // Still send confirmation for the specific match ID
      socket.emit(`matchLeft_${matchId}`, { success: false, error: true });
    }
  });

  /**
   * Handle disconnection
   * Cleans up resources and notifies other users when a player disconnects
   */
  socket.on('disconnect', () => {
    try {
      console.log('User disconnected:', socket.id);

      // Handle player in waiting rooms
      handleDisconnect(socket.id);

      // Handle player in active matches
      for (const matchId in activeMatches) {
        const match = activeMatches[matchId];
        const playerIndex = match.players.findIndex(p => p.socketId === socket.id);

        if (playerIndex !== -1) {
          const player = match.players[playerIndex];
          console.log(`Player ${player.userId} disconnected from match ${matchId}`);

          // Remove player from match
          match.players.splice(playerIndex, 1);

          // If no players left, end the match
          if (match.players.length === 0) {
            endMatch(matchId, 'All players have disconnected.');
          } else {
            // Notify remaining players
            socket.to(matchId).emit('opponentLeftMatch', {
              matchId,
              userId: player.userId
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  });
});

/**
 * Find a matching waiting room based on search parameters
 * Uses indexed lookups for efficient matching
 * 
 * @param {Object} searchParams - The search parameters (city, time, game)
 * @returns {string|null} - The room ID if found, null otherwise
 */
function findMatchingRoom(searchParams) {
  try {
    if (!searchParams || !searchParams.city || !searchParams.time || !searchParams.game) {
      console.log('Invalid search parameters for finding room:', searchParams);
      return null;
    }

    // Create a key from the search parameters
    const searchKey = `${searchParams.city}:${searchParams.time}:${searchParams.game}`;

    // Check if we have any waiting rooms with this exact criteria
    if (waitingRoomsByKey[searchKey] && waitingRoomsByKey[searchKey].length > 0) {
      // Return the oldest waiting room (first in, first out)
      return waitingRoomsByKey[searchKey][0];
    }

    return null;
  } catch (error) {
    console.error('Error in findMatchingRoom:', error);
    return null;
  }
}

/**
 * Handle when a match is found between two players
 * Creates a new match room and notifies both players
 * 
 * @param {string} matchRoomId - The ID of the waiting room
 * @param {string} player2SocketId - The socket ID of the second player
 * @param {string} player2UserId - The user ID of the second player
 */
function handleMatchFound(matchRoomId, player2SocketId, player2UserId) {
  try {
    const matchRoom = waitingRooms[matchRoomId];
    if (!matchRoom) {
      console.log(`Waiting room ${matchRoomId} not found`);
      return;
    }

    // Remove the waiting room from the main structure
    const searchKey = `${matchRoom.city}:${matchRoom.time}:${matchRoom.game}`;

    // Remove from the indexed structure
    if (waitingRoomsByKey[searchKey]) {
      const index = waitingRoomsByKey[searchKey].indexOf(matchRoomId);
      if (index !== -1) {
        waitingRoomsByKey[searchKey].splice(index, 1);

        // Clean up empty arrays
        if (waitingRoomsByKey[searchKey].length === 0) {
          delete waitingRoomsByKey[searchKey];
        }
      }
    }

    delete waitingRooms[matchRoomId];

    // Clean up active searches for both players
    if (activeSearches[matchRoom.playerSocketId]) {
      delete activeSearches[matchRoom.playerSocketId];
    }
    if (activeSearches[player2SocketId]) {
      delete activeSearches[player2SocketId];
    }

    const player1SocketId = matchRoom.playerSocketId;
    const player1UserId = matchRoom.userId;
    const newMatchRoomId = uuidv4();

    // Get socket objects
    const player1Socket = io.sockets.sockets.get(player1SocketId);
    const player2Socket = io.sockets.sockets.get(player2SocketId);

    // Check if both sockets are still connected
    if (!player1Socket || !player2Socket) {
      console.log('One or both players disconnected before match could be created');
      return;
    }

    // Join both players to the new match room
    player1Socket.join(newMatchRoomId);
    player2Socket.join(newMatchRoomId);

    // Create match data with game details
    const matchData = {
      matchId: newMatchRoomId,
      city: matchRoom.city,
      time: matchRoom.time,
      game: matchRoom.game,
      createdAt: Date.now()
    };

    // Notify both players
    io.to(player1SocketId).emit('matchFound', {
      ...matchData,
      opponent: {
        userId: player2UserId,
        socketId: player2SocketId
      }
    });

    io.to(player2SocketId).emit('matchFound', {
      ...matchData,
      opponent: {
        userId: player1UserId,
        socketId: player1SocketId
      }
    });

    console.log('Match found:', player1SocketId, 'and', player2SocketId, 'in room', newMatchRoomId);

    // Store the match
    activeMatches[newMatchRoomId] = {
      ...matchData,
      players: [
        { socketId: player1SocketId, userId: player1UserId, isActive: true },
        { socketId: player2SocketId, userId: player2UserId, isActive: true },
      ],
    };
  } catch (error) {
    console.error('Error in handleMatchFound:', error);
  }
}

/**
 * Create a new waiting room for a player
 * 
 * @param {Object} searchParams - The search parameters (city, time, game, userId)
 * @param {string} socketId - The socket ID of the player
 * @param {Object} socket - The socket object
 */
function createNewWaitingRoom(searchParams, socketId, socket) {
  try {
    if (!searchParams || !socketId || !socket) {
      console.log('Invalid parameters for creating waiting room');
      return;
    }

    const newRoomId = uuidv4();
    waitingRooms[newRoomId] = {
      ...searchParams,
      playerSocketId: socketId,
      createdAt: Date.now()
    };

    // Add to the indexed structure for faster lookups
    const searchKey = `${searchParams.city}:${searchParams.time}:${searchParams.game}`;
    if (!waitingRoomsByKey[searchKey]) {
      waitingRoomsByKey[searchKey] = [];
    }
    waitingRoomsByKey[searchKey].push(newRoomId);

    socket.join(newRoomId);
    console.log('Player added to waiting room:', newRoomId);

    // Notify the client
    socket.emit('waitingForMatch', {
      roomId: newRoomId,
      searchParams
    });
  } catch (error) {
    console.error('Error in createNewWaitingRoom:', error);
  }
}

/**
 * End a match and notify all participants
 * 
 * @param {string} matchId - The ID of the match to end
 * @param {string} reason - The reason for ending the match
 * @param {boolean} notifyPlayers - Whether to notify players about the match ending
 */
function endMatch(matchId, reason, notifyPlayers = true) {
  try {
    const match = activeMatches[matchId];
    if (!match) {
      console.log(`Cannot end match ${matchId}: match not found`);
      return;
    }

    // Notify all clients in the room if requested
    if (notifyPlayers) {
      io.to(matchId).emit('matchEnded', {
        matchId,
        message: reason || 'This match has ended.'
      });
    }

    // Delete the match
    delete activeMatches[matchId];
    console.log(`Match ${matchId} ended: ${reason}`);
  } catch (error) {
    console.error(`Error ending match ${matchId}:`, error);
  }
}

/**
 * Handle player disconnection
 * Cleans up waiting rooms and active searches
 * 
 * @param {string} socketId - The socket ID of the disconnected player
 */
function handleDisconnect(socketId) {
  try {
    // Clean up waiting rooms
    for (const roomId in waitingRooms) {
      if (waitingRooms[roomId].playerSocketId === socketId) {
        const room = waitingRooms[roomId];

        // Remove from indexed structure
        if (room) {
          const searchKey = `${room.city}:${room.time}:${room.game}`;
          if (waitingRoomsByKey[searchKey]) {
            const index = waitingRoomsByKey[searchKey].indexOf(roomId);
            if (index !== -1) {
              waitingRoomsByKey[searchKey].splice(index, 1);

              // Clean up empty arrays
              if (waitingRoomsByKey[searchKey].length === 0) {
                delete waitingRoomsByKey[searchKey];
              }
            }
          }
        }

        delete waitingRooms[roomId];
        console.log('Player disconnected and removed from waiting room:', roomId);
        break;
      }
    }

    // Clean up active searches
    if (activeSearches[socketId]) {
      delete activeSearches[socketId];
      console.log('Player disconnected and removed from active searches:', socketId);
    }
  } catch (error) {
    console.error('Error in handleDisconnect:', error);
  }
}

/**
 * Clean up stale searches and waiting rooms
 * Runs periodically to free up resources
 * 
 * @param {number} maxSearchAge - Maximum age of a search in milliseconds (default: 5 minutes)
 */
function cleanupStaleSearches(maxSearchAge = 5 * 60 * 1000) {
  try {
    const now = Date.now();
    let cleanupCount = 0;

    // Clean up stale waiting rooms
    for (const roomId in waitingRooms) {
      const room = waitingRooms[roomId];
      if (now - room.createdAt > maxSearchAge) {
        // Get the socket for this room
        const socket = io.sockets.sockets.get(room.playerSocketId);

        // Remove from indexed structure
        const searchKey = `${room.city}:${room.time}:${room.game}`;
        if (waitingRoomsByKey[searchKey]) {
          const index = waitingRoomsByKey[searchKey].indexOf(roomId);
          if (index !== -1) {
            waitingRoomsByKey[searchKey].splice(index, 1);

            // Clean up empty arrays
            if (waitingRoomsByKey[searchKey].length === 0) {
              delete waitingRoomsByKey[searchKey];
            }
          }
        }

        // Remove the waiting room
        delete waitingRooms[roomId];

        // Notify the client if they're still connected
        if (socket) {
          socket.emit('searchTimeout', {
            message: 'Your search has timed out after 5 minutes of inactivity.'
          });
        }

        cleanupCount++;
      }
    }

    // Clean up stale active searches
    for (const socketId in activeSearches) {
      const search = activeSearches[socketId];
      if (now - search.timestamp > maxSearchAge) {
        delete activeSearches[socketId];

        // Notify the client if they're still connected
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('searchTimeout', {
            message: 'Your search has timed out after 5 minutes of inactivity.'
          });
        }

        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Cleaned up ${cleanupCount} stale searches and waiting rooms`);
    }
  } catch (error) {
    console.error('Error in cleanupStaleSearches:', error);
  }
}

/**
 * Clean up inactive matches
 * Runs periodically to free up resources
 * 
 * @param {number} maxInactiveTime - Maximum time a match can be inactive in milliseconds (default: 24 hours)
 */
function cleanupInactiveMatches(maxInactiveTime = 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    let cleanupCount = 0;

    for (const matchId in activeMatches) {
      const match = activeMatches[matchId];

      // Check if the match has been inactive for too long
      // We consider a match inactive if it was created more than maxInactiveTime ago
      if (now - match.createdAt > maxInactiveTime) {
        // End the match with notification
        endMatch(matchId, 'This match has been automatically ended due to inactivity.', true);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Cleaned up ${cleanupCount} inactive matches`);
    }
  } catch (error) {
    console.error('Error in cleanupInactiveMatches:', error);
  }
}

// Run cleanup every minute for searches and every hour for matches
const searchCleanupInterval = setInterval(cleanupStaleSearches, 60 * 1000);
const matchCleanupInterval = setInterval(cleanupInactiveMatches, 60 * 60 * 1000);

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Clear intervals
  clearInterval(rateLimitCleanupInterval);
  clearInterval(searchCleanupInterval);
  clearInterval(matchCleanupInterval);
  
  // Notify all clients
  io.emit('serverShutdown', { message: 'Server is shutting down.' });
  
  // Close server
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});