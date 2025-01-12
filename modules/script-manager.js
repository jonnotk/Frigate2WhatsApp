// modules/script-manager.js
import { spawn } from "child_process";
import { getScriptProcess, setScriptProcess } from "../state.js";
import path from "path";
import { fileURLToPath } from "url";
import { setupLogging } from "../utils/logger.js";
import { BASE_DIR } from "../constants-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const { info, warn, error } = setupLogging();

/**
 * Starts the script.
 */
function startScript() {
  if (getScriptProcess()) {
    warn("ScriptManager", "Script is already running.");
    return;
  }

  // Construct path to the script
  const scriptPath = path.join(BASE_DIR, "public", "components", "frigate-filter.js");

  info("ScriptManager", `Starting script at: ${scriptPath}`);

  const scriptProcess = spawn("node", [scriptPath]);

  scriptProcess.stdout.on("data", (data) => {
    info("Script", data.toString());
  });

  scriptProcess.stderr.on("data", (data) => {
    error("Script", data.toString());
  });

  scriptProcess.on("close", (code) => {
    info("Script", `Script process exited with code ${code}`);
    setScriptProcess(null);
  });

  setScriptProcess(scriptProcess);
  info("ScriptManager", "Script started successfully.");
}

/**
 * Stops the script.
 */
function stopScript() {
  const scriptProcess = getScriptProcess();
  if (scriptProcess) {
    scriptProcess.kill();
    info("ScriptManager", "Script stopped successfully.");
  } else {
    warn("ScriptManager", "No script is running.");
  }
}

export { startScript, stopScript, getScriptProcess };