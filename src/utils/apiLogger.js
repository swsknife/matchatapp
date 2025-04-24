/**
 * API Logger Utility
 * 
 * This module provides a wrapper around fetch to log API requests and responses.
 * It can be used to debug network-related issues.
 */

// Store for API logs
const apiLogs = [];
const MAX_LOGS = 50; // Maximum number of logs to keep

// Original fetch function
const originalFetch = global.fetch;

// Intercept fetch calls
const interceptFetch = () => {
  global.fetch = async (url, options = {}) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 10);
    
    // Create log entry for request
    const logEntry = {
      id: requestId,
      url,
      method: options.method || 'GET',
      requestHeaders: options.headers || {},
      requestBody: options.body,
      startTime,
      pending: true
    };
    
    // Add to logs
    addLog(logEntry);
    
    try {
      // Make the actual request
      const response = await originalFetch(url, options);
      
      // Clone the response so we can read the body
      const clonedResponse = response.clone();
      
      // Try to parse response body
      let responseBody;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseBody = await clonedResponse.json();
        } else {
          responseBody = await clonedResponse.text();
        }
      } catch (e) {
        responseBody = 'Could not parse response body';
      }
      
      // Update log entry with response
      updateLog(requestId, {
        status: response.status,
        statusText: response.statusText,
        responseHeaders: Object.fromEntries([...response.headers.entries()]),
        responseBody,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        pending: false,
        error: null
      });
      
      return response;
    } catch (error) {
      // Update log entry with error
      updateLog(requestId, {
        endTime: Date.now(),
        duration: Date.now() - startTime,
        pending: false,
        error: error.message
      });
      
      throw error;
    }
  };
};

// Restore original fetch
const restoreFetch = () => {
  global.fetch = originalFetch;
};

// Add a log entry
const addLog = (entry) => {
  apiLogs.unshift(entry);
  
  // Trim logs if they exceed the maximum
  if (apiLogs.length > MAX_LOGS) {
    apiLogs.pop();
  }
};

// Update an existing log entry
const updateLog = (id, data) => {
  const index = apiLogs.findIndex(log => log.id === id);
  if (index !== -1) {
    apiLogs[index] = { ...apiLogs[index], ...data };
  }
};

// Get all logs
const getLogs = () => {
  return [...apiLogs];
};

// Clear all logs
const clearLogs = () => {
  apiLogs.length = 0;
};

// Initialize API logging
const initApiLogging = () => {
  interceptFetch();
  console.log('API logging initialized');
};

export default {
  initApiLogging,
  restoreFetch,
  getLogs,
  clearLogs
};