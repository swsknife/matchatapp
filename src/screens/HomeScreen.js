/**
 * HomeScreen.js
 * 
 * This component serves as the main entry point for the application.
 * It handles user preferences, match searching, and navigation to active matches.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Button,
  Image, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REACT_APP_SERVER_URL } from '@env';
import { Picker } from '@react-native-picker/picker';
import {
  initializeSocket, onMatchFound, onConnectionError, startSearch, leaveMatch,
  getSocketInstance, navigatingBack, resetNavigationState, onDisconnect, onSearchTimeout,
  manualReconnect
} from '../utils/network';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCity, setTime, setGame, setLoading, setIsSearching, setCurrentMatch,
} from '../store/actions';
import remoteLogger from '../utils/remoteLogger';
import { 
  getUserId,
  updateActivity,
  getSessionTimeouts,
  resetInactivityTimer
} from '../utils/sessionManager';

  /**
   * Redux selector functions for accessing state
   */
  const selectCity = (state) => state.city;
  const selectTime = (state) => state.time;
  const selectGame = (state) => state.game;
  const selectLoading = (state) => state.loading;
  const selectIsSearching = (state) => state.isSearching;
  const selectCurrentMatch = (state) => state.currentMatch;
  const selectConnectionStatus = (state) => state.connectionStatus;

/**
 * HomeScreen Component
 * 
 * The main screen of the application that allows users to:
 * - Set preferences for matching (city, time, game type)
 * - Search for other players with matching preferences
 * - View and manage active matches
 * - Monitor connection status with the server
 * 
 * @param {Object} navigation - React Navigation navigation object
 */
const HomeScreen = ({ navigation }) => {
  // Redux hooks
  const dispatch = useDispatch();

  // Select state from Redux store
  const city = useSelector(selectCity);
  const time = useSelector(selectTime);
  const game = useSelector(selectGame);
  const loading = useSelector(selectLoading);
  const isSearching = useSelector(selectIsSearching);
  const currentMatch = useSelector(selectCurrentMatch);
  const connectionStatus = useSelector(selectConnectionStatus);
  
  // Local state
  const [userId, setUserId] = useState(null); // Will be loaded from session manager
  const [countdown, setCountdown] = useState(0); // Counter for search duration
  const [lastCountdownUpdate, setLastCountdownUpdate] = useState(Date.now()); // Track when countdown was last updated
  const [serverStatus, setServerStatus] = useState('unknown'); // Server connection status

  /**
   * Load user ID
   */
  useEffect(() => {
    const loadUserIdAndConnect = async () => {
      try {
        // Load or generate user ID
        const id = await getUserId();
        setUserId(id);
        
        // Update activity timestamp
        await updateActivity();
        
        // Log initialization
        remoteLogger.log('HomeScreen initialized with user ID', { userId: id });
        
        // Initialize socket connection
        console.log('Initializing socket connection on HomeScreen mount');
        try {
          await initializeSocket(20000);
          console.log('Socket connection established successfully');
        } catch (error) {
          console.error('Failed to initialize socket on mount:', error);
          remoteLogger.logError(error, 'HomeScreen.initializeSocket');
          Alert.alert(
            'Connection Error',
            'Failed to connect to the server. Some features may not work properly.',
            [
              {
                text: 'Retry',
                onPress: () => initializeSocket(20000)
                  .then(() => console.log('Reconnection successful'))
                  .catch(err => console.error('Reconnection failed:', err))
              },
              { text: 'OK' }
            ]
          );
        }
      } catch (error) {
        console.error('Failed to load user ID:', error);
        remoteLogger.logError(error, 'HomeScreen.loadUserId');
      }
    };
    
    loadUserIdAndConnect();
  }, []);

  /**
   * Socket initialization and event listener setup
   * Handles socket connection, active matches, and various socket events
   */
  useEffect(() => {
    // Don't initialize socket until we have a user ID
    if (!userId) return;
    
    let isMounted = true;

    const setupSocketAndListeners = async () => {
      try {
        console.log("🔍 Initializing socket on HomeScreen");
        
        // Reset inactivity timer when setting up socket
        resetInactivityTimer();
        
        // Try to initialize socket with a timeout of 20 seconds
        await initializeSocket(20000).catch(error => {
          console.error("Failed to initialize socket:", error);
          throw new Error(`Socket connection failed: ${error.message}`);
        });
        
        const socket = getSocketInstance();

        if (!socket) {
          console.error("Socket initialization failed - no socket instance returned");
          if (isMounted) {
            Alert.alert(
              'Connection Error', 
              'Could not connect to the matchmaking server. Please check your internet connection and try again.',
              [
                { text: 'Retry', onPress: () => setupSocketAndListeners() },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
            dispatch(setLoading(false));
            dispatch(setIsSearching(false));
          }
          return () => {};
        }

        // Check for active matches on mount
        socket.emit('checkActiveMatches');

        /**
         * Event handler for when a match ends
         */
        const handleMatchEnded = ({ matchId }) => {
          if (currentMatch && currentMatch.matchId === matchId) {
            dispatch(setCurrentMatch(null));
            if (isMounted) {
              Alert.alert('Match Ended', 'The match has ended.');
            }
          }
        };

        /**
         * Event handler for receiving active matches from server
         */
        const handleActiveMatches = ({ matches }) => {
          if (matches && matches.length > 0) {
            dispatch(setCurrentMatch(matches[0]));
          } else {
            dispatch(setCurrentMatch(null));
          }
        };

        /**
         * Event handler for when a match is found
         */
        const handleMatchFound = (matchData) => {
          console.log('Match found:', matchData);
          
          // Validate match data before proceeding
          if (!matchData || !matchData.matchId) {
            console.error('Invalid match data received:', matchData);
            if (isMounted) {
              Alert.alert('Error', 'Received invalid match data from server.');
              dispatch(setLoading(false));
              dispatch(setIsSearching(false));
              setCountdown(0);
            }
            return;
          }
          
          // Update state
          dispatch(setLoading(false));
          setCountdown(0); // Reset counter to 0
          dispatch(setIsSearching(false));
          dispatch(setCurrentMatch(matchData));
          
          // Navigate to chat screen
          if (isMounted) {
            try {
              navigation.navigate('Chat', { ...matchData, userId });
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert(
                'Navigation Error', 
                'Failed to open chat screen. Please try accessing your match from the home screen.',
                [{ text: 'OK' }]
              );
            }
          }
        };

        /**
         * Event handler for connection errors
         */
        const handleConnectionError = (error) => {
          console.error('Connection error:', error);
          if (isMounted) {
            Alert.alert('Connection Error', 'Could not connect to the matchmaking server. Please check your internet connection.');
            dispatch(setLoading(false));
            dispatch(setIsSearching(false));
          }
        };

        /**
         * Event handler for when a match is left
         */
        const handleMatchLeft = ({ success, matchId }) => {
          if (success) {
            dispatch(setCurrentMatch(null));
          }
        };

        /**
         * Event handler for when an opponent leaves a match
         */
        const handlePlayerLeft = ({ userId }) => {
          if (isMounted) {
            Alert.alert('Opponent Left', 'Your opponent has left the match.');
          }
          dispatch(setCurrentMatch(null));
        };

        /**
         * Event handler for socket disconnection
         */
        const handleDisconnect = (reason) => {
          console.log('Socket disconnected. Reason:', reason);
          
          // Only show alert and cancel search if we're actively searching
          if (isMounted && isSearching) {
            // Different messages based on disconnect reason
            let message = 'You have been disconnected from the server. Your search has been canceled.';
            
            if (reason === 'io server disconnect') {
              message = 'The server has closed the connection. Your search has been canceled.';
            } else if (reason === 'transport close') {
              message = 'Connection to server lost. Your search has been canceled.';
            } else if (reason === 'ping timeout') {
              message = 'Connection timed out. Your search has been canceled.';
            }
            
            Alert.alert('Connection Lost', message);
            dispatch(setLoading(false));
            dispatch(setIsSearching(false));
            setCountdown(0); // Reset counter to 0
          }
        };
        
        /**
         * Event handler for socket reconnection
         */
        const handleReconnect = (attemptNumber) => {
          console.log(`Socket reconnected after ${attemptNumber} attempts`);
          
          if (isMounted) {
            // Check for active matches again after reconnection
            socket.emit('checkActiveMatches');
            
            // Only show alert if we're not in the middle of something else
            if (!isSearching && !loading) {
              Alert.alert('Reconnected', 'Connection to the server has been restored.');
            }
          }
        };

        // Register all event listeners
        socket.on('matchEnded', handleMatchEnded);
        socket.on('activeMatches', handleActiveMatches);
        socket.on('matchLeft', handleMatchLeft);
        socket.on('playerLeft', handlePlayerLeft);
        socket.on('reconnect', handleReconnect);

        // Register handlers using utility functions and get cleanup functions
        /**
         * Event handler for search timeout
         * This is kept for backward compatibility with older server versions
         */
        const handleSearchTimeout = (data) => {
          console.log('Search timeout received:', data);
          if (isMounted && isSearching) {
            Alert.alert('Search Timeout', data.message || 'Your search has timed out.');
            dispatch(setLoading(false));
            dispatch(setIsSearching(false));
            setCountdown(0); // Reset counter to 0
          }
        };

        const cleanupMatchFound = onMatchFound(handleMatchFound);
        const cleanupConnectionError = onConnectionError(handleConnectionError);
        const cleanupDisconnect = onDisconnect(handleDisconnect);
        const cleanupSearchTimeout = onSearchTimeout(handleSearchTimeout);

        // Return the cleanup function
        return () => {
          // Clean up all event listeners
          socket.off('matchEnded', handleMatchEnded);
          socket.off('activeMatches', handleActiveMatches);
          socket.off('matchLeft', handleMatchLeft);
          socket.off('playerLeft', handlePlayerLeft);
          socket.off('reconnect', handleReconnect);
          cleanupMatchFound();
          cleanupConnectionError();
          cleanupDisconnect();
          cleanupSearchTimeout();
        };
      } catch (error) {
        console.error('Failed to initialize socket:', error);
        if (isMounted) {
          // Provide more detailed error information and retry option
          Alert.alert(
            'Connection Error', 
            `Could not connect to the matchmaking server: ${error.message}. Please check your internet connection and try again.`,
            [
              { 
                text: 'Retry', 
                onPress: () => {
                  console.log('Retrying socket connection...');
                  setupSocketAndListeners();
                } 
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
          dispatch(setLoading(false));
          dispatch(setIsSearching(false));
        }
        return () => {};
      }
    };

    const cleanup = setupSocketAndListeners();

    return () => {
      isMounted = false;
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [dispatch, navigation, userId, currentMatch, isSearching]);
  
  /**
   * Reset inactivity timer on user interaction
   * This ensures the user isn't logged out while actively using the app
   */
  useEffect(() => {
    // Reset inactivity timer when user interacts with the app
    if (isSearching || currentMatch) {
      updateActivity();
    }
  }, [isSearching, currentMatch]);

  /**
   * Timer effect to track search duration
   * Shows how long the user has been searching without automatically timing out
   */
  useEffect(() => {
    let timer;
    let isMounted = true;
    
    // Only run the timer when actively searching
    if (isSearching) {
      // Reset the counter when starting a new search
      if (!timer) {
        setCountdown(0);
      }

      timer = setInterval(() => {
        if (isMounted) {
          setCountdown((prevCountdown) => prevCountdown + 1);
          setLastCountdownUpdate(Date.now());
        }
      }, 1000);
    } else {
      // Reset countdown when not searching
      setCountdown(0);
    }

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isSearching]);
  
  /**
   * Effect to handle app going to background
   * Pauses the search timer when app is in background
   */
  useEffect(() => {
    // This would be the place to add app state listeners
    // for handling app going to background/foreground
    // if we were using AppState from react-native
    
    // Check for stuck search state
    const checkStuckSearchState = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastCountdownUpdate;
      
      // If we're searching but the countdown hasn't updated in 5 seconds, the search is stuck
      if (isSearching && timeSinceLastUpdate > 5000) {
        console.log('Detected stuck search state - resetting');
        remoteLogger.log('Detected stuck search state', { 
          countdown, 
          timeSinceLastUpdate,
          isSearching,
          loading
        });
        
        // Reset the search state
        dispatch(setIsSearching(false));
        dispatch(setLoading(false));
        setCountdown(0);
        
        // Notify the user
        Alert.alert(
          'Search Reset',
          'The search appeared to be stuck and has been reset. You can try searching again.'
        );
      }
    };
    
    // Check for stuck search state every 5 seconds
    const stuckStateInterval = setInterval(checkStuckSearchState, 5000);
    
    // Also check immediately if we detect a potential issue
    if (isSearching && !loading) {
      console.log('Checking for potentially stuck search state');
      checkStuckSearchState();
    }
    
    return () => {
      // Clean up interval
      clearInterval(stuckStateInterval);
    };
  }, [isSearching, loading, countdown, lastCountdownUpdate]);

  /**
   * Start searching for a match
   * Validates user selections, checks connection status, and handles existing matches
   */
  const searchMatch = async () => {
    // Validate user selections
    if (city === 'choose' || time === 'choose' || game === 'choose') {
      Alert.alert('Missing Information', 'Please choose a city, time, and game type before searching.');
      return;
    }
    
    // Update activity when starting a search
    updateActivity();

    // Check connection status
    if (connectionStatus === 'disconnected') {
      Alert.alert('Not Connected', 'You are not connected to the server. Please check your internet connection and try again.');
      return;
    }

    /**
     * Helper function to start a new search
     */
    const startNewSearch = () => {
      // Check if socket is connected before starting search
      const socket = getSocketInstance();
      if (!socket || !socket.connected) {
        Alert.alert(
          'Not Connected', 
          'Cannot start search because you are not connected to the server. Please check your connection and try again.',
          [
            {
              text: 'Retry Connection',
              onPress: () => {
                // Try to reconnect and then start search if successful
                dispatch(setLoading(true));
                initializeSocket(10000)
                  .then(() => {
                    console.log('Reconnected successfully, starting search');
                    performSearch();
                  })
                  .catch(error => {
                    console.error('Failed to reconnect:', error);
                    dispatch(setLoading(false));
                    Alert.alert('Connection Failed', 'Could not connect to the server. Please try again later.');
                  });
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => dispatch(setLoading(false))
            }
          ]
        );
        return;
      }
      
      performSearch();
    };
    
    /**
     * Actually perform the search operation
     * Separated to allow for reconnection attempts
     */
    const performSearch = async () => {
      dispatch(setLoading(true));
      dispatch(setIsSearching(true));
      // Countdown will be reset in the useEffect
      
      // Update activity timestamp
      await updateActivity();

      startSearch({ city, time, game, userId }, (response) => {
        if (response && response.error) {
          // Handle different types of errors
          let errorMessage = `Failed to start search: ${response.error}`;
          let shouldRetry = false;
          
          if (response.error.includes('connection') || response.error.includes('timeout')) {
            errorMessage = 'Connection to server lost. Please check your internet connection.';
            shouldRetry = true;
          }
          
          Alert.alert(
            'Search Error', 
            errorMessage,
            shouldRetry ? 
              [
                {
                  text: 'Retry',
                  onPress: () => startNewSearch()
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    dispatch(setLoading(false));
                    dispatch(setIsSearching(false));
                  }
                }
              ] : 
              [{ text: 'OK' }]
          );
          
          if (!shouldRetry) {
            dispatch(setLoading(false));
            dispatch(setIsSearching(false));
          }
        } else {
          console.log('Search started successfully');
        }
      });
    };

    // Handle case where user already has an active match
    if (currentMatch) {
      Alert.alert(
        'Active Match',
        'You are currently matched with someone. Are you sure you want to search for a new match?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: async () => {
              try {
                dispatch(setLoading(true)); // Show loading while leaving match
                await leaveMatch(currentMatch.matchId, userId);
                // Reset navigation state to avoid issues with future matches
                resetNavigationState();
                dispatch(setCurrentMatch(null));
                // Only start search after successfully leaving match
                startNewSearch();
              } catch (error) {
                console.error('Failed to leave match:', error);
                dispatch(setLoading(false));
                Alert.alert('Error', 'Failed to leave the current match. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      startNewSearch();
    }
  };

  /**
   * Cancel an ongoing search
   * Notifies the server and updates local state
   */
  const cancelSearch = async () => {
    if (isSearching) {
      // Log the cancellation attempt
      remoteLogger.log('Canceling search', { 
        isSearching, 
        countdown: countdown,
        connectionStatus
      });
      
      // Always update local state immediately to ensure UI is responsive
      dispatch(setIsSearching(false));
      setCountdown(0);
      
      // Update activity timestamp
      await updateActivity();
      
      // Show loading indicator while canceling
      dispatch(setLoading(true));
      
      // Notify server about cancellation
      const socket = getSocketInstance();
      if (socket && socket.connected) {
        socket.emit('cancelSearch', { userId }, (response) => {
          // Always update local state regardless of server response
          dispatch(setLoading(false));
          dispatch(setIsSearching(false));
          setCountdown(0); // Reset counter to 0
          
          if (response && response.error) {
            console.error('Error canceling search:', response.error);
            remoteLogger.logError(new Error(response.error), 'HomeScreen.cancelSearch');
            // Still show success message to user since we've canceled locally
            Alert.alert('Search Canceled', 'You have canceled the search, but there was an issue communicating with the server.');
          } else {
            console.log('Search canceled successfully on server');
            Alert.alert('Search Canceled', 'You have canceled the search.');
          }
        });
        
        // Set a timeout in case the server doesn't respond
        setTimeout(() => {
          if (loading) {
            remoteLogger.log('Search cancel timeout reached', { countdown });
            dispatch(setLoading(false));
            Alert.alert('Search Canceled', 'You have canceled the search, but the server did not confirm the cancellation.');
          }
        }, 5000);
      } else {
        // If socket is not connected, just update local state
        dispatch(setLoading(false));
        dispatch(setIsSearching(false));
        setCountdown(0);
        Alert.alert('Search Canceled', 'You have canceled the search. The server could not be notified because you are disconnected.');
      }
    }
  };

  /**
   * Main render method
   */
  return (
    <View style={styles.container}>
      {/* Header with user ID and connection status */}
      <View style={styles.headerContainer}>
        <Text style={styles.userId}>User ID: {userId}</Text>
        <View style={styles.connectionStatusContainer}>
          <View style={[
            styles.connectionIndicator,
            { backgroundColor:
              connectionStatus === 'connected' ? 'green' :
              connectionStatus === 'reconnecting' ? 'orange' :
              connectionStatus === 'reconnect_failed' ? 'red' : 'red'
            }
          ]} />
          <Text style={styles.connectionStatusText}>
            {connectionStatus === 'connected' ? 'Connected' :
             connectionStatus === 'reconnecting' ? 'Reconnecting...' :
             connectionStatus === 'reconnect_failed' ? 'Connection Failed' : 'Disconnected'}
          </Text>
        </View>
      </View>
      
      {/* Session rules banner */}
      <View style={styles.sessionRulesBanner}>
        <Text style={styles.sessionRulesBannerText}>
          Sessions expire after {getSessionTimeouts().inactivityTimeout} of inactivity
        </Text>
      </View>
      
      {/* Server connection test button */}
      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: 
          serverStatus === 'connected' ? 'green' : 
          serverStatus === 'error' ? 'red' : 
          serverStatus === 'testing' ? 'orange' : '#666'
        }]}
        onPress={() => {
          // Prevent multiple simultaneous tests
          if (serverStatus === 'testing') {
            return;
          }
          
          setServerStatus('testing');
          
          // Create an AbortController to handle timeouts
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          fetch(`${REACT_APP_SERVER_URL}/ping`, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
          })
            .then(response => {
              clearTimeout(timeoutId);
              console.log('Server ping response:', response.status);
              setServerStatus('connected');
              Alert.alert('Server Connection', 'Successfully connected to the server!');
            })
            .catch(error => {
              clearTimeout(timeoutId);
              console.error('Server ping error:', error);
              setServerStatus('error');
              
              // Provide more specific error messages
              let errorMessage = `Failed to connect to the server at ${REACT_APP_SERVER_URL}.`;
              
              if (error.name === 'AbortError') {
                errorMessage = 'Connection timed out. The server might be busy or unreachable.';
              } else if (error.message && error.message.includes('Network request failed')) {
                errorMessage = 'Network request failed. Please check your internet connection.';
              }
              
              Alert.alert('Server Connection Error', 
                `${errorMessage}\nPlease check your network connection and server status.`);
            });
        }}
      >
        <Text style={styles.testButtonText}>Test Server Connection</Text>
      </TouchableOpacity>

      {/* Active match buttons */}
      {currentMatch && (
        <TouchableOpacity
          style={styles.matchButton}
          onPress={() => {
            // Log the start of the Go to Match action
            remoteLogger.log('Go to Match button clicked', { 
              userId,
              matchId: currentMatch?.matchId,
              matchData: currentMatch
            });
            
            // Validate match data before navigating
            if (!currentMatch || !currentMatch.matchId) {
              const errorMsg = 'Invalid match data';
              console.error(errorMsg, currentMatch);
              remoteLogger.logError(
                new Error(errorMsg), 
                'HomeScreen.goToMatch'
              );
              Alert.alert(
                'Invalid Match', 
                'The match data is invalid. Please try leaving the match and searching again.',
                [{ text: 'OK' }]
              );
              return;
            }
            
            // Validate userId
            if (!userId) {
              console.error('Invalid userId:', userId);
              Alert.alert(
                'Error', 
                'User ID is missing. Please restart the app and try again.',
                [{ text: 'OK' }]
              );
              return;
            }
            
            try {
              // Set loading state to prevent multiple clicks
              dispatch(setLoading(true));
              
              // Log the socket check attempt
              remoteLogger.log('Checking if match is active', {
                matchId: currentMatch.matchId,
                userId
              });
              
              // Check if the match is still active on the server
              const socket = getSocketInstance();
              
              // Log socket state
              remoteLogger.log('Socket state before navigation', {
                socketExists: !!socket,
                connected: socket ? socket.connected : false,
                id: socket ? socket.id : null
              });
              
              if (socket && socket.connected) {
                socket.emit('checkMatchActive', { matchId: currentMatch.matchId }, (response) => {
                  dispatch(setLoading(false));
                  
                  // Log the server response
                  remoteLogger.log('Server response for checkMatchActive', {
                    matchId: currentMatch.matchId,
                    response
                  });
                  
                  if (response && response.active === false) {
                    // Match is no longer active on the server
                    remoteLogger.log('Match is no longer active', {
                      matchId: currentMatch.matchId,
                      response
                    });
                    
                    Alert.alert(
                      'Match Ended', 
                      'This match has ended or is no longer available.',
                      [{ 
                        text: 'OK',
                        onPress: () => dispatch(setCurrentMatch(null))
                      }]
                    );
                    return;
                  }
                  
                  // Match is active, proceed with navigation
                  try {
                    // Tell server we're returning to the match
                    remoteLogger.log('Navigating back to match', {
                      matchId: currentMatch.matchId
                    });
                    
                    navigatingBack(currentMatch.matchId);
                    
                    // Prepare navigation params with explicit required fields
                    const navigationParams = {
                      matchId: currentMatch.matchId,
                      userId: userId,
                      // Include other match data
                      players: currentMatch.players || [],
                      createdAt: currentMatch.createdAt || Date.now(),
                      // Any other fields from currentMatch
                      ...currentMatch
                    };
                    
                    // Log navigation params for debugging
                    console.log('Navigating to Chat with params:', JSON.stringify(navigationParams));
                    
                    // Log to remote logger
                    remoteLogger.log('Navigating to Chat screen', {
                      navigationParams,
                      matchId: currentMatch.matchId,
                      userId
                    });
                    
                    // Navigate to chat screen with validated params
                    navigation.navigate('Chat', navigationParams);
                  } catch (navError) {
                    console.error('Error navigating to match:', navError);
                    
                    // Log the navigation error
                    remoteLogger.logError(navError, 'HomeScreen.navigateToChat');
                    
                    Alert.alert(
                      'Navigation Error', 
                      'Failed to open chat screen. Please try again.',
                      [{ text: 'OK' }]
                    );
                  }
                });
              } else {
                // If socket is not connected, just try to navigate
                dispatch(setLoading(false));
                
                // Log the socket disconnection issue
                remoteLogger.log('Socket not connected when navigating to match', {
                  matchId: currentMatch.matchId,
                  userId,
                  socketExists: !!socket
                }, remoteLogger.LOG_LEVELS.WARN);
                
                // Prepare navigation params with explicit required fields
                const navigationParams = {
                  matchId: currentMatch.matchId,
                  userId: userId,
                  // Include other match data
                  players: currentMatch.players || [],
                  createdAt: currentMatch.createdAt || Date.now(),
                  // Any other fields from currentMatch
                  ...currentMatch
                };
                
                // Log navigation params for debugging
                console.log('Navigating to Chat with params (no socket):', JSON.stringify(navigationParams));
                
                // Log to remote logger
                remoteLogger.log('Navigating to Chat screen (no socket)', {
                  navigationParams,
                  matchId: currentMatch.matchId,
                  userId
                });
                
                navigation.navigate('Chat', navigationParams);
              }
            } catch (error) {
              dispatch(setLoading(false));
              console.error('Error checking match status:', error);
              
              // Log the error to remote logger
              remoteLogger.logError(error, 'HomeScreen.checkMatchStatus');
              
              Alert.alert(
                'Connection Error', 
                'Failed to verify match status. Please check your connection and try again.',
                [{ text: 'OK' }]
              );
            }
          }}
        >
          <Text style={styles.matchButtonText}>Go to Match</Text>
        </TouchableOpacity>
      )}

      {currentMatch && (
        <TouchableOpacity
          style={[styles.matchButton, { backgroundColor: 'red', marginTop: 8 }]}
          onPress={() => {
            Alert.alert(
              'Leave Match',
              'Are you sure you want to permanently leave this match?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      dispatch(setLoading(true)); // Show loading indicator
                      await leaveMatch(currentMatch.matchId, userId);
                      // Reset navigation state after leaving
                      resetNavigationState();
                      dispatch(setCurrentMatch(null));
                      dispatch(setLoading(false)); // Hide loading indicator
                      Alert.alert('Success', 'You have left the match.');
                    } catch (error) {
                      console.error('Error leaving match:', error);
                      dispatch(setLoading(false)); // Hide loading indicator
                      Alert.alert('Error', 'Failed to leave the match. Please try again.');
                    }
                  }
                }
              ]
            );
          }}
        >
          <Text style={styles.matchButtonText}>Leave Match</Text>
        </TouchableOpacity>
      )}

      {/* Preference selection pickers */}
      <Text style={styles.label}>City</Text>
      <Picker
        selectedValue={city}
        onValueChange={(value) => dispatch(setCity(value))}
        style={styles.picker}
        enabled={!isSearching}
      >
        <Picker.Item label="Choose City" value="choose" />
        <Picker.Item label="Riyadh" value="riyadh" />
        <Picker.Item label="Jeddah" value="jeddah" />
        <Picker.Item label="Khobar" value="khobar" />
        <Picker.Item label="Dahran" value="dahran" />
        <Picker.Item label="Dammam" value="dammam" />
        <Picker.Item label="Madinah" value="madinah" />
      </Picker>

      <Text style={styles.label}>Time</Text>
      <Picker
        selectedValue={time}
        onValueChange={(value) => dispatch(setTime(value))}
        style={styles.picker}
        enabled={!isSearching}
      >
        <Picker.Item label="Choose Time" value="choose" />
        <Picker.Item label="Morning" value="morning" />
        <Picker.Item label="Afternoon" value="afternoon" />
      </Picker>

      <Text style={styles.label}>Game Type</Text>
      <Picker
        selectedValue={game}
        onValueChange={(value) => dispatch(setGame(value))}
        style={styles.picker}
        enabled={!isSearching}
      >
        <Picker.Item label="Choose Game Type" value="choose" />
        <Picker.Item label="Game 1" value="game1" />
        <Picker.Item label="Game 2" value="game2" />
      </Picker>

      {/* Loading state or search button */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Searching for a player...</Text>
          <Text style={styles.loadingText}>
            Search time: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </Text>
          <Button title="Cancel" onPress={cancelSearch} />
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <Button title="Search" onPress={searchMatch} />
        </View>
      )}
      
      {/* Connection status indicator and reconnect button */}
      {connectionStatus === 'reconnect_failed' && (
        <TouchableOpacity
          style={styles.reconnectButton}
          onPress={() => {
            // Attempt manual reconnection
            if (manualReconnect()) {
              Alert.alert('Reconnecting', 'Attempting to reconnect to the server...');
            } else {
              Alert.alert('Error', 'Could not reconnect. Please restart the app.');
            }
          }}
        >
          <Text style={styles.reconnectButtonText}>Reconnect</Text>
        </TouchableOpacity>
      )}
      
      {/* Session rules indicator */}
      <View style={styles.sessionRulesIndicator}>
        <Text style={styles.sessionRulesText}>
          Session timeout: {getSessionTimeouts().inactivityTimeout}
        </Text>
      </View>

      {/* Debug button - always visible for testing */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={() => navigation.navigate('Debug')}
      >
        <Text style={styles.debugButtonText}>Debug Console</Text>
      </TouchableOpacity>
      

    </View>
  );
};

/**
 * Styles for the HomeScreen component
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userId: {
    color: 'black',
    fontSize: 16,
  },
  connectionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  connectionStatusText: {
    fontSize: 14,
    color: 'black',
  },
  matchButton: {
    padding: 10,
    backgroundColor: 'blue',
    marginBottom: 16,
    alignItems: 'center',
    borderRadius: 5,
  },
  matchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  testButton: {
    padding: 10,
    marginBottom: 16,
    alignItems: 'center',
    borderRadius: 5,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  label: {
    color: 'black',
    fontSize: 18,
    marginVertical: 8,
  },
  picker: {
    color: 'black',
    height: 50,
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    color: 'black',
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 16,
  },
  debugButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  debugButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  sessionRulesIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sessionRulesText: {
    color: '#495057',
    fontSize: 12,
  },
  sessionRulesBanner: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 15,
    alignItems: 'center',
  },
  sessionRulesBannerText: {
    color: '#495057',
    fontSize: 14,
    fontWeight: '500',
  },
  reconnectButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  reconnectButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default HomeScreen;