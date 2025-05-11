const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const logger = require('./logger');
const logsRouter = require('./routes/logs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' })); // For parsing application/json

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingInterval: 60000,  // 1 minute between pings
  pingTimeout: 30000,   // 30 seconds to respond to a ping
  transports: ['websocket', 'polling']
});

// Use environment variables with fallbacks for configuration
const PORT = process.env.PORT || 3000;

// State management
const waitingRooms = {};
const activeMatches = {};
const activeSearches = {}; // Track active searches by socketId
const waitingRoomsByKey = {}; // Index waiting rooms by search criteria for faster matching
const rateLimits = {}; // Track rate limits by IP address

app.get('/ping', (req, res) => {
  logger.info('Received ping from client', { ip: req.ip });
  res.status(200).send('pong');
});

app.get('/', (req, res) => {
  logger.info('Received request to root endpoint');
  res.status(200).send('MatchChatApp server is running!');
});

// Mount the logs router
app.use('/api/logs', logsRouter);

// Debug endpoint to get server status
app.get('/debug/status', (req, res) => {
  logger.info('Debug status request received', { ip: req.ip });
  
  const status = {
    server: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage()
    },
    sockets: {
      // Fix for Socket.IO v4+ where sockets is a Map, not an object
      connected: io.sockets.sockets ? io.sockets.sockets.size : 0,
      connectionCount: io.engine ? io.engine.clientsCount : 0
    },
    state: {
      activeMatches: Object.keys(activeMatches).length,
      waitingRooms: Object.keys(waitingRooms).length,
      activeSearches: Object.keys(activeSearches).length
    }
  };
  
  res.status(200).json(status);
});

/**
 * Check if a request is rate limited
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
 * Clean up expired rate limit entries
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

io.on('connection', (socket) => {
  logger.info('A user connected', { 
    socketId: socket.id, 
    address: socket.handshake.address,
    userAgent: socket.handshake.headers['user-agent'],
    transport: socket.conn.transport.name
  });

  // Store client IP for rate limiting
  const clientIp = socket.handshake.headers['x-forwarded-for'] ||
                   socket.handshake.address ||
                   'unknown';
                   
  // Handle ping for debugging
  socket.on('ping', (data, callback) => {
    logger.debug('Received ping from client', { socketId: socket.id, data });
    if (callback && typeof callback === 'function') {
      callback({ 
        success: true, 
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        echo: data
      });
    }
  });
  
  // Check if a match is still active
  socket.on('checkMatchActive', ({ matchId }, callback) => {
    logger.debug('Checking if match is active', { socketId: socket.id, matchId });
    
    if (!callback || typeof callback !== 'function') {
      logger.warn('No callback provided for checkMatchActive', { socketId: socket.id });
      return;
    }
    
    try {
      const isActive = !!activeMatches[matchId];
      logger.debug(`Match ${matchId} active status: ${isActive}`, { socketId: socket.id });
      
      callback({
        active: isActive,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error checking match active status', { 
        socketId: socket.id, 
        matchId, 
        error: error.message 
      });
      
      callback({
        error: 'Failed to check match status',
        active: false
      });
    }
  });

  // Store userId in socket for easier access
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
      
      // Also emit opponentLeftMatch for backward compatibility
      socket.to(matchId).emit('opponentLeftMatch', {
        matchId,
        userId
      });

      console.log(`User ${userId} joined match ${matchId}`);
    } catch (error) {
      console.error('Error in joinMatch handler:', error);
      socket.emit('error', { message: 'Server error while joining match' });
    }
  });

  // Check active matches for a user
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

  // Handle temporary navigation away
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

  // Handle returning to match
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

  // Handle starting a search
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

  // Handle canceling a search
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

  // Handle sending messages
  socket.on('sendMessage', ({ message, matchId }, callback) => {
    try {
      console.log('Message received:', message, 'in room', matchId);

      // Validate required parameters
      if (!message || !matchId) {
        console.log('Invalid message parameters:', { message, matchId });
        if (callback) callback({ error: 'Invalid message parameters' });
        socket.emit('error', { message: 'Invalid message parameters' });
        return;
      }

      // Validate message object structure
      if (!message.id || !message.text || !message.sender) {
        console.log('Invalid message format:', message);
        if (callback) callback({ error: 'Invalid message format' });
        socket.emit('error', { message: 'Invalid message format' });
        return;
      }

      // Check that match exists before allowing messages
      if (activeMatches[matchId]) {
        try {
          const match = activeMatches[matchId];
          
          // Check if both players are still in the match
          const bothPlayersActive = match.players.length >= 2;
          
          // Always send the message to all clients in the match room
          io.to(matchId).emit('receiveMessage', message);

          // Send delivery confirmation to the sender socket (not room)
          socket.emit('messageDelivered', {
            messageId: message.id,
            timestamp: Date.now()
          });

          // Log message for debugging
          if (bothPlayersActive) {
            console.log(`Message ${message.id} delivered to match ${matchId} with both players active`);
          } else {
            console.log(`Message ${message.id} delivered to match ${matchId}, but only ${match.players.length} player(s) active`);
          }
          
          // Send acknowledgment back to the client
          if (callback) {
            if (bothPlayersActive) {
              callback({ success: true });
            } else {
              // Still successful but with a warning
              callback({ 
                success: true, 
                warning: 'One or more players may be offline',
                playersActive: match.players.length
              });
            }
          }
        } catch (emitError) {
          console.error('Error emitting message:', emitError);
          if (callback) callback({ error: 'Error delivering message' });
        }
      } else {
        console.log('Error: Match not found or invalid for message:', message);
        // Notify the sender that the match has ended
        socket.emit('matchEnded', {
          matchId,
          message: 'This match has ended or is no longer valid.'
        });
        
        if (callback) callback({ error: 'Match not found or invalid' });
      }
    } catch (error) {
      console.error('Error in sendMessage handler:', error);
      socket.emit('error', { message: 'Server error while sending message' });
      if (callback) callback({ error: 'Server error while sending message' });
    }
  });

  // Handle message read status
  socket.on('messageRead', ({ messageId, matchId }) => {
    try {
      if (!messageId || !matchId) {
        console.log('Invalid messageRead parameters:', { messageId, matchId });
        return;
      }

      if (activeMatches[matchId]) {
        console.log('Message read:', messageId, 'in match:', matchId);
        
        // Get the match and the current user
        const match = activeMatches[matchId];
        const currentUser = match.players.find(p => p.socketId === socket.id);
        
        if (!currentUser) {
          console.log(`User with socket ${socket.id} not found in match ${matchId}`);
          return;
        }
        
        // Store the read status in the match data
        if (!match.readMessages) {
          match.readMessages = {};
        }
        
        if (!match.readMessages[messageId]) {
          match.readMessages[messageId] = [];
        }
        
        // Add this user to the list of users who have read this message
        // (if they haven't already been added)
        if (!match.readMessages[messageId].includes(currentUser.userId)) {
          match.readMessages[messageId].push(currentUser.userId);
          
          // Broadcast to all clients in the match that the message has been read
          io.to(matchId).emit('messageRead', {
            messageId,
            userId: currentUser.userId,
            timestamp: Date.now()
          });
          
          // Log for debugging
          logger.info('Message marked as read', { 
            messageId, 
            matchId, 
            userId: currentUser.userId,
            socketId: socket.id 
          });
        }
      } else {
        console.log(`Cannot mark message as read: match ${matchId} not found`);
      }
    } catch (error) {
      console.error('Error in messageRead handler:', error);
    }
  });

  // Handle leaving a match
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
      // Store matchId in a variable that's safe to use in the catch block
      if (matchId) {
        // Only send confirmation if matchId is defined
        socket.emit(`matchLeft_${matchId}`, { success: false, error: true });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      console.log('User disconnected:', socket.id);

      // Clean up waiting rooms and active searches
      handleDisconnect(socket.id);

      // Handle active matches
      for (const matchId in activeMatches) {
        const match = activeMatches[matchId];
        const playerIndex = match.players.findIndex(p => p.socketId === socket.id);

        if (playerIndex !== -1) {
          const player = match.players[playerIndex];

          // Remove player from match
          match.players.splice(playerIndex, 1);
          console.log(`Player ${socket.id} removed from match ${matchId}`);

          if (match.players.length === 0) {
            // If no players left, just delete the match without notification
            endMatch(matchId, 'Match is now empty', false);
          } else {
            // End match with notification to remaining players
            endMatch(matchId, 'Player has disconnected from the match.');
          }

          // Only handle one match per player (in case of duplicates)
          break;
        }
      }
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  });
});

/**
 * Finds a matching waiting room based on search parameters
 * @param {Object} searchParams - The search parameters
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
 * Handles when a match is found between two players
 * @param {string} matchRoomId - The waiting room ID
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

    // Validate required fields in matchRoom
    if (!matchRoom.city || !matchRoom.time || !matchRoom.game || !matchRoom.playerSocketId || !matchRoom.userId) {
      console.log(`Invalid match room data for ${matchRoomId}:`, matchRoom);
      delete waitingRooms[matchRoomId];
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
    try {
      player1Socket.join(newMatchRoomId);
      player2Socket.join(newMatchRoomId);
    } catch (joinError) {
      console.error('Error joining players to match room:', joinError);
      return;
    }

    // Create match data with game details
    const matchData = {
      matchId: newMatchRoomId,
      city: matchRoom.city,
      time: matchRoom.time,
      game: matchRoom.game,
      createdAt: Date.now()
    };

    // Notify both players with try/catch blocks to handle potential errors
    try {
      io.to(player1SocketId).emit('matchFound', {
        ...matchData,
        opponent: {
          userId: player2UserId,
          socketId: player2SocketId
        }
      });
    } catch (emitError) {
      console.error('Error notifying player 1:', emitError);
    }

    try {
      io.to(player2SocketId).emit('matchFound', {
        ...matchData,
        opponent: {
          userId: player1UserId,
          socketId: player1SocketId
        }
      });
    } catch (emitError) {
      console.error('Error notifying player 2:', emitError);
    }

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
 * Creates a new waiting room for a player
 * @param {Object} searchParams - The search parameters
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
 * Handles ending a match and cleaning up resources
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
 * Handles player disconnection by cleaning up waiting rooms and active searches
 * @param {string} socketId - The socket ID of the disconnected player
 */
function handleDisconnect(socketId) {
  try {
    if (!socketId) {
      console.log('Invalid socketId in handleDisconnect');
      return;
    }
    
    // Clean up waiting rooms
    for (const roomId in waitingRooms) {
      const room = waitingRooms[roomId];
      
      // Skip invalid rooms or rooms that don't match the socket ID
      if (!room || room.playerSocketId !== socketId) {
        continue;
      }
      
      // Remove from indexed structure
      if (room.city && room.time && room.game) {
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

    // Clean up active searches
    if (activeSearches[socketId]) {
      delete activeSearches[socketId];
      console.log('Player disconnected and removed from active searches:', socketId);
    }
  } catch (error) {
    console.error('Error in handleDisconnect:', error);
  }
}

// Add error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

/**
 * Cleans up orphaned searches and waiting rooms
 * Note: We no longer timeout searches automatically - they remain active until
 * the user cancels them or finds a match
 */
function cleanupStaleSearches() {
  try {
    let cleanupCount = 0;

    // Only clean up waiting rooms for disconnected sockets
    for (const roomId in waitingRooms) {
      const room = waitingRooms[roomId];
      // Check if room and playerSocketId exist before trying to get the socket
      if (!room || !room.playerSocketId) {
        // Invalid room data, clean it up
        delete waitingRooms[roomId];
        cleanupCount++;
        continue;
      }
      
      const socket = io.sockets.sockets.get(room.playerSocketId);
      
      // If socket no longer exists, clean up the waiting room
      if (!socket) {
        // Remove from indexed structure
        if (room.city && room.time && room.game) {
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

        // Remove the waiting room
        delete waitingRooms[roomId];
        cleanupCount++;
      }
    }

    // Only clean up active searches for disconnected sockets
    for (const socketId in activeSearches) {
      if (!socketId) continue; // Skip if socketId is invalid
      
      const socket = io.sockets.sockets.get(socketId);
      
      // If socket no longer exists, clean up the search
      if (!socket) {
        delete activeSearches[socketId];
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`Cleaned up ${cleanupCount} orphaned searches and waiting rooms`);
    }
  } catch (error) {
    console.error('Error in cleanupStaleSearches:', error);
  }
}

/**
 * Cleans up inactive matches
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

// Clean up the intervals when the server is shutting down
process.on('SIGTERM', () => {
  clearInterval(searchCleanupInterval);
  clearInterval(matchCleanupInterval);
  clearInterval(rateLimitCleanupInterval);
  logger.info('Cleanup intervals cleared');
  process.exit(0);
});

// Enhanced logging function
const logWithTimestamp = (message, data = null) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, JSON.stringify(data));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
};

// Start the server
logWithTimestamp(`Attempting to start server with PORT=${PORT} (from env: ${process.env.PORT || 'not set'})`);
server.listen(PORT, '0.0.0.0', () => {
  logWithTimestamp(`Server is running on port ${PORT}`);
  logWithTimestamp(`Server environment: ${process.env.NODE_ENV || 'development'}`);
  logWithTimestamp(`Note: External access will be through Render.com's HTTPS port (443)`);
  
  // Log active connections every 30 seconds
  const statsLoggingInterval = setInterval(() => {
    try {
      // Fix for Socket.IO v4+ where sockets is a Map, not an object
      const connectedSockets = io.sockets.sockets ? io.sockets.sockets.size : 0;
      logWithTimestamp(`Active connections: ${connectedSockets}`);
      logWithTimestamp(`Active matches: ${Object.keys(activeMatches).length}`);
      logWithTimestamp(`Waiting rooms: ${Object.keys(waitingRooms).length}`);
    } catch (error) {
      console.error('Error logging stats:', error);
    }
  }, 30000);
  
  // Clean up the interval when the server is shutting down
  process.on('SIGTERM', () => {
    clearInterval(statsLoggingInterval);
    logger.info('Stats logging interval cleared');
  });
});