// public/components/camera-mapping.js
import {
    getCameras,
    getCameraGroupMappings,
    on,
} from "../client-state.js";

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

      // Update the camera list when the state changes
      on("cameras-update", () => {
          console.info("Camera Mapping", "Cameras updated, reloading cameras.");
          cameraMapping.loadCameras();
      });

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
            if (response.status === 404 && errorData.error === 'No cameras found') {
                console.warn("Camera Mapping", "No cameras found in the database.");
                cameraMapping.updateCameraList([], {}); // Update with an empty list
            } else {
                console.error("Camera Mapping", "Failed to fetch cameras:", errorData);
            }
            return;
        }
        const { data: cameras } = await response.json();
        console.info("Camera Mapping", "Cameras fetched successfully:", cameras);
        // Fetch group mappings from the server
        const mappingsResponse = await fetch("/api/camera-group-mappings");
        if (!mappingsResponse.ok) {
            const errorData = await mappingsResponse.json();
            console.error("Camera Mapping", "Failed to fetch camera group mappings:", errorData);
            return;
        }
        const { data: mappings } = await mappingsResponse.json();
        console.info("Camera Mapping", "Camera group mappings fetched successfully:", mappings);
        if (cameras && cameras.length > 0) {
            cameraMapping.updateCameraList(cameras, mappings);
        } else {
            console.warn("Camera Mapping", "No cameras returned from API.");
        }
    } catch (errorData) {
        console.error("Camera Mapping", "Error fetching cameras:", errorData);
    }
},


  /**
   * Update the camera list in the UI.
   * @param {string[]} cameras - List of camera names.
   * @param {object} mappings - Object containing camera-group mappings.
   */
  updateCameraList: (cameras, mappings) => {
    console.info("Camera Mapping", "updateCameraList() called with cameras:", cameras, "and mappings:", mappings);

    if (!cameraMapping.cameraListContainer) {
        console.error("Camera Mapping", "Camera list container not found.");
        return;
    }

    // Only clear the list if cameras are available
    if (cameras && cameras.length > 0) {
        cameraMapping.cameraListContainer.innerHTML = "";

        // Populate the camera list
        cameras.forEach((camera) => {
            cameraMapping.addCameraToUI(camera, mappings && mappings[camera] ? mappings[camera] : null);
        });
    }
},

  /**
   * Dynamically add a new camera to the UI.
   * @param {string} camera - Name of the camera.
   * @param {string} group - Name of the group the camera is assigned to.
   */
  addCameraToUI: (camera, group) => {
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

      // Set the selected group if available
      if (group) {
          groupSelect.value = group;
      }

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