const assert = require('assert');

// Mock the socket.io and uuid dependencies
const mockSocketIO = {
  sockets: {
    sockets: new Map()
  }
};

const mockUuid = {
  v4: () => 'test-uuid-' + Math.floor(Math.random() * 1000)
};

// Import the functions to test (with mocked dependencies)
const waitingRooms = {};
const activeMatches = {};
const activeSearches = {};
const waitingRoomsByKey = {};

// Mock socket objects
const createMockSocket = (id) => ({
  id,
  join: () => {},
  emit: () => {},
  to: () => ({ emit: () => {} })
});

// Import the functions we want to test
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

function createNewWaitingRoom(searchParams, socketId, socket) {
  try {
    if (!searchParams || !socketId || !socket) {
      console.log('Invalid parameters for creating waiting room');
      return null;
    }

    const newRoomId = mockUuid.v4();
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

    return newRoomId;
  } catch (error) {
    console.error('Error in createNewWaitingRoom:', error);
    return null;
  }
}

// Function to simulate canceling a search
function cancelSearch(socketId) {
  try {
    // Remove from waiting rooms
    for (const roomId in waitingRooms) {
      if (waitingRooms[roomId].playerSocketId === socketId) {
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
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error in cancelSearch:', error);
    return false;
  }
}

// Test suite
describe('Matching Algorithm Tests', () => {
  beforeEach(() => {
    // Clear all data structures before each test
    Object.keys(waitingRooms).forEach(key => delete waitingRooms[key]);
    Object.keys(activeMatches).forEach(key => delete activeMatches[key]);
    Object.keys(activeSearches).forEach(key => delete activeSearches[key]);
    Object.keys(waitingRoomsByKey).forEach(key => delete waitingRoomsByKey[key]);
  });

  it('should create a new waiting room with correct indexing', () => {
    const socket = createMockSocket('socket1');
    const searchParams = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    
    const roomId = createNewWaitingRoom(searchParams, socket.id, socket);
    
    // Check that the room was created
    assert.ok(roomId, 'Room ID should be returned');
    assert.ok(waitingRooms[roomId], 'Room should exist in waitingRooms');
    
    // Check that the room was indexed correctly
    const searchKey = 'newyork:morning:game1';
    assert.ok(waitingRoomsByKey[searchKey], 'Room should be indexed by search key');
    assert.strictEqual(waitingRoomsByKey[searchKey][0], roomId, 'Room ID should be in the index');
  });

  it('should find a matching room when one exists', () => {
    const socket1 = createMockSocket('socket1');
    const searchParams1 = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    const roomId = createNewWaitingRoom(searchParams1, socket1.id, socket1);
    
    // Try to find a match with the same parameters
    const socket2 = createMockSocket('socket2');
    const searchParams2 = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user2' };
    const foundRoomId = findMatchingRoom(searchParams2);
    
    assert.strictEqual(foundRoomId, roomId, 'Should find the existing room');
  });

  it('should not find a room with different parameters', () => {
    const socket1 = createMockSocket('socket1');
    const searchParams1 = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    createNewWaitingRoom(searchParams1, socket1.id, socket1);
    
    // Try to find a match with different parameters
    const searchParams2 = { city: 'chicago', time: 'morning', game: 'game1', userId: 'user2' };
    const foundRoomId = findMatchingRoom(searchParams2);
    
    assert.strictEqual(foundRoomId, null, 'Should not find a room with different parameters');
  });

  it('should handle multiple waiting rooms with different parameters', () => {
    // Create several waiting rooms with different parameters
    const socket1 = createMockSocket('socket1');
    const searchParams1 = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    const roomId1 = createNewWaitingRoom(searchParams1, socket1.id, socket1);
    
    const socket2 = createMockSocket('socket2');
    const searchParams2 = { city: 'chicago', time: 'afternoon', game: 'game2', userId: 'user2' };
    const roomId2 = createNewWaitingRoom(searchParams2, socket2.id, socket2);
    
    const socket3 = createMockSocket('socket3');
    const searchParams3 = { city: 'losangeles', time: 'morning', game: 'game1', userId: 'user3' };
    const roomId3 = createNewWaitingRoom(searchParams3, socket3.id, socket3);
    
    // Check that we can find each room with matching parameters
    assert.strictEqual(findMatchingRoom(searchParams1), roomId1, 'Should find the first room');
    assert.strictEqual(findMatchingRoom(searchParams2), roomId2, 'Should find the second room');
    assert.strictEqual(findMatchingRoom(searchParams3), roomId3, 'Should find the third room');
    
    // Check that we don't find rooms with non-matching parameters
    const nonMatchingParams = { city: 'boston', time: 'morning', game: 'game1', userId: 'user4' };
    assert.strictEqual(findMatchingRoom(nonMatchingParams), null, 'Should not find a non-matching room');
  });

  it('should handle multiple waiting rooms with the same parameters', () => {
    // Create two waiting rooms with the same parameters
    const socket1 = createMockSocket('socket1');
    const searchParams = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    const roomId1 = createNewWaitingRoom(searchParams, socket1.id, socket1);

    const socket2 = createMockSocket('socket2');
    const roomId2 = createNewWaitingRoom(searchParams, socket2.id, socket2);

    // The first room created should be returned first (FIFO)
    assert.strictEqual(findMatchingRoom(searchParams), roomId1, 'Should find the first room created');

    // After removing the first room, the second should be found
    const searchKey = 'newyork:morning:game1';
    waitingRoomsByKey[searchKey].shift(); // Remove the first room from the index
    delete waitingRooms[roomId1]; // Remove from main structure

    assert.strictEqual(findMatchingRoom(searchParams), roomId2, 'Should find the second room after first is removed');
  });

  it('should properly clean up waitingRoomsByKey when a room is removed', () => {
    // Create a waiting room
    const socket = createMockSocket('socket1');
    const searchParams = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    const roomId = createNewWaitingRoom(searchParams, socket.id, socket);

    // Verify the room was created and indexed
    const searchKey = 'newyork:morning:game1';
    assert.ok(waitingRoomsByKey[searchKey], 'Room should be indexed by search key');
    assert.strictEqual(waitingRoomsByKey[searchKey].length, 1, 'Index should have one entry');

    // Simulate removing the room (like in cancelSearch)
    const index = waitingRoomsByKey[searchKey].indexOf(roomId);
    waitingRoomsByKey[searchKey].splice(index, 1);
    if (waitingRoomsByKey[searchKey].length === 0) {
      delete waitingRoomsByKey[searchKey];
    }
    delete waitingRooms[roomId];

    // Verify the room was removed from the index
    assert.strictEqual(waitingRoomsByKey[searchKey], undefined, 'Index key should be removed when empty');

    // Verify that findMatchingRoom returns null
    assert.strictEqual(findMatchingRoom(searchParams), null, 'Should not find a room after it was removed');
  });

  it('should properly clean up waitingRoomsByKey when a search is canceled', () => {
    // Create a waiting room
    const socket = createMockSocket('socket1');
    const searchParams = { city: 'newyork', time: 'morning', game: 'game1', userId: 'user1' };
    createNewWaitingRoom(searchParams, socket.id, socket);

    // Verify the room was created and indexed
    const searchKey = 'newyork:morning:game1';
    assert.ok(waitingRoomsByKey[searchKey], 'Room should be indexed by search key');

    // Cancel the search
    const result = cancelSearch(socket.id);
    assert.strictEqual(result, true, 'Search should be successfully canceled');

    // Verify the room was removed from the index
    assert.strictEqual(waitingRoomsByKey[searchKey], undefined, 'Index key should be removed when empty');

    // Verify that findMatchingRoom returns null
    assert.strictEqual(findMatchingRoom(searchParams), null, 'Should not find a room after search is canceled');
  });
});

// Tests will run automatically with Mocha
console.log('Running matching algorithm tests...');