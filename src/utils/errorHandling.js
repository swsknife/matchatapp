/**
 * errorHandling.js
 * 
 * Centralized error handling utilities for consistent error management across the app.
 * Provides standardized logging, user notifications, and error tracking.
 */

import { Alert } from 'react-native';

// Error categories for better organization and handling
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  STORAGE: 'storage',
  AUTHENTICATION: 'authentication',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

// Error severity levels
export const ERROR_SEVERITY = {
  INFO: 'info',       // Informational, non-critical
  WARNING: 'warning', // Warning, might affect functionality
  ERROR: 'error',     // Error, affects functionality but app can continue
  CRITICAL: 'critical' // Critical, app cannot function properly
};

/**
 * Handles errors in a standardized way across the app
 * 
 * @param {Error|string} error - The error object or message
 * @param {Object} options - Error handling options
 * @param {string} options.category - Error category from ERROR_CATEGORIES
 * @param {string} options.severity - Error severity from ERROR_SEVERITY
 * @param {boolean} options.showAlert - Whether to show an alert to the user
 * @param {string} options.alertTitle - Title for the alert
 * @param {string} options.alertMessage - Message for the alert (defaults to error.message)
 * @param {Function} options.onContinue - Callback for when user dismisses alert
 * @param {boolean} options.silent - If true, only logs the error without user-facing actions
 * @returns {Object} Error information object
 */
export const handleError = (error, options = {}) => {
  const {
    category = ERROR_CATEGORIES.UNKNOWN,
    severity = ERROR_SEVERITY.ERROR,
    showAlert = false,
    alertTitle = 'Error',
    alertMessage = error?.message || String(error),
    onContinue = null,
    silent = false
  } = options;
  
  // Create standardized error object
  const errorInfo = {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    category,
    severity
  };
  
  // Log error based on severity
  switch (severity) {
    case ERROR_SEVERITY.INFO:
      console.log(`[${category.toUpperCase()}] ${errorInfo.message}`);
      break;
    case ERROR_SEVERITY.WARNING:
      console.warn(`[${category.toUpperCase()}] ${errorInfo.message}`);
      break;
    case ERROR_SEVERITY.ERROR:
    case ERROR_SEVERITY.CRITICAL:
      console.error(`[${category.toUpperCase()}] ${errorInfo.message}`, error?.stack);
      break;
    default:
      console.error(`[${category.toUpperCase()}] ${errorInfo.message}`);
  }
  
  // Show alert to user if requested and not silent
  if (showAlert && !silent) {
    Alert.alert(
      alertTitle,
      alertMessage,
      [{ text: 'OK', onPress: onContinue }]
    );
  }
  
  // Here you could add additional error reporting to a service like Sentry
  // if (severity === ERROR_SEVERITY.CRITICAL || severity === ERROR_SEVERITY.ERROR) {
  //   // reportErrorToService(errorInfo);
  // }
  
  return errorInfo;
};

/**
 * Specialized handler for storage-related errors
 * 
 * @param {Error|string} error - The error object or message
 * @param {Object} options - Additional options (see handleError)
 * @returns {Object} Error information object
 */
export const handleStorageError = (error, options = {}) => {
  return handleError(error, {
    category: ERROR_CATEGORIES.STORAGE,
    alertTitle: 'Storage Error',
    ...options
  });
};

/**
 * Specialized handler for network-related errors
 * 
 * @param {Error|string} error - The error object or message
 * @param {Object} options - Additional options (see handleError)
 * @returns {Object} Error information object
 */
export const handleNetworkError = (error, options = {}) => {
  return handleError(error, {
    category: ERROR_CATEGORIES.NETWORK,
    alertTitle: 'Connection Error',
    ...options
  });
};