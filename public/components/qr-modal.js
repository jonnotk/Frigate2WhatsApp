// components/qr-modal.js

const qrModal = {
    /**
     * Initializes the QR modal component.
     */
    initialize: () => {
      console.info("QR-Modal", "Initializing...");
  
      // Add event listener to close button
      const closeButton = document.getElementById("close-qr-button");
      if (closeButton) {
        closeButton.addEventListener("click", qrModal.hideQR);
      } else {
        console.error("QR-Modal", "Close button not found.");
      }
  
      console.info("QR-Modal", "Initialized.");
    },
  
    /**
     * Displays the QR code modal.
     */
    showQR: () => {
      console.info("QR-Modal", "Displaying QR code modal...");
      const qrModalElement = document.getElementById("qr-modal");
      const qrImageElement = document.getElementById("qr-image");
  
      if (!qrModalElement || !qrImageElement) {
        console.error("QR-Modal", "Required elements not found in the DOM.");
        return;
      }
  
      // Use a hardcoded path for the loading GIF
      const loadingGifPath = "/assets/loading.gif"; // Ensure this path is correct and that you have a loading.gif file
      qrImageElement.src = loadingGifPath;
      qrImageElement.alt = "Waiting for QR code...";
      console.warn("QR-Modal", "Waiting for QR Code...");
  
      qrModalElement.style.display = "block";
    },
  
    /**
     * Hides the QR code modal.
     */
    hideQR: () => {
      console.info("QR-Modal", "Hiding QR code modal...");
      const qrModalElement = document.getElementById("qr-modal");
  
      if (!qrModalElement) {
        console.error("QR-Modal", "QR modal element not found.");
        return;
      }
  
      qrModalElement.style.display = "none";
      console.info("QR-Modal", "QR Code modal closed.");
    },
  
    /**
     * Updates the QR code image with new data.
     * @param {string} qrData - The QR code payload received from the WhatsApp API.
     */
    updateQR: (qrData) => {
      console.info("QR-Modal", "Updating QR code...");
      if (!qrData) {
        console.error("QR-Modal", "Invalid QR code data received.");
        return;
      }
  
      const qrImageElement = document.getElementById("qr-image");
      if (!qrImageElement) {
        console.error("QR-Modal", "QR image element not found.");
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
        console.info("QR-Modal", "QR Code updated.");
      } catch (err) {
        console.error("QR-Modal", `Error generating QR code: ${err}`);
      }
    },
  
    /**
     * Automatically close the QR modal when WhatsApp is connected.
     */
    autoCloseOnConnection: () => {
      console.info("QR-Modal", "WhatsApp connected. Closing QR Code modal automatically.");
      qrModal.hideQR();
    },
  
    // Function to explicitly show the QR modal
    showModal: () => {
      console.info("QR-Modal", "Displaying QR code modal...");
      const qrModalElement = document.getElementById("qr-modal");
      if (qrModalElement) {
        qrModalElement.style.display = "block";
      } else {
        console.error("QR-Modal", "QR modal element not found.");
      }
    },
  };
  
  // Export showModal function specifically
  function showQRModal() {
    console.info("QR-Modal", "Showing QR Modal on user request.");
    qrModal.showModal();
  }
  
  // Call initialize() to set up the event listener
  qrModal.initialize();
  
  export { qrModal, showQRModal };