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
      broadcast("wa-groups", userGroups);
    }
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
};