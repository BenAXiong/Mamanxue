/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Workbox } from "workbox-window";
import { useToast } from "../components/ToastProvider";

export interface BuildInfo {
  version: string;
  timestamp: string;
  channel?: string;
}

interface ServiceWorkerContextValue {
  isSupported: boolean;
  isOnline: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  checkingForUpdate: boolean;
  promptUpdate: () => void;
  checkForUpdates: () => Promise<void>;
  buildInfo: BuildInfo | null;
  buildInfoError: string | null;
  refreshBuildInfo: () => Promise<void>;
}

const defaultValue: ServiceWorkerContextValue = {
  isSupported: false,
  isOnline: true,
  registration: null,
  updateAvailable: false,
  checkingForUpdate: false,
  promptUpdate: () => {},
  checkForUpdates: async () => {},
  buildInfo: null,
  buildInfoError: null,
  refreshBuildInfo: async () => {},
};

const ServiceWorkerContext = createContext<ServiceWorkerContextValue>(defaultValue);

async function fetchBuildInfo(): Promise<BuildInfo> {
  const response = await fetch("/build.json", {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Build info request failed with ${response.status}`);
  }

  return (await response.json()) as BuildInfo;
}

export function ServiceWorkerProvider({ children }: PropsWithChildren) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [buildInfoError, setBuildInfoError] = useState<string | null>(null);
  const workboxRef = useRef<Workbox | null>(null);
  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator;
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const markOnline = () => {
      setIsOnline(true);
    };
    const markOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);

    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    if (!isSupported || !import.meta.env.PROD || workboxRef.current) {
      return;
    }

    const wb = new Workbox("/sw.js", {
      scope: "/",
    });
    workboxRef.current = wb;

    wb.addEventListener("waiting", () => {
      setUpdateAvailable(true);
    });

    wb.addEventListener("installed", (event) => {
      if (event.isUpdate) {
        setUpdateAvailable(true);
      }
    });

    wb.addEventListener("controlling", () => {
      window.location.reload();
    });

    wb.register()
      .then((reg) => {
        if (!reg) {
          return;
        }
        setRegistration(reg);
        if (reg.waiting) {
          setUpdateAvailable(true);
        }
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
        showToast({
          message: "Service worker registration failed. Offline features may be limited.",
          variant: "error",
        });
      });
  }, [isSupported, showToast]);

  const promptUpdate = useCallback(() => {
    const wb = workboxRef.current;
    if (!wb) {
      return;
    }
    setUpdateAvailable(false);
    wb.messageSkipWaiting();
  }, []);

  const checkForUpdates = useCallback(async () => {
    const wb = workboxRef.current;
    if (!wb) {
      return;
    }
    setCheckingForUpdate(true);
    try {
      await wb.update();
    } catch (error) {
      console.error("Manual update check failed", error);
      showToast({
        message: "Update check failed. Please retry later.",
        variant: "warning",
      });
    } finally {
      setCheckingForUpdate(false);
    }
  }, [showToast]);

  const refreshBuildInfo = useCallback(async () => {
    try {
      const info = await fetchBuildInfo();
      setBuildInfo(info);
      setBuildInfoError(null);
    } catch (error) {
      console.error("Unable to load build info", error);
      setBuildInfo(null);
      setBuildInfoError(
        error instanceof Error ? error.message : "Unknown build info error.",
      );
      showToast({
        message: "Unable to load build information.",
        variant: "warning",
      });
    }
  }, [showToast]);

  useEffect(() => {
    void refreshBuildInfo();
  }, [refreshBuildInfo]);

  const value = useMemo<ServiceWorkerContextValue>(
    () => ({
      isSupported,
      isOnline,
      registration,
      updateAvailable,
      checkingForUpdate,
      promptUpdate,
      checkForUpdates,
      buildInfo,
      buildInfoError,
      refreshBuildInfo,
    }),
    [
      isSupported,
      isOnline,
      registration,
      updateAvailable,
      checkingForUpdate,
      promptUpdate,
      checkForUpdates,
      buildInfo,
      buildInfoError,
      refreshBuildInfo,
    ],
  );

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

export function useServiceWorker() {
  return useContext(ServiceWorkerContext);
}
