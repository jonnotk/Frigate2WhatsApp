// components/file-editor.js
import { logDisplay } from "./log-display.js";

let editor;

const fileEditor = {
  /**
   * Initializes the file editor module.
   */
  initialize: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [File Editor] Initializing...`);

    // Initialize Ace Editor if it hasn't been initialized yet
    if (!editor) {
      editor = ace.edit("editor");
      editor.setTheme("ace/theme/monokai");
      editor.session.setMode("ace/mode/javascript");

      // Access the underlying <textarea> element and add an id
      const textarea = editor.textInput.getElement();
      textarea.id = "ace-text-input"; // Add an id
      textarea.name = "aceTextInput"; // Add a name
    }

    // Attach event listeners to buttons
    document.getElementById("save-file-button")?.addEventListener("click", fileEditor.saveFile);
    document.getElementById("close-editor-button")?.addEventListener("click", fileEditor.closeEditor);
    document.getElementById("cancel-editor-button")?.addEventListener("click", fileEditor.closeEditor);

    console.log(`[${timestamp}] [File Editor] Initialized.`);
  },

  /**
   * Opens the editor modal and loads the content of the specified file.
   * @param {string} filename - The name of the file to edit.
   */
  editFile: async (filename) => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [File Editor] Editing ${filename}...`);

    try {
      const res = await fetch(`/dashboard/api/edit/${filename}`);
      if (res.ok) {
        const { data } = await res.json();
        document.getElementById("current-file").innerText = filename;

        // Set the Ace Editor mode based on file extension
        if (filename.endsWith(".js")) {
          editor.session.setMode("ace/mode/javascript");
        } else if (filename.endsWith(".html")) {
          editor.session.setMode("ace/mode/html");
        } else if (filename.endsWith(".css")) {
          editor.session.setMode("ace/mode/css");
        }

        editor.setValue(data.content);
        editor.gotoLine(0);

        // Show the editor modal
        document.getElementById("editor-modal").style.display = "block";
      } else {
        const error = await res.json();
        console.error(`[${timestamp}] [File Editor] Error fetching ${filename}:`, error);
        logDisplay.appendLog("log-container-server", `Error fetching ${filename}: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error(`[${timestamp}] [File Editor] Network or other error:`, error);
      logDisplay.appendLog("log-container-server", `Network or other error while fetching ${filename}`);
    }
  },

  /**
   * Saves the content of the editor to the specified file.
   */
  saveFile: async () => {
    const timestamp = new Date().toLocaleString();
    const filename = document.getElementById("current-file").innerText;
    const content = editor.getValue();

    console.log(`[${timestamp}] [File Editor] Saving ${filename}...`);

    try {
      const res = await fetch("/dashboard/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content }),
      });

      if (res.ok) {
        console.log(`[${timestamp}] [File Editor] ${filename} saved successfully.`);
        logDisplay.appendLog("log-container", `${filename} saved successfully.`);
        fileEditor.closeEditor();
      } else {
        const error = await res.json();
        console.error(`[${timestamp}] [File Editor] Error saving ${filename}:`, error);
        logDisplay.appendLog("log-container", `Error saving ${filename}: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error(`[${timestamp}] [File Editor] Network or other error:`, error);
      logDisplay.appendLog("log-container", `Network or other error while saving ${filename}`);
    }
  },

  /**
   * Closes the editor modal.
   */
  closeEditor: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [File Editor] Closing editor...`);
    document.getElementById("editor-modal").style.display = "none";
  },
};

export { fileEditor };