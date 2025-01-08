import { logDisplay } from "./log-display.js";
import { getCameras, getCameraGroupMappings, setCameraGroupMappings } from "../../state.js";

const cameraMapping = {
  cameraListContainer: null, // Reference to the camera list container

  /**
   * Initialize the camera mapping module.
   */
  initialize: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Camera Mapping] Initializing module.`);

    // Get the camera list container
    cameraMapping.cameraListContainer = document.getElementById("camera-list");
    if (!cameraMapping.cameraListContainer) {
      console.error(`[${timestamp}] [Camera Mapping] Camera list container not found in HTML.`);
      logDisplay.appendLog("log-container-server", `[Camera Mapping] Camera list container not found.`);
      return; // Exit if the container is not found
    }

    // Attach event listener to refresh button
    const refreshButton = document.getElementById("refresh-cameras-button");
    if (refreshButton) {
      refreshButton.addEventListener("click", cameraMapping.refreshCameras);
    } else {
      console.warn(`[${timestamp}] [Camera Mapping] Refresh button not found.`);
      logDisplay.appendLog("log-container-server", `[Camera Mapping] Refresh button not found.`);
    }

    // Load cameras on initialization
    cameraMapping.loadCameras();
  },

  /**
   * Fetch cameras from the backend.
   */
  loadCameras: async () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Camera Mapping] loadCameras() called`);

    try {
      const response = await fetch("/api/cameras");
      if (!response.ok) {
        const error = await response.json();
        console.error(`[${timestamp}] [Camera Mapping] Failed to fetch cameras:`, error);
        logDisplay.appendLog("log-container-server", `Error loading cameras: ${error.error || "Unknown error"}`);
        return;
      }

      const { data: cameras } = await response.json();
      console.log(`[${timestamp}] [Camera Mapping] Cameras fetched successfully:`, cameras);
      cameraMapping.updateCameraList(cameras);
    } catch (error) {
      console.error(`[${timestamp}] [Camera Mapping] Error fetching cameras:`, error);
      logDisplay.appendLog("log-container-server", `Network error while fetching cameras: ${error.message}`);
    }
  },

  /**
   * Update the camera list in the UI.
   * @param {string[]} cameras - List of camera names.
   */
  updateCameraList: (cameras) => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Camera Mapping] updateCameraList() called with cameras:`, cameras);

    if (!cameraMapping.cameraListContainer) {
      console.error(`[${timestamp}] [Camera Mapping] Camera list container not found.`);
      return;
    }

    // Clear the existing list
    cameraMapping.cameraListContainer.innerHTML = "";

    // Populate the camera list
    cameras.forEach((camera) => {
      cameraMapping.addCamera(camera);
    });
  },

  /**
   * Dynamically add a new camera to the UI.
   * @param {string} camera - Name of the camera.
   */
  addCamera: (camera) => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Camera Mapping] Adding camera:`, camera);

    // Check if the camera already exists
    const existingCameras = Array.from(cameraMapping.cameraListContainer.querySelectorAll(".camera-name")).map(
      (cameraElement) => cameraElement.textContent
    );
    if (existingCameras.includes(camera)) {
      console.warn(`[${timestamp}] [Camera Mapping] Camera ${camera} already exists in the list.`);
      return;
    }

    // Create a new camera row
    const cameraRow = document.createElement("div");
    cameraRow.className = "camera-row";

    const cameraName = document.createElement("span");
    cameraName.textContent = camera;
    cameraName.className = "camera-name";

    const groupSelect = document.createElement("select");
    groupSelect.className = "camera-group";
    groupSelect.id = `group-select-${camera}`; // Add a unique ID
    groupSelect.innerHTML = `
      <option value="">Select Group</option>
      <option value="group1">Group 1</option>
      <option value="group2">Group 2</option>
      <option value="group3">Group 3</option>
    `;
    groupSelect.addEventListener("change", async () => {
      console.log(`[${timestamp}] [Camera Mapping] Group changed for camera: ${camera}, Selected group: ${groupSelect.value}`);
      try {
        const response = await fetch("/api/assign-camera", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camera, group: groupSelect.value }),
        });
        if (!response.ok) {
          const error = await response.json();
          console.error(`[${timestamp}] [Camera Mapping] Error assigning group:`, error);
          logDisplay.appendLog("log-container-server", `Error assigning camera ${camera} to group: ${error.error}`);
        } else {
          console.log(`[${timestamp}] [Camera Mapping] Camera ${camera} assigned to group ${groupSelect.value}`);
          logDisplay.appendLog("log-container", `Camera ${camera} assigned to group ${groupSelect.value}.`);
        }
      } catch (error) {
        console.error(`[${timestamp}] [Camera Mapping] Error during group assignment:`, error);
        logDisplay.appendLog("log-container-server", `Error assigning camera ${camera} to group: ${error.message}`);
      }
    });

    cameraRow.appendChild(cameraName);
    cameraRow.appendChild(groupSelect);
    cameraMapping.cameraListContainer.appendChild(cameraRow);
  },

  /**
   * Refresh the camera list.
   */
  refreshCameras: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Camera Mapping] Refreshing cameras...`);
    cameraMapping.loadCameras();
  },
};

export { cameraMapping };