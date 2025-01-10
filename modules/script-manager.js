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
 * @param {object} logger - The logger instance.
 */
function startScript(logger) {
  if (getScriptProcess()) {
    logger.warn("ScriptManager", "Script is already running.");
    return;
  }

  // Construct path to the script
  const scriptPath = path.join(BASE_DIR, "public", "components", "frigate-filter.js");

  const scriptProcess = spawn("node", [scriptPath]);

  scriptProcess.stdout.on("data", (data) => {
    logger.info("Script", data.toString());
  });

  scriptProcess.stderr.on("data", (data) => {
    logger.error("Script", data.toString());
  });

  scriptProcess.on("close", (code) => {
    logger.info("Script", `Script process exited with code ${code}`);
    setScriptProcess(null);
  });

  setScriptProcess(scriptProcess);
  logger.info("ScriptManager", "Script started successfully.");
}

/**
 * Stops the script.
 * @param {object} logger - The logger instance.
 */
function stopScript(logger) {
  const scriptProcess = getScriptProcess();
  if (scriptProcess) {
    scriptProcess.kill();
    logger.info("ScriptManager", "Script stopped successfully.");
  } else {
    logger.warn("ScriptManager", "No script is running.");
  }
}

export { startScript, stopScript, getScriptProcess };