import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getAuthorityVersion } from "../services/AuthService";
import { readJson, writeJson, remove } from "../utils/safeSessionStorage";

const USER_KEY = "medtrack_user";
const AUTHORITY_KEY = "medtrack_authority";
const SESSION_END_REASON_KEY = "medtrack_session_end_reason";
const DEFAULT_AUTHORITY = { authorityVersion: 1, permissions: [] };

/** How often the client re-checks its authority version against the server. */
const AUTHORITY_POLL_INTERVAL_MS = 60000;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Read through safeSessionStorage. A bare JSON.parse here threw out of the provider's render on
  // any malformed value, and because ErrorBoundary is nested inside this provider it never mounted
  // and could not catch it - the whole tree unmounted to a permanently blank page with no route left
  // that could offer a way to sign out.
  const [user, setUser] = useState(() => readJson(USER_KEY, null));

  // The authority entry persisted by a previous page load, or null when this browser has no stored
  // session. The distinction matters and is read exactly once: `null` means "this session has never
  // fetched an authority version", which is not the same thing as "this session holds version 1".
  const [storedAuthority] = useState(() => readJson(AUTHORITY_KEY, null));

  const [authorityState, setAuthorityState] = useState(
    () => storedAuthority ?? DEFAULT_AUTHORITY
  );

  const [authorityLoading, setAuthorityLoading] = useState(false);

  /**
   * Set when the session ended for a reason the user should see again: ended
   * by an administrator (authority revocation) or auto-locked for inactivity.
   * Persisted so the reason survives a page refresh on the login screen.
   */
  const [revokedReason, setRevokedReason] = useState(() =>
    readJson(SESSION_END_REASON_KEY, null)
  );

  // Latest committed authority state, also held in a ref. fetchUserAuthority is a stable callback
  // (empty deps), so it cannot read authorityState directly without going stale between renders -
  // but the revocation comparison needs the current version at fetch time.
  //
  // The ref is written by commitAuthority and clearAuthorityBaseline rather than during render.
  // Assigning it on every render meant any unrelated re-render landing between a commit and its
  // paint - `authorityLoading` flipping, for instance - could push the ref back to the pre-commit
  // value, which is the stale number the comparison below must never see.
  const authorityStateRef = useRef(authorityState);

  /**
   * Whether `authorityStateRef.current.authorityVersion` is a version this session actually
   * obtained, as opposed to the DEFAULT_AUTHORITY placeholder.
   *
   * This flag is the whole fix for #22. `DEFAULT_AUTHORITY.authorityVersion` is `1`, which is not a
   * neutral sentinel - it is where every tenant starts, so it is indistinguishable from a real
   * version 1 - and the revocation check below reads any server version above the one held as an
   * administrator revocation. On a session that had never fetched, that compared the server's
   * version against a placeholder, so a tenant whose authority version had moved past 1 (one press
   * of "Invalidate active tokens" does it) revoked every sign-in the instant it succeeded.
   *
   * A session restored from sessionStorage is a different case: it holds a version it really was
   * issued, so it starts with a baseline and is still revoked by a higher one.
   */
  const baselineEstablishedRef = useRef(storedAuthority !== null);

  /**
   * Commits an authority response as the session's current state and baseline.
   *
   * The ref is updated synchronously with the state so a second fetch resolving before React has
   * re-rendered compares against the version just committed, not the one before it.
   */
  const commitAuthority = useCallback((next) => {
    authorityStateRef.current = next;
    baselineEstablishedRef.current = true;
    setAuthorityState(next);
    writeJson(AUTHORITY_KEY, next);
  }, []);

  /** Returns the session to "no authority version known", for a sign-in or a sign-out. */
  const clearAuthorityBaseline = useCallback(() => {
    authorityStateRef.current = DEFAULT_AUTHORITY;
    baselineEstablishedRef.current = false;
    setAuthorityState(DEFAULT_AUTHORITY);
    remove(AUTHORITY_KEY);
  }, []);

  const login = (userData) => {
    setRevokedReason(null);
    remove(SESSION_END_REASON_KEY);

    // A new sign-in starts with no authority baseline. Whatever the previous session left in state
    // or in sessionStorage belongs to a different session - possibly a different account - and must
    // not be treated as a version this one can be revoked against.
    clearAuthorityBaseline();

    setUser(userData);
    writeJson(USER_KEY, userData);

    // The authority fetch is left to the effect below, which fires on the `user.id` transition this
    // assignment causes. Calling it here as well put two fetches in flight for the same sign-in,
    // and the second could resolve against a baseline the first had only just established - a race
    // that revoked a perfectly good session roughly one time in twenty.
  };

  const logout = useCallback((reason = null) => {
    setUser(null);
    clearAuthorityBaseline();
    setRevokedReason(reason);
    remove(USER_KEY);
    if (reason) {
      writeJson(SESSION_END_REASON_KEY, reason);
    } else {
      remove(SESSION_END_REASON_KEY);
    }
  }, [clearAuthorityBaseline]);

  /** Dismisses the session-end notice once the user has read it. */
  const clearRevokedReason = useCallback(() => {
    setRevokedReason(null);
    remove(SESSION_END_REASON_KEY);
  }, []);

  // Held in a ref so fetchUserAuthority can call logout without taking it as a dependency, which
  // would put the callback's identity back on a state value and restart the poll interval.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  // No dependency on authorityState. It previously depended on authorityState.authorityVersion while
  // also *setting* authorityState, so the callback identity changed on every poll, the effect below
  // tore down and recreated its interval each time, and an extra immediate fetch fired outside the
  // 60-second cadence. The version comparison also read a value captured when the callback was
  // created, so it could compare against a stale number.
  const fetchUserAuthority = useCallback(async (userId) => {
    if (!userId || userId === "demo-user") return;
    setAuthorityLoading(true);
    try {
      const data = await getAuthorityVersion(userId);
      if (data) {
        const newAuth = {
          authorityVersion: data.authorityVersion || 1,
          permissions: data.permissions || [],
          role: data.role || "",
          active: data.active
        };

        // Authority version exists so an administrator can revoke live sessions - that is what
        // POST /api/auth/authority/version/increment and /bump-global are for, and what the
        // Enterprise Security Center presents as "Active tokens invalidated!". Compare against the
        // committed value read at fetch time. The previous version must NOT be compared inside a
        // setState updater: React defers updater functions to the render phase, so a flag written
        // there is still false when checked synchronously and the logout below never runs.
        const previousAuth = authorityStateRef.current;
        if (
          baselineEstablishedRef.current &&
          previousAuth.authorityVersion &&
          newAuth.authorityVersion > previousAuth.authorityVersion
        ) {
          logoutRef.current(
            "Your session was ended by an administrator. Please sign in again."
          );
          return;
        }

        // Either this is the session's first fetch, in which case the server's version becomes the
        // baseline (there is nothing yet to revoke), or the version is unchanged or lower and the
        // session continues. A lower version is not a revocation: it means the tenant's counter was
        // rolled back, and ending sessions over that would be a denial of service, not a control.
        commitAuthority(newAuth);
      }
    } catch (err) {
      console.error("Failed to fetch user authority state:", err);
    } finally {
      setAuthorityLoading(false);
    }
  }, [commitAuthority]);

  // Periodic verification of the authority version. Depends only on the user id, so the interval is
  // created once per session rather than being recreated on every authority change.
  useEffect(() => {
    if (!user || !user.id) {
      return undefined;
    }
    fetchUserAuthority(user.id);
    const interval = setInterval(() => {
      fetchUserAuthority(user.id);
    }, AUTHORITY_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id, fetchUserAuthority]);

  const hasPermission = (permissionName) => {
    if (!permissionName) return true;
    return authorityState.permissions.includes(permissionName);
  };

  const refreshAuthority = () => {
    if (user && user.id) {
      return fetchUserAuthority(user.id);
    }
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authorityState,
        authorityVersion: authorityState.authorityVersion,
        permissions: authorityState.permissions,
        authorityLoading,
        revokedReason,
        clearRevokedReason,
        login,
        logout,
        hasPermission,
        refreshAuthority
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// Exported for testing — allows MockAuthProvider to wrap components with a known context value
export { AuthContext };
