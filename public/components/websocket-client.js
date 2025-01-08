// components/websocket-client.js
import { qrModal } from "./qr-modal.js";
import { cameraMapping } from "./camera-mapping.js";
import { logDisplay } from "./log-display.js";
import {
  getCameras,
  getIsSubscribed,
  getIsSubscribing,
  setIsSubscribed,
  setIsSubscribing,
  getWaConnected,
  setWaConnected,
  getWaAccount,
  setWaAccount,
} from "../../state.js";
import {
  initialize as initWhatsAppConnection,
  handleWhatsAppMessage,
  updateStatusUI,
  updateForwardingStatus
} from "./whatsapp-connection.js";
import { CONNECTION_STATES } from "../../constants.js";
import { setupLogging } from "../../utils/logger.js";

const { log, debug, info, warn, error } = setupLogging();

let WS_BASE_URL = null;
let socket = null;
let wsUrl = null;

async function initializeSocket() {
  try {
    // Fetch WebSocket URL from the server
    const response = await fetch("/api/ws-config");
    if (!response.ok) {
      throw new Error("Failed to fetch WebSocket configuration");
    }
    const config = await response.json();
    wsUrl = config.WS_URL; // Set the WebSocket URL from the server response
    WS_BASE_URL = wsUrl.replace(/^ws:\/\//, ""); // Remove protocol from WS_URL

    // Retrieve or generate a session ID
    let sessionId = sessionStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem("sessionId", sessionId);
    }

    connectWebSocket(sessionId);
  } catch (error) {
    console.error("[WebSocket Client] Error initializing WebSocket:", error);
    logDisplay.appendLog(
      "log-container-server",
      `[WebSocket Client] Error initializing WebSocket: ${error.message}`
    );
  }
}

function connectWebSocket(sessionId) {
  // Construct the WebSocket URL with the session ID as a query parameter
  const fullWsUrl = `${wsUrl}?sessionId=${sessionId}`;
  console.log(`[WebSocket Client] WebSocket URL set to: ${fullWsUrl}`);

  // Create WebSocket connection to the server
  socket = new WebSocket(fullWsUrl);

  // Store the WebSocket instance in the global scope
  window.ws = socket;

  // Event: Connection opened
  socket.onopen = () => {
    const timestamp = new Date().toLocaleString();
    info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Connection established.`);
    logDisplay.appendLog(
      "log-container-server",
      "[WebSocket Client] Connected to server."
    );
    // Fetch initial statuses after connection
    fetchInitialStatuses();
    // Initialize WhatsApp Connection after WebSocket is established
    initWhatsAppConnection();
  };

  // Event: Message received
  socket.onmessage = (event) => {
    console.log(event.data);
    const timestamp = new Date().toLocaleString();
    debug("WebSocket-Client",`[${timestamp}] [WebSocket Client] Message received: ${event.data}`);

    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error(
        `[${timestamp}] [WebSocket Client] Error processing message:`,
        error
      );
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] Error processing message: ${error.message}`
      );
    }
  };

  // Event: Connection error
  socket.onerror = (error) => {
    const timestamp = new Date().toLocaleString();
    error("WebSocket-Client",`[${timestamp}] [WebSocket Client] Error: ${error}`);
    logDisplay.appendLog(
      "log-container-server",
      `[WebSocket Client] Error: ${error.message || error}`
    );
  };

  // Event: Connection closed
  socket.onclose = () => {
    const timestamp = new Date().toLocaleString();
    warn("WebSocket-Client",`[${timestamp}] [WebSocket Client] Connection closed. Reconnecting in 5 seconds...`);
    logDisplay.appendLog(
      "log-container-server",
      "[WebSocket Client] Connection closed. Reconnecting in 5 seconds..."
    );
    setTimeout(initializeSocket, 5000); // Retry connection after 5 seconds
  };
}

/**
 * Fetch initial statuses for WhatsApp and script.
 */
async function fetchInitialStatuses() {
  const timestamp = new Date().toLocaleString();

  // Fetch WhatsApp status
  try {
    const waStatusResponse = await fetch("/api/wa/status");
    const waStatusData = await waStatusResponse.json();

    if (waStatusData.success) {
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Initial WhatsApp status: ${waStatusData.data}`);
      updateWhatsAppStatus(waStatusData.data.connected);
      setWaAccount(waStatusData.data.account);

      // Check and update waConnected based on the fetched status
      if (waStatusData.data.connected) {
        setWaConnected(true);
      } else {
        setWaConnected(false);
      }

      // Update connection state only if wa-status is successfully fetched
      if (waStatusData.data && waStatusData.data.state) {
        updateStatusUI(waStatusData.data.state);
      }

      // Explicitly check subscription status
      const subscriptionResponse = await fetch("/api/wa/subscription-status");
      const subscriptionData = await subscriptionResponse.json();

      if (subscriptionData.success) {
        setIsSubscribed(subscriptionData.data.subscribed);
        info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Subscription status updated to: ${subscriptionData.data.subscribed}`);
      } else {
        warn("WebSocket-Client",`[${timestamp}] [WebSocket Client] Failed to fetch subscription status: ${subscriptionData.error}`);
      }
    } else {
      warn("WebSocket-Client",`[${timestamp}] [WebSocket Client] Failed to fetch WhatsApp status: ${waStatusData.error}`);
      logDisplay.appendLog(
        "log-container-server",
        `Failed to fetch WhatsApp status: ${waStatusData.error}`
      );
    }
  } catch (error) {
    error("WebSocket-Client",`[${timestamp}] [WebSocket Client] Error fetching WhatsApp status: ${error}`);
    logDisplay.appendLog(
      "log-container-server",
      `Error fetching WhatsApp status: ${error.message}`
    );
  }

  // Fetch script status
  try {
    const scriptStatusResponse = await fetch("/api/script/status");
    const scriptStatusData = await scriptStatusResponse.json();

    if (scriptStatusData.success) {
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Initial script status: ${scriptStatusData.data}`);
      updateScriptStatus(scriptStatusData.data.running);
    } else {
      warn("WebSocket-Client",`[${timestamp}] [WebSocket Client] Failed to fetch script status: ${scriptStatusData.error}`);
      logDisplay.appendLog(
        "log-container-server",
        `Failed to fetch script status: ${scriptStatusData.error}`
      );
    }
  } catch (error) {
    error("WebSocket-Client",`[${timestamp}] [WebSocket Client] Error fetching script status: ${error}`);
    logDisplay.appendLog(
      "log-container-server",
      `Error fetching script status: ${error.message}`
    );
  }
}
/**
 * Handle incoming WebSocket messages.
 * @param {object} message - WebSocket message object.
 */
function handleWebSocketMessage(message) {
  const timestamp = new Date().toLocaleString();
  switch (message.event) {
    case "server-connected":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Server says: ${message.data}`);
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] Server message: ${message.data}`
      );
      break;

    case "qr":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] QR Code received.`);
      qrModal.updateQR(message.data);
      break;

    case "wa-status":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] WhatsApp status updated: ${message.data}`);
      updateWhatsAppStatus(message.data.connected);
      if (message.data.connected) {
        qrModal.autoCloseOnConnection();
      }
      break;

    case "wa-account":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] WhatsApp account updated: ${message.data}`);
      setWaAccount(message.data);
      break;

    case "script-status":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Script status updated: ${message.data}`);
      updateScriptStatus(message.data.running);
      break;

    case "new-camera":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] New camera detected: ${message.data.camera}`);
      cameraMapping.updateCameraList(getCameras());
      break;

    case "wa-subscribed":
      setIsSubscribed(true);
      setIsSubscribing(false);
      break;

    case "wa-unsubscribed":
      setIsSubscribed(false);
      setIsSubscribing(false);
      break;

    case "wa-connected":
      setWaConnected(true);
      info("WebSocket-Client", "WhatsApp connected.");
      showPopup("WhatsApp connected.", "popup-connected");
      updateStatusUI(CONNECTION_STATES.CONNECTED);
      break;

    case "wa-disconnected":
      setWaConnected(false);
      info("WebSocket-Client", "WhatsApp disconnected.");
      showPopup("WhatsApp disconnected.", "popup-disconnected");
      updateStatusUI(CONNECTION_STATES.DISCONNECTED);
      break;

    case "wa-authorized":
      info("WebSocket-Client",`WhatsApp authorization status updated: ${message.data.authorized}`);
      if (message.data.authorized) {
        updateStatusUI(CONNECTION_STATES.CONNECTED);
      } else {
        updateStatusUI(CONNECTION_STATES.DISCONNECTED);
      }
      break;

    case "wa-forwarding":
      info("WebSocket-Client",`WhatsApp forwarding status updated: ${message.data.forwarding}`);
      updateForwardingStatus(message.data.forwarding);
      break;

    case "connection-state":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] WhatsApp connection state updated: ${message.data}`);
      updateStatusUI(message.data.state);
      break;

    case "wa-error":
      error("WebSocket-Client",`[${timestamp}] [WebSocket Client] WhatsApp error: ${message.data.message}`);
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] WhatsApp error: ${message.data.message}`
      );
      break;

    case "initial-status":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Initial status received: ${message.data}`);
      updateWhatsAppStatus(message.data.connected);
      setWaAccount(message.data.account);
      updateStatusUI(message.data.state);
      setIsSubscribed(message.data.subscribed);
      break;

    case "wa-groups":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] WhatsApp groups updated: ${message.data}`);
      updateGroupList(message.data);
      break;

    case "wa-authorizing":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] WhatsApp authorizing: ${message.data.authorizing}`);
      updateStatusUI(CONNECTION_STATES.AWAITING_QR); // Update button to "Awaiting QR"
      break;

    case "session-restored":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Session restored.`);
      fetchInitialStatuses(); // Re-fetch initial statuses after restoring a session
      break;
    
    case "config":
      info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Config received:`, message.data);
      wsUrl = message.data.wsUrl; // Update wsUrl
      initializeSocket(); // reconnect with the correct URL
      break;

    default:
      warn("WebSocket-Client",`[${timestamp}] [WebSocket Client] Unknown event received: ${message.event}`);
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] Unknown event: ${message.event}`
      );
      break;
  }
}
/**
 * Updates the WhatsApp connection status in the UI.
 * @param {boolean} connected - WhatsApp connection status.
 */
function updateWhatsAppStatus(connected) {
  const timestamp = new Date().toLocaleString();
  const statusElement = document.getElementById("wa-status-value"); // Corrected element ID
  if (statusElement) {
    statusElement.textContent = `${connected ? "Connected" : "Disconnected"}`;
    statusElement.className = connected ? "connected" : "disconnected";
    info("WebSocket-Client",
      `[${timestamp}] [WebSocket Client] WhatsApp status updated in UI: ${
        connected ? "Connected" : "Disconnected"
      }`
    );
  } else {
    error("WebSocket-Client",
      `[${timestamp}] [WebSocket Client] WhatsApp status element not found in UI.`
    );
    logDisplay.appendLog(
      "log-container-server",
      `WhatsApp status element not found in UI.`
    );
  }
}

/**
 * Updates the script running status in the UI.
 * @param {boolean} running - Script running status.
 */
function updateScriptStatus(running) {
  const timestamp = new Date().toLocaleString();
  const scriptElement = document.getElementById("script-status");
  if (scriptElement) {
    scriptElement.textContent = `Script: ${running ? "Running" : "Stopped"}`;
    info("WebSocket-Client",
      `[${timestamp}] [WebSocket Client] Script status updated in UI: ${
        running ? "Running" : "Stopped"
      }`
    );
  } else {
    error("WebSocket-Client",
      `[${timestamp}] [WebSocket Client] Script status element not found in UI.`
    );
    logDisplay.appendLog(
      "log-container-server",
      `Script status element not found in UI.`
    );
  }
}

/**
 * Updates the group list in the UI with the provided groups data.
 * @param {Array} groups - Array of group objects with 'id' and 'name' properties.
 */
function updateGroupList(groups) {
  const timestamp = new Date().toLocaleString();
  const groupListElement = document.getElementById("group-list");

  if (groupListElement) {
    groupListElement.innerHTML = ""; // Clear existing list

    groups.forEach((group) => {
      const listItem = document.createElement("li");
      listItem.textContent = group.name;
      groupListElement.appendChild(listItem);
    });

    info("WebSocket-Client",`[${timestamp}] [WebSocket Client] Group list updated in UI.`);
  } else {
    error("WebSocket-Client",
      `[${timestamp}] [WebSocket Client] Group list element not found in UI.`
    );
    logDisplay.appendLog(
      "log-container-server",
      "Group list element not found in UI."
    );
  }
}

/**
 * Generate a unique session ID.
 */
function generateSessionId() {
  // Simple example using Math.random (not cryptographically secure)
  return "s" + Math.random().toString(36).substring(2, 15);
}

export { initializeSocket };