import { Context } from "./draftContext";
export { useTripDraft } from "./draftContext";
import { hotelPayload } from "./payload";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialDraft, restoreDraft, STORAGE_KEY, updateDraft } from "./model";
import { searchHotelsWithFlyAI, selectHighlights } from "./services";
import {
  getHotelCapabilities,
  TravelServiceError,
  serviceErrorMessage,
} from "./serviceClient";
import { unsupportedFilterNames } from "./filterCapabilities";
import type { TripDraft } from "./types";
export function TripDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(() => {
    try {
      return restoreDraft(localStorage.getItem(STORAGE_KEY));
    } catch {
      return initialDraft();
    }
  });
  const [storageError, setStorageError] = useState("");
  const current = useRef(draft);
  current.current = draft;
  const pending = useRef<AbortController | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patch = useCallback(
    (
      value: Partial<TripDraft> | ((previous: TripDraft) => Partial<TripDraft>),
    ) =>
      setDraft((previous) =>
        updateDraft(
          previous,
          typeof value === "function" ? value(previous) : value,
        ),
      ),
    [],
  );
  const cancelHotelSearch = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const armTimeout = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current) patch({ hotelSearchStatus: "timeout" });
    }, 15000);
  }, [patch]);
  const startHotelSearch = useCallback(async () => {
    cancelHotelSearch();
    const controller = new AbortController(),
      payload = hotelPayload(current.current),
      signature = JSON.stringify(payload);
    pending.current = controller;
    patch({
      hotelSearchStatus: "loading",
      hotelSearchError: "",
      hotelResults: [],
      compareHotelIds: [],
    });
    armTimeout();
    try {
      const capabilities = await getHotelCapabilities(controller.signal);
      const unsupported = unsupportedFilterNames(
        current.current.hotelFilters,
        capabilities,
      );
      if (unsupported.length)
        throw new TravelServiceError(
          "UNSUPPORTED_FILTERS",
          "请先在酒店筛选页主动清除暂不支持的条件：" +
            unsupported.join("、") +
            "。",
        );
      const results = await searchHotelsWithFlyAI(payload, controller.signal);
      if (
        controller.signal.aborted ||
        signature !== JSON.stringify(hotelPayload(current.current))
      )
        return;
      patch({
        hotelResults: results,
        hotelCandidateIds: [
          ...new Set([
            ...selectHighlights(results).map((h) => h.hotel.id),
            ...results.map((h) => h.id),
          ]),
        ].slice(0, 6),
        hotelSearchStatus: results.length ? "success" : "empty",
      });
    } catch (error) {
      if (
        !controller.signal.aborted &&
        signature === JSON.stringify(hotelPayload(current.current))
      )
        patch({
          hotelSearchStatus: "error",
          hotelSearchError: serviceErrorMessage(error),
        });
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (timer.current) clearTimeout(timer.current);
      }
    }
  }, [patch, cancelHotelSearch, armTimeout]);
  useEffect(() => {
    try {
      if (draft.lastUpdatedAt)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      else localStorage.removeItem(STORAGE_KEY);
      setStorageError("");
    } catch {
      setStorageError(
        "浏览器未能保存草稿，请允许本地存储后重试；当前页面仍可继续操作。",
      );
    }
  }, [draft]);
  useEffect(() => () => cancelHotelSearch(), [cancelHotelSearch]);
  const payloadSignature = JSON.stringify(hotelPayload(draft));
  useEffect(() => {
    cancelHotelSearch();
  }, [payloadSignature, cancelHotelSearch]);
  const reset = () => {
    cancelHotelSearch();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* warning is shown by persistence effect */
    }
    setDraft(initialDraft());
  };
  return (
    <Context.Provider
      value={{
        draft,
        patch,
        reset,
        storageError,
        startHotelSearch,
        continueHotelSearch: () => {
          if (pending.current) {
            patch({ hotelSearchStatus: "loading" });
            armTimeout();
          } else startHotelSearch();
        },
        cancelHotelSearch,
      }}
    >
      {children}
    </Context.Provider>
  );
}
