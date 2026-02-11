import { useHistoryStore } from '../stores/history-store'
import { useMediaStore } from '../stores/media-store'
import { useProjectStore } from '../stores/project-store'
import { useTimelineStore } from '../stores/timeline-store'
import { importMediaFile } from '../services/media-import'
import { deleteMediaAsset } from '../storage/project-persistence'
import { deleteMediaFile, deleteThumbnail } from '../storage/media-storage'
import { computeClipLayouts } from '../utils/timeline-math'
import { nextClipOrder, splitClipAt } from '../utils/clip-operations'
import { newId } from '../utils/id'
import type { ImportResult, MediaAsset } from '../types/media'
import type { Clip } from '../types/project'

export async function importMediaAndAppendClip(file: File): Promise<ImportResult> {
  const project = useProjectStore.getState().currentProject
  if (!project) throw new Error('No active project')

  const media = useMediaStore.getState()
  media.setImporting(true)
  media.setImportProgress(0)

  try {
    const result = await importMediaFile(file, project.id, (progress) => {
      useMediaStore.getState().setImportProgress(progress)
    })

    // If the user switched projects mid-import, don't attach the asset/clip to the wrong project.
    const currentProject = useProjectStore.getState().currentProject
    if (!currentProject || currentProject.id !== project.id) {
      return result
    }

    // Project mutation boundary (undo/redo is project-only for now).
    useHistoryStore.getState().captureBeforeMutation()

    useMediaStore.getState().addAsset(result.asset)

    const order = nextClipOrder(currentProject.timeline.clips)
    const clip: Clip = {
      id: newId('clip'),
      mediaAssetId: result.asset.id,
      trim: { start: 0, duration: result.asset.duration },
      order,
    }

    useProjectStore.getState().addClip(clip)
    useHistoryStore.getState().commitMutation()

    return result
  } catch (err) {
    useHistoryStore.getState().abortMutation()
    throw err
  } finally {
    useMediaStore.getState().setImporting(false)
    useMediaStore.getState().setImportProgress(0)
  }
}

export async function removeMediaAssetAndAssociatedClips(assetId: string): Promise<void> {
  const project = useProjectStore.getState().currentProject

  const asset = useMediaStore.getState().assets.find((a) => a.id === assetId) ?? null

  const clips = project?.timeline.clips ?? []
  const remainingClips = clips.filter((c) => c.mediaAssetId !== assetId)
  const removedClipIds = new Set(clips.filter((c) => c.mediaAssetId === assetId).map((c) => c.id))

  if (removedClipIds.size > 0) {
    useHistoryStore.getState().captureBeforeMutation()
    useProjectStore.getState().reorderClips(remainingClips)
    const selected = useTimelineStore.getState().selectedClipId
    if (selected && removedClipIds.has(selected)) {
      useTimelineStore.getState().selectClip(null)
    }
    useHistoryStore.getState().commitMutation()
  }

  // Remove from in-memory list immediately (UI responsiveness).
  useMediaStore.getState().removeAsset(assetId)

  // Best-effort persistent cleanup.
  try {
    await deleteMediaAsset(assetId)
  } catch {
    // noop
  }
  try {
    if (asset) await deleteMediaFile(asset.opfsPath)
  } catch {
    // noop
  }
  try {
    if (asset?.thumbnailPath) await deleteThumbnail(asset.thumbnailPath)
  } catch {
    // noop
  }
}

export function deleteClip(clipId: string): void {
  const project = useProjectStore.getState().currentProject
  if (!project) return

  const clipExists = project.timeline.clips.some((c) => c.id === clipId)
  if (!clipExists) return

  useHistoryStore.getState().captureBeforeMutation()
  useProjectStore.getState().removeClip(clipId)

  const selected = useTimelineStore.getState().selectedClipId
  if (selected === clipId) useTimelineStore.getState().selectClip(null)

  useHistoryStore.getState().commitMutation()
}

export function splitClipAtPlayhead(clipId: string): void {
  const project = useProjectStore.getState().currentProject
  if (!project) return

  const clips = project.timeline.clips
  const clip = clips.find((c) => c.id === clipId)
  if (!clip) return

  const playheadTime = useTimelineStore.getState().playheadTime
  const pps = useTimelineStore.getState().pixelsPerSecond
  const layouts = computeClipLayouts(clips, pps)
  const layout = layouts.find((l) => l.clipId === clipId)
  if (!layout) return

  if (playheadTime < layout.startTime || playheadTime >= layout.endTime) return

  const splitTimeLocal = playheadTime - layout.startTime
  const result = splitClipAt(clip, splitTimeLocal)
  if (!result) return

  useHistoryStore.getState().captureBeforeMutation()

  const [first, second] = result
  const next = clips.filter((c) => c.id !== clipId)
  next.push(first, second)

  useProjectStore.getState().reorderClips(next)
  useTimelineStore.getState().selectClip(first.id)

  useHistoryStore.getState().commitMutation()
}

// Convenience: used for callers that already have an asset object.
export async function removeAsset(asset: MediaAsset): Promise<void> {
  await removeMediaAssetAndAssociatedClips(asset.id)
}
