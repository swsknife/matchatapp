/**
 * ModernMessageBubble.js
 * 
 * A modern message bubble component with animations, status indicators, and reactions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  interpolate
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const ModernMessageBubble = ({
  message,
  isOwn = false,
  showAvatar = false,
  avatar = null,
  onLongPress = null,
  onPress = null,
  showTimestamp = true,
  showStatus = true,
  animated = true,
  style = {},
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
        delay: 50,
      });
      opacity.value = withTiming(1, {
        duration: 300,
        delay: 50,
      });
    } else {
      scale.value = 1;
      opacity.value = 1;
    }
  }, [animated]);

  const handlePressIn = () => {
    setIsPressed(true);
    pressScale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 300,
    });
    
    if (onLongPress || onPress) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
    pressScale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePress = () => {
    if (onPress) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      onPress(message);
    }
  };

  const handleLongPress = () => {
    if (onLongPress) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
      onLongPress(message);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pressScale.value }
    ],
    opacity: opacity.value,
  }));

  const getStatusIcon = (status, offlineRecipient) => {
    if (offlineRecipient) {
      return '🕒';
    }
    
    switch (status) {
      case 'pending':
        return '🕒';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      default:
        return '✓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#9CA3AF';
      case 'sent':
        return '#9CA3AF';
      case 'delivered':
        return '#9CA3AF';
      case 'read':
        return '#4FC3F7';
      default:
        return '#9CA3AF';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getBubbleStyles = () => {
    const baseStyle = [styles.bubble];
    
    if (isOwn) {
      baseStyle.push(styles.ownBubble);
    } else {
      baseStyle.push(styles.otherBubble);
    }
    
    return baseStyle;
  };

  const renderBubbleContent = () => (
    <View style={styles.bubbleContent}>
      <Text style={[
        styles.messageText,
        isOwn ? styles.ownMessageText : styles.otherMessageText
      ]}>
        {message.text}
      </Text>
      
      <View style={styles.messageFooter}>
        {showTimestamp && (
          <Text style={[
            styles.timestampText,
            isOwn ? styles.ownTimestampText : styles.otherTimestampText
          ]}>
            {formatTime(message.timestamp)}
          </Text>
        )}
        
        {showStatus && isOwn && (
          <View style={styles.statusContainer}>
            <Text 
              style={[
                styles.statusIcon,
                { color: getStatusColor(message.status) }
              ]}
            >
              {getStatusIcon(message.status, message.offlineRecipient)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const MessageContainer = onPress || onLongPress ? Pressable : View;

  return (
    <Animated.View style={[styles.container, animatedStyle, style]} {...props}>
      <View style={[
        styles.messageContainer,
        isOwn ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwn && showAvatar && (
          <View style={styles.avatarContainer}>
            {avatar || <View style={styles.defaultAvatar} />}
          </View>
        )}
        
        <MessageContainer
          style={getBubbleStyles()}
          onPressIn={onPress || onLongPress ? handlePressIn : undefined}
          onPressOut={onPress || onLongPress ? handlePressOut : undefined}
          onPress={onPress ? handlePress : undefined}
          onLongPress={onLongPress ? handleLongPress : undefined}
          delayLongPress={500}
        >
          {isOwn ? (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              {renderBubbleContent()}
            </LinearGradient>
          ) : (
            renderBubbleContent()
          )}
        </MessageContainer>
        
        {isOwn && showAvatar && (
          <View style={styles.avatarContainer}>
            {avatar || <View style={styles.defaultAvatar} />}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  
  // Avatar
  avatarContainer: {
    width: 32,
    height: 32,
    marginHorizontal: 8,
  },
  defaultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  
  // Bubble
  bubble: {
    maxWidth: width * 0.75,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  
  // Gradient for own messages
  gradient: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  
  // Content
  bubbleContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#111827',
  },
  
  // Footer
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestampText: {
    fontSize: 11,
    opacity: 0.7,
  },
  ownTimestampText: {
    color: '#FFFFFF',
  },
  otherTimestampText: {
    color: '#6B7280',
  },
  
  // Status
  statusContainer: {
    marginLeft: 8,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ModernMessageBubble;