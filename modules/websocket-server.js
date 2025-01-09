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
  connectionState,
} from "./whatsapp.js";
import { getIsSubscribed, getIsSubscribing, setIsSubscribing } from "../state.js";
import {
  DASHBOARD_URL,
  PORT,
  WS_URL,
  BASE_DIR,
} from "../constants-server.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { setupLogging } from "../utils/logger.js";
import { handleAssignCameraToGroup } from "./camera-logic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, debug, info, warn, error } = setupLogging();

let wss = null;

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

function initializeWebSocket(server) {
  info("WebSocket-Server", "Initializing WebSocket server...");

  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const searchParams = new URL(request.url, `http://${request.headers.host}`).searchParams;
    const sessionId = searchParams.get("sessionId");

    info("WebSocket-Server", `Upgrade request received for pathname: ${pathname}, sessionId: ${sessionId}`);

    if (pathname === DASHBOARD_URL) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.sessionId = sessionId;
        wss.emit("connection", ws, request);
      });
    } else {
      warn("WebSocket-Server", `Invalid WebSocket path: ${pathname}`);
      socket.destroy();
    }
  });

  wss.on("connection", (ws, request) => {
    info("WebSocket-Server", `Client connected from: ${request.socket.remoteAddress}, sessionId: ${ws.sessionId}`);

    const sessionDir = path.join(
      BASE_DIR,
      "modules",
      "whatsapp-sessions",
      `session-${ws.sessionId}`
    );
    if (fs.existsSync(sessionDir)) {
      info(
        "WebSocket-Server",
        `Session directory found for sessionId: ${ws.sessionId}. Attempting to restore session.`
      );
      ws.send(JSON.stringify({ event: "session-restored", data: {} }));
    }

    ws.send(
      JSON.stringify({
        event: "config",
        data: {
          wsUrl: WS_URL,
        },
      })
    );

    ws.on("message", (message) => {
      debug("WebSocket-Server", "Received message", {
        message: message.toString(),
      });
      try {
        const parsedMessage = JSON.parse(message);
        if (!validatePayload(parsedMessage)) {
          warn("WebSocket-Server", "Invalid payload received", {
            message: parsedMessage,
          });
          ws.send(JSON.stringify({ event: "error", data: "Invalid payload" }));
          return;
        }
        handleClientMessage(ws, parsedMessage);
      } catch (error) {
        error("WebSocket-Server", "Error processing message", {
          error: error.message,
        });
        ws.send(
          JSON.stringify({ event: "error", data: "Failed to process message" })
        );
      }
    });

    ws.on("close", () => {
      info("WebSocket-Server", "Client disconnected");
    });

    ws.on("error", (error) => {
      error("WebSocket-Server", "Connection error", { error: error.message });
      ws.send(JSON.stringify({ event: "error", data: "Connection error" }));
    });

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
    state: getWhatsAppConnectionState(),
  };

  ws.send(
    JSON.stringify({
      event: "initial-status",
      data: statusData,
    })
  );
}

/**
 * Get the current connection state from whatsapp.js
 */
function getWhatsAppConnectionState() {
  return connectionState;
}

/**
 * Handle specific client messages/commands.
 */
async function handleClientMessage(ws, message) {
  switch (message.event) {
    case "wa-subscribe-request":
      info("WebSocket-Server", "WhatsApp subscription request received", {
        sessionId: ws.sessionId,
      });
      try {
        // Pass the sessionId to initializeWhatsApp
        await initializeWhatsApp(ws.sessionId);
        const qrCode = getQrCodeData();
        if (qrCode) {
          ws.send(JSON.stringify({ event: "qr", data: qrCode }));
        }
      } catch (error) {
        error("WebSocket-Server", "Error initializing WhatsApp", {
          error: error.message,
        });
        setIsSubscribing(false);
        updateConnectionState("disconnected");
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
      unlinkWhatsApp()
        .then(() => {
          // Confirmation handled in whatsapp.js
        })
        .catch((error) => {
          error("WebSocket-Server", "Error unsubscribing WhatsApp", {
            error: error.message,
          });
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
      connectWhatsApp()
        .then(() => {
          // Confirmation handled in whatsapp.js
        })
        .catch((error) => {
          error("WebSocket-Server", "Error connecting WhatsApp", {
            error: error.message,
          });
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
      disconnectWhatsApp()
        .then(() => {
          // Confirmation handled in whatsapp.js
        })
        .catch((error) => {
          error("WebSocket-Server", "Error disconnecting WhatsApp", {
            error: error.message,
          });
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
      const { authorize: shouldAuthorize } = message.data;
      if (shouldAuthorize) {
        authorize(ws.sessionId)
          .then(() => {
            // Confirmation handled in whatsapp.js
          })
          .catch((error) => {
            error("WebSocket-Server", "Error authorizing WhatsApp", {
              error: error.message,
            });
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
            // Confirmation handled in whatsapp.js
          })
          .catch((error) => {
            error("WebSocket-Server", "Error unauthorizing WhatsApp", {
              error: error.message,
            });
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
      const { forwarding } = message.data;
      if (forwarding) {
        startForwarding();
      } else {
        stopForwarding();
      }
      ws.send(JSON.stringify({ event: "wa-forwarding", data: { forwarding } }));
      break;

    case "assign-camera-to-group":
      const { camera, group } = message.data;
      info("WebSocket-Server", `Assigning camera ${camera} to group ${group}...`);
      try {
        await handleAssignCameraToGroup(camera, group);
        info("WebSocket-Server", `Camera ${camera} assigned to group ${group}`);
        broadcast("camera-group-updated", { camera, group });
      } catch (err) {
        error("WebSocket-Server", `Error assigning camera to group: ${err}`);
        ws.send(JSON.stringify({ event: "error", data: `Failed to assign camera to group: ${err}` }));
      }
      break;

    default:
      warn("WebSocket-Server", "Unknown event received", {
        event: message.event,
      });
      ws.send(JSON.stringify({ event: "error", data: "Unknown event" }));
  }
}

/**
 * Broadcasts a message to all connected WebSocket clients.
 */
function broadcast(event, data) {
  if (!wss) {
    warn("WebSocket-Server", "Broadcast called before WebSocket initialized");
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

// Export necessary functions and variables
export { initializeWebSocket, broadcast };