// server-state.js
import { broadcast } from "./websocket-server.js";


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

// Function to notify about state changes
export const notifyStateChange = (changeType, newData) => {
    if (!isUpdating) {
        console.warn("State", `Attempting to notify without an update: ${changeType}`);
        return;
    }
    // Only broadcast events from the backend
    if (typeof window === 'undefined') {
        broadcast(changeType, newData); // Now correctly using the imported broadcast function
    }
    // Emit a custom event
    emit(changeType, newData);
};

// Deep equality check (used only on the server-side for now)
const isDeepEqual = (function () {
    var t = {
        eq: c,
        deepEq: u,
        find: function find(e, t) {
            for (var n = 0; n < e.length; n++) if (t(e[n])) return e[n];
        },
    };
    function r(e, t) {
        return (
            !!n.find(e, function (e) {
                return e.object === t;
            }) || null
        );
    }
    function o(e, t, o) {
        var i = r(e, t);
        if (i) return i.result;
        var a = { object: t, result: {} };
        e.push(a);
        var s = Object.keys(t);
        (a.result = n.eq(
            s.length,
            o.length,
            "number of keys of compared objects should be equal"
        )
            ? n.deepEq(
                s.sort(),
                o.sort(),
                function (n, r) {
                    if (!c(n, r, "value of key " + JSON.stringify(n))) return !1;
                    var i = t[n],
                        a = o[n];
                    return c(i, a, "should be equal by value", e);
                },
                "keys should be equal"
            )
            : (console.warn("different number of keys", t, o), !1)),
            e.splice(e.indexOf(a), 1);
        return a.result;
    }
    function i(e, t) {
        var o = r(e, t);
        if (o) return o.result;
        var i = { object: t, result: {} };
        e.push(i);
        var a = t.source,
            s = t.flags,
            c = {
                source: a,
                flags: s,
                ignoreCase: "i" === s[s.length - 1],
                multiline: s.includes("m"),
                global: s.includes("g"),
            };
        (i.result = n.eq(a, e.source, "RegExp source should be equal")),
            e.splice(e.indexOf(i), 1);
        return i.result;
    }
    function a(e, t) {
        var o = r(e, t);
        if (o) return o.result;
        var i = { object: t, result: {} };
        e.push(i);
        var a = {
            value: +t,
            negative: 1 / t === -(1 / 0),
            string: String(t),
            primitive: t,
        };
        (i.result = n.eq(
            a.value,
            e.value,
            "should be equal as numbers"
        )),
            e.splice(e.indexOf(i), 1);
        return i.result;
    }
    function s(e, t) {
        var o = r(e, t);
        if (o) return o.result;
        var i = { object: t, result: {} };
        e.push(i);
        var s = { value: String(t) };
        (i.result = n.eq(s.value, e.value, "should be equal as strings")),
            e.splice(e.indexOf(i), 1);
        return i.result;
    }
    function c(e, t, r, a) {
        r = r || "should be equal";
        return (
            n.eq(typeof e, typeof t, "should have the same type " + r) &&
            n.deepEq(e, t, c, r, a)
        );
    }
    function u(e, t, r, c, u) {
        if (e === t) return n.eq(e, t, c);
        if (
            e &&
            t &&
            (function (e) {
                return (
                    "[object Object]" ===
                    Object.prototype.toString.call(e)
                );
            })(e) &&
            (function (e) {
                return (
                    "[object Object]" ===
                    Object.prototype.toString.call(e)
                );
            })(t)
        )
            return o(u || [], e, t);
        if (
            e instanceof Date &&
            t instanceof Date &&
            "[object Date]" === Object.prototype.toString.call(e) &&
            "[object Date]" === Object.prototype.toString.call(t)
        )
            return n.eq(
                +e,
                +t,
                "Dates should be equal as numbers"
            );
        if (
            e instanceof RegExp &&
            t instanceof RegExp &&
            "[object RegExp]" === Object.prototype.toString.call(e) &&
            "[object RegExp]" === Object.prototype.toString.call(t)
        )
            return i(u || [], e, t);
        if (
            (function (e) {
                return (
                    "[object Number]" ===
                    Object.prototype.toString.call(e)
                );
            })(e) &&
            (function (e) {
                return (
                    "[object Number]" ===
                    Object.prototype.toString.call(e)
                );
            })(t)
        )
            return a(u || [], e, t);
        if (
            (function (e) {
                return (
                    "[object String]" ===
                    Object.prototype.toString.call(e)
                );
            })(e) &&
            (function (e) {
                return (
                    "[object String]" ===
                    Object.prototype.toString.call(e)
                );
            })(t)
        )
            return s(u || [], e, t);
        var l = Array.isArray(e);
        if (l !== Array.isArray(t))
            return (
                console.warn(
                    "cannot compare Array and non-Array - " + r,
                    e,
                    t
                ),
                !1
            );
        if (!l)
            return (
                console.warn(
                    "cannot compare " +
                    Object.prototype.toString.call(e) +
                    " and " +
                    Object.prototype.toString.call(t),
                    e,
                    t
                ),
                !1
            );
        var d = r;
        r += " -> " + JSON.stringify(e);
        for (var f = 0, p = e; f < p.length; f++) {
            var v = p[f];
            if (!n.find(t, n.eq.bind(null, v)))
                return (
                    console.warn(d + " -> cannot find equal value in other array", v, e, t), !1
                );
        }
        for (var h = 0, b = t; h < b.length; h++) {
            var g = b[h];
            if (!n.find(e, n.eq.bind(null, g)))
                return (
                    console.warn(d + " -> cannot find equal value in other array", g, e, t), !1
                );
        }
        return !0;
    }
    return  (
        (t = { exports: {} }).exports.eq = function eq(e, t, n) {
            return (
                n && console.warn(n),
                Object.is(e, t) ||
                (function (e, t) {
                    if (e !== e) return t !== t;
                })(e, t)
            );
        },
        (t.deepEq = u),
        (t.toJson = function toJson(e, t) {
            return JSON.stringify(
                e,
                (function (e, t) {
                    var n = r(a || [], t);
                    if (n) return { __CIRCULAR__: n.index };
                    var o = { index: a.length, object: t };
                    a.push(o);
                    if (
                        t &&
                        (function (e) {
                            return (
                                "[object Object]" ===
                                Object.prototype.toString.call(e)
                            );
                        })(t)
                    ) {
                        var i = {},
                            s = Object.keys(t);
                        if (
                            (function (e) {
                                return (
                                    "[object Array]" ===
                                    Object.prototype.toString.call(e)
                                );
                            })(t)
                        ) {
                            var c = [];
                            for (var u in t) c.push(t[u]);
                            i = c;
                        } else
                            for (var l in t) i[l] = t[l];
                        return i;
                    }
                    if (
                        t instanceof Date &&
                        "[object Date]" === Object.prototype.toString.call(t)
                    )
                        return {
                            __Date__: {
                                value: +t,
                                negative: 1 / t === -(1 / 0),
                                string: String(t),
                            },
                        };
                    if (
                        t instanceof RegExp &&
                        "[object RegExp]" === Object.prototype.toString.call(t)
                    ) {
                        var d = t.source,
                            f = t.flags;
                        return {
                            __RegExp__: {
                                source: d,
                                flags: f,
                                ignoreCase: "i" === f[f.length - 1],
                                multiline: f.includes("m"),
                                global: f.includes("g"),
                            },
                        };
                    }
                    if (
                        (function (e) {
                            return (
                                "[object Number]" ===
                                Object.prototype.toString.call(e)
                            );
                        })(t)
                    )
                        return {
                            __Number__: {
                                value: +t,
                                negative: 1 / t === -(1 / 0),
                                string: String(t),
                                primitive: t,
                            },
                        };
                    if (
                        (function (e) {
                            return (
                                "[object String]" ===
                                Object.prototype.toString.call(e)
                            );
                        })(t)
                    )
                        return { __String__: { value: String(t) } };
                    return t;
                }),
                null,
                t
            );
        }),
        (t.isDeepEqual = function isDeepEqual(e, t) {
            try {
                return u(e, t, "isDeepEqual");
            } catch (e) {
                if (e.message)
                    throw new Error(e.message + "\n" + e.stack);
                throw e;
            }
        }),
        (t.dateToJson = function dateToJson(e) {
            return t.toJson(e);
        }),
        (t.fromJson = function fromJson(e, n) {
            return JSON.parse(e, function (e, o) {
                if (n && e in n) return n[e](o);
                if (o) {
                    if (
                        (function (e) {
                            return (
                                "object" == typeof e &&
                                null !== e &&
                                "__CIRCULAR__" in e
                            );
                        })(o)
                    )
                        return a[o.__CIRCULAR__].object;
                    if (
                        (function (e) {
                            return (
                                "object" == typeof e &&
                                null !== e &&
                                "__RegExp__" in e
                            );
                        })(o)
                    ) {
                        var i = o.__RegExp__;
                        return new RegExp(i.source, i.flags);
                    }
                    if (
                        (function (e) {
                            return (
                                "object" == typeof e &&
                                null !== e &&
                                "__Date__" in e
                            );
                        })(o)
                    ) {
                        var s = o.__Date__;
                        return new Date(s.negative ? -s.value : s.value);
                    }
                    if (
                        (function (e) {
                            return (
                                "object" == typeof e &&
                                null !== e &&
                                "__Number__" in e
                            );
                        })(o)
                    ) {
                        var c = o.__Number__;
                        return c.negative ? -c.value : c.value;
                    }
                    if (
                        (function (e) {
                            return (
                                "object" == typeof e &&
                                null !== e &&
                                "__String__" in e
                            );
                        })(o)
                    )
                        return o.__String__.value;
                }
                return o;
            });
        }),
        (t.exports = t),
        (t.exports.deepEqual = u),
        (t.exports.toJson = t.toJson),
        (t.exports.dateToJson = t.toJson),
        (t.exports.fromJson = t.fromJson),
        (t.exports.isDeepEqual = t.isDeepEqual),
        (t.exports.eq = c));
    var a = [];
    return t.exports;
})();

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

        // Update the state with the new Map
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