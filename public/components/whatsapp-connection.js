// components/whatsapp-connection.js
import { logDisplay } from "./log-display.js";
import {
  getIsSubscribed,
  setIsSubscribed,
  getIsSubscribing,
  setIsSubscribing,
  getWaConnected,
  setWaConnected,
  getWaAccount,
} from "../state.js";
import { showQRModal } from "./qr-modal.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, warn, error, debug } = setupLogging();

// State management
let connectionState = "disconnected";

/**
 * Updates the connection state and logs the change.
 * @param {string} state - The new connection state.
 */
function updateConnectionState(state) {
    const validStates = [
        "initializing",
        "qr_received",
        "awaiting_qr",
        "loading",
        "failed_restore",
        "timeout",
        "connected",
        "authenticated",
        "disconnected",
        "auth_failure",
        "initialization_failed",
        "destroyed",
        "conflict",
        "unlaunched",
        "unpaired",
        "unpaired_idle",
        "not_ready",
        "proxy_error",
        "subscribing",
        "unsubscribing"
    ];

    if (!validStates.includes(state)) {
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
  updateConnectionState("initializing");
  sendWebSocketMessage("wa-subscribe-request", {});
}

/**
 * Handle the authorize/unauthorize button click.
 */
async function handleAuthorize() {
    const authorizeButton = document.getElementById("authorize-button");
    const connected = getWaConnected();
    const account = getWaAccount();

    if (connected && account.name !== null) {
        // Unauthorize
        info("WhatsApp-Connection", "Unauthorizing WhatsApp...");
        updateConnectionState("unsubscribing");
        sendWebSocketMessage("wa-unsubscribe-request", { authorize: false });
        authorizeButton.textContent = "Unauthorize";
        authorizeButton.disabled = true;
    } else {
        // Authorize
        info("WhatsApp-Connection", "Authorizing WhatsApp...");
        updateConnectionState("subscribing");
        showQRModal();
        sendWebSocketMessage("wa-subscribe-request", { authorize: true });
        authorizeButton.textContent = "Authorize";
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
    const authorizeButton = document.getElementById("authorize-button");
    switch (message.event) {
        case "wa-subscribed":
            setIsSubscribed(true);
            setIsSubscribing(false);
            info("WhatsApp-Connection", "Successfully subscribed to WhatsApp.");
            authorizeButton.textContent = "Unauthorize";
            authorizeButton.disabled = false;
            // Show popup only after successful subscription
            showPopup("Successfully subscribed to WhatsApp.", "popup-subscribed");
            break;

        case "wa-unsubscribed":
            setIsSubscribed(false);
            setIsSubscribing(false);
            setWaConnected(false); // Ensure connection status is updated
            info("WhatsApp-Connection", "Successfully unsubscribed from WhatsApp.");
            updateConnectionState("disconnected");
            authorizeButton.textContent = "Authorize";
            authorizeButton.disabled = false;
            // Consider whether to show a popup here or not
            break;

        case "wa-connected":
            setWaConnected(true);
            info("WhatsApp-Connection", "WhatsApp connected.");
            updateConnectionState("connected");
            // Update button text based on new state
            authorizeButton.textContent = "Unauthorize";
            authorizeButton.disabled = false;
            showPopup("WhatsApp connected.", "popup-connected");
            break;
    
        case "wa-disconnected":
            setWaConnected(false);
            info("WhatsApp-Connection", "WhatsApp disconnected.");
            updateConnectionState("disconnected");
            // Update button text based on new state
            authorizeButton.textContent = "Authorize";
            authorizeButton.disabled = false;
            showPopup("WhatsApp disconnected.", "popup-disconnected");
            break;

        case "wa-authorized":
            info("WhatsApp-Connection", `WhatsApp authorization status updated: ${message.data.authorized}`);
            if (message.data.authorized) {
                updateConnectionState("connected");
                authorizeButton.textContent = "Unauthorize";
                authorizeButton.disabled = false;
            } else {
                updateConnectionState("disconnected");
                authorizeButton.textContent = "Authorize";
                authorizeButton.disabled = false;
            }
            break;

        case "wa-forwarding":
            info("WhatsApp-Connection", `WhatsApp forwarding status updated: ${message.data.forwarding}`);
            updateForwardingStatus(message.data.forwarding);
            break;

        case "connection-state":
            info("WhatsApp-Connection", `WhatsApp connection state updated: ${message.data.state}`);
            updateConnectionState(message.data.state);
            break;

        case "wa-error":
            error("WhatsApp-Connection", `WhatsApp error: ${message.data.message}`);
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
      case "connected":
        statusSpan.classList.add("connected");
        break;
      case "disconnected":
        statusSpan.classList.add("disconnected");
        break;
      case "awaiting_qr":
      case "connecting":
      case "loading":
      case "authenticated":
      case "subscribing":
        statusSpan.classList.add("connecting");
        break;
      case "initialization_failed":
      case "authentication_failed":
      case "proxy_error":
      case "unsubscribing":
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