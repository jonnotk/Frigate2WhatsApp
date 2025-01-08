// utils/logger.js
import fs from "fs";
import path from "path";
import { LOG_FILE, DEBUG } from "../constants-server.js";

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

  // Create a single write stream for all logs
  logStream = fs.createWriteStream(logFilePath, { flags: "a" });

  const log = (level, moduleName, message, data = null) => {
    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] [${moduleName}] [${level}] ${message} ${
      data ? JSON.stringify(data) : ""
    }\n`;

    // Log to console if in debug mode or if it's an error
    if (DEBUG || level === LOG_LEVELS.ERROR) {
      console.log(logMessage.trim()); // Trim to remove extra newline
    }

    // Log to the file using the central stream
    logStream.write(logMessage);
  };

  // Helper function to log specific types of messages
  const debug = (moduleName, message, data = null) =>
    log(LOG_LEVELS.DEBUG, moduleName, message, data);
  const info = (moduleName, message, data = null) =>
    log(LOG_LEVELS.INFO, moduleName, message, data);
  const warn = (moduleName, message, data = null) =>
    log(LOG_LEVELS.WARN, moduleName, message, data);
  const error = (moduleName, message, data = null) =>
    log(LOG_LEVELS.ERROR, moduleName, message, data);

  return { log, debug, info, warn, error };
}

export { setupLogging };