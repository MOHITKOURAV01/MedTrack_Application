import { render } from "@testing-library/react";
import { AuthContext } from "../../context/AuthContext";
import { ThemeProvider } from "../../context/ThemeContext";
import { ToastContext, ToastProvider } from "../../context/ToastContext";

const defaultAuthValue = {
  user: null,
  authorityState: { authorityVersion: 1, permissions: [] },
  authorityVersion: 1,
  permissions: [],
  authorityLoading: false,
  login: () => {},
  logout: () => {},
  hasPermission: () => true,
  refreshAuthority: () => Promise.resolve(),
};

export function MockAuthProvider({ children, value = {} }) {
  return (
    <AuthContext.Provider value={{ ...defaultAuthValue, ...value }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Render `ui` inside the providers App.jsx actually mounts.
 *
 * The harness previously wrapped in `ThemeProvider` and a mock `AuthContext.Provider` and stopped
 * there, while App.jsx mounts
 *
 *     <AuthProvider><ThemeProvider><ErrorBoundary><ToastProvider>
 *
 * so every page that raises a toast was rendered outside a provider under test and failed on
 * `const { addToast } = useToast()` before reaching a single assertion - for a reason that had
 * nothing to do with what the test was about.
 *
 * @param {React.ReactElement} ui
 * @param {Object} [options]
 * @param {Object} [options.authValue] partial override merged over the default auth context
 * @param {Object} [options.toastValue] a stub toast context, for asserting on toasts directly.
 *   Omit it to get a real `ToastProvider`, which is what most tests want; pass
 *   `{ addToast: vi.fn() }` when the toast itself is the thing under test.
 */
export function renderWithProviders(ui, { authValue, toastValue, ...renderOptions } = {}) {
  function Toasts({ children }) {
    if (!toastValue) return <ToastProvider>{children}</ToastProvider>;

    // Only the keys the test supplied are overridden; the rest stay callable, so a stub of
    // `addToast` alone does not leave `removeToast` undefined for whatever else the page does.
    const value = {
      toasts: [],
      addToast: () => null,
      removeToast: () => {},
      isAvailable: true,
      ...toastValue,
    };
    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
  }

  function Wrapper({ children }) {
    return (
      <ThemeProvider>
        <MockAuthProvider value={authValue}>
          <Toasts>{children}</Toasts>
        </MockAuthProvider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
