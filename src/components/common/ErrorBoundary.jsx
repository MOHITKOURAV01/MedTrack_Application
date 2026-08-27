import { Component } from "react";
import { BASE_PATH } from "../../routes/routeRegistry";

/**
 * The application's last line of defence against a render that throws.
 *
 * Mounted outside every provider in App.jsx, which is where the comment there always said it was and
 * where it needs to be: a boundary only catches what is thrown *below* it, and a provider that
 * throws while resolving its initial state - an unreadable session, a `localStorage` blocked by
 * browser policy - throws above anything nested inside it.
 *
 * A caught error is recoverable in three ways, in increasing order of cost to the user:
 *
 *   1. The browser's back/forward buttons. `hasError` was never cleared, and in a pushState SPA
 *      nothing remounts the boundary - so one broken console disabled every route for the rest of
 *      the session, and the app's own navigation was gone with the unmounted tree. Going back is
 *      the one navigation the user still has, and it now lands on a working app.
 *   2. "Try again" re-renders the subtree in place. A transient failure - a fetch that rejected, a
 *      malformed payload - does not need the document thrown away.
 *   3. "Go home" is the full document navigation, kept as the last resort it is.
 *
 * `resetKey` is the same recovery for a host that already tracks a route: change it and a caught
 * error clears.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Clears a caught error when the host says the context has changed.
   *
   * Derived state rather than `componentDidUpdate`, so the recovered subtree renders in the same
   * commit as the key change instead of painting the error panel for one frame first.
   */
  static getDerivedStateFromProps(props, state) {
    if (state.hasError && props.resetKey !== state.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    if (props.resetKey !== state.resetKey) {
      return { resetKey: props.resetKey };
    }
    return null;
  }

  componentDidMount() {
    // The app's own navigation lives in the tree this boundary just unmounted, so back/forward is
    // the only navigation a user has left once the panel is showing. pushState does not fire this,
    // which is why `resetKey` exists alongside it.
    window.addEventListener("popstate", this.handleTryAgain);
  }

  componentWillUnmount() {
    window.removeEventListener("popstate", this.handleTryAgain);
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleTryAgain = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  };

  handleGoHome = () => {
    // BASE_PATH comes from the route registry, which is where every other consumer of it reads it
    // from - HttpService's session-expiry redirect and App.jsx's navigation both do. This file had
    // the string written out by hand, so three places agreed by coincidence rather than by import.
    const pathname = window.location.pathname || "";
    window.location.href = pathname.includes(BASE_PATH) ? BASE_PATH : "/";
  };

  render() {
    if (this.state.hasError) {
      // Surfaced in development only. In production it is noise to a user and can leak internals;
      // in development, having to open the console to learn what threw is a needless step.
      const detail =
        process.env.NODE_ENV === "development" && this.state.error
          ? this.state.error.message || String(this.state.error)
          : null;

      return (
        <div
          role="alert"
          className="flex items-center justify-center min-h-screen bg-surface text-primary"
        >
          <div className="text-center space-y-4 p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-3xl font-bold">Something went wrong</h1>
            <p className="text-lg text-secondary max-w-md mx-auto">
              An unexpected error occurred. You can try again, or return to the homepage.
            </p>
            {detail && (
              <pre className="max-w-md mx-auto overflow-x-auto rounded-lg bg-slate-900 p-3 text-left text-xs text-rose-300">
                {detail}
              </pre>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={this.handleTryAgain}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-6 py-3 border border-slate-600 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
