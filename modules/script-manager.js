// modules/script-manager.js
import { spawn } from "child_process";
import { getScriptProcess, setScriptProcess } from "../state.js"; // Correct relative path
import { DASHBOARD_DIR } from "../constants-server.js"; // Correct relative path
import path from "path";
import { fileURLToPath } from "url";
import { setupLogging } from "../utils/logger.js"; // Added import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logging
const { debug, info, warn, error } = setupLogging();

/**
 * Starts the script.
 * @param {function} log - The logging function.
 */
function startScript(log) {
  if (getScriptProcess()) {
    log("[ScriptManager] Script is already running.");
    info("ScriptManager", "Script is already running."); // Added logging
    return;
  }

  // Use COMPONENTS_DIR to construct the path to the script
  const scriptPath = path.join(DASHBOARD_DIR, "frigate-filter.js");

  const scriptProcess = spawn("node", [scriptPath]);

  scriptProcess.stdout.on("data", (data) => {
    log(`[Script] stdout: ${data}`);
    info("Script", `stdout: ${data}`); // Added logging
  });

  scriptProcess.stderr.on("data", (data) => {
    log(`[Script] stderr: ${data}`);
    error("Script", `stderr: ${data}`); // Added logging
  });

  scriptProcess.on("close", (code) => {
    log(`[Script] Script process exited with code ${code}`);
    info("Script", `Script process exited with code ${code}`); // Added logging
    setScriptProcess(null);
  });

  setScriptProcess(scriptProcess);
  info("ScriptManager", "Script started successfully."); // Added logging
}

/**
 * Stops the script.
 * @param {function} log - The logging function.
 */
function stopScript(log) {
  const scriptProcess = getScriptProcess();
  if (scriptProcess) {
    scriptProcess.kill(); // This sends a SIGTERM signal to stop the process
    setScriptProcess(null);
    info("ScriptManager", "Script stopped successfully."); // Added logging
  } else {
    warn("ScriptManager", "No script is running."); // Added logging
  }
}

// Export functions
export { startScript, stopScript, getScriptProcess };