// public/components/camera-mapping.js
import { logDisplay } from "./log-display.js";
import { getCameras } from "../../state.js";

const cameraMapping = {
  cameraListContainer: null, // Reference to the camera list container

  /**
   * Initialize the camera mapping module.
   */
  initialize: () => {
    console.info("Camera Mapping", "Initializing module.");

    // Get the camera list container
    cameraMapping.cameraListContainer = document.getElementById("camera-list");
    if (!cameraMapping.cameraListContainer) {
      console.error("Camera Mapping", "Camera list container not found in HTML.");
      return; // Exit if the container is not found
    }

    // Attach event listener to refresh button
    const refreshButton = document.getElementById("refresh-cameras-button");
    if (refreshButton) {
      refreshButton.addEventListener("click", cameraMapping.refreshCameras);
    } else {
      console.warn("Camera Mapping", "Refresh button not found.");
    }

    // Load cameras on initialization
    cameraMapping.loadCameras();
  },

  /**
   * Fetch cameras from the backend.
   */
  loadCameras: async () => {
    console.info("Camera Mapping", "loadCameras() called");

    try {
      const response = await fetch("/api/cameras");
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Camera Mapping", "Failed to fetch cameras:", errorData);
        return;
      }

      const { data: cameras } = await response.json();
      console.info("Camera Mapping", "Cameras fetched successfully:", cameras);
      cameraMapping.updateCameraList(cameras);
    } catch (errorData) {
      console.error("Camera Mapping", "Error fetching cameras:", errorData);
    }
  },

  /**
   * Update the camera list in the UI.
   * @param {string[]} cameras - List of camera names.
   */
  updateCameraList: (cameras) => {
    console.info("Camera Mapping", "updateCameraList() called with cameras:", cameras);

    if (!cameraMapping.cameraListContainer) {
      console.error("Camera Mapping", "Camera list container not found.");
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
    console.info("Camera Mapping", "Adding camera:", camera);

    // Check if the camera already exists
    const existingCameras = Array.from(
      cameraMapping.cameraListContainer.querySelectorAll(".camera-name")
    ).map((cameraElement) => cameraElement.textContent);
    if (existingCameras.includes(camera)) {
      console.warn("Camera Mapping", `Camera ${camera} already exists in the list.`);
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
        console.info("Camera Mapping",`Group changed for camera: ${camera}, Selected group: ${selectedGroup}`);
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
    console.info("Camera Mapping", "Refreshing cameras...");
    cameraMapping.loadCameras();
  },
};

export { cameraMapping };