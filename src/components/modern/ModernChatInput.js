/**
 * ModernChatInput.js
 * 
 * A modern chat input component with animations, typing indicators, and send button
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Keyboard,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const ModernChatInput = ({
  value,
  onChangeText,
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  maxLength = 1000,
  multiline = true,
  sendIcon = null,
  leftIcon = null,
  onLeftIconPress = null,
  showCharacterCount = false,
  autoFocus = false,
  style = {},
  inputStyle = {},
  sendButtonStyle = {},
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState(40);
  const inputRef = useRef(null);
  
  const focusAnimation = useSharedValue(0);
  const sendButtonScale = useSharedValue(0.8);
  const sendButtonOpacity = useSharedValue(0.5);

  useEffect(() => {
    const hasText = value && value.trim().length > 0;
    
    sendButtonScale.value = withSpring(hasText ? 1 : 0.8, {
      damping: 15,
      stiffness: 300,
    });
    
    sendButtonOpacity.value = withTiming(hasText ? 1 : 0.5, {
      duration: 200,
    });
  }, [value]);

  useEffect(() => {
    focusAnimation.value = withTiming(isFocused ? 1 : 0, {
      duration: 200,
    });
  }, [isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleSend = () => {
    if (!value || !value.trim() || disabled) return;
    
    runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    onSend && onSend(value.trim());
  };

  const handleContentSizeChange = (event) => {
    const { height } = event.nativeEvent.contentSize;
    const newHeight = Math.max(40, Math.min(120, height));
    setInputHeight(newHeight);
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolate(
      focusAnimation.value,
      [0, 1],
      [0.2, 0.4]
    );

    return {
      borderColor: `rgba(103, 126, 234, ${borderColor})`,
      shadowOpacity: interpolate(
        focusAnimation.value,
        [0, 1],
        [0.1, 0.2]
      ),
    };
  });

  const animatedSendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
    opacity: sendButtonOpacity.value,
  }));

  const canSend = value && value.trim().length > 0 && !disabled;

  const renderSendButton = () => (
    <Animated.View style={[styles.sendButtonContainer, animatedSendButtonStyle]}>
      <TouchableOpacity
        style={[styles.sendButton, sendButtonStyle]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={canSend ? ['#667eea', '#764ba2'] : ['#E5E7EB', '#D1D5DB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendButtonGradient}
        >
          {sendIcon || (
            <View style={styles.defaultSendIcon}>
              <View style={styles.sendArrow} />
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <Animated.View style={[styles.container, animatedContainerStyle, style]}>
      <View style={styles.inputContainer}>
        {leftIcon && (
          <TouchableOpacity
            style={styles.leftIconContainer}
            onPress={onLeftIconPress}
            disabled={!onLeftIconPress}
          >
            {leftIcon}
          </TouchableOpacity>
        )}
        
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              { height: Math.max(40, inputHeight) },
              inputStyle
            ]}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onContentSizeChange={handleContentSizeChange}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline={multiline}
            maxLength={maxLength}
            editable={!disabled}
            autoFocus={autoFocus}
            textAlignVertical="top"
            {...props}
          />
          
          {showCharacterCount && (
            <View style={styles.characterCountContainer}>
              <Text style={[
                styles.characterCount,
                value?.length >= maxLength * 0.9 && styles.characterCountWarning
              ]}>
                {value?.length || 0}/{maxLength}
              </Text>
            </View>
          )}
        </View>
        
        {renderSendButton()}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(103, 126, 234, 0.2)',
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 56,
  },
  
  // Left icon
  leftIconContainer: {
    marginRight: 12,
    marginBottom: 8,
  },
  
  // Input wrapper and input
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 20,
    paddingVertical: 8,
    paddingHorizontal: 0,
    maxHeight: 120,
  },
  
  // Character count
  characterCountContainer: {
    position: 'absolute',
    bottom: -20,
    right: 0,
  },
  characterCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  characterCountWarning: {
    color: '#F59E0B',
  },
  
  // Send button
  sendButtonContainer: {
    marginLeft: 12,
    marginBottom: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Default send icon
  defaultSendIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 0,
    borderBottomWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: '#FFFFFF',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    marginLeft: 2,
  },
});

export default ModernChatInput;