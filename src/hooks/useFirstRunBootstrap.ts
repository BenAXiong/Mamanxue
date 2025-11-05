import { useEffect, useState } from "react";
import type { BootstrapResult } from "../db/bootstrap";
import { firstRunBootstrap } from "../db/bootstrap";

type BootstrapState = "idle" | "running" | "done" | "error";

interface UseBootstrapReturn {
  state: BootstrapState;
  result: BootstrapResult | null;
}

export function useFirstRunBootstrap(): UseBootstrapReturn {
  const [state, setState] = useState<BootstrapState>("idle");
  const [result, setResult] = useState<BootstrapResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setState("running");
      try {
        const bootstrapResult = await firstRunBootstrap();
        if (!cancelled) {
          setResult(bootstrapResult);
          setState("done");
        }
      } catch (error) {
        console.error("Bootstrap failed", error);
        if (!cancelled) {
          setResult(null);
          setState("error");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { state, result };
}
