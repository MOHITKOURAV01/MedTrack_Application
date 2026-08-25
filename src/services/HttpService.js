import axios from "axios";
import { BASE_PATH } from "../routes/routeRegistry";

const errorEmitter = new EventTarget();

// Toast bus for API-level errors: App.jsx forwards "toast" events to the UI
// toast system, so 401/403 responses surface as non-intrusive toasts instead
// of blocking alert() dialogs (the intent documented in the interceptor below).
const emitToast = (message, type = "error") => {
  errorEmitter.dispatchEvent(new CustomEvent("toast", { detail: { message, type } }));
};

/**
 * Per-attempt request timeout.
 *
 * Axios defaults `timeout` to 0, which means *no timeout* - a request waits on the OS socket
 * timeout, minutes on Linux, and indefinitely against a server that accepted the connection and
 * then went quiet. That matters more here than in most apps because of how all 92 services are
 * written:
 *
 *     try  { const response = await API.get(...); return response.data; }
 *     catch (error) { return <fallback data>; }
 *
 * The fallback is the app's entire story for an unavailable backend, and it is reached only via
 * the catch. With no timeout there is no catch - the promise simply never settles, so the console
 * does not fall back, does not error and does not retry. It spins, with no cancel and no message,
 * and a dropped connection is indistinguishable from a frozen page.
 *
 * 15s is the order of magnitude for this app. The slowest legitimate call is a SIEM export, which
 * returns a URL to fetch rather than the payload itself. A caller with a genuinely longer job -
 * a bulk equipment import - overrides it per request:
 *
 *     API.post("/api/auth/equipment/import", body, { timeout: 60000 })
 */
export const DEFAULT_TIMEOUT_MS = 15000;

/**
 * How many times an idempotent request is re-attempted after the first try, and how long the
 * pauses between attempts are.
 *
 * Two retries is a deliberate ceiling rather than a round number: with the timeout above, three
 * total attempts plus backoff is already ~31s of worst case, and a caller that has waited that
 * long is better served by the fallback than by a fourth attempt.
 */
export const MAX_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 300;

/**
 * Methods that may be re-attempted.
 *
 * Idempotence is the whole criterion. A GET, HEAD, OPTIONS, PUT or DELETE applied twice leaves the
 * server in the state one application would have. A POST does not - and crucially, a POST that
 * timed out may well have been *applied* already, with only the response lost, so retrying it can
 * duplicate an order, a maintenance record or a procurement request. PATCH is excluded for the
 * same reason: nothing guarantees a PATCH body is idempotent, and two of the ones in this codebase
 * are relative updates.
 */
const RETRYABLE_METHODS = ["get", "head", "options", "put", "delete"];

/** Transient by nature: the server is up but not currently able to answer. */
const RETRYABLE_STATUS_CODES = [502, 503, 504];

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8081",
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json"
  }
});

/**
 * Did this request run out of time rather than get refused?
 *
 * Axios reports a timeout as `ECONNABORTED` with a message it builds from the timeout value, and
 * as `ETIMEDOUT` on some adapters. Neither carries a response.
 */
export const isTimeoutError = (error) =>
  !!error &&
  !error.response &&
  (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || /timeout/i.test(error.message || ""));

/** No response at all, and not a timeout: DNS failure, refused connection, dropped socket. */
export const isNetworkError = (error) => !!error && !error.response && !isTimeoutError(error);

const isRetryable = (error) => {
  const config = error?.config;
  if (!config) return false;

  // A caller that aborted deliberately gets no further attempts. `signal` passes straight through
  // to axios, so a component can cancel its in-flight request on unmount.
  if (config.signal?.aborted) return false;

  const method = (config.method || "get").toLowerCase();
  if (!RETRYABLE_METHODS.includes(method)) return false;

  if (isTimeoutError(error) || isNetworkError(error)) return true;

  // A 4xx will fail identically the second time - the request is what is wrong, not the moment.
  return RETRYABLE_STATUS_CODES.includes(error.response?.status);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry, registered *before* the auth interceptor below so that an attempt which eventually
 * succeeds never reaches it - otherwise a recovered request would still log "API request failed"
 * and, for a 401 among the retries, would have signed the user out on the way to succeeding.
 */
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;

    if (!isRetryable(error)) return Promise.reject(decorate(error));

    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= MAX_RETRIES) return Promise.reject(decorate(error));

    config.__retryCount += 1;

    // Exponential: 300ms, then 600ms. Deliberately without jitter - there is one browser tab
    // here, not a fleet, so there is no thundering herd to spread out, and a deterministic delay
    // is one less source of flake in the tests.
    await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, config.__retryCount - 1));

    return API(config);
  }
);

/**
 * Give a failure a shape a service's catch can branch on.
 *
 * Every one of the 92 services currently sees only `error.message`, which is the same opaque
 * string whether the backend refused the request or was never reached. `isTimeout` and
 * `isNetwork` let a caller tell "backend unreachable" from "backend said no" - the difference
 * between showing fallback data and showing an error.
 */
function decorate(error) {
  if (!error || typeof error !== "object") return error;
  error.isTimeout = isTimeoutError(error);
  error.isNetwork = isNetworkError(error);
  error.attempts = (error.config?.__retryCount || 0) + 1;
  if (error.isTimeout) {
    error.friendlyMessage = `The server did not respond within ${DEFAULT_TIMEOUT_MS / 1000}s.`;
  } else if (error.isNetwork) {
    error.friendlyMessage = "The server could not be reached.";
  }
  return error;
}

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
    return Promise.reject(decorate(error));
  }
);

export { errorEmitter };
export default API;