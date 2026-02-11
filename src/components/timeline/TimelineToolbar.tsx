import { useHistory } from '../../hooks/use-history'
import { useTimelineStore } from '../../stores/timeline-store'
import { deleteClip, splitClipAtPlayhead } from '../../actions/editor-actions'

export function TimelineToolbar() {
  const { undo, redo, canUndo, canRedo } = useHistory()
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)

  const handleSplit = () => {
    if (!selectedClipId) return
    splitClipAtPlayhead(selectedClipId)
  }

  const handleDelete = () => {
    if (!selectedClipId) return
    deleteClip(selectedClipId)
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
