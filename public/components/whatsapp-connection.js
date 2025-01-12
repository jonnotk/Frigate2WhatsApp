// components/whatsapp-connection.js
import {
    getIsSubscribed,
    setIsSubscribed,
    getIsSubscribing,
    setIsSubscribing,
    getWaConnected,
    setWaConnected,
    getWaAccount,
    setWaAccount,
    getConnectionState,
  } from "../state.js";
  import { showQRModal } from "./qr-modal.js";
  
  /**
   * Updates the connection state and logs the change.
   * @param {string} state - The new connection state.
   */
  function updateConnectionState(state) {
      console.info("WhatsApp-Connection", `Connection state updated: ${state}`);
      updateStatusUI(state);
  }
  
  /**
   * Sends a message to the WebSocket server.
   * @param {string} event - The event name.
   * @param {object} data - The message data.
   */
  function sendWebSocketMessage(event, data) {
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ event, data });
      window.ws.send(message);
      console.debug("WhatsApp-Connection", `WebSocket message sent: ${event}`, data);
    } else {
      console.warn(
        "WhatsApp-Connection",
        `WebSocket not connected. Cannot send message: ${event}`
      );
    }
  }
  
  /**
   * Initializes the WhatsApp Connection module.
   */
  let isInitialized = false;

function initializeWhatsAppConnection() {
    if (isInitialized) {
        console.warn("WhatsApp-Connection", "Already initialized. Skipping.");
        return;
    }
    isInitialized = true;

    console.info("WhatsApp-Connection", "Initializing...");
  
    // Attach event listeners to buttons
    document
      .getElementById("authorize-button")
      ?.addEventListener("click", handleAuthorize);
    document
      .getElementById("forwarding-toggle")
      ?.addEventListener("change", handleForwardingToggle);
  
    // Set the initial state of the authorize button
    const connected = getWaConnected();
    const account = getWaAccount();
    updateAuthorizeButton(connected && account.number !== null);
  
    console.info("WhatsApp-Connection", "Initialized.");
  }
  
  // Function to start the WhatsApp authorization process
  function initWhatsAppConnection() {
    if (getWaConnected()) {
      console.info(
        "WhatsApp-Connection",
        "WhatsApp is already connected. Skipping initialization."
      );
      return;
    }
  
    console.info("WhatsApp-Connection", "Initializing WhatsApp connection...");
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
          console.info("WhatsApp-Connection", "Unauthorizing WhatsApp...");
          updateConnectionState("unsubscribing");
          sendWebSocketMessage("wa-unsubscribe-request", { authorize: false });
          authorizeButton.textContent = "Unauthorize";
          authorizeButton.disabled = true;
      } else {
          // Authorize
          console.info("WhatsApp-Connection", "Authorizing WhatsApp...");
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
    console.info("WhatsApp-Connection",`Forwarding ${forwarding ? "enabled" : "disabled"}`);
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
              console.info("WhatsApp-Connection", "Successfully subscribed to WhatsApp.");
              authorizeButton.textContent = "Unauthorize";
              authorizeButton.disabled = false;
              // Show popup only after successful subscription
              showPopup("Successfully subscribed to WhatsApp.", "popup-subscribed");
              break;
  
          case "wa-unsubscribed":
              setIsSubscribed(false);
              setIsSubscribing(false);
              setWaConnected(false); // Ensure connection status is updated
              console.info("WhatsApp-Connection", "Successfully unsubscribed from WhatsApp.");
              updateConnectionState("disconnected");
              authorizeButton.textContent = "Authorize";
              authorizeButton.disabled = false;
              // Consider whether to show a popup here or not
              break;
  
          case "wa-connected":
              setWaConnected(true);
              console.info("WhatsApp-Connection", "WhatsApp connected.");
              updateConnectionState("connected");
              // Update button text based on new state
              authorizeButton.textContent = "Unauthorize";
              authorizeButton.disabled = false;
              showPopup("WhatsApp connected.", "popup-connected");
              break;
      
          case "wa-disconnected":
              setWaConnected(false);
              console.info("WhatsApp-Connection", "WhatsApp disconnected.");
              updateConnectionState("disconnected");
              // Update button text based on new state
              authorizeButton.textContent = "Authorize";
              authorizeButton.disabled = false;
              showPopup("WhatsApp disconnected.", "popup-disconnected");
              break;
  
          case "wa-authorized":
              console.info("WhatsApp-Connection", `WhatsApp authorization status updated: ${message.data.authorized}`);
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
              console.info("WhatsApp-Connection", `WhatsApp forwarding status updated: ${message.data.forwarding}`);
              updateForwardingStatus(message.data.forwarding);
              break;
  
          case "connection-state-update":
              console.info("WhatsApp-Connection", `WhatsApp connection state updated: ${message.data}`);
              updateConnectionState(message.data);
              break;
  
          case "wa-error":
              console.error("WhatsApp-Connection", `WhatsApp error: ${message.data.message}`);
              // Only show error popups if they are not related to routine operations (like QR code expiration)
              if (!message.data.message.includes("QR code expired")) {
                  showPopup(`Error: ${message.data.message}`, "popup-error");
              }
              break;
  
          case "error":
              console.error("WhatsApp-Connection", `Error: ${message.data}`);
              showPopup(`Error: ${message.data}`, "popup-error");
              break;
  
          default:
              console.warn("WhatsApp-Connection", `Unknown event received: ${message.event}`);
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
      console.info("WhatsApp-Connection",`Forwarding status updated in UI: ${forwarding ? "Enabled" : "Disabled"}`);
    } else {
      console.warn("WhatsApp-Connection", "Forwarding toggle not found in UI.");
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
              case "running":
              case "stopped":
                  statusSpan.classList.add(state);
                  break;
              default:
                  statusSpan.classList.add("unknown");
          }
  
          console.info("WhatsApp-Connection",`Connection state updated in UI: ${state}`);
      } else {
          console.warn("WhatsApp-Connection","Connection state element (wa-state or status) not found in UI.");
      }
  }
  
  /**
   * Updates the authorize button's text and disabled state based on the connection status.
   * @param {boolean} connected - Whether WhatsApp is currently connected.
   */
  function updateAuthorizeButton(connected) {
      const authorizeButton = document.getElementById("authorize-button");
      if (authorizeButton) {
        authorizeButton.textContent = connected ? "Unauthorize" : "Authorize";
        authorizeButton.disabled = false; // Enable the button in either case
      }
  }
  
  /**
   * Updates the script status in the UI.
   * @param {boolean} running - Script running status.
   */
  function updateScriptStatus(running) {
      const scriptElement = document.getElementById("script-status");
      if (scriptElement) {
          scriptElement.textContent = `Script: ${running ? "Running" : "Stopped"}`;
          console.info("WhatsApp-Connection",`Script status updated in UI: ${running ? "Running" : "Stopped"}`);
      } else {
          console.error("WhatsApp-Connection",
              `Script status element not found in UI.`
          );
      }
  }
  
  export {
    initializeWhatsAppConnection,
    handleWhatsAppMessage,
    updateConnectionState,
    updateStatusUI,
    updateForwardingStatus,
  };