import { createSelector } from 'reselect';

// Selector to get messages for a specific match
const selectMessagesState = (state) => state.messages;

export const selectMessages = createSelector(
  [selectMessagesState, (_, matchId) => matchId],
  (messages, matchId) => messages[matchId] || []
);
