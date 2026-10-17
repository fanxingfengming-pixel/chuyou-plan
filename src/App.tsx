import { isRouteReady } from "./planning/routeEngine";
import { TravelMemo } from "./planning/components/TravelMemo";
import { FeedbackToast } from "./planning/components/Common";
import { prefetchKnownArea } from "./planning/services";
import { ServiceStatusProvider } from "./planning/ServiceStatusProvider";
import { ServiceStatus } from "./planning/components/ServiceStatus";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { Router, useRouter } from "./planning/router";
import { TripDraftProvider, useTripDraft } from "./planning/TripDraftProvider";
import { validateDetails } from "./planning/model";
import { PlanningProgress, TripSummary } from "./planning/components/Common";
import {
  ModeSelector,
  TransportSelector,
  TripDetailsForm,
} from "./planning/components/SetupPages";
import {
  AreaRecommendations,
  HotelBrandPreference,
} from "./planning/components/LocationPages";
import {
  HotelCompare,
  HotelFilters,
  HotelResults,
} from "./planning/components/HotelPages";
import {
  LocalTransportSelector,
  PlacesPage,
  RoutePlanner,
} from "./planning/components/ItineraryPages";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
const routes: Record<
  string,
  { title: string; description: string; page: ReactNode }
> = {
  "/plan/details": {
    title: "把想法，变成出发。",
    description: "先核对旅行信息，剩下的我们一步步来。",
    page: <TripDetailsForm />,
  },
  "/plan/mode": {
    title: "从哪里，找到落脚点？",
    description: "两种开始方式，按你习惯的节奏选择。",
    page: <ModeSelector />,
  },
  "/plan/transport": {
    title: "先想好，怎样抵达。",
    description: "比较城际交通，再继续选择目的地的住宿。",
    page: <TransportSelector />,
  },
  "/plan/area": {
    title: "找到想靠近的生活。",
    description: "最多选择三个位置，并指定一个核心地点。",
    page: <AreaRecommendations />,
  },
  "/plan/hotel-preference": {
    title: "从熟悉的品牌开始。",
    description: "有偏好，就告诉我们；没有，也很好。",
    page: <HotelBrandPreference />,
  },
  "/plan/hotels": {
    title: "把在意的条件，留下。",
    description: "价格、位置与住宿品质，在你觉得舒服的范围里。",
    page: <HotelFilters />,
  },
  "/plan/results": {
    title: "找到适合你的那一间。",
    description: "先比较，再决定。只有你的确认才会选定酒店。",
    page: <HotelResults />,
  },
  "/plan/compare": {
    title: "看清差别，再作决定。",
    description: "最多三家，把真正影响选择的细节放在一起。",
    page: <HotelCompare />,
  },
  "/plan/places": {
    title: "追随好奇，去你想去的。",
    description: "搜索你已经心动的地方，需要灵感时再让我们推荐。",
    page: <PlacesPage />,
  },
  "/plan/local-transport": {
    title: "在城市里，怎么走？",
    description: "酒店与景点已确定，选一种舒服的市内出行方式。",
    page: <LocalTransportSelector />,
  },
  "/plan/memo": {
    title: "你的旅行，收在这一页。",
    description: "酒店、每日路线与重要备忘，随时查看。",
    page: <TravelMemo />,
  },
  "/plan/route": {
    title: "少一点赶路，多一点感受。",
    description: "从酒店出发，把喜欢的地方连成自己的旅程。",
    page: <RoutePlanner />,
  },
};
function Experience() {
  const { path, navigate, direction } = useRouter(),
    { draft, patch, storageError } = useTripDraft(),
    root = useRef<HTMLElement>(null);
  const [redirectNotice, setRedirectNotice] = useState("");
  const noticeTarget = useRef("");
  useEffect(() => {
    if (draft.destinationCity && !validateDetails(draft))
      void prefetchKnownArea(draft.destinationCity).catch(() => {});
  }, [
    draft.destinationCity,
    draft.tripDays,
    draft.departureDate,
    draft.fuzzyDateText,
  ]);
  let redirect = "";
  if (path !== "/" && path !== "/plan/details" && validateDetails(draft))
    redirect = "/plan/details";
  else if (
    path.startsWith("/plan/") &&
    !["/plan/details", "/plan/mode"].includes(path) &&
    !draft.planningMode
  )
    redirect = "/plan/mode";
  else if (
    [
      "/plan/area",
      "/plan/hotel-preference",
      "/plan/hotels",
      "/plan/results",
      "/plan/compare",
      "/plan/places",
      "/plan/local-transport",
      "/plan/route",
      "/plan/memo",
    ].includes(path) &&
    !draft.selectedTransportMode
  )
    redirect = "/plan/transport";
  else if (path === "/plan/area" && draft.planningMode === "hotel")
    redirect = "/plan/hotel-preference";
  else if (path === "/plan/hotel-preference" && draft.planningMode === "area")
    redirect = "/plan/area";
  else if (
    ["/plan/hotels", "/plan/results", "/plan/compare"].includes(path) &&
    draft.planningMode === "area" &&
    !draft.primaryPlace
  )
    redirect = "/plan/area";
  else if (
    [
      "/plan/places",
      "/plan/local-transport",
      "/plan/route",
      "/plan/memo",
    ].includes(path) &&
    !draft.selectedHotel
  )
    redirect = "/plan/hotels";
  else if (
    ["/plan/local-transport", "/plan/route", "/plan/memo"].includes(path) &&
    !draft.tripPlaces.length &&
    !(path === "/plan/route" && draft.routeDraft)
  )
    redirect = "/plan/places";
  else if (
    ["/plan/route", "/plan/memo"].includes(path) &&
    !draft.localTransportPreference
  )
    redirect = "/plan/local-transport";
  else if (path === "/plan/memo" && !isRouteReady(draft))
    redirect = "/plan/route";
  useEffect(() => {
    if (redirect) {
      noticeTarget.current = redirect;
      const reasons: Record<string, string> = {
        "/plan/route": "请先完成高德路线核实，再查看旅行备忘录。",
        "/plan/details": "请先补齐旅行信息。",
        "/plan/mode": "请先选择住宿规划方式。",
        "/plan/transport": "请先选择城际交通方式。",
        "/plan/area": "请先选择位置并指定核心地点。",
        "/plan/hotels": "请先手动确认一家酒店。",
        "/plan/places": "请先加入想去的地点。",
        "/plan/local-transport": "请先选择市内交通方式。",
      };
      setRedirectNotice(
        reasons[redirect] || "已返回与你当前规划方式对应的步骤。",
      );
      navigate(redirect, true);
    } else if (routes[path]) {
      if (noticeTarget.current !== path) setRedirectNotice("");
      patch({ lastRoute: path });
    }
  }, [path, redirect, patch]);
  useEffect(() => {
    document.title =
      path === "/"
        ? "出游plan · 让旅行更从容"
        : (routes[path]?.title || "未找到页面") + " · 出游plan";
  }, [path]);
  useLayoutEffect(() => {
    if (path === "/" || !root.current) return;
    root.current
      .querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const compact = window.matchMedia("(max-width: 650px)").matches;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".wizard-content",
        {
          clipPath: compact
            ? "inset(0 0 0 0)"
            : "polygon(0% 0%, 100% 0%, 100% 82%, 88% 100%, 0% 100%)",
          x: direction === "back" ? -10 : 10,
          opacity: 0.9,
        },
        {
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 100%)",
          x: 0,
          opacity: 1,
          duration: compact ? 0.28 : 0.48,
          ease: "expo.out",
          clearProps: "clipPath,transform,opacity",
        },
      );
      if (!compact)
        gsap.fromTo(
          ".wizard-page-curl",
          { scale: 1, opacity: 0.8, rotation: direction === "back" ? 12 : -12 },
          {
            scale: 0,
            opacity: 0,
            rotation: 0,
            duration: 0.48,
            ease: "expo.out",
          },
        );
    }, root);
    return () => ctx.revert();
  }, [path, direction]);
  const route = routes[path];
  return (
    <>
      <a href="#main" className="skip-link">
        跳至主要内容
      </a>
      <Navbar />
      <FeedbackToast />
      {path === "/" ? (
        <main id="main">
          <Hero />
        </main>
      ) : (
        <main ref={root} id="main" className="planning-page page-width">
          <PlanningProgress />
          <TripSummary />
          {redirectNotice && (
            <div className="route-notice" role="alert">
              {redirectNotice}
              <button
                onClick={() => setRedirectNotice("")}
                aria-label="关闭步骤提醒"
              >
                知道了
              </button>
            </div>
          )}
          {route ? (
            <div key={path} className="wizard-content">
              <div
                className={
                  "wizard-page-curl " + (direction === "back" ? "back" : "")
                }
                aria-hidden="true"
              />
              <header className="wizard-heading">
                <h1 tabIndex={-1}>{route.title}</h1>
                <p>{route.description}</p>
              </header>
              {!redirect && route.page}
            </div>
          ) : (
            <div className="search-recovery">
              <h1>这个页面还没有抵达。</h1>
              <a className="button-primary" href="/">
                返回首页
              </a>
            </div>
          )}
        </main>
      )}
      <footer className="product-footer page-width">
        <span>出游plan · 让旅行回到你的节奏</span>
        <ServiceStatus />
        {storageError && <p role="alert">{storageError}</p>}
      </footer>
    </>
  );
}
export default function App() {
  return (
    <ServiceStatusProvider>
      <Router>
        <TripDraftProvider>
          <Experience />
        </TripDraftProvider>
      </Router>
    </ServiceStatusProvider>
  );
}
