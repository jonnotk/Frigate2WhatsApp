// modules/whatsapp-session-manager.js
import fs from "fs";
import path from "path";
import { BASE_DIR } from "../constants-server.js";
import { setupLogging } from "../utils/logger.js";
import { rimraf } from "rimraf";

const { info, warn, error } = setupLogging();

const SESSIONS_DIR = path.join(BASE_DIR, "modules", "whatsapp-sessions");

async function createSession(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, `session-${sessionId}`);

  // Validate sessionId (basic example - make it more robust if needed)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    error("WhatsApp Session Manager", `Invalid session ID: ${sessionId}`);
    throw new Error("Invalid session ID");
  }

  // Prevent path traversal
  const normalizedPath = path.normalize(sessionPath);
  if (!normalizedPath.startsWith(SESSIONS_DIR)) {
    error("WhatsApp Session Manager", `Invalid session path: ${normalizedPath}`);
    throw new Error("Invalid session path");
  }

  try {
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      info(
        "WhatsApp Session Manager",
        `Session directory created for ID: ${sessionId}`
      );
    }
  } catch (err) {
    error(
      "WhatsApp Session Manager",
      `Error creating session directory for ID: ${sessionId}`,
      err
    );
    throw new Error("Error creating session directory");
  }
}

async function removeSession(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, `session-${sessionId}`);

  // Validate sessionId (basic example - make it more robust if needed)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    error("WhatsApp Session Manager", `Invalid session ID: ${sessionId}`);
    throw new Error("Invalid session ID");
  }

  // Prevent path traversal
  const normalizedPath = path.normalize(sessionPath);
  if (!normalizedPath.startsWith(SESSIONS_DIR)) {
    error("WhatsApp Session Manager", `Invalid session path: ${normalizedPath}`);
    throw new Error("Invalid session path");
  }

  try {
    if (fs.existsSync(sessionPath)) {
      await rimraf(sessionPath);
      info(
        "WhatsApp Session Manager",
        `Session directory removed for ID: ${sessionId}`
      );
    }
  } catch (err) {
    error(
      "WhatsApp Session Manager",
      `Error removing session directory for ID: ${sessionId}`,
      err
    );
    throw new Error("Error removing session directory");
  }
}

// Placeholder for future implementation if needed
async function loadSession(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, `session-${sessionId}`);
  // TODO: Implement session loading logic if needed
}

export { createSession, removeSession, loadSession };