// modules/camera-logic.js
import {
  getCameras,
  getCameraGroupMappings,
  setCameraGroupMappings,
  notifyStateChange,
} from "../server-state.js"; // Import from server-state
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, error, debug } = setupLogging();

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

export { assignCameraToGroup, getCameraGroupMappings };