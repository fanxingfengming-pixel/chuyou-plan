import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getHotelCapabilities,
  getServiceHealth,
  isLiveMode,
} from "./serviceClient";
import {
  ServiceStatusContext,
  type ServiceStatusValue,
} from "./serviceStatusContext";
import type { HotelCapabilities } from "./types";
export function ServiceStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServiceStatusValue["state"]>(
    isLiveMode ? "checking" : "mock",
  );
  const [capabilities, setCapabilities] = useState<HotelCapabilities | null>(
    null,
  );
  const current = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    if (!isLiveMode) {
      setCapabilities(await getHotelCapabilities());
      return;
    }
    const results = await Promise.allSettled([
      getServiceHealth(controller.signal),
      getHotelCapabilities(controller.signal),
    ]);
    if (controller.signal.aborted) return;
    setState(results[0].status === "fulfilled" ? "online" : "offline");
    setCapabilities(
      results[1].status === "fulfilled" ? results[1].value : null,
    );
  }, []);
  useEffect(() => {
    void check();
    const visible = () => {
      if (document.visibilityState !== "hidden") void check();
    };
    const unavailable = () => setState("offline");
    window.addEventListener("focus", visible);
    window.addEventListener("travel-service-unreachable", unavailable);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 15000);
    return () => {
      current.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("travel-service-unreachable", unavailable);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [check]);
  return (
    <ServiceStatusContext.Provider value={{ state, capabilities, check }}>
      {children}
    </ServiceStatusContext.Provider>
  );
}
