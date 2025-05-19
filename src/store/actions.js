/**
 * actions.js
 * 
 * This file defines all Redux action types and action creators for the application.
 * Actions are organized by feature area (preferences, search, chat, connection).
 */

import { 
  getMessages, 
  saveMessages, 
  addMessage as storeMessage, 
  generateMessageId 
} from '../services/storageService';

// ===== User Preference Actions =====

/**
 * Action type constants for user preferences (city, time, game)
 */
export const SET_CITY = 'SET_CITY';
export const SET_TIME = 'SET_TIME';
export const SET_GAME = 'SET_GAME';

/**
 * Action creator to set the user's city preference
 * @param {string} city - The selected city
 * @returns {Object} Action object
 */
export const setCity = (city) => ({
  type: SET_CITY,
  payload: city,
});

/**
 * Action creator to set the user's time preference
 * @param {string} time - The selected time (morning, afternoon, evening)
 * @returns {Object} Action object
 */
export const setTime = (time) => ({
  type: SET_TIME,
  payload: time,
});

/**
 * Action creator to set the user's game preference
 * @param {string} game - The selected game type
 * @returns {Object} Action object
 */
export const setGame = (game) => ({
  type: SET_GAME,
  payload: game,
});

// ===== Connection Status Actions =====

/**
 * Action type constant for connection status
 */
export const SET_CONNECTION_STATUS = 'SET_CONNECTION_STATUS';

/**
 * Action creator to update the socket connection status
 * @param {string} status - Connection status ('connected', 'disconnected', 'reconnecting')
 * @returns {Object} Action object
 */
export const setConnectionStatus = (status) => ({
  type: SET_CONNECTION_STATUS,
  payload: status,
});

// ===== Search-related Actions =====

/**
 * Action type constants for search functionality
 */
export const SET_LOADING = 'SET_LOADING';
export const SET_IS_SEARCHING = 'SET_IS_SEARCHING';
export const SET_CURRENT_MATCH = 'SET_CURRENT_MATCH';
export const UPDATE_COUNTDOWN = 'UPDATE_COUNTDOWN';

/**
 * Action creator to set the loading state
 * @param {boolean} loading - Whether the app is in a loading state
 * @returns {Object} Action object
 */
export const setLoading = (loading) => ({
  type: SET_LOADING,
  payload: loading,
});

/**
 * Action creator to set the searching state
 * @param {boolean} isSearching - Whether the app is currently searching for a match
 * @returns {Object} Action object
 */
export const setIsSearching = (isSearching) => ({
  type: SET_IS_SEARCHING,
  payload: isSearching,
});

/**
 * Action creator to set the current match
 * @param {Object} currentMatch - The match object containing match details
 * @returns {Object} Action object
 */
export const setCurrentMatch = (currentMatch) => ({
  type: SET_CURRENT_MATCH,
  payload: currentMatch,
});

/**
 * Action creator to update the countdown timer
 * @param {number} newCountdown - The new countdown value in seconds
 * @returns {Object} Action object
 */
export const updateCountdown = (newCountdown) => ({
  type: UPDATE_COUNTDOWN,
  payload: newCountdown,
});

// ===== Chat-related Actions =====

/**
 * Action type constants for chat functionality
 */
export const ADD_MESSAGE = 'ADD_MESSAGE';
export const SET_MESSAGES = 'SET_MESSAGES';
export const UPDATE_MESSAGE_STATUS = 'UPDATE_MESSAGE_STATUS';
export const PERSISTENCE_ERROR = 'PERSISTENCE_ERROR';

/**
 * Thunk action creator to add a message to a specific match
 * Persists messages to AsyncStorage for offline access using the storage service
 * 
 * @param {string} matchId - The ID of the match the message belongs to
 * @param {Object} message - The message object to add
 * @returns {Function} Thunk function that dispatches the action
 */
export const addMessage = (matchId, message) => async (dispatch) => {
  // First dispatch to update Redux state immediately
  dispatch({
    type: ADD_MESSAGE,
    payload: { matchId, message },
  });
  
  // Then persist to storage using the centralized storage service
  // with retry mechanism
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let success = false;
  
  while (retryCount < MAX_RETRIES && !success) {
    try {
      // Use the storage service to add the message
      const result = await storeMessage(matchId, message);
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error saving message');
      }
      
      success = true;
    } catch (error) {
      retryCount++;
      console.error(`Failed to save message to storage (attempt ${retryCount}/${MAX_RETRIES}):`, error);
      
      if (retryCount < MAX_RETRIES) {
        // Wait before retrying with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // All retries failed, dispatch persistence error
        dispatch({
          type: PERSISTENCE_ERROR,
          payload: { 
            matchId, 
            messageId: message.id,
            error: error.message,
            retryCount
          }
        });
      }
    }
  }
  
  // Return success status for components that need to know if persistence succeeded
  return success;
};

/**
 * Action creator to set all messages for a specific match
 * Used when loading messages from storage or receiving history
 * 
 * @param {string} matchId - The ID of the match
 * @param {Array} messages - Array of message objects
 * @returns {Object} Action object
 */
export const setMessages = (matchId, messages) => ({
  type: SET_MESSAGES,
  payload: { matchId, messages },
});

/**
 * Thunk action creator to update the status of a specific message
 * Used to mark messages as delivered or read
 * Also persists the updated status to storage
 * 
 * @param {string} matchId - The ID of the match the message belongs to
 * @param {string} messageId - The ID of the message to update
 * @param {string} status - The new status ('sent', 'delivered', 'read')
 * @returns {Function} Thunk function that dispatches the action
 */
export const updateMessageStatus = (matchId, messageId, status) => async (dispatch, getState) => {
  // First dispatch to update Redux state immediately
  dispatch({
    type: UPDATE_MESSAGE_STATUS,
    payload: { matchId, messageId, status },
  });
  
  // Then persist the updated messages to storage with retry mechanism
  const MAX_RETRIES = 3;
  let retryCount = 0;
  let success = false;
  
  while (retryCount < MAX_RETRIES && !success) {
    try {
      // Get the current messages for this match
      const messages = getState().messages[matchId] || [];
      
      // Only persist if we have messages
      if (messages.length > 0) {
        // Save the updated messages to storage
        await saveMessages(matchId, messages);
        success = true;
      } else {
        // No messages to save, consider it a success
        success = true;
      }
    } catch (error) {
      retryCount++;
      console.error(`Failed to persist message status update (attempt ${retryCount}/${MAX_RETRIES}):`, error);
      
      if (retryCount < MAX_RETRIES) {
        // Wait before retrying with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // All retries failed, dispatch persistence error
        dispatch({
          type: PERSISTENCE_ERROR,
          payload: { 
            matchId, 
            messageId,
            error: error.message,
            retryCount
          }
        });
        
        // Schedule a reconciliation attempt for later
        setTimeout(() => {
          // Get the latest state
          const currentState = getState();
          const currentMessages = currentState.messages[matchId] || [];
          
          // If we still have messages, try one more time
          if (currentMessages.length > 0) {
            console.log(`Attempting message status reconciliation for match ${matchId}`);
            saveMessages(matchId, currentMessages)
              .then(() => console.log(`Successfully reconciled message status for match ${matchId}`))
              .catch(err => console.error(`Failed final reconciliation attempt:`, err));
          }
        }, 30000); // Try again after 30 seconds
      }
    }
  }
  
  // Return success status for components that need to know if persistence succeeded
  return success;
};