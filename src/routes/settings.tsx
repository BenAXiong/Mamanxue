import { useState } from "react";
import { resetFirstRun } from "../db/bootstrap";
import { useTaskSignal } from "../store/taskSignal";

export function SettingsPage() {
  const [resetStatus, setResetStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const startTaskSignal = useTaskSignal((state) => state.startTask);
  const completeTaskSignal = useTaskSignal((state) => state.completeTask);
  const resetTaskSignal = useTaskSignal((state) => state.resetSignal);
  const taskStatus = useTaskSignal((state) => state.status);

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
    } catch (error) {
      console.error("Failed to reset", error);
      setResetStatus("error");
      setFeedback(
        error instanceof Error ? error.message : "Unexpected error occurred.",
      );
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
      <div className="card space-y-3 p-4 text-sm text-slate-300">
        <p>More customization options coming soon.</p>
      </div>
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
      <div className="card space-y-3 p-4 text-sm">
        <div className="space-y-1 text-slate-200">
          <h2 className="text-lg font-semibold">Header task signal demo</h2>
          <p className="text-xs text-slate-400">
            Use these buttons to preview the task color signal in the logo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={startTaskSignal} className="btn-secondary">
            Start task (red)
          </button>
          <button type="button" onClick={completeTaskSignal} className="btn-primary">
            Complete task (green)
          </button>
          <button type="button" onClick={resetTaskSignal} className="btn-secondary">
            Reset
          </button>
        </div>
        <p className="text-xs text-slate-500">Current signal: {taskStatus}</p>
      </div>
    </div>
  );
}

export default SettingsPage;
