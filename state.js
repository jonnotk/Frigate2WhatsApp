// state.js

import { isDeepEqual } from "./utils/utils.js";

// Use a simple locking mechanism to prevent concurrent updates
let isUpdating = false;

// Encapsulate global state variables
const state = {
    cameras: new Map(), // Changed to a Map to store cameras and their details
    scriptProcess: null,
    waConnected: false,
    waAccount: { name: null, number: null },
    qrCodeData: null,
    cameraGroupMappings: {},
    isSubscribed: false, // Track if the user is subscribed
    isSubscribing: false, // Track if the subscription process is ongoing
    connectionState: "disconnected", // Track the WhatsApp connection state
    groupMembershipRequests: [], // Store group membership requests
};

// Simple custom event system
const eventListeners = {};

function on(event, listener) {
    if (!eventListeners[event]) {
        eventListeners[event] = [];
    }
    eventListeners[event].push(listener);
}

function off(event, listener) {
    if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter((l) => l !== listener);
    }
}

function emit(event, data) {
    if (eventListeners[event]) {
        eventListeners[event].forEach((listener) => listener(data));
    }
}

// Function to notify about state changes
export const notifyStateChange = async (changeType, newData) => {
    if (!isUpdating) {
        console.warn("State", `Attempting to notify without an update: ${changeType}`);
        return;
    }
    // only broadcast events from the backend
    if (typeof window === 'undefined') {
        const { broadcast } = await import("./modules/websocket-server.js");
        broadcast(changeType, newData);
    }
    // Emit a custom event
    emit(changeType, newData);
};

// Getters and setters for controlled access

export const getCameras = () => state.cameras;

export const setCameras = (cameras) => {
    if (isUpdating) return;
    isUpdating = true;

    // Convert Map keys to an array for comparison
    const currentCameras = Array.from(state.cameras.keys());

    // Check if there's an actual change in the camera list
    if (!isDeepEqual(currentCameras, cameras)) {
        // Update the cameras Map with new entries
        const newCameraMap = new Map();
        cameras.forEach(camera => {
            newCameraMap.set(camera, state.cameras.get(camera) || {});
        });

        state.cameras = newCameraMap;
        notifyStateChange("cameras-update", Array.from(state.cameras.keys()));
    }

    isUpdating = false;
};

export const getScriptProcess = () => state.scriptProcess;
export const setScriptProcess = (process) => {
    if (isUpdating) return;
    isUpdating = true;
    state.scriptProcess = process;
    notifyStateChange("script-process-update", state.scriptProcess);
    isUpdating = false;
};

export const getWaConnected = () => state.waConnected;
export const setWaConnected = (connected) => {
    if (isUpdating) return;
    isUpdating = true;
    if (state.waConnected !== connected) {
        state.waConnected = connected;
        notifyStateChange("wa-connected-update", state.waConnected);
    }
    isUpdating = false;
};

export const getWaAccount = () => state.waAccount;
export const setWaAccount = (account) => {
    if (isUpdating) return;
    isUpdating = true;
    if (!isDeepEqual(state.waAccount, account)) {
        state.waAccount = account;
        notifyStateChange("wa-account-update", state.waAccount);
    }
    isUpdating = false;
};

export const getQrCodeData = () => state.qrCodeData;
export const setQrCodeData = (qrData) => {
    if (isUpdating) return;
    isUpdating = true;
    state.qrCodeData = qrData;
    notifyStateChange("qr-code-update", state.qrCodeData);
    isUpdating = false;
};

export const getCameraGroupMappings = () => state.cameraGroupMappings;
export const setCameraGroupMappings = (mappings) => {
    if (isUpdating) return;
    isUpdating = true;
    if (!isDeepEqual(state.cameraGroupMappings, mappings)) {
        state.cameraGroupMappings = mappings;
        notifyStateChange("camera-group-mappings-update", state.cameraGroupMappings);
    }
    isUpdating = false;
};

export const getIsSubscribed = () => state.isSubscribed;
export const setIsSubscribed = (subscribed) => {
    if (isUpdating) return;
    isUpdating = true;
    if (state.isSubscribed !== subscribed) {
        state.isSubscribed = subscribed;
        notifyStateChange("is-subscribed-update", state.isSubscribed);
    }
    isUpdating = false;
};

export const getIsSubscribing = () => state.isSubscribing;
export const setIsSubscribing = (subscribing) => {
    if (isUpdating) return;
    isUpdating = true;
    if (state.isSubscribing !== subscribing) {
        state.isSubscribing = subscribing;
        notifyStateChange("is-subscribing-update", state.isSubscribing);
    }
    isUpdating = false;
};

// Getter and setter for connectionState
export const getConnectionState = () => state.connectionState;
export const setConnectionState = (connectionState) => {
    if (isUpdating) return;
    isUpdating = true;
    if (state.connectionState !== connectionState) {
        state.connectionState = connectionState;
        notifyStateChange("connection-state-update", state.connectionState);
    }
    isUpdating = false;
};

// Getter and setter for groupMembershipRequests
export const getGroupMembershipRequests = () => state.groupMembershipRequests;

export const setGroupMembershipRequests = (requests) => {
    if (isUpdating) return;
    isUpdating = true;
    if (!isDeepEqual(state.groupMembershipRequests, requests)) {
        state.groupMembershipRequests = requests;
        notifyStateChange("group-membership-requests-update", state.groupMembershipRequests);
    }
    isUpdating = false;
};

export { on, off };