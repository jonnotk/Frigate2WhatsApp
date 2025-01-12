// utils/logger.js
import fs from "fs";
import path from "path";
import { LOG_FILE, DEBUG } from "../constants-server.js";
import { WebSocket } from 'ws';

// Define log levels
const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

// Centralized log stream
let logStream = null;

function setupLogging(logFilePath = LOG_FILE) {
  const logDirectory = path.dirname(logFilePath);

  // Create log directory if it doesn't exist
  try {
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
      console.log(`[Logger] Log directory created at: ${logDirectory}`);
    }
  } catch (err) {
    console.error(`[Logger] Error creating log directory: ${err}`);
    // You might want to handle this error more gracefully in production
    // Maybe fallback to a default log location or exit the application
  }

  // Create a single write stream for all logs (append mode)
  if (!logStream) {
      logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  }

  const log = (level, moduleName, message, data = null, stream = 'file') => {
    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] [${moduleName}] [${level}] ${message} ${data ? JSON.stringify(data) : ""}`;

    if (stream === 'file') {
        // Log to the file using the central stream
        logStream.write(logMessage + '\n');
    } else if (stream === 'console') {
        // Output to console based on log level
        switch (level) {
            case LOG_LEVELS.DEBUG:
                if (DEBUG) console.debug(logMessage);
                break;
            case LOG_LEVELS.INFO:
                console.info(logMessage);
                break;
            case LOG_LEVELS.WARN:
                console.warn(logMessage);
                break;
            case LOG_LEVELS.ERROR:
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
        }
    }
  };

  // Helper function to log specific types of messages
  const debug = (moduleName, message, data = null) =>
    log(LOG_LEVELS.DEBUG, moduleName, message, data, DEBUG ? 'console' : 'file');
  const info = (moduleName, message, data = null) =>
    log(LOG_LEVELS.INFO, moduleName, message, data, 'console');
  const warn = (moduleName, message, data = null) =>
    log(LOG_LEVELS.WARN, moduleName, message, data, 'console');
  const error = (moduleName, message, data = null) =>
    log(LOG_LEVELS.ERROR, moduleName, message, data, 'console');

  return { log, debug, info, warn, error };
}

export { setupLogging };