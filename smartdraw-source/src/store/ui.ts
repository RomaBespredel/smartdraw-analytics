import { create } from 'zustand';

export type SectionKey =
  | 'dashboard'
  | 'scanner'
  | 'live'
  | 'leagues'
  | 'journal'
  | 'settings';

interface UIState {
  section: SectionKey;
  setSection: (s: SectionKey) => void;
  /** Optional match id to focus after switching to the live section */
  focusMatchId: string | null;
  setFocusMatchId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  section: 'dashboard',
  setSection: (section) => set({ section }),
  focusMatchId: null,
  setFocusMatchId: (focusMatchId) => set({ focusMatchId }),
}));
