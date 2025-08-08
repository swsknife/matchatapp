/**
 * Redux Store Configuration
 */

import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';

// Import reducers
import {
  cityReducer,
  timeReducer,
  gameReducer,
  messagesReducer,
  connectionStatusReducer,
  currentMatchReducer,
  isSearchingReducer,
  loadingReducer,
  countdownReducer,
  persistenceErrorsReducer
} from './reducers';

// Combine reducers
const rootReducer = combineReducers({
  city: cityReducer,
  time: timeReducer,
  game: gameReducer,
  messages: messagesReducer,
  connectionStatus: connectionStatusReducer,
  currentMatch: currentMatchReducer,
  isSearching: isSearchingReducer,
  loading: loadingReducer,
  countdown: countdownReducer,
  persistenceErrors: persistenceErrorsReducer,
});

// Configure store
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;