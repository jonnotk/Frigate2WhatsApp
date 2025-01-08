// components/file-editor.js
import { logDisplay } from "./log-display.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, warn, error } = setupLogging();

let editor;

const fileEditor = {
  initialize: () => {
    info("File Editor", "Initializing...");

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
    document
      .getElementById("save-file-button")
      ?.addEventListener("click", fileEditor.saveFile);
    document
      .getElementById("close-editor-button")
      ?.addEventListener("click", fileEditor.closeEditor);
    document
      .getElementById("cancel-editor-button")
      ?.addEventListener("click", fileEditor.closeEditor);

    info("File Editor", "Initialized.");
  },

  editFile: async (filename) => {
    info("File Editor", `Editing ${filename}...`);

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
        const errorData = await res.json();
        error("File Editor", `Error fetching ${filename}:`, errorData);
        logDisplay.appendLog(
          "log-container-server",
          `Error fetching ${filename}: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (errorData) {
      error("File Editor", "Network or other error:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Network or other error while fetching ${filename}`
      );
    }
  },

  saveFile: async () => {
    const filename = document.getElementById("current-file").innerText;
    const content = editor.getValue();

    info("File Editor", `Saving ${filename}...`);

    try {
      const res = await fetch("/dashboard/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content }),
      });

      if (res.ok) {
        info("File Editor", `${filename} saved successfully.`);
        logDisplay.appendLog("log-container", `${filename} saved successfully.`);
        fileEditor.closeEditor();
      } else {
        const errorData = await res.json();
        error("File Editor", `Error saving ${filename}:`, errorData);
        logDisplay.appendLog(
          "log-container",
          `Error saving ${filename}: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (errorData) {
      error("File Editor", "Network or other error:", errorData);
      logDisplay.appendLog(
        "log-container",
        `Network or other error while saving ${filename}`
      );
    }
  },

  closeEditor: () => {
    info("File Editor", "Closing editor...");
    document.getElementById("editor-modal").style.display = "none";
  },
};

export { fileEditor };