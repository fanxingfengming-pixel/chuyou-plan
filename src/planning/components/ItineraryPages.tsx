import { PackingList } from "./PackingList";
import { ensureCorePlace } from "../model";
import { calculateRealRoute } from "../services";
import { serviceErrorMessage } from "../serviceClient";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Sparkles,
  X,
  Pencil,
  Plus,
} from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { useRouter } from "../router";
import { distanceKm, recommendTripPlaces } from "../services";
import {
  generateRoute,
  moveStop,
  invalidateRoute,
  routeSignature,
  routeNumbers,
  isRouteReady,
  legLabel,
} from "../routeEngine";
import type { Place } from "../types";
import { Action, Message, PageFooter } from "./Common";
import { PlaceCard, PlaceSearch } from "./LocationPages";
import { RouteMap } from "./RouteMap";
import { QueryProgress } from "./QueryProgress";
export function PlacesPage() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter(),
    [recommended, setRecommended] = useState<Place[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const addition = ensureCorePlace(draft);
    if (addition) patch(addition);
  }, [
    draft.primaryPlace?.id,
    draft.tripPlaces,
    draft.corePlaceDecisions,
    patch,
  ]);
  const choose = (p: Place) =>
    patch((previous) => ({
      tripPlaces: previous.tripPlaces.some((x) => x.id === p.id)
        ? previous.tripPlaces.filter((x) => x.id !== p.id)
        : [...previous.tripPlaces, p],
    }));
  const recommend = async () => {
    setBusy(true);
    setMessage("");
    try {
      const places = await recommendTripPlaces(draft);
      setRecommended(places);
      if (!places.length) setMessage("没有更多已核实候选，你可以继续搜索。");
    } catch (error) {
      setMessage(serviceErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="selected-hotel-line">
        <span>从这里出发</span>
        <strong>{draft.selectedHotel?.name}</strong>
        <a href="/plan/hotels">更换酒店</a>
      </div>
      <div className="places-heading">
        <h2>把想去的地方，加入行程。</h2>
        <p>先搜索你的目的地，或者在需要灵感时让我们帮你推荐。</p>
        {draft.primaryPlace && (
          <p className="quiet-copy">
            核心地点「{draft.primaryPlace.name}
            」默认加入行程，可自行移除；移除后不会自动加回。
          </p>
        )}
      </div>
      <PlaceSearch
        onChoose={choose}
        chosenIds={draft.tripPlaces.map((p) => p.id)}
      />
      <div className="recommend-invitation">
        <Sparkles size={20} />
        <p>想发现几个顺路的地方？</p>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={recommend}
        >
          {busy ? "正在推荐…" : "帮我推荐景点"}
        </button>
      </div>
      {message && <Message>{message}</Message>}
      {recommended.length > 0 && (
        <>
          <h2 className="subheading">为这趟旅行推荐 · 等你决定</h2>
          <p className="quiet-copy">
            根据酒店、核心地点、天数、原始偏好与已选景点查找候选，不会自动加入行程。
          </p>
          <div className="trip-place-grid">
            {recommended.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                onChoose={() => choose(p)}
                selected={draft.tripPlaces.some((x) => x.id === p.id)}
              />
            ))}
          </div>
        </>
      )}
      <div className="chosen-places">
        <h2>
          已加入行程 <span>{draft.tripPlaces.length}</span>
        </h2>
        {draft.tripPlaces.length > draft.tripDays * 3 && (
          <Message>
            {draft.tripDays} 天已经选择 {draft.tripPlaces.length}{" "}
            个地点，行程可能较紧凑，但仍可继续添加。
          </Message>
        )}
        {draft.tripPlaces.length ? (
          <ol>
            {draft.tripPlaces.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.type} · {p.district}
                    {draft.selectedHotel
                      ? " · 距酒店约 " +
                        (distanceKm(p, draft.selectedHotel)?.toFixed(1) ??
                          "待核实") +
                        " 公里（直线距离）"
                      : ""}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label={"移除行程" + p.name}
                  onClick={() => choose(p)}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="quiet-copy">
            还没有加入地点。推荐与搜索结果都需要你手动选择。
          </p>
        )}
      </div>
      <PageFooter
        back="/plan/results"
        nextLabel="选择市内交通"
        blockedReason={
          !draft.tripPlaces.length
            ? "请至少加入一个想去的地点，再选择市内交通。"
            : ""
        }
        focusTarget=".chosen-places"
        onNext={() => navigate("/plan/local-transport")}
      />
    </>
  );
}
export function LocalTransportSelector() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter();
  return (
    <>
      <div className="local-transport-options">
        {[
          ["公共交通", "以地铁、公交为主，按相近街区安排行程。"],
          ["打车", "减少换乘，把出行弹性留给你。"],
          ["步行 + 公共交通", "相邻地点步行，跨街区搭乘公共交通。"],
        ].map(([mode, description]) => (
          <button
            className={
              "local-choice " +
              (draft.localTransportPreference === mode ? "selected" : "")
            }
            key={mode}
            aria-pressed={draft.localTransportPreference === mode}
            onClick={() => patch({ localTransportPreference: mode })}
          >
            <h2>{mode}</h2>
            <p>{description}</p>
          </button>
        ))}
      </div>
      <Message>
        城际交通已选：
        {draft.selectedTransportMode === "rail"
          ? "高铁 / 火车"
          : draft.selectedTransportMode === "flight"
            ? "飞机"
            : "自驾"}
        。这里的选择仅用于目的地内出行。
      </Message>
      <PageFooter
        back="/plan/places"
        nextLabel="安排行程路线"
        blockedReason={
          !draft.localTransportPreference ? "请先选择一种市内交通方式。" : ""
        }
        focusTarget=".local-transport-options"
        onNext={() => navigate("/plan/route")}
      />
    </>
  );
}

export function RoutePlanner() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter();
  const [message, setMessage] = useState(""),
    [dragId, setDragId] = useState<string | null>(null),
    [editing, setEditing] = useState<number[]>([]),
    [picker, setPicker] = useState<{ day: number; replaceId?: string } | null>(
      null,
    ),
    [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    latest = useRef(draft),
    force = useRef(false);
  latest.current = draft;
  const route = draft.routeDraft,
    signature = routeSignature(draft),
    numbers = routeNumbers(route);
  const retry = () => {
    force.current = true;
    setAttempt((n) => n + 1);
  };
  useEffect(() => {
    if (!draft.routeDraft) {
      const addition = ensureCorePlace(draft);
      if (addition) patch(addition);
    }
  }, [
    draft.primaryPlace?.id,
    draft.tripPlaces,
    draft.corePlaceDecisions,
    draft.routeDraft,
    patch,
  ]);
  useEffect(() => {
    if (!route || !draft.tripPlaces.length) return;
    if (!force.current && isRouteReady(draft)) return;
    force.current = false;
    const controller = new AbortController();
    patch((previous) => ({
      routeDraft: previous.routeDraft
        ? { ...invalidateRoute(previous.routeDraft), status: "loading" }
        : null,
    }));
    setMessage("正在重新计算路线…");
    const timer = setTimeout(async () => {
      try {
        const result = await calculateRealRoute(
          latest.current,
          controller.signal,
        );
        if (
          !controller.signal.aborted &&
          routeSignature(latest.current) === signature
        ) {
          patch({ routeDraft: { ...result, querySignature: signature } });
          setMessage(
            result.status === "ready"
              ? "路线已重新计算，包含每天返回酒店。"
              : result.error || "请补齐路线信息。",
          );
        }
      } catch (e) {
        if (
          !controller.signal.aborted &&
          routeSignature(latest.current) === signature
        ) {
          patch((previous) => ({
            routeDraft: previous.routeDraft
              ? {
                  ...previous.routeDraft,
                  status: "error",
                  error: serviceErrorMessage(e),
                }
              : null,
          }));
          setMessage("");
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [signature, attempt, patch]);
  const reorder = (id: string, day: number, beforeId?: string) => {
    if (route && id !== beforeId) {
      patch({ routeDraft: moveStop(route, id, day, beforeId) });
      setMessage("顺序已保存，正在重新计算路线…");
    }
  };
  const remove = (id: string) => {
    if (!route) return;
    patch({
      tripPlaces: draft.tripPlaces.filter((p) => p.id !== id),
      routeDraft: invalidateRoute({
        ...route,
        days: route.days.map((d) => ({
          ...d,
          stops: d.stops.filter((s) => s.placeId !== id),
        })),
      }),
    });
    setMessage("地点已删除，正在重新计算路线…");
  };
  const choose = (place: Place) => {
    if (!picker || !route) return;
    if (draft.tripPlaces.some((p) => p.id === place.id)) {
      setMessage("这个地点已经在行程中。");
      return;
    }
    const replaced = picker.replaceId;
    const days = route.days.map((day) =>
      day.day !== picker.day
        ? day
        : {
            ...day,
            stops: replaced
              ? day.stops.map((s) =>
                  s.placeId === replaced
                    ? {
                        ...s,
                        id: place.id,
                        placeId: place.id,
                        name: place.name,
                      }
                    : s,
                )
              : [
                  ...day.stops,
                  {
                    id: place.id,
                    placeId: place.id,
                    name: place.name,
                    kind: "place" as const,
                    period: "下午" as const,
                  },
                ],
          },
    );
    patch({
      tripPlaces: replaced
        ? draft.tripPlaces.map((p) => (p.id === replaced ? place : p))
        : [...draft.tripPlaces, place],
      routeDraft: invalidateRoute({ ...route, days }),
    });
    setPicker(null);
    setMessage("地点已更新，正在重新计算路线…");
  };
  const pointer = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    const node = e.currentTarget;
    node.setPointerCapture(e.pointerId);
    setDragId(id);
    const end = (event: globalThis.PointerEvent) => {
      if (event.type !== "pointercancel") {
        const target = document.elementFromPoint(event.clientX, event.clientY),
          day = target?.closest<HTMLElement>("[data-route-day]"),
          stop = target?.closest<HTMLElement>("[data-route-stop]");
        if (day)
          reorder(id, Number(day.dataset.routeDay), stop?.dataset.routeStop);
      }
      setDragId(null);
      node.removeEventListener("pointerup", end);
      node.removeEventListener("pointercancel", end);
    };
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
  };
  const ready = isRouteReady(draft);
  return (
    <>
      <div className="route-context">
        <div>
          <h2>{draft.selectedHotel?.name}</h2>
          <p>每天从酒店出发，最后回到酒店。</p>
        </div>
        <p>
          {draft.localTransportPreference} · {draft.tripDays} 天 ·{" "}
          {draft.tripPlaces.length} 个地点
        </p>
      </div>
      <p className="quiet-copy">
        只安排大概时段。每段距离、交通方式与预计耗时由高德实际查询，出发前请核对运营状况；驾车耗时不含叫车等待。
      </p>
      {!route ? (
        <div className="route-start">
          <h2>喜欢的地方，现在连起来。</h2>
          <p>
            将 {draft.tripPlaces.length} 个地点安排进 {draft.tripDays} 天。
          </p>
          <Action onClick={() => dialog.current?.showModal()}>
            开始规划路线
          </Action>
        </div>
      ) : (
        <>
          <div className="route-toolbar">
            <h2>你的旅行，按自己的节奏。</h2>
            <button
              className="secondary-button"
              onClick={() => dialog.current?.showModal()}
            >
              重新生成路线
            </button>
          </div>
          {route.status === "loading" && (
            <QueryProgress
              operation="amap/route"
              label="正在获取高德实际路线"
            />
          )}
          {route.status === "needs-hotel" && (
            <section className="hotel-location-confirm">
              <Message>
                {route.error}{" "}
                <button className="text-button" onClick={retry}>
                  重新定位
                </button>{" "}
                <a href="/plan/results">返回选择酒店</a>
              </Message>
              {route.hotelChoices?.map((h) => (
                <button
                  className="secondary-button"
                  key={h.id}
                  onClick={() => {
                    if (!draft.selectedHotel) return;
                    patch({
                      selectedHotel: {
                        ...draft.selectedHotel,
                        amapPoiId: h.amapPoiId,
                        address: h.address,
                        lat: h.lat,
                        lng: h.lng,
                      },
                      routeDraft: invalidateRoute(route),
                    });
                  }}
                >
                  {h.name} · {h.district} · {h.address} · 确认此位置
                </button>
              ))}
            </section>
          )}
          {["error", "partial"].includes(route.status || "") && (
            <Message error>
              {route.error || "路线暂未完成。"}{" "}
              <button className="text-button" onClick={retry}>
                重试计算路线
              </button>
            </Message>
          )}
          {route.status === "idle" && (
            <Message>
              路线需要重新通过高德核实。
              <button className="text-button" onClick={retry}>
                重新核实
              </button>
            </Message>
          )}
          {route.hotelAnchor &&
            ["ready", "partial"].includes(route.status || "") && (
              <RouteMap route={route} />
            )}
          <div className="route-days">
            {route.days.map((day) => {
              const places = day.stops.filter((s) => s.kind === "place"),
                edit = editing.includes(day.day);
              return (
                <section
                  className="route-day"
                  key={day.day}
                  data-route-day={day.day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) reorder(dragId, day.day);
                    setDragId(null);
                  }}
                >
                  <header>
                    <h3>第 {day.day} 天</h3>
                    <button
                      className="text-button"
                      aria-expanded={edit}
                      onClick={() =>
                        setEditing((v) =>
                          v.includes(day.day)
                            ? v.filter((n) => n !== day.day)
                            : [...v, day.day],
                        )
                      }
                    >
                      <Pencil size={15} />
                      {edit ? "收起编辑" : "编辑路线"}
                    </button>
                  </header>
                  <p className="day-origin">
                    H · 早上从 {draft.selectedHotel?.name} 出发
                  </p>
                  <ol>
                    {day.stops.map((stop) => {
                      const index = places.findIndex((s) => s.id === stop.id),
                        leg = day.legs?.[index];
                      return (
                        <li
                          className={dragId === stop.id ? "dragging" : ""}
                          key={stop.id}
                          data-route-stop={stop.id}
                          draggable={edit && stop.kind === "place"}
                          onDragStart={(e) => {
                            setDragId(stop.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", stop.id);
                          }}
                          onDragEnd={() => setDragId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragId) reorder(dragId, day.day, stop.id);
                            setDragId(null);
                          }}
                        >
                          {stop.kind === "place" && (
                            <p
                              className={
                                "route-leg " +
                                (leg?.status === "error" ? "is-error" : "")
                              }
                            >
                              {leg
                                ? legLabel(leg)
                                : route.status === "loading"
                                  ? "正在获取实际路线…"
                                  : "路段待核实"}
                              {leg?.mode === "transit" &&
                                leg.instructions.length > 0 && (
                                  <small>{leg.instructions.join(" → ")}</small>
                                )}
                            </p>
                          )}
                          <div className="route-stop-main">
                            {edit && stop.kind === "place" && (
                              <button
                                className="drag-handle"
                                aria-label={"拖动" + stop.name}
                                onPointerDown={(e) => pointer(e, stop.id)}
                              >
                                <GripVertical size={18} />
                              </button>
                            )}
                            {stop.kind === "place" && (
                              <b className="stop-number">
                                {numbers[stop.placeId!]}
                              </b>
                            )}
                            <span className="stop-period">{stop.period}</span>
                            <strong>{stop.name}</strong>
                          </div>
                          {edit && stop.kind === "place" && (
                            <div className="route-stop-actions">
                              <select
                                aria-label={"移动" + stop.name + "到"}
                                value={day.day}
                                onChange={(e) =>
                                  reorder(stop.id, Number(e.target.value))
                                }
                              >
                                {route.days.map((d) => (
                                  <option key={d.day} value={d.day}>
                                    第 {d.day} 天
                                  </option>
                                ))}
                              </select>
                              <button
                                aria-label={"上移" + stop.name}
                                disabled={index === 0}
                                onClick={() =>
                                  reorder(
                                    stop.id,
                                    day.day,
                                    places[index - 1]?.id,
                                  )
                                }
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                aria-label={"下移" + stop.name}
                                disabled={index === places.length - 1}
                                onClick={() =>
                                  reorder(
                                    stop.id,
                                    day.day,
                                    places[index + 2]?.id,
                                  )
                                }
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                aria-label={"更换" + stop.name}
                                onClick={() =>
                                  setPicker({
                                    day: day.day,
                                    replaceId: stop.placeId,
                                  })
                                }
                              >
                                更换
                              </button>
                              <button
                                aria-label={"删除" + stop.name}
                                onClick={() => remove(stop.placeId!)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {!places.length ? (
                    <p className="free-day">
                      酒店休整 / 自由安排，可以添加地点。
                    </p>
                  ) : (
                    <>
                      <p className="route-leg">
                        {day.legs?.at(-1)
                          ? legLabel(day.legs.at(-1)!)
                          : "返酒店路段待核实"}
                      </p>
                      <p className="day-return">
                        H · 晚上返回 {draft.selectedHotel?.name}
                      </p>
                    </>
                  )}
                  {edit && (
                    <button
                      className="secondary-button"
                      onClick={() => setPicker({ day: day.day })}
                    >
                      <Plus size={16} />
                      添加地点
                    </button>
                  )}
                  {picker?.day === day.day && (
                    <div className="route-place-picker">
                      <h4>
                        {picker.replaceId ? "选择替换地点" : "搜索并添加地点"}
                      </h4>
                      <PlaceSearch
                        onChoose={choose}
                        chosenIds={draft.tripPlaces.map((p) => p.id)}
                        label={
                          picker.replaceId ? "替换为此地点" : "添加到这一天"
                        }
                      />
                      <button
                        className="text-button"
                        onClick={() => setPicker(null)}
                      >
                        取消地点编辑
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <PackingList />
          <div className="route-complete">
            <div>
              <h2>把这趟旅行，收进一页备忘录。</h2>
              <p>
                {ready
                  ? "路线已核实，可以完成规划。"
                  : "请等待路线核实完成；查询失败可重试。"}
              </p>
            </div>
            <Action
              disabled={!ready}
              onClick={() => {
                setMessage("正在整理你的旅行备忘录…");
                navigate("/plan/memo");
              }}
            >
              完成规划
            </Action>
          </div>
        </>
      )}
      {message && <Message>{message}</Message>}
      <dialog
        ref={dialog}
        className="confirm-dialog"
        aria-labelledby="route-confirm-title"
      >
        <h2 id="route-confirm-title">
          已选择 {draft.tripPlaces.length} 个地点，是否开始规划？
        </h2>
        <p>
          按大概时段安排每天酒店往返，并查询高德真实路线。重新生成将覆盖当前分天和顺序。
        </p>
        <div className="inline-actions">
          <button
            className="secondary-button"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            再看看
          </button>
          <button
            className="button-primary"
            disabled={!draft.tripPlaces.length}
            onClick={() => {
              patch({ routeDraft: generateRoute(draft, false) });
              force.current = true;
              setAttempt((n) => n + 1);
              dialog.current?.close();
            }}
          >
            确认开始规划
          </button>
        </div>
      </dialog>
      <div className="wizard-footer">
        <a href="/plan/local-transport">返回市内交通</a>
        <span className="quiet-copy">草稿自动保存在本机</span>
      </div>
    </>
  );
}
