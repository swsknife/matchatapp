// __tests__/reducers.test.js
import {
  cityReducer,
  timeReducer,
  gameReducer,
  loadingReducer,
  isSearchingReducer,
  currentMatchReducer,
  messagesReducer,
  connectionStatusReducer
} from '../src/store/reducers';

import {
  SET_CITY,
  SET_TIME,
  SET_GAME,
  SET_LOADING,
  SET_IS_SEARCHING,
  SET_CURRENT_MATCH,
  SET_MESSAGES,
  ADD_MESSAGE,
  UPDATE_MESSAGE_STATUS,
  SET_CONNECTION_STATUS
} from '../src/store/actions';

describe('Reducers', () => {
  // cityReducer tests
  describe('cityReducer', () => {
    test('cityReducer returns initial state', () => {
      // When no action is provided, it should return the default state
      const initialState = 'choose';
      const action = { type: 'UNKNOWN_ACTION' };
      
      expect(cityReducer(undefined, action)).toBe(initialState);
    });

    test('cityReducer handles SET_CITY action', () => {
      // When SET_CITY action is dispatched, it should update the state
      const initialState = 'choose';
      const newCity = 'New York';
      const action = { type: SET_CITY, payload: newCity };
      
      expect(cityReducer(initialState, action)).toBe(newCity);
    });
  });

  // timeReducer tests
  describe('timeReducer', () => {
    test('timeReducer handles SET_TIME action', () => {
      // When SET_TIME action is dispatched, it should update the state
      const initialState = 'choose';
      const newTime = 'evening';
      const action = { type: SET_TIME, payload: newTime };
      
      expect(timeReducer(initialState, action)).toBe(newTime);
    });
  });

  // gameReducer tests
  describe('gameReducer', () => {
    test('gameReducer handles SET_GAME action', () => {
      // When SET_GAME action is dispatched, it should update the state
      const initialState = 'choose';
      const newGame = 'chess';
      const action = { type: SET_GAME, payload: newGame };
      
      expect(gameReducer(initialState, action)).toBe(newGame);
    });
  });

  // messagesReducer tests
  describe('messagesReducer', () => {
    test('messagesReducer handles SET_MESSAGES action', () => {
      // When SET_MESSAGES action is dispatched, it should set messages for a match
      const initialState = {};
      const matchId = 'match123';
      const messages = [{ id: 1, text: 'Hello', status: 'sent' }];
      const action = { 
        type: SET_MESSAGES, 
        payload: { matchId, messages } 
      };
      
      const newState = messagesReducer(initialState, action);
      expect(newState[matchId]).toEqual(messages);
    });

    test('messagesReducer handles ADD_MESSAGE action', () => {
      // When ADD_MESSAGE action is dispatched, it should add a message to existing messages
      const matchId = 'match123';
      const initialState = { [matchId]: [{ id: 1, text: 'Hello', status: 'sent' }] };
      const newMessage = { id: 2, text: 'How are you?', status: 'sent' };
      const action = { 
        type: ADD_MESSAGE, 
        payload: { matchId, message: newMessage } 
      };
      
      const newState = messagesReducer(initialState, action);
      expect(newState[matchId]).toHaveLength(2);
      expect(newState[matchId][1]).toEqual(newMessage);
      
      // Test adding a message to a non-existent match
      const newMatchId = 'match456';
      const actionForNewMatch = { 
        type: ADD_MESSAGE, 
        payload: { matchId: newMatchId, message: newMessage } 
      };
      
      const stateWithNewMatch = messagesReducer(initialState, actionForNewMatch);
      expect(stateWithNewMatch[newMatchId]).toHaveLength(1);
      expect(stateWithNewMatch[newMatchId][0]).toEqual(newMessage);
    });

    test('messagesReducer handles UPDATE_MESSAGE_STATUS action', () => {
      // When UPDATE_MESSAGE_STATUS action is dispatched, it should update the status of a message
      const matchId = 'match123';
      const messageId = 1;
      const initialState = { 
        [matchId]: [{ id: messageId, text: 'Hello', status: 'sent' }] 
      };
      const newStatus = 'delivered';
      const action = { 
        type: UPDATE_MESSAGE_STATUS, 
        payload: { matchId, messageId, status: newStatus } 
      };
      
      const newState = messagesReducer(initialState, action);
      expect(newState[matchId][0].status).toBe(newStatus);
      
      // Test with non-existent message ID
      const nonExistentMessageId = 999;
      const actionWithNonExistentId = { 
        type: UPDATE_MESSAGE_STATUS, 
        payload: { matchId, messageId: nonExistentMessageId, status: newStatus } 
      };
      
      const stateAfterNonExistentId = messagesReducer(initialState, actionWithNonExistentId);
      // State should remain unchanged
      expect(stateAfterNonExistentId).toEqual(initialState);
      
      // Test with non-existent match ID
      const nonExistentMatchId = 'nonExistentMatch';
      const actionWithNonExistentMatchId = { 
        type: UPDATE_MESSAGE_STATUS, 
        payload: { matchId: nonExistentMatchId, messageId, status: newStatus } 
      };
      
      const stateAfterNonExistentMatchId = messagesReducer(initialState, actionWithNonExistentMatchId);
      // State should remain unchanged
      expect(stateAfterNonExistentMatchId).toEqual(initialState);
    });
  });

  // connectionStatusReducer tests
  describe('connectionStatusReducer', () => {
    test('connectionStatusReducer handles SET_CONNECTION_STATUS action', () => {
      // When SET_CONNECTION_STATUS action is dispatched, it should update the state
      const initialState = 'disconnected';
      const newStatus = 'connected';
      const action = { type: SET_CONNECTION_STATUS, payload: newStatus };
      
      expect(connectionStatusReducer(initialState, action)).toBe(newStatus);
    });
  });
});