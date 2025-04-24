/**
 * ErrorBoundary.js
 * 
 * This component catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 * 
 * Error boundaries are React components that catch JavaScript errors anywhere in their
 * child component tree, log those errors, and display a fallback UI instead of the
 * component tree that crashed.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * ErrorBoundary component that catches errors in its children
 * and prevents the entire app from crashing
 */
class ErrorBoundary extends React.Component {
  /**
   * Initialize component state
   * @param {Object} props - Component props
   */
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Update state when an error occurs
   * This is called during the "render" phase, so side-effects are not permitted
   * 
   * @param {Error} error - The error that was thrown
   * @returns {Object} Updated state object
   */
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  /**
   * Log error information when a component error occurs
   * This is called during the "commit" phase, so side-effects are permitted
   * 
   * @param {Error} error - The error that was thrown
   * @param {Object} errorInfo - Component stack information
   */
  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  /**
   * Render either the children or the fallback UI
   * @returns {React.ReactNode} The rendered component
   */
  render() {
    if (this.state.hasError) {
      // Render fallback UI when an error occurs
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>Something went wrong.</Text>
          <Text style={styles.subText}>The application encountered an unexpected error.</Text>
        </View>
      );
    }

    // When there's no error, render children normally
    return this.props.children; 
  }
}

/**
 * Styles for the error fallback UI
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
  },
  subText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default ErrorBoundary;
