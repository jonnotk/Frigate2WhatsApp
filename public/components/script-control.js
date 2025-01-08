// components/script-control.js
import { logDisplay } from "./log-display.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, warn, error } = setupLogging();

let scriptStatus = false; // Track the current script status

/**
 * Verifies if the WhatsApp link is active before starting the script.
 * @returns {Promise<boolean>} Whether the WhatsApp link is active or not.
 */
async function verifyWhatsAppLink() {
  info("Script Control", "Verifying WhatsApp link...");

  try {
    const res = await fetch("/api/wa/status");
    if (!res.ok) {
      const errorData = await res.json();
      error("Script Control", "Error verifying WhatsApp link:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Error verifying WhatsApp link: ${errorData.error || "Unknown error"}`
      );
      return false;
    }

    const { data } = await res.json();
    if (data.connected) {
      info("Script Control", "WhatsApp link is active.");
      logDisplay.appendLog(
        "log-container",
        "[Script Control] WhatsApp link is active."
      );
      return true;
    } else {
      warn("Script Control", "WhatsApp link is not active.");
      logDisplay.appendLog(
        "log-container-server",
        "[Script Control] WhatsApp link is not active."
      );
      return false;
    }
  } catch (errorData) {
    error("Script Control", "Network error while verifying WhatsApp link:", errorData);
    logDisplay.appendLog(
      "log-container-server",
      `Network error while verifying WhatsApp link: ${errorData.message}`
    );
    return false;
  }
}

/**
 * Fetch the current status of the script from the backend API.
 */
async function fetchScriptStatus() {
  info("Script Control", "Fetching current script status...");

  try {
    const res = await fetch("/api/script/status");
    if (!res.ok) {
      const errorData = await res.json();
      error("Script Control", "Error fetching script status:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Error fetching script status: ${errorData.error || "Unknown error"}`
      );
      return;
    }

    const { data } = await res.json();
    scriptStatus = data.running; // Update the local script status
    logDisplay.appendLog(
      "log-container",
      `[Script Control] Script is currently ${
        scriptStatus ? "running" : "stopped"
      }.`
    );
    info("Script Control",`Script is currently ${scriptStatus ? "running" : "stopped"}.`);
  } catch (errorData) {
    error("Script Control", "Network error while fetching script status:", errorData);
    logDisplay.appendLog(
      "log-container-server",
      `Network error while fetching script status: ${errorData.message}`
    );
  }
}

/**
 * Exported object containing all Script Control functionalities.
 */
const scriptControl = {
  /**
   * Initializes the Script Control module.
   * Attaches event listeners to the start and stop buttons in the UI.
   */
  initialize: () => {
    info("Script Control", "Initializing...");

    const startButton = document.getElementById("start-script-button");
    const stopButton = document.getElementById("stop-script-button");

    if (startButton) {
      startButton.addEventListener("click", scriptControl.startScript);
      info("Script Control", "Start button listener attached.");
    } else {
      warn("Script Control", "Start button not found in the DOM.");
    }

    if (stopButton) {
      stopButton.addEventListener("click", scriptControl.stopScript);
      info("Script Control", "Stop button listener attached.");
    } else {
      warn("Script Control", "Stop button not found in the DOM.");
    }

    // Fetch the initial script status during initialization
    fetchScriptStatus();

    info("Script Control", "Initialized successfully.");
  },

  /**
   * Start the script by calling the backend API.
   */
  startScript: async () => {
    info("Script Control", "Attempting to start script...");

    // Verify WhatsApp link status
    const isWhatsAppLinked = await verifyWhatsAppLink();
    if (!isWhatsAppLinked) {
      logDisplay.appendLog(
        "log-container-server",
        "[Script Control] Cannot start script because WhatsApp link is not active."
      );
      return;
    }

    try {
      const res = await fetch("/api/script/start", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        error("Script Control", "Error starting script:", errorData);
        logDisplay.appendLog(
          "log-container-server",
          `Error starting script: ${errorData.error || "Unknown error"}`
        );
        return;
      }

      scriptStatus = true;
      info("Script Control", "Script started successfully.");
      logDisplay.appendLog(
        "log-container",
        "[Script Control] Script started successfully."
      );
    } catch (errorData) {
      error("Script Control", "Network error while starting script:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Network error while starting script: ${errorData.message}`
      );
    }
  },

  /**
   * Stop the script by calling the backend API.
   */
  stopScript: async () => {
    info("Script Control", "Attempting to stop script...");

    try {
      const res = await fetch("/api/script/stop", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        error("Script Control", "Error stopping script:", errorData);
        logDisplay.appendLog(
          "log-container-server",
          `Error stopping script: ${errorData.error || "Unknown error"}`
        );
        return;
      }

      scriptStatus = false;
      info("Script Control", "Script stopped successfully.");
      logDisplay.appendLog(
        "log-container",
        "[Script Control] Script stopped successfully."
      );
    } catch (errorData) {
      error("Script Control", "Network error while stopping script:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Network error while stopping script: ${errorData.message}`
      );
    }
  },

  /**
   * Checks if the script is currently running.
   * @returns {boolean} The current script status.
   */
  isScriptRunning: () => {
    return scriptStatus;
  },

  /**
   * Fetch the current status of the script from the backend API.
   */
  fetchScriptStatus,
};

export { scriptControl };