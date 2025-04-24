/**
 * logger.js - Simple logging utility for the MatchChatApp server
 * 
 * This module provides functions for logging messages to both the console
 * and a log file, with timestamps and different log levels.
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Log file paths
const logFile = path.join(logsDir, `server-${new Date().toISOString().split('T')[0]}.log`);
const errorLogFile = path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`);

/**
 * Write a message to the log file
 * @param {string} message - The message to log
 * @param {string} level - The log level (info, warn, error)
 * @param {Object} data - Optional data to include in the log
 */
const writeToFile = (message, level, data = null) => {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data) {
    try {
      logMessage += ` ${JSON.stringify(data)}`;
    } catch (err) {
      logMessage += ` [Error serializing data: ${err.message}]`;
    }
  }
  
  logMessage += '\n';
  
  // Write to the appropriate log file
  const file = level === 'error' ? errorLogFile : logFile;
  
  fs.appendFile(file, logMessage, (err) => {
    if (err) {
      console.error(`Failed to write to log file: ${err.message}`);
    }
  });
};

/**
 * Log an info message
 * @param {string} message - The message to log
 * @param {Object} data - Optional data to include in the log
 */
const info = (message, data = null) => {
  console.log(`[INFO] ${message}`, data ? data : '');
  writeToFile(message, 'info', data);
};

/**
 * Log a warning message
 * @param {string} message - The message to log
 * @param {Object} data - Optional data to include in the log
 */
const warn = (message, data = null) => {
  console.warn(`[WARN] ${message}`, data ? data : '');
  writeToFile(message, 'warn', data);
};

/**
 * Log an error message
 * @param {string} message - The message to log
 * @param {Object} data - Optional data to include in the log
 */
const error = (message, data = null) => {
  console.error(`[ERROR] ${message}`, data ? data : '');
  writeToFile(message, 'error', data);
};

/**
 * Log a debug message (only in development)
 * @param {string} message - The message to log
 * @param {Object} data - Optional data to include in the log
 */
const debug = (message, data = null) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[DEBUG] ${message}`, data ? data : '');
    writeToFile(message, 'debug', data);
  }
};

/**
 * Log socket events
 * @param {string} event - The socket event name
 * @param {Object} data - The event data
 * @param {string} socketId - The socket ID
 */
const socketEvent = (event, data, socketId) => {
  const logData = {
    socketId,
    event,
    data: typeof data === 'object' ? data : { value: data }
  };
  
  debug(`Socket event: ${event}`, logData);
};

module.exports = {
  info,
  warn,
  error,
  debug,
  socketEvent
};