import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getAllOrders } from "../../services/OrderService";
import { getUnreadCounts } from "../../services/EventStreamService";
import usePermissions from "../../hooks/usePermissions";
import { filterNavLinks } from "../../security/permissions";
import MedTrackLogo from "./MedTrackLogo";
import ActivityCenter from "../../pages/hospital/ActivityCenter";
import { CONSOLE_GROUPS, PAGE_LABELS } from "./pageDirectory";
import { checkAccess } from "../../routes/routeRegistry";

export default function Navbar({ onNavigate, currentPage }) {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [consolesOpen, setConsolesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  // Activity Center (real-time events)
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Supplier order polling (legacy - will be replaced by event stream)
  useEffect(() => {
    if (!user || user.role?.toLowerCase() !== "supplier") return;

    const checkSupplierOrders = async () => {
      try {
        const orders = await getAllOrders();
        if (Array.isArray(orders)) {
          const pendingOrders = orders.filter(
            (o) => o.shippingStatus === "Processing" || o.shippingStatus === "Pending"
          );
          setNotifications(pendingOrders);
          setUnreadCount(pendingOrders.length);
        }
      } catch (err) {
        setNotifications([
          { id: "ORD-9021", equipmentName: "MRI Scanner Component", hospital: "City Central Hospital", shippingStatus: "Processing" },
          { id: "ORD-9025", equipmentName: "ICU Ventilator Unit", hospital: "St. Jude Medical Center", shippingStatus: "Pending" }
        ]);
        setUnreadCount(2);
      }
    };

    checkSupplierOrders();
    const interval = setInterval(checkSupplierOrders, 12000);
    return () => clearInterval(interval);
  }, [user]);

  // Activity Center unread counts for hospital users
  useEffect(() => {
    if (!user || user.role?.toLowerCase() !== "hospital") return;

    const fetchUnreadCounts = async () => {
      try {
        const data = await getUnreadCounts();
        setActivityUnreadCount(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch unread counts:', err);
      }
    };

    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000); // Poll every 30s as fallback
    return () => clearInterval(interval);
  }, [user]);

  const isLanding = currentPage === "landing";

  // Landing page links. "Features" / "Hospitals" / "Suppliers" are sections of the landing page,
  // not routes of their own - pointing them at "landing" keeps them from 404ing (an unregistered
  // page key renders the not-found screen). "Features" additionally scrolls to its section when the
  // landing page is already on screen.
 const publicLinks = [
  { label: "Features", page: "landing", section: "features" },
  { label: "Hospitals", page: "landing" },
  { label: "Suppliers", page: "landing" },
  { label: "Blog", page: "blog" },
  { label: "For employers", page: "about" },
  { label: "Careers", page: "careers" },
];

  // Dashboard links after login
  // Links are tagged with the fine-grained permission they need (mirroring the
  // backend authority model). filterNavLinks drops any whose permission the
  // session no longer holds, so a permission revoked through the RBAC console
  // removes the menu entry instead of navigating to a page that 403s. Public
  // links carry no permission and always show.
  const privateLinks = user
    ? user.role === "hospital"
      ? [
          { label: "Dashboard", page: "dashboard" },
          { label: "Equipment", page: "equipment", permission: "READ_EQUIPMENT" },
          { label: "Maintenance", page: "maintenance", permission: "READ_MAINTENANCE" },
          { label: "PM Rules", page: "maintenance-rules", permission: "READ_MAINTENANCE" },
        ]
      : user.role === "technician"
      ? [
          { label: "My Tasks", page: "tasks" },
          { label: "Update Task", page: "update-task" },
        ]
      : [
          { label: "Orders", page: "orders", permission: "READ_ORDERS" },
          { label: "Order Status", page: "orderstatus", permission: "READ_ORDERS" },
        ]
    : [];

  // Procurement links for hospital
  const navLinks = user
    ? user.role === "hospital"
      ? [
          ...privateLinks,
          { label: "New Procurement", page: "procurement-wizard", permission: "CREATE_ORDERS" },
          { label: "Approval Inbox", page: "approval-inbox", permission: "READ_ORDERS" },
        ]
      : privateLinks
    : publicLinks;

  const visibleLinks = filterNavLinks(navLinks, hasPermission);

  // The clinical console menu. Thirty-four registered consoles had no navigation entry of any kind,
  // so the only way to open one was to know its URL and type it.
  //
  // Each group is filtered through checkAccess rather than through the role, because that is the
  // function the router itself uses to decide: listing a console the current role cannot open would
  // navigate to the access-denied screen, which is worse than not listing it. A group with nothing
  // left in it is dropped entirely rather than rendered as an empty heading.
  const consoleGroups = user
    ? CONSOLE_GROUPS.map((group) => ({
        ...group,
        entries: group.pages
          .filter((page) => checkAccess(user, page).allowed)
          .map((page) => ({ page, label: PAGE_LABELS[page]?.label || page })),
      })).filter((group) => group.entries.length > 0)
    : [];

  const openConsole = (page) => {
    setConsolesOpen(false);
    setMenuOpen(false);
    onNavigate(page);
  };

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isLanding ? (scrolled ? 'top-0 bg-surface/95 backdrop-blur-md shadow-sm border-b border-subtle' : 'top-0 bg-transparent border-transparent') : 'sticky top-0 bg-surface/80 backdrop-blur-lg border-b border-subtle'}`}>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex justify-between items-center h-20">

          {/* Logo */}
          <button
            onClick={() => onNavigate("landing")}
            className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-lg"
          >
            <MedTrackLogo size="text-2xl" />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">

            {visibleLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => {
                  if (link.page === "landing" && currentPage === "landing" && link.section) {
                    document.getElementById(link.section)?.scrollIntoView({ behavior: "smooth" });
                    return;
                  }
                  onNavigate(link.page);
                }}
                className={`text-sm font-bold transition-all ${
                  currentPage === link.page
                    ? "text-blue-600"
                    : "text-primary hover:text-blue-600"
                }`}
              >
                {link.label}
              </button>
            ))}

            {/* Clinical consoles. Rendered only when the session can reach at least one, so an
                anonymous visitor and a role with no console access never see an empty menu. */}
            {consoleGroups.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setConsolesOpen((open) => !open)}
                  aria-expanded={consolesOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-1 text-sm font-bold text-primary transition-all hover:text-blue-600 focus:outline-none"
                >
                  Consoles
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${consolesOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {consolesOpen && (
                  <>
                    {/* Click-away layer. The menu is wide and the consoles are many, so leaving it
                        open behind the page a user has just navigated to is worse than a backdrop. */}
                    <div className="fixed inset-0 z-40" onClick={() => setConsolesOpen(false)} aria-hidden="true" />
                    <div
                      role="menu"
                      aria-label="Clinical consoles"
                      className="absolute left-0 mt-3 z-50 w-[34rem] max-h-[70vh] overflow-y-auto rounded-2xl border border-subtle bg-card p-5 shadow-xl animate-in fade-in slide-in-from-top-2"
                    >
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {consoleGroups.map((group) => (
                          <div key={group.id}>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary/70">
                              {group.label}
                            </p>
                            <ul className="space-y-0.5">
                              {group.entries.map((entry) => (
                                <li key={entry.page}>
                                  <button
                                    role="menuitem"
                                    onClick={() => openConsole(entry.page)}
                                    className={`w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                                      currentPage === entry.page
                                        ? "bg-blue-600/10 text-blue-600"
                                        : "text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    {entry.label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 border-t border-subtle pt-3 text-[11px] text-secondary/70">
                        Press <kbd className="rounded bg-slate-100 px-1 font-semibold dark:bg-slate-800">Ctrl</kbd>
                        {" + "}
                        <kbd className="rounded bg-slate-100 px-1 font-semibold dark:bg-slate-800">K</kbd> to search
                        every console by name or by what it does.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

          {/* Right Side Buttons */}
          <div className="flex items-center gap-6">

            {/* Supplier Order Notification Bell */}
            {user && user.role?.toLowerCase() === "supplier" && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 text-primary hover:text-blue-600 transition-colors relative focus:outline-none"
                  aria-label="Order Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-card border border-subtle rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between pb-3 border-b border-subtle mb-3">
                      <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                        🔔 Order Requests
                      </h4>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => setUnreadCount(0)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {notifications.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setNotifOpen(false);
                              onNavigate("orders");
                            }}
                            className="p-3 bg-surface/50 hover:bg-hover rounded-xl cursor-pointer transition-colors border border-subtle/50"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-primary truncate max-w-[170px]">
                                {n.equipmentName || n.id}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                                {n.shippingStatus || "New Inquiry"}
                              </span>
                            </div>
                            <p className="text-[10px] text-secondary">
                              {n.hospital || "Hospital Order Request"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-secondary text-center py-4">
                        No active order notifications.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Activity Center Notification Bell (Hospital) */}
            {user && user.role?.toLowerCase() === "hospital" && (
              <div className="relative">
                <button
                  onClick={() => setActivityOpen(!activityOpen)}
                  className="p-2 text-primary hover:text-blue-600 transition-colors relative focus:outline-none"
                  aria-label="Activity Center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activityUnreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-blue-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {activityUnreadCount > 99 ? '99+' : activityUnreadCount}
                    </span>
                  )}
                </button>

                {activityOpen && (
                  <ActivityCenter
                    onClose={() => setActivityOpen(false)}
                    onNavigate={onNavigate}
                  />
                )}
              </div>
            )}

            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-primary font-medium">{user.name}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    onNavigate("landing");
                  }}
                  className="text-sm font-bold text-primary hover:text-blue-600"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate("login")}
                className="bg-black hover:bg-gray-800 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign in
              </button>
            )}

            {/* Mobile Menu Button */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-primary hover:text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>

          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {menuOpen && (
        <div className="md:hidden border-t border-subtle bg-surface px-6 py-4 space-y-3">
          {visibleLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => {
                if (link.page === "landing" && currentPage === "landing" && link.section) {
                  document.getElementById(link.section)?.scrollIntoView({ behavior: "smooth" });
                } else {
                  onNavigate(link.page);
                }
                setMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${
                currentPage === link.page ? "bg-blue-600 text-white" : "text-primary hover:bg-hover"
              }`}
            >
              {link.label}
            </button>
          ))}

          {/* The same consoles on mobile, flattened into labelled sections. A nested dropdown inside
              an already-open drawer is more chrome than it is navigation. */}
          {consoleGroups.map((group) => (
            <div key={group.id} className="pt-2">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-secondary/70">
                {group.label}
              </p>
              {group.entries.map((entry) => (
                <button
                  key={entry.page}
                  onClick={() => openConsole(entry.page)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    currentPage === entry.page ? "bg-blue-600 text-white" : "text-primary hover:bg-hover"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}