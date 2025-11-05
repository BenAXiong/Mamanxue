import { NavLink } from "react-router-dom";

const baseLinkClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
const inactiveClasses =
  "text-slate-200 hover:text-white hover:bg-slate-800/70";
const activeClasses = "bg-blue-600 text-white shadow";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8">
        <span className="app-logo text-white">{"\u66fc\u66fc\u5b78"}</span>
        <nav className="flex items-center gap-2">
          <NavLink
            to="/review"
            end
            className={({ isActive }) =>
              `${baseLinkClasses} ${isActive ? activeClasses : inactiveClasses}`
            }
          >
            Review
          </NavLink>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${baseLinkClasses} ${isActive ? activeClasses : inactiveClasses}`
            }
          >
            Dck
          </NavLink>
          <details className="relative group options">
            <summary
              className={`${baseLinkClasses} ${inactiveClasses} options-trigger cursor-pointer select-none`}
            >
              Options
            </summary>
            <div className="options-popover">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `options-link ${isActive ? "active" : ""}`
                }
              >
                Settings
              </NavLink>
              <NavLink
                to="/import"
                className={({ isActive }) =>
                  `options-link ${isActive ? "active" : ""}`
                }
              >
                Import / Export
              </NavLink>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

export default Header;
