import API from "./HttpService";
import { readJson } from "../utils/safeSessionStorage";

const BASE = "/api/events";

/** Session key the auth layer writes; read here for a token refreshed while the client was down. */
const SESSION_USER_KEY = "medtrack_user";

// ---- REST API ----

export const getEvents = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set("category", params.category);
  if (params.unreadOnly) searchParams.set("unreadOnly", "true");
  searchParams.set("page", String(params.page ?? 0));
  searchParams.set("size", String(params.size ?? 20));
  const response = await API.get(`${BASE}?${searchParams.toString()}`);
  return response.data;
};

export const getUnreadCounts = async () => {
  const response = await API.get(`${BASE}/unread-counts`);
  return response.data;
};

export const getRecentEvents = async (since) => {
  const response = await API.get(`${BASE}/recent?since=${encodeURIComponent(since)}`);
  return response.data;
};

export const markEventsAsRead = async (eventIds) => {
  const response = await API.post(`${BASE}/read`, { eventIds });
  return response.data;
};

export const markAllEventsAsRead = async (limit = 100) => {
  const response = await API.post(`${BASE}/read-all?limit=${limit}`);
  return response.data;
};

// ---- WebSocket Client ----

/** Initial backoff before the first retry, doubled per attempt up to MAX_RECONNECT_DELAY_MS. */
const INITIAL_RECONNECT_DELAY_MS = 1000;

/** Ceiling for the exponential backoff. */
const MAX_RECONNECT_DELAY_MS = 30000;

/** Retries before the client stops trying and stays disconnected until something calls connect(). */
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Fraction of the backoff applied as random jitter.
 *
 * Without it, every client that dropped on the same backend restart retries in lockstep and the
 * backend is hit by the whole fleet at 1s, then 2s, then 4s.
 */
const RECONNECT_JITTER = 0.25;

/**
 * Applies jitter to a backoff delay.
 *
 * Exported so the reconnect schedule can be asserted without waiting on real timers.
 *
 * @param {number} delay base delay in ms
 * @param {number} [random] injectable [0, 1) source, so the result is deterministic under test
 * @returns {number} the delay, spread over +/- RECONNECT_JITTER of itself
 */
export function withJitter(delay, random = Math.random) {
  const spread = delay * RECONNECT_JITTER;
  return Math.max(0, Math.round(delay - spread + random() * spread * 2));
}

/**
 * Calls every handler in a set, in order, without letting one failure stop the rest.
 *
 * `Set.prototype.forEach` does not isolate its callbacks: a single subscriber that throws - a
 * component mid-unmount, an unexpected payload - aborted the iteration, and every subscriber
 * registered after it silently missed that event and every field of it.
 *
 * @param {Set<Function>} handlers
 * @param {*} payload
 * @param {string} label used in the warning when a handler throws
 */
function notifyAll(handlers, payload, label) {
  handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.warn(`[EventStream] ${label} handler threw:`, error);
    }
  });
}

class EventStreamClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.maxReconnectDelay = MAX_RECONNECT_DELAY_MS;
    this.hospitalId = null;
    this.token = null;
    this.eventHandlers = new Set();
    this.connectionHandlers = new Set();
    this.reconnectTimer = null;
    this.manuallyClosed = false;
    this.connected = false;

    // Every socket and every scheduled reconnect is stamped with the generation that created it.
    // A socket the client has moved on from cannot report state, and a reconnect that resolves
    // against a stale generation is discarded - see teardown() for why both are needed.
    this.generation = 0;
  }

  /**
   * Detaches a socket's handlers and closes it.
   *
   * The handlers have to come off *before* the close, and this is the whole fix. `WebSocket.close()`
   * is asynchronous: the previous implementation dropped its reference to the socket but left
   * `onclose` attached, closing over `this`. By the time that event was delivered, `connect()` had
   * already reset `manuallyClosed` to false for the replacement socket, so the stale handler
   *
   *   - called notifyConnection(false), telling every subscriber the feed was down while the new
   *     socket was opening or already open; and
   *   - called scheduleReconnect(), which fired a connect() against a socket the caller had
   *     deliberately replaced. If the replacement had reached OPEN the guard in connect() absorbed
   *     it; if it was still CONNECTING - a slow link, which is when reconnection matters - the guard
   *     did not fire, `this.ws` was overwritten, and the second socket was orphaned with its own
   *     live onclose to schedule yet another reconnect.
   *
   * @param {WebSocket|null} socket
   */
  teardown(socket) {
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch (error) {
      // A socket already closing throws in some implementations; nothing to do about it.
    }
  }

  /** The stream URL, carrying the credential the handshake cannot put in a header. */
  buildUrl(token) {
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${scheme}//${window.location.host}${BASE}/stream`;
    // A WebSocket handshake carries no Authorization header and the browser API exposes no way to
    // add one, so the credential travels as a query parameter. Previously `token` was accepted by
    // connect(), re-read from sessionStorage by scheduleReconnect(), and then never sent at all -
    // the stream was opened anonymously.
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  }

  connect(hospitalId, token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.hospitalId === hospitalId) {
      return;
    }

    // Retire whatever is in flight - open, connecting, or a pending reconnect - before replacing it.
    this.generation += 1;
    const generation = this.generation;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardown(this.ws);
    this.ws = null;

    this.hospitalId = hospitalId;
    this.token = token ?? null;
    this.manuallyClosed = false;

    let socket;
    try {
      socket = new WebSocket(this.buildUrl(this.token));
    } catch (error) {
      console.warn("[EventStream] Could not open socket:", error);
      this.notifyConnection(false);
      this.scheduleReconnect(generation);
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      if (generation !== this.generation) {
        return;
      }
      this.reconnectAttempts = 0;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this.notifyConnection(true);
      this.send({ action: "subscribe", hospitalId, token: this.token });
    };

    socket.onmessage = (event) => {
      if (generation !== this.generation) {
        return;
      }
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "event" && msg.event) {
          this.notifyEvent(msg.event);
        }
      } catch (e) {
        console.warn("[EventStream] Failed to parse message:", e);
      }
    };

    socket.onclose = () => {
      // A socket from a retired generation has no say in the client's state. This is the guard the
      // stale handler needed and did not have.
      if (generation !== this.generation) {
        return;
      }
      this.notifyConnection(false);
      if (!this.manuallyClosed) {
        this.scheduleReconnect(generation);
      }
    };

    socket.onerror = (err) => {
      if (generation !== this.generation) {
        return;
      }
      console.error("[EventStream] Error:", err);
    };
  }

  /**
   * Schedules one reconnect for the given generation.
   *
   * @param {number} generation the generation that requested it; a reconnect that resolves after the
   *   client has moved on is dropped rather than opening a socket nobody asked for
   */
  scheduleReconnect(generation) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[EventStream] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts += 1;
    // The delay is read first and doubled after, so the first retry honours the configured initial
    // delay. Previously it doubled before scheduling, so the first retry waited 2000ms while the
    // constructor advertised 1000ms.
    const delay = withJitter(this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);

    console.log(
      `[EventStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (generation !== this.generation || this.manuallyClosed || !this.hospitalId) {
        return;
      }
      // Prefer the credential the caller gave us; fall back to the stored session for a token that
      // was refreshed while this client was down.
      const stored = readJson(SESSION_USER_KEY);
      this.connect(this.hospitalId, stored?.token || this.token);
    }, delay);
  }

  disconnect() {
    this.generation += 1;
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardown(this.ws);
    this.ws = null;
    this.hospitalId = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.notifyConnection(false);
  }

  onEvent(handler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onConnectionChange(handler) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  notifyEvent(event) {
    notifyAll(this.eventHandlers, event, "event");
  }

  notifyConnection(connected) {
    // Subscribers render from this, so repeating a state they already hold is a wasted render at
    // best and a flicker at worst.
    if (this.connected === connected) {
      return;
    }
    this.connected = connected;
    notifyAll(this.connectionHandlers, connected, "connection");
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export const eventStream = new EventStreamClient();
