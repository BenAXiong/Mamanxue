import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import codexStatus, { type CodexStatus } from "../codexStatus";

const baseLinkClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
const inactiveClasses =
  "text-slate-200 hover:text-white hover:bg-slate-800/70";
const activeClasses = "bg-blue-600 text-white shadow";

const STATUS_COLORS: Record<CodexStatus, string> = {
  idle: "#ffffff",
  working: "#ef4444",
  finishing: "#34d399",
};

function classForStatus(status: CodexStatus): string {
  switch (status) {
    case "working":
      return "codex-status-working";
    case "finishing":
      return "codex-status-finishing";
    default:
      return "codex-status-idle";
  }
}

export function Header() {
  const status = codexStatus;
  const [logoColor, setLogoColor] = useState<string>(STATUS_COLORS[status]);
  const [logoStatusClass, setLogoStatusClass] = useState<string>(
    classForStatus(status),
  );
  const finishingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (finishingTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(finishingTimerRef.current);
        finishingTimerRef.current = null;
      }
    };

    clearTimer();
    setLogoColor(STATUS_COLORS[status]);
    setLogoStatusClass(classForStatus(status));

    if (status === "finishing" && typeof window !== "undefined") {
      finishingTimerRef.current = window.setTimeout(() => {
        setLogoColor(STATUS_COLORS.idle);
        setLogoStatusClass(classForStatus("idle"));
        finishingTimerRef.current = null;
      }, 30_000);
    }

    return () => {
      clearTimer();
    };
  }, [status]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8">
        <span
          className={`app-logo ${logoStatusClass}`}
          style={{ color: logoColor }}
        >
          {"\u66fc\u66fc\u5b78"}
        </span>
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
            Decks
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


