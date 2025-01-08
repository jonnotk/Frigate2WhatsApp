// components/whatsapp-connection.js
import { logDisplay } from "./log-display.js";
import {
  getIsSubscribed,
  setIsSubscribed,
  getIsSubscribing,
  setIsSubscribing,
  getWaConnected,
  setWaConnected,
} from "../state.js";
import { showQRModal } from "./qr-modal.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, warn, error, debug } = setupLogging();

// State management
let connectionState = CONNECTION_STATES.DISCONNECTED;

/**
 * Updates the connection state and logs the change.
 * @param {string} state - The new connection state.
 */
function updateConnectionState(state) {
  if (!Object.values(CONNECTION_STATES).includes(state)) {
    const errorMessage = `Unknown connection state received: ${state}`;
    error("WhatsApp-Connection", errorMessage);
    logDisplay.appendLog("log-container-server", errorMessage);
    sendWebSocketMessage("error", { message: errorMessage });
    return;
  }

  connectionState = state;
  info("WhatsApp-Connection", `Connection state updated: ${state}`);
  updateStatusUI(state);
}

/**
 * Sends a message to the WebSocket server.
 * @param {string} event - The event name.
 * @param {object} data - The message data.
 */
function sendWebSocketMessage(event, data) {
  const socket = window.ws;
  if (socket && socket.readyState === WebSocket.OPEN) {
    const message = JSON.stringify({ event, data });
    socket.send(message);
    debug("WhatsApp-Connection", `WebSocket message sent: ${event}`, data);
  } else {
    warn(
      "WhatsApp-Connection",
      `WebSocket not connected. Cannot send message: ${event}`
    );
  }
}

/**
 * Retries a function with a specified number of retries and delay.
 * @param {function} fn - The function to retry.
 * @param {number} retries - Number of retries.
 * @param {number} delay - Delay between retries in milliseconds.
 * @returns {Promise} - The result of the function.
 */
async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      info("WhatsApp-Connection",`Retrying... (${retries} attempts left)`, {
        error: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
}

/**
 * Initializes the WhatsApp Connection module.
 */
function initialize() {
  info("WhatsApp-Connection", "Initializing...");

  // Attach event listeners to buttons
  document
    .getElementById("subscribe-whatsapp-button")
    ?.addEventListener("click", subscribeWhatsApp);
  document
    .getElementById("unsubscribe-whatsapp-button")
    ?.addEventListener("click", unsubscribeWhatsApp);
  document
    .getElementById("connect-whatsapp-button")
    ?.addEventListener("click", connectWhatsApp);
  document
    .getElementById("disconnect-whatsapp-button")
    ?.addEventListener("click", disconnectWhatsApp);
  document
    .getElementById("authorize-button")
    ?.addEventListener("click", handleAuthorize);
  document
    .getElementById("forwarding-toggle")
    ?.addEventListener("change", handleForwardingToggle);

  info("WhatsApp-Connection", "Initialized.");
}

// Function to start the WhatsApp authorization process
function initWhatsAppConnection() {
  if (getWaConnected()) {
    info(
      "WhatsApp-Connection",
      "WhatsApp is already connected. Skipping initialization."
    );
    return;
  }

  info("WhatsApp-Connection", "Initializing WhatsApp connection...");
  updateConnectionState(CONNECTION_STATES.INITIALIZING);
  sendWebSocketMessage("wa-subscribe-request", {});
}

/**
 * Initiates the WhatsApp subscription process.
 */
function subscribeWhatsApp() {
  info("WhatsApp-Connection", "Subscribing to WhatsApp...");
  setIsSubscribing(true);
  updateConnectionState(CONNECTION_STATES.SUBSCRIBING);
  sendWebSocketMessage("wa-subscribe-request", {});
}

/**
 * Unsubscribes from WhatsApp.
 */
function unsubscribeWhatsApp() {
  info("WhatsApp-Connection", "Unsubscribing from WhatsApp...");
  setIsSubscribing(false);
  updateConnectionState(CONNECTION_STATES.UNSUBSCRIBING);
  sendWebSocketMessage("wa-unsubscribe-request", {});
}

/**
 * Connects to WhatsApp.
 */
function connectWhatsApp() {
  info("WhatsApp-Connection", "Connecting to WhatsApp...");
  updateConnectionState(CONNECTION_STATES.CONNECTING);
  sendWebSocketMessage("wa-connect-request", {});
}

/**
 * Disconnects from WhatsApp.
 */
function disconnectWhatsApp() {
  info("WhatsApp-Connection", "Disconnecting from WhatsApp...");
  updateConnectionState(CONNECTION_STATES.DISCONNECTING);
  sendWebSocketMessage("wa-disconnect-request", {});
}
/**
 * Handle the authorize/unauthorize button click.
 */
async function handleAuthorize() {
  const authorizeButton = document.getElementById("authorize-button");
  const connected = getWaConnected();

  if (connected) {
    // Unauthorize
    info("WhatsApp-Connection", "Unauthorizing WhatsApp...");
    sendWebSocketMessage("wa-authorize-request", { authorize: false });
    authorizeButton.textContent = "Authorize";
    authorizeButton.disabled = false;
  } else {
    // Authorize
    info("WhatsApp-Connection", "Authorizing WhatsApp...");
    showQRModal();
    sendWebSocketMessage("wa-authorize-request", { authorize: true });
    authorizeButton.textContent = "Awaiting QR";
    authorizeButton.disabled = true;
  }
}

/**
 * Handle the forwarding toggle change.
 */
function handleForwardingToggle(event) {
  const forwarding = event.target.checked;
  info("WhatsApp-Connection",`Forwarding ${forwarding ? "enabled" : "disabled"}`);
  sendWebSocketMessage("wa-forwarding-request", { forwarding });
}

/**
 * Displays a popup message for 15 seconds or until the user closes it.
 * @param {string} message - The message to display.
 * @param {string} popupId - The unique ID for the popup.
 */
function showPopup(message, popupId) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.id = popupId; // Add a unique ID
  popup.textContent = message;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 15000); // Remove popup after 15 seconds

  popup.addEventListener("click", () => {
    popup.remove();
  });
}

/**
 * Handle incoming WebSocket messages related to WhatsApp connection.
 * @param {object} message - WebSocket message object.
 */
function handleWhatsAppMessage(message) {
  switch (message.event) {
    case "wa-subscribed":
      setIsSubscribed(true);
      setIsSubscribing(false);
      info("WhatsApp-Connection", "Successfully subscribed to WhatsApp.");
      showPopup("Successfully subscribed to WhatsApp.", "popup-subscribed");
      break;

    case "wa-unsubscribed":
      setIsSubscribed(false);
      setIsSubscribing(false);
      info("WhatsApp-Connection", "Successfully unsubscribed from WhatsApp.");
      // Only show the popup if the unsubscription was intentional (e.g., user clicked Unsubscribe)
      // You might need additional logic to track intentional vs. unintentional unsubscriptions
      // if (!message.data.intentional) {
      //  showPopup("Successfully unsubscribed from WhatsApp.", "popup-unsubscribed");
      // }
      break;

    case "wa-connected":
      setWaConnected(true);
      info("WhatsApp-Connection", "WhatsApp connected.");
      showPopup("WhatsApp connected.", "popup-connected");
      updateConnectionState(CONNECTION_STATES.CONNECTED);
      break;

    case "wa-disconnected":
      setWaConnected(false);
      info("WhatsApp-Connection", "WhatsApp disconnected.");
      showPopup("WhatsApp disconnected.", "popup-disconnected");
      updateConnectionState(CONNECTION_STATES.DISCONNECTED);
      break;

    case "wa-authorized":
      info("WhatsApp-Connection",`WhatsApp authorization status updated: ${message.data.authorized}`);
      if (message.data.authorized) {
        updateConnectionState(CONNECTION_STATES.CONNECTED);
      } else {
        updateConnectionState(CONNECTION_STATES.DISCONNECTED);
      }
      break;

    case "wa-forwarding":
      info("WhatsApp-Connection",`WhatsApp forwarding status updated: ${message.data.forwarding}`);
      updateForwardingStatus(message.data.forwarding);
      break;

    case "connection-state":
      info("WhatsApp-Connection",`WhatsApp connection state updated: ${message.data.state}`);
      updateConnectionState(message.data.state);
      break;

    case "wa-error":
      error("WhatsApp-Connection",`WhatsApp error: ${message.data.message}`);
      // Only show error popups if they are not related to routine operations (like QR code expiration)
      if (!message.data.message.includes("QR code expired")) {
        showPopup(`Error: ${message.data.message}`, "popup-error");
      }
      break;

    case "error":
      error("WhatsApp-Connection", `Error: ${message.data}`);
      showPopup(`Error: ${message.data}`, "popup-error");
      break;

    default:
      warn("WhatsApp-Connection", `Unknown event received: ${message.event}`);
      showPopup(`Unknown event: ${message.event}`, "popup-unknown-event");
  }
}

/**
 * Updates the forwarding status in the UI.
 * @param {boolean} forwarding - The new forwarding status.
 */
function updateForwardingStatus(forwarding) {
  const forwardingToggle = document.getElementById("forwarding-toggle");
  if (forwardingToggle) {
    forwardingToggle.checked = forwarding;
    info("WhatsApp-Connection",`Forwarding status updated in UI: ${forwarding ? "Enabled" : "Disabled"}`);
  } else {
    warn("WhatsApp-Connection", "Forwarding toggle not found in UI.");
  }
}
/**
 * Updates the connection state in the UI.
 * @param {string} state - The new connection state.
 */
function updateStatusUI(state) {
  const stateElement = document.getElementById("wa-state");
  const statusSpan = document.getElementById("status");

  if (stateElement && statusSpan) {
    statusSpan.textContent = `${state}`;
    statusSpan.className = ''; // Reset class names

    // Add visual cues based on state
    switch (state) {
      case CONNECTION_STATES.CONNECTED:
        statusSpan.classList.add("connected");
        break;
      case CONNECTION_STATES.DISCONNECTED:
        statusSpan.classList.add("disconnected");
        break;
      case CONNECTION_STATES.AWAITING_QR:
      case CONNECTION_STATES.CONNECTING:
      case CONNECTION_STATES.LOADING:
      case CONNECTION_STATES.AUTHENTICATED:
        statusSpan.classList.add("connecting");
        break;
      case CONNECTION_STATES.INITIALIZATION_FAILED:
      case CONNECTION_STATES.AUTHENTICATION_FAILED:
      case CONNECTION_STATES.PROXY_ERROR:
        statusSpan.classList.add("error");
        break;
      default:
        statusSpan.classList.add("unknown");
    }

    info("WhatsApp-Connection",`Connection state updated in UI: ${state}`);
  } else {
    warn("WhatsApp-Connection","Connection state element (wa-state or status) not found in UI.");
  }
}

export {
  initialize,
  initWhatsAppConnection,
  handleWhatsAppMessage,
  updateConnectionState,
  updateStatusUI,
  updateForwardingStatus,
  retry,
};