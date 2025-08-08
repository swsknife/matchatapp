/**
 * ModernCard.js
 * 
 * A modern card component with shadows, animations, and customizable styling
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const ModernCard = ({
  children,
  onPress,
  style = {},
  variant = 'default', // default, elevated, glass, outline
  padding = 'medium', // none, small, medium, large
  margin = 'none', // none, small, medium, large
  borderRadius = 'medium', // small, medium, large, round
  shadow = true,
  animated = true,
  blurIntensity = 20,
  backgroundColor = '#FFFFFF',
  ...props
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    if (animated && onPress) {
      scale.value = withSpring(0.98, {
        damping: 15,
        stiffness: 300,
      });
    }
  };

  const handlePressOut = () => {
    if (animated && onPress) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
      });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getCardStyles = () => {
    const baseStyle = [styles.card];
    
    // Padding
    baseStyle.push(styles[`${padding}Padding`]);
    
    // Margin
    baseStyle.push(styles[`${margin}Margin`]);
    
    // Border radius
    baseStyle.push(styles[`${borderRadius}Radius`]);
    
    // Variant styles
    switch (variant) {
      case 'elevated':
        baseStyle.push(styles.elevated);
        break;
      case 'glass':
        baseStyle.push(styles.glass);
        break;
      case 'outline':
        baseStyle.push(styles.outline);
        break;
      default:
        baseStyle.push(styles.default);
    }
    
    // Shadow
    if (shadow && variant !== 'glass') {
      baseStyle.push(styles.shadow);
    }
    
    // Background color (only for non-glass variants)
    if (variant !== 'glass') {
      baseStyle.push({ backgroundColor });
    }
    
    return [...baseStyle, style];
  };

  if (variant === 'glass') {
    const CardComponent = onPress ? AnimatedTouchableOpacity : Animated.View;
    
    return (
      <CardComponent
        style={[animatedStyle, getCardStyles()]}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        onPress={onPress}
        activeOpacity={onPress ? 0.9 : 1}
        {...props}
      >
        <BlurView
          intensity={blurIntensity}
          style={[
            StyleSheet.absoluteFillObject,
            styles[`${borderRadius}Radius`]
          ]}
        />
        <View style={styles.glassContent}>
          {children}
        </View>
      </CardComponent>
    );
  }

  if (onPress) {
    return (
      <AnimatedTouchableOpacity
        style={[animatedStyle, getCardStyles()]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
        {...props}
      >
        {children}
      </AnimatedTouchableOpacity>
    );
  }

  return (
    <Animated.View
      style={[animatedStyle, getCardStyles()]}
      {...props}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  
  // Variants
  default: {
    backgroundColor: '#FFFFFF',
  },
  elevated: {
    backgroundColor: '#FFFFFF',
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  
  // Padding
  nonePadding: {
    padding: 0,
  },
  smallPadding: {
    padding: 12,
  },
  mediumPadding: {
    padding: 16,
  },
  largePadding: {
    padding: 24,
  },
  
  // Margin
  noneMargin: {
    margin: 0,
  },
  smallMargin: {
    margin: 8,
  },
  mediumMargin: {
    margin: 16,
  },
  largeMargin: {
    margin: 24,
  },
  
  // Border radius
  smallRadius: {
    borderRadius: 8,
  },
  mediumRadius: {
    borderRadius: 12,
  },
  largeRadius: {
    borderRadius: 16,
  },
  roundRadius: {
    borderRadius: 50,
  },
  
  // Shadow
  shadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  // Elevated variant specific shadow
  elevated: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6.84,
    elevation: 8,
  },
  
  // Glass content wrapper
  glassContent: {
    flex: 1,
  },
});

export default ModernCard;