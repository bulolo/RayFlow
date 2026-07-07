import { create } from 'zustand';

interface UIState {
  settingsOpen: boolean;
  platformOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setPlatformOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  platformOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setPlatformOpen: (open) => set({ platformOpen: open }),
}));
