import { useState } from "react";
import { ArrowUpRight, Menu, Navigation, X } from "lucide-react";
import { useTripDraft } from "../planning/TripDraftProvider";
import { useRouter } from "../planning/router";
export default function Navbar() {
  const { draft } = useTripDraft(),
    { path } = useRouter(),
    [menu, setMenu] = useState(false);
  return (
    <nav
      className={"navbar v2-navbar " + (path !== "/" ? "is-scrolled" : "")}
      aria-label="主导航"
    >
      <a href="/" className="brand" aria-label="出游plan 首页">
        <Navigation size={26} fill="currentColor" strokeWidth={1.4} />
        <strong>
          出游<span>plan</span>
        </strong>
        <span className="brand-divider" />
        <span className="brand-descriptor">智能旅行助手</span>
      </a>
      <div className="nav-links">
        <a href="/plan/details">旅行信息</a>
        <a href="/plan/hotels">选择住宿</a>
        <a href="/plan/route">安排行程</a>
      </div>
      <div className="nav-actions">
        <a
          className="nav-cta"
          href={draft.lastUpdatedAt ? draft.lastRoute : "/plan/details"}
        >
          {draft.lastUpdatedAt ? "继续规划" : "开始规划"}
          <ArrowUpRight size={16} />
        </a>
        <button
          className="menu-toggle"
          aria-label={menu ? "关闭菜单" : "打开菜单"}
          aria-expanded={menu}
          aria-controls="mobile-menu"
          onClick={() => setMenu(!menu)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(false);
          }}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </div>
      {menu && (
        <div className="mobile-menu" id="mobile-menu">
          {[
            ["旅行信息", "/plan/details"],
            ["选择住宿", "/plan/hotels"],
            ["安排行程", "/plan/route"],
          ].map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
              <ArrowUpRight size={20} />
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
