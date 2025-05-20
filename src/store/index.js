/**
 * Redux Store Configuration
 */

import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';

// Import reducers
import cityReducer from './reducers/cityReducer';
import timeReducer from './reducers/timeReducer';
import gameReducer from './reducers/gameReducer';
import messagesReducer from './reducers/messagesReducer';
import connectionStatusReducer from './reducers/connectionStatusReducer';
import matchReducer from './reducers/matchReducer';
import searchReducer from './reducers/searchReducer';

// Combine reducers
const rootReducer = combineReducers({
  city: cityReducer,
  time: timeReducer,
  game: gameReducer,
  messages: messagesReducer,
  connectionStatus: connectionStatusReducer,
  currentMatch: matchReducer,
  search: searchReducer,
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