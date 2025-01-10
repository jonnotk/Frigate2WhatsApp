// components/websocket-client.js
import { qrModal } from "./qr-modal.js";
import { cameraMapping } from "./camera-mapping.js";
import {
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
  } catch (errorData) {
    console.error("WebSocket-Client", "Error initializing WebSocket:", errorData);
    // Consider retrying or displaying an error message to the user
  }
}

function connectWebSocket(sessionId) {
  // Construct the WebSocket URL with the session ID as a query parameter
  const fullWsUrl = `<span class="math-inline">\{wsUrl\}?sessionId\=</span>{sessionId}`;
  console.info("WebSocket-Client", `WebSocket URL set to: ${fullWsUrl}`);

  // Create WebSocket connection to the server
  socket = new WebSocket(fullWsUrl);

  // Store the WebSocket instance in the global scope
  window.ws = socket;

  // Event: Connection opened
  socket.onopen = () => {
    console.info("WebSocket-Client", "[WebSocket Client] Connection established.");
    // Fetch initial statuses after connection
    fetchInitialStatuses();
    // Initialize WhatsApp Connection after WebSocket is established
    initWhatsAppConnection();
  };

  // Event: Message received
  socket.onmessage = (event) => {
    console.debug("WebSocket-Client",`[WebSocket Client] Message received: ${event.data}`);

    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (errorData) {
      console.error("WebSocket-Client",`Error processing message: ${errorData}`);
    }
  };

  // Event: Connection error
  socket.onerror = (errorData) => {
    console.error("WebSocket-Client",`[WebSocket Client] Error: ${errorData}`);
  };

  // Event: Connection closed
  socket.onclose = () => {
    console.warn("WebSocket-Client",`[WebSocket Client] Connection closed. Reconnecting in 5 seconds...`);
    setTimeout(initializeSocket, 5000); // Retry connection after 5 seconds
  };
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
      console.info("WebSocket-Client",`Initial WhatsApp status: ${waStatusData.data}`);
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
        console.info("WebSocket-Client",`Subscription status updated to: ${subscriptionData.data.subscribed}`);
      } else {
        console.warn("WebSocket-Client",`Failed to fetch subscription status: ${subscriptionData.error}`);
      }
    } else {
      console.warn("WebSocket-Client",`Failed to fetch WhatsApp status: ${waStatusData.error}`);
    }
  } catch (errorData) {
    console.error("WebSocket-Client",`Error fetching WhatsApp status: ${errorData}`);
  }

  // Fetch script status
  try {
    const scriptStatusResponse = await fetch("/api/script/status");
    const scriptStatusData = await scriptStatusResponse.json();

    if (scriptStatusData.success) {
      console.info("WebSocket-Client",`Initial script status: ${scriptStatusData.data}`);
      updateScriptStatus(scriptStatusData.data.running);
    } else {
      console.warn("WebSocket-Client",`Failed to fetch script status: ${scriptStatusData.error}`);
    }
  } catch (errorData) {
    console.error("WebSocket-Client",`Error fetching script status: ${errorData}`);
  }
}
/**
 * Handle incoming WebSocket messages.
 * @param {object} message - WebSocket message object.
 */
function handleWebSocketMessage(message) {
  switch (message.event) {
    case "server-connected":
      console.info("WebSocket-Client",`Server says: ${message.data}`);
      break;

    case "qr":
      console.info("WebSocket-Client",`QR Code received.`);
      qrModal.updateQR(message.data);
      break;

    case "wa-status":
      console.info("WebSocket-Client",`WhatsApp status updated: ${message.data}`);
      updateWhatsAppStatus(message.data.connected);
      if (message.data.connected) {
        qrModal.autoCloseOnConnection();
      }
      break;

    case "wa-account":
      console.info("WebSocket-Client",`WhatsApp account updated:`, message.data);
      setWaAccount(message.data);
      break;

    case "script-status":
      console.info("WebSocket-Client",`Script status updated: ${message.data}`);
      updateScriptStatus(message.data.running);
      break;

    case "new-camera":
      console.info("WebSocket-Client",`New camera detected: ${message.data.camera}`);
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
      console.info("WebSocket-Client", "WhatsApp connected.");
      updateStatusUI("connected");
      break;

    case "wa-disconnected":
      setWaConnected(false);
      console.info("WebSocket-Client", "WhatsApp disconnected.");
      updateStatusUI("disconnected");
      break;

    case "wa-authorized":
      console.info("WebSocket-Client",`WhatsApp authorization status updated: ${message.data.authorized}`);
      if (message.data.authorized) {
        updateStatusUI("connected");
      } else {
        updateStatusUI("disconnected");
      }
      break;

    case "connection-state":
      console.info("WebSocket-Client",`WhatsApp connection state updated: ${message.data}`);
      updateStatusUI(message.data.state);
      break;

    case "wa-error":
      console.error("WebSocket-Client",`WhatsApp error: ${message.data.message}`);
      break;

    case "initial-status":
      console.info("WebSocket-Client",`Initial status received:`, message.data);
      updateWhatsAppStatus(message.data.connected);
      setWaAccount(message.data.account);
      updateStatusUI(message.data.state);
      setIsSubscribed(message.data.subscribed);
      break;

    case "wa-groups":
      console.info("WebSocket-Client",`WhatsApp groups updated:`, message.data);
      updateGroupList(message.data);
      break;
      
    case "wa-group-joined":
        console.info("WebSocket-Client", `New group joined:`, message.data);
        // You might want to just refresh the group list here
        // instead of calling getGroups again
        updateGroupList(message.data);
        break;

      case "wa-group-left":
        console.info("WebSocket-Client", `Left a group:`, message.data);
        // Similarly, you might want to refresh the group list
        updateGroupList(message.data);
        break;

      case "wa-group-membership-request":
        console.info("WebSocket-Client", "Received a group membership request", message.data);
        // Here, instead of calling a function that may not exist,
        // you should update your UI or state to reflect the new request
        updateGroupMembershipRequest(message.data);
        break;

    case "wa-authorizing":
      console.info("WebSocket-Client",`WhatsApp authorizing: ${message.data.authorizing}`);
      updateStatusUI("awaiting_qr"); // Update button to "Awaiting QR"
      break;

    case "session-restored":
      console.info("WebSocket-Client",`Session restored.`);
      fetchInitialStatuses(); // Re-fetch initial statuses after restoring a session
      break;

    case "config":
      console.info("WebSocket-Client",`Config received:`, message.data);
      wsUrl = message.data.wsUrl; // Update wsUrl
      initializeSocket(); // reconnect with the correct URL
      break;

    case "camera-group-updated":
      console.info("WebSocket-Client", `Camera group mapping updated:`, message.data);
      cameraMapping.loadCameras(); // Refresh the camera list
      break;

    default:
      console.warn("WebSocket-Client",`Unknown event received: ${message.event}`);
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
    console.info("WebSocket-Client",`WhatsApp status updated in UI: ${connected ? "Connected" : "Disconnected"}`);
  } else {
    console.error("WebSocket-Client",
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
    console.info("WebSocket-Client",`Script status updated in UI: ${running ? "Running" : "Stopped"}`);
  } else {
    console.error("WebSocket-Client",
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
      listItem.textContent = group.name + (group.isMember ? " (Member)" : "") + (group.isAdmin ? " (Admin)" : "");
      groupListElement.appendChild(listItem);
    });

    console.info("WebSocket-Client",`Group list updated in UI.`);
  } else {
    console.error("WebSocket-Client",
      `Group list element not found in UI.`
    );
  }
}

/**
 * Updates the UI to reflect a new group membership request.
 * @param {object} request - The group membership request data.
 */
function updateGroupMembershipRequest(request) {
    const groupRequestsList = document.getElementById("membership-requests-list");
    if (groupRequestsList) {
      const listItem = document.createElement("li");
      listItem.textContent = `Request to join ${request.groupName} by ${request.userName}`;
      // Potentially add buttons or links to approve/reject the request
      groupRequestsList.appendChild(listItem);
    } else {
      console.error("WebSocket-Client", "Group membership requests list not found in UI.");
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