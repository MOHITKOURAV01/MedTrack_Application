import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eventStream, withJitter } from "../../services/EventStreamService";

/**
 * A WebSocket stand-in that stays CONNECTING until a test says otherwise.
 *
 * jsdom ships no WebSocket, and the race this file exists to cover is only reachable while a
 * replacement socket is still CONNECTING - so the fake has to let a test hold it there and deliver
 * the old socket's close event underneath it, in that order. A real socket cannot be driven that
 * precisely.
 */
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.closeCalls = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closeCalls += 1;
    this.readyState = FakeWebSocket.CLOSED;
  }

  /** Completes the handshake. */
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }

  /** Delivers a close event, as the browser would - which the client may or may not still care about. */
  emitClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({});
  }

  emitMessage(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  static latest() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

  static reset() {
    FakeWebSocket.instances = [];
  }
}

const originalWebSocket = global.WebSocket;

describe("EventStreamService", () => {
  let logs;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.reset();
    global.WebSocket = FakeWebSocket;
    sessionStorage.clear();
    logs = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // The client is a module singleton, so each test has to hand it back in a clean state.
    eventStream.disconnect();
    eventStream.eventHandlers.clear();
    eventStream.connectionHandlers.clear();
    eventStream.connected = false;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.WebSocket = originalWebSocket;
  });

  describe("connect", () => {
    it("opens a socket and subscribes once the handshake completes", () => {
      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();

      expect(socket.sent).toEqual([]);
      socket.open();
      expect(socket.sent).toEqual([{ action: "subscribe", hospitalId: "hosp-1", token: "tok-1" }]);
    });

    it("sends the credential in the URL, which a handshake cannot put in a header", () => {
      eventStream.connect("hosp-1", "tok/with+chars");
      expect(FakeWebSocket.latest().url).toContain(`token=${encodeURIComponent("tok/with+chars")}`);
    });

    it("omits the query parameter entirely when there is no token", () => {
      eventStream.connect("hosp-1");
      expect(FakeWebSocket.latest().url).not.toContain("token=");
    });

    it("is a no-op when already open against the same hospital", () => {
      eventStream.connect("hosp-1", "tok-1");
      FakeWebSocket.latest().open();
      eventStream.connect("hosp-1", "tok-1");
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("replaces the socket when the hospital changes", () => {
      eventStream.connect("hosp-1", "tok-1");
      const first = FakeWebSocket.latest();
      first.open();

      eventStream.connect("hosp-2", "tok-1");
      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(first.closeCalls).toBe(1);
    });

    it("schedules a retry when the constructor itself throws", () => {
      global.WebSocket = class {
        constructor() {
          throw new Error("blocked by policy");
        }
      };
      global.WebSocket.OPEN = 1;

      expect(() => eventStream.connect("hosp-1", "tok-1")).not.toThrow();
      expect(logs.log).toHaveBeenCalledWith(expect.stringContaining("Reconnecting in"));
    });
  });

  // The regression this file exists for.
  describe("a retired socket", () => {
    it("has its handlers detached before it is closed", () => {
      eventStream.connect("hosp-1", "tok-1");
      const first = FakeWebSocket.latest();
      first.open();

      eventStream.connect("hosp-2", "tok-1");

      expect(first.onclose).toBeNull();
      expect(first.onopen).toBeNull();
      expect(first.onmessage).toBeNull();
      expect(first.onerror).toBeNull();
    });

    it("cannot report the feed as down after its replacement is open", () => {
      const states = [];
      eventStream.onConnectionChange((connected) => states.push(connected));

      eventStream.connect("hosp-1", "tok-1");
      const first = FakeWebSocket.latest();
      first.open();
      expect(states).toEqual([true]);

      eventStream.connect("hosp-2", "tok-1");
      const second = FakeWebSocket.latest();
      second.open();

      // The browser delivers the first socket's close event late, as it always would.
      first.onclose?.({});
      first.emitClose();

      // One `true`, and nothing else. The retired socket has no handler left to fire, and the
      // handover itself is not announced - subscribers render an offline banner from this, and a
      // deliberate switch is not an outage. Previously the stale handler pushed a `false` here,
      // over a live stream.
      expect(states).toEqual([true]);
      expect(eventStream.isConnected()).toBe(true);
    });

    it("cannot schedule a reconnect against a socket that was deliberately replaced", () => {
      eventStream.connect("hosp-1", "tok-1");
      const first = FakeWebSocket.latest();
      first.open();

      eventStream.connect("hosp-2", "tok-1");
      const second = FakeWebSocket.latest();
      // Deliberately left CONNECTING: this is the window in which the old code overwrote `this.ws`
      // and orphaned the replacement.
      expect(second.readyState).toBe(FakeWebSocket.CONNECTING);

      first.emitClose();
      vi.advanceTimersByTime(60000);

      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(eventStream.ws).toBe(second);
    });

    it("cannot deliver messages after being replaced", () => {
      const received = [];
      eventStream.onEvent((event) => received.push(event));

      eventStream.connect("hosp-1", "tok-1");
      const first = FakeWebSocket.latest();
      first.open();
      first.emitMessage({ type: "event", event: { id: 1 } });
      expect(received).toHaveLength(1);

      const handler = first.onmessage;
      eventStream.connect("hosp-2", "tok-1");
      // Even if the browser had already queued a delivery against the old handler.
      handler?.({ data: JSON.stringify({ type: "event", event: { id: 2 } }) });

      expect(received).toEqual([{ id: 1 }]);
    });
  });

  describe("reconnect", () => {
    it("honours the configured initial delay on the first retry", () => {
      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();
      socket.emitClose();

      // 1000ms +/- 25% jitter. Previously the first retry waited 2000ms, because the delay was
      // doubled before it was used.
      vi.advanceTimersByTime(1250);
      expect(FakeWebSocket.instances).toHaveLength(2);
    });

    it("backs off exponentially and stops at the attempt ceiling", () => {
      eventStream.connect("hosp-1", "tok-1");
      FakeWebSocket.latest().open();

      for (let attempt = 0; attempt < 12; attempt += 1) {
        FakeWebSocket.latest().emitClose();
        vi.advanceTimersByTime(60000);
      }

      // One initial socket plus at most maxReconnectAttempts retries.
      expect(FakeWebSocket.instances.length).toBeLessThanOrEqual(1 + eventStream.maxReconnectAttempts);
      expect(logs.warn).toHaveBeenCalledWith(expect.stringContaining("Max reconnect attempts reached"));
    });

    it("resets the attempt counter and the delay once a socket opens", () => {
      eventStream.connect("hosp-1", "tok-1");
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().emitClose();
      expect(eventStream.reconnectAttempts).toBe(1);

      vi.advanceTimersByTime(60000);
      FakeWebSocket.latest().open();

      expect(eventStream.reconnectAttempts).toBe(0);
      expect(eventStream.reconnectDelay).toBe(1000);
    });

    it("picks up a token refreshed in the session while it was down", () => {
      eventStream.connect("hosp-1", "stale-token");
      const socket = FakeWebSocket.latest();
      socket.open();

      sessionStorage.setItem("medtrack_user", JSON.stringify({ token: "fresh-token" }));
      socket.emitClose();
      vi.advanceTimersByTime(60000);

      expect(FakeWebSocket.latest().url).toContain("token=fresh-token");
    });

    it("survives an unreadable session entry", () => {
      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();

      sessionStorage.setItem("medtrack_user", "{ broken");
      socket.emitClose();

      expect(() => vi.advanceTimersByTime(60000)).not.toThrow();
      expect(FakeWebSocket.latest().url).toContain("token=tok-1");
    });

    it("does not reconnect after an explicit disconnect", () => {
      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();

      eventStream.disconnect();
      socket.emitClose();
      vi.advanceTimersByTime(60000);

      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe("subscribers", () => {
    it("delivers to every subscriber even when one throws", () => {
      const seen = [];
      eventStream.onEvent(() => { throw new Error("subscriber blew up"); });
      eventStream.onEvent((event) => seen.push(event));

      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();
      socket.emitMessage({ type: "event", event: { id: 7 } });

      expect(seen).toEqual([{ id: 7 }]);
      expect(logs.warn).toHaveBeenCalledWith(expect.stringContaining("event handler threw"), expect.anything());
    });

    it("notifies every connection subscriber even when one throws", () => {
      const seen = [];
      eventStream.onConnectionChange(() => { throw new Error("subscriber blew up"); });
      eventStream.onConnectionChange((connected) => seen.push(connected));

      eventStream.connect("hosp-1", "tok-1");
      FakeWebSocket.latest().open();

      expect(seen).toEqual([true]);
    });

    it("unsubscribes through the returned function", () => {
      const seen = [];
      const unsubscribe = eventStream.onEvent((event) => seen.push(event));

      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();
      socket.emitMessage({ type: "event", event: { id: 1 } });
      unsubscribe();
      socket.emitMessage({ type: "event", event: { id: 2 } });

      expect(seen).toEqual([{ id: 1 }]);
    });

    it("does not repeat a connection state the subscribers already hold", () => {
      const states = [];
      eventStream.onConnectionChange((connected) => states.push(connected));

      eventStream.connect("hosp-1", "tok-1");
      FakeWebSocket.latest().open();
      eventStream.disconnect();
      eventStream.disconnect();

      expect(states).toEqual([true, false]);
    });

    it("ignores an unparseable frame without disturbing the stream", () => {
      const seen = [];
      eventStream.onEvent((event) => seen.push(event));

      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();
      socket.onmessage({ data: "not json" });
      socket.emitMessage({ type: "event", event: { id: 1 } });

      expect(seen).toEqual([{ id: 1 }]);
    });

    it("ignores a frame that is not an event", () => {
      const seen = [];
      eventStream.onEvent((event) => seen.push(event));

      eventStream.connect("hosp-1", "tok-1");
      const socket = FakeWebSocket.latest();
      socket.open();
      socket.emitMessage({ type: "pong" });

      expect(seen).toEqual([]);
    });
  });

  describe("withJitter", () => {
    it("spreads a delay over +/- 25% of itself", () => {
      expect(withJitter(1000, () => 0)).toBe(750);
      expect(withJitter(1000, () => 0.5)).toBe(1000);
      expect(withJitter(1000, () => 0.999)).toBe(1250);
    });

    it("never returns a negative delay", () => {
      expect(withJitter(0, () => 0)).toBe(0);
    });
  });
});
