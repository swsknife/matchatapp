import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import {
  initializeSocket, sendMessage, onReceiveMessage, onOpponentLeftMatch, joinMatch, onConnectionError,
  onDisconnect, leaveMatch, onMessageDelivered, onMessageRead, offReceiveMessage, offMessageDelivered,
  offMessageRead, offOpponentLeftMatch, offConnectionError, offDisconnect,
} from '../utils/network'; // Updated imports
import ErrorBoundary from '../components/ErrorBoundary';
import { REACT_APP_SERVER_URL } from '@env';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, updateMessageStatus } from '../store/actions';
import { selectMessages } from '../store/selectors';

const ChatScreen = ({ route }) => {
  const { userId, matchId } = route.params;
  const dispatch = useDispatch();
  const messages = useSelector((state) => selectMessages(state, matchId));
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    const setupSocket = async () => {
      const serverUrl = REACT_APP_SERVER_URL;
      initializeSocket(serverUrl);

      await joinMatch(matchId, userId);
      setIsLoading(false);

      const handleReceiveMessage = (newMessage) => {
        dispatch(addMessage(matchId, newMessage));
      };

      const handleMessageDelivered = (messageId) => {
        dispatch(updateMessageStatus(matchId, messageId, 'delivered'));
      };

      const handleMessageRead = (messageId) => {
        dispatch(updateMessageStatus(matchId, messageId, 'read'));
      };

      const handleOpponentLeftMatch = () => {
        Alert.alert('Opponent Left', 'Your opponent has left the match.');
      };

      const handleConnectionError = (error) => {
        Alert.alert('Connection Error', 'Unable to connect to the server.');
      };

      const handleDisconnect = (reason) => {
        Alert.alert('Disconnected', 'You have been disconnected from the server.');
      };

      onReceiveMessage(handleReceiveMessage);
      onMessageDelivered(handleMessageDelivered);
      onMessageRead(handleMessageRead);
      onOpponentLeftMatch(handleOpponentLeftMatch);
      onConnectionError(handleConnectionError);
      onDisconnect(handleDisconnect);

      // Clean up event listeners when the component unmounts
      return () => {
        leaveMatch(matchId, userId, () => {
          console.log('Left match successfully.');
        });

        offReceiveMessage(handleReceiveMessage);
        offMessageDelivered(handleMessageDelivered);
        offMessageRead(handleMessageRead);
        offOpponentLeftMatch(handleOpponentLeftMatch);
        offConnectionError(handleConnectionError);
        offDisconnect(handleDisconnect);
      };
    };

    setupSocket();
  }, []);

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleSendMessage = () => {
    if (message.trim() !== '') {
      const newMessage = {
        id: Date.now().toString(),
        sender: userId,
        text: message,
        timestamp: new Date().getTime(),
        status: 'sent',
      };

      setMessage('');

      sendMessage(newMessage, matchId, (response) => {
        if (response && response.error) {
          Alert.alert('Error', 'Failed to send message.');
        } else {
          dispatch(addMessage(matchId, newMessage));
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }
      });
    }
  };

  const renderMessage = ({ item }) => {
    const getIconColor = (status) => {
      switch (status) {
        case 'sent':
          return 'gray';
        case 'delivered':
          return 'yellow';
        case 'read':
          return 'blue';
        default:
          return 'gray';
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
        <Text style={styles.timestampText}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })}
        </Text>
        {item.sender === userId && (
          <View style={[styles.statusIcon, { backgroundColor: getIconColor(item.status) }]} />
        )}
      </View>
    );
  };

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 70}
      >
        <View style={styles.container}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <>
              <Text style={styles.matchIdText}>Match ID: {matchId || ''}</Text>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id.toString()}
                onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: true })}
              />
            </>
          )}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor="black"
              onChangeText={setMessage}
              value={message}
              onSubmitEditing={handleSendMessage}
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
};

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
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#ECECEC',
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
  timestampText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 0,
    right: 5,
  },
});

export default ChatScreen;
