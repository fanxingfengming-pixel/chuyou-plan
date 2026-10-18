import { Check } from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { useRouter } from "../router";
import { isRouteReady, routeNumbers, legLabel } from "../routeEngine";
import { TripPdfExport } from "./TripPdfExport";
import { RouteMap } from "./RouteMap";
import { Message } from "./Common";
export function TravelMemo() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter(),
    route = draft.routeDraft,
    numbers = routeNumbers(route);
  if (!route || !isRouteReady(draft))
    return (
      <Message>
        请先完成路线计算。
        <button className="text-button" onClick={() => navigate("/plan/route")}>
          返回路线
        </button>
      </Message>
    );
  const dates =
    draft.dateMode === "fuzzy"
      ? draft.fuzzyDateText
      : draft.dateMode === "range"
        ? draft.departureDate + " 至 " + draft.returnDate + "（可出行范围）"
        : draft.departureDate +
          (draft.returnDate ? " 至 " + draft.returnDate : " 出发");
  return (
    <section className="travel-memo">
      <div className="memo-actions">
        <button
          className="secondary-button"
          onClick={() => navigate("/plan/route")}
        >
          返回编辑
        </button>
        <TripPdfExport draft={draft} compact />
        <button
          className="button-primary"
          onClick={() => {
            patch({ memoCompletedAt: new Date().toISOString() });
            window.dispatchEvent(
              new CustomEvent("travel-feedback", {
                detail: "规划已完成，备忘录保存在本机。",
              }),
            );
          }}
        >
          <Check size={17} />
          {draft.memoCompletedAt ? "已完成" : "完成 ✓"}
        </button>
      </div>
      <header className="memo-summary">
        <h2>{draft.destinationCity} · 旅行备忘录</h2>
        <p>
          {dates} · {draft.tripDays} 天 · {draft.adults} 位成人
          {draft.children ? " · " + draft.children + "位儿童" : ""}
        </p>
        <p>
          <strong>H · {draft.selectedHotel?.name}</strong> ·{" "}
          {route.hotelAnchor?.address || draft.selectedHotel?.district}
        </p>
        <p className="quiet-copy">
          {draft.memoCompletedAt
            ? "规划已完成 · 本机保存"
            : route.hotelAnchor?.source === "mock" ? "模拟路线 · 不可用于实际出行" : "路线已核实 · 每天最后返回酒店"}{" "}
          · 路线查询于{" "}
          {new Date(route.generatedAt).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
            hour12: false,
          })}
        </p>
      </header>
      <div className="memo-layout">
        <div className="memo-days">
          {route.days.map((day) => (
            <section className="memo-day" key={day.day}>
              <h3>第 {day.day} 天</h3>
              <p>H 酒店出发</p>
              <ol>
                {day.stops.map((s) => (
                  <li key={s.id}>
                    {s.kind === "place" && <b>{numbers[s.placeId!]}</b>}
                    <span>
                      {s.period} · {s.name}
                    </span>
                  </li>
                ))}
              </ol>
              {!day.stops.some((s) => s.kind === "place") && (
                <p>酒店休整 / 自由安排</p>
              )}
              <div className="memo-transports">
                {day.legs?.map((l) => (
                  <p key={l.id}>
                    <span>
                      {l.from.id === route.hotelAnchor?.id
                        ? "H"
                        : numbers[l.from.id]}{" "}
                      →{" "}
                      {l.to.id === route.hotelAnchor?.id
                        ? "H"
                        : numbers[l.to.id]}
                    </span>
                    {legLabel(l)}
                    {l.mode === "transit" && l.instructions.length > 0 && (
                      <small>{l.instructions.join(" → ")}</small>
                    )}
                  </p>
                ))}
              </div>
              <p>H 返回酒店</p>
            </section>
          ))}
          <section className="memo-packing">
            <h3>携带与重要备忘</h3>
            <p>
              {draft.packingItems.length
                ? "已备好 " +
                  draft.packingItems.filter((p) => p.packed).length +
                  " / " +
                  draft.packingItems.length +
                  " 项"
                : "暂未添加携带清单，可返回编辑补充。"}
            </p>
            <ul>
              {draft.packingItems.map((p) => (
                <li key={p.id}>
                  {p.packed ? "已备好" : "待准备"} · {p.name}
                  {p.note ? " — " + p.note : ""}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <RouteMap route={route} />
      </div>
      <p className="quiet-copy">
        住宿和交通选择不代表预订；价格、开放与预约要求请出发前核对。驾车耗时不含叫车等待。
      </p>
    </section>
  );
}
