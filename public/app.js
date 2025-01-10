// public/app.js
import { cameraMapping } from './components/camera-mapping.js';
import { codeEditor } from './components/code-editor.js';
import { fileEditor } from './components/file-editor.js';
import { qrModal } from './components/qr-modal.js';
import { initializeWhatsAppConnection } from './components/whatsapp-connection.js';
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
    initializeWhatsAppConnection();

    // Add event listeners to buttons
    document.getElementById("export-logs-button")?.addEventListener("click", () => {
        // Changed to fetch logs from the server
        fetch('/api/logs')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(logs => {
                // Create a blob from the logs
                const blob = new Blob([logs], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                // Create a temporary link element to trigger the download
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'logs.txt';

                // Append the link to the body, click it, and then remove it
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Revoke the blob URL to free up memory
                URL.revokeObjectURL(url);
            })
            .catch(error => {
                console.error('Error fetching logs:', error);
            });
    });

    document.getElementById("export-server-logs-button")?.addEventListener("click", () => {
      // Changed to fetch logs from the server
      fetch('/api/logs')
          .then(response => {
              if (!response.ok) {
                  throw new Error('Network response was not ok');
              }
              return response.text();
          })
          .then(logs => {
              // Create a blob from the logs
              const blob = new Blob([logs], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);

              // Create a temporary link element to trigger the download
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = 'server-logs.txt';

              // Append the link to the body, click it, and then remove it
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              // Revoke the blob URL to free up memory
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