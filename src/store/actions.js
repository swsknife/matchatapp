// actions.js
import AsyncStorage from '@react-native-async-storage/async-storage';
// City, Time, and Game Type actions
export const SET_CITY = 'SET_CITY';
export const SET_TIME = 'SET_TIME';
export const SET_GAME = 'SET_GAME';
export const SET_CONNECTION_STATUS = 'SET_CONNECTION_STATUS';
export const setConnectionStatus = (status) => ({
  type: SET_CONNECTION_STATUS,
  payload: status,
});

export const setCity = (city) => ({
  type: SET_CITY,
  payload: city,
});

export const setTime = (time) => ({
  type: SET_TIME,
  payload: time,
});

export const setGame = (game) => ({
  type: SET_GAME,
  payload: game,
});

// Search-related actions
export const SET_LOADING = 'SET_LOADING';
export const SET_IS_SEARCHING = 'SET_IS_SEARCHING';
export const SET_CURRENT_MATCH = 'SET_CURRENT_MATCH';
export const UPDATE_COUNTDOWN = 'UPDATE_COUNTDOWN';

export const setLoading = (loading) => ({
  type: SET_LOADING,
  payload: loading,
});

export const setIsSearching = (isSearching) => ({
  type: SET_IS_SEARCHING,
  payload: isSearching,
});

export const setCurrentMatch = (currentMatch) => ({
  type: SET_CURRENT_MATCH,
  payload: currentMatch,
});

export const updateCountdown = (newCountdown) => ({
  type: UPDATE_COUNTDOWN,
  payload: newCountdown,
});

// Chat-related actions
export const ADD_MESSAGE = 'ADD_MESSAGE';
export const SET_MESSAGES = 'SET_MESSAGES';
export const UPDATE_MESSAGE_STATUS = 'UPDATE_MESSAGE_STATUS';

// Updated to include matchId
export const addMessage = (matchId, message) => async (dispatch) => {
  dispatch({
    type: ADD_MESSAGE,
    payload: { matchId, message },
  });
  const messages = await AsyncStorage.getItem(`messages_${matchId}`);
  const parsedMessages = messages ? JSON.parse(messages) : [];
  parsedMessages.push(message);
  await AsyncStorage.setItem(`messages_${matchId}`, JSON.stringify(parsedMessages));
};

export const setMessages = (matchId, messages) => ({
  type: SET_MESSAGES,
  payload: { matchId, messages },
});

export const updateMessageStatus = (matchId, messageId, status) => ({ // New action creator
  type: UPDATE_MESSAGE_STATUS,
  payload: { matchId, messageId, status },
});