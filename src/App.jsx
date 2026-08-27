import { useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import ToastContainer from "./components/common/ToastContainer";
import CommandPalette from "./components/common/CommandPalette";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import { errorEmitter } from "./services/HttpService";
import ErrorBoundary from "./components/common/ErrorBoundary";
import SessionGuard from "./components/common/SessionGuard";
import Navbar from "./components/common/Navbar";
import Footer from "./components/common/Footer";
import ScrollToTopButton from "./components/common/ScrollToTopButton";
import CustomCursor from "./components/common/CustomCursor";
import CookieBanner from "./components/common/CookieBanner";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "./context/ThemeContext";
import {
  BASE_PATH,
  buildPath,
  hasChrome,
  resolveEffectivePage,
  resolvePath,
} from "./routes/routeRegistry";

/**
 * Strips the GitHub Pages base path and surrounding slashes from the current location, leaving the
 * bare route path for the registry to resolve.
 */
const currentRoutePath = () =>
  window.location.pathname
    .replace(new RegExp(`^${BASE_PATH}`, "i"), "")
    .replace(/^\/+|\/+$/g, "");

/**
 * Route resolution is delegated to routeRegistry.js.
 *
 * This file used to carry its own `routeMap` object, maintained by hand in parallel with the
 * `switch` in AppRoutes.jsx. The two drifted, and the map itself contained duplicate keys: `help`
 * appeared twice, and `microsegmentation` appeared twice with *different* targets ("ztna" and
 * "microsegmentation"). In an object literal the last wins silently, so `/microsegmentation`
 * resolved to a page whose switch case was itself unreachable.
 *
 * This file also used to carry its own `lazy()` ladder rendering AboutPage, ContactPage and seven
 * others *before* delegating to AppRoutes. Those nine pages are all in the registry, so the ladder
 * both duplicated their chunks and made App.jsx a second place a route could be declared. Every
 * page now renders through AppRoutes; there is one list.
 */
const getRouteStateFromPath = () => resolvePath(currentRoutePath());

function AppContent() {
  const { user } = useAuth();
  const initialRoute = getRouteStateFromPath();
  const [currentPage, setCurrentPage] = useState(initialRoute.page);
  const [pageData, setPageData] = useState(initialRoute.data);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { addToast } = useToast();

  // Ctrl/Cmd+K opens the command palette anywhere in the app (public pages
  // included - it only lists destinations the visitor can actually reach).
  useKeyboardShortcuts({
    "ctrl+k": () => setPaletteOpen((open) => !open),
    "meta+k": () => setPaletteOpen((open) => !open),
  });

  useEffect(() => {
    const handler = (event) => {
      addToast(event.detail.message, event.detail.type);
    };
    errorEmitter.addEventListener("toast", handler);
    return () => errorEmitter.removeEventListener("toast", handler);
  }, [addToast]);

  const handleNavigate = (page, data = null) => {
    setCurrentPage(page);
    setPageData(data);

    const basePath = window.location.pathname.includes(BASE_PATH) ? BASE_PATH : "";
    window.history.pushState({}, "", `${basePath}${buildPath(page, data)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteStateFromPath();
      setCurrentPage(route.page);
      setPageData(route.data);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Whether a page shows the navbar and footer is a property of the route, declared once in the
  // registry, rather than a hard-coded list here that had to be kept in step with it.
  //
  // Evaluated against the *effective* page rather than the requested one. AppRoutes substitutes the
  // login screen for an unauthenticated hit on a protected route, so keying chrome off currentPage
  // wrapped the full-bleed login layout in the navbar and footer for a signed-out visit to
  // /equipment. Both sides now derive the substitution from resolveEffectivePage.
  const showChrome = hasChrome(resolveEffectivePage(user, currentPage));

  // SessionGuard sits inside ToastProvider (it needs toasts) and wraps the whole
  // layout so the idle-timeout warning can render above every page. It is a no-op
  // for signed-out visitors and enforces the inactivity auto-lock only once a
  // user is signed in - see SessionGuard.jsx.
  return (
    <SessionGuard>
      <ReactLenis root>
      <div
        className="flex flex-col min-h-screen bg-surface text-primary transition-colors duration-200"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <CustomCursor />
        <ToastContainer />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={handleNavigate}
        />
        {showChrome && (
          <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
        )}

        <main className="flex-1">
          <AppRoutes
            currentPage={currentPage}
            onNavigate={handleNavigate}
            pageData={pageData}
          />
        </main>

        {showChrome && <Footer onNavigate={handleNavigate} />}
        <ScrollToTopButton />
        <CookieBanner onNavigate={handleNavigate} />
      </div>
      </ReactLenis>
    </SessionGuard>
  );
}

export default function App() {
  // ErrorBoundary is outermost on purpose. It only catches errors thrown inside its own subtree, so
  // while it sat *inside* AuthProvider and ThemeProvider a throw during either provider's render -
  // which is exactly what an unreadable sessionStorage value produced, and what a localStorage
  // blocked by browser policy still produces - unmounted the entire tree to a blank page with
  // nothing left that could catch it or offer a way out.
  //
  // It was not actually outermost. It was third in, so the failure this comment describes was still
  // uncaught. It is outermost now.
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
