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
import remoteLogger from './src/utils/remoteLogger';
import { initializeSessionManager, cleanupSessionManager } from './src/utils/sessionManager';

const Stack = createStackNavigator();

const AppContent = () => {
  // Initialize services when app loads
  useEffect(() => {
    try {
      // Start cleanup process - run once per day, keep messages for 30 days
      startPeriodicCleanup(24 * 60 * 60 * 1000, 30);
      
      // Initialize remote logger
      const cleanupLogger = remoteLogger.initRemoteLogger();
      
      // Initialize session manager
      try {
        initializeSessionManager();
      } catch (sessionError) {
        console.error('Failed to initialize session manager:', sessionError);
        // Continue app initialization - we'll try to recover
      }
      
      // Log app start
      remoteLogger.log('Application started', {
        timestamp: new Date().toISOString(),
        version: '0.0.1' // Replace with your app version
      });
      
      // Clean up when component unmounts
      return () => {
        try {
          try {
            stopPeriodicCleanup();
          } catch (cleanupError) {
            console.error('Error stopping periodic cleanup:', cleanupError);
          }
          
          try {
            if (cleanupLogger) cleanupLogger();
          } catch (loggerError) {
            console.error('Error cleaning up logger:', loggerError);
          }
          
          try {
            cleanupSessionManager();
          } catch (sessionError) {
            console.error('Error cleaning up session manager:', sessionError);
          }
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
      };
    } catch (error) {
      console.error('Error initializing app services:', error);
    }
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