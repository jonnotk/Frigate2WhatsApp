// components/script-control.js

let scriptStatus = false; // Track the current script status

/**
 * Verifies if the WhatsApp link is active before starting the script.
 * @returns {Promise<boolean>} Whether the WhatsApp link is active or not.
 */
async function verifyWhatsAppLink() {
  console.info("Script Control", "Verifying WhatsApp link...");

  try {
    const res = await fetch("/api/wa/status");
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Script Control", "Error verifying WhatsApp link:", errorData);
      return false;
    }

    const { data } = await res.json();
    if (data.connected) {
      console.info("Script Control", "WhatsApp link is active.");
      return true;
    } else {
      console.warn("Script Control", "WhatsApp link is not active.");
      return false;
    }
  } catch (errorData) {
    console.error("Script Control", "Network error while verifying WhatsApp link:", errorData);
    return false;
  }
}

/**
 * Fetch the current status of the script from the backend API.
 */
async function fetchScriptStatus() {
  console.info("Script Control", "Fetching current script status...");

  try {
    const res = await fetch("/api/script/status");
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Script Control", "Error fetching script status:", errorData);
      return;
    }

    const { data } = await res.json();
    scriptStatus = data.running; // Update the local script status
    console.info("Script Control",`Script is currently ${scriptStatus ? "running" : "stopped"}.`);
  } catch (errorData) {
    console.error("Script Control", "Network error while fetching script status:", errorData);
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
    console.info("Script Control", "Initializing...");

    const startButton = document.getElementById("start-script-button");
    const stopButton = document.getElementById("stop-script-button");

    if (startButton) {
      startButton.addEventListener("click", scriptControl.startScript);
      console.info("Script Control", "Start button listener attached.");
    } else {
      console.warn("Script Control", "Start button not found in the DOM.");
    }

    if (stopButton) {
      stopButton.addEventListener("click", scriptControl.stopScript);
      console.info("Script Control", "Stop button listener attached.");
    } else {
      console.warn("Script Control", "Stop button not found in the DOM.");
    }

    // Fetch the initial script status during initialization
    fetchScriptStatus();

    console.info("Script Control", "Initialized successfully.");
  },

  /**
   * Start the script by calling the backend API.
   */
  startScript: async () => {
    console.info("Script Control", "Attempting to start script...");

    // Verify WhatsApp link status
    const isWhatsAppLinked = await verifyWhatsAppLink();
    if (!isWhatsAppLinked) {
      console.warn("Script Control", "Cannot start script because WhatsApp link is not active.");
      return;
    }

    try {
      const res = await fetch("/api/script/start", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Script Control", "Error starting script:", errorData);
        return;
      }

      scriptStatus = true;
      console.info("Script Control", "Script started successfully.");
    } catch (errorData) {
      console.error("Script Control", "Network error while starting script:", errorData);
    }
  },

  /**
   * Stop the script by calling the backend API.
   */
  stopScript: async () => {
    console.info("Script Control", "Attempting to stop script...");

    try {
      const res = await fetch("/api/script/stop", { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Script Control", "Error stopping script:", errorData);
        return;
      }

      scriptStatus = false;
      console.info("Script Control", "Script stopped successfully.");
    } catch (errorData) {
      console.error("Script Control", "Network error while stopping script:", errorData);
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