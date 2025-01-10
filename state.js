// state.js

// Use a simple locking mechanism to prevent concurrent updates
let isUpdating = false;

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
  connectionState: "disconnected", // Track the WhatsApp connection state
  groupMembershipRequests: [], // Store group membership requests
};

// Getters and setters for controlled access

export const getCameras = () => state.cameras;
export const setCameras = (cameras) => {
  if (isUpdating) return;
  isUpdating = true;
  state.cameras = cameras;
  isUpdating = false;
};

export const getScriptProcess = () => state.scriptProcess;
export const setScriptProcess = (process) => {
  if (isUpdating) return;
  isUpdating = true;
  state.scriptProcess = process;
  isUpdating = false;
};

export const getWaConnected = () => state.waConnected;
export const setWaConnected = (connected) => {
  if (isUpdating) return;
  isUpdating = true;
  state.waConnected = connected;
  isUpdating = false;
};

export const getWaAccount = () => state.waAccount;
export const setWaAccount = (account) => {
  if (isUpdating) return;
  isUpdating = true;
  state.waAccount = account;
  isUpdating = false;
};

export const getQrCodeData = () => state.qrCodeData;
export const setQrCodeData = (qrData) => {
  if (isUpdating) return;
  isUpdating = true;
  state.qrCodeData = qrData;
  isUpdating = false;
};

export const getCameraGroupMappings = () => state.cameraGroupMappings;
export const setCameraGroupMappings = (mappings) => {
  if (isUpdating) return;
  isUpdating = true;
  state.cameraGroupMappings = mappings;
  isUpdating = false;
};

export const getIsSubscribed = () => state.isSubscribed;
export const setIsSubscribed = (subscribed) => {
  if (isUpdating) return;
  isUpdating = true;
  state.isSubscribed = subscribed;
  isUpdating = false;
};

export const getIsSubscribing = () => state.isSubscribing;
export const setIsSubscribing = (subscribing) => {
  if (isUpdating) return;
  isUpdating = true;
  state.isSubscribing = subscribing;
  isUpdating = false;
};

// Getter and setter for connectionState
export const getConnectionState = () => state.connectionState;
export const setConnectionState = (connectionState) => {
    if (isUpdating) return;
    isUpdating = true;
    state.connectionState = connectionState;
    isUpdating = false;
};

// Getter and setter for groupMembershipRequests
export const getGroupMembershipRequests = () => state.groupMembershipRequests;

export const setGroupMembershipRequests = (requests) => {
    if (isUpdating) return;
    isUpdating = true;
    state.groupMembershipRequests = requests;
    isUpdating = false;
};