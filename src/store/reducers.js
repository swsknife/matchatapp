// reducers.js

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
} from './actions';

// City Reducer
export const cityReducer = (state = 'choose', action) => {
  switch (action.type) {
    case SET_CITY:
      return action.payload;
    default:
      return state;
  }
};

// Time Reducer
export const timeReducer = (state = 'choose', action) => {
  switch (action.type) {
    case SET_TIME:
      return action.payload;
    default:
      return state;
  }
};

// Game Reducer
export const gameReducer = (state = 'choose', action) => {
  switch (action.type) {
    case SET_GAME:
      return action.payload;
    default:
      return state;
  }
};

// Loading Reducer
export const loadingReducer = (state = false, action) => {
  switch (action.type) {
    case SET_LOADING:
      return action.payload;
    default:
      return state;
  }
};

// Is Searching Reducer
export const isSearchingReducer = (state = false, action) => {
  switch (action.type) {
    case SET_IS_SEARCHING:
      return action.payload;
    default:
      return state;
  }
};

// Current Match Reducer
export const currentMatchReducer = (state = null, action) => {
  switch (action.type) {
    case SET_CURRENT_MATCH:
      return action.payload;
    default:
      return state;
  }
};

// Messages Reducer using Immer for immutable updates
export const messagesReducer = (state = {}, action) =>
  produce(state, (draft) => {
    switch (action.type) {
      case SET_MESSAGES:
        draft[action.payload.matchId] = action.payload.messages;
        break;

      case ADD_MESSAGE:
        if (!draft[action.payload.matchId]) {
          draft[action.payload.matchId] = [];
        }
        draft[action.payload.matchId].push(action.payload.message);
        break;

      case UPDATE_MESSAGE_STATUS:
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

  export const connectionStatusReducer = (state = 'disconnected', action) => {
    switch (action.type) {
      case SET_CONNECTION_STATUS:
        return action.payload;
      default:
        return state;
    }
  };