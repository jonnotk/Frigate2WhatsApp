// public/components/camera-mapping.js
import { logDisplay } from "./log-display.js";
import { getCameras } from "../../state.js";
import { setupLogging } from "../../utils/logger.js";

// Initialize logging
const { info, warn, error } = setupLogging();

const cameraMapping = {
  cameraListContainer: null, // Reference to the camera list container

  /**
   * Initialize the camera mapping module.
   */
  initialize: () => {
    info("Camera Mapping", "Initializing module.");

    // Get the camera list container
    cameraMapping.cameraListContainer = document.getElementById("camera-list");
    if (!cameraMapping.cameraListContainer) {
      error("Camera Mapping", "Camera list container not found in HTML.");
      logDisplay.appendLog(
        "log-container-server",
        "[Camera Mapping] Camera list container not found."
      );
      return; // Exit if the container is not found
    }

    // Attach event listener to refresh button
    const refreshButton = document.getElementById("refresh-cameras-button");
    if (refreshButton) {
      refreshButton.addEventListener("click", cameraMapping.refreshCameras);
    } else {
      warn("Camera Mapping", "Refresh button not found.");
      logDisplay.appendLog(
        "log-container-server",
        "[Camera Mapping] Refresh button not found."
      );
    }

    // Load cameras on initialization
    cameraMapping.loadCameras();
  },

  /**
   * Fetch cameras from the backend.
   */
  loadCameras: async () => {
    info("Camera Mapping", "loadCameras() called");

    try {
      const response = await fetch("/api/cameras");
      if (!response.ok) {
        const errorData = await response.json();
        error("Camera Mapping", "Failed to fetch cameras:", errorData);
        logDisplay.appendLog(
          "log-container-server",
          `Error loading cameras: ${errorData.error || "Unknown error"}`
        );
        return;
      }

      const { data: cameras } = await response.json();
      info("Camera Mapping", "Cameras fetched successfully:", cameras);
      cameraMapping.updateCameraList(cameras);
    } catch (errorData) {
      error("Camera Mapping", "Error fetching cameras:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Network error while fetching cameras: ${errorData.message}`
      );
    }
  },

  /**
   * Update the camera list in the UI.
   * @param {string[]} cameras - List of camera names.
   */
  updateCameraList: (cameras) => {
    info("Camera Mapping", "updateCameraList() called with cameras:", cameras);

    if (!cameraMapping.cameraListContainer) {
      error("Camera Mapping", "Camera list container not found.");
      return;
    }

    // Clear the existing list
    cameraMapping.cameraListContainer.innerHTML = "";

    // Populate the camera list
    cameras.forEach((camera) => {
      cameraMapping.addCameraToUI(camera);
    });
  },

  /**
   * Dynamically add a new camera to the UI.
   * @param {string} camera - Name of the camera.
   */
  addCameraToUI: (camera) => {
    info("Camera Mapping", "Adding camera:", camera);

    // Check if the camera already exists
    const existingCameras = Array.from(
      cameraMapping.cameraListContainer.querySelectorAll(".camera-name")
    ).map((cameraElement) => cameraElement.textContent);
    if (existingCameras.includes(camera)) {
      warn("Camera Mapping", `Camera ${camera} already exists in the list.`);
      return;
    }

    // Create a new camera item
    const cameraItem = document.createElement("div");
    cameraItem.className = "camera-item";

    const cameraName = document.createElement("span");
    cameraName.textContent = camera;
    cameraName.className = "camera-name";

    const groupSelect = document.createElement("select");
    groupSelect.className = "group-select";
    groupSelect.id = `group-select-${camera}`;
    groupSelect.innerHTML = `
        <option value="">Select Group</option>
        <option value="group1">Group 1</option>
        <option value="group2">Group 2</option>
        <option value="group3">Group 3</option>
      `;

    // Add event listener for changing the group
    groupSelect.addEventListener("change", async () => {
        const selectedGroup = groupSelect.value;
        info("Camera Mapping",`Group changed for camera: ${camera}, Selected group: ${selectedGroup}`);
        window.ws.send(JSON.stringify({
            event: "assign-camera-to-group",
            data: { camera: camera, group: selectedGroup }
        }));
    });

    cameraItem.appendChild(cameraName);
    cameraItem.appendChild(groupSelect);
    cameraMapping.cameraListContainer.appendChild(cameraItem);
  },

  /**
   * Refresh the camera list.
   */
  refreshCameras: () => {
    info("Camera Mapping", "Refreshing cameras...");
    cameraMapping.loadCameras();
  },
};

export { cameraMapping };