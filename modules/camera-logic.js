// modules/camera-logic.js
import {
  getCameras,
  setCameras,
  getCameraGroupMappings,
  setCameraGroupMappings,
  notifyStateChange,
} from "../state.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, error, debug } = setupLogging();

// Add a camera to the list if it doesn't already exist
function addCamera(camera) {
  const cameras = getCameras();

  if (!cameras.includes(camera)) {
      setCameras([...cameras, camera]); // Update state and notify
      info("CameraLogic", `Added new camera: ${camera}`);
  } else {
      debug("CameraLogic", `Camera already exists: ${camera}`);
  }
}

// Assign a camera to a WhatsApp group
function assignCameraToGroup(camera, group) {
  const mappings = getCameraGroupMappings();
  if (mappings[camera] !== group) {
      mappings[camera] = group;
      setCameraGroupMappings(mappings);
      info("CameraLogic", `Assigned camera ${camera} to group ${group}`);
      notifyStateChange("camera-group-mappings-update", mappings); // Notify after updating state
  } else {
      debug("CameraLogic", `Camera ${camera} is already assigned to group ${group}`);
  }
}

export { addCamera, assignCameraToGroup, getCameraGroupMappings };