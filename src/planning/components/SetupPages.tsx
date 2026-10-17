import { QueryProgress } from "./QueryProgress";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Sparkles, Check } from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { useRouter } from "../router";
import {
  compareTransportOptions,
  isLiveMode,
  parseTripPrompt,
} from "../services";
import { Action, Message, PageFooter, ResetControl } from "./Common";
export function PlanningCommandBar({ id }: { id: string }) {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter();
  const [value, setValue] = useState(draft.rawPrompt);
  useEffect(() => setValue(draft.rawPrompt), [draft.rawPrompt]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    patch({ rawPrompt: value.trim(), parsedPrompt: "" });
    navigate("/plan/details");
  };
  return (
    <div className="command-shell">
      <form className="command-bar v2-command" onSubmit={submit}>
        <Sparkles size={22} />
        <label className="sr-only" htmlFor={id}>
          告诉智能助手你的旅行想法
        </label>
        <input
          id={id}
          placeholder="11月从长沙去北京玩4天，两个人"
          value={value}
          maxLength={500}
          required
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="command-submit" type="submit" aria-label="开始规划">
          <span>开始规划</span>
          <ArrowUpRight size={21} />
        </button>
        <ResetControl />
      </form>
      <p className="command-status">
        {draft.lastUpdatedAt
          ? "本机草稿已恢复，继续规划或修改你的想法。"
          : "从一句话开始。住宿、交通与路线，由你一步步决定。"}
      </p>
      <div className="quick-prompts">
        {[
          "11月从长沙去北京玩4天，两个人",
          "2026年11月10日从上海去东京玩5天，2成人1儿童",
        ].map((prompt, i) => (
          <button key={prompt} onClick={() => setValue(prompt)}>
            {i ? "东京 · 设计与慢旅行" : "北京 · 城市漫步"}
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      {draft.lastUpdatedAt && (
        <a className="resume-draft" href={draft.lastRoute}>
          继续上次规划
          <ArrowUpRight size={15} />
        </a>
      )}
    </div>
  );
}
export function TripDetailsForm() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => {
    if (
      !draft.rawPrompt ||
      (draft.parsedPrompt === draft.rawPrompt && !attempt)
    )
      return;
    let active = true;
    setBusy(true);
    parseTripPrompt(draft.rawPrompt)
      .then((result) => {
        if (active) patch({ ...result, parsedPrompt: draft.rawPrompt });
      })
      .catch(() => {
        if (active) setError("解析暂不可用，你可以直接补齐下面的信息。");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [draft.rawPrompt, attempt, patch]);
  const next = () => {
    const problem = validateDetails(latest.current);
    setError(problem);

    if (!problem) navigate("/plan/mode");
    else {
      const d = latest.current;
      const field = !d.originCity.trim()
        ? "originCity"
        : !d.destinationCity.trim() || d.originCity === d.destinationCity
          ? "destinationCity"
          : d.dateMode === "fuzzy" && !d.fuzzyDateText
            ? "fuzzyDateText"
            : d.dateMode !== "fuzzy" && !d.departureDate
              ? "departureDate"
              : d.dateMode === "range" &&
                  (!d.returnDate || d.returnDate < d.departureDate)
                ? "returnDate"
                : !d.tripDays || d.tripDays > 30
                  ? "tripDays"
                  : d.adults < 1 || d.adults > 20
                    ? "adults"
                    : "children";
      const input = document.querySelector<HTMLElement>(
        '[data-field="' + field + '"]',
      );
      input?.focus();
      input?.scrollIntoView({ block: "center" });
    }
  };
  const dates = (departureDate: string, returnDate: string) =>
    patch({
      departureDate,
      returnDate,
      ...(draft.dateMode === "range" && departureDate && returnDate
        ? {
            tripDays:
              Math.round(
                (Date.parse(returnDate) - Date.parse(departureDate)) / 86400000,
              ) + 1,
          }
        : {}),
    });
  return (
    <>
      <div className="prompt-review">
        <Sparkles size={19} />
        <div>
          <span>你的旅行想法</span>
          <p>
            {draft.rawPrompt ||
              "直接填写下面的信息，也可以回首页从一句话开始。"}
          </p>
        </div>
        {draft.rawPrompt && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => setAttempt((n) => n + 1)}
          >
            再次解析
          </button>
        )}
      </div>
      {busy && (
        <QueryProgress operation="parse-trip" label="正在解析旅行信息" />
      )}
      <Message>
        {busy
          ? "正在解析你的想法…"
          : isLiveMode
            ? "百炼 Agent 解析 · 请核对信息，缺失项可直接补充。"
            : "本地规则解析 · 请核对信息。"}
      </Message>
      <div className="details-grid">
        <label>
          出发地
          <input
            data-field="originCity"
            value={draft.originCity}
            placeholder="例如：长沙"
            maxLength={40}
            onChange={(e) => patch({ originCity: e.target.value })}
          />
        </label>
        <label>
          目的地
          <input
            data-field="destinationCity"
            value={draft.destinationCity}
            placeholder="例如：北京"
            maxLength={40}
            onChange={(e) => patch({ destinationCity: e.target.value })}
          />
        </label>
        <fieldset className="date-fields">
          <legend>出发时间</legend>
          <div className="segmented-control">
            {(
              [
                ["fuzzy", "模糊时间"],
                ["exact", "出发日期 + 天数"],
                ["range", "往返日期"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={draft.dateMode === value}
                onClick={() => patch({ dateMode: value })}
              >
                {label}
              </button>
            ))}
          </div>
          {draft.dateMode === "fuzzy" ? (
            <label>
              大概什么时候出发
              <input
                data-field="fuzzyDateText"
                value={draft.fuzzyDateText}
                placeholder="11月上旬 / 国庆期间"
                maxLength={80}
                onChange={(e) => patch({ fuzzyDateText: e.target.value })}
              />
            </label>
          ) : (
            <div className="date-pair">
              <label>
                出发日期
                <input
                  type="date"
                  data-field="departureDate"
                  value={draft.departureDate}
                  onChange={(e) => dates(e.target.value, draft.returnDate)}
                />
              </label>
              {draft.dateMode === "range" && (
                <label>
                  返程日期
                  <input
                    type="date"
                    min={draft.departureDate}
                    data-field="returnDate"
                    value={draft.returnDate}
                    onChange={(e) => dates(draft.departureDate, e.target.value)}
                  />
                </label>
              )}
            </div>
          )}
        </fieldset>
        <label>
          游玩天数
          <input
            type="number"
            min={1}
            max={30}
            data-field="tripDays"
            value={draft.tripDays || ""}
            onChange={(e) => patch({ tripDays: Number(e.target.value) })}
          />
        </label>
        <div className="traveler-fields">
          <label>
            成人数
            <input
              type="number"
              min={1}
              max={20}
              data-field="adults"
              value={draft.adults}
              onChange={(e) => patch({ adults: Number(e.target.value) })}
            />
          </label>
          <label>
            儿童数
            <input
              type="number"
              min={0}
              max={20}
              data-field="children"
              value={draft.children}
              onChange={(e) => patch({ children: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
      {draft.lastUpdatedAt && (
        <p className="quiet-copy">
          修改目的地将清空该目的地的区域、酒店、景点与路线，通用旅行信息会保留。
        </p>
      )}
      {error && <Message error>{error}</Message>}
      <PageFooter
        back="/"
        nextLabel="选择住宿方式"
        disabled={busy}
        onNext={next}
      />
    </>
  );
}
import { validateDetails } from "../model";
export function ModeSelector() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter();
  return (
    <>
      <div className="mode-options">
        {(
          [
            [
              "area",
              "先选区域",
              "先找到喜欢的城市位置，再选一间顺路的酒店。",
              "景点 / 商圈 → 核心地点 → 酒店",
            ],
            [
              "hotel",
              "先找酒店",
              "从偏好的酒店品牌开始，找到这趟旅行的落脚点。",
              "品牌偏好 → 筛选条件 → 酒店",
            ],
          ] as const
        ).map(([mode, title, description, flow]) => (
          <button
            key={mode}
            className={
              "mode-choice " + (draft.planningMode === mode ? "selected" : "")
            }
            aria-pressed={draft.planningMode === mode}
            onClick={() => patch({ planningMode: mode })}
          >
            <div className={"mode-art " + mode}>
              <img
                src={"/images/mode-" + mode + "-warm.webp"}
                alt=""
                aria-hidden="true"
                width={1600}
                height={534}
                loading="eager"
              />
              <span className="mode-image-label">AI氛围配图 · 非实景</span>
              {draft.planningMode === mode && (
                <span className="mode-selected" aria-hidden="true">
                  <Check size={19} />
                </span>
              )}
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="mode-flow">{flow}</span>
            <ArrowUpRight size={23} />
          </button>
        ))}
      </div>
      <PageFooter
        back="/plan/details"
        nextLabel="比较城际交通"
        blockedReason={
          !draft.planningMode ? "请选择「先选区域」或「先找酒店」。" : ""
        }
        focusTarget=".mode-options"
        onNext={() => navigate("/plan/transport")}
      />
    </>
  );
}
export function TransportSelector() {
  const { draft, patch } = useTripDraft(),
    { navigate } = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summary, setSummary] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    compareTransportOptions(draft, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          patch({ transportOptions: result.options });
          setSummary(result.summary);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [
    draft.destinationCity,
    draft.originCity,
    draft.intercityTransportPreference,
    draft.departureDate,
    draft.dateMode,
    attempt,
    patch,
  ]);
  return (
    <>
      <div className="inline-actions transport-priority">
        <span>这段路，更在意</span>
        {["均衡", "省时", "舒适"].map((p) => (
          <button
            key={p}
            aria-pressed={draft.intercityTransportPreference === p}
            className="secondary-button"
            onClick={() =>
              patch({
                intercityTransportPreference: p,
                selectedTransportMode: null,
              })
            }
          >
            {p}
          </button>
        ))}
      </div>
      {busy ? (
        <QueryProgress
          operation="transport/compare"
          label="正在比较两地的交通方式"
        />
      ) : (
        <Message>{summary}</Message>
      )}
      {error && (
        <>
          <Message error>{error}</Message>
          <Action onClick={() => setAttempt((n) => n + 1)}>重新比较</Action>
          <a href="/plan/details">修改日期与旅行信息</a>
        </>
      )}
      <div className="transport-options">
        {draft.transportOptions.map((option) => (
          <button
            key={option.mode}
            className={
              "transport-choice " +
              (draft.selectedTransportMode === option.mode ? "selected" : "")
            }
            aria-pressed={draft.selectedTransportMode === option.mode}
            disabled={!option.available || busy}
            onClick={() => patch({ selectedTransportMode: option.mode })}
          >
            <h2>{option.title}</h2>
            <strong>{option.duration}</strong>
            <span>{option.priceLabel}</span>
            <p>{option.reason}</p>
            <small>
              {option.available ? "选择这种方式" : "当前暂无适用方案"}
            </small>
          </button>
        ))}
      </div>
      <p className="quiet-copy">
        {isLiveMode
          ? "比较基于查询时的铁路与航班候选，余票和价格会变化。这一步只选交通方式。"
          : "模拟比较，不代表真实班次或票价。这一步只选交通方式。"}
      </p>
      <PageFooter
        back="/plan/mode"
        nextLabel={
          draft.planningMode === "area" ? "选择住宿区域" : "选择品牌偏好"
        }
        disabled={busy}
        blockedReason={
          !draft.selectedTransportMode ? "请先选择城际交通方式。" : ""
        }
        focusTarget=".transport-options"
        onNext={() =>
          navigate(
            draft.planningMode === "area"
              ? "/plan/area"
              : "/plan/hotel-preference",
          )
        }
      />
    </>
  );
}
