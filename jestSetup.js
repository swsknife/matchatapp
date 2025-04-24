// jestSetup.js
import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage - proper implementation for tests
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Mock the Alert module
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock the uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid')
}));

// Mock the socket.io-client
jest.mock('socket.io-client', () => jest.fn(() => ({
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  id: 'mock-socket-id',
})));

// Mock Picker component
jest.mock('@react-native-picker/picker', () => ({
  Picker: () => 'Picker'
}));

// Mock react-native-dotenv module
jest.mock('react-native-dotenv', () => ({
  REACT_APP_SERVER_URL: 'http://localhost:3000'
}));

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock the navigation object
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: jest.fn(),
    }),
  };
});

// Global mocks
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};