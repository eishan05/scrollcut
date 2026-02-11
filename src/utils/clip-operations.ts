import type { Clip } from '../types/project'
import type { TimeRange } from '../types/common'
import { newId } from './id'

function stableClipSort(a: Clip, b: Clip): number {
  const d = a.order - b.order
  if (d !== 0) return d
  // Deterministic tie-breaker in case orders collide.
  return a.id.localeCompare(b.id)
}

export function splitClipAt(
  clip: Clip,
  splitTimeLocal: number,
): [Clip, Clip] | null {
  // splitTimeLocal is relative to trim.start
  if (splitTimeLocal <= 0 || splitTimeLocal >= clip.trim.duration) return null

  const firstClip: Clip = {
    id: newId('clip'),
    mediaAssetId: clip.mediaAssetId,
    trim: {
      start: clip.trim.start,
      duration: splitTimeLocal,
    },
    order: clip.order,
  }

  const secondClip: Clip = {
    id: newId('clip'),
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
  const sorted = [...clips].sort(stableClipSort)
  return sorted.map((clip, i) => ({ ...clip, order: i }))
}

export function nextClipOrder(clips: Clip[]): number {
  let max = -1
  for (const c of clips) max = Math.max(max, c.order)
  return max + 1
}

export function clampTrim(trim: TimeRange, mediaDuration: number): TimeRange {
  const start = Math.max(0, Math.min(trim.start, mediaDuration))
  const maxDuration = mediaDuration - start
  const duration = Math.max(0.1, Math.min(trim.duration, maxDuration))
  return { start, duration }
}
