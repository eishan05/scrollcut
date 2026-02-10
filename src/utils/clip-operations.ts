import type { Clip } from '../types/project'
import type { TimeRange } from '../types/common'

export function splitClipAt(
  clip: Clip,
  splitTimeLocal: number,
): [Clip, Clip] | null {
  // splitTimeLocal is relative to trim.start
  if (splitTimeLocal <= 0 || splitTimeLocal >= clip.trim.duration) return null

  const firstClip: Clip = {
    id: crypto.randomUUID(),
    mediaAssetId: clip.mediaAssetId,
    trim: {
      start: clip.trim.start,
      duration: splitTimeLocal,
    },
    order: clip.order,
  }

  const secondClip: Clip = {
    id: crypto.randomUUID(),
    mediaAssetId: clip.mediaAssetId,
    trim: {
      start: clip.trim.start + splitTimeLocal,
      duration: clip.trim.duration - splitTimeLocal,
    },
    order: clip.order + 1,
  }

  return [firstClip, secondClip]
}

export function renumberClipOrders(clips: Clip[]): Clip[] {
  const sorted = [...clips].sort((a, b) => a.order - b.order)
  return sorted.map((clip, i) => ({ ...clip, order: i }))
}

export function clampTrim(trim: TimeRange, mediaDuration: number): TimeRange {
  const start = Math.max(0, Math.min(trim.start, mediaDuration))
  const maxDuration = mediaDuration - start
  const duration = Math.max(0.1, Math.min(trim.duration, maxDuration))
  return { start, duration }
}
