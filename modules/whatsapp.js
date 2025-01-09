// modules/whatsapp.js
import { broadcast } from "./websocket-server.js";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
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
  MAX_RETRIES,
  RETRY_DELAY,
  CHROMIUM_PATH,
  BASE_DIR,
} from "../constants-server.js";
import { setupLogging } from "../utils/logger.js";
import { removeSession } from "./whatsapp-session-manager.js";

// Initialize logging
const { info, warn, error, debug } = setupLogging();

// Define CONNECTION_STATES within whatsapp.js
const CONNECTION_STATES = {
  INITIALIZING: "initializing",
  QR_RECEIVED: "qr_received",
  AWAITING_QR: "awaiting_qr",
  LOADING: "loading",
  FAILED_RESTORE: "failed_restore",
  TIMEOUT: "timeout",
  CONNECTED: "connected",
  AUTHENTICATED: "authenticated",
  DISCONNECTED: "disconnected",
  AUTH_FAILURE: "auth_failure",
  INITIALIZATION_FAILED: "initialization_failed",
  DESTROYED: "destroyed",
  CONFLICT: "conflict",
  UNLAUNCHED: "unlaunched",
  UNPAIRED: "unpaired",
  UNPAIRED_IDLE: "unpaired_idle",
  NOT_READY: "not_ready",
  PROXY_ERROR: "proxy_error",
  SUBSCRIBING: "subscribing",
  UNSUBSCRIBING: "unsubscribing",
};

// Global variables
let isInitializing = false;
let waClient = null;
let qrCodeData = null;
let connectionState = CONNECTION_STATES.DISCONNECTED;
let qrRefreshInterval = null;
let isForwarding = false;
let groupPollingInterval = null;

// Global variable to store the user's groups (accessible to other modules)
let userGroups = [];

// Track the last connection state and broadcast time
let lastConnectionState = null;
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 1000; // Throttle broadcasts to once per second

/**
 * Updates the connection state and broadcasts it to the frontend.
 * @param {string} state - The new connection state.
 */
function updateConnectionState(state) {
  // Validate the new state
  if (!Object.values(CONNECTION_STATES).includes(state)) {
    const errorMessage = `Unknown connection state received: ${state}`;
    error("WhatsApp", errorMessage);
    broadcast("error", { message: errorMessage });
    return;
  }

  // Only update and broadcast if the state has changed
  if (state !== lastConnectionState) {
    connectionState = state;
    lastConnectionState = state; // Update the last known state
    info("WhatsApp", `Connection state updated: ${state}`);

    // Throttle broadcasts to avoid rapid-fire updates
    const now = Date.now();
    if (now - lastBroadcastTime >= BROADCAST_THROTTLE_MS) {
      broadcast("connection-state", { state });
      lastBroadcastTime = now; // Update the last broadcast time
    }
  }
}

/**
 * Initializes the WhatsApp client.
 * @param {string} sessionId - The session ID.
 */
async function initializeWhatsApp(sessionId) {
  if (isInitializing) {
    info("WhatsApp", "Client is already initializing. Skipping.");
    return;
  }

  info("WhatsApp", "Initializing client...");
  isInitializing = true;
  updateConnectionState(CONNECTION_STATES.INITIALIZING);

  const sessionDir = path.join(
    BASE_DIR,
    "modules",
    "whatsapp-sessions",
    `session-${sessionId}`
  );

  waClient = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: sessionDir,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-update",
        "--disable-domain-reliability",
        "--disable-features=AudioServiceOutOfProcess",
        "--disable-hang-monitor",
        "--disable-ipc-flooding-protection",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-renderer-backgrounding",
        "--disable-sync",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--enable-automation",
        "--password-store=basic",
        "--use-mock-keychain",
      ],
      executablePath: CHROMIUM_PATH,
      dumpio: true, // Remove in production
    },
  });

  // --- Event Handlers ---
  // (Covering all documented events in whatsapp-web.js 1.23.0)

  waClient.on("qr", (qr) => {
    info("WhatsApp", "QR Code received. Broadcasting to frontend...");
    qrCodeData = qr;
    qrcode.generate(qr, { small: true });
    broadcast("qr", qr);
    updateConnectionState(CONNECTION_STATES.AWAITING_QR);

    // Clear any existing interval before setting a new one
    if (qrRefreshInterval) {
      clearInterval(qrRefreshInterval);
      qrRefreshInterval = null;
    }
  });

  waClient.on("ready", async () => {
    isInitializing = false;
    info("WhatsApp", "Client is ready.");
    setWaConnected(true);
    setIsSubscribed(true);
    setIsSubscribing(false);
    broadcast("wa-status", { connected: true });
    updateConnectionState(CONNECTION_STATES.CONNECTED);

    if (qrRefreshInterval) {
      clearInterval(qrRefreshInterval);
      qrRefreshInterval = null;
    }

    await updateAccountInfo();
    startGroupPolling();
  });

  waClient.on("contact_changed", async (message, oldId, newId, isContact) => {
    /**
     * Emitted when a contact is changed.
     * @param {Message} message The message that caused the contact change.
     * @param {string|null} oldId The user's id before the change.
     * @param {string} newId The user's new id.
     * @param {boolean} isContact True if the user is a contact, false otherwise.
     */
    info("WhatsApp", "contact_changed event", message, oldId, newId, isContact);
    await updateAccountInfo();
  });

  waClient.on("authenticated", () => {
    isInitializing = false;
    info("WhatsApp", "Authentication successful.");
    updateConnectionState(CONNECTION_STATES.AUTHENTICATED);
  });

  waClient.on("auth_failure", (msg) => {
    error("WhatsApp", "Authentication failed:", msg);
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    updateConnectionState(CONNECTION_STATES.AUTH_FAILURE);
    broadcast("wa-status", { connected: false });
    removeSession(sessionId); // Remove the failed session
  });

  waClient.on("disconnected", (reason) => {
    info("WhatsApp", "Client disconnected. Reason:", reason);
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    updateConnectionState(CONNECTION_STATES.DISCONNECTED);
    broadcast("wa-status", { connected: false });
    broadcast("wa-account", getWaAccount());
    removeSession(sessionId); // Remove the session on disconnect
    if (reason === "NAVIGATION_ERROR" || reason === "CONNECTION_ERROR") {
      info("WhatsApp", "Attempting to reconnect...");
      retry(() => initializeWhatsApp(sessionId), MAX_RETRIES, RETRY_DELAY)
        .then(() => info("WhatsApp", "Reconnected successfully."))
        .catch((error) => error("WhatsApp", "Failed to reconnect:", error));
    }
  });

  // Group Events
  waClient.on("group_join", (notification) => {
    info("WhatsApp", "Group join:", notification);
    broadcast("group_join", notification);
  });

  waClient.on("group_leave", (notification) => {
    info("WhatsApp", "Group leave:", notification);
    broadcast("group_leave", notification);
  });

  waClient.on("group_update", (notification) => {
    info("WhatsApp", "Group update:", notification);
    broadcast("group_update", notification);
  });

  waClient.on("group_admin_changed", (notification) => {
    info("WhatsApp", "Group admin changed:", notification);
    broadcast("group_admin_changed", notification);
  });

  // Call Events
  waClient.on("call", (call) => {
    info("WhatsApp", "Call received:", call);
    broadcast("call", call);
  });

  // Deprecated call events (included for completeness, but ideally not used)
  waClient.on("incoming_call", (call) => {
    info("WhatsApp", "Incoming call (deprecated):", call);
    broadcast("incoming_call", call);
  });

  waClient.on("outgoing_call", (call) => {
    info("WhatsApp", "Outgoing call (deprecated):", call);
    broadcast("outgoing_call", call);
  });

  // State Change Events
  waClient.on("change_state", (state) => {
    info("WhatsApp", "State changed:", state);
    broadcast("change_state", state);
  });

  waClient.on("change_battery", (batteryInfo) => {
    info("WhatsApp", "Battery changed:", batteryInfo);
    broadcast("change_battery", batteryInfo);
  });

  // Message Events
  waClient.on("message", async (msg) => {
    debug("WhatsApp", "New message received:", msg);
    handleIncomingMessage(msg);

    if (isForwarding) {
      const targetChatId = "1234567890@c.us";
      waClient.sendMessage(targetChatId, msg.body);
      info("WhatsApp", `Forwarded message to ${targetChatId}: ${msg.body}`);
    }
  });

  waClient.on("message_create", (msg) => {
    info("WhatsApp", "Message created:", msg);
    broadcast("message_create", msg);
  });

  waClient.on("message_revoke_everyone", (msg, revokedMsg) => {
    info("WhatsApp", "Message revoked for everyone:", msg);
    broadcast("message_revoke_everyone", { msg, revokedMsg });
  });

  waClient.on("message_revoke_me", (msg) => {
    info("WhatsApp", "Message revoked for me:", msg);
    broadcast("message_revoke_me", msg);
  });

  waClient.on("message_ack", (msg, ack) => {
    debug("WhatsApp", `Message acknowledged. Ack level: ${ack}`, msg);
    broadcast("message_ack", { msg, ack });
  });

  waClient.on("media_uploaded", (msg) => {
    info("WhatsApp", "Media uploaded:", msg);
    broadcast("media_uploaded", msg);
  });

  // Initialization
  try {
    info("WhatsApp", "Initializing WhatsApp client...");
    await waClient.initialize();
    info("WhatsApp", "WhatsApp client initialized successfully.");
  } catch (error) {
    error("WhatsApp", "Error initializing client:", error);
    updateConnectionState(CONNECTION_STATES.INITIALIZATION_FAILED);

    // Retry initialization on failure
    try {
      info("WhatsApp", "Retrying initialization...");
      await retry(() => waClient.initialize(), MAX_RETRIES, RETRY_DELAY);
      info("WhatsApp", "Client reinitialized successfully.");
    } catch (err) {
      error("WhatsApp", "Failed to reinitialize client:", err);
    }
  }
}

/**
 * Handle incoming messages from WhatsApp.
 * @param {object} msg - The incoming message object.
 */
async function handleIncomingMessage(msg) {
  debug("WhatsApp", "Processing received message:", msg);

  try {
    // Check if the message is from the authenticated user
    if (msg.from === waClient.info.wid._serialized) {
      debug("WhatsApp", "Ignoring message from authenticated user.");
      return;
    }
    if (msg.body.toLowerCase().includes("status")) {
      retry(() => msg.reply("[WhatsApp] This is an automated status response."))
        .then(() => info("WhatsApp", "Sent automated response to:", msg.from))
        .catch((error) =>
          error("WhatsApp", "Error sending automated response:", error)
        );
    }

    // TODO: Add custom logic for handling messages
  } catch (error) {
    error("WhatsApp", "Error handling incoming message:", error);
    broadcast("wa-error", {
      message: "Error handling incoming message",
      error: error.message,
    });
  }
}

/**
 * Update the WhatsApp account information.
 */
async function updateAccountInfo() {
  if (!waClient || !waClient.info) {
    info(
      "WhatsApp",
      "Client not initialized or info not available. Cannot update account info."
    );
    return;
  }

  try {
    const contact = await waClient.getContactById(waClient.info.wid._serialized);
    const contactNumber = waClient.info.wid.user;
    const contactName =
      contact.pushname || contact.name || waClient.info.pushname || "Unknown";

    setWaAccount({ name: contactName, number: contactNumber });

    info("WhatsApp", "Account info updated:", getWaAccount());
    broadcast("wa-account", getWaAccount());
  } catch (error) {
    error("WhatsApp", "Error updating account info:", error);
  }
}

/**
 * Get the current QR code data.
 * @returns {string|null} The QR code data or null if unavailable.
 */
function getQrCodeData() {
  return qrCodeData;
}

/**
 * Check if the client is connected to WhatsApp.
 * @returns {boolean} True if connected, false otherwise.
 */
function isConnected() {
  return getWaConnected();
}

/**
 * Get the current WhatsApp account information.
 * @returns {object} An object containing the account name and number.
 */
function getAccountInfo() {
  return getWaAccount();
}

/**
 * Get the current WhatsApp client instance.
 * @returns {Client|null} The WhatsApp client instance.
 */
function getWhatsAppClient() {
  return waClient;
}

/**
 * Unlink the current WhatsApp session.
 */
async function unlinkWhatsApp() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot unlink.");
    return;
  }

  try {
    await retry(() => waClient.logout());
    info("WhatsApp", "Client logged out successfully.");
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    resetClientState();
    stopGroupPolling();
    broadcast("wa-status", { connected: false });
    broadcast("wa-account", getWaAccount());
  } catch (error) {
    error("WhatsApp", "Error during logout:", error);
  }
}

/**
 * Connect to an existing WhatsApp session.
 */
async function connectWhatsApp() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot connect.");
    return;
  }

  info("WhatsApp", "Connecting to WhatsApp...");
  try {
    await waClient.initialize();
    info("WhatsApp", "Connected to WhatsApp.");
  } catch (error) {
    error("WhatsApp", "Error connecting to WhatsApp:", error);
  }
}

/**
 * Disconnect from the WhatsApp service without unsubscribing.
 */
async function disconnectWhatsApp() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot disconnect.");
    return;
  }

  info("WhatsApp", "Disconnecting from WhatsApp...");
  try {
    await waClient.logout();
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    info("WhatsApp", "Disconnected from WhatsApp.");
    broadcast("wa-status", { connected: false });
    return Promise.resolve();
  } catch (error) {
    error("WhatsApp", "Error disconnecting from WhatsApp:", error);
    return Promise.reject(error);
  }
}

/**
 * Reset client state to initial values.
 */
async function resetClientState() {
  qrCodeData = null;
  setWaAccount({ name: null, number: null });
  updateConnectionState(CONNECTION_STATES.DISCONNECTED);
  stopGroupPolling();

  if (qrRefreshInterval) {
    clearInterval(qrRefreshInterval);
    qrRefreshInterval = null;
  }

  if (waClient) {
    waClient.destroy();
    waClient = null;
  }
}

/**
 * Gracefully destroy the WhatsApp client instance.
 */
function destroyClient() {
  if (waClient) {
    info("WhatsApp", "Destroying client instance...");
    waClient.destroy();
    resetClientState();
  }
}

/**
 * Authorizes the WhatsApp client.
 */
async function authorize(sessionId) {
  info("WhatsApp", "Authorizing WhatsApp...");
  try {
    await initializeWhatsApp(sessionId);
    info("WhatsApp", "WhatsApp authorized successfully.");
    broadcast("wa-authorized", { authorized: true });
  } catch (error) {
    error("WhatsApp", "Error authorizing WhatsApp:", error);
    broadcast("wa-error", {
      message: "Error authorizing WhatsApp",
      error: error.message,
    });
  }
}

/**
 * Unauthorizes the WhatsApp client.
 */
async function unauthorize() {
  info("WhatsApp", "Unauthorizing WhatsApp...");
  try {
    await waClient.logout();
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    info("WhatsApp", "WhatsApp unauthorized successfully.");
    broadcast("wa-authorized", { authorized: false });
    stopGroupPolling();
  } catch (error) {
    error("WhatsApp", "Error unauthorizing WhatsApp:", error);
    broadcast("wa-error", {
      message: "Error unauthorizing WhatsApp",
      error: error.message,
    });
  }
}

/**
 * Starts forwarding messages.
 */
function startForwarding() {
  info("WhatsApp", "Starting message forwarding...");
  isForwarding = true;
  broadcast("forwarding-started", { forwarding: true });
}

/**
 * Stops forwarding messages.
 */
function stopForwarding() {
  info("WhatsApp", "Stopping message forwarding...");
  isForwarding = false;
  broadcast("forwarding-stopped", { forwarding: false });
}

/**
 * Get the current forwarding status.
 * @returns {boolean} True if forwarding is active, false otherwise.
 */
function getForwardingStatus() {
  return isForwarding;
}

/**
 * Retries a function with a specified number of retries and delay.
 * @param {function} fn - The function to retry.
 * @param {number} retries - Number of retries.
 * @param {number} delay - Delay between retries in milliseconds.
 * @returns {Promise} - The result of the function.
 */
async function retry(fn, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      info("WhatsApp", `Retrying... (${retries} attempts left)`, {
        error: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
}

/**
 * Start polling for WhatsApp groups.
 */
async function startGroupPolling() {
  if (!waClient || !getWaConnected()) {
    info(
      "WhatsApp",
      "Client not initialized or not connected. Cannot start group polling."
    );
    return;
  }

  info("WhatsApp", "Starting group polling...");
  try {
    await fetchAndUpdateGroups();
    groupPollingInterval = setInterval(async () => {
      if (!waClient || !getWaConnected()) {
        info("WhatsApp", "Client is not connected. Stopping group polling.");
        stopGroupPolling();
        return;
      }
      await fetchAndUpdateGroups();
    }, 30000);
  } catch (error) {
    error("WhatsApp", "Error setting up group polling:", error);
  }
}

/**
 * Stop polling for WhatsApp groups.
 */
function stopGroupPolling() {
  if (groupPollingInterval) {
    clearInterval(groupPollingInterval);
    groupPollingInterval = null;
    info("WhatsApp", "Group polling stopped.");
  }
}

/**
 * Fetches and updates the list of WhatsApp groups the user is a part of.
 */
async function fetchAndUpdateGroups() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot fetch groups.");
    return;
  }
  try {
    const chats = await waClient.getChats();
    userGroups = chats
      .filter((chat) => chat.isGroup)
      .map((group) => ({
        id: group.id._serialized,
        name: group.name,
      }));

    info("WhatsApp", "Fetched and updated user groups:", userGroups);
    broadcast("wa-groups", userGroups);
  } catch (err) {
    error("WhatsApp", "Error fetching or updating user groups:", err);
    if (err.message.includes("Session closed")) {
      info("WhatsApp", "Session closed. Stopping group polling.");
      stopGroupPolling();
    }
    broadcast("wa-error", {
      message: "WhatsApp Error",
      error: "Error fetching or updating user groups: " + err.message,
    });
  }
}

export {
  initializeWhatsApp,
  getQrCodeData,
  updateAccountInfo,
  isConnected,
  getAccountInfo,
  getWhatsAppClient,
  unlinkWhatsApp,
  connectWhatsApp,
  disconnectWhatsApp,
  destroyClient,
  authorize,
  unauthorize,
  startForwarding,
  stopForwarding,
  getForwardingStatus,
  userGroups,
  connectionState,
  updateConnectionState,
};