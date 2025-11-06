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

type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface Toast extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => 0,
  dismissToast: () => {},
});

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    const timeout = timers.current.get(id);
    if (timeout !== undefined && typeof window !== "undefined") {
      window.clearTimeout(timeout);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = ++idCounter.current;
      const duration = options.duration ?? 5000;
      const toast: Toast = {
        id,
        variant: options.variant ?? "info",
        message: options.message,
        duration,
      };
      setToasts((previous) => [...previous, toast]);

      if (duration > 0 && duration !== Infinity && typeof window !== "undefined") {
        const timeout = window.setTimeout(() => {
          dismissToast(id);
        }, duration);
        timers.current.set(id, timeout);
      }

      return id;
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }
      timers.current.forEach((timeout) => window.clearTimeout(timeout));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => {
          const role = toast.variant === "error" || toast.variant === "warning" ? "alert" : "status";
          return (
            <div key={toast.id} className={`toast toast-${toast.variant}`} role={role}>
              <span>{toast.message}</span>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
