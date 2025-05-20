// __tests__/testUtils.js
import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

// Create a mock store creator
const mockStoreCreator = configureStore([]);

export const renderWithRedux = (
  component,
  { initialState = {}, store = mockStoreCreator(initialState) } = {}
) => {
  return {
    ...render(<Provider store={store}>{component}</Provider>),
    store,
  };
};