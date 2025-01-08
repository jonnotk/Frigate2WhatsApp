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
    const cameras = getCameras();
    if (!cameras.includes(camera)) {
      const errorMessage = `Camera "${camera}" not found`;
      error("CameraLogic", errorMessage);
      throw new Error(errorMessage);
    }
  
    const mappings = getCameraGroupMappings();
    mappings[camera] = group;
    setCameraGroupMappings(mappings);
    info("CameraLogic", `Assigned camera ${camera} to group ${group}`);
    broadcast("camera-group-updated", mappings);
  }
  
  export { addCamera, assignCameraToGroup, getCameraGroupMappings };