import { QueryProgress } from "./QueryProgress";
import { isLiveMode } from "../services";
import { safeMediaUrl } from "../contracts";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { useRouter } from "../router";
import type { Place } from "../types";
export function Action({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="button-primary"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <ArrowRight size={18} />
    </button>
  );
}
export function PageFooter({
  back,
  nextLabel,
  onNext,
  disabled = false,
  blockedReason = "",
  focusTarget,
}: {
  back: string;
  blockedReason?: string;
  focusTarget?: string;
  nextLabel: string;
  onNext: () => void;
  disabled?: boolean;
}) {
  const [attempted, setAttempted] = useState(false);
  const next = () => {
    if (blockedReason) {
      setAttempted(true);
      const element = document.querySelector<HTMLElement>(
        focusTarget || ".wizard-content input, .wizard-content button",
      );
      element?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      if (element) {
        if (!element.hasAttribute("tabindex"))
          element.setAttribute("tabindex", "-1");
        element.focus({ preventScroll: true });
      }
      return;
    }
    onNext();
  };
  return (
    <div className="wizard-footer">
      {blockedReason && (
        <p
          className={"step-blocker " + (attempted ? "is-error" : "")}
          role={attempted ? "alert" : "status"}
        >
          {blockedReason}
        </p>
      )}
      <a href={back} className="text-link">
        <ArrowLeft size={17} />
        上一步
      </a>
      <Action onClick={next} disabled={disabled}>
        {nextLabel}
      </Action>
    </div>
  );
}
export function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={error ? "form-message is-error" : "form-message"}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
export function PlanningProgress() {
  const { draft } = useTripDraft(),
    { path } = useRouter(),
    progressNav = useRef<HTMLElement>(null);
  const stages = [
    ["旅行信息", "/plan/details"],
    ["住宿方式", "/plan/mode"],
    ["城际交通", "/plan/transport"],
    [
      draft.planningMode === "hotel" ? "品牌偏好" : "住宿区域",
      draft.planningMode === "hotel" ? "/plan/hotel-preference" : "/plan/area",
    ],
    ["酒店筛选", "/plan/hotels"],
    ["选择酒店", "/plan/results"],
    ["选择景点", "/plan/places"],
    ["市内交通", "/plan/local-transport"],
    ["安排行程", "/plan/route"],
    ["旅行备忘录", "/plan/memo"],
  ];
  const index =
    path === "/plan/compare" ? 5 : stages.findIndex((s) => s[1] === path);
  useLayoutEffect(() => {
    const nav = progressNav.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    const bounds = nav.getBoundingClientRect();
    const active = current.getBoundingClientRect();
    nav.scrollLeft +=
      active.left - bounds.left - (nav.clientWidth - active.width) / 2;
  }, [path, index]);
  return (
    <nav ref={progressNav} className="planning-progress" aria-label="规划进度">
      {stages.map(([label, href], i) => (
        <a
          key={href}
          href={href}
          aria-current={i === index ? "step" : undefined}
          className={i < index ? "passed" : ""}
        >
          <span>{String(i + 1).padStart(2, "0")}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}
export function ResetControl() {
  const { reset } = useTripDraft(),
    { navigate } = useRouter(),
    dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="reset-button"
        onClick={() => dialog.current?.showModal()}
      >
        <RotateCcw size={15} />
        全部重置
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">重新开始这趟旅行？</h2>
        <p>这会清除本机保存的所有规划信息，包括已选酒店、景点和路线。</p>
        <div className="inline-actions">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            className="secondary-button"
          >
            保留草稿
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              dialog.current?.close();
              reset();
              navigate("/");
            }}
          >
            确认全部重置
          </button>
        </div>
      </dialog>
    </>
  );
}
export function TripSummary() {
  const { draft } = useTripDraft();
  return (
    <aside className="trip-summary">
      <span>
        {draft.originCity || "待补充"}
        <ArrowRight size={14} />
        {draft.destinationCity || "待补充"}
      </span>
      <span>
        {draft.dateMode === "fuzzy" ? draft.fuzzyDateText : draft.departureDate}{" "}
        · {draft.tripDays || "—"} 天 · {draft.adults} 成人
        {draft.children > 0 ? " · " + draft.children + " 儿童" : ""}
      </span>
      <a href="/plan/details">修改信息</a>
    </aside>
  );
}
export function Media({
  place,
  hotelImage,
  name,
  hotelSource,
  imageSource,
  imageFallback,
}: {
  place?: Place;
  hotelImage?: string;
  name?: string;
  hotelSource?: "mock" | "live";
  imageSource?: string;
  imageFallback?: boolean;
}) {
  const fallback = "/images/fallback-landscape.webp";
  const [failed, setFailed] = useState(false);
  const preferred = safeMediaUrl(hotelImage || place?.image);
  useEffect(() => setFailed(false), [preferred]);
  const generic = failed || !preferred || imageFallback || place?.imageFallback;
  const src = generic ? fallback : preferred;
  const title = name || place?.name || "旅行地点";
  const caption = generic
    ? "通用风景示意图 · 非实景"
    : imageSource ||
      place?.imageSource ||
      (hotelSource === "live" ? "飞猪供应方图片" : "氛围示意图 · 非实景");
  return (
    <div className={"planning-media " + (hotelImage ? "hotel-media" : "")}>
      <img
        src={src}
        alt={
          generic
            ? title + " · 通用风景示意图，非实拍"
            : title + " · " + caption
        }
        loading="eager"
        decoding="async"
        onError={() => {
          if (!failed) setFailed(true);
        }}
      />
      <span className="image-caption">{caption}</span>
      {place &&
        "imageCredit" in place &&
        (() => {
          const credit = place.imageCredit as {
            source?: string;
            license?: string;
          };
          return credit.source?.startsWith("https://commons.wikimedia.org/") ? (
            <a
              className="image-credit"
              href={credit.source}
              target="_blank"
              rel="noreferrer"
            >
              照片署名与许可
            </a>
          ) : null;
        })()}
    </div>
  );
}

export function SearchLoading() {
  return (
    <div className="search-loading">
      <QueryProgress
        operation="flyai/search-hotels"
        label="正在查询酒店并准备候选"
      />
      <p>
        {isLiveMode
          ? "正在等待真实查询返回，请稍候。"
          : "正在读取本地模拟目录。"}
      </p>
    </div>
  );
}

export function FeedbackToast() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      setMessage(String((event as CustomEvent).detail || ""));
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 2300);
    };
    window.addEventListener("travel-feedback", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("travel-feedback", show);
    };
  }, []);
  return (
    <div
      className={"feedback-toast " + (message ? "is-visible" : "")}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
