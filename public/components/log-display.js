// components/log-display.js
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, warn, error } = setupLogging();

const logDisplay = {
  /**
   * Initializes the log display module.
   */
  initialize: () => {
    info("Log Display", "Initializing...");
    info("Log Display", "Initialized.");
  },

  /**
   * Appends a log message to a specified container.
   * @param {string} containerId - The ID of the log container.
   * @param {string} message - The message to append to the log.
   */
  appendLog: (containerId, message) => {
    const logContainer = document.getElementById(containerId);

    if (!logContainer) {
      error("Log Display", `Log container not found: ${containerId}`);
      return;
    }

    const log = document.createElement("p");
    log.textContent = `[${new Date().toLocaleString()}] ${message}`; // Include timestamp
    logContainer.appendChild(log);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Optional: Limit the number of logs to prevent excessive growth
    const maxLogs = 500;
    while (logContainer.childNodes.length > maxLogs) {
      logContainer.removeChild(logContainer.firstChild);
    }
  },

  /**
   * Clears all logs from a specified container.
   * @param {string} containerId - The ID of the log container.
   */
  clearLogs: (containerId) => {
    info("Log Display", `Clearing logs for ${containerId}...`);
    const logContainer = document.getElementById(containerId);

    if (logContainer) {
      logContainer.innerHTML = "";
    } else {
      error("Log Display", `Log container not found: ${containerId}`);
    }
  },

  /**
   * Exports logs from a specified container as a file.
   * @param {string} containerId - The ID of the log container.
   * @param {string} filename - The name of the file to export.
   */
  exportLogs: (containerId, filename = "logs.txt") => {
    const logContainer = document.getElementById(containerId);

    if (!logContainer) {
      error("Log Display", `Log container not found: ${containerId}`);
      return;
    }

    const logs = logContainer.innerText;
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    info("Log Display",`Logs exported from ${containerId} to ${filename}.`);
  },
};

export { logDisplay };