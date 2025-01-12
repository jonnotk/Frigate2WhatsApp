// modules/api-endpoints.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import {
  startScript,
  stopScript,
  getScriptProcess,
} from "./script-manager.js";
import {
  isConnected,
  getAccountInfo,
  getQrCodeData,
  unlinkWhatsApp,
} from "./whatsapp.js";
import {
  DASHBOARD_DIR,
  LOGS_DIR,
  LOG_FILE,
  BASE_DIR,
} from "../constants-server.js";
import {
  getCameraGroupMappings,
  getCameras,
  getIsSubscribed,
  notifyStateChange,
} from "../state.js";
import { setupLogging } from "../utils/logger.js";
import { assignCameraToGroup } from "./camera-logic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const { log, info, warn, error } = setupLogging(LOG_FILE);

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

// Assign a camera to a WhatsApp group
async function handleAssignCameraToGroup(camera, group) {
  info("api-endpoints", `Assigning camera ${camera} to group ${group}...`);
  try {
    // Validate the camera and group (add more robust validation as needed)
    if (!camera || !group) {
      throw new Error("Invalid camera or group provided.");
    }

    // Update the camera group mappings in the state
    assignCameraToGroup(camera, group); // Ensure this function is synchronous or properly awaited

    info(
      "api-endpoints",
      `Camera ${camera} assigned to group ${group} successfully.`
    );
  } catch (err) {
    error("api-endpoints", `Error assigning camera to group: ${err.message}`);
    throw err; // Re-throw the error to be handled by the caller
  }
}

function setupApiEndpoints(app) {
  app.get("/api/qr", (req, res) => {
    try {
      const qrCodeData = getQrCodeData();
      if (!qrCodeData) {
        warn("Api-endpoints", "QR code not available");
        return res
          .status(404)
          .json({ success: false, error: "QR code not available" });
      }
      info("Api-endpoints", "QR Code data sent");
      res.json({ success: true, data: { qr: qrCodeData } });
    } catch (error) {
      error("Api-endpoints", `Error fetching QR code: ${error}`);
      res.status(500).json({ success: false, error: "Failed to fetch QR code" });
    }
  });

    app.get("/api/cameras", (req, res) => {
        info("Api-endpoints", "Camera list requested");
        const cameras = getCameras();
        if (!cameras || cameras.length === 0) {
            warn("Api-endpoints", "No cameras found");
            return res.status(404).json({ success: false, error: "No cameras found" });
        }
        info("Api-endpoints", `Cameras fetched successfully: ${cameras}`);
        res.json({ success: true, data: cameras });
    });

  app.get("/api/camera-group-mappings", (req, res) => {
    info("Api-endpoints", "Camera group mappings requested");
    const mappings = getCameraGroupMappings();
    if (!mappings) {
      warn("Api-endpoints", "No camera group mappings found");
      return res
        .status(404)
        .json({ success: false, error: "No camera group mappings found" });
    }
    info(
      "Api-endpoints",
      `Camera group mappings fetched successfully:`,
      mappings
    );
    res.json({ success: true, data: mappings });
  });

  app.post("/api/wa/unlink", async (req, res) => {
    try {
      await unlinkWhatsApp();
      notifyStateChange("wa-status-update", { connected: false });
      notifyStateChange("wa-account-update", { name: null, number: null });
      info("Api-endpoints", "WhatsApp unlinked");
      res.json({ success: true });
    } catch (error) {
      error("Api-endpoints", `Error unlinking WhatsApp: ${error}`);
      res
        .status(500)
        .json({ success: false, error: "Failed to unlink WhatsApp" });
    }
  });

  app.get("/api/wa/status", (req, res) => {
    info("Api-endpoints", "WhatsApp status requested");
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
    info("Api-endpoints", "WhatsApp subscription status requested");

    try {
      // Check subscription status
      const isSubscribed = getIsSubscribed();
      res.json({ success: true, data: { subscribed: isSubscribed } });
    } catch (error) {
      error(
        "Api-endpoints",
        `Error checking subscription status: ${error}`
      );
      res
        .status(500)
        .json({
          success: false,
          error: "Failed to check subscription status",
        });
    }
  });

  app.post("/api/assign-camera", async (req, res) => {
    const { camera, group } = req.body;
    if (!validatePayload(req.body, ["camera", "group"])) {
      warn("Api-endpoints", "Invalid request: camera and group are required");
      return res
        .status(400)
        .json({ success: false, error: "Camera and group are required" });
    }
    try {
      await handleAssignCameraToGroup(camera, group);
      info("Api-endpoints", `Camera ${camera} assigned to group ${group}`);
      res.json({ success: true });
    } catch (error) {
      error(
        "Api-endpoints",
        `Error assigning camera to group: ${error.message}`
      );
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/script/start", (req, res) => {
    info("Api-endpoints", "Starting script...");

    if (getScriptProcess()) {
      warn("Api-endpoints", "Script is already running.");
      return res
        .status(400)
        .json({ success: false, error: "Script is already running." });
    }

    try {
      startScript();
      info("Api-endpoints", "Script started successfully.");
      res.json({ success: true, message: "Script started successfully." });
    } catch (error) {
      error("Api-endpoints", `Error starting script: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/script/stop", (req, res) => {
    info("Api-endpoints", "Stopping script...");

    if (!getScriptProcess()) {
      warn("Api-endpoints", "No script is running.");
      return res
        .status(400)
        .json({ success: false, error: "No script is running." });
    }

    try {
      stopScript();
      info("Api-endpoints", "Script stopped successfully.");
      res.json({ success: true, message: "Script stopped successfully." });
    } catch (error) {
      error("Api-endpoints", `Error stopping script: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/script/status", (req, res) => {
    info("Api-endpoints", "Checking script status...");

    const running = !!getScriptProcess();
    info("Api-endpoints", `Script running status: ${running}`);
    res.json({ success: true, data: { running } });
  });

  // Serve logs
  app.get("/api/logs", (req, res) => {
    const logFilePath = path.join(LOGS_DIR, LOG_FILE);
    info("Api-endpoints", `Fetching logs from ${logFilePath}...`);
    fs.readFile(logFilePath, "utf8", (err, data) => {
      if (err) {
        error("Api-endpoints", `Error reading log file: ${err}`);
        return res.status(500).send("Error reading log file");
      }
      info("Api-endpoints", "Logs fetched successfully.");
      res.send(data);
    });
  });

  app.get("/dashboard/api/edit/:filename", async (req, res) => {
    const filename = req.params.filename;
    const allowedFiles = ["index.html", "server.js", "whatsapp.js"];
    if (!allowedFiles.includes(filename)) {
      warn(
        "Api-endpoints",
        `Invalid filename requested for editing: ${filename}`
      );
      return res
        .status(400)
        .json({ success: false, error: "Invalid filename" });
    }

    const filePath = path.join(BASE_DIR, filename);

    try {
      const data = await fs.promises.readFile(filePath, "utf8"); // Use async version
      info("Api-endpoints", `Sending content of file: ${filename}`);
      res.json({ success: true, data: { content: data } });
    } catch (err) {
      error("Api-endpoints", `Error reading file ${filename}: ${err}`);
      res.status(500).json({ success: false, error: "Error reading file" });
    }
  });

  app.post("/dashboard/api/save", async (req, res) => {
    const { filename, content } = req.body;
    const allowedFiles = ["index.html", "server.js", "whatsapp.js"];
    if (!allowedFiles.includes(filename)) {
      warn(
        "Api-endpoints",
        `Invalid filename provided for saving: ${filename}`
      );
      return res
        .status(400)
        .json({ success: false, error: "Invalid filename" });
    }

    const filePath = path.join(BASE_DIR, filename); // Use the correct path

    try {
      await fs.promises.writeFile(filePath, content, "utf8"); // Use async version
      info("Api-endpoints", `File ${filename} saved successfully.`);
      res.json({ success: true });
    } catch (err) {
      error("Api-endpoints", `Error saving file ${filename}: ${err}`);
      res.status(500).json({ success: false, error: "Error saving file" });
    }
  });

  info("Api-endpoints", "Endpoints initialized.");
}

// Export only once at the end:
export { setupApiEndpoints, handleAssignCameraToGroup };