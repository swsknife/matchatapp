/**
 * remoteLogger.js
 * 
 * A utility for sending logs and crash reports to the server.
 * This allows debugging of production builds without UI modifications.
 */

import { REACT_APP_SERVER_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Constants
const LOG_STORAGE_KEY = '@MatchChatApp:RemoteLogs';
const MAX_STORED_LOGS = 100;
const LOG_BATCH_SIZE = 20;

// Log levels
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
};

/**
 * Create a log entry with device and app information
 * 
 * @param {string} message - Log message
 * @param {Object} data - Additional data to include
 * @param {string} level - Log level
 * @returns {Object} Complete log entry
 */
const createLogEntry = (message, data = {}, level = LOG_LEVELS.INFO) => {
  return {
    timestamp: new Date().toISOString(),
    message,
    data,
    level,
    device: {
      platform: Platform.OS,
      version: Platform.Version,
      model: Platform.constants?.model || 'unknown',
      brand: Platform.constants?.brand || 'unknown',
      isEmulator: Platform.constants?.isEmulator || false
    },
    appState: {
      // Add any global app state that might be useful for debugging
    }
  };
};

/**
 * Store a log entry in AsyncStorage for later sending
 * 
 * @param {Object} logEntry - The log entry to store
 */
const storeLog = async (logEntry) => {
  try {
    // Get existing logs
    const existingLogsJson = await AsyncStorage.getItem(LOG_STORAGE_KEY);
    let logs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
    
    // Add new log
    logs.unshift(logEntry);
    
    // Limit the number of stored logs
    if (logs.length > MAX_STORED_LOGS) {
      logs = logs.slice(0, MAX_STORED_LOGS);
    }
    
    // Save back to storage
    await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to store log entry:', error);
  }
};

/**
 * Send logs to the server
 * 
 * @param {boolean} force - Whether to force sending even if offline
 * @returns {Promise<Object>} Result of the send operation
 */
export const sendLogs = async (force = false) => {
  try {
    // Check network connectivity first
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected && !force) {
      console.log('Not connected to the internet, skipping log upload');
      return { success: false, reason: 'offline' };
    }
    
    // Get stored logs
    const logsJson = await AsyncStorage.getItem(LOG_STORAGE_KEY);
    if (!logsJson) {
      return { success: true, sent: 0 };
    }
    
    const logs = JSON.parse(logsJson);
    if (logs.length === 0) {
      return { success: true, sent: 0 };
    }
    
    // Send logs in batches to avoid large payloads
    const batches = [];
    for (let i = 0; i < logs.length; i += LOG_BATCH_SIZE) {
      batches.push(logs.slice(i, i + LOG_BATCH_SIZE));
    }
    
    let sentCount = 0;
    let failedBatches = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const response = await fetch(`${REACT_APP_SERVER_URL}/api/logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            logs: batch,
            batchIndex: i,
            totalBatches: batches.length
          }),
          timeout: 10000 // 10 second timeout
        });
        
        if (response.ok) {
          sentCount += batch.length;
        } else {
          failedBatches.push(i);
        }
      } catch (error) {
        console.error(`Failed to send log batch ${i}:`, error);
        failedBatches.push(i);
      }
    }
    
    // Remove sent logs from storage
    if (sentCount > 0) {
      // If we sent all logs, clear storage
      if (sentCount === logs.length) {
        await AsyncStorage.removeItem(LOG_STORAGE_KEY);
      } else {
        // Otherwise, keep only the logs that failed to send
        const remainingLogs = [];
        failedBatches.forEach(batchIndex => {
          const start = batchIndex * LOG_BATCH_SIZE;
          const end = Math.min(start + LOG_BATCH_SIZE, logs.length);
          remainingLogs.push(...logs.slice(start, end));
        });
        
        await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(remainingLogs));
      }
    }
    
    return {
      success: true,
      sent: sentCount,
      failed: logs.length - sentCount,
      failedBatches
    };
  } catch (error) {
    console.error('Error sending logs:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Log a message and send it to the server when possible
 * 
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 * @param {string} level - Log level
 */
export const log = async (message, data = {}, level = LOG_LEVELS.INFO) => {
  // Always log to console
  switch (level) {
    case LOG_LEVELS.ERROR:
    case LOG_LEVELS.FATAL:
      console.error(`[${level.toUpperCase()}] ${message}`, data);
      break;
    case LOG_LEVELS.WARN:
      console.warn(`[${level.toUpperCase()}] ${message}`, data);
      break;
    default:
      console.log(`[${level.toUpperCase()}] ${message}`, data);
  }
  
  // Create and store the log entry
  const logEntry = createLogEntry(message, data, level);
  await storeLog(logEntry);
  
  // Try to send logs immediately for ERROR and FATAL levels
  if (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.FATAL) {
    sendLogs().catch(err => console.error('Failed to send logs after error:', err));
  }
};

/**
 * Log an error with stack trace
 * 
 * @param {Error} error - The error object
 * @param {string} context - Where the error occurred
 * @param {boolean} isFatal - Whether this is a fatal error (app crash)
 */
export const logError = async (error, context = 'unknown', isFatal = false) => {
  const level = isFatal ? LOG_LEVELS.FATAL : LOG_LEVELS.ERROR;
  
  await log(
    `Error in ${context}: ${error.message}`,
    {
      name: error.name,
      stack: error.stack,
      context
    },
    level
  );
};

/**
 * Set up global error handler to catch unhandled errors
 */
export const setupGlobalErrorHandler = () => {
  const originalErrorHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler(async (error, isFatal) => {
    // Log the error
    await logError(error, 'UnhandledException', isFatal);
    
    // Force send logs for fatal errors
    if (isFatal) {
      try {
        await sendLogs(true);
      } catch (e) {
        console.error('Failed to send logs after fatal error:', e);
      }
    }
    
    // Call the original handler
    originalErrorHandler(error, isFatal);
  });
};

/**
 * Initialize the remote logger
 */
export const initRemoteLogger = () => {
  setupGlobalErrorHandler();
  
  // Set up periodic log sending (every 15 minutes)
  const sendInterval = 15 * 60 * 1000;
  const intervalId = setInterval(() => {
    sendLogs().catch(err => console.error('Failed to send logs in interval:', err));
  }, sendInterval);
  
  // Also try to send logs on app start
  sendLogs().catch(err => console.error('Failed to send logs on startup:', err));
  
  return () => {
    clearInterval(intervalId);
  };
};

export default {
  log,
  logError,
  sendLogs,
  initRemoteLogger,
  LOG_LEVELS
};