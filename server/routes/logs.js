/**
 * logs.js
 * 
 * Server routes for handling client logs and crash reports
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const logger = require('../logger');

// Directory for storing log files
const LOG_DIR = path.join(__dirname, '../logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Create a log file name based on date
 * @returns {string} Log file name
 */
const getLogFileName = () => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `client-logs-${dateStr}.json`;
};

/**
 * Write logs to a JSON file
 * @param {Array} logs - Array of log entries
 */
const writeLogsToFile = async (logs) => {
  const fileName = getLogFileName();
  const filePath = path.join(LOG_DIR, fileName);
  
  try {
    // Check if file exists
    let existingLogs = [];
    if (fs.existsSync(filePath)) {
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      existingLogs = JSON.parse(fileContent);
    }
    
    // Append new logs
    const updatedLogs = [...existingLogs, ...logs];
    
    // Write back to file
    await fs.promises.writeFile(filePath, JSON.stringify(updatedLogs, null, 2));
    
    return true;
  } catch (error) {
    logger.error('Failed to write logs to file:', error);
    return false;
  }
};

/**
 * POST /api/logs
 * Receive and store client logs
 */
router.post('/', async (req, res) => {
  try {
    const { logs, batchIndex, totalBatches } = req.body;
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ error: 'Invalid logs format' });
    }
    
    // Add server receipt timestamp and client IP
    const processedLogs = logs.map(log => ({
      ...log,
      receivedAt: new Date().toISOString(),
      clientIp: req.ip || req.connection.remoteAddress
    }));
    
    // Log summary to server logs
    const errorCount = logs.filter(log => log.level === 'error' || log.level === 'fatal').length;
    logger.info(`Received ${logs.length} logs (batch ${batchIndex + 1}/${totalBatches}), including ${errorCount} errors`);
    
    // Write to file
    const success = await writeLogsToFile(processedLogs);
    
    if (success) {
      res.status(200).json({ success: true, received: logs.length });
    } else {
      res.status(500).json({ error: 'Failed to store logs' });
    }
  } catch (error) {
    logger.error('Error processing logs:', error);
    res.status(500).json({ error: 'Server error processing logs' });
  }
});

/**
 * GET /api/logs/summary
 * Get a summary of stored logs
 */
router.get('/summary', async (req, res) => {
  try {
    // Only allow this in development or with proper authentication
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    
    const files = await fs.promises.readdir(LOG_DIR);
    const logFiles = files.filter(file => file.startsWith('client-logs-'));
    
    const summary = {
      totalFiles: logFiles.length,
      files: []
    };
    
    for (const file of logFiles) {
      const filePath = path.join(LOG_DIR, file);
      const stats = await fs.promises.stat(filePath);
      
      // Read file to count logs and errors
      const content = await fs.promises.readFile(filePath, 'utf8');
      const logs = JSON.parse(content);
      
      const errorCount = logs.filter(log => log.level === 'error' || log.level === 'fatal').length;
      
      summary.files.push({
        name: file,
        size: stats.size,
        modified: stats.mtime,
        logCount: logs.length,
        errorCount
      });
    }
    
    res.status(200).json(summary);
  } catch (error) {
    logger.error('Error getting logs summary:', error);
    res.status(500).json({ error: 'Server error getting logs summary' });
  }
});

module.exports = router;