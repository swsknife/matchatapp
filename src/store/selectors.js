/**
 * selectors.js
 * 
 * This file defines memoized selectors for efficiently accessing and computing derived data
 * from the Redux store. Using Reselect helps prevent unnecessary re-renders by memoizing
 * selector results until inputs change.
 */

import { createSelector } from 'reselect';

// ===== Base Selectors =====

/**
 * Base selector that returns the entire messages state object
 * @param {Object} state - The Redux state
 * @returns {Object} The messages state object
 */
const selectMessagesState = (state) => state.messages;

/**
 * Base selector that returns the current match
 * @param {Object} state - The Redux state
 * @returns {Object|null} The current match object or null
 */
const selectCurrentMatchState = (state) => state.currentMatch;

/**
 * Base selector that returns the connection status
 * @param {Object} state - The Redux state
 * @returns {string} The connection status
 */
const selectConnectionStatusState = (state) => state.connectionStatus;

/**
 * Base selector that returns the persistence errors state
 * @param {Object} state - The Redux state
 * @returns {Object} The persistence errors state object
 */
const selectPersistenceErrorsState = (state) => state.persistenceErrors;

/**
 * Base selector that returns the countdown state
 * @param {Object} state - The Redux state
 * @returns {number} The countdown value
 */
const selectCountdownState = (state) => state.countdown;

// ===== Memoized Selectors =====

/**
 * Memoized selector to get messages for a specific match
 * Returns an empty array if no messages exist for the match
 * 
 * Usage: selectMessages(state, matchId)
 * 
 * @type {Function}
 * @param {Object} messages - The messages state object
 * @param {string} matchId - The ID of the match to get messages for
 * @returns {Array} Array of message objects for the specified match
 */
export const selectMessages = createSelector(
  [selectMessagesState, (_, matchId) => matchId],
  (messages, matchId) => messages[matchId] || []
);

/**
 * Memoized selector to get the current match ID
 * 
 * @type {Function}
 * @param {Object|null} currentMatch - The current match object
 * @returns {string|null} The ID of the current match or null
 */
export const selectCurrentMatchId = createSelector(
  [selectCurrentMatchState],
  (currentMatch) => currentMatch ? currentMatch.id : null
);

/**
 * Memoized selector to get messages for the current match
 * 
 * @type {Function}
 * @param {Object} state - The Redux state
 * @returns {Array} Array of message objects for the current match
 */
export const selectCurrentMatchMessages = createSelector(
  [selectMessagesState, selectCurrentMatchId],
  (messages, currentMatchId) => currentMatchId ? (messages[currentMatchId] || []) : []
);

/**
 * Memoized selector to get the connection status
 * 
 * @type {Function}
 * @param {string} connectionStatus - The connection status
 * @returns {boolean} Whether the connection is active
 */
export const selectIsConnected = createSelector(
  [selectConnectionStatusState],
  (connectionStatus) => connectionStatus === 'connected'
);

/**
 * Memoized selector to get persistence errors for a specific match
 * 
 * Usage: selectPersistenceErrors(state, matchId)
 * 
 * @type {Function}
 * @param {Object} persistenceErrors - The persistence errors state object
 * @param {string} matchId - The ID of the match to get errors for
 * @returns {Array} Array of error objects for the specified match
 */
export const selectPersistenceErrors = createSelector(
  [selectPersistenceErrorsState, (_, matchId) => matchId],
  (persistenceErrors, matchId) => persistenceErrors[matchId] || []
);

/**
 * Memoized selector to check if there are any persistence errors
 * 
 * @type {Function}
 * @param {Object} persistenceErrors - The persistence errors state object
 * @returns {boolean} Whether there are any persistence errors
 */
export const selectHasPersistenceErrors = createSelector(
  [selectPersistenceErrorsState],
  (persistenceErrors) => Object.keys(persistenceErrors).length > 0
);

/**
 * Memoized selector to get the countdown value
 * 
 * @type {Function}
 * @param {number} countdown - The countdown value
 * @returns {number} The countdown value
 */
export const selectCountdown = createSelector(
  [selectCountdownState],
  (countdown) => countdown
);

/**
 * Memoized selector to check if the countdown is active
 * 
 * @type {Function}
 * @param {number} countdown - The countdown value
 * @returns {boolean} Whether the countdown is active
 */
export const selectIsCountdownActive = createSelector(
  [selectCountdownState],
  (countdown) => countdown > 0
);
