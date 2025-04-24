/**
 * store.js
 * 
 * This file configures the Redux store for the application.
 * It combines all reducers and applies middleware.
 */

import { configureStore } from '@reduxjs/toolkit';
import { 
  cityReducer, 
  timeReducer, 
  gameReducer, 
  loadingReducer, 
  isSearchingReducer, 
  currentMatchReducer,
  messagesReducer,
  connectionStatusReducer,
  countdownReducer,
  persistenceErrorsReducer,
} from './reducers';

/**
 * Redux store configuration
 * 
 * The store is configured with the following state slices:
 * - city: User's selected city preference
 * - time: User's selected time preference
 * - game: User's selected game preference
 * - loading: Global loading state
 * - isSearching: Whether the app is currently searching for a match
 * - currentMatch: The currently active match
 * - messages: All messages organized by match ID
 * - connectionStatus: Current socket connection status
 * - countdown: Countdown timer value in seconds
 * - persistenceErrors: Tracking of message persistence failures
 */
const store = configureStore({
  reducer: {
    city: cityReducer,
    time: timeReducer,
    game: gameReducer,
    loading: loadingReducer,
    isSearching: isSearchingReducer,
    currentMatch: currentMatchReducer,
    messages: messagesReducer,
    connectionStatus: connectionStatusReducer,
    countdown: countdownReducer,
    persistenceErrors: persistenceErrorsReducer,
  },
  // Redux Toolkit's configureStore automatically adds:
  // - Redux Thunk middleware for async actions
  // - Redux DevTools integration
  // - Development checks and warnings
});

export default store;
