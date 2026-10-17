import { QueryProgress, PlaceSkeleton } from "./QueryProgress";
import { readPrefetchedArea, preloadPlaceImages } from "../services";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Search, Star, X } from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { useRouter } from "../router";
import {
  distanceKm,
  getAreaRecommendations,
  resolveDistrictWithAmapMCP,
  searchPlaceWithAmapMCP,
} from "../services";
import type { Place } from "../types";
import { Media, Message, PageFooter } from "./Common";
import { serviceErrorMessage } from "../serviceClient";
export function PlaceSearch({
  onChoose,
  chosenIds = [],
  label = "加入行程",
}: {
  onChoose: (p: Place) => void;
  chosenIds?: string[];
  label?: string;
}) {
  const { draft } = useTripDraft(),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setStatus("");
    try {
      const places = await searchPlaceWithAmapMCP(
        query,
        draft.destinationCity,
        request.signal,
      );
      if (!request.signal.aborted) {
        setResults(places);
        setStatus(
          places.length ? "" : "未找到可确认位置的地点，请换个更具体的关键词。",
        );
      }
    } catch (e) {
      if (!request.signal.aborted) setStatus(serviceErrorMessage(e));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="place-search">
      <form onSubmit={search} className="place-search-bar">
        <Search size={19} />
        <label className="sr-only" htmlFor="place-query">
          搜索地点
        </label>
        <input
          id="place-query"
          placeholder={"在" + draft.destinationCity + "，你想去哪里？"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          required
        />
        <button className="secondary-button" disabled={busy}>
          {busy ? "定位中…" : "搜索地点"}
        </button>
      </form>
      {busy && (
        <QueryProgress operation="amap/search-place" label="正在查询地点" />
      )}
      {status && <Message>{status}</Message>}
      <div className="place-search-results">
        {results.map((p) => (
          <PlaceCard
            key={p.id}
            place={p}
            onChoose={() => onChoose(p)}
            selected={chosenIds.includes(p.id)}
            label={label}
          />
        ))}
      </div>
    </div>
  );
}
export function PlaceCard({
  place,
  onChoose,
  selected = false,
  label = "加入行程",
  disabled = false,
}: {
  place: Place;
  onChoose: () => void;
  selected?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const { draft } = useTripDraft();
  return (
    <article className="place-choice">
      <Media place={place} />
      <div className="place-copy">
        <span className="place-meta">
          {place.type} · {place.district}
        </span>
        <h3>{place.name}</h3>
        <p>{place.description}</p>
        <p className="place-address">{place.address}</p>
        {draft.selectedHotel && (
          <p className="place-distance">
            距酒店约{" "}
            {distanceKm(place, draft.selectedHotel)?.toFixed(1) ?? "待核实"}{" "}
            公里 · 直线距离估算
          </p>
        )}
        <button
          className="secondary-button"
          disabled={disabled}
          aria-pressed={selected}
          onClick={onChoose}
        >
          {selected ? (
            <>
              <Check size={15} />
              已选择 · 点击移除
            </>
          ) : (
            label
          )}
        </button>
      </div>
    </article>
  );
}
export function AreaRecommendations() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter(),
    [places, setPlaces] = useState<Place[]>(
      () => readPrefetchedArea(draft.destinationCity) || [],
    ),
    [areaLoading, setAreaLoading] = useState(
      !readPrefetchedArea(draft.destinationCity),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    coreRequest = useRef(0),
    refreshRequested = useRef(false);
  useEffect(() => {
    const c = new AbortController();

    setError("");
    setAreaLoading(true);
    const known = readPrefetchedArea(draft.destinationCity);
    setPlaces(known || []);
    getAreaRecommendations(
      draft.destinationCity,
      c.signal,
      refreshRequested.current,
    )
      .then(async (data) => {
        await preloadPlaceImages(data);
        if (!c.signal.aborted) setPlaces(data);
      })
      .catch(() => {
        if (!c.signal.aborted) setError("区域目录暂不可用，请重新加载。");
      })
      .finally(() => {
        if (!c.signal.aborted) setAreaLoading(false);
      });
    refreshRequested.current = false;
    return () => c.abort();
  }, [draft.destinationCity, attempt]);
  const choose = (p: Place) => {
    const exists = draft.selectedPlaces.some((x) => x.id === p.id);
    if (!exists && draft.selectedPlaces.length >= 3) {
      setError("最多选择 3 个位置，请先移除一个。");
      return;
    }
    setError("");
    patch((previous) => ({
      selectedPlaces: previous.selectedPlaces.some((x) => x.id === p.id)
        ? previous.selectedPlaces.filter((x) => x.id !== p.id)
        : [...previous.selectedPlaces, p],
      ...(previous.primaryPlace?.id === p.id
        ? { primaryPlace: null, recommendedDistricts: [] }
        : {}),
    }));
  };
  const core = async (p: Place) => {
    const id = ++coreRequest.current;
    setBusy(true);
    setError("");
    try {
      const districts = await resolveDistrictWithAmapMCP(p);
      if (id === coreRequest.current)
        patch({
          primaryPlace: p,
          recommendedDistricts: districts,
          hotelFilters: { ...draft.hotelFilters, selectedDistricts: districts },
        });
    } catch {
      setError("行政区解析失败，请重试。");
    } finally {
      if (id === coreRequest.current) setBusy(false);
    }
  };
  return (
    <>
      <div className="selected-area-bar">
        <div>
          <strong>已选 {draft.selectedPlaces.length} / 3</strong>
          <span>手动指定一个核心地点，让住宿更顺路。</span>
        </div>
        {draft.selectedPlaces.map((p) => (
          <div className="selected-area" key={p.id}>
            <button
              disabled={busy}
              aria-pressed={draft.primaryPlace?.id === p.id}
              onClick={() => core(p)}
            >
              <Star
                size={15}
                fill={draft.primaryPlace?.id === p.id ? "currentColor" : "none"}
              />
              {p.name}
              <small>
                {draft.primaryPlace?.id === p.id ? "核心地点" : "设为核心"}
              </small>
            </button>
            <button aria-label={"移除" + p.name} onClick={() => choose(p)}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {draft.selectedPlaces.length >= 3 && (
        <Message>已选满3个位置。要更换位置，请先移除一个。</Message>
      )}
      {areaLoading && (
        <QueryProgress
          operation="area-recommendations"
          label="正在读取地点资料与图片"
        />
      )}
      {!areaLoading && places.some((p) => p.loadedFrom === "catalog") && (
        <div className="catalog-notice">
          <p role="status">
            已读取本地收录资料 · {places.length} 个地点 · 图片和介绍无需重复搜索
          </p>
          <button
            className="text-button"
            onClick={() => {
              refreshRequested.current = true;
              setAttempt((n) => n + 1);
            }}
          >
            联网更新资料
          </button>
        </div>
      )}
      {(["景点", "商圈"] as const).map((type) => (
        <details key={type} className="area-group" open>
          <summary>
            <h2>{type === "景点" ? "热门景点" : "热门商圈"}</h2>
            <span>
              精选 3 个 · 横向浏览
              <ChevronDown size={17} />
            </span>
          </summary>
          {areaLoading && !places.length ? (
            <PlaceSkeleton />
          ) : (
            <div className="area-scroll">
              {places
                .filter((p) => p.type === type)
                .slice(0, 3)
                .map((p) => (
                  <PlaceCard
                    key={p.id}
                    place={p}
                    onChoose={() => choose(p)}
                    selected={draft.selectedPlaces.some((x) => x.id === p.id)}
                    disabled={
                      busy ||
                      (!draft.selectedPlaces.some((x) => x.id === p.id) &&
                        draft.selectedPlaces.length >= 3)
                    }
                    label="选择位置"
                  />
                ))}
            </div>
          )}
        </details>
      ))}
      {!areaLoading && !error && !places.length && (
        <Message>当前城市暂未取得推荐地点，你可以自行搜索。</Message>
      )}
      <div className="manual-place">
        <h2>已经有想住附近的地方？</h2>
        <p>输入地点名称，定位后加入你的候选位置。</p>
        <PlaceSearch
          onChoose={choose}
          chosenIds={draft.selectedPlaces.map((p) => p.id)}
          label="选择位置"
        />
      </div>
      {error && (
        <>
          <Message error>{error}</Message>
          {!places.length && (
            <button
              className="secondary-button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              重新加载
            </button>
          )}
        </>
      )}
      <p className="quiet-copy">
        地点、坐标与行政区由高德 MCP
        查询。图片注明来源，未找到时使用通用风景示意图。
      </p>
      <PageFooter
        back="/plan/transport"
        nextLabel="设置酒店条件"
        disabled={busy}
        blockedReason={
          !draft.primaryPlace
            ? draft.selectedPlaces.length
              ? "请在已选位置中点击「设为核心」。"
              : "请先选择一个位置，再设为核心地点。"
            : ""
        }
        focusTarget=".selected-area-bar"
        onNext={() => navigate("/plan/hotels")}
      />
    </>
  );
}
import { HOTEL_BRANDS } from "../../../shared/hotel-brands.js";
export function HotelBrandPreference() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter();
  const retired = draft.brandPreference.filter(
    (b) => !HOTEL_BRANDS.includes(b),
  );
  return (
    <>
      <h2 className="subheading">有偏好的酒店品牌吗？</h2>
      <p className="quiet-copy">
        可多选，也可以不限品牌。这里只记录偏好，实际库存以后续搜索为准。
      </p>
      <div className="brand-options">
        <button
          className={
            "brand-option " + (!draft.brandPreference.length ? "selected" : "")
          }
          aria-pressed={!draft.brandPreference.length}
          onClick={() => patch({ brandPreference: [] })}
        >
          <span>不限品牌</span>
          <small>保持开放，发现更多选择</small>
        </button>
        {HOTEL_BRANDS.map((brand) => (
          <button
            key={brand}
            className={
              "brand-option " +
              (draft.brandPreference.includes(brand) ? "selected" : "")
            }
            aria-pressed={draft.brandPreference.includes(brand)}
            onClick={() =>
              patch((previous) => ({
                brandPreference: previous.brandPreference.includes(brand)
                  ? previous.brandPreference.filter(
                      (b) => b !== brand && HOTEL_BRANDS.includes(b),
                    )
                  : [
                      ...previous.brandPreference.filter((b) =>
                        HOTEL_BRANDS.includes(b),
                      ),
                      brand,
                    ],
              }))
            }
          >
            <span>{brand}</span>
          </button>
        ))}
      </div>
      {!!retired.length && (
        <Message>
          原品牌偏好「{retired.join("、")}
          」已移出本次范围，请重新选择品牌或选择不限品牌。
        </Message>
      )}
      <div className="inline-actions">
        <button
          className="text-button"
          onClick={() => {
            patch({ brandPreference: [] });
            navigate("/plan/hotels");
          }}
        >
          跳过品牌偏好
        </button>
      </div>
      <PageFooter
        back="/plan/transport"
        nextLabel="设置酒店条件"
        blockedReason={retired.length ? "请重新选择品牌或选择不限品牌。" : ""}
        focusTarget=".brand-options"
        onNext={() => navigate("/plan/hotels")}
      />
    </>
  );
}
