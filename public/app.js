// public/app.js
import { cameraMapping } from './components/camera-mapping.js';
import { codeEditor } from './components/code-editor.js';
import { fileEditor } from './components/file-editor.js';
import { logDisplay } from './components/log-display.js';
import { qrModal } from './components/qr-modal.js';
import { initialize } from './components/whatsapp-connection.js';
import { initializeSocket } from "./components/websocket-client.js";
import { setupLogging } from '../utils/logger.js';

// Initialize logging
const { info, warn, error } = setupLogging();

document.addEventListener('DOMContentLoaded', () => {
  info('App', 'DOM fully loaded and parsed');

  // Initialize the imported modules
  initializeSocket();
  cameraMapping.initialize();
  codeEditor.initialize();
  fileEditor.initialize();
  logDisplay.initialize();
  qrModal.initialize();
  initialize();

  // Add event listeners to buttons
  document.getElementById("export-logs-button")?.addEventListener("click", () => {
    logDisplay.exportLogs("log-container");
  });

  document.getElementById("export-server-logs-button")?.addEventListener("click", () => {
    logDisplay.exportLogs("log-container-server", "server-logs.txt");
  });

  // Attach event listeners to the file editor buttons
  document.getElementById("edit-index-button")?.addEventListener("click", () => {
    fileEditor.editFile("index.html");
  });

  document.getElementById("edit-server-button")?.addEventListener("click", () => {
    fileEditor.editFile("server.js");
  });

  document.getElementById("edit-whatsapp-button")?.addEventListener("click", () => {
    fileEditor.editFile("whatsapp.js");
  });
});