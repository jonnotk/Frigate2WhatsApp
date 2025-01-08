// components/script-control.js
import { logDisplay } from "./log-display.js";

let scriptStatus = false; // Track the current script status

/**
 * Verifies if the WhatsApp link is active before starting the script.
 * @returns {Promise<boolean>} Whether the WhatsApp link is active or not.
 */
async function verifyWhatsAppLink() {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] [Script Control] Verifying WhatsApp link...`);

  try {
    const res = await fetch("/api/wa/status");
    if (!res.ok) {
      const error = await res.json();
      console.error(`[${timestamp}] [Script Control] Error verifying WhatsApp link:`, error);
      logDisplay.appendLog(
        "log-container-server",
        `Error verifying WhatsApp link: ${error.error || "Unknown error"}`
      );
      return false;
    }

    const { data } = await res.json();
    if (data.connected) {
      console.log(`[${timestamp}] [Script Control] WhatsApp link is active.`);
      logDisplay.appendLog("log-container", "[Script Control] WhatsApp link is active.");
      return true;
    } else {
      console.warn(`[${timestamp}] [Script Control] WhatsApp link is not active.`);
      logDisplay.appendLog("log-container-server", "[Script Control] WhatsApp link is not active.");
      return false;
    }
  } catch (error) {
    console.error(`[${timestamp}] [Script Control] Network error while verifying WhatsApp link:`, error);
    logDisplay.appendLog(
      "log-container-server",
      `Network error while verifying WhatsApp link: ${error.message}`
    );
    return false;
  }
}

/**
 * Fetch the current status of the script from the backend API.
 */
async function fetchScriptStatus() {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] [Script Control] Fetching current script status...`);

  try {
    const res = await fetch("/api/script/status");
    if (!res.ok) {
      const error = await res.json();
      console.error(`[${timestamp}] [Script Control] Error fetching script status:`, error);
      logDisplay.appendLog("log-container-server", `Error fetching script status: ${error.error || "Unknown error"}`);
      return;
    }

    const { data } = await res.json();
    scriptStatus = data.running; // Update the local script status
    logDisplay.appendLog("log-container", `[Script Control] Script is currently ${scriptStatus ? "running" : "stopped"}.`);
    console.log(`[${timestamp}] [Script Control] Script is currently ${scriptStatus ? "running" : "stopped"}.`);
  } catch (error) {
    console.error(`[${timestamp}] [Script Control] Network error while fetching script status:`, error);
    logDisplay.appendLog("log-container-server", `Network error while fetching script status: ${error.message}`);
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
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Script Control] Initializing...`);

    const startButton = document.getElementById("start-script-button");
    const stopButton = document.getElementById("stop-script-button");

    if (startButton) {
      startButton.addEventListener("click", scriptControl.startScript);
      console.log(`[${timestamp}] [Script Control] Start button listener attached.`);
    } else {
      console.warn(`[${timestamp}] [Script Control] Start button not found in the DOM.`);
    }

    if (stopButton) {
      stopButton.addEventListener("click", scriptControl.stopScript);
      console.log(`[${timestamp}] [Script Control] Stop button listener attached.`);
    } else {
      console.warn(`[${timestamp}] [Script Control] Stop button not found in the DOM.`);
    }

    // Fetch the initial script status during initialization
    fetchScriptStatus();

    console.log(`[${timestamp}] [Script Control] Initialized successfully.`);
  },

  /**
   * Start the script by calling the backend API.
   */
  startScript: async () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Script Control] Attempting to start script...`);

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
        const error = await res.json();
        console.error(`[${timestamp}] [Script Control] Error starting script:`, error);
        logDisplay.appendLog("log-container-server", `Error starting script: ${error.error || "Unknown error"}`);
        return;
      }

      scriptStatus = true;
      console.log(`[${timestamp}] [Script Control] Script started successfully.`);
      logDisplay.appendLog("log-container", "[Script Control] Script started successfully.");
    } catch (error) {
      console.error(`[${timestamp}] [Script Control] Network error while starting script:`, error);
      logDisplay.appendLog("log-container-server", `Network error while starting script: ${error.message}`);
    }
  },

  /**
   * Stop the script by calling the backend API.
   */
  stopScript: async () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Script Control] Attempting to stop script...`);

    try {
      const res = await fetch("/api/script/stop", { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        console.error(`[${timestamp}] [Script Control] Error stopping script:`, error);
        logDisplay.appendLog("log-container-server", `Error stopping script: ${error.error || "Unknown error"}`);
        return;
      }

      scriptStatus = false;
      console.log(`[${timestamp}] [Script Control] Script stopped successfully.`);
      logDisplay.appendLog("log-container", "[Script Control] Script stopped successfully.");
    } catch (error) {
      console.error(`[${timestamp}] [Script Control] Network error while stopping script:`, error);
      logDisplay.appendLog("log-container-server", `Network error while stopping script: ${error.message}`);
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