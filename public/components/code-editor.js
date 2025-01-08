// components/code-editor.js
import { logDisplay } from "./log-display.js";

let editor;

const codeEditor = {
  initialize: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Code Editor] Initializing...`);

    // Initialize Ace Editor if it hasn't been initialized yet
    if (!editor) {
      editor = ace.edit("code-editor");
      editor.setTheme("ace/theme/monokai");
    }

    // Attach event listeners to buttons
    document.getElementById("edit-index-button")?.addEventListener("click", () => codeEditor.editFile("index.html"));
    document.getElementById("edit-server-button")?.addEventListener("click", () => codeEditor.editFile("server.js"));
    document.getElementById("edit-whatsapp-button")?.addEventListener("click", () => codeEditor.editFile("whatsapp.js"));
    document.getElementById("close-editor-button")?.addEventListener("click", codeEditor.closeEditor);
    document.getElementById("cancel-editor-button")?.addEventListener("click", codeEditor.closeEditor); // Updated event listener

    console.log(`[${timestamp}] [Code Editor] Initialized.`);
  },

  editFile: async (filename) => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Code Editor] Editing ${filename}...`);

    try {
      const res = await fetch(`/dashboard/api/edit/${filename}`);
      if (res.ok) {
        const content = await res.text();
        document.getElementById("current-file").innerText = filename;

        // Set the Ace Editor mode based on file extension
        if (filename.endsWith(".js")) {
          editor.session.setMode("ace/mode/javascript");
        } else if (filename.endsWith(".html")) {
          editor.session.setMode("ace/mode/html");
        } else if (filename.endsWith(".css")) {
          editor.session.setMode("ace/mode/css");
        }

        editor.setValue(content);
        editor.gotoLine(0);

        // Show the editor modal
        document.getElementById("editor-modal").style.display = "block";
      } else {
        const error = await res.json();
        console.error(`[${timestamp}] [Code Editor] Error fetching ${filename}:`, error);
        logDisplay.appendLog("log-container-server", `Error fetching ${filename}: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error(`[${timestamp}] [Code Editor] Network or other error:`, error);
      logDisplay.appendLog("log-container-server", `Network or other error while fetching ${filename}`);
    }
  },

  clearEditor: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Code Editor] Clearing editor...`);
    editor.setValue("");
  },

  pasteToEditor: async () => {
    const timestamp = new Date().toLocaleString();
    try {
      const text = await navigator.clipboard.readText();
      editor.session.insert(editor.getCursorPosition(), text);
    } catch (err) {
      console.error(`[${timestamp}] [Code Editor] Failed to read clipboard contents: `, err);
    }
  },

  undoEditor: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Code Editor] Undoing last action...`);
    editor.undo();
  },

  closeEditor: () => {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] [Code Editor] Closing editor...`);
    document.getElementById("editor-modal").style.display = "none";
  },

  saveFile: async () => {
    const timestamp = new Date().toLocaleString();
    const filename = document.getElementById("current-file").innerText;
    const content = editor.getValue();

    console.log(`[${timestamp}] [Code Editor] Saving ${filename}...`);

    try {
      const res = await fetch("/dashboard/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content }),
      });

      if (res.ok) {
        console.log(`[${timestamp}] [Code Editor] ${filename} saved successfully.`);
        logDisplay.appendLog("log-container", `${filename} saved successfully.`);
        codeEditor.closeEditor();
      } else {
        const error = await res.json();
        console.error(`[${timestamp}] [Code Editor] Error saving ${filename}:`, error);
        logDisplay.appendLog("log-container", `Error saving ${filename}: ${error.error || "Unknown error"}`);
        // Close the editor even if saving fails
        codeEditor.closeEditor();
      }
    } catch (error) {
      console.error(`[${timestamp}] [Code Editor] Network or other error:`, error);
      logDisplay.appendLog("log-container", `Network or other error while saving ${filename}`);
      // Close the editor even if saving fails
      codeEditor.closeEditor();
    }
  },
};

export { codeEditor };