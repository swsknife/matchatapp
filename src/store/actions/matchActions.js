/**
 * Match Actions
 */

// Action Types
export const SET_CURRENT_MATCH = 'SET_CURRENT_MATCH';
export const SET_IS_SEARCHING = 'SET_IS_SEARCHING';

/**
 * Set the current match
 * @param {object|null} match - The match object or null to clear
 * @returns {object} Action object
 */
export const setCurrentMatch = (match) => ({
  type: SET_CURRENT_MATCH,
  payload: match,
});

/**
 * Set the searching status
 * @param {boolean} isSearching - Whether the user is currently searching
 * @returns {object} Action object
 */
export const setIsSearching = (isSearching) => ({
  type: SET_IS_SEARCHING,
  payload: isSearching,
});