import { useRef, useState } from "react";
import { ArrowDown, Navigation, Pause, Play } from "lucide-react";
import { useOpening } from "../animations/useAnimations";
import { PlanningCommandBar as CommandBar } from "../planning/components/SetupPages";
export default function Hero() {
  const root = useRef<HTMLElement>(null),
    [complete, setComplete] = useState(false),
    [skip, setSkip] = useState(false),
    [paused, setPaused] = useState(false);
  useOpening(root, () => setComplete(true), skip);
  return (
    <section
      ref={root}
      className={`hero ${paused ? "motion-paused" : ""}`}
      id="home"
      aria-label="智能旅行助手首页"
    >
      <span id="hero-top" className="hero-top" />
      {!complete && (
        <div className="opening">
          <div className="opening-word-mask">
            <div className="opening-word">
              <Navigation size={38} />
              <span>出游plan</span>
            </div>
          </div>
          <button
            onClick={() => {
              setSkip(true);
              setComplete(true);
            }}
          >
            跳过开场
            <ArrowDown size={14} />
          </button>
        </div>
      )}
      <div className="hero-visual" aria-hidden="true">
        <img
          src="/images/mode-area-warm.webp"
          alt=""
          fetchPriority="high"
          width="1920"
          height="1080"
        />
        <div className="hero-shade" />
      </div>
      <div className="hero-content page-width">
        <h1>
          <span className="hero-line-mask">
            <span className="hero-title-line">向往的远方，</span>
          </span>
          <span className="hero-line-mask">
            <span className="hero-title-line">让智能为你规划。</span>
          </span>
        </h1>
        <p className="hero-subtitle hero-enter">
          去向往的远方。<span>把旅行的复杂，留给智能助手。</span>
        </p>
        <div className="hero-command hero-enter">
          <CommandBar id="hero-command" />
        </div>
      </div>
      <div className="hero-bottom page-width hero-enter">
        <a href="/plan/details" className="hero-discover">
          让旅行，回到你的节奏。
          <ArrowDown size={17} />
        </a>
        <div className="hero-location">
          <span>AI城市氛围示意图 · 非实景</span>
        </div>
        <button
          className="motion-control"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "播放动态背景" : "暂停动态背景"}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          <span>{paused ? "播放动态" : "暂停动态"}</span>
        </button>
      </div>
    </section>
  );
}
