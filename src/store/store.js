// store.js

import { configureStore } from '@reduxjs/toolkit';
import { 
  cityReducer, 
  timeReducer, 
  gameReducer, 
  loadingReducer, 
  isSearchingReducer, 
  currentMatchReducer,
  messagesReducer, // Import the updated messagesReducer
} from './reducers';

// Configure the store
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
  },
});

export default store;
