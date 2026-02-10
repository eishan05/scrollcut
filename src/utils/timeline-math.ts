import type { Clip } from '../types/project'

export interface ClipLayout {
  clipId: string
  startTime: number
  duration: number
  endTime: number
  left: number
  width: number
  order: number
}

export function timeToPixel(time: number, pps: number): number {
  return time * pps
}

export function pixelToTime(px: number, pps: number): number {
  return px / pps
}

export function computeClipLayouts(clips: Clip[], pps: number): ClipLayout[] {
  const sorted = [...clips].sort((a, b) => a.order - b.order)
  let currentTime = 0

  return sorted.map((clip) => {
    const duration = clip.trim.duration
    const startTime = currentTime
    const endTime = startTime + duration
    const left = timeToPixel(startTime, pps)
    const width = timeToPixel(duration, pps)

    currentTime = endTime

    return {
      clipId: clip.id,
      startTime,
      duration,
      endTime,
      left,
      width,
      order: clip.order,
    }
  })
}

export function computeTotalDuration(clips: Clip[]): number {
  return clips.reduce((sum, c) => sum + c.trim.duration, 0)
}

export function hitTestClip(
  x: number,
  y: number,
  layouts: ClipLayout[],
  trackTop: number,
  trackHeight: number,
): ClipLayout | null {
  if (y < trackTop || y > trackTop + trackHeight) return null
  for (const layout of layouts) {
    if (x >= layout.left && x <= layout.left + layout.width) {
      return layout
    }
  }
  return null
}

export function hitTestTrimHandle(
  x: number,
  y: number,
  layouts: ClipLayout[],
  selectedClipId: string | null,
  trackTop: number,
  trackHeight: number,
  handleWidth: number,
): { clipId: string; edge: 'start' | 'end' } | null {
  if (!selectedClipId) return null
  if (y < trackTop || y > trackTop + trackHeight) return null

  const layout = layouts.find((l) => l.clipId === selectedClipId)
  if (!layout) return null

  // Start handle
  if (Math.abs(x - layout.left) <= handleWidth) {
    return { clipId: selectedClipId, edge: 'start' }
  }
  // End handle
  if (Math.abs(x - (layout.left + layout.width)) <= handleWidth) {
    return { clipId: selectedClipId, edge: 'end' }
  }

  return null
}
