import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
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
import notificationService from './src/services/notificationService';
import * as Notifications from 'expo-notifications';

const Stack = createStackNavigator();

const AppContent = () => {
  const navigationRef = useRef();
  const notificationListener = useRef();
  const responseListener = useRef();

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
      
      // Initialize push notifications
      const initializeNotifications = async () => {
        try {
          const result = await notificationService.initializeNotifications();
          if (result.success) {
            console.log('Push notifications initialized successfully');
            remoteLogger.log('Push notifications initialized', { token: result.token?.substring(0, 20) + '...' });
          } else {
            console.log('Push notifications initialization failed:', result.reason);
            remoteLogger.log('Push notifications failed to initialize', { reason: result.reason });
          }
        } catch (error) {
          console.error('Error initializing push notifications:', error);
          remoteLogger.logError(error, 'App.initializeNotifications');
        }
      };
      
      initializeNotifications();
      
      // Set up notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        remoteLogger.log('Notification received', {
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data
        });
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        
        const result = notificationService.handleNotificationResponse(response);
        
        if (result.shouldNavigate && result.data) {
          // Navigate based on notification type
          if (result.data.type === 'NEW_MESSAGE' && result.data.matchId) {
            navigationRef.current?.navigate('Chat', {
              matchId: result.data.matchId,
              userId: result.data.userId || 'current-user'
            });
          } else if (result.data.type === 'MATCH_FOUND' && result.data.matchId) {
            navigationRef.current?.navigate('Chat', {
              matchId: result.data.matchId,
              userId: result.data.userId || 'current-user'
            });
          }
        }
      });
      
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
          
          // Clean up notification listeners
          try {
            if (notificationListener.current) {
              Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
              Notifications.removeNotificationSubscription(responseListener.current);
            }
          } catch (notificationError) {
            console.error('Error cleaning up notification listeners:', notificationError);
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
    <NavigationContainer ref={navigationRef}>
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