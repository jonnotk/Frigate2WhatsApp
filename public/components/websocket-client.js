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
    on,
} from "../state.js";
import {
  initializeWhatsAppConnection,
  handleWhatsAppMessage,
  updateStatusUI,
} from "./whatsapp-connection.js";

let socket = null;
let wsUrl = null; // moved variable declaration outside of function

async function initializeSocket() {
  try {
    // Fetch WebSocket URL from the server
    const response = await fetch("/api/ws-config");
    if (!response.ok) {
      throw new Error("Failed to fetch WebSocket configuration");
    }
    const config = await response.json();

    // Retrieve or generate a session ID
    let sessionId = sessionStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem("sessionId", sessionId);
    }

    connectWebSocket(sessionId, config.WS_URL);
  } catch (errorData) {
    console.error("WebSocket-Client", "Error initializing WebSocket:", errorData);
  }
}

function connectWebSocket(sessionId, wsUrl) {
  // Construct the WebSocket URL with the session ID as a query parameter
  const fullWsUrl = `${wsUrl}?sessionId=${sessionId}`
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
        initializeWhatsAppConnection();
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
    console.warn("WebSocket-Client", "Connection closed. Reconnecting in 5 seconds...");
    setTimeout(() => {
        initializeSocket(); // Reconnect WebSocket
    }, 5000);
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
            console.info("WebSocket-Client", `Initial WhatsApp status: ${waStatusData.data}`);
            // updateWhatsAppStatus(waStatusData.data.connected); Removed 
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
                console.info("WebSocket-Client", `Subscription status updated to: ${subscriptionData.data.subscribed}`);
            } else {
                console.warn("WebSocket-Client", `Failed to fetch subscription status: ${subscriptionData.error}`);
            }
        } else {
            console.warn("WebSocket-Client", `Failed to fetch WhatsApp status: ${waStatusData.error}`);
        }
    } catch (errorData) {
        console.error("WebSocket-Client", `Error fetching WhatsApp status: ${errorData}`);
    }

    // Fetch script status
    try {
        const scriptStatusResponse = await fetch("/api/script/status");
        const scriptStatusData = await scriptStatusResponse.json();

        if (scriptStatusData.success) {
            console.info("WebSocket-Client", `Initial script status: ${scriptStatusData.data}`);
            updateStatusUI(scriptStatusData.data.running ? "running" : "stopped"); // Use updateStatusUI for script status as well
        } else {
            console.warn("WebSocket-Client", `Failed to fetch script status: ${scriptStatusData.error}`);
        }
    } catch (errorData) {
        console.error("WebSocket-Client", `Error fetching script status: ${errorData}`);
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

    case "qr-code-update":
      console.info("WebSocket-Client",`QR Code received.`);
      qrModal.updateQR(message.data);
      break;

    case "wa-status-update":
            console.info("WebSocket-Client", `WhatsApp status updated: ${message.data}`);
            updateStatusUI(message.data.connected ? "connected" : "disconnected"); // Correctly call updateStatusUI
            if (message.data.connected) {
                qrModal.autoCloseOnConnection();
            }
            break;

    case "wa-account-update":
      console.info("WebSocket-Client",`WhatsApp account updated:`, message.data);
      setWaAccount(message.data);
      break;

    case "script-status":
      console.info("WebSocket-Client",`Script status updated: ${message.data}`);
      updateScriptStatus(message.data.running);
      break;

    case "cameras-update":
      console.info("WebSocket-Client",`New camera detected: ${message.data.camera}`);
      cameraMapping.loadCameras();
      break;

    case "is-subscribed-update":
      setIsSubscribed(message.data);
      console.info("WebSocket-Client",`WhatsApp isSubscribed updated: ${message.data}`);
      break;

    case "is-subscribing-update":
      setIsSubscribing(message.data);
      console.info("WebSocket-Client",`WhatsApp isSubscribing updated: ${message.data}`);
      break;

    case "wa-connected-update":
      setWaConnected(message.data);
      console.info("WebSocket-Client", "WhatsApp connected update.");
      updateStatusUI(message.data ? "connected" : "disconnected");
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

    case "connection-state-update":
      console.info("WebSocket-Client",`WhatsApp connection state updated: ${message.data}`);
      updateStatusUI(message.data);
      break;

    case "wa-error":
      console.error("WebSocket-Client",`WhatsApp error: ${message.data.message}`);
      break;

    case "initial-status":
            console.info("WebSocket-Client", `Initial status received:`, message.data);
            // updateWhatsAppStatus(message.data.connected); // Remove this line, we use updateStatusUI instead
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
        updateGroupList(message.data);
        break;

      case "wa-group-left":
        console.info("WebSocket-Client", `Left a group:`, message.data);
        updateGroupList(message.data);
        break;

      case "wa-group-membership-request":
        console.info("WebSocket-Client", "Received a group membership request", message.data);
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

    case "camera-group-updated":
      console.info("WebSocket-Client", `Camera group mapping updated:`, message.data);
      cameraMapping.loadCameras(); // Refresh the camera list
      break;

    case "config":
      console.info("WebSocket-Client",`Config received:`, message.data);
      wsUrl = message.data.wsUrl; // Update wsUrl
      initializeSocket(); // reconnect with the correct URL
      break;

    default:
      console.warn("WebSocket-Client",`Unknown event received: ${message.event}`);
  }
}

// Listen for state change events and send WebSocket messages accordingly
on("cameras-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "cameras-update", data }));
  }
});

on("wa-connected-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "wa-connected-update", data }));
  }
});

on("wa-account-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "wa-account-update", data }));
  }
});

on("qr-code-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "qr-code-update", data }));
  }
});

on("camera-group-mappings-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "camera-group-mappings-update", data }));
  }
});

on("is-subscribed-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "is-subscribed-update", data }));
  }
});

on("is-subscribing-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: "is-subscribing-update", data }));
  }
});

on("connection-state-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: "connection-state-update", data }));
  }
});

on("group-membership-requests-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: "group-membership-requests-update", data }));
  }
});

on("script-process-update", (data) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: "script-process-update", data }));
  }
});

export { initializeSocket };