/*******************************************************
 * server.js
 *
 * The main server file. Key updates:
 * 1) Remove the route that served old `state.js`.
 * 2) Import from `server-state.js` instead of `state.js`.
 *******************************************************/
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { initializeWebSocket } from "./modules/websocket-server.js";
import { setupApiEndpoints } from "./modules/api-endpoints.js";
import { initializeMQTT } from "./modules/mqtt.js";
import {
    HOST,
    PORT,
    LOG_FILE,
    COMPONENTS_URL,
    LOGS_DIR,
    BASE_DIR,
    UTILS_URL,
    DASHBOARD_URL,
} from "./constants-server.js";
import { setupLogging } from "./utils/logger.js";
import { initializeWhatsApp } from "./modules/whatsapp.js";

import {
        getCameras,
        setCameras,
    } from "./modules/server-state.js";

// Logging
const { log, info, warn, error } = setupLogging(LOG_FILE);

// Resolve the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Middleware for logging requests
app.use((req, res, next) => {
    info("Server", `[${req.method}] ${req.url}`);
    next();
});

// Serve static files
app.use(express.static(path.join(BASE_DIR, "public")));
app.use(COMPONENTS_URL, express.static(path.join(BASE_DIR, "public", "components")));
app.use(LOGS_DIR, express.static(path.join(BASE_DIR, "logs")));
app.use(UTILS_URL, express.static(path.join(BASE_DIR, "utils")));

// ------------------ KEY CHANGE: Remove old route for state.js ------------------
// app.get("/state.js", (req, res) => {
//     res.setHeader("Content-Type", "application/javascript");
//     res.sendFile(path.join(BASE_DIR, "state.js"));
// });
// -----------------------------------------------------------------------------

// Serve index.html for the dashboard route
app.get(DASHBOARD_URL, (req, res) => {
    res.sendFile(path.join(BASE_DIR, "public", "index.html"));
});

// Parse JSON request bodies
app.use(express.json());

// Add API endpoint to serve WebSocket configuration to the client
app.get("/api/ws-config", (req, res) => {
    res.json({
        WS_URL: `ws://${HOST}:${PORT}`,
    });
});

// Setup the rest of the API endpoints
setupApiEndpoints(app, { log, info, warn, error });

// Initialize WebSocket server
initializeWebSocket(server);

// Initialize MQTT
initializeMQTT();

// Initialize WhatsApp
initializeWhatsApp();

// Catch-All Route for unhandled API requests
app.use((req, res) => {
    error("Server", `Unhandled route: ${req.method} ${req.url}`);
    res.status(404).json({ success: false, error: "Route not found" });
});

// Start the server
server.listen(PORT, HOST, () => {
    info("Server", `Frigate2WhatsApp listening at http://${HOST}:${PORT}`);
});