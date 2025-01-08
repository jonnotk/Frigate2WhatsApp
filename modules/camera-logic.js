// camera-logic.js
import { getCameras, setCameras, getCameraGroupMappings, setCameraGroupMappings } from "../state.js";
import { broadcast } from "./websocket-server.js";
import { setupLogging } from "../utils/logger.js"; // Added import

// Initialize logging
const { debug, info, warn, error } = setupLogging();

// Utility to log debug messages
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[camera-logic.js] ${timestamp} - ${message}`, data ? JSON.stringify(data) : "");
    debug("CameraLogic", message, data); // Added logging
}

// Add a camera to the list if it doesn't already exist
function addCamera(camera) {
    const cameras = getCameras();
    const uniqueCameras = new Set(cameras); // Use a Set to ensure uniqueness

    if (!uniqueCameras.has(camera)) {
        uniqueCameras.add(camera);
        setCameras([...uniqueCameras]); // Convert back to array and update state
        debugLog("Added new camera", { camera });
        info("CameraLogic", `Added new camera: ${camera}`); // Added logging
        broadcast("camera-update", getCameras()); // Notify WebSocket clients
    } else {
        debugLog("Camera already exists", { camera });
        debug("CameraLogic", `Camera already exists: ${camera}`); // Added logging
    }
}

// Assign a camera to a WhatsApp group
function assignCameraToGroup(camera, group) {
    const cameras = getCameras();
    if (!cameras.includes(camera)) {
        const errorMessage = `Camera "${camera}" not found`;
        debugLog("Error assigning camera to group", { error: errorMessage, camera, group });
        error("CameraLogic", errorMessage); // Added logging
        throw new Error(errorMessage);
    }

    const mappings = getCameraGroupMappings();
    mappings[camera] = group; // Directly modify the mappings object
    setCameraGroupMappings(mappings); // Update state
    debugLog("Assigned camera to group", { camera, group });
    info("CameraLogic", `Assigned camera ${camera} to group ${group}`); // Added logging
    broadcast("camera-group-updated", mappings); // Notify WebSocket clients
}

export {
    addCamera,
    assignCameraToGroup,
    getCameraGroupMappings, // Added to exports
};