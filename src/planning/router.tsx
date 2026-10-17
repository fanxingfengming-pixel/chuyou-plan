import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
const RouterContext = createContext<{
  path: string;
  direction: "forward" | "back";
  navigate: (path: string, replace?: boolean) => void;
} | null>(null);
export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const currentPath = useRef(path);
  currentPath.current = path;
  const rank = (value: string) =>
    [
      "/",
      "/plan/details",
      "/plan/mode",
      "/plan/transport",
      "/plan/area",
      "/plan/hotels",
      "/plan/results",
      "/plan/places",
      "/plan/local-transport",
      "/plan/route",
      "/plan/memo",
    ].indexOf(
      value
        .replace("/plan/hotel-preference", "/plan/area")
        .replace("/plan/compare", "/plan/results"),
    );
  const navigate = (next: string, replace = false) => {
    if (!next.startsWith("/") || next.startsWith("//")) return;
    setDirection(rank(next) < rank(currentPath.current) ? "back" : "forward");
    window.history[replace ? "replaceState" : "pushState"]({}, "", next);
    setPath(next);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const pop = () => {
      setDirection(
        rank(window.location.pathname) < rank(currentPath.current)
          ? "back"
          : "forward",
      );
      setPath(window.location.pathname);
      window.scrollTo(0, 0);
    };
    const click = (event: MouseEvent) => {
      const a = (event.target as Element).closest("a");
      if (
        !a ||
        event.defaultPrevented ||
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        a.target ||
        a.hasAttribute("download")
      )
        return;
      const url = new URL(a.href);
      if (url.origin === window.location.origin && !url.hash) {
        event.preventDefault();
        navigate(url.pathname);
      }
    };
    window.addEventListener("popstate", pop);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("popstate", pop);
      document.removeEventListener("click", click);
    };
  }, []);
  return (
    <RouterContext.Provider value={{ path, navigate, direction }}>
      {children}
    </RouterContext.Provider>
  );
}
export function useRouter() {
  const value = useContext(RouterContext);
  if (!value) throw new Error("Router missing");
  return value;
}
