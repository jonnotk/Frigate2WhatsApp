// modules/whatsapp.js
import { broadcast } from "./websocket-server.js";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
import { CONNECTION_STATES } from "../constants.js";
import {
  DEBUG,
  MAX_RETRIES,
  RETRY_DELAY,
  CHROMIUM_PATH,
} from "../constants-server.js";
import qrcode from "qrcode-terminal";
import { rimraf } from "rimraf";
import { setupLogging } from "../utils/logger.js";

// Global variables
let isInitializing = false; // Add this line to track initialization state

const { log, info, warn, error } = setupLogging();

// Resolve the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the directory for WhatsApp session data
const authDir = path.join(__dirname, "whatsapp-sessions");

// Ensure the directory exists and is writable
if (!fs.existsSync(authDir)) {
  console.log("Directory does not exist. Creating it...");
  info("WhatsApp", "Directory does not exist. Creating it..."); // Added logging
  fs.mkdirSync(authDir, { recursive: true });
}

try {
  fs.accessSync(authDir, fs.constants.W_OK);
  console.log("Directory is writable.");
  info("WhatsApp", "Directory is writable."); // Added logging
} catch (err) {
  console.error("Directory is not writable:", err);
  error("WhatsApp", "Directory is not writable:", err); // Added logging
  process.exit(1); // Exit if the directory is not writable
}

let waClient = null;
let qrCodeData = null;
let connectionState = CONNECTION_STATES.DISCONNECTED;
const QR_CODE_TIMEOUT = 60000;

let qrRefreshInterval = null;
let isForwarding = false;
let groupPollingInterval = null; // Store the polling interval ID

// Global variable to store the user's groups (accessible to other modules)
let userGroups = [];

/**
 * Updates the connection state and broadcasts it to the frontend.
 * @param {string} state - The new connection state.
 */
function updateConnectionState(state) {
  if (!Object.values(CONNECTION_STATES).includes(state)) {
    const errorMessage = `Unknown connection state received: ${state}`;
    console.error(errorMessage);
    error("WhatsApp", errorMessage); // Added logging
    broadcast("error", { message: errorMessage });
    return; // Prevent updating to an unknown state
  }

  connectionState = state;
  info("WhatsApp", `Connection state updated: ${state}`); // Added logging
  broadcast("connection-state", { state }); // Broadcast the state
}

/**
 * Clean up old WhatsApp sessions.
 */
async function cleanupSessions() {
  const sessions = fs.readdirSync(authDir);
  const now = Date.now();
  const sessionLifetime = 24 * 60 * 60 * 1000; // 24 hours

  for (const session of sessions) {
    const sessionPath = path.join(authDir, session);
    const stat = fs.statSync(sessionPath);

    if (now - stat.mtimeMs > sessionLifetime) {
      try {
        // Use dynamic import to load rimraf
        const { default: rimraf } = await import("rimraf");
        await rimraf(sessionPath);
        info("WhatsApp", `Cleaned up old session: ${session}`); // Added logging
      } catch (err) {
        error("WhatsApp", `Error cleaning up session ${session}:`, err); // Added logging
      }
    }
  }
}

// Initialize the WhatsApp client
async function initializeWhatsApp(sessionId) {
  if (isInitializing) {
    info("WhatsApp", "Client is already initializing. Skipping."); // Added logging
    return;
  }

  info("WhatsApp", "Initializing client..."); // Added logging
  isInitializing = true; // Set the flag
  updateConnectionState(CONNECTION_STATES.INITIALIZING);

  // Use the received sessionId
  const sessionDir = path.join(authDir, `session-${sessionId}`);

  // Check if a valid session exists for this sessionId
  if (!fs.existsSync(sessionDir)) {
    info("WhatsApp", `No valid session found for ID: ${sessionId}. Cleaning up sessions directory.`); // Added logging
    await cleanupSessions();
  }

  // Use the system-installed Chromium binary
  info("WhatsApp", `Using Chromium executable path: ${CHROMIUM_PATH}`); // Added logging

  waClient = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: sessionDir,
    }),
    puppeteer: {
      headless: true, // Use true in production
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
      dumpio: true, // Enable debugging logs
    },
  });

  // Event: QR Code received
  waClient.on("qr", (qr) => {
    info("WhatsApp", "QR Code received. Broadcasting to frontend..."); // Added logging
    qrCodeData = qr;
    qrcode.generate(qr, { small: true });
    broadcast("qr", qr);
    updateConnectionState(CONNECTION_STATES.AWAITING_QR);

    // Clear any existing interval before setting a new one
    if (qrRefreshInterval) {
      clearInterval(qrRefreshInterval);
      qrRefreshInterval = null; // Reset the interval ID
    }

    qrRefreshInterval = setInterval(() => {
      if (connectionState === CONNECTION_STATES.AWAITING_QR) {
        info("WhatsApp", "QR code expired. Refreshing..."); // Added logging
        // Re-emit the existing QR code data
        broadcast("qr", qrCodeData);
      }
    }, QR_CODE_TIMEOUT);
  });

  // Event: WhatsApp client is ready
  waClient.on("ready", async () => {
    isInitializing = false; // Reset the flag
    info("WhatsApp", "Client is ready."); // Added logging
    setWaConnected(true);
    setIsSubscribed(true);
    setIsSubscribing(false);
    console.log("waConnected set to:", getWaConnected());
    console.log("isSubscribed set to:", getIsSubscribed());
    console.log("isSubscribing set to:", getIsSubscribing());
    info("WhatsApp", `waConnected set to: ${getWaConnected()}`); // Added logging
    info("WhatsApp", `isSubscribed set to: ${getIsSubscribed()}`); // Added logging
    info("WhatsApp", `isSubscribing set to: ${getIsSubscribing()}`); // Added logging
    broadcast("wa-status", { connected: true }); // Update wa-status only when ready
    updateConnectionState(CONNECTION_STATES.CONNECTED);

    if (qrRefreshInterval) {
      clearInterval(qrRefreshInterval);
      qrRefreshInterval = null;
    }

    // Immediately update account info after client is ready
    await updateAccountInfo();

    // Start polling for groups
    startGroupPolling();
  });

  // Event: Successfully authenticated
  waClient.on("authenticated", () => {
    isInitializing = false; // Reset the flag
    info("WhatsApp", "Authentication successful."); // Added logging
    updateConnectionState(CONNECTION_STATES.AUTHENTICATED); // Update state but do not broadcast wa-status
  });

  // Event: Authentication failure
  waClient.on("auth_failure", (msg) => {
    error("WhatsApp", "Authentication failed:", msg); // Added logging
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    updateConnectionState(CONNECTION_STATES.AUTH_FAILURE);
    broadcast("wa-status", { connected: false }); // Ensure wa-status is updated
  });

  // Event: Disconnected
  waClient.on("disconnected", (reason) => {
    info("WhatsApp", "Client disconnected. Reason:", reason); // Added logging
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    updateConnectionState(CONNECTION_STATES.DISCONNECTED);
    broadcast("wa-status", { connected: false });
    broadcast("wa-account", getWaAccount());

    if (reason === "NAVIGATION_ERROR" || reason === "CONNECTION_ERROR") {
      info("WhatsApp", "Attempting to reconnect..."); // Added logging
      retry(() => initializeWhatsApp(sessionId), MAX_RETRIES, RETRY_DELAY)
        .then(() => info("WhatsApp", "Reconnected successfully.")) // Added logging
        .catch((error) => error("WhatsApp", "Failed to reconnect:", error)); // Added logging
    }
  });

  // Event: Incoming message
  waClient.on("message", (msg) => {
    info("WhatsApp", "New message received:", msg.body); // Added logging
    handleIncomingMessage(msg);

    if (isForwarding) {
      const targetChatId = "1234567890@c.us"; // Replace with target chat ID
      waClient.sendMessage(targetChatId, msg.body);
      info("WhatsApp", `Forwarded message to ${targetChatId}: ${msg.body}`); // Added logging
    }
  });

  // Event: Message acknowledgment
  waClient.on("message_ack", (msg, ack) => {
    info("WhatsApp", `Message acknowledged. Ack level: ${ack}`, msg.body); // Added logging
  });

  // Initialize the WhatsApp client
  try {
    info("WhatsApp", "Initializing WhatsApp client..."); // Added logging
    await waClient.initialize();
    info("WhatsApp", "WhatsApp client initialized successfully."); // Added logging
  } catch (error) {
    error("WhatsApp", "Error initializing client:", error); // Added logging
    updateConnectionState(CONNECTION_STATES.INITIALIZATION_FAILED);

    // Retry initialization on failure
    try {
      info("WhatsApp", "Retrying initialization..."); // Added logging
      await retry(() => waClient.initialize(), MAX_RETRIES, RETRY_DELAY);
      info("WhatsApp", "Client reinitialized successfully."); // Added logging
    } catch (err) {
      error("WhatsApp", "Failed to reinitialize client:", err); // Added logging
    }
  }
}

/**
 * Handle incoming messages from WhatsApp.
 * @param {object} msg - The incoming message object.
 */
async function handleIncomingMessage(msg) {
  info("WhatsApp", "Processing received message:", msg); // Added logging

  try {
    // Check if the message is from the authenticated user
    if (msg.from === waClient.info.wid._serialized) {
      info("WhatsApp", "Ignoring message from authenticated user."); // Added logging
      return;
    }

    // Rest of the message handling logic
    if (msg.body.toLowerCase().includes("status")) {
      retry(() => msg.reply("[WhatsApp] This is an automated status response."))
        .then(() => info("WhatsApp", "Sent automated response to:", msg.from)) // Added logging
        .catch((error) => error("WhatsApp", "Error sending automated response:", error)); // Added logging
    }

    // TODO: Add custom logic for handling messages
  } catch (error) {
    error("WhatsApp", "Error handling incoming message:", error); // Added logging
    broadcast("wa-error", {
      message: "Error handling incoming message",
      error: error.message,
    });
  }
}

/**
 * Update the WhatsApp account information.
 * Retrieves account name and number and broadcasts it to connected clients.
 */
async function updateAccountInfo() {
  if (!waClient || !waClient.info) {
    info("WhatsApp", "Client not initialized or info not available. Cannot update account info."); // Added logging
    return;
  }

  try {
    // Fetch the Contact object for the authenticated user
    const contact = await waClient.getContactById(waClient.info.wid._serialized);

    // Extract the relevant information from the Contact object
    const contactNumber = waClient.info.wid.user;
    const contactName =
      contact.pushname || contact.name || waClient.info.pushname || "Unknown";

    setWaAccount({ name: contactName, number: contactNumber });

    info("WhatsApp", "Account info updated:", getWaAccount()); // Added logging
    broadcast("wa-account", getWaAccount());
  } catch (error) {
    error("WhatsApp", "Error updating account info:", error); // Added logging
  }
}

/**
 * Get the current QR code data.
 * Returns the base64-encoded QR string.
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
 * Logs out the client and clears account information.
 */
async function unlinkWhatsApp() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot unlink."); // Added logging
    return;
  }

  try {
    await retry(() => waClient.logout());
    info("WhatsApp", "Client logged out successfully."); // Added logging
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    resetClientState();
    stopGroupPolling(); // Stop polling when unauthorized
    broadcast("wa-status", { connected: false });
    broadcast("wa-account", getWaAccount());
  } catch (error) {
    error("WhatsApp", "Error during logout:", error); // Added logging
  }
}

/**
 * Connect to an existing WhatsApp session.
 */
async function connectWhatsApp() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot connect."); // Added logging
    return;
  }

  info("WhatsApp", "Connecting to WhatsApp..."); // Added logging
  try {
    await waClient.initialize();
    info("WhatsApp", "Connected to WhatsApp."); // Added logging
  } catch (error) {
    error("WhatsApp", "Error connecting to WhatsApp:", error); // Added logging
  }
}

/**
 * Disconnect from the WhatsApp service without unsubscribing.
 */
async function disconnectWhatsApp() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot disconnect."); // Added logging
    return;
  }

  info("WhatsApp", "Disconnecting from WhatsApp..."); // Added logging
  try {
    await waClient.logout();
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    info("WhatsApp", "Disconnected from WhatsApp."); // Added logging
    broadcast("wa-status", { connected: false });
    return Promise.resolve();
  } catch (error) {
    error("WhatsApp", "Error disconnecting from WhatsApp:", error); // Added logging
    return Promise.reject(error);
  }
}

/**
 * Reset client state to initial values.
 * Handles disconnection or logout scenarios gracefully.
 */
async function resetClientState() {
  qrCodeData = null;
  setWaAccount({ name: null, number: null });
  updateConnectionState(CONNECTION_STATES.DISCONNECTED);
  stopGroupPolling(); // Stop polling when resetting client state

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
 * Useful for shutting down the application.
 */
function destroyClient() {
  if (waClient) {
    info("WhatsApp", "Destroying client instance..."); // Added logging
    waClient.destroy();
    resetClientState();
  }
}

/**
 * Authorizes the WhatsApp client.
 */
async function authorize(sessionId) {
  info("WhatsApp", "Authorizing WhatsApp..."); // Added logging
  try {
    await initializeWhatsApp(sessionId);
    info("WhatsApp", "WhatsApp authorized successfully."); // Added logging
    broadcast("wa-authorized", { authorized: true });
    console.log(
      `[${new Date().toLocaleString()}] [WhatsApp] Broadcasted wa-authorized event: true`
    );
    info("WhatsApp", `Broadcasted wa-authorized event: true`); // Added logging
  } catch (error) {
    error("WhatsApp", "Error authorizing WhatsApp:", error); // Added logging
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
  info("WhatsApp", "Unauthorizing WhatsApp..."); // Added logging
  try {
    await waClient.logout();
    setWaConnected(false);
    setIsSubscribed(false);
    setIsSubscribing(false);
    info("WhatsApp", "WhatsApp unauthorized successfully."); // Added logging
    broadcast("wa-authorized", { authorized: false }); // Broadcast authorization status
    console.log(
      `[${new Date().toLocaleString()}] [WhatsApp] Broadcasted wa-authorized event: false`
    );
    info("WhatsApp", `Broadcasted wa-authorized event: false`); // Added logging
    stopGroupPolling(); // Stop group polling when unauthorized
  } catch (error) {
    error("WhatsApp", "Error unauthorizing WhatsApp:", error); // Added logging
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
  info("WhatsApp", "Starting message forwarding..."); // Added logging
  isForwarding = true;
  broadcast("forwarding-started", { forwarding: true });
}

/**
 * Stops forwarding messages.
 */
function stopForwarding() {
  info("WhatsApp", "Stopping message forwarding..."); // Added logging
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
      info("WhatsApp", `Retrying... (${retries} attempts left)`, { error: error.message }); // Added logging
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
    info("WhatsApp", "Client not initialized or not connected. Cannot start group polling."); // Added logging
    return;
  }

  info("WhatsApp", "Starting group polling..."); // Added logging
  try {
    // Perform initial fetch of groups asynchronously
    await fetchAndUpdateGroups();

    // Set up the interval for subsequent polls
    groupPollingInterval = setInterval(async () => {
      if (!waClient || !getWaConnected()) {
        info("WhatsApp", "Client is not connected. Stopping group polling."); // Added logging
        stopGroupPolling();
        return;
      }
      await fetchAndUpdateGroups();
    }, 30000); // Poll every 30 seconds (adjust as needed)
  } catch (error) {
    error("WhatsApp", "Error setting up group polling:", error); // Added logging
  }
}

/**
 * Stop polling for WhatsApp groups.
 */
function stopGroupPolling() {
  if (groupPollingInterval) {
    clearInterval(groupPollingInterval);
    groupPollingInterval = null;
    info("WhatsApp", "Group polling stopped."); // Added logging
  }
}

/**
 * Fetches and updates the list of WhatsApp groups the user is a part of.
 * Filters the chats to include only groups, and maps them to an array of group objects.
 * Each group object contains the group's serialized ID and name.
 * If the fetched groups differ from the current list of user groups, it updates the list and broadcasts it to the frontend.
 */
async function fetchAndUpdateGroups() {
  if (!waClient) {
    info("WhatsApp", "Client not initialized. Cannot fetch groups."); // Added logging
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

    info("WhatsApp", "Fetched and updated user groups:", userGroups); // Added logging
    broadcast("wa-groups", userGroups); // Use 'wa-groups' event
  } catch (err) {
    error("WhatsApp", "Error fetching or updating user groups:", err); // Added logging
    if (err.message.includes("Session closed")) {
      info("WhatsApp", "Session closed. Stopping group polling."); // Added logging
      stopGroupPolling(); // Stop polling if the session is closed
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
};