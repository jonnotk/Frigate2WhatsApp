// constants.js

export const CONNECTION_STATES = {
    INITIALIZING: "initializing",
    QR_RECEIVED: "qr_received",
    AWAITING_QR: "awaiting_qr",
    LOADING: "loading",
    FAILED_RESTORE: "failed_restore",
    TIMEOUT: "timeout",
    CONNECTED: "connected",
    AUTHENTICATED: "authenticated",
    DISCONNECTED: "disconnected",
    AUTH_FAILURE: "auth_failure",
    INITIALIZATION_FAILED: "initialization_failed",
    DESTROYED: "destroyed",
    CONFLICT: "conflict",
    UNLAUNCHED: "unlaunched",
    UNPAIRED: "unpaired",
    UNPAIRED_IDLE: "unpaired_idle",
    NOT_READY: "not_ready",
    PROXY_ERROR: "proxy_error",
    SUBSCRIBING: "subscribing",
    UNSUBSCRIBING: "unsubscribing"
};
console.log("constants.js loaded");