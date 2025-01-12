// public/app.js
import { cameraMapping } from './components/camera-mapping.js';
import { codeEditor } from './components/code-editor.js';
import { fileEditor } from './components/file-editor.js';
import { qrModal } from './components/qr-modal.js';
import { initializeWhatsAppConnection } from './components/whatsapp-connection.js';
import { initializeSocket } from "./components/websocket-client.js";

document.addEventListener('DOMContentLoaded', async () => {
    console.info('App', 'DOM fully loaded and parsed');

    // Initialize the WebSocket connection
    try {
        initializeSocket();
        console.info('App', 'WebSocket connection initialized.');

        // Initialize other modules that depend on the WebSocket connection
        cameraMapping.initialize();
        codeEditor.initialize();
        fileEditor.initialize();
        qrModal.initialize();
        initializeWhatsAppConnection();

    } catch (error) {
        console.error('App', 'Error initializing WebSocket:', error);
    }
});