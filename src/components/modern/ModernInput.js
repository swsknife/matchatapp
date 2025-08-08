/**
 * ModernInput.js
 * 
 * A modern input component with floating labels, animations, and validation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  interpolateColor
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const ModernInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  variant = 'outline', // outline, filled, underline
  size = 'medium', // small, medium, large
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  leftIcon = null,
  rightIcon = null,
  onRightIconPress = null,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  style = {},
  inputStyle = {},
  labelStyle = {},
  errorStyle = {},
  helperStyle = {},
  focusedColor = '#667eea',
  errorColor = '#ff6b6b',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  const focusAnimation = useSharedValue(0);
  const labelAnimation = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    labelAnimation.value = withTiming(value || isFocused ? 1 : 0, {
      duration: 200,
    });
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    focusAnimation.value = withTiming(1, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnimation.value = withTiming(0, { duration: 200 });
  };

  const handleLabelPress = () => {
    inputRef.current?.focus();
  };

  const getContainerStyles = () => {
    const baseStyle = [styles.container, styles[size]];
    
    switch (variant) {
      case 'filled':
        baseStyle.push(styles.filled);
        break;
      case 'underline':
        baseStyle.push(styles.underline);
        break;
      default:
        baseStyle.push(styles.outline);
    }
    
    if (error) {
      baseStyle.push(styles.errorContainer);
    } else if (isFocused) {
      baseStyle.push(styles.focusedContainer);
    }
    
    if (disabled) {
      baseStyle.push(styles.disabledContainer);
    }
    
    return [...baseStyle, style];
  };

  const getInputStyles = () => {
    const baseStyle = [styles.input, styles[`${size}Input`]];
    
    if (leftIcon) {
      baseStyle.push(styles.inputWithLeftIcon);
    }
    
    if (rightIcon) {
      baseStyle.push(styles.inputWithRightIcon);
    }
    
    if (multiline) {
      baseStyle.push(styles.multilineInput);
    }
    
    return [...baseStyle, inputStyle];
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = error 
      ? errorColor
      : interpolateColor(
          focusAnimation.value,
          [0, 1],
          ['#E5E7EB', focusedColor]
        );

    return {
      borderColor,
      borderWidth: variant === 'underline' ? 0 : interpolate(
        focusAnimation.value,
        [0, 1],
        [1, 2]
      ),
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      labelAnimation.value,
      [0, 1],
      [0, variant === 'filled' ? -25 : -30]
    );
    
    const scale = interpolate(
      labelAnimation.value,
      [0, 1],
      [1, 0.85]
    );
    
    const color = error
      ? errorColor
      : interpolateColor(
          focusAnimation.value,
          [0, 1],
          ['#9CA3AF', focusedColor]
        );

    return {
      transform: [
        { translateY },
        { scale }
      ],
      color,
    };
  });

  const animatedUnderlineStyle = useAnimatedStyle(() => {
    if (variant !== 'underline') return {};
    
    const scaleX = focusAnimation.value;
    const backgroundColor = error ? errorColor : focusedColor;
    
    return {
      transform: [{ scaleX }],
      backgroundColor,
    };
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[getContainerStyles(), animatedContainerStyle]}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <View style={styles.inputWrapper}>
          {label && (
            <TouchableOpacity
              onPress={handleLabelPress}
              style={styles.labelContainer}
              activeOpacity={1}
            >
              <Animated.Text
                style={[
                  styles.label,
                  styles[`${size}Label`],
                  animatedLabelStyle,
                  labelStyle
                ]}
              >
                {label}
              </Animated.Text>
            </TouchableOpacity>
          )}
          
          <TextInput
            ref={inputRef}
            style={getInputStyles()}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={!label ? placeholder : undefined}
            placeholderTextColor="#9CA3AF"
            editable={!disabled}
            multiline={multiline}
            numberOfLines={numberOfLines}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            maxLength={maxLength}
            {...props}
          />
        </View>
        
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
        
        {variant === 'underline' && (
          <Animated.View style={[styles.underline, animatedUnderlineStyle]} />
        )}
      </Animated.View>
      
      {(error || helperText) && (
        <View style={styles.helperContainer}>
          {error ? (
            <Text style={[styles.errorText, errorStyle]}>
              {error}
            </Text>
          ) : (
            <Text style={[styles.helperText, helperStyle]}>
              {helperText}
            </Text>
          )}
          
          {maxLength && (
            <Text style={styles.characterCount}>
              {value?.length || 0}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  
  // Sizes
  small: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
  medium: {
    minHeight: 48,
    paddingHorizontal: 16,
  },
  large: {
    minHeight: 56,
    paddingHorizontal: 20,
  },
  
  // Variants
  outline: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filled: {
    backgroundColor: '#F9FAFB',
    borderWidth: 0,
  },
  underline: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderRadius: 0,
    paddingBottom: 8,
  },
  
  // States
  focusedContainer: {
    // Animated styles applied via animatedContainerStyle
  },
  errorContainer: {
    // Animated styles applied via animatedContainerStyle
  },
  disabledContainer: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  
  // Input wrapper and input
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  smallInput: {
    fontSize: 14,
  },
  mediumInput: {
    fontSize: 16,
  },
  largeInput: {
    fontSize: 18,
  },
  inputWithLeftIcon: {
    marginLeft: 8,
  },
  inputWithRightIcon: {
    marginRight: 8,
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 8,
    paddingBottom: 8,
  },
  
  // Label
  labelContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 16,
    color: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  smallLabel: {
    fontSize: 14,
  },
  mediumLabel: {
    fontSize: 16,
  },
  largeLabel: {
    fontSize: 18,
  },
  
  // Icons
  leftIconContainer: {
    marginRight: 8,
  },
  rightIconContainer: {
    marginLeft: 8,
  },
  
  // Underline (for underline variant)
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#667eea',
    transformOrigin: 'center',
  },
  
  // Helper text and error
  helperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    flex: 1,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
});

export default ModernInput;