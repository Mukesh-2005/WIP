import logoMark from "../assets/design/logo-mark.svg";

// Sidebar items from the design. Only the ones with a `view` are built so far;
// the rest are shown (as in the design) but disabled.
const NAV = [
  { label: "Dashboard" },
  { label: "Tournaments" },
  { label: "Teams and registrations" },
  { label: "Fixtures", view: "fixtures" },
  { label: "Match centre", view: "demo" },
  { label: "Venues" },
  { label: "Announcements" },
  { label: "Reports" },
  { label: "Audit log" },
];

export function Logo({ className = "" }) {
  return (
    <div className={`logo-row ${className}`}>
      <img src={logoMark} alt="" width="26" height="26" />
      <span>TurfPlay</span>
    </div>
  );
}

// The organiser layout: dark green sidebar on the left (on a phone it becomes a
// scrollable strip at the top) and the page on the right.
export default function AppShell({ activeView, onNavigate, children }) {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Logo />
        <div className="sidebar-gap" />
        {NAV.map(({ label, view }) =>
          view ? (
            <button
              key={label}
              className={`nav-item ${activeView === view ? "nav-active" : ""}`}
              aria-current={activeView === view ? "page" : undefined}
              onClick={() => onNavigate(view)}
            >
              {label}
            </button>
          ) : (
            <button key={label} className="nav-item" disabled title="Not built yet">
              {label}
            </button>
          )
        )}
        <div className="sidebar-spacer" />
        <button className={`nav-item nav-public ${activeView === "public" ? "nav-active" : ""}`} onClick={() => onNavigate("public")}>
          View public page
        </button>
      </nav>
      <div className="shell-main">{children}</div>
    </div>
  );
}
