// server.js

import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { initializeWebSocket } from "./modules/websocket-server.js";
import { setupApiEndpoints } from "./modules/api-endpoints.js";
import { initializeMQTT } from "./modules/mqtt.js"; // Add MQTT initialization
import { HOST, PORT, LOG_FILE, DASHBOARD_DIR, COMPONENTS_URL, LOGS_DIR } from "./constants-server.js";
import { setupLogging } from "./utils/logger.js";
import { initializeWhatsApp } from "./modules/whatsapp.js";

// Log the environment variables
console.log("BASE_DIR:", process.env.BASE_DIR);
console.log("PORT:", process.env.PORT);
console.log("MQTT_HOST:", process.env.MQTT_HOST);
console.log("CHROMIUM_PATH:", process.env.CHROMIUM_PATH);

// Set up logging
const { log, debug, info, warn, error } = setupLogging(LOG_FILE);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Middleware for Logging Requests
app.use((req, res, next) => {
  log(`[${req.method}] ${req.url}`);
  next();
});

// Example usage in server.js
info("Server", `[Server] Frigate2WhatsApp listening at http://${HOST}:${PORT}`);


// Serve Static Files
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from the 'public' directory
app.use(COMPONENTS_URL, express.static(path.join(__dirname, "components")));
app.use(LOGS_DIR, express.static(path.join(__dirname, "logs")));

// Serve state.js from the root directory
app.use("/state.js", express.static(path.join(__dirname, "state.js")));

// Serve constants.js from the root directory
app.use("/constants.js", express.static(path.join(__dirname, "constants.js")));

// Parse JSON request bodies
app.use(express.json());

// Add API endpoint to serve WebSocket configuration to the client
// server.js
app.get("/api/ws-config", (req, res) => {
  res.json({
    WS_URL: `ws://${HOST}:${PORT}`, // Dynamically generate the WebSocket URL
  });
});

// Setup API Endpoints
setupApiEndpoints(app, log); // Pass the log function to the API endpoints

// Initialize WebSocket server
initializeWebSocket(server);

// Initialize MQTT
initializeMQTT(); // Add this line to initialize the MQTT client

// Initialize WhatsApp
initializeWhatsApp();

// Catch-All Route for Unhandled API Requests
app.use((req, res) => {
  log(`[SERVER] Unhandled route: ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: "Route not found" });
});

server.listen(PORT, HOST, () => {
  log(`[Server] Frigate2WhatsApp listening at http://${HOST}:${PORT}`);
});

// Add API endpoint to serve WebSocket configuration to the client
app.get("/api/ws-config", (req, res) => {
  res.json({
  WS_URL: `ws://<span class="math-inline">\{HOST\}\:</span>{PORT}`, // Dynamically generate the WebSocket URL
  });
});