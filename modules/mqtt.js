// modules/mqtt.js
import mqtt from "mqtt";
import {
    MQTT_HOST,
    MQTT_USERNAME,
    MQTT_PASSWORD,
    DEBUG,
} from "../constants-server.js";
import { getCameras, setCameras, notifyStateChange } from "./server-state.js"; // Import from server-state
import { setupLogging } from "../utils/logger.js";
import { assignCameraToGroup, getCameraGroupMappings } from "./camera-logic.js"; // Import from camera-logic

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
        notifyStateChange("mqtt-status-update", { connected: true });

        // Subscribe to relevant topics
        mqttClient.subscribe("frigate/#", (err) => {
            if (!err) {
                info("MQTT", "Subscribed to topic: frigate/#");
            } else {
                error("MQTT", `Error subscribing to topic: ${err}`);
            }
        });
    });

    mqttClient.on("error", (err) => {
        error("MQTT", `Error: ${err.message}`);
        notifyStateChange("mqtt-status-update", { connected: false });
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

    if (!excludedTopics.some((excluded) => camera.toLowerCase().includes(excluded.toLowerCase()))) {
        // Add the camera only if it doesn't already exist
        handleNewCamera(camera); // This function now just adds a new camera to state if not already present
    }

    if (topicParts.length >= 3 && topicParts[2] === "events") {
        const severity = payload.type;
        const eventType = payload.type;
        const eventStatus = payload.after.end_time ? "ended" : "started";

        info("MQTT", `${severity.toUpperCase()} Event: ${eventType} ${payload.after.label} in ${payload.after.camera} ${eventStatus}`);

        // Only broadcast if there's a meaningful change for the frontend
        if (eventStatus === "started" || eventStatus === "ended") {
            notifyStateChange("formatted-event", {
                camera: payload.after.camera,
                severity: severity,
                event: eventType,
                label: payload.after.label,
                zones: payload.after.current_zones || [],
                startTime: payload.after.start_time ? new Date(payload.after.start_time * 1000).toLocaleString() : null,
                endTime: payload.after.end_time ? new Date(payload.after.end_time * 1000).toLocaleString() : null,
                thumbnail: payload.after.thumbnail,
            });
        }
    }

    if (topicParts[2] === "snapshot" || topicParts[2] === "clip") {
        if (DEBUG) {
            debug("MQTT", `Ignored binary message on topic: ${topic}`);
        }
        return;
    }
}

// Handle new camera logic (called from handleMQTTMessage)
function handleNewCamera(camera) {
    const cameras = getCameras();
    if (!cameras.has(camera)) {
        info("CameraLogic", `Adding new camera: ${camera}`);
        // Create a new Map with the added camera and copy existing details
        const updatedCameras = new Map(cameras);
        updatedCameras.set(camera, {}); // Initialize with an empty object for future details
        setCameras(updatedCameras); // Update state and notify
    } else {
        debug("CameraLogic", `Camera already exists: ${camera}`);
    }
}

export { initializeMQTT };