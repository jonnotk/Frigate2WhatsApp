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

// Function to handle new cameras
function handleNewCamera(camera) {
  const cameras = getCameras();
  if (!cameras.has(camera)) {
      info("CameraLogic", `Adding new camera: ${camera}`);
      // Create a new Map with the added camera and copy existing details
      const updatedCameras = new Map(cameras);
      updatedCameras.set(camera, {}); // Initialize with an empty object for future details
      setCameras(Array.from(updatedCameras.keys())); // Update state and notify
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

export { handleNewCamera, assignCameraToGroup, getCameraGroupMappings };