// modules/websocket-server.js
import { WebSocketServer, WebSocket } from "ws";
import {
  getQrCodeData,
  unlinkWhatsApp,
  connectWhatsApp,
  disconnectWhatsApp,
  authorize,
  unauthorize,
  startForwarding,
  stopForwarding,
  initializeWhatsApp,
  isConnected,
  getAccountInfo,
  userGroups,
} from "./whatsapp.js";
import { getIsSubscribed, getIsSubscribing, setIsSubscribing } from "../state.js";
import { CONNECTION_STATES } from "../constants.js";
import { DASHBOARD_URL, PORT, WS_URL } from "../constants-server.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { setupLogging } from "../utils/logger.js";
const { log, debug, info, warn, error } = setupLogging();

// Resolve the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the directory for WhatsApp session data
const authDir = path.join(__dirname, "../", "modules", "whatsapp-sessions");

let wss = null;
let connectionState = CONNECTION_STATES.DISCONNECTED; // Track connection state from whatsapp.js

/**
 * Validates the received WebSocket message payload.
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (!payload.event || typeof payload.event !== "string") {
    return false;
  }
  if (!payload.data || typeof payload.data !== "object") {
    return false;
  }
  return true;
}

/**
 * Initialize the WebSocket server.
 * @param {object} server - The HTTP server instance.
 */
function initializeWebSocket(server) {
  info("WebSocket-Server", "Initializing WebSocket server...");
  console.log(
    `[${new Date().toLocaleString()}] [WebSocket Server] Initializing WebSocket server...`
  );

  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const timestamp = new Date().toLocaleString();
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const searchParams = new URL(request.url, `http://${request.headers.host}`).searchParams;
    const sessionId = searchParams.get("sessionId"); // Get sessionId from query parameter

    info("WebSocket-Server", `Upgrade request received for pathname: ${pathname}, sessionId: ${sessionId}`);
    console.log(
      `[${timestamp}] [WebSocket Server] Upgrade request received for pathname: ${pathname}, sessionId: ${sessionId}`
    );

    if (pathname === DASHBOARD_URL) {
      // Pass sessionId to handleUpgrade
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.sessionId = sessionId; // Attach sessionId to WebSocket connection object
        wss.emit("connection", ws, request);
      });
    } else {
      warn("WebSocket-Server", `Invalid WebSocket path: ${pathname}`);
      console.warn(
        `[${timestamp}] [WebSocket Server] Invalid WebSocket path: ${pathname}`
      );
      socket.destroy();
    }
  });

  wss.on("connection", (ws, request) => {
    const timestamp = new Date().toLocaleString();
    info("WebSocket-Server", `Client connected from: ${request.socket.remoteAddress}, sessionId: ${ws.sessionId}`);
    console.log(
      `[${timestamp}] [WebSocket Server] Client connected from: ${request.socket.remoteAddress}, sessionId: ${ws.sessionId}`
    );

    // Check if the session exists on connection
    const sessionDir = path.join(authDir, `session-${ws.sessionId}`);
    if (fs.existsSync(sessionDir)) {
      info("WebSocket-Server", `Session directory found for sessionId: ${ws.sessionId}. Attempting to restore session.`);
      console.log(
        `[${timestamp}] [WebSocket Server] Session directory found for sessionId: ${ws.sessionId}. Attempting to restore session.`
      );
      // Send a session-restored event
      ws.send(JSON.stringify({ event: "session-restored", data: {} }));
    }

    // Send WS_URL and other config values to the client after connection
    ws.send(
      JSON.stringify({
        event: "config",
        data: {
          wsUrl: WS_URL,
          // Add other config values you want to send to the client here
        },
      })
    );

    ws.on("message", (message) => {
      debug("WebSocket-Server", "Received message", { message: message.toString() });
      console.log(
        `[${new Date().toLocaleString()}] [WebSocket Server] Received message: ${message}`
      );
      try {
        const parsedMessage = JSON.parse(message);
        if (!validatePayload(parsedMessage)) {
          warn("WebSocket-Server", "Invalid payload received", { message: parsedMessage });
          console.error(
            `[${new Date().toLocaleString()}] [WebSocket Server] Invalid payload received.`
          );
          ws.send(JSON.stringify({ event: "error", data: "Invalid payload" }));
          return;
        }
        handleClientMessage(ws, parsedMessage);
      } catch (error) {
        error("WebSocket-Server", "Error processing message", { error: error.message });
        console.error(
          `[${new Date().toLocaleString()}] [WebSocket Server] Error processing message: ${error.message}`
        );
        ws.send(
          JSON.stringify({ event: "error", data: "Failed to process message" })
        );
      }
    });

    ws.on("close", () => {
      info("WebSocket-Server", "Client disconnected");
      console.log(
        `[${new Date().toLocaleString()}] [WebSocket Server] Client disconnected`
      );
    });

    ws.on("error", (error) => {
      error("WebSocket-Server", "Connection error", { error: error.message });
      console.error(
        `[${new Date().toLocaleString()}] [WebSocket Server] Connection error: ${error.message}`
      );
      ws.send(JSON.stringify({ event: "error", data: "Connection error" }));
    });

    // Send initial status update and welcome message
    sendInitialStatus(ws);
    ws.send(
      JSON.stringify({
        event: "server-connected",
        data: "Welcome to the WebSocket server!",
      })
    );
  });
}

/**
 * Sends initial status update to a newly connected client.
 */
function sendInitialStatus(ws) {
  const statusData = {
    connected: isConnected(),
    account: getAccountInfo(),
    subscribed: getIsSubscribed(),
    state: connectionState,
  };

  ws.send(
    JSON.stringify({
      event: "initial-status",
      data: statusData,
    })
  );
}

/**
 * Handle specific client messages/commands.
 */
async function handleClientMessage(ws, message) {
  const timestamp = new Date().toLocaleString();
  switch (message.event) {
    case "wa-subscribe-request":
      info("WebSocket-Server", "WhatsApp subscription request received", { sessionId: ws.sessionId });
      console.log(
        `[${timestamp}] [WebSocket Server] WhatsApp subscription request received. Session ID: ${ws.sessionId}`
      );
      try {
        // Pass the sessionId to initializeWhatsApp
        await initializeWhatsApp(ws.sessionId);
        const qrCode = getQrCodeData();
        if (qrCode) {
          ws.send(JSON.stringify({ event: "qr", data: qrCode }));
        }
      } catch (error) {
        error("WebSocket-Server", "Error initializing WhatsApp", { error: error.message });
        console.error("Error initializing WhatsApp:", error);
        setIsSubscribing(false);
        updateConnectionState(CONNECTION_STATES.DISCONNECTED);
        ws.send(
          JSON.stringify({
            event: "wa-error",
            data: { message: "Failed to initialize WhatsApp" },
          })
        );
      }
      break;

    case "wa-unsubscribe-request":
      info("WebSocket-Server", "WhatsApp unsubscription request received");
      console.log(
        `[${timestamp}] [WebSocket Server] WhatsApp unsubscription request received.`
      );
      unlinkWhatsApp()
        .then(() => {
          // isSubscribed = false; // Moved to whatsapp.js on("disconnected") event
          // ws.send(JSON.stringify({ event: "wa-unsubscribed", data: { subscribed: false } })); // Moved to whatsapp.js on("disconnected") event
        })
        .catch((error) => {
          error("WebSocket-Server", "Error unsubscribing WhatsApp", { error: error.message });
          console.error(
            `[${timestamp}] [WebSocket Server] Error unsubscribing WhatsApp: ${error.message}`
          );
          ws.send(
            JSON.stringify({
              event: "error",
              data: "Failed to unsubscribe WhatsApp",
            })
          );
        });
      break;

    case "wa-connect-request":
      info("WebSocket-Server", "WhatsApp connection request received");
      console.log(
        `[${timestamp}] [WebSocket Server] WhatsApp connection request received.`
      );
      connectWhatsApp()
        .then(() => {
          // ws.send(JSON.stringify({ event: "wa-connected", data: { connected: true } })); // Removed and handled in whatsapp.js
        })
        .catch((error) => {
          error("WebSocket-Server", "Error connecting WhatsApp", { error: error.message });
          console.error(
            `[${timestamp}] [WebSocket Server] Error connecting WhatsApp: ${error.message}`
          );
          ws.send(
            JSON.stringify({
              event: "error",
              data: "Failed to connect WhatsApp",
            })
          );
        });
      break;

    case "wa-disconnect-request":
      info("WebSocket-Server", "WhatsApp disconnect request received");
      console.log(
        `[${timestamp}] [WebSocket Server] WhatsApp disconnect request received.`
      );
      disconnectWhatsApp()
        .then(() => {
          // ws.send(JSON.stringify({ event: "wa-disconnected", data: { connected: false } })); // Removed and handled in whatsapp.js
        })
        .catch((error) => {
          error("WebSocket-Server", "Error disconnecting WhatsApp", { error: error.message });
          console.error(
            `[${timestamp}] [WebSocket Server] Error disconnecting WhatsApp: ${error.message}`
          );
          ws.send(
            JSON.stringify({
              event: "error",
              data: "Failed to disconnect WhatsApp",
            })
          );
        });
      break;

    case "wa-authorize-request":
      info("WebSocket-Server", "WhatsApp authorization request received");
      console.log(
        `[${timestamp}] [WebSocket Server] WhatsApp authorization request received.`
      );
      const { authorize: shouldAuthorize } = message.data;
      if (shouldAuthorize) {
        authorize(ws.sessionId)
          .then(() => {
            // ws.send(JSON.stringify({ event: "wa-authorized", data: { authorized: true } })); // Removed and handled in whatsapp.js
          })
          .catch((error) => {
            error("WebSocket-Server", "Error authorizing WhatsApp", { error: error.message });
            console.error(
              `[${timestamp}] [WebSocket Server] Error authorizing WhatsApp: ${error.message}`
            );
            ws.send(
              JSON.stringify({
                event: "error",
                data: "Failed to authorize WhatsApp",
              })
            );
          });
      } else {
        unauthorize()
          .then(() => {
            // ws.send(JSON.stringify({ event: "wa-authorized", data: { authorized: false } })); // Removed and handled in whatsapp.js
          })
          .catch((error) => {
            error("WebSocket-Server", "Error unauthorizing WhatsApp", { error: error.message });
            console.error(
              `[${timestamp}] [WebSocket Server] Error unauthorizing WhatsApp: ${error.message}`
            );
            ws.send(
              JSON.stringify({
                event: "error",
                data: "Failed to unauthorize WhatsApp",
              })
            );
          });
      }
      break;

    case "wa-forwarding-request":
      info("WebSocket-Server", "WhatsApp forwarding request received");
      console.log(
        `[${timestamp}] [WebSocket Server] WhatsApp forwarding request received.`
      );
      const { forwarding } = message.data;
      if (forwarding) {
        startForwarding();
      } else {
        stopForwarding();
      }
      ws.send(JSON.stringify({ event: "wa-forwarding", data: { forwarding } }));
      break;

    default:
      warn("WebSocket-Server", "Unknown event received", { event: message.event });
      console.warn(
        `[${timestamp}] [WebSocket Server] Unknown event received: ${message.event}`
      );
      ws.send(JSON.stringify({ event: "error", data: "Unknown event" }));
  }
}

/**
 * Broadcasts a message to all connected WebSocket clients.
 */
function broadcast(event, data) {
  if (!wss) {
    warn("WebSocket-Server", "Broadcast called before WebSocket initialized");
    console.warn(
      `[${new Date().toLocaleString()}] [WebSocket Server] Broadcast called before WebSocket initialized.`
    );
    return;
  }

  const message = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      debug("WebSocket-Server", "Broadcasting message", { event, data });
      client.send(message);
    }
  });
}

export { initializeWebSocket, broadcast };