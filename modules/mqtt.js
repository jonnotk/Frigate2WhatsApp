// modules/mqtt.js
import mqtt from "mqtt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { broadcast } from "./websocket-server.js";
import {
  MQTT_HOST,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  LOGS_DIR,
  CAMERA_COLOR,
  DEBUG,
} from "../constants-server.js";
import { getCameras, setCameras } from "../state.js";
import { setupLogging } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const { info, warn, error, debug } = setupLogging();

let mqttClient = null;

/**
 * Initialize the MQTT connection.
 */
function initializeMQTT() {
  info("MQTT", "Initializing MQTT connection...");

  mqttClient = mqtt.connect(MQTT_HOST, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  mqttClient.on("connect", () => {
    info("MQTT", "Connected to broker");
    broadcast("mqtt-status", { connected: true });

    // Subscribe to relevant topics
    mqttClient.subscribe("frigate/#", (err) => {
      if (!err) {
        info("MQTT", "Subscribed to topic: frigate/#");
      } else {
        error("MQTT", `Error subscribing to topic: ${err}`);
      }
    });

    // Summarize all cameras after subscription
    setTimeout(() => {
      info("MQTT", "Summary of Detected Cameras:");
      getCameras().forEach((camera) => {
        info("MQTT", `- ${camera} (Color: ${CAMERA_COLOR})`);
      });
    }, 5000); // Wait 5 seconds to ensure most topics are processed
  });

  mqttClient.on("error", (err) => {
    error("MQTT", `Error: ${err.message}`);
    broadcast("mqtt-status", { connected: false });
  });

  mqttClient.on("message", (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      handleMQTTMessage(topic, payload);
    } catch (error) {
      if (DEBUG) {
        debug("MQTT", `Ignoring non-readable message on topic ${topic}`);
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
    setCameras(cameras);
    info("MQTT", `New camera found: ${camera}`);
    broadcast("new-camera", { camera, color: CAMERA_COLOR });
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

    info("MQTT", `${severity.toUpperCase()} Event: ${JSON.stringify(formattedMessage)}`);
    broadcast("formatted-event", formattedMessage);
  }

  if (topicParts[2] === "snapshot" || topicParts[2] === "clip") {
    if (DEBUG) {
      debug("MQTT", `Ignored binary message on topic: ${topic}`);
    }
    return;
  }
}

export { initializeMQTT };