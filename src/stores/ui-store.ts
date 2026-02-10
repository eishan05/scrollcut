import { create } from 'zustand'

export type ActivePanel = 'projects' | 'editor' | 'settings'
export type ActiveSheet = 'none' | 'import' | 'new-project' | 'asset-packs'

interface UIState {
  activePanel: ActivePanel
  activeSheet: ActiveSheet
  isDebugMode: boolean

  setActivePanel: (panel: ActivePanel) => void
  openSheet: (sheet: ActiveSheet) => void
  closeSheet: () => void
  toggleDebugMode: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  activePanel: 'projects',
  activeSheet: 'none',
  isDebugMode: false,

  setActivePanel: (panel) => set({ activePanel: panel }),
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: 'none' }),
  toggleDebugMode: () => set((state) => ({ isDebugMode: !state.isDebugMode })),
}))
