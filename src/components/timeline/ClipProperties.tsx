import { useTimelineStore } from '../../stores/timeline-store'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'

export function ClipProperties() {
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const clips = useProjectStore((s) => s.currentProject?.timeline.clips) ?? []
  const assets = useMediaStore((s) => s.assets)

  const clip = clips.find((c) => c.id === selectedClipId)
  if (!clip) return null

  const asset = assets.find((a) => a.id === clip.mediaAssetId)

  return (
    <div className="p-3 bg-slate-800 rounded-lg">
      <h3 className="text-xs font-medium text-slate-400 mb-2">Clip Properties</h3>

      <div className="space-y-1.5">
        {asset && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Source</span>
            <span className="text-white truncate ml-2">{asset.fileName}</span>
          </div>
        )}

        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Duration</span>
          <span className="text-white">{clip.trim.duration.toFixed(2)}s</span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Trim Start</span>
          <span className="text-white">{clip.trim.start.toFixed(2)}s</span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Trim End</span>
          <span className="text-white">{(clip.trim.start + clip.trim.duration).toFixed(2)}s</span>
        </div>

        {asset && (
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Media Duration</span>
            <span className="text-white">{asset.duration.toFixed(2)}s</span>
          </div>
        )}

        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Order</span>
          <span className="text-white">#{clip.order + 1}</span>
        </div>
      </div>
    </div>
  )
}
