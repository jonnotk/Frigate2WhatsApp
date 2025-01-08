// modules/state.js

// Encapsulate global state variables
const state = {
  cameras: [], // Ensure cameras is initialized as an empty array
  scriptProcess: null,
  waConnected: false,
  waAccount: { name: null, number: null },
  qrCodeData: null,
  cameraGroupMappings: {},
  isSubscribed: false, // Track if the user is subscribed
  isSubscribing: false, // Track if the subscription process is ongoing
};

// Getters and setters for controlled access
export const getCameras = () => state.cameras;
export const setCameras = (cameras) => {
  state.cameras = cameras;
};

export const getScriptProcess = () => state.scriptProcess;
export const setScriptProcess = (process) => {
  state.scriptProcess = process;
};

export const getWaConnected = () => state.waConnected;
export const setWaConnected = (connected) => {
  state.waConnected = connected;
};

export const getWaAccount = () => state.waAccount;
export const setWaAccount = (account) => {
  state.waAccount = account;
};

export const getQrCodeData = () => state.qrCodeData;
export const setQrCodeData = (qrData) => {
  state.qrCodeData = qrData;
};

export const getCameraGroupMappings = () => state.cameraGroupMappings;
export const setCameraGroupMappings = (mappings) => {
  state.cameraGroupMappings = mappings;
};

// Add getter and setter for isSubscribed
export const getIsSubscribed = () => state.isSubscribed;
export const setIsSubscribed = (subscribed) => {
  state.isSubscribed = subscribed;
};

// Add getter and setter for isSubscribing
export const getIsSubscribing = () => state.isSubscribing;
export const setIsSubscribing = (subscribing) => {
  state.isSubscribing = subscribing;
};