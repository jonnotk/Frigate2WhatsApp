import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { startScript, stopScript, getScriptProcess } from "./script-manager.js";
import { isConnected, getAccountInfo, getQrCodeData, unlinkWhatsApp } from "./whatsapp.js";
import { DASHBOARD_DIR, LOGS_DIR, LOG_FILE } from "../constants-server.js";
import { getCameraGroupMappings, getCameras, getIsSubscribed } from "../state.js";
import { broadcast } from "./websocket-server.js";
import { setupLogging } from "../utils/logger.js"; // Added import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const { debug, info, warn, error } = setupLogging(LOG_FILE);

/**
 * Validate API request payload.
 * @param {object} payload - The request payload.
 * @param {string[]} requiredFields - List of required fields.
 * @returns {boolean} True if the payload is valid, false otherwise.
 */
function validatePayload(payload, requiredFields) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  for (const field of requiredFields) {
    if (!payload[field]) {
      return false;
    }
  }
  return true;
}

export function setupApiEndpoints(app, log) {
  app.get("/api/qr", (req, res) => {
    const timestamp = new Date().toLocaleString();
    try {
      const qrCodeData = getQrCodeData();
      if (!qrCodeData) {
        log(`[${timestamp}] [API] QR code not available`);
        warn("Api-endpoints", "QR code not available"); // Added logging
        return res
          .status(404)
          .json({ success: false, error: "QR code not available" });
      }
      log(`[${timestamp}] [API] QR Code data sent`);
      info("Api-endpoints", "QR Code data sent"); // Added logging
      res.json({ success: true, data: { qr: qrCodeData } });
    } catch (error) {
      log(`[${timestamp}] [API] Error fetching QR code: ${error}`);
      error("Api-endpoints", `Error fetching QR code: ${error}`); // Added logging
      res.status(500).json({ success: false, error: "Failed to fetch QR code" });
    }
  });

  app.get("/api/cameras", (req, res) => {
    const timestamp = new Date().toLocaleString();
    log(`[${timestamp}] [API] Camera list requested`);
    info("Api-endpoints", "Camera list requested"); // Added logging
    const cameras = getCameras(); // Use getCameras to fetch the list
    if (!cameras || cameras.length === 0) {
      log(`[${timestamp}] [API] No cameras found`);
      warn("Api-endpoints", "No cameras found"); // Added logging
      return res.status(404).json({ success: false, error: "No cameras found" });
    }
    log(`[${timestamp}] [API] Cameras fetched successfully: ${cameras}`);
    info("Api-endpoints", `Cameras fetched successfully: ${cameras}`); // Added logging
    res.json({ success: true, data: cameras });
  });

  app.post("/api/wa/unlink", async (req, res) => {
    const timestamp = new Date().toLocaleString();
    try {
      await unlinkWhatsApp();
      broadcast("wa-status", { connected: false });
      broadcast("wa-account", { name: null, number: null });
      log(`[${timestamp}] [API] WhatsApp unlinked`);
      info("Api-endpoints", "WhatsApp unlinked"); // Added logging
      res.json({ success: true });
    } catch (error) {
      log(`[${timestamp}] [API] Error unlinking WhatsApp: ${error}`);
      error("Api-endpoints", `Error unlinking WhatsApp: ${error}`); // Added logging
      res.status(500).json({ success: false, error: "Failed to unlink WhatsApp" });
    }
  });

  app.get("/api/wa/status", (req, res) => {
    const timestamp = new Date().toLocaleString();
    log(`[${timestamp}] [API] WhatsApp status requested`);
    info("Api-endpoints", "WhatsApp status requested"); // Added logging
    res.json({
      success: true,
      data: {
        connected: isConnected(),
        account: getAccountInfo(),
        state: "connected", // Consider getting the actual connection state
      },
    });
  });

  app.get("/api/wa/subscription-status", async (req, res) => {
    const timestamp = new Date().toLocaleString();
    log(`[${timestamp}] [API] WhatsApp subscription status requested`);
    info("Api-endpoints", "WhatsApp subscription status requested"); // Added logging

    try {
      // Check subscription status
      const isSubscribed = getIsSubscribed();
      res.json({ success: true, data: { subscribed: isSubscribed } });
    } catch (error) {
      log(`[${timestamp}] [API] Error checking subscription status: ${error}`);
      error("Api-endpoints", `Error checking subscription status: ${error}`); // Added logging
      res
        .status(500)
        .json({ success: false, error: "Failed to check subscription status" });
    }
  });

  app.post("/api/assign-camera", (req, res) => {
    const timestamp = new Date().toLocaleString();
    const { camera, group } = req.body;

    // Validate payload
    if (!validatePayload(req.body, ["camera", "group"])) {
      log(
        `[${timestamp}] [API] Invalid request: camera and group are required`
      );
      warn("Api-endpoints", "Invalid request: camera and group are required"); // Added logging
      return res
        .status(400)
        .json({ success: false, error: "Camera and group are required" });
    }

    const mappings = getCameraGroupMappings();
    mappings[camera] = group;
    log(`[${timestamp}] [API] Assigned camera ${camera} to group ${group}`);
    info("Api-endpoints", `Assigned camera ${camera} to group ${group}`); // Added logging
    broadcast("camera-group-updated", mappings);
    res.json({ success: true });
  });

  app.post("/api/script/start", (req, res) => {
    const timestamp = new Date().toLocaleString();
    log(`[${timestamp}] [API] Starting script...`);
    info("Api-endpoints", "Starting script..."); // Added logging

    if (getScriptProcess()) {
      log(`[${timestamp}] [API] Script is already running.`);
      warn("Api-endpoints", "Script is already running."); // Added logging
      return res
        .status(400)
        .json({ success: false, error: "Script is already running." });
    }

    // Use COMPONENTS_DIR to construct the path to the script
    const scriptPath = path.join(COMPONENTS_DIR, "frigate-filter.js");

    const scriptProcess = spawn("node", [scriptPath]);

    scriptProcess.stdout.on("data", (data) => {
      log(`[Script] stdout: ${data}`);
      info("Script", `stdout: ${data}`); // Added logging
      broadcast("script-output", data.toString());
    });

    scriptProcess.stderr.on("data", (data) => {
      log(`[Script] stderr: ${data}`);
      error("Script", `stderr: ${data}`); // Added logging
      broadcast("script-error", data.toString());
    });

    scriptProcess.on("close", (code) => {
      log(`[Script] Script exited with code ${code}`);
      info("Script", `Script exited with code ${code}`); // Added logging
      broadcast("script-exit", code);
    });

    log(`[${timestamp}] [API] Script started successfully.`);
    info("Api-endpoints", "Script started successfully."); // Added logging
    res.json({ success: true, message: "Script started successfully." });
  });

  app.post("/api/script/stop", (req, res) => {
    const timestamp = new Date().toLocaleString();
    log(`[${timestamp}] [API] Stopping script...`);
    info("Api-endpoints", "Stopping script..."); // Added logging

    if (!getScriptProcess()) {
      log(`[${timestamp}] [API] No script is running.`);
      warn("Api-endpoints", "No script is running."); // Added logging
      return res
        .status(400)
        .json({ success: false, error: "No script is running." });
    }

    getScriptProcess().kill();

    log(`[${timestamp}] [API] Script stopped successfully.`);
    info("Api-endpoints", "Script stopped successfully."); // Added logging
    res.json({ success: true, message: "Script stopped successfully." });
  });

  app.get("/api/script/status", (req, res) => {
    const timestamp = new Date().toLocaleString();
    log(`[${timestamp}] [API] Checking script status...`);
    info("Api-endpoints", "Checking script status..."); // Added logging

    const running = !!getScriptProcess();
    log(`[${timestamp}] [API] Script running status: ${running}`);
    info("Api-endpoints", `Script running status: ${running}`); // Added logging
    res.json({ success: true, data: { running } });
  });

  app.get("/dashboard/api/edit/:filename", (req, res) => {
    const timestamp = new Date().toLocaleString();
    const filename = req.params.filename;
    const allowedFiles = ["index.html", "server.js", "whatsapp.js"]; // Updated to include whatsapp.js
    if (!allowedFiles.includes(filename)) {
      log(
        `[${timestamp}] [API] Invalid filename requested for editing: ${filename}`
      );
      warn("Api-endpoints", `Invalid filename requested for editing: ${filename}`); // Added logging
      return res
        .status(400)
        .json({ success: false, error: "Invalid filename" });
    }

    const filePath = path.join(__dirname, "../", filename); // Use the correct path
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        log(`[${timestamp}] [API] Error reading file ${filename}: ${err}`);
        error("Api-endpoints", `Error reading file ${filename}: ${err}`); // Added logging
        return res.status(500).json({ success: false, error: "Error reading file" });
      }
      log(`[${timestamp}] [API] Sending content of file: ${filename}`);
      info("Api-endpoints", `Sending content of file: ${filename}`); // Added logging
      res.json({ success: true, data: { content: data } });
    });
  });

  app.post("/dashboard/api/save", (req, res) => {
    const timestamp = new Date().toLocaleString();
    const { filename, content } = req.body;
    const allowedFiles = ["index.html", "server.js", "whatsapp.js"]; // Updated to include whatsapp.js
    if (!allowedFiles.includes(filename)) {
      log(
        `[${timestamp}] [API] Invalid filename provided for saving: ${filename}`
      );
      warn("Api-endpoints", `Invalid filename provided for saving: ${filename}`); // Added logging
      return res
        .status(400)
        .json({ success: false, error: "Invalid filename" });
    }

    const filePath = path.join(__dirname, "../", filename); // Use the correct path
    fs.writeFile(filePath, content, "utf8", (err) => {
      if (err) {
        log(`[${timestamp}] [API] Error saving file ${filename}: ${err}`);
        error("Api-endpoints", `Error saving file ${filename}: ${err}`); // Added logging
        return res.status(500).json({ success: false, error: "Error saving file" });
      }
      log(`[${timestamp}] [API] File ${filename} saved successfully.`);
      info("Api-endpoints", `File ${filename} saved successfully.`); // Added logging
      res.json({ success: true });
    });
  });

  // Serve logs
  app.get("/api/logs", (req, res) => {
    const logFilePath = path.join(LOGS_DIR, LOG_FILE);
    log(`[API] Fetching logs from ${logFilePath}...`);
    info("Api-endpoints", `Fetching logs from ${logFilePath}...`); // Added logging
    fs.readFile(logFilePath, "utf8", (err, data) => {
      if (err) {
        log(`[API] Error reading log file: ${err}`);
        error("Api-endpoints", `Error reading log file: ${err}`); // Added logging
        return res.status(500).send("Error reading log file");
      }
      log("[API] Logs fetched successfully.");
      info("Api-endpoints", "Logs fetched successfully."); // Added logging
      res.send(data);
    });
  });

  log("[API] Endpoints initialized.");
  info("Api-endpoints", "Endpoints initialized."); // Added logging
}