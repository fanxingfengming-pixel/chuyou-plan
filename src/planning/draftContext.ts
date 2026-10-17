import { createContext, useContext } from "react";
import type { TripDraft } from "./types";
interface DraftContext {
  draft: TripDraft;
  patch: (
    patch: Partial<TripDraft> | ((previous: TripDraft) => Partial<TripDraft>),
  ) => void;
  reset: () => void;
  storageError: string;
  startHotelSearch: () => void;
  continueHotelSearch: () => void;
  cancelHotelSearch: () => void;
}
export const Context = createContext<DraftContext | null>(null);
export function useTripDraft() {
  const value = useContext(Context);
  if (!value) throw new Error("TripDraftProvider missing");
  return value;
}
