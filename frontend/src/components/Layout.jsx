import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const NAV = [
  { to: "/",         label: "Dashboard" },
  { to: "/listeners",label: "Listeners" },
  { to: "/topics",   label: "Topics" },
  { to: "/logs",     label: "Logs" },
  { to: "/users",    label: "Users" },
  { to: "/acl",      label: "ACL" },
  { to: "/tls",      label: "TLS Certs" },
  { to: "/config",   label: "Config" },
  { to: "/user-management", label: "User Management", adminOnly: true },
];

export default function Layout() {
  const location = useLocation();
  const menuRef = useRef(null);
  const { user, logout, isAdmin } = useAuth();

  function openSidebar()  { document.documentElement.classList.add("sidebar-open");    sessionStorage.setItem("isSidebarOpen", "true"); }
  function closeSidebar() { document.documentElement.classList.remove("sidebar-open"); sessionStorage.setItem("isSidebarOpen", "false"); }
  function toggleSidebar() {
    document.documentElement.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
  }

  // Restore sidebar state on mount (avoids layout flash — same pattern as legacy)
  useEffect(() => {
    const isOpen = sessionStorage.getItem("isSidebarOpen") === "true";
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isOpen && isDesktop) {
      document.documentElement.classList.add("sidebar-open", "sidebar-preload");
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove("sidebar-preload");
    }));
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) closeSidebar();
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") closeSidebar(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Lock body scroll on mobile when open
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const open = document.documentElement.classList.contains("sidebar-open");
      if (window.innerWidth < 1024) {
        document.body.classList.toggle("sidebar-lock-scroll", open);
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay */}
      <div
        id="menu-overlay"
        className="fixed inset-0 z-40"
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sliding menu */}
      <div id="sliding-menu" ref={menuRef} className="fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <span className="font-semibold text-gray-800">Mosquitto</span>
          <button id="menu-close" onClick={closeSidebar} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-6 space-y-1">
          {NAV.filter(item => !item.adminOnly || isAdmin).map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors${isActive ? " bg-gray-100 font-medium" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 space-y-3">
          <div className="text-sm text-gray-600">
            <div className="font-medium">{user?.username}</div>
            <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="block w-full text-center bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
          <a
            href="https://mosquitto.org/documentation"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-c-orange text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors"
          >
            Docs
          </a>
        </div>
      </div>

      {/* Main content */}
      <div id="main-content" className="transition-all duration-300 ease-in-out">
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top bar */}
            <div className="sticky bg-gray-50 top-0 z-10 pb-2 flex items-center justify-between">
              <button
                onClick={toggleSidebar}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-c-orange hover:text-white transition-colors duration-200"
                aria-label="Toggle menu"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Mosquitto logo — using the SVG from legacy/index.html */}
              <div className="flex items-center gap-3 w-64">
                <svg width="57" height="43" viewBox="0 0 114 86" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M57.0013 86L58.5908 64.5156L59.8811 47.0706C62.5402 45.9585 64.4064 43.3537 64.4064 40.3183C64.4064 36.2725 61.0902 32.9916 57.0013 32.9916C52.9121 32.9916 49.5962 36.2725 49.5962 40.3183C49.5962 43.3537 51.4625 45.9585 54.1216 47.0706L55.412 64.5156L57.0013 86Z" fill="#F3771C"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.42676 40.291C6.42676 52.6852 11.0068 64.2874 18.9495 73.2527L14.1625 77.4988C5.1991 67.4059 0 54.2981 0 40.291C0 24.5083 6.55628 10.2381 17.1193 7.62939e-06L17.3602 0.213791L31.52 12.7736C18.2121 24.8448 15.456 44.4755 24.7152 59.5987L29.6037 55.2628C22.5455 42.6463 25.2344 26.7106 36.3333 17.0429L41.1815 21.3426L45.4936 25.168L49.9667 29.1355C48.2936 30.1731 46.8715 31.5698 45.8107 33.2165C44.4992 35.2519 43.7396 37.6684 43.7396 40.2597C43.7396 46.037 47.5151 50.9431 52.7571 52.6942L53.2087 58.7914C44.4739 57.0506 37.8941 49.4142 37.8941 40.2597C37.8941 36.1833 39.1989 32.408 41.4175 29.3198L37.1379 25.5231L37.1219 25.509C30.1062 34.73 30.5396 47.5312 38.0944 56.2719L23.7361 69.0071C9.60061 52.9899 9.19696 29.2169 22.7358 12.7492L17.9465 8.50084C11.336 16.442 7.14974 26.4328 6.51204 37.3633L6.48277 37.3959L6.50886 37.4186C6.45429 38.3692 6.42676 39.3268 6.42676 40.2912V40.291Z" fill="#3C5280"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M61.2429 52.6942C66.4849 50.9431 70.2608 46.037 70.2608 40.2597C70.2608 37.6684 69.5008 35.2519 68.1898 33.217C67.1285 31.5703 65.7064 30.1731 64.0342 29.1355L68.5069 25.1683L72.8194 21.3426H72.8189L77.6672 17.0429C88.7656 26.7106 91.455 42.6463 84.3968 55.2628L89.2848 59.5987C98.5445 44.4755 95.7883 24.8448 82.48 12.7736L96.6408 0.212845L96.8807 7.62939e-06C107.444 10.2381 114 24.5083 114 40.291C114 54.2981 108.801 67.4059 99.838 77.4988L95.0505 73.2527C102.994 64.2874 107.573 52.6852 107.573 40.291C107.573 39.3266 107.546 38.369 107.492 37.4184L107.517 37.3958L107.488 37.3632C106.851 26.4326 102.664 16.4419 96.054 8.50068L91.2647 12.7491C104.804 29.2167 104.4 52.9897 90.2639 69.007L75.9061 56.2718C83.4609 47.531 83.8943 34.7299 76.8784 25.5088L76.8621 25.523L72.5825 29.3202C74.8011 32.4078 76.1059 36.1836 76.1059 40.2596C76.1059 49.414 69.5261 57.05 60.7918 58.7913L61.2429 52.6941V52.6942Z" fill="#3C5280"/>
                </svg>
                <span className="text-sm font-semibold text-gray-700">Mosquitto Dashboard</span>
              </div>
            </div>

            {/* Page content */}
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
