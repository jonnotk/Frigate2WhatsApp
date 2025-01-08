// public/app.js
import { cameraMapping } from './components/camera-mapping.js';
import { codeEditor } from './components/code-editor.js';
import { fileEditor } from './components/file-editor.js';
import { logDisplay } from './components/log-display.js';
import { qrModal } from './components/qr-modal.js';
import { initialize } from './components/whatsapp-connection.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the imported modules
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

    // You can add more initializations or logic here as needed
});