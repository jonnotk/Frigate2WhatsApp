// public/app.js
import { cameraMapping } from './components/camera-mapping.js';
import { codeEditor } from './components/code-editor.js';
import { fileEditor } from './components/file-editor.js';
import { qrModal } from './components/qr-modal.js';
import { initialize, initWhatsAppConnection } from './components/whatsapp-connection.js';
import { initializeSocket } from "./components/websocket-client.js";

document.addEventListener('DOMContentLoaded', async () => {
  console.info('App', 'DOM fully loaded and parsed');

  // Initialize the WebSocket connection first and wait for it to be established
  try {
    await initializeSocket();
    console.info('App', 'WebSocket connection initialized.');

    // Initialize other modules that depend on the WebSocket connection
    cameraMapping.initialize();
    codeEditor.initialize();
    fileEditor.initialize();
    qrModal.initialize();
    initialize();

    // Now that the WebSocket is ready, initiate WhatsApp connection
    initWhatsAppConnection();

    // Add event listeners to buttons - No changes here
    document.getElementById("export-logs-button")?.addEventListener("click", () => {
        fetch('/api/logs')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(logs => {
                const blob = new Blob([logs], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'logs.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Error fetching logs:', error);
            });
    });

    document.getElementById("export-server-logs-button")?.addEventListener("click", () => {
        fetch('/api/logs')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(logs => {
                const blob = new Blob([logs], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'server-logs.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Error fetching logs:', error);
            });
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

  } catch (error) {
      console.error('App', 'Error initializing WebSocket:', error);
  }
});