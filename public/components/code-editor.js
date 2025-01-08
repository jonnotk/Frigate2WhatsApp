// components/code-editor.js
import { logDisplay } from "./log-display.js";
import { setupLogging } from "../utils/logger.js";

// Initialize logging
const { info, warn, error } = setupLogging();

let editor;

const codeEditor = {
  initialize: () => {
    info("Code Editor", "Initializing...");

    // Initialize Ace Editor if it hasn't been initialized yet
    if (!editor) {
      editor = ace.edit("code-editor");
      editor.setTheme("ace/theme/monokai");
    }

    // Attach event listeners to buttons
    document
      .getElementById("edit-index-button")
      ?.addEventListener("click", () => codeEditor.editFile("index.html"));
    document
      .getElementById("edit-server-button")
      ?.addEventListener("click", () => codeEditor.editFile("server.js"));
    document
      .getElementById("edit-whatsapp-button")
      ?.addEventListener("click", () => codeEditor.editFile("whatsapp.js"));
    document
      .getElementById("close-editor-button")
      ?.addEventListener("click", codeEditor.closeEditor);
    document
      .getElementById("cancel-editor-button")
      ?.addEventListener("click", codeEditor.closeEditor);
    document
      .getElementById("save-file-button")
      ?.addEventListener("click", codeEditor.saveFile);

    info("Code Editor", "Initialized.");
  },

  editFile: async (filename) => {
    info("Code Editor", `Editing ${filename}...`);

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
        error("Code Editor", `Error fetching ${filename}:`, errorData);
        logDisplay.appendLog(
          "log-container-server",
          `Error fetching ${filename}: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (errorData) {
      error("Code Editor", "Network or other error:", errorData);
      logDisplay.appendLog(
        "log-container-server",
        `Network or other error while fetching ${filename}`
      );
    }
  },

  clearEditor: () => {
    info("Code Editor", "Clearing editor...");
    editor.setValue("");
  },

  pasteToEditor: async () => {
    try {
      const text = await navigator.clipboard.readText();
      editor.session.insert(editor.getCursorPosition(), text);
    } catch (err) {
      error("Code Editor", "Failed to read clipboard contents: ", err);
    }
  },

  undoEditor: () => {
    info("Code Editor", "Undoing last action...");
    editor.undo();
  },

  closeEditor: () => {
    info("Code Editor", "Closing editor...");
    document.getElementById("editor-modal").style.display = "none";
  },

  saveFile: async () => {
    const filename = document.getElementById("current-file").innerText;
    const content = editor.getValue();

    info("Code Editor", `Saving ${filename}...`);

    try {
      const res = await fetch("/dashboard/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content }),
      });

      if (res.ok) {
        info("Code Editor", `${filename} saved successfully.`);
        logDisplay.appendLog("log-container", `${filename} saved successfully.`);
        codeEditor.closeEditor();
      } else {
        const errorData = await res.json();
        error("Code Editor", `Error saving ${filename}:`, errorData);
        logDisplay.appendLog(
          "log-container",
          `Error saving ${filename}: ${errorData.error || "Unknown error"}`
        );
      }
    } catch (errorData) {
      error("Code Editor", "Network or other error:", errorData);
      logDisplay.appendLog(
        "log-container",
        `Network or other error while saving ${filename}`
      );
    }
  },
};

export { codeEditor };