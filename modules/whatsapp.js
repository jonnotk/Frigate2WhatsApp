// modules/whatsapp.js
import {
    notifyStateChange,
    setWaConnected,
    setWaAccount,
    setConnectionState,
    getWaConnected,
    getWaAccount,
    setIsSubscribed,
    setIsSubscribing,
  } from "../state.js";
  import pkg from "whatsapp-web.js";
  const { Client, LocalAuth, MessageMedia } = pkg;
  import qrcode from "qrcode-terminal";
  import {
    CHROMIUM_PATH,
    BASE_DIR,
  } from "../constants-server.js";
  import { setupLogging } from "../utils/logger.js";
  import {
    removeSession,
    hasSessionData,
    getSessionDataPath,
  } from "./whatsapp-session-manager.js";
  
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
  let qrRefreshInterval = null;
  let isForwarding = false;
  let groupPollingInterval = null;
  
  // Global variable to store the user's groups (accessible to other modules)
  let userGroups = [];
  // Global variable to store the user's group membership requests
  let groupMembershipRequests = [];
  
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
    notifyStateChange("connection-state-update", CONNECTION_STATES.INITIALIZING);
  
    if (hasSessionData(sessionId)) {
      info("WhatsApp", "Restoring existing session...");
      notifyStateChange("connection-state-update", CONNECTION_STATES.AUTHENTICATED);
    } else {
      info("WhatsApp", "No existing session found.");
    }
  
    waClient = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: getSessionDataPath(sessionId),
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
        dumpio: false, //remove in prod
      },
    });
  
    // --- Event Handlers ---
    // (Covering all documented events in whatsapp-web.js 1.26.1-alpha.3)
  
    waClient.on("qr", (qr) => {
      info("WhatsApp", "QR Code received. Broadcasting to frontend...");
      qrCodeData = qr;
      qrcode.generate(qr, { small: true });
      notifyStateChange("qr-code-update", qr);
      notifyStateChange("connection-state-update", CONNECTION_STATES.AWAITING_QR);
  
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
      notifyStateChange("wa-status-update", { connected: true });
      notifyStateChange("connection-state-update", CONNECTION_STATES.CONNECTED);
  
      if (qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
        qrRefreshInterval = null;
      }
  
      await updateAccountInfo();
      startGroupPolling();
    });
  
    waClient.on("authenticated", () => {
      isInitializing = false;
      info("WhatsApp", "Authentication successful.");
      notifyStateChange("connection-state-update", CONNECTION_STATES.AUTHENTICATED);
      setWaConnected(true);
      setIsSubscribed(true);
      setIsSubscribing(false);
      updateAccountInfo();
    });
  
    waClient.on("auth_failure", (msg) => {
      error("WhatsApp", "Authentication failed:", msg);
      setWaConnected(false);
      setIsSubscribed(false);
      setIsSubscribing(false);
      notifyStateChange("connection-state-update", CONNECTION_STATES.AUTH_FAILURE);
      notifyStateChange("wa-status-update", { connected: false });
      removeSession(sessionId); // Remove the failed session
    });
  
    waClient.on("disconnected", (reason) => {
      info("WhatsApp", "Client disconnected. Reason:", reason);
      setWaConnected(false);
      setIsSubscribed(false);
      setIsSubscribing(false);
      notifyStateChange("connection-state-update", CONNECTION_STATES.DISCONNECTED);
      notifyStateChange("wa-status-update", { connected: false });
      notifyStateChange("wa-account-update", getWaAccount());
      removeSession(sessionId); // Remove the session on disconnect
    });
  
    // Group Events
    waClient.on("group_join", (notification) => {
      info("WhatsApp", "Group join:", notification);
      notifyStateChange("wa-group-joined", notification);
    });
  
    waClient.on("group_leave", (notification) => {
      info("WhatsApp", "Group leave:", notification);
      notifyStateChange("wa-group-left", notification);
    });
  
    waClient.on("group_update", (notification) => {
      info("WhatsApp", "Group update:", notification);
      notifyStateChange("wa-group-update", notification);
    });
  
    waClient.on("group_membership_request", (request) => {
      info("WhatsApp", "Group membership request:", request);
      // Update the groupMembershipRequests array
      groupMembershipRequests.push(request);
      notifyStateChange("wa-group-membership-request", request);
    });
  
    // Call Events
    waClient.on("call", (call) => {
      info("WhatsApp", "Call received:", call);
      notifyStateChange("call", call);
    });
  
    // State Change Events
    waClient.on("change_state", (state) => {
      info("WhatsApp", "State changed:", state);
      notifyStateChange("change_state", state);
    });
  
    waClient.on("change_battery", (batteryInfo) => {
      info("WhatsApp", "Battery changed:", batteryInfo);
      notifyStateChange("change_battery", batteryInfo);
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
      notifyStateChange("message_create", msg);
    });
  
    waClient.on("message_revoke_everyone", (msg, revokedMsg) => {
      info("WhatsApp", "Message revoked for everyone:", msg);
      notifyStateChange("message_revoke_everyone", { msg, revokedMsg });
    });
  
    waClient.on("message_revoke_me", (msg) => {
      info("WhatsApp", "Message revoked for me:", msg);
      notifyStateChange("message_revoke_me", msg);
    });
  
    waClient.on("message_ack", (msg, ack) => {
      debug("WhatsApp", `Message acknowledged. Ack level: ${ack}`, msg);
      notifyStateChange("message_ack", { msg, ack });
    });
  
    waClient.on("media_uploaded", (msg) => {
      info("WhatsApp", "Media uploaded:", msg);
      notifyStateChange("media_uploaded", msg);
    });
  
    // added for updating wa-account number and name if number is edited in whatsapp
    waClient.on("contact_changed", async (msg) => {
      info("WhatsApp", "contact_changed event", msg);
      await updateAccountInfo();
    });
  
    // Initialization
    try {
      info("WhatsApp", "Initializing WhatsApp client...");
      await waClient.initialize();
      info("WhatsApp", "WhatsApp client initialized successfully.");
    } catch (error) {
      error("WhatsApp", "Error initializing client:", error);
      notifyStateChange("connection-state-update", CONNECTION_STATES.INITIALIZATION_FAILED);
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
          msg.reply("[WhatsApp] This is an automated status response.")
          info("WhatsApp", "Sent automated response to:", msg.from)
      }
  
      // TODO: Add custom logic for handling messages
    } catch (error) {
      error("WhatsApp", "Error handling incoming message:", error);
      notifyStateChange("wa-error", {
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
  
      const newAccountInfo = { name: contactName, number: contactNumber };
      if (
        getWaAccount().name !== newAccountInfo.name ||
        getWaAccount().number !== newAccountInfo.number
      ) {
        setWaAccount(newAccountInfo);
        info("WhatsApp", "Account info updated:", getWaAccount());
        notifyStateChange("wa-account-update", getWaAccount());
      }
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
      await waClient.logout();
      info("WhatsApp", "Client logged out successfully.");
      setWaConnected(false);
      setIsSubscribed(false);
      setIsSubscribing(false);
      resetClientState();
      stopGroupPolling();
      notifyStateChange("wa-status-update", { connected: false });
      notifyStateChange("wa-account-update", getWaAccount());
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
      notifyStateChange("wa-status-update", { connected: false });
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
    notifyStateChange("connection-state-update", CONNECTION_STATES.DISCONNECTED);
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
      notifyStateChange("wa-authorized", { authorized: true });
    } catch (error) {
      error("WhatsApp", "Error authorizing WhatsApp:", error);
      notifyStateChange("wa-error", {
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
      notifyStateChange("wa-authorized", { authorized: false });
      stopGroupPolling();
    } catch (error) {
      error("WhatsApp", "Error unauthorizing WhatsApp:", error);
      notifyStateChange("wa-error", {
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
    notifyStateChange("forwarding-started", { forwarding: true });
  }
  
  /**
   * Stops forwarding messages.
   */
  function stopForwarding() {
    info("WhatsApp", "Stopping message forwarding...");
    isForwarding = false;
    notifyStateChange("forwarding-stopped", { forwarding: false });
  }
  
  /**
   * Get the current forwarding status.
   * @returns {boolean} True if forwarding is active, false otherwise.
   */
  function getForwardingStatus() {
    return isForwarding;
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
      const fetchedGroups = chats
        .filter((chat) => chat.isGroup)
        .map((group) => ({
          id: group.id._serialized,
          name: group.name,
          isMember: true,
          isAdmin: group.groupMetadata && group.groupMetadata.participants.some(
            (participant) =>
              participant.id._serialized === waClient.info.wid._serialized &&
              participant.isAdmin
          ),
        }));
  
      // Update userGroups only if there are changes
      if (JSON.stringify(userGroups) !== JSON.stringify(fetchedGroups)) {
        userGroups = fetchedGroups;
        info("WhatsApp", "Fetched and updated user groups:", userGroups);
        notifyStateChange("wa-groups-update", userGroups);
      }
    } catch (err) {
      error("WhatsApp", "Error fetching or updating user groups:", err);
      if (err.message.includes("Session closed")) {
        info("WhatsApp", "Session closed. Stopping group polling.");
        stopGroupPolling();
      }
      notifyStateChange("wa-error", {
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