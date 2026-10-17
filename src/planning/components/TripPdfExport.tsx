import { useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import type { TripDraft } from "../types";
import { Message } from "./Common";

export function TripPdfExport({
  draft,
  disabled = false,
  compact = false,
}: {
  draft: TripDraft;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const pending = useRef(false);
  const download = async () => {
    if (pending.current || disabled || !draft.routeDraft) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("正在整理行程并加载中文字体，首次导出可能稍慢…");
    // Freeze this click's choices while the user may continue editing the page.
    try {
      const snapshot = structuredClone(draft);
      const { downloadTripPdf } = await import("../tripPdf");
      await downloadTripPdf(snapshot);
      setStatus("PDF 已生成并发起下载。如未看到文件，请检查浏览器下载列表。");
    } catch (error) {
      setStatus("");
      setError(
        error instanceof Error
          ? error.message + " 请重试导出。"
          : "PDF 生成失败，请重试导出。",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      className={compact ? "trip-pdf-export compact" : "trip-pdf-export"}
      aria-labelledby={compact ? undefined : "pdf-export-title"}
      aria-label={compact ? "行程PDF导出" : undefined}
    >
      <div className="trip-pdf-export-row">
        {!compact && (
          <div>
            <h2 id="pdf-export-title">把行程带在身边。</h2>
            <p>
              保存旅行信息、已选酒店与景点，以及当前每日路线，离线也能查看。
            </p>
          </div>
        )}
        <button
          type="button"
          className={compact ? "secondary-button" : "button-primary"}
          onClick={download}
          disabled={busy || disabled || !draft.routeDraft}
          aria-busy={busy}
        >
          {busy ? (
            <LoaderCircle size={18} aria-hidden="true" />
          ) : (
            <Download size={18} aria-hidden="true" />
          )}
          {busy ? "正在生成 PDF…" : "生成 PDF"}
        </button>
      </div>
      {draft.routeDraft?.needsOptimization && (
        <p className="quiet-copy">
          路线已调整。PDF 会保留当前顺序，你也可以先重新优化再下载。
        </p>
      )}
      {status && <Message>{status}</Message>}
      {error && <Message error>{error}</Message>}
    </section>
  );
}
