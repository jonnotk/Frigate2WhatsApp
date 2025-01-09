// components/log-display.js

const logDisplay = {
  /**
   * Initializes the log display module.
   */
  initialize: () => {
    console.info("Log Display", "Initializing...");
    console.info("Log Display", "Initialized.");
  },

  /**
   * Appends a log message to a specified container.
   * @param {string} containerId - The ID of the log container.
   * @param {string} message - The message to append to the log.
   */
  appendLog: (containerId, message) => {
    const logContainer = document.getElementById(containerId);

    if (!logContainer) {
      console.error("Log Display", `Log container not found: ${containerId}`);
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
    console.info("Log Display", `Clearing logs for ${containerId}...`);
    const logContainer = document.getElementById(containerId);

    if (logContainer) {
      logContainer.innerHTML = "";
    } else {
      console.error("Log Display", `Log container not found: ${containerId}`);
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
      console.error("Log Display", `Log container not found: ${containerId}`);
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

    console.info("Log Display",`Logs exported from ${containerId} to ${filename}.`);
  },
};

export { logDisplay };