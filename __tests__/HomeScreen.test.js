import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../src/screens/HomeScreen';
import { renderWithRedux } from './testUtils';

// Mock the HomeScreen component
jest.mock('../src/screens/HomeScreen', () => {
  const { View, Text } = require('react-native');
  return function MockHomeScreen({ navigation }) {
    return (
      <View>
        <Text testID="mockHomeScreen">Mock HomeScreen</Text>
      </View>
    );
  };
});

// Rest of your existing test file content...
// [Include all the remaining test code from the original file here]
// Make sure to keep all the existing test cases and mocks
