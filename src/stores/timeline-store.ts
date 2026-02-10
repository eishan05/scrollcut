import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface DragState {
  clipId: string
  startOrder: number
  currentInsertIndex: number
  startX: number
  currentX: number
}

export interface TrimState {
  clipId: string
  edge: 'start' | 'end'
  originalStart: number
  originalDuration: number
  startX: number
}

interface TimelineState {
  pixelsPerSecond: number
  scrollX: number
  viewportWidth: number
  playheadTime: number
  isPlaying: boolean
  isScrubbing: boolean
  selectedClipId: string | null
  dragState: DragState | null
  trimState: TrimState | null
  totalDuration: number

  // Actions
  setPixelsPerSecond: (pps: number) => void
  setScrollX: (x: number) => void
  setViewportWidth: (w: number) => void
  setPlayheadTime: (t: number) => void
  setIsPlaying: (playing: boolean) => void
  setIsScrubbing: (scrubbing: boolean) => void
  selectClip: (clipId: string | null) => void
  setDragState: (state: DragState | null) => void
  setTrimState: (state: TrimState | null) => void
  setTotalDuration: (d: number) => void
}

export const useTimelineStore = create<TimelineState>()(subscribeWithSelector((set) => ({
  pixelsPerSecond: 80,
  scrollX: 0,
  viewportWidth: 0,
  playheadTime: 0,
  isPlaying: false,
  isScrubbing: false,
  selectedClipId: null,
  dragState: null,
  trimState: null,
  totalDuration: 0,

  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: Math.max(20, Math.min(300, pps)) }),
  setScrollX: (scrollX) => set({ scrollX }),
  setViewportWidth: (viewportWidth) => set({ viewportWidth }),
  setPlayheadTime: (playheadTime) => set({ playheadTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsScrubbing: (isScrubbing) => set({ isScrubbing }),
  selectClip: (selectedClipId) => set({ selectedClipId }),
  setDragState: (dragState) => set({ dragState }),
  setTrimState: (trimState) => set({ trimState }),
  setTotalDuration: (totalDuration) => set({ totalDuration }),
})))
