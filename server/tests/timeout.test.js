const assert = require('assert');

// Mock dependencies
const mockIO = {
  sockets: {
    sockets: new Map()
  }
};

// Mock data structures
const waitingRooms = {};
const activeMatches = {};
const activeSearches = {};
const waitingRoomsByKey = {};

// Mock socket for testing
const mockSocket = {
  id: 'test-socket-id',
  emit: function(event, data) {
    this.lastEmit = { event, data };
  }
};

// Add the mock socket to the sockets map
mockIO.sockets.sockets.set(mockSocket.id, mockSocket);

// Import the functions to test
function cleanupStaleSearches() {
  try {
    let cleanupCount = 0;
    
    // Only clean up waiting rooms for disconnected sockets
    for (const roomId in waitingRooms) {
      const room = waitingRooms[roomId];
      const socket = mockIO.sockets.sockets.get(room.playerSocketId);
      
      // If socket no longer exists, clean up the waiting room
      if (!socket) {
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
        cleanupCount++;
      }
    }
    
    // Only clean up active searches for disconnected sockets
    for (const socketId in activeSearches) {
      const socket = mockIO.sockets.sockets.get(socketId);
      
      // If socket no longer exists, clean up the search
      if (!socket) {
        delete activeSearches[socketId];
        cleanupCount++;
      }
    }
    
    return cleanupCount;
  } catch (error) {
    console.error('Error in cleanupStaleSearches:', error);
    return 0;
  }
}

function endMatch(matchId, reason, notifyPlayers = true) {
  try {
    const match = activeMatches[matchId];
    if (!match) {
      return false;
    }

    // Notify all clients in the room if requested
    if (notifyPlayers) {
      // In a real implementation, this would emit to all sockets in the room
      // For testing, we'll just record that it was called
      match.notified = true;
      match.endReason = reason;
    }

    // Delete the match
    delete activeMatches[matchId];
    return true;
  } catch (error) {
    console.error(`Error ending match ${matchId}:`, error);
    return false;
  }
}

function cleanupInactiveMatches(maxInactiveTime = 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    let cleanupCount = 0;
    
    for (const matchId in activeMatches) {
      const match = activeMatches[matchId];
      
      // Check if the match has been inactive for too long
      if (now - match.createdAt > maxInactiveTime) {
        // End the match with notification
        if (endMatch(matchId, 'This match has been automatically ended due to inactivity.', true)) {
          cleanupCount++;
        }
      }
    }
    
    return cleanupCount;
  } catch (error) {
    console.error('Error in cleanupInactiveMatches:', error);
    return 0;
  }
}

// Test suite
describe('Timeout Mechanism Tests', () => {
  beforeEach(() => {
    // Clear all data structures before each test
    Object.keys(waitingRooms).forEach(key => delete waitingRooms[key]);
    Object.keys(activeMatches).forEach(key => delete activeMatches[key]);
    Object.keys(activeSearches).forEach(key => delete activeSearches[key]);
    Object.keys(waitingRoomsByKey).forEach(key => delete waitingRoomsByKey[key]);
    
    // Reset the mock socket
    mockSocket.lastEmit = null;
  });

  it('should not clean up waiting rooms for connected sockets', function() {
    // Create a waiting room with a connected socket
    const roomId = 'connected-room';
    
    waitingRooms[roomId] = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      playerSocketId: mockSocket.id,
      createdAt: Date.now()
    };

    // Add to indexed structure
    const searchKey = 'newyork:morning:game1';
    waitingRoomsByKey[searchKey] = [roomId];

    // Run the cleanup
    const cleanupCount = cleanupStaleSearches();

    // Check that the room was not cleaned up
    assert.strictEqual(cleanupCount, 0, 'Should not clean up rooms with connected sockets');
    assert.strictEqual(Object.keys(waitingRooms).length, 1, 'Waiting rooms should not be empty');
    assert.strictEqual(Object.keys(waitingRoomsByKey).length, 1, 'Indexed structure should not be empty');
  });

  it('should clean up waiting rooms for disconnected sockets', () => {
    // Create a waiting room with a disconnected socket
    const roomId = 'disconnected-room';
    const disconnectedSocketId = 'disconnected-socket';
    
    waitingRooms[roomId] = {
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      playerSocketId: disconnectedSocketId, // This socket doesn't exist in our mock
      createdAt: Date.now()
    };
    
    // Add to indexed structure
    const searchKey = 'newyork:morning:game1';
    waitingRoomsByKey[searchKey] = [roomId];
    
    // Run the cleanup
    const cleanupCount = cleanupStaleSearches();
    
    // Check that the room was cleaned up
    assert.strictEqual(cleanupCount, 1, 'Should clean up rooms with disconnected sockets');
    assert.strictEqual(Object.keys(waitingRooms).length, 0, 'Waiting rooms should be empty');
    assert.strictEqual(Object.keys(waitingRoomsByKey).length, 0, 'Indexed structure should be empty');
  });

  it('should not clean up active searches for connected sockets', () => {
    // Create an active search with a connected socket
    activeSearches[mockSocket.id] = {
      timestamp: Date.now(),
      params: { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' }
    };
    
    // Run the cleanup
    const cleanupCount = cleanupStaleSearches();
    
    // Check that the search was not cleaned up
    assert.strictEqual(cleanupCount, 0, 'Should not clean up searches with connected sockets');
    assert.strictEqual(Object.keys(activeSearches).length, 1, 'Active searches should not be empty');
  });
  
  it('should clean up active searches for disconnected sockets', () => {
    // Create an active search with a disconnected socket
    const disconnectedSocketId = 'disconnected-socket';
    activeSearches[disconnectedSocketId] = {
      timestamp: Date.now(),
      params: { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' }
    };
    
    // Run the cleanup
    const cleanupCount = cleanupStaleSearches();
    
    // Check that the search was cleaned up
    assert.strictEqual(cleanupCount, 1, 'Should clean up searches with disconnected sockets');
    assert.strictEqual(Object.keys(activeSearches).length, 0, 'Active searches should be empty');
  });

  it('should clean up inactive matches', () => {
    // Create an inactive match
    const inactiveMatchId = 'inactive-match';
    const inactiveTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    
    activeMatches[inactiveMatchId] = {
      matchId: inactiveMatchId,
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      createdAt: inactiveTime,
      players: [
        { socketId: 'socket1', userId: 'user1', isActive: false },
        { socketId: 'socket2', userId: 'user2', isActive: false }
      ]
    };
    
    // Run the cleanup with a 24-hour timeout
    const cleanupCount = cleanupInactiveMatches(24 * 60 * 60 * 1000);
    
    // Check that the match was cleaned up
    assert.strictEqual(cleanupCount, 1, 'Should clean up one inactive match');
    assert.strictEqual(Object.keys(activeMatches).length, 0, 'Active matches should be empty');
  });

  it('should not clean up recent matches', () => {
    // Create a recent match
    const recentMatchId = 'recent-match';
    const recentTime = Date.now() - (12 * 60 * 60 * 1000); // 12 hours ago
    
    activeMatches[recentMatchId] = {
      matchId: recentMatchId,
      city: 'newyork',
      time: 'morning',
      game: 'game1',
      createdAt: recentTime,
      players: [
        { socketId: 'socket1', userId: 'user1', isActive: true },
        { socketId: 'socket2', userId: 'user2', isActive: true }
      ]
    };
    
    // Run the cleanup with a 24-hour timeout
    const cleanupCount = cleanupInactiveMatches(24 * 60 * 60 * 1000);
    
    // Check that the match was not cleaned up
    assert.strictEqual(cleanupCount, 0, 'Should not clean up recent matches');
    assert.strictEqual(Object.keys(activeMatches).length, 1, 'Match should still exist');
  });
});

// Tests will run automatically with Mocha
console.log('Running timeout mechanism tests...');