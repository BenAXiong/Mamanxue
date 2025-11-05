import { NavLink } from "react-router-dom";

const linkClasses =
  "btn text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800/70";

const activeClasses = "bg-blue-600 text-white";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        <span className="text-lg font-semibold text-white">MamanXue</span>
        <nav className="flex items-center gap-2">
          <NavLink
            to="/review"
            end
            className={({ isActive }) =>
              `${linkClasses} ${isActive ? activeClasses : ""}`
            }
          >
            Review
          </NavLink>
          <NavLink
            to="/import"
            className={({ isActive }) =>
              `${linkClasses} ${isActive ? activeClasses : ""}`
            }
          >
            Import / Export
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${linkClasses} ${isActive ? activeClasses : ""}`
            }
          >
            Settings
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
