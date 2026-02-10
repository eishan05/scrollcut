import { useHistory } from '../../hooks/use-history'
import { useTimelineStore } from '../../stores/timeline-store'
import { useProjectStore } from '../../stores/project-store'
import { useHistoryStore } from '../../stores/history-store'
import { splitClipAt, renumberClipOrders } from '../../utils/clip-operations'
import { computeClipLayouts } from '../../utils/timeline-math'

export function TimelineToolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory()
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const playheadTime = useTimelineStore((s) => s.playheadTime)

  const handleSplit = () => {
    if (!selectedClipId) return
    const project = useProjectStore.getState().currentProject
    if (!project) return

    const clips = project.timeline.clips
    const pps = useTimelineStore.getState().pixelsPerSecond
    const layouts = computeClipLayouts(clips, pps)
    const layout = layouts.find((l) => l.clipId === selectedClipId)
    if (!layout) return

    // Check playhead is within this clip
    if (playheadTime < layout.startTime || playheadTime >= layout.endTime) return

    const clip = clips.find((c) => c.id === selectedClipId)
    if (!clip) return

    // Split time relative to clip start (local time within the clip's trim)
    const splitTimeLocal = playheadTime - layout.startTime

    const result = splitClipAt(clip, splitTimeLocal)
    if (!result) return

    useHistoryStore.getState().captureBeforeMutation()

    const [first, second] = result
    // Remove original, add two new clips, renumber
    const newClips = clips.filter((c) => c.id !== selectedClipId)
    newClips.push(first, second)
    const renumbered = renumberClipOrders(newClips)

    useProjectStore.getState().reorderClips(renumbered)
    useTimelineStore.getState().selectClip(first.id)

    useHistoryStore.getState().commitMutation()
  }

  const handleDelete = () => {
    if (!selectedClipId) return

    useHistoryStore.getState().captureBeforeMutation()

    useProjectStore.getState().removeClip(selectedClipId)

    // Renumber remaining clips
    const project = useProjectStore.getState().currentProject
    if (project) {
      const renumbered = renumberClipOrders(project.timeline.clips)
      useProjectStore.getState().reorderClips(renumbered)
    }

    useTimelineStore.getState().selectClip(null)
    useHistoryStore.getState().commitMutation()
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-t border-slate-700">
      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="text-xs px-2 py-1 rounded bg-slate-800 text-white disabled:text-slate-600 disabled:bg-slate-800/50 active:bg-slate-700"
      >
        Undo
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="text-xs px-2 py-1 rounded bg-slate-800 text-white disabled:text-slate-600 disabled:bg-slate-800/50 active:bg-slate-700"
      >
        Redo
      </button>

      <div className="flex-1" />

      {/* Clip actions — shown when a clip is selected */}
      {selectedClipId && (
        <>
          <button
            onClick={handleSplit}
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white active:bg-blue-500"
          >
            Split
          </button>
          <button
            onClick={handleDelete}
            className="text-xs px-2 py-1 rounded bg-red-600 text-white active:bg-red-500"
          >
            Delete
          </button>
        </>
      )}
    </div>
  )
}
