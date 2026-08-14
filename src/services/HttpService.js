import axios from "axios";
import { BASE_PATH } from "../routes/routeRegistry";

const errorEmitter = new EventTarget();

// Toast bus for API-level errors: App.jsx forwards "toast" events to the UI
// toast system, so 401/403 responses surface as non-intrusive toasts instead
// of blocking alert() dialogs (the intent documented in the interceptor below).
const emitToast = (message, type = "error") => {
  errorEmitter.dispatchEvent(new CustomEvent("toast", { detail: { message, type } }));
};

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8081",
  headers: {
    "Content-Type": "application/json"
  }
});

// Attach the JWT token (saved on login in AuthContext) to every outgoing
// request. Without this, every call to a protected endpoint (equipment,
// orders, maintenance, ...) is rejected with 403 Forbidden since the
// backend now requires authentication on all routes except login/register.
API.interceptors.request.use(
  (config) => {
    const savedUser = sessionStorage.getItem("medtrack_user");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.token) {
          config.headers["Authorization"] = `Bearer ${user.token}`;
        }
      } catch (err) {
        console.error("Failed to parse user details for JWT header injection:", err);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// The endpoints a caller reaches *before* they have a session.
//
// A 401 from any of these is a failed credential check - a wrong password, a wrong OTP, an
// unrecognised email - and not an expired session. The distinction matters because the two need
// opposite handling: an expired session should sign the user out and send them to the login screen,
// while a wrong password should leave them exactly where they are with the reason displayed.
//
// Treating them the same is why entering a wrong password reloaded the page and announced
// "Session expired. Please login again." LoginPage already handles the failure properly -
// `setError(err.response.data.message || "Invalid credentials.")` - but the interceptor ran first
// and assigned window.location.href, which is a full document navigation, so the message it had
// just rendered was torn down before anyone could read it. The OTP screen lost the email and the
// half-finished reset flow the same way.
//
// Matched on the path only, so a full URL, a relative path and a query string all resolve the same.
export const UNAUTHENTICATED_AUTH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
];

const isUnauthenticatedAuthRequest = (config) => {
  const url = config?.url;
  if (!url) return false;
  // config.url is what the caller passed - "/api/auth/login" - but it may carry a query string, and
  // an absolute URL is legal too. Strip both down to a path before comparing.
  const path = url.startsWith("http")
    ? (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })()
    : url.split("?")[0];
  return UNAUTHENTICATED_AUTH_PATHS.some((authPath) => path === authPath);
};

// Intercept responses to handle 401/403 errors globally via toast events
// instead of blocking alert() dialogs.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && isUnauthenticatedAuthRequest(error.config)) {
      // Hand it straight back to the form that asked. It knows what a rejected credential means
      // and has somewhere to say so; there is no session here to expire.
      return Promise.reject(error);
    }
    if (status === 401) {
      // Both keys, not just the user. AuthProvider seeds its permission state from
      // medtrack_authority on mount, so leaving it behind meant the next person to sign in on this
      // tab started with the previous user's cached permissions until the first authority poll
      // returned - briefly offering actions their account may not hold. AuthContext.logout clears
      // the same pair.
      sessionStorage.removeItem("medtrack_user");
      sessionStorage.removeItem("medtrack_authority");
      emitToast("Session expired. Please login again.");
      // The SPA is hosted under a base path on GitHub Pages (BASE_PATH, e.g.
      // "/MedTrack_Application"). Redirecting to a bare "/login" bypasses it
      // and lands on a 404; mirror App.jsx's base-path handling so the
      // session-expiry redirect reaches the real login route.
      const pathname = window.location.pathname || "";
      const base = pathname.includes(BASE_PATH) ? BASE_PATH : "";
      window.location.href = `${base}/login`;
    } else if (status === 403) {
      emitToast("Access denied: You are not authorised to perform this action.");
    }
    else{
      console.error("API request failed:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export { errorEmitter };
export default API;