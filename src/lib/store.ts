import { create } from "zustand";

export type View = "today" | "history" | "progress" | "coach";

interface RutinaState {
  view: View;
  setView: (v: View) => void;
  activeSessionId: string | null;
  startSession: (id: string) => void;
  endSession: () => void;
}

export const useRutinaStore = create<RutinaState>((set) => ({
  view: "today",
  setView: (view) => set({ view }),
  activeSessionId: null,
  startSession: (activeSessionId) => set({ activeSessionId }),
  endSession: () => set({ activeSessionId: null }),
}));
