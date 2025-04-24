import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import store from './src/store/store';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import DebugScreen from './src/screens/DebugScreen';
import { startPeriodicCleanup, stopPeriodicCleanup } from './src/utils/storageCleanup';

const Stack = createStackNavigator();

const AppContent = () => {
  // Start storage cleanup when app loads and stop when it unmounts
  useEffect(() => {
    // Start cleanup process - run once per day, keep messages for 30 days
    startPeriodicCleanup(24 * 60 * 60 * 1000, 30);
    
    // Clean up when component unmounts
    return () => {
      stopPeriodicCleanup();
    };
  }, []);
  
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Match Chat' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
        <Stack.Screen name="Debug" component={DebugScreen} options={{ title: 'Debug Console' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;