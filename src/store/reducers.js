/**
 * reducers.js
 * 
 * This file defines all Redux reducers that handle state changes in response to actions.
 * Each reducer manages a specific slice of the application state.
 */

import { produce } from 'immer';
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
  SET_CONNECTION_STATUS,
  UPDATE_COUNTDOWN,
  PERSISTENCE_ERROR,
} from './actions';

/**
 * Reducer for the user's city preference
 * 
 * @param {string} state - Current city state, defaults to 'choose'
 * @param {Object} action - Redux action object
 * @returns {string} New city state
 */
export const cityReducer = (state = 'choose', action) => {
  switch (action.type) {
    case SET_CITY:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for the user's time preference
 * 
 * @param {string} state - Current time state, defaults to 'choose'
 * @param {Object} action - Redux action object
 * @returns {string} New time state
 */
export const timeReducer = (state = 'choose', action) => {
  switch (action.type) {
    case SET_TIME:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for the user's game preference
 * 
 * @param {string} state - Current game state, defaults to 'choose'
 * @param {Object} action - Redux action object
 * @returns {string} New game state
 */
export const gameReducer = (state = 'choose', action) => {
  switch (action.type) {
    case SET_GAME:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for the application loading state
 * 
 * @param {boolean} state - Current loading state, defaults to false
 * @param {Object} action - Redux action object
 * @returns {boolean} New loading state
 */
export const loadingReducer = (state = false, action) => {
  switch (action.type) {
    case SET_LOADING:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for tracking if the app is currently searching for a match
 * 
 * @param {boolean} state - Current searching state, defaults to false
 * @param {Object} action - Redux action object
 * @returns {boolean} New searching state
 */
export const isSearchingReducer = (state = false, action) => {
  switch (action.type) {
    case SET_IS_SEARCHING:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for the current active match
 * 
 * @param {Object|null} state - Current match object, defaults to null
 * @param {Object} action - Redux action object
 * @returns {Object|null} New match state
 */
export const currentMatchReducer = (state = null, action) => {
  switch (action.type) {
    case SET_CURRENT_MATCH:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for managing messages across multiple matches
 * Uses Immer to create immutable updates in a mutable style
 * State structure: { [matchId]: [messages] }
 * 
 * @param {Object} state - Current messages state, defaults to empty object
 * @param {Object} action - Redux action object
 * @returns {Object} New messages state
 */
export const messagesReducer = (state = {}, action) =>
  produce(state, (draft) => {
    switch (action.type) {
      case SET_MESSAGES:
        // Set all messages for a specific match
        draft[action.payload.matchId] = action.payload.messages;
        break;

      case ADD_MESSAGE:
        // Initialize the array if this is the first message for this match
        if (!draft[action.payload.matchId]) {
          draft[action.payload.matchId] = [];
        }
        // Add the new message to the match's message array
        draft[action.payload.matchId].push(action.payload.message);
        break;

      case UPDATE_MESSAGE_STATUS:
        // Find and update the status of a specific message
        if (draft[action.payload.matchId]) {
          const messageIndex = draft[action.payload.matchId].findIndex(
            (msg) => msg.id === action.payload.messageId
          );
          if (messageIndex !== -1) {
            draft[action.payload.matchId][messageIndex].status = action.payload.status;
          }
        }
        break;

      default:
        break;
    }
  });

/**
 * Reducer for tracking the socket connection status
 * 
 * Valid connection status values:
 * - 'connected': Socket is connected to the server
 * - 'disconnected': Socket is disconnected from the server
 * - 'reconnecting': Socket is attempting to reconnect
 * - 'reconnect_failed': Socket failed to reconnect after all attempts
 * 
 * @param {string} state - Current connection status, defaults to 'disconnected'
 * @param {Object} action - Redux action object
 * @returns {string} New connection status
 */
export const connectionStatusReducer = (state = 'disconnected', action) => {
  switch (action.type) {
    case SET_CONNECTION_STATUS:
      // Validate the connection status to prevent invalid states
      const validStatuses = ['connected', 'disconnected', 'reconnecting', 'reconnect_failed'];
      if (validStatuses.includes(action.payload)) {
        return action.payload;
      } else {
        console.error(`Invalid connection status: ${action.payload}`);
        return state;
      }
    default:
      return state;
  }
};

/**
 * Reducer for tracking the countdown timer
 * 
 * @param {number} state - Current countdown value in seconds, defaults to 0
 * @param {Object} action - Redux action object
 * @returns {number} New countdown value
 */
export const countdownReducer = (state = 0, action) => {
  switch (action.type) {
    case UPDATE_COUNTDOWN:
      return action.payload;
    default:
      return state;
  }
};

/**
 * Reducer for tracking persistence errors
 * Keeps track of messages that failed to persist to AsyncStorage
 * 
 * @param {Object} state - Current persistence errors state, defaults to empty object
 * @param {Object} action - Redux action object
 * @returns {Object} New persistence errors state
 */
export const persistenceErrorsReducer = (state = {}, action) =>
  produce(state, (draft) => {
    switch (action.type) {
      case PERSISTENCE_ERROR:
        // Initialize the array if this is the first error for this match
        if (!draft[action.payload.matchId]) {
          draft[action.payload.matchId] = [];
        }
        // Add the error information
        draft[action.payload.matchId].push({
          messageId: action.payload.messageId,
          error: action.payload.error,
          timestamp: Date.now()
        });
        
        // Limit the number of stored errors to prevent excessive state growth
        if (draft[action.payload.matchId].length > 10) {
          draft[action.payload.matchId] = draft[action.payload.matchId].slice(-10);
        }
        break;
        
      default:
        break;
    }
  });