import { useEffect, useState } from "react";
import {
  progressSubscribers,
  type QueryProgress as Progress,
} from "../serviceClient";
export function QueryProgress({
  label = "正在准备旅行资料",
  operation,
}: {
  label?: string;
  operation?: string;
}) {
  const [progress, setProgress] = useState<Progress>({ stage: label }),
    [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const began = Date.now();
    const callback = (p: Progress) => {
      if (!operation || p.operation === operation) setProgress(p);
    };
    progressSubscribers.add(callback);
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - began) / 1000)),
      1000,
    );
    return () => {
      progressSubscribers.delete(callback);
      clearInterval(timer);
    };
  }, [operation]);
  const determinate =
    typeof progress.completed === "number" &&
    typeof progress.total === "number" &&
    progress.total > 0;
  const percentage = determinate
    ? Math.round(Math.min(1, progress.completed! / progress.total!) * 100)
    : undefined;
  const range = progress.estimateRangeMs;
  const estimate =
    range &&
    range.length === 2 &&
    range.every((n) => Number.isFinite(n) && n >= 0)
      ? range
      : null;
  const upper = estimate ? Math.ceil(estimate[1] / 1000) - elapsed : 0;
  return (
    <div className="query-progress" role="status" aria-live="polite">
      <div className="query-progress-heading">
        <strong>{progress.stage}</strong>
        <span>
          {determinate
            ? progress.completed + " / " + progress.total
            : "已等待 " + elapsed + " 秒"}
        </span>
      </div>
      <div
        className={
          "query-progress-track " + (!determinate ? "indeterminate" : "")
        }
        role="progressbar"
        aria-label={progress.stage}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={percentage}
      >
        <span style={determinate ? { width: percentage + "%" } : undefined} />
      </div>
      <p>
        {estimate
          ? upper > 0
            ? "按近期同类查询估计，还需约 " +
              Math.max(1, Math.floor(estimate[0] / 1000) - elapsed) +
              "–" +
              Math.max(1, upper) +
              " 秒；实际用时可能变化。"
            : "本次查询比近期通常用时更久，仍在等待返回。"
          : "首次查询或耗时样本不足，暂无法准确估计剩余时间。"}
      </p>
    </div>
  );
}
export function PlaceSkeleton() {
  return (
    <div className="area-scroll" aria-label="地点资料加载中">
      {[0, 1, 2].map((i) => (
        <div key={i} className="place-skeleton" aria-hidden="true">
          <div />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
