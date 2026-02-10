import { useCallback, useEffect, useState } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'
import { readMediaFile } from '../../storage/media-storage'
import { useVideoPreview } from '../../hooks/use-video-preview'
import { AspectRatioContainer } from './AspectRatioContainer'

export function VideoPreview() {
  const project = useProjectStore((s) => s.currentProject)
  const assets = useMediaStore((s) => s.assets)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // Get the first clip's media asset for preview
  const firstClip = project?.timeline.clips[0]
  const activeAsset = firstClip
    ? assets.find((a) => a.id === firstClip.mediaAssetId)
    : assets[0] // Fall back to first imported asset

  // Load video from OPFS when active asset changes
  useEffect(() => {
    let revoked = false

    if (activeAsset) {
      readMediaFile(activeAsset.opfsPath)
        .then((buffer) => {
          if (revoked) return
          const blob = new Blob([buffer], { type: activeAsset.mimeType })
          setVideoUrl(URL.createObjectURL(blob))
        })
        .catch(() => {
          if (!revoked) setVideoUrl(null)
        })
    }

    return () => {
      revoked = true
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [activeAsset])

  const onFrame = useCallback((ctx: CanvasRenderingContext2D, _video: HTMLVideoElement, time: number) => {
    const canvas = ctx.canvas
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr

    // Only draw overlay HUD — the <video> element is visible underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(8, 8, 100, 24)
    ctx.fillStyle = '#fff'
    ctx.font = '12px monospace'
    ctx.fillText(`${time.toFixed(2)}s`, 14, 24)

    // FPS badge (top right)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(w - 70, 8, 62, 24)
  }, [])

  const { videoRef, canvasRef, containerRef, playing, fps, togglePlay } = useVideoPreview({ onFrame })

  const aspectRatio = project?.aspectRatio ?? '9:16'

  return (
    <div className="flex flex-col items-center gap-2">
      <AspectRatioContainer ratio={aspectRatio}>
        <div ref={containerRef} className="absolute inset-0">
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {playing && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none"
                />
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              {assets.length === 0 ? 'Import media to preview' : 'Select a clip'}
            </div>
          )}
        </div>
      </AspectRatioContainer>

      {videoUrl && (
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg active:bg-slate-600"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          {playing && (
            <span className={`text-xs font-mono ${fps >= 25 ? 'text-green-400' : fps >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
              {fps} fps
            </span>
          )}
        </div>
      )}
    </div>
  )
}
