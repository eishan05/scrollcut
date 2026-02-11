import { useCallback, useRef } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'
import { useTimelineStore } from '../../stores/timeline-store'
import { useVideoPreview } from '../../hooks/use-video-preview'
import { usePlaybackEngine } from '../../hooks/use-playback-engine'
import { AspectRatioContainer } from './AspectRatioContainer'
import { resizeCanvasToContainer } from '../../utils/canvas'

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  const scale = Math.max(w / vw, h / vh)
  const dw = vw * scale
  const dh = vh * scale
  const dx = (w - dw) / 2
  const dy = (h - dh) / 2
  ctx.drawImage(video, dx, dy, dw, dh)
}

export function VideoPreview() {
  const project = useProjectStore((s) => s.currentProject)
  const assets = useMediaStore((s) => s.assets)
  const isPlaying = useTimelineStore((s) => s.isPlaying)

  const containerRef = useRef<HTMLDivElement>(null)
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null)
  const freezeVisibleRef = useRef(false)

  const setFreezeVisible = (visible: boolean) => {
    freezeVisibleRef.current = visible
    const canvas = freezeCanvasRef.current
    if (!canvas) return
    if (visible) {
      // Show immediately (don't fade in) so we can cover any black frame.
      canvas.style.transition = 'none'
      canvas.style.opacity = '1'
      requestAnimationFrame(() => {
        const c = freezeCanvasRef.current
        if (c) c.style.transition = 'opacity 80ms linear'
      })
    } else {
      // Fade out quickly to reveal the new decoded video frame.
      canvas.style.transition = 'opacity 80ms linear'
      canvas.style.opacity = '0'
    }
  }

  const handleTransitionStart = useCallback((video: HTMLVideoElement) => {
    const canvas = freezeCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { dpr } = resizeCanvasToContainer(canvas, container)
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    try {
      // If we can't capture a frame (rare, but can happen during early load),
      // don't clear the previous freeze frame: better to show "something" than flash black.
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        ctx.clearRect(0, 0, w, h)
        drawCover(ctx, video, w, h)
        setFreezeVisible(true)
      } else if (freezeVisibleRef.current) {
        setFreezeVisible(true)
      }
    } catch {
      // Keep last freeze frame if present; otherwise, don't show a blank overlay.
      if (!freezeVisibleRef.current) setFreezeVisible(false)
    }
  }, [])

  const handleTransitionEnd = useCallback(() => {
    setFreezeVisible(false)
  }, [])

  const { videoUrl, videoRef, play, pause } = usePlaybackEngine({
    onTransitionStart: handleTransitionStart,
    onTransitionEnd: handleTransitionEnd,
  })

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

  const { canvasRef, playing, fps } = useVideoPreview({ onFrame, videoRef, containerRef, extraCanvasRefs: [freezeCanvasRef] })

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      // On mobile, keep a direct `video.play()` call inside the user gesture.
      // The engine will still ensure the correct clip/src/seek and start syncing.
      const v = videoRef.current
      if (v) {
        try {
          v.muted = true
          void v.play()
        } catch {
          // ignore
        }
      }
      void play()
    }
  }, [isPlaying, pause, play, videoRef])

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
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas
                ref={freezeCanvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ opacity: 0, transition: 'opacity 80ms linear' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ display: playing ? 'block' : 'none' }}
              />
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
            onClick={handleTogglePlay}
            className="bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg active:bg-slate-600"
          >
            {isPlaying ? 'Pause' : 'Play'}
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
