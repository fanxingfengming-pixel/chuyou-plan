import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Search, SlidersHorizontal } from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { useRouter } from "../router";
import {
  getBookingUrl,
  selectHighlights,
  isLiveMode,
  getRelaxationAdvice,
  searchNamedHotel,
} from "../services";
import type { Hotel, HotelFilters as Filters } from "../types";
import { Action, Media, Message, PageFooter, SearchLoading } from "./Common";
import { DualRangeSlider } from "./DualRangeSlider";
import { useServiceStatus } from "../serviceStatusContext";
import {
  clearUnsupportedFilters,
  unsupportedFilterNames,
} from "../filterCapabilities";
import { serviceErrorMessage } from "../serviceClient";
import { QueryProgress } from "./QueryProgress";
import { factHotelReason } from "../../../shared/hotel-ranking.js";
export function HotelFilters() {
  const { draft, patch, startHotelSearch } = useTripDraft(),
    { navigate } = useRouter(),
    f = draft.hotelFilters;
  const { capabilities, check } = useServiceStatus();
  const unsupported = capabilities
    ? unsupportedFilterNames(f, capabilities)
    : [];
  const unavailable = (key: "starLevel" | "reviewCount" | "facilities") =>
    !capabilities?.hotelFilters[key];
  const set = (value: Partial<Filters>) =>
    patch({ hotelFilters: { ...f, ...value } });
  const year = f.minRenovationYear === 0 ? 0 : f.minRenovationYear - 2015;
  return (
    <>
      {!capabilities && (
        <Message>
          暂未确认可用筛选范围，请检查本地服务。
          <button className="text-button" onClick={() => void check()}>
            重新检查
          </button>
        </Message>
      )}
      {unsupported.length > 0 && (
        <Message error>
          上次草稿包含暂不支持的条件：{unsupported.join("、")}
          。其他条件保持原样。
          <button
            className="secondary-button"
            onClick={() =>
              capabilities && set(clearUnsupportedFilters(f, capabilities))
            }
          >
            清除未支持条件
          </button>
        </Message>
      )}
      <div className="hotel-filter-layout">
        <div className="main-filters">
          <section className="filter-section">
            <div className="filter-heading">
              <h2>每晚价格</h2>
              <span>人民币 · 供应方每晚起价</span>
            </div>
            <DualRangeSlider
              value={f.priceRange}
              onChange={(priceRange) => set({ priceRange })}
            />
            <p className="quiet-copy">
              按城市预设的参考预算，可自行调整。¥2000+ 表示不设价格上限。
            </p>
          </section>
          <section className="filter-section">
            <div className="filter-heading">
              <h2>最近装修年份</h2>
              <output>
                {year === 0
                  ? "不限"
                  : f.minRenovationYear === 2016
                    ? "2016 年及以后"
                    : f.minRenovationYear + " 年及以后"}
              </output>
            </div>
            <label className="sr-only" htmlFor="renovation-year">
              至少哪一年以后装修
            </label>
            <input
              className="single-range"
              id="renovation-year"
              type="range"
              min={0}
              max={11}
              value={year}
              onChange={(e) =>
                set({
                  minRenovationYear:
                    Number(e.target.value) === 0
                      ? 0
                      : Number(e.target.value) + 2015,
                })
              }
            />
            <div className="range-scale">
              <span>不限</span>
              <span>2016</span>
              <span>2020</span>
              <span>2026</span>
            </div>
          </section>
          <div className="filter-pair filter-single">
            <label>
              综合评分
              <select
                value={f.overallRating}
                onChange={(e) => set({ overallRating: Number(e.target.value) })}
              >
                {[
                  [0, "不限"],
                  [8, "8 分以上"],
                  [8.5, "8.5 分以上"],
                  [9, "9 分以上"],
                  [9.5, "9.5 分以上"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details className="more-filters">
            <summary>
              <SlidersHorizontal size={17} />
              更多筛选<span>星级、评价与设施</span>
            </summary>
            <div className="filter-extra">
              <label>
                酒店星级
                {unavailable("starLevel") && (
                  <small className="unsupported-filter">暂不支持</small>
                )}
                <select
                  aria-label="酒店星级"
                  disabled={unavailable("starLevel")}
                  value={f.starLevel}
                  onChange={(e) => set({ starLevel: Number(e.target.value) })}
                >
                  {[0, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n ? n + " 星及以上" : "不限"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                评论数量
                {unavailable("reviewCount") && (
                  <small className="unsupported-filter">暂不支持</small>
                )}
                <select
                  aria-label="评论数量"
                  disabled={unavailable("reviewCount")}
                  value={f.reviewCount}
                  onChange={(e) => set({ reviewCount: Number(e.target.value) })}
                >
                  {[0, 500, 1000, 2000].map((n) => (
                    <option key={n} value={n}>
                      {n ? n + " 条以上" : "不限"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                用户评分
                <select
                  value={f.userScore}
                  onChange={(e) => set({ userScore: Number(e.target.value) })}
                >
                  {[0, 4, 4.5, 4.8].map((n) => (
                    <option key={n} value={n}>
                      {n ? n + " / 5 以上" : "不限"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset
              className="facility-options"
              disabled={unavailable("facilities")}
            >
              <legend>
                你需要的设施{" "}
                {unavailable("facilities") && (
                  <small className="unsupported-filter">暂不支持</small>
                )}
              </legend>
              {["早餐", "停车", "健身房", "洗衣房", "亲子", "禁烟房"].map(
                (item) => (
                  <label key={item}>
                    <input
                      type="checkbox"
                      checked={f.facilities.includes(item)}
                      onChange={() =>
                        set({
                          facilities: f.facilities.includes(item)
                            ? f.facilities.filter((x) => x !== item)
                            : [...f.facilities, item],
                        })
                      }
                    />
                    {item}
                  </label>
                ),
              )}
            </fieldset>
          </details>
        </div>
        <aside className="district-panel">
          <h2>住得顺路一些。</h2>
          {draft.primaryPlace ? (
            <>
              <p>
                围绕 <strong>{draft.primaryPlace.name}</strong> 推荐行政区。
              </p>
              <div className="district-options">
                {draft.recommendedDistricts.map((d) => (
                  <label key={d}>
                    <input
                      type="checkbox"
                      checked={f.selectedDistricts.includes(d)}
                      onChange={() =>
                        set({
                          selectedDistricts: f.selectedDistricts.includes(d)
                            ? f.selectedDistricts.filter((x) => x !== d)
                            : [...f.selectedDistricts, d],
                        })
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
              <p className="quiet-copy">
                {isLiveMode
                  ? "取消勾选可搜索全城。行政区由高德 MCP 核验。"
                  : "行政区为模拟定位结果，待高德核验。"}
              </p>
            </>
          ) : (
            <p>尚未指定核心地点，将从全城搜索。你可以先找到喜欢的酒店。</p>
          )}
          <span className="filter-footnote">
            条件由你决定。搜索没有结果时，我们会提出放宽建议，等你选择。
          </span>
        </aside>
      </div>
      <PageFooter
        back={
          draft.planningMode === "area"
            ? "/plan/area"
            : "/plan/hotel-preference"
        }
        nextLabel="搜索适合的酒店"
        blockedReason={
          !capabilities
            ? "查询服务尚未就绪，请在页面底部检查服务状态。"
            : unsupported.length
              ? "请先主动清除暂不支持的筛选条件：" +
                unsupported.join("、") +
                "。"
              : ""
        }
        focusTarget=".hotel-filter-layout"
        onNext={() => {
          startHotelSearch();
          navigate("/plan/results");
        }}
      />
    </>
  );
}
function HotelCard({
  hotel,
  label,
  reason,
  onAdd,
}: {
  hotel: Hotel;
  label?: string;
  reason?: string;
  onAdd?: () => void;
}) {
  const { draft, patch } = useTripDraft(),
    checked = draft.compareHotelIds.includes(hotel.id),
    selected = draft.selectedHotel?.id === hotel.id;
  return (
    <article
      className={
        "hotel-result " +
        (label ? "featured " : "") +
        (selected && !onAdd ? "is-selected" : "")
      }
    >
      <Media
        hotelImage={hotel.image}
        hotelSource={hotel.source}
        imageSource={hotel.imageSource}
        imageFallback={hotel.imageFallback}
        name={hotel.name}
      />
      <div className="hotel-result-copy">
        <span className="place-meta">
          {hotel.district || "行政区待核实"} ·{" "}
          {hotel.starLevel === null
            ? hotel.starLabel || "等级待核实"
            : hotel.starLevel + " 星"}
        </span>
        <h2>
          {hotel.name}
          {label && <span className="recommendation-label">{label}</span>}
        </h2>
        <p className="hotel-address">{hotel.address || hotel.city}</p>
        {hotel.dataProvider === "amap" && (
          <p className="data-source-label">高德地图位置 · 非飞猪酒店数据</p>
        )}
        <div className="hotel-price">
          <strong>
            {hotel.price === null
              ? "报价待核实"
              : "¥" + hotel.price.toLocaleString()}
          </strong>
          <span>
            {hotel.price === null
              ? "仅确认位置"
              : "/ 晚起 · " +
                (hotel.source === "live" ? "供应方报价" : "模拟价格")}
          </span>
          <b>
            {hotel.overallRating?.toFixed(1) ?? "待核实"}
            {hotel.overallRating !== null && <small> / 10</small>}
          </b>
        </div>
        <div className="hotel-facts">
          <span>
            地铁{" "}
            {hotel.subwayDistance === null
              ? "待核实"
              : hotel.subwayDistance + " 米"}
          </span>
          <span>
            距核心（直线）{" "}
            {hotel.coreDistance === null
              ? draft.primaryPlace
                ? "待核实"
                : "待指定"
              : hotel.coreDistance + " 公里"}
          </span>
          <span>
            {hotel.renovationYear === null
              ? "装修年份待核实"
              : hotel.renovationYear + " 年装修"}
          </span>
        </div>
        <p className="hotel-review">
          用户评分{" "}
          {hotel.userScore === null ? "待核实" : hotel.userScore + " / 5"} ·
          评论{" "}
          {hotel.reviewCount === null
            ? "待核实"
            : hotel.reviewCount.toLocaleString() + " 条"}
        </p>
        {hotel.queriedAt && (
          <p className="quiet-copy">
            查询于{" "}
            {new Date(hotel.queriedAt).toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
              hour12: false,
            })}
          </p>
        )}
        <p className="hotel-reason">
          {reason ||
            (hotel.source === "live" ? factHotelReason(hotel) : hotel.reason)}
        </p>
        <div className="hotel-card-actions">
          <a
            className="secondary-button"
            target="_blank"
            rel="noopener noreferrer"
            href={getBookingUrl(hotel)}
            aria-disabled={!getBookingUrl(hotel)}
          >
            {getBookingUrl(hotel) ? "查看飞猪" : "飞猪链接待核实"}
            <ArrowUpRight size={15} />
          </a>
          <button
            className={
              selected ? "secondary-button selected" : "secondary-button"
            }
            aria-pressed={!onAdd && selected}
            onClick={() => {
              if (onAdd) onAdd();
              else {
                patch({ selectedHotel: hotel });
                window.dispatchEvent(
                  new CustomEvent("travel-feedback", {
                    detail: "已选择：" + hotel.name,
                  }),
                );
              }
            }}
          >
            {onAdd ? (
              "加入候选"
            ) : selected ? (
              <>
                <Check size={15} />
                已选择这家酒店
              </>
            ) : (
              "我已选择这家酒店"
            )}
          </button>
        </div>
        {!onAdd && (
          <label className="compare-check">
            <input
              type="checkbox"
              checked={checked}
              disabled={!checked && draft.compareHotelIds.length >= 3}
              onChange={() =>
                patch({
                  compareHotelIds: checked
                    ? draft.compareHotelIds.filter((id) => id !== hotel.id)
                    : [...draft.compareHotelIds, hotel.id],
                })
              }
            />
            {!checked && draft.compareHotelIds.length >= 3
              ? "对比已满 3 家"
              : "加入对比"}
          </label>
        )}
      </div>
    </article>
  );
}
function HotelConfirmation() {
  const { draft } = useTripDraft(),
    { navigate } = useRouter();
  if (!draft.selectedHotel) return null;
  return (
    <div className="hotel-confirmation" role="status">
      <Check size={23} />
      <div>
        <span>住宿选择已确认</span>
        <strong>{draft.selectedHotel.name}</strong>
        <p>这是规划选择，实际预订需在飞猪完成。</p>
      </div>
      <Action onClick={() => navigate("/plan/places")}>接着选择景点</Action>
    </div>
  );
}
function RelaxSuggestions() {
  const [advice, setAdvice] = useState("");
  const { draft, patch, cancelHotelSearch } = useTripDraft(),
    { navigate } = useRouter(),
    f = draft.hotelFilters;
  useEffect(() => {
    if (!isLiveMode) return;
    const controller = new AbortController();
    setAdvice("正在分析当前条件…");
    getRelaxationAdvice(f, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAdvice(result.summary);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAdvice("AI 建议暂未取得，你仍可自行选择下面的放宽方案。");
      });
    return () => controller.abort();
  }, [f]);
  const plans = [
    {
      title: "价格更灵活",
      body: "取消每晚价格上限，保留其余条件。",
      patch: { priceRange: [0, 2000] as [number, number] },
    },
    {
      title: "扩大位置与评分范围",
      body: "搜索全城，综合评分改为不限。",
      patch: {
        selectedDistricts: [],
        overallRating: 0,
      },
    },
    {
      title: "减少硬性条件",
      body: "装修年份、星级、评价数量与设施改为不限。",
      patch: {
        minRenovationYear: 0,
        starLevel: 0,
        reviewCount: 0,
        userScore: 0,
        facilities: [],
      },
    },
  ];
  return (
    <>
      <Message>{advice}</Message>
      <div className="relax-options">
        {plans.map((plan) => (
          <button
            key={plan.title}
            onClick={() => {
              cancelHotelSearch();
              patch({ hotelFilters: { ...f, ...plan.patch } });
              navigate("/plan/hotels");
            }}
          >
            <h3>{plan.title}</h3>
            <p>{plan.body}</p>
            <span>
              应用并检查条件
              <ArrowUpRight size={15} />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
export function HotelResults() {
  const {
      draft,
      patch,
      startHotelSearch,
      continueHotelSearch,
      cancelHotelSearch,
    } = useTripDraft(),
    { navigate } = useRouter(),
    [sort, setSort] = useState("推荐");
  const highlights = useMemo(
    () => selectHighlights(draft.hotelResults),
    [draft.hotelResults],
  );
  const sorted = useMemo(
    () =>
      [...draft.hotelResults].sort((a, b) =>
        sort === "价格"
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : sort === "评分"
            ? (b.overallRating ?? -1) - (a.overallRating ?? -1)
            : sort === "距离"
              ? (a.coreDistance ?? (a.subwayDistance ?? Infinity) / 1000) -
                (b.coreDistance ?? (b.subwayDistance ?? Infinity) / 1000)
              : (b.overallRating ?? -1) - (a.overallRating ?? -1),
      ),
    [draft.hotelResults, sort],
  );
  const candidateIds = draft.hotelCandidateIds.length
    ? draft.hotelCandidateIds
    : [
        ...new Set([
          ...highlights.map((h) => h.hotel.id),
          ...draft.hotelResults.map((h) => h.id),
        ]),
      ].slice(0, 6);
  const candidates = candidateIds
    .map((id) => draft.hotelResults.find((h) => h.id === id))
    .filter((h): h is Hotel => !!h)
    .sort((a, b) =>
      sort === "推荐" ? 0 : sorted.indexOf(a) - sorted.indexOf(b),
    );
  const status = draft.hotelSearchStatus;
  const edit = () => {
    cancelHotelSearch();
    patch({ hotelSearchStatus: "idle" });
    navigate("/plan/hotels");
  };
  return (
    <>
      <HotelConfirmation />
      <HotelNameSearch />
      {status === "loading" ? (
        <>
          <SearchLoading />
          <button className="secondary-button" onClick={edit}>
            返回修改条件
          </button>
        </>
      ) : status === "timeout" ? (
        <div className="search-recovery">
          <h2>搜索比预期久一些。</h2>
          <p>请求仍在等待返回，你可以继续等待、重试，或主动放宽条件。</p>
          <div className="inline-actions">
            <Action onClick={continueHotelSearch}>继续等待</Action>
            <button className="secondary-button" onClick={startHotelSearch}>
              重新搜索
            </button>
            <button className="secondary-button" onClick={edit}>
              放宽条件
            </button>
          </div>
        </div>
      ) : status === "error" ? (
        <div className="search-recovery">
          <h2>这次搜索暂未完成。</h2>
          <Message error>{draft.hotelSearchError}</Message>
          <a href="/plan/details">修改日期与旅行信息</a>
          <div className="inline-actions">
            <Action onClick={startHotelSearch}>重新搜索</Action>
            <button className="secondary-button" onClick={edit}>
              修改条件
            </button>
          </div>
        </div>
      ) : status === "empty" ? (
        <>
          <div className="search-recovery">
            <h2>暂时没有符合条件的酒店。</h2>
            <p>
              当前条件保持不变。下面是 3
              套放宽方案，由你决定是否采用。供应方未返回的参数无法保证满足硬性筛选。
            </p>
          </div>
          <RelaxSuggestions />
          <button className="secondary-button" onClick={edit}>
            自己调整条件
          </button>
        </>
      ) : status === "idle" ? (
        <div className="search-recovery">
          <h2>条件已准备好。</h2>
          <p>
            {draft.hotelSearchError || "开始搜索，比较适合这趟旅行的住宿。"}
          </p>
          <Action onClick={startHotelSearch}>开始搜索酒店</Action>
        </div>
      ) : (
        <>
          <p className="quiet-copy">
            {isLiveMode
              ? "以下为 FlyAI 本次查询候选。起价可能对应床位或部分房型，不能保证整间房或全部同行人数适用；房型、间数、库存与最终价格请在飞猪核对。综合评分由供应方 5 分制换算。登录后可能使用会员价 / 优惠券。"
              : "以下为虚构酒店与模拟价格，照片是氛围占位素材。登录后可能使用会员价 / 优惠券。"}
          </p>
          {isLiveMode && (
            <Message>
              {draft.hotelResults.some(
                (h) => h.recommendationSource === "agent",
              )
                ? "AI 已从本次候选中选择综合推荐，价格与距离比较由已知数据核验。"
                : "AI 推荐暂未生成或旧推荐尚未核验，当前按已知评分、价格与直线距离整理候选。"}
            </Message>
          )}
          <div className="result-toolbar">
            <h2>{candidates.length} 家候选，先看看有没有喜欢的。</h2>
            <label>
              排序
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {["推荐", "价格", "评分", "距离"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {candidates.length < 6 && (
            <Message>
              本次仅有 {candidates.length}{" "}
              家可用候选，不足六家；可以直接搜索酒店补充。
            </Message>
          )}
          <div className="hotel-highlights">
            {candidates.map((h) => (
              <HotelCard
                key={h.id}
                hotel={h}
                label={highlights.find((x) => x.hotel.id === h.id)?.label}
              />
            ))}
          </div>
          {draft.hotelResults.length > candidates.length && (
            <details className="additional-hotels">
              <summary>
                更多符合条件的酒店 ·{" "}
                {draft.hotelResults.length - candidates.length} 家
              </summary>
              <div className="more-hotels">
                {sorted
                  .filter((h) => !candidateIds.includes(h.id))
                  .map((h) => (
                    <HotelCard key={h.id} hotel={h} />
                  ))}
              </div>
            </details>
          )}
          {draft.hotelResults.find((h) => h.platformHint)?.platformHint && (
            <Message>
              {draft.hotelResults.find((h) => h.platformHint)?.platformHint}
            </Message>
          )}
          <div className="compare-tray">
            <span>已选 {draft.compareHotelIds.length} / 3 家对比</span>
            <a href="/plan/hotels">修改筛选</a>
            <Action
              disabled={!draft.compareHotelIds.length}
              onClick={() => navigate("/plan/compare")}
            >
              比较已选酒店
            </Action>
          </div>
        </>
      )}
      <div className="wizard-footer">
        <a
          href="/plan/hotels"
          onClick={() => {
            if (status === "loading" || status === "timeout") {
              cancelHotelSearch();
              patch({ hotelSearchStatus: "idle" });
            }
          }}
        >
          返回酒店筛选
        </a>
        {draft.selectedHotel && (
          <Action onClick={() => navigate("/plan/places")}>继续选择景点</Action>
        )}
      </div>
    </>
  );
}
export function HotelCompare() {
  const { draft, patch } = useTripDraft(),
    items = draft.compareHotelIds
      .map((id) => draft.hotelResults.find((h) => h.id === id))
      .filter((h): h is Hotel => !!h),
    highlights = selectHighlights(items);
  return (
    <>
      <HotelConfirmation />
      {items.length ? (
        <>
          <div className="compare-verdict">
            <h2>把更重要的，放在前面。</h2>
            {items.some((h) => h.source === "live") && (
              <p className="quiet-copy">
                仅比较本次选中的酒店。综合项沿用查询推荐或按已知评分排序；价格与核心直线距离由程序比较。供应方起价可能对应床位或部分房型，房间、人数和最终金额需在飞猪核对。
              </p>
            )}
            {highlights.map((h) => (
              <p key={h.hotel.id}>
                <strong>
                  {["最推荐", "综合推荐"].includes(h.label)
                    ? "综合更推荐"
                    : ["最划算", "价格较优"].includes(h.label)
                      ? "更在意价格选"
                      : ["位置最好", "距核心较近"].includes(h.label)
                        ? "更在意位置选"
                        : "可作备选"}{" "}
                  {h.hotel.name}
                </strong>
                <span>{h.reason}</span>
              </p>
            ))}
          </div>
          <div className="compare-table-scroll">
            <table className="hotel-compare">
              <caption className="sr-only">
                最多三家酒店参数对比，未知参数保留待核实
              </caption>
              <thead>
                <tr>
                  <th scope="col">比较维度</th>
                  {items.map((h) => (
                    <th key={h.id} scope="col">
                      {h.name}
                      <button
                        aria-label={"移除对比" + h.name}
                        onClick={() =>
                          patch({
                            compareHotelIds: draft.compareHotelIds.filter(
                              (id) => id !== h.id,
                            ),
                          })
                        }
                      >
                        移除
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    "供应方每晚起价",
                    "综合评分",
                    "距地铁",
                    "距核心地点（直线）",
                    "装修年份",
                    "星级",
                    "评论数量",
                    "用户评分",
                    "设施",
                  ] as const
                ).map((label, i) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {items.map((h) => (
                      <td key={h.id}>
                        {
                          [
                            h.price === null
                              ? "待核实"
                              : "¥" + h.price + " / 晚起",
                            h.overallRating === null
                              ? "待核实"
                              : h.overallRating + " / 10",
                            h.subwayDistance === null
                              ? "待核实"
                              : h.subwayDistance + " 米",
                            h.coreDistance === null
                              ? draft.primaryPlace
                                ? "待核实"
                                : "待指定"
                              : h.coreDistance + " 公里",
                            h.renovationYear === null
                              ? "待核实"
                              : h.renovationYear + " 年",
                            h.starLevel === null
                              ? h.starLabel || "待核实"
                              : h.starLevel + " 星",
                            h.reviewCount === null
                              ? "待核实"
                              : h.reviewCount + " 条",
                            h.userScore === null
                              ? "待核实"
                              : h.userScore + " / 5",
                            h.facilities.length
                              ? h.facilities.join("、")
                              : h.source === "live"
                                ? "待核实"
                                : "无",
                          ][i]
                        }
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">你的决定</th>
                  {items.map((h) => (
                    <td key={h.id}>
                      <a
                        className="secondary-button"
                        href={getBookingUrl(h)}
                        aria-disabled={!getBookingUrl(h)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        查看酒店
                        <ArrowUpRight size={15} />
                      </a>
                      <button
                        className="button-primary"
                        onClick={() => patch({ selectedHotel: h })}
                      >
                        {draft.selectedHotel?.id === h.id
                          ? "已选择这家酒店"
                          : "我已选择这家酒店"}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="quiet-copy">
            登录后可能使用会员价 /
            优惠券。点击外链不会确认酒店；请返回后手动选择。
          </p>
        </>
      ) : (
        <Message>还没有选择对比酒店，请先回结果页勾选，最多 3 家。</Message>
      )}
      <div className="wizard-footer">
        <a href="/plan/results">返回酒店结果</a>
      </div>
    </>
  );
}

function HotelNameSearch() {
  const { draft, patch } = useTripDraft();
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Hotel[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Hotel | null>(null);
  const request = useRef<AbortController | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const context = JSON.stringify([
    draft.destinationCity,
    draft.dateMode,
    draft.departureDate,
    draft.returnDate,
    draft.tripDays,
  ]);
  useEffect(() => {
    setResults([]);
    setNotice("");
    setError("");
    setBusy(false);
    setPending(null);
    dialog.current?.close();
    return () => request.current?.abort();
  }, [context]);
  const search = async (provider?: "amap") => {
    if (!query.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setResults([]);
    setError("");
    setNotice("");
    try {
      const result = await searchNamedHotel(
        query,
        draft,
        controller.signal,
        provider,
      );
      if (!controller.signal.aborted) {
        setResults(result.hotels);
        setNotice(
          result.notice +
            (result.hotels.length
              ? ""
              : " 暂未找到匹配酒店，请补充具体名称或地址。"),
        );
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(serviceErrorMessage(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const ids = draft.hotelCandidateIds.length
    ? draft.hotelCandidateIds
    : draft.hotelResults.slice(0, 6).map((h) => h.id);
  const commit = (hotel: Hotel, replaceId?: string) => {
    patch((previous) => ({
      hotelResults: previous.hotelResults.some((h) => h.id === hotel.id)
        ? previous.hotelResults
        : [...previous.hotelResults, hotel],
      hotelSearchStatus: "success",
      hotelCandidateIds: replaceId
        ? ids.map((id) => (id === replaceId ? hotel.id : id))
        : [...ids, hotel.id].slice(0, 6),
    }));
    dialog.current?.close();
    setPending(null);
    setNotice("已加入候选：" + hotel.name + "。住宿选择仍由你确认。");
    window.dispatchEvent(
      new CustomEvent("travel-feedback", {
        detail: "已加入候选：" + hotel.name,
      }),
    );
  };
  const add = (hotel: Hotel) => {
    if (ids.includes(hotel.id)) {
      setNotice("这家酒店已经在候选中。");
      return;
    }
    if (ids.length < 6) {
      commit(hotel);
      return;
    }
    setPending(hotel);
    dialog.current?.showModal();
  };
  return (
    <section className="hotel-name-search" aria-labelledby="hotel-name-title">
      <h2 id="hotel-name-title">有心仪的酒店？直接找。</h2>
      <p className="quiet-copy">
        按名称搜索飞猪已有酒店，结果独立于推荐筛选。加入候选后，再由你选择住宿。
      </p>
      <form
        className="place-search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Search size={19} />
        <label className="sr-only" htmlFor="hotel-name-query">
          搜索飞猪酒店
        </label>
        <input
          id="hotel-name-query"
          value={query}
          maxLength={100}
          required
          placeholder={"输入" + draft.destinationCity + "的酒店名称"}
          onChange={(e) => {
            request.current?.abort();
            setBusy(false);
            setResults([]);
            setNotice("");
            setError("");
            setQuery(e.target.value);
          }}
        />
        <button className="secondary-button" disabled={busy} aria-busy={busy}>
          {busy ? "正在搜索…" : "搜索飞猪酒店"}
        </button>
      </form>
      {busy && (
        <>
          <QueryProgress operation="hotels/search-name" label="正在搜索酒店" />
          <div className="hotel-search-skeleton" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i} />
            ))}
          </div>
        </>
      )}
      {notice && <Message>{notice}</Message>}
      {error && (
        <>
          <Message error>{error}</Message>
          <div className="inline-actions">
            <button
              className="secondary-button"
              onClick={() => void search()}
              disabled={busy}
            >
              重试飞猪搜索
            </button>
            <button
              className="secondary-button"
              onClick={() => void search("amap")}
              disabled={busy}
            >
              改用高德查位置
            </button>
          </div>
        </>
      )}
      {!!results.length && (
        <div className="named-hotel-results">
          <h3>搜索结果 · 不会自动替换候选</h3>
          <div className="hotel-highlights">
            {results.map((h) => (
              <HotelCard key={h.id} hotel={h} onAdd={() => add(h)} />
            ))}
          </div>
        </div>
      )}
      <dialog
        ref={dialog}
        className="confirm-dialog hotel-replacement-dialog"
        aria-labelledby="replace-hotel-title"
        onClose={() => setPending(null)}
      >
        <h2 id="replace-hotel-title">用{pending?.name}替换哪一家？</h2>
        <p>候选保持六家。替换不会自动更改已选住宿。</p>
        <div className="replacement-options">
          {ids.map((id, index) => {
            const h = draft.hotelResults.find((x) => x.id === id);
            return (
              <button
                className="secondary-button"
                key={id}
                onClick={() => pending && commit(pending, id)}
              >
                {index + 1}. {h?.name}
                {draft.selectedHotel?.id === id ? "（当前已选）" : ""}
              </button>
            );
          })}
        </div>
        <button
          className="secondary-button"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          取消替换
        </button>
      </dialog>
    </section>
  );
}
