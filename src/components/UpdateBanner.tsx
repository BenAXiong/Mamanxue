import { useServiceWorker } from "../pwa/ServiceWorkerProvider";

export function UpdateBanner() {
  const { updateAvailable, promptUpdate, checkingForUpdate } = useServiceWorker();

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="font-semibold text-white">Update available</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={promptUpdate}
          className="btn-primary px-3 py-1 text-sm"
        >
          Reload
        </button>
        {checkingForUpdate ? (
          <span className="text-xs text-secondary">Preparing update…</span>
        ) : null}
      </div>
    </div>
  );
}

export default UpdateBanner;
