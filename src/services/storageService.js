/**
 * storageService.js
 * 
 * A centralized service for handling all AsyncStorage operations in the app.
 * This service provides methods for storing, retrieving, and managing data in AsyncStorage,
 * with built-in error handling, retry logic, and data validation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { handleStorageError, ERROR_SEVERITY } from '../utils/errorHandling';

// Constants for storage keys to ensure consistency
export const STORAGE_KEYS = {
  MESSAGES: (matchId) => `messages_${matchId}`,
  USER_PREFERENCES: 'user_preferences',
  ACTIVE_MATCHES: 'active_matches',
};

// Maximum number of messages to store per match
const MAX_STORED_MESSAGES = 100;

// Maximum number of retries for storage operations
const MAX_RETRIES = 3;

// Delay between retries (in milliseconds) - increases with each retry
const getRetryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000);

/**
 * Validates and parses JSON data from storage
 * 
 * @param {string} data - The data string to parse
 * @param {Array|Object} defaultValue - Default value to return if parsing fails
 * @returns {Array|Object} Parsed data or default value
 */
const safelyParseJSON = (data, defaultValue) => {
  if (!data) return defaultValue;
  
  try {
    // Basic validation before parsing
    if (typeof data !== 'string' || !data.trim().startsWith('{') && !data.trim().startsWith('[')) {
      handleStorageError(
        'Invalid JSON format in storage', 
        { 
          severity: ERROR_SEVERITY.WARNING,
          silent: true 
        }
      );
      return defaultValue;
    }
    
    return JSON.parse(data);
  } catch (error) {
    handleStorageError(
      error, 
      { 
        severity: ERROR_SEVERITY.ERROR,
        silent: true,
        alertMessage: 'Failed to parse data from storage'
      }
    );
    return defaultValue;
  }
};

/**
 * Retrieves messages for a specific match with retry logic
 * 
 * @param {string} matchId - The ID of the match
 * @param {number} attempt - Current attempt number (for internal use in recursion)
 * @returns {Promise<Array>} Array of message objects
 */
export const getMessages = async (matchId) => {
  let attempt = 0;
  
  while (attempt <= MAX_RETRIES) {
    try {
      const key = STORAGE_KEYS.MESSAGES(matchId);
      const messagesData = await AsyncStorage.getItem(key);
      return safelyParseJSON(messagesData, []);
    } catch (error) {
      attempt++;
      
      handleStorageError(
        error, 
        { 
          severity: ERROR_SEVERITY.WARNING,
          silent: true,
          alertMessage: `Failed to get messages (attempt ${attempt}/${MAX_RETRIES})`
        }
      );
      
      // If we've reached max retries, break out of the loop
      if (attempt > MAX_RETRIES) {
        break;
      }
      
      // Wait before retrying
      const delay = getRetryDelay(attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If all retries fail, return empty array and log a more severe error
  handleStorageError(
    `All ${MAX_RETRIES} attempts to get messages failed`, 
    { 
      severity: ERROR_SEVERITY.ERROR,
      showAlert: true,
      alertMessage: 'Unable to load messages. Please try again later.'
    }
  );
  return [];
};

/**
 * Saves messages for a specific match with retry logic
 * 
 * @param {string} matchId - The ID of the match
 * @param {Array} messages - Array of message objects to save
 * @param {number} attempt - Current attempt number (for internal use in recursion)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export const saveMessages = async (matchId, messages) => {
  let attempt = 0;
  
  while (attempt <= MAX_RETRIES) {
    try {
      // Ensure we don't exceed the maximum number of stored messages
      const messagesToStore = messages.length > MAX_STORED_MESSAGES 
        ? messages.slice(messages.length - MAX_STORED_MESSAGES) 
        : messages;
      
      const key = STORAGE_KEYS.MESSAGES(matchId);
      await AsyncStorage.setItem(key, JSON.stringify(messagesToStore));
      return true;
    } catch (error) {
      attempt++;
      
      handleStorageError(
        error, 
        { 
          severity: ERROR_SEVERITY.WARNING,
          silent: true,
          alertMessage: `Failed to save messages (attempt ${attempt}/${MAX_RETRIES})`
        }
      );
      
      // If we've reached max retries, break out of the loop
      if (attempt > MAX_RETRIES) {
        break;
      }
      
      // Wait before retrying
      const delay = getRetryDelay(attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If all retries fail, return false and log a more severe error
  handleStorageError(
    `All ${MAX_RETRIES} attempts to save messages failed`, 
    { 
      severity: ERROR_SEVERITY.ERROR,
      // Only show alert if there are messages to save
      showAlert: messages.length > 0,
      alertMessage: 'Unable to save messages. Your messages will be available until you close the app.'
    }
  );
  return false;
};

/**
 * Adds a single message to storage for a specific match
 * Optimized to avoid loading all messages for large conversations
 * 
 * @param {string} matchId - The ID of the match
 * @param {Object} message - The message object to add
 * @returns {Promise<Object>} Result object with success flag and error if applicable
 */
export const addMessage = async (matchId, message) => {
  try {
    const key = STORAGE_KEYS.MESSAGES(matchId);
    
    // For temporary chat app with short conversations, we can use a simpler approach
    // that's still efficient enough for our use case
    
    // Get existing messages
    const existingMessages = await getMessages(matchId);
    
    // Check if we need to trim the messages array to prevent excessive storage
    if (existingMessages.length >= MAX_STORED_MESSAGES) {
      // Remove oldest messages to stay within limit
      const trimmedMessages = existingMessages.slice(-MAX_STORED_MESSAGES + 1);
      trimmedMessages.push(message);
      await AsyncStorage.setItem(key, JSON.stringify(trimmedMessages));
    } else {
      // Just add the new message
      existingMessages.push(message);
      await AsyncStorage.setItem(key, JSON.stringify(existingMessages));
    }
    
    return { success: true, message };
  } catch (error) {
    console.error('Error in addMessage:', error);
    return { success: false, error: error.message, message };
  }
};

/**
 * Generates a unique ID for messages
 * 
 * @returns {string} Unique ID
 */
export const generateMessageId = () => {
  return uuidv4();
};

/**
 * Cleans up old message data to prevent excessive storage usage
 * Removes messages for matches older than the specified age
 * 
 * @param {number} maxAgeInDays - Maximum age of messages to keep (in days)
 * @returns {Promise<Object>} Result with count of cleaned matches
 */
export const cleanupOldMessages = async (maxAgeInDays = 30) => {
  try {
    // Get all keys from AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    
    // Filter message keys
    const messageKeys = keys.filter(key => key.startsWith('messages_'));
    
    // Get current timestamp
    const now = Date.now();
    const maxAgeMs = maxAgeInDays * 24 * 60 * 60 * 1000;
    
    let cleanedCount = 0;
    
    // Check each match's messages
    for (const key of messageKeys) {
      try {
        const messagesData = await AsyncStorage.getItem(key);
        const messages = safelyParseJSON(messagesData, []);
        
        // If no messages or all messages are old, remove the entire entry
        if (messages.length === 0 || 
            (messages.length > 0 && 
             messages[messages.length - 1].timestamp < (now - maxAgeMs))) {
          try {
            await AsyncStorage.removeItem(key);
            cleanedCount++;
            console.log(`Removed old message entry: ${key}`);
          } catch (removeError) {
            console.error(`Error removing message entry ${key}:`, removeError);
            // Continue with other entries even if this one fails
          }
        }
      } catch (getError) {
        console.error(`Error retrieving message entry ${key}:`, getError);
        // Continue with other entries even if this one fails
      }
    }
    
    console.log(`Cleaned up ${cleanedCount} old message entries`);
    return { success: true, cleanedCount };
  } catch (error) {
    console.error('Error cleaning up old messages:', error);
    return { success: false, error: error.message };
  }
};