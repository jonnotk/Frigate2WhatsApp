// constants-server.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Resolve the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define constants
const BASE_DIR = process.env.BASE_DIR || path.resolve(__dirname, ".."); //Using absolute path from project root
const PUBLIC_DIR = path.join(BASE_DIR, "public");
const DASHBOARD_DIR = path.join(BASE_DIR, "public");
const COMPONENTS_DIR = path.join(BASE_DIR, "public", "components");
const MODULES_DIR = path.join(BASE_DIR, "modules");
const LOGS_DIR = path.join(BASE_DIR, "logs");
const LOG_FILE = path.join(LOGS_DIR, "app.log");
const DASHBOARD_URL = "/";
const COMPONENTS_URL = "/components";
const MODULES_URL = "/modules";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const WS_URL = process.env.WS_URL || `ws://${HOST}:${PORT}`;
const API_BASE_URL = process.env.API_BASE_URL || "/api";
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const CAMERA_COLOR = "#2ca02c"; // Default camera color
const MAX_RETRIES = process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES, 10) : 3;
const RETRY_DELAY = process.env.RETRY_DELAY ? parseInt(process.env.RETRY_DELAY, 10) : 1000;
const DEBUG = process.env.DEBUG === "true";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH;

// Log the environment variables (optional, for debugging)
console.log("BASE_DIR:", BASE_DIR);
console.log("PUBLIC_DIR:", PUBLIC_DIR);
console.log("LOGS_DIR:", LOGS_DIR);
console.log("LOG_FILE:", LOG_FILE);

// Validate required environment variables
const requiredEnvVars = [
  "BASE_DIR",
  "PUBLIC_DIR",
  "DASHBOARD_DIR",
  "COMPONENTS_DIR",
  "MODULES_DIR",
  "LOGS_DIR",
  "LOG_FILE",
  "DASHBOARD_URL",
  "COMPONENTS_URL",
  "MODULES_URL",
  "HOST",
  "PORT",
  "WS_URL",
  "API_BASE_URL",
  "MQTT_HOST",
  "MQTT_USERNAME",
  "MQTT_PASSWORD",
  "MAX_RETRIES",
  "RETRY_DELAY",
  "CHROMIUM_PATH",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(
      `[Config] Warning: Required environment variable ${envVar} is missing or empty.`
    );
  }
}

// Export all constants at the end
export {
  BASE_DIR,
  PUBLIC_DIR,
  DASHBOARD_DIR,
  COMPONENTS_DIR,
  MODULES_DIR,
  LOGS_DIR,
  LOG_FILE,
  DASHBOARD_URL,
  COMPONENTS_URL,
  MODULES_URL,
  HOST,
  PORT,
  WS_URL,
  API_BASE_URL,
  MQTT_HOST,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  CAMERA_COLOR,
  MAX_RETRIES,
  RETRY_DELAY,
  DEBUG,
  CHROMIUM_PATH,
};