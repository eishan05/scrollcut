import { create } from 'zustand'
import type { MediaAsset } from '../types/media'

interface MediaState {
  assets: MediaAsset[]
  isImporting: boolean
  importProgress: number

  setAssets: (assets: MediaAsset[]) => void
  addAsset: (asset: MediaAsset) => void
  removeAsset: (assetId: string) => void
  setImporting: (importing: boolean) => void
  setImportProgress: (progress: number) => void
}

export const useMediaStore = create<MediaState>()((set) => ({
  assets: [],
  isImporting: false,
  importProgress: 0,

  setAssets: (assets) => set({ assets }),
  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  removeAsset: (assetId) => set((state) => ({
    assets: state.assets.filter((a) => a.id !== assetId),
  })),
  setImporting: (isImporting) => set({ isImporting }),
  setImportProgress: (importProgress) => set({ importProgress }),
}))
