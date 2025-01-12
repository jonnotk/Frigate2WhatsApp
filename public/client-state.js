/*******************************************************
 * client-state.js
 *
 * Minimal front-end state to avoid Node-specific imports.
 * This is served to the client from /public/.
 *******************************************************/

// We do NOT import Node modules or `isDeepEqual` here.
// Instead, we store and mutate data as needed for the UI.

const browserState = {
  cameras: [], // or we can store them as needed
  scriptProcess: null,
  waConnected: false,
  waAccount: { name: null, number: null },
  qrCodeData: null,
  cameraGroupMappings: {},
  isSubscribed: false,
  isSubscribing: false,
  connectionState: "disconnected",
  groupMembershipRequests: [],
};

const eventListeners = {};

export function on(event, listener) {
  if (!eventListeners[event]) {
      eventListeners[event] = [];
  }
  eventListeners[event].push(listener);
}

export function off(event, listener) {
  if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter((l) => l !== listener);
  }
}

function emit(event, data) {
  if (eventListeners[event]) {
      eventListeners[event].forEach((listener) => listener(data));
  }
}

/***************************************************
* Getters/Setters for front-end usage
**************************************************/

export function getCameras() {
  return browserState.cameras;
}
export function setCameras(camerasArr) {
  browserState.cameras = camerasArr;
  emit("cameras-update", camerasArr);
}

export function getScriptProcess() {
  return browserState.scriptProcess;
}
export function setScriptProcess(proc) {
  browserState.scriptProcess = proc;
  emit("script-process-update", proc);
}

export function getWaConnected() {
  return browserState.waConnected;
}
export function setWaConnected(connected) {
  browserState.waConnected = connected;
  emit("wa-connected-update", connected);
}

export function getWaAccount() {
  return browserState.waAccount;
}
export function setWaAccount(account) {
  browserState.waAccount = account;
  emit("wa-account-update", account);
}

export function getQrCodeData() {
  return browserState.qrCodeData;
}
export function setQrCodeData(qrData) {
  browserState.qrCodeData = qrData;
  emit("qr-code-update", qrData);
}

export function getCameraGroupMappings() {
  return browserState.cameraGroupMappings;
}
export function setCameraGroupMappings(mappings) {
  browserState.cameraGroupMappings = mappings;
  emit("camera-group-mappings-update", mappings);
}

export function getIsSubscribed() {
  return browserState.isSubscribed;
}
export function setIsSubscribed(subscribed) {
  browserState.isSubscribed = subscribed;
  emit("is-subscribed-update", subscribed);
}

export function getIsSubscribing() {
  return browserState.isSubscribing;
}
export function setIsSubscribing(subscribing) {
  browserState.isSubscribing = subscribing;
  emit("is-subscribing-update", subscribing);
}

export function getConnectionState() {
  return browserState.connectionState;
}
export function setConnectionState(connState) {
  browserState.connectionState = connState;
  emit("connection-state-update", connState);
}

export function getGroupMembershipRequests() {
  return browserState.groupMembershipRequests;
}
export function setGroupMembershipRequests(requests) {
  browserState.groupMembershipRequests = requests;
  emit("group-membership-requests-update", requests);
}