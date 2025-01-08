// utils/logger.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LOG_FILE, DEBUG } from "../constants-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

// Configuration for which modules to log (you can make this dynamic later)
const LOG_MODULES = {
  "MQTT": true,
  "WhatsApp": true,
  "WebSocket-Client": true,
  "WebSocket-Server": true,
};

// Object to store log streams for each module
const logStreams = {};

export function setupLogging(logFilePath) {
  if (!logFilePath) {
    console.error(
      "[Logger] Error: LOG_FILE environment variable is not set. Using default: ./logs/app.log"
    );
    logFilePath = path.join(__dirname, "../logs", "app.log"); // Provide a default path
  }

  const logDirectory = path.dirname(logFilePath);

  // Create log directory if it doesn't exist
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
    console.log(`[Logger] Log directory created at: ${logDirectory}`);
  }

  // Check if the log file exists and create it if it doesn't
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, ""); // Create an empty file
    console.log(`[Logger] Log file created at: ${logFilePath}`);
  }

  // Function to get or create a log stream for a specific module
  const getLogStream = (moduleName) => {
    if (!logStreams[moduleName]) {
      const moduleLogFilePath = path.join(logDirectory, `${moduleName.toLowerCase()}.log`);
      
      // Create the module-specific log file if it doesn't exist
      if (!fs.existsSync(moduleLogFilePath)) {
        fs.writeFileSync(moduleLogFilePath, ""); // Create an empty file
        console.log(`[Logger] Log file created for module ${moduleName} at: ${moduleLogFilePath}`);
      }

      // Create a write stream for the module-specific log file
      logStreams[moduleName] = fs.createWriteStream(moduleLogFilePath, { flags: "a" });
    }

    return logStreams[moduleName];
  };

  const log = (moduleName, level, message, data = null) => {
    // Check if the module should be logged
    if (!LOG_MODULES[moduleName]) {
      return; // Skip logging for this module
    }

    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] [${moduleName}] [${level}] ${message} ${
      data ? JSON.stringify(data) : ""
    }\n`;

    // Log to console if in debug mode or if it's an error
    if (DEBUG || level === LOG_LEVELS.ERROR) {
      console.log(logMessage.trim()); // Trim to remove extra newline
    }

    // Log to the module-specific log file
    const moduleLogStream = getLogStream(moduleName);
    moduleLogStream.write(logMessage);
  };

  // Helper function to log specific types of messages
  const debug = (moduleName, message, data = null) => log(moduleName, LOG_LEVELS.DEBUG, message, data);
  const info = (moduleName, message, data = null) => log(moduleName, LOG_LEVELS.INFO, message, data);
  const warn = (moduleName, message, data = null) => log(moduleName, LOG_LEVELS.WARN, message, data);
  const error = (moduleName, message, data = null) => log(moduleName, LOG_LEVELS.ERROR, message, data);

  return { log, debug, info, warn, error };
}