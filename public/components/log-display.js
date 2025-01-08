// components/log-display.js

const logDisplay = {
  /**
   * Initializes the log display module.
   */
  initialize: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Log Display] Initializing...`);

    // Load persisted logs from localStorage
    const persistedLogs = JSON.parse(localStorage.getItem("logs") || "{}");
    for (const containerId in persistedLogs) {
      const logs = persistedLogs[containerId];
      const logContainer = document.getElementById(containerId);
      if (logContainer) {
        logContainer.innerHTML = logs;
      }
    }

    console.log(`[${timestamp}] [Log Display] Initialized.`);
  },

  /**
   * Appends a log message to a specified container.
   * @param {string} containerId - The ID of the log container.
   * @param {string} message - The message to append to the log.
   */
  appendLog: (containerId, message) => {
    const timestamp = new Date().toLocaleString();
    const logContainer = document.getElementById(containerId);

    if (!logContainer) {
      console.error(`[${timestamp}] [Log Display] Log container not found: ${containerId}`);
      return;
    }

    const log = document.createElement("p");
    log.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(log);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Persist logs in localStorage
    const persistedLogs = JSON.parse(localStorage.getItem("logs") || "{}");
    persistedLogs[containerId] = logContainer.innerHTML;
    localStorage.setItem("logs", JSON.stringify(persistedLogs));

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
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Log Display] Clearing logs for ${containerId}...`);
    const logContainer = document.getElementById(containerId);

    if (logContainer) {
      logContainer.innerHTML = "";

      // Remove logs from localStorage
      const persistedLogs = JSON.parse(localStorage.getItem("logs") || "{}");
      delete persistedLogs[containerId];
      localStorage.setItem("logs", JSON.stringify(persistedLogs));
    } else {
      console.error(`[${timestamp}] [Log Display] Log container not found: ${containerId}`);
    }
  },

  /**
   * Exports logs from a specified container as a file.
   * @param {string} containerId - The ID of the log container.
   * @param {string} filename - The name of the file to export.
   */
  exportLogs: (containerId, filename = "logs.txt") => {
    const timestamp = new Date().toLocaleString();
    const logContainer = document.getElementById(containerId);

    if (!logContainer) {
      console.error(`[${timestamp}] [Log Display] Log container not found: ${containerId}`);
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

    console.log(`[${timestamp}] [Log Display] Logs exported from ${containerId} to ${filename}.`);
  },
};

export { logDisplay };