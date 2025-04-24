/**
 * ChatScreen.js
 * 
 * This component handles the real-time chat interface between matched users.
 * It manages socket connections, message sending/receiving, and UI states for
 * active/inactive matches.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Keyboard, BackHandler, AppState
} from 'react-native';
import {
  initializeSocket, sendMessage, onReceiveMessage, onOpponentLeftMatch, joinMatch, onConnectionError,
  onDisconnect, onMessageDelivered, onMessageRead, getSocketInstance, navigatingAway, markMessageAsRead
} from '../utils/network';
import ErrorBoundary from '../components/ErrorBoundary';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, updateMessageStatus, setMessages } from '../store/actions';
import { selectMessages } from '../store/selectors';
import { getMessages, generateMessageId } from '../services/storageService';
import { handleStorageError, handleNetworkError, ERROR_SEVERITY } from '../utils/errorHandling';
import { useFocusEffect } from '@react-navigation/native';

/**
 * ChatScreen Component
 * 
 * Provides a real-time messaging interface for users who have been matched.
 * Features include:
 * - Real-time message exchange
 * - Message status indicators (sent, delivered, read)
 * - Offline message storage
 * - Match status management
 * - Keyboard handling and auto-scrolling
 * 
 * @param {Object} route - React Navigation route object containing matchId and userId
 * @param {Object} navigation - React Navigation navigation object
 */
const ChatScreen = ({ route, navigation }) => {
  // Extract parameters from navigation
  const { userId, matchId } = route.params;
  
  // Redux hooks
  const dispatch = useDispatch();
  const messages = useSelector((state) => selectMessages(state, matchId));
  
  // Component state
  const [message, setMessage] = useState(''); // Current message being typed
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial connection
  const [isMatchActive, setIsMatchActive] = useState(true); // Whether the match is still active
  
  // Refs
  const hasJoinedRef = useRef(false); // Track if we've joined the match room
  const flatListRef = useRef(null); // Reference to the message list for scrolling
  const pendingMessagesRef = useRef([]); // Queue for messages that couldn't be sent
  const hasShownOfflineWarningRef = useRef(false); // Track if we've shown the offline warning
  const isNavigatingRef = useRef(false); // Track if we're currently navigating to prevent duplicate navigation

  /**
   * Handle screen focus and blur events with React Navigation
   * When screen is focused, join the match room if needed
   * When screen is blurred, notify server we're navigating away
   */
  useFocusEffect(
    React.useCallback(() => {
      console.log('Chat screen focused');
      
      // Track if this is a return to an existing match
      const isReturningToMatch = hasJoinedRef.current;
      
      // Join match if we haven't already or if we're returning to it
      if (!isLoading) {
        if (!hasJoinedRef.current) {
          console.log('Joining match for the first time');
          joinMatch(matchId, userId, (response) => {
            if (response && response.error) {
              console.error('Error joining match:', response.error);
              Alert.alert('Error', 'Failed to join the match. Please try again.');
              navigation.goBack();
            } else {
              hasJoinedRef.current = true;
            }
          });
        } else {
          console.log('Returning to existing match');
          // Notify server we're back in the match
          navigatingBack(matchId);
        }
      }
      
      return () => {
        console.log('Chat screen blurred');
        // Only emit navigating away if the match is still active
        if (isMatchActive) {
          try {
            navigatingAway(matchId);
          } catch (error) {
            console.error('Error navigating away:', error);
          }
        }
      };
    }, [matchId, userId, isLoading, isMatchActive, navigation])
  );

  /**
   * Handle Android back button press
   * Notify server we're navigating away and return to home screen
   */
  useEffect(() => {
    const backAction = () => {
      console.log('Back button pressed, navigating away');
      
      // Prevent rapid back button presses and set a flag to avoid duplicate navigation
      if (isMatchActive && !isNavigatingRef.current) {
        isNavigatingRef.current = true;
        
        try {
          // Create a promise that resolves when navigation is complete or times out
          const navigatePromise = new Promise((resolve) => {
            // Send navigation event to server
            const socket = getSocketInstance();
            if (socket && socket.connected) {
              socket.emit("navigatingAway", { matchId }, () => {
                console.log('Server acknowledged navigation event');
                resolve();
              });
              
              // Set a timeout in case the server doesn't respond
              setTimeout(resolve, 300);
            } else {
              // If socket is not connected, resolve immediately
              resolve();
            }
          });
          
          // Wait for navigation event to be sent before navigating
          navigatePromise.then(() => {
            navigation.goBack();
            // Reset the flag after navigation
            setTimeout(() => {
              isNavigatingRef.current = false;
            }, 500);
          });
        } catch (error) {
          console.error('Error when navigating away:', error);
          // Continue with navigation even if the event fails
          navigation.goBack();
          // Reset the flag after navigation
          setTimeout(() => {
            isNavigatingRef.current = false;
          }, 500);
        }
      } else if (!isMatchActive) {
        // If match is not active, just navigate back
        navigation.goBack();
      }
      
      return true; // Prevents default back behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [navigation, matchId, isMatchActive]);

  /**
   * Main socket setup effect
   * Initializes socket connection and sets up all event listeners
   */
  useEffect(() => {
    let cleanupFunctions = [];
    
    const setupSocket = async () => {
      try {
        // Initialize socket with a timeout of 20 seconds
        await initializeSocket(20000).catch(error => {
          console.error("Failed to initialize socket in ChatScreen:", error);
          throw new Error(`Socket connection failed: ${error.message}`);
        });
        
        const socket = getSocketInstance();
        
        if (!socket) {
          throw new Error("Socket initialization failed - no socket instance returned");
        }

        // IMPORTANT: Register matchEnded handler FIRST before any other operations
        const handleMatchEnded = (data) => {
          console.log('Match ended event received:', data);
          setIsMatchActive(false);
          
          // Remove message-related listeners to prevent sending to ended match
          socket.off('receiveMessage');
          socket.off('messageDelivered');
          socket.off('messageRead');
          
          Alert.alert('Match Ended', data.message || 'This match has ended.', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        };
        
        // Use socket.on with cleanup instead of socket.once with duplicate cleanup
        socket.on('matchEnded', handleMatchEnded);
        cleanupFunctions.push(() => socket.off('matchEnded', handleMatchEnded));

        // Join the match if not already joined
        if (!hasJoinedRef.current) {
          await joinMatch(matchId, userId);
          hasJoinedRef.current = true;
        }
        
        setIsLoading(false);

        // Message handlers
        const handleReceiveMessage = (newMessage) => {
          console.log("Received message:", newMessage);
          dispatch(addMessage(matchId, newMessage));
          
          // If the message is from the other user and the chat screen is in focus, mark it as read
          if (newMessage.sender !== userId) {
            // Check if app is in foreground and this screen is focused before marking as read
            const appState = AppState.currentState;
            const isFocused = navigation.isFocused();
            
            console.log(`App state: ${appState}, Screen focused: ${isFocused}`);
            
            if (appState === 'active' && isFocused) {
              console.log("Marking message as read:", newMessage.id);
              
              // Try to mark as read, with retry mechanism
              const markAsRead = () => {
                const socket = getSocketInstance();
                if (socket && socket.connected) {
                  markMessageAsRead(newMessage.id, matchId);
                } else {
                  console.warn("Socket not connected, will retry marking message as read");
                  // Retry after a short delay
                  setTimeout(markAsRead, 2000);
                }
              };
              
              markAsRead();
            } else {
              console.log("Screen not focused or app in background. Message will be marked as read when user views it.");
            }
          }
        };

        const handleMessageDelivered = (messageId) => {
          dispatch(updateMessageStatus(matchId, messageId, 'delivered'));
        };

        const handleMessageRead = (data) => {
          // Check if we have the new format (object with messageId) or old format (just messageId)
          const messageId = typeof data === 'object' ? data.messageId : data;
          
          if (!messageId) {
            console.error('Invalid messageRead data received:', data);
            return;
          }
          
          console.log('Message marked as read:', messageId);
          dispatch(updateMessageStatus(matchId, messageId, 'read'));
          
          // If we have additional data, log it
          if (typeof data === 'object' && data.userId) {
            console.log(`Message ${messageId} was read by user ${data.userId}`);
          }
        };

        // User status handlers
        const handleOpponentLeftMatch = (data) => {
          console.log('Opponent left match event received:', data);
          setIsMatchActive(false);
          
          // Check if we have opponent data to personalize the message
          let message = 'Your opponent has left the match.';
          if (data && data.userId) {
            message = `User ${data.userId.substring(0, 8)}... has left the match.`;
          }
          
          Alert.alert('Opponent Left', message, [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        };

        // Connection handlers with standardized error handling
        const handleConnectionError = (error) => {
          handleNetworkError(error, {
            severity: ERROR_SEVERITY.ERROR,
            showAlert: true,
            alertTitle: 'Connection Error',
            alertMessage: 'Unable to connect to the server. Please check your internet connection.',
            onContinue: () => {
              // Provide option to retry or go back
              Alert.alert(
                'Connection Options',
                'Would you like to retry connecting or go back?',
                [
                  { 
                    text: 'Retry', 
                    onPress: () => setupSocket() 
                  },
                  { 
                    text: 'Go Back', 
                    style: 'cancel',
                    onPress: () => navigation.goBack() 
                  }
                ]
              );
            }
          });
        };

        const handleDisconnect = (reason) => {
          // Use standardized error handling
          handleNetworkError(`Socket disconnected. Reason: ${reason}`, {
            severity: reason === 'io server disconnect' || reason === 'transport close' 
              ? ERROR_SEVERITY.ERROR 
              : ERROR_SEVERITY.WARNING,
            // Only show alert for permanent disconnections
            showAlert: reason === 'io server disconnect' || reason === 'transport close',
            alertTitle: 'Disconnected',
            alertMessage: 'You have been disconnected from the server. The match may have ended.',
            onContinue: () => navigation.goBack()
          });
        };
        
        // Handle reconnection - process any pending messages
        const handleReconnect = (attemptNumber) => {
          console.log(`Socket reconnected after ${attemptNumber} attempts`);
          
          // Process any pending messages
          if (pendingMessagesRef.current.length > 0) {
            console.log(`Processing ${pendingMessagesRef.current.length} pending messages`);
            
            // Create a copy of the queue and clear it
            const messagesToSend = [...pendingMessagesRef.current];
            pendingMessagesRef.current = [];
            
            // Send each message
            messagesToSend.forEach(pendingMessage => {
              console.log('Sending pending message:', pendingMessage.id);
              sendMessage(pendingMessage, matchId, (response) => {
                if (response && response.error) {
                  console.error('Failed to send pending message:', response.error);
                  // If still recoverable, add back to queue
                  if (response.recoverable) {
                    pendingMessagesRef.current.push(pendingMessage);
                  }
                } else {
                  console.log('Pending message sent successfully:', pendingMessage.id);
                  // Update message status in Redux
                  dispatch(updateMessageStatus(matchId, pendingMessage.id, 'sent'));
                }
              });
            });
          }
        };

        // Only register cleanups if socket is successfully initialized
        if (socket) {
          cleanupFunctions.push(onReceiveMessage(handleReceiveMessage));
          cleanupFunctions.push(onMessageDelivered(handleMessageDelivered));
          cleanupFunctions.push(onMessageRead(handleMessageRead));
          cleanupFunctions.push(onOpponentLeftMatch(handleOpponentLeftMatch));
          cleanupFunctions.push(onConnectionError(handleConnectionError));
          cleanupFunctions.push(onDisconnect(handleDisconnect));
          
          // Register reconnect handler
          socket.on('reconnect', handleReconnect);
          cleanupFunctions.push(() => socket.off('reconnect', handleReconnect));
        }
      } catch (error) {
        // Determine error type and message
        let errorMessage = 'Failed to connect to the server. Please check your internet connection.';
        let severity = ERROR_SEVERITY.ERROR;
        
        if (error.message && error.message.includes('timeout')) {
          errorMessage = 'Connection timed out. The server might be busy or unreachable.';
          severity = ERROR_SEVERITY.ERROR;
        } else if (error.message && error.message.includes('disconnected')) {
          errorMessage = 'Connection was lost. Please check your internet connection and try again.';
          severity = ERROR_SEVERITY.ERROR;
        }
        
        // Use standardized error handling
        handleNetworkError(error, {
          severity: severity,
          showAlert: true,
          alertTitle: 'Connection Error',
          alertMessage: errorMessage,
          onContinue: () => {
            // Show options dialog after the error alert
            Alert.alert(
              'Connection Options', 
              'Would you like to retry connecting or go back?',
              [
                { 
                  text: 'Retry', 
                  onPress: () => {
                    console.log('Retrying socket connection...');
                    setupSocket();
                  } 
                },
                { 
                  text: 'Go Back', 
                  style: 'cancel',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        });
        
        setIsLoading(false); // Ensure loading state is updated even on error
      }
    };

    setupSocket();

    // Clean up event listeners when the component unmounts
    return () => {
      console.log('ChatScreen unmounting');
      
      // Notify server we're navigating away if match is still active
      if (isMatchActive) {
        try {
          navigatingAway(matchId);
        } catch (error) {
          console.error('Error while navigating away:', error);
        }
      }
      
      // Call all cleanup functions with error handling
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          try {
            cleanup();
          } catch (error) {
            console.error('Error during cleanup function:', error);
          }
        }
      });
      
      // Get socket instance and remove any remaining listeners
      try {
        const socket = getSocketInstance();
        if (socket) {
          socket.off('matchEnded');
          socket.off('receiveMessage');
          socket.off('messageDelivered');
          socket.off('messageRead');
          socket.off('opponentLeftMatch');
          socket.off('playerLeft');
          socket.off('reconnect');
        }
      } catch (error) {
        console.error('Error cleaning up socket listeners:', error);
      }
    };
  }, [matchId, userId, dispatch, navigation]);

  /**
   * Load saved messages using the storage service
   * This allows messages to persist across app restarts
   */
  useEffect(() => {
    const loadMessages = async () => {
      try {
        // Use the storage service to get messages
        const savedMessages = await getMessages(matchId);
        if (savedMessages && savedMessages.length > 0) {
          dispatch(setMessages(matchId, savedMessages));
        }
      } catch (error) {
        // Use standardized error handling
        handleStorageError(error, {
          severity: ERROR_SEVERITY.ERROR,
          showAlert: true,
          alertTitle: 'Message Loading Error',
          alertMessage: 'Failed to load your conversation history. You can continue chatting, but previous messages may not be visible.',
          onContinue: () => {
            // Ensure we can continue even if loading fails
            setIsLoading(false);
          }
        });
      }
    };
    loadMessages();
  }, [matchId, dispatch]);
  
  // Note: We've removed the separate save effect since the addMessage action
  // now handles saving messages through the storage service

  /**
   * Auto-scroll to bottom when messages change
   */
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  /**
   * Handle keyboard showing to scroll to bottom
   */
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      keyboardDidShowListener.remove(); // Properly clean up keyboard listener
    };
  }, []);
  
  /**
   * Handle app state changes to mark messages as read when app comes to foreground
   */
  useEffect(() => {
    // Function to mark all unread messages as read
    const markUnreadMessagesAsRead = () => {
      if (!isMatchActive || !messages || messages.length === 0) return;
      
      // Get all messages from other user that aren't marked as read
      const unreadMessages = messages.filter(
        msg => msg.sender !== userId && msg.status !== 'read'
      );
      
      if (unreadMessages.length > 0) {
        console.log(`Marking ${unreadMessages.length} unread messages as read`);
        
        // Mark each message as read
        unreadMessages.forEach(msg => {
          const socket = getSocketInstance();
          if (socket && socket.connected) {
            markMessageAsRead(msg.id, matchId);
          }
        });
      }
    };
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && navigation.isFocused()) {
        console.log('App has come to the foreground and chat screen is focused');
        markUnreadMessagesAsRead();
      }
    };
    
    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Also mark messages as read when the screen gains focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (AppState.currentState === 'active') {
        console.log('Chat screen gained focus while app is active');
        markUnreadMessagesAsRead();
      }
    });
    
    return () => {
      appStateSubscription.remove();
      unsubscribeFocus();
    };
  }, [matchId, userId, messages, isMatchActive, navigation]);

  /**
   * Send message with error handling
   * Creates a message object, sends it to the server, and updates local state
   */
  const handleSendMessage = () => {
    // Don't send empty messages
    if (message.trim() === '') return;
    
    // Don't allow sending if match has ended
    if (!isMatchActive) {
      Alert.alert('Match Ended', 'You cannot send messages in an ended match.');
      return;
    }
    
    // Create message object with UUID instead of timestamp for ID
    const newMessage = {
      id: generateMessageId(),
      sender: userId,
      text: message,
      timestamp: new Date().getTime(),
      status: 'sent',
    };

    // Clear input field immediately for better UX
    setMessage('');

    // Add message to Redux store immediately with pending status
    const pendingMessage = {...newMessage, status: 'pending'};
    dispatch(addMessage(matchId, pendingMessage));
    
    // Check socket connection before sending
    const socket = getSocketInstance();
    
    if (!socket || !socket.connected) {
      console.log('Socket not connected, queuing message for later delivery');
      // Add to pending messages queue for retry on reconnection
      pendingMessagesRef.current.push(newMessage);
      
      // Update message status to pending in Redux
      const pendingMessage = {...newMessage, status: 'pending', offlineRecipient: true};
      dispatch(addMessage(matchId, pendingMessage));
      
      // Show a non-blocking notification
      Alert.alert(
        'Connection Issue', 
        'You appear to be offline. Your message will be sent when connection is restored.',
        [{ text: 'OK' }]
      );
      
      // Set up a one-time reconnect handler to send all pending messages
      if (socket) {
        socket.once('connect', () => {
          console.log('Socket reconnected, sending pending messages');
          if (pendingMessagesRef.current.length > 0) {
            // Process pending messages
            const messagesToSend = [...pendingMessagesRef.current];
            pendingMessagesRef.current = [];
            
            messagesToSend.forEach(pendingMsg => {
              sendMessage(pendingMsg, matchId, (response) => {
                if (!response || !response.error) {
                  console.log('Pending message sent successfully:', pendingMsg.id);
                  dispatch(updateMessageStatus(matchId, pendingMsg.id, 'sent'));
                }
              });
            });
          }
        });
      }
      
      return;
    }
    
    // Socket is connected, send message immediately
    sendMessage(newMessage, matchId, (response) => {
      if (response && response.error) {
        // Handle different error cases
        if (response.recoverable) {
          // For recoverable errors like temporary disconnection
          console.log('Recoverable error while sending message:', response.error);
          
          // Add to pending messages queue for retry on reconnection
          pendingMessagesRef.current.push(newMessage);
          
          // Update message status in Redux
          dispatch(updateMessageStatus(matchId, newMessage.id, 'pending'));
          
          // Show a non-blocking notification
          Alert.alert('Connection Issue', response.message || 'Message will be sent when connection is restored.');
        } else {
          // For non-recoverable errors like match ended
          console.error('Non-recoverable error while sending message:', response.error);
          setIsMatchActive(false);
          Alert.alert('Error', 'Failed to send message. The match may have ended.');
        }
      } else {
        // Success case - update message status in Redux
        
        // Check if there's a warning about offline players
        if (response && response.warning) {
          console.log('Message sent with warning:', response.warning);
          
          // Update message status if other player is offline
          if (response.playersActive < 2) {
            dispatch(updateMessageStatus(matchId, newMessage.id, 'delivered'));
            // Mark message as sent to offline recipient
            const updatedMessage = {...newMessage, status: 'delivered', offlineRecipient: true};
            dispatch(addMessage(matchId, updatedMessage));
            
            // Show a non-blocking notification (only first time)
            if (!hasShownOfflineWarningRef.current) {
              Alert.alert(
                'Message Sent', 
                'Your message was sent, but the other player appears to be offline and may not see it immediately.',
                [{ text: 'OK' }]
              );
              hasShownOfflineWarningRef.current = true;
            }
          } else {
            dispatch(updateMessageStatus(matchId, newMessage.id, 'sent'));
          }
        } else {
          // Normal success case
          dispatch(updateMessageStatus(matchId, newMessage.id, 'sent'));
        }
        
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }
    });
  };

  /**
   * Render a single message item
   * @param {Object} item - The message object to render
   */
  const renderMessage = ({ item }) => {
    // Get status icon for WhatsApp-style message status indicators
    const getStatusIcon = (status, offlineRecipient) => {
      if (offlineRecipient) {
        return '🕒'; // Clock icon for offline recipient (message queued)
      }
      
      switch (status) {
        case 'pending':
          return '🕒'; // Clock icon for pending/unsent messages
        case 'sent':
          return '✓'; // Single checkmark for sent to server
        case 'delivered':
          return '✓✓'; // Double gray checkmarks for delivered to recipient
        case 'read':
          return '✓✓'; // Double blue checkmarks for read by recipient (color handled in style)
        default:
          return '✓';
      }
    };
    
    // Get color for message status indicator
    const getStatusColor = (status) => {
      switch (status) {
        case 'pending':
          return '#888888'; // Gray for pending
        case 'sent':
          return '#888888'; // Gray for sent
        case 'delivered':
          return '#888888'; // Gray for delivered
        case 'read':
          return '#4FC3F7'; // Light blue for read (WhatsApp style)
        default:
          return '#888888';
      }
    };
    
    // Get status text for accessibility and tooltip
    const getStatusText = (status, offlineRecipient) => {
      if (offlineRecipient) {
        return 'Waiting to send (recipient offline)';
      }
      
      switch (status) {
        case 'pending':
          return 'Sending...';
        case 'sent':
          return 'Sent to server';
        case 'delivered':
          return 'Delivered to recipient';
        case 'read':
          return 'Read by recipient';
        default:
          return '';
      }
    };

    return (
      <View
        style={[
          styles.messageContainer,
          item.sender === userId ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            item.sender === userId ? styles.myMessageText : styles.otherMessageText,
          ]}
        >
          {item.text || ''}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestampText}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
          
          {/* WhatsApp-style status indicators only shown for sent messages */}
          {item.sender === userId && (
            <View style={styles.statusContainer}>
              <Text 
                style={[
                  styles.statusIcon, 
                  { color: getStatusColor(item.status) }
                ]}
                accessibilityLabel={getStatusText(item.status, item.offlineRecipient)}
              >
                {getStatusIcon(item.status, item.offlineRecipient)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  /**
   * Main render method
   * Handles three states:
   * 1. Loading - Shows spinner while connecting
   * 2. Match Ended - Shows inactive state with back button
   * 3. Active Match - Shows message list and input field
   */
  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
      >
        <View style={styles.container}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : !isMatchActive ? (
            <View style={styles.inactiveContainer}>
              <Text style={styles.inactiveText}>This match has ended</Text>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.matchIdText}>Match ID: {matchId || ''}</Text>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id.toString()}
                onContentSizeChange={() => {
                  if (flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: true });
                  }
                }}
              />
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, !isMatchActive && styles.disabledInput]}
                  placeholder="Type your message..."
                  placeholderTextColor="black"
                  onChangeText={setMessage}
                  value={message}
                  onSubmitEditing={handleSendMessage}
                  blurOnSubmit={false}
                  editable={isMatchActive}
                />
                <TouchableOpacity 
                  style={[styles.sendButton, !isMatchActive && styles.disabledButton]} 
                  onPress={handleSendMessage}
                  disabled={!isMatchActive}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
};

/**
 * Styles for the ChatScreen component
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  matchIdText: {
    textAlign: 'center',
    marginVertical: 10,
  },
  messageContainer: {
    margin: 10,
    padding: 10,
    borderRadius: 10,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#DCF8C6', // Light green for user's messages
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#ECECEC', // Light gray for other's messages
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#000',
  },
  otherMessageText: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  timestampText: {
    fontSize: 12,
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EEE',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#000',
  },
  disabledInput: {
    backgroundColor: '#F0F0F0',
    color: '#999',
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  sendButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  inactiveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  inactiveText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ChatScreen;