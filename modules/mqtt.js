import mqtt from "mqtt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { broadcast } from "./websocket-server.js";
import { MQTT_HOST, MQTT_USERNAME, MQTT_PASSWORD, LOGS_DIR, LOG_FILE, DEBUG, CAMERA_COLOR } from "../constants-server.js";
import { getCameras, setCameras } from "../state.js";
import { setupLogging } from "../utils/logger.js"; // Added import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const { debug, info, warn, error } = setupLogging(LOG_FILE);

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    console.log(`[MQTT] Created logs directory: ${LOGS_DIR}`);
    info("MQTT", `Created logs directory: ${LOGS_DIR}`); // Added logging
  } catch (error) {
    console.error(`[MQTT] Error creating logs directory: ${error.message}`);
    error("MQTT", `Error creating logs directory: ${error.message}`); // Added logging
  }
}

let mqttClient = null;

/**
 * Logs messages to the console and optionally to a file.
 * @param {string} message - The log message.
 * @param {string} colorHex - Optional color for console output.
 */
function logToFile(message, colorHex = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    // Write to log file
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    console.error(`[MQTT] Error writing to log file: ${error.message}`);
    error("MQTT", `Error writing to log file: ${error.message}`); // Added logging
  }

  // Output to console with optional color
  if (colorHex) {
    const coloredMessage = chalk.hex(colorHex)(message);
    console.log(coloredMessage);
  } else {
    console.log(message);
  }
}

/**
 * Initialize the MQTT connection.
 */
function initializeMQTT() {
  logToFile("[MQTT] Initializing MQTT connection...");
  info("MQTT", "Initializing MQTT connection..."); // Added logging

  mqttClient = mqtt.connect(MQTT_HOST, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  mqttClient.on("connect", () => {
    logToFile("[MQTT] Connected to broker");
    info("MQTT", "Connected to broker"); // Added logging
    broadcast("mqtt-status", { connected: true });

    // Subscribe to relevant topics
    mqttClient.subscribe("frigate/#", (err) => {
      if (!err) {
        logToFile("[MQTT] Subscribed to topic: frigate/#");
        info("MQTT", "Subscribed to topic: frigate/#"); // Added logging
      } else {
        logToFile(`[MQTT] Error subscribing to topic: ${err}`);
        error("MQTT", `Error subscribing to topic: ${err}`); // Added logging
      }
    });

    // Summarize all cameras after subscription
    setTimeout(() => {
      logToFile("[MQTT] Summary of Detected Cameras:");
      info("MQTT", "Summary of Detected Cameras:"); // Added logging
      getCameras().forEach((camera) => {
        logToFile(`- ${camera} (Color: ${CAMERA_COLOR})`, CAMERA_COLOR);
        info("MQTT", `- ${camera} (Color: ${CAMERA_COLOR})`); // Added logging
      });
    }, 5000); // Wait 5 seconds to ensure most topics are processed
  });

  mqttClient.on("error", (err) => {
    logToFile(`[MQTT] Error: ${err.message}`);
    error("MQTT", `Error: ${err.message}`); // Added logging
    broadcast("mqtt-status", { connected: false });
  });

  mqttClient.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      handleMQTTMessage(topic, payload);
    } catch (error) {
      if (DEBUG) {
        logToFile(`[MQTT] Ignoring non-readable message on topic ${topic}`);
        debug("MQTT", `Ignoring non-readable message on topic ${topic}`); // Added logging
      }
    }
  });
}

/**
 * Handle incoming MQTT messages.
 * @param {string} topic - The MQTT topic.
 * @param {object} payload - The message payload.
 */
function handleMQTTMessage(topic, payload) {
  const topicParts = topic.split("/");

  if (topicParts[0] !== "frigate" || topicParts.length < 2) {
    return;
  }

  const camera = topicParts[1];
  const excludedTopics = [
    "notifications",
    "events",
    "available",
    "reviews",
    "stats",
    "Zone",
  ];

  if (
    !excludedTopics.some((excluded) =>
      camera.toLowerCase().includes(excluded.toLowerCase())
    ) &&
    !getCameras().includes(camera)
  ) {
    const cameras = getCameras();
    cameras.push(camera);
    setCameras(cameras); // Update global state
    logToFile(`[MQTT] New camera found: ${camera}`, CAMERA_COLOR);
    info("MQTT", `New camera found: ${camera}`); // Added logging
    broadcast("new-camera", { camera, color: CAMERA_COLOR }); // Broadcast new camera to front end
  }

  if (topicParts.length >= 3 && topicParts[2] === "events") {
    const severity = payload.severity || "info";
    const formattedMessage = {
      camera: payload.camera,
      label: payload.label,
      zones: payload.current_zones || [],
      startTime: payload.start_time
        ? new Date(payload.start_time * 1000).toLocaleString()
        : null,
      endTime: payload.end_time
        ? new Date(payload.end_time * 1000).toLocaleString()
        : null,
      score: payload.top_score || null,
      severity,
      color: severity === "alert" ? "#ff4d4d" : "#007bff",
    };

    logToFile(
      `[MQTT] ${severity.toUpperCase()} Event: ${JSON.stringify(formattedMessage)}`,
      formattedMessage.color
    );
    info("MQTT", `${severity.toUpperCase()} Event: ${JSON.stringify(formattedMessage)}`); // Added logging
    broadcast("formatted-event", formattedMessage);
  }

  if (topicParts[2] === "snapshot" || topicParts[2] === "clip") {
    if (DEBUG) {
      logToFile(`[MQTT] Ignored binary message on topic: ${topic}`);
      debug("MQTT", `Ignored binary message on topic: ${topic}`); // Added logging
    }
    return;
  }
}

export { initializeMQTT };