import { useMemo, useState } from "react";
import { resetFirstRun } from "../db/bootstrap";
import { db } from "../db/dexie";
import { useServiceWorker } from "../pwa/ServiceWorkerProvider";
import { useTheme, type ThemePreference } from "../theme/ThemeProvider";
import { useToast } from "../components/ToastProvider";

export function SettingsPage() {
  const [resetStatus, setResetStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [clearStatus, setClearStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [clearFeedback, setClearFeedback] = useState<string | null>(null);
  const {
    buildInfo,
    checkingForUpdate,
    checkForUpdates,
    updateAvailable,
  } = useServiceWorker();
  const { preference: themePreference, resolved: resolvedTheme, setPreference: setThemePreference } =
    useTheme();
  const { showToast } = useToast();

  const buildVersionLabel = useMemo(() => {
    if (!buildInfo) {
      return "Development build";
    }
    const builtOn = new Date(buildInfo.timestamp);
    const formatted = Number.isNaN(builtOn.valueOf())
      ? buildInfo.timestamp
      : builtOn.toLocaleString();
    return `Build ${buildInfo.version} • ${formatted}`;
  }, [buildInfo]);

  const handleThemeSelect = (preference: ThemePreference) => {
    setThemePreference(preference);
  };

  const handleClearOffline = async () => {
    const confirmed = window.confirm(
      "Clear all offline data? This removes cached audio, decks, and stored progress on this device.",
    );
    if (!confirmed) {
      return;
    }

    setClearStatus("running");
    setClearFeedback(null);

    try {
      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.unregister();
            } catch (error) {
              console.warn("Failed to unregister service worker", error);
            }
          }),
        );
      }

      if (typeof caches !== "undefined") {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }

      await db.delete();

      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.clear();
      }

      setClearStatus("done");
      setClearFeedback("Offline data cleared. Reloading…");
      showToast({
        message: "Offline data cleared.",
        variant: "success",
        duration: 2400,
      });

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error("Failed to clear offline data", error);
      setClearStatus("error");
      setClearFeedback(
        error instanceof Error ? error.message : "Unexpected error clearing offline data.",
      );
      showToast({
        message: "Failed to clear offline data.",
        variant: "error",
      });
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      "Reset first-run data? This clears all cards and review progress on this device.",
    );

    if (!confirmed) {
      return;
    }

    setResetStatus("running");
    setFeedback(null);

    try {
      await resetFirstRun();
      setResetStatus("done");
      setFeedback("Data cleared. Reload to trigger the bootstrap importer.");
      showToast({
        message: "Session reset. Reload to run bootstrap.",
        variant: "success",
        duration: 3200,
      });
    } catch (error) {
      console.error("Failed to reset", error);
      setResetStatus("error");
      setFeedback(
        error instanceof Error ? error.message : "Unexpected error occurred.",
      );
      showToast({
        message: "Failed to reset first-run state.",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">
          Placeholder settings screen for future configuration.
        </p>
      </header>
      <section className="card space-y-3 p-4 text-sm text-slate-300">
        <div className="space-y-1 text-slate-200">
          <h2 className="text-lg font-semibold">Updates</h2>
          <p className="text-xs text-slate-400">
            Stay current with the latest fixes and polish.
          </p>
        </div>
        <p className="text-xs text-slate-400">{buildVersionLabel}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void checkForUpdates()}
            disabled={checkingForUpdate}
            className="btn-primary px-4 py-2 text-sm"
          >
            {checkingForUpdate ? "Checking..." : "Check for updates"}
          </button>
          {updateAvailable ? (
            <span className="text-xs text-emerald-300">
              Update ready — tap “Reload” in the banner above.
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Latest version is already installed.
            </span>
          )}
        </div>
      </section>
      <section className="card space-y-3 p-4 text-sm">
        <div className="space-y-1 text-slate-200">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-xs text-slate-400">
            Choose the color theme. Currently using <span className="font-medium">{resolvedTheme}</span>{" "}
            mode.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {(["system", "dark", "light"] as ThemePreference[]).map((option) => (
            <label
              key={option}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-200"
            >
              <span className="capitalize">{option}</span>
              <input
                type="radio"
                name="theme"
                value={option}
                checked={themePreference === option}
                onChange={() => handleThemeSelect(option)}
                aria-label={`Use ${option} theme`}
              />
            </label>
          ))}
        </div>
      </section>
      <section className="card space-y-3 p-4 text-sm">
        <div className="space-y-1 text-slate-200">
          <h2 className="text-lg font-semibold">Offline data</h2>
          <p className="text-xs text-slate-400">
            Remove cached audio, decks, and stored progress to reclaim space or troubleshoot syncing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleClearOffline()}
          disabled={clearStatus === "running"}
          className="btn-secondary px-4 py-2 text-sm"
        >
          {clearStatus === "running" ? "Clearing..." : "Clear offline data & caches"}
        </button>
        {clearFeedback ? (
          <p className="text-xs text-slate-400">{clearFeedback}</p>
        ) : null}
      </section>
      <div className="card space-y-3 p-4 text-sm">
        <div className="space-y-1 text-slate-200">
          <h2 className="text-lg font-semibold">Developer utilities</h2>
          <p className="text-xs text-slate-400">
            Reset the first-run flag and wipe Dexie data for quick testing.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetStatus === "running"}
          className="btn-secondary"
        >
          {resetStatus === "running"
            ? "Resetting..."
            : "Reset first-run & wipe data"}
        </button>
        {feedback ? (
          <p className="text-xs text-slate-400">{feedback}</p>
        ) : null}
      </div>
    </div>
  );
}

export default SettingsPage;
