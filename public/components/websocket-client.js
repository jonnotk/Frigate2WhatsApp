// components/websocket-client.js
import { qrModal } from "./qr-modal.js";
import { cameraMapping } from "./camera-mapping.js";
import { logDisplay } from "./log-display.js";
import {
  getCameras,
  getIsSubscribed,
  setIsSubscribed,
  getIsSubscribing,
  setIsSubscribing,
  getWaConnected,
  setWaConnected,
  getWaAccount,
  setWaAccount,
} from "../state.js";
import {
  initWhatsAppConnection,
  handleWhatsAppMessage,
  updateStatusUI,
} from "./whatsapp-connection.js";

// Replace setupLogging with browser-compatible logging
const info = console.log;
const warn = console.warn;
const error = console.error;
const debug = console.debug;

let WS_BASE_URL = null;
let socket = null;
let wsUrl = null;

// Track reconnection attempts and initial status fetching
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_BACKOFF = 5000;
let isInitialStatusFetched = false;
let isReconnecting = false;

// Track the last received QR code
let lastQrCode = null;
const QR_UPDATE_THROTTLE_MS = 1000;

// Add a flag to track if the WebSocket is already connecting
let isConnecting = false;

async function initializeSocket() {
  try {
    const response = await fetch("/api/ws-config");
    if (!response.ok) {
      throw new Error("Failed to fetch WebSocket configuration");
    }
    const config = await response.json();
    wsUrl = config.WS_URL;
    WS_BASE_URL = wsUrl.replace(/^ws:\/\//, "");

    let sessionId = sessionStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem("sessionId", sessionId);
    }

    connectWebSocket(sessionId);
  } catch (errorData) {
    error("WebSocket-Client", "Error initializing WebSocket:", errorData);
    logDisplay.appendLog(
      "log-container-server",
      `[WebSocket Client] Error initializing WebSocket: ${errorData.message}`
    );
  }
}

function connectWebSocket(sessionId) {
  if (isConnecting) {
    info("WebSocket-Client", "WebSocket is already connecting. Skipping duplicate call.");
    return;
  }

  isConnecting = true;

  const fullWsUrl = `${wsUrl}?sessionId=${sessionId}`;
  info("WebSocket-Client", `WebSocket URL set to: ${fullWsUrl}`);

  socket = new WebSocket(fullWsUrl);
  window.ws = socket;

  socket.onopen = () => {
    info("WebSocket-Client", "[WebSocket Client] Connection established.");
    logDisplay.appendLog(
      "log-container-server",
      "[WebSocket Client] Connected to server."
    );

    reconnectionAttempts = 0;
    isReconnecting = false;
    isConnecting = false;

    if (!isInitialStatusFetched) {
      fetchInitialStatuses();
      isInitialStatusFetched = true;
    }

    // Initialize WhatsApp Connection after WebSocket is established
    setTimeout(() => {
      initWhatsAppConnection();
    }, 500);
  };

  socket.onclose = () => {
    if (isReconnecting) {
      return;
    }

    isReconnecting = true;
    reconnectionAttempts++;
    if (reconnectionAttempts > MAX_RECONNECTION_ATTEMPTS) {
      error("WebSocket-Client", "Maximum reconnection attempts reached. Stopping reconnection.");
      logDisplay.appendLog(
        "log-container-server",
        "[WebSocket Client] Maximum reconnection attempts reached. Stopping reconnection."
      );
      return;
    }

    const delay = RECONNECTION_BACKOFF * reconnectionAttempts;
    warn("WebSocket-Client", `[WebSocket Client] Connection closed. Reconnecting in ${delay / 1000} seconds...`);
    logDisplay.appendLog(
      "log-container-server",
      `[WebSocket Client] Connection closed. Reconnecting in ${delay / 1000} seconds...`
    );

    isInitialStatusFetched = false;

    setTimeout(() => {
      isReconnecting = false;
      initializeSocket();
    }, delay);
  };
}

  // Event: Connection error
  socket.onerror = (errorData) => {
    error("WebSocket-Client", `[WebSocket Client] Error: ${errorData}`);
    logDisplay.appendLog(
      "log-container-server",
      `[WebSocket Client] Error: ${errorData.message || errorData}`
    );
  };

  // Event: Connection closed
  socket.onclose = () => {
    if (isReconnecting) {
      return; // Skip if already reconnecting
    }

    isReconnecting = true;
    reconnectionAttempts++;
    if (reconnectionAttempts > MAX_RECONNECTION_ATTEMPTS) {
      error("WebSocket-Client", "Maximum reconnection attempts reached. Stopping reconnection.");
      logDisplay.appendLog(
        "log-container-server",
        "[WebSocket Client] Maximum reconnection attempts reached. Stopping reconnection."
      );
      return;
    }

    const delay = RECONNECTION_BACKOFF * reconnectionAttempts; // Exponential backoff
    warn("WebSocket-Client", `[WebSocket Client] Connection closed. Reconnecting in ${delay / 1000} seconds...`);
    logDisplay.appendLog(
      "log-container-server",
      `[WebSocket Client] Connection closed. Reconnecting in ${delay / 1000} seconds...`
    );

    // Reset the initial status flag on reconnection
    isInitialStatusFetched = false;

    // Retry connection after delay
    setTimeout(() => {
      isReconnecting = false;
      initializeSocket();
    }, delay);
  };


/**
 * Handle incoming WebSocket messages.
 * @param {object} message - WebSocket message object.
 */
function handleWebSocketMessage(message) {
  switch (message.event) {
    case "server-connected":
      info("WebSocket-Client", `Server says: ${message.data}`);
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] Server message: ${message.data}`
      );
      break;

    case "qr":
      handleQrCodeMessage(message.data);
      break;

    case "wa-status":
      info("WebSocket-Client", `WhatsApp status updated: ${message.data}`);
      updateWhatsAppStatus(message.data.connected);
      if (message.data.connected) {
        qrModal.autoCloseOnConnection();
      }
      break;

    case "wa-account":
      info("WebSocket-Client", `WhatsApp account updated: ${message.data}`);
      setWaAccount(message.data);
      break;

    case "script-status":
      info("WebSocket-Client", `Script status updated: ${message.data}`);
      updateScriptStatus(message.data.running);
      break;

    case "new-camera":
      info("WebSocket-Client", `New camera detected: ${message.data.camera}`);
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
      updateStatusUI("connected");
      break;

    case "wa-disconnected":
      setWaConnected(false);
      info("WebSocket-Client", "WhatsApp disconnected.");
      updateStatusUI("disconnected");
      break;

    case "wa-authorized":
      info("WebSocket-Client", `WhatsApp authorization status updated: ${message.data.authorized}`);
      if (message.data.authorized) {
        updateStatusUI("connected");
      } else {
        updateStatusUI("disconnected");
      }
      break;

    case "connection-state":
      info("WebSocket-Client", `WhatsApp connection state updated: ${message.data}`);
      updateStatusUI(message.data.state);
      break;

    case "wa-error":
      error("WebSocket-Client", `WhatsApp error: ${message.data.message}`);
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] WhatsApp error: ${message.data.message}`
      );
      break;

    case "initial-status":
      info("WebSocket-Client", `Initial status received: ${message.data}`);
      updateWhatsAppStatus(message.data.connected);
      setWaAccount(message.data.account);
      updateStatusUI(message.data.state);
      setIsSubscribed(message.data.subscribed);
      break;

    case "wa-groups":
      info("WebSocket-Client", `WhatsApp groups updated: ${message.data}`);
      updateGroupList(message.data);
      break;

    case "wa-authorizing":
      info("WebSocket-Client", `WhatsApp authorizing: ${message.data.authorizing}`);
      updateStatusUI("awaiting_qr"); // Update button to "Awaiting QR"
      break;

    case "session-restored":
      info("WebSocket-Client", `Session restored.`);
      fetchInitialStatuses(); // Re-fetch initial statuses after restoring a session
      break;

    case "config":
      info("WebSocket-Client", `Config received:`, message.data);
      wsUrl = message.data.wsUrl; // Update wsUrl
      initializeSocket(); // reconnect with the correct URL
      break;

    case "camera-group-updated":
      info("WebSocket-Client", `Camera group mapping updated: ${message.data}`);
      cameraMapping.loadCameras(); // Refresh the camera list
      break;

    default:
      warn("WebSocket-Client", `Unknown event received: ${message.event}`);
      logDisplay.appendLog(
        "log-container-server",
        `[WebSocket Client] Unknown event: ${message.event}`
      );
      break;
  }
}

/**
 * Handle QR code messages.
 * @param {string} qrData - The QR code data.
 */
function handleQrCodeMessage(qrData) {
  if (qrData === lastQrCode) {
    debug("WebSocket-Client", "Received duplicate QR code. Skipping update.");
    return;
  }

  lastQrCode = qrData; // Update the last received QR code
  info("WebSocket-Client", "QR Code received.");
  qrModal.updateQR(qrData);
}

/**
 * Fetch initial statuses for WhatsApp and script.
 */
async function fetchInitialStatuses() {
  // Fetch WhatsApp status
  try {
    const waStatusResponse = await fetch("/api/wa/status");
    const waStatusData = await waStatusResponse.json();

    if (waStatusData.success) {
      info("WebSocket-Client", `Initial WhatsApp status: ${waStatusData.data}`);
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
        info("WebSocket-Client", `Subscription status updated to: ${subscriptionData.data.subscribed}`);
      } else {
        warn("WebSocket-Client", `Failed to fetch subscription status: ${subscriptionData.error}`);
      }
    } else {
      warn("WebSocket-Client", `Failed to fetch WhatsApp status: ${waStatusData.error}`);
      logDisplay.appendLog(
        "log-container-server",
        `Failed to fetch WhatsApp status: ${waStatusData.error}`
      );
    }
  } catch (errorData) {
    error("WebSocket-Client", `Error fetching WhatsApp status: ${errorData}`);
    logDisplay.appendLog(
      "log-container-server",
      `Error fetching WhatsApp status: ${errorData.message}`
    );
  }

  // Fetch script status
  try {
    const scriptStatusResponse = await fetch("/api/script/status");
    const scriptStatusData = await scriptStatusResponse.json();

    if (scriptStatusData.success) {
      info("WebSocket-Client", `Initial script status: ${scriptStatusData.data}`);
      updateScriptStatus(scriptStatusData.data.running);
    } else {
      warn("WebSocket-Client", `Failed to fetch script status: ${scriptStatusData.error}`);
      logDisplay.appendLog(
        "log-container-server",
        `Failed to fetch script status: ${scriptStatusData.error}`
      );
    }
  } catch (errorData) {
    error("WebSocket-Client", `Error fetching script status: ${errorData}`);
    logDisplay.appendLog(
      "log-container-server",
      `Error fetching script status: ${errorData.message}`
    );
  }
}

/**
 * Updates the WhatsApp connection status in the UI.
 * @param {boolean} connected - WhatsApp connection status.
 */
function updateWhatsAppStatus(connected) {
  const statusElement = document.getElementById("wa-status-value");
  if (statusElement) {
    statusElement.textContent = `${connected ? "Connected" : "Disconnected"}`;
    statusElement.className = connected ? "connected" : "disconnected";
    info("WebSocket-Client", `WhatsApp status updated in UI: ${connected ? "Connected" : "Disconnected"}`);
  } else {
    error("WebSocket-Client", `WhatsApp status element not found in UI.`);
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
  const scriptElement = document.getElementById("script-status");
  if (scriptElement) {
    scriptElement.textContent = `Script: ${running ? "Running" : "Stopped"}`;
    info("WebSocket-Client", `Script status updated in UI: ${running ? "Running" : "Stopped"}`);
  } else {
    error("WebSocket-Client", `Script status element not found in UI.`);
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
  const groupListElement = document.getElementById("group-list");

  if (groupListElement) {
    groupListElement.innerHTML = ""; // Clear existing list

    groups.forEach((group) => {
      const listItem = document.createElement("li");
      listItem.textContent = group.name;
      groupListElement.appendChild(listItem);
    });

    info("WebSocket-Client", `Group list updated in UI.`);
  } else {
    error("WebSocket-Client", `Group list element not found in UI.`);
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