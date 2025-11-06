import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import codexStatus, { type CodexStatus } from "../codexStatus";
import { ReactComponent as SteartIcon } from "../assets/steart_2.svg";
import { useSessionStore } from "../store/session";
import { useServiceWorker } from "../pwa/ServiceWorkerProvider";

const baseLinkClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
const inactiveClasses =
  "text-secondary hover:text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/30";
const activeClasses = "bg-white/10 text-white shadow";

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
  const [announceMessage, setAnnounceMessage] = useState<string | null>(null);
  const finishingTimerRef = useRef<number | null>(null);
  const optionsRef = useRef<HTMLDetailsElement | null>(null);
  const location = useLocation();
  const suspendSession = useSessionStore((state) => state.suspendSession);
  const { isOnline } = useServiceWorker();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const node = optionsRef.current;
      if (!node || !node.open) {
        return;
      }
      if (event.target instanceof Node && node.contains(event.target)) {
        return;
      }
      node.open = false;
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

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

  useEffect(() => {
    if (!announceMessage || typeof window === "undefined") {
      return;
    }
    const timer = window.setTimeout(() => {
      setAnnounceMessage(null);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [announceMessage]);

  const placeholderHandlers = useMemo(
    () => ({
      noteTypes: () => {
        setAnnounceMessage("Note types management is coming soon.");
        if (optionsRef.current) {
          optionsRef.current.open = false;
        }
      },
      inspect: () => {
        setAnnounceMessage("Inspect tools will arrive later in this overhaul.");
        if (optionsRef.current) {
          optionsRef.current.open = false;
        }
      },
    }),
    [],
  );

  return (
    <header className="app-header sticky top-0 z-30 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:px-8">
        <div className="flex items-center gap-3">
          <SteartIcon
            aria-hidden="true"
            className={`logo-mark ${logoStatusClass}`}
            width={24}
            height={24}
            style={{ color: logoColor }}
          />
          <span
            className={`app-logo ${logoStatusClass}`}
            style={{ color: logoColor }}
          >
            {"\u66fc\u66fc\u5b78"}
          </span>
        </div>
        <nav className="flex items-center gap-3">
          {!isOnline ? (
            <span className="offline-chip" role="status" aria-live="polite">
              Offline
            </span>
          ) : null}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${baseLinkClasses} ${isActive ? activeClasses : inactiveClasses}`
            }
            onClick={() => {
              if (location.pathname.startsWith("/review")) {
                suspendSession();
              }
            }}
          >
            Decks
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) =>
              `${baseLinkClasses} ${isActive ? activeClasses : inactiveClasses}`
            }
          >
            Stats
          </NavLink>
          <details className="relative group options" ref={optionsRef}>
            <summary
              className={`${baseLinkClasses} ${inactiveClasses} options-trigger cursor-pointer select-none`}
            >
              <span className="sr-only">Menu</span>
              <HeaderMenuIcon />
            </summary>
            <div className="options-popover">
              <NavLink
                to="/import"
                className={({ isActive }) =>
                  `options-link ${isActive ? "active" : ""}`
                }
                onClick={() => {
                  if (optionsRef.current) {
                    optionsRef.current.open = false;
                  }
                }}
              >
                Import
              </NavLink>
              <NavLink
                to="/import?tab=export"
                className={() => `options-link`}
                onClick={() => {
                  if (optionsRef.current) {
                    optionsRef.current.open = false;
                  }
                }}
              >
                Export
              </NavLink>
              <button
                type="button"
                className="options-link text-left"
                onClick={placeholderHandlers.noteTypes}
              >
                Note types
                <span className="block text-[0.65rem] uppercase text-slate-500">
                  coming soon
                </span>
              </button>
              <button
                type="button"
                className="options-link text-left"
                onClick={placeholderHandlers.inspect}
              >
                Inspect
                <span className="block text-[0.65rem] uppercase text-slate-500">
                  coming soon
                </span>
              </button>
              <div className="divider" />
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `options-link ${isActive ? "active" : ""}`
                }
              >
                Settings
              </NavLink>
            </div>
          </details>
        </nav>
      </div>
      {announceMessage ? (
        <div className="sr-only" role="status" aria-live="polite">
          {announceMessage}
        </div>
      ) : null}
    </header>
  );
}

export default Header;

function HeaderMenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="7" x2="19" y2="7" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="17" x2="19" y2="17" />
    </svg>
  );
}





