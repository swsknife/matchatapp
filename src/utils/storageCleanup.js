/**
 * storageCleanup.js
 * 
 * Utility functions for cleaning up storage to prevent excessive usage.
 * This includes scheduled cleanup of old messages and other stored data.
 */

import { cleanupOldMessages } from '../services/storageService';

// Default cleanup interval (once per day)
const DEFAULT_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Default maximum age for messages (30 days)
const DEFAULT_MAX_AGE_DAYS = 30;

// Track the cleanup timer
let cleanupTimer = null;

/**
 * Starts the periodic cleanup process
 * 
 * @param {number} interval - Cleanup interval in milliseconds
 * @param {number} maxAgeInDays - Maximum age of messages to keep
 */
export const startPeriodicCleanup = (
  interval = DEFAULT_CLEANUP_INTERVAL,
  maxAgeInDays = DEFAULT_MAX_AGE_DAYS
) => {
  // Clear any existing timer
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  
  // Run cleanup immediately
  performCleanup(maxAgeInDays);
  
  // Schedule periodic cleanup
  cleanupTimer = setInterval(() => {
    performCleanup(maxAgeInDays);
  }, interval);
  
  console.log(`Storage cleanup scheduled every ${interval / (60 * 60 * 1000)} hours`);
};

/**
 * Stops the periodic cleanup process
 */
export const stopPeriodicCleanup = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('Storage cleanup stopped');
  }
};

/**
 * Performs the actual cleanup operation
 * 
 * @param {number} maxAgeInDays - Maximum age of messages to keep
 */
const performCleanup = async (maxAgeInDays) => {
  try {
    console.log('Starting storage cleanup...');
    const result = await cleanupOldMessages(maxAgeInDays);
    
    if (result.success) {
      console.log(`Storage cleanup completed. Removed ${result.cleanedCount} old message entries.`);
    } else {
      console.error('Storage cleanup failed:', result.error);
    }
  } catch (error) {
    console.error('Error during storage cleanup:', error);
  }
};