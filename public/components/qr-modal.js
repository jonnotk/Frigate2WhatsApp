// components/qr-modal.js
import { logDisplay } from "./log-display.js";
import { setupLogging } from "../../utils/logger.js";

const { log, debug, info, warn, error } = setupLogging();

const qrModal = {
  /**
   * Initializes the QR modal component.
   */
  initialize: () => {
    info("QR-Modal", "Initializing...");

    // Add event listener to close button
    const closeButton = document.getElementById("close-qr-button");
    if (closeButton) {
      closeButton.addEventListener("click", qrModal.hideQR);
    } else {
      error("QR-Modal", "Close button not found.");
    }

    info("QR-Modal", "Initialized.");
  },

  /**
   * Displays the QR code modal.
   */
  showQR: () => {
    info("QR-Modal", "Displaying QR code modal...");
    const qrModalElement = document.getElementById("qr-modal");
    const qrImageElement = document.getElementById("qr-image");

    if (!qrModalElement || !qrImageElement) {
      error("QR-Modal", "Required elements not found in the DOM.");
      return;
    }

    // Use a hardcoded path for the loading GIF
    const loadingGifPath = "/assets/loading.gif"; // Ensure this path is correct
    qrImageElement.src = loadingGifPath;
    qrImageElement.alt = "Waiting for QR code...";
    warn("QR-Modal", "Waiting for QR Code...");

    qrModalElement.style.display = "block";
  },

  /**
   * Hides the QR code modal.
   */
  hideQR: () => {
    info("QR-Modal", "Hiding QR code modal...");
    const qrModalElement = document.getElementById("qr-modal");

    if (!qrModalElement) {
      error("QR-Modal", "QR modal element not found.");
      return;
    }

    qrModalElement.style.display = "none";
    info("QR-Modal", "QR Code modal closed.");
  },

  /**
   * Updates the QR code image with new data.
   * @param {string} qrData - The QR code payload received from the WhatsApp API.
   */
  updateQR: (qrData) => {
    info("QR-Modal", "Updating QR code...");
    if (!qrData) {
      error("QR-Modal", "Invalid QR code data received.");
      return;
    }

    const qrImageElement = document.getElementById("qr-image");
    if (!qrImageElement) {
      error("QR-Modal", "QR image element not found.");
      return;
    }

    // Clear any existing QR code
    qrImageElement.innerHTML = "";

    // Generate a QR code using qrcode.js
    try {
      new QRCode(qrImageElement, {
        text: qrData,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });
      info("QR-Modal", "QR Code updated.");
    } catch (err) {
      error("QR-Modal", `Error generating QR code: ${err}`);
    }
  },

  /**
   * Automatically close the QR modal when WhatsApp is connected.
   */
  autoCloseOnConnection: () => {
    info("QR-Modal", "WhatsApp connected. Closing QR Code modal automatically.");
    qrModal.hideQR();
  },

  // Function to explicitly show the QR modal
  showModal: () => {
      info("QR-Modal", "Displaying QR code modal...");
      const qrModalElement = document.getElementById("qr-modal");
      if (qrModalElement) {
          qrModalElement.style.display = "block";
      } else {
          error("QR-Modal", "QR modal element not found.");
      }
  },
};

// Export showModal function specifically
function showQRModal() {
  info("QR-Modal", "Showing QR Modal on user request.");
  qrModal.showModal();
}

// Call initialize() to set up the event listener
qrModal.initialize();

export { qrModal, showQRModal };