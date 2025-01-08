// modules/camera-logic.js
import {
  getCameras,
  setCameras,
  getCameraGroupMappings,
  setCameraGroupMappings,
} from "../state.js";
import { broadcast } from "./websocket-server.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { debug, info, warn, error } = setupLogging();

// Add a camera to the list if it doesn't already exist
function addCamera(camera) {
  const cameras = getCameras();
  const uniqueCameras = new Set(cameras);

  if (!uniqueCameras.has(camera)) {
    uniqueCameras.add(camera);
    setCameras([...uniqueCameras]);
    info("CameraLogic", `Added new camera: ${camera}`);
    broadcast("camera-update", getCameras());
  } else {
    debug("CameraLogic", `Camera already exists: ${camera}`);
  }
}

// Assign a camera to a WhatsApp group
function assignCameraToGroup(camera, group) {
    const mappings = getCameraGroupMappings();
    mappings[camera] = group;
    setCameraGroupMappings(mappings);
    info("CameraLogic", `Assigned camera ${camera} to group ${group}`);
    broadcast("camera-group-updated", mappings);
}

async function handleAssignCameraToGroup(camera, group) {
    try {
      const response = await fetch("/api/assign-camera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera, group }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Unknown error");
      }
  
      info("Camera Logic", `Camera ${camera} assigned to group ${group}`);
    } catch (errorData) {
      error("Camera Logic", "Error during group assignment:", errorData);
    }
  }
  

export { addCamera, assignCameraToGroup, getCameraGroupMappings, handleAssignCameraToGroup };